import { NextResponse } from 'next/server';
import { api, ApiError, notFound, parse } from '@/server/http';
import { guestSchema } from '@/server/validacion';
import { query } from '@/server/baseDatos';
import { getAuth, setGuestCookie, toAuthUser } from '@/server/autenticacion';
import { assertActive, ensureMember, findEvent } from '@/server/eventos';
import { clientIp, rateLimit } from '@/server/limiteSolicitudes';

// POST /api/auth/guest  — { name, eventCode }  Crea una identidad temporal y la mantiene con una cookie de 30 días
export const POST = api(async (req) => {
  await rateLimit(`guest:${clientIp(req)}`, 120, 900); // límite generoso: en una boda muchos invitados comparten IP
  const b = await parse(req, guestSchema);
  const ev = await findEvent(b.eventCode);
  if (!ev) throw notFound('Evento');
  assertActive(ev);

  const existing = await getAuth(req);
  if (existing) {
    await ensureMember(ev.id, existing.id);
    return NextResponse.json({ user: existing });
  }
  const [row] = await query<any>(
    `INSERT INTO usuarios (name, role) VALUES ($1, 'GUEST') RETURNING id, name, email, role, avatar_url`,
    [b.name]
  );
  await ensureMember(ev.id, row.id);
  const res = NextResponse.json({ user: toAuthUser(row) }, { status: 201 });
  await setGuestCookie(res, row);
  return res;
});
