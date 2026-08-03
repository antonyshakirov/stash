'use strict';

// Чистое ядро Reelbox: разбор данных Instagram без единого обращения к браузеру.
// Один и тот же файл грузится в контекст страницы, в контент-скрипт и в тесты,
// поэтому наружу он отдаётся и через globalThis, и через module.exports.

(function (root, factory) {
  const api = factory();
  root.ReelboxExtract = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  // Потолок обхода: живые ответы Instagram огромны, а зациклиться на них нельзя.
  const MAX_NODES = 50000;
  const MAX_NAME_SEGMENT = 60;
  const POST_SEGMENTS = new Set(['reel', 'reels', 'p', 'tv']);
  // Символы, недопустимые в имени файла для Chrome, плюс управляющие.
  const FORBIDDEN_IN_NAME = /[\x00-\x1f\\/:*?"<>|]/g;

  function isObject(value) {
    return value !== null && typeof value === 'object';
  }

  function firstString(node, keys) {
    for (const key of keys) {
      const value = node[key];
      if (typeof value === 'string' && value) return value;
    }
    return null;
  }

  function readUsername(node) {
    for (const key of ['user', 'owner', 'media_owner']) {
      const holder = node[key];
      if (isObject(holder)) {
        const name = firstString(holder, ['username', 'handle']);
        if (name) return name;
      }
    }
    return firstString(node, ['username']);
  }

  function readTakenAt(node) {
    for (const key of ['taken_at', 'taken_at_timestamp', 'device_timestamp']) {
      const value = Number(node[key]);
      // Секунды, не миллисекунды: у Instagram это unix seconds.
      if (Number.isFinite(value) && value > 1000000000 && value < 4000000000) {
        return Math.floor(value);
      }
    }
    return null;
  }

  // Варианты видео у одного объекта-медиа. Основная форма — video_versions,
  // старая веб-схема отдавала одиночный video_url.
  function readVideos(node) {
    const videos = [];

    if (Array.isArray(node.video_versions)) {
      for (const version of node.video_versions) {
        if (!isObject(version)) continue;
        if (typeof version.url !== 'string' || !version.url) continue;
        videos.push({
          url: version.url,
          width: Number(version.width) || 0,
          height: Number(version.height) || 0
        });
      }
    }

    if (typeof node.video_url === 'string' && node.video_url) {
      videos.push({
        url: node.video_url,
        width: Number(node.original_width) || Number(node.dimensions?.width) || 0,
        height: Number(node.original_height) || Number(node.dimensions?.height) || 0
      });
    }

    return videos;
  }

  function mergeItem(previous, candidate) {
    if (!previous) return candidate;
    return {
      code: previous.code || candidate.code,
      pk: previous.pk || candidate.pk,
      username: previous.username || candidate.username,
      takenAt: previous.takenAt || candidate.takenAt,
      videos: previous.videos.length >= candidate.videos.length ? previous.videos : candidate.videos
    };
  }

  /**
   * Обходит произвольную структуру и собирает все медиа с видео.
   * Намеренно не знает путей внутри ответа: ищет по признаку, а не по адресу,
   * чтобы пережить переезд полей на стороне Instagram.
   */
  function collectMedia(payload) {
    const found = new Map();
    const seen = new Set();
    const stack = [payload];
    let visited = 0;

    while (stack.length) {
      const node = stack.pop();
      if (!isObject(node) || seen.has(node)) continue;
      seen.add(node);
      if (++visited > MAX_NODES) break;

      const videos = readVideos(node);
      if (videos.length) {
        const code = firstString(node, ['code', 'shortcode']);
        const pk = firstString(node, ['pk', 'id', 'media_id']);
        const item = {
          code: code || null,
          pk: pk || null,
          username: readUsername(node),
          takenAt: readTakenAt(node),
          videos
        };
        const key = item.code || item.pk || videos[0].url;
        found.set(key, mergeItem(found.get(key), item));
      }

      for (const value of Object.values(node)) {
        if (isObject(value)) stack.push(value);
      }
    }

    return Array.from(found.values());
  }

  /** Самый крупный вариант: для референсов качество важнее веса файла. */
  function bestVideo(videos) {
    if (!Array.isArray(videos) || !videos.length) return null;
    let best = null;
    let bestArea = -1;
    for (const video of videos) {
      if (!video || typeof video.url !== 'string' || !video.url) continue;
      const area = (Number(video.width) || 0) * (Number(video.height) || 0);
      if (area > bestArea) {
        best = video;
        bestArea = area;
      }
    }
    return best;
  }

  function sanitizeSegment(value) {
    return String(value)
      .replace(FORBIDDEN_IN_NAME, '-')
      .replace(/\s+/g, ' ')
      .trim()
      .replace(/^[.\s]+|[.\s]+$/g, '')
      .slice(0, MAX_NAME_SEGMENT);
  }

  // UTC осознанно: имя файла не должно зависеть от часового пояса машины.
  function formatDate(unixSeconds) {
    const date = new Date(unixSeconds * 1000);
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    const day = String(date.getUTCDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  function buildFilename(item) {
    const parts = [];
    const username = item && item.username ? sanitizeSegment(item.username) : '';
    const code = item && item.code ? sanitizeSegment(item.code) : '';

    parts.push(username || 'instagram');
    if (item && item.takenAt) parts.push(formatDate(item.takenAt));
    if (code) parts.push(code);

    return parts.filter(Boolean).join(' — ') + '.mp4';
  }

  /** Код ролика из адреса: /reel/<code>/, /reels/<code>/, /<автор>/reel/<code>/. */
  function codeFromPath(pathname) {
    if (typeof pathname !== 'string') return null;
    const segments = pathname.split('/').filter(Boolean);
    for (let i = 0; i < segments.length - 1; i += 1) {
      if (POST_SEGMENTS.has(segments[i])) {
        const code = segments[i + 1];
        if (/^[A-Za-z0-9_-]+$/.test(code)) return code;
      }
    }
    return null;
  }

  /** Похоже ли на прямую ссылку на файл, а не на blob: из плеера. */
  function isDirectVideoUrl(url) {
    return typeof url === 'string' && /^https?:\/\//i.test(url);
  }

  return {
    collectMedia,
    bestVideo,
    buildFilename,
    sanitizeSegment,
    formatDate,
    codeFromPath,
    isDirectVideoUrl
  };
});
