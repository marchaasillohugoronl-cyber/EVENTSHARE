'use client';

import { useEffect, useId, useRef, useState, type CSSProperties } from 'react';
import dynamic from 'next/dynamic';
import type { Manipulation } from '@/lib/gestureInteraction';

const ControlGestos = dynamic(() => import('./ControlGestos'), { ssr: false });

type Photo = { url: string; label: string; href?: string };
type Props = {
  photos: Photo[];
  interactive?: boolean;
  fillFrame?: boolean;
  /** Tiempo entre cambios de fotos. 0 desactiva la rotación. */
  intervalMs?: number;
  magicEnabled?: boolean;
  onDisableMagic?: () => void;
};

// Misma composición y separaciones que collage-demo.html (740 × 1290).
const TILES = [
  [308, 192, 175, 121], [490, 236, 88, 98], [176, 268, 123, 87],
  [308, 322, 175, 196], [491, 344, 125, 146], [624, 426, 60, 93],
  [81, 399, 76, 118], [164, 364, 135, 155], [70, 527, 175, 120],
  [253, 527, 230, 253], [490, 499, 120, 195], [616, 527, 92, 134],
  [35, 654, 112, 126], [154, 654, 92, 126], [491, 703, 175, 102],
  [118, 788, 175, 110], [300, 788, 183, 140], [491, 815, 107, 114],
  [175, 905, 118, 95], [301, 937, 132, 108], [440, 937, 84, 69],
];
const COLORS = [['#8aa39b', '#3f5a52'], ['#c9b58a', '#7b6a45'], ['#7f97ad', '#34495e'], ['#a7b27a', '#52602f']];

export default function CollageGeometrico({ photos, interactive = false, fillFrame = false, intervalMs = 10000, magicEnabled = false, onDisableMagic }: Props) {
  const id = useId().replaceAll(':', '');
  const svgRef = useRef<SVGSVGElement>(null);
  const [landscape, setLandscape] = useState(false);
  const spread = landscape ? 2.6 : 1;
  const [manipulation, setManipulation] = useState<Manipulation>({ transforms: {}, selected: null, hovered: null });
  useEffect(() => { setManipulation({ transforms: {}, selected: null, hovered: null }); }, [magicEnabled, landscape]);

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      setLandscape(width / height >= 1.2);
    });
    observer.observe(svg);
    return () => observer.disconnect();
  }, []);
  const [offset, setOffset] = useState(0);
  const [paused, setPaused] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [failed, setFailed] = useState<Set<string>>(() => new Set());
  const available = photos.filter(photo => !failed.has(photo.url));

  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReducedMotion(query.matches);
    update();
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);

  useEffect(() => {
    if (intervalMs <= 0 || paused || magicEnabled || reducedMotion || available.length < 2) return;
    const timer = setInterval(() => {
      if (document.visibilityState === 'visible') setOffset(value => value + 1);
    }, intervalMs);
    return () => clearInterval(timer);
  }, [intervalMs, paused, magicEnabled, reducedMotion, available.length]);

  const tiles = TILES.map(([x, y, width, height], i) => ({ id: i, x: x * spread, y, width: width * spread, height }));

  return (
    <><svg
      ref={svgRef}
      className={`geometric-collage${landscape ? ' geometric-collage--landscape' : ''}${fillFrame ? ' geometric-collage--fill' : ''}${magicEnabled ? ' geometric-collage--magic' : ''}`}
      viewBox={landscape ? '0 108 1924 1020' : '0 140 740 960'}
      preserveAspectRatio="xMidYMid meet"
      role="group"
      aria-label="Collage de recuerdos del evento"
      onPointerEnter={() => { if (interactive) setPaused(true); }}
      onPointerLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) setPaused(false); }}
    >
      <defs>
        {COLORS.map(([start, end], i) => (
          <linearGradient key={i} id={`${id}-g${i}`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor={start} /><stop offset="1" stopColor={end} />
          </linearGradient>
        ))}
      </defs>
      {TILES.map((tile, i) => ({ tile, i })).sort((a, b) => Number(a.i === manipulation.selected) - Number(b.i === manipulation.selected)).map(({ tile: [x, y, width, height], i }) => {
        const photo = available.length ? available[(i + offset) % available.length] : undefined;
        const isLink = interactive && !magicEnabled && !!photo?.href;
        const box = { x: x * spread, y, width: width * spread, height };
        const transform = magicEnabled ? manipulation.transforms[i] : undefined;
        const cx = box.x + box.width / 2, cy = box.y + box.height / 2;
        const content = <>
          <rect {...box} fill={`url(#${id}-g${i % COLORS.length})`} />
          {photo && <image
            {...box}
            href={photo.url}
            preserveAspectRatio="xMidYMid slice"
            onError={() => setFailed(previous => new Set(previous).add(photo.url))}
          />}
          <rect
            x={box.x + 3}
            y={box.y + 3}
            width={box.width - 6}
            height={box.height - 6}
            className="collage-photo-border"
          />
        </>;
        return (
          <g key={i} data-magic-tile={i} className={magicEnabled ? manipulation.selected === i ? 'collage-tile--selected' : manipulation.hovered === i ? 'collage-tile--hovered' : undefined : undefined}
            transform={transform ? `translate(${transform.x} ${transform.y}) translate(${cx} ${cy}) scale(${transform.scale}) translate(${-cx} ${-cy})` : undefined}>
          <g
            key={`${i}-${offset}-${photo?.url ?? 'empty'}`}
            className={`collage-tile${isLink ? ' collage-tile--link' : ''}`}
            style={{
              '--i': i,
              '--enter-x': `${(x + width / 2 - 370) * .55}px`,
              '--enter-y': `${(y + height / 2 - 620) * .4}px`,
              '--enter-rotation': `${i % 2 === 0 ? -9 : 9}deg`,
            } as CSSProperties}
          >
            {isLink ? <a href={photo!.href} aria-label={photo!.label}>
              <title>{photo!.label}</title>
              {content}
              <rect {...box} className="collage-focus-ring" fill="none" />
            </a> : <>{photo && <title>{photo.label}</title>}{content}</>}
          </g>
          </g>
        );
      })}

    </svg>
    {magicEnabled && onDisableMagic && <ControlGestos layoutKey={String(landscape)} svgRef={svgRef} tiles={available.length ? tiles : []} onChange={setManipulation} onDisable={onDisableMagic} />}
    </>
  );
}
