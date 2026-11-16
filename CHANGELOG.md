# Historial de Cambios (Changelog)

Todos los cambios relevantes de este proyecto se documentan en este archivo.
El formato se basa en [Keep a Changelog](https://keepachangelog.com/es-ES/1.0.0/) y el proyecto adhiere a [Semantic Versioning](https://semver.org/lang/es/).

---

## [1.0.0] - 2026-11-14

### Añadido
- **Accesibilidad WCAG 2.2 AA y seguridad defensiva**: estilos `:focus-visible` en todos los
  controles interactivos del panel y del popup, atributo `aria-expanded` en el botón de colapsar el
  panel, navegación con flechas (`←` / `→`) en los marcadores de la línea de tiempo y en la paleta
  de colores del editor en línea, ajuste de contraste en textos secundarios (≥ 4,5:1), traducción en
  vivo de la etiqueta `"instante actual"` / `"current moment"` (`captureCaption`) y validación
  defensiva `isValidVideoId()` contra claves de prototipo (`constructor`, `__proto__`) al importar
  respaldos JSON. Total de pruebas automatizadas: 42 de 42 en verde.
- **Activos gráficos listos para la Chrome Web Store (`store-assets/`)**: icono de tienda `128×128`
  con arte centrado en `96×96` (`store-icon-128.png`), imagen promocional pequeña `440×280` RGB sin
  transparencia (`promo-small.png`) y las 5 capturas `1280×800` RGB de la extensión en
  funcionamiento (`store-assets/screenshots/`).
- **Pie de apoyo en el popup**: una tarjeta minimalista y bilingüe con Ko-fi ("Invitame un
  cafecito · voluntario") al pie del popup, pegada al borde inferior con `position: sticky` porque
  con varios videos el contenido supera los 600 px que permite Chrome. Sólo Ko-fi: no viajan datos
  de cobro (Prex, Mercado Pago, teléfono ni correo) dentro del paquete, y una prueba falla si
  aparecen.
- **Control de cuota de Chrome Sync**: `saveComments()` decide si el video entra en
  `chrome.storage.sync` por ítem (8 KB) y por total (100 KB) y devuelve `{ saved, synced, reason }`;
  si no entra, borra la copia vieja de sync para no mostrar en otro equipo notas desactualizadas y
  lo deja sólo en local. `getSyncReport()` informa qué videos están pendientes y cuánto ocupa el
  conjunto, y el popup lo avisa: "1 video está sólo en este equipo / superan el límite de Chrome
  Sync". El fallback a `localStorage` (sólo cuando no hay `chrome.storage`) ahora separa las áreas
  `local` y `sync` en sus claves, porque antes escribir en sync pisaba la copia local.
- **Pantalla completa**: al entrar en pantalla completa el panel se oculta y vuelve al salir
  (`fullscreenchange`), en vez de quedar tapando el video. Se reevalúa al montar, porque el panel
  puede montarse ya en pantalla completa.
- **Columna única**: cuando no hay columna lateral (ventana angosta o comentarios colapsados) el
  host queda con `data-layout="below"` y estilos propios de ancho y márgenes.
- **Buscador y filtro por color**: el panel suma una caja de búsqueda sobre el listado y una fila
  con "Todos" más los 10 colores; el popup busca en las notas de **todos** los videos
  (`searchComments()` en `store.js`) y cada resultado abre YouTube en el segundo de la nota. El
  filtro comparte `filterComments()` en `common.js` y no distingue mayúsculas ni acentos
  ("practica" encuentra "Práctica"). Con filtro activo el panel muestra "N de M" y un estado vacío
  propio.
- **Navegación SPA robusta**: al cambiar de video el listado anterior se limpia en el acto
  (`resetVideoState()`), antes de pedir las notas nuevas, y se escucha `yt-navigate-start` comparando
  la URL para no vaciar el panel cuando la navegación termina en el mismo video.
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
  los dos, colores y ausencia de literales sueltos), el filtro compartido, la búsqueda en todos los
  videos, el contrato de la navegación SPA, la cuota de sync (por ítem y apagada) y la pantalla
  completa, el pie de apoyo, la ausencia de datos de cobro en el paquete, la sincronización entre
  `content.css` y `styles.js`, el montaje sólo en `/watch`, la accesibilidad WCAG 2.2 AA y la
  validación defensiva al importar JSON. Total: 42 de 42.
- `PUBLISHING.md`: proceso de publicación en la Chrome Web Store verificado contra la documentación
  oficial el 7/11/2026 (registro de desarrollador, tarifa única, 2SV, países admitidos, empaquetado,
  campos del dashboard, revisión, publicación diferida de 30 días y checklist final).
- `STORE_LISTING.md`: ficha lista para pegar (descripción corta y detallada en español, versión en
  inglés, categoría, propósito único, justificaciones de permisos, declaración de uso de datos y
  plan de capturas).
- `CHROME_STORE_CHECKLIST.md`: reescrito como verificación de cumplimiento, con las medidas
  correctas de los activos (capturas 1280×800 o 640×400, promocional 440×280, marquee 1400×560) y
  referencias a los dos documentos nuevos.

### Corregido
- **Error "Unsafe attempt to load URL ... Domains, protocols and ports must match"**: el panel pedía
  `chrome-extension://…/content.css` con un `<link>`, y Chrome rechaza esa carga en Shorts y en
  algunas vistas del reproductor. Ahora el CSS viaja como texto en `src/content/styles.js`
  (generado desde `content.css` con `node tools/build-css.mjs`) y se inyecta con un `<style>` en el
  Shadow DOM: no hay pedido, así que el error no puede volver. El manifiesto ya no declara
  `web_accessible_resources`. Una prueba falla si `styles.js` queda desincronizado del CSS.
- **Panel invisible en Shorts**: el panel se montaba en un `#below` de 0×0 (sin reproductor con
  línea de tiempo). Ahora sólo se monta en `youtube.com/watch`.

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
