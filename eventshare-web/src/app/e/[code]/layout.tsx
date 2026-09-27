import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import EventNav from '@/components/NavegacionEvento';
import { getEventByCodeCached } from '@/server/eventos';
import { themeVars } from '@/lib/formato';

type Props = { children: React.ReactNode; params: Promise<{ code: string }> };

export async function generateMetadata({ params }: Pick<Props, 'params'>): Promise<Metadata> {
  const resolvedParams = await params;
  const ev = await getEventByCodeCached(resolvedParams.code);
  return ev ? { title: ev.name, description: ev.description ?? `Álbum de ${ev.name}` } : {};
}

export default async function EventLayout({ children, params }: Props) {
  const resolvedParams = await params;
  const ev = await getEventByCodeCached(resolvedParams.code);
  if (!ev) notFound();

  if (ev.status === 'ARCHIVED') {
    return (
      <main className="mx-auto flex min-h-screen max-w-xl flex-col justify-center px-6">
        <h1 className="font-serif text-4xl">{ev.name}</h1>
        <p className="mt-3 text-muted">Este álbum es privado y ya no está disponible.</p>
      </main>
    );
  }

  return (
    <div style={themeVars(ev.primaryColor) as React.CSSProperties} className="min-h-screen pb-28">
      <div className="mx-auto max-w-xl">{children}</div>
      <EventNav code={ev.code} canPost={ev.status === 'ACTIVE'} />
    </div>
  );
}
