'use client';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { api, errorMessage } from '@/lib/api';
import { prepareImage, uploadWithProgress } from '@/lib/imagen';
import { codigoOrigen } from '@/lib/rutasAdmin';
import type { PublicEvent } from '@/lib/tipos';
import type { EventTheme } from '@/lib/permisos';
import { useSession } from '@/components/ProveedorSesion';

export default function FormularioEventoWeb({ id }: { id?: string }) {
  const { user } = useSession();
  const router = useRouter();
  const params = useSearchParams();
  const from = codigoOrigen(params.get('from'));
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState('');
  const [color, setColor] = useState('#1F2937');
  const [theme, setTheme] = useState<EventTheme>('STANDARD');
  const [moderation, setModeration] = useState(true);
  const [file, setFile] = useState<File | null>(null);
  const [cover, setCover] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(!!id);
  const [loadError, setLoadError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState('');
  useEffect(() => {
    if (!id) return;
    let active = true; setLoading(true); setLoadError('');
    api<{ event: PublicEvent }>(`/admin/events/${id}`).then(({ event }) => {
      if (!active) return;
      setName(event.name); setDescription(event.description ?? ''); setColor(event.primaryColor); setTheme(event.theme); setModeration(event.moderationEnabled); setCover(event.coverImageUrl);
      if (event.eventDate) {
        const local = new Date(event.eventDate);
        local.setMinutes(local.getMinutes() - local.getTimezoneOffset());
        setDate(local.toISOString().slice(0, 16));
      }
    }).catch(e => { if (active) setLoadError(errorMessage(e)); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [id, attempt]);
  useEffect(() => {
    if (!file) { setPreview(null); return; }
    const url = URL.createObjectURL(file); setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);
  async function save(e: React.FormEvent) {
    e.preventDefault(); if (busy) return;
    setBusy(true); setError(''); setProgress(0);
    try {
      let coverKey: string | undefined;
      if (file) {
        const blob = await prepareImage(file);
        const upload = await api<{ uploadUrl: string; fields: Record<string, string>; key: string }>('/admin/uploads/cover', { method: 'POST', json: { contentType: blob.type, size: blob.size } });
        await uploadWithProgress(upload.uploadUrl, blob, upload.fields, setProgress); coverKey = upload.key;
      }
      const { event } = await api<{ event: PublicEvent }>(id ? `/events/${id}` : '/events', { method: id ? 'PATCH' : 'POST', json: {
        name: name.trim(), description: description.trim(), eventDate: date ? new Date(date).toISOString() : null,
        primaryColor: color, moderationEnabled: moderation, coverKey,
        ...(user?.role === 'SUPER_ADMIN' ? { theme } : {}),
      } });
      router.replace(`/admin/eventos/${event.id}${!id ? '?created=1' : ''}${from ? `${!id ? '&' : '?'}from=${from}` : ''}`);
    } catch (err) { setError(errorMessage(err)); setBusy(false); }
  }
  if (loading) return <p role="status">Cargando evento…</p>;
  if (loadError) return <div role="alert"><p>{loadError}</p><button className="btn btn-ghost mt-3" onClick={() => setAttempt(v => v + 1)}>Reintentar</button></div>;
  return <div className="mx-auto max-w-2xl">
    <h1 className="font-serif text-4xl">{id ? 'Edita tu evento' : 'Dale vida a tu evento'}</h1><p className="mb-8 mt-3 text-muted">{id ? 'Los cambios se verán en el mismo enlace y QR.' : 'Un nombre y ya tienes un lugar para reunir recuerdos.'}</p>
    <form onSubmit={save} className="rounded-2xl border border-line bg-white p-5 sm:p-8">
      <fieldset disabled={busy} className="space-y-6">
        <label className="block text-sm font-medium">Nombre del evento *<input required maxLength={120} value={name} onChange={e => setName(e.target.value)} className="field mt-2" placeholder="Por ejemplo, Cumpleaños de Ana" /></label>
        <label className="block text-sm font-medium">Fecha y hora (opcional)<input type="datetime-local" value={date} onChange={e => setDate(e.target.value)} className="field mt-2" /></label>
        <label className="block text-sm font-medium">Unas palabras para tus invitados<textarea maxLength={1000} value={description} onChange={e => setDescription(e.target.value)} rows={3} className="mt-2 w-full rounded-xl border border-line p-4" placeholder="Comparte tus mejores momentos con nosotros…" /></label>
        <div><label htmlFor="cover" className="block text-sm font-medium">Foto de portada (opcional)</label>
          {(preview || cover) && <img src={preview || cover!} alt="Portada del evento" className="mt-3 max-h-56 w-full rounded-xl object-contain" />}
          <input id="cover" type="file" accept="image/jpeg,image/png,image/webp" className="mt-3 block w-full text-sm" onChange={e => { setFile(e.target.files?.[0] ?? null); setError(''); }} />
          <p className="mt-2 text-xs text-muted">JPG, PNG o WebP. La imagen se optimiza antes de subir.</p>
        </div>
        <label className="flex items-center gap-4 text-sm font-medium">Color del evento<input aria-label="Color del evento" type="color" value={color} onChange={e => setColor(e.target.value)} className="h-10 w-16 cursor-pointer rounded border border-line" /></label>
        <label className="flex items-start gap-3 rounded-xl bg-paper p-4"><input type="checkbox" checked={moderation} onChange={e => setModeration(e.target.checked)} className="mt-1 h-4 w-4" /><span><span className="block text-sm font-semibold">Revisar antes de mostrar</span><span className="mt-1 block text-sm text-muted">{moderation ? 'Las fotos y videos se mostrarán cuando los apruebes desde tu panel.' : 'Las fotos y videos aparecerán automáticamente al publicarse.'}</span></span></label>
        {user?.role === 'SUPER_ADMIN' && <label className="block text-sm font-medium">Diseño del evento<select className="field mt-2" value={theme} onChange={e => setTheme(e.target.value as EventTheme)}><option value="STANDARD">Estándar</option><option value="SENATI_TEC">Senati Tec · Collage especial</option></select></label>}
      </fieldset>
      {busy && file && <p role="status" className="mt-4 text-sm">Subiendo portada… {progress}%</p>}
      {error && <p role="alert" className="mt-4 text-sm text-red-700">{error}</p>}
      <button disabled={busy || !name.trim()} className="btn btn-primary mt-7 w-full">{busy ? 'Guardando…' : id ? 'Guardar cambios' : 'Crear mi evento y obtener el QR'}</button>
      <Link href={id ? `/admin/eventos/${id}` : '/admin'} className="mt-4 block text-center text-sm text-muted">{id ? 'Volver al evento' : 'Ver mis eventos'}</Link>
    </form>
  </div>;
}
