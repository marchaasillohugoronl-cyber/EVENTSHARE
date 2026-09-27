# API REST

Base: `/api` · JSON · Errores: `{ "error": { "code": "...", "message": "..." } }` (400, 401, 403, 404, 409, 429, 500).

Autenticación:
- **Android (ADMIN):** `Authorization: Bearer <accessToken>` (15 min) + `POST /auth/refresh`.
- **Web (invitados):** cookie `es_session` (httpOnly, 30 días) creada por `/auth/guest` o `/auth/google`.

Paginación por cursor: `?limit=` (1–50) y `?cursor=<nextCursor>`. Respuesta `{ items: [...], nextCursor: string | null }`.

## Auth
| Método | Ruta | Acceso | Cuerpo → Respuesta |
|---|---|---|---|
| POST | `/auth/register` | público | `{name,email,password}` → `{accessToken,refreshToken,expiresIn,user}` |
| POST | `/auth/login` | público | `{email,password}` → igual |
| POST | `/auth/refresh` | público | `{refreshToken}` → nuevo par de tokens (rotación) |
| POST | `/auth/logout` | cualquiera | `{refreshToken?}` → `{ok:true}` y borra la cookie |
| POST | `/auth/google` | público | `{idToken,eventCode?}` → `{user}` + cookie |
| POST | `/auth/guest` | público | `{name,eventCode}` → `{user}` + cookie |
| GET | `/auth/me` | cualquiera | → `{user | null}` |

## Eventos e invitados
| Método | Ruta | Acceso | Descripción |
|---|---|---|---|
| GET | `/events/:codeOrId` | público | Datos públicos del evento (`event`, `viewer`) |
| POST | `/events/:id/join` | autenticado | Se une al evento |
| GET | `/events/:id/posts?photos=1` | público | Muro: publicaciones `APPROVED`, más recientes primero |
| POST | `/events/:id/uploads` | miembro | `{contentType,size}` → `{uploadUrl,key,method,fields,publicUrl,maxBytes,expiresIn}` (POST multipart a Cloudinary) |
| POST | `/events/:id/posts` | miembro | `{photoKey?,message?}` → `{post,requiresApproval}` |
| GET | `/posts/:id` | público | Una publicación aprobada |
| POST | `/posts/:id/like` | miembro | Alterna me gusta → `{liked,likesCount}` |
| GET / POST | `/posts/:id/comments` | público / miembro | Lista / crea `{message}` |
| DELETE | `/posts/:id`, `/comments/:id` | ADMIN dueño o autor | Borrado lógico |

## Administración (rol ADMIN, dueño del evento)
| Método | Ruta | Descripción |
|---|---|---|
| POST | `/events` | Crea evento `{name,description?,eventDate?,primaryColor?,moderationEnabled?,coverKey?}` (genera código único) |
| PATCH | `/events/:id` | Edita; `status`: `ACTIVE` \| `CLOSED` \| `ARCHIVED` |
| POST | `/admin/uploads/cover` | URL prefirmada para la portada |
| GET | `/admin/stats` | Totales del dashboard |
| GET | `/admin/events` | Mis eventos con contadores |
| GET | `/admin/events/:id` | Detalle + estadísticas |
| GET | `/admin/events/:id/posts?status=&hasMessage=1&photos=1` | Publicaciones por estado |
| GET | `/admin/events/:id/comments` | Comentarios recientes |
| GET | `/admin/events/:id/members` | Invitados |
| PATCH | `/admin/events/:id/members/:userId` | `{isBlocked}` bloquea/desbloquea en ese evento |
| GET | `/admin/events/:id/qr?format=png\|svg&download=1` | Imagen del QR |
| PATCH | `/posts/:id/moderation` | `{status: APPROVED\|REJECTED\|PENDING}` |

## Flujo de subida de una foto
1. `POST /events/:id/uploads {contentType,size}` → `uploadUrl`, `key`.
2. `POST uploadUrl` con un formulario multipart: todos los campos de `fields` y el archivo en `file`. El cliente genera el boundary; no fijes manualmente `Content-Type`. La firma dura una hora.
3. `POST /events/:id/posts {photoKey:key,message}` → el servidor verifica el archivo y crea la publicación (`PENDING` o `APPROVED` según la configuración de moderación).
