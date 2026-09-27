import { NextResponse } from 'next/server';
import { OAuth2Client } from 'google-auth-library';
import { api, ApiError, parse } from '@/server/http';
import { googleSchema } from '@/server/validacion';
import { queryOne } from '@/server/baseDatos';
import { env } from '@/server/entorno';
import { setGuestCookie, toAuthUser } from '@/server/autenticacion';
import { assertActive, ensureMember, findEvent } from '@/server/eventos';
import { clientIp, rateLimit } from '@/server/limiteSolicitudes';

// POST /api/auth/google  — { idToken, eventCode? }  (token de Google Identity Services)
export const POST = api(async (req) => {
  await rateLimit(`google:${clientIp(req)}`, 60, 900);
  if (!env.googleClientId) throw new ApiError(503, 'GOOGLE_DISABLED', 'El inicio con Google no está configurado');
  const b = await parse(req, googleSchema);

  let payload;
  try {
    const ticket = await new OAuth2Client(env.googleClientId).verifyIdToken({ idToken: b.idToken, audience: env.googleClientId });
    payload = ticket.getPayload();
  } catch {
    throw new ApiError(401, 'INVALID_GOOGLE_TOKEN', 'No se pudo verificar tu cuenta de Google');
  }
  if (!payload?.sub || !payload.email_verified) throw new ApiError(401, 'INVALID_GOOGLE_TOKEN', 'Cuenta de Google no verificada');

  const name = (payload.name || payload.email || 'Invitado').slice(0, 80);
  let user = await queryOne<any>('SELECT id, name, email, role, avatar_url FROM usuarios WHERE google_id = $1', [payload.sub]);
  if (!user) {
    // El correo solo se guarda si no pertenece a otra cuenta (nunca se enlaza con administradores).
    const taken = await queryOne('SELECT 1 AS x FROM usuarios WHERE email = $1', [payload.email]);
    user = await queryOne<any>(
      `INSERT INTO usuarios (name, email, google_id, avatar_url, role) VALUES ($1, $2, $3, $4, 'GUEST')
       RETURNING id, name, email, role, avatar_url`,
      [name, taken ? null : payload.email, payload.sub, payload.picture ?? null]
    );
  }
  if (b.eventCode) {
    const ev = await findEvent(b.eventCode);
    if (ev) { assertActive(ev); await ensureMember(ev.id, user.id); }
  }
  const res = NextResponse.json({ user: toAuthUser(user) });
  await setGuestCookie(res, user);
  return res;
});
