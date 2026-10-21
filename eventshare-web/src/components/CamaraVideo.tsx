'use client';

import { useEffect, useRef, useState } from 'react';
import { grabarVideo } from '@/lib/grabarVideo';

export default function CamaraVideo({ onComplete, onClose }: {
  onComplete: (file: File) => void;
  onClose: () => void;
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

  useEffect(() => {
    let cancelled = false;
    mounted.current = true;
    dialog.current?.showModal();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    async function openCamera() {
      try {
        if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
          throw new Error('No se puede grabar aquí. Abre el evento en Chrome o Safari mediante HTTPS, o elige un video de la galería.');
        }
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
          ? 'Permite el acceso a la cámara y al micrófono para grabar. También puedes elegir un video de la galería.'
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
  }, []);

  function start() {
    if (!stream.current || recording.current) return;
    try {
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

  return <dialog ref={dialog} className="recording-dialog" onCancel={e => { e.preventDefault(); onClose(); }}>
    <div className="recording-header">
      <h2>Grabar un momento</h2>
      <button type="button" className="btn btn-ghost" onClick={onClose}>Cancelar</button>
    </div>
    <video ref={video} autoPlay muted playsInline className="recording-preview" aria-label="Vista previa de la cámara" />
    <div className="recording-footer">
      {error ? <p role="alert">{error}</p> : <>
        <p role="timer" className="recording-timer">{seconds.toFixed(1)} / 10 s</p>
        <progress value={seconds} max={10} aria-label="Tiempo grabado" />
        <p className="text-sm">La grabación se detiene sola a los 10 segundos.</p>
        <button type="button" className="btn btn-primary w-full" disabled={!ready}
          onClick={() => capturing ? recording.current?.stop() : start()}>
          {capturing ? 'Detener y usar video' : ready ? 'Empezar a grabar' : 'Abriendo cámara…'}
        </button>
      </>}
    </div>
  </dialog>;
}
