'use strict';

// Словарь TikTok. Данные приходят и в ответах API, и в инлайновом JSON
// первой загрузки (`__UNIVERSAL_DATA_FOR_REHYDRATION__`, у старых сборок
// `SIGI_STATE`) — оба пути уже поддержаны общим обходчиком.

(function (root, factory) {
  const core = root.StashExtract || (typeof require === 'function' ? require('../extract.js') : null);
  const site = factory(core);

  root.StashSites = root.StashSites || { list: [] };
  root.StashSites.list.push(site);
  root.StashSites.tiktok = site;

  if (typeof module !== 'undefined' && module.exports) module.exports = site;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (core) {
  const { isObject, firstString, readId, readUnixSeconds } = core;

  // --- данные -------------------------------------------------------------

  /**
   * Ролик читается на уровне записи, а не изнутри `video`: иначе объект
   * `video` всплыл бы отдельным постом без автора и даты.
   *
   * Берём `playAddr`, а не `downloadAddr`: во второй TikTok впечатывает
   * водяной знак.
   */
  function readVideos(node) {
    const video = isObject(node.video) ? node.video : null;
    if (!video) return [];

    const videos = [];
    const width = Number(video.width) || 0;
    const height = Number(video.height) || 0;

    if (Array.isArray(video.bitrateInfo)) {
      for (const entry of video.bitrateInfo) {
        if (!isObject(entry) || !isObject(entry.PlayAddr)) continue;
        const list = entry.PlayAddr.UrlList;
        if (!Array.isArray(list) || !list.length) continue;
        const source = core.sourceOf(
          list[0],
          entry.PlayAddr.Width || width,
          entry.PlayAddr.Height || height
        );
        if (source) videos.push(source);
      }
    }

    const plain = core.sourceOf(video.playAddr, width, height);
    if (plain) videos.push(plain);

    return videos;
  }

  /** Кадр слайдшоу. В `urlList` лежат зеркала одного файла, а не размеры. */
  function readImages(node) {
    const holder = isObject(node.imageURL) ? node.imageURL : null;
    if (!holder || !Array.isArray(holder.urlList)) return [];

    const images = [];
    for (const url of holder.urlList) {
      const source = core.sourceOf(url, node.imageWidth, node.imageHeight);
      if (source) images.push(source);
    }
    return images;
  }

  /** Слайдшоу: кадры лежат в imagePost.images и разворачиваются в слайды. */
  function readChildren(node) {
    const post = isObject(node.imagePost) ? node.imagePost : null;
    if (!post || !Array.isArray(post.images)) return [];
    return post.images.filter(isObject);
  }

  /** У TikTok звук лежит готовым файлом, разбирать mp4 для него не нужно. */
  function readAudio(node) {
    const music = isObject(node.music) ? node.music : null;
    if (!music) return null;

    const url = firstString(music, ['playUrl']);
    if (!url) return null;

    const artist = firstString(music, ['authorName']);
    const title = firstString(music, ['title']);
    return { url, title: artist && title ? `${artist} — ${title}` : title || artist || null };
  }

  function readIdentity(node) {
    const author = isObject(node.author) ? node.author : {};
    const id = readId(node, ['id']);
    return {
      code: id,
      pk: id,
      username: firstString(author, ['uniqueId', 'nickname']),
      takenAt: readUnixSeconds(node, ['createTime'])
    };
  }

  // --- страница -----------------------------------------------------------

  /** Адрес открытой записи: /@автор/video/<id> и /@автор/photo/<id>. */
  function codeFromPath(pathname) {
    if (typeof pathname !== 'string') return null;
    const segments = pathname.split('/').filter(Boolean);
    for (let i = 0; i < segments.length - 1; i += 1) {
      if (segments[i] === 'video' || segments[i] === 'photo') {
        const code = segments[i + 1];
        if (/^\d+$/.test(code)) return code;
      }
    }
    return null;
  }

  function isOpen() {
    return Boolean(codeFromPath(location.pathname));
  }

  /** Номер кадра в слайдшоу TikTok в адрес не попадает. */
  function slideIndexFromUrl() {
    return null;
  }

  return {
    id: 'tiktok',
    hosts: /(^|\.)tiktok\.com$/i,
    cdnHosts: /(^|\.)(tiktokcdn\.com|tiktokcdn-us\.com|tiktokv\.com|ibyteimg\.com|byteoversea\.com)$/i,
    linkSelector: 'a[href*="/video/"], a[href*="/photo/"]',
    readVideos,
    readImages,
    readChildren,
    readAudio,
    readIdentity,
    codeFromPath,
    isOpen,
    slideIndexFromUrl
  };
});
