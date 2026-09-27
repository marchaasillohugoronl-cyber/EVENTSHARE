import { api, json, parseQuery } from '@/server/http';
import { pageQuery } from '@/server/validacion';
import { requireAdmin } from '@/server/autenticacion';
import { requireOwnedEvent } from '@/server/eventos';
import { listPosts } from '@/server/publicaciones';

// GET /api/admin/events/:id/posts?status=PENDING|APPROVED|REJECTED&hasMessage=1&photos=1&cursor=&limit=
export const GET = api<{ id: string }>(async (req, { params }) => {
  const admin = await requireAdmin(req);
  const ev = await requireOwnedEvent(params.id, admin);
  const q = parseQuery(req, pageQuery);
  return json(
    await listPosts({
      eventId: ev.id, status: q.status, viewerId: admin.id, cursor: q.cursor, limit: q.limit ?? 20,
      hasPhoto: q.photos === '1', hasMessage: q.hasMessage === '1',
    })
  );
});
