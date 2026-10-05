/** Traduce errores conocidos sin mostrar claves, firmas ni parámetros del proveedor. */
export function mensajeErrorSubida(status: number, response: string): string {
  let message = '';
  try {
    const parsed = JSON.parse(response);
    if (typeof parsed?.error?.message === 'string') message = parsed.error.message;
  } catch { /* El proveedor puede responder sin JSON. */ }

  if (/invalid api[_ ]key|unknown api[_ ]key|api[_ ]key.*(?:invalid|not found)/i.test(message)) {
    return 'El servicio de fotos tiene una clave de acceso incorrecta. Avisa al organizador. (FOTO_CLAVE)';
  }
  if (/invalid signature|signature.*(?:invalid|mismatch)/i.test(message)) {
    return 'No se pudo autorizar la subida. Avisa al organizador para que revise la configuración de fotos. (FOTO_FIRMA)';
  }
  if (/unknown cloud|invalid cloud|cloud name.*(?:invalid|not found|disabled)/i.test(message)) {
    return 'La cuenta del servicio de fotos no está disponible. Avisa al organizador. (FOTO_CUENTA)';
  }
  if (/stale request|timestamp|expired/i.test(message)) {
    return 'La autorización para subir caducó. Recarga la página e inténtalo de nuevo. (FOTO_CADUCADA)';
  }
  if (status === 413 || /file size too large|file too large|maximum.*size/i.test(message)) {
    return 'La foto supera el tamaño permitido. Prueba con una imagen más pequeña. (FOTO_TAMANO)';
  }
  if (/invalid image|unsupported.*(?:format|file)|(?:format|file type).*not allowed/i.test(message)) {
    return 'No se pudo leer esa imagen. Prueba con otra foto JPG, PNG o WebP. (FOTO_FORMATO)';
  }
  if (status === 429 || /quota|limit exceeded/i.test(message)) {
    return 'El servicio de fotos alcanzó su límite temporal. Inténtalo más tarde. (FOTO_LIMITE)';
  }
  return `El servicio de fotos rechazó la subida. Inténtalo de nuevo o avisa al organizador. (FOTO_HTTP_${status})`;
}
