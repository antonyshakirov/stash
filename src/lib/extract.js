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
  // Расширения, которые Instagram реально отдаёт. Всё прочее — не наше дело.
  const KNOWN_EXTENSIONS = new Set(['jpg', 'jpeg', 'png', 'webp', 'heic', 'mp4']);

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

  // Идентификатор приходит и строкой, и числом: pk у Instagram числовой.
  function readId(node, keys) {
    for (const key of keys) {
      const value = node[key];
      if (typeof value === 'string' && value) return value;
      if (typeof value === 'number' && Number.isFinite(value)) return String(value);
    }
    return null;
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

  // Варианты картинки у одного объекта-медиа. Основная форма —
  // image_versions2.candidates, старая веб-схема отдавала display_url
  // и display_resources.
  function readImages(node) {
    const images = [];

    const candidates = isObject(node.image_versions2) ? node.image_versions2.candidates : null;
    if (Array.isArray(candidates)) {
      for (const candidate of candidates) {
        if (!isObject(candidate)) continue;
        if (typeof candidate.url !== 'string' || !candidate.url) continue;
        images.push({
          url: candidate.url,
          width: Number(candidate.width) || 0,
          height: Number(candidate.height) || 0
        });
      }
    }

    if (Array.isArray(node.display_resources)) {
      for (const resource of node.display_resources) {
        if (!isObject(resource)) continue;
        if (typeof resource.src !== 'string' || !resource.src) continue;
        images.push({
          url: resource.src,
          width: Number(resource.config_width) || 0,
          height: Number(resource.config_height) || 0
        });
      }
    }

    if (typeof node.display_url === 'string' && node.display_url) {
      images.push({
        url: node.display_url,
        width: Number(node.dimensions && node.dimensions.width) || 0,
        height: Number(node.dimensions && node.dimensions.height) || 0
      });
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

  // У видео-поста есть и обложка, и само видео. Обложка нам не нужна:
  // сохранение обложек отдельно от поста в границы не входит.
  function readSlide(node, index) {
    const videos = readVideos(node);
    if (videos.length) return { index, kind: 'video', sources: videos };
    const images = readImages(node);
    if (images.length) return { index, kind: 'image', sources: images };
    return null;
  }

  function buildPost(node, slides) {
    return {
      code: firstString(node, ['code', 'shortcode']),
      pk: readId(node, ['pk', 'id', 'media_id']),
      username: readUsername(node),
      takenAt: readTakenAt(node),
      slides
    };
  }

  function postKey(post) {
    return post.code || post.pk || (post.slides[0] && post.slides[0].sources[0].url) || null;
  }

  /** Один пост приходит несколько раз и разной полноты: берём лучшее из обоих. */
  function mergePosts(previous, candidate) {
    if (!previous) return candidate;
    if (!candidate) return previous;
    return {
      code: previous.code || candidate.code,
      pk: previous.pk || candidate.pk,
      username: previous.username || candidate.username,
      takenAt: previous.takenAt || candidate.takenAt,
      slides: previous.slides.length >= candidate.slides.length ? previous.slides : candidate.slides
    };
  }

  /**
   * Обходит произвольную структуру и собирает посты со слайдами.
   * Намеренно не знает путей внутри ответа: ищет по признаку, а не по адресу,
   * чтобы пережить переезд полей на стороне Instagram.
   */
  function collectMedia(payload) {
    const seen = new Set();
    // Дети карусели: они уже учтены как слайды и своими постами быть не должны.
    const consumed = new Set();
    const drafts = [];
    const stack = [payload];
    let visited = 0;

    while (stack.length) {
      const node = stack.pop();
      if (!isObject(node) || seen.has(node)) continue;
      seen.add(node);
      if (++visited > MAX_NODES) break;

      const children = readChildren(node);
      if (children.length) {
        const slides = [];
        for (const child of children) {
          consumed.add(child);
          const slide = readSlide(child, slides.length + 1);
          if (slide) slides.push(slide);
        }
        if (slides.length) drafts.push({ node, post: buildPost(node, slides) });
      } else {
        const slide = readSlide(node, 1);
        if (slide) drafts.push({ node, post: buildPost(node, [slide]) });
      }

      for (const value of Object.values(node)) {
        if (isObject(value)) stack.push(value);
      }
    }

    // Отсев детей делается после обхода: порядок обхода не гарантирован,
    // и ребёнок мог быть разобран раньше своего родителя.
    const found = new Map();
    for (const draft of drafts) {
      if (consumed.has(draft.node)) continue;
      const key = postKey(draft.post);
      if (!key) continue;
      found.set(key, mergePosts(found.get(key), draft.post));
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

  /**
   * Последний сегмент пути CDN-адреса. У Instagram он один и тот же для
   * одного файла в любом размере: размер живёт в query (`stp`), подпись в
   * `oh` и `oe`, и они меняются от запроса к запросу.
   */
  function mediaKeyFromUrl(url) {
    if (typeof url !== 'string' || !url) return null;
    const path = url.split('?')[0].split('#')[0];
    const segment = path.slice(path.lastIndexOf('/') + 1);
    return segment || null;
  }

  function extensionFromUrl(url, kind) {
    const fallback = kind === 'video' ? 'mp4' : 'jpg';
    const key = mediaKeyFromUrl(url);
    if (!key) return fallback;
    const dot = key.lastIndexOf('.');
    if (dot < 1) return fallback;
    const extension = key.slice(dot + 1).toLowerCase();
    return KNOWN_EXTENSIONS.has(extension) ? extension : fallback;
  }

  return {
    collectMedia,
    mergePosts,
    mediaKeyFromUrl,
    extensionFromUrl,
    bestVideo,
    buildFilename,
    sanitizeSegment,
    formatDate,
    codeFromPath,
    isDirectVideoUrl
  };
});
