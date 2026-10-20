// Prueba de navegador/API con Chromium y PostgreSQL locales, sin Google ni Cloudinary reales.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readdirSync, readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { setTimeout as delay } from 'node:timers/promises';
import pg from 'pg';

const databaseUrl = process.env.TEST_DATABASE_URL;
if (!databaseUrl || !['localhost', '127.0.0.1'].includes(new URL(databaseUrl).hostname)) throw new Error('Usa TEST_DATABASE_URL local de pruebas');
const schema = `web_test_${randomUUID().replaceAll('-', '')}`;
const base = 'http://localhost:3105';
const setup = new pg.Client({ connectionString: databaseUrl });
let server, browser, ws;
const output = [];
const pending = new Map(); let sequence = 0;
async function until(fn, label) {
  for (let i = 0; i < 100; i++) { try { if (await fn()) return; } catch {} await delay(200); }
  throw new Error(`Tiempo agotado: ${label}`);
}
async function request(path, { method = 'GET', token, cookie, body, status = 200 } = {}) {
  const r = await fetch(`${base}/api${path}`, { method, headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(cookie ? { Cookie: cookie } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}) }, body: body ? JSON.stringify(body) : undefined });
  assert.equal(r.status, status, `${method} ${path}: ${await r.clone().text()}`); return r;
}
function cdp(method, params = {}) {
  return new Promise((resolve, reject) => {
    const id = ++sequence;
    const timer = setTimeout(() => { pending.delete(id); reject(new Error(`CDP timeout: ${method}`)); }, 15000);
    pending.set(id, { resolve: value => { clearTimeout(timer); resolve(value); }, reject: error => { clearTimeout(timer); reject(error); } });
    ws.send(JSON.stringify({ id, method, params }));
  });
}
async function evaluate(expression) {
  const r = await cdp('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.text);
  return r.result.value;
}
async function fill(selector, value) {
  await evaluate(`(() => { const e = document.querySelector(${JSON.stringify(selector)}); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(e, ${JSON.stringify(value)}); e.dispatchEvent(new Event('input', { bubbles: true })); })()`);
}
async function stop(child) {
  if (!child || child.exitCode !== null) return;
  const exited = once(child, 'exit'); child.kill('SIGTERM');
  await Promise.race([exited, delay(5000)]);
  if (child.exitCode === null) child.kill('SIGKILL');
}
try {
  await setup.connect(); await setup.query(`CREATE SCHEMA ${schema}`); await setup.query(`SET search_path = ${schema}, public`);
  const dir = new URL('../../db/migrations/', import.meta.url);
  for (const file of readdirSync(dir).filter(f => f.endsWith('.sql')).sort()) await setup.query(readFileSync(new URL(file, dir), 'utf8'));
  const scoped = new URL(databaseUrl); scoped.searchParams.set('options', `-c search_path=${schema},public`);
  server = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'start', '-p', '3105'], { env: { ...process.env, NEXT_DIST_DIR: '.next-admin-test', DATABASE_URL: scoped.toString(), JWT_ACCESS_SECRET: 'local-browser-test-secret-only', NEXT_PUBLIC_APP_URL: base, GOOGLE_CLIENT_ID: '', ALLOW_ADMIN_REGISTRATION: 'true' }, stdio: ['ignore', 'pipe', 'pipe'] });
  server.stdout.on('data', data => output.push(data.toString())); server.stderr.on('data', data => output.push(data.toString()));
  await until(async () => (await fetch(`${base}/api/auth/me`)).ok, 'servidor local');
  const email = `web-${randomUUID()}@example.com`, password = randomUUID();
  const account = await (await request('/auth/register', { method: 'POST', status: 201, body: { name: 'Anfitrión web', email, password, role: 'SUPER_ADMIN' } })).json();
  assert.equal(account.user.role, 'ADMIN');
  const token = account.accessToken;
  const { event: original } = await (await request('/events', { method: 'POST', token, status: 201, body: { name: 'Evento de origen' } })).json();
  await request('/events', { method: 'POST', token, status: 403, body: { name: 'Senati bloqueado', theme: 'SENATI_TEC' } });
  const visitor = await request('/auth/guest', { method: 'POST', status: 201, body: { name: 'Visitante', eventCode: original.code } });
  const cookie = visitor.headers.get('set-cookie').split(';')[0];
  await request('/admin/events', { cookie, status: 403 });

  browser = spawn(process.env.CHROMIUM_PATH || 'chromium', ['--headless', '--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage', '--remote-debugging-port=9234', `--user-data-dir=${mkdtempSync('/tmp/eventshare-web-browser-')}`, 'about:blank'], { stdio: 'ignore' });
  let target;
  await until(async () => { target = (await (await fetch('http://127.0.0.1:9234/json')).json()).find(t => t.type === 'page'); return !!target; }, 'Chromium');
  ws = new WebSocket(target.webSocketDebuggerUrl); await once(ws, 'open');
  ws.addEventListener('message', event => { const m = JSON.parse(event.data); if (m.id && pending.has(m.id)) { const p = pending.get(m.id); pending.delete(m.id); m.error ? p.reject(new Error(m.error.message)) : p.resolve(m.result); } });
  await cdp('Page.enable'); await cdp('Runtime.enable');
  await cdp('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  await cdp('Page.navigate', { url: `${base}/e/${original.code}` });
  await until(() => evaluate(`!!document.querySelector('footer a[href="/crear?from=${original.code}"]')`), 'pie del evento');
  await evaluate(`document.querySelector('footer a').click()`);
  await until(() => evaluate(`!!document.querySelector('input[type="email"]')`), 'acceso web');
  await evaluate(`document.querySelector('details').open = true`);
  await fill('input[type="email"]', email); await fill('input[type="password"]', password);
  await evaluate(`document.querySelector('form button').click()`);
  await until(() => evaluate(`location.pathname === '/admin/nuevo' && !!document.querySelector('input[maxlength="120"]')`), 'formulario nuevo');
  assert.equal(await evaluate(`!!document.querySelector('select')`), false, 'ADMIN no ve Senati');
  await fill('input[maxlength="120"]', 'Mi evento desde el móvil');
  await evaluate(`document.querySelector('form button').click()`);
  await until(() => evaluate(`location.pathname.startsWith('/admin/eventos/') && !!document.querySelector('img[alt^="QR de"]')`), 'evento creado con QR');
  const id = await evaluate(`location.pathname.split('/').pop()`);
  const { event: created } = await (await request(`/admin/events/${id}`, { token })).json();
  assert.equal(created.name, 'Mi evento desde el móvil');
  assert.equal(created.theme, 'STANDARD');
  assert.equal(await evaluate(`document.documentElement.scrollWidth <= innerWidth`), true, 'sin desbordamiento móvil');
  await until(() => evaluate(`document.querySelector('img[alt^="QR de"]').naturalWidth > 0`), 'QR visible con cookie');
  const browserSession = await evaluate(`fetch('/api/auth/me').then(r=>r.json()).then(r=>r.user.role)`);
  assert.equal(browserSession, 'ADMIN');
  const member = await request('/auth/guest', { method: 'POST', status: 201, body: { name: 'Invitada web', eventCode: created.code } });
  const memberCookie = member.headers.get('set-cookie').split(';')[0];
  const { post } = await (await request(`/events/${id}/posts`, { method: 'POST', cookie: memberCookie, status: 201, body: { message: 'Recuerdo para moderar' } })).json();
  await evaluate(`[...document.querySelectorAll('button')].find(b => b.textContent === 'Actualizar').click()`);
  await until(() => evaluate(`document.body.textContent.includes('Recuerdo para moderar')`), 'publicación pendiente');
  await evaluate(`[...document.querySelectorAll('button')].find(b => b.textContent === 'Aprobar').click()`);
  await until(async () => (await (await request(`/events/${id}/posts`)).json()).items.some(p => p.id === post.id), 'publicación aprobada');
  const shot = await cdp('Page.captureScreenshot', { format: 'png' });
  writeFileSync('/tmp/eventshare-admin-mobile.png', Buffer.from(shot.data, 'base64'));
  await evaluate(`[...document.querySelectorAll('a')].find(a=>a.textContent==='Editar evento').click()`);
  await until(() => evaluate(`!!document.querySelector('input[maxlength="120"]')`), 'editar evento');
  await fill('input[maxlength="120"]', 'Evento editado en la web');
  await evaluate(`document.querySelector('form button').click()`);
  await until(() => evaluate(`!!document.querySelector('h1') && document.querySelector('h1').textContent === 'Evento editado en la web'`), 'cambio guardado');
  const login = await request('/auth/login/web', { method: 'POST', body: { email, password } });
  assert.match(login.headers.get('set-cookie'), /HttpOnly/i);
  assert.match(login.headers.get('set-cookie'), /SameSite=lax/i);
  assert.equal('accessToken' in await login.json(), false);
  await evaluate(`[...document.querySelectorAll('button')].find(b=>b.textContent==='Salir').click()`);
  await until(() => evaluate(`location.pathname === '/'`), 'cerrar sesión');
  assert.equal(await evaluate(`fetch('/api/auth/me').then(r=>r.json()).then(r=>r.user)`), null);
  console.log('OK: footer → acceso → crear → QR → moderar → editar → salir, móvil sin desbordamiento y permisos API.');
} catch (error) {
  console.error(output.join('').slice(-6000));
  if (ws?.readyState === WebSocket.OPEN) console.error(await evaluate('location.href').catch(() => 'Navegador no disponible'));
  throw error;
} finally {
  ws?.close(); await stop(browser); await stop(server);
  await setup.query('SET search_path = public');
  await setup.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`); await setup.end();
}
