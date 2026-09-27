import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';

// Ejecutar únicamente contra un servidor local con una base desechable.
const base = process.env.TEST_API_URL;
if (!base || !['localhost', '127.0.0.1'].includes(new URL(base).hostname)) {
  throw new Error('Define TEST_API_URL con la URL de un servidor local de pruebas');
}

async function request(path, { method = 'GET', token, cookie, body, status = 200 } = {}) {
  const response = await fetch(`${base}${path}`, {
    method,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(cookie ? { Cookie: cookie } : {}),
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  assert.equal(response.status, status, `${method} ${path}`);
  return response;
}

test('API y páginas después de la actualización de Next.js', async () => {
  for (const path of ['/api/admin/events', '/api/admin/stats']) {
    await request(path, { status: 401 });
  }
  assert.deepEqual(await (await request('/api/auth/me')).json(), { user: null });
  const account = await (await request('/api/auth/register', {
    method: 'POST', status: 201,
    body: { name: 'Admin de prueba', email: `test-${randomUUID()}@example.com`, password: randomUUID() },
  })).json();
  const token = account.accessToken;
  const { event } = await (await request('/api/events', {
    method: 'POST', token, status: 201,
    body: { name: 'Evento de integración', moderationEnabled: true },
  })).json();
  for (const path of ['/api/admin/events', '/api/admin/stats', `/api/admin/events/${event.id}`]) {
    await request(path, { token });
  }
  const qr = await request(`/api/admin/events/${event.id}/qr?format=svg`, { token });
  assert.match(await qr.text(), /<svg/);
  for (const suffix of ['', '/photos', '/upload']) {
    const page = await request(`/e/${event.code}${suffix}`);
    assert.match(await page.text(), /Evento de integración/);
  }
  const guest = await request('/api/auth/guest', {
    method: 'POST', status: 201, body: { name: 'Invitado', eventCode: event.code },
  });
  const cookieHeader = guest.headers.get('set-cookie');
  assert.match(cookieHeader, /HttpOnly/i);
  const cookie = cookieHeader.split(';')[0];
  const { post, requiresApproval } = await (await request(`/api/events/${event.id}/posts`, {
    method: 'POST', cookie, status: 201, body: { message: 'Mensaje de prueba' },
  })).json();
  assert.equal(requiresApproval, true);
  await request(`/api/posts/${post.id}/moderation`, {
    method: 'PATCH', token, body: { status: 'APPROVED' },
  });
  await request(`/e/${event.code}/post/${post.id}`);
  const feed = await (await request(`/api/events/${event.id}/posts`, { cookie })).json();
  assert.ok(feed.items.some((item) => item.id === post.id));

  // Mismo usuario, distintas solicitudes: la número 11 se rechaza con Retry-After.
  for (let i = 0; i < 9; i++) {
    await request(`/api/events/${event.id}/posts`, {
      method: 'POST', cookie, status: 201, body: { message: `Mensaje ${i}` },
    });
  }
  const limited = await request(`/api/events/${event.id}/posts`, {
    method: 'POST', cookie, status: 429, body: { message: 'Sobre el límite' },
  });
  assert.ok(Number(limited.headers.get('retry-after')) > 0);
  assert.equal(limited.headers.get('cache-control'), 'no-store');
});
