// Aplica las migraciones SQL de ../db/migrations en orden. Uso: npm run db:migrate
import { readdirSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import pg from 'pg';

dotenv.config({ path: '.env.local' });
dotenv.config();

if (!process.env.DATABASE_URL) {
  console.error('Falta DATABASE_URL (define .env.local)');
  process.exit(1);
}

const dir = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'db', 'migrations');
const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();
// Conserva el historial de bases que ya usaban el nombre anterior.
await client.query(`DO $$ BEGIN
  IF to_regclass('migraciones_esquema') IS NULL AND to_regclass('schema_migrations') IS NOT NULL THEN
    ALTER TABLE schema_migrations RENAME TO migraciones_esquema;
  END IF;
END $$`);
await client.query(
  'CREATE TABLE IF NOT EXISTS migraciones_esquema (name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())'
);
const applied = new Set((await client.query('SELECT name FROM migraciones_esquema')).rows.map((r) => r.name));

for (const file of readdirSync(dir).filter((f) => f.endsWith('.sql')).sort()) {
  if (applied.has(file)) {
    console.log(`= ${file} (ya aplicada)`);
    continue;
  }
  console.log(`> aplicando ${file}`);
  await client.query(readFileSync(join(dir, file), 'utf8'));
  await client.query('INSERT INTO migraciones_esquema(name) VALUES ($1)', [file]);
}
await client.end();
console.log('Migraciones al día.');
