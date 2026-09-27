import { NextRequest, NextResponse } from 'next/server';
import { SignJWT, jwtVerify } from 'jose';
import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';
import { env } from './entorno';
import { query, queryOne } from './baseDatos';
import { ApiError, forbidden } from './http';

export const SESSION_COOKIE = 'es_session';
const ACCESS_TTL_SEC = 15 * 60;
const GUEST_TTL_SEC = 30 * 24 * 3600;
const REFRESH_TTL_SEC = 30 * 24 * 3600;

export type Role = 'ADMIN' | 'GUEST';
export type AuthUser = { id: string; role: Role; name: string; email: string | null; avatarUrl: string | null };

const secret = () => new TextEncoder().encode(env.jwtAccessSecret);

export async function signToken(userId: string, role: Role, ttlSec: number): Promise<string> {
  return new SignJWT({ role })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(userId)
    .setIssuer('eventshare')
    .setIssuedAt()
    .setExpirationTime(`${ttlSec}s`)
    .sign(secret());
}

export const hashPassword = (pw: string) => bcrypt.hash(pw, 12);
const DUMMY_HASH = bcrypt.hashSync('dummy-password-for-timing', 12);
export async function verifyPassword(pw: string, hash: string | null): Promise<boolean> {
  // Compara siempre contra un hash (aunque el usuario no exista) para evitar filtrar existencia por tiempo.
  const ok = await bcrypt.compare(pw, hash ?? DUMMY_HASH);
  return ok && !!hash;
}

const sha256 = (s: string) => crypto.createHash('sha256').update(s).digest('hex');

export function toAuthUser(r: { id: string; role: Role; name: string; email: string | null; avatar_url: string | null }): AuthUser {
  return { id: r.id, role: r.role, name: r.name, email: r.email, avatarUrl: r.avatar_url };
}

/** Lee el usuario desde `Authorization: Bearer` o desde la cookie de sesión. Devuelve null si no hay sesión válida. */
export async function getAuth(req: NextRequest): Promise<AuthUser | null> {
  const header = req.headers.get('authorization');
  const token = header?.startsWith('Bearer ') ? header.slice(7) : req.cookies.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret(), { issuer: 'eventshare' });
    if (!payload.sub) return null;
    const row = await queryOne<any>('SELECT id, role, name, email, avatar_url FROM usuarios WHERE id = $1', [payload.sub]);
    return row ? toAuthUser(row) : null;
  } catch {
    return null;
  }
}

export async function requireAuth(req: NextRequest): Promise<AuthUser> {
  const u = await getAuth(req);
  if (!u) throw new ApiError(401, 'UNAUTHORIZED', 'Inicia sesión para continuar');
  return u;
}

export async function requireAdmin(req: NextRequest): Promise<AuthUser> {
  const u = await requireAuth(req);
  if (u.role !== 'ADMIN') throw forbidden('Solo administradores');
  return u;
}

/** Tokens para la app Android (access corto + refresh rotativo). */
export async function issueTokens(user: AuthUser, req: NextRequest) {
  const accessToken = await signToken(user.id, user.role, ACCESS_TTL_SEC);
  const refreshToken = crypto.randomBytes(48).toString('base64url');
  await query(
    `INSERT INTO tokens_renovacion (user_id, token_hash, expires_at, user_agent)
     VALUES ($1, $2, now() + ($3 || ' seconds')::interval, $4)`,
    [user.id, sha256(refreshToken), String(REFRESH_TTL_SEC), req.headers.get('user-agent')?.slice(0, 200) ?? null]
  );
  return { accessToken, refreshToken, expiresIn: ACCESS_TTL_SEC, user };
}

export async function rotateRefreshToken(token: string, req: NextRequest) {
  const row = await queryOne<any>(
    `SELECT rt.id, rt.user_id, rt.revoked_at, rt.expires_at, u.id AS uid, u.role, u.name, u.email, u.avatar_url
       FROM tokens_renovacion rt JOIN usuarios u ON u.id = rt.user_id WHERE rt.token_hash = $1`,
    [sha256(token)]
  );
  if (!row) throw new ApiError(401, 'INVALID_REFRESH', 'Sesión inválida');
  if (row.revoked_at) {
    // Reutilización de un token ya rotado: posible robo -> revoca todas las sesiones del usuario.
    await query('UPDATE tokens_renovacion SET revoked_at = now() WHERE user_id = $1 AND revoked_at IS NULL', [row.user_id]);
    throw new ApiError(401, 'INVALID_REFRESH', 'Sesión inválida');
  }
  if (new Date(row.expires_at) < new Date()) throw new ApiError(401, 'INVALID_REFRESH', 'La sesión expiró');
  await query('UPDATE tokens_renovacion SET revoked_at = now() WHERE id = $1', [row.id]);
  return issueTokens(toAuthUser({ id: row.uid, role: row.role, name: row.name, email: row.email, avatar_url: row.avatar_url }), req);
}

export async function revokeRefreshToken(token: string) {
  await query('UPDATE tokens_renovacion SET revoked_at = now() WHERE token_hash = $1 AND revoked_at IS NULL', [sha256(token)]);
}

/** Sesión de invitado del navegador: cookie httpOnly de larga duración. */
export async function setGuestCookie(res: NextResponse, user: { id: string; role: Role }) {
  const token = await signToken(user.id, user.role, GUEST_TTL_SEC);
  res.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: env.isProd,
    sameSite: 'lax',
    path: '/',
    maxAge: GUEST_TTL_SEC,
  });
}

export function clearSessionCookie(res: NextResponse) {
  res.cookies.set(SESSION_COOKIE, '', { httpOnly: true, secure: env.isProd, sameSite: 'lax', path: '/', maxAge: 0 });
}
