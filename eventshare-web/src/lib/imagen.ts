const ALLOWED = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_DIM = 2200;

/** Reduce fotos grandes del teléfono (JPEG, lado máx. 2200 px) antes de subirlas. */
export async function prepareImage(file: File): Promise<Blob> {
  try {
    const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' });
    const scale = Math.min(1, MAX_DIM / Math.max(bmp.width, bmp.height));
    if (scale === 1 && file.size <= 3 * 1024 * 1024 && ALLOWED.includes(file.type)) {
      bmp.close();
      return file;
    }
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bmp.width * scale);
    canvas.height = Math.round(bmp.height * scale);
    canvas.getContext('2d')!.drawImage(bmp, 0, 0, canvas.width, canvas.height);
    bmp.close();
    const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, 'image/jpeg', 0.86));
    if (blob) return blob;
  } catch {
    /* cae al archivo original */
  }
  if (!ALLOWED.includes(file.type)) throw new Error('Formato no compatible. Usa una foto JPG, PNG o WebP.');
  return file;
}

export function uploadWithProgress(url: string, body: Blob, fields: Record<string, string>, onProgress: (pct: number) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', url);
    const form = new FormData();
    Object.entries(fields).forEach(([k, v]) => form.append(k, v));
    form.append('file', body, 'foto');
    xhr.timeout = 120000;
    xhr.ontimeout = () => reject(new Error('La subida tardo demasiado. Intentalo de nuevo.'));
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress(Math.round((e.loaded / e.total) * 100));
    xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error('No se pudo subir la foto. Inténtalo de nuevo.')));
    xhr.onerror = () => reject(new Error('Error de red al subir la foto.'));
    xhr.send(form);
  });
}
