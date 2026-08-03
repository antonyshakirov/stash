'use strict';

// Что сейчас на экране: элемент, его пост и номер слайда.
// Единственный файл, который знает про вёрстку Instagram.

(function (root) {
  const extract = root.ReelboxExtract;
  if (!extract) return;

  // Порог отсекает аватарки: в шапке профиля на десктопе они 150 CSS-пикселей.
  const MIN_SIDE = 180;
  const CDN_HOST = /(^|\.)(cdninstagram\.com|fbcdn\.net)$/i;

  function visibleBox(element) {
    const box = element.getBoundingClientRect();
    const width = Math.max(0, Math.min(box.right, window.innerWidth) - Math.max(box.left, 0));
    const height = Math.max(0, Math.min(box.bottom, window.innerHeight) - Math.max(box.top, 0));
    return { box, width, height, area: width * height };
  }

  function onCdn(url) {
    if (typeof url !== 'string' || !url) return false;
    try {
      return CDN_HOST.test(new URL(url, location.href).hostname);
    } catch (error) {
      return false;
    }
  }

  /** Постовая картинка: с CDN Instagram и достаточно крупная на экране. */
  function isPostImage(element) {
    if (!element || element.tagName !== 'IMG') return false;
    if (!onCdn(element.currentSrc || element.src)) return false;
    const seen = visibleBox(element);
    return Math.min(seen.width, seen.height) >= MIN_SIDE;
  }

  function isPostVideo(element) {
    if (!element || element.tagName !== 'VIDEO') return false;
    const seen = visibleBox(element);
    return Math.min(seen.width, seen.height) >= MIN_SIDE;
  }

  function largestVisible() {
    let best = null;
    let bestArea = 0;
    for (const element of document.querySelectorAll('video, img')) {
      if (!isPostVideo(element) && !isPostImage(element)) continue;
      const seen = visibleBox(element);
      if (seen.area > bestArea) {
        bestArea = seen.area;
        best = element;
      }
    }
    return best;
  }

  // --- поиск слайда --------------------------------------------------------

  function indexFromUrl() {
    const raw = new URLSearchParams(location.search).get('img_index');
    const value = Number(raw);
    return Number.isInteger(value) && value > 0 ? value : null;
  }

  /** Позиция слайда в карусели по положению его <li> среди соседей. */
  function indexFromDom(element) {
    const item = element.closest ? element.closest('li') : null;
    if (!item || !item.parentElement) return null;
    const siblings = Array.from(item.parentElement.children).filter((node) => node.tagName === 'LI');
    const position = siblings.indexOf(item);
    return position >= 0 ? position + 1 : null;
  }

  function codeFromNearestLink(element) {
    let node = element;
    for (let depth = 0; node && depth < 12; depth += 1) {
      const link = node.querySelector
        ? node.querySelector('a[href*="/reel/"], a[href*="/reels/"], a[href*="/p/"], a[href*="/tv/"]')
        : null;
      if (link) {
        try {
          const code = extract.codeFromPath(new URL(link.href, location.origin).pathname);
          if (code) return code;
        } catch (error) {
          /* битая ссылка, идём выше */
        }
      }
      node = node.parentElement;
    }
    return null;
  }

  function create(cache) {
    let hovered = null;

    function resolve(element) {
      if (!element) return null;

      // Основной путь: адрес самого файла ведёт прямо в слайд.
      const byKey = cache.findByMediaKey(extract.mediaKeyFromUrl(element.currentSrc || element.src));
      if (byKey) return { element, post: byKey.post, slide: byKey.slide, guessed: false };

      // У видео в src обычно blob:, поэтому пост ищется по адресу страницы.
      const code = extract.codeFromPath(location.pathname) || codeFromNearestLink(element);
      const post = code ? cache.get(code) : null;
      // Цель на экране есть, данных о ней нет. Возвращаем её всё равно:
      // кнопка должна появиться и честно сказать, что источник не найден,
      // а не молча исчезнуть.
      if (!post) return { element, post: null, slide: null, guessed: false };

      const wanted = indexFromUrl() || indexFromDom(element);
      const slide = post.slides.find((candidate) => candidate.index === wanted);
      if (slide) return { element, post, slide, guessed: false };

      return { element, post, slide: post.slides[0], guessed: post.slides.length > 1 };
    }

    return {
      setHovered(element) {
        if (isPostImage(element) || isPostVideo(element)) hovered = element;
      },
      current() {
        return resolve(largestVisible());
      }
    };
  }

  root.ReelboxTarget = { create, isPostImage, isPostVideo, visibleBox };
})(typeof globalThis !== 'undefined' ? globalThis : this);
