(() => {
  'use strict';

  const COLORS = [
    { value: '#f07159' },
    { value: '#f2a65a' },
    { value: '#e8ca67' },
    { value: '#80c783' },
    { value: '#59c5a5' },
    { value: '#65c5d8' },
    { value: '#668fe8' },
    { value: '#a58ae8' },
    { value: '#e881b4' },
    { value: '#d9d9de' },
  ];

  const STORAGE_PREFIX = 'yt-temporal-comments:';
  const SETTINGS_KEY = 'yt-temporal-settings';
  const INDEX_KEY = 'yt-temporal-index';
  const MAX_COMMENT_LENGTH = 500;

  function formatTime(seconds) {
    if (!Number.isFinite(seconds) || seconds < 0) return '00:00';
    const whole = Math.floor(seconds);
    const hours = Math.floor(whole / 3600);
    const minutes = Math.floor((whole % 3600) / 60);
    const secs = whole % 60;
    return hours
      ? `${hours}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
      : `${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }

  const DATE_LOCALES = { es: 'es-UY', en: 'en-GB' };

  // Devuelve la fecha y hora locales del dispositivo a partir de un ISO 8601.
  // Formato: dd/mm/aaaa + hh:mm:ss en los dos idiomas. Devuelve null si el valor no es válido.
  // hourCycle 'h23' evita que la medianoche se muestre como 24:00.
  function formatCommentDate(isoString, language = 'es') {
    if (typeof isoString !== 'string') return null;
    const parsed = new Date(isoString);
    if (Number.isNaN(parsed.getTime())) return null;
    const locale = DATE_LOCALES[language] || DATE_LOCALES.es;
    try {
      return {
        date: new Intl.DateTimeFormat(locale, {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
        }).format(parsed),
        time: new Intl.DateTimeFormat(locale, {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hourCycle: 'h23',
        }).format(parsed),
      };
    } catch {
      return null;
    }
  }

  function extractVideoId(rawUrl) {
    if (typeof rawUrl !== 'string' || !rawUrl.trim()) return null;
    let parsed;
    try {
      parsed = new URL(rawUrl.trim());
    } catch {
      return null;
    }
    const host = parsed.hostname.toLowerCase().replace(/^www\./, '');
    let id = null;
    if (host === 'youtu.be') {
      id = parsed.pathname.split('/').filter(Boolean)[0];
    } else if (host === 'youtube.com' || host === 'm.youtube.com' || host === 'music.youtube.com') {
      if (parsed.pathname === '/watch') {
        id = parsed.searchParams.get('v');
      } else {
        const match = parsed.pathname.match(/^\/(?:embed|shorts|live)\/([^/?#]+)/);
        if (match) id = match[1];
      }
    }
    return id && /^[\w-]{11}$/.test(id) ? id : null;
  }

  function isValidColor(colorValue) {
    return typeof colorValue === 'string' && COLORS.some((c) => c.value.toLowerCase() === colorValue.toLowerCase());
  }

  function sanitizeComment(raw, fallbackVideoId = null) {
    if (!raw || typeof raw !== 'object') return null;
    const videoId = typeof raw.videoId === 'string' && /^[\w-]{11}$/.test(raw.videoId)
      ? raw.videoId
      : (typeof fallbackVideoId === 'string' && /^[\w-]{11}$/.test(fallbackVideoId) ? fallbackVideoId : null);
    if (!videoId) return null;

    const id = typeof raw.id === 'string' && raw.id.trim()
      ? raw.id.trim().slice(0, 80)
      : null;
    if (!id) return null;

    const timestamp = Number(raw.timestamp);
    if (!Number.isFinite(timestamp) || timestamp < 0) return null;

    if (typeof raw.text !== 'string') return null;
    const text = raw.text.trim().slice(0, MAX_COMMENT_LENGTH);
    if (!text) return null;

    const color = isValidColor(raw.color)
      ? COLORS.find((c) => c.value.toLowerCase() === raw.color.toLowerCase()).value
      : COLORS[0].value;

    const createdAt = typeof raw.createdAt === 'string' && !Number.isNaN(Date.parse(raw.createdAt))
      ? new Date(raw.createdAt).toISOString()
      : new Date().toISOString();

    const sanitized = {
      id,
      videoId,
      timestamp: Math.round(timestamp * 100) / 100,
      text,
      color,
      createdAt,
    };

    if (typeof raw.videoTitle === 'string' && raw.videoTitle.trim()) {
      sanitized.videoTitle = raw.videoTitle.trim().slice(0, 200);
    }

    return sanitized;
  }

  function validateCommentsArray(arr, fallbackVideoId = null) {
    if (!Array.isArray(arr)) return [];
    const seenIds = new Set();
    const valid = [];
    for (const item of arr) {
      const clean = sanitizeComment(item, fallbackVideoId);
      if (clean && !seenIds.has(clean.id)) {
        seenIds.add(clean.id);
        valid.push(clean);
      }
    }
    return valid.sort((a, b) => a.timestamp - b.timestamp);
  }

  // Markdown con enlaces directos al instante, para pegar en Notion u Obsidian.
  function commentsToMarkdown(videoId, videoTitle, comments) {
    const list = Array.isArray(comments)
      ? comments.filter((c) => c && typeof c.text === 'string')
      : [];
    const title = String(videoTitle || `Video ${videoId}`).replace(/\s+/g, ' ').trim();
    const lines = list
      .slice()
      .sort((a, b) => a.timestamp - b.timestamp)
      .map((c) => {
        const seconds = Math.max(0, Math.floor(Number(c.timestamp) || 0));
        const text = c.text.replace(/\s+/g, ' ').trim().replace(/[[\]]/g, '\\$&');
        return `- [${formatTime(c.timestamp)}](https://youtu.be/${videoId}?t=${seconds}s) — ${text}`;
      });
    return `## ${title}\n\n${lines.join('\n')}\n`;
  }

  function createComment({ videoId, videoTitle = '', timestamp, text, color }) {
    const id = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;
    return sanitizeComment({
      id,
      videoId,
      videoTitle,
      timestamp,
      text,
      color: isValidColor(color) ? color : COLORS[0].value,
      createdAt: new Date().toISOString(),
    }, videoId);
  }

  // Edita el texto o el color de una nota existente sin tocar id, instante ni fecha de creación.
  // Devuelve null cuando el texto queda vacío, igual que al crear una nota.
  function editComment(comment, changes = {}) {
    if (!comment || typeof comment !== 'object') return null;
    const nextText = changes.text === undefined ? comment.text : changes.text;
    const nextColor = changes.color === undefined ? comment.color : changes.color;
    return sanitizeComment({
      ...comment,
      text: nextText,
      color: nextColor,
      timestamp: comment.timestamp,
      createdAt: comment.createdAt,
    }, comment.videoId);
  }

  const api = {
    COLORS,
    STORAGE_PREFIX,
    SETTINGS_KEY,
    INDEX_KEY,
    MAX_COMMENT_LENGTH,
    formatTime,
    formatCommentDate,
    extractVideoId,
    isValidColor,
    sanitizeComment,
    validateCommentsArray,
    createComment,
    editComment,
    commentsToMarkdown,
  };

  globalThis.YTTemporalCommon = api;
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
})();
