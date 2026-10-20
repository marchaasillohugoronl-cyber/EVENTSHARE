'use client';

import { esVideo } from '@/lib/video';
import Link from 'next/link';
import { Camera, Heart, Images } from 'lucide-react';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { formatDate } from '@/lib/formato';
import type { Page, Post, PublicEvent } from '@/lib/tipos';

export default function PortadaMatrimonio({ event }: { event: PublicEvent }) {
  const [photos, setPhotos] = useState<Post[]>([]);
  useEffect(() => {
    let active = true;
    api<Page<Post>>(`/events/${event.id}/posts?limit=4&photos=1`)
      .then((page) => { if (active) setPhotos(page.items.filter((post) => post.photoUrl && !esVideo(post.photoUrl))); })
      .catch(() => { /* La portada sigue disponible si el album no responde. */ });
    return () => { active = false; };
  }, [event.id]);
  const date = formatDate(event.eventDate);
  const images = photos.length
    ? photos.map((post) => ({ src: post.photoUrl!, alt: `Foto de ${post.author.name}`, href: `/e/${event.code}/post/${post.id}` }))
    : event.coverImageUrl ? [{ src: event.coverImageUrl, alt: 'Portada del matrimonio', href: `/e/${event.code}/photos` }] : [];

  return (
    <header className={`wedding-hero ${images.length ? 'wedding-hero--photos' : ''}`}>
      <div className="wedding-invitation">
        <Link href="/" className="wedding-brand">EventShare</Link>
        <div className="wedding-ornament" aria-hidden="true"><span /><Heart size={24} strokeWidth={1} /><span /></div>
        <p className="wedding-eyebrow">Nuestro matrimonio</p>
        <h1 className="wedding-names font-serif">{event.name}</h1>
        <p className="wedding-subtitle font-serif">Un amor, mil recuerdos.</p>
        <div className="wedding-rule" aria-hidden="true" />
        {date && <p className="wedding-date">{date}</p>}
        {event.description && <p className="wedding-description">{event.description}</p>}
        <div className="wedding-buttons">
          {event.status === 'ACTIVE' && <Link href={`/e/${event.code}/upload`} className="btn wedding-primary"><Camera size={17} aria-hidden="true" />Subir foto</Link>}
          <Link href={`/e/${event.code}/photos`} className="btn wedding-secondary"><Images size={17} aria-hidden="true" />Ver álbum</Link>
        </div>
        <p className="wedding-footer font-serif">Gracias por ser parte de nuestra historia.</p>
      </div>
      {images.length > 0 && <div className="wedding-film" aria-label="Recuerdos del matrimonio">
        {images.map((photo) => <Link href={photo.href} key={photo.src} className="wedding-frame">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={photo.src} alt={photo.alt} decoding="async" />
        </Link>)}
      </div>}
    </header>
  );
}
