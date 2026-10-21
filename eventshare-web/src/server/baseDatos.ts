import { Pool, PoolClient, QueryResultRow } from 'pg';
import { env } from './entorno';

declare global {
  // eslint-disable-next-line no-var
  var __pgPool: Pool | undefined;
}

function pool(): Pool {
  if (!globalThis.__pgPool) {
    globalThis.__pgPool = new Pool({ connectionString: env.databaseUrl, max: 5 });
  }
  return globalThis.__pgPool;
}

function isConnectionFailure(error: unknown): boolean {
  if (error instanceof AggregateError) {
    return error.errors.length > 0 && error.errors.every(isConnectionFailure);
  }
  const code = (error as { code?: string } | null)?.code;
  return !!code && ['ECONNREFUSED', 'ECONNRESET', 'ETIMEDOUT', 'EAI_AGAIN', 'ENOTFOUND', 'ENETUNREACH', 'EHOSTUNREACH', '57P03'].includes(code);
}

export async function query<T extends QueryResultRow = any>(text: string, params: unknown[] = []): Promise<T[]> {
  // Solo las lecturas se reintentan: repetir una escritura podría duplicar datos.
  const attempts = /^\s*SELECT\b/i.test(text) ? 2 : 1;
  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      const res = await pool().query<T>(text, params);
      return res.rows;
    } catch (error) {
      if (!isConnectionFailure(error)) throw error;
      if (attempt + 1 === attempts) {
        throw new Error('No se pudo conectar con la base de datos. Inténtalo de nuevo en unos segundos.', { cause: error });
      }
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }
  throw new Error('No se pudo completar la consulta.');
}

export async function queryOne<T extends QueryResultRow = any>(text: string, params: unknown[] = []): Promise<T | null> {
  const rows = await query<T>(text, params);
  return rows[0] ?? null;
}

export async function tx<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool().connect();
  try {
    await client.query('BEGIN');
    const out = await fn(client);
    await client.query('COMMIT');
    return out;
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

export function isUniqueViolation(e: unknown, constraint?: string): boolean {
  const err = e as { code?: string; constraint?: string };
  return err?.code === '23505' && (!constraint || err.constraint === constraint);
}
