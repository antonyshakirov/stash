'use strict';

// Словарь Instagram: как из его данных достать медиа и как понять, что
// сейчас открыт пост. Всё, что знает про эту площадку, живёт здесь.

(function (root, factory) {
  const core = root.StashExtract || (typeof require === 'function' ? require('../extract.js') : null);
  const site = factory(core);

  root.StashSites = root.StashSites || { list: [] };
  root.StashSites.list.push(site);
  root.StashSites.instagram = site;

  if (typeof module !== 'undefined' && module.exports) module.exports = site;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (core) {
  const { isObject, firstString, readId, readUnixSeconds } = core;

  const POST_SEGMENTS = new Set(['reel', 'reels', 'p', 'tv']);

  // --- данные -------------------------------------------------------------

  // Варианты видео у одного объекта-медиа. Основная форма — video_versions,
  // старая веб-схема отдавала одиночный video_url.
  function readVideos(node) {
    const videos = [];

    if (Array.isArray(node.video_versions)) {
      for (const version of node.video_versions) {
        if (!isObject(version)) continue;
        const source = core.sourceOf(version.url, version.width, version.height);
        if (source) videos.push(source);
      }
    }

    if (typeof node.video_url === 'string' && node.video_url) {
      videos.push(core.sourceOf(
        node.video_url,
        node.original_width || (node.dimensions && node.dimensions.width),
        node.original_height || (node.dimensions && node.dimensions.height)
      ));
    }

    return videos;
  }

  // Варианты картинки. Основная форма — image_versions2.candidates, старая
  // веб-схема отдавала display_url и display_resources.
  function readImages(node) {
    const images = [];

    const candidates = isObject(node.image_versions2) ? node.image_versions2.candidates : null;
    if (Array.isArray(candidates)) {
      for (const candidate of candidates) {
        if (!isObject(candidate)) continue;
        const source = core.sourceOf(candidate.url, candidate.width, candidate.height);
        if (source) images.push(source);
      }
    }

    if (Array.isArray(node.display_resources)) {
      for (const resource of node.display_resources) {
        if (!isObject(resource)) continue;
        const source = core.sourceOf(resource.src, resource.config_width, resource.config_height);
        if (source) images.push(source);
      }
    }

    if (typeof node.display_url === 'string' && node.display_url) {
      images.push(core.sourceOf(
        node.display_url,
        node.dimensions && node.dimensions.width,
        node.dimensions && node.dimensions.height
      ));
    }

    return images;
  }

  /** Слайды карусели в обеих схемах: новой v1 и старой graphql. */
  function readChildren(node) {
    if (Array.isArray(node.carousel_media)) {
      return node.carousel_media.filter(isObject);
    }
    const edges = isObject(node.edge_sidecar_to_children) ? node.edge_sidecar_to_children.edges : null;
    if (Array.isArray(edges)) {
      return edges.map((edge) => (isObject(edge) ? edge.node : null)).filter(isObject);
    }
    return [];
  }

  function audioTitle(info) {
    const artist = firstString(info, ['display_artist', 'artist_name']);
    const title = firstString(info, ['original_audio_title', 'title', 'song_name']);
    if (artist && title) return `${artist} — ${title}`;
    return title || artist || null;
  }

  /**
   * Прямой адрес звуковой дорожки, если Instagram его дал. Оригинальный звук
   * предпочтительнее музыки: у лицензированной по этому адресу часто отрывок.
   */
  function readAudio(node) {
    const clips = isObject(node.clips_metadata) ? node.clips_metadata : node;

    const own = isObject(clips.original_sound_info) ? clips.original_sound_info : null;
    if (own) {
      const url = firstString(own, ['progressive_download_url']);
      if (url) return { url, title: audioTitle(own) };
    }

    const music = isObject(clips.music_info) ? clips.music_info : null;
    const asset = music && isObject(music.music_asset_info) ? music.music_asset_info : null;
    if (asset) {
      const url = firstString(asset, ['progressive_download_url']);
      if (url) return { url, title: audioTitle(asset) };
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

  function readIdentity(node) {
    return {
      code: firstString(node, ['code', 'shortcode']),
      pk: readId(node, ['pk', 'id', 'media_id']),
      username: readUsername(node),
      takenAt: readUnixSeconds(node, ['taken_at', 'taken_at_timestamp', 'device_timestamp'])
    };
  }

  // --- страница -----------------------------------------------------------

  /** Код поста из адреса: /reel/<код>/, /reels/<код>/, /<автор>/reel/<код>/. */
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

  /**
   * Сохранение работает только на открытом посте. В ленте и в сетке профиля
   * кнопки нет намеренно: там под курсором миниатюра, из неё вышел бы файл
   * хуже оригинала, а какой именно пост имеется в виду — вопрос догадки.
   *
   * Instagram ставит /p/<код>/ и когда пост распахнут модальным окном поверх
   * ленты или профиля, поэтому адреса почти всегда достаточно.
   */
  function codeFromUrl(href) {
    try {
      const base = typeof location !== 'undefined' ? location.href : 'https://example.com/';
      return codeFromPath(new URL(href, base).pathname);
    } catch (error) {
      return null;
    }
  }

  function isOpen(element) {
    if (codeFromPath(location.pathname)) return true;
    return Boolean(element && element.closest && element.closest('div[role="dialog"]'));
  }

  function slideIndexFromUrl() {
    const raw = new URLSearchParams(location.search).get('img_index');
    const value = Number(raw);
    return Number.isInteger(value) && value > 0 ? value : null;
  }

  const LINK_SELECTOR = 'a[href*="/reel/"], a[href*="/reels/"], a[href*="/p/"], a[href*="/tv/"]';

  return {
    id: 'instagram',
    hosts: /(^|\.)instagram\.com$/i,
    cdnHosts: /(^|\.)(cdninstagram\.com|fbcdn\.net)$/i,
    linkSelector: LINK_SELECTOR,
    readVideos,
    readImages,
    readChildren,
    readAudio,
    readIdentity,
    codeFromPath,
    codeFromUrl,
    isOpen,
    slideIndexFromUrl
  };
});
