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

  function digest(text) {
    const data = parseBody(text);
    if (!data) return;
    try {
      publish(extract.collectMedia(data, site));
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
