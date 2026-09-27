import { notFound } from 'next/navigation';
import Feed from '@/components/Muro';
import { getEventByCodeCached } from '@/server/eventos';
import type { PublicEvent } from '@/lib/tipos';

export default async function PhotosPage({ params }: { params: Promise<{ code: string }> }) {
  const resolvedParams = await params;
  const ev = await getEventByCodeCached(resolvedParams.code);
  if (!ev) notFound();
  const event = JSON.parse(JSON.stringify(ev)) as PublicEvent;
  return (
    <main className="px-3 pt-8">
      <h1 className="mb-5 px-2 font-serif text-3xl">Álbum</h1>
      <Feed event={event} mode="grid" />
    </main>
  );
}
