import { api, json } from '@/server/http';
import { env } from '@/server/entorno';

// El OAuth client ID es público; nunca se expone un client secret.
export const GET = api(async () => json({ clientId: env.googleClientId || null }));
