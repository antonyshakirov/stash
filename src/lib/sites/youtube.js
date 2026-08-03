'use strict';

// Словарь YouTube. Здесь всё устроено иначе, чем на Instagram и TikTok, и это
// объяснено в спеке: готовых ссылок на файлы YouTube почти не отдаёт, видео и
// звук идут раздельными потоками, а адреса закрыты подписью.
//
// Мы ничего не расшифровываем. Плеер уже подписал адреса, чтобы проиграть
// ролик, и запрашивает по ним куски через `videoplayback`. Эти запросы видит
// перехватчик: мы берём готовый рабочий адрес, отбрасываем параметры куска и
// забираем поток целиком.

(function (root, factory) {
  const core = root.StashExtract || (typeof require === 'function' ? require('../extract.js') : null);
  const site = factory(core);

  root.StashSites = root.StashSites || { list: [] };
  root.StashSites.list.push(site);
  root.StashSites.youtube = site;

  if (typeof module !== 'undefined' && module.exports) module.exports = site;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (core) {
  const { isObject, firstString } = core;

  // Параметры куска: без них тот же адрес отдаёт файл целиком.
  const CHUNK_PARAMS = ['range', 'rn', 'rbuf'];

  // --- разбор ответа плеера ------------------------------------------------

  function kindOfMime(mime) {
    return typeof mime === 'string' && mime.indexOf('audio/') === 0 ? 'audio' : 'video';
  }

  /**
   * Форматы из ответа плеера. `formats` — прогрессивные, звук и видео уже
   * вместе; `adaptiveFormats` — раздельные потоки.
   */
  function collectFormats(payload) {
    const data = isObject(payload) && isObject(payload.streamingData) ? payload.streamingData : null;
    if (!data) return [];

    const out = [];
    const groups = [
      { list: data.formats, progressive: true },
      { list: data.adaptiveFormats, progressive: false }
    ];

    for (const group of groups) {
      if (!Array.isArray(group.list)) continue;
      for (const format of group.list) {
        if (!isObject(format) || format.itag === undefined) continue;
        const mime = typeof format.mimeType === 'string' ? format.mimeType : '';
        out.push({
          itag: String(format.itag),
          mime,
          kind: group.progressive ? 'both' : kindOfMime(mime),
          progressive: group.progressive,
          width: Number(format.width) || 0,
          height: Number(format.height) || 0,
          bitrate: Number(format.bitrate) || 0,
          size: Number(format.contentLength) || 0,
          // Форматы с signatureCipher пропускаем: расшифровывать подпись мы
          // не будем, их рабочий адрес всё равно придёт от перехватчика.
          url: typeof format.url === 'string' && format.url ? format.url : null
        });
      }
    }

    return out;
  }

  function readIdentity(payload) {
    const details = isObject(payload) && isObject(payload.videoDetails) ? payload.videoDetails : null;
    if (!details) return null;

    const micro = isObject(payload.microformat) ? payload.microformat.playerMicroformatRenderer : null;
    const date = isObject(micro) ? firstString(micro, ['publishDate', 'uploadDate']) : null;
    const parsed = date ? Date.parse(date) : NaN;

    return {
      code: firstString(details, ['videoId']),
      username: firstString(details, ['author', 'ownerChannelName']),
      title: firstString(details, ['title']),
      takenAt: Number.isFinite(parsed) ? Math.floor(parsed / 1000) : null
    };
  }

  // --- перехваченные потоки ------------------------------------------------

  /** Описание потока по адресу `videoplayback`, который плеер уже подписал. */
  function streamFromUrl(raw) {
    if (typeof raw !== 'string' || raw.indexOf('videoplayback') === -1) return null;

    let url;
    try {
      url = new URL(raw, location.href);
    } catch (error) {
      return null;
    }

    if (url.pathname.indexOf('videoplayback') === -1) return null;

    const itag = url.searchParams.get('itag');
    if (!itag) return null;

    const mime = url.searchParams.get('mime') || '';
    for (const name of CHUNK_PARAMS) url.searchParams.delete(name);

    return {
      itag: String(itag),
      mime,
      kind: kindOfMime(mime),
      size: Number(url.searchParams.get('clen')) || 0,
      url: url.toString()
    };
  }

  // --- выбор потоков -------------------------------------------------------

  function isMp4(entry) {
    return typeof entry.mime === 'string' && entry.mime.indexOf('mp4') !== -1;
  }

  function rank(entry) {
    return (entry.width || 0) * (entry.height || 0) || entry.bitrate || entry.size || 0;
  }

  function bestOf(entries) {
    let best = null;
    for (const entry of entries) {
      if (!best || rank(entry) > rank(best)) best = entry;
    }
    return best;
  }

  /**
   * Что можно сохранить прямо сейчас. Метаданные берутся из ответа плеера,
   * рабочие адреса — из перехваченных запросов, сводятся они по itag.
   */
  function choose(state) {
    const known = new Map();
    for (const format of state.formats) known.set(format.itag, format);

    const ready = [];
    for (const stream of state.streams.values()) {
      const meta = known.get(stream.itag) || {};
      ready.push({
        itag: stream.itag,
        url: stream.url,
        mime: stream.mime || meta.mime || '',
        kind: meta.progressive ? 'both' : stream.kind,
        progressive: Boolean(meta.progressive),
        width: meta.width || 0,
        height: meta.height || 0,
        bitrate: meta.bitrate || 0,
        size: stream.size || meta.size || 0
      });
    }

    // Форматы, у которых адрес пришёл открытым, тоже годятся.
    for (const format of state.formats) {
      if (!format.url) continue;
      if (state.streams.has(format.itag)) continue;
      ready.push(Object.assign({}, format));
    }

    const progressive = ready.filter((entry) => entry.progressive);
    const videoOnly = ready.filter((entry) => entry.kind === 'video' && !entry.progressive);
    const audioOnly = ready.filter((entry) => entry.kind === 'audio');

    // AAC в mp4 предпочтительнее opus в webm: он открывается на айфоне
    // нативно и его можно сложить с видео в один mp4.
    const audioMp4 = audioOnly.filter(isMp4);

    return {
      progressive: bestOf(progressive),
      video: bestOf(videoOnly.filter(isMp4)) || bestOf(videoOnly),
      audio: bestOf(audioMp4) || bestOf(audioOnly)
    };
  }

  // --- страница -----------------------------------------------------------

  function codeFromUrl(href) {
    let url;
    try {
      url = new URL(href, location.href);
    } catch (error) {
      return null;
    }

    const segments = url.pathname.split('/').filter(Boolean);
    const shorts = segments.indexOf('shorts');
    if (shorts !== -1 && segments[shorts + 1]) return segments[shorts + 1];
    if (segments[0] === 'watch') return url.searchParams.get('v');
    return null;
  }

  function isOpen() {
    return Boolean(codeFromUrl(location.href));
  }

  /**
   * Инлайновые данные YouTube лежат не в `script[type="application/json"]`,
   * а присваиванием в обычном скрипте, поэтому вытаскиваются отдельно.
   */
  function jsonAfter(text, marker) {
    const at = text.indexOf(marker);
    if (at === -1) return null;

    const start = text.indexOf('{', at + marker.length);
    if (start === -1) return null;

    let depth = 0;
    let inString = false;
    let escaped = false;

    for (let i = start; i < text.length; i += 1) {
      const char = text[i];

      if (inString) {
        if (escaped) escaped = false;
        else if (char === '\\') escaped = true;
        else if (char === '"') inString = false;
        continue;
      }

      if (char === '"') inString = true;
      else if (char === '{') depth += 1;
      else if (char === '}') {
        depth -= 1;
        if (!depth) {
          try {
            return JSON.parse(text.slice(start, i + 1));
          } catch (error) {
            return null;
          }
        }
      }
    }

    return null;
  }

  function scanInline(doc) {
    const payloads = [];
    for (const script of doc.querySelectorAll('script')) {
      const text = script.textContent;
      if (!text || text.indexOf('ytInitialPlayerResponse') === -1) continue;
      const payload = jsonAfter(text, 'ytInitialPlayerResponse');
      if (payload) payloads.push(payload);
    }
    return payloads;
  }

  return {
    id: 'youtube',
    hosts: /(^|\.)(youtube\.com|youtu\.be)$/i,
    cdnHosts: /(^|\.)(googlevideo\.com|ytimg\.com)$/i,
    linkSelector: 'a[href*="/watch"], a[href*="/shorts/"]',
    // Общий обходчик для YouTube не используется: медиа собирается из
    // перехваченных потоков, см. choose().
    readVideos: () => [],
    readImages: () => [],
    readChildren: () => [],
    readAudio: () => null,
    readIdentity: () => ({}),
    codeFromUrl,
    codeFromPath: (pathname) => codeFromUrl(`https://www.youtube.com${pathname || '/'}`),
    isOpen,
    slideIndexFromUrl: () => null,
    // Своё, чего нет у других площадок.
    usesStreams: true,
    collectFormats,
    readPlayerIdentity: readIdentity,
    streamFromUrl,
    choose,
    scanInline
  };
});
