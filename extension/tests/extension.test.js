'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const EXTENSION_DIR = path.resolve(__dirname, '..');
const MANIFEST_PATH = path.join(EXTENSION_DIR, 'manifest.json');
const SRC_DIR = path.join(EXTENSION_DIR, 'src');

// Mock de chrome.storage (local y sync) en memoria para pruebas aisladas
function createChromeStorageMock() {
  const buckets = {
    local: new Map(),
    sync: new Map(),
  };

  function makeArea(name) {
    const map = buckets[name];
    return {
      get(keys, cb) {
        const result = {};
        if (keys === null || keys === undefined) {
          for (const [k, v] of map.entries()) {
            result[k] = structuredClone(v);
          }
        } else {
          const list = Array.isArray(keys) ? keys : [keys];
          for (const k of list) {
            if (map.has(k)) {
              result[k] = structuredClone(map.get(k));
            }
          }
        }
        cb(result);
      },
      set(items, cb) {
        for (const [k, v] of Object.entries(items)) {
          map.set(k, structuredClone(v));
        }
        if (cb) cb();
      },
      remove(keys, cb) {
        const list = Array.isArray(keys) ? keys : [keys];
        for (const k of list) {
          map.delete(k);
        }
        if (cb) cb();
      },
      clear() {
        map.clear();
      },
      _dump() {
        return Object.fromEntries(map.entries());
      },
    };
  }

  return {
    local: makeArea('local'),
    sync: makeArea('sync'),
    reset() {
      buckets.local.clear();
      buckets.sync.clear();
    },
  };
}

const storageMock = createChromeStorageMock();
globalThis.chrome = {
  runtime: { lastError: null },
  storage: {
    local: storageMock.local,
    sync: storageMock.sync,
  },
};

const Common = require('../src/utils/common.js');
const I18n = require('../src/utils/i18n.js');
const Store = require('../src/storage/store.js');

function collectFilesRecursively(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectFilesRecursively(full));
    } else if (entry.isFile()) {
      files.push(full);
    }
  }
  return files;
}

test('manifest.json: validez MV3, permisos mínimos y archivos existentes', () => {
  assert.ok(fs.existsSync(MANIFEST_PATH), 'Debe existir extension/manifest.json');
  const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));

  assert.equal(manifest.manifest_version, 3, 'Debe ser Manifest V3');
  assert.ok(typeof manifest.name === 'string' && manifest.name.length > 0);
  assert.match(manifest.version, /^\d+\.\d+\.\d+$/);

  assert.deepEqual(manifest.permissions, ['storage'], 'Solo debe requerir el permiso storage');
  assert.deepEqual(manifest.host_permissions, ['*://*.youtube.com/*']);

  // Verificar iconos declarados
  for (const size of ['16', '32', '48', '128']) {
    const relIcon = manifest.icons[size];
    assert.ok(relIcon, `Falta icono de tamaño ${size}`);
    const fullIcon = path.join(EXTENSION_DIR, relIcon);
    assert.ok(fs.existsSync(fullIcon), `No existe el archivo de icono: ${relIcon}`);
    assert.ok(fs.statSync(fullIcon).size > 0, `El icono ${relIcon} está vacío`);
  }

  // Verificar popup y archivos de content_scripts / web_accessible_resources
  const popupPath = path.join(EXTENSION_DIR, manifest.action.default_popup);
  assert.ok(fs.existsSync(popupPath), 'Debe existir el archivo default_popup');

  for (const cs of manifest.content_scripts) {
    for (const jsFile of cs.js) {
      assert.ok(fs.existsSync(path.join(EXTENSION_DIR, jsFile)), `No existe content script: ${jsFile}`);
    }
  }

  // Ya no hay recursos web accesibles: el CSS viaja como texto en styles.js. Si alguien vuelve a
  // declararlos, es señal de que volvió la carga por chrome-extension:// que Chrome rechaza.
  assert.equal(
    manifest.web_accessible_resources,
    undefined,
    'No debe declarar web_accessible_resources'
  );
});

test('common.js: formatTime formatea segundos y maneja bordes e inválidos', () => {
  assert.equal(Common.formatTime(0), '00:00');
  assert.equal(Common.formatTime(9), '00:09');
  assert.equal(Common.formatTime(65.9), '01:05');
  assert.equal(Common.formatTime(3661), '1:01:01');
  assert.equal(Common.formatTime(-5), '00:00');
  assert.equal(Common.formatTime(NaN), '00:00');
  assert.equal(Common.formatTime(Infinity), '00:00');
});

test('common.js: formatCommentDate arma fecha y hora locales completas', () => {
  // Se construye en hora local para que el test no dependa del TZ de la máquina.
  const afternoon = new Date(2026, 10, 6, 14, 32, 7);
  assert.deepEqual(Common.formatCommentDate(afternoon.toISOString()), {
    date: '06/11/2026',
    time: '14:32:07',
  });

  // Día y mes de un dígito se rellenan con cero; medianoche no se confunde con 24h.
  const earlyMorning = new Date(2025, 0, 9, 3, 4, 5);
  assert.deepEqual(Common.formatCommentDate(earlyMorning.toISOString()), {
    date: '09/01/2025',
    time: '03:04:05',
  });

  // El createdAt que genera createComment siempre debe ser formateable.
  const created = Common.createComment({
    videoId: 'dQw4w9WgXcQ',
    timestamp: 10,
    text: 'Nota con fecha',
    color: Common.COLORS[0].value,
  });
  assert.ok(Common.formatCommentDate(created.createdAt));

  // Entradas inválidas: null, nunca una fecha inventada.
  assert.equal(Common.formatCommentDate('no-es-fecha'), null);
  assert.equal(Common.formatCommentDate(undefined), null);
  assert.equal(Common.formatCommentDate(null), null);
});

test('common.js: extractVideoId soporta watch, youtu.be, shorts, live, embed y rechaza inválidos', () => {
  const validId = 'dQw4w9WgXcQ';
  assert.equal(Common.extractVideoId(`https://www.youtube.com/watch?v=${validId}&t=12s`), validId);
  assert.equal(Common.extractVideoId(`https://m.youtube.com/watch?v=${validId}`), validId);
  assert.equal(Common.extractVideoId(`https://music.youtube.com/watch?v=${validId}`), validId);
  assert.equal(Common.extractVideoId(`https://youtu.be/${validId}?si=abc`), validId);
  assert.equal(Common.extractVideoId(`https://www.youtube.com/shorts/${validId}`), validId);
  assert.equal(Common.extractVideoId(`https://www.youtube.com/live/${validId}?feature=share`), validId);
  assert.equal(Common.extractVideoId(`https://www.youtube.com/embed/${validId}`), validId);

  assert.equal(Common.extractVideoId('https://www.youtube.com/feed/subscriptions'), null);
  assert.equal(Common.extractVideoId('https://www.youtube.com/watch?v=short'), null);
  assert.equal(Common.extractVideoId('https://example.com/watch?v=dQw4w9WgXcQ'), null);
  assert.equal(Common.extractVideoId('no-es-una-url'), null);
  assert.equal(Common.extractVideoId(''), null);
  assert.equal(Common.extractVideoId(null), null);
});

test('common.js: sanitizeComment y createComment validan, normalizan y truncan entradas', () => {
  const videoId = 'dQw4w9WgXcQ';
  const created = Common.createComment({
    videoId,
    videoTitle: '  Mi Video de Prueba  ',
    timestamp: 42.678,
    text: '  Nota importante en el minuto 0:42  ',
    color: '#65c5d8',
  });

  assert.ok(created);
  assert.equal(created.videoId, videoId);
  assert.equal(created.videoTitle, 'Mi Video de Prueba');
  assert.equal(created.timestamp, 42.68);
  assert.equal(created.text, 'Nota importante en el minuto 0:42');
  assert.equal(created.color, '#65c5d8');
  assert.ok(typeof created.id === 'string' && created.id.length > 0);

  // Color inválido cae al color por defecto (Coral)
  const fallbackColor = Common.createComment({
    videoId,
    timestamp: 10,
    text: 'Color desconocido',
    color: '#000000',
  });
  assert.equal(fallbackColor.color, Common.COLORS[0].value);

  // Texto largo se trunca a MAX_COMMENT_LENGTH
  const longText = 'a'.repeat(Common.MAX_COMMENT_LENGTH + 150);
  const truncated = Common.createComment({
    videoId,
    timestamp: 1,
    text: longText,
    color: Common.COLORS[1].value,
  });
  assert.equal(truncated.text.length, Common.MAX_COMMENT_LENGTH);

  // Entradas inválidas devuelven null
  assert.equal(Common.sanitizeComment(null), null);
  assert.equal(Common.sanitizeComment({ id: '1', videoId: 'bad', timestamp: 10, text: 'hola' }), null);
  assert.equal(Common.sanitizeComment({ id: '1', videoId, timestamp: -1, text: 'hola' }), null);
  assert.equal(Common.sanitizeComment({ id: '1', videoId, timestamp: 10, text: '   ' }), null);
});

test('common.js: editComment cambia texto y color y conserva id, instante y fecha de creación', () => {
  const videoId = 'dQw4w9WgXcQ';
  const original = {
    id: 'nota-1',
    videoId,
    videoTitle: 'Video de prueba',
    timestamp: 125.5,
    text: 'Texto original',
    color: Common.COLORS[2].value,
    createdAt: '2026-11-10T22:15:04.000Z',
  };

  const edited = Common.editComment(original, {
    text: '  Texto corregido  ',
    color: Common.COLORS[5].value,
  });
  assert.ok(edited);
  assert.equal(edited.id, 'nota-1');
  assert.equal(edited.videoId, videoId);
  assert.equal(edited.timestamp, 125.5);
  assert.equal(edited.createdAt, '2026-11-10T22:15:04.000Z');
  assert.equal(edited.text, 'Texto corregido');
  assert.equal(edited.color, Common.COLORS[5].value);

  // La nota original no se muta
  assert.equal(original.text, 'Texto original');
  assert.equal(original.color, Common.COLORS[2].value);

  // Cambiar sólo el color deja el texto intacto
  const onlyColor = Common.editComment(original, { color: Common.COLORS[9].value });
  assert.equal(onlyColor.text, 'Texto original');
  assert.equal(onlyColor.color, Common.COLORS[9].value);

  // Texto vacío invalida la edición, igual que al crear una nota
  assert.equal(Common.editComment(original, { text: '   ' }), null);
  // Color inválido cae al color por defecto sin perder el resto
  assert.equal(Common.editComment(original, { color: '#000000' }).color, Common.COLORS[0].value);
  // Texto largo se trunca a MAX_COMMENT_LENGTH
  const long = Common.editComment(original, { text: 'b'.repeat(Common.MAX_COMMENT_LENGTH + 50) });
  assert.equal(long.text.length, Common.MAX_COMMENT_LENGTH);
});

test('content.js: cada nota se abre en edición sin perder el instante', () => {
  const source = fs.readFileSync(path.join(SRC_DIR, 'content', 'content.js'), 'utf8');
  const css = fs.readFileSync(path.join(SRC_DIR, 'content', 'content.css'), 'utf8');

  // La edición reutiliza editComment, que conserva id, timestamp y createdAt.
  assert.match(source, /Common\.editComment\(comment/);
  assert.match(source, /editingId = comment\.id/);
  assert.match(source, /function startEditing\(/);
  // El formulario en línea reemplaza el cuerpo de la nota, con colores y guardar/cancelar.
  assert.match(source, /ytt-item-editor-input/);
  assert.match(source, /ytt-item-editor-colors/);
  assert.match(css, /\.ytt-item-editor\s*\{/);
  assert.match(css, /\.ytt-edit-btn\s*\{/);
});
test('store.js: guardado, lectura, índice de videos, exportAllToJson e importFromJson sin duplicados', async () => {
  storageMock.reset();
  const videoA = 'dQw4w9WgXcQ';
  const videoB = '3JZ_D3ELwOQ';

  const c1 = Common.createComment({
    videoId: videoA,
    videoTitle: 'Video Alfa',
    timestamp: 90,
    text: 'Segundo comentario cronológico',
    color: '#80c783',
  });
  const c2 = Common.createComment({
    videoId: videoA,
    videoTitle: 'Video Alfa',
    timestamp: 15,
    text: 'Primer comentario cronológico',
    color: '#f07159',
  });

  const saved = await Store.saveComments(videoA, [c1, c2], { title: 'Video Alfa' });
  assert.equal(saved.saved, true);
  assert.equal(saved.synced, true);
  assert.equal(saved.reason, null);

  // Debe devolverlos ordenados por timestamp ascendente
  const loadedA = await Store.getComments(videoA);
  assert.equal(loadedA.length, 2);
  assert.equal(loadedA[0].id, c2.id);
  assert.equal(loadedA[1].id, c1.id);

  // Resumen de videos e índice
  const summaries = await Store.getAllVideosSummary();
  assert.equal(summaries.length, 1);
  assert.equal(summaries[0].videoId, videoA);
  assert.equal(summaries[0].title, 'Video Alfa');
  assert.equal(summaries[0].count, 2);

  // Exportar todo a JSON
  const exported = await Store.exportAllToJson();
  assert.equal(exported.app, 'yt-temporal-comments');
  assert.equal(exported.totalVideos, 1);
  assert.equal(exported.totalComments, 2);
  assert.ok(exported.videos[videoA]);

  // Importar fusionando: mismo comentario c1 (no debe duplicarse) + nuevo comentario en videoA + nuevo videoB
  const c3 = Common.createComment({
    videoId: videoA,
    timestamp: 120,
    text: 'Tercer comentario importado',
    color: '#668fe8',
  });
  const cB1 = Common.createComment({
    videoId: videoB,
    timestamp: 5,
    text: 'Nota en video Beta',
    color: '#e8ca67',
  });

  const importPayload = JSON.stringify({
    app: 'yt-temporal-comments',
    version: 1,
    videos: {
      [videoA]: {
        title: 'Video Alfa Actualizado',
        comments: [c1, c3],
      },
      [videoB]: {
        title: 'Video Beta',
        comments: [cB1],
      },
    },
  });

  const importResult = await Store.importFromJson(importPayload);
  assert.equal(importResult.importedVideos, 2);
  assert.equal(importResult.importedComments, 3);

  const mergedA = await Store.getComments(videoA);
  assert.equal(mergedA.length, 3, 'No debe duplicar c1 al fusionar por ID');
  assert.deepEqual(
    mergedA.map((c) => c.timestamp),
    [15, 90, 120]
  );

  // Eliminar todos los comentarios de un video limpia su entrada
  await Store.saveComments(videoB, []);
  const afterDeleteB = await Store.getComments(videoB);
  assert.equal(afterDeleteB.length, 0);

  // Rechazo de JSON corrupto o estructura inválida
  await assert.rejects(
    () => Store.importFromJson('{json-corrupto'),
    (err) => err.code === 'ERR_INVALID_JSON'
  );
  await assert.rejects(
    () => Store.importFromJson(JSON.stringify({ foo: 'bar' })),
    (err) => err.code === 'ERR_UNKNOWN_STRUCTURE'
  );
});

test('content.js: el listado muestra fecha y hora de creación a la derecha de cada nota', () => {
  const contentPath = path.join(SRC_DIR, 'content', 'content.js');
  const cssPath = path.join(SRC_DIR, 'content', 'content.css');
  const source = fs.readFileSync(contentPath, 'utf8');
  const css = fs.readFileSync(cssPath, 'utf8');

  assert.match(source, /I18n\.formatCommentDate\(comment\.createdAt\)/);
  assert.match(source, /classList\.add\('ytt-item-side'\)|className = 'ytt-item-side'/);
  assert.match(css, /\.ytt-item-side\s*\{/);
  assert.match(css, /\.ytt-item-meta\s*\{/);
});

test('content.js: el reloj se actualiza con eventos del reproductor', () => {
  const source = fs.readFileSync(path.join(SRC_DIR, 'content', 'content.js'), 'utf8');
  for (const evento of ['timeupdate', 'loadedmetadata', 'durationchange', 'seeked']) {
    assert.match(source, new RegExp(`'${evento}'`), `Falta el evento ${evento}`);
  }
});

test('content.js: registra el atajo Alt+N sin interferir al escribir', () => {
  const source = fs.readFileSync(path.join(SRC_DIR, 'content', 'content.js'), 'utf8');
  assert.match(source, /event\.altKey/);
  assert.match(source, /isContentEditable/);
});

test('content.js: el panel se reubica en modo cine bajo el reproductor', () => {
  const source = fs.readFileSync(path.join(SRC_DIR, 'content', 'content.js'), 'utf8');
  const css = fs.readFileSync(path.join(SRC_DIR, 'content', 'content.css'), 'utf8');

  // Detección del modo cine por el atributo que pone YouTube.
  assert.match(source, /ytd-watch-flexy\[theater\]/);
  // El modo cine monta el panel bajo el reproductor, antes de los comentarios.
  assert.match(source, /layout: 'theater'/);
  assert.match(source, /#comments/);
  // Se marca el layout en el host para poder ajustar estilos por modo.
  assert.match(source, /dataset\.layout/);
  // Y se reacciona al cambio de modo sin depender de que cambie la URL.
  assert.match(source, /yt-page-data-updated/);
  assert.match(css, /:host\(\[data-layout='theater'\]\)/);
});

test('popup: la versión mostrada sale del manifiesto, no escrita a mano', () => {
  const html = fs.readFileSync(path.join(SRC_DIR, 'popup', 'popup.html'), 'utf8');
  const jsSource = fs.readFileSync(path.join(SRC_DIR, 'popup', 'popup.js'), 'utf8');

  assert.match(html, /id="version-pill"/);
  assert.equal(
    /v\d+\.\d+\.\d+/.test(html),
    false,
    'La versión no debe estar hardcodeada en popup.html'
  );
  assert.match(jsSource, /chrome\.runtime\.getManifest\(\)\.version/);
});

test('store.js: el índice guarda título, cantidad y fecha de actualización por video', async () => {
  storageMock.reset();
  const videoId = 'dQw4w9WgXcQ';
  const c = Common.createComment({
    videoId,
    videoTitle: 'Charla sobre arquitectura',
    timestamp: 12,
    text: 'Nota con título',
    color: Common.COLORS[0].value,
  });
  await Store.saveComments(videoId, [c], { title: 'Charla sobre arquitectura' });

  const summaries = await Store.getAllVideosSummary();
  assert.equal(summaries.length, 1);
  assert.equal(summaries[0].title, 'Charla sobre arquitectura');
  assert.equal(summaries[0].count, 1);
  assert.match(summaries[0].updatedAt, /^\d{4}-\d{2}-\d{2}T/);
});

test('common.js: commentsToMarkdown arma enlaces con instante y escapa corchetes', () => {
  const md = Common.commentsToMarkdown('dQw4w9WgXcQ', 'Video  Alfa', [
    { timestamp: 90, text: 'Segunda [importante]\nparte' },
    { timestamp: 5, text: 'Primera' },
  ]);
  assert.equal(
    md,
    '## Video Alfa\n\n' +
      '- [00:05](https://youtu.be/dQw4w9WgXcQ?t=5s) — Primera\n' +
      '- [01:30](https://youtu.be/dQw4w9WgXcQ?t=90s) — Segunda \\[importante\\] parte\n'
  );
});

test('store.js: exportAllToMarkdown junta todos los videos con encabezado', async () => {
  storageMock.reset();
  const videoId = 'dQw4w9WgXcQ';
  const c = Common.createComment({
    videoId,
    timestamp: 15,
    text: 'Momento exportado',
    color: Common.COLORS[0].value,
  });
  await Store.saveComments(videoId, [c], { title: 'Video Alfa' });

  const md = await Store.exportAllToMarkdown();
  assert.match(md, /^## Video Alfa/);
  assert.match(md, /- \[00:15\]\(https:\/\/youtu\.be\/dQw4w9WgXcQ\?t=15s\) — Momento exportado/);
});

test('seguridad estática: ningún archivo en extension/src/ usa innerHTML ni carga fuentes/scripts remotos', () => {
  const files = collectFilesRecursively(SRC_DIR);
  assert.ok(files.length > 0, 'Debe haber archivos fuente en extension/src/');

  for (const file of files) {
    const content = fs.readFileSync(file, 'utf8');
    const rel = path.relative(EXTENSION_DIR, file);

    assert.equal(
      /\binnerHTML\b|\bouterHTML\b|\binsertAdjacentHTML\b/.test(content),
      false,
      `Uso prohibido de innerHTML/outerHTML en ${rel}`
    );
    assert.equal(
      /fonts\.googleapis\.com|fonts\.gstatic\.com/.test(content),
      false,
      `Carga remota de fuentes detectada en ${rel}`
    );
    assert.equal(
      /<script[^>]+src=["']https?:/i.test(content),
      false,
      `Carga remota de script externo detectada en ${rel}`
    );
  }
});

test('manifest.json: default_locale, textos por __MSG__ y ambos _locales completos', () => {
  const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));

  assert.equal(manifest.default_locale, 'es');
  assert.equal(manifest.name, '__MSG_appName__');
  assert.equal(manifest.description, '__MSG_appDesc__');
  assert.equal(manifest.action.default_title, '__MSG_appName__');

  const locales = {};
  for (const locale of ['es', 'en']) {
    const file = path.join(EXTENSION_DIR, '_locales', locale, 'messages.json');
    assert.ok(fs.existsSync(file), `Falta _locales/${locale}/messages.json`);
    locales[locale] = JSON.parse(fs.readFileSync(file, 'utf8'));
    for (const key of ['appName', 'appDesc']) {
      const entry = locales[locale][key];
      assert.ok(entry && typeof entry.message === 'string' && entry.message.trim(), `${locale}.${key} vacío`);
    }
    // La descripción corta de la tienda admite 132 caracteres.
    assert.ok(locales[locale].appDesc.message.length <= 132, `appDesc demasiado larga en ${locale}`);
  }
  assert.equal(locales.es.appName.message, locales.en.appName.message);
});

test('i18n: los dos idiomas tienen las mismas claves y ninguna queda vacía', () => {
  const es = Object.keys(I18n.MESSAGES.es).sort();
  const en = Object.keys(I18n.MESSAGES.en).sort();
  assert.deepEqual(en, es, 'Los idiomas tienen claves distintas');

  for (const language of I18n.LANGUAGES) {
    for (const [key, value] of Object.entries(I18n.MESSAGES[language])) {
      assert.equal(typeof value, 'string', `${language}.${key} no es texto`);
      assert.ok(value.trim().length > 0, `${language}.${key} está vacío`);
    }
  }
});

test('i18n: t() cambia de idioma, interpola variables y no inventa claves', () => {
  I18n.setLanguage('es');
  assert.equal(I18n.getLanguage(), 'es');
  assert.equal(I18n.t('saveMoment'), 'Guardar momento');
  assert.equal(I18n.t('countMany', { count: 3 }), '3 momentos');
  assert.equal(I18n.t('countOne', { count: 1 }), '1 momento');

  I18n.setLanguage('en');
  assert.equal(I18n.getLanguage(), 'en');
  assert.equal(I18n.t('saveMoment'), 'Save moment');
  assert.equal(I18n.t('countOne', { count: 1 }), '1 moment');
  assert.equal(
    I18n.t('savedAt', { date: '06/11/2026', time: '14:32:07' }),
    'Saved on 06/11/2026 at 14:32:07'
  );
  assert.equal(I18n.t('markerLabel', { time: '00:42', text: 'hola' }), 'Go to 00:42: hola');

  // Una clave inexistente se devuelve tal cual: nunca una cadena vacía en la interfaz.
  assert.equal(I18n.t('claveInexistente'), 'claveInexistente');

  // 'auto' sigue al navegador y siempre resuelve a un idioma soportado.
  I18n.setLanguage('auto');
  assert.ok(I18n.LANGUAGES.includes(I18n.getLanguage()));
  I18n.setLanguage('es');
});

test('i18n: cada color de la paleta tiene etiqueta en los dos idiomas', () => {
  assert.equal(Object.keys(I18n.COLOR_KEYS).length, Common.COLORS.length);

  for (const color of Common.COLORS) {
    assert.ok(I18n.COLOR_KEYS[color.value], `Falta la clave de traducción del color ${color.value}`);
    for (const language of I18n.LANGUAGES) {
      I18n.setLanguage(language);
      const label = I18n.colorLabel(color.value);
      assert.ok(label && label.trim().length > 0, `${language}: color sin etiqueta ${color.value}`);
      assert.equal(label, I18n.t(I18n.COLOR_KEYS[color.value]));
    }
  }
  // Un valor desconocido no rompe: devuelve el propio valor.
  I18n.setLanguage('es');
  assert.equal(I18n.colorLabel('#123456'), '#123456');
});

test('common.js: formatCommentDate mantiene dd/mm/aaaa y hh:mm:ss en los dos idiomas', () => {
  const afternoon = new Date(2026, 10, 6, 14, 32, 7).toISOString();
  assert.deepEqual(Common.formatCommentDate(afternoon, 'es'), { date: '06/11/2026', time: '14:32:07' });
  assert.deepEqual(Common.formatCommentDate(afternoon, 'en'), { date: '06/11/2026', time: '14:32:07' });

  // h23: la medianoche no se muestra como 24:00 en ninguno de los dos idiomas.
  const midnight = new Date(2026, 10, 6, 0, 5, 0).toISOString();
  assert.equal(Common.formatCommentDate(midnight, 'es').time, '00:05:00');
  assert.equal(Common.formatCommentDate(midnight, 'en').time, '00:05:00');

  // Sin idioma explícito cae a español, que es el idioma por defecto.
  assert.deepEqual(Common.formatCommentDate(afternoon), { date: '06/11/2026', time: '14:32:07' });
});

test('i18n: no quedan textos de interfaz en español fuera del diccionario', () => {
  const phrases = [
    'Guardar momento', 'Colapsar o expandir panel', 'Tus videos recientes', 'Exportar JSON',
    'Importar JSON', 'Exportar Markdown', 'Sincronizar con Chrome Sync', 'Momentos guardados',
    'Videos con notas', 'Abrí cualquier video', 'Eliminar momento', 'Saltar a este momento',
    'Marcadores de comentarios', 'Resumen de actividad', 'Respaldo de datos', 'Color del marcador',
    'Escribí una nota', 'No se detectó un video activo', 'instante actual',
  ];
  const sources = [
    path.join(SRC_DIR, 'content', 'content.js'),
    path.join(SRC_DIR, 'popup', 'popup.js'),
    path.join(SRC_DIR, 'storage', 'store.js'),
    path.join(SRC_DIR, 'utils', 'common.js'),
  ];
  for (const file of sources) {
    const source = fs.readFileSync(file, 'utf8');
    for (const phrase of phrases) {
      assert.equal(source.includes(phrase), false, `Texto sin traducir en ${path.basename(file)}: ${phrase}`);
    }
  }

  // En el HTML cada texto visible y cada aria-label tiene que estar marcado con data-i18n.
  const html = fs.readFileSync(path.join(SRC_DIR, 'popup', 'popup.html'), 'utf8');
  const usedKeys = [...html.matchAll(/data-i18n(?:-title|-aria-label|-placeholder)?="([^"]+)"/g)].map((m) => m[1]);
  assert.ok(usedKeys.length >= 15, 'El popup tiene que declarar sus textos con data-i18n');
  for (const key of usedKeys) {
    assert.ok(Object.prototype.hasOwnProperty.call(I18n.MESSAGES.es, key), `data-i18n desconocido: ${key}`);
    assert.ok(Object.prototype.hasOwnProperty.call(I18n.MESSAGES.en, key), `data-i18n sin inglés: ${key}`);
  }
  // El selector de idioma tiene las tres opciones y arranca en automático.
  for (const value of ['auto', 'es', 'en']) {
    assert.match(html, new RegExp(`<option value="${value}"`));
  }
  assert.match(html, /id="language-select"/);
});

test('content.js: el panel repinta sus textos cuando cambia el idioma', () => {
  const source = fs.readFileSync(path.join(SRC_DIR, 'content', 'content.js'), 'utf8');

  assert.match(source, /I18n\.setLanguage\(languagePreference\)/);
  assert.match(source, /I18n\.t\('saveMoment'\)/);
  assert.match(source, /I18n\.t\('captureCaption'\)/);
  assert.match(source, /I18n\.colorLabel\(color\.value\)/);
  // El idioma se lee del almacenamiento y se reaplica cuando el popup lo cambia.
  assert.match(source, /Store\.getSettings\(\)/);
  assert.match(source, /chrome\.storage\.onChanged/);
  assert.match(source, /changes\[Common\.SETTINGS_KEY\]/);
});

test('store.js: getSettings guarda la preferencia de idioma y descarta valores inválidos', async () => {
  storageMock.reset();

  assert.equal((await Store.getSettings()).language, 'auto');
  await Store.saveSettings({ language: 'en' });
  assert.equal((await Store.getSettings()).language, 'en');
  await Store.saveSettings({ language: 'klingon' });
  assert.equal((await Store.getSettings()).language, 'auto');
  // La preferencia de idioma no pisa la de sincronización.
  assert.equal((await Store.getSettings()).syncEnabled, true);
});

test('common.js: filterComments filtra por texto sin acentos ni mayúsculas y por color', () => {
  const list = [
    { id: '1', text: 'Avanzar la práctica', color: '#f07159' },
    { id: '2', text: 'práctica final', color: '#80c783' },
    { id: '3', text: 'Otra cosa', color: '#80c783' },
  ];

  assert.equal(Common.filterComments(list, {}).length, 3);
  assert.equal(Common.filterComments(list, { query: 'PRACTICA' }).length, 2);
  assert.equal(Common.filterComments(list, { query: '  practica  ' }).length, 2);
  assert.equal(Common.filterComments(list, { color: '#80C783' }).length, 2);
  assert.equal(Common.filterComments(list, { query: 'practica', color: '#f07159' }).length, 1);
  // Un filtro de sólo espacios no filtra nada.
  assert.equal(Common.filterComments(list, { query: '   ' }).length, 3);
  // Entradas inválidas devuelven lista vacía, nunca una excepción.
  assert.equal(Common.filterComments(null, {}).length, 0);
  assert.equal(Common.filterComments(undefined, { query: 'x' }).length, 0);
  // No muta la lista original ni devuelve la misma referencia.
  const copia = Common.filterComments(list, {});
  assert.notEqual(copia, list);
  assert.equal(list.length, 3);
  assert.equal(Common.normalizeSearchText('Práctica'), 'practica');
});

test('store.js: searchComments busca por texto y color en todos los videos', async () => {
  storageMock.reset();
  const videoA = 'dQw4w9WgXcQ';
  const videoB = '3JZ_D3ELwOQ';
  const coral = Common.COLORS[0].value;
  const verde = Common.COLORS[3].value;

  await Store.saveComments(videoA, [
    Common.createComment({ videoId: videoA, videoTitle: 'Video Alfa', timestamp: 90, text: 'Exportar notas', color: verde }),
    Common.createComment({ videoId: videoA, videoTitle: 'Video Alfa', timestamp: 30, text: 'Cierre de cuenta', color: coral }),
  ], { title: 'Video Alfa' });

  await Store.saveComments(videoB, [
    Common.createComment({ videoId: videoB, videoTitle: 'Video Beta', timestamp: 10, text: 'Cuenta de prueba', color: verde }),
  ], { title: 'Video Beta' });

  // Texto: dos coincidencias, ordenadas por título de video y después por instante.
  const porTexto = await Store.searchComments({ query: 'CUENTA' });
  assert.equal(porTexto.length, 2);
  assert.deepEqual(porTexto.map((m) => m.videoId), [videoA, videoB]);
  assert.equal(porTexto[0].videoTitle, 'Video Alfa');
  assert.equal(porTexto[0].timestamp, 30);

  // Color.
  const porColor = await Store.searchComments({ color: verde });
  assert.equal(porColor.length, 2);

  // Texto y color a la vez.
  const ambos = await Store.searchComments({ query: 'cuenta', color: coral });
  assert.equal(ambos.length, 1);
  assert.equal(ambos[0].text, 'Cierre de cuenta');

  // Sin filtro devuelve todo; sin coincidencias, lista vacía.
  assert.equal((await Store.searchComments({})).length, 3);
  assert.equal((await Store.searchComments({ query: 'inexistente' })).length, 0);
});

test('content.js: buscador y filtro por color del listado', () => {
  const source = fs.readFileSync(path.join(SRC_DIR, 'content', 'content.js'), 'utf8');
  const css = fs.readFileSync(path.join(SRC_DIR, 'content', 'content.css'), 'utf8');

  assert.match(source, /let filterQuery = ''/);
  assert.match(source, /let filterColor = ''/);
  assert.match(source, /Common\.filterComments\(comments, \{ query: filterQuery, color: filterColor \}\)/);
  assert.match(source, /function renderFilterColors\(/);
  assert.match(source, /className = 'ytt-search'/);
  assert.match(source, /I18n\.t\('noMatches'\)/);
  assert.match(source, /I18n\.t\('shownOfTotal'/);
  assert.match(css, /\.ytt-filter-dot\s*\{/);
  assert.match(css, /\.ytt-search\s*\{/);
});

test('content.js: la navegación SPA no deja datos del video anterior', () => {
  const source = fs.readFileSync(path.join(SRC_DIR, 'content', 'content.js'), 'utf8');

  assert.match(source, /function resetVideoState\(/);
  assert.match(source, /document\.addEventListener\('yt-navigate-start'/);

  // Al cambiar de video, el estado viejo se limpia antes de pedir las notas nuevas.
  const bloque = source.slice(source.indexOf('if (currentVideoId !== videoId)'));
  const limpia = bloque.indexOf('resetVideoState()');
  const pide = bloque.indexOf('Store.getComments');
  assert.ok(limpia !== -1 && pide !== -1, 'Falta el reset o la carga de notas');
  assert.ok(limpia < pide, 'El listado viejo tiene que limpiarse antes de cargar el nuevo video');

  // resetVideoState vacía el listado y el campo de nota.
  const cuerpo = source.slice(source.indexOf('function resetVideoState()'), source.indexOf('function updateClock()'));
  assert.match(cuerpo, /comments = \[\]/);
  assert.match(cuerpo, /ui\.textarea\.value = ''/);
  assert.match(cuerpo, /renderComments\(\)/);
});

test('popup: buscador de notas en todos los videos', () => {
  const html = fs.readFileSync(path.join(SRC_DIR, 'popup', 'popup.html'), 'utf8');
  const js = fs.readFileSync(path.join(SRC_DIR, 'popup', 'popup.js'), 'utf8');

  assert.match(html, /id="search-input"/);
  assert.match(html, /id="search-colors"/);
  assert.match(js, /Store\.searchComments\(filters\)/);
  assert.match(js, /filters\.color/);
  assert.match(js, /note-row/);
  // Cada resultado tiene que abrir el video en el instante de la nota.
  assert.match(js, /watch\?v=\$\{encodeURIComponent\(match\.videoId\)\}&t=\$\{seconds\}s/);
});

test('popup: los errores de refresco no se tragan y safeRefresh no se llama a sí misma', () => {
  const js = fs.readFileSync(path.join(SRC_DIR, 'popup', 'popup.js'), 'utf8');

  // Nada de .catch(() => {}): si la lista no se puede actualizar tiene que quedar rastro.
  assert.equal(/\.catch\(\(\) => \{\}\)/.test(js), false, 'Hay promesas con errores silenciados');

  const inicio = js.indexOf('function safeRefresh()');
  const cuerpo = js.slice(js.indexOf('{', inicio), js.indexOf('async function refreshList()'));
  assert.match(cuerpo, /refreshList\(\)\.catch/, 'safeRefresh tiene que llamar a refreshList');
  assert.equal(/safeRefresh\s*\(/.test(cuerpo), false, 'safeRefresh no puede llamarse a sí misma');
});

test('store.js: las notas que no entran en Chrome Sync se guardan sólo en local', async () => {
  storageMock.reset();
  const videoId = 'dQw4w9WgXcQ';

  const chica = await Store.saveComments(videoId, [
    Common.createComment({ videoId, timestamp: 10, text: 'Nota corta', color: Common.COLORS[0].value }),
  ], { title: 'Video de prueba' });
  assert.equal(chica.synced, true);
  assert.equal(chica.reason, null);
  assert.ok(chica.bytes > 0);

  // Veinte notas de 500 caracteres superan el límite por ítem: quedan en local y se informa el motivo.
  const largas = Array.from({ length: 20 }, (_, i) => Common.createComment({
    videoId,
    timestamp: i * 5,
    text: 'x'.repeat(Common.MAX_COMMENT_LENGTH),
    color: Common.COLORS[i % Common.COLORS.length].value,
  }));
  const grande = await Store.saveComments(videoId, largas, { title: 'Video de prueba' });
  assert.equal(grande.saved, true, 'Siempre se guarda en local');
  assert.equal(grande.synced, false);
  assert.equal(grande.reason, 'item');
  assert.ok(grande.bytes > 7500, `Esperaba más de 7500 bytes, fueron ${grande.bytes}`);

  // Nada se perdió: las 20 notas se leen igual.
  assert.equal((await Store.getComments(videoId)).length, 20);

  const report = await Store.getSyncReport();
  assert.equal(report.enabled, true);
  assert.equal(report.pending.length, 1);
  assert.equal(report.pending[0].videoId, videoId);
  assert.equal(report.totalBytes, 0);
  assert.equal(report.itemLimit, 7500);
  assert.equal(report.hardItemLimit, 8192);
  assert.equal(report.hardTotalLimit, 102400);
});

test('store.js: con la sincronización apagada no se escribe nada en sync', async () => {
  storageMock.reset();
  const videoId = '3JZ_D3ELwOQ';
  await Store.saveSettings({ syncEnabled: false });

  const result = await Store.saveComments(videoId, [
    Common.createComment({ videoId, timestamp: 5, text: 'Sólo local', color: Common.COLORS[1].value }),
  ], { title: 'Otro video' });

  assert.equal(result.saved, true);
  assert.equal(result.synced, false);
  assert.equal(result.reason, 'disabled');

  const report = await Store.getSyncReport();
  assert.equal(report.enabled, false);
  assert.equal(report.pending.length, 1);
  assert.equal(report.totalBytes, 0);

  // Al reactivarla y volver a guardar ese video, se sincroniza y deja de estar pendiente.
  await Store.saveSettings({ syncEnabled: true });
  await Store.saveComments(videoId, [
    Common.createComment({ videoId, timestamp: 5, text: 'Sólo local', color: Common.COLORS[1].value }),
  ], { title: 'Otro video' });
  assert.equal((await Store.getSyncReport()).pending.length, 0);
});

test('content.js: pantalla completa oculta el panel y lo devuelve al salir', () => {
  const source = fs.readFileSync(path.join(SRC_DIR, 'content', 'content.js'), 'utf8');
  const css = fs.readFileSync(path.join(SRC_DIR, 'content', 'content.css'), 'utf8');

  assert.match(source, /function syncFullscreenVisibility\(/);
  assert.match(source, /document\.fullscreenElement/);
  assert.match(source, /addEventListener\('fullscreenchange'/);
  assert.match(source, /syncFullscreenVisibility\(\);\s*\n\s*\/\/ Cambiar de modo/);

  assert.match(source, /layout: 'below'/);
  assert.match(css, /:host\(\[data-layout='below'\]\)\s*\{/);
  assert.match(css, /:host\(\[data-layout='below'\]\)\s*\.ytt-panel\s*\{/);
});

test('popup: avisa cuando hay notas que no entran en Chrome Sync', () => {
  const html = fs.readFileSync(path.join(SRC_DIR, 'popup', 'popup.html'), 'utf8');
  const js = fs.readFileSync(path.join(SRC_DIR, 'popup', 'popup.js'), 'utf8');
  const css = fs.readFileSync(path.join(SRC_DIR, 'popup', 'popup.css'), 'utf8');

  assert.match(html, /id="sync-note"/);
  assert.match(js, /Store\.getSyncReport\(\)/);
  assert.match(js, /function renderSyncNote\(/);
  assert.match(js, /syncPendingMany', \{ count: report\.pending\.length \}\)/);
  assert.match(js, /syncDisabledNote/);
  assert.match(css, /\.sync-note\s*\{/);
});

test('popup: pie de apoyo con Ko-fi, bilingüe y sin datos de cobro', () => {
  const html = fs.readFileSync(path.join(SRC_DIR, 'popup', 'popup.html'), 'utf8');

  assert.match(html, /<footer class="support"/);
  assert.match(html, /href="https:\/\/ko-fi\.com\/martinmartinezgarcia"/);
  // Un enlace externo siempre con target y rel.
  assert.match(html, /target="_blank" rel="noopener noreferrer"/);
  assert.match(html, /data-i18n-aria-label="supportTitle"/);
  assert.match(html, /data-i18n="supportKofiSub"/);
});

test('seguridad: la extensión no lleva datos de cobro ni de contacto', () => {
  const prohibidos = [
    'Prex', 'Mercado Pago', 'PayPal', 'Starlink',
    '+598', 'hotmail', 'gmail', '35502', '1006269736963', 'wa.me',
  ];
  const archivos = fs.readdirSync(SRC_DIR, { recursive: true })
    .filter((rel) => typeof rel === 'string' && /\.(js|html|css|json)$/.test(rel))
    .map((rel) => path.join(SRC_DIR, rel));

  for (const file of archivos) {
    const contenido = fs.readFileSync(file, 'utf8');
    for (const dato of prohibidos) {
      assert.equal(
        contenido.toLowerCase().includes(dato.toLowerCase()),
        false,
        `${path.basename(file)} contiene un dato que no debe viajar en la extensión: ${dato}`
      );
    }
  }
});

test('content.css y styles.js están sincronizados', () => {
  const cssPath = path.join(SRC_DIR, 'content', 'content.css');
  const stylesPath = path.join(SRC_DIR, 'content', 'styles.js');

  const css = fs.readFileSync(cssPath, 'utf8');
  delete globalThis.YTTemporalStyles;
  require(stylesPath);
  const enJs = globalThis.YTTemporalStyles;

  assert.equal(typeof enJs, 'string', 'styles.js tiene que exportar el CSS como texto');
  assert.equal(
    enJs,
    css,
    'styles.js está desactualizado: corré "node tools/build-css.mjs"'
  );
  assert.ok(enJs.includes(':host([data-layout=\'theater\'])'), 'El CSS generado tiene que ser el completo');
});

test('content.js: el CSS se inyecta como texto y no se pide ningún archivo de la extensión', () => {
  const source = fs.readFileSync(path.join(SRC_DIR, 'content', 'content.js'), 'utf8');

  // Esta carga es la que Chrome rechaza en Shorts y en algunas vistas del reproductor.
  assert.equal(/chrome\.runtime\.getURL/.test(source), false, 'No debe pedir URLs chrome-extension://');
  assert.equal(/createElement\('link'\)/.test(source), false, 'No debe crear <link> de estilos');

  assert.match(source, /globalThis\.YTTemporalStyles/);
  assert.match(source, /createElement\('style'\)/);

  // styles.js tiene que cargarse antes del content script.
  const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));
  const scripts = manifest.content_scripts[0].js;
  assert.ok(scripts.includes('src/content/styles.js'), 'Falta styles.js en content_scripts');
  assert.ok(
    scripts.indexOf('src/content/styles.js') < scripts.indexOf('src/content/content.js'),
    'styles.js tiene que ir antes que content.js'
  );
});

test('content.js: el panel sólo se monta en la página de reproducción', () => {
  const source = fs.readFileSync(path.join(SRC_DIR, 'content', 'content.js'), 'utf8');
  assert.match(source, /location\.pathname === '\/watch'/);
  assert.match(source, /esPaginaDeReproduccion/);
  // Sin esa guarda el panel se monta en Shorts dentro de un #below de 0x0, invisible.
  assert.match(source, /if \(!videoId \|\| !esPaginaDeReproduccion\)/);
});

test('accesibilidad WCAG 2.2 AA: foco visible, aria-expanded, teclado en editor y marcadores', () => {
  const contentJs = fs.readFileSync(path.join(SRC_DIR, 'content', 'content.js'), 'utf8');
  const contentCss = fs.readFileSync(path.join(SRC_DIR, 'content', 'content.css'), 'utf8');
  const popupCss = fs.readFileSync(path.join(SRC_DIR, 'popup', 'popup.css'), 'utf8');

  // El botón de colapsar informa su estado expandido/colapsado.
  assert.match(contentJs, /setAttribute\('aria-expanded', String\(!isCollapsed\)\)/);
  // Navegación por teclado con flechas en los marcadores de la línea de tiempo y en los colores.
  const arrowMatches = contentJs.match(/\['ArrowRight', 'ArrowLeft'\]/g) || [];
  assert.equal(arrowMatches.length, 3, 'El selector principal, el editor en línea y los marcadores deben soportar flechas');

  // Estilos :focus-visible en el panel y en el popup.
  assert.match(contentCss, /\.ytt-toggle-btn:focus-visible/);
  assert.match(contentCss, /\.ytt-save-btn:focus-visible/);
  assert.match(contentCss, /\.ytt-filter-dot:focus-visible/);
  assert.match(popupCss, /\.action-btn:focus-visible/);
  assert.match(popupCss, /\.video-row:focus-visible/);
});

test('seguridad defensiva: importFromJson rechaza claves de prototipo (constructor, __proto__) y sanea entradas', async () => {
  storageMock.reset();
  assert.equal(Common.isValidVideoId('constructor'), false);
  assert.equal(Common.isValidVideoId('__proto__'), false);
  assert.equal(Common.isValidVideoId('dQw4w9WgXcQ'), true);

  const payload = JSON.stringify({
    app: 'yt-temporal-comments',
    version: 1,
    videos: {
      constructor: [
        { id: 'mal-1', timestamp: 10, text: 'Intento sobre constructor', color: '#f07159' },
      ],
      dQw4w9WgXcQ: [
        { id: 'ok-1', timestamp: 12, text: '  <img src=x onerror=alert(1)>  ', color: '#no-existe' },
        { id: 'bad-ts', timestamp: -5, text: 'Negativo', color: '#f07159' },
      ],
    },
  });

  const res = await Store.importFromJson(payload);
  assert.equal(res.importedVideos, 1);
  assert.equal(res.importedComments, 1);

  const saved = await Store.getComments('dQw4w9WgXcQ');
  assert.equal(saved.length, 1);
  assert.equal(saved[0].text, '<img src=x onerror=alert(1)>');
  assert.equal(saved[0].color, Common.COLORS[0].value);
  assert.equal((await Store.getComments('constructor')).length, 0);
});
