'use strict';

// Service worker: единственное место, где Reelbox трогает загрузки и хранилище.

const SAVED_KEY = 'saved';
const SUBFOLDER = 'Reels';

// downloadId -> откуда пришла загрузка, чтобы сообщить вкладке о срыве.
const inFlight = new Map();

async function readSaved() {
  const store = await chrome.storage.local.get(SAVED_KEY);
  return store[SAVED_KEY] || {};
}

async function remember(code, filename) {
  if (!code) return;
  const saved = await readSaved();
  saved[code] = { filename, at: Date.now() };
  await chrome.storage.local.set({ [SAVED_KEY]: saved });
}

async function forget(code) {
  if (!code) return;
  const saved = await readSaved();
  if (!saved[code]) return;
  delete saved[code];
  await chrome.storage.local.set({ [SAVED_KEY]: saved });
}

async function startDownload(message, sender) {
  const { url, filename, code } = message;
  if (!url || !filename) return { ok: false, error: 'Нечего сохранять' };

  const saved = await readSaved();
  if (code && saved[code]) {
    return { ok: false, duplicate: true, filename: saved[code].filename };
  }

  try {
    const id = await chrome.downloads.download({
      url,
      filename: `${SUBFOLDER}/${filename}`,
      conflictAction: 'uniquify',
      saveAs: false
    });
    inFlight.set(id, { tabId: sender.tab ? sender.tab.id : null, code, url, filename });
    await remember(code, filename);
    return { ok: true, id, filename };
  } catch (error) {
    return { ok: false, error: String((error && error.message) || error) };
  }
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || message.kind !== 'download') return undefined;
  startDownload(message, sender).then(sendResponse);
  return true;
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
    await forget(entry.code);
    if (entry.tabId != null) {
      try {
        await chrome.tabs.sendMessage(entry.tabId, {
          kind: 'download-failed',
          code: entry.code,
          url: entry.url,
          filename: entry.filename,
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
    console.warn('[reelbox] вкладка не отвечает, обнови страницу Instagram');
  }
});
