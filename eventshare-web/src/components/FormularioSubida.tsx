'use client';

import Link from 'next/link';
import { Send, CircleCheck, ImagePlus, ImageUp, ShieldCheck, Clock3, CircleAlert, LoaderCircle, ArrowLeft, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { api, errorMessage } from '@/lib/api';
import { prepareImage, uploadWithProgress } from '@/lib/imagen';
import type { Post, PublicEvent } from '@/lib/tipos';
import { useSession } from './ProveedorSesion';

type Presign = { uploadUrl: string; key: string; fields: Record<string, string> };

export default function UploadForm({ event, initialFile, onClose, onBusyChange, onIdentityChange }: { event: PublicEvent; initialFile: File; onClose?: () => void; onBusyChange?: (busy: boolean) => void; onIdentityChange?: (open: boolean) => void }) {
  const router = useRouter();
  const { ensureIdentity } = useSession();
  const [file, setFile] = useState<File | null>(initialFile);
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [requiresApproval, setRequiresApproval] = useState(false);
  const [phase, setPhase] = useState('');
  const publishing = useRef(false);
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
    onBusyChange?.(true);
    setError(null);
    setProgress(0);
    try {
      setPhase('Preparando tu publicación…');
      let identified = false;
      onIdentityChange?.(true);
      try {
        identified = await ensureIdentity(event.code);
      } finally {
        onIdentityChange?.(false);
      }
      if (!identified) return;
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
      setRequiresApproval(r.requiresApproval);
      if (r.requiresApproval) setPending(true);
      else {
        setPending(true);
        router.push(`/e/${event.code}`);
        router.refresh();
      }
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      publishing.current = false;
      setBusy(false);
      onBusyChange?.(false);
    }
  }

  if (pending) {
    return (
      <div className="upload-success">
        <span className="upload-success-icon">{requiresApproval ? <Clock3 size={30} strokeWidth={1.6} aria-hidden="true" /> : <CircleCheck size={30} strokeWidth={1.6} aria-hidden="true" />}</span>
        <p className="upload-success-title">{requiresApproval ? 'Recibido · Pendiente de aprobación' : '¡Foto publicada!'}</p>
        <p className="mx-auto mt-3 max-w-xs text-muted">{requiresApproval ? 'Tu publicación se guardó correctamente. Aparecerá en el muro y en la TV cuando el anfitrión la apruebe. No necesitas volver a subirla.' : 'Tu momento ya está en el álbum del evento.'}</p>
        <Link href={`/e/${event.code}`} onClick={onClose} className="btn btn-primary mt-8"><ArrowLeft size={18} strokeWidth={1.7} aria-hidden="true" />Volver al muro</Link>
      </div>
    );
  }

  return (
    <div className="upload-flow">
      <header className="upload-header"><div className="upload-heading"><span className="upload-heading-icon"><ImagePlus size={23} strokeWidth={1.7} aria-hidden="true" /></span><div>
        <h1>Publicar foto</h1>
        <p>Revisa tu foto y comparte el momento.</p>
      </div></div>{onClose && <button type="button" className="upload-close" aria-label="Cerrar vista previa" disabled={busy} onClick={onClose}><X size={20} strokeWidth={1.7} aria-hidden="true" /></button>}</header>
      <input ref={galleryRef} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={onPick} />

      {preview && file && (
        <section className="upload-preview" aria-label="Vista previa de tu publicación">
          <div className="upload-preview-heading"><span><CircleCheck size={16} strokeWidth={1.7} aria-hidden="true" />Tu momento está listo</span>
            <button type="button" onClick={() => galleryRef.current?.click()} disabled={busy}><ImageUp size={17} strokeWidth={1.7} aria-hidden="true" />Cambiar</button>
          </div>
          <img src={preview} alt="Vista previa de tu foto" />
        </section>
      )}

      <div className="upload-publish-bar">
        {error && <p role="alert" className="upload-error"><CircleAlert size={18} strokeWidth={1.7} aria-hidden="true" />{error}</p>}
        {busy && <div className="mb-3" role="status" aria-live="polite">
          <progress className="upload-progress" value={progress} max={100} aria-label="Progreso de subida" />
          <p className="mt-1 text-sm">{phase}{phase.startsWith('Subiendo') ? ` ${progress}%` : ''}</p>
        </div>}
        <button type="button" className="btn btn-primary w-full" onClick={publish} disabled={busy || !file}>
          {busy ? <LoaderCircle className="upload-spinner" size={19} strokeWidth={1.7} aria-hidden="true" /> : <Send size={19} strokeWidth={1.7} aria-hidden="true" />}{busy ? 'Publicando…' : 'Publicar momento'}
        </button>
        {!file && !busy && <p className="mt-2 text-center text-xs text-muted">Selecciona una foto para continuar.</p>}
        {event.moderationEnabled && <p className="upload-moderation"><ShieldCheck size={17} strokeWidth={1.7} aria-hidden="true" /><span>Tu publicación aparecerá después de la revisión del anfitrión.</span></p>}
      </div>
    </div>
  );
}
