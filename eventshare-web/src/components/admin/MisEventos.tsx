'use client';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { api, errorMessage } from '@/lib/api';
import { formatDate } from '@/lib/formato';
import type { PublicEvent } from '@/lib/tipos';
type Summary = PublicEvent & { photosCount: number; pendingCount: number; guestsCount: number };
export default function MisEventos() {
  const [events, setEvents] = useState<Summary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const load = useCallback(async () => {
    setLoading(true); setError('');
    try { setEvents((await api<{ items: Summary[] }>('/admin/events')).items); }
    catch (e) { setError(errorMessage(e)); } finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);
  return <>
    <div className="mb-8 flex flex-wrap items-center justify-between gap-5"><div><h1 className="font-serif text-4xl">Mis eventos</h1><p className="mt-2 text-muted">Un espacio para cada celebración.</p></div><Link href="/admin/nuevo" className="btn btn-primary">+ Crear evento</Link></div>
    {loading && <p role="status">Cargando tus eventos…</p>}
    {error && <div role="alert"><p>{error}</p><button onClick={load} className="btn btn-ghost mt-3">Reintentar</button></div>}
    {!loading && !error && !events.length && <div className="rounded-3xl border border-dashed border-line bg-white px-6 py-16 text-center"><h2 className="font-serif text-3xl">Tu primer evento empieza aquí</h2><p className="mt-3 text-muted">Ponle nombre, comparte el QR y deja que lleguen los recuerdos.</p><Link href="/admin/nuevo" className="btn btn-primary mt-6">Crear mi primer evento</Link></div>}
    <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{events.map(event => <Link key={event.id} href={`/admin/eventos/${event.id}`} className="overflow-hidden rounded-2xl border border-line bg-white">
      {event.coverImageUrl ? <img src={event.coverImageUrl} alt="" className="h-40 w-full object-cover" /> : <div className="flex h-40 items-end p-5 text-5xl font-semibold" style={{ background: `${event.primaryColor}20`, color: event.primaryColor }}>{event.name.slice(0, 1)}</div>}
      <div className="p-5"><p className="text-xs text-muted">{event.status === 'ACTIVE' ? 'Activo' : event.status === 'CLOSED' ? 'Cerrado' : 'Archivado'}{event.theme === 'SENATI_TEC' ? ' · Senati Tec' : ''}</p><h2 className="mt-2 break-words font-serif text-2xl">{event.name}</h2><p className="mt-2 text-sm text-muted">{formatDate(event.eventDate)}</p><p className="mt-5 text-sm">{event.photosCount} recuerdos · {event.guestsCount} invitados</p>{event.pendingCount > 0 && <p className="mt-2 text-sm font-semibold text-amber-800">{event.pendingCount} por aprobar</p>}</div>
    </Link>)}</div>
  </>;
}
