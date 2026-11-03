'use client';
import { motion, useReducedMotion } from 'motion/react';
import type { Point } from '@/lib/gestureRecognition';

export default function GestureCursor({ point, selected, paused }: { point: Point | null; selected: boolean; paused: boolean }) {
  const reduced = useReducedMotion();
  if (!point) return null;
  return <div className="gesture-cursor-position" style={{ left: `${point.x * 100}%`, top: `${point.y * 100}%` }} aria-hidden="true">
    <motion.div className={`gesture-cursor${paused ? ' gesture-cursor--paused' : ''}`} animate={{ scale: selected ? .75 : 1, opacity: paused ? .5 : 1 }} transition={{ duration: reduced ? 0 : .12 }}><span /></motion.div>
  </div>;
}
