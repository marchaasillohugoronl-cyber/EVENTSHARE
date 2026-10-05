import assert from 'node:assert/strict';
import test from 'node:test';
import { mensajeErrorSubida } from '../src/lib/errorSubida';

test('identifica errores de configuración sin revelar claves ni firmas', () => {
  const cases = [
    [401, 'Invalid api_key private-value', 'FOTO_CLAVE'],
    [401, 'Invalid Signature private-value. String to sign private-value', 'FOTO_FIRMA'],
    [400, 'Unknown cloud name private-value', 'FOTO_CUENTA'],
    [400, 'Stale request - timestamp private-value', 'FOTO_CADUCADA'],
  ] as const;
  for (const [status, message, code] of cases) {
    const result = mensajeErrorSubida(status, JSON.stringify({ error: { message } }));
    assert.ok(result.includes(code));
    assert.ok(!result.includes('private-value'));
  }
});
test('maneja respuestas no JSON, límites y formatos inválidos', () => {
  assert.match(mensajeErrorSubida(502, '<html>Error</html>'), /FOTO_HTTP_502/);
  assert.match(mensajeErrorSubida(400, 'null'), /FOTO_HTTP_400/);
  assert.match(mensajeErrorSubida(413, ''), /FOTO_TAMANO/);
  assert.match(mensajeErrorSubida(429, ''), /FOTO_LIMITE/);
  assert.match(mensajeErrorSubida(400, JSON.stringify({ error: { message: 'Invalid image file' } })), /FOTO_FORMATO/);
});
