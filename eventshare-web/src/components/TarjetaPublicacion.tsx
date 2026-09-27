'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { api, errorMessage } from '@/lib/api';
import { timeAgo } from '@/lib/formato';
import type { Post } from '@/lib/tipos';
import { useSession } from './ProveedorSesion';

export function Avatar({ name, url, size = 36 }: { name: string; url: string | null; size?: number }) {
  if (url) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={url} alt="" referrerPolicy="no-referrer" width={size} height={size} className="rounded-full object-cover" style={{ width: size, height: size }} />;
  }
  return (
    <span className="grid place-items-center rounded-full bg-brand/15 font-semibold text-brand" style={{ width: size, height: size, fontSize: size * 0.42 }}>
      {name.trim().charAt(0).toUpperCase() || '?'}
    </span>
  );
}

export default function PostCard({ post, code, readOnly = false }: { post: Post; code: string; readOnly?: boolean }) {
  const { ensureIdentity } = useSession();
  const [liked, setLiked] = useState(post.likedByMe);
  const [likes, setLikes] = useState(post.likesCount);
  const [pop, setPop] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { setLiked(post.likedByMe); setLikes(post.likesCount); }, [post.likedByMe, post.likesCount]);

  async function toggleLike() {
    if (readOnly) return;
    if (!(await ensureIdentity(code))) return;
    const prev = { liked, likes };
    setLiked(!liked);
    setLikes(likes + (liked ? -1 : 1));
    setPop(true);
    setError(null);
    try {
      const r = await api<{ liked: boolean; likesCount: number }>(`/posts/${post.id}/like`, { method: 'POST' });
      setLiked(r.liked);
      setLikes(r.likesCount);
    } catch (e) {
      setLiked(prev.liked);
      setLikes(prev.likes);
      setError(errorMessage(e));
    }
  }

  const href = `/e/${code}/post/${post.id}`;
  return (
    <article className="rounded-sm bg-white p-2.5 pb-4 shadow-[0_1px_0_rgba(0,0,0,0.06),0_10px_24px_-14px_rgba(0,0,0,0.35)]">
      {post.photoUrl && (
        <Link href={href} className="block bg-line/50">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={post.photoUrl} alt={post.message ? `Foto de ${post.author.name}: ${post.message}` : `Foto de ${post.author.name}`}
            loading="lazy" decoding="async" className="block h-auto min-h-48 w-full" />
        </Link>
      )}
      <div className="px-1.5 pt-3">
        {post.message && <p className="whitespace-pre-line break-words font-serif text-[19px] leading-snug">{post.message}</p>}
        <div className="mt-3 flex items-center gap-2.5">
          <Avatar name={post.author.name} url={post.author.avatarUrl} size={28} />
          <span className="truncate text-sm font-medium">{post.author.name}</span>
          <span className="text-sm text-muted">{timeAgo(post.createdAt)}</span>
          <div className="ml-auto flex items-center gap-1">
            <button onClick={toggleLike} aria-pressed={liked} aria-label={liked ? 'Quitar me gusta' : 'Me gusta'}
              className="flex h-10 items-center gap-1.5 rounded-full px-3 text-sm">
              <svg viewBox="0 0 24 24" width="20" height="20" className={pop ? 'animate-pop' : ''} onAnimationEnd={() => setPop(false)}
                fill={liked ? 'rgb(var(--brand-rgb))' : 'none'} stroke={liked ? 'rgb(var(--brand-rgb))' : 'currentColor'} strokeWidth="1.8">
                <path d="M12 20.5s-7.5-4.6-9.3-9.2C1.5 8 3.4 5 6.4 5c1.9 0 3.4 1 4.4 2.5h.4C12.2 6 13.7 5 15.6 5c3 0 4.9 3 3.7 6.3-1.8 4.6-7.3 9.2-7.3 9.2z" strokeLinejoin="round" />
              </svg>
              <span className="tabular-nums">{likes}</span>
            </button>
            <Link href={href} aria-label="Ver comentarios" className="flex h-10 items-center gap-1.5 rounded-full px-3 text-sm">
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round">
                <path d="M4 5h16v11H9l-5 4V5z" />
              </svg>
              <span className="tabular-nums">{post.commentsCount}</span>
            </Link>
          </div>
        </div>
        {error && <p role="alert" className="mt-1 text-sm text-red-700">{error}</p>}
      </div>
    </article>
  );
}
