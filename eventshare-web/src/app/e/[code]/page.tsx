import Link from 'next/link';
import { notFound } from 'next/navigation';
import Feed from '@/components/Muro';
import { getEventByCodeCached } from '@/server/eventos';
import { formatDate } from '@/lib/formato';
import type { PublicEvent } from '@/lib/tipos';

export default async function EventPage({ params }: { params: Promise<{ code: string }> }) {
  const resolvedParams = await params;
  const ev = await getEventByCodeCached(resolvedParams.code);
  if (!ev) notFound();
  const event = JSON.parse(JSON.stringify(ev)) as PublicEvent;
  const date = formatDate(event.eventDate);

  return (
    <>
      <header className="relative flex min-h-[58svh] flex-col justify-end overflow-hidden bg-brand text-onbrand">
        {event.coverImageUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={event.coverImageUrl} alt="" className="absolute inset-0 h-full w-full object-cover" />
        )}
        {event.coverImageUrl && <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/15 to-transparent" />}
        <div className={`relative px-6 pb-8 pt-24 ${event.coverImageUrl ? 'text-white' : ''}`}>
          <h1 className="animate-reveal font-serif text-[2.75rem] leading-[1.02] sm:text-6xl">{event.name}</h1>
          {date && <p className="mt-3 text-base opacity-90">{date}</p>}
        </div>
      </header>

      <section className="px-6 pt-6">
        {event.description && <p className="max-w-prose whitespace-pre-line font-serif text-lg leading-relaxed">{event.description}</p>}
        {event.status === 'ACTIVE' ? (
          <div className="mt-6 flex gap-3">
            <Link href={`/e/${event.code}/upload`} className="btn btn-primary flex-1">Subir foto</Link>
            <Link href={`/e/${event.code}/photos`} className="btn btn-ghost flex-1">Ver álbum</Link>
          </div>
        ) : (
          <p className="mt-6 rounded-xl bg-line/60 p-4 text-sm">El evento está cerrado. Ya no se aceptan publicaciones, pero puedes seguir viendo el álbum.</p>
        )}
      </section>

      <section className="px-4 pt-10" aria-labelledby="wall-title">
        <h2 id="wall-title" className="mb-5 px-2 font-serif text-3xl">Muro del evento</h2>
        <Feed event={event} />
      </section>
    </>
  );
}
