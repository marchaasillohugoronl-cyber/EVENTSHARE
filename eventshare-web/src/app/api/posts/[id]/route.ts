import { api, forbidden, json, notFound } from '@/server/http';
import { queryOne } from '@/server/baseDatos';
import { getAuth, requireAuth } from '@/server/autenticacion';
import { getPost } from '@/server/publicaciones';
import { assertReadable, requireEvent } from '@/server/eventos';
import { deleteObject } from '@/server/almacenamiento';

// DELETE /api/posts/:id  — borrado lógico. Lo puede hacer el dueño del evento (ADMIN) o el autor.
export const DELETE = api<{ id: string }>(async (req, { params }) => {
  const user = await requireAuth(req);
  const post = await queryOne<{ id: string; user_id: string; owner_id: string; photo_key: string | null }>(
    `SELECT p.id, p.user_id, p.photo_key, e.owner_id FROM publicaciones p JOIN eventos e ON e.id = p.event_id
      WHERE p.id = $1 AND p.deleted_at IS NULL`, [params.id]
  );
  if (!post) throw notFound('Publicación');
  if (post.owner_id !== user.id && post.user_id !== user.id) throw forbidden();
  await queryOne('UPDATE publicaciones SET deleted_at = now() WHERE id = $1', [post.id]);
  if (post.photo_key) await deleteObject(post.photo_key);
  return json({ deleted: true });
});

// GET /api/posts/:id  — una publicación aprobada
export const GET = api<{ id: string }>(async (req, { params }) => {
  const viewer = await getAuth(req);
  const post = await getPost(params.id, viewer?.id ?? null);
  if (!post) throw notFound('Publicación');
  assertReadable(await requireEvent(post.eventId), viewer);
  return json({ post });
});
