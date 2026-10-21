'use client';

import Link from 'next/link';
import { Camera, Images, Upload, Check } from 'lucide-react';
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
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [phase, setPhase] = useState('');
  const publishing = useRef(false);
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!file) { setPreview(null); return; }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = e.target.files?.[0];
    e.target.value = '';
    if (!selected) return;
    setError(null);
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(selected.type)) {
      setError('Selecciona una foto JPG, PNG o WebP.');
      return;
    }
    setFile(selected);
  }

  async function publish() {
    if (!file) return setError('Agrega una foto.');
    if (publishing.current) return;
    publishing.current = true;
    setBusy(true);
    setError(null);
    setProgress(0);
    try {
      setPhase('Preparando tu publicación…');
      if (!(await ensureIdentity(event.code))) return;
      let key: string | undefined;
      if (file) {
        const blob = await prepareImage(file);
        const p = await api<Presign>(`/events/${event.id}/uploads`, { method: 'POST', json: { contentType: blob.type, size: blob.size } });
        setPhase('Subiendo tu momento…');
        await uploadWithProgress(p.uploadUrl, blob, p.fields, setProgress);
        key = p.key;
      }
      setPhase('Guardando la publicación…');
      const r = await api<{ post: Post; requiresApproval: boolean }>(`/events/${event.id}/posts`, {
        method: 'POST', json: { photoKey: key },
      });
      if (r.requiresApproval) setPending(true);
      else router.push(`/e/${event.code}`);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      publishing.current = false;
      setBusy(false);
    }
  }

  if (pending) {
    return (
      <div className="py-16 text-center">
        <p className="font-serif text-3xl">Recibido · Pendiente de aprobación</p>
        <p className="mx-auto mt-3 max-w-xs text-muted">Tu publicación se guardó correctamente. Aparecerá en el muro y en la TV cuando el anfitrión la apruebe. No necesitas volver a subirla.</p>
        <Link href={`/e/${event.code}`} className="btn btn-primary mt-8">Volver al muro</Link>
      </div>
    );
  }

  return (
    <div className="upload-flow">
      <header>
        <h1 className="font-serif text-3xl">Comparte un momento</h1>
        <p className="mt-2 text-sm text-muted">Toma una foto o elige una de tu galería.</p>
      </header>
      <input ref={cameraRef} type="file" accept="image/jpeg,image/png,image/webp" capture="environment" hidden onChange={onPick} />
      <input ref={galleryRef} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={onPick} />

      {preview && file ? (
        <section className="upload-preview" aria-label="Vista previa de tu publicación">
          <div className="upload-preview-heading"><span><Check size={16} aria-hidden="true" />Tu momento está listo</span>
            <button type="button" onClick={() => setFile(null)} disabled={busy}>Cambiar</button>
          </div>
          <img src={preview} alt="Vista previa de tu foto" />
        </section>
      ) : (
        <div className="upload-options">
          <button type="button" className="btn btn-primary" onClick={() => cameraRef.current?.click()} disabled={busy}>
            <Camera aria-hidden="true" />Tomar foto
          </button>
          <button type="button" className="btn btn-ghost" onClick={() => galleryRef.current?.click()} disabled={busy}>
            <Images aria-hidden="true" />Elegir de la galería
          </button>
          <p className="text-center text-xs text-muted upload-gallery">Fotos JPG, PNG o WebP.</p>
        </div>
      )}

      <div className="upload-publish-bar">
        {error && <p role="alert" className="mb-2 text-sm text-red-700">{error}</p>}
        {busy && <div className="mb-3" role="status" aria-live="polite">
          <progress className="upload-progress" value={progress} max={100} aria-label="Progreso de subida" />
          <p className="mt-1 text-sm">{phase}{phase.startsWith('Subiendo') ? ` ${progress}%` : ''}</p>
        </div>}
        <button type="button" className="btn btn-primary w-full" onClick={publish} disabled={busy || !file}>
          <Upload size={20} aria-hidden="true" />{busy ? 'Publicando…' : 'Publicar momento'}
        </button>
        {!file && !busy && <p className="mt-2 text-center text-xs text-muted">Selecciona una foto para continuar.</p>}
        {event.moderationEnabled && <p className="mt-2 text-center text-xs text-muted">Tu publicación aparecerá después de la revisión del anfitrión.</p>}
      </div>
    </div>
  );
}
