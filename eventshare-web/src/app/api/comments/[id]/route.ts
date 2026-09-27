import { api, forbidden, json, notFound } from '@/server/http';
import { queryOne } from '@/server/baseDatos';
import { requireAuth } from '@/server/autenticacion';

// DELETE /api/comments/:id  — borrado lógico (dueño del evento o autor)
export const DELETE = api<{ id: string }>(async (req, { params }) => {
  const user = await requireAuth(req);
  const c = await queryOne<{ id: string; user_id: string; owner_id: string }>(
    `SELECT c.id, c.user_id, e.owner_id FROM comentarios c
       JOIN publicaciones p ON p.id = c.post_id JOIN eventos e ON e.id = p.event_id
      WHERE c.id = $1 AND c.deleted_at IS NULL`, [params.id]
  );
  if (!c) throw notFound('Comentario');
  if (c.owner_id !== user.id && c.user_id !== user.id) throw forbidden();
  await queryOne('UPDATE comentarios SET deleted_at = now() WHERE id = $1', [c.id]);
  return json({ deleted: true });
});
