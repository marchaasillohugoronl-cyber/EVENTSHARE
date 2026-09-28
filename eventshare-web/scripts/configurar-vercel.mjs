import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import dotenv from 'dotenv';

// Solo se envian las variables enumeradas y nunca se imprimen sus valores.
const values = dotenv.parse(readFileSync('.env.local'));
const required = ['DATABASE_URL', 'JWT_ACCESS_SECRET', 'CLOUDINARY_CLOUD_NAME', 'CLOUDINARY_API_KEY', 'CLOUDINARY_API_SECRET'];
for (const name of required) {
  if (!values[name]) throw new Error(`Falta ${name} en .env.local`);
}
const project = JSON.parse(readFileSync('.vercel/project.json', 'utf8'));
if (!project.projectId || !project.orgId) throw new Error('Primero ejecuta vercel link');
const configured = Object.fromEntries(required.map(name => [name, values[name]]));
configured.ALLOW_ADMIN_REGISTRATION = 'false';
configured.NEXT_PUBLIC_APP_URL = 'https://eventshare-fawn.vercel.app';
for (const name of ['GOOGLE_CLIENT_ID', 'NEXT_PUBLIC_GOOGLE_CLIENT_ID']) {
  if (values[name]) configured[name] = values[name];
}
for (const [name, value] of Object.entries(configured)) {
  const args = ['env', 'add', name, 'production', '--yes'];
  if (['DATABASE_URL', 'JWT_ACCESS_SECRET', 'CLOUDINARY_API_SECRET'].includes(name)) args.push('--sensitive');
  const result = spawnSync('vercel', args, { input: value, encoding: 'utf8', timeout: 60000 });
  if (result.status !== 0) {
    console.error(`No se pudo configurar ${name}; revisa la sesion y las variables del proyecto en Vercel.`);
    process.exit(1);
  }
  console.log(`${name}: configurada`);
}
