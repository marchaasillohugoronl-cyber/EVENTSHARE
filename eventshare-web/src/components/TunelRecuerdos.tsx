'use client';

import { useEffect, useRef, useState } from 'react';
import { esVideo } from '@/lib/video';
import type { Post } from '@/lib/tipos';

type Point = [number, number];
type Media = HTMLImageElement | HTMLVideoElement;

// Proyecta cada foto sobre la pared del cilindro, en dos triángulos.
function texture(ctx: CanvasRenderingContext2D, media: Media, corners: Point[]) {
  const width = media instanceof HTMLVideoElement ? media.videoWidth : media.naturalWidth;
  const height = media instanceof HTMLVideoElement ? media.videoHeight : media.naturalHeight;
  if (!width || !height) return;
  const ratio = 1.15;
  const sw = Math.min(width, height * ratio), sh = sw / ratio;
  const sx = (width - sw) / 2, sy = (height - sh) / 2;
  const [a, b, c, d] = corners;
  for (const second of [false, true]) {
    ctx.save();
    ctx.beginPath();
    const triangle = second ? [b, c, d] : [a, b, d];
    triangle.forEach((p, i) => i ? ctx.lineTo(...p) : ctx.moveTo(...p));
    ctx.closePath(); ctx.clip();
    if (second) ctx.transform(c[0] - d[0], c[1] - d[1], c[0] - b[0], c[1] - b[1], b[0] + d[0] - c[0], b[1] + d[1] - c[1]);
    else ctx.transform(b[0] - a[0], b[1] - a[1], d[0] - a[0], d[1] - a[1], ...a);
    ctx.drawImage(media, sx, sy, sw, sh, 0, 0, 1, 1);
    ctx.restore();
  }
}

export default function TunelRecuerdos({ posts, name }: { posts: Post[]; name: string }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [paused, setPaused] = useState(false);
  const pausedRef = useRef(false);
  pausedRef.current = paused;
  const mediaKey = JSON.stringify(posts.filter(p => p.photoUrl).map(p => p.photoUrl));

  useEffect(() => {
    const element = canvas.current;
    const ctx = element?.getContext('2d', { alpha: false });
    if (!element || !ctx) return;
    let stopped = false, frame = 0, width = 1, height = 1, travel = 0, rotation = 0, last = 0;
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    let videoCount = 0;
    const assets: Media[] = [];
    for (const url of JSON.parse(mediaKey) as string[]) {
      if (esVideo(url)) {
        // Reutiliza como textura un máximo de dos decodificadores de video.
        if (videoCount++ >= 2) continue;
        const video = document.createElement('video');
        video.muted = true; video.loop = true; video.playsInline = true; video.preload = 'auto'; video.src = url;
        void video.play().catch(() => {});
        assets.push(video);
      } else {
        const image = new Image(); image.src = url; assets.push(image);
      }
    }
    const resize = new ResizeObserver(([entry]) => {
      width = entry.contentRect.width; height = entry.contentRect.height;
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      element.width = Math.round(width * dpr); element.height = Math.round(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    });
    resize.observe(element);
    const render = (now: number) => {
      if (stopped) return;
      frame = requestAnimationFrame(render);
      const delta = last ? Math.min(now - last, 50) : 0; last = now;
      if (document.visibilityState !== 'visible') return;
      if (!pausedRef.current && !reducedMotion.matches) {
        // Avance pausado y continuo: se siente como una exploración, no un salto brusco.
        travel += delta * .058;
        // En coordenadas de pantalla, el ángulo positivo gira hacia la derecha.
        rotation = (rotation + delta * .000018) % (Math.PI * 2);
      }
      const available = assets.filter(asset => asset instanceof HTMLVideoElement ? asset.readyState >= 2 : asset.complete && asset.naturalWidth > 0);
      ctx.fillStyle = '#030b16'; ctx.fillRect(0, 0, width, height);
      if (!available.length) return;
      const cx = width * .5, cy = height * .68;
      const projection = Math.max(width * .6, height) * 730;
      const spacing = 360, rows = 20, columns = 12;
      const shift = travel % spacing, cycle = Math.floor(travel / spacing);
      const point = (angle: number, depth: number): Point => [cx + Math.cos(angle) * projection / depth, cy + Math.sin(angle) * projection / depth];
      // Dibuja desde el fondo; las filas cercanas cubren sus bordes sin huecos.
      for (let row = rows - 1; row >= 0; row--) {
        const near = 480 + row * spacing - shift, far = near + spacing - 9;
        for (let col = 0; col < columns; col++) {
          const angle = col * Math.PI * 2 / columns - Math.PI / 2 + rotation;
          const end = angle + Math.PI * 2 / columns - .009;
          const corners = [point(angle, near), point(end, near), point(end, far), point(angle, far)];
          if (corners.every(p => p[0] < -30) || corners.every(p => p[0] > width + 30) || corners.every(p => p[1] < -30) || corners.every(p => p[1] > height + 30)) continue;
          const tileSeed = Math.imul(row + cycle + 1, 73856093) ^ Math.imul(col + 1, 19349663);
          const asset = available[(tileSeed >>> 0) % available.length];
          texture(ctx, asset, corners);
          ctx.beginPath(); corners.forEach((p, i) => i ? ctx.lineTo(...p) : ctx.moveTo(...p)); ctx.closePath();
          ctx.strokeStyle = 'rgba(117, 224, 255, .82)'; ctx.lineWidth = Math.max(.45, Math.min(2.4, 1500 / near)); ctx.stroke();
          ctx.fillStyle = `rgba(0,0,0,${Math.max(0, (far - 1900) / 6500)})`; ctx.fill();
        }
      }
      const radius = projection / (480 + rows * spacing - shift);
      const shade = ctx.createRadialGradient(cx, cy, radius * .65, cx, cy, radius * 1.4);
      shade.addColorStop(0, '#020914'); shade.addColorStop(.6, '#020914e8'); shade.addColorStop(1, '#02091400');
      ctx.fillStyle = shade; ctx.beginPath(); ctx.arc(cx, cy, radius * 1.4, 0, Math.PI * 2); ctx.fill();
    };
    frame = requestAnimationFrame(render);
    return () => {
      stopped = true; cancelAnimationFrame(frame); resize.disconnect();
      for (const asset of assets) if (asset instanceof HTMLVideoElement) { asset.pause(); asset.removeAttribute('src'); asset.load(); }
    };
  }, [mediaKey]);

  return <div className="memory-tunnel" aria-label="Túnel continuo de fotos y videos">
    <canvas ref={canvas} className="memory-tunnel-canvas" aria-label={`Recuerdos de ${name}`} />
    <div className="memory-tunnel-title"><h2>{name}</h2></div>
    <button className="memory-tunnel-pause" aria-pressed={paused} onClick={() => setPaused(value => !value)}>{paused ? 'Reanudar túnel' : 'Pausar túnel'}</button>
  </div>;
}
