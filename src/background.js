'use strict';

// Service worker: единственное место, где Stash трогает загрузки и хранилище.

const SAVED_KEY = 'saved';

// downloadId -> откуда пришла загрузка, чтобы сообщить вкладке о срыве.
const inFlight = new Map();

async function readSaved() {
  const store = await chrome.storage.local.get(SAVED_KEY);
  return store[SAVED_KEY] || {};
}

async function remember(key, filename) {
  if (!key) return;
  const saved = await readSaved();
  saved[key] = { filename, at: Date.now() };
  await chrome.storage.local.set({ [SAVED_KEY]: saved });
}

async function forget(key) {
  if (!key) return;
  const saved = await readSaved();
  if (!saved[key]) return;
  delete saved[key];
  await chrome.storage.local.set({ [SAVED_KEY]: saved });
}

// Последний рубеж перед диском: в папке Audio не должно оказаться файла с
// расширением видео. Контейнер у m4a и mp4 один и тот же, но по имени и
// система, и человек считают такой файл роликом.
function audioSafeName(folder, filename) {
  return folder === 'Audio' ? filename.replace(/\.mp4$/i, '.m4a') : filename;
}

async function startDownload(item, sender) {
  const { url, folder, key, force } = item;
  const filename = audioSafeName(folder, item.filename);
  if (!url || !filename || !folder) return { ok: false, error: 'Нечего сохранять' };

  // force приходит со второго нажатия подряд: человек уже знает, что файл
  // есть, и просит копию. Память о сохранённом бережёт от случайных дублей,
  // но запирать в ней нельзя — прошлый файл мог сохраниться плохо.
  const saved = await readSaved();
  if (key && !force && saved[key]) {
    return { ok: false, duplicate: true, filename: saved[key].filename };
  }

  try {
    const id = await chrome.downloads.download({
      url,
      filename: `${folder}/${filename}`,
      conflictAction: 'uniquify',
      saveAs: false
    });
    inFlight.set(id, { tabId: sender.tab ? sender.tab.id : null, key, url, filename, folder });
    await remember(key, filename);
    return { ok: true, id, filename };
  } catch (error) {
    return { ok: false, error: String((error && error.message) || error) };
  }
}

// Адреса потоков видно только браузеру: плеер YouTube ходит в сеть мимо
// обёрток над fetch, поэтому со стороны страницы их не поймать. Наблюдаем
// запросы вкладки — ничего не меняя и не блокируя.
const STREAM_HOSTS = ['*://*.googlevideo.com/*', '*://*.youtube.com/*'];
const STREAM_LIMIT = 80;
const streamsByTab = new Map();

// Состояние наблюдателя нужно в отчёте: без него «ноль адресов» одинаково
// выглядит и когда наблюдение не включилось, и когда оно ничего не видит.
const watch = { observing: false, seen: 0, error: null };

function rememberStream(tabId, url) {
  watch.seen += 1;
  if (tabId < 0) return;
  const list = streamsByTab.get(tabId) || [];
  if (list.includes(url)) return;
  list.push(url);
  if (list.length > STREAM_LIMIT) list.shift();
  streamsByTab.set(tabId, list);
}

try {
  chrome.webRequest.onBeforeRequest.addListener(
    (details) => {
      if (details.url.indexOf('videoplayback') === -1) return;
      rememberStream(details.tabId, details.url);
    },
    { urls: STREAM_HOSTS }
  );
  watch.observing = true;
} catch (error) {
  watch.error = String((error && error.message) || error);
  console.warn('[stash] наблюдение за запросами недоступно:', error);
}

chrome.tabs.onRemoved.addListener((tabId) => streamsByTab.delete(tabId));

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message) return undefined;
  const tabId = sender.tab ? sender.tab.id : -1;

  if (message.kind === 'download') {
    startDownload(message, sender).then(sendResponse);
    return true;
  }

  if (message.kind === 'streams') {
    sendResponse({
      urls: streamsByTab.get(tabId) || [],
      observing: watch.observing,
      seen: watch.seen,
      error: watch.error
    });
    return false;
  }

  // Ролик сменился: адреса прошлого к нему не относятся.
  if (message.kind === 'streams-reset') {
    streamsByTab.delete(tabId);
    sendResponse({ ok: true });
    return false;
  }

  return undefined;
});

// Загрузка могла стартовать и умереть позже: тогда снимаем отметку
// «уже сохранён» и просим вкладку попробовать запасной путь.
chrome.downloads.onChanged.addListener(async (delta) => {
  const entry = inFlight.get(delta.id);
  if (!entry) return;

  if (delta.state && delta.state.current === 'complete') {
    inFlight.delete(delta.id);
    return;
  }

  if (delta.state && delta.state.current === 'interrupted') {
    inFlight.delete(delta.id);
    await forget(entry.key);
    if (entry.tabId != null) {
      try {
        await chrome.tabs.sendMessage(entry.tabId, {
          kind: 'download-failed',
          key: entry.key,
          url: entry.url,
          filename: entry.filename,
          folder: entry.folder,
          error: (delta.error && delta.error.current) || 'загрузка прервана'
        });
      } catch (error) {
        /* вкладку закрыли, сообщать некому */
      }
    }
  }
});

// Иконка в панели: второй путь к тому же действию, живёт даже если
// кнопка поверх плеера не отрисовалась.
chrome.action.onClicked.addListener(async (tab) => {
  if (!tab || tab.id == null) return;
  try {
    await chrome.tabs.sendMessage(tab.id, { kind: 'download-current' });
  } catch (error) {
    console.warn('[stash] вкладка не отвечает, обнови страницу Instagram');
  }
});
