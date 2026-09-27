import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { promisify } from 'node:util';
import { randomUUID } from 'node:crypto';
import test from 'node:test';

const run = promisify(execFile);
const database = process.env.TEST_DATABASE_URL;
if (!database) throw new Error('Define TEST_DATABASE_URL con una base PostgreSQL de pruebas');
const schema = `ratelimit_test_${randomUUID().replaceAll('-', '')}`;
async function sql(statement) {
  const { stdout } = await run('psql', ['-X', '-A', '-t', '-d', database, '-v', 'ON_ERROR_STOP=1', '-c', statement], {
    env: { ...process.env, PGOPTIONS: `-c search_path=${schema},public` },
  });
  return stdout.trim();
}

test('Límites compartidos entre conexiones PostgreSQL', async (t) => {
  await sql(`CREATE SCHEMA ${schema}`);
  try {
    for (const file of ['0001_init.sql', '0002_unique_photo_key.sql', '0003_rate_limits.sql', '0004_tablas_espanol.sql']) {
      await sql(await readFile(new URL(`../../db/migrations/${file}`, import.meta.url), 'utf8'));
    }

    await t.test('admite exactamente el máximo bajo concurrencia', async () => {
      const results = await Promise.all(Array.from({ length: 24 }, () =>
        sql("SELECT allowed FROM consume_rate_limit('concurrent', 7, 900)")));
      assert.equal(results.filter((value) => value === 't').length, 7);
      assert.equal(results.filter((value) => value === 'f').length, 17);
    });

    await t.test('una clave distinta tiene su propio cupo', async () => {
      assert.equal(await sql("SELECT allowed FROM consume_rate_limit('other', 1, 900)"), 't');
      assert.equal(await sql("SELECT allowed FROM consume_rate_limit('other', 1, 900)"), 'f');
    });

    await t.test('rechazar no extiende la ventana y devuelve una espera válida', async () => {
      const before = await sql("SELECT resets_at FROM limites_solicitudes WHERE key_hash = 'other'");
      const result = await sql("SELECT allowed, retry_after FROM consume_rate_limit('other', 1, 900)");
      const [allowed, retry] = result.split('|');
      assert.equal(allowed, 'f');
      assert.ok(Number(retry) > 0 && Number(retry) <= 900);
      assert.equal(await sql("SELECT resets_at FROM limites_solicitudes WHERE key_hash = 'other'"), before);
    });

    await t.test('restablece el cupo cuando vence la ventana', async () => {
      await sql("UPDATE limites_solicitudes SET resets_at = now() - interval '1 second' WHERE key_hash = 'other'");
      assert.equal(await sql("SELECT allowed FROM consume_rate_limit('other', 1, 900)"), 't');
      assert.equal(await sql("SELECT count FROM limites_solicitudes WHERE key_hash = 'other'"), '1');
      assert.equal(await sql("SELECT allowed FROM consume_rate_limit('other', 1, 900)"), 'f');
    });

    await t.test('rechaza configuraciones inválidas', async () => {
      await assert.rejects(sql("SELECT * FROM consume_rate_limit('invalid', 0, 60)"));
      await assert.rejects(sql("SELECT * FROM consume_rate_limit('invalid', 1, 0)"));
      assert.equal(await sql("SELECT count(*) FROM limites_solicitudes WHERE key_hash = 'invalid'"), '0');
    });
  } finally {
    await sql(`DROP SCHEMA ${schema} CASCADE`);
  }
});
