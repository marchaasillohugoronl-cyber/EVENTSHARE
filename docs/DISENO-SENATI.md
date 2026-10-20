# Diseño SENATI — cambios y alcance

## Estructura revisada
- Web: Next.js App Router, componentes React, Tailwind y CSS compartido.
- Eventos: portada específica SENATI_TEC, temas personalizados y portada de matrimonio.
- Participación: acceso por código/QR, identidad, subida, álbum, muro y comentarios.
- Administración: panel web y aplicación Android con Jetpack Compose.
- Servicios: API integrada en Next.js, PostgreSQL y almacenamiento Cloudinary.

## Diagnóstico visual
La entrada original tenía un formulario aislado y no presentaba la identidad de SENATI. La portada SENATI tenía un collage, pero carecía del personaje de referencia. La web utilizaba tonos grises y Android una paleta verde: la identidad no era coherente entre plataformas.

## Implementación
- Portada con jerarquía tipográfica, entrada por código/QR y explicación del recorrido.
- Identidad azul, blanco y cian, con escenario oscuro para destacar el robot.
- RobotSenati.tsx: dibujo vectorial original mediante geometría SVG, degradados y piezas articuladas. No utiliza la imagen de referencia ni archivos de imagen del personaje. Es una interpretación vectorial con volumen simulado, no un modelo 3D.
- Entrada con desplazamiento, escala y enfoque; flotación, saludo, parpadeo y sombra sincronizada mediante CSS.
- Controles para pausar y repetir la entrada; respeto de prefers-reduced-motion.
- Reutilización del robot en portada SENATI_TEC, con acciones según el estado del evento.
- Adaptación de composición a móvil y escritorio.
- Colores base compartidos de la web y esquemas claro/oscuro de Android actualizados.

## Alcance
Se conservaron los flujos existentes de acceso, QR, publicaciones y administración. No se modificaron API, permisos, base de datos ni almacenamiento. La revisión de arquitectura orienta el rediseño; no constituye una auditoría exhaustiva de seguridad. Android recibió ajustes de color, sin incorporar el robot nativo.

## Validación
- TypeScript: `npm run typecheck` completado sin errores.
- Revisión visual automatizada pendiente: el navegador integrado no consiguió adjuntar la vista local.
- Android: no se ejecutó una compilación Gradle en esta sesión.
- Producción: `npm run build` completado correctamente (23 páginas estáticas generadas).
- Ajuste según las capturas del usuario: cabecera blanca y franja oscura, campaña azul/violeta con cian, botones rosados y contornos azules. Emblema vectorial compartido y centrado en el pecho. Portada verificada visualmente en localhost:3000; TypeScript sin errores.

## Pantalla TV: semicírculo SENATI
- Referencia revisada: https://www.pinterest.com/pin/627196685645154102/ (el enlace pin.it recibido dirige al mismo video).
- Nuevo diseño `semicircle`: máscara fija de medio círculo, ocho segmentos fotográficos en blanco y negro y giro continuo de 40 segundos por vuelta; marca y textos inmóviles al centro.
- Usa las publicaciones reales del evento, admite videos silenciados y reemplaza medios que no cargan. Si hay más de ocho publicaciones, cambia el grupo tras una vuelta.
- Pausa/reanudación de movimiento y videos; respeta movimiento reducido y pestañas ocultas.
- Seleccionado por defecto para eventos SENATI_TEC. Los demás diseños siguen disponibles; el modo automático deja completar la vuelta de este diseño.
- Validación: TypeScript, inspección visual en /tv/J6J6MFUB, pausa confirmada por animationPlayState y cambio de diseño de ida y vuelta.
- Ajuste posterior: la TV inicia con todas las animaciones en secuencia, cada 12 segundos, incluyendo el semicírculo. El robot vectorial permanece visible en tamaño compacto durante todos los diseños, con pausa independiente.
