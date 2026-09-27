import { NextResponse } from 'next/server';
import QRCode from 'qrcode';
import { api } from '@/server/http';
import { requireAdmin } from '@/server/autenticacion';
import { eventUrl, requireOwnedEvent } from '@/server/eventos';

// GET /api/admin/events/:id/qr?format=png|svg&download=1  — código QR del evento
export const GET = api<{ id: string }>(async (req, { params }) => {
  const admin = await requireAdmin(req);
  const ev = await requireOwnedEvent(params.id, admin);
  const url = eventUrl(ev.event_code);
  const sp = req.nextUrl.searchParams;
  const svg = sp.get('format') === 'svg';
  const headers: Record<string, string> = { 'Cache-Control': 'private, max-age=3600' };
  if (sp.get('download') === '1') headers['Content-Disposition'] = `attachment; filename="eventshare-${ev.event_code}.${svg ? 'svg' : 'png'}"`;

  if (svg) {
    const body = await QRCode.toString(url, { type: 'svg', margin: 2, errorCorrectionLevel: 'M' });
    return new NextResponse(body, { headers: { ...headers, 'Content-Type': 'image/svg+xml' } });
  }
  const png = await QRCode.toBuffer(url, { type: 'png', width: 1024, margin: 2, errorCorrectionLevel: 'M' });
  return new NextResponse(new Uint8Array(png), { headers: { ...headers, 'Content-Type': 'image/png' } });
});
