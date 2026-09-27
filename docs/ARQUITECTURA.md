# EventShare – Arquitectura (propuesta para confirmar)

## Vista general
```
 Android Admin (Kotlin/Compose) ─┐
                                 ├─► API REST (Next.js Route Handlers) ─► PostgreSQL (Neon)
 Web Invitados (Next.js/React) ──┘                │
                                                  └─► Cloudinary (fotos, URLs prefirmadas)
```

## Decisiones clave

**1. Backend dentro de Next.js (monolito modular).**
Para el MVP un solo proyecto y un solo deploy (Vercel) reduce complejidad. La API vive en `src/app/api/**` y la lógica en `src/server/**` (servicios/repositorios independientes de Next), de modo que se puede extraer a un servicio aparte (Fastify/NestJS) cuando haga falta, sin reescribir la lógica.

**2. Almacenamiento de fotos: Cloudinary con subida directa.**
El cliente pide una URL prefirmada a la API (`POST /api/events/:id/uploads`), sube el archivo directo a Cloudinary con POST multipart firmado y luego crea el post con la clave. Así los archivos no pasan por el servidor (más barato/rápido). La API valida tipo MIME (jpeg/png/webp), tamaño máximo (ej. 10 MB) y verifica el objeto tras la subida; se recomienda reprocesar (resize/EXIF strip) en una fase posterior.

**3. Autenticación.**
- Admin: email + contraseña (argon2id/bcrypt), access token JWT corto (15 min) + refresh token rotativo guardado hasheado en `tokens_renovacion`. En Android se guarda con DataStore cifrado / EncryptedSharedPreferences.
- Invitado: (a) Google (se verifica el ID token en el servidor), o (b) invitado temporal: se crea un `usuarios` con `role=GUEST`, sin email, y se entrega un token de larga duración en cookie httpOnly (~30 días) para mantener la sesión.
- Roles verificados en cada endpoint; los invitados solo actúan en eventos donde son miembros y no están bloqueados.

**4. Tiempo real: recomendación.**
| Opción | Ventaja | Problema |
|---|---|---|
| WebSockets propios | Bidireccional | No funciona en serverless (Vercel); requiere servidor persistente |
| SSE | Simple | Conexiones largas limitadas en serverless |
| Supabase Realtime | Fácil | Añade otra plataforma; no encaja con Neon como única BD |
| Servicio gestionado (Ably/Pusher) | Escala, sin infra | Costo a gran escala |
| Polling corto con cursor | Cero infraestructura | Latencia de segundos |

**Decisión implementada:** *polling corto* (la web vuelve a pedir la primera página del muro cada 8 s, solo con la pestaña visible, y fusiona los cambios: nuevas publicaciones, aprobadas después, borradas y contadores) — es suficiente para un muro de fotos y funciona en serverless. En Fase 10, migrar a Ably o Pusher (publicar un evento al aprobar un post) sin cambiar el modelo de datos. Para un evento típico, el polling es indistinguible de tiempo real para el usuario.

**5. Paginación.** Cursor `(created_at, id)` con índice `idx_posts_feed`; infinite scroll en web. Evita los problemas de OFFSET.

**6. Moderación.** `eventos.moderation_enabled` decide el estado inicial del post (`PENDING` o `APPROVED`). Borrado lógico (`deleted_at`) + eliminación del objeto en Cloudinary. Bloqueo por evento en `miembros_evento.is_blocked`.

**7. Seguridad.** HTTPS (Vercel), rate limiting atómico compartido en PostgreSQL, validación con Zod, sanitización de mensajes (se guarda texto plano y se escapa al renderizar; React lo hace por defecto), CORS restringido, secretos solo en variables de entorno, consultas parametrizadas.

**8. Escalabilidad futura.** Videos (mismo flujo de subida prefirmada + procesamiento), notificaciones, planes premium (columna `plan` en usuarios/eventos), dominio personalizado (tabla `event_domains`), álbum privado post-evento (`status=CLOSED/ARCHIVED`). Nada de esto exige cambiar el esquema actual.

## Tecnologías
Next.js 15+ (App Router) · React · TypeScript · Tailwind CSS · Zod · `pg` o Drizzle ORM (recomendado Drizzle) · `jose` (JWT) · `argon2` · API REST de Cloudinary · `qrcode` · Kotlin · Jetpack Compose · Retrofit · Coroutines · Navigation Compose · DataStore.

## Estructura de carpetas
```
eventshare/
├─ db/migrations/                 0001_init.sql, 0002_unique_photo_key.sql, 0003_rate_limits.sql
├─ docs/
├─ eventshare-web/
│  ├─ scripts/migrar.mjs         aplica migraciones
│  └─ src/
│     ├─ app/
│     │  ├─ page.tsx, login/      entrada por código / identidad de invitado
│     │  ├─ e/[code]/             layout (tema del evento), muro, photos/, upload/, post/[id]/
│     │  └─ api/                  auth/, events/, posts/, comments/, admin/ (Route Handlers)
│     ├─ components/              Feed, PostCard, UploadForm, IdentityForm, SessionProvider…
│     ├─ lib/                     cliente API, tipos, formato, procesado de imagen (frontend)
│     └─ server/                  db, auth, storage (Cloudinary), events, posts, validation, http, ratelimit
└─ eventshare-admin/              Android (Kotlin + Compose, MVVM)
   └─ app/src/main/java/com/eventshare/admin/
      ├─ data/                    Retrofit, modelos, DataStore cifrado, repositorio, autenticador de tokens
      ├─ ui/                      navegación + pantallas (auth, dashboard, events, posts) con sus ViewModels
      └─ util/CodigoQr.kt               generación, guardado y compartir del QR
```

## Relaciones
- `usuarios 1—N eventos` (owner_id)
- `eventos N—M usuarios` vía `miembros_evento` (unique event_id+user_id)
- `eventos 1—N publicaciones`, `usuarios 1—N publicaciones`
- `publicaciones 1—N comentarios`, `publicaciones 1—N me_gusta` (unique post_id+user_id)
- `usuarios 1—N tokens_renovacion`
