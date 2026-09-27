import { api, json } from '@/server/http';
import { query } from '@/server/baseDatos';
import { requireAdmin } from '@/server/autenticacion';
import { requireOwnedEvent } from '@/server/eventos';

// GET /api/admin/events/:id/members  — invitados del evento
export const GET = api<{ id: string }>(async (req, { params }) => {
  const admin = await requireAdmin(req);
  const ev = await requireOwnedEvent(params.id, admin);
  const rows = await query<any>(
    `SELECT u.id, u.name, u.avatar_url, m.joined_at, m.is_blocked,
            (SELECT count(*) FROM publicaciones p WHERE p.event_id = m.event_id AND p.user_id = u.id AND p.deleted_at IS NULL)::int AS posts_count
       FROM miembros_evento m JOIN usuarios u ON u.id = m.user_id
      WHERE m.event_id = $1 ORDER BY m.joined_at DESC LIMIT 500`,
    [ev.id]
  );
  return json({
    items: rows.map((r) => ({ id: r.id, name: r.name, avatarUrl: r.avatar_url, joinedAt: r.joined_at, isBlocked: r.is_blocked, postsCount: r.posts_count })),
  });
});
