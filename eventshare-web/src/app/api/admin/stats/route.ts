import { api, json } from '@/server/http';
import { queryOne } from '@/server/baseDatos';
import { requireAdmin } from '@/server/autenticacion';

// GET /api/admin/stats  — totales para el dashboard
export const GET = api(async (req) => {
  const admin = await requireAdmin(req);
  const s = await queryOne<any>(
    `SELECT
       (SELECT count(*) FROM eventos WHERE owner_id = $1)::int AS events,
       (SELECT count(*) FROM eventos WHERE owner_id = $1 AND status = 'ACTIVE')::int AS active_events,
       (SELECT count(*) FROM publicaciones p JOIN eventos e ON e.id = p.event_id WHERE e.owner_id = $1 AND p.deleted_at IS NULL AND p.photo_url IS NOT NULL AND p.status = 'APPROVED')::int AS photos,
       (SELECT count(*) FROM publicaciones p JOIN eventos e ON e.id = p.event_id WHERE e.owner_id = $1 AND p.deleted_at IS NULL AND p.message IS NOT NULL AND p.status = 'APPROVED')::int AS messages,
       (SELECT count(*) FROM miembros_evento m JOIN eventos e ON e.id = m.event_id WHERE e.owner_id = $1)::int AS guests,
       (SELECT count(*) FROM publicaciones p JOIN eventos e ON e.id = p.event_id WHERE e.owner_id = $1 AND p.deleted_at IS NULL AND p.status = 'PENDING')::int AS pending`,
    [admin.id]
  );
  return json({
    events: s.events, activeEvents: s.active_events, photos: s.photos, messages: s.messages, guests: s.guests, pending: s.pending,
  });
});
