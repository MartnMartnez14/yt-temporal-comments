(() => {
  'use strict';

  const Common = globalThis.YTTemporalCommon;
  const Store = globalThis.YTTemporalStore;
  const I18n = globalThis.YTTemporalI18n;

  const els = {
    statVideos: document.getElementById('stat-videos'),
    statComments: document.getElementById('stat-comments'),
    versionPill: document.getElementById('version-pill'),
    syncToggle: document.getElementById('sync-toggle'),
    languageSelect: document.getElementById('language-select'),
    searchInput: document.getElementById('search-input'),
    searchColors: document.getElementById('search-colors'),
    listTitle: document.getElementById('list-title'),
    videosList: document.getElementById('videos-list'),
    emptyMsg: document.getElementById('empty-msg'),
    exportBtn: document.getElementById('export-btn'),
    exportMdBtn: document.getElementById('export-md-btn'),
    importBtn: document.getElementById('import-btn'),
    importFile: document.getElementById('import-file'),
    statusMsg: document.getElementById('status-msg'),
  };

  // Último estado mostrado, para poder volver a pintarlo al cambiar de idioma.
  let lastStatus = null;

  // Filtro del popup: busca en las notas de todos los videos.
  const filters = { query: '', color: '' };

  function filterActive() {
    return filters.query !== '' || filters.color !== '';
  }

  // La versión sale del manifiesto para que no quede desactualizada al subir la extensión.
  function renderVersion() {
    if (!els.versionPill) return;
    if (typeof chrome === 'undefined' || !chrome.runtime || typeof chrome.runtime.getManifest !== 'function') {
      return;
    }
    try {
      els.versionPill.textContent = `v${chrome.runtime.getManifest().version}`;
    } catch {
      els.versionPill.textContent = '';
    }
  }

  function showStatus(key, vars) {
    lastStatus = key ? { key, vars } : null;
    if (!key) {
      els.statusMsg.textContent = '';
      els.statusMsg.hidden = true;
      return;
    }
    els.statusMsg.textContent = I18n.t(key, vars);
    els.statusMsg.hidden = false;
  }

  function renderStatus() {
    if (lastStatus) showStatus(lastStatus.key, lastStatus.vars);
  }

  // Cambia el idioma de toda la interfaz sin recargar la extensión.
  function applyLanguage(preference) {
    I18n.setLanguage(preference);
    I18n.applyDom(document);
    if (els.languageSelect) els.languageSelect.value = I18n.normalizePreference(preference);
    renderStatus();
    renderSearchColors();
    safeRefresh();
  }

  async function renderDashboard() {
    if (els.listTitle) els.listTitle.textContent = I18n.t('recentVideos');
    els.emptyMsg.textContent = I18n.t('emptyVideos');

    const [settings, summaries] = await Promise.all([
      Store.getSettings(),
      Store.getAllVideosSummary(),
    ]);

    els.syncToggle.checked = Boolean(settings.syncEnabled);

    const totalVideos = summaries.length;
    const totalComments = summaries.reduce((acc, item) => acc + item.count, 0);

    els.statVideos.textContent = String(totalVideos);
    els.statComments.textContent = String(totalComments);

    els.videosList.replaceChildren();
    if (summaries.length === 0) {
      els.emptyMsg.hidden = false;
      els.videosList.append(els.emptyMsg);
      return;
    }

    els.emptyMsg.hidden = true;
    summaries.forEach((item) => {
      const link = document.createElement('a');
      link.className = 'video-row';
      link.href = `https://www.youtube.com/watch?v=${encodeURIComponent(item.videoId)}`;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      link.title = item.title;

      const titleSpan = document.createElement('span');
      titleSpan.className = 'video-title';
      titleSpan.textContent = item.title;

      const countSpan = document.createElement('span');
      countSpan.className = 'video-count';
      countSpan.textContent = `${item.count}`;

      link.append(titleSpan, countSpan);
      els.videosList.append(link);
    });
  }

  // Chips de color del popup: "Todos" más la paleta de marcadores.
  function renderSearchColors() {
    if (!els.searchColors) return;
    els.searchColors.replaceChildren();

    const allBtn = document.createElement('button');
    allBtn.type = 'button';
    allBtn.className = 'search-all';
    allBtn.textContent = I18n.t('filterAll');
    allBtn.title = I18n.t('filterClear');
    allBtn.setAttribute('aria-pressed', String(filters.color === ''));
    allBtn.addEventListener('click', () => {
      filters.color = '';
      renderSearchColors();
      safeRefresh();
    });
    els.searchColors.append(allBtn);

    Common.COLORS.forEach((color) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'search-dot';
      btn.style.setProperty('--swatch', color.value);
      btn.setAttribute('aria-pressed', String(filters.color === color.value));
      btn.setAttribute('aria-label', I18n.colorLabel(color.value));
      btn.title = I18n.colorLabel(color.value);
      btn.addEventListener('click', () => {
        filters.color = filters.color === color.value ? '' : color.value;
        renderSearchColors();
        safeRefresh();
      });
      els.searchColors.append(btn);
    });
  }

  // Resultados de la búsqueda: cada nota con su video, su instante y su fecha.
  async function renderSearch() {
    const matches = await Store.searchComments(filters);
    if (els.listTitle) els.listTitle.textContent = I18n.t('popupResultsTitle');

    els.videosList.replaceChildren();
    if (matches.length === 0) {
      els.emptyMsg.hidden = false;
      els.emptyMsg.textContent = I18n.t('popupNoMatches');
      els.videosList.append(els.emptyMsg);
      return;
    }

    els.emptyMsg.hidden = true;
    matches.forEach((match) => {
      const link = document.createElement('a');
      link.className = 'note-row';
      const seconds = Math.max(0, Math.floor(Number(match.timestamp) || 0));
      link.href = `https://www.youtube.com/watch?v=${encodeURIComponent(match.videoId)}&t=${seconds}s`;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';

      const dot = document.createElement('span');
      dot.className = 'note-dot';
      dot.style.background = match.color;
      dot.setAttribute('aria-hidden', 'true');

      const body = document.createElement('span');
      body.className = 'note-body';

      const text = document.createElement('span');
      text.className = 'note-text';
      text.textContent = match.text;

      const when = I18n.formatCommentDate(match.createdAt);
      const meta = document.createElement('span');
      meta.className = 'note-meta';
      meta.textContent = [
        match.videoTitle,
        Common.formatTime(match.timestamp),
        when ? `${when.date} ${when.time}` : '',
      ].filter(Boolean).join(' · ');

      body.append(text, meta);
      link.append(dot, body);
      els.videosList.append(link);
    });
  }

  function safeRefresh() {
    refreshList().catch((err) => console.error('[YTTemporal] no se pudo actualizar la lista', err));
  }

  async function refreshList() {
    if (filterActive()) {
      await renderSearch();
      return;
    }
    await renderDashboard();
  }

  els.searchInput.addEventListener('input', () => {
    filters.query = els.searchInput.value;
    safeRefresh();
  });

  els.searchInput.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && els.searchInput.value) {
      event.preventDefault();
      els.searchInput.value = '';
      filters.query = '';
      safeRefresh();
    }
  });

  els.syncToggle.addEventListener('change', async () => {
    await Store.saveSettings({ syncEnabled: els.syncToggle.checked });
    showStatus(els.syncToggle.checked ? 'statusSyncOn' : 'statusSyncOff');
  });

  // El selector guarda 'auto' | 'es' | 'en' y aplica el cambio al panel de YouTube en el acto.
  els.languageSelect.addEventListener('change', async () => {
    const preference = I18n.normalizePreference(els.languageSelect.value);
    applyLanguage(preference);
    await Store.saveSettings({ language: preference });
    showStatus(null);
  });

  function downloadFile(fileName, text, mimeType) {
    const blob = new Blob([text], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.append(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  els.exportBtn.addEventListener('click', async () => {
    try {
      const payload = await Store.exportAllToJson();
      downloadFile(
        'yt-temporal-comments-backup.json',
        JSON.stringify(payload, null, 2),
        'application/json'
      );
      showStatus('statusExported', { count: payload.totalComments });
    } catch {
      showStatus('statusExportError');
    }
  });

  els.exportMdBtn.addEventListener('click', async () => {
    try {
      const markdown = await Store.exportAllToMarkdown();
      const videoCount = (markdown.match(/^## /gm) || []).length;
      downloadFile('yt-temporal-comments.md', markdown, 'text/markdown');
      showStatus('statusMarkdownExported', { count: videoCount });
    } catch {
      showStatus('statusMarkdownError');
    }
  });

  els.importBtn.addEventListener('click', () => {
    els.importFile.value = '';
    els.importFile.click();
  });

  els.importFile.addEventListener('change', async () => {
    const file = els.importFile.files && els.importFile.files[0];
    if (!file) return;
    try {
      const text = await file.text();
      const res = await Store.importFromJson(text);
      await renderDashboard();
      showStatus('statusImported', { comments: res.importedComments, videos: res.importedVideos });
    } catch (err) {
      // store.js devuelve códigos estables; acá se traducen al idioma activo.
      if (err && err.code === 'ERR_INVALID_JSON') showStatus('statusInvalidJsonDetail');
      else if (err && err.code === 'ERR_UNKNOWN_STRUCTURE') showStatus('statusUnknownStructure');
      else showStatus('statusInvalidJson');
    }
  });

  async function init() {
    const settings = await Store.getSettings();
    applyLanguage(settings.language);
    renderVersion();
    await refreshList();
  }

  init();
})();
