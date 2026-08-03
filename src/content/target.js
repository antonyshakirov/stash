'use strict';

// Что сейчас на экране: элемент, его пост и номер слайда.
// Правила конкретной площадки берутся из её словаря, здесь только общая
// механика: какой элемент считать постовым и как найти его слайд.

(function (root) {
  const extract = root.StashExtract;
  if (!extract) return;

  // Порог отсекает аватарки: в шапке профиля на десктопе они 150 CSS-пикселей.
  const MIN_SIDE = 180;

  function visibleBox(element) {
    const box = element.getBoundingClientRect();
    const width = Math.max(0, Math.min(box.right, window.innerWidth) - Math.max(box.left, 0));
    const height = Math.max(0, Math.min(box.bottom, window.innerHeight) - Math.max(box.top, 0));
    return { box, width, height, area: width * height };
  }

  function onCdn(site, url) {
    if (typeof url !== 'string' || !url) return false;
    try {
      return site.cdnHosts.test(new URL(url, location.href).hostname);
    } catch (error) {
      return false;
    }
  }

  /** Постовая картинка: с CDN площадки и достаточно крупная на экране. */
  function isPostImage(site, element) {
    if (!element || element.tagName !== 'IMG') return false;
    if (!onCdn(site, element.currentSrc || element.src)) return false;
    const seen = visibleBox(element);
    return Math.min(seen.width, seen.height) >= MIN_SIDE;
  }

  function isPostVideo(element) {
    if (!element || element.tagName !== 'VIDEO') return false;
    const seen = visibleBox(element);
    return Math.min(seen.width, seen.height) >= MIN_SIDE;
  }

  function largestVisible(site) {
    let best = null;
    let bestArea = 0;
    for (const element of document.querySelectorAll('video, img')) {
      if (!isPostVideo(element) && !isPostImage(site, element)) continue;
      if (!site.isOpen(element)) continue;
      const seen = visibleBox(element);
      if (seen.area > bestArea) {
        bestArea = seen.area;
        best = element;
      }
    }
    return best;
  }

  /** Позиция слайда в карусели по положению его <li> среди соседей. */
  function indexFromDom(element) {
    const item = element.closest ? element.closest('li') : null;
    if (!item || !item.parentElement) return null;
    const siblings = Array.from(item.parentElement.children).filter((node) => node.tagName === 'LI');
    const position = siblings.indexOf(item);
    return position >= 0 ? position + 1 : null;
  }

  function codeFromNearestLink(site, element) {
    let node = element;
    for (let depth = 0; node && depth < 12; depth += 1) {
      const link = node.querySelector ? node.querySelector(site.linkSelector) : null;
      if (link) {
        try {
          const code = site.codeFromPath(new URL(link.href, location.origin).pathname);
          if (code) return code;
        } catch (error) {
          /* битая ссылка, идём выше */
        }
      }
      node = node.parentElement;
    }
    return null;
  }

  function create(cache, site) {
    function resolve(element) {
      if (!element) return null;

      // Основной путь: адрес самого файла ведёт прямо в слайд.
      const byKey = cache.findByMediaKey(extract.mediaKeyFromUrl(element.currentSrc || element.src));
      if (byKey) return { element, post: byKey.post, slide: byKey.slide, guessed: false };

      // У видео в src обычно blob:, поэтому пост ищется по адресу страницы.
      const code = site.codeFromPath(location.pathname) || codeFromNearestLink(site, element);
      const post = code ? cache.get(code) : null;
      // Цель на экране есть, данных о ней нет. Возвращаем её всё равно:
      // кнопка должна появиться и честно сказать, что источник не найден,
      // а не молча исчезнуть.
      if (!post) return { element, post: null, slide: null, guessed: false };

      const wanted = site.slideIndexFromUrl() || indexFromDom(element);
      const slide = post.slides.find((candidate) => candidate.index === wanted);
      if (slide) return { element, post, slide, guessed: false };

      return { element, post, slide: post.slides[0], guessed: post.slides.length > 1 };
    }

    return {
      current() {
        return resolve(largestVisible(site));
      }
    };
  }

  root.StashTarget = { create };
})(typeof globalThis !== 'undefined' ? globalThis : this);
