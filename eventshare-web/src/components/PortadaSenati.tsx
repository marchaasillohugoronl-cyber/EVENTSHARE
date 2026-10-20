'use client';

import Link from 'next/link';
import CollageGeometrico from './CollageGeometrico';
import RobotSenati from './RobotSenati';
import QRCode from 'qrcode';
import { useEffect, useState } from 'react';
import { api, errorMessage } from '@/lib/api';
import { esVideo } from '@/lib/video';
import { formatDate } from '@/lib/formato';
import type { Page, Post, PublicEvent } from '@/lib/tipos';

export default function PortadaSenati({ event }: { event: PublicEvent }) {
  const [posts, setPosts] = useState<Post[]>([]);
  const [qr, setQr] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let active = true;
    const refresh = async () => {
      if (document.visibilityState !== 'visible') return;
      try {
        const page = await api<Page<Post>>(`/events/${event.id}/posts?limit=24&photos=1`);
        if (active) { setPosts(page.items.filter(p => p.photoUrl && !esVideo(p.photoUrl))); setError(''); }
      } catch (e) { if (active) setError(errorMessage(e)); }
      finally { if (active) setLoading(false); }
    };
    void refresh();
    const timer = setInterval(refresh, 8000);
    QRCode.toDataURL(`${window.location.origin}/e/${event.code}`, { width: 256, margin: 4, errorCorrectionLevel: 'M', color: { dark: '#092c60', light: '#ffffff' } })
      .then(value => { if (active) setQr(value); }).catch(() => {});
    return () => { active = false; clearInterval(timer); };
  }, [event.id, event.code]);
  const photos = posts.map(p => ({ url: p.photoUrl!, label: `Foto de ${p.author.name}`, href: `/e/${event.code}/post/${p.id}` }));
  if (!photos.length && event.coverImageUrl) photos.push({ url: event.coverImageUrl, label: 'Portada del evento', href: `/e/${event.code}/photos` });
  return (
    <header className="senati-hero">
      <div className="senati-heading">
        <div><Link href="/" className="senati-kicker">EVENTSHARE / COMUNIDAD</Link><h1>{event.name}</h1></div>
        <span className="senati-edition">TECNOLOGÍA<br />QUE NOS UNE</span>
      </div>
      <section className="senati-welcome" aria-label="Bienvenida a la comunidad SENATI">
        <div className="senati-welcome-copy"><p className="senati-kicker">EL FUTURO LO CREAMOS JUNTOS</p><h2>Tu talento.<br />Tus momentos.<br /><span>Nuestra comunidad.</span></h2><p>Cada idea tiene una historia. Comparte la tuya y forma parte de los recuerdos de este evento.</p><div className="senati-actions">{event.status === 'ACTIVE' ? <Link href={`/e/${event.code}/upload`} className="btn btn-primary">Compartir un momento ↗</Link> : <Link href={`/e/${event.code}/photos`} className="btn btn-primary">Explorar los recuerdos ↗</Link>}</div></div>
        <RobotSenati />
      </section>
      <div className="senati-collage">
        <CollageGeometrico photos={photos} interactive />
        {!photos.length && <div className="senati-empty"><span>SENATI TEC</span><p>{loading ? 'Cargando recuerdos…' : 'El próximo recuerdo lo compartes tú.'}</p></div>}
        <div className="senati-collage-caption">APRENDEMOS. CREAMOS. COMPARTIMOS.</div>
      </div>
      <div className="senati-bottom">
        <div className="senati-intro"><p className="senati-kicker">NUESTROS MOMENTOS, EN UN SOLO LUGAR</p><h2>Así se vive Senati Tec.</h2>
          {formatDate(event.eventDate) && <p>{formatDate(event.eventDate)}</p>}
          {event.description && <p className="whitespace-pre-line">{event.description}</p>}
          <div className="senati-actions">
            {event.status === 'ACTIVE' ? <Link href={`/e/${event.code}/upload`} className="btn btn-primary">Compartir foto o video ↗</Link> : <p>El evento está cerrado. Disfruta los recuerdos del álbum.</p>}
            <Link href={`/e/${event.code}/photos`} className="btn btn-ghost">Ver álbum</Link>
          </div><p className="senati-note">Videos de hasta 10 segundos.</p>
          {error && <p role="status" className="text-sm">No se pudo actualizar el collage. Se reintentará automáticamente.</p>}
        </div>
        {qr && <details className="senati-qr"><summary><img src={qr} width="92" height="92" alt="QR para entrar al evento" /><span>Escanea y participa<br /><small>Ampliar QR</small></span></summary><img src={qr} width="256" height="256" alt={`QR del evento ${event.name}`} /><p className="text-center text-xs">Código: {event.code}</p></details>}
      </div>
    </header>
  );
}
