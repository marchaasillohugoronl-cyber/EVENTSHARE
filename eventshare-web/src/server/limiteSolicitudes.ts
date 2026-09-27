import { createHash } from 'node:crypto';
import { queryOne } from './baseDatos';
import { ApiError } from './http';

// PostgreSQL serializa los incrementos por clave, incluso entre varias instancias.
// No se permite continuar si el almacenamiento del límite no está disponible.
export async function rateLimit(id: string, max: number, windowSec: number): Promise<void> {
  const result = await queryOne<{ allowed: boolean; retry_after: number }>(
    'SELECT * FROM consume_rate_limit($1, $2, $3)',
    [createHash('sha256').update(id).digest('hex'), max, windowSec]
  );
  if (!result) throw new Error('No se pudo comprobar el límite de solicitudes');
  if (!result.allowed) {
    throw new ApiError(429, 'RATE_LIMITED', 'Demasiadas solicitudes. Intenta de nuevo en unos minutos.', {
      'Retry-After': String(result.retry_after),
    });
  }
}

export function clientIp(req: Request): string {
  const fwd = req.headers.get('x-forwarded-for');
  return (fwd?.split(',')[0] ?? req.headers.get('x-real-ip') ?? 'unknown').trim();
}
