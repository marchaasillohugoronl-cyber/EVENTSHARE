import { api, ApiError, forbidden, json, parse } from '@/server/http';
import { eventCreateSchema } from '@/server/validacion';
import { queryOne, isUniqueViolation } from '@/server/baseDatos';
import { requireAdmin } from '@/server/autenticacion';
import { generateEventCode, toEvent, EventRow } from '@/server/eventos';
import { publicUrl, verifyUploadedImage } from '@/server/almacenamiento';

// POST /api/events  — crea un evento (ADMIN)
export const POST = api(async (req) => {
  const admin = await requireAdmin(req);
  const b = await parse(req, eventCreateSchema);
  if (b.coverKey && !b.coverKey.startsWith(`covers/${admin.id}/`)) throw forbidden('Portada inválida');
  if (b.coverKey) await verifyUploadedImage(b.coverKey);

  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const row = await queryOne<EventRow>(
        `INSERT INTO eventos (owner_id, name, description, cover_image_url, primary_color, event_code, event_date, moderation_enabled)
         VALUES ($1, $2, $3, $4, COALESCE($5, '#1F2937'), $6, $7, COALESCE($8, true)) RETURNING *`,
        [
          admin.id, b.name, b.description || null, b.coverKey ? publicUrl(b.coverKey) : null,
          b.primaryColor ?? null, generateEventCode(), b.eventDate ?? null, b.moderationEnabled ?? null,
        ]
      );
      return json({ event: toEvent(row!) }, 201);
    } catch (e) {
      if (!isUniqueViolation(e)) throw e; // colisión de código: reintenta con otro
    }
  }
  throw new ApiError(500, 'CODE_GENERATION_FAILED', 'No se pudo generar un código único');
});
