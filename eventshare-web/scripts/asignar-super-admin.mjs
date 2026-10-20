// Comando operativo, nunca expuesto por la API. Solo promueve una cuenta ADMIN existente.
import dotenv from 'dotenv';
import pg from 'pg';
dotenv.config({ path: '.env.local' });
if (!process.env.DATABASE_URL) throw new Error('Falta DATABASE_URL');
const email = process.argv[2]?.trim().toLowerCase();
if (!email || !email.includes('@')) throw new Error('Uso: npm run admin:promote -- correo@ejemplo.com');
const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
try {
  await client.connect();
  const result = await client.query(`UPDATE usuarios SET role = 'SUPER_ADMIN'
    WHERE email = $1 AND role IN ('ADMIN', 'SUPER_ADMIN') RETURNING id`, [email]);
  if (result.rowCount !== 1) throw new Error('No existe una cuenta de administrador con ese correo. Regístrala primero.');
  console.log('Cuenta asignada como superadministrador. Cierra sesión y vuelve a entrar en la app.');
} finally { await client.end(); }
