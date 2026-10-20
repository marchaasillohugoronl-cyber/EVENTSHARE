'use client';

import { useCallback, useMemo, useState, type CSSProperties } from 'react';
import { esVideo } from '@/lib/video';
import type { Post } from '@/lib/tipos';

const COLS = 3;
const MIN_CARDS = 7;        // mínimo de tarjetas por columna (evita huecos)
const SECONDS_PER_CARD = 7; // menor = sube más rápido

type Props = { posts: Post[]; name: string; subtitle?: string };

export default function MuroAscendente({
  posts,
  name,
  subtitle = 'Proyectos, equipos e ideas que impulsan la tecnología',
}: Props) {
  const [paused, setPaused] = useState(false);
  const [failed, setFailed] = useState<Set<string>>(() => new Set());

  const media = useMemo(
    () => posts.filter(p => p.photoUrl && !failed.has(p.id)),
    [posts, failed]
  );

  const markFailed = useCallback((id: string) => {
    setFailed(prev => new Set(prev).add(id));
  }, []);

  // Reparte las fotos en columnas y repite hasta tener MIN_CARDS
  const columns = useMemo(() => {
    if (media.length === 0) return [];
    const cols: Post[][] = Array.from({ length: COLS }, () => []);
    media.forEach((p, i) => cols[i % COLS].push(p));
    return cols.map((col, ci) => {
      const source = col.length ? col : media;
      const base: Post[] = [];
      while (base.length < MIN_CARDS) base.push(...source);
      // cada columna arranca en un punto distinto para que no se repitan en fila
      const shift = (ci * 2) % base.length;
      return [...base.slice(shift), ...base.slice(0, shift)];
    });
  }, [media]);

  if (media.length === 0) {
    return (
      <div className="wall-stage">
        <p className="wall-empty">Aún no hay fotos ni videos para mostrar.</p>
      </div>
    );
  }

  return (
    <div className="wall-stage">
      {/* Izquierda: título */}
      <div className="wall-intro">
        <span className="wall-eyebrow">EVENTSHARE</span>
        <h1 className="wall-title">{name}</h1>
        <i className="wall-line" />
        <p className="wall-subtitle">{subtitle}</p>
      </div>

      {/* Derecha: muro inclinado que sube */}
      <div className="wall-viewport" aria-label={`Muro de recuerdos de ${name}`} role="group">
        <div className={`wall-tilt ${paused ? 'is-paused' : ''}`}>
          {columns.map((list, ci) => {
            const duration = list.length * SECONDS_PER_CARD * (1 + ci * 0.18);
            const trackStyle = { '--dur': `${duration}s` } as CSSProperties;
            return (
              <div key={ci} className="wall-col">
                <div className="wall-track" style={trackStyle}>
                  {[...list, ...list].map((post, i) => (
                    <figure key={`${ci}-${i}`} className="wall-card">
                      {esVideo(post.photoUrl!) ? (
                        <video
                          src={post.photoUrl!}
                          autoPlay
                          muted
                          playsInline
                          loop
                          preload="metadata"
                          aria-label={`Video de ${post.author.name}`}
                          onError={() => markFailed(post.id)}
                        />
                      ) : (
                        <img
                          src={post.photoUrl!}
                          alt={`Foto de ${post.author.name}`}
                          decoding="async"
                          onError={() => markFailed(post.id)}
                        />
                      )}
                    </figure>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <button
        type="button"
        className="wall-pause"
        aria-pressed={paused}
        onClick={() => setPaused(v => !v)}
      >
        {paused ? 'Reanudar' : 'Pausar'}
      </button>
    </div>
  );
}
