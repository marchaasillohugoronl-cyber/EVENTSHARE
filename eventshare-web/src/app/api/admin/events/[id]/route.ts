import { api, json } from '@/server/http';
import { queryOne } from '@/server/baseDatos';
import { requireAdmin } from '@/server/autenticacion';
import { requireOwnedEvent, toEvent } from '@/server/eventos';

// GET /api/admin/events/:id  — detalle + estadísticas básicas
export const GET = api<{ id: string }>(async (req, { params }) => {
  const admin = await requireAdmin(req);
  const ev = await requireOwnedEvent(params.id, admin);
  const s = await queryOne<any>(
    `SELECT
       (SELECT count(*) FROM publicaciones WHERE event_id = $1 AND deleted_at IS NULL AND photo_url IS NOT NULL AND status = 'APPROVED')::int AS photos,
       (SELECT count(*) FROM publicaciones WHERE event_id = $1 AND deleted_at IS NULL AND message IS NOT NULL AND status = 'APPROVED')::int AS messages,
       (SELECT count(*) FROM publicaciones WHERE event_id = $1 AND deleted_at IS NULL AND status = 'PENDING')::int AS pending,
       (SELECT count(*) FROM publicaciones WHERE event_id = $1 AND deleted_at IS NULL AND status = 'REJECTED')::int AS rejected,
       (SELECT count(*) FROM comentarios c JOIN publicaciones p ON p.id = c.post_id WHERE p.event_id = $1 AND c.deleted_at IS NULL)::int AS comments,
       (SELECT COALESCE(sum(likes_count), 0) FROM publicaciones WHERE event_id = $1 AND deleted_at IS NULL)::int AS likes,
       (SELECT count(*) FROM miembros_evento WHERE event_id = $1)::int AS guests,
       (SELECT count(*) FROM miembros_evento WHERE event_id = $1 AND is_blocked)::int AS blocked`,
    [ev.id]
  );
  return json({ event: toEvent(ev), stats: s });
});
