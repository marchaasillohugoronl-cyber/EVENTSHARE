# Cartas de nuevos recuerdos

La TV anuncia las nuevas fotos aprobadas detectadas en el sondeo existente (cada 8 segundos). La primera respuesta al abrir la pantalla establece la colección inicial y no genera cartas.

La secuencia dura 10,5 segundos desde que carga la imagen: entra un sobre, se abre la solapa, sale la foto con el nombre del invitado y se desvanece para regresar a la presentación. El botón de cierre permite saltarla. Si la imagen falla o no carga en 10 segundos, se continúa con la siguiente. Con movimiento reducido se muestra la foto directamente.

Las llegadas se presentan de una en una, primero las más antiguas del lote. La cola conserva hasta 24 fotos de la ventana actual del feed; las que dejan de estar disponibles se retiran. No se anuncian videos, mensajes sin foto ni publicaciones pendientes. Una foto ya detectada no se vuelve a anunciar durante esa sesión.

Magic Touch aplaza las cartas hasta desactivarse. Mientras hay cartas pendientes se suspende el cambio automático de diseño. No se cambia la elección de diseño del anfitrión.

Validación:

- `node --import tsx --test scripts/prueba-nuevas-fotos.ts`
- `TV_TEST_URL=http://127.0.0.1:3106/tv/CODIGO node scripts/prueba-carta-browser.mjs` (servidor local y Chromium). Lee el evento, simula el feed y no publica fotos. Genera capturas en `/tmp/eventshare-carta-*.png`.
