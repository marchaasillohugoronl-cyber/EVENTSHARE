# EventShare

Plataforma para que los invitados de una boda, cumpleaños o graduación compartan fotos y mensajes escaneando un código QR.

```
eventshare/
├─ db/migrations/          Esquema PostgreSQL (0001_init.sql, 0002_unique_photo_key.sql, 0003_rate_limits.sql)
├─ docs/                   ARQUITECTURA.md, API.md, DESPLIEGUE.md
├─ eventshare-web/         Next.js 15: web de invitados + API REST (la usan la web y Android)
└─ eventshare-admin/       App Android (Kotlin, Jetpack Compose, MVVM) para administradores
```

## Requisitos
- Node.js 20+ y npm
- Cuenta en [Neon](https://neon.tech) (PostgreSQL) y en [Cloudinary](https://cloudinary.com) (fotos)
- Android Studio (Ladybug o superior, JDK 17) para la app de administrador
- Opcional: proyecto en Google Cloud para "Continuar con Google"

## 1. Base de datos (Neon)
1. Crea un proyecto en Neon y copia la cadena de conexión (`postgresql://...?sslmode=require`).
2. Guárdala en `eventshare-web/.env.local` como `DATABASE_URL` (paso 3).
3. Aplica las migraciones (más abajo, después de instalar dependencias): `npm run db:migrate`.

## 2. Almacenamiento de fotos (Cloudinary)
1. Crea una cuenta y abre **Settings > API Keys** en la consola de Cloudinary.
2. Configura `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY` y `CLOUDINARY_API_SECRET` en `eventshare-web/.env.local`.
3. Las subidas son firmadas por el servidor; no necesitas crear un bucket ni habilitar subidas sin firma.
4. Las fotos se guardan bajo `events/` y las portadas bajo `covers/`. Neon conserva sus referencias y URLs.

Las URLs de las imagenes son publicas. La validacion al publicar consulta la Admin API de Cloudinary y consume su cuota. Supervisa almacenamiento, transferencia, transformaciones y solicitudes de administracion en la consola.

## 3. Web + API (Next.js)
```bash
cd eventshare-web
npm install
cp .env.example .env.local        # completa los valores (ver abajo)
npm run db:migrate                # crea las tablas en Neon
npm run dev                       # http://localhost:3000
```

Variables de entorno (`.env.local`):

| Variable | Descripción |
|---|---|
| `DATABASE_URL` | Cadena de conexión de Neon |
| `JWT_ACCESS_SECRET` | Secreto largo y aleatorio: `openssl rand -base64 48` |
| `NEXT_PUBLIC_APP_URL` | URL pública de la web (se usa en los enlaces/QR). En pruebas con teléfonos: `http://TU_IP_LOCAL:3000` |
| `ALLOW_ADMIN_REGISTRATION` | `false` para cerrar el registro público de administradores |
| `GOOGLE_CLIENT_ID` / `NEXT_PUBLIC_GOOGLE_CLIENT_ID` | Opcional. OAuth Client ID tipo *Web* (mismo valor en ambas). Agrega tu dominio en *Authorized JavaScript origins*. Sin esto, el botón de Google se oculta |
| `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` | Configuracion privada del servidor para Cloudinary |

Nunca subas `.env.local` al repositorio (ya está en `.gitignore`).

## 4. App Android (administrador)
1. Abre la carpeta `eventshare-admin/` con Android Studio y espera la sincronización de Gradle.
   Si falta `gradlew`, Android Studio usa su propio Gradle; desde terminal puedes generarlo con `gradle wrapper --gradle-version 8.9`.
2. La URL de la API está en `eventshare-admin/gradle.properties`:
   - `EVENTSHARE_DEBUG_API_URL` (debug): `http://10.0.2.2:3000/api/` funciona con el emulador. Con un teléfono físico usa la IP de tu PC, por ejemplo `http://192.168.1.20:3000/api/`.
   - `EVENTSHARE_API_URL` (release): tu dominio HTTPS, terminado en `/`.
3. Ejecuta la app → *Regístrate* → crea tu primer evento → verás el QR.

## Probar el flujo completo
1. Android: crea una cuenta y un evento (activa o desactiva la aprobación).
2. Abre la URL del QR (`http://localhost:3000/e/CODIGO`) en el navegador del teléfono o PC.
3. Sube una foto como invitado: aparece en el muro (o queda pendiente si hay moderación).
4. Android → evento → *Moderación* → aprueba. En el navegador el muro se actualiza solo (cada ~8 s).

Prueba rápida de la API sin Android:
```bash
curl -s -X POST localhost:3000/api/auth/register -H 'Content-Type: application/json' \
  -d '{"name":"Ana","email":"ana@example.com","password":"contraseña-segura"}'
```

## Notas de seguridad
Las tablas usan nombres en espanol desde `0004_tablas_espanol.sql`: `usuarios`, `eventos`, `miembros_evento`, `publicaciones`, `comentarios`, `me_gusta`, `tokens_renovacion` y `limites_solicitudes`. El historial se guarda en `migraciones_esquema`. Ejecuta `npm run db:migrate` antes de iniciar esta version. Las migraciones anteriores se conservan para instalaciones nuevas; las columnas y las rutas de la API mantienen sus nombres actuales.

- Contraseñas con bcrypt (coste 12); access token JWT de 15 min + refresh token rotativo (se guarda solo su hash) con detección de reutilización.
- Los tokens en Android se guardan cifrados (AES-GCM con Android Keystore) en DataStore.
- Invitados: cookie `httpOnly`, `SameSite=Lax`, 30 días, con comprobación de `Origin` en peticiones que modifican datos.
- Subidas: formulario firmado para Cloudinary (una hora), identificador aleatorio y sobrescritura desactivada. Al publicar, el servidor consulta el original y verifica formato (JPEG/PNG/WebP) y tamano (max. 10 MB); elimina archivos invalidos.
- Validación con Zod en todos los endpoints, consultas SQL parametrizadas, texto plano escapado al mostrarse, rate limiting compartido y atómico en PostgreSQL (con `Retry-After` en respuestas 429), cabeceras de seguridad y HTTPS.

Consulta `docs/ARQUITECTURA.md`, `docs/API.md` y `docs/DESPLIEGUE.md` para más detalle.
