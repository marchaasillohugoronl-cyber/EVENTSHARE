'use client';
import { useEffect, useRef, useState } from 'react';
import { HandTracker, type HandFrame, type RawHand } from '@/lib/gestureRecognition';

export type TrackingStatus = 'off' | 'loading' | 'active' | 'error';
export function useHandTracking(enabled: boolean, onFrame: (frame: HandFrame) => void) {
  const callback = useRef(onFrame);
  callback.current = onFrame;
  const [status, setStatus] = useState<TrackingStatus>('off');
  const [error, setError] = useState('');
  const [cameraActive, setCameraActive] = useState(false);
  useEffect(() => {
    if (!enabled) { setStatus('off'); setError(''); setCameraActive(false); return; }
    let stopped = false, stream: MediaStream | null = null, worker: Worker | null = null;
    let raf = 0, lastCapture = 0, lastVideoTime = -1, busy = false;
    let watchdog: ReturnType<typeof setTimeout> | undefined;
    const video = document.createElement('video');
    video.muted = true; video.autoplay = true; video.playsInline = true;
    const tracker = new HandTracker();
    function dispose() {
      stopped = true; cancelAnimationFrame(raf); clearTimeout(watchdog);
      stream?.getTracks().forEach(track => { track.onended = null; track.stop(); });
      video.pause(); video.srcObject = null; worker?.terminate(); worker = null;
    }
    function fail(message: string) {
      if (stopped) return;
      dispose(); setCameraActive(false); setError(message); setStatus('error');
      callback.current({ hands: [], timestamp: performance.now() });
    }
    const onVisibility = () => {
      if (document.hidden) fail('Magic Touch se detuvo al ocultar la pantalla. Vuelve a activarlo para usar la cámara.');
    };
    async function capture(now: number) {
      if (stopped) return;
      raf = requestAnimationFrame(capture);
      // At most one frame in flight; inference never queues or blocks the UI thread.
      if (busy || now - lastCapture < 50 || video.readyState < 2 || video.currentTime === lastVideoTime) return;
      busy = true; lastCapture = now; lastVideoTime = video.currentTime;
      try {
        const bitmap = await createImageBitmap(video);
        if (stopped || !worker) { bitmap.close(); return; }
        watchdog = setTimeout(() => fail('El detector dejó de responder. Vuelve a activar Magic Touch.'), 12000);
        worker.postMessage({ type: 'frame', bitmap, timestamp: now }, [bitmap]);
      } catch { fail('No se pudo leer la cámara. Comprueba que siga conectada.'); }
    }
    async function start() {
      setStatus('loading'); setError(''); setCameraActive(false);
      try {
        if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) throw new Error('La cámara necesita HTTPS o localhost y un navegador compatible.');
        if (!window.Worker || !window.createImageBitmap || !window.OffscreenCanvas) throw new Error('Este navegador no admite Magic Touch. Prueba Chrome o Edge actualizado.');
        const acquired = await navigator.mediaDevices.getUserMedia({ audio: false, video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 }, frameRate: { ideal: 24, max: 30 } } });
        if (stopped) { acquired.getTracks().forEach(track => track.stop()); return; }
        stream = acquired;
        setCameraActive(true);
        stream.getVideoTracks().forEach(track => { track.onended = () => fail('La cámara se desconectó o se revocó su permiso.'); });
        video.srcObject = stream;
        await video.play();
        if (stopped) return;
        worker = new Worker('/magic-touch/hand-tracking.worker.js');
        watchdog = setTimeout(() => fail('No se pudo cargar el modelo de manos. Revisa la conexión y vuelve a intentarlo.'), 45000);
        worker.onerror = () => fail('No se pudo cargar el detector de manos en este navegador.');
        worker.onmessage = ({ data }: MessageEvent<{ type: string; hands: RawHand[]; timestamp: number; message: string }>) => {
          if (stopped) return;
          clearTimeout(watchdog);
          if (data.type === 'ready') { setStatus('active'); raf = requestAnimationFrame(capture); }
          else if (data.type === 'result') { busy = false; callback.current(tracker.update(data.hands, data.timestamp, video.videoWidth / video.videoHeight)); }
          else if (data.type === 'error') fail(data.message);
        };
        worker.postMessage({ type: 'init' });
      } catch (e) {
        const name = e instanceof Error ? e.name : '';
        fail(name === 'NotAllowedError' ? 'Permiso de cámara denegado. Habilítalo en tu navegador y vuelve a intentarlo.'
          : name === 'NotFoundError' ? 'No hay una cámara conectada a este equipo.'
          : name === 'NotReadableError' ? 'La cámara está ocupada por otra aplicación o no se puede abrir.'
          : e instanceof Error ? e.message : 'No se pudo iniciar la cámara.');
      }
    }
    document.addEventListener('visibilitychange', onVisibility);
    void start();
    return () => { document.removeEventListener('visibilitychange', onVisibility); dispose(); };
  }, [enabled]);
  return { status, error, cameraActive };
}
