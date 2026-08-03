'use strict';

// Работает в контексте самой страницы Instagram (world: MAIN).
// Единственная задача: увидеть ответы, которые страница и так получает,
// и переслать найденные медиа в контент-скрипт.
//
// Железное правило этого файла: страница не должна заметить его присутствие.
// Любая ошибка внутри гасится, оригинальные fetch и XHR возвращают ровно то,
// что вернули бы без нас.

(function () {
  const extract = globalThis.StashExtract;
  const sites = globalThis.StashSites;
  if (!extract || !sites) return;

  const site = sites.pick(location.hostname);
  if (!site) return;

  if (debugEnabled()) console.log('[stash] перехватчик готов, площадка:', site.id);
  if (globalThis.__stashInterceptorReady) return;
  globalThis.__stashInterceptorReady = true;

  const MAX_BODY = 6 * 1024 * 1024;

  function debugEnabled() {
    try {
      return localStorage.getItem('stashDebug') === '1';
    } catch (error) {
      return false;
    }
  }


  function publish(items) {
    if (!items || !items.length) return;
    try {
      window.postMessage({ source: 'stash', kind: 'media', items }, window.location.origin);
      if (debugEnabled()) console.log('[stash] перехвачено медиа:', items.length, items);
    } catch (error) {
      /* постинг не должен ломать страницу */
    }
  }

  function parseBody(text) {
    if (typeof text !== 'string') return null;
    if (text.length < 2 || text.length > MAX_BODY) return null;

    const head = text[0];
    if (head === '{' || head === '[') {
      try {
        return JSON.parse(text);
      } catch (error) {
        return null;
      }
    }

    // Часть ответов Meta приходит с защитным префиксом вида "for (;;);".
    const start = text.indexOf('{');
    if (start > 0 && start < 32) {
      try {
        return JSON.parse(text.slice(start));
      } catch (error) {
        return null;
      }
    }

    return null;
  }

  // Площадки вроде YouTube не отдают готовых ссылок на файлы: плеер сам
  // подписывает адреса потоков и запрашивает по ним куски. Мы эти адреса
  // замечаем — ничего не расшифровывая, просто читая то, что уже произошло.
  const seenStreams = new Set();

  function noticeRequest(input) {
    if (!site.streamFromUrl) return;
    try {
      const url = typeof input === 'string' ? input : (input && input.url);
      const stream = site.streamFromUrl(url);
      if (!stream || seenStreams.has(stream.url)) return;
      seenStreams.add(stream.url);
      window.postMessage({ source: 'stash', kind: 'stream', stream }, window.location.origin);
      if (debugEnabled()) console.log('[stash] замечен поток', stream.itag, stream.kind);
    } catch (error) {
      /* чужой запрос не повод падать */
    }
  }

  /**
   * Второй, независимый источник адресов. Обёртки над fetch и XHR ловят не
   * всё: страница может ходить в сеть и другими путями. Браузер при этом
   * ведёт список всех загруженных ресурсов, и там лежат те же адреса.
   */
  function scanPerformance() {
    if (!site.streamFromUrl || typeof performance === 'undefined') return;
    try {
      for (const entry of performance.getEntriesByType('resource')) {
        noticeRequest(entry.name);
      }
    } catch (error) {
      /* список ресурсов недоступен, остаются обёртки */
    }
  }

  if (site.streamFromUrl) {
    try {
      // Список ресурсов по умолчанию короткий, а запросов у плеера много.
      if (performance.setResourceTimingBufferSize) performance.setResourceTimingBufferSize(1000);
    } catch (error) {
      /* необязательная мелочь */
    }
    scanPerformance();
    setInterval(scanPerformance, 1000);
  }

  function noticePlayer(data) {
    if (!site.collectFormats) return;
    try {
      const formats = site.collectFormats(data);
      const identity = site.readPlayerIdentity(data);
      if (!formats.length && !identity) return;
      window.postMessage({ source: 'stash', kind: 'player', formats, identity }, window.location.origin);
    } catch (error) {
      /* разбор чужого ответа не повод падать */
    }
  }

  function digest(text) {
    const data = parseBody(text);
    if (!data) return;
    try {
      publish(extract.collectMedia(data, site));
      noticePlayer(data);
    } catch (error) {
      /* разбор чужого ответа не повод падать */
    }
  }

  function looksLikeJson(response) {
    try {
      const type = response.headers.get('content-type') || '';
      return type.includes('json') || type.includes('javascript');
    } catch (error) {
      return false;
    }
  }

  const originalFetch = window.fetch;
  if (typeof originalFetch === 'function') {
    window.fetch = function stashFetch(...args) {
      noticeRequest(args[0]);
      const promise = originalFetch.apply(this, args);
      promise
        .then((response) => {
          try {
            if (response && looksLikeJson(response)) {
              response.clone().text().then(digest).catch(() => {});
            }
          } catch (error) {
            /* клон ответа не удался, идём дальше */
          }
        })
        .catch(() => {});
      return promise;
    };
  }

  const xhrProto = window.XMLHttpRequest && window.XMLHttpRequest.prototype;
  if (xhrProto && typeof xhrProto.open === 'function') {
    const originalOpen = xhrProto.open;
    xhrProto.open = function stashOpen(method, url, ...rest) {
      noticeRequest(url);
      return originalOpen.call(this, method, url, ...rest);
    };
  }

  if (xhrProto && typeof xhrProto.send === 'function') {
    const originalSend = xhrProto.send;
    xhrProto.send = function stashSend(...args) {
      try {
        this.addEventListener('load', function onLoad() {
          try {
            const type = this.responseType;
            if (type === '' || type === 'text') {
              digest(this.responseText);
            } else if (type === 'json' && this.response) {
              publish(extract.collectMedia(this.response, site));
            }
          } catch (error) {
            /* ответ недоступен, это нормально */
          }
        });
      } catch (error) {
        /* подписка не удалась, отправку всё равно выполняем */
      }
      return originalSend.apply(this, args);
    };
  }
})();
