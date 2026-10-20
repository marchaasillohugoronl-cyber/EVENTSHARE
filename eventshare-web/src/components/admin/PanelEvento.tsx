'use client';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { api, errorMessage } from '@/lib/api';
import { esVideo } from '@/lib/video';
import type { Page, Post, PublicEvent } from '@/lib/tipos';

type Detail = { event: PublicEvent; stats: { photos: number; guests: number; pending: number } };
export default function PanelEvento({ id }: { id: string }) {
  const params = useSearchParams();
  const [detail, setDetail] = useState<Detail | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Post['status']>('PENDING');
  const [posts, setPosts] = useState<Post[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [postsError, setPostsError] = useState('');
  const [postsLoading, setPostsLoading] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState('');
  const generation = useRef(0);
  const loadDetail = useCallback(async () => {
    setError('');
    try { setDetail(await api<Detail>(`/admin/events/${id}`)); }
    catch (e) { setError(errorMessage(e)); } finally { setLoading(false); }
  }, [id]);
  useEffect(() => { void loadDetail(); }, [loadDetail]);
  const loadPosts = useCallback(async (next?: string) => {
    const current = ++generation.current;
    setPostsLoading(true); setPostsError('');
    try {
      const page = await api<Page<Post>>(`/admin/events/${id}/posts?status=${tab}&limit=20${next ? `&cursor=${encodeURIComponent(next)}` : ''}`);
      if (generation.current !== current) return;
      setPosts(prev => next ? [...prev, ...page.items.filter(p => !prev.some(old => old.id === p.id))] : page.items); setCursor(page.nextCursor);
    } catch (e) { if (generation.current === current) setPostsError(errorMessage(e)); }
    finally { if (generation.current === current) setPostsLoading(false); }
  }, [id, tab]);
  useEffect(() => { setPosts([]); setCursor(null); void loadPosts(); return () => { generation.current++; }; }, [loadPosts]);
  useEffect(() => {
    const timer = setInterval(() => { if (document.visibilityState === 'visible' && !busy) void loadDetail(); }, 15000);
    return () => clearInterval(timer);
  }, [loadDetail, busy]);
  useEffect(() => {
    const refresh = () => {
      if (document.visibilityState === 'visible' && !busy && !postsLoading && posts.length <= 20) void loadPosts();
    };
    const timer = setInterval(refresh, 8000);
    document.addEventListener('visibilitychange', refresh);
    return () => { clearInterval(timer); document.removeEventListener('visibilitychange', refresh); };
  }, [loadPosts, busy, postsLoading, posts.length]);
  async function moderate(post: Post, status: Post['status']) {
    setBusy(post.id); setPostsError('');
    try {
      await api(`/posts/${post.id}/moderation`, { method: 'PATCH', json: { status } });
      setPosts(prev => prev.filter(p => p.id !== post.id));
      setNotice(status === 'APPROVED' ? 'Publicación aprobada. Aparecerá en el muro y en la TV en unos segundos.' : 'Publicación rechazada.');
      await loadDetail();
    } catch (e) { setPostsError(errorMessage(e)); } finally { setBusy(null); }
  }
  async function changeStatus(status: PublicEvent['status']) {
    if (status === 'ARCHIVED' && !window.confirm('¿Archivar el evento? El álbum dejará de estar disponible para los invitados.')) return;
    setBusy('status'); setError('');
    try { await api(`/events/${id}`, { method: 'PATCH', json: { status } }); await loadDetail(); }
    catch (e) { setError(errorMessage(e)); } finally { setBusy(null); }
  }
  async function copyLink() {
    if (!detail) return;
    try { await navigator.clipboard.writeText(detail.event.url); setNotice('Enlace copiado. Ya puedes compartirlo.'); }
    catch { setNotice('No se pudo copiar automáticamente. Selecciona y copia el enlace que aparece debajo del QR.'); }
  }
  if (loading) return <p role="status">Cargando tu evento…</p>;
  if (!detail) return <div role="alert"><p>{error || 'No se encontró el evento.'}</p><button className="btn btn-ghost mt-3" onClick={loadDetail}>Reintentar</button></div>;
  const { event, stats } = detail;
  return <>
    {params.get('created') === '1' && <p role="status" className="mb-6 rounded-xl bg-emerald-50 p-4 text-emerald-900">Tu evento está listo. Comparte el QR para recibir las primeras fotos.</p>}
    <div className="flex flex-wrap items-start justify-between gap-5"><div><p className="mb-2 text-xs font-semibold uppercase tracking-widest text-muted">{event.status === 'ACTIVE' ? 'Evento activo' : event.status === 'CLOSED' ? 'Evento cerrado' : 'Evento archivado'}{event.theme === 'SENATI_TEC' ? ' · Senati Tec' : ''}</p><h1 className="break-words font-serif text-4xl">{event.name}</h1></div><Link href={`/admin/eventos/${id}/editar`} className="btn btn-ghost">Editar evento</Link></div>
    {error && <p role="alert" className="mt-4 text-red-700">{error}</p>}
    <div className="my-8 grid gap-6 md:grid-cols-[1fr_300px]">
      <section className="rounded-2xl border border-line bg-white p-6"><h2 className="font-serif text-2xl">Invita a compartir</h2><p className="mt-3 text-muted">Muestra el QR en tu evento. Tus invitados podrán ver y subir fotos y videos desde su teléfono.</p>
        <div className="my-6 grid grid-cols-3 gap-3 text-center">{[[stats.photos, 'recuerdos'], [stats.guests, 'invitados'], [stats.pending, 'por aprobar']].map(([value, label]) => <div key={label}><p className="text-3xl font-semibold">{value}</p><p className="mt-1 text-xs text-muted">{label}</p></div>)}</div>
        <div className="flex flex-wrap gap-3"><button className="btn btn-primary" onClick={copyLink}>Copiar enlace de invitados</button><Link className="btn btn-ghost" href={`/e/${event.code}`} target="_blank" rel="noopener noreferrer">Panel de invitados ↗</Link><Link className="btn btn-ghost" href={`/tv/${event.code}`} target="_blank" rel="noopener noreferrer">Abrir vista TV ↗</Link></div>
        <p className="mt-5 text-sm text-muted">{event.moderationEnabled ? 'Revisión activada: las fotos llegan a Pendientes. Apruébalas abajo para mostrarlas en el muro y en la TV.' : 'Publicación directa: los recuerdos aparecen automáticamente en el muro y en la TV.'}</p>
        {stats.pending > 0 && <p role="status" className="mt-3 rounded-xl bg-amber-50 p-4 text-sm text-amber-900">Hay {stats.pending} publicación(es) recibida(s) que todavía no se muestran. <button className="font-semibold underline" onClick={() => { setTab('PENDING'); document.getElementById('moderation-title')?.scrollIntoView({ behavior: 'smooth' }); }}>Revisar pendientes</button></p>}
        <details className="mt-5 border-t border-line pt-4"><summary className="cursor-pointer text-sm">Estado del evento</summary><div className="mt-3 flex flex-wrap gap-2">
          {event.status !== 'ACTIVE' && <button disabled={!!busy} className="btn btn-ghost" onClick={() => changeStatus('ACTIVE')}>Reabrir evento</button>}
          {event.status === 'ACTIVE' && <button disabled={!!busy} className="btn btn-ghost" onClick={() => changeStatus('CLOSED')}>Cerrar subidas</button>}
          {event.status !== 'ARCHIVED' && <button disabled={!!busy} className="btn btn-ghost" onClick={() => changeStatus('ARCHIVED')}>Archivar evento</button>}
        </div></details>
      </section>
      <section className="flex flex-col items-center rounded-2xl border border-line bg-white p-5" aria-label="QR de tu evento"><img src={`/api/admin/events/${id}/qr`} alt={`QR de ${event.name}`} width={220} height={220} className="max-w-full" /><p className="text-sm font-semibold tracking-widest">{event.code}</p><a href={event.url} className="mt-3 max-w-full break-all text-center text-xs text-muted underline">{event.url}</a><a href={`/api/admin/events/${id}/qr?download=1`} download className="btn btn-ghost mt-4">Descargar QR</a></section>
    </div>
    {notice && <p role="status" className="mb-5 rounded-lg bg-white p-4 text-sm">{notice}</p>}
    <section aria-labelledby="moderation-title"><div className="mb-4 flex flex-wrap items-center justify-between gap-3"><h2 id="moderation-title" className="font-serif text-3xl">Publicaciones</h2><button className="text-sm underline" onClick={() => { void loadPosts(); void loadDetail(); }} disabled={postsLoading || !!busy}>Actualizar</button></div>
      <div className="mb-6 flex flex-wrap gap-2" aria-label="Filtrar publicaciones">{(['PENDING', 'APPROVED', 'REJECTED'] as const).map(status => <button key={status} aria-pressed={status === tab} disabled={!!busy} className={`btn ${status === tab ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setTab(status)}>{{ PENDING: 'Pendientes', APPROVED: 'Aprobadas', REJECTED: 'Rechazadas' }[status]}</button>)}</div>
      {postsError && <div role="alert" className="mb-4 text-red-700"><p>{postsError}</p><button className="underline" onClick={() => loadPosts()}>Reintentar</button></div>}
      {!postsLoading && !postsError && !posts.length && <p className="rounded-xl border border-dashed border-line p-10 text-center text-muted">No hay publicaciones en esta sección.</p>}
      <div className="grid items-start gap-5 sm:grid-cols-2 lg:grid-cols-3">{posts.map(post => <article key={post.id} className="overflow-hidden rounded-xl border border-line bg-white">
        {post.photoUrl && (esVideo(post.photoUrl) ? <video src={post.photoUrl} controls playsInline preload="metadata" className="max-h-80 w-full bg-black" /> : <img src={post.photoUrl} alt={`Foto de ${post.author.name}`} loading="lazy" className="max-h-80 w-full object-contain" />)}
        <div className="p-4"><p className="font-semibold">{post.author.name}</p>{post.message && <p className="mt-2 whitespace-pre-line break-words text-sm">{post.message}</p>}<div className="mt-4 flex flex-wrap gap-2">{post.status !== 'APPROVED' && <button disabled={!!busy} onClick={() => moderate(post, 'APPROVED')} className="btn btn-primary">Aprobar</button>}{post.status !== 'REJECTED' && <button disabled={!!busy} onClick={() => moderate(post, 'REJECTED')} className="btn btn-ghost">Rechazar</button>}</div></div>
      </article>)}</div>
      {postsLoading && <p role="status" className="py-6 text-center">Cargando publicaciones…</p>}
      {cursor && <button className="btn btn-ghost mt-5" disabled={postsLoading || !!busy} onClick={() => loadPosts(cursor)}>Cargar más</button>}
    </section>
  </>;
}
