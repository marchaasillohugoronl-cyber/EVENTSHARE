import { api, json, notFound, parse } from '@/server/http';
import { memberPatchSchema } from '@/server/validacion';
import { queryOne } from '@/server/baseDatos';
import { requireAdmin } from '@/server/autenticacion';
import { requireOwnedEvent } from '@/server/eventos';

// PATCH /api/admin/events/:id/members/:userId  — { isBlocked }  bloquea/desbloquea en este evento
export const PATCH = api<{ id: string; userId: string }>(async (req, { params }) => {
  const admin = await requireAdmin(req);
  const ev = await requireOwnedEvent(params.id, admin);
  const b = await parse(req, memberPatchSchema);
  const row = await queryOne<{ user_id: string; is_blocked: boolean }>(
    `UPDATE miembros_evento SET is_blocked = $1, blocked_at = CASE WHEN $1 THEN now() ELSE NULL END
      WHERE event_id = $2 AND user_id = $3 RETURNING user_id, is_blocked`,
    [b.isBlocked, ev.id, params.userId]
  );
  if (!row) throw notFound('Invitado');
  return json({ userId: row.user_id, isBlocked: row.is_blocked });
});
