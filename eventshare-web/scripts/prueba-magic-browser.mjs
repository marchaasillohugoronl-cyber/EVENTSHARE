// Run against a local build and an existing event URL. Reads the event only;
// photo API responses and camera frames are fixtures, never writes to the database.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { once } from 'node:events';
import { setTimeout as delay } from 'node:timers/promises';
const url = process.env.MAGIC_TEST_URL;
if (!url || !['localhost', '127.0.0.1'].includes(new URL(url).hostname)) throw new Error('Define MAGIC_TEST_URL con una página TV local existente.');
const origin = new URL(url).origin;
const profile = mkdtempSync('/tmp/eventshare-magic-browser-');
const browser = spawn(process.env.CHROMIUM_PATH || 'chromium', ['--headless', '--no-sandbox', '--disable-dev-shm-usage', '--use-fake-device-for-media-stream', '--enable-unsafe-swiftshader', '--remote-debugging-port=9247', `--user-data-dir=${profile}`, 'about:blank'], { stdio: 'ignore' });
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
  await until(async () => { try { target = (await (await fetch('http://127.0.0.1:9247/json')).json()).find(t => t.type === 'page'); return !!target; } catch { return false; } }, 'Chromium');
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
  await cdp('Page.addScriptToEvaluateOnNewDocument', { source: `
    window.__streams = []; window.__workers = []; window.__mockFrames = false;
    const getUserMedia = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
    navigator.mediaDevices.getUserMedia = async options => { const stream = await getUserMedia(options); window.__streams.push(stream); if(window.__delayMedia) await new Promise(r=>setTimeout(r,500)); return stream; };
    const NativeWorker = window.Worker;
    window.Worker = class extends NativeWorker { constructor(...args) { super(...args); window.__workers.push(this); this.addEventListener('message', event => { if (window.__mockFrames) event.stopImmediatePropagation(); }); } };
  ` });
  await cdp('Browser.setPermission', { permission: { name: 'camera' }, setting: 'denied', origin });
  await cdp('Page.navigate', { url });
  await until(() => evaluate(`!!document.querySelector('.magic-touch-toggle:not(:disabled)')`), 'TV con fotos');
  await evaluate(`document.querySelector('.magic-touch-toggle').click()`);
  await until(() => evaluate(`document.querySelector('.gesture-error')?.textContent.includes('denegado')`), 'permiso denegado explicado');
  assert.equal(await evaluate(`window.__streams.length`), 0);
  await evaluate(`document.querySelector('.magic-touch-toggle').click()`);
  await cdp('Browser.setPermission', { permission: { name: 'camera' }, setting: 'granted', origin });
  await evaluate(`document.querySelector('.magic-touch-toggle').click()`);
  await until(() => evaluate(`document.querySelector('.gesture-camera')?.textContent.includes('procesamiento local')`), 'modelo real y cámara simulada activos', 300);
  await delay(1000);
  assert.equal(await evaluate(`!!document.querySelector('.gesture-error')`), false, 'inferencia real sin errores');
  const captureRequests = requests.slice();
  assert.ok(captureRequests.some(r => r.endsWith('/magic-touch/hand-tracking.worker.js')));
  assert.equal(captureRequests.some(r => /googleapis.com|jsdelivr.net/.test(r)), false, 'sin CDN en tiempo de ejecución');
  // Deliver synthetic landmarks through the worker boundary to exercise the real UI/recognizer.
  await evaluate(`window.__mockFrames = true; window.__time = performance.now(); window.__shape = (gesture, x = .5, y = .4) => {
    const points = Array.from({length:21}, () => ({x:.5,y:.9}));
    points[1]={x:.4,y:.78}; points[2]={x:.32,y:.7}; points[3]={x:.26,y:.6}; points[4]={x:.15,y:.5};
    [5,9,13,17].forEach((base,i)=>{const xx=.35+i*.1;const straight=gesture==='palm'||i===0&&(gesture==='draw'||gesture==='pinch');points[base]={x:xx,y:.65};points[base+1]={x:xx,y:.51};points[base+2]={x:straight?xx:xx+.03,y:straight?.4:.62};points[base+3]={x:xx,y:straight?.29:.74};});
    if(gesture==='pinch')points[4]={x:points[8].x+.025,y:points[8].y};
    const dx=1-x-points[8].x, dy=y-points[8].y;
    return {landmarks:points.map(p=>({x:p.x+dx,y:p.y+dy})),confidence:.99,side:'Left'};
  }; window.__inject=async (gesture,x=.5,y=.4)=>{const shape=window.__shape(gesture,x,y);
    for(let i=0;i<7;i++){window.__time+=100;window.__workers.at(-1).onmessage({data:{type:'result',timestamp:window.__time,hands:[shape,...(window.__second?[window.__second]:[])]}});await new Promise(r=>setTimeout(r,20));}
  }`);
  const center = await evaluate(`(() => {const r=document.querySelector('[data-magic-tile="9"]').getBoundingClientRect();return {x:(r.x+r.width/2)/innerWidth,y:(r.y+r.height/2)/innerHeight};})()`);
  await evaluate(`window.__inject('pinch',${center.x},${center.y})`);
  assert.equal(await evaluate(`!!document.querySelector('.collage-tile--selected')`), true, 'pellizco selecciona');
  const before = await evaluate(`document.querySelector('.collage-tile--selected').getAttribute('transform')`);
  await evaluate(`window.__inject('pinch',${center.x + .06},${center.y + .04})`);
  assert.notEqual(await evaluate(`document.querySelector('.collage-tile--selected').getAttribute('transform')`), before, 'arrastra la pieza SVG');
  await evaluate(`window.__second={...window.__shape('pinch',.8,.3),side:'Right'};window.__second.landmarks[4].x+=.05;window.__inject('pinch',${center.x + .06},${center.y + .04})`);
  const scaleBefore = await evaluate(`document.querySelector('.collage-tile--selected').getAttribute('transform')`);
  await evaluate(`window.__second.landmarks[4].x+=.15;window.__inject('pinch',${center.x + .06},${center.y + .04})`);
  assert.notEqual(await evaluate(`document.querySelector('.collage-tile--selected').getAttribute('transform')`), scaleBefore, 'segunda mano amplía');
  assert.match(await evaluate(`document.querySelector('.gesture-hud').textContent`), /Ampliar/);
  await evaluate(`window.__second=null`);
  await evaluate(`window.__inject('draw',.5,.4)`);
  await evaluate(`window.__inject('draw',.55,.45)`);
  const pixelCount = `(() => {const c=document.querySelector('.gesture-canvas');const p=c.getContext('2d').getImageData(0,0,c.width,c.height).data;let n=0;for(let i=3;i<p.length;i+=4)if(p[i])n++;return n;})()`;
  assert.ok(await evaluate(pixelCount) > 0, 'trazos dibujados');
  await evaluate(`window.__inject('palm',.55,.45)`);
  assert.match(await evaluate(`document.querySelector('.gesture-hud').textContent`), /En pausa/);
  assert.equal(await evaluate(pixelCount), 0, 'palma borra trazos');
  await evaluate(`window.__inject('fist',.55,.45)`);
  assert.match(await evaluate(`document.querySelector('.gesture-hud').textContent`), /reanudada/);
  await cdp('Page.captureScreenshot', { format: 'png' }).then(r => writeFileSync('/tmp/eventshare-magic-touch.png', Buffer.from(r.data, 'base64')));
  await evaluate(`document.querySelector('.magic-touch-toggle').click()`);
  await until(() => evaluate(`window.__streams.every(s=>s.getTracks().every(t=>t.readyState==='ended'))`), 'cámara liberada');
  assert.equal(await evaluate(`!!document.querySelector('.gesture-overlay')`), false);
  await evaluate(`document.querySelector('.tv-controls-toggle').click()`);
  assert.equal(await evaluate(`document.querySelector('select').disabled`), false, 'diseños disponibles al desactivar');
  assert.equal(await evaluate(`document.querySelector('select').value`), 'random', 'selección anterior restaurada');
  const restoredView = await evaluate(`document.querySelector('.tv-stage').firstElementChild.className`);
  await until(async () => (await evaluate(`document.querySelector('.tv-stage').firstElementChild.className`)) !== restoredView, 'rotación automática reanudada');
  // Real worker again; resize and hide the tab to verify resource cleanup.

  await evaluate(`window.__mockFrames=false;document.querySelector('.magic-touch-toggle').click()`);
  await until(() => evaluate(`document.querySelector('.gesture-camera')?.textContent.includes('procesamiento local')`), 'segunda activación', 300);
  const streamCount = await evaluate(`window.__streams.length`);
  await cdp('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  await delay(500);
  assert.equal(await evaluate(`window.__streams.length`), streamCount, 'orientación no reinicia cámara');
  assert.equal(await evaluate(`document.documentElement.scrollWidth <= innerWidth`), true, 'sin desbordamiento móvil');
  await evaluate(`Object.defineProperty(document,'hidden',{configurable:true,value:true});document.dispatchEvent(new Event('visibilitychange'))`);
  await until(() => evaluate(`window.__streams.every(s=>s.getTracks().every(t=>t.readyState==='ended'))`), 'limpieza al ocultar');
  await evaluate(`Object.defineProperty(document,'hidden',{configurable:true,value:false});document.querySelector('.magic-touch-toggle').click();window.__delayMedia=true`);
  await evaluate(`document.querySelector('.magic-touch-toggle').click()`);
  await until(() => evaluate(`window.__streams.length > ${streamCount}`), 'solicitud tardía');
  await evaluate(`document.querySelector('.magic-touch-toggle').click()`);
  await until(() => evaluate(`window.__streams.every(s=>s.getTracks().every(t=>t.readyState==='ended'))`), 'stream tardío detenido tras desactivar');
  assert.deepEqual(errors, [], 'sin excepciones de navegador');
  console.log('OK: permisos, worker/WASM/modelo reales, selección, arrastre, dibujo, pausa/borrado, reanudación y liberación de cámara.');
  console.log('Captura: /tmp/eventshare-magic-touch.png');
} finally {
  ws?.close();
  if (browser.exitCode === null) { const exited = once(browser, 'exit'); browser.kill('SIGTERM'); await Promise.race([exited, delay(3000)]); if (browser.exitCode === null) browser.kill('SIGKILL'); }
}
