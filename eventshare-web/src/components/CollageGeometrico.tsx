'use client';

import { useEffect, useId, useMemo, useState } from 'react';

type Photo = { url: string; label: string; href?: string };
type Point = [number, number];

type Props = {
  photos: Photo[];
  interactive?: boolean;
  fillFrame?: boolean;
  /** Tiempo entre recomposiciones. 0 desactiva la rotación. */
  intervalMs?: number;
};

const MAX_SEED = 2147483646;
const nextSeed = () => Math.floor(Math.random() * MAX_SEED) + 1;
const toPoints = (pts: Point[]) => pts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ');

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReduced(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);
  return reduced;
}

export default function CollageGeometrico({
  photos,
  interactive = false,
  fillFrame = false,
  intervalMs = 10000,
}: Props) {
  const id = useId().replaceAll(':', '');
  const [seed, setSeed] = useState(1); // valor fijo en SSR para evitar errores de hidratación
  const [paused, setPaused] = useState(false);
  const reducedMotion = usePrefersReducedMotion();

  // Primera composición aleatoria solo en cliente
  useEffect(() => setSeed(nextSeed()), []);

  // Rotación: se detiene con hover/foco, pestaña oculta o reduced-motion
  useEffect(() => {
    if (!intervalMs || paused || reducedMotion) return;
    const timer = setInterval(() => {
      if (document.visibilityState === 'visible') setSeed(nextSeed());
    }, intervalMs);
    return () => clearInterval(timer);
  }, [intervalMs, paused, reducedMotion]);

  const tiles = useMemo(() => {
    let state = seed;
    const random = () => {
      state = (state * 16807) % 2147483647;
      return (state - 1) / MAX_SEED;
    };

    const cx = 440 + random() * 120;
    const cy = 300 + random() * 100;
    const rx = 170 + random() * 60;
    const ry = 190 + random() * 50;

    const outer: Point[] = [[cx, 0], [1000, 0], [1000, 700], [cx, 700], [0, 700], [0, 0]];
    const inner: Point[] = Array.from({ length: 6 }, (_, i) => {
      const angle = -Math.PI / 2 + (i * Math.PI) / 3;
      return [cx + Math.cos(angle) * rx, cy + Math.sin(angle) * ry];
    });

    const polys: Point[][] = [];
    for (let i = 0; i < 6; i++) {
      const j = (i + 1) % 6;
      if (random() > 0.3) polys.push([outer[i], outer[j], inner[i]], [outer[j], inner[j], inner[i]]);
      else polys.push([outer[i], outer[j], inner[j], inner[i]]);
    }
    polys.push(inner);

    // Fisher–Yates sobre una copia (no muta props)
    const ordered = [...photos];
    for (let i = ordered.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [ordered[i], ordered[j]] = [ordered[j], ordered[i]];
    }

    return polys.map((points, i) => {
      const xs = points.map(p => p[0]);
      const ys = points.map(p => p[1]);
      const x = Math.min(...xs);
      const y = Math.min(...ys);
      return {
        key: `${seed}-${i}`,
        clipId: `${id}-${seed}-${i}`,
        polygon: toPoints(points),
        box: { x, y, width: Math.max(...xs) - x, height: Math.max(...ys) - y },
        photo: ordered.length ? ordered[i % ordered.length] : null,
      };
    });
  }, [seed, photos, id]);

  return (
    <svg
      className="geometric-collage"
      viewBox="0 0 1000 700"
      preserveAspectRatio={fillFrame ? 'xMidYMid slice' : 'xMidYMid meet'}
      role="group"
      aria-label="Collage de fotos del evento"
      onPointerEnter={() => setPaused(true)}
      onPointerLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      <defs>
        {tiles.map(t => (
          <clipPath key={t.key} id={t.clipId}>
            <polygon points={t.polygon} />
          </clipPath>
        ))}
      </defs>

      {tiles.map((t, i) => {
        const { photo, box } = t;
        const isLink = interactive && !!photo?.href;

        const image = photo && (
          <image
            href={photo.url}
            {...box}
            preserveAspectRatio="xMidYMid slice"
            clipPath={`url(#${t.clipId})`}
            onError={e => { e.currentTarget.style.display = 'none'; }}
          />
        );

        return (
          <g
            key={t.key}
            className={`collage-tile${isLink ? ' collage-tile--link' : ''}`}
            style={{ animationDelay: `${i * 60}ms` }}
          >
            <polygon points={t.polygon} fill="#18334a" />
            {isLink ? (
              <a href={photo!.href} aria-label={photo!.label}>
                <title>{photo!.label}</title>
                {image}
                {/* Capa de foco visible con teclado */}
                <polygon className="collage-focus-ring" points={t.polygon} fill="none" />
              </a>
            ) : (
              <g>
                {photo && <title>{photo.label}</title>}
                {image}
              </g>
            )}
            <polygon
              points={t.polygon}
              fill="none"
              stroke="white"
              strokeWidth={fillFrame ? 3 : 6}
              strokeLinejoin="round"
              pointerEvents="none"
            />
          </g>
        );
      })}
    </svg>
  );
}
