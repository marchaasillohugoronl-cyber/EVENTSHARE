export const URL_PUBLICA = 'https://eventshare-fawn.vercel.app';
export const ORIGEN_ANTERIOR = 'https://eventos-sis.vercel.app';

export function resolverUrlPublica(configured?: string, vercelHost?: string): string {
  const url = (configured || (vercelHost ? `https://${vercelHost}` : 'http://localhost:3000')).trim().replace(/\/+$/, '');
  return url === ORIGEN_ANTERIOR ? URL_PUBLICA : url;
}
