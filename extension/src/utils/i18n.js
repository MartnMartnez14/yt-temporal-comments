(() => {
  'use strict';

  // Diccionario propio de la interfaz. chrome.i18n sólo resuelve el nombre y la descripción
  // del manifiesto (archivos _locales/), porque toma el idioma del navegador al cargar y no
  // se puede cambiar en caliente: el selector del popup necesita poder hacerlo sin recargar.
  const LANGUAGES = ['es', 'en'];
  const DEFAULT_LANGUAGE = 'es';
  const LANGUAGE_PREFERENCE = 'auto';

  // El formato de fecha se mantiene en dd/mm/aaaa + hh:mm:ss en los dos idiomas; el que cambia
  // es el idioma con el que Intl arma los números y separadores.

  const MESSAGES = {
    es: {
      // Panel dentro de YouTube
      panelToggle: 'Colapsar o expandir panel',
      timelineLabel: 'Marcadores de comentarios',
      captureTitle: 'Actualizar al segundo actual',
      notePlaceholder: '¿Qué querés recordar de este momento?',
      noteLabel: 'Escribí tu nota temporal',
      colorPrompt: 'Color del marcador',
      colorPickerLabel: 'Color del comentario',
      saveMoment: 'Guardar momento',
      emptyList: 'Tus notas temporales de este video aparecerán acá.',
      noVideo: 'No se detectó un video activo.',
      emptyNote: 'Escribí una nota antes de guardarla.',
      seekTitle: 'Saltar a este momento',
      markerLabel: 'Ir a {time}: {text}',
      savedAt: 'Guardada el {date} a las {time}',
      deleteTitle: 'Eliminar momento',
      deleteLabel: 'Eliminar nota de {time}',
      editTitle: 'Editar nota',
      editLabel: 'Editar nota de {time}',
      editFieldLabel: 'Editar el texto de la nota',
      save: 'Guardar',
      saveEditTitle: 'Guardar los cambios de la nota',
      cancel: 'Cancelar',
      cancelTitle: 'Descartar los cambios',
      countOne: '{count} momento',
      countMany: '{count} momentos',
      footerPrivate: '⌑ Privado en tu navegador',
      searchPlaceholder: 'Buscar en las notas de este video',
      searchLabel: 'Buscar notas',
      filterColorsLabel: 'Filtrar por color',
      filterAll: 'Todos',
      filterClear: 'Limpiar filtro',
      noMatches: 'Ninguna nota coincide con el filtro.',
      shownOfTotal: '{shown} de {total}',

      // Popup
      popupStatsLabel: 'Resumen de actividad',
      statVideos: 'Videos con notas',
      statComments: 'Momentos guardados',
      syncSectionLabel: 'Configuración de sincronización',
      syncTitle: 'Sincronizar con Chrome Sync',
      syncSub: 'Guarda copia en tu cuenta de Google',
      languageSectionLabel: 'Idioma de la interfaz',
      languageTitle: 'Idioma',
      languageSub: 'Automático sigue al navegador',
      languageAuto: 'Automático',
      languageEs: 'Español',
      languageEn: 'English',
      videosSectionLabel: 'Videos guardados',
      recentVideos: 'Tus videos recientes',
      emptyVideos: 'Abrí cualquier video en YouTube para empezar a guardar momentos.',
      backupSectionLabel: 'Respaldo de datos',
      exportJson: 'Exportar JSON',
      importJson: 'Importar JSON',
      exportMarkdown: 'Exportar Markdown',
      popupSearchPlaceholder: 'Buscar en todas las notas',
      popupResultsTitle: 'Resultados',
      popupNoMatches: 'No hay notas que coincidan.',

      // Estados del popup
      statusSyncOn: 'Sincronización activada.',
      statusSyncOff: 'Sincronización desactivada.',
      statusExported: 'Respaldo exportado ({count} notas).',
      statusExportError: 'No se pudo exportar el respaldo.',
      statusMarkdownExported: 'Markdown exportado ({count} videos).',
      statusMarkdownError: 'No se pudo exportar el Markdown.',
      statusImported: 'Importados {comments} momentos en {videos} videos.',
      statusInvalidJson: 'Archivo JSON inválido.',
      statusInvalidJsonDetail: 'El archivo no contiene un JSON válido.',
      statusUnknownStructure: 'Estructura de respaldo no reconocida.',

      // Paleta de marcadores
      colorCoral: 'Coral',
      colorOrange: 'Naranja',
      colorYellow: 'Amarillo',
      colorGreen: 'Verde',
      colorMint: 'Menta',
      colorSky: 'Celeste',
      colorBlue: 'Azul',
      colorViolet: 'Violeta',
      colorPink: 'Rosa',
      colorWhite: 'Blanco',
    },
    en: {
      // Panel inside YouTube
      panelToggle: 'Collapse or expand panel',
      timelineLabel: 'Comment markers',
      captureTitle: 'Refresh to the current second',
      notePlaceholder: 'What do you want to remember from this moment?',
      noteLabel: 'Write your timestamped note',
      colorPrompt: 'Marker color',
      colorPickerLabel: 'Comment color',
      saveMoment: 'Save moment',
      emptyList: 'Your timestamped notes for this video will appear here.',
      noVideo: 'No active video detected.',
      emptyNote: 'Write a note before saving it.',
      seekTitle: 'Jump to this moment',
      markerLabel: 'Go to {time}: {text}',
      savedAt: 'Saved on {date} at {time}',
      deleteTitle: 'Delete moment',
      deleteLabel: 'Delete note at {time}',
      editTitle: 'Edit note',
      editLabel: 'Edit note at {time}',
      editFieldLabel: 'Edit the note text',
      save: 'Save',
      saveEditTitle: 'Save the note changes',
      cancel: 'Cancel',
      cancelTitle: 'Discard the changes',
      countOne: '{count} moment',
      countMany: '{count} moments',
      footerPrivate: '⌑ Private in your browser',
      searchPlaceholder: 'Search notes in this video',
      searchLabel: 'Search notes',
      filterColorsLabel: 'Filter by color',
      filterAll: 'All',
      filterClear: 'Clear filter',
      noMatches: 'No notes match the filter.',
      shownOfTotal: '{shown} of {total}',

      // Popup
      popupStatsLabel: 'Activity summary',
      statVideos: 'Videos with notes',
      statComments: 'Saved moments',
      syncSectionLabel: 'Sync settings',
      syncTitle: 'Sync with Chrome Sync',
      syncSub: 'Keeps a copy in your Google account',
      languageSectionLabel: 'Interface language',
      languageTitle: 'Language',
      languageSub: 'Automatic follows the browser',
      languageAuto: 'Automatic',
      languageEs: 'Español',
      languageEn: 'English',
      videosSectionLabel: 'Saved videos',
      recentVideos: 'Your recent videos',
      emptyVideos: 'Open any YouTube video to start saving moments.',
      backupSectionLabel: 'Data backup',
      exportJson: 'Export JSON',
      importJson: 'Import JSON',
      exportMarkdown: 'Export Markdown',
      popupSearchPlaceholder: 'Search all notes',
      popupResultsTitle: 'Results',
      popupNoMatches: 'No notes match.',

      // Popup statuses
      statusSyncOn: 'Sync enabled.',
      statusSyncOff: 'Sync disabled.',
      statusExported: 'Backup exported ({count} notes).',
      statusExportError: 'Could not export the backup.',
      statusMarkdownExported: 'Markdown exported ({count} videos).',
      statusMarkdownError: 'Could not export the Markdown.',
      statusImported: 'Imported {comments} moments across {videos} videos.',
      statusInvalidJson: 'Invalid JSON file.',
      statusInvalidJsonDetail: 'The file does not contain valid JSON.',
      statusUnknownStructure: 'Unrecognized backup structure.',

      // Marker palette
      colorCoral: 'Coral',
      colorOrange: 'Orange',
      colorYellow: 'Yellow',
      colorGreen: 'Green',
      colorMint: 'Mint',
      colorSky: 'Sky blue',
      colorBlue: 'Blue',
      colorViolet: 'Violet',
      colorPink: 'Pink',
      colorWhite: 'White',
    },
  };

  // Clave de traducción de cada color de la paleta, por valor hex.
  const COLOR_KEYS = {
    '#f07159': 'colorCoral',
    '#f2a65a': 'colorOrange',
    '#e8ca67': 'colorYellow',
    '#80c783': 'colorGreen',
    '#59c5a5': 'colorMint',
    '#65c5d8': 'colorSky',
    '#668fe8': 'colorBlue',
    '#a58ae8': 'colorViolet',
    '#e881b4': 'colorPink',
    '#d9d9de': 'colorWhite',
  };

  let currentLanguage = DEFAULT_LANGUAGE;

  function detectLanguage() {
    let raw = '';
    if (typeof chrome !== 'undefined' && chrome.i18n && typeof chrome.i18n.getUILanguage === 'function') {
      raw = chrome.i18n.getUILanguage() || '';
    }
    if (!raw && typeof navigator !== 'undefined' && navigator.language) {
      raw = navigator.language;
    }
    return String(raw).toLowerCase().startsWith('en') ? 'en' : DEFAULT_LANGUAGE;
  }

  // 'auto' sigue al navegador; cualquier otro valor tiene que ser un idioma soportado.
  function resolveLanguage(preference) {
    if (LANGUAGES.includes(preference)) return preference;
    return detectLanguage();
  }

  function setLanguage(preference) {
    currentLanguage = resolveLanguage(preference);
    return currentLanguage;
  }

  function getLanguage() {
    return currentLanguage;
  }

  // Preferencia tal como se guarda en chrome.storage: 'auto' | 'es' | 'en'.
  function normalizePreference(value) {
    if (LANGUAGES.includes(value)) return value;
    return LANGUAGE_PREFERENCE;
  }

  function t(key, vars) {
    const dict = MESSAGES[currentLanguage] || MESSAGES[DEFAULT_LANGUAGE];
    let text = dict[key];
    if (text === undefined) text = MESSAGES[DEFAULT_LANGUAGE][key];
    if (text === undefined) return String(key);
    if (vars && typeof vars === 'object') {
      Object.keys(vars).forEach((name) => {
        text = text.split(`{${name}}`).join(String(vars[name]));
      });
    }
    return text;
  }

  function colorLabel(colorValue) {
    const key = COLOR_KEYS[String(colorValue).toLowerCase()];
    return key ? t(key) : String(colorValue);
  }

  // La fecha la arma common.js con Intl (una sola implementación): acá sólo se fija el idioma
  // activo, con el formato dd/mm/aaaa + hh:mm:ss en los dos casos.
  function formatCommentDate(isoString) {
    const Common = globalThis.YTTemporalCommon;
    if (!Common || typeof Common.formatCommentDate !== 'function') return null;
    return Common.formatCommentDate(isoString, currentLanguage);
  }

  // Rellena los textos marcados con data-i18n, data-i18n-title, data-i18n-aria-label
  // y data-i18n-placeholder dentro de `root` (el popup lo usa completo).
  function applyDom(root) {
    if (!root || typeof root.querySelectorAll !== 'function') return;
    root.querySelectorAll('[data-i18n]').forEach((el) => {
      el.textContent = t(el.getAttribute('data-i18n'));
    });
    root.querySelectorAll('[data-i18n-title]').forEach((el) => {
      el.title = t(el.getAttribute('data-i18n-title'));
    });
    root.querySelectorAll('[data-i18n-aria-label]').forEach((el) => {
      el.setAttribute('aria-label', t(el.getAttribute('data-i18n-aria-label')));
    });
    root.querySelectorAll('[data-i18n-placeholder]').forEach((el) => {
      el.placeholder = t(el.getAttribute('data-i18n-placeholder'));
    });
    const html = root.documentElement || (root.nodeType === 9 ? root.documentElement : null);
    if (html) html.lang = currentLanguage;
  }

  const api = {
    LANGUAGES,
    DEFAULT_LANGUAGE,
    LANGUAGE_PREFERENCE,
    MESSAGES,
    COLOR_KEYS,
    resolveLanguage,
    normalizePreference,
    setLanguage,
    getLanguage,
    t,
    colorLabel,
    formatCommentDate,
    applyDom,
  };

  globalThis.YTTemporalI18n = api;
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
})();
