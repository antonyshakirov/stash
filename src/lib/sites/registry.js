'use strict';

// Выбор площадки по имени хоста. Грузится последним среди словарей: к этому
// моменту каждый из них уже записал себя в список.

(function (root) {
  const sites = root.StashSites || { list: [] };

  sites.pick = function pick(hostname) {
    if (typeof hostname !== 'string' || !hostname) return null;
    return sites.list.find((site) => site.hosts.test(hostname)) || null;
  };

  root.StashSites = sites;

  if (typeof module !== 'undefined' && module.exports) module.exports = sites;
})(typeof globalThis !== 'undefined' ? globalThis : this);
