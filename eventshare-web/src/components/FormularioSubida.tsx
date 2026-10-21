'use client';

import { validarVideo } from '@/lib/video';
import Link from 'next/link';
import { Camera, Video, Images, Upload, Check } from 'lucide-react';
import CamaraVideo from './CamaraVideo';
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
  const [cameraOpen, setCameraOpen] = useState(false);
  const [checking, setChecking] = useState(false);
  const [phase, setPhase] = useState('');
  const validatedVideo = useRef<File | null>(null);
  const publishing = useRef(false);
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!file) { setPreview(null); return; }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = e.target.files?.[0];
    e.target.value = '';
    if (!selected) return;
    setError(null);
    setChecking(true);
    setFile(null);
    validatedVideo.current = null;
    try {
      if (selected.type.startsWith('video/')) {
        await validarVideo(selected);
        validatedVideo.current = selected;
      }
      setFile(selected);
    } catch (err) { setError(errorMessage(err)); }
    finally { setChecking(false); }
  }

  function useRecording(recorded: File) {
    // MediaRecorder corta esta captura a los 10 s y controla su tamaño.
    // WebM grabado en vivo puede no incluir duración en sus metadatos.
    validatedVideo.current = recorded;
    setFile(recorded);
    setError(null);
    setCameraOpen(false);
  }

  async function publish() {
    if (!file) return setError('Agrega una foto o un video.');
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
        const blob = file.type.startsWith('video/') ? (validatedVideo.current === file ? file : await validarVideo(file)) : await prepareImage(file);
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
        <p className="mt-2 text-sm text-muted">Elige una foto o graba hasta 10 segundos.</p>
      </header>
      <input ref={cameraRef} type="file" accept="image/jpeg,image/png,image/webp" capture="environment" hidden onChange={onPick} />
      <input ref={galleryRef} type="file" accept="image/jpeg,image/png,image/webp,video/mp4,video/webm,video/quicktime" hidden onChange={onPick} />
      {cameraOpen && <CamaraVideo onComplete={useRecording} onClose={() => setCameraOpen(false)} />}

      {preview && file ? (
        <section className="upload-preview" aria-label="Vista previa de tu publicación">
          <div className="upload-preview-heading"><span><Check size={16} aria-hidden="true" />Tu momento está listo</span>
            <button type="button" onClick={() => { setFile(null); validatedVideo.current = null; }} disabled={busy}>Cambiar</button>
          </div>
          {file.type.startsWith('video/')
            ? <video src={preview} controls playsInline />
            : <img src={preview} alt="Vista previa de tu foto" />}
        </section>
      ) : checking ? <div className="upload-checking" role="status">Revisando tu video…</div> : (
        <div className="upload-options">
          <button type="button" className="btn btn-primary" onClick={() => cameraRef.current?.click()} disabled={busy}>
            <Camera aria-hidden="true" />Tomar foto
          </button>
          <button type="button" className="btn btn-primary" onClick={() => { setError(null); setCameraOpen(true); }} disabled={busy}>
            <Video aria-hidden="true" />Grabar video
          </button>
          <button type="button" className="btn btn-ghost upload-gallery" onClick={() => galleryRef.current?.click()} disabled={busy}>
            <Images aria-hidden="true" />Elegir de la galería
          </button>
          <p className="text-center text-xs text-muted upload-gallery">Videos MP4, WebM o MOV · Hasta 10 s y 50 MB.</p>
        </div>
      )}

      <div className="upload-publish-bar">
        {error && <p role="alert" className="mb-2 text-sm text-red-700">{error}</p>}
        {busy && <div className="mb-3" role="status" aria-live="polite">
          <progress className="upload-progress" value={progress} max={100} aria-label="Progreso de subida" />
          <p className="mt-1 text-sm">{phase}{phase.startsWith('Subiendo') ? ` ${progress}%` : ''}</p>
        </div>}
        <button type="button" className="btn btn-primary w-full" onClick={publish} disabled={busy || checking || !file}>
          <Upload size={20} aria-hidden="true" />{busy ? 'Publicando…' : 'Publicar momento'}
        </button>
        {!file && !busy && <p className="mt-2 text-center text-xs text-muted">Selecciona una foto o video para continuar.</p>}
        {event.moderationEnabled && <p className="mt-2 text-center text-xs text-muted">Tu publicación aparecerá después de la revisión del anfitrión.</p>}
      </div>
    </div>
  );
}
