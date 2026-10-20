'use client';

import { useEffect, useId, useState, type CSSProperties } from 'react';

type Photo = { url: string; label: string; href?: string };
type Props = {
  photos: Photo[];
  interactive?: boolean;
  fillFrame?: boolean;
  /** Tiempo entre cambios de fotos. 0 desactiva la rotación. */
  intervalMs?: number;
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

export default function CollageGeometrico({ photos, interactive = false, fillFrame = false, intervalMs = 10000 }: Props) {
  const id = useId().replaceAll(':', '');
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
    if (intervalMs <= 0 || paused || reducedMotion || available.length < 2) return;
    const timer = setInterval(() => {
      if (document.visibilityState === 'visible') setOffset(value => value + 1);
    }, intervalMs);
    return () => clearInterval(timer);
  }, [intervalMs, paused, reducedMotion, available.length]);

  return (
    <svg
      className={`geometric-collage${fillFrame ? ' geometric-collage--fill' : ''}`}
      viewBox="0 0 740 1290"
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
      {TILES.map(([x, y, width, height], i) => {
        const photo = available.length ? available[(i + offset) % available.length] : undefined;
        const isLink = interactive && !!photo?.href;
        const box = { x, y, width, height };
        const content = <>
          <rect {...box} fill={`url(#${id}-g${i % COLORS.length})`} />
          {photo && <image
            {...box}
            href={photo.url}
            preserveAspectRatio="xMidYMid slice"
            onError={() => setFailed(previous => new Set(previous).add(photo.url))}
          />}
        </>;
        return (
          <g key={`${i}-${photo?.url ?? 'empty'}`} className={`collage-tile${isLink ? ' collage-tile--link' : ''}`} style={{ '--i': i } as CSSProperties}>
            {isLink ? <a href={photo!.href} aria-label={photo!.label}>
              <title>{photo!.label}</title>
              {content}
              <rect {...box} className="collage-focus-ring" fill="none" />
            </a> : <>{photo && <title>{photo.label}</title>}{content}</>}
          </g>
        );
      })}

      <text className="collage-title" x="80" y="140">Capture</text>
      <text className="collage-title" x="80" y="178">The Moment</text>
      <text className="collage-subtitle" x="84" y="201">Momentos que nos unen</text>
      <line className="collage-rule" x1="84" y1="218" x2="115" y2="218" />
      <text className="collage-name" x="85" y="256">Recuerdos compartidos</text>

      <text className="collage-slogan" x="592" y="278">GOOD</text>
      <text className="collage-slogan is-red" x="642" y="274">DAY</text>
      <text className="collage-slogan" x="592" y="304">GOOD</text>
      <text className="collage-slogan" x="640" y="304">&amp;</text>
      <text className="collage-slogan is-blue" x="619" y="327">PEOPLE</text>

      <text className="collage-label" x="85" y="391">RECUERDOS</text>
      <text className="collage-badge" x="624" y="416">01</text>
      <text className="collage-badge" x="88" y="805">02</text>
      <text className="collage-badge" x="602" y="831">03</text>
      <text className="collage-credit" x="532" y="950">Creado juntos</text>
      <text className="collage-credit is-bold" x="532" y="969">Nuestra comunidad</text>

      <text className="collage-caption" x="370" y="1075">Cada foto cuenta una historia.</text>
      <text className="collage-caption" x="370" y="1091">Gracias por compartir tus ideas, tu alegría y estos momentos.</text>
      <text className="collage-caption" x="370" y="1107">Que sigamos creando recuerdos juntos.</text>
      <text className="collage-hashtag" x="370" y="1144">#MomentosCompartidos</text>
    </svg>
  );
}
