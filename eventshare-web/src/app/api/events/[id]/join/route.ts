import { api, json } from '@/server/http';
import { requireAuth } from '@/server/autenticacion';
import { assertActive, ensureMember, requireEvent } from '@/server/eventos';

// POST /api/events/:id/join  — registra al usuario autenticado como participante
export const POST = api<{ id: string }>(async (req, { params }) => {
  const user = await requireAuth(req);
  const ev = await requireEvent(params.id);
  assertActive(ev);
  await ensureMember(ev.id, user.id);
  return json({ joined: true });
});
