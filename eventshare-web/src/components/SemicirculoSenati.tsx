'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Pause, Play } from 'lucide-react';
import MarcaSenati from './MarcaSenati';
import { esVideo } from '@/lib/video';
import type { Post } from '@/lib/tipos';

const PIECES = 8;
// A single wedge is rotated eight times. The stationary mask exposes only
// the right half of the rotating ring, as in the reference video.
const wedge = Array.from({ length: 2 }, (_, edge) =>
  Array.from({ length: 25 }, (_, i) => {
    const angle = (-22 + (edge ? 24 - i : i) * 44 / 24) * Math.PI / 180;
    const radius = edge ? 29 : 49;
    return `${50 + radius * Math.cos(angle)}% ${50 + radius * Math.sin(angle)}%`;
  }).join(',')
).join(',');

export default function SemicirculoSenati({ posts, name }: { posts: Post[]; name: string }) {
  const stage = useRef<HTMLDivElement>(null);
  const [paused, setPaused] = useState(false);
  const [reduced, setReduced] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [offset, setOffset] = useState(0);
  const [failed, setFailed] = useState<string[]>([]);
  const media = useMemo(() => posts.filter(p => p.photoUrl && !failed.includes(p.id)), [posts, failed]);
  const stopped = paused || reduced || hidden;

  useEffect(() => {
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
    const sync = () => setReduced(preference.matches);
    const visibility = () => setHidden(document.hidden);
    sync(); visibility();
    preference.addEventListener('change', sync);
    document.addEventListener('visibilitychange', visibility);
    return () => { preference.removeEventListener('change', sync); document.removeEventListener('visibilitychange', visibility); };
  }, []);

  useEffect(() => {
    stage.current?.querySelectorAll('video').forEach(video => {
      if (stopped) video.pause();
      else void video.play().catch(() => {});
    });
  }, [stopped, media, offset]);

  useEffect(() => {
    if (stopped || media.length <= PIECES) return;
    const timer = setInterval(() => setOffset(value => value + PIECES), 40000);
    return () => clearInterval(timer);
  }, [stopped, media.length]);

  const fail = (id: string) => setFailed(items => items.includes(id) ? items : [...items, id]);
  return <div ref={stage} className={`senati-semicircle${stopped ? ' is-stopped' : ''}`}>
    <div className="semicircle-composition">
      <div className="semicircle-mask" role="group" aria-label={`Semicírculo de recuerdos de ${name}`}>
        <div className="semicircle-ring">
          {Array.from({ length: PIECES }, (_, i) => {
            const post = media.length ? media[(i + offset) % media.length] : undefined;
            return <div key={i} className="semicircle-piece" style={{ transform: `rotate(${i * 45}deg)`, clipPath: `polygon(${wedge})` }}>
              <div className="semicircle-photo">
                {post?.photoUrl ? esVideo(post.photoUrl)
                  ? <video key={post.id} src={post.photoUrl} muted playsInline loop autoPlay={!stopped} preload="metadata" aria-label={`Video de ${post.author.name}`} onError={() => fail(post.id)} />
                  : <img key={post.id} src={post.photoUrl} alt={`Foto de ${post.author.name}`} onError={() => fail(post.id)} />
                  : <div className="semicircle-placeholder"><MarcaSenati /></div>}
              </div>
              <span className="semicircle-caption">{post?.author.name || 'COMUNIDAD SENATI'}</span>
            </div>;
          })}
        </div>
      </div>
      <div className="semicircle-center">
        <MarcaSenati />
        <span className="semicircle-spark" aria-hidden="true">✦</span>
        <p className="semicircle-eyebrow">TALENTO QUE NOS UNE</p>
        <h2>{name}</h2>
        <div className="semicircle-rule" />
        <p className="semicircle-message">Creamos el futuro.<br />Compartimos el momento.</p>
        <span className="semicircle-invite">ESCANEA EL QR Y PARTICIPA</span>
      </div>
    </div>
    <div className="semicircle-controls"><button type="button" onClick={() => setPaused(value => !value)} aria-pressed={paused} disabled={reduced}>{stopped ? <Play size={16} aria-hidden="true" /> : <Pause size={16} aria-hidden="true" />}{reduced ? 'Movimiento reducido' : paused ? 'Reanudar animación' : 'Pausar animación'}</button></div>
  </div>;
}
