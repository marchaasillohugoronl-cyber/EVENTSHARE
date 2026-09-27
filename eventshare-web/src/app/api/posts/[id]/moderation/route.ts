import { api, json, notFound, parse } from '@/server/http';
import { moderationSchema } from '@/server/validacion';
import { queryOne } from '@/server/baseDatos';
import { requireAdmin } from '@/server/autenticacion';

// PATCH /api/posts/:id/moderation  — { status: APPROVED | REJECTED | PENDING }  (ADMIN dueño del evento)
export const PATCH = api<{ id: string }>(async (req, { params }) => {
  const admin = await requireAdmin(req);
  const b = await parse(req, moderationSchema);
  const row = await queryOne<{ id: string; status: string }>(
    `UPDATE publicaciones p SET status = $1, moderated_by = $2, moderated_at = now()
       FROM eventos e
      WHERE p.id = $3 AND p.deleted_at IS NULL AND e.id = p.event_id AND e.owner_id = $2
      RETURNING p.id, p.status`,
    [b.status, admin.id, params.id]
  );
  if (!row) throw notFound('Publicación');
  return json({ id: row.id, status: row.status });
});
