# Deploy

## Web + API en Vercel
1. Sube el repositorio a GitHub y en Vercel importa el proyecto con **Root Directory** = `eventshare-web`.
2. Añade las variables de entorno de `.env.example` (Settings → Environment Variables). `NEXT_PUBLIC_APP_URL` debe ser tu dominio final (`https://eventshare.com`).
3. Aplica las migraciones contra Neon desde tu máquina: `DATABASE_URL=... npm run db:migrate`.
4. Añade tu dominio en Vercel (HTTPS automático).
5. Configura las tres variables `CLOUDINARY_*` en el servidor. No expongas el API Secret en variables `NEXT_PUBLIC_*`. Las subidas usan POST multipart firmado directo a Cloudinary.
6. Google (opcional): agrega tu dominio en *Authorized JavaScript origins*.
7. Pon `ALLOW_ADMIN_REGISTRATION=false` cuando ya hayas creado tus cuentas de administrador.

## Android
1. Ajusta `EVENTSHARE_API_URL` en `eventshare-admin/gradle.properties` a tu dominio.
2. *Build → Generate Signed Bundle / APK* con tu keystore.

## Rate limiting en producción
El limitador usa PostgreSQL y comparte los contadores entre instancias. Aplica `0003_rate_limits.sql` **antes** de desplegar esta versión. Cada comprobación realiza una operación atómica y las respuestas 429 incluyen `Retry-After` en segundos. Si la base de datos falla, la solicitud no continúa; no existe un fallback en memoria que permita eludir el límite.

Programa diariamente la limpieza de ventanas vencidas (por ejemplo, desde un trabajo de mantenimiento con acceso a la base):
```sql
DELETE FROM limites_solicitudes WHERE resets_at < now() - interval '1 day';
```
Las claves almacenadas son hashes SHA-256 de la categoría y el identificador; no contienen emails o IP en claro, aunque el hash no equivale a anonimización. El proxy de entrada debe sobrescribir `X-Forwarded-For` y `X-Real-IP` y evitar acceso directo a la API; no confíes en cabeceras aportadas por el cliente. Los límites por IP conservan el margen para invitados que comparten Wi-Fi.

Las pruebas de integración requieren `psql` y usan una base PostgreSQL desechable y crean un esquema aislado:
```bash
cd eventshare-web
TEST_DATABASE_URL=postgresql://localhost/eventshare_test npm run test:ratelimit
```
Para cargas mayores puede sustituirse el almacenamiento por Redis conservando la interfaz asíncrona `await rateLimit(id, max, windowSec)`.

## Evolución
- Tiempo real con push: publicar un evento a Ably/Pusher al aprobar un post y suscribirse en `Muro.tsx` en lugar del polling.
- Videos: mismo flujo de subida prefirmada (`/uploads`) con tipos `video/mp4` y límite mayor.
- Planes premium: columna `plan` en `usuarios`/`eventos` y límites por plan en `/uploads` y `/posts`.
- Dominio personalizado por evento: tabla `event_domains` y resolución del evento por `Host` en el middleware.

## Comprobación después de actualizar dependencias
```bash
cd eventshare-web
npm ci
npm audit
npm run build
npm run typecheck
```

Para probar el flujo HTTP usa una base PostgreSQL **desechable**, aplica las migraciones y arranca la compilación con sus credenciales y un `JWT_ACCESS_SECRET` exclusivo de pruebas. Habilita el registro de administradores para esa instancia. En otra terminal:
```bash
TEST_API_URL=http://127.0.0.1:3000 npm run test:api
```
La prueba crea datos: administrador, evento, invitado y mensajes. Comprueba autenticación, QR, páginas por código, moderación y respuesta 429 con `Retry-After`. No cubre Google OAuth, subidas a Cloudinary ni interacción visual en dispositivos. Recrea la base desechable entre ejecuciones para no acumular datos ni agotar los límites de registro.

Las rutas y páginas usan parámetros asíncronos conforme a la [guía de migración de Next.js 15](https://nextjs.org/docs/app/guides/upgrading/version-15). El adaptador de la API espera los parámetros antes de invocar la lógica de cada endpoint y usa `connection()` fuera del bloque de errores para impedir el prerender de respuestas dependientes de una sesión.

`package.json` aplica un override de PostCSS para que Next.js utilice la misma versión corregida que el compilador CSS. Evita quitarlo sin volver a ejecutar `npm audit`; véase el [aviso de PostCSS](https://github.com/postcss/postcss/security/advisories/GHSA-fxqj-rqcc-2cmp).
