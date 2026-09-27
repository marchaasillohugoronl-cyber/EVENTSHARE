import { api, json, parseQuery } from '@/server/http';
import { pageQuery } from '@/server/validacion';
import { query } from '@/server/baseDatos';
import { requireAdmin } from '@/server/autenticacion';
import { requireOwnedEvent } from '@/server/eventos';
import { decodeCursor, encodeCursor, tsSql } from '@/server/publicaciones';

// GET /api/admin/events/:id/comments  — comentarios recientes del evento (para moderar)
export const GET = api<{ id: string }>(async (req, { params }) => {
  const admin = await requireAdmin(req);
  const ev = await requireOwnedEvent(params.id, admin);
  const q = parseQuery(req, pageQuery);
  const limit = q.limit ?? 30;
  const args: unknown[] = [ev.id];
  let cursorSql = '';
  const c = decodeCursor(q.cursor);
  if (c) {
    args.push(c.ts, c.id);
    cursorSql = `AND (c.created_at, c.id) < ($2::timestamptz, $3::uuid)`;
  }
  args.push(limit + 1);
  const rows = await query<any>(
    `SELECT c.id, c.post_id, c.message, c.created_at, ${tsSql('c.created_at')} AS cursor_ts,
            u.id AS user_id, u.name AS user_name, u.avatar_url
       FROM comentarios c JOIN publicaciones p ON p.id = c.post_id JOIN usuarios u ON u.id = c.user_id
      WHERE p.event_id = $1 AND c.deleted_at IS NULL ${cursorSql}
      ORDER BY c.created_at DESC, c.id DESC LIMIT $${args.length}`,
    args
  );
  const page = rows.slice(0, limit);
  const last = page[page.length - 1];
  return json({
    items: page.map((r) => ({
      id: r.id, postId: r.post_id, message: r.message, createdAt: r.created_at,
      author: { id: r.user_id, name: r.user_name, avatarUrl: r.avatar_url },
    })),
    nextCursor: rows.length > limit && last ? encodeCursor(last.cursor_ts, last.id) : null,
  });
});
