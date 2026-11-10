// Run against a local build and an existing event URL. Reads the event only;
// photo API responses and camera frames are fixtures, never writes to the database.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { once } from 'node:events';
import { setTimeout as delay } from 'node:timers/promises';
const url = process.env.TV_TEST_URL;
if (!url || !['localhost', '127.0.0.1'].includes(new URL(url).hostname)) throw new Error('Define TV_TEST_URL con una página TV local existente.');
const origin = new URL(url).origin;
const profile = mkdtempSync('/tmp/eventshare-magic-browser-');
const browser = spawn(process.env.CHROMIUM_PATH || 'chromium', ['--headless', '--no-sandbox', '--disable-dev-shm-usage', '--use-fake-device-for-media-stream', '--enable-unsafe-swiftshader', '--remote-debugging-port=9248', `--user-data-dir=${profile}`, 'about:blank'], { stdio: 'ignore' });
let ws, sequence = 0;
const pending = new Map(), errors = [], requests = [];
async function until(fn, label, attempts = 100) { for (let i = 0; i < attempts; i++) { if (await fn()) return; await delay(200); } throw new Error(`Tiempo agotado: ${label}`); }
function cdp(method, params = {}) {
  return new Promise((resolve, reject) => {
    const id = ++sequence, timer = setTimeout(() => { pending.delete(id); reject(new Error(`CDP timeout: ${method}`)); }, 15000);
    pending.set(id, { resolve: result => { clearTimeout(timer); resolve(result); }, reject: error => { clearTimeout(timer); reject(error); } });
    ws.send(JSON.stringify({ id, method, params }));
  });
}
async function evaluate(expression) {
  const r = await cdp('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
  if (r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails));
  return r.result.value;
}
const photo = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300"><rect width="400" height="300" fill="#146ca4"/><circle cx="200" cy="150" r="75" fill="#64e1ef"/></svg>');
const posts = { items: Array.from({ length: 3 }, (_, i) => ({ id: `fixture-${i}`, photoUrl: photo + `#${i}`, author: { id: 'fixture', name: 'Prueba' }, status: 'APPROVED' })), nextCursor: null };
try {
  let target;
  await until(async () => { try { target = (await (await fetch('http://127.0.0.1:9248/json')).json()).find(t => t.type === 'page'); return !!target; } catch { return false; } }, 'Chromium');
  ws = new WebSocket(target.webSocketDebuggerUrl); await once(ws, 'open');
  ws.addEventListener('message', async ({ data }) => {
    const m = JSON.parse(data);
    if (m.id && pending.has(m.id)) { const p = pending.get(m.id); pending.delete(m.id); m.error ? p.reject(new Error(m.error.message)) : p.resolve(m.result); }
    if (m.method === 'Runtime.exceptionThrown') errors.push(m.params.exceptionDetails);
    if (m.method === 'Network.requestWillBeSent') requests.push(m.params.request.url);
    if (m.method === 'Fetch.requestPaused') {
      await cdp('Fetch.fulfillRequest', { requestId: m.params.requestId, responseCode: 200, responseHeaders: [{ name: 'Content-Type', value: 'application/json' }], body: Buffer.from(JSON.stringify(posts)).toString('base64') });
    }
  });
  await cdp('Page.enable'); await cdp('Runtime.enable'); await cdp('Network.enable');
  await cdp('Fetch.enable', { patterns: [{ urlPattern: '*/api/events/*/posts*' }] });
  await cdp('Emulation.setDeviceMetricsOverride', { width: 1920, height: 1080, deviceScaleFactor: 1, mobile: false });
  await cdp('Page.navigate', { url });
  await until(() => evaluate(`!!document.querySelector('.magic-touch-toggle:not(:disabled)')`), 'TV con fotos');
  assert.equal(await evaluate(`!!document.querySelector('.photo-letter')`), false, 'no anuncia fotos iniciales');
  const incoming = id => ({ ...posts.items[0], id, author: { id: 'guest', name: 'Invitada de prueba' } });
  posts.items.unshift(incoming('arrival-2'), incoming('arrival-1'));
  await until(() => evaluate(`!!document.querySelector('.photo-letter--ready')`), 'llegada de foto');
  assert.match(await evaluate(`document.querySelector('.photo-letter-card figcaption').textContent`), /Invitada de prueba/);
  await delay(2800);
  await cdp('Page.captureScreenshot', { format: 'png' }).then(r => writeFileSync('/tmp/eventshare-carta-apertura.png', Buffer.from(r.data, 'base64')));
  await delay(1500);
  assert.equal(await evaluate(`getComputedStyle(document.querySelector('.photo-letter-card')).opacity`), '1');
  await cdp('Page.captureScreenshot', { format: 'png' }).then(r => writeFileSync('/tmp/eventshare-carta-foto.png', Buffer.from(r.data, 'base64')));
  await evaluate(`document.querySelector('.photo-letter-close').click()`);
  await until(() => evaluate(`!!document.querySelector('.photo-letter--ready')`), 'segunda foto en cola');
  await cdp('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
  assert.equal(await evaluate(`getComputedStyle(document.querySelector('.photo-letter-card')).animationName`), 'none', 'respeta movimiento reducido');
  assert.equal(await evaluate(`getComputedStyle(document.querySelector('.photo-letter-card')).opacity`), '1');
  await cdp('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  await delay(300);
  assert.equal(await evaluate(`document.documentElement.scrollWidth <= innerWidth`), true);
  await cdp('Page.captureScreenshot', { format: 'png' }).then(r => writeFileSync('/tmp/eventshare-carta-movil.png', Buffer.from(r.data, 'base64')));
  await until(() => evaluate(`!document.querySelector('.photo-letter')`), 'carta cierra automáticamente');
  await delay(8500);
  assert.equal(await evaluate(`!!document.querySelector('.photo-letter')`), false, 'sondeos no repiten la presentación');
  assert.deepEqual(errors, []);
  console.log('OK: colección inicial, llegada, carta animada, cola, cierre manual y automático, movimiento reducido y pantalla móvil.');
} finally {
  ws?.close();
  if (browser.exitCode === null) { const exited = once(browser, 'exit'); browser.kill('SIGTERM'); await Promise.race([exited, delay(3000)]); if (browser.exitCode === null) browser.kill('SIGKILL'); }
}
