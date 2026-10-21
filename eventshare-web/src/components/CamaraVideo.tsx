'use client';

import { useEffect, useRef, useState } from 'react';
import { grabarVideo } from '@/lib/grabarVideo';

export default function CamaraVideo({ onComplete, onClose, onNativeCamera }: {
  onComplete: (file: File) => void;
  onClose: () => void;
  onNativeCamera: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const video = useRef<HTMLVideoElement>(null);
  const stream = useRef<MediaStream | null>(null);
  const recording = useRef<ReturnType<typeof grabarVideo> | null>(null);
  const mounted = useRef(false);
  const [ready, setReady] = useState(false);
  const [capturing, setCapturing] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    mounted.current = true;
    setError(''); setReady(false); setCapturing(false); setSeconds(0);
    recording.current = null;
    if (!dialog.current?.open) dialog.current?.showModal();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    async function openCamera() {
      try {
        if (!window.isSecureContext) throw new Error('Este enlace no usa una conexión segura. Abre el evento con HTTPS para grabar aquí y detener el video automáticamente a los 10 segundos.');
        if (!navigator.mediaDevices?.getUserMedia) throw new Error('Este navegador no permite abrir la cámara dentro de la página. Abre el enlace en Chrome o Safari y permite el acceso a la cámara.');
        if (typeof MediaRecorder === 'undefined') throw new Error('Este navegador no admite el grabador con contador. Prueba Chrome o Safari actualizado.');
        const media = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: true,
        });
        if (cancelled) { media.getTracks().forEach(track => track.stop()); return; }
        stream.current = media;
        if (video.current) { video.current.srcObject = media; await video.current.play(); }
        if (!cancelled) setReady(true);
      } catch (err) {
        if (cancelled) return;
        stream.current?.getTracks().forEach(track => track.stop());
        setError(err instanceof DOMException && err.name === 'NotAllowedError'
          ? 'Permite la cámara y el micrófono en los permisos de este sitio y pulsa Reintentar.'
          : err instanceof Error ? err.message : 'No se pudo abrir la cámara.');
      }
    }
    void openCamera();
    const stopWhenHidden = () => { if (document.hidden) recording.current?.stop(); };
    document.addEventListener('visibilitychange', stopWhenHidden);
    return () => {
      cancelled = true;
      mounted.current = false;
      recording.current?.dispose();
      stream.current?.getTracks().forEach(track => track.stop());
      document.removeEventListener('visibilitychange', stopWhenHidden);
      document.body.style.overflow = previousOverflow;
    };
  }, [attempt]);

  function start() {
    if (!stream.current || recording.current) return;
    try {
      setSeconds(0);
      recording.current = grabarVideo(stream.current, {
        onTime: setSeconds,
        onComplete: file => { if (mounted.current) onComplete(file); },
        onError: err => {
          if (!mounted.current) return;
          setError(err.message); setCapturing(false); setReady(false);
        },
      });
      setCapturing(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo iniciar la grabación.');
    }
  }

  return <dialog ref={dialog} className="recording-dialog" aria-labelledby="recording-title" onCancel={e => { e.preventDefault(); onClose(); }}>
    <div className="recording-header">
      <h2 id="recording-title">Grabar un momento</h2>
      <button type="button" className="btn btn-ghost" onClick={onClose}>Cancelar</button>
    </div>
    <video ref={video} hidden={!!error} autoPlay muted playsInline className="recording-preview" aria-label="Vista previa de la cámara" />
    <div className="recording-footer">
      {error ? <>
        <p role="alert">{error}</p>
        <button type="button" className="btn btn-primary w-full" onClick={() => setAttempt(value => value + 1)}>Reintentar</button>
        <button type="button" className="btn btn-ghost w-full" onClick={onNativeCamera}>Abrir cámara del teléfono</button>
        <p className="text-sm">En la cámara del teléfono, detén la grabación antes de 10 segundos. El corte automático solo funciona al grabar dentro de esta página.</p>
      </> : <>
        <p role="timer" className="recording-timer">00:{String(Math.floor(seconds)).padStart(2, '0')} / 00:10</p>
        <progress value={seconds} max={10} aria-label="Tiempo grabado" />
        <p className="text-sm">La grabación se detiene sola a los 10 segundos.</p>
        <button type="button" className="btn btn-primary w-full" disabled={!ready}
          onClick={() => capturing ? recording.current?.stop() : start()}>
          {capturing ? 'Detener y usar video' : ready ? 'Grabar · 10 segundos' : 'Abriendo cámara…'}
        </button>
      </>}
    </div>
  </dialog>;
}
