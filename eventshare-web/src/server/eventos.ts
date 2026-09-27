import crypto from 'node:crypto';
import { cache } from 'react';
import { query, queryOne } from './baseDatos';
import { env } from './entorno';
import { ApiError, forbidden, notFound } from './http';
import { AuthUser } from './autenticacion';

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // sin 0/O/1/I para evitar confusiones al teclear
export function generateEventCode(len = 8): string {
  let out = '';
  for (let i = 0; i < len; i++) out += CODE_ALPHABET[crypto.randomInt(CODE_ALPHABET.length)];
  return out;
}

export const eventUrl = (code: string) => `${env.appUrl}/e/${code}`;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type EventRow = {
  id: string; owner_id: string; name: string; description: string | null; cover_image_url: string | null;
  primary_color: string; event_code: string; event_date: Date | null; status: 'ACTIVE' | 'CLOSED' | 'ARCHIVED';
  moderation_enabled: boolean; created_at: Date;
};

export function toEvent(e: EventRow) {
  return {
    id: e.id,
    code: e.event_code,
    name: e.name,
    description: e.description,
    coverImageUrl: e.cover_image_url,
    primaryColor: e.primary_color,
    eventDate: e.event_date,
    status: e.status,
    moderationEnabled: e.moderation_enabled,
    url: eventUrl(e.event_code),
    createdAt: e.created_at,
  };
}
export type PublicEvent = ReturnType<typeof toEvent>;

/** Busca por UUID o por código de evento. */
export async function findEvent(key: string): Promise<EventRow | null> {
  if (UUID_RE.test(key)) return queryOne<EventRow>('SELECT * FROM eventos WHERE id = $1', [key]);
  return queryOne<EventRow>('SELECT * FROM eventos WHERE event_code = $1', [key.toUpperCase()]);
}

export const getEventByCodeCached = cache(async (code: string) => {
  const row = await queryOne<EventRow>('SELECT * FROM eventos WHERE event_code = $1', [code.toUpperCase()]);
  return row ? toEvent(row) : null;
});

export async function requireEvent(key: string): Promise<EventRow> {
  const e = await findEvent(key);
  if (!e) throw notFound('Evento');
  return e;
}

/** Evento que pertenece al administrador (404 si no es suyo, para no filtrar existencia). */
export async function requireOwnedEvent(eventId: string, admin: AuthUser): Promise<EventRow> {
  const e = await queryOne<EventRow>('SELECT * FROM eventos WHERE id = $1 AND owner_id = $2', [eventId, admin.id]);
  if (!e) throw notFound('Evento');
  return e;
}

/** Registra al usuario como miembro (idempotente). Lanza 403 si está bloqueado en este evento. */
export async function ensureMember(eventId: string, userId: string): Promise<void> {
  const row = await queryOne<{ is_blocked: boolean }>(
    `INSERT INTO miembros_evento (event_id, user_id) VALUES ($1, $2)
     ON CONFLICT (event_id, user_id) DO UPDATE SET event_id = EXCLUDED.event_id
     RETURNING is_blocked`,
    [eventId, userId]
  );
  if (row?.is_blocked) throw new ApiError(403, 'BLOCKED', 'Fuiste bloqueado en este evento');
}

export function assertActive(e: EventRow) {
  if (e.status === 'ARCHIVED') throw new ApiError(403, 'EVENT_ARCHIVED', 'Este álbum ya no está disponible');
  if (e.status === 'CLOSED') throw new ApiError(403, 'EVENT_CLOSED', 'El evento está cerrado y ya no acepta publicaciones');
}

export function assertReadable(e: EventRow, viewer: AuthUser | null) {
  if (e.status === 'ARCHIVED' && viewer?.id !== e.owner_id) throw forbidden('Este álbum ya no está disponible');
}

export async function listOwnedEvents(adminId: string) {
  return query<any>(
    `SELECT e.*,
       (SELECT count(*) FROM publicaciones p WHERE p.event_id = e.id AND p.deleted_at IS NULL AND p.photo_url IS NOT NULL AND p.status = 'APPROVED')::int AS photos_count,
       (SELECT count(*) FROM publicaciones p WHERE p.event_id = e.id AND p.deleted_at IS NULL AND p.status = 'PENDING')::int AS pending_count,
       (SELECT count(*) FROM miembros_evento m WHERE m.event_id = e.id)::int AS guests_count
     FROM eventos e WHERE e.owner_id = $1 ORDER BY e.created_at DESC`,
    [adminId]
  );
}
