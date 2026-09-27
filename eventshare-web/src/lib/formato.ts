export function hexToRgb(hex: string): [number, number, number] {
  const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
  if (!m) return [31, 41, 55];
  return [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)];
}

/** Variables CSS de tema: color principal y color de texto legible sobre él. */
export function themeVars(hex: string): Record<string, string> {
  const [r, g, b] = hexToRgb(hex);
  const lum = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  return { '--brand-rgb': `${r} ${g} ${b}`, '--on-brand-rgb': lum > 0.6 ? '23 25 28' : '255 255 255' };
}

export function timeAgo(iso: string): string {
  const diff = (new Date(iso).getTime() - Date.now()) / 1000;
  const rtf = new Intl.RelativeTimeFormat('es', { numeric: 'auto' });
  const abs = Math.abs(diff);
  if (abs < 45) return 'ahora';
  if (abs < 3600) return rtf.format(Math.round(diff / 60), 'minute');
  if (abs < 86400) return rtf.format(Math.round(diff / 3600), 'hour');
  return rtf.format(Math.round(diff / 86400), 'day');
}

export function formatDate(iso: string | null): string | null {
  if (!iso) return null;
  return new Intl.DateTimeFormat('es', { dateStyle: 'long' }).format(new Date(iso));
}
