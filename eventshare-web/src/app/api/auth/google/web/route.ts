import { api, json, parse } from '@/server/http';
import { googleSchema } from '@/server/validacion';
import { getAuth, setGuestCookie } from '@/server/autenticacion';
import { authenticateGoogle } from '@/server/google';
import { clientIp, rateLimit } from '@/server/limiteSolicitudes';

export const POST = api(async (req) => {
  await rateLimit(`google-web:${clientIp(req)}`, 15, 900);
  const { idToken } = await parse(req, googleSchema);
  const current = await getAuth(req);
  const user = await authenticateGoogle(idToken, true, current?.role === 'GUEST' ? current.id : undefined);
  const res = json({ user });
  await setGuestCookie(res, user);
  return res;
});
