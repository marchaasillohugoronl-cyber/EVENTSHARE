import { api, ApiError, json, parse } from '@/server/http';
import { loginSchema } from '@/server/validacion';
import { queryOne } from '@/server/baseDatos';
import { setGuestCookie, toAuthUser, verifyPassword } from '@/server/autenticacion';
import { clientIp, rateLimit } from '@/server/limiteSolicitudes';

// Acceso de cuentas existentes, también para superadministradores creados con contraseña.
export const POST = api(async (req) => {
  await rateLimit(`login:${clientIp(req)}`, 15, 900);
  const b = await parse(req, loginSchema);
  await rateLimit(`login-email:${b.email}`, 8, 900);
  const row = await queryOne<any>("SELECT * FROM usuarios WHERE email = $1 AND role IN ('ADMIN', 'SUPER_ADMIN')", [b.email]);
  const ok = await verifyPassword(b.password, row?.password_hash ?? null);
  if (!row || !ok) throw new ApiError(401, 'INVALID_CREDENTIALS', 'Correo o contraseña incorrectos');
  const user = toAuthUser(row);
  const res = json({ user });
  await setGuestCookie(res, user);
  return res;
});
