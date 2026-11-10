# Magic Touch en EventShare

## Uso en el televisor

1. Ejecuta `npm install` y `npm run dev` (o `npm run build` y `npm start`). Abre `/tv/CODIGO` en el equipo conectado al televisor. Necesitas al menos una fotografía aprobada en el evento.
2. Usa HTTPS o localhost. Conecta una webcam al equipo que ejecuta el navegador; una cámara en el teléfono del administrador no controla otra pantalla.
3. Pulsa **Magic Touch** en la esquina superior derecha y permite el acceso a la cámara. Espera a que aparezca «Cámara activa · procesamiento local». La primera carga prepara unos 22 MB entre modelo y WASM.
4. Sigue la guía de tres pasos: muestra tu mano, acerca el cursor a una foto y junta pulgar e índice. El borde punteado dorado anticipa la foto; el borde cian continuo confirma el agarre. Puedes omitir la guía y volver a abrirla con **Ver guía**.
5. Colócate frente a la cámara, con la mano completa visible y buena iluminación. El cursor sigue al índice en espejo.

| Gesto | Resultado |
| --- | --- |
| Solo índice extendido, otros dedos cerrados | Trazo cian luminoso. Baja el índice para terminar un trazo. |
| Pulgar e índice juntos cerca de una foto | Selecciona la pieza más cercana. Muévela sin separar los dedos. |
| Separar pulgar e índice | Suelta la pieza. |
| Mantener el pellizco con la primera mano y variar la separación pulgar–índice de la segunda | Escala relativa de la pieza, limitada entre 65 % y 220 %. La separación al aparecer la segunda mano es la referencia. |
| Palma abierta de la mano que controla el cursor durante unos 450 ms | Pausa sin borrar el dibujo ni cambiar las posiciones. Durante el zoom, la segunda mano no activa la pausa. |
| Puño cerrado de la mano que controla el cursor durante unos 300 ms | Reanuda. |
| Botón «Borrar dibujo» | Borra solo los trazos; conserva las posiciones de las fotos y el estado de pausa. |
| Desactivar Magic Touch | Apaga cámara y detector, descarta dibujos y posiciones temporales, y vuelve a la presentación previa. |

Las piezas conservan la distribución SVG original. En modo Magic Touch se congela la selección de fotos y la rotación de diseños para que una foto no cambie mientras la mueves; las consultas de actualización siguen funcionando. Al desactivarlo aparecen las fotos actualizadas y se reanudan los temporizadores. Los movimientos son locales a esa pantalla y no modifican las publicaciones ni se transmiten al administrador.

Si ocultas la pestaña, desconectas la cámara o el detector falla, se detienen la cámara y el procesamiento. Desactiva y vuelve a activar para reintentar. Cambiar entre orientación horizontal y vertical restablece la composición y los trazos, sin volver a pedir la cámara. Los trazos desaparecen a los 90 segundos y tienen un límite de segmentos para acotar el consumo de memoria.

## Arquitectura y privacidad

- `PantallaTv.tsx`: mantiene la API de fotos aprobadas, el sondeo de 8 s y los diseños existentes. Añade activación, captura de la lista visible y suspensión temporal de los cambios automáticos.
- `CollageGeometrico.tsx` / `.css`: conserva los 21 rectángulos, su composición, fotos y animaciones de entrada. Añade un grupo SVG exterior por pieza para traslación/escala y carga diferida del control de gestos.
- `ControlGestos.tsx`: convierte las coordenadas en espejo a coordenadas SVG mediante `getScreenCTM().inverse()`, incluyendo márgenes de pantalla y `viewBox`, y conecta el detector al collage y al lienzo.
- `GestureCursor.tsx`: cursor cian animado con `motion/react`, ya instalado.
- `GestureCanvas.tsx`: trazos locales con Canvas 2D, resolución adaptable, brillo y límite de memoria.
- `useHandTracking.ts`: permisos, ciclo de cámara, identificación y suavizado, un solo fotograma en vuelo, máximo 20 inferencias/s, cancelación de activaciones tardías y liberación al desmontar.
- `gestureRecognition.ts`: geometría relativa al tamaño de la palma, histéresis de pellizco, umbral 0.7, confirmación temporal y seguimiento por proximidad para evitar intercambiar las manos si cambia el orden del detector. Los umbrales de detección, presencia y seguimiento también se configuran en MediaPipe. El score de lateralidad solo es un filtro adicional, no una probabilidad del gesto.
- `gestureInteraction.ts`: selección, arrastre, zoom, límites espaciales, pérdida de mano y pausa sin borrado, preselección y avance de la guía por acciones.
- `public/magic-touch/hand-tracking.worker.js`: worker clásico con MediaPipe Tasks Vision 1.2.0, dos manos, modo VIDEO y CPU. Usa el bundle IIFE para permitir `importScripts` del cargador WASM.

El video no se sube a ninguna API. Solo se transfieren `ImageBitmap` de la cámara al worker del mismo navegador. La respuesta contiene puntos de las manos. Al desactivar se termina el worker y se detienen todos los tracks. No se crean grabaciones.

El modelo y el runtime se sirven desde el mismo origen de EventShare, sin CDN en ejecución. `scripts/preparar-mediapipe.mjs` copia los archivos de la versión exacta de npm antes de `dev` y `build`, y verifica el SHA-256 del modelo. El directorio generado `public/magic-touch/vendor` no se versiona. `.vercelignore` permite incluir el script necesario en despliegues por CLI.

Modelo: [Hand Landmarker float16, versión 1](https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task).
SHA-256: `fbc2a30080c3c557093b5ddfc334698132eb341044ccee322ccf8bcf3607cde1`.
Referencia: [guía oficial de Hand Landmarker para web](https://developers.google.com/edge/mediapipe/solutions/vision/hand_landmarker/web_js). Runtime MediaPipe: Apache-2.0.

## Verificación

- `npm run test:gestos`: geometría, rotación/tamaño, confianza, estabilización, identidad, arrastre, zoom, límites, pausa, preselección, guía y pérdida de mano.
- `npm run typecheck` y `npm run build`: tipos y compilación de producción.
- `MAGIC_TEST_URL=http://localhost:3106/tv/CODIGO node scripts/prueba-magic-browser.mjs`: requiere Chromium y un servidor local. Lee el evento existente, sustituye las respuestas del feed por fotos de prueba y usa una cámara simulada; no escribe en la base. Comprueba permisos, carga real del worker/modelo, interacción de UI con landmarks sintéticos y limpieza. Guarda captura en `/tmp/eventshare-magic-touch.png`.

La prueba de navegador no sustituye una validación con manos reales: comprueba iluminación, distancia y rendimiento en el equipo del televisor. Navegadores sin Worker, ImageBitmap, OffscreenCanvas o acceso a cámara muestran un mensaje explicativo. Se recomienda Chrome/Edge de escritorio actual.
