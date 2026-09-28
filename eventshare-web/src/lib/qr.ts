import { ORIGEN_ANTERIOR } from './urlPublica';

/** Acepta códigos y enlaces del sitio actual o del dominio anterior; nunca navega a destinos externos. */
export function codigoDesdeQr(value: string, origin: string): string | null {
  const text = value.trim();
  if (/^[A-Za-z0-9]{6,12}$/.test(text)) return text.toUpperCase();
  try {
    const url = new URL(text, origin);
    if ((url.origin !== origin && url.origin !== ORIGEN_ANTERIOR) || url.username || url.password) return null;
    const match = /^\/e\/([A-Za-z0-9]{6,12})\/?$/.exec(url.pathname);
    return match ? match[1].toUpperCase() : null;
  } catch { return null; }
}
