'use strict';

// Сведение: приём данных в кэш, реакция на нажатия, жизненный цикл.
// Вёрстка Instagram живёт в target.js, интерфейс в ui.js, разбор в lib/.

(function () {
  const extract = globalThis.StashExtract;
  const cacheModule = globalThis.StashCache;
  const targetModule = globalThis.StashTarget;
  const uiModule = globalThis.StashUI;
  const sites = globalThis.StashSites;
  if (!extract || !cacheModule || !targetModule || !uiModule || !sites) return;
  if (window.__stashContentReady) return;
  window.__stashContentReady = true;

  // Площадка выбирается один раз: на неподдержанном хосте расширение просто
  // ничего не делает и ничего не рисует.
  const site = sites.pick(location.hostname);
  if (!site) return;

  const MAX_INLINE_JSON = 3 * 1024 * 1024;
  const POLL_INTERVAL = 700;
  const SMALL_SIDE = 1080;

  const cache = cacheModule.create();
  const target = targetModule.create(cache, site);
  let busy = false;

  function debugEnabled() {
    try {
      return localStorage.getItem('stashDebug') === '1';
    } catch (error) {
      return false;
    }
  }

  function log(...args) {
    if (debugEnabled()) console.log('[stash]', ...args);
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

  // Площадки со стриминговой доставкой (YouTube) не отдают готовых ссылок на
  // файлы. Метаданные приходят из ответа плеера, рабочие адреса — из его же
  // запросов за кусками, и сводятся они здесь по itag.
  const streamState = { code: null, formats: [], streams: new Map(), identity: {} };

  function resetStreams(code) {
    streamState.code = code;
    streamState.formats = [];
    streamState.streams = new Map();
    streamState.identity = {};
  }

  window.addEventListener('message', (event) => {
    if (event.source !== window) return;
    const data = event.data;
    if (!data || data.source !== 'stash') return;

    if (data.kind === 'media') {
      cache.ingest(data.items);
      return;
    }

    if (data.kind === 'stream' && data.stream) {
      const known = streamState.streams.has(data.stream.itag);
      streamState.streams.set(data.stream.itag, data.stream);
      if (!known) log('поток', data.stream.itag, data.stream.kind, data.stream.mime || '');
      return;
    }

    if (data.kind === 'player') {
      if (Array.isArray(data.formats) && data.formats.length) streamState.formats = data.formats;
      if (data.identity) streamState.identity = data.identity;
    }
  });

  // Данные, вшитые в HTML при первой загрузке: спасают случай
  // «открыл пост по прямой ссылке».
  function scanInlineJson() {
    if (site.scanInline) {
      for (const payload of site.scanInline(document)) {
        if (site.collectFormats) {
          const formats = site.collectFormats(payload);
          if (formats.length) streamState.formats = formats;
        }
        if (site.readPlayerIdentity) {
          const identity = site.readPlayerIdentity(payload);
          if (identity) streamState.identity = identity;
        }
      }
    }

    for (const script of document.querySelectorAll('script[type="application/json"]')) {
      const text = script.textContent;
      if (!text || text.length > MAX_INLINE_JSON) continue;
      try {
        cache.ingest(extract.collectMedia(JSON.parse(text), site));
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

  /** Пост YouTube собирается из перехваченных потоков, а не из кэша. */
  function streamPost() {
    const code = site.codeFromUrl(location.href);
    if (!code) return null;

    const picked = site.choose(streamState);
    const best = picked.progressive || picked.video;

    // Ответ плеера мог и не попасться: тогда автора и дату берём из разметки.
    const known = streamState.identity && streamState.identity.username
      ? streamState.identity
      : (site.readDomIdentity ? site.readDomIdentity(document) : {});

    const base = {
      code,
      pk: code,
      username: known.username || null,
      takenAt: known.takenAt || null,
      picked
    };

    if (!best) return Object.assign(base, { audio: null, slides: [] });

    return Object.assign(base, {
      code,
      pk: code,
      username: streamState.identity.username || null,
      takenAt: streamState.identity.takenAt || null,
      audio: picked.audio ? { url: picked.audio.url, title: null } : null,
      slides: [{
        index: 1,
        kind: 'video',
        sources: [{ url: best.url, width: best.width, height: best.height }]
      }]
    });
  }

  /** Главный плеер, а не первый попавшийся <video>: их на странице несколько. */
  function largestVideo() {
    let best = null;
    let bestArea = 0;
    for (const element of document.querySelectorAll('video')) {
      const box = element.getBoundingClientRect();
      const width = Math.max(0, Math.min(box.right, window.innerWidth) - Math.max(box.left, 0));
      const height = Math.max(0, Math.min(box.bottom, window.innerHeight) - Math.max(box.top, 0));
      const area = width * height;
      if (area > bestArea) {
        bestArea = area;
        best = element;
      }
    }
    return bestArea > 0 ? best : null;
  }

  function currentTarget() {
    if (!site.usesStreams) return target.current();

    const element = largestVideo();
    if (!element || !site.isOpen()) return null;

    const post = streamPost();
    if (!post) return null;
    return { element, post, slide: post.slides[0] || null, guessed: false };
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

  // --- площадки с раздельными потоками (YouTube) --------------------------

  // Выше этого размера data:-адрес становится неподъёмным, и файл уходит в
  // корень Загрузок через страницу. Папку так не задать, зато памяти хватит.
  const MAX_DATA_URL = 30 * 1024 * 1024;

  function isMp4Stream(entry) {
    return Boolean(entry) && typeof entry.mime === 'string' && entry.mime.indexOf('mp4') !== -1;
  }

  function streamExtension(entry, kind) {
    if (isMp4Stream(entry)) return kind === 'audio' ? 'm4a' : 'mp4';
    return kind === 'audio' ? 'weba' : 'webm';
  }

  function streamName(post, extension) {
    const slide = post.slides[0] || { index: 1, kind: 'video', sources: [] };
    return extract.buildFilename(post, slide).replace(/\.[^.]+$/, '') + '.' + extension;
  }

  /** Отдаёт готовые байты в загрузку: мелкое — в папку, крупное — в корень. */
  async function deliver(bytes, filename, folder, key) {
    if (bytes.length <= MAX_DATA_URL) {
      const item = { url: toDataUrl(bytes, DOWNLOAD_MIME), filename, folder, key };
      const result = await chrome.runtime.sendMessage({
        kind: 'download', ...item, force: forceRequested(key)
      });
      if (result && result.ok) return `Сохранено: Загрузки/${folder}/${result.filename}`;
      if (result && result.duplicate) {
        armForce(key);
        return 'Это уже сохранено. Нажми ещё раз, чтобы скачать копию.';
      }
    }

    saveBlob(new Blob([bytes], { type: DOWNLOAD_MIME }), filename);
    return `Сохранено в корень Загрузок: ${filename}`;
  }

  function nothingYet() {
    ui.setState('error');
    ui.say(
      streamState.formats.length
        ? 'Потоки закрыты подписью. Включи воспроизведение и попробуй снова.'
        : 'Данных ролика ещё нет. Включи воспроизведение и попробуй снова.'
    );
  }

  async function saveStreamVideo(found) {
    const post = found.post;
    if (!post || !post.picked) {
      nothingYet();
      return;
    }

    const picked = post.picked;
    const key = extract.downloadKey(post, found.slide);

    if (!picked.video && !picked.progressive) {
      nothingYet();
      return;
    }

    // Прогрессивный формат берётся, только когда он не хуже раздельных:
    // у YouTube это обычно 360p, и молча отдать его вместо 1080p нельзя.
    const canMux = isMp4Stream(picked.video) && isMp4Stream(picked.audio);
    const progressiveWins = picked.progressive
      && (!picked.video || (picked.progressive.height || 0) >= (picked.video.height || 0) || !canMux);

    if (progressiveWins) {
      const item = {
        url: picked.progressive.url,
        filename: streamName(post, 'mp4'),
        folder: 'Reels',
        key
      };
      const force = forceRequested(key);
      const result = await chrome.runtime.sendMessage({ kind: 'download', ...item, force });

      if (result && result.ok) {
        clearForce();
        ui.setState('done');
        ui.say(`Сохранено: Загрузки/Reels/${result.filename}${force ? ' Это копия.' : ''}`);
      } else if (result && result.duplicate) {
        armForce(key);
        ui.setState('done');
        ui.say('Этот ролик уже сохранён. Нажми ещё раз, чтобы скачать копию.');
      } else {
        await fallbackDownload(item.url, item.filename);
        ui.setState('done');
        ui.say('Сохранено в корень Загрузок (запасной путь)');
      }
      return;
    }

    if (!picked.video) {
      ui.setState('error');
      ui.say('Потоки закрыты подписью. Включи воспроизведение и попробуй снова.');
      return;
    }

    // Звука нет вовсе: сохраняем видео как есть и говорим об этом.
    if (!picked.audio) {
      ui.say('Качаю видео, звуковой дорожки не нашлось…');
      const bytes = new Uint8Array(await fetchBytes(picked.video.url));
      const said = await deliver(bytes, streamName(post, streamExtension(picked.video, 'video')), 'Reels', key);
      ui.setState('done');
      ui.say(`${said} Без звука: дорожка не пришла.`);
      return;
    }

    // Контейнеры несовместимы: сложить webm-звук в mp4 нельзя, поэтому
    // сохраняем двумя файлами, а не портим один.
    if (!isMp4Stream(picked.video) || !isMp4Stream(picked.audio)) {
      ui.say('Качаю видео и звук…');
      const video = new Uint8Array(await fetchBytes(picked.video.url));
      const audio = new Uint8Array(await fetchBytes(picked.audio.url));
      await deliver(video, streamName(post, streamExtension(picked.video, 'video')), 'Reels', key);
      await deliver(audio, streamName(post, streamExtension(picked.audio, 'audio')), 'Audio', `${key}#audio`);
      ui.setState('done');
      ui.say('Сохранено двумя файлами: контейнеры видео и звука несовместимы.');
      return;
    }

    ui.say('Качаю видео и звук…');
    const video = await fetchBytes(picked.video.url);
    const audio = await fetchBytes(picked.audio.url);

    ui.say('Собираю в один файл…');
    const bytes = globalThis.StashMp4Mux.mux(video, audio);
    log('собрано', bytes.length, 'байт из', video.byteLength, '+', audio.byteLength);

    const said = await deliver(bytes, streamName(post, 'mp4'), 'Reels', key);
    clearForce();
    ui.setState('done');
    ui.say(said);
  }

  async function saveStreamAudio(found) {
    const post = found.post;
    if (!post || !post.picked || !post.picked.audio) {
      nothingYet();
      return;
    }

    const picked = post.picked;

    ui.say('Качаю звук…');
    const bytes = new Uint8Array(await fetchBytes(picked.audio.url));
    const key = `${extract.downloadKey(post, found.slide)}#audio`;
    const filename = streamName(post, streamExtension(picked.audio, 'audio'));

    const said = await deliver(bytes, filename, 'Audio', key);
    clearForce();
    ui.setState('done');
    ui.say(said);
  }

  async function saveOne() {
    if (busy) return;
    const found = currentTarget();
    if (!found) {
      ui.setState('error');
      ui.say('Не понял, что сохранять. Открой сам пост.');
      return;
    }

    if (site.usesStreams) {
      busy = true;
      ui.setState('busy');
      try {
        await saveStreamVideo(found);
      } catch (error) {
        ui.setState('error');
        ui.say(`Не получилось: ${describeError(error)}`);
      } finally {
        busy = false;
      }
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
    if (!found || !found.post) return false;
    if (site.usesStreams) return Boolean(found.post.picked && found.post.picked.audio);
    if (!found.slide) return false;
    if (found.post.audio && found.post.audio.url) return true;
    return found.slide.kind === 'video';
  }

  async function saveAudio() {
    if (busy) return;
    const found = currentTarget();
    if (!hasAudio(found)) return;

    busy = true;
    ui.setState('busy');

    if (site.usesStreams) {
      try {
        await saveStreamAudio(found);
      } catch (error) {
        ui.setState('error');
        ui.say(`Звук не сохранён: ${describeError(error)}`);
      } finally {
        busy = false;
      }
      return;
    }

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
        bytes = globalThis.StashMp4Audio.extractAudio(await fetchBytes(video.url));
      } else {
        // Фотопост с прикреплённой музыкой: ролика нет, вынимать не из чего.
        const buffer = await fetchBytes(direct);
        try {
          bytes = globalThis.StashMp4Audio.extractAudio(buffer);
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
  let lastHref = location.href;
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

    const found = currentTarget();
    ui.setVisible(Boolean(found));
    ui.setAudioAvailable(hasAudio(found));
    if (location.href !== lastHref) {
      lastHref = location.href;
      ui.resetTransient();
      // Потоки принадлежат конкретному ролику: на другом они не годятся.
      if (site.usesStreams) {
        const code = site.codeFromUrl(location.href);
        if (code !== streamState.code) resetStreams(code);
      }
    }
  }, POLL_INTERVAL);

  // Код ролика запоминается до чтения страницы: иначе первый же тик опроса
  // решит, что ролик сменился, и сотрёт только что прочитанное.
  if (site.usesStreams) streamState.code = site.codeFromUrl(location.href);
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

  log('готов, версия', version(), '| площадка:', site.id);
})();
