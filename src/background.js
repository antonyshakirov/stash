'use strict';

// Фон: единственное место, где Stash трогает загрузки и хранилище.
// В Chrome это service worker, в Firefox — обычный фоновый скрипт.

// Единственное различие между сборками в вызовах API: Firefox отдаёт промисы
// через `browser`, Chrome — через `chrome`. Снято здесь, чтобы дальше по коду
// об этом можно было не помнить.
const api = globalThis.browser || globalThis.chrome;

const SAVED_KEY = 'saved';

// downloadId -> откуда пришла загрузка, чтобы сообщить вкладке о срыве.
const inFlight = new Map();

async function readSaved() {
  const store = await api.storage.local.get(SAVED_KEY);
  return store[SAVED_KEY] || {};
}

async function remember(key, filename) {
  if (!key) return;
  const saved = await readSaved();
  saved[key] = { filename, at: Date.now() };
  await api.storage.local.set({ [SAVED_KEY]: saved });
}

async function forget(key) {
  if (!key) return;
  const saved = await readSaved();
  if (!saved[key]) return;
  delete saved[key];
  await api.storage.local.set({ [SAVED_KEY]: saved });
}

// Последний рубеж перед диском: у звука не должно оказаться расширения видео.
// Контейнер у m4a и mp4 один и тот же, но по имени и система, и человек
// считают такой файл роликом.
//
// Проверяется тип слайда, а не имя папки: имя папки настраивается человеком,
// и стоило бы ему переименовать «Saved Audio», как рубеж молча перестал бы
// срабатывать. Тип приходит из того же места, что и сам файл.
function audioSafeName(kind, filename) {
  return kind === 'audio' ? filename.replace(/\.mp4$/i, '.m4a') : filename;
}

async function startDownload(item, sender) {
  const { url, folder, key, force } = item;
  const filename = audioSafeName(item.slideKind, item.filename);
  if (!url || !filename || !folder) return { ok: false, error: 'Нечего сохранять' };

  // force приходит со второго нажатия подряд: человек уже знает, что файл
  // есть, и просит копию. Память о сохранённом бережёт от случайных дублей,
  // но запирать в ней нельзя — прошлый файл мог сохраниться плохо.
  const saved = await readSaved();
  if (key && !force && saved[key]) {
    return { ok: false, duplicate: true, filename: saved[key].filename };
  }

  try {
    const id = await api.downloads.download({
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

api.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || message.kind !== 'download') return undefined;
  startDownload(message, sender).then(sendResponse);
  return true;
});

// Загрузка могла стартовать и умереть позже: тогда снимаем отметку
// «уже сохранён» и просим вкладку попробовать запасной путь.
api.downloads.onChanged.addListener(async (delta) => {
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
        await api.tabs.sendMessage(entry.tabId, {
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
api.action.onClicked.addListener(async (tab) => {
  if (!tab || tab.id == null) return;
  try {
    await api.tabs.sendMessage(tab.id, { kind: 'download-current' });
  } catch (error) {
    console.warn('[stash] вкладка не отвечает, обнови страницу Instagram');
  }
});
