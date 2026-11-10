import { z } from 'zod';
import { api, ApiError, notFound } from '@/server/http';
import { getAuth } from '@/server/autenticacion';
import { queryOne } from '@/server/baseDatos';
import { assertReadable, requireEvent } from '@/server/eventos';
import { publicUrl } from '@/server/almacenamiento';

export const GET = api<{ id: string }>(async (req, { params }) => {
  const id = z.string().uuid().parse(params.id);
  const viewer = await getAuth(req);
  const post = await queryOne<{ event_id: string; status: string; photo_key: string | null }>(
    'SELECT event_id, status, photo_key FROM publicaciones WHERE id = $1 AND deleted_at IS NULL', [id]
  );
  if (!post?.photo_key || !/\.(jpg|png|webp)$/.test(post.photo_key)) throw notFound('Foto');
  const event = await requireEvent(post.event_id);
  assertReadable(event, viewer);
  if (post.status !== 'APPROVED' && viewer?.id !== event.owner_id) throw notFound('Foto');

  // La URL se construye desde la clave validada del almacenamiento, nunca desde el navegador.
  let response: Response;
  try {
    response = await fetch(publicUrl(post.photo_key), { cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(20000) });
  } catch { throw new ApiError(502, 'DOWNLOAD_FAILED', 'No se pudo descargar la foto. Inténtalo de nuevo.'); }
  if (!response.ok || !response.body) throw new ApiError(502, 'DOWNLOAD_FAILED', 'La foto no está disponible para descargar. Inténtalo de nuevo.');
  const extension = post.photo_key.split('.').pop()!;
  const types: Record<string, string> = { jpg: 'image/jpeg', png: 'image/png', webp: 'image/webp' };
  return new Response(response.body, { headers: {
    'Content-Type': types[extension],
    'Content-Disposition': `attachment; filename="eventshare-${id}.${extension}"`,
    'Cache-Control': 'private, no-store',
    'X-Content-Type-Options': 'nosniff',
  } });
});
