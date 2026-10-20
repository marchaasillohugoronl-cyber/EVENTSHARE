import { api, json, parse } from '@/server/http';
import { googleSchema } from '@/server/validacion';
import { setGuestCookie } from '@/server/autenticacion';
import { authenticateGoogle } from '@/server/google';
import { assertActive, ensureMember, requireEvent } from '@/server/eventos';
import { clientIp, rateLimit } from '@/server/limiteSolicitudes';

// Inicio desde el QR: crea invitados, nunca administradores.
export const POST = api(async (req) => {
  await rateLimit(`google:${clientIp(req)}`, 60, 900);
  const b = await parse(req, googleSchema);
  const ev = b.eventCode ? await requireEvent(b.eventCode) : null;
  if (ev) assertActive(ev);
  const user = await authenticateGoogle(b.idToken);
  if (ev) await ensureMember(ev.id, user.id);
  const res = json({ user });
  await setGuestCookie(res, user);
  return res;
});
