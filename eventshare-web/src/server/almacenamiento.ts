import { createHash } from 'node:crypto';
import { env } from './entorno';
import { ApiError } from './http';
import { ALLOWED_IMAGE_TYPES, ALLOWED_VIDEO_TYPES, MAX_PHOTO_BYTES, MAX_VIDEO_BYTES, MAX_VIDEO_SECONDS } from './validacion';

function publicId(key: string): string {
  if (!/^(?:events\/[a-f0-9-]{36}\/[a-f0-9-]{36}|covers\/[a-f0-9-]{36})\/[a-f0-9-]{36}\.(jpg|png|webp|mp4|webm|mov)$/.test(key)) {
    throw new ApiError(400, 'INVALID_UPLOAD', 'Referencia de imagen no valida');
  }
  return key.replace(/\.(jpg|png|webp|mp4|webm|mov)$/, '');
}

const isVideo = (key: string) => /\.(mp4|webm|mov)$/.test(key);
const resourceType = (key: string) => isVideo(key) ? 'video' : 'image';

const apiBase = () => `https://api.cloudinary.com/v1_1/${encodeURIComponent(env.cloudinaryCloudName)}`;

function signedFields(params: Record<string, string>): Record<string, string> {
  // Cloudinary firma los parametros ordenados, sin file ni api_key.
  const values = { ...params, timestamp: String(Math.floor(Date.now() / 1000)) };
  const serialized = Object.entries(values).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => `${k}=${v}`).join('&');
  const signature = createHash('sha256').update(serialized + env.cloudinaryApiSecret).digest('hex');
  return { ...values, api_key: env.cloudinaryApiKey, signature };
}

export function publicUrl(key: string): string {
  publicId(key);
  return `https://res.cloudinary.com/${encodeURIComponent(env.cloudinaryCloudName)}/${resourceType(key)}/upload/${key}`;
}

export async function presignUpload(key: string, contentType: string, size: number) {
  if (!(contentType in (isVideo(key) ? ALLOWED_VIDEO_TYPES : ALLOWED_IMAGE_TYPES)) || (isVideo(key) && !key.startsWith('events/')) || !Number.isInteger(size) || size <= 0 || size > (isVideo(key) ? MAX_VIDEO_BYTES : MAX_PHOTO_BYTES)) {
    throw new ApiError(400, 'INVALID_UPLOAD', 'Tipo o tamano de imagen no permitido');
  }
  return {
    uploadUrl: `${apiBase()}/${resourceType(key)}/upload`,
    method: 'POST' as const,
    fields: signedFields({ public_id: publicId(key), overwrite: 'false', allowed_formats: isVideo(key) ? 'mp4,webm,mov' : 'jpg,png,webp' }),
    expiresIn: 3600,
  };
}

export async function deleteObject(key: string): Promise<void> {
  const response = await fetch(`${apiBase()}/${resourceType(key)}/destroy`, {
    method: 'POST',
    body: new URLSearchParams(signedFields({ public_id: publicId(key), invalidate: 'true' })),
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) throw new ApiError(502, 'STORAGE_ERROR', 'No se pudo borrar la imagen de Cloudinary');
  const data = await response.json();
  if (!['ok', 'not found'].includes(data.result)) throw new ApiError(502, 'STORAGE_ERROR', 'Cloudinary no confirmo el borrado');
}

/** Consulta el original en el servidor: no confia en los datos del navegador. */
export async function verifyUploadedImage(key: string): Promise<void> {
  if (isVideo(key)) throw new ApiError(400, 'INVALID_UPLOAD', 'Se requiere una imagen');
  return verifyUploadedMedia(key);
}

export async function verifyUploadedMedia(key: string): Promise<void> {
  const id = publicId(key);
  const video = isVideo(key);
  if (video && !key.startsWith('events/')) throw new ApiError(400, 'INVALID_UPLOAD', 'Referencia de video no válida');
  const response = await fetch(`${apiBase()}/resources/${resourceType(key)}/upload/${encodeURIComponent(id)}`, {
    headers: { Authorization: `Basic ${Buffer.from(`${env.cloudinaryApiKey}:${env.cloudinaryApiSecret}`).toString('base64')}` },
    cache: 'no-store',
    signal: AbortSignal.timeout(15000),
  });
  if (response.status === 404) throw new ApiError(400, 'UPLOAD_NOT_FOUND', 'La foto no se subio correctamente. Intentalo de nuevo.');
  if (!response.ok) throw new ApiError(502, 'STORAGE_ERROR', 'No se pudo verificar la imagen en Cloudinary');
  const asset = await response.json();
  if (asset.public_id !== id || asset.resource_type !== resourceType(key) || asset.type !== 'upload') {
    throw new ApiError(400, 'INVALID_UPLOAD', 'Referencia de imagen no valida');
  }
  if (!(video ? ['mp4', 'webm', 'mov'] : ['jpg', 'png', 'webp']).includes(asset.format) || !Number.isInteger(asset.bytes) || asset.bytes <= 0 || asset.bytes > (video ? MAX_VIDEO_BYTES : MAX_PHOTO_BYTES) || (video && (!Number.isFinite(asset.duration) || asset.duration <= 0 || asset.duration > MAX_VIDEO_SECONDS))) {
    await deleteObject(key);
    throw new ApiError(400, 'INVALID_UPLOAD', video ? 'El video debe ser MP4, WebM o MOV, durar hasta 10 segundos y pesar como máximo 50 MB' : 'La imagen debe ser JPG, PNG o WebP y pesar como maximo 10 MB');
  }
}
