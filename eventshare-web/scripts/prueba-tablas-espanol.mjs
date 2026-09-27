import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import dotenv from 'dotenv';
import pg from 'pg';

dotenv.config({ path: '.env.local' });

test('renombrar conserva datos, relaciones, contadores y limites', async () => {
  const client = new pg.Client({ connectionString: process.env.TEST_DATABASE_URL || process.env.DATABASE_URL });
  await client.connect();
  try {
    await client.query('BEGIN');
    const schema = `prueba_tablas_${randomUUID().replaceAll('-', '')}`;
    await client.query(`CREATE SCHEMA ${schema}`);
    await client.query(`SET LOCAL search_path TO ${schema}, public`);
    const apply = async (file) => {
      const sql = await readFile(new URL(`../../db/migrations/${file}`, import.meta.url), 'utf8');
      // Toda la prueba pertenece a una transaccion que se revierte al terminar.
      await client.query(sql.replace(/^BEGIN;\s*$/gm, '').replace(/^COMMIT;\s*$/gm, ''));
    };
    for (const file of ['0001_init.sql', '0002_unique_photo_key.sql', '0003_rate_limits.sql']) await apply(file);
    const user = (await client.query("INSERT INTO users(name) VALUES ('Prueba') RETURNING id")).rows[0].id;
    const event = (await client.query("INSERT INTO events(owner_id, name, event_code) VALUES ($1, 'Prueba', 'PRUEBA01') RETURNING id", [user])).rows[0].id;
    const post = (await client.query("INSERT INTO posts(event_id, user_id, message) VALUES ($1, $2, 'Prueba') RETURNING id", [event, user])).rows[0].id;
    await client.query('INSERT INTO likes(post_id, user_id) VALUES ($1, $2)', [post, user]);
    await client.query("SELECT * FROM consume_rate_limit('prueba', 1, 60)");
    const before = (await client.query('SELECT * FROM posts WHERE id = $1', [post])).rows[0];
    await apply('0004_tablas_espanol.sql');
    assert.deepEqual((await client.query('SELECT * FROM publicaciones WHERE id = $1', [post])).rows[0], before);
    const tables = (await client.query('SELECT tablename FROM pg_tables WHERE schemaname = $1 ORDER BY tablename', [schema])).rows.map(r => r.tablename);
    assert.deepEqual(tables, ['comentarios', 'eventos', 'limites_solicitudes', 'me_gusta', 'miembros_evento', 'publicaciones', 'tokens_renovacion', 'usuarios']);
    await client.query('DELETE FROM me_gusta WHERE post_id = $1', [post]);
    assert.equal((await client.query('SELECT likes_count FROM publicaciones WHERE id = $1', [post])).rows[0].likes_count, 0);
    await client.query('INSERT INTO me_gusta(post_id, user_id) VALUES ($1, $2)', [post, user]);
    await client.query("INSERT INTO comentarios(post_id, user_id, message) VALUES ($1, $2, 'Comentario')", [post, user]);
    assert.deepEqual((await client.query('SELECT likes_count, comments_count FROM publicaciones WHERE id = $1', [post])).rows[0], { likes_count: 1, comments_count: 1 });
    await client.query('UPDATE comentarios SET deleted_at = now() WHERE post_id = $1', [post]);
    assert.equal((await client.query('SELECT comments_count FROM publicaciones WHERE id = $1', [post])).rows[0].comments_count, 0);
    assert.equal((await client.query("SELECT allowed FROM consume_rate_limit('prueba', 1, 60)")).rows[0].allowed, false);
    await client.query('DELETE FROM publicaciones WHERE id = $1', [post]);
    assert.equal((await client.query('SELECT count(*)::int AS total FROM me_gusta')).rows[0].total, 0);
    assert.equal((await client.query('SELECT count(*)::int AS total FROM comentarios')).rows[0].total, 0);
  } finally {
    await client.query('ROLLBACK');
    await client.end();
  }
});
