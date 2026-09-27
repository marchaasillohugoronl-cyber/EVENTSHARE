import { api, json, notFound } from '@/server/http';
import { queryOne, query } from '@/server/baseDatos';
import { requireAuth } from '@/server/autenticacion';
import { assertActive, ensureMember, requireEvent } from '@/server/eventos';
import { rateLimit } from '@/server/limiteSolicitudes';

// POST /api/posts/:id/like  — alterna "Me gusta"
export const POST = api<{ id: string }>(async (req, { params }) => {
  const user = await requireAuth(req);
  await rateLimit(`like:${user.id}`, 60, 60);
  const post = await queryOne<{ id: string; event_id: string }>(
    `SELECT id, event_id FROM publicaciones WHERE id = $1 AND status = 'APPROVED' AND deleted_at IS NULL`, [params.id]
  );
  if (!post) throw notFound('Publicación');
  const ev = await requireEvent(post.event_id);
  assertActive(ev);
  await ensureMember(ev.id, user.id);

  const inserted = await queryOne(
    `INSERT INTO me_gusta (post_id, user_id) VALUES ($1, $2) ON CONFLICT (post_id, user_id) DO NOTHING RETURNING id`,
    [post.id, user.id]
  );
  if (!inserted) await query('DELETE FROM me_gusta WHERE post_id = $1 AND user_id = $2', [post.id, user.id]);
  const counts = await queryOne<{ likes_count: number }>('SELECT likes_count FROM publicaciones WHERE id = $1', [post.id]);
  return json({ liked: !!inserted, likesCount: counts?.likes_count ?? 0 });
});
