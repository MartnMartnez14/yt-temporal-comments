(() => {
  'use strict';

  const Common = globalThis.YTTemporalCommon;
  // Límites reales de chrome.storage.sync: QUOTA_BYTES_PER_ITEM (8192) y QUOTA_BYTES (102400).
  // Se trabaja con margen para no quedar justo en el borde.
  const SYNC_ITEM_LIMIT = 8192;
  const SYNC_TOTAL_LIMIT = 102400;
  const SYNC_ITEM_SOFT_LIMIT = 7500;
  const SYNC_TOTAL_SOFT_LIMIT = 95000;

  function hasChromeStorage() {
    return typeof chrome !== 'undefined' && Boolean(chrome.storage && chrome.storage.local);
  }

  function storageKey(videoId) {
    return `${Common.STORAGE_PREFIX}${videoId}`;
  }

  // Cuando no hay chrome.storage (páginas abiertas a mano, pruebas en el navegador) se usa
  // localStorage, pero con el área en la clave: local y sync son espacios distintos en Chrome y
  // mezclarlos hacía que escribir en sync pisara la copia local.
  const FALLBACK_PREFIX = 'ytt-fallback:';

  function fallbackKey(area, key) {
    return `${FALLBACK_PREFIX}${area}:${key}`;
  }

  function fromFallback(area, k) {
    const prefix = fallbackKey(area, '');
    return k.startsWith(prefix) ? k.slice(prefix.length) : null;
  }

  async function rawGet(area, keys) {
    if (hasChromeStorage() && chrome.storage[area]) {
      return new Promise((resolve) => {
        chrome.storage[area].get(keys, (res) => {
          if (chrome.runtime && chrome.runtime.lastError) {
            resolve({});
            return;
          }
          resolve(res || {});
        });
      });
    }
    try {
      if (keys === null) {
        const all = {};
        for (let i = 0; i < localStorage.length; i += 1) {
          const stored = localStorage.key(i);
          const k = stored ? fromFallback(area, stored) : null;
          if (!k) continue;
          try {
            all[k] = JSON.parse(localStorage.getItem(stored));
          } catch {
            all[k] = localStorage.getItem(stored);
          }
        }
        return all;
      }
      const keyList = Array.isArray(keys) ? keys : [keys];
      const out = {};
      for (const k of keyList) {
        const raw = localStorage.getItem(fallbackKey(area, k));
        if (raw !== null) {
          try {
            out[k] = JSON.parse(raw);
          } catch {
            out[k] = raw;
          }
        }
      }
      return out;
    } catch {
      return {};
    }
  }

  async function rawSet(area, items) {
    if (hasChromeStorage() && chrome.storage[area]) {
      return new Promise((resolve) => {
        chrome.storage[area].set(items, () => {
          resolve(!(chrome.runtime && chrome.runtime.lastError));
        });
      });
    }
    try {
      for (const [k, v] of Object.entries(items)) {
        localStorage.setItem(fallbackKey(area, k), JSON.stringify(v));
      }
      return true;
    } catch {
      return false;
    }
  }

  async function rawRemove(area, keys) {
    if (hasChromeStorage() && chrome.storage[area]) {
      return new Promise((resolve) => {
        chrome.storage[area].remove(keys, () => {
          resolve(!(chrome.runtime && chrome.runtime.lastError));
        });
      });
    }
    try {
      const list = Array.isArray(keys) ? keys : [keys];
      for (const k of list) localStorage.removeItem(fallbackKey(area, k));
      return true;
    } catch {
      return false;
    }
  }

  async function getSettings() {
    const data = await rawGet('local', Common.SETTINGS_KEY);
    const stored = data[Common.SETTINGS_KEY];
    const language = stored && typeof stored.language === 'string' ? stored.language : 'auto';
    return {
      syncEnabled: stored && typeof stored.syncEnabled === 'boolean' ? stored.syncEnabled : true,
      // 'auto' sigue al idioma del navegador; los otros son preferencias explícitas.
      language: ['auto', 'es', 'en'].includes(language) ? language : 'auto',
    };
  }

  async function saveSettings(partial) {
    const current = await getSettings();
    const next = {
      ...current,
      ...(partial && typeof partial === 'object' ? partial : {}),
    };
    await rawSet('local', { [Common.SETTINGS_KEY]: next });
    return next;
  }

  async function getIndex() {
    const data = await rawGet('local', Common.INDEX_KEY);
    const index = data[Common.INDEX_KEY];
    return index && typeof index === 'object' && !Array.isArray(index) ? index : {};
  }

  async function updateIndexEntry(videoId, comments, videoTitle = '') {
    const index = await getIndex();
    if (!comments || comments.length === 0) {
      delete index[videoId];
    } else {
      const existingTitle = index[videoId] && index[videoId].title ? index[videoId].title : '';
      const inferredTitle = videoTitle || comments.find((c) => c.videoTitle)?.videoTitle || existingTitle || `Video ${videoId}`;
      index[videoId] = {
        videoId,
        title: inferredTitle.slice(0, 200),
        count: comments.length,
        updatedAt: new Date().toISOString(),
      };
    }
    await rawSet('local', { [Common.INDEX_KEY]: index });
    return index;
  }

  async function getComments(videoId) {
    if (!videoId) return [];
    const key = storageKey(videoId);
    const localData = await rawGet('local', key);
    if (Array.isArray(localData[key])) {
      return Common.validateCommentsArray(localData[key], videoId);
    }

    const settings = await getSettings();
    if (settings.syncEnabled) {
      const syncData = await rawGet('sync', key);
      if (Array.isArray(syncData[key])) {
        const validated = Common.validateCommentsArray(syncData[key], videoId);
        await rawSet('local', { [key]: validated });
        await updateIndexEntry(videoId, validated);
        return validated;
      }
    }
    return [];
  }

  // Bytes que ocupa una entrada, contando la clave y el JSON, como los mide Chrome.
  function entryBytes(key, value) {
    return JSON.stringify({ [key]: value }).length;
  }

  // Bytes ya usados en sync, sin contar la clave que se está por escribir.
  function syncBytesExcluding(syncData, key) {
    let total = 0;
    for (const [k, v] of Object.entries(syncData)) {
      if (!k.startsWith(Common.STORAGE_PREFIX) || k === key) continue;
      total += entryBytes(k, v);
    }
    return total;
  }

  // Guarda siempre en local; sincroniza sólo si entraría en la cuota de Chrome Sync.
  // Devuelve { saved, synced, reason, bytes } con reason: null | 'disabled' | 'item' | 'total' | 'error'.
  async function saveComments(videoId, comments, videoMeta = {}) {
    if (!videoId) return { saved: false, synced: false, reason: 'error', bytes: 0 };
    const key = storageKey(videoId);
    const clean = Common.validateCommentsArray(comments, videoId);

    if (clean.length === 0) {
      await rawRemove('local', key);
      await rawRemove('sync', key);
      await updateIndexEntry(videoId, []);
      return { saved: true, synced: true, reason: null, bytes: 0 };
    }

    const savedLocal = await rawSet('local', { [key]: clean });
    await updateIndexEntry(videoId, clean, videoMeta.title || '');
    const bytes = entryBytes(key, clean);

    const settings = await getSettings();
    if (!settings.syncEnabled) {
      return { saved: savedLocal, synced: false, reason: 'disabled', bytes };
    }

    // Fuera de Sync queda sólo en este equipo. Si había una versión vieja sincronizada se borra,
    // porque mostrarla en otro dispositivo sería peor que no mostrar nada.
    if (bytes > SYNC_ITEM_SOFT_LIMIT) {
      await rawRemove('sync', key);
      return { saved: savedLocal, synced: false, reason: 'item', bytes };
    }

    const syncData = await rawGet('sync', null);
    if (syncBytesExcluding(syncData, key) + bytes > SYNC_TOTAL_SOFT_LIMIT) {
      await rawRemove('sync', key);
      return { saved: savedLocal, synced: false, reason: 'total', bytes };
    }

    const synced = await rawSet('sync', { [key]: clean });
    return { saved: savedLocal, synced, reason: synced ? null : 'error', bytes };
  }

  // Dos listas son la misma copia si tienen las mismas notas, en el mismo orden y con el mismo
  // texto y color; comparar sólo la clave diría que está sincronizado aunque la copia sea vieja.
  function sameComments(a, b) {
    if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false;
    return a.every((item, index) => (
      item && b[index]
      && item.id === b[index].id
      && item.text === b[index].text
      && item.color === b[index].color
    ));
  }

  // Estado de la sincronización: qué videos están sólo en local y cuánto ocupa el conjunto.
  async function getSyncReport() {
    const settings = await getSettings();
    const localData = await rawGet('local', null);
    const syncData = await rawGet('sync', null);

    const items = [];
    const pending = [];
    for (const [key, value] of Object.entries(localData)) {
      if (!key.startsWith(Common.STORAGE_PREFIX)) continue;
      const videoId = key.slice(Common.STORAGE_PREFIX.length);
      if (!/[\w-]{11}/.test(videoId)) continue;
      const bytes = entryBytes(key, value);
      const synced = Object.prototype.hasOwnProperty.call(syncData, key)
        && sameComments(value, syncData[key]);
      const item = { videoId, bytes, synced };
      items.push(item);
      if (!synced) pending.push(item);
    }

    let totalBytes = 0;
    for (const [key, value] of Object.entries(syncData)) {
      if (!key.startsWith(Common.STORAGE_PREFIX)) continue;
      totalBytes += entryBytes(key, value);
    }

    return {
      enabled: settings.syncEnabled,
      items,
      pending,
      totalBytes,
      itemLimit: SYNC_ITEM_SOFT_LIMIT,
      totalLimit: SYNC_TOTAL_SOFT_LIMIT,
      hardItemLimit: SYNC_ITEM_LIMIT,
      hardTotalLimit: SYNC_TOTAL_LIMIT,
    };
  }

  async function getAllVideosSummary() {
    const allLocal = await rawGet('local', null);
    const index = allLocal[Common.INDEX_KEY] && typeof allLocal[Common.INDEX_KEY] === 'object'
      ? allLocal[Common.INDEX_KEY]
      : {};

    const summaries = [];
    for (const [key, val] of Object.entries(allLocal)) {
      if (!key.startsWith(Common.STORAGE_PREFIX)) continue;
      const videoId = key.slice(Common.STORAGE_PREFIX.length);
      if (!/^[\w-]{11}$/.test(videoId)) continue;
      const comments = Common.validateCommentsArray(val, videoId);
      if (comments.length === 0) continue;
      const meta = index[videoId] || {};
      const title = meta.title || comments.find((c) => c.videoTitle)?.videoTitle || `youtube.com/watch?v=${videoId}`;
      summaries.push({
        videoId,
        title,
        count: comments.length,
        updatedAt: meta.updatedAt || comments[comments.length - 1].createdAt,
        colors: Array.from(new Set(comments.map((c) => c.color))).slice(0, 5),
      });
    }

    return summaries.sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
  }

  async function exportAllToJson() {
    const allLocal = await rawGet('local', null);
    const index = allLocal[Common.INDEX_KEY] || {};
    const videos = {};
    let totalComments = 0;

    for (const [key, val] of Object.entries(allLocal)) {
      if (!key.startsWith(Common.STORAGE_PREFIX)) continue;
      const videoId = key.slice(Common.STORAGE_PREFIX.length);
      if (!/^[\w-]{11}$/.test(videoId)) continue;
      const comments = Common.validateCommentsArray(val, videoId);
      if (comments.length === 0) continue;
      totalComments += comments.length;
      videos[videoId] = {
        title: index[videoId]?.title || comments.find((c) => c.videoTitle)?.videoTitle || `youtube.com/watch?v=${videoId}`,
        comments,
      };
    }

    return {
      app: 'yt-temporal-comments',
      version: 1,
      exportedAt: new Date().toISOString(),
      totalVideos: Object.keys(videos).length,
      totalComments,
      videos,
    };
  }

  async function exportAllToMarkdown() {
    const allLocal = await rawGet('local', null);
    const index = allLocal[Common.INDEX_KEY] && typeof allLocal[Common.INDEX_KEY] === 'object'
      ? allLocal[Common.INDEX_KEY]
      : {};
    const blocks = [];
    const videoIds = Object.keys(allLocal)
      .filter((key) => key.startsWith(Common.STORAGE_PREFIX))
      .map((key) => key.slice(Common.STORAGE_PREFIX.length))
      .filter((videoId) => /^[\w-]{11}$/.test(videoId))
      .sort();

    for (const videoId of videoIds) {
      const comments = Common.validateCommentsArray(allLocal[`${Common.STORAGE_PREFIX}${videoId}`], videoId);
      if (comments.length === 0) continue;
      const title = index[videoId]?.title || comments.find((c) => c.videoTitle)?.videoTitle || `Video ${videoId}`;
      blocks.push(Common.commentsToMarkdown(videoId, title, comments));
    }
    return blocks.join('\n');
  }

  // Busca en las notas de todos los videos. Devuelve cada coincidencia con el video al que
  // pertenece, ordenadas por título del video y después por instante.
  async function searchComments(options = {}) {
    const allLocal = await rawGet('local', null);
    const index = allLocal[Common.INDEX_KEY] && typeof allLocal[Common.INDEX_KEY] === 'object'
      ? allLocal[Common.INDEX_KEY]
      : {};
    const matches = [];

    for (const [key, val] of Object.entries(allLocal)) {
      if (!key.startsWith(Common.STORAGE_PREFIX)) continue;
      const videoId = key.slice(Common.STORAGE_PREFIX.length);
      if (!/^[\w-]{11}$/.test(videoId)) continue;
      const comments = Common.validateCommentsArray(val, videoId);
      if (comments.length === 0) continue;
      const found = Common.filterComments(comments, options);
      if (found.length === 0) continue;
      const title = index[videoId]?.title
        || comments.find((c) => c.videoTitle)?.videoTitle
        || `youtube.com/watch?v=${videoId}`;
      for (const comment of found) {
        matches.push({ ...comment, videoId, videoTitle: title });
      }
    }

    return matches.sort((a, b) => (
      a.videoTitle.localeCompare(b.videoTitle) || a.timestamp - b.timestamp
    ));
  }

  // Errores de importación con código estable: el popup los traduce al idioma activo.
  function importError(code) {
    const error = new Error(code);
    error.code = code;
    return error;
  }

  async function importFromJson(jsonInput) {
    let parsed;
    try {
      parsed = typeof jsonInput === 'string' ? JSON.parse(jsonInput) : jsonInput;
    } catch {
      throw importError('ERR_INVALID_JSON');
    }

    if (!parsed || typeof parsed !== 'object' || !parsed.videos || typeof parsed.videos !== 'object') {
      throw importError('ERR_UNKNOWN_STRUCTURE');
    }

    let importedVideos = 0;
    let importedComments = 0;

    for (const [videoId, entry] of Object.entries(parsed.videos)) {
      if (!/^[\w-]{11}$/.test(videoId)) continue;
      const incomingList = Array.isArray(entry) ? entry : (entry && Array.isArray(entry.comments) ? entry.comments : []);
      const validIncoming = Common.validateCommentsArray(incomingList, videoId);
      if (validIncoming.length === 0) continue;

      const existing = await getComments(videoId);
      const mergedMap = new Map();
      for (const item of existing) mergedMap.set(item.id, item);
      for (const item of validIncoming) mergedMap.set(item.id, item);

      const merged = Array.from(mergedMap.values()).sort((a, b) => a.timestamp - b.timestamp);
      const title = entry && typeof entry.title === 'string' ? entry.title : '';
      await saveComments(videoId, merged, { title });
      importedVideos += 1;
      importedComments += validIncoming.length;
    }

    return { importedVideos, importedComments };
  }

  const api = {
    getSettings,
    saveSettings,
    getComments,
    saveComments,
    getSyncReport,
    getAllVideosSummary,
    exportAllToJson,
    exportAllToMarkdown,
    searchComments,
    importFromJson,
  };

  globalThis.YTTemporalStore = api;
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
})();
