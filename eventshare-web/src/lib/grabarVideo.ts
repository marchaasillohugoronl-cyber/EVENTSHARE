export const RECORDING_LIMIT_MS = 10_000;
const MAX_BYTES = 50 * 1024 * 1024;

/** Finaliza la captura a los 10 s y espera el último bloque antes de entregar el archivo. */
export function grabarVideo(stream: MediaStream, callbacks: {
  onTime: (seconds: number) => void;
  onComplete: (file: File) => void;
  onError: (error: Error) => void;
}) {
  const mimeType = ['video/mp4', 'video/webm;codecs=vp8,opus', 'video/webm']
    .find(type => MediaRecorder.isTypeSupported(type));
  if (!mimeType) throw new Error('Este navegador no permite grabar video. Puedes elegir uno de la galería.');
  const recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 4_000_000 });
  const chunks: Blob[] = [];
  let bytes = 0;
  let discarded = false;
  let deadline: ReturnType<typeof setTimeout> | undefined;
  let ticker: ReturnType<typeof setInterval> | undefined;
  const clearTimers = () => { clearTimeout(deadline); clearInterval(ticker); };
  const stop = () => {
    clearTimers();
    if (recorder.state !== 'inactive') recorder.stop();
    stream.getTracks().forEach(track => track.stop());
  };
  const fail = (error: Error) => {
    if (discarded) return;
    discarded = true;
    stop();
    callbacks.onError(error);
  };
  recorder.ondataavailable = event => {
    if (discarded || !event.data.size) return;
    bytes += event.data.size;
    if (bytes > MAX_BYTES) return fail(new Error('El video supera los 50 MB. Intenta una grabación más corta.'));
    chunks.push(event.data);
  };
  recorder.onerror = () => fail(new Error('No se pudo terminar la grabación. Inténtalo de nuevo.'));
  recorder.onstop = () => {
    clearTimers();
    stream.getTracks().forEach(track => track.stop());
    if (discarded) return;
    if (!bytes) return fail(new Error('La grabación está vacía. Inténtalo de nuevo.'));
    const type = mimeType.split(';')[0];
    callbacks.onComplete(new File(chunks, `momento.${type === 'video/mp4' ? 'mp4' : 'webm'}`, { type }));
  };
  recorder.start(250);
  const started = performance.now();
  deadline = setTimeout(stop, RECORDING_LIMIT_MS);
  ticker = setInterval(() => {
    const elapsed = performance.now() - started;
    callbacks.onTime(Math.min(10, elapsed / 1000));
    if (elapsed >= RECORDING_LIMIT_MS) stop();
  }, 100);
  return { stop, dispose: () => { discarded = true; stop(); } };
}
