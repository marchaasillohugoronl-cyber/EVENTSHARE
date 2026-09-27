import assert from 'node:assert/strict';
import { test } from 'node:test';
import QRCode from 'qrcode';
import jsQR from 'jsqr';
import { codigoDesdeQr } from '../src/lib/qr';

const origin = 'https://eventshare-fawn.vercel.app';
test('acepta códigos y enlaces de eventos del sitio', () => {
  assert.equal(codigoDesdeQr(' abc123 ', origin), 'ABC123');
  assert.equal(codigoDesdeQr(`${origin}/e/ABC123`, origin), 'ABC123');
  assert.equal(codigoDesdeQr('/e/abc123/', origin), 'ABC123');
});
test('rechaza otros sitios, rutas y códigos inválidos', () => {
  for (const value of ['https://example.com/e/ABC123', '//example.com/e/ABC123', 'javascript:alert(1)', `${origin}/login`, '/e/ABC123/photos', 'abc', 'a'.repeat(13)]) {
    assert.equal(codigoDesdeQr(value, origin), null, value);
  }
});
test('decodifica una imagen QR con el enlace publicado', () => {
  const qr = QRCode.create(`${origin}/e/ABC123`);
  const scale = 6;
  const margin = 4;
  const width = (qr.modules.size + margin * 2) * scale;
  const pixels = new Uint8ClampedArray(width * width * 4).fill(255);
  for (let y = 0; y < width; y++) {
    for (let x = 0; x < width; x++) {
      const row = Math.floor(y / scale) - margin;
      const col = Math.floor(x / scale) - margin;
      if (row >= 0 && col >= 0 && row < qr.modules.size && col < qr.modules.size && qr.modules.get(row, col)) {
        const offset = (y * width + x) * 4;
        pixels[offset] = pixels[offset + 1] = pixels[offset + 2] = 0;
      }
    }
  }
  const result = jsQR(pixels, width, width);
  assert.ok(result);
  assert.equal(codigoDesdeQr(result.data, origin), 'ABC123');
});
