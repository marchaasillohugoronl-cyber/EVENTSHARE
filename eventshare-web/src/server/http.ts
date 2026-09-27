import { connection, NextRequest, NextResponse } from 'next/server';
import { ZodError, ZodTypeAny, z } from 'zod';
import { env } from './entorno';

export class ApiError extends Error {
  constructor(public status: number, public code: string, message: string, public headers: Record<string, string> = {}) {
    super(message);
  }
}

export const notFound = (what = 'Recurso') => new ApiError(404, 'NOT_FOUND', `${what} no encontrado`);
export const forbidden = (msg = 'No tienes permiso para esta acción') => new ApiError(403, 'FORBIDDEN', msg);

export function json(data: unknown, status = 200): NextResponse {
  return NextResponse.json(data, { status, headers: { 'Cache-Control': 'no-store' } });
}

export async function parse<S extends ZodTypeAny>(req: Request, schema: S): Promise<z.infer<S>> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    throw new ApiError(400, 'INVALID_JSON', 'El cuerpo debe ser JSON válido');
  }
  return schema.parse(raw);
}

export function parseQuery<S extends ZodTypeAny>(req: NextRequest, schema: S): z.infer<S> {
  return schema.parse(Object.fromEntries(req.nextUrl.searchParams.entries()));
}

// Protección CSRF para peticiones con cookie: si el navegador envía Origin, debe ser el propio sitio.
function checkOrigin(req: NextRequest) {
  const origin = req.headers.get('origin');
  if (!origin) return;
  let host: string;
  try { host = new URL(origin).host; } catch { throw forbidden('Origen inválido'); }
  const ok =
    host === req.headers.get('host') ||
    host === new URL(env.appUrl).host ||
    env.allowedOrigins.some((o) => { try { return new URL(o).host === host; } catch { return false; } });
  if (!ok) throw forbidden('Origen no permitido');
}

export function errorResponse(e: unknown): NextResponse {
  if (e instanceof ApiError) {
    return NextResponse.json({ error: { code: e.code, message: e.message } }, { status: e.status, headers: { ...e.headers, 'Cache-Control': 'no-store' } });
  }
  if (e instanceof ZodError) {
    return NextResponse.json(
      { error: { code: 'VALIDATION_ERROR', message: 'Datos inválidos', details: e.issues.map((i) => ({ path: i.path.join('.'), message: i.message })) } },
      { status: 400 }
    );
  }
  console.error(e);
  return NextResponse.json({ error: { code: 'INTERNAL', message: 'Error interno del servidor' } }, { status: 500 });
}

type Handler<P> = (req: NextRequest, ctx: { params: P }) => Promise<Response>;

export function api<P = Record<string, string>>(handler: Handler<P>) {
  return async (req: NextRequest, ctx: { params: Promise<P> }): Promise<Response> => {
    // La API depende de la petición y nunca debe ejecutarse durante el prerender.
    await connection();
    try {
      if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method)) checkOrigin(req);
      return await handler(req, { params: await ctx.params });
    } catch (e) {
      return errorResponse(e);
    }
  };
}
