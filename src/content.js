'use strict';

// Сведение: приём данных в кэш, реакция на нажатия, жизненный цикл.
// Вёрстка Instagram живёт в target.js, интерфейс в ui.js, разбор в lib/.

(function () {
  const extract = globalThis.ReelboxExtract;
  const cacheModule = globalThis.ReelboxCache;
  const targetModule = globalThis.ReelboxTarget;
  const uiModule = globalThis.ReelboxUI;
  if (!extract || !cacheModule || !targetModule || !uiModule) return;
  if (window.__reelboxContentReady) return;
  window.__reelboxContentReady = true;

  const MAX_INLINE_JSON = 3 * 1024 * 1024;
  const POLL_INTERVAL = 700;
  const SMALL_SIDE = 1080;

  const cache = cacheModule.create();
  const target = targetModule.create(cache);
  let busy = false;

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

  // --- приём данных --------------------------------------------------------

  window.addEventListener('message', (event) => {
    if (event.source !== window) return;
    const data = event.data;
    if (!data || data.source !== 'reelbox' || data.kind !== 'media') return;
    cache.ingest(data.items);
  });

  // Данные, вшитые в HTML при первой загрузке: спасают случай
  // «открыл пост по прямой ссылке».
  function scanInlineJson() {
    for (const script of document.querySelectorAll('script[type="application/json"]')) {
      const text = script.textContent;
      if (!text || text.length > MAX_INLINE_JSON) continue;
      try {
        cache.ingest(extract.collectMedia(JSON.parse(text)));
      } catch (error) {
        /* не всякий инлайновый JSON нам подходит */
      }
    }
  }

  // --- сохранение ----------------------------------------------------------

  function describe(post, slide) {
    const source = extract.bestSource(slide.sources);
    if (!source) return null;
    return {
      url: source.url,
      filename: extract.buildFilename(post, slide),
      folder: extract.folderFor(slide.kind),
      key: extract.downloadKey(post, slide),
      width: source.width,
      height: source.height
    };
  }

  function smallNote(item) {
    const side = Math.max(Number(item.width) || 0, Number(item.height) || 0);
    if (!side || side >= SMALL_SIDE) return '';
    return ` (${side} px — открой пост для полного качества)`;
  }

  // Отдаём готовый файл в загрузку прямо из страницы. Подпапку так задать
  // нельзя, файл ложится в корень Загрузок.
  function saveBlob(blob, filename) {
    const objectUrl = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = objectUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(objectUrl), 15000);
  }

  // Запасной путь: тянем файл внутри страницы и сохраняем его отсюда.
  async function fallbackDownload(url, filename) {
    const response = await fetch(url, { credentials: 'omit' });
    if (!response.ok) throw new Error(`CDN ответил ${response.status}`);
    saveBlob(await response.blob(), filename);
  }

  async function saveOne() {
    if (busy) return;
    const found = target.current();
    if (!found) {
      ui.setState('error');
      ui.say('Не понял, что сохранять. Открой сам пост.');
      return;
    }

    const item = found.post && found.slide ? describe(found.post, found.slide) : null;
    if (!item) {
      ui.setState('error');
      ui.say('Источник не найден. Обнови страницу и попробуй снова.');
      return;
    }

    busy = true;
    ui.setState('busy');
    log('сохраняю', item);

    try {
      const result = await chrome.runtime.sendMessage({ kind: 'download', ...item });

      if (result && result.ok) {
        const guess = found.guessed ? ' Слайд не опознан, сохранил первый.' : '';
        ui.setState('done');
        ui.say(`Сохранено: Загрузки/${item.folder}/${result.filename}${smallNote(item)}${guess}`);
      } else if (result && result.duplicate) {
        ui.setState('done');
        ui.say('Этот кадр уже сохранён');
      } else {
        log('основной путь не прошёл:', result && result.error);
        await fallbackDownload(item.url, item.filename);
        ui.setState('done');
        ui.say('Сохранено в корень Загрузок (запасной путь)');
      }
    } catch (error) {
      ui.setState('error');
      ui.say(`Не получилось: ${String((error && error.message) || error)}`);
    } finally {
      busy = false;
    }
  }

  async function saveAll() {
    if (busy) return;
    const found = target.current();
    if (!found || !found.post || found.post.slides.length < 2) return;

    const items = found.post.slides.map((slide) => describe(found.post, slide)).filter(Boolean);
    if (!items.length) {
      ui.setState('error');
      ui.say('Источник не найден. Обнови страницу и попробуй снова.');
      return;
    }

    busy = true;
    ui.setState('busy');
    log('сохраняю пакет', items.length);

    try {
      const report = await chrome.runtime.sendMessage({ kind: 'download-batch', items });
      const parts = [`Сохранено ${report.saved}`];
      if (report.skipped) parts.push(`пропущено ${report.skipped} (уже есть)`);
      if (report.failed) parts.push(`не удалось ${report.failed}: ${report.firstError}`);
      ui.setState(report.failed ? 'error' : 'done');
      ui.say(parts.join(', '));
    } catch (error) {
      ui.setState('error');
      ui.say(`Не получилось: ${String((error && error.message) || error)}`);
    } finally {
      busy = false;
    }
  }

  function audioName(post, slide, url) {
    const extension = extract.extensionFromUrl(url, 'audio');
    return extract.buildFilename(post, slide).replace(/\.[^.]+$/, '') + '.' + extension;
  }

  // Готовый m4a уходит в загрузку через data:-адрес: только так сохраняется
  // подпапка. URL.createObjectURL в service worker MV3 недоступен, а через
  // <a download> файл лёг бы в корень Загрузок.
  function toDataUrl(bytes, type) {
    let binary = '';
    const chunk = 0x8000;
    for (let i = 0; i < bytes.length; i += chunk) {
      binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
    }
    return `data:${type};base64,${btoa(binary)}`;
  }

  async function saveAudio() {
    if (busy) return;
    const found = target.current();
    if (!found || !found.post || !found.slide || found.slide.kind !== 'video') return;

    busy = true;
    ui.setState('busy');

    try {
      // Без кода и pk ключа нет, и дедупликация выключается: общий ключ
      // «null#audio» роднил бы между собой чужие друг другу ролики.
      const base = extract.downloadKey(found.post, found.slide);
      const key = base ? `${base}#audio` : null;
      const direct = found.post.audio && found.post.audio.url;
      let item;
      let bytes = null;

      if (direct) {
        item = { url: direct, filename: audioName(found.post, found.slide, direct), folder: 'Audio', key };
        log('звук по прямому адресу', direct);
      } else {
        const source = extract.bestSource(found.slide.sources);
        if (!source) throw new Error('источник не найден');
        const response = await fetch(source.url, { credentials: 'omit' });
        if (!response.ok) throw new Error(`CDN ответил ${response.status}`);
        bytes = globalThis.ReelboxMp4Audio.extractAudio(await response.arrayBuffer());
        item = {
          url: toDataUrl(bytes, 'audio/mp4'),
          filename: audioName(found.post, found.slide, 'sound.m4a'),
          folder: 'Audio',
          key
        };
        log('звук вынут из ролика,', bytes.length, 'байт');
      }

      const result = await chrome.runtime.sendMessage({ kind: 'download', ...item });

      if (result && result.ok) {
        ui.setState('done');
        ui.say(`Сохранено: Загрузки/Audio/${result.filename}`);
      } else if (result && result.duplicate) {
        ui.setState('done');
        ui.say('Этот звук уже сохранён');
      } else if (bytes) {
        // Запасной путь для вынутого звука: отдаём файл в загрузку прямо
        // отсюда. Подпапку так не задать, файл ложится в корень Загрузок.
        log('data:-адрес не прошёл:', result && result.error);
        await saveBlob(new Blob([bytes], { type: 'audio/mp4' }), item.filename);
        ui.setState('done');
        ui.say('Звук сохранён в корень Загрузок (запасной путь)');
      } else {
        throw new Error((result && result.error) || 'загрузка не началась');
      }
    } catch (error) {
      ui.setState('error');
      ui.say(`Звук не сохранён: ${String((error && error.message) || error)}`);
    } finally {
      busy = false;
    }
  }

  const ui = uiModule.create({ onSaveOne: saveOne, onSaveAll: saveAll, onSaveAudio: saveAudio });

  chrome.runtime.onMessage.addListener((message) => {
    if (!message) return;

    if (message.kind === 'download-current') {
      saveOne();
      return;
    }

    if (message.kind === 'download-failed') {
      log('загрузка прервана, пробую запасной путь:', message.error);
      fallbackDownload(message.url, message.filename)
        .then(() => {
          ui.setState('done');
          ui.say('Сохранено в корень Загрузок (запасной путь)');
        })
        .catch((error) => {
          ui.setState('error');
          ui.say(`Не получилось: ${String((error && error.message) || error)}`);
        });
    }
  });

  document.addEventListener('mouseover', (event) => target.setHovered(event.target), true);

  // --- жизненный цикл ------------------------------------------------------

  // Instagram меняет адрес прокруткой ленты, события об этом нет,
  // поэтому просто смотрим на состояние страницы раз в POLL_INTERVAL.
  let lastHref = '';
  setInterval(() => {
    const found = target.current();
    ui.setVisible(Boolean(found));
    ui.setAllCount(found && found.post ? found.post.slides.length : 0);
    ui.setAudioAvailable(Boolean(found && found.slide && found.slide.kind === 'video'));
    ui.highlight(found ? found.element.getBoundingClientRect() : null);
    if (location.href !== lastHref) {
      lastHref = location.href;
      ui.resetTransient();
    }
  }, POLL_INTERVAL);

  scanInlineJson();
  log('готов');
})();
