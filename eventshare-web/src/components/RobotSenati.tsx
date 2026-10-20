'use client';

import { useId, useState } from 'react';
import { Pause, Play, RotateCcw } from 'lucide-react';
import { trazadoSenati } from './MarcaSenati';

/** Vector geometry, lighting and articulated animation; no raster assets. */
export default function RobotSenati({ compact = false }: { compact?: boolean }) {
  const id = useId().replace(/:/g, '');
  const [paused, setPaused] = useState(false);
  const [take, setTake] = useState(0);
  const paint = (name: string) => `url(#${id}-${name})`;
  return <div className={`robot-scene${compact ? ' robot-scene--compact' : ''}${paused ? ' is-paused' : ''}`}>
    <div className="robot-orbit orbit-one" aria-hidden="true" /><div className="robot-orbit orbit-two" aria-hidden="true" />
    <div className="robot-greeting">¡Bienvenido a la comunidad SENATI! <span>Comparte tus mejores momentos.</span></div>
    <div className="robot-stage" key={take}>
      <svg className="senati-robot" viewBox="0 0 600 620" role="img" aria-label="Robot inspirado en SENATI, de cuerpo blanco, brazos azules y ojos cian, flotando y saludando">
        <defs>
          <linearGradient id={`${id}-shell`} x1="0" x2="1" y2=".3"><stop stopColor="#8196b4" /><stop offset=".17" stopColor="#e8eef7" /><stop offset=".4" stopColor="#fff" /><stop offset=".7" stopColor="#eff4fa" /><stop offset="1" stopColor="#9daec4" /></linearGradient>
          <linearGradient id={`${id}-visor`} x2=".3" y2="1"><stop stopColor="#303e51" /><stop offset=".45" stopColor="#071120" /><stop offset="1" stopColor="#01060d" /></linearGradient>
          <linearGradient id={`${id}-blue`} x2="1" y2="1"><stop stopColor="#3966ff" /><stop offset=".5" stopColor="#113dc4" /><stop offset="1" stopColor="#061d83" /></linearGradient>
          <linearGradient id={`${id}-metal`}><stop stopColor="#566a82" /><stop offset=".4" stopColor="#d1deeb" /><stop offset="1" stopColor="#62758c" /></linearGradient>
          <filter id={`${id}-glow`} x="-100%" y="-50%" width="300%" height="200%"><feGaussianBlur stdDeviation="7" /></filter>
        </defs>
        <ellipse className="robot-ground" cx="300" cy="552" rx="115" ry="18" fill="#00e5ff" opacity=".22" />
        <ellipse cx="300" cy="548" rx="158" ry="36" fill="none" stroke="#73ddff" strokeOpacity=".3" />
        <g className="robot-float">
          <g className="robot-arm robot-arm-left">
            <ellipse cx="166" cy="302" rx="34" ry="47" fill={paint('blue')} />
            <path d="M155 321 L129 377 L158 391 L183 335" fill={paint('metal')} stroke="#91a6be" strokeWidth="2" />
            <path d="M128 358 Q151 354 171 380 L148 455 Q124 470 96 438Z" fill={paint('shell')} stroke="#c8d6e7" strokeWidth="2" />
            <circle cx="136" cy="405" r="16" fill="#dce6ef" stroke="#9eaec3" strokeWidth="3" />
            <path d="M100 438 Q78 466 104 486 Q128 502 146 471 L141 451 L124 467 L114 457 L124 442" fill={paint('blue')} />
          </g>
          <g className="robot-arm robot-arm-right">
            <ellipse cx="434" cy="302" rx="34" ry="47" fill={paint('blue')} />
            <path d="M445 321 L471 377 L442 391 L417 335" fill={paint('metal')} stroke="#91a6be" strokeWidth="2" />
            <path d="M472 358 Q449 354 429 380 L452 455 Q476 470 504 438Z" fill={paint('shell')} stroke="#c8d6e7" strokeWidth="2" />
            <circle cx="464" cy="405" r="16" fill="#dce6ef" stroke="#9eaec3" strokeWidth="3" />
            <path d="M500 438 Q522 466 496 486 Q472 502 454 471 L459 451 L476 467 L486 457 L476 442" fill={paint('blue')} />
          </g>
          <ellipse cx="181" cy="295" rx="28" ry="64" fill={paint('metal')} /><ellipse cx="419" cy="295" rx="28" ry="64" fill={paint('metal')} />
          <path d="M300 82 C209 82 174 165 174 291 C174 420 225 505 300 505 C375 505 426 420 426 291 C426 165 391 82 300 82Z" fill={paint('shell')} stroke="#e3edf8" strokeWidth="3" />
          <path d="M201 281 C196 370 225 447 251 465" fill="none" stroke="white" strokeOpacity=".65" strokeWidth="9" strokeLinecap="round" />
          <path d="M223 135 Q300 89 377 135" fill="none" stroke="white" strokeWidth="13" strokeLinecap="round" />
          <g className="robot-face">
            <path d="M300 137 C231 137 204 164 201 215 C198 263 225 279 300 280 C375 279 402 263 399 215 C396 164 369 137 300 137Z" fill={paint('visor')} stroke="#778795" strokeWidth="4" />
            <path d="M220 190 Q230 151 288 151" fill="none" stroke="#fff" strokeOpacity=".17" strokeWidth="5" strokeLinecap="round" />
            <g className="robot-eyes"><g filter={paint('glow')} fill="#00ffff"><rect x="244" y="176" width="25" height="66" rx="13" /><rect x="331" y="176" width="25" height="66" rx="13" /></g><rect x="245" y="177" width="23" height="64" rx="12" fill="#0cffff" /><rect x="332" y="177" width="23" height="64" rx="12" fill="#0cffff" /></g>
          </g>
          <g transform="translate(234.17 318) scale(1.38)" className="robot-emblem"><path d={trazadoSenati} fill="#1635ed" /></g>
          <rect x="284" y="463" width="32" height="4" rx="2" fill="#54d5ed" />
        </g>
      </svg>
    </div>
    <div className="robot-controls"><button type="button" onClick={() => setPaused(!paused)} aria-label={paused ? 'Reanudar animación del robot' : 'Pausar animación del robot'} aria-pressed={paused}>{paused ? <Play size={14} /> : <Pause size={14} />}</button><button type="button" onClick={() => setTake(take + 1)} aria-label="Repetir entrada del robot"><RotateCcw size={14} /></button><span>DISEÑADO PARA CONECTAR</span></div>
  </div>;
}
