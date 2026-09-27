'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { api, errorMessage } from '@/lib/api';
import type { Page, Post, PublicEvent } from '@/lib/tipos';
import PostCard from './TarjetaPublicacion';

const POLL_MS = 8000;

/**
 * mode "feed": muro con tarjetas. mode "grid": álbum de fotos en cuadrícula.
 * Scroll infinito con cursor + actualización casi en tiempo real (polling de la primera página cada 8 s
 * mientras la pestaña está visible).
 */
export default function Feed({ event, mode = 'feed' }: { event: PublicEvent; mode?: 'feed' | 'grid' }) {
  const limit = mode === 'grid' ? 24 : 10;
  const base = `/events/${event.id}/posts?limit=${limit}${mode === 'grid' ? '&photos=1' : ''}`;
  const [items, setItems] = useState<Post[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const busy = useRef(false);
  const sentinel = useRef<HTMLDivElement>(null);
  const cursorRef = useRef<string | null>(null);
  const started = useRef(false);
  cursorRef.current = cursor;

  const loadMore = useCallback(async (first = false) => {
    if (busy.current || (!first && !cursorRef.current)) return;
    busy.current = true;
    setLoading(true);
    try {
      const page = await api<Page<Post>>(first ? base : `${base}&cursor=${encodeURIComponent(cursorRef.current!)}`);
      setItems((prev) => {
        const seen = new Set(prev.map((p) => p.id));
        return [...prev, ...page.items.filter((p) => !seen.has(p.id))];
      });
      setCursor(page.nextCursor);
      setError(null);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      busy.current = false;
      setLoading(false);
    }
  }, [base]);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    loadMore(true);
  }, [loadMore]);

  // Scroll infinito
  useEffect(() => {
    const el = sentinel.current;
    if (!el) return;
    const io = new IntersectionObserver((entries) => entries[0].isIntersecting && loadMore(), { rootMargin: '600px' });
    io.observe(el);
    return () => io.disconnect();
  }, [loadMore]);

  // Tiempo real (polling): fusiona la primera página con lo ya cargado
  useEffect(() => {
    const refresh = async () => {
      if (document.visibilityState !== 'visible' || busy.current) return;
      try {
        const page = await api<Page<Post>>(base);
        const fresh = page.items;
        setItems((prev) => {
          if (!prev.length && !fresh.length) return prev;
          const ids = new Set(fresh.map((p) => p.id));
          const full = page.nextCursor !== null;
          const oldest = fresh.length ? fresh[fresh.length - 1].createdAt : null;
          const kept = full && oldest ? prev.filter((p) => !ids.has(p.id) && p.createdAt < oldest) : [];
          return [...fresh, ...kept];
        });
        if (page.nextCursor === null) setCursor(null);
      } catch { /* silencioso: se reintenta en el siguiente ciclo */ }
    };
    const t = setInterval(refresh, POLL_MS);
    const onVis = () => document.visibilityState === 'visible' && refresh();
    document.addEventListener('visibilitychange', onVis);
    return () => { clearInterval(t); document.removeEventListener('visibilitychange', onVis); };
  }, [base]);

  const closed = event.status !== 'ACTIVE';

  return (
    <div>
      {!loading && !items.length && !error && (
        <div className="rounded-2xl border border-dashed border-line px-6 py-14 text-center">
          <p className="font-serif text-2xl">Aún no hay publicaciones</p>
          {!closed && <><p className="mt-2 text-muted">Sé el primero en compartir un momento.</p>
            <Link href={`/e/${event.code}/upload`} className="btn btn-primary mt-6">Subir foto</Link></>}
        </div>
      )}

      {mode === 'grid' ? (
        <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
          {items.map((p) => (
            <Link key={p.id} href={`/e/${event.code}/post/${p.id}`} className="relative block aspect-square overflow-hidden bg-line/50">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p.photoUrl!} alt={`Foto de ${p.author.name}`} loading="lazy" decoding="async" className="h-full w-full object-cover" />
            </Link>
          ))}
        </div>
      ) : (
        <div className="space-y-7">
          {items.map((p) => <PostCard key={p.id} post={p} code={event.code} readOnly={closed} />)}
        </div>
      )}

      {loading && <p className="py-8 text-center text-sm text-muted" role="status">Cargando…</p>}
      {error && (
        <div className="py-8 text-center" role="alert">
          <p className="text-sm text-red-700">{error}</p>
          <button className="btn btn-ghost mt-3 h-10" onClick={() => loadMore(items.length === 0)}>Reintentar</button>
        </div>
      )}
      <div ref={sentinel} className="h-px" />
    </div>
  );
}
