import Link from 'next/link';
import { notFound } from 'next/navigation';
import PostView from '@/components/VistaPublicacion';
import { getEventByCodeCached } from '@/server/eventos';
import type { PublicEvent } from '@/lib/tipos';

export default async function PostPage({ params }: { params: Promise<{ code: string; id: string }> }) {
  const resolvedParams = await params;
  const ev = await getEventByCodeCached(resolvedParams.code);
  if (!ev) notFound();
  const event = JSON.parse(JSON.stringify(ev)) as PublicEvent;
  return (
    <main className="px-4 pt-6">
      <Link href={`/e/${event.code}`} className="mb-4 inline-flex h-10 items-center text-sm text-muted underline">Volver al muro</Link>
      <PostView event={event} postId={resolvedParams.id} />
    </main>
  );
}
