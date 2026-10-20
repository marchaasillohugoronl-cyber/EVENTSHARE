import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import test from 'node:test';
import pg from 'pg';
import { NextRequest } from 'next/server';
import { OAuth2Client } from 'google-auth-library';
import { codigoOrigen, destinoAdmin } from '../src/lib/rutasAdmin';
import { esAdministrador, puedeUsarTema } from '../src/lib/permisos';
import { eventCreateSchema, registerSchema } from '../src/server/validacion';
import { authenticateGoogle } from '../src/server/google';
import { requireAdmin, signToken } from '../src/server/autenticacion';
import { listOwnedEvents, requireOwnedEvent, toEvent } from '../src/server/eventos';

const databaseUrl = process.env.TEST_DATABASE_URL;
if (!databaseUrl || !['localhost', '127.0.0.1'].includes(new URL(databaseUrl).hostname)) {
  throw new Error('TEST_DATABASE_URL debe apuntar a PostgreSQL local de pruebas');
}

test('tres roles, migraciones y Google sin elevar privilegios', async (t) => {
  const schema = `test_roles_${randomUUID().replaceAll('-', '')}`;
  const setup = new pg.Client({ connectionString: databaseUrl });
  await setup.connect();
  await setup.query(`CREATE SCHEMA ${schema}`);
  const pool = new pg.Pool({ connectionString: databaseUrl, options: `-c search_path=${schema},public` });
  globalThis.__pgPool = pool;
  process.env.GOOGLE_CLIENT_ID = 'test-client';
  process.env.JWT_ACCESS_SECRET = 'test-secret-for-local-roles-only';
  process.env.ALLOW_ADMIN_REGISTRATION = 'true';
  const query = (sql: string, values: unknown[] = []) => pool.query(sql, values);
  try {
    const migrationClient = await pool.connect();
    try {
      const dir = new URL('../../db/migrations/', import.meta.url);
      for (const file of readdirSync(dir).filter(f => f.endsWith('.sql')).sort()) {
        await migrationClient.query(readFileSync(new URL(file, dir), 'utf8'));
      }
    } finally { migrationClient.release(); }

    await t.test('invitados no administran; Senati solo para superadministrador', () => {
      assert.equal(esAdministrador('GUEST'), false);
      assert.equal(puedeUsarTema('GUEST', 'STANDARD'), false);
      assert.equal(puedeUsarTema('ADMIN', 'SENATI_TEC'), false);
      assert.equal(puedeUsarTema('SUPER_ADMIN', 'SENATI_TEC'), true);
      assert.equal(puedeUsarTema('ADMIN', 'STANDARD'), true);
      assert.equal(eventCreateSchema.parse({ name: 'Senati Tec' }).theme, undefined);
      assert.equal('role' in registerSchema.parse({ name: 'Test', email: 'test@example.com', password: 'password-123', role: 'SUPER_ADMIN' }), false);
    });

    let subject = 'guest-google';
    let email = 'guest@example.com';
    let verified = true;
    t.mock.method(OAuth2Client.prototype, 'verifyIdToken', async () => ({ getPayload: () => ({ sub: subject, email, email_verified: verified, name: 'Prueba Google' }) }));
    const guest = await authenticateGoogle('test-token');
    assert.equal(guest.role, 'GUEST');
    const admin = await authenticateGoogle('test-token', true);
    assert.equal(admin.id, guest.id);
    assert.equal(admin.role, 'ADMIN');
    assert.equal((await authenticateGoogle('test-token')).role, 'ADMIN');

    subject = 'super-google'; email = 'super@example.com';
    const superAccount = await authenticateGoogle('test-token', true);
    await query("UPDATE usuarios SET role = 'SUPER_ADMIN' WHERE id = $1", [superAccount.id]);
    const superAdmin = await authenticateGoogle('test-token', true);
    assert.equal(superAdmin.role, 'SUPER_ADMIN');
    assert.equal((await authenticateGoogle('test-token')).role, 'SUPER_ADMIN');

    await t.test('registro cerrado bloquea altas/promociones pero permite iniciar sesión', async () => {
      process.env.ALLOW_ADMIN_REGISTRATION = 'false';
      assert.equal((await authenticateGoogle('test-token', true)).role, 'SUPER_ADMIN');
      subject = 'new-google'; email = 'new@example.com';
      await assert.rejects(authenticateGoogle('test-token', true), { code: 'REGISTRATION_DISABLED' });
      assert.equal((await authenticateGoogle('test-token')).role, 'GUEST');
      await assert.rejects(authenticateGoogle('test-token', true), { code: 'REGISTRATION_DISABLED' });
      process.env.ALLOW_ADMIN_REGISTRATION = 'true';
    });

    await t.test('Google no vincula otra identidad por coincidencia de correo', async () => {
      subject = 'different-google'; email = 'super@example.com';
      await assert.rejects(authenticateGoogle('test-token', true), { code: 'EMAIL_TAKEN' });
      const other = await authenticateGoogle('test-token');
      assert.equal(other.role, 'GUEST'); assert.equal(other.email, null);
      await assert.rejects(authenticateGoogle('test-token', true), { code: 'EMAIL_TAKEN' });
      verified = false;
      await assert.rejects(authenticateGoogle('test-token', true), { code: 'INVALID_GOOGLE_TOKEN' });
      verified = true;
    });

    await t.test('la base impide asignar Senati a un administrador normal', async () => {
      await assert.rejects(query("INSERT INTO eventos (owner_id,name,event_code,theme) VALUES ($1,'Senati','BAD12345','SENATI_TEC')", [admin.id]), { code: '23514' });
      const { rows: [ev] } = await query("INSERT INTO eventos (owner_id,name,event_code,theme) VALUES ($1,'Mi feria','SEN12345','SENATI_TEC') RETURNING *", [superAdmin.id]);
      assert.equal(toEvent(ev).theme, 'SENATI_TEC');
      await assert.rejects(requireOwnedEvent(ev.id, admin), { status: 404 });
      assert.equal((await requireOwnedEvent(ev.id, superAdmin)).id, ev.id);
      assert.equal((await listOwnedEvents(admin.id)).length, 0);
      assert.equal((await listOwnedEvents(superAdmin.id)).length, 1);
      await assert.rejects(query('UPDATE eventos SET owner_id = $1 WHERE id = $2', [admin.id, ev.id]), { code: '23514' });
    });

    await t.test('el invitado anónimo conserva sus publicaciones al registrarse por Google en la web', async () => {
      const { rows: [anonymous] } = await query("INSERT INTO usuarios(name,role) VALUES ('Invitado original','GUEST') RETURNING *");
      const { rows: [event] } = await query("SELECT id FROM eventos LIMIT 1");
      const { rows: [post] } = await query("INSERT INTO publicaciones(event_id,user_id,message) VALUES ($1,$2,'Mi recuerdo') RETURNING *", [event.id, anonymous.id]);
      subject = 'web-new-google'; email = 'web-new@example.com';
      const creator = await authenticateGoogle('test-token', true, anonymous.id);
      assert.equal(creator.id, anonymous.id);
      assert.equal(creator.role, 'ADMIN');
      assert.equal(creator.name, 'Invitado original');
      assert.equal((await query('SELECT user_id FROM publicaciones WHERE id = $1', [post.id])).rows[0].user_id, creator.id);
      subject = 'other-new-google'; email = 'other-new@example.com';
      const other = await authenticateGoogle('test-token', true, anonymous.id);
      assert.notEqual(other.id, anonymous.id);
      assert.equal((await query('SELECT google_id FROM usuarios WHERE id = $1', [anonymous.id])).rows[0].google_id, 'web-new-google');
    });

    await t.test('el retorno al evento y el destino del panel no aceptan redirecciones externas', () => {
      assert.equal(codigoOrigen('abC12345'), 'ABC12345');
      assert.equal(codigoOrigen('//example.com'), null);
      assert.equal(destinoAdmin('/admin'), '/admin');
      for (const path of ['https://example.com', '//example.com', '/admin/../otra', '/admin?redirect=otro']) assert.equal(destinoAdmin(path), '/admin/nuevo');
    });

    await t.test('la autorización consulta el rol actual, no confía en el rol del token', async () => {
      const { rows: [row] } = await query("INSERT INTO usuarios(name,role) VALUES ('Invitado','GUEST') RETURNING *");
      const forgedRoleToken = await signToken(row.id, 'SUPER_ADMIN', 60);
      const req = new NextRequest('http://localhost/api/events', { headers: { Authorization: `Bearer ${forgedRoleToken}` } });
      await assert.rejects(requireAdmin(req), { status: 403 });
      const superToken = await signToken(superAdmin.id, 'ADMIN', 60);
      assert.equal((await requireAdmin(new NextRequest('http://localhost/api/events', { headers: { Authorization: `Bearer ${superToken}` } }))).role, 'SUPER_ADMIN');
    });
  } finally {
    await pool.end();
    globalThis.__pgPool = undefined;
    await setup.query(`DROP SCHEMA ${schema} CASCADE`);
    await setup.end();
  }
});
