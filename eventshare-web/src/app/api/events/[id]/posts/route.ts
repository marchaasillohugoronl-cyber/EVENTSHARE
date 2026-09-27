import { api, forbidden, json, parse, parseQuery, ApiError } from '@/server/http';
import { pageQuery, postCreateSchema } from '@/server/validacion';
import { queryOne } from '@/server/baseDatos';
import { getAuth, requireAuth } from '@/server/autenticacion';
import { assertActive, assertReadable, ensureMember, requireEvent } from '@/server/eventos';
import { listPosts, toPost } from '@/server/publicaciones';
import { publicUrl, verifyUploadedImage } from '@/server/almacenamiento';
import { rateLimit } from '@/server/limiteSolicitudes';

// GET /api/events/:id/posts?cursor=&limit=&photos=1  — muro (solo publicaciones APPROVED), orden descendente
export const GET = api<{ id: string }>(async (req, { params }) => {
  const ev = await requireEvent(params.id);
  const viewer = await getAuth(req);
  assertReadable(ev, viewer);
  const q = parseQuery(req, pageQuery);
  const page = await listPosts({
    eventId: ev.id, status: 'APPROVED', viewerId: viewer?.id, cursor: q.cursor, limit: q.limit ?? 12, hasPhoto: q.photos === '1',
  });
  return json(page);
});

// POST /api/events/:id/posts  — { photoKey?, message? }
export const POST = api<{ id: string }>(async (req, { params }) => {
  const user = await requireAuth(req);
  await rateLimit(`post:${user.id}`, 10, 60);
  const ev = await requireEvent(params.id);
  assertActive(ev);
  await ensureMember(ev.id, user.id);
  const b = await parse(req, postCreateSchema);

  if (b.photoKey) {
    if (!b.photoKey.startsWith(`events/${ev.id}/${user.id}/`)) throw forbidden('Archivo no válido para este usuario');
    await verifyUploadedImage(b.photoKey);
  }
  const status = ev.moderation_enabled ? 'PENDING' : 'APPROVED';
  let row;
  try {
    row = await queryOne<any>(
      `INSERT INTO publicaciones (event_id, user_id, photo_url, photo_key, message, status)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [ev.id, user.id, b.photoKey ? publicUrl(b.photoKey) : null, b.photoKey ?? null, b.message || null, status]
    );
  } catch (e: any) {
    if (e?.code === '23505') throw new ApiError(409, 'DUPLICATE_UPLOAD', 'Esta foto ya fue publicada');
    throw e;
  }
  return json(
    { post: toPost({ ...row, user_name: user.name, avatar_url: user.avatarUrl, liked_by_me: false }), requiresApproval: status === 'PENDING' },
    201
  );
});
