import { api, forbidden, json, parse } from '@/server/http';
import { eventUpdateSchema } from '@/server/validacion';
import { query, queryOne } from '@/server/baseDatos';
import { getAuth, requireAdmin } from '@/server/autenticacion';
import { assertReadable, findEvent, requireEvent, requireOwnedEvent, toEvent, EventRow } from '@/server/eventos';
import { publicUrl, verifyUploadedImage } from '@/server/almacenamiento';

// GET /api/events/:codeOrId  — datos públicos del evento (por código del QR o por id)
export const GET = api<{ id: string }>(async (req, { params }) => {
  const ev = await requireEvent(params.id);
  const viewer = await getAuth(req);
  assertReadable(ev, viewer);
  let member = null;
  if (viewer) {
    member = await queryOne<{ is_blocked: boolean }>(
      'SELECT is_blocked FROM miembros_evento WHERE event_id = $1 AND user_id = $2', [ev.id, viewer.id]
    );
  }
  return json({
    event: toEvent(ev),
    viewer: viewer ? { isMember: !!member, isBlocked: !!member?.is_blocked, isOwner: viewer.id === ev.owner_id } : null,
  });
});

// PATCH /api/events/:id  — edita, cierra o archiva (ADMIN dueño)
export const PATCH = api<{ id: string }>(async (req, { params }) => {
  const admin = await requireAdmin(req);
  const ev = await requireOwnedEvent(params.id, admin);
  const b = await parse(req, eventUpdateSchema);

  const sets: string[] = [];
  const vals: unknown[] = [];
  const add = (col: string, v: unknown) => { vals.push(v); sets.push(`${col} = $${vals.length}`); };
  if (b.name !== undefined) add('name', b.name);
  if (b.description !== undefined) add('description', b.description || null);
  if (b.eventDate !== undefined) add('event_date', b.eventDate);
  if (b.primaryColor !== undefined) add('primary_color', b.primaryColor);
  if (b.moderationEnabled !== undefined) add('moderation_enabled', b.moderationEnabled);
  if (b.status !== undefined) add('status', b.status);
  if (b.coverKey !== undefined) {
    if (b.coverKey && !b.coverKey.startsWith(`covers/${admin.id}/`)) throw forbidden('Portada inválida');
    if (b.coverKey) await verifyUploadedImage(b.coverKey);
    add('cover_image_url', b.coverKey ? publicUrl(b.coverKey) : null);
  }
  if (!sets.length) return json({ event: toEvent(ev) });
  vals.push(ev.id);
  const [row] = await query<EventRow>(`UPDATE eventos SET ${sets.join(', ')} WHERE id = $${vals.length} RETURNING *`, vals);
  return json({ event: toEvent(row) });
});
