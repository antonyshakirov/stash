'use strict';

// Контент-скрипт: кэш найденных роликов, кнопка поверх плеера, запуск сохранения.

(function () {
  const extract = globalThis.ReelboxExtract;
  if (!extract) return;
  if (window.__reelboxContentReady) return;
  window.__reelboxContentReady = true;

  const MAX_INLINE_JSON = 3 * 1024 * 1024;
  const POLL_INTERVAL = 700;
  const TOAST_TIME = 2600;

  const cache = new Map();
  let busy = false;
  let toastTimer = null;

  function debugEnabled() {
    try {
      return localStorage.getItem('reelboxDebug') === '1';
    } catch (error) {
      return false;
    }
  }

  function log(...args) {
    if (debugEnabled()) console.log('[reelbox]', ...args);
  }

  // --- кэш ---------------------------------------------------------------

  function ingest(items) {
    if (!Array.isArray(items)) return;
    for (const item of items) {
      if (!item || !item.code || !Array.isArray(item.videos) || !item.videos.length) continue;
      const previous = cache.get(item.code);
      if (previous && previous.videos.length >= item.videos.length && previous.username) continue;
      cache.set(item.code, {
        code: item.code,
        username: item.username || (previous && previous.username) || null,
        takenAt: item.takenAt || (previous && previous.takenAt) || null,
        videos: item.videos
      });
    }
  }

  window.addEventListener('message', (event) => {
    if (event.source !== window) return;
    const data = event.data;
    if (!data || data.source !== 'reelbox' || data.kind !== 'media') return;
    ingest(data.items);
  });

  // Данные, вшитые в HTML при первой загрузке страницы: второй источник,
  // он спасает случай «открыл ролик по прямой ссылке».
  function scanInlineJson() {
    const scripts = document.querySelectorAll('script[type="application/json"]');
    for (const script of scripts) {
      const text = script.textContent;
      if (!text || text.length > MAX_INLINE_JSON) continue;
      try {
        ingest(extract.collectMedia(JSON.parse(text)));
      } catch (error) {
        /* не всякий инлайновый JSON нам подходит */
      }
    }
  }

  // --- что сейчас на экране ----------------------------------------------

  function visibleVideo() {
    let best = null;
    let bestArea = 0;
    for (const video of document.querySelectorAll('video')) {
      const box = video.getBoundingClientRect();
      const height = Math.max(0, Math.min(box.bottom, window.innerHeight) - Math.max(box.top, 0));
      const width = Math.max(0, Math.min(box.right, window.innerWidth) - Math.max(box.left, 0));
      const area = height * width;
      if (area > bestArea) {
        bestArea = area;
        best = video;
      }
    }
    return best;
  }

  function codeFromNearestLink() {
    const video = visibleVideo();
    if (!video) return null;
    let node = video;
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

  function currentCode() {
    return extract.codeFromPath(location.pathname) || codeFromNearestLink();
  }

  // Третий источник: если плеер получил прямую ссылку, а не blob из MSE.
  function directVideoSrc() {
    const video = visibleVideo();
    if (!video) return null;
    const candidates = [video.currentSrc, video.src];
    for (const source of video.querySelectorAll('source')) candidates.push(source.src);
    for (const candidate of candidates) {
      if (extract.isDirectVideoUrl(candidate)) return candidate;
    }
    return null;
  }

  function usernameFromDom() {
    const video = visibleVideo();
    let node = video;
    for (let depth = 0; node && depth < 12; depth += 1) {
      const links = node.querySelectorAll ? node.querySelectorAll('a[href^="/"]') : [];
      for (const link of links) {
        const segments = new URL(link.href, location.origin).pathname.split('/').filter(Boolean);
        if (segments.length === 1 && /^[A-Za-z0-9._]+$/.test(segments[0])) return segments[0];
      }
      node = node.parentElement;
    }
    return null;
  }

  // --- кнопка -------------------------------------------------------------

  const host = document.createElement('div');
  host.id = 'reelbox-host';
  const shadow = host.attachShadow({ mode: 'open' });
  shadow.innerHTML = `
    <style>
      :host { all: initial; }
      .wrap {
        position: fixed;
        right: 24px;
        bottom: 88px;
        z-index: 2147483000;
        display: flex;
        flex-direction: column;
        align-items: flex-end;
        gap: 8px;
        font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif;
      }
      .wrap[hidden] { display: none; }
      .btn {
        width: 44px;
        height: 44px;
        border-radius: 50%;
        border: 1px solid rgba(255, 255, 255, 0.18);
        background: rgba(20, 20, 22, 0.62);
        backdrop-filter: blur(12px);
        color: #fff;
        display: grid;
        place-items: center;
        cursor: pointer;
        padding: 0;
        transition: background 150ms ease, transform 150ms ease, opacity 150ms ease;
      }
      .btn:hover { background: rgba(20, 20, 22, 0.86); transform: scale(1.05); }
      .btn:active { transform: scale(0.96); }
      .btn:focus-visible { outline: 2px solid #fff; outline-offset: 2px; }
      .btn[data-state="busy"] { opacity: 0.7; cursor: progress; }
      .btn[data-state="done"] { background: rgba(28, 120, 60, 0.86); }
      .btn[data-state="error"] { background: rgba(150, 40, 40, 0.86); }
      .icon { width: 20px; height: 20px; display: block; }
      .spinner {
        width: 18px; height: 18px; border-radius: 50%;
        border: 2px solid rgba(255, 255, 255, 0.28);
        border-top-color: #fff;
        animation: spin 700ms linear infinite;
      }
      @keyframes spin { to { transform: rotate(360deg); } }
      .toast {
        max-width: 260px;
        background: rgba(20, 20, 22, 0.9);
        color: #fff;
        font-size: 12px;
        line-height: 1.4;
        padding: 8px 10px;
        border-radius: 10px;
        border: 1px solid rgba(255, 255, 255, 0.14);
        opacity: 0;
        transform: translateY(4px);
        transition: opacity 150ms ease, transform 150ms ease;
        pointer-events: none;
      }
      .toast[data-visible="1"] { opacity: 1; transform: none; }
      @media (prefers-reduced-motion: reduce) {
        .btn, .toast { transition: none; }
        .btn:hover { transform: none; }
        .spinner { animation-duration: 1600ms; }
      }
    </style>
    <div class="wrap" hidden>
      <div class="toast" role="status"></div>
      <button class="btn" data-state="idle" type="button" title="Сохранить этот Reels">
        <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor"
             stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M12 4v12" />
          <path d="M6 12l6 6 6-6" />
          <path d="M5 20h14" />
        </svg>
      </button>
    </div>
  `;

  const wrap = shadow.querySelector('.wrap');
  const button = shadow.querySelector('.btn');
  const toast = shadow.querySelector('.toast');
  const icon = shadow.querySelector('.icon');
  const iconMarkup = icon.outerHTML;

  document.documentElement.appendChild(host);

  function setState(state) {
    button.dataset.state = state;
    if (state === 'busy') {
      button.innerHTML = '<div class="spinner"></div>';
    } else {
      button.innerHTML = iconMarkup;
    }
  }

  function say(text) {
    toast.textContent = text;
    toast.dataset.visible = '1';
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      toast.dataset.visible = '0';
      if (button.dataset.state !== 'busy') setState('idle');
    }, TOAST_TIME);
  }

  function fail(text) {
    setState('error');
    say(text);
    log('отказ:', text);
  }

  function succeed(text) {
    setState('done');
    say(text);
  }

  // --- сохранение ---------------------------------------------------------

  function resolveTarget() {
    const code = currentCode();
    if (!code) return { error: 'Не понял, какой это ролик. Открой сам ролик.' };

    let item = cache.get(code);
    if (!item) {
      scanInlineJson();
      item = cache.get(code);
    }

    if (item) {
      const best = extract.bestVideo(item.videos);
      if (best && best.url) {
        return { code, url: best.url, filename: extract.buildFilename(item) };
      }
    }

    const direct = directVideoSrc();
    if (direct) {
      return {
        code,
        url: direct,
        filename: extract.buildFilename({ code, username: usernameFromDom(), takenAt: null })
      };
    }

    return { error: 'Источник не найден. Обнови страницу и попробуй снова.' };
  }

  // Запасной путь: тянем файл внутри страницы и отдаём его в загрузку отсюда.
  // Подпапку в этом случае задать нельзя, файл ложится в корень Загрузок.
  async function fallbackDownload(url, filename) {
    const response = await fetch(url, { credentials: 'omit' });
    if (!response.ok) throw new Error(`CDN ответил ${response.status}`);
    const blob = await response.blob();
    const objectUrl = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = objectUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(objectUrl), 15000);
  }

  async function saveCurrent() {
    if (busy) return;
    const target = resolveTarget();
    if (target.error) {
      fail(target.error);
      return;
    }

    busy = true;
    setState('busy');
    log('сохраняю', target);

    try {
      const result = await chrome.runtime.sendMessage({
        kind: 'download',
        url: target.url,
        filename: target.filename,
        code: target.code
      });

      if (result && result.ok) {
        succeed(`Сохранено: Загрузки/Reels/${result.filename}`);
      } else if (result && result.duplicate) {
        succeed('Этот ролик уже сохранён');
      } else {
        const reason = (result && result.error) || 'загрузка не началась';
        log('основной путь не прошёл:', reason);
        await fallbackDownload(target.url, target.filename);
        succeed('Сохранено в корень Загрузок (запасной путь)');
      }
    } catch (error) {
      fail(`Не получилось: ${String((error && error.message) || error)}`);
    } finally {
      busy = false;
    }
  }

  chrome.runtime.onMessage.addListener((message) => {
    if (!message) return;
    if (message.kind === 'download-current') {
      saveCurrent();
      return;
    }
    if (message.kind === 'download-failed') {
      log('загрузка прервана, пробую запасной путь:', message.error);
      fallbackDownload(message.url, message.filename)
        .then(() => succeed('Сохранено в корень Загрузок (запасной путь)'))
        .catch((error) => fail(`Не получилось: ${String((error && error.message) || error)}`));
    }
  });

  button.addEventListener('click', saveCurrent);

  // --- жизненный цикл -----------------------------------------------------

  // Instagram меняет адрес прокруткой ленты, никакого события об этом нет,
  // поэтому просто смотрим на состояние страницы раз в POLL_INTERVAL.
  let lastHref = '';
  setInterval(() => {
    const hasVideo = Boolean(visibleVideo());
    wrap.hidden = !hasVideo;
    if (location.href !== lastHref) {
      lastHref = location.href;
      if (button.dataset.state !== 'busy') setState('idle');
      toast.dataset.visible = '0';
    }
  }, POLL_INTERVAL);

  scanInlineJson();
  log('готов');
})();
