(() => {
  'use strict';

  const Common = globalThis.YTTemporalCommon;
  const Store = globalThis.YTTemporalStore;
  const I18n = globalThis.YTTemporalI18n;
  const HOST_ID = 'yt-temporal-comments-host';

  let currentVideoId = null;
  let comments = [];
  let selectedColor = Common.COLORS[0];
  let isCollapsed = false;
  let hostEl = null;
  let shadowRoot = null;
  let ui = {};
  let lastObservedHref = location.href;
  // Edición en línea: id de la nota abierta y color elegido en el borrador.
  let editingId = null;
  let editingColor = Common.COLORS[0];
  // Filtro del listado: texto libre y color exacto ('' = todos).
  let filterQuery = '';
  let filterColor = '';

  function getYouTubeVideoElement() {
    return document.querySelector('video.html5-main-video') || document.querySelector('video');
  }

  function getCurrentVideoTitle() {
    const h1 = document.querySelector('ytd-watch-metadata h1 yt-formatted-string')
      || document.querySelector('#title h1')
      || document.querySelector('h1.ytd-video-primary-info-renderer');
    if (h1 && h1.textContent && h1.textContent.trim()) {
      return h1.textContent.trim();
    }
    return document.title.replace(/\s*-\s*YouTube$/i, '').trim();
  }

  // YouTube marca el modo cine con el atributo [theater] en ytd-watch-flexy.
  function isTheaterMode() {
    return Boolean(document.querySelector('ytd-watch-flexy[theater]'));
  }

  function findMountTarget() {
    // Modo cine: la columna lateral se va abajo del reproductor y #secondary queda
    // a lo ancho. El panel va bajo el video y antes de los comentarios.
    if (isTheaterMode()) {
      const below = document.querySelector('#below');
      if (below) {
        return { parent: below, layout: 'theater', position: 'before-comments' };
      }
    }

    const secondaryInner = document.querySelector('#secondary-inner');
    if (secondaryInner && secondaryInner.offsetParent !== null) {
      return { parent: secondaryInner, layout: 'default', position: 'prepend' };
    }
    const secondary = document.querySelector('#secondary');
    if (secondary && secondary.offsetParent !== null) {
      return { parent: secondary, layout: 'default', position: 'prepend' };
    }
    const below = document.querySelector('#below');
    if (below) {
      return { parent: below, layout: 'default', position: 'prepend' };
    }
    return null;
  }

  // Sube desde `el` hasta el hijo directo de `root`, para insertar antes de un bloque anidado.
  function directChildOf(root, el) {
    let node = el;
    while (node && node.parentElement && node.parentElement !== root) {
      node = node.parentElement;
    }
    return node && node.parentElement === root ? node : null;
  }

  function mountHost(mount) {
    if (mount.position === 'before-comments') {
      const comments = mount.parent.querySelector('#comments');
      const anchor = comments ? directChildOf(mount.parent, comments) : null;
      if (anchor) {
        mount.parent.insertBefore(hostEl, anchor);
        return;
      }
      mount.parent.append(hostEl);
      return;
    }
    mount.parent.prepend(hostEl);
  }

  function buildPanelDom(root) {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.getURL
      ? chrome.runtime.getURL('src/content/content.css')
      : 'src/content/content.css';
    root.append(link);

    const panel = document.createElement('section');
    panel.className = 'ytt-panel';
    panel.setAttribute('aria-label', 'YT Temporal Comments');

    // Header
    const header = document.createElement('header');
    header.className = 'ytt-header';

    const brand = document.createElement('div');
    brand.className = 'ytt-brand';
    const mark = document.createElement('span');
    mark.className = 'ytt-brand-mark';
    mark.setAttribute('aria-hidden', 'true');
    mark.textContent = '▶';
    const brandText = document.createElement('span');
    brandText.textContent = 'YT ';
    const brandStrong = document.createElement('strong');
    brandStrong.textContent = 'Temporal';
    brandText.append(brandStrong);
    brand.append(mark, brandText);

    const headerActions = document.createElement('div');
    headerActions.className = 'ytt-header-actions';
    const countBadge = document.createElement('span');
    countBadge.className = 'ytt-badge';
    countBadge.textContent = '';

    const toggleBtn = document.createElement('button');
    toggleBtn.type = 'button';
    toggleBtn.className = 'ytt-toggle-btn';
    toggleBtn.title = I18n.t('panelToggle');
    toggleBtn.setAttribute('aria-label', I18n.t('panelToggle'));
    toggleBtn.textContent = '−';

    headerActions.append(countBadge, toggleBtn);
    header.append(brand, headerActions);

    // Body
    const body = document.createElement('div');
    body.className = 'ytt-body';

    // Timeline box
    const timelineBox = document.createElement('div');
    timelineBox.className = 'ytt-timeline-box';

    const timeLabels = document.createElement('div');
    timeLabels.className = 'ytt-time-labels';
    const startLabel = document.createElement('span');
    startLabel.textContent = '00:00';
    const endLabel = document.createElement('span');
    endLabel.textContent = '--:--';
    timeLabels.append(startLabel, endLabel);

    const timeline = document.createElement('div');
    timeline.className = 'ytt-timeline';
    timeline.setAttribute('role', 'group');
    timeline.setAttribute('aria-label', I18n.t('timelineLabel'));

    const progress = document.createElement('div');
    progress.className = 'ytt-timeline-progress';
    const playhead = document.createElement('div');
    playhead.className = 'ytt-playhead';
    playhead.hidden = true;
    timeline.append(progress, playhead);
    timelineBox.append(timeLabels, timeline);

    // Form
    const form = document.createElement('form');
    form.className = 'ytt-form';

    const captureRow = document.createElement('div');
    captureRow.className = 'ytt-capture-row';
    const captureTime = document.createElement('div');
    captureTime.className = 'ytt-capture-time';
    const captureDot = document.createElement('span');
    captureDot.className = 'ytt-capture-dot';
    const currentTimeText = document.createElement('span');
    currentTimeText.textContent = '00:00';
    const captureCaption = document.createElement('span');
    captureCaption.className = 'ytt-capture-caption';
    captureCaption.textContent = 'instante actual';
    captureTime.append(captureDot, currentTimeText, captureCaption);

    const captureBtn = document.createElement('button');
    captureBtn.type = 'button';
    captureBtn.className = 'ytt-capture-btn';
    captureBtn.title = I18n.t('captureTitle');
    captureBtn.setAttribute('aria-label', I18n.t('captureTitle'));
    captureBtn.textContent = '⟳';
    captureRow.append(captureTime, captureBtn);

    const textarea = document.createElement('textarea');
    textarea.className = 'ytt-textarea';
    textarea.rows = 2;
    textarea.maxLength = Common.MAX_COMMENT_LENGTH;
    textarea.placeholder = I18n.t('notePlaceholder');
    textarea.setAttribute('aria-label', I18n.t('noteLabel'));

    // Stop YouTube global shortcuts (like k, j, l, f, m, space) while typing inside our textarea
    textarea.addEventListener('keydown', (e) => {
      e.stopPropagation();
    });
    textarea.addEventListener('keyup', (e) => {
      e.stopPropagation();
    });
    textarea.addEventListener('keypress', (e) => {
      e.stopPropagation();
    });

    const colorLabel = document.createElement('div');
    colorLabel.className = 'ytt-color-label';
    const colorPrompt = document.createElement('span');
    colorPrompt.textContent = I18n.t('colorPrompt');
    const selectedColorName = document.createElement('span');
    selectedColorName.textContent = I18n.colorLabel(selectedColor.value);
    colorLabel.append(colorPrompt, selectedColorName);

    const colorPicker = document.createElement('div');
    colorPicker.className = 'ytt-color-picker';
    colorPicker.setAttribute('role', 'radiogroup');
    colorPicker.setAttribute('aria-label', I18n.t('colorPickerLabel'));

    const errorMsg = document.createElement('p');
    errorMsg.className = 'ytt-error';
    errorMsg.setAttribute('role', 'alert');
    errorMsg.hidden = true;

    const saveBtn = document.createElement('button');
    saveBtn.type = 'submit';
    saveBtn.className = 'ytt-save-btn';
    const saveText = document.createElement('span');
    saveText.textContent = I18n.t('saveMoment');
    const savePlus = document.createElement('span');
    savePlus.setAttribute('aria-hidden', 'true');
    savePlus.textContent = '＋';
    saveBtn.append(saveText, savePlus);

    form.append(captureRow, textarea, colorLabel, colorPicker, errorMsg, saveBtn);

    // Búsqueda y filtro por color del listado
    const filterBox = document.createElement('div');
    filterBox.className = 'ytt-filter';
    filterBox.setAttribute('role', 'search');

    const searchInput = document.createElement('input');
    searchInput.type = 'search';
    searchInput.className = 'ytt-search';
    searchInput.placeholder = I18n.t('searchPlaceholder');
    searchInput.setAttribute('aria-label', I18n.t('searchLabel'));

    const filterColors = document.createElement('div');
    filterColors.className = 'ytt-filter-colors';
    filterColors.setAttribute('role', 'group');
    filterColors.setAttribute('aria-label', I18n.t('filterColorsLabel'));

    const filterInfo = document.createElement('p');
    filterInfo.className = 'ytt-filter-info';
    filterInfo.hidden = true;

    filterBox.append(searchInput, filterColors);

    // List
    const list = document.createElement('div');
    list.className = 'ytt-list';
    list.setAttribute('aria-live', 'polite');

    const empty = document.createElement('div');
    empty.className = 'ytt-empty';
    const emptyIcon = document.createElement('span');
    emptyIcon.className = 'ytt-empty-icon';
    emptyIcon.setAttribute('aria-hidden', 'true');
    emptyIcon.textContent = '✳';
    const emptyText = document.createElement('span');
    emptyText.textContent = I18n.t('emptyList');
    empty.append(emptyIcon, emptyText);

    const footer = document.createElement('div');
    footer.className = 'ytt-footer';
    const footerNote = document.createElement('span');
    footerNote.textContent = I18n.t('footerPrivate');
    const videoIdSpan = document.createElement('span');
    videoIdSpan.textContent = '';
    footer.append(footerNote, videoIdSpan);

    body.append(timelineBox, form, filterBox, filterInfo, list, empty, footer);
    panel.append(header, body);
    root.append(panel);

    ui = {
      panel,
      body,
      countBadge,
      toggleBtn,
      endLabel,
      timeline,
      progress,
      playhead,
      currentTimeText,
      captureBtn,
      textarea,
      selectedColorName,
      colorPrompt,
      colorPicker,
      errorMsg,
      form,
      saveText,
      searchInput,
      filterColors,
      filterInfo,
      list,
      empty,
      emptyText,
      footerNote,
      videoIdSpan,
    };

    toggleBtn.addEventListener('click', () => {
      isCollapsed = !isCollapsed;
      ui.body.hidden = isCollapsed;
      ui.toggleBtn.textContent = isCollapsed ? '＋' : '−';
    });

    captureBtn.addEventListener('click', () => {
      updateClock();
      ui.textarea.focus();
    });

    form.addEventListener('submit', onAddComment);

    searchInput.addEventListener('input', () => {
      filterQuery = searchInput.value;
      renderComments();
    });
    searchInput.addEventListener('keydown', (event) => {
      event.stopPropagation();
      if (event.key === 'Escape' && searchInput.value) {
        event.preventDefault();
        searchInput.value = '';
        filterQuery = '';
        renderComments();
      }
    });

    renderColors();
    renderFilterColors();
  }

  // Chips de color del filtro: "Todos" más la paleta. Un solo color activo a la vez.
  function renderFilterColors() {
    if (!ui.filterColors) return;
    ui.filterColors.replaceChildren();

    const allBtn = document.createElement('button');
    allBtn.type = 'button';
    allBtn.className = 'ytt-filter-all';
    allBtn.textContent = I18n.t('filterAll');
    allBtn.title = I18n.t('filterClear');
    allBtn.setAttribute('aria-pressed', String(filterColor === ''));
    allBtn.addEventListener('click', () => {
      filterColor = '';
      renderComments();
    });
    ui.filterColors.append(allBtn);

    Common.COLORS.forEach((color) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'ytt-filter-dot';
      btn.style.setProperty('--swatch', color.value);
      btn.setAttribute('aria-pressed', String(filterColor === color.value));
      btn.setAttribute('aria-label', I18n.colorLabel(color.value));
      btn.title = I18n.colorLabel(color.value);
      btn.addEventListener('click', () => {
        filterColor = filterColor === color.value ? '' : color.value;
        renderComments();
      });
      ui.filterColors.append(btn);
    });
  }

  // Idioma activo: preferencia guardada ('auto' | 'es' | 'en').
  let languagePreference = I18n ? I18n.LANGUAGE_PREFERENCE : 'auto';

  // Repinta todos los textos fijos del panel en el idioma activo. Se llama al montar el panel,
  // al cambiar el selector del popup y cuando el guardado del idioma llega después del montaje.
  function applyLanguage(preference) {
    if (!I18n) return;
    languagePreference = I18n.normalizePreference(preference);
    I18n.setLanguage(languagePreference);
    if (!ui.panel) return;

    ui.toggleBtn.title = I18n.t('panelToggle');
    ui.toggleBtn.setAttribute('aria-label', I18n.t('panelToggle'));
    ui.timeline.setAttribute('aria-label', I18n.t('timelineLabel'));
    ui.captureBtn.title = I18n.t('captureTitle');
    ui.captureBtn.setAttribute('aria-label', I18n.t('captureTitle'));
    ui.textarea.placeholder = I18n.t('notePlaceholder');
    ui.textarea.setAttribute('aria-label', I18n.t('noteLabel'));
    ui.colorPrompt.textContent = I18n.t('colorPrompt');
    ui.colorPicker.setAttribute('aria-label', I18n.t('colorPickerLabel'));
    ui.saveText.textContent = I18n.t('saveMoment');
    ui.emptyText.textContent = I18n.t('emptyList');
    ui.footerNote.textContent = I18n.t('footerPrivate');
    ui.searchInput.placeholder = I18n.t('searchPlaceholder');
    ui.searchInput.setAttribute('aria-label', I18n.t('searchLabel'));
    ui.filterColors.setAttribute('aria-label', I18n.t('filterColorsLabel'));

    renderColors();
    renderFilterColors();
    renderComments();
    updateClock();
  }

  function renderColors() {
    if (!ui.colorPicker) return;
    ui.colorPicker.replaceChildren();
    Common.COLORS.forEach((color, index) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'ytt-color-choice';
      btn.style.setProperty('--swatch', color.value);
      btn.setAttribute('role', 'radio');
      btn.setAttribute('aria-label', I18n.colorLabel(color.value));
      btn.setAttribute('aria-checked', String(color.value === selectedColor.value));
      btn.tabIndex = color.value === selectedColor.value ? 0 : -1;
      btn.title = I18n.colorLabel(color.value);
      btn.addEventListener('click', () => {
        selectedColor = color;
        ui.selectedColorName.textContent = I18n.colorLabel(color.value);
        renderColors();
      });
      btn.addEventListener('keydown', (event) => {
        event.stopPropagation();
        if (!['ArrowRight', 'ArrowLeft'].includes(event.key)) return;
        event.preventDefault();
        const next = (index + (event.key === 'ArrowRight' ? 1 : -1) + Common.COLORS.length) % Common.COLORS.length;
        const target = ui.colorPicker.children[next];
        if (target) {
          target.focus();
          target.click();
        }
      });
      ui.colorPicker.append(btn);
    });
  }

  function seekTo(seconds) {
    const video = getYouTubeVideoElement();
    if (!video) return;
    video.currentTime = Math.max(0, seconds);
    if (video.paused) {
      video.play().catch(() => {});
    }
    updateClock();
  }

  async function deleteComment(commentId) {
    if (!currentVideoId) return;
    const next = comments.filter((c) => c.id !== commentId);
    comments = next;
    if (editingId === commentId) editingId = null;
    await Store.saveComments(currentVideoId, comments, { title: getCurrentVideoTitle() });
    renderComments();
  }

  // Abre la nota en modo edición sin tocar el instante ni la fecha de creación.
  function startEditing(comment) {
    editingId = comment.id;
    editingColor = Common.COLORS.find(
      (c) => c.value.toLowerCase() === String(comment.color).toLowerCase(),
    ) || Common.COLORS[0];
    renderComments();
    const input = ui.list ? ui.list.querySelector('.ytt-item-editor-input') : null;
    if (input) {
      input.focus();
      input.setSelectionRange(input.value.length, input.value.length);
    }
  }

  function cancelEditing() {
    editingId = null;
    renderComments();
  }

  async function saveEdit(comment, rawText, errorEl) {
    if (!currentVideoId) return;
    const text = typeof rawText === 'string' ? rawText.trim() : '';
    if (!text) {
      if (errorEl) {
        errorEl.textContent = I18n.t('emptyNote');
        errorEl.hidden = false;
      }
      return;
    }

    // editComment conserva id, videoId, timestamp y createdAt: sólo cambian texto y color.
    const updated = Common.editComment(comment, { text, color: editingColor.value });
    if (!updated) return;

    comments = comments.map((c) => (c.id === updated.id ? updated : c));
    editingId = null;
    await Store.saveComments(currentVideoId, comments, { title: getCurrentVideoTitle() });
    renderComments();
  }

  // Formulario de edición en línea de una nota existente.
  function buildCommentEditor(comment) {
    const editor = document.createElement('div');
    editor.className = 'ytt-item-editor';

    const input = document.createElement('textarea');
    input.className = 'ytt-textarea ytt-item-editor-input';
    input.rows = 2;
    input.maxLength = Common.MAX_COMMENT_LENGTH;
    input.value = comment.text;
    input.setAttribute('aria-label', I18n.t('editFieldLabel'));

    const colors = document.createElement('div');
    colors.className = 'ytt-item-editor-colors';
    colors.setAttribute('role', 'radiogroup');
    colors.setAttribute('aria-label', I18n.t('colorPickerLabel'));

    Common.COLORS.forEach((color) => {
      const dot = document.createElement('button');
      dot.type = 'button';
      dot.className = 'ytt-color-choice';
      dot.style.setProperty('--swatch', color.value);
      dot.setAttribute('role', 'radio');
      dot.setAttribute('aria-checked', String(color.value === editingColor.value));
      dot.setAttribute('aria-label', I18n.colorLabel(color.value));
      dot.title = I18n.colorLabel(color.value);
      dot.addEventListener('click', () => {
        editingColor = color;
        colors.querySelectorAll('.ytt-color-choice').forEach((el) => {
          el.setAttribute('aria-checked', 'false');
        });
        dot.setAttribute('aria-checked', 'true');
      });
      colors.append(dot);
    });

    const error = document.createElement('p');
    error.className = 'ytt-error';
    error.setAttribute('role', 'alert');
    error.hidden = true;

    const actions = document.createElement('div');
    actions.className = 'ytt-item-editor-actions';

    const saveBtn = document.createElement('button');
    saveBtn.type = 'button';
    saveBtn.className = 'ytt-mini-btn ytt-mini-btn-primary';
    saveBtn.textContent = I18n.t('save');
    saveBtn.title = I18n.t('saveEditTitle');
    saveBtn.addEventListener('click', () => saveEdit(comment, input.value, error));

    const cancelBtn = document.createElement('button');
    cancelBtn.type = 'button';
    cancelBtn.className = 'ytt-mini-btn';
    cancelBtn.textContent = I18n.t('cancel');
    cancelBtn.title = I18n.t('cancelTitle');
    cancelBtn.addEventListener('click', cancelEditing);

    input.addEventListener('keydown', (event) => {
      event.stopPropagation();
      if (event.key === 'Escape') {
        event.preventDefault();
        cancelEditing();
        return;
      }
      if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
        event.preventDefault();
        saveEdit(comment, input.value, error);
      }
    });

    actions.append(saveBtn, cancelBtn);
    editor.append(input, colors, error, actions);
    return editor;
  }

  async function onAddComment(event) {
    event.preventDefault();
    ui.errorMsg.hidden = true;
    ui.errorMsg.textContent = '';

    if (!currentVideoId) {
      ui.errorMsg.textContent = I18n.t('noVideo');
      ui.errorMsg.hidden = false;
      return;
    }

    const text = ui.textarea.value.trim();
    if (!text) {
      ui.errorMsg.textContent = I18n.t('emptyNote');
      ui.errorMsg.hidden = false;
      ui.textarea.focus();
      return;
    }

    const video = getYouTubeVideoElement();
    const timestamp = video && Number.isFinite(video.currentTime) ? video.currentTime : 0;
    const title = getCurrentVideoTitle();

    const newComment = Common.createComment({
      videoId: currentVideoId,
      videoTitle: title,
      timestamp,
      text,
      color: selectedColor.value,
    });

    if (!newComment) return;
    comments = [...comments, newComment].sort((a, b) => a.timestamp - b.timestamp);
    await Store.saveComments(currentVideoId, comments, { title });
    ui.textarea.value = '';
    renderComments();
  }

  function renderTimeline(duration) {
    if (!ui.timeline) return;
    ui.timeline.querySelectorAll('.ytt-marker').forEach((m) => m.remove());
    comments.forEach((comment) => {
      const marker = document.createElement('button');
      marker.type = 'button';
      marker.className = 'ytt-marker';
      const pct = duration > 0 ? Math.min(100, Math.max(0, (comment.timestamp / duration) * 100)) : 0;
      marker.style.left = `${pct}%`;
      marker.style.backgroundColor = comment.color;
      const markerTime = Common.formatTime(comment.timestamp);
      marker.title = `${markerTime} · ${comment.text}`;
      marker.setAttribute('aria-label', I18n.t('markerLabel', { time: markerTime, text: comment.text }));
      marker.addEventListener('click', () => seekTo(comment.timestamp));
      ui.timeline.append(marker);
    });
  }

  // Refleja el filtro activo en los chips sin reconstruirlos (no se pierde el foco).
  function syncFilterChips() {
    if (!ui.filterColors) return;
    const allBtn = ui.filterColors.querySelector('.ytt-filter-all');
    if (allBtn) allBtn.setAttribute('aria-pressed', String(filterColor === ''));
    ui.filterColors.querySelectorAll('.ytt-filter-dot').forEach((btn) => {
      btn.setAttribute('aria-pressed', String(btn.style.getPropertyValue('--swatch') === filterColor));
    });
  }

  function renderComments() {
    if (!ui.list) return;
    comments.sort((a, b) => a.timestamp - b.timestamp);

    const filtering = filterQuery !== '' || filterColor !== '';
    const visible = Common.filterComments(comments, { query: filterQuery, color: filterColor });

    ui.list.replaceChildren();
    ui.empty.hidden = visible.length > 0;
    ui.emptyText.textContent = filtering ? I18n.t('noMatches') : I18n.t('emptyList');
    ui.countBadge.textContent = comments.length === 1
      ? I18n.t('countOne', { count: comments.length })
      : I18n.t('countMany', { count: comments.length });
    if (ui.filterInfo) {
      ui.filterInfo.hidden = !filtering;
      ui.filterInfo.textContent = filtering
        ? I18n.t('shownOfTotal', { shown: visible.length, total: comments.length })
        : '';
    }
    syncFilterChips();

    visible.forEach((comment) => {
      const item = document.createElement('article');
      item.className = 'ytt-item';
      item.style.setProperty('--item-color', comment.color);

      const bar = document.createElement('span');
      bar.className = 'ytt-item-bar';
      bar.setAttribute('aria-hidden', 'true');

      // Una sola nota puede estar en edición: en ese caso el cuerpo es el formulario.
      if (editingId === comment.id) {
        item.classList.add('ytt-item-editing');
        item.append(bar, buildCommentEditor(comment));
        ui.list.append(item);
        return;
      }

      const main = document.createElement('div');
      main.className = 'ytt-item-main';

      const timeBtn = document.createElement('button');
      timeBtn.type = 'button';
      timeBtn.className = 'ytt-item-time';
      timeBtn.textContent = Common.formatTime(comment.timestamp);
      timeBtn.title = I18n.t('seekTitle');
      timeBtn.addEventListener('click', () => seekTo(comment.timestamp));

      const textEl = document.createElement('p');
      textEl.className = 'ytt-item-text';
      textEl.textContent = comment.text;

      main.append(timeBtn, textEl);

      // Columna derecha: fecha/hora de creación arriba, botón eliminar abajo.
      const side = document.createElement('div');
      side.className = 'ytt-item-side';

      const when = I18n.formatCommentDate(comment.createdAt);
      if (when) {
        const meta = document.createElement('div');
        meta.className = 'ytt-item-meta';
        meta.title = I18n.t('savedAt', { date: when.date, time: when.time });

        const dateEl = document.createElement('span');
        dateEl.className = 'ytt-item-date';
        dateEl.textContent = when.date;

        const clockEl = document.createElement('span');
        clockEl.className = 'ytt-item-clock';
        clockEl.textContent = when.time;

        meta.append(dateEl, clockEl);
        side.append(meta);
      }

      const delBtn = document.createElement('button');
      delBtn.type = 'button';
      delBtn.className = 'ytt-delete-btn';
      delBtn.textContent = '×';
      delBtn.title = I18n.t('deleteTitle');
      delBtn.setAttribute('aria-label', I18n.t('deleteLabel', { time: Common.formatTime(comment.timestamp) }));
      delBtn.addEventListener('click', () => deleteComment(comment.id));

      const editBtn = document.createElement('button');
      editBtn.type = 'button';
      editBtn.className = 'ytt-edit-btn';
      editBtn.textContent = '✎';
      editBtn.title = I18n.t('editTitle');
      editBtn.setAttribute('aria-label', I18n.t('editLabel', { time: Common.formatTime(comment.timestamp) }));
      editBtn.addEventListener('click', () => startEditing(comment));

      const itemActions = document.createElement('div');
      itemActions.className = 'ytt-item-actions';
      itemActions.append(editBtn, delBtn);

      side.append(itemActions);
      item.append(bar, main, side);
      ui.list.append(item);
    });

    const video = getYouTubeVideoElement();
    const duration = video && Number.isFinite(video.duration) ? video.duration : 0;
    renderTimeline(duration);
  }

  // Al cambiar de video no puede quedar visible ni un instante el listado anterior.
  function resetVideoState() {
    comments = [];
    editingId = null;
    if (ui.errorMsg) {
      ui.errorMsg.hidden = true;
      ui.errorMsg.textContent = '';
    }
    if (ui.textarea) ui.textarea.value = '';
    renderComments();
  }

  function updateClock() {
    if (!ui.currentTimeText) return;
    const video = getYouTubeVideoElement();
    if (!video) return;

    const current = Number.isFinite(video.currentTime) ? video.currentTime : 0;
    const duration = Number.isFinite(video.duration) && video.duration > 0 ? video.duration : 0;

    ui.currentTimeText.textContent = Common.formatTime(current);
    ui.endLabel.textContent = duration > 0 ? Common.formatTime(duration) : '--:--';

    const pct = duration > 0 ? Math.min(100, Math.max(0, (current / duration) * 100)) : 0;
    ui.progress.style.width = `${pct}%`;
    ui.playhead.hidden = duration <= 0;
    ui.playhead.style.left = `${pct}%`;
  }

  let trackedVideo = null;

  // El reproductor de YouTube se recrea al cambiar de video: reenganchar los eventos cada vez.
  function attachVideoListeners() {
    const video = getYouTubeVideoElement();
    if (!video) return;
    if (video === trackedVideo) return;

    if (trackedVideo) {
      ['timeupdate', 'loadedmetadata', 'durationchange', 'seeked', 'play', 'pause'].forEach((eventName) => {
        trackedVideo.removeEventListener(eventName, updateClock);
      });
    }

    trackedVideo = video;
    ['timeupdate', 'loadedmetadata', 'durationchange', 'seeked', 'play', 'pause'].forEach((eventName) => {
      video.addEventListener(eventName, updateClock);
    });
    updateClock();
  }

  function ensureMounted() {
    const videoId = Common.extractVideoId(location.href);
    if (!videoId) {
      if (hostEl && hostEl.isConnected) {
        hostEl.remove();
      }
      currentVideoId = null;
      resetVideoState();
      return;
    }

    const mount = findMountTarget();
    if (!mount) return;

    if (!hostEl) {
      hostEl = document.createElement('div');
      hostEl.id = HOST_ID;
      shadowRoot = hostEl.attachShadow({ mode: 'open' });
      buildPanelDom(shadowRoot);
      applyLanguage(languagePreference);
    }

    // Cambiar de modo (predeterminado ↔ cine) mueve el panel a otro contenedor.
    if (hostEl.parentElement !== mount.parent || hostEl.dataset.layout !== mount.layout) {
      mountHost(mount);
      hostEl.dataset.layout = mount.layout;
    }

    attachVideoListeners();

    if (currentVideoId !== videoId) {
      currentVideoId = videoId;
      resetVideoState();
      if (ui.videoIdSpan) ui.videoIdSpan.textContent = videoId;
      Store.getComments(videoId).then((loaded) => {
        if (currentVideoId === videoId) {
          comments = loaded;
          renderComments();
          updateClock();
        }
      });
    }
  }

  // Alt+N: salta al instante actual y enfoca el campo de nota, sin salir del reproductor.
  document.addEventListener('keydown', (event) => {
    if (!event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
    if (event.key.toLowerCase() !== 'n') return;
    const target = event.target;
    if (target && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName))) return;
    if (!hostEl || !hostEl.isConnected || !ui.textarea) return;
    event.preventDefault();
    event.stopPropagation();
    if (isCollapsed) {
      isCollapsed = false;
      ui.body.hidden = false;
      ui.toggleBtn.textContent = '−';
    }
    updateClock();
    ui.textarea.focus();
  }, true);

  // YouTube avisa el arranque de la navegación interna: si el video destino es otro, el listado
  // viejo se limpia en el acto. Se compara con la URL para no vaciar el panel cuando la navegación
  // termina en el mismo video (ahí nadie volvería a cargar las notas).
  document.addEventListener('yt-navigate-start', () => {
    if (!hostEl || !hostEl.isConnected) return;
    if (Common.extractVideoId(location.href) !== currentVideoId) resetVideoState();
  });

  document.addEventListener('yt-navigate-finish', () => {
    setTimeout(ensureMounted, 150);
  });

  // Al entrar o salir de modo cine YouTube reacomoda la página: reubicar el panel.
  document.addEventListener('yt-page-data-updated', () => {
    setTimeout(ensureMounted, 150);
  });

  if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.onChanged) {
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area === 'local' && changes[Common.SETTINGS_KEY]) {
        const next = changes[Common.SETTINGS_KEY].newValue;
        applyLanguage(next && next.language ? next.language : I18n.LANGUAGE_PREFERENCE);
      }
      if (area === 'local' && currentVideoId) {
        const key = `${Common.STORAGE_PREFIX}${currentVideoId}`;
        if (changes[key]) {
          Store.getComments(currentVideoId).then((loaded) => {
            comments = loaded;
            renderComments();
          });
        }
      }
    });
  }

  setInterval(() => {
    if (location.href !== lastObservedHref) {
      lastObservedHref = location.href;
      ensureMounted();
    } else if (!hostEl || !hostEl.isConnected) {
      ensureMounted();
    } else if ((hostEl.dataset.layout === 'theater') !== isTheaterMode()) {
      // El modo cine se activa sin cambiar la URL: hay que mover el panel.
      ensureMounted();
    }
    if (currentVideoId) attachVideoListeners();
  }, 500);

  // La preferencia de idioma se aplica al montar el panel: si llega antes, queda en
  // languagePreference; si llega después, applyLanguage repinta el panel ya montado.
  Store.getSettings()
    .then((settings) => applyLanguage(settings.language))
    .catch(() => {});

  ensureMounted();
})();
