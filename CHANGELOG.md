# Historial de Cambios (Changelog)

Todos los cambios relevantes de este proyecto se documentan en este archivo.
El formato se basa en [Keep a Changelog](https://keepachangelog.com/es-ES/1.0.0/) y el proyecto adhiere a [Semantic Versioning](https://semver.org/lang/es/).

---

## [Sin publicar]

### Añadido
- **Bilingüe español/inglés con selector**: el popup suma un desplegable *Automático / Español /
  English* que se guarda en `chrome.storage` y cambia el panel, el popup y las fechas sin recargar
  la extensión (`chrome.storage.onChanged` repinta el panel). El diccionario vive en
  `extension/src/utils/i18n.js`; `extension/_locales/es|en/messages.json` y
  `"default_locale": "es"` resuelven sólo el nombre y la descripción del manifiesto por
  `__MSG_appName__` / `__MSG_appDesc__`. Los nombres de los 10 colores salen del diccionario.
- **Fechas con `Intl.DateTimeFormat`**: `formatCommentDate(iso, idioma)` mantiene el formato ya
  probado `dd/mm/aaaa` + `hh:mm:ss` en los dos idiomas y usa `hourCycle: 'h23'` para que la
  medianoche no se muestre como `24:00`.
- **Edición de notas existentes**: cada nota del listado tiene un botón de lápiz que la abre en un
  formulario en línea con su texto y la paleta de 10 colores. Al guardar se conservan el `id`, el
  instante y la `createdAt`, así que la nota no cambia de lugar en la línea de tiempo ni de fecha.
  `Esc` cancela y `Ctrl+Enter` guarda. La lógica vive en `editComment()` de
  `extension/src/utils/common.js`, que reutiliza `sanitizeComment()` para validar y truncar.
- **Anclaje del panel en modo cine**: cuando YouTube activa el modo cine (`ytd-watch-flexy[theater]`)
  el panel se reubica bajo el reproductor, antes del bloque de comentarios, y vuelve a la columna
  lateral al salir. Se detecta el cambio de modo por el atributo `[theater]`, por el evento
  `yt-page-data-updated` y por una revisión periódica, sin depender de que cambie la URL.
- Exportación a **Markdown** de todas las notas, con enlaces directos al instante
  (`https://youtu.be/<id>?t=<s>s`) para pegar en Notion u Obsidian: `commentsToMarkdown()` en
  `extension/src/utils/common.js`, `exportAllToMarkdown()` en `extension/src/storage/store.js` y un
  botón nuevo en el popup que ocupa las dos columnas del bloque de respaldos.
- Atajo **`Alt+N`** en el panel: salta al instante actual y enfoca el campo de nota sin salir del
  reproductor; se ignora mientras el foco está en un campo de texto.
- El reloj del panel se actualiza con los eventos del reproductor (`timeupdate`, `loadedmetadata`,
  `durationchange`, `seeked`, `play`, `pause`) en lugar de consultar `currentTime` cada medio
  segundo, y se reengancha cuando YouTube recrea el `<video>`.
- Pruebas nuevas: índice por video (título, cantidad, `updatedAt`), `commentsToMarkdown()`,
  `exportAllToMarkdown()`, contrato de render del reloj, registro del atajo, reubicación del panel
  en modo cine y edición de notas, más las de idioma (mismas claves en ambos idiomas, fechas en
  los dos, colores y ausencia de literales sueltos). Total: 25 de 25.
- `PUBLISHING.md`: proceso de publicación en la Chrome Web Store verificado contra la documentación
  oficial el 7/11/2026 (registro de desarrollador, tarifa única, 2SV, países admitidos, empaquetado,
  campos del dashboard, revisión, publicación diferida de 30 días y checklist final).
- `STORE_LISTING.md`: ficha lista para pegar (descripción corta y detallada en español, versión en
  inglés, categoría, propósito único, justificaciones de permisos, declaración de uso de datos y
  plan de capturas).
- `CHROME_STORE_CHECKLIST.md`: reescrito como verificación de cumplimiento, con las medidas
  correctas de los activos (capturas 1280×800 o 640×400, promocional 440×280, marquee 1400×560) y
  referencias a los dos documentos nuevos.

### Cambiado
- `README.md`: sección de apoyo reducida a una donación voluntaria por Ko-fi, con la aclaración de
  que no desbloquea funciones; se retiraron el enlace de PayPal y el de afiliado de Starlink. Se
  agregó el estado del proyecto y los enlaces a la documentación de publicación.
- `ROADMAP.md`: reorganizado con el orden de ejecución Fase 1 → Fase 4 → Fases 2 y 3 → Fase 5. La
  Fase 4 queda como alcance cerrado de la v1.0.0: bilingüe español/inglés, apoyo por donación
  voluntaria, calidad y publicación, cada bloque con su criterio de cierre.
- `ROADMAP.md`: el pack premium de temas (pago único de 2,99 USD) queda documentado como decisión
  descartada, con los motivos (declaración de compras integradas, pasarela, licencias, reembolsos,
  facturación e IVA), y los temas se mueven a la Fase 5 como mejora gratuita opcional.
- `ROADMAP.md`: Fases 2 y 3 marcadas como mejoras posteriores al lanzamiento y Fase 5 reducida a
  crecimiento (temas gratuitos, port a Edge y Firefox, página del producto).
- `PUBLISHING.md`: la lista de pendientes y el checklist quedan con el bilingüe como único trabajo de
  código previo, sin compras integradas, y la tabla de políticas deja anotado qué habría que hacer si
  alguna vez se agregara una compra.
- `STORE_LISTING.md`: descripciones ES y EN con el selector de idioma, compras integradas = No y la
  donación fuera de la tienda; la justificación de `storage` suma las preferencias de idioma.

---

## [0.4.1] - 2026-11-06

### Cambiado
- Icono de la extensión (16, 32, 48 y 128 px) rediseñado con la marca del panel: cuadrado de
  esquinas redondeadas con el degradé cian → violeta → rosa y el triángulo de play en tinta
  oscura. Se agregaron `extension/icons/icon.svg` y `extension/icons/icon-small.svg` como
  fuentes editables, y se retiró el coral y el punto verde del icono anterior.

---

## [0.4.0] - 2026-11-06

### Cambiado
- Nueva identidad visual "cyberpunk" en el panel y el popup: degradé neón cian → violeta →
  rosa (`--grad`) sobre el lema, el botón de guardar, el avance de la línea de tiempo y las
  cifras del popup. El coral anterior se retiró como color de interfaz para no confundirse
  con los 10 colores pastel de los marcadores, que no cambiaron.
- Fondo del panel con trama de líneas fina y halo violeta tenue; el playhead pasa a tener
  brillo cian.

### Corregido
- El popup mostraba una versión escrita a mano (`v0.2.0`); ahora la toma de
  `chrome.runtime.getManifest()` y no queda desactualizada al subir la extensión.

---

## [0.3.0] - 2026-11-06

### Añadido
- Cada nota del panel muestra a su derecha la fecha y hora local completa en la que fue
  guardada (`dd/mm/aaaa` y `hh:mm:ss`), tomada del campo `createdAt` ya persistido.

---

## [0.2.0] - 2026-10-27

### Añadido
- Estructura completa de la extensión de Google Chrome bajo **Manifest V3** en `extension/`.
- Content Script (`extension/src/content/`) con aislamiento mediante **Shadow DOM** para inyectar la línea de tiempo y el panel de notas directamente en `youtube.com/watch`.
- Capa de almacenamiento unificada (`extension/src/storage/store.js`) con soporte para `chrome.storage.local`, sincronización en `chrome.storage.sync` y exportación/importación en archivo `.json`.
- Popup de gestión (`extension/src/popup/`) para ver estadísticas, alternar sincronización y exportar/importar copias de seguridad.
- Iconos oficiales de la extensión en `16x16`, `32x32`, `48x48` y `128x128` px.
- Documentación del proyecto: `ROADMAP.md`, `ARCHITECTURE.md`, `PRIVACY_POLICY.md`, `CHROME_STORE_CHECKLIST.md`, `CONTRIBUTING.md` y `CHANGELOG.md`.

### Cambiado
- Reorganización del prototipo original en Flask dentro del directorio `web-prototype/` conservando intacto su funcionamiento.
- Actualización de `README.md` y `.gitignore` para cubrir tanto la extensión de Chrome como el prototipo web.

---

## [0.1.0] - 2026-09-29

### Añadido
- Prototipo inicial en Python/Flask con YouTube IFrame Player API (`app.py`, `templates/index.html`, `static/app.js`, `static/styles.css`).
- Creación de notas temporales con selector accesible de 10 colores y línea de tiempo proporcional con salto temporal.
- Persistencia local por ID de video mediante `localStorage`.
