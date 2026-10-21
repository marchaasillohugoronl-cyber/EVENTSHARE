import assert from 'node:assert/strict';
import { test } from 'node:test';
import { grabarVideo } from '../src/lib/grabarVideo';

test('grabación limitada: corte automático, cancelación y errores', async t => {
  const original = globalThis.MediaRecorder;
  let latest: FakeRecorder;
  class FakeRecorder {
    static isTypeSupported(type: string) { return type.startsWith('video/webm'); }
    state = 'inactive';
    ondataavailable?: (event: { data: Blob }) => void;
    onstop?: () => void;
    onerror?: () => void;
    constructor() { latest = this; }
    start() { this.state = 'recording'; }
    stop() {
      assert.equal(this.state, 'recording');
      this.state = 'inactive';
      // El último bloque llega después de solicitar stop.
      queueMicrotask(() => {
        this.ondataavailable?.({ data: new Blob(['ultimo-bloque']) });
        this.onstop?.();
      });
    }
  }
  globalThis.MediaRecorder = FakeRecorder as unknown as typeof MediaRecorder;
  t.after(() => { globalThis.MediaRecorder = original; });
  const stream = () => {
    let stopped = false;
    return {
      media: { getTracks: () => [{ stop() { stopped = true; } }] } as unknown as MediaStream,
      stopped: () => stopped,
    };
  };

  await t.test('se detiene a los 10 segundos y conserva el último bloque', async t => {
    t.mock.timers.enable({ apis: ['setTimeout', 'setInterval'] });
    const source = stream();
    const files: File[] = [];
    grabarVideo(source.media, { onTime() {}, onComplete: file => files.push(file), onError: assert.fail });
    t.mock.timers.tick(9999);
    assert.equal(latest.state, 'recording');
    t.mock.timers.tick(1);
    assert.equal(latest.state, 'inactive');
    assert.equal(source.stopped(), true);
    await Promise.resolve();
    assert.equal(files.length, 1);
    assert.equal(files[0].type, 'video/webm');
    assert.equal(await files[0].text(), 'ultimo-bloque');
  });

  await t.test('cancelar libera la cámara y descarta el archivo', async () => {
    const source = stream();
    let completed = false;
    const session = grabarVideo(source.media, { onTime() {}, onComplete() { completed = true; }, onError: assert.fail });
    session.dispose();
    await Promise.resolve();
    assert.equal(source.stopped(), true);
    assert.equal(completed, false);
  });

  await t.test('detener manualmente entrega una sola grabación', async () => {
    const source = stream();
    let completed = 0;
    const session = grabarVideo(source.media, { onTime() {}, onComplete() { completed++; }, onError: assert.fail });
    session.stop();
    session.stop();
    await Promise.resolve();
    assert.equal(completed, 1);
    assert.equal(source.stopped(), true);
  });

  await t.test('un error del grabador no publica un archivo incompleto', async () => {
    const source = stream();
    let errors = 0;
    grabarVideo(source.media, { onTime() {}, onComplete() { assert.fail('No debe entregar un archivo'); }, onError() { errors++; } });
    latest.onerror?.();
    await Promise.resolve();
    assert.equal(errors, 1);
    assert.equal(source.stopped(), true);
  });

  await t.test('rechaza grabaciones que superan el límite de tamaño', async () => {
    const source = stream();
    let message = '';
    grabarVideo(source.media, { onTime() {}, onComplete() { assert.fail('Archivo demasiado grande'); }, onError(error) { message = error.message; } });
    latest.ondataavailable?.({ data: { size: 50 * 1024 * 1024 + 1 } as Blob });
    await Promise.resolve();
    assert.match(message, /50 MB/);
    assert.equal(source.stopped(), true);
  });
});
