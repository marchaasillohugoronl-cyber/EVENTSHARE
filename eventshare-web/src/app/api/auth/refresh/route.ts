import { api, json, parse } from '@/server/http';
import { refreshSchema } from '@/server/validacion';
import { rotateRefreshToken } from '@/server/autenticacion';
import { clientIp, rateLimit } from '@/server/limiteSolicitudes';

// POST /api/auth/refresh  — rota el refresh token y devuelve un nuevo par de tokens
export const POST = api(async (req) => {
  await rateLimit(`refresh:${clientIp(req)}`, 60, 900);
  const b = await parse(req, refreshSchema);
  return json(await rotateRefreshToken(b.refreshToken, req));
});
