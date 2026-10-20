import { notFound } from 'next/navigation';
import PantallaTv from '@/components/PantallaTv';
import { getEventByCodeCached } from '@/server/eventos';
import type { PublicEvent } from '@/lib/tipos';

export const dynamic = 'force-dynamic';

export default async function TvPage({ params }: { params: Promise<{ code: string }> }) {
  const event = await getEventByCodeCached((await params).code);
  if (!event || event.status === 'ARCHIVED') notFound();
  return <PantallaTv event={JSON.parse(JSON.stringify(event)) as PublicEvent} />;
}
