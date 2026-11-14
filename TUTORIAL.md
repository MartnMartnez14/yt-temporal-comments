# Tutorial de YT Temporal Comments

Guía básica para usar la extensión sin saber nada de programación. Está pensada para alguien que
instala la extensión por primera vez y quiere entender qué hace y cómo sacarle provecho.

> **Estado:** borrador inicial. La idea es ir ampliándolo con cada función nueva y con las dudas
> que aparezcan en las reseñas o en el soporte.

---

## 1. Qué es y qué no es

**Es** un cuaderno privado atado al minuto exacto de un video de YouTube. Marcás un instante, escribís
lo que te interesa y después volvés a ese segundo con un clic.

**No es** un sistema de comentarios. Nada de lo que escribas se publica en YouTube, no lo ve el
creador del video ni otra persona: las notas quedan en tu navegador.

Casos en los que se usa: apuntar el minuto de un tutorial que hay que repetir, guardar dónde se
menciona un dato para citarlo, marcar los errores de un video propio antes de volver a editarlo,
seguir una receta o una clase sin volver a mirar todo.

---

## 2. Instalarla

Cuando la extensión esté publicada, el camino es la ficha de la Chrome Web Store y el botón
**Usar en Chrome**.

Mientras tanto se instala desde el código, en modo desarrollador:

1. Descargá o cloná el repositorio.
2. Abrí Chrome y entrá a `chrome://extensions/`.
3. Encendé **Modo de desarrollador** (arriba a la derecha).
4. Tocá **Cargar descomprimida** y elegí la carpeta `extension/`.
5. Fijá el icono de la extensión en la barra, para tenerla a mano.

Si cambiás archivos del proyecto, la extensión no se actualiza sola: en `chrome://extensions/` hay
que tocar el botón de recargar de la tarjeta y después refrescar la pestaña de YouTube.

---

## 3. Tu primera nota, paso a paso

1. Abrí cualquier video en `youtube.com/watch`.
2. Vas a ver un panel **YT Temporal** a la derecha del video, en la columna lateral. Si la ventana
   está angosta, aparece abajo del reproductor.
3. Poné el video en el minuto que te interesa.
4. Escribí en el campo de texto: *"acá explican cómo cerrar la cuenta"*.
5. Elegí un color de la paleta si querés clasificarla.
6. Tocá **Guardar momento**.

La nota aparece en el listado con el minuto del video a la izquierda y, a la derecha, la fecha y
hora en que la guardaste. Arriba, un punto del color elegido se suma a la barra de tiempo.

---

## 4. Los colores

Hay 10 colores. Sirven para clasificar, pero la extensión no les asigna un significado: el criterio
lo ponés vos. Por ejemplo:

- **Verde** para lo que ya entendí y quiero recordar.
- **Amarillo** para dudas o cosas para revisar.
- **Rojo o coral** para errores o cosas que no me cierran.
- **Azul** para datos que voy a citar en otro lado.

Elegí pocos colores y sostenelos: con diez significados distintos no se entiende nada.

---

## 5. Volver a un momento

Hay tres formas, y las tres llevan al mismo lugar:

- Tocá el **minuto** de la nota en el listado.
- Tocá el **punto de color** sobre la barra de tiempo.
- Usá la línea de tiempo para ver de un vistazo en qué partes del video hay notas.

---

## 6. Atajo `Alt+N`

Con el video andando, `Alt+N` lleva el cursor directo al campo de nota del instante actual, sin sacar
el foco del reproductor. Es la forma más rápida de marcar algo mientras mirás.

El atajo no se dispara si estás escribiendo en un campo de texto, así que no molesta.

---

## 7. Corregir una nota

1. Tocá el **lápiz** de la nota.
2. La nota se abre ahí mismo, con su texto y la paleta de colores.
3. Corregí lo que quieras.
4. `Ctrl+Enter` guarda, o tocá **Guardar**. `Esc` cancela y deja todo como estaba.

Al editar **no se pierde el minuto ni la fecha original**: la nota sigue en el mismo lugar del video.

---

## 8. Borrar una nota

Tocá la **cruz** a la derecha de la nota. Se borra en el acto, sin vuelta atrás, así que conviene
tener un respaldo (ver el punto siguiente).

---

## 9. Llevarte las notas a otro lado

El icono de la extensión abre el panel de gestión, con los videos donde tenés notas y dos formas de
exportar:

- **Exportar Markdown**: genera un archivo de texto con las notas de todos los videos y un enlace
  directo al minuto de cada una (`https://youtu.be/<video>?t=<segundo>s`). Sirve para pegar en
  Notion, Obsidian o cualquier editor. Los enlaces abren YouTube en ese segundo exacto.
- **Exportar JSON**: es el respaldo completo, pensado para volver a importarlo en la extensión. No
  está pensado para leerlo a mano.

**Importar JSON** suma las notas de un respaldo a las que ya tenés, sin duplicar las que ya existen
(compara identificadores). Se puede importar el mismo archivo dos veces sin miedo.

---

## 10. Cambiar el idioma

En el panel de la extensión hay un desplegable de idioma: **Automático**, **Español** o **English**.

- **Automático** sigue el idioma de tu navegador.
- Elegir uno fijo cambia el panel de YouTube, este panel y las fechas en el acto, sin recargar nada.

Las fechas se mantienen siempre en `dd/mm/aaaa` y `hh:mm:ss` en los dos idiomas.

---

## 11. Dónde viven tus notas

- Se guardan en tu navegador (`chrome.storage.local`) en el momento en que tocás Guardar.
- Si activás **Sincronizar con Chrome Sync**, además se copian a tu cuenta de Google, y así las
  tenés en otras computadoras con el mismo perfil.
- No se envían a ningún servidor del proyecto y no hay cuentas ni registros.

Consecuencia práctica: si desinstalás la extensión o borrás los datos del navegador sin tener sync ni
respaldo, las notas se pierden. Una exportación de vez en cuando no está de más.

---

## 12. Problemas comunes

**No veo el panel en el video.**
Fijate que estés en `youtube.com/watch` (un video, no la página principal). Si acabás de instalar o
recargar la extensión, refrescá la pestaña.

**El panel quedó en un lugar raro.**
En modo cine se ubica abajo del reproductor, antes de los comentarios; en la vista normal vuelve a la
columna lateral. Si cambiás de vista con el reproductor, esperá un segundo: se reacomoda solo.

**Guardé una nota y no la veo.**
Mirá que el video sea el mismo: cada video tiene su propia lista. También revisá que el panel no esté
colapsado con el botón `−`.

**Cambié de computadora y no están mis notas.**
Sin Chrome Sync activo las notas son locales. Exportá el JSON en la máquina vieja e importalo en la
nueva.

---

## 13. Lo que todavía no hace

Para que no lo busques: no exporta a PDF ni a otros formatos, no tiene buscador dentro de las notas,
no sincroniza con servicios que no sean Chrome Sync, y no hay versión para celular (el panel se
instala en el navegador de escritorio).

Varias de esas cosas están anotadas en la [hoja de ruta](ROADMAP.md).
