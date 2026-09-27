import Link from 'next/link';
import { notFound } from 'next/navigation';
import UploadForm from '@/components/FormularioSubida';
import { getEventByCodeCached } from '@/server/eventos';
import type { PublicEvent } from '@/lib/tipos';

export default async function UploadPage({ params }: { params: Promise<{ code: string }> }) {
  const resolvedParams = await params;
  const ev = await getEventByCodeCached(resolvedParams.code);
  if (!ev) notFound();
  const event = JSON.parse(JSON.stringify(ev)) as PublicEvent;
  return (
    <main className="px-5 pt-8">
      {event.status === 'ACTIVE' ? <UploadForm event={event} /> : (
        <>
          <h1 className="font-serif text-3xl">El evento está cerrado</h1>
          <p className="mt-3 text-muted">Ya no se aceptan publicaciones.</p>
          <Link href={`/e/${event.code}`} className="btn btn-primary mt-6">Volver al muro</Link>
        </>
      )}
    </main>
  );
}
