'use client';

import { useEffect, useRef, useState } from 'react';
import { codigoDesdeQr } from '@/lib/qr';

export default function EscanerQr({ onCode, onClose }: { onCode: (code: string) => void; onClose: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [message, setMessage] = useState('Abriendo cámara…');

  useEffect(() => {
    let cancelled = false;
    let stream: MediaStream | undefined;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const stop = () => {
      cancelled = true;
      clearTimeout(timer);
      stream?.getTracks().forEach((track) => track.stop());
      if (videoRef.current) videoRef.current.srcObject = null;
    };
    const start = async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) {
          setMessage('La cámara no está disponible. Abre la página con HTTPS o escribe el código del evento.');
          return;
        }
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false });
        if (cancelled) { stream.getTracks().forEach((track) => track.stop()); return; }
        const video = videoRef.current;
        if (!video) { stop(); return; }
        video.srcObject = stream;
        await video.play();
        const { default: jsQR } = await import('jsqr');
        if (cancelled) return;
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d', { willReadFrequently: true });
        if (!context) throw new Error('Canvas unavailable');
        setMessage('Apunta la cámara al QR de tu evento.');
        const scan = () => {
          if (cancelled) return;
          try {
            if (video.readyState >= 2 && video.videoWidth > 0) {
              const scale = Math.min(1, 640 / video.videoWidth);
              canvas.width = Math.round(video.videoWidth * scale);
              canvas.height = Math.round(video.videoHeight * scale);
              context.drawImage(video, 0, 0, canvas.width, canvas.height);
              const frame = context.getImageData(0, 0, canvas.width, canvas.height);
              const result = jsQR(frame.data, frame.width, frame.height);
              if (result) {
                const code = codigoDesdeQr(result.data, window.location.origin);
                if (code) { stop(); onCode(code); return; }
                setMessage('Ese QR no corresponde a un evento de esta página. Prueba con el QR de tu evento.');
              }
            }
            timer = setTimeout(scan, 200);
          } catch { stop(); setMessage('No pudimos leer la cámara. Cierra el escáner e inténtalo de nuevo.'); }
        };
        scan();
      } catch (error) {
        if (cancelled) return;
        stop();
        const name = error instanceof DOMException ? error.name : '';
        setMessage(name === 'NotAllowedError'
          ? 'Permite el acceso a la cámara en tu navegador y vuelve a intentarlo. También puedes escribir el código.'
          : name === 'NotFoundError'
            ? 'No encontramos una cámara en este dispositivo. Puedes escribir el código del evento.'
            : 'No pudimos abrir la cámara. Comprueba que no esté en uso y vuelve a intentarlo.');
      }
    };
    const hide = () => { if (document.hidden) { stop(); onClose(); } };
    document.addEventListener('visibilitychange', hide);
    void start();
    return () => { stop(); document.removeEventListener('visibilitychange', hide); };
  }, [onCode, onClose]);

  return (
    <section aria-label="Escanear QR del evento" className="mt-4 rounded-2xl border border-line bg-white p-4">
      <video ref={videoRef} autoPlay muted playsInline aria-label="Vista de la cámara" className="aspect-square w-full rounded-xl bg-black object-cover" />
      <p role="status" className="mt-3 text-sm text-muted">{message}</p>
      <button type="button" className="btn btn-ghost mt-3 w-full" onClick={onClose}>Cerrar cámara</button>
    </section>
  );
}
