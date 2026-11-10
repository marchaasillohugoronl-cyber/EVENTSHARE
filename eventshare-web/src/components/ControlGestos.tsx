'use client';
import { useEffect, useRef, useState, type RefObject } from 'react';
import { useHandTracking } from '@/hooks/useHandTracking';
import { GestureInteraction, advanceGuide, type GuideStep, type InteractionResult, type Manipulation } from '@/lib/gestureInteraction';
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
  const [guideStep, setGuideStep] = useState<GuideStep>(0);
  const [guideVisible, setGuideVisible] = useState(true);
  const [clearNotice, setClearNotice] = useState(false);
  useEffect(() => {
    engine.current = new GestureInteraction(); canvas.current?.clear(); setState(null);
    onChange({ transforms: {}, selected: null, hovered: null });
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
    canvas.current?.add(result.drawing ? result.cursor : null);
    onChange({ transforms: result.transforms, selected: result.selected, hovered: result.hovered });
    setState(result);
    setGuideStep(step => advanceGuide(step, result));
    if (result.drawing) setClearNotice(false);
  });
  return <div ref={root} className="gesture-overlay">
    <GestureCanvas ref={canvas} />
    <GestureCursor point={state?.cursor ?? null} selected={state?.selected != null} paused={state?.paused ?? false} />
    <div className="gesture-hud">
      <div className="gesture-hud-heading"><strong>✦ Magic Touch</strong><button type="button" onClick={onDisable}>Desactivar</button></div>
      <p className="gesture-camera" role="status"><span className={cameraActive ? 'is-active' : ''} />{cameraActive ? status === 'active' ? 'Cámara activa · procesamiento local' : 'Cámara activa · preparando detector…' : status === 'error' ? 'Cámara detenida' : 'Esperando permiso de cámara…'}</p>
      {error ? <p role="alert" className="gesture-error">{error}</p> : <p role="status">{state?.label ?? 'Permite el acceso a la cámara para comenzar.'}</p>}
      {status === 'active' && guideVisible && <section className="gesture-guide" aria-label="Primeros pasos">
        <div className="gesture-guide-heading"><strong>{guideStep === 3 ? '¡Ya sabes mover fotos!' : `Paso ${guideStep + 1} de 3`}</strong><button type="button" onClick={() => setGuideVisible(false)}>{guideStep === 3 ? 'Listo' : 'Omitir guía'}</button></div>
        {guideStep < 3 ? <ol>
          {['Muestra tu mano a la cámara', 'Acerca el cursor a una foto', 'Junta pulgar e índice para tomarla'].map((text, index) => <li key={text} aria-current={guideStep === index ? 'step' : undefined} className={guideStep > index ? 'is-complete' : ''}><span aria-hidden="true">{guideStep > index ? '✓' : index + 1}</span>{text}</li>)}
        </ol> : <p>Mueve la mano para llevar la foto contigo. Separa los dedos para soltarla.</p>}
        {guideStep === 2 && <p>El borde punteado indica qué foto vas a tomar.</p>}
      </section>}
      <div className="gesture-actions">
        <button type="button" onClick={() => { canvas.current?.clear(); setClearNotice(true); }}>Borrar dibujo</button>
        {!guideVisible && <button type="button" onClick={() => { setGuideStep(0); setGuideVisible(true); }}>Ver guía</button>}
      </div>
      {clearNotice && <p role="status">Dibujo borrado. Las fotos conservan su posición.</p>}
      <details><summary>Cómo usar los gestos</summary><p>Índice levantado: dibujar. Pellizco: tomar y mover. Mantén el pellizco y abre o cierra el pulgar y el índice de la otra mano para cambiar el tamaño.</p><p>Palma abierta medio segundo: pausar sin borrar. Puño: continuar. Para eliminar los trazos, pulsa «Borrar dibujo». Usa la cámara del equipo conectado al televisor.</p></details>
    </div>
  </div>;
}
