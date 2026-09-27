import { api, json } from '@/server/http';
import { getAuth } from '@/server/autenticacion';

// GET /api/auth/me  — usuario actual o null
export const GET = api(async (req) => {
  return json({ user: await getAuth(req) });
});
