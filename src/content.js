'use strict';

// Сведение: приём данных в кэш, реакция на нажатия, жизненный цикл.
// Вёрстка площадки живёт в target.js, интерфейс в ui.js, разбор в lib/.

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

  // Firefox отдаёт промисы через `browser`, Chrome — через `chrome`. Это
  // единственное различие между сборками в вызовах API.
  const api = globalThis.browser || globalThis.chrome;

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
      return Boolean(api.runtime && api.runtime.id);
    } catch (error) {
      return false;
    }
  }

  function version() {
    try {
      return api.runtime.getManifest().version;
    } catch (error) {
      return 'неизвестна';
    }
  }

  const RELOAD_HINT = 'Расширение обновилось. Перезагрузи страницу (⌘R).';

  function describeError(error) {
    const text = String((error && error.message) || error);
    if (!contextAlive() || text.includes('Extension context invalidated')) return RELOAD_HINT;
    return text;
  }

  /**
   * Человеческая формулировка для тоста. Технический текст остаётся в отчёте:
   * он нужен, чтобы чинить, а не тому, кто просто хотел сохранить кадр. Слова
   * вроде «битый контейнер» человеку не говорят ни что случилось, ни что
   * делать дальше, и выглядят поломкой самого расширения.
   *
   * Общая часть у ошибок разбора одна: сам ролик при этом сохраняется, потому
   * что видео уходит в загрузку ссылкой и разбора не требует. Это и есть то,
   * что человеку полезно знать.
   */
  const HUMAN_ERRORS = [
    [/нет звуковой дорожки/, 'В этом ролике нет звука.'],
    [
      /фрагментированный mp4/,
      'Площадка отдала ролик кусками, и звук из него не вынуть. Само видео сохранится.'
    ],
    [
      /битый контейнер|нет moov/,
      'Не удалось разобрать этот ролик, звук из него не достать. Само видео сохранится.'
    ],
    [
      /приехал не целиком/,
      'Файл скачался не полностью. Обнови страницу и попробуй снова.'
    ],
    [/CDN ответил/, 'Площадка не отдала файл. Обнови страницу и попробуй снова.']
  ];

  function humanError(error) {
    const text = describeError(error);
    if (text === RELOAD_HINT) return text;
    for (const [pattern, message] of HUMAN_ERRORS) {
      if (pattern.test(text)) return message;
    }
    return 'Не получилось. Загляни в подробности.';
  }

  // --- приём данных --------------------------------------------------------

  // Перехватчик работает в мире страницы и присылает данные строкой: живой
  // объект оттуда в Firefox виден сквозь защитную обёртку, и часть его
  // свойств трогать запрещено. Разбор строки даёт нам собственный объект.
  window.addEventListener('message', (event) => {
    if (event.source !== window) return;
    const data = event.data;
    if (!data || data.source !== 'stash' || data.kind !== 'media') return;
    try {
      cache.ingest(JSON.parse(data.payload));
    } catch (error) {
      log('данные от перехватчика не разобрались:', error);
    }
  });

  // Данные, вшитые в HTML при первой загрузке: спасают случай
  // «открыл пост по прямой ссылке».
  function scanInlineJson() {
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

  // Настройки читаются перед каждым сохранением, а не кэшируются при старте:
  // чтений столько же, сколько нажатий, зато папка не может разойтись с тем,
  // что человек только что выбрал в соседней вкладке настроек.
  async function readFolders() {
    try {
      const store = await api.storage.local.get(extract.SETTINGS_KEY);
      const settings = store[extract.SETTINGS_KEY];
      return (settings && settings.folders) || null;
    } catch (error) {
      // Настройки недоступны — это не повод не сохранять файл: folderFor
      // без них вернёт имена по умолчанию.
      log('настройки не прочитались:', error);
      return null;
    }
  }

  function describe(post, slide, folders) {
    const source = extract.bestSource(slide.sources);
    if (!source) return null;
    return {
      url: source.url,
      filename: extract.buildFilename(post, slide),
      folder: extract.folderFor(slide.kind, folders),
      // Тип едет вместе с файлом: по нему background решает про расширение
      // звука. Поле называется не kind, потому что kind в этом же сообщении
      // занят словом download и отличает его от прочих.
      slideKind: extract.folderSlot(slide.kind),
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

  /**
   * Единственное место, где расширение само тянет файл с CDN.
   *
   * `cache: 'no-store'` здесь не про свежесть, а про целостность. Пока человек
   * смотрит ролик, плеер тянет его кусками через Range-запросы, и в кэше
   * браузера остаётся неполная запись. Firefox отдаёт этот обрезок обычному
   * `fetch` без Range: боксы в нём читаются, а куски звука выходят за конец
   * файла — разбор падал на «битом контейнере», хотя контейнер был цел, просто
   * приехал не весь. Chrome с медиа-кэшем ведёт себя иначе, поэтому там всё
   * работало и разницу было видно только между браузерами.
   */
  async function fetchFromCdn(url) {
    const response = await fetch(url, { credentials: 'omit', cache: 'no-store' });
    if (!response.ok) throw new Error(`CDN ответил ${response.status}`);
    return response;
  }

  /**
   * Обрезанный ответ опаснее ошибки: молча сохранённый неполный файл человек
   * заметит не сразу. Если CDN сказал длину, сверяем с ней и говорим прямо.
   */
  function checkComplete(response, payload) {
    // ArrayBuffer меряется byteLength, Blob — size: через эту функцию проходят
    // оба, и путать их нельзя.
    const got = payload.byteLength !== undefined ? payload.byteLength : payload.size;
    const declared = Number(response.headers.get('content-length'));
    if (declared && got < declared) {
      throw new Error(`файл приехал не целиком: ${got} из ${declared}`);
    }
    return payload;
  }

  // Запасной путь: тянем файл внутри страницы и сохраняем его отсюда.
  async function fallbackDownload(url, filename) {
    const response = await fetchFromCdn(url);
    const blob = await response.blob();
    checkComplete(response, blob);
    saveBlob(blob, filename);
  }

  async function fetchBytes(url) {
    const response = await fetchFromCdn(url);
    step('чтение тела ответа');
    const buffer = await response.arrayBuffer();
    step('осмотр буфера');
    describeBuffer(buffer);
    step('проверка полноты');
    return checkComplete(response, buffer);
  }

  /**
   * Чем оказался буфер от fetch. В Firefox контент-скрипт и страница живут в
   * разных «реальностях», и объект оттуда не проходит проверку instanceof, а
   * обращение к его конструктору запрещено — обе ошибки, которые мы видели,
   * объясняются этим. Проверки поштучно и каждая в своём try: любая из них
   * может оказаться той самой запрещённой.
   */
  let bufferKind = null;

  function describeBuffer(buffer) {
    const facts = [];
    const probe = (name, fn) => {
      try {
        facts.push(`${name}=${fn()}`);
      } catch (error) {
        facts.push(`${name}=ЗАПРЕЩЕНО`);
      }
    };
    probe('typeof', () => typeof buffer);
    probe('isArrayBuffer', () => buffer instanceof ArrayBuffer);
    probe('isView', () => ArrayBuffer.isView(buffer));
    probe('byteLength', () => buffer.byteLength);
    probe('tag', () => Object.prototype.toString.call(buffer));
    probe('ctor', () => buffer.constructor && buffer.constructor.name);
    bufferKind = facts.join(' ');
  }

  // На каком шаге мы находимся. Нужно там, где у ошибки нет стека: защитная
  // обёртка Firefox бросает объект из чужого мира, и `error.stack` у него
  // недоступен — сообщение говорит, что случилось, и ничего о том, где.
  let lastStep = null;

  function step(name) {
    lastStep = name;
    log('шаг:', name);
  }

  // Что именно приехало с CDN. Без этого «битый контейнер» неотличим от
  // пустого ответа, обрезанного файла и страницы с ошибкой вместо ролика, и
  // присланный отчёт починить ничего не помогает.
  let lastProbe = null;

  function probeBuffer(buffer) {
    // Осмотр — чистая диагностика, и ронять из-за него сохранение нельзя.
    // Своим отказом он однажды уже притворился отказом скачивания.
    try {
      const bytes = new Uint8Array(buffer);
      const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.length);
      const types = [];
      let at = 0;
      // Верхний уровень mp4: размер четырьмя байтами, следом четырёхбуквенный
      // тип. Больше пяти боксов для опознания не нужно.
      while (at + 8 <= bytes.length && types.length < 5) {
        const size = view.getUint32(at);
        const type = String.fromCharCode(bytes[at + 4], bytes[at + 5], bytes[at + 6], bytes[at + 7]);
        if (!/^[\x20-\x7e]{4}$/.test(type)) break;
        types.push(type);
        if (size < 8) break;
        at += size;
      }
      lastProbe = {
        size: bytes.length,
        types,
        // Первые байты пригодятся, когда боксов не нашлось вовсе: по ним видно,
        // приехал ли HTML вместо файла.
        head: Array.from(bytes.slice(0, 12), (b) => b.toString(16).padStart(2, '0')).join(' ')
      };
    } catch (error) {
      lastProbe = { size: -1, types: [], head: `осмотр не прошёл: ${error && error.message}` };
    }
  }

  /**
   * Отчёт для разбора: всё, что нужно, чтобы понять причину, и ничего
   * лишнего. Отдаётся кнопкой, потому что искать его в инструментах
   * разработчика — не работа человека, который смотрит ленту.
   */
  function buildReport(error, found) {
    const lines = [];
    lines.push(`Stash ${version()} — ${site.id}`);
    lines.push(`адрес: ${location.origin}${location.pathname}`);
    lines.push(`ошибка: ${describeError(error)}`);
    lines.push(`постов в кэше: ${cache.count()}`);

    if (found && found.post) {
      const post = found.post;
      lines.push(`пост: ${post.code || post.pk} | автор: ${post.username || 'неизвестен'}`);
      lines.push(`слайдов: ${post.slides.length} | звук: ${post.audio ? 'есть' : 'нет'}`);
      if (found.slide) lines.push(`слайд ${found.slide.index}: ${found.slide.kind}`);
    } else {
      lines.push('пост не опознан');
    }

    if (lastProbe) {
      const boxes = lastProbe.types.length ? lastProbe.types.join(', ') : 'не опознаны';
      lines.push(`файл с CDN: ${lastProbe.size} байт | боксы: ${boxes}`);
      if (!lastProbe.types.length) lines.push(`первые байты: ${lastProbe.head}`);
    }

    lines.push('браузер: ' + (globalThis.browser ? 'firefox' : 'chrome'));
    if (lastStep) lines.push(`шаг: ${lastStep}`);
    if (bufferKind) lines.push(`буфер: ${bufferKind}`);

    // Трассировка: сообщение говорит, что случилось, и молчит о том, где.
    // Пути внутри расширения длинные и одинаковые у всех, поэтому оставляем
    // только файл и строку.
    if (error && error.stack) {
      const frames = String(error.stack)
        .split('\n')
        .map((line) => line.trim().replace(/^at\s+/, '').replace(/^.*\/(?=[\w.-]+\.js)/, ''))
        .filter(Boolean)
        .slice(0, 4);
      if (frames.length) lines.push('след: ' + frames.join(' ← '));
    }

    return lines.join('\n');
  }

  async function saveOne() {
    if (busy) return;
    const found = target.current();
    if (!found) {
      ui.setState('error');
      ui.say('Не понял, что сохранять. Открой сам пост.');
      return;
    }

    // Заслон ставится до первого await: чтение настроек асинхронное, и между
    // ним и записью busy иначе помещается второе нажатие — файл уехал бы дважды.
    busy = true;
    ui.setState('busy');
    ui.report(null);
    lastProbe = null;
    bufferKind = null;

    try {
      step('кадр: чтение настроек');
      const folders = await readFolders();
      step('кадр: выбор источника');
      const item = found.post && found.slide ? describe(found.post, found.slide, folders) : null;
      if (!item) {
        ui.setState('error');
        ui.say('Источник не найден. Обнови страницу и попробуй снова.');
        return;
      }
      log('сохраняю', item);

      const force = forceRequested(item.key);
      step('кадр: отправка в фон');
      const result = await api.runtime.sendMessage({ kind: 'download', ...item, force });

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
      ui.say(humanError(error), { sticky: true });
      ui.report(buildReport(error, found));
    } finally {
      busy = false;
    }
  }

  // --- звук ----------------------------------------------------------------

  // Тип намеренно нейтральный. Chrome при сохранении приводит расширение в
  // соответствие с заявленным типом, и для audio/mp4 его предпочтительное
  // расширение — mp4: запрошенный нами .m4a переписывался на .mp4 уже за
  // пределами расширения. С octet-stream переписывать не на что.
  const DOWNLOAD_MIME = 'application/octet-stream';

  function audioName(post, slide, extension) {
    return extract.buildFilename(post, slide).replace(/\.[^.]+$/, '') + '.' + extension;
  }

  // Всё, что уходит в звуковую папку, — звук. Расширение mp4 здесь недопустимо:
  // контейнер тот же самый, но по имени и система, и человек считают файл
  // видео. Площадки отдают дорожки именно так, поэтому переименовываем.
  function audioExtension(url) {
    const extension = extract.extensionFromUrl(url, 'audio');
    return extension === 'mp4' ? 'm4a' : extension;
  }

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
    ui.report(null);
    lastProbe = null;
    bufferKind = null;

    try {
      // Без кода и pk ключа нет, и дедупликация выключается: общий ключ
      // «null#audio» роднил бы между собой чужие друг другу ролики.
      step('звук: ключ и выбор источника');
      const base = extract.downloadKey(found.post, found.slide);
      const key = base ? `${base}#audio` : null;
      const video = found.slide.kind === 'video' ? extract.bestSource(found.slide.sources) : null;
      const direct = found.post.audio && found.post.audio.url;

      let bytes;
      let extension = 'm4a';
      let path;

      if (video) {
        // Звук вынимается из самого ролика. Прямой адрес дорожки площадки
        // отдают в контейнере mp4, и файл получался с расширением видео,
        // а у лицензированной музыки там ещё и отрывок вместо всей дорожки.
        path = 'разбор ролика';
        ui.say('Вынимаю звук из ролика…');
        step('звук: скачивание ролика');
        const buffer = await fetchBytes(video.url);
        step('звук: осмотр файла');
        probeBuffer(buffer);
        step('звук: разбор mp4');
        bytes = globalThis.StashMp4Audio.extractAudio(buffer);
      } else {
        // Фотопост с прикреплённой музыкой: ролика нет, вынимать не из чего.
        step('звук: скачивание дорожки');
        const buffer = await fetchBytes(direct);
        probeBuffer(buffer);
        step('звук: разбор дорожки');
        try {
          bytes = globalThis.StashMp4Audio.extractAudio(buffer);
          path = 'разбор дорожки по прямому адресу';
        } catch (error) {
          path = `прямой адрес как есть (разбор не прошёл: ${error.message})`;
          bytes = new Uint8Array(buffer);
          extension = audioExtension(direct);
        }
      }

      // Как отдать фону файл, собранный здесь, у браузеров разное.
      // Chrome: `data:`-адресом, потому что в его service worker нет DOM и
      // blob-адрес там создать не из чего. Firefox: сырыми байтами — `data:`
      // его загрузчик не принимает вовсе, зато фон у него обычная страница и
      // blob он сделает сам. Blob, созданный здесь, Firefox тоже отверг бы.
      step('звук: сборка посылки');
      const item = {
        ...(globalThis.browser
          ? { bytes }
          : { url: toDataUrl(bytes, DOWNLOAD_MIME) }),
        filename: audioName(found.post, found.slide, extension),
        folder: extract.folderFor('audio', await readFolders()),
        slideKind: 'audio',
        key
      };
      log('звук:', path, '| слайд:', found.slide.kind, '| файл:', item.filename, '|', bytes.length, 'байт');

      const force = forceRequested(key);
      step('звук: отправка в фон');
      const result = await api.runtime.sendMessage({ kind: 'download', ...item, force });

      if (result && result.ok) {
        clearForce();
        ui.setState('done');
        ui.say(`Сохранено: Загрузки/${item.folder}/${result.filename}${force ? ' Это копия.' : ''}`);
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
      ui.say(humanError(error), { sticky: true });
      ui.report(buildReport(error, found));
    } finally {
      busy = false;
    }
  }

  const ui = uiModule.create({ onSaveOne: saveOne, onSaveAudio: saveAudio });

  api.runtime.onMessage.addListener((message) => {
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

  // Площадки меняют адрес прокруткой ленты, события об этом нет,
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

    const found = target.current();
    ui.setVisible(Boolean(found));
    ui.setAudioAvailable(hasAudio(found));

    if (location.href !== lastHref) {
      lastHref = location.href;
      ui.resetTransient();
    }
  }, POLL_INTERVAL);

  scanInlineJson();
  log('готов, версия', version(), '| площадка:', site.id);
})();
