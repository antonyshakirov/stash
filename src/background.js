'use strict';

// Фон: единственное место, где Stash трогает загрузки и хранилище.
// В Chrome это service worker, в Firefox — обычный фоновый скрипт.

// Единственное различие между сборками в вызовах API: Firefox отдаёт промисы
// через `browser`, Chrome — через `chrome`. Снято здесь, чтобы дальше по коду
// об этом можно было не помнить.
const api = globalThis.browser || globalThis.chrome;

const SAVED_KEY = 'saved';
const PENDING_KEY = 'pending';

// Начатые загрузки лежат в хранилище, а не в памяти. Фон засыпает в обоих
// браузерах — в Chrome это service worker, в Firefox событийная страница, — и
// обычная Map исчезала бы вместе с ним. Тогда завершившуюся загрузку некому
// опознать, и отметка «сохранено» не ставилась бы никогда.
const pendingRevokes = new Map();

async function readPending() {
  const store = await api.storage.local.get(PENDING_KEY);
  return store[PENDING_KEY] || {};
}

async function rememberPending(id, entry) {
  const pending = await readPending();
  pending[id] = entry;
  await api.storage.local.set({ [PENDING_KEY]: pending });
}

async function takePending(id) {
  const pending = await readPending();
  const entry = pending[id];
  if (!entry) return null;
  delete pending[id];
  await api.storage.local.set({ [PENDING_KEY]: pending });
  return entry;
}

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

/**
 * Адрес, который примет загрузчик этого браузера.
 *
 * Chrome отдаёт файл, собранный расширением, `data:`-адресом: в его service
 * worker нет DOM, а значит и URL.createObjectURL. Firefox такие адреса в
 * downloads.download не принимает вовсе (Mozilla bug 1696174), зато его фон —
 * обычная страница, и blob-адрес, созданный именно здесь, загрузчик берёт.
 * Blob из контент-скрипта он бы тоже отверг, поэтому байты едут сюда
 * сообщением и превращаются в адрес на этой стороне.
 */
function downloadUrlFor(item) {
  if (item.url) return { url: item.url, revoke: null };
  if (!item.bytes) return { url: null, revoke: null };
  const blob = new Blob([Uint8Array.from(item.bytes)], { type: 'application/octet-stream' });
  const url = URL.createObjectURL(blob);
  return { url, revoke: () => URL.revokeObjectURL(url) };
}

async function startDownload(item, sender) {
  const { folder, key, force } = item;
  const filename = audioSafeName(item.slideKind, item.filename);
  if (!filename || !folder) return { ok: false, error: 'Нечего сохранять' };

  // force приходит со второго нажатия подряд: человек уже знает, что файл
  // есть, и просит копию. Память о сохранённом бережёт от случайных дублей,
  // но запирать в ней нельзя — прошлый файл мог сохраниться плохо.
  const saved = await readSaved();
  if (key && !force && saved[key]) {
    return { ok: false, duplicate: true, filename: saved[key].filename };
  }

  const { url, revoke } = downloadUrlFor(item);
  if (!url) return { ok: false, error: 'Нечего сохранять' };

  try {
    const id = await api.downloads.download({
      url,
      filename: `${folder}/${filename}`,
      conflictAction: 'uniquify',
      saveAs: false
    });
    // Отметка «сохранено» ставится не здесь, а когда загрузка действительно
    // завершится. Иначе расширение говорит «этот звук уже сохранён», а на
    // диске пусто: ровно так и вышло в Firefox, где downloads.download
    // отказывал уже после того, как отметка была поставлена.
    await rememberPending(id, {
      tabId: sender.tab ? sender.tab.id : null,
      key,
      url: item.url || null,
      filename,
      folder
    });
    if (revoke) pendingRevokes.set(id, revoke);
    return { ok: true, id, filename };
  } catch (error) {
    if (revoke) revoke();
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
  const state = delta.state && delta.state.current;
  if (state !== 'complete' && state !== 'interrupted') return;

  const revoke = pendingRevokes.get(delta.id);
  if (revoke) {
    revoke();
    pendingRevokes.delete(delta.id);
  }

  const entry = await takePending(delta.id);
  if (!entry) return;

  // Вот теперь файл действительно на диске, и об этом можно помнить. Раньше
  // отметка ставилась в момент старта, и отказ загрузчика оставлял память с
  // записью о файле, которого нет: расширение отвечало «уже сохранено» на
  // пустое место.
  if (state === 'complete') {
    await remember(entry.key, entry.filename);
    return;
  }

  // Отметку снимать незачем — её и не ставили. Но если ключ остался с прежних
  // версий, где она ставилась наперёд, самое время убрать: файла-то нет.
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
});

// Разовая чистка памяти о сохранённом. До этой версии отметка ставилась в
// момент старта загрузки, а не по её завершении, поэтому в памяти могли
// осесть записи о файлах, которых на диске нет: расширение отвечало «уже
// сохранено» на пустое место. Проверить существование файлов оно не умеет,
// поэтому память обнуляется целиком. Цена — одно лишнее скачивание там, где
// файл всё-таки был; невычищенная ложь стоила бы дороже.
const MEMORY_VERSION = 2;
const MEMORY_VERSION_KEY = 'memoryVersion';

api.runtime.onInstalled.addListener(async () => {
  const store = await api.storage.local.get(MEMORY_VERSION_KEY);
  if (store[MEMORY_VERSION_KEY] === MEMORY_VERSION) return;
  await api.storage.local.remove([SAVED_KEY, PENDING_KEY]);
  await api.storage.local.set({ [MEMORY_VERSION_KEY]: MEMORY_VERSION });
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
