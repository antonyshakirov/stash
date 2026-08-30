'use strict';

// Страница настроек. Единственная её задача — записать имена папок в
// chrome.storage.local. Правила чистки и значения по умолчанию берутся из
// того же ядра, что и сохранение, поэтому показанный здесь путь совпадает
// с тем, куда файл ляжет на самом деле.

(function () {
  const extract = globalThis.StashExtract;
  if (!extract) return;

  const SLOTS = ['video', 'image', 'audio'];
  // Пример имени файла из README: показывает не только папку, но и то, что
  // в ней окажется.
  const SAMPLES = {
    video: 'nike — 2026-08-01 — DKx9dQ2.mp4',
    image: 'nike — 2026-08-01 — DKx9dQ2 — 3.jpg',
    audio: 'nike — 2026-08-01 — DKx9dQ2.m4a'
  };

  const fields = {};
  const previews = {};
  const status = document.getElementById('status');
  let statusTimer = null;

  for (const slot of SLOTS) {
    fields[slot] = document.getElementById(slot);
    previews[slot] = document.getElementById(`${slot}-preview`);
    fields[slot].placeholder = extract.DEFAULT_FOLDERS[slot];
    fields[slot].addEventListener('input', redraw);
  }

  function say(text) {
    status.textContent = text;
    clearTimeout(statusTimer);
    if (text) statusTimer = setTimeout(() => { status.textContent = ''; }, 4000);
  }

  // Путь считается тем же folderFor, что и при сохранении. Если человек ввёл
  // что-то, что чистка выбросит целиком, он увидит имя по умолчанию ещё до
  // нажатия «Сохранить», а не после первого пропавшего файла.
  function redraw() {
    for (const slot of SLOTS) {
      const folder = extract.folderFor(slot, current());
      previews[slot].textContent = `Загрузки/${folder}/${SAMPLES[slot]}`;
    }
  }

  function current() {
    const folders = {};
    for (const slot of SLOTS) folders[slot] = fields[slot].value;
    return folders;
  }

  function cleaned() {
    const folders = {};
    for (const slot of SLOTS) {
      const value = extract.sanitizeFolder(fields[slot].value);
      // Пустое поле не пишется вовсе: тогда folderFor берёт умолчание, и
      // переименование умолчаний в будущих версиях само доедет до человека.
      if (value) folders[slot] = value;
    }
    return folders;
  }

  async function load() {
    const store = await chrome.storage.local.get(extract.SETTINGS_KEY);
    const settings = store[extract.SETTINGS_KEY];
    const folders = (settings && settings.folders) || {};
    for (const slot of SLOTS) fields[slot].value = folders[slot] || '';
    redraw();
  }

  async function save() {
    const folders = cleaned();
    const store = await chrome.storage.local.get(extract.SETTINGS_KEY);
    const settings = store[extract.SETTINGS_KEY] || {};
    await chrome.storage.local.set({ [extract.SETTINGS_KEY]: { ...settings, folders } });

    // Показываем то, что записалось, а не то, что было набрано: чистка могла
    // убрать из имени недопустимое, и молчать об этом нельзя.
    const changed = SLOTS.some((slot) => (folders[slot] || '') !== fields[slot].value.trim());
    for (const slot of SLOTS) fields[slot].value = folders[slot] || '';
    redraw();
    say(changed ? 'Сохранено. Имена папок поправлены под правила файловой системы.' : 'Сохранено.');
  }

  async function reset() {
    for (const slot of SLOTS) fields[slot].value = '';
    await save();
    say('Вернул имена по умолчанию.');
  }

  document.getElementById('save').addEventListener('click', () => {
    save().catch((error) => say(`Не сохранилось: ${error.message}`));
  });
  document.getElementById('reset').addEventListener('click', () => {
    reset().catch((error) => say(`Не сохранилось: ${error.message}`));
  });

  load().catch((error) => say(`Настройки не прочитались: ${error.message}`));
})();
