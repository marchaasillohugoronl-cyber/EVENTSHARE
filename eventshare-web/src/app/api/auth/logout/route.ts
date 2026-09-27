import { NextResponse } from 'next/server';
import { z } from 'zod';
import { api } from '@/server/http';
import { clearSessionCookie, revokeRefreshToken } from '@/server/autenticacion';

// POST /api/auth/logout  — revoca el refresh token (Android) y borra la cookie (web)
export const POST = api(async (req) => {
  const body = await req.json().catch(() => ({}));
  const parsed = z.object({ refreshToken: z.string().max(200).optional() }).safeParse(body);
  if (parsed.success && parsed.data.refreshToken) await revokeRefreshToken(parsed.data.refreshToken);
  const res = NextResponse.json({ ok: true });
  clearSessionCookie(res);
  return res;
});
