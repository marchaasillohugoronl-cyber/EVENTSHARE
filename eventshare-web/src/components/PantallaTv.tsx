'use client';

import { useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import { api, ApiClientError } from '@/lib/api';
import { esVideo } from '@/lib/video';
import CollageGeometrico from './CollageGeometrico';
import RuedaRecuerdos from './RuedaRecuerdos';
import TunelRecuerdos from './TunelRecuerdos';
import MuroAscendente from './MuroAscendente';
import CorazonRecuerdos from './CorazonRecuerdos';
import TrioEnmarcado from './TrioEnmarcado';
// [PASO 1 - NUEVO DISEÑO] Importa aquí tu componente nuevo. Ejemplo:
// import MiNuevoDiseno from './MiNuevoDiseno';
import type { Page, Post, PublicEvent } from '@/lib/tipos';

// [PASO 2 - NUEVO DISEÑO] Agrega el identificador del diseño al tipo.
// Ejemplo: | 'nuevo'
type Vista = 'wheel' | 'collage' | 'tunnel' | 'wall' | 'heart' | 'trio';
type SeleccionVista = Vista | 'random';

// [PASO 3 - NUEVO DISEÑO] Agrega una línea aquí. Es lo que aparece en el
// selector "Diseño de pantalla". El orden de esta lista es el orden del menú.
// Ejemplo: { value: 'nuevo', label: 'Mi nuevo diseño' },
const VISTAS: { value: Vista; label: string }[] = [
  { value: 'tunnel', label: 'Túnel de recuerdos' },
  { value: 'wheel', label: 'Círculo de fotos y videos' },
  { value: 'wall', label: 'Muro ascendente' },
  { value: 'heart', label: 'Corazón de fotos y videos' },
  { value: 'trio', label: 'Trío enmarcado' },
  { value: 'collage', label: 'Collage geométrico' },
];

const VISTA_ALEATORIA: { value: SeleccionVista; label: string } = {
  value: 'random',
  label: 'Cambiar diseño automáticamente (cada 4 s)',
};

export default function PantallaTv({ event }: { event: PublicEvent }) {
  const screen = useRef<HTMLElement>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [index, setIndex] = useState(0);
  // Por defecto, la pantalla alterna sin repetir entre todos los diseños
  // disponibles cada cuatro segundos.
  const [selectedView, setSelectedView] = useState<SeleccionVista>('random');
  const [view, setView] = useState<Vista>('trio');
  const [qr, setQr] = useState('');
  const [notice, setNotice] = useState('');
  const [unavailable, setUnavailable] = useState(false);
  const [loading, setLoading] = useState(true);
  const [fullscreenError, setFullscreenError] = useState('');

  useEffect(() => {
    let active = true;
    let timer: ReturnType<typeof setTimeout>;
    const refresh = async () => {
      try {
        // limit=24: cantidad máxima de fotos que reciben TODOS los diseños.
        // Súbelo (por ejemplo a 48) si quieres más variedad en el muro o la rueda.
        const page = await api<Page<Post>>(`/events/${event.id}/posts?limit=24&photos=1`);
        if (active) { setPosts(page.items); setNotice(''); setUnavailable(false); }
      } catch (error) {
        if (active) {
          if (error instanceof ApiClientError && [403, 404].includes(error.status)) {
            setPosts([]); setUnavailable(true);
          }
          setNotice('No se pudo actualizar la pantalla. Reintentando…');
        }
      } finally {
        // 8000 = cada cuántos ms se vuelven a pedir las fotos al servidor.
        if (active) { setLoading(false); timer = setTimeout(refresh, 8000); }
      }
    };
    void refresh();
    QRCode.toDataURL(`${window.location.origin}/e/${event.code}`, { width: 280, margin: 3 })
      .then(value => { if (active) setQr(value); })
      .catch(() => { /* El código del evento permanece visible. */ });
    return () => { active = false; clearTimeout(timer); };
  }, [event.id, event.code]);

  // Este contador solo lo usa el "collage" (cambia de foto cada 10 s).
  // Los demás diseños llevan su propio temporizador dentro de su componente.
  useEffect(() => {
    const timer = setInterval(() => setIndex(value => value + 1), 10000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (selectedView !== 'random') {
      setView(selectedView);
      return;
    }

    const cambiarVista = () => {
      setView(actual => {
        const alternativas = VISTAS.map(({ value }) => value).filter(value => value !== actual);
        return alternativas[Math.floor(Math.random() * alternativas.length)];
      });
    };
    const timer = setInterval(cambiarVista, 4000);
    return () => clearInterval(timer);
  }, [selectedView]);

  async function fullscreen() {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await screen.current?.requestFullscreen();
      setFullscreenError('');
    } catch { setFullscreenError('Usa la opción de pantalla completa de tu navegador.'); }
  }

  const post = posts.length ? posts[index % posts.length] : null;
  const photos = posts
    .filter(p => p.photoUrl && !esVideo(p.photoUrl))
    .map(p => ({ url: p.photoUrl!, label: `Foto de ${p.author.name}` }));

  function renderContent() {
    if (unavailable) return <p className="tv-empty">Este evento ya no está disponible.</p>;

    if (!post) {
      return <>
        {event.coverImageUrl && <img src={event.coverImageUrl} alt="" className="tv-media opacity-40" />}
        <div className="tv-empty">
          <h2>{loading ? 'Cargando recuerdos…' : 'Tus recuerdos, en pantalla'}</h2>
          <p>Escanea el QR y comparte un momento.</p>
        </div>
      </>;
    }

    switch (view) {
      case 'tunnel': return <TunelRecuerdos posts={posts} name={event.name} />;
      case 'wheel': return <RuedaRecuerdos posts={posts} name={event.name} />;
      case 'wall': return <MuroAscendente posts={posts} name={event.name} />;
      case 'heart': return <CorazonRecuerdos posts={posts} name={event.name} />;
      case 'trio': return <TrioEnmarcado posts={posts} name={event.name} />;
      // [PASO 4 - NUEVO DISEÑO] Agrega un case con el MISMO valor del PASO 2.
      // Ejemplo: case 'nuevo': return <MiNuevoDiseno posts={posts} name={event.name} />;
      default: return <div className="tv-slide">
        {post.photoUrl && (esVideo(post.photoUrl)
          ? <video key={post.id} src={post.photoUrl} autoPlay muted playsInline loop className="tv-media" />
          : <CollageGeometrico photos={photos} fillFrame />)}
        {post.photoUrl && esVideo(post.photoUrl) && <div className="tv-caption">
          <span>{post.author.name}</span>
        </div>}
      </div>;
    }
  }

  return <main ref={screen} className="tv-screen">
    <section className="tv-stage" aria-label="Recuerdos del evento">
      {renderContent()}
    </section>
    {/* Nombre del evento arriba a la izquierda. Los diseños que ya muestran el
        nombre en su título lo ocultan desde su CSS con:
        .tv-screen:has(.mi-clase-stage) .tv-event-label { display: none; } */}
    <h1 className="tv-event-label">{event.name}</h1>
    {!unavailable && <details className="tv-qr">
      <summary aria-label="Ampliar QR para participar">
        {qr && <img src={qr} alt="QR para entrar al evento" width={96} height={96} />}
        <span>Participa ↗</span>
      </summary>
      <div className="tv-qr-expanded">
        {qr && <img src={qr} alt={`QR del evento ${event.name}`} width={256} height={256} />}
        <p>Escanea y comparte</p><span>{event.code}</span>
      </div>
    </details>}
    <details className="tv-controls">
      <summary aria-label="Opciones de pantalla">•••</summary>
      <div className="tv-controls-panel">
        <label className="text-sm">Diseño de pantalla
          {/* El selector se llena solo desde la lista VISTAS (PASO 3). */}
          <select
            className="mt-2 w-full rounded-lg border border-white/30 bg-slate-900 p-3 text-white"
            value={selectedView}
            onChange={e => setSelectedView(e.target.value as SeleccionVista)}
          >
            <option value={VISTA_ALEATORIA.value}>{VISTA_ALEATORIA.label}</option>
            {VISTAS.map(v => <option key={v.value} value={v.value}>{v.label}</option>)}
          </select>
        </label>
        <button className="tv-fullscreen" onClick={fullscreen}>Activar / salir de pantalla completa</button>
        {fullscreenError && <p role="status" className="text-sm">{fullscreenError}</p>}
      </div>
    </details>
    {notice && <p role="status" className="tv-notice">{notice}</p>}
  </main>;
}
