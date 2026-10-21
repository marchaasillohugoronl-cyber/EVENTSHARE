'use client';

import { Fragment, useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { esVideo } from '@/lib/video';
import type { Post } from '@/lib/tipos';

const SEGMENT_COUNT = 8;
const GAP = 0.03;
const STEPS = 16;
const OUTER = 49; // % del tamaño de la rueda
const INNER = 30; // si lo cambias, cambia también inset: 20% de .memory-wheel::before

const WHEEL_SWAP_MS = 5000; // cada cuánto cambia UNA foto de la rueda
const PHOTO_MS = 9000; // duración de cada foto protagonista
const VIDEO_MAX_MS = 30000; // tope para videos protagonistas

const DEFAULT_LABELS = [
  'Prototipos',
  'Código en acción',
  'Demostraciones',
  'Comunidad tech',
  'Ideas que escalan',
  'Equipos makers',
  'Innovación aplicada',
  'Expo software',
];

const segments = Array.from({ length: SEGMENT_COUNT }, (_, i) => {
  const arc = (Math.PI * 2) / SEGMENT_COUNT;
  const base = i * arc - Math.PI / 2;
  const start = base + GAP;
  const end = base + arc - GAP;

  const arcPoints = (radius: number, reverse = false) =>
    Array.from({ length: STEPS + 1 }, (_, j) => {
      const k = reverse ? STEPS - j : j;
      const angle = start + ((end - start) * k) / STEPS;
      return [50 + radius * Math.cos(angle), 50 + radius * Math.sin(angle)];
    });

  const points = [...arcPoints(OUTER), ...arcPoints(INNER, true)];
  const xs = points.map(p => p[0]);
  const ys = points.map(p => p[1]);
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  const width = Math.max(...xs) - x;
  const height = Math.max(...ys) - y;

  const tagAngle = start + 0.1;
  const tagRadius = (OUTER + INNER) / 2 + 2;

  return {
    style: {
      left: `${x}%`,
      top: `${y}%`,
      width: `${width}%`,
      height: `${height}%`,
      clipPath: `polygon(${points
        .map(p => `${((p[0] - x) / width) * 100}% ${((p[1] - y) / height) * 100}%`)
        .join(',')})`,
    },
    tag: {
      left: `${50 + tagRadius * Math.cos(tagAngle)}%`,
      top: `${50 + tagRadius * Math.sin(tagAngle)}%`,
      transform: `translate(-50%, -50%) rotate(${(tagAngle * 180) / Math.PI}deg)`,
    },
  };
});

// Cada tick cambia UNA pieza; salta de 3 en 3 para que no cambien las vecinas seguidas
type WheelState = { slots: number[]; next: number; cursor: number };
const initialWheel = (): WheelState => ({
  slots: Array.from({ length: SEGMENT_COUNT }, (_, i) => i),
  next: SEGMENT_COUNT,
  cursor: 0,
});
function wheelReducer(s: WheelState): WheelState {
  const slots = s.slots.slice();
  slots[s.cursor] = s.next;
  return { slots, next: s.next + 1, cursor: (s.cursor + 3) % SEGMENT_COUNT };
}

type Props = { posts: Post[]; name: string; labels?: string[] };

export default function RuedaRecuerdos({ posts, name, labels = DEFAULT_LABELS }: Props) {
  const [wheel, tick] = useReducer(wheelReducer, undefined, initialWheel);
  const [single, setSingle] = useState(0);
  const [paused, setPaused] = useState(false);
  const [failed, setFailed] = useState<Set<string>>(() => new Set());

  const media = useMemo(
    () => posts.filter(post => post.photoUrl && !failed.has(post.id)),
    [posts, failed]
  );
  const total = media.length;

  const markFailed = useCallback((id: string) => {
    setFailed(prev => new Set(prev).add(id));
  }, []);

  const nextSingle = useCallback(() => {
    setSingle(value => value + 1);
  }, []);

  // La rueda cambia una foto cada WHEEL_SWAP_MS
  useEffect(() => {
    if (paused || total < 2) return;
    const timer = setInterval(() => {
      if (document.visibilityState === 'visible') tick();
    }, WHEEL_SWAP_MS);
    return () => clearInterval(timer);
  }, [paused, total]);

  const featured = total ? media[(SEGMENT_COUNT + single) % total] : undefined;
  const upcoming = total > 1 ? media[(SEGMENT_COUNT + single + 1) % total] : undefined;
  const featuredIsVideo = !!featured?.photoUrl && esVideo(featured.photoUrl);
  const featuredMs = featuredIsVideo ? VIDEO_MAX_MS : PHOTO_MS;
  const previousFeatured = useRef<Post | undefined>(undefined);
  const [outgoing, setOutgoing] = useState<Post | null>(null);
  useEffect(() => {
    const previous = previousFeatured.current;
    previousFeatured.current = featured;
    if (previous?.id === featured?.id) return;
    setOutgoing(previous?.photoUrl && !esVideo(previous.photoUrl) ? previous : null);
    const timer = setTimeout(() => setOutgoing(null), 1500);
    return () => clearTimeout(timer);
  }, [featured?.id]);

  // Foto: 9 s. Video: hasta que termine (máximo 30 s)
  useEffect(() => {
    if (total < 2) return;
    const timer = setTimeout(nextSingle, featuredMs);
    return () => clearTimeout(timer);
  }, [single, featuredMs, total, nextSingle]);

  if (total === 0) {
    return (
      <div className="memory-wheel-stage">
        <p className="memory-wheel-empty">Aún no hay fotos ni videos para mostrar.</p>
      </div>
    );
  }

  return (
    <div className={`memory-wheel-stage${paused ? ' is-paused' : ''}`}>
      {/* Izquierda: la rueda */}
      <div className="memory-wheel-side">
        <div className="memory-wheel" role="group" aria-label={`Rueda de recuerdos de ${name}`}>
          <div className="memory-wheel-backdrop" aria-hidden="true" />
          <div className={`memory-wheel-ring ${paused ? 'is-paused' : ''}`}>
            {segments.map(({ style, tag }, i) => {
              const slot = wheel.slots[i];
              const post = media[slot % total];
              if (!post?.photoUrl) return null;
              return (
                <Fragment key={i}>
                  <div className="memory-wheel-segment" style={style}>
                    {esVideo(post.photoUrl) ? (
                      <video
                        key={`${slot}-${post.id}`}
                        src={post.photoUrl}
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
                        key={`${slot}-${post.id}`}
                        src={post.photoUrl}
                        alt={`Foto de ${post.author.name}`}
                        decoding="async"
                        onError={() => markFailed(post.id)}
                      />
                    )}
                  </div>
                  <span className="memory-wheel-tag" style={tag}>
                    {labels[i % labels.length]}
                  </span>
                </Fragment>
              );
            })}
          </div>
        </div>

        <div className="memory-wheel-center">
          <span>EVENTSHARE</span>
          <i className="memory-wheel-rule" />
          <h2>{name}</h2>
        </div>
      </div>

      {/* Derecha: foto o video protagonista */}
      <div className="memory-wheel-single">
        {outgoing?.photoUrl && <figure className="memory-wheel-outgoing" aria-hidden="true"><img src={outgoing.photoUrl} alt="" /></figure>}

        {featured?.photoUrl && (
          <figure key={`${single}-${featured.id}`}>
            {featuredIsVideo ? (
              <video
                src={featured.photoUrl}
                autoPlay
                muted
                playsInline
                loop={total < 2}
                onEnded={nextSingle}
                aria-label={`Video de ${featured.author.name}`}
                onError={() => markFailed(featured.id)}
              />
            ) : (
              <img
                src={featured.photoUrl}
                alt={`Foto de ${featured.author.name}`}
                onError={() => markFailed(featured.id)}
              />
            )}
            <figcaption>{featured.author.name}</figcaption>
            {!featuredIsVideo && total > 1 && (
              <i className="memory-wheel-progress" style={{ animationDuration: `${PHOTO_MS}ms` }} />
            )}
          </figure>
        )}

        {/* Precarga de la siguiente foto */}
        {upcoming?.photoUrl && !esVideo(upcoming.photoUrl) && (
          <img className="memory-wheel-preload" src={upcoming.photoUrl} alt="" aria-hidden="true" />
        )}
      </div>

      <button
        type="button"
        className="memory-wheel-pause"
        aria-pressed={paused}
        onClick={() => setPaused(value => !value)}
      >
        {paused ? 'Reanudar giro' : 'Pausar giro'}
      </button>
    </div>
  );
}
