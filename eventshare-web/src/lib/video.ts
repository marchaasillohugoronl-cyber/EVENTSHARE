export const esVideo = (url: string) => /\.(mp4|webm|mov)(?:\?|$)/i.test(url);

export async function validarVideo(file: File): Promise<File> {
  if (!['video/mp4', 'video/webm', 'video/quicktime'].includes(file.type)) throw new Error('Usa un video MP4, WebM o MOV.');
  if (file.size > 50 * 1024 * 1024) throw new Error('El video debe pesar como máximo 50 MB.');
  await new Promise<void>((resolve, reject) => {
    const video = document.createElement('video');
    const url = URL.createObjectURL(file);
    const cleanup = () => { clearTimeout(timer); video.onerror = null; video.onloadedmetadata = null; video.removeAttribute('src'); video.load(); URL.revokeObjectURL(url); };
    const fail = () => { cleanup(); reject(new Error('No se pudo leer el video. Prueba con un archivo MP4.')); };
    const timer = setTimeout(fail, 15000);
    video.preload = 'metadata';
    video.onloadedmetadata = () => {
      const duration = video.duration;
      cleanup();
      if (!Number.isFinite(duration) || duration <= 0 || duration > 10) reject(new Error('El video debe durar como máximo 10 segundos. Recórtalo antes de subirlo.'));
      else resolve();
    };
    video.onerror = fail;
    video.src = url;
  });
  return file;
}
