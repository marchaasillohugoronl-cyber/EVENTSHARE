'use client';

import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { Camera } from 'lucide-react';
import type { PublicEvent } from '@/lib/tipos';
import UploadForm from './FormularioSubida';

const PhotoPicker = createContext<(() => void) | null>(null);

export function SharePhotoButton({ children, className }: { children: React.ReactNode; className?: string }) {
  const open = useContext(PhotoPicker);
  return <button type="button" className={className} onClick={() => open?.()}>{children}</button>;
}

export default function SharePhotoProvider({ event, children }: { event: PublicEvent; children: React.ReactNode }) {
  const gallery = useRef<HTMLInputElement>(null);
  const camera = useRef<HTMLInputElement>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!file) return;
    dialog.current?.showModal();
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = previous; };
  }, [file]);

  function pick(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = e.target.files?.[0];
    e.target.value = '';
    if (!selected) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(selected.type)) {
      setError('Selecciona una foto JPG, PNG o WebP.');
      return;
    }
    setError('');
    setFile(selected);
  }

  function close() {
    if (busy) return;
    dialog.current?.close();
    setFile(null);
  }

  return <PhotoPicker.Provider value={() => { if (event.status === 'ACTIVE') gallery.current?.click(); }}>
    {children}
    {event.status === 'ACTIVE' && <>
      <input ref={gallery} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={pick} />
      <input ref={camera} type="file" accept="image/*" capture="environment" hidden onChange={pick} />
      {!file && <button type="button" className="event-camera-bubble" aria-label="Tomar una foto con la cámara" onClick={() => { setError(''); camera.current?.click(); }}>
        <Camera size={26} strokeWidth={1.8} aria-hidden="true" />
        <span>Cámara</span>
      </button>}
      {error && <div className="photo-picker-error" role="alert">{error}<button type="button" onClick={() => setError('')} aria-label="Cerrar aviso">×</button></div>}
      <dialog ref={dialog} className="photo-composer" aria-label="Publicar foto" onCancel={(e) => { e.preventDefault(); close(); }}>
        {file && <UploadForm event={event} initialFile={file} onClose={close} onBusyChange={setBusy} onIdentityChange={(open) => {
          if (open) dialog.current?.close();
          else dialog.current?.showModal();
        }} />}
      </dialog>
    </>}
  </PhotoPicker.Provider>;
}
