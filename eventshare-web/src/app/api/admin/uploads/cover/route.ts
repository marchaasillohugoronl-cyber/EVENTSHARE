import crypto from 'node:crypto';
import { api, json, parse } from '@/server/http';
import { uploadSchema, ALLOWED_IMAGE_TYPES } from '@/server/validacion';
import { requireAdmin } from '@/server/autenticacion';
import { presignUpload, publicUrl } from '@/server/almacenamiento';
import { rateLimit } from '@/server/limiteSolicitudes';

// POST /api/admin/uploads/cover  — { contentType, size } URL prefirmada para la portada de un evento
export const POST = api(async (req) => {
  const admin = await requireAdmin(req);
  await rateLimit(`cover:${admin.id}`, 20, 600);
  const b = await parse(req, uploadSchema);
  const key = `covers/${admin.id}/${crypto.randomUUID()}.${ALLOWED_IMAGE_TYPES[b.contentType]}`;
  const upload = await presignUpload(key, b.contentType, b.size);
  return json({ ...upload, key, publicUrl: publicUrl(key) });
});
