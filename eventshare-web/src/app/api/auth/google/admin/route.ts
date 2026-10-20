import { api, json, parse } from '@/server/http';
import { googleSchema } from '@/server/validacion';
import { issueTokens } from '@/server/autenticacion';
import { authenticateGoogle } from '@/server/google';
import { clientIp, rateLimit } from '@/server/limiteSolicitudes';

// Alta/inicio de administradores desde Android con una identidad Google verificada.
export const POST = api(async (req) => {
  await rateLimit(`google-admin:${clientIp(req)}`, 15, 900);
  const { idToken } = await parse(req, googleSchema);
  const user = await authenticateGoogle(idToken, true);
  return json(await issueTokens(user, req));
});
