import crypto from 'node:crypto';
import { api, json, parse } from '@/server/http';
import { mediaUploadSchema, ALLOWED_IMAGE_TYPES, ALLOWED_VIDEO_TYPES, MAX_PHOTO_BYTES, MAX_VIDEO_BYTES } from '@/server/validacion';
import { requireAuth } from '@/server/autenticacion';
import { assertActive, ensureMember, requireEvent } from '@/server/eventos';
import { presignUpload, publicUrl } from '@/server/almacenamiento';
import { rateLimit } from '@/server/limiteSolicitudes';

// POST /api/events/:id/uploads  — { contentType, size } -> URL prefirmada para subir la foto directo al storage
export const POST = api<{ id: string }>(async (req, { params }) => {
  const user = await requireAuth(req);
  await rateLimit(`upload:${user.id}`, 20, 600);
  const ev = await requireEvent(params.id);
  assertActive(ev);
  await ensureMember(ev.id, user.id);
  const b = await parse(req, mediaUploadSchema);
  const key = `events/${ev.id}/${user.id}/${crypto.randomUUID()}.${{ ...ALLOWED_IMAGE_TYPES, ...ALLOWED_VIDEO_TYPES }[b.contentType]}`;
  const upload = await presignUpload(key, b.contentType, b.size);
  return json({ ...upload, key, publicUrl: publicUrl(key), maxBytes: b.contentType.startsWith('video/') ? MAX_VIDEO_BYTES : MAX_PHOTO_BYTES });
});
