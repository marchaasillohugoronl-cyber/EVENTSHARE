import type { Metadata, Viewport } from 'next';
import { Fraunces, Figtree } from 'next/font/google';
import SessionProvider from '@/components/ProveedorSesion';
import './globales.css';
import { resolverUrlPublica } from '@/lib/urlPublica';

const serif = Fraunces({ subsets: ['latin'], variable: '--font-serif', display: 'swap' });
const sans = Figtree({ subsets: ['latin'], variable: '--font-sans', display: 'swap' });

export const metadata: Metadata = {
  title: { default: 'EventShare', template: '%s · EventShare' },
  description: 'Comparte las fotos y los mensajes de tu evento con un código QR.',
  metadataBase: new URL(resolverUrlPublica(process.env.NEXT_PUBLIC_APP_URL, process.env.VERCEL_PROJECT_PRODUCTION_URL)),
};
export const viewport: Viewport = { width: 'device-width', initialScale: 1, viewportFit: 'cover' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={`${serif.variable} ${sans.variable}`}>
      <body><SessionProvider>{children}</SessionProvider></body>
    </html>
  );
}
