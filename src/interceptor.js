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

  if (debugEnabled()) console.log('[stash] interceptor ready, site:', site.id);
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


  /**
   * Данные уезжают строкой, а не объектом. Этот файл работает в мире самой
   * страницы, а принимает контент-скрипт — в своём. В Firefox объекты через
   * эту границу видны сквозь защитную обёртку, и обращение к части их свойств
   * запрещено: разбор падал с «Permission denied to access property».
   * JSON гарантирует, что на той стороне окажется собственный объект
   * получателя, и никакой границы у него внутри нет.
   */
  function publish(items) {
    if (!items || !items.length) return;
    let payload;
    try {
      payload = JSON.stringify(items);
    } catch (error) {
      // Отказ сериализации раньше уходил в общий catch, и кэш просто оставался
      // пустым: кнопки не появлялись, а причины не было видно нигде.
      if (debugEnabled()) console.warn('[stash] payload is not serialisable:', error);
      return;
    }
    try {
      window.postMessage({ source: 'stash', kind: 'media', payload }, window.location.origin);
      if (debugEnabled()) console.log('[stash] media captured:', items.length, items);
    } catch (error) {
      if (debugEnabled()) console.warn('[stash] posting failed:', error);
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
