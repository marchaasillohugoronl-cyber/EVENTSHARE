import { OAuth2Client } from 'google-auth-library';
import { env } from './entorno';
import { ApiError } from './http';
import { tx, isUniqueViolation } from './baseDatos';
import { toAuthUser } from './autenticacion';

export async function authenticateGoogle(idToken: string, admin = false, guestId?: string) {
  if (!env.googleClientId) throw new ApiError(503, 'GOOGLE_DISABLED', 'El inicio con Google no está configurado');
  let payload;
  try {
    const ticket = await new OAuth2Client(env.googleClientId).verifyIdToken({ idToken, audience: env.googleClientId });
    payload = ticket.getPayload();
  } catch {
    throw new ApiError(401, 'INVALID_GOOGLE_TOKEN', 'No se pudo verificar tu cuenta de Google');
  }
  if (!payload?.sub || !payload.email_verified || !payload.email) throw new ApiError(401, 'INVALID_GOOGLE_TOKEN', 'Cuenta de Google no verificada');
  const { sub, email, picture } = payload;
  const name = (payload.name || email).slice(0, 80);
  const emailTaken = () => new ApiError(409, 'EMAIL_TAKEN', 'Ese correo ya tiene otra cuenta. Entra con tu contraseña o usa otra cuenta de Google.');
  try {
    return await tx(async (client) => {
      // Serializa el registro del mismo Google ID, incluidas solicitudes simultáneas web/app.
      await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [sub]);
      let user = (await client.query('SELECT * FROM usuarios WHERE google_id = $1 FOR UPDATE', [sub])).rows[0];
      const needsAdmin = admin && (!user || user.role === 'GUEST');
      if (needsAdmin && process.env.ALLOW_ADMIN_REGISTRATION === 'false') {
        throw new ApiError(403, 'REGISTRATION_DISABLED', 'El registro de administradores está deshabilitado');
      }
      if (!user || (needsAdmin && !user.email)) {
        const taken = (await client.query('SELECT id FROM usuarios WHERE email = $1', [email])).rows[0];
        if (taken && admin) throw emailTaken();
        if (!user && admin && !taken && guestId) {
          // Solo la identidad anónima de la cookie autenticada puede convertirse in situ.
          // Un Google ID ya existente nunca se fusiona automáticamente con otra cuenta.
          user = (await client.query(`UPDATE usuarios SET email = $2, google_id = $3, avatar_url = $4, role = 'ADMIN'
            WHERE id = $1 AND role = 'GUEST' AND google_id IS NULL AND email IS NULL RETURNING *`,
            [guestId, email, sub, picture ?? null])).rows[0];
        }
        if (!user) {
          user = (await client.query(`INSERT INTO usuarios (name, email, google_id, avatar_url, role)
            VALUES ($1, $2, $3, $4, $5) RETURNING *`, [name, taken ? null : email, sub, picture ?? null, admin ? 'ADMIN' : 'GUEST'])).rows[0];
        } else {
          user = (await client.query('UPDATE usuarios SET email = $2 WHERE id = $1 RETURNING *', [user.id, email])).rows[0];
        }
      }
      // La entrada por QR nunca promueve invitados; el registro de administrador nunca concede SUPER_ADMIN.
      if (admin && user.role === 'GUEST') {
        user = (await client.query("UPDATE usuarios SET role = 'ADMIN' WHERE id = $1 RETURNING *", [user.id])).rows[0];
      }
      return toAuthUser(user);
    });
  } catch (e) {
    if (isUniqueViolation(e)) throw emailTaken();
    throw e;
  }
}
