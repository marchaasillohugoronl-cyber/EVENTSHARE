import Link from 'next/link';
import { ArrowUpRight, CalendarDays, Camera, Images } from 'lucide-react';
import { notFound } from 'next/navigation';
import Feed from '@/components/Muro';
import { getEventByCodeCached } from '@/server/eventos';
import { formatDate } from '@/lib/formato';
import type { PublicEvent } from '@/lib/tipos';
import PortadaSenati from '@/components/PortadaSenati';
import { esMatrimonio } from '@/lib/temaEvento';
import PortadaMatrimonio from '@/components/PortadaMatrimonio';

export default async function EventPage({ params }: { params: Promise<{ code: string }> }) {
  const resolvedParams = await params;
  const ev = await getEventByCodeCached(resolvedParams.code);
  if (!ev) notFound();
  const event = JSON.parse(JSON.stringify(ev)) as PublicEvent;
  const date = formatDate(event.eventDate);
  const matrimonio = esMatrimonio(event.name);

  return (
    <>
      {event.theme === 'SENATI_TEC' ? <PortadaSenati event={event} /> : matrimonio ? <PortadaMatrimonio event={event} /> : <><header className="event-header">
        {event.coverImageUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={event.coverImageUrl} alt="Portada del evento" className="event-cover" />
        )}
        <div className="px-5 pb-6 pt-7 sm:px-8">
          <Link href="/" className="mb-4 inline-block text-xs font-semibold text-muted">EventShare</Link>
          <h1 className="event-title animate-reveal font-serif text-4xl leading-[1.12] sm:text-5xl">{event.name}</h1>
          {date && <p className="mt-4 flex items-center gap-2 text-sm text-muted"><CalendarDays size={16} aria-hidden="true" />{date}</p>}
        </div>
      </header>

      <section className="px-5 pt-5 sm:px-8">
        {event.description && <p className="max-w-prose whitespace-pre-line font-serif text-lg leading-relaxed">{event.description}</p>}
        {event.status === 'ACTIVE' ? (
          <div className="event-actions mt-5 grid grid-cols-2 gap-3">
            <Link href={`/e/${event.code}/upload`} className="btn btn-primary"><Camera size={18} aria-hidden="true" />Subir foto</Link>
            <Link href={`/e/${event.code}/photos`} className="btn btn-ghost"><Images size={18} aria-hidden="true" />Ver álbum</Link>
          </div>
        ) : (
          <p className="mt-6 rounded-xl bg-line/60 p-4 text-sm">El evento está cerrado. Ya no se aceptan publicaciones, pero puedes seguir viendo el álbum.</p>
        )}
      </section></>}

      {matrimonio && event.status === 'CLOSED' && <p className="px-5 pt-5 text-sm text-muted">El evento está cerrado. Puedes seguir viendo el álbum.</p>}

      <section className="px-5 pt-9 sm:px-8" aria-labelledby="wall-title">
        <div className="mb-5 flex items-center justify-between gap-3 border-b border-line pb-4">
          <h2 id="wall-title" className="font-serif text-2xl">Muro del evento</h2>
          <Link href={`/e/${event.code}/photos`} className="album-shortcut" aria-label="Ver álbum" title="Ver álbum"><ArrowUpRight size={20} aria-hidden="true" /></Link>
        </div>
        <Feed event={event} />
      </section>
    </>
  );
}
