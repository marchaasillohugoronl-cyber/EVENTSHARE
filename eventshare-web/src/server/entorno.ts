import { resolverUrlPublica } from '../lib/urlPublica';

// Lectura perezosa de variables de entorno: falla solo cuando se usa una que falta.
function req(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Falta la variable de entorno ${name}`);
  return v;
}

export const env = {
  get databaseUrl() { return req('DATABASE_URL'); },
  get jwtAccessSecret() { return req('JWT_ACCESS_SECRET'); },
  get appUrl() {
    const vercelHost = process.env.VERCEL_PROJECT_PRODUCTION_URL;
    return resolverUrlPublica(process.env.NEXT_PUBLIC_APP_URL, vercelHost);
  },
  get allowedOrigins() {
    return (process.env.ALLOWED_ORIGINS || '').split(',').map((s) => s.trim()).filter(Boolean);
  },
  get googleClientId() { return process.env.GOOGLE_CLIENT_ID || ''; },
  get cloudinaryCloudName() { return req('CLOUDINARY_CLOUD_NAME'); },
  get cloudinaryApiKey() { return req('CLOUDINARY_API_KEY'); },
  get cloudinaryApiSecret() { return req('CLOUDINARY_API_SECRET'); },
  get isProd() { return process.env.NODE_ENV === 'production'; },
};
