'use strict';

// Чистое ядро Stash: обход произвольных данных, имена файлов, ключи.
// Про конкретные площадки не знает ничего — словарь полей приходит снаружи,
// см. `src/lib/sites/*`. Один и тот же файл грузится в контекст страницы,
// в контент-скрипт и в тесты, поэтому наружу он отдаётся и через globalThis,
// и через module.exports.

(function (root, factory) {
  const api = factory();
  root.StashExtract = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  // Потолок обхода: живые ответы площадок огромны, а зациклиться на них нельзя.
  const MAX_NODES = 50000;
  const MAX_NAME_SEGMENT = 60;
  // Символы, недопустимые в имени файла для Chrome, плюс управляющие.
  const FORBIDDEN_IN_NAME = /[\x00-\x1f\\/:*?"<>|]/g;
  // Расширения, которые площадки реально отдают. Всё прочее — не наше дело.
  const KNOWN_EXTENSIONS = new Set([
    'jpg', 'jpeg', 'png', 'webp', 'heic',
    'mp4', 'm4a', 'aac', 'mp3', 'webm', 'weba', 'opus'
  ]);

  // --- мелочь, нужная и здесь, и словарям площадок ------------------------

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

  // Идентификатор приходит и строкой, и числом: pk у Instagram числовой.
  function readId(node, keys) {
    for (const key of keys) {
      const value = node[key];
      if (typeof value === 'string' && value) return value;
      if (typeof value === 'number' && Number.isFinite(value)) return String(value);
    }
    return null;
  }

  /** Unix-секунды, а не миллисекунды: отсечка по разумному диапазону дат. */
  function readUnixSeconds(node, keys) {
    for (const key of keys) {
      const value = Number(node[key]);
      if (Number.isFinite(value) && value > 1000000000 && value < 4000000000) {
        return Math.floor(value);
      }
    }
    return null;
  }

  function sourceOf(url, width, height) {
    if (typeof url !== 'string' || !url) return null;
    return { url, width: Number(width) || 0, height: Number(height) || 0 };
  }

  // --- обход --------------------------------------------------------------

  // У видео-поста есть и обложка, и само видео. Обложка нам не нужна:
  // сохранение обложек отдельно от поста в границы не входит.
  function readSlide(vocab, node, index) {
    const videos = vocab.readVideos(node) || [];
    if (videos.length) return { index, kind: 'video', sources: videos };
    const images = vocab.readImages(node) || [];
    if (images.length) return { index, kind: 'image', sources: images };
    return null;
  }

  function buildPost(vocab, node, slides) {
    const identity = vocab.readIdentity(node) || {};
    return {
      code: identity.code || null,
      pk: identity.pk || null,
      username: identity.username || null,
      takenAt: identity.takenAt || null,
      audio: (vocab.readAudio && vocab.readAudio(node)) || null,
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
      audio: previous.audio || candidate.audio,
      slides: previous.slides.length >= candidate.slides.length ? previous.slides : candidate.slides
    };
  }

  /**
   * Обходит произвольную структуру и собирает посты со слайдами.
   * Намеренно не знает путей внутри ответа: ищет по признаку, а не по адресу,
   * чтобы пережить переезд полей на стороне площадки.
   */
  function collectMedia(payload, vocab) {
    if (!vocab) return [];

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

      const children = (vocab.readChildren && vocab.readChildren(node)) || [];
      if (children.length) {
        const slides = [];
        for (const child of children) {
          consumed.add(child);
          const slide = readSlide(vocab, child, slides.length + 1);
          if (slide) slides.push(slide);
        }
        if (slides.length) drafts.push({ node, post: buildPost(vocab, node, slides) });
      } else {
        const slide = readSlide(vocab, node, 1);
        if (slide) drafts.push({ node, post: buildPost(vocab, node, [slide]) });
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

  // --- выбор и имена ------------------------------------------------------

  /** Самый крупный вариант: для референсов качество важнее веса файла. */
  function bestSource(sources) {
    if (!Array.isArray(sources) || !sources.length) return null;
    let best = null;
    let bestArea = -1;
    for (const source of sources) {
      if (!source || typeof source.url !== 'string' || !source.url) continue;
      const area = (Number(source.width) || 0) * (Number(source.height) || 0);
      if (area > bestArea) {
        best = source;
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

  /**
   * Последний сегмент пути CDN-адреса. У Instagram он один и тот же для
   * одного файла в любом размере: размер живёт в query, подпись тоже,
   * и они меняются от запроса к запросу. Сам файл — нет.
   */
  function mediaKeyFromUrl(url) {
    if (typeof url !== 'string' || !url) return null;
    const path = url.split('?')[0].split('#')[0];
    const segment = path.slice(path.lastIndexOf('/') + 1);
    return segment || null;
  }

  function extensionFromUrl(url, kind) {
    let fallback = 'jpg';
    if (kind === 'video') fallback = 'mp4';
    if (kind === 'audio') fallback = 'm4a';

    const key = mediaKeyFromUrl(url);
    if (!key) return fallback;
    const dot = key.lastIndexOf('.');
    if (dot < 1) return fallback;
    const extension = key.slice(dot + 1).toLowerCase();
    return KNOWN_EXTENSIONS.has(extension) ? extension : fallback;
  }

  function buildFilename(post, slide) {
    const parts = [];
    const username = post && post.username ? sanitizeSegment(post.username) : '';
    const id = post && (post.code || post.pk) ? sanitizeSegment(post.code || post.pk) : '';

    parts.push(username || 'stash');
    if (post && post.takenAt) parts.push(formatDate(post.takenAt));
    if (id) parts.push(id);

    // Номер нужен только там, где слайдов больше одного: у обычного поста
    // хвост « — 1» был бы шумом.
    const many = post && Array.isArray(post.slides) && post.slides.length > 1;
    if (many && slide && slide.index) parts.push(String(slide.index));

    const source = slide ? bestSource(slide.sources) : null;
    const extension = extensionFromUrl(source && source.url, slide && slide.kind);

    return parts.filter(Boolean).join(' — ') + '.' + extension;
  }

  function folderFor(kind) {
    if (kind === 'video') return 'Reels';
    if (kind === 'audio') return 'Audio';
    return 'Photos';
  }

  /**
   * Ключ «уже сохранено». У поста с одним слайдом это просто код, поэтому
   * ролики, сохранённые прошлой версией, не поедут заново.
   */
  function downloadKey(post, slide) {
    const id = (post && (post.code || post.pk)) || null;
    if (!id) return null;
    const many = post && Array.isArray(post.slides) && post.slides.length > 1;
    return many && slide && slide.index ? `${id}#${slide.index}` : String(id);
  }

  /** Похоже ли на прямую ссылку на файл, а не на blob: из плеера. */
  function isDirectVideoUrl(url) {
    return typeof url === 'string' && /^https?:\/\//i.test(url);
  }

  return {
    collectMedia,
    mergePosts,
    bestSource,
    buildFilename,
    folderFor,
    downloadKey,
    mediaKeyFromUrl,
    extensionFromUrl,
    sanitizeSegment,
    formatDate,
    isDirectVideoUrl,
    // Для словарей площадок.
    isObject,
    firstString,
    readId,
    readUnixSeconds,
    sourceOf
  };
});
