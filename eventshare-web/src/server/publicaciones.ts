import { query } from './baseDatos';

export type PostStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export function encodeCursor(ts: string, id: string): string {
  return Buffer.from(`${ts}|${id}`).toString('base64url');
}
export function decodeCursor(c?: string | null): { ts: string; id: string } | null {
  if (!c) return null;
  try {
    const [ts, id] = Buffer.from(c, 'base64url').toString().split('|');
    if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{6}Z$/.test(ts) || !/^[0-9a-f-]{36}$/i.test(id)) return null;
    return { ts, id };
  } catch {
    return null;
  }
}

const TS_FMT = `to_char(%s AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"')`;
export const tsSql = (col: string) => TS_FMT.replace('%s', col);

export function toPost(r: any) {
  return {
    id: r.id,
    eventId: r.event_id,
    photoUrl: r.photo_url,
    message: r.message,
    status: r.status as PostStatus,
    likesCount: r.likes_count,
    commentsCount: r.comments_count,
    createdAt: r.created_at,
    likedByMe: !!r.liked_by_me,
    author: { id: r.user_id, name: r.user_name, avatarUrl: r.avatar_url },
  };
}

export type PostFilter = {
  eventId: string;
  status?: PostStatus;
  hasPhoto?: boolean;
  hasMessage?: boolean;
  viewerId?: string | null;
  cursor?: string | null;
  limit?: number;
};

/** Lista publicaciones con paginación por cursor (created_at DESC, id DESC). */
export async function listPosts(f: PostFilter) {
  const limit = Math.min(Math.max(f.limit ?? 12, 1), 50);
  const params: unknown[] = [f.eventId, f.viewerId ?? null];
  const where = ['p.event_id = $1', 'p.deleted_at IS NULL'];
  if (f.status) { params.push(f.status); where.push(`p.status = $${params.length}`); }
  if (f.hasPhoto) where.push('p.photo_url IS NOT NULL');
  if (f.hasMessage) where.push(`p.message IS NOT NULL`);
  const c = decodeCursor(f.cursor);
  if (c) {
    params.push(c.ts, c.id);
    where.push(`(p.created_at, p.id) < ($${params.length - 1}::timestamptz, $${params.length}::uuid)`);
  }
  params.push(limit + 1);
  const rows = await query<any>(
    `SELECT p.id, p.event_id, p.photo_url, p.message, p.status, p.likes_count, p.comments_count, p.created_at,
            ${tsSql('p.created_at')} AS cursor_ts,
            u.id AS user_id, u.name AS user_name, u.avatar_url,
            EXISTS (SELECT 1 FROM me_gusta l WHERE l.post_id = p.id AND l.user_id = $2::uuid) AS liked_by_me
       FROM publicaciones p JOIN usuarios u ON u.id = p.user_id
      WHERE ${where.join(' AND ')}
      ORDER BY p.created_at DESC, p.id DESC
      LIMIT $${params.length}`,
    params
  );
  const page = rows.slice(0, limit);
  const last = page[page.length - 1];
  return {
    items: page.map(toPost),
    nextCursor: rows.length > limit && last ? encodeCursor(last.cursor_ts, last.id) : null,
  };
}

/** Una publicación aprobada (o cualquiera si `includeAll`). */
export async function getPost(id: string, viewerId: string | null, includeAll = false) {
  const rows = await query<any>(
    `SELECT p.id, p.event_id, p.photo_url, p.message, p.status, p.likes_count, p.comments_count, p.created_at,
            u.id AS user_id, u.name AS user_name, u.avatar_url,
            EXISTS (SELECT 1 FROM me_gusta l WHERE l.post_id = p.id AND l.user_id = $2::uuid) AS liked_by_me
       FROM publicaciones p JOIN usuarios u ON u.id = p.user_id
      WHERE p.id = $1 AND p.deleted_at IS NULL ${includeAll ? '' : "AND p.status = 'APPROVED'"}`,
    [id, viewerId]
  );
  return rows[0] ? toPost(rows[0]) : null;
}
