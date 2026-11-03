'use client';
import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import type { Point } from '@/lib/gestureRecognition';

export type GestureCanvasHandle = { add: (point: Point | null) => void; clear: () => void };
type Segment = { a: Point; b: Point; time: number };
export default forwardRef<GestureCanvasHandle>(function GestureCanvas(_, ref) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const segments = useRef<Segment[]>([]);
  const previous = useRef<Point | null>(null);
  useImperativeHandle(ref, () => ({
    add(point) {
      if (point) {
        segments.current.push({ a: previous.current ?? point, b: point, time: performance.now() });
        if (segments.current.length > 2400) segments.current.shift();
      }
      previous.current = point;
    },
    clear() { segments.current = []; previous.current = null; },
  }), []);
  useEffect(() => {
    const node = canvas.current;
    const ctx = node?.getContext('2d');
    if (!node || !ctx) return;
    let raf = 0, width = 0, height = 0;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
    const resize = () => {
      const rect = node.getBoundingClientRect(); width = rect.width; height = rect.height;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      node.width = Math.round(width * dpr); node.height = Math.round(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    const observer = new ResizeObserver(resize); observer.observe(node); resize();
    const paint = (now: number) => {
      ctx.clearRect(0, 0, width, height);
      segments.current = segments.current.filter(s => now - s.time < 90000);
      ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.strokeStyle = '#b9fcff'; ctx.shadowColor = '#00d9ff';
      ctx.shadowBlur = reduced.matches ? 10 : 15 + Math.sin(now / 400) * 4;
      ctx.lineWidth = Math.max(3, Math.min(width, height) / 200);
      for (const segment of segments.current) {
        ctx.globalAlpha = Math.min(1, (90000 - now + segment.time) / 3000);
        ctx.beginPath(); ctx.moveTo(segment.a.x * width, segment.a.y * height); ctx.lineTo(segment.b.x * width, segment.b.y * height); ctx.stroke();
      }
      ctx.globalAlpha = 1; raf = requestAnimationFrame(paint);
    };
    raf = requestAnimationFrame(paint);
    return () => { cancelAnimationFrame(raf); observer.disconnect(); };
  }, []);
  return <canvas ref={canvas} className="gesture-canvas" aria-hidden="true" />;
});
