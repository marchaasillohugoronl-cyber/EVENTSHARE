import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import dotenv from 'dotenv';
import { presignUpload, publicUrl, verifyUploadedImage, verifyUploadedMedia, deleteObject } from '../src/server/almacenamiento';
import { env } from '../src/server/entorno';

dotenv.config({ path: '.env.local' });
const key = () => `covers/${randomUUID()}/${randomUUID()}.png`;

test('rechaza rutas ajenas y archivos no permitidos antes de acceder a Cloudinary', async () => {
  assert.throws(() => publicUrl('covers/../otro.png'));
  await assert.rejects(presignUpload(key(), 'image/svg+xml', 10));
  await assert.rejects(presignUpload(key(), 'image/png', 11 * 1024 * 1024));
});

test('elimina originales demasiado grandes y no borra ante errores del proveedor', async (t) => {
  t.mock.getter(env, 'cloudinaryCloudName', () => 'prueba');
  t.mock.getter(env, 'cloudinaryApiKey', () => 'prueba');
  t.mock.getter(env, 'cloudinaryApiSecret', () => 'prueba');
  const photoKey = key();
  const calls: string[] = [];
  const mock = t.mock.method(globalThis, 'fetch', async (url: string | URL | Request) => {
    calls.push(String(url));
    return Response.json(calls.length === 1
      ? { public_id: photoKey.replace(/\.png$/, ''), resource_type: 'image', type: 'upload', format: 'png', bytes: 11 * 1024 * 1024 }
      : { result: 'ok' });
  });
  await assert.rejects(verifyUploadedImage(photoKey), { code: 'INVALID_UPLOAD' });
  assert.equal(calls.length, 2);
  assert.ok(calls[1].endsWith('/image/destroy'));
  mock.mock.mockImplementation(async () => new Response(null, { status: 429 }));
  await assert.rejects(verifyUploadedImage(photoKey), { code: 'STORAGE_ERROR' });
  assert.equal(mock.mock.callCount(), 3);
});

test('subida firmada, lectura, verificacion y borrado reales', { skip: process.env.TEST_CLOUDINARY !== '1' }, async () => {
  const photoKey = key();
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=', 'base64');
  const upload = await presignUpload(photoKey, 'image/png', png.length);
  assert.equal(upload.fields.overwrite, 'false');
  assert.ok(!Object.values(upload.fields).includes(process.env.CLOUDINARY_API_SECRET!));
  const form = new FormData();
  Object.entries(upload.fields).forEach(([k, v]) => form.append(k, v));
  form.append('file', new Blob([png], { type: 'image/png' }), 'prueba.png');
  try {
    const response = await fetch(upload.uploadUrl, { method: 'POST', body: form, signal: AbortSignal.timeout(30000) });
    assert.equal(response.status, 200, `Cloudinary respondio HTTP ${response.status}`);
    await verifyUploadedImage(photoKey);
    const image = await fetch(publicUrl(photoKey), { signal: AbortSignal.timeout(15000) });
    assert.equal(image.status, 200);
    assert.ok(image.headers.get('content-type')?.startsWith('image/'));
    assert.ok((await image.arrayBuffer()).byteLength > 0);
  } finally {
    await deleteObject(photoKey);
  }
  await assert.rejects(verifyUploadedImage(photoKey), { code: 'UPLOAD_NOT_FOUND' });
});


test('videos: firma y URL de video, límite de duración y borrado del original inválido', async (t) => {
  t.mock.getter(env, 'cloudinaryCloudName', () => 'prueba');
  t.mock.getter(env, 'cloudinaryApiKey', () => 'prueba');
  t.mock.getter(env, 'cloudinaryApiSecret', () => 'prueba');
  const videoKey = `events/${randomUUID()}/${randomUUID()}/${randomUUID()}.mp4`;
  const signed = await presignUpload(videoKey, 'video/mp4', 1024);
  assert.ok(signed.uploadUrl.endsWith('/video/upload'));
  assert.ok(publicUrl(videoKey).includes('/video/upload/'));
  await assert.rejects(presignUpload(videoKey, 'video/mp4', 50 * 1024 * 1024 + 1));
  await assert.rejects(presignUpload(key().replace('.png', '.mp4'), 'video/mp4', 1024));
  await assert.rejects(verifyUploadedImage(videoKey));
  let duration: unknown = 10;
  const calls: string[] = [];
  t.mock.method(globalThis, 'fetch', async (url: string | URL | Request) => {
    calls.push(String(url));
    if (String(url).endsWith('/destroy')) return Response.json({ result: 'ok' });
    return Response.json({ public_id: videoKey.replace(/\.mp4$/, ''), resource_type: 'video', type: 'upload', format: 'mp4', bytes: 1024, duration });
  });
  await verifyUploadedMedia(videoKey);
  assert.equal(calls.length, 1);
  for (const value of [10.01, 0, null, '10']) {
    duration = value;
    await assert.rejects(verifyUploadedMedia(videoKey), { code: 'INVALID_UPLOAD' });
    assert.ok(calls.at(-1)?.endsWith('/video/destroy'));
  }
});
