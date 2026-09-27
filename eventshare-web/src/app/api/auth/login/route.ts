import { api, ApiError, json, parse } from '@/server/http';
import { loginSchema } from '@/server/validacion';
import { queryOne } from '@/server/baseDatos';
import { issueTokens, toAuthUser, verifyPassword } from '@/server/autenticacion';
import { clientIp, rateLimit } from '@/server/limiteSolicitudes';

// POST /api/auth/login  — login de administradores
export const POST = api(async (req) => {
  await rateLimit(`login:${clientIp(req)}`, 15, 900);
  const b = await parse(req, loginSchema);
  await rateLimit(`login-email:${b.email}`, 8, 900);
  const row = await queryOne<any>(
    `SELECT id, name, email, role, avatar_url, password_hash FROM usuarios WHERE email = $1 AND role = 'ADMIN'`,
    [b.email]
  );
  const ok = await verifyPassword(b.password, row?.password_hash ?? null);
  if (!row || !ok) throw new ApiError(401, 'INVALID_CREDENTIALS', 'Correo o contraseña incorrectos');
  return json(await issueTokens(toAuthUser(row), req));
});
