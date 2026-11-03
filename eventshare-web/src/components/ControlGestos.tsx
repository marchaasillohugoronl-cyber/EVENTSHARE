'use client';
import { useEffect, useRef, useState, type RefObject } from 'react';
import { useHandTracking } from '@/hooks/useHandTracking';
import { GestureInteraction, type InteractionResult, type Manipulation } from '@/lib/gestureInteraction';
import type { Point, TileBox } from '@/lib/gestureRecognition';
import GestureCanvas, { type GestureCanvasHandle } from './GestureCanvas';
import GestureCursor from './GestureCursor';

export default function ControlGestos({ svgRef, tiles, layoutKey, onChange, onDisable }: {
  svgRef: RefObject<SVGSVGElement | null>; tiles: TileBox[];
  layoutKey: string;
  onChange: (value: Manipulation) => void; onDisable: () => void;
}) {
  const root = useRef<HTMLDivElement>(null);
  const canvas = useRef<GestureCanvasHandle>(null);
  const engine = useRef(new GestureInteraction());
  const [state, setState] = useState<InteractionResult | null>(null);
  useEffect(() => {
    engine.current = new GestureInteraction(); canvas.current?.clear(); setState(null);
    onChange({ transforms: {}, selected: null });
  }, [layoutKey, onChange]);
  const { status, error, cameraActive } = useHandTracking(true, frame => {
    const svg = svgRef.current, overlay = root.current;
    const matrix = svg?.getScreenCTM();
    if (!svg || !overlay || !matrix) return;
    const rect = overlay.getBoundingClientRect();
    const toSvg = (p: Point) => {
      const point = new DOMPoint(rect.left + p.x * rect.width, rect.top + p.y * rect.height).matrixTransform(matrix.inverse());
      return { x: point.x, y: point.y };
    };
    const result = engine.current.update(frame, toSvg, tiles, svg.viewBox.baseVal);
    if (result.clear) canvas.current?.clear();
    canvas.current?.add(result.drawing ? result.cursor : null);
    onChange({ transforms: result.transforms, selected: result.selected });
    setState(result);
  });
  return <div ref={root} className="gesture-overlay">
    <GestureCanvas ref={canvas} />
    <GestureCursor point={state?.cursor ?? null} selected={state?.selected != null} paused={state?.paused ?? false} />
    <div className="gesture-hud">
      <div className="gesture-hud-heading"><strong>✦ Magic Touch</strong><button type="button" onClick={onDisable}>Desactivar</button></div>
      <p className="gesture-camera" role="status"><span className={cameraActive ? 'is-active' : ''} />{cameraActive ? status === 'active' ? 'Cámara activa · procesamiento local' : 'Cámara activa · preparando detector…' : status === 'error' ? 'Cámara detenida' : 'Esperando permiso de cámara…'}</p>
      {error ? <p role="alert" className="gesture-error">{error}</p> : <p role="status">{state?.label ?? 'Permite el acceso a la cámara para comenzar.'}</p>}
      <details><summary>Cómo usar los gestos</summary><p>Índice levantado: dibujar. Pellizco: tomar y mover. Mantén el pellizco y abre o cierra el pulgar y el índice de la otra mano para cambiar el tamaño.</p><p>Palma abierta medio segundo: borrar y pausar. Puño: continuar. Usa la cámara del equipo conectado al televisor.</p></details>
    </div>
  </div>;
}
