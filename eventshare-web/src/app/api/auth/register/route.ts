import { api, ApiError, json, parse } from '@/server/http';
import { registerSchema } from '@/server/validacion';
import { query, isUniqueViolation } from '@/server/baseDatos';
import { hashPassword, issueTokens, toAuthUser } from '@/server/autenticacion';
import { clientIp, rateLimit } from '@/server/limiteSolicitudes';

// POST /api/auth/register  — registro de administradores (app Android)
export const POST = api(async (req) => {
  if (process.env.ALLOW_ADMIN_REGISTRATION === 'false') {
    throw new ApiError(403, 'REGISTRATION_DISABLED', 'El registro está deshabilitado');
  }
  await rateLimit(`register:${clientIp(req)}`, 5, 3600);
  const b = await parse(req, registerSchema);
  const hash = await hashPassword(b.password);
  try {
    const [row] = await query<any>(
      `INSERT INTO usuarios (name, email, password_hash, role) VALUES ($1, $2, $3, 'ADMIN')
       RETURNING id, name, email, role, avatar_url`,
      [b.name, b.email, hash]
    );
    return json(await issueTokens(toAuthUser(row), req), 201);
  } catch (e) {
    if (isUniqueViolation(e)) throw new ApiError(409, 'EMAIL_TAKEN', 'Ya existe una cuenta con ese correo');
    throw e;
  }
});
