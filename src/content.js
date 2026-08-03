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

  // После обновления расширения старый контент-скрипт остаётся в открытой
  // вкладке, но связь с расширением у него оборвана. Chrome сообщает об этом
  // невнятным «Extension context invalidated», и человеку это ничего не даёт.
  function contextAlive() {
    try {
      return Boolean(chrome.runtime && chrome.runtime.id);
    } catch (error) {
      return false;
    }
  }

  const RELOAD_HINT = 'Расширение обновилось. Перезагрузи страницу (⌘R).';

  function describeError(error) {
    const text = String((error && error.message) || error);
    if (!contextAlive() || text.includes('Extension context invalidated')) return RELOAD_HINT;
    return text;
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

  // Повтор не запрещён навсегда: первое нажатие сообщает, что файл уже есть,
  // второе подряд сохраняет копию. Случайный дубль так не появится, но и
  // застрять невозможно, если прошлый файл сохранился плохо.
  const FORCE_WINDOW = 8000;
  let forceKey = null;
  let forceUntil = 0;

  function forceRequested(key) {
    return Boolean(key) && forceKey === key && Date.now() < forceUntil;
  }

  function armForce(key) {
    forceKey = key;
    forceUntil = Date.now() + FORCE_WINDOW;
  }

  function clearForce() {
    forceKey = null;
    forceUntil = 0;
  }

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
      const force = forceRequested(item.key);
      const result = await chrome.runtime.sendMessage({ kind: 'download', ...item, force });

      if (result && result.ok) {
        clearForce();
        const guess = found.guessed ? ' Слайд не опознан, сохранил первый.' : '';
        const copy = force ? ' Это копия.' : '';
        ui.setState('done');
        ui.say(`Сохранено: Загрузки/${item.folder}/${result.filename}${smallNote(item)}${guess}${copy}`);
      } else if (result && result.duplicate) {
        armForce(item.key);
        ui.setState('done');
        ui.say('Этот кадр уже сохранён. Нажми ещё раз, чтобы скачать копию.');
      } else {
        log('основной путь не прошёл:', result && result.error);
        await fallbackDownload(item.url, item.filename);
        ui.setState('done');
        ui.say('Сохранено в корень Загрузок (запасной путь)');
      }
    } catch (error) {
      ui.setState('error');
      ui.say(`Не получилось: ${describeError(error)}`);
    } finally {
      busy = false;
    }
  }

  // Тип намеренно нейтральный. Chrome при сохранении приводит расширение в
  // соответствие с заявленным типом, и для audio/mp4 его предпочтительное
  // расширение — mp4: запрошенный нами .m4a переписывался на .mp4 уже за
  // пределами расширения. С octet-stream переписывать не на что, и имя
  // остаётся тем, которое мы задали.
  const DOWNLOAD_MIME = 'application/octet-stream';

  function audioName(post, slide, extension) {
    return extract.buildFilename(post, slide).replace(/\.[^.]+$/, '') + '.' + extension;
  }

  // Всё, что уходит в папку Audio, — звук. Расширение mp4 здесь недопустимо:
  // контейнер тот же самый, но по имени и система, и человек считают файл
  // видео. Instagram отдаёт дорожки именно так, поэтому переименовываем.
  function audioExtension(url) {
    const extension = extract.extensionFromUrl(url, 'audio');
    return extension === 'mp4' ? 'm4a' : extension;
  }

  async function fetchBytes(url) {
    const response = await fetch(url, { credentials: 'omit' });
    if (!response.ok) throw new Error(`CDN ответил ${response.status}`);
    return response.arrayBuffer();
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

  // Звук есть у ролика, а ещё у фотопоста, к которому прикреплена музыка.
  function hasAudio(found) {
    if (!found || !found.post || !found.slide) return false;
    if (found.post.audio && found.post.audio.url) return true;
    return found.slide.kind === 'video';
  }

  async function saveAudio() {
    if (busy) return;
    const found = target.current();
    if (!hasAudio(found)) return;

    busy = true;
    ui.setState('busy');

    try {
      // Без кода и pk ключа нет, и дедупликация выключается: общий ключ
      // «null#audio» роднил бы между собой чужие друг другу ролики.
      const base = extract.downloadKey(found.post, found.slide);
      const key = base ? `${base}#audio` : null;
      const video = found.slide.kind === 'video' ? extract.bestSource(found.slide.sources) : null;
      const direct = found.post.audio && found.post.audio.url;

      let bytes;
      let extension = 'm4a';
      let path;

      if (video) {
        // Звук вынимается из самого ролика. Прямой адрес дорожки Instagram
        // отдаёт в контейнере mp4, и файл получался с расширением видео,
        // а у лицензированной музыки там ещё и отрывок вместо всей дорожки.
        path = 'разбор ролика';
        ui.say('Вынимаю звук из ролика…');
        bytes = globalThis.ReelboxMp4Audio.extractAudio(await fetchBytes(video.url));
      } else {
        // Фотопост с прикреплённой музыкой: ролика нет, вынимать не из чего.
        const buffer = await fetchBytes(direct);
        try {
          bytes = globalThis.ReelboxMp4Audio.extractAudio(buffer);
          path = 'разбор дорожки по прямому адресу';
        } catch (error) {
          path = `прямой адрес как есть (разбор не прошёл: ${error.message})`;
          bytes = new Uint8Array(buffer);
          extension = audioExtension(direct);
        }
      }

      const item = {
        url: toDataUrl(bytes, DOWNLOAD_MIME),
        filename: audioName(found.post, found.slide, extension),
        folder: 'Audio',
        key
      };
      log('звук:', path, '| слайд:', found.slide.kind, '| файл:', item.filename, '|', bytes.length, 'байт');

      const force = forceRequested(key);
      const result = await chrome.runtime.sendMessage({ kind: 'download', ...item, force });

      if (result && result.ok) {
        clearForce();
        ui.setState('done');
        ui.say(`Сохранено: Загрузки/Audio/${result.filename}${force ? ' Это копия.' : ''}`);
      } else if (result && result.duplicate) {
        armForce(key);
        ui.setState('done');
        ui.say('Этот звук уже сохранён. Нажми ещё раз, чтобы скачать копию.');
      } else {
        // Запасной путь: отдаём файл в загрузку прямо отсюда. Подпапку так
        // не задать, файл ложится в корень Загрузок.
        log('data:-адрес не прошёл:', result && result.error);
        saveBlob(new Blob([bytes], { type: DOWNLOAD_MIME }), item.filename);
        ui.setState('done');
        ui.say('Звук сохранён в корень Загрузок (запасной путь)');
      }
    } catch (error) {
      ui.setState('error');
      ui.say(`Звук не сохранён: ${describeError(error)}`);
    } finally {
      busy = false;
    }
  }

  const ui = uiModule.create({ onSaveOne: saveOne, onSaveAudio: saveAudio });

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
          ui.say(`Не получилось: ${describeError(error)}`);
        });
    }
  });

  // --- жизненный цикл ------------------------------------------------------

  // Instagram меняет адрес прокруткой ленты, события об этом нет,
  // поэтому просто смотрим на состояние страницы раз в POLL_INTERVAL.
  let lastHref = '';
  const poll = setInterval(() => {
    // Связь с расширением оборвана: дальше опрашивать страницу незачем,
    // и лучше сказать об этом один раз, чем ронять каждое нажатие.
    if (!contextAlive()) {
      clearInterval(poll);
      ui.setVisible(true);
      ui.setState('error');
      ui.say(RELOAD_HINT, { sticky: true });
      return;
    }

    // Во время сохранения состояние кнопок не трогаем: иначе крутилка
    // моргала бы раз в POLL_INTERVAL.
    if (busy) return;

    const found = target.current();
    ui.setVisible(Boolean(found));
    ui.setAudioAvailable(hasAudio(found));
    if (location.href !== lastHref) {
      lastHref = location.href;
      ui.resetTransient();
    }
  }, POLL_INTERVAL);

  scanInlineJson();

  // Версия в консоли: единственный надёжный способ убедиться, что во вкладке
  // работает свежий код, а не скрипт, оставшийся от прошлой сборки.
  function version() {
    try {
      return chrome.runtime.getManifest().version;
    } catch (error) {
      return 'неизвестна';
    }
  }

  log('готов, версия', version());
})();
