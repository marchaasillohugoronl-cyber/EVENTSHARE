import { api, json, notFound, parse } from '@/server/http';
import { commentSchema } from '@/server/validacion';
import { query, queryOne } from '@/server/baseDatos';
import { getAuth, requireAuth } from '@/server/autenticacion';
import { assertActive, assertReadable, ensureMember, requireEvent } from '@/server/eventos';
import { rateLimit } from '@/server/limiteSolicitudes';

const toComment = (r: any) => ({
  id: r.id, postId: r.post_id, message: r.message, createdAt: r.created_at,
  author: { id: r.user_id, name: r.user_name, avatarUrl: r.avatar_url },
});

async function approvedPost(id: string) {
  const post = await queryOne<{ id: string; event_id: string }>(
    `SELECT id, event_id FROM publicaciones WHERE id = $1 AND status = 'APPROVED' AND deleted_at IS NULL`, [id]
  );
  if (!post) throw notFound('Publicación');
  return post;
}

// GET /api/posts/:id/comments  — comentarios en orden cronológico (máx. 200)
export const GET = api<{ id: string }>(async (req, { params }) => {
  const post = await approvedPost(params.id);
  assertReadable(await requireEvent(post.event_id), await getAuth(req));
  const rows = await query<any>(
    `SELECT c.id, c.post_id, c.message, c.created_at, u.id AS user_id, u.name AS user_name, u.avatar_url
       FROM comentarios c JOIN usuarios u ON u.id = c.user_id
      WHERE c.post_id = $1 AND c.deleted_at IS NULL ORDER BY c.created_at ASC LIMIT 200`,
    [post.id]
  );
  return json({ items: rows.map(toComment) });
});

// POST /api/posts/:id/comments  — { message }
export const POST = api<{ id: string }>(async (req, { params }) => {
  const user = await requireAuth(req);
  await rateLimit(`comment:${user.id}`, 20, 60);
  const post = await approvedPost(params.id);
  const ev = await requireEvent(post.event_id);
  assertActive(ev);
  await ensureMember(ev.id, user.id);
  const b = await parse(req, commentSchema);
  const row = await queryOne<any>(
    'INSERT INTO comentarios (post_id, user_id, message) VALUES ($1, $2, $3) RETURNING *', [post.id, user.id, b.message]
  );
  return json({ comment: toComment({ ...row, user_name: user.name, avatar_url: user.avatarUrl }) }, 201);
});
