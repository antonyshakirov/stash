'use strict';

// Кэш вкладки: посты по идентификатору и слайды по ключу файла на CDN.
// Вторая карта нужна, чтобы картинка на экране находила свой слайд одним
// обращением, а не перебором всех постов на каждое движение мыши.
// Чистый модуль: ни document, ни chrome, ни сети.

(function (root, factory) {
  const extract = root.ReelboxExtract || (typeof require === 'function' ? require('./extract.js') : null);
  const api = factory(extract);
  root.ReelboxCache = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (extract) {
  function isObject(value) {
    return value !== null && typeof value === 'object';
  }

  function identify(post) {
    return post.code || post.pk || null;
  }

  function create() {
    const posts = new Map();
    const keys = new Map();

    function indexSlides(id, post) {
      for (const slide of post.slides) {
        for (const source of slide.sources) {
          const key = extract.mediaKeyFromUrl(source.url);
          if (key) keys.set(key, { id, index: slide.index });
        }
      }
    }

    function ingest(list) {
      if (!Array.isArray(list)) return 0;
      let accepted = 0;

      for (const post of list) {
        if (!isObject(post) || !Array.isArray(post.slides) || !post.slides.length) continue;
        const id = identify(post);
        if (!id) continue;

        const merged = extract.mergePosts(posts.get(id), post);
        posts.set(id, merged);
        indexSlides(id, merged);
        accepted += 1;
      }

      return accepted;
    }

    function get(id) {
      return posts.get(id) || null;
    }

    function findByMediaKey(key) {
      if (!key) return null;
      const hit = keys.get(key);
      if (!hit) return null;
      const post = posts.get(hit.id);
      if (!post) return null;
      const slide = post.slides.find((candidate) => candidate.index === hit.index);
      return slide ? { post, slide } : null;
    }

    return { ingest, get, findByMediaKey, count: () => posts.size };
  }

  return { create };
});
