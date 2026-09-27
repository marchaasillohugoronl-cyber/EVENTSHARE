'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { api, errorMessage } from '@/lib/api';
import { prepareImage, uploadWithProgress } from '@/lib/imagen';
import type { Post, PublicEvent } from '@/lib/tipos';
import { useSession } from './ProveedorSesion';

type Presign = { uploadUrl: string; key: string; fields: Record<string, string> };

export default function UploadForm({ event }: { event: PublicEvent }) {
  const router = useRouter();
  const { ensureIdentity } = useSession();
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!file) { setPreview(null); return; }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (f) { setFile(f); setError(null); }
  }

  async function publish() {
    if (!file && !message.trim()) return setError('Agrega una foto o escribe un mensaje.');
    if (!(await ensureIdentity(event.code))) return;
    setBusy(true);
    setError(null);
    setProgress(0);
    try {
      let key: string | undefined;
      if (file) {
        const blob = await prepareImage(file);
        const p = await api<Presign>(`/events/${event.id}/uploads`, { method: 'POST', json: { contentType: blob.type, size: blob.size } });
        await uploadWithProgress(p.uploadUrl, blob, p.fields, setProgress);
        key = p.key;
      }
      const r = await api<{ post: Post; requiresApproval: boolean }>(`/events/${event.id}/posts`, {
        method: 'POST', json: { photoKey: key, message: message.trim() || undefined },
      });
      if (r.requiresApproval) setPending(true);
      else router.push(`/e/${event.code}`);
    } catch (e) {
      setError(errorMessage(e));
      setBusy(false);
    }
  }

  if (pending) {
    return (
      <div className="py-16 text-center">
        <p className="font-serif text-3xl">Publicado</p>
        <p className="mx-auto mt-3 max-w-xs text-muted">Tu publicación aparecerá en el muro cuando el anfitrión la apruebe.</p>
        <Link href={`/e/${event.code}`} className="btn btn-primary mt-8">Volver al muro</Link>
      </div>
    );
  }

  return (
    <div>
      <h1 className="font-serif text-3xl">Comparte un momento</h1>

      <input ref={cameraRef} type="file" accept="image/jpeg,image/png,image/webp" capture="environment" hidden onChange={onPick} />
      <input ref={galleryRef} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={onPick} />

      {preview ? (
        <div className="mt-6 bg-white p-2.5 shadow-[0_10px_24px_-14px_rgba(0,0,0,0.35)]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={preview} alt="Vista previa de tu foto" className="max-h-[60vh] w-full object-contain" />
          <button className="mt-2 h-10 px-2 text-sm text-muted underline" onClick={() => setFile(null)} disabled={busy}>Quitar foto</button>
        </div>
      ) : (
        <div className="mt-6 grid grid-cols-2 gap-3">
          <button className="btn btn-primary h-28 flex-col" onClick={() => cameraRef.current?.click()}>
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"><path d="M4 8h3l2-3h6l2 3h3v11H4V8z" /><circle cx="12" cy="13" r="3.5" /></svg>
            Tomar foto
          </button>
          <button className="btn btn-ghost h-28 flex-col" onClick={() => galleryRef.current?.click()}>
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"><rect x="4" y="5" width="16" height="14" rx="1" /><path d="M4 16l4-4 4 4 3-3 5 5" /></svg>
            Elegir de la galería
          </button>
        </div>
      )}

      <label htmlFor="msg" className="mt-6 block text-sm font-medium">Mensaje (opcional)</label>
      <textarea id="msg" rows={3} maxLength={500} value={message} onChange={(e) => setMessage(e.target.value)}
        className="mt-2 w-full rounded-xl border border-line bg-white p-4 text-base outline-none focus:border-ink" placeholder="Escribe unas palabras para los anfitriones" />

      {busy && file && (
        <div className="mt-4" role="status" aria-live="polite">
          <div className="h-1.5 overflow-hidden rounded-full bg-line"><div className="h-full bg-brand transition-all" style={{ width: `${progress}%` }} /></div>
          <p className="mt-1 text-sm text-muted">Subiendo… {progress}%</p>
        </div>
      )}
      {error && <p role="alert" className="mt-4 text-sm text-red-700">{error}</p>}

      <button className="btn btn-primary mt-6 w-full" onClick={publish} disabled={busy || (!file && !message.trim())}>
        {busy ? 'Publicando…' : 'Publicar'}
      </button>
      {event.moderationEnabled && <p className="mt-3 text-center text-sm text-muted">Los anfitriones revisan las publicaciones antes de mostrarlas.</p>}
    </div>
  );
}
