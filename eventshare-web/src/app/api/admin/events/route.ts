import { api, json } from '@/server/http';
import { requireAdmin } from '@/server/autenticacion';
import { listOwnedEvents, toEvent } from '@/server/eventos';

// GET /api/admin/events  — eventos del administrador con contadores
export const GET = api(async (req) => {
  const admin = await requireAdmin(req);
  const rows = await listOwnedEvents(admin.id);
  return json({
    items: rows.map((r) => ({
      ...toEvent(r),
      photosCount: r.photos_count,
      pendingCount: r.pending_count,
      guestsCount: r.guests_count,
    })),
  });
});
