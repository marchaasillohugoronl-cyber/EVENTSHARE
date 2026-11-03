/** Geometry is normalized by palm size, so distance from the camera is not a gesture. */
export type Landmark = { x: number; y: number; z?: number };
export type Point = { x: number; y: number };
export type Gesture = 'none' | 'draw' | 'pinch' | 'palm' | 'fist';
export type RawHand = { landmarks: Landmark[]; confidence: number; side: string };
export type TrackedHand = { id: number; point: Point; gesture: Gesture; pinch: number };
export type HandFrame = { hands: TrackedHand[]; timestamp: number };
export const MIN_CONFIDENCE = .7;
export const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));
export const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);

export function recognizeGesture(landmarks: Landmark[], wasPinching = false, aspect = 4 / 3): { gesture: Gesture; pinch: number } {
  if (landmarks.length !== 21 || landmarks.some(p => !Number.isFinite(p.x) || !Number.isFinite(p.y))) return { gesture: 'none', pinch: 0 };
  const p = landmarks.map(v => ({ x: v.x * aspect, y: v.y }));
  const palm = distance(p[0], p[9]);
  if (palm < .025) return { gesture: 'none', pinch: 0 };
  const extended = [8, 12, 16, 20].map(tip => {
    const a = p[tip - 2], b = p[tip - 1], c = p[tip];
    const dot = (a.x - b.x) * (c.x - b.x) + (a.y - b.y) * (c.y - b.y);
    const cosine = dot / Math.max(.000001, distance(a, b) * distance(c, b));
    return cosine < -.5 && distance(c, p[0]) > distance(a, p[0]) * 1.12;
  });
  const pinch = distance(p[4], p[8]) / palm;
  const fist = extended.every(v => !v) && distance(p[8], p[0]) < distance(p[5], p[0]) * 1.25;
  if (fist) return { gesture: 'fist', pinch };
  // Different enter/exit thresholds keep a held pinch from flickering.
  if (pinch < (wasPinching ? .42 : .28)) return { gesture: 'pinch', pinch };
  if (extended.every(Boolean) && distance(p[4], p[5]) / palm > .45) return { gesture: 'palm', pinch };
  if (extended[0] && extended.slice(1).every(v => !v)) return { gesture: 'draw', pinch };
  return { gesture: 'none', pinch };
}

type Track = { id: number; wrist: Point; point: Point; side: string; pinch: number; gesture: Gesture; candidate: Gesture; since: number; seen: number };
const HOLD: Record<Gesture, number> = { none: 70, pinch: 100, draw: 160, palm: 450, fist: 300 };

/** Tracks physical hands by proximity, not the detector's changing array order. */
export class HandTracker {
  private tracks: Track[] = [];
  private sequence = 0;
  update(raw: RawHand[], timestamp: number, aspect = 4 / 3): HandFrame {
    const previous = this.tracks.filter(t => timestamp - t.seen < 250);
    const next: Track[] = [];
    for (const hand of raw) {
      if (hand.confidence < MIN_CONFIDENCE || hand.landmarks.length !== 21 || hand.landmarks.some(p => !Number.isFinite(p.x) || !Number.isFinite(p.y))) continue;
      const wrist = hand.landmarks[0];
      const candidates = previous.filter(t => !next.some(n => n.id === t.id) && distance(t.wrist, wrist) < .3);
      candidates.sort((a, b) => (distance(a.wrist, wrist) + (a.side === hand.side ? 0 : .08)) - (distance(b.wrist, wrist) + (b.side === hand.side ? 0 : .08)));
      const old = candidates[0];
      const recognized = recognizeGesture(hand.landmarks, old?.candidate === 'pinch', aspect);
      const point = { x: clamp(1 - hand.landmarks[8].x, 0, 1), y: clamp(hand.landmarks[8].y, 0, 1) };
      const alpha = old ? 1 - Math.exp(-Math.min(100, timestamp - old.seen) / 65) : 1;
      const track: Track = old ? { ...old } : { id: ++this.sequence, wrist, point, side: hand.side, pinch: recognized.pinch, gesture: 'none', candidate: 'none', since: timestamp, seen: timestamp };
      if (recognized.gesture !== track.candidate) { track.candidate = recognized.gesture; track.since = timestamp; }
      if (timestamp - track.since >= HOLD[track.candidate]) track.gesture = track.candidate;
      track.point = { x: track.point.x + (point.x - track.point.x) * alpha, y: track.point.y + (point.y - track.point.y) * alpha };
      track.pinch += (recognized.pinch - track.pinch) * alpha;
      track.wrist = wrist; track.side = hand.side; track.seen = timestamp;
      next.push(track);
    }
    // Losing a hand releases its gesture immediately. No stale grabs after occlusion.
    this.tracks = next;
    return { timestamp, hands: next.map(({ id, point, gesture, pinch }) => ({ id, point, gesture, pinch })) };
  }
}

export type TileTransform = { x: number; y: number; scale: number };
export type TileBox = { id: number; x: number; y: number; width: number; height: number };
export function nearestTile(point: Point, tiles: TileBox[], transforms: Record<number, TileTransform>, maxDistance: number): number | null {
  let selected: number | null = null, best = Infinity;
  for (const box of tiles) {
    const t = transforms[box.id] ?? { x: 0, y: 0, scale: 1 };
    const cx = box.x + box.width / 2 + t.x, cy = box.y + box.height / 2 + t.y;
    const edge = Math.hypot(Math.max(0, Math.abs(point.x - cx) - box.width * t.scale / 2), Math.max(0, Math.abs(point.y - cy) - box.height * t.scale / 2));
    const score = edge * 10 + Math.hypot(point.x - cx, point.y - cy);
    if (edge <= maxDistance && score < best) { selected = box.id; best = score; }
  }
  return selected;
}
