'use client';

import { useCallback, useEffect, useMemo, useReducer, useState, type CSSProperties } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { esVideo } from '@/lib/video';
import type { Post } from '@/lib/tipos';

const SWAP_MS = 7000;
const CHANGE_OUT_MS = 260;
const CHANGE_SETTLE_MS = 560;

// Polígonos del corazón, en píxeles de la imagen de referencia (x, y)
const RAW: number[][][] = [
  [[170, 115], [172, 238], [105, 282], [102, 200]],
  [[178, 106], [298, 100], [355, 158], [240, 222], [178, 247]],
  [[160, 266], [352, 166], [356, 296], [330, 358]],
  [[108, 290], [165, 272], [378, 378], [240, 452]],
  [[252, 455], [382, 384], [515, 418], [450, 505], [375, 567]],
  [[362, 165], [590, 262], [472, 345], [395, 375], [362, 330]],
  [[400, 378], [480, 340], [638, 272], [630, 310], [520, 432]],
  [[388, 148], [455, 102], [567, 106], [607, 148], [497, 200]],
  [[500, 205], [612, 160], [645, 200], [640, 268], [598, 262]],
];

const W = 100;
const H = 86; // alto del corazón en la misma escala (100 de ancho)

const pieces = RAW.map(poly => {
  // normaliza a un lienzo de 100 x 86
  const pts = poly.map(([x, y]) => [(x - 100) / 5.45, (y - 98) / 5.45]);
  const xs = pts.map(p => p[0]);
  const ys = pts.map(p => p[1]);
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  const w = Math.max(...xs) - x;
  const h = Math.max(...ys) - y;
  return {
    style: {
      left: `${(x / W) * 100}%`,
      top: `${(y / H) * 100}%`,
      width: `${(w / W) * 100}%`,
      height: `${(h / H) * 100}%`,
      clipPath: `polygon(${pts
        .map(p => `${((p[0] - x) / w) * 100}% ${((p[1] - y) / h) * 100}%`)
        .join(',')})`,
    },
    svgPoints: pts.map(p => `${p[0].toFixed(2)},${p[1].toFixed(2)}`).join(' '),
  };
});

const COUNT = pieces.length;

type State = { slots: number[]; next: number; cursor: number };

function reducer(state: State): State {
  const slots = state.slots.slice();
  slots[state.cursor] = state.next;
  return { slots, next: state.next + 1, cursor: (state.cursor + 1) % COUNT };
}

type Props = { posts: Post[]; name: string };

export default function CorazonRecuerdos({ posts, name }: Props) {
  const [failed, setFailed] = useState<Set<string>>(() => new Set());
  const [paused, setPaused] = useState(false);
  const [updatingPiece, setUpdatingPiece] = useState<number | null>(null);
  const [cycle, setCycle] = useState(0);
  const [assembled, setAssembled] = useState(false);
  const reduceMotion = useReducedMotion();
  const [state, tick] = useReducer(reducer, {
    slots: Array.from({ length: COUNT }, (_, i) => i),
    next: COUNT,
    cursor: 0,
  });

  const media = useMemo(
    () => posts.filter(p => p.photoUrl && !failed.has(p.id)),
    [posts, failed]
  );
  const total = media.length;
  const featuredPost = total ? media[state.slots[0] % total] : undefined;

  const markFailed = useCallback((id: string) => {
    setFailed(prev => new Set(prev).add(id));
  }, []);

  // Espera al primer cuadro pintado para que el mosaico entre de forma escalonada.
  useEffect(() => {
    if (reduceMotion) { setAssembled(true); return; }
    const frame = requestAnimationFrame(() => setAssembled(true));
    return () => cancelAnimationFrame(frame);
  }, [reduceMotion]);

  useEffect(() => {
    if (paused || total < 2) return;
    let swapTimer: ReturnType<typeof setTimeout> | undefined;
    let settleTimer: ReturnType<typeof setTimeout> | undefined;
    const timer = setTimeout(() => {
      if (document.visibilityState !== 'visible') {
        setCycle(value => value + 1);
        return;
      }
      if (reduceMotion) {
        tick();
        setCycle(value => value + 1);
        return;
      }
      // Solo sale la pieza que se actualizará. Así la transición explica el cambio
      // sin desarmar todo el mosaico ni distraer de las fotos restantes.
      setUpdatingPiece(state.cursor);
      swapTimer = setTimeout(() => {
        tick();
      }, CHANGE_OUT_MS);
      settleTimer = setTimeout(() => {
        setUpdatingPiece(null);
        setCycle(value => value + 1);
      }, CHANGE_SETTLE_MS);
    }, SWAP_MS);
    return () => {
      clearTimeout(timer);
      if (swapTimer) clearTimeout(swapTimer);
      if (settleTimer) clearTimeout(settleTimer);
    };
  }, [paused, total, cycle, reduceMotion]);

  if (total === 0) {
    return (
      <div className="heart-stage">
        <p className="heart-empty">Aún no hay fotos ni videos para mostrar.</p>
      </div>
    );
  }

  return (
    <div className={`heart-stage ${assembled ? 'is-assembled' : 'is-starting'}${paused ? ' is-paused' : ''}`}>
      <div className="heart-frame">
        <div className="heart-brand" aria-label="EventShare">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.5 20 7v10l-8 4.5L4 17V7l8-4.5Zm0 4.1L7.6 9v6L12 17.4l4.4-2.4V9L12 6.6Zm0 3.1 2.1 1.2v2.3L12 14.4l-2.1-1.2v-2.3L12 9.7Z" /></svg>
          <span>eventshare</span>
        </div>
        <div className="heart-meta" aria-hidden="true">
          <span className="heart-live-dot" />
          <span>{total} {total === 1 ? 'aporte' : 'aportes'}</span>
        </div>
        <div className="heart-collage" role="group" aria-label={`Collage de recuerdos de ${name}`}>
          {pieces.map(({ style }, i) => {
            const slot = state.slots[i];
            const post = media[slot % total];
            if (!post?.photoUrl) return null;
            return (
              <motion.div
                key={i}
                className={`heart-piece${updatingPiece === i ? ' is-updating' : ''}`}
                style={{ ...style, '--i': i } as CSSProperties}
                initial={false}
                animate={!assembled && !reduceMotion
                  ? { opacity: 0, y: 18, scale: .96 }
                  : updatingPiece === i && !reduceMotion
                  ? { opacity: 0, y: -8, scale: .975 }
                  : { opacity: 1, y: 0, scale: 1 }}
                transition={!assembled
                  ? { duration: 0 }
                  : updatingPiece === i
                  ? { duration: CHANGE_OUT_MS / 1000, ease: [0.4, 0, 1, 1] }
                  : { duration: .38, ease: [0.16, 1, .3, 1], delay: i * .045 }}
              >
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
              </motion.div>
            );
          })}

          {/* Cortes: líneas del color de fondo dibujadas encima */}
          <motion.svg
            className="heart-lines"
            viewBox={`0 0 ${W} ${H}`}
            preserveAspectRatio="none"
            aria-hidden="true"
            initial={false}
            animate={!assembled && !reduceMotion
              ? { opacity: 0, scale: .97 }
              : { opacity: 1, scale: 1 }}
            transition={{ duration: .45, ease: [0.16, 1, .3, 1], delay: .08 }}
          >
            {pieces.map((p, i) => (
              <polygon key={i} points={p.svgPoints} />
            ))}
          </motion.svg>
        </div>

        <div className="heart-heading">
          <span className="heart-heading-rule" aria-hidden="true" />
          <span className="heart-kicker">Mosaico de innovación</span>
          <h2 className="heart-title">{name}</h2>
          <p>{featuredPost ? `Aporte de ${featuredPost.author.name}` : 'Ideas, proyectos y comunidad'}</p>
        </div>
      </div>

      <button
        type="button"
        className="heart-pause"
        aria-pressed={paused}
        onClick={() => setPaused(v => !v)}
      >
        <span aria-hidden="true">{paused ? '▶' : 'Ⅱ'}</span>
        <span className="heart-pause-label">{paused ? 'Reanudar' : 'Pausar'}</span>
      </button>
    </div>
  );
}
