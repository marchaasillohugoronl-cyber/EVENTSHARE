import { clamp, nearestTile, type Gesture, type HandFrame, type Point, type TileBox, type TileTransform } from './gestureRecognition';

export type Manipulation = { transforms: Record<number, TileTransform>; selected: number | null };
export type InteractionResult = Manipulation & { cursor: Point | null; drawing: boolean; clear: boolean; label: string; paused: boolean };
export class GestureInteraction {
  private primary: number | null = null;
  private lastGesture: Gesture = 'none';
  private paused = false;
  private transforms: Record<number, TileTransform> = {};
  private grip: { tile: number; start: Point; transform: TileTransform } | null = null;
  private zoom: { hand: number; gap: number; scale: number } | null = null;

  update(frame: HandFrame, toSvg: (point: Point) => Point, tiles: TileBox[], bounds: { x: number; y: number; width: number; height: number }): InteractionResult {
    let hand = frame.hands.find(h => h.id === this.primary);
    if (!hand) {
      this.grip = null; this.zoom = null; this.lastGesture = 'none';
      hand = frame.hands[0]; this.primary = hand?.id ?? null;
    }
    let clear = false, drawing = false;
    let label = this.paused ? 'En pausa · cierra el puño para continuar' : 'Muestra tu mano a la cámara';
    if (hand) {
      const point = toSvg(hand.point);
      if (hand.gesture === 'palm' && this.lastGesture !== 'palm') {
        this.paused = true; clear = true; this.grip = null; this.zoom = null;
      } else if (hand.gesture === 'fist') this.paused = false;
      if (this.paused) label = 'En pausa · cierra el puño para continuar';
      else {
        if (hand.gesture === 'pinch') {
          if (!this.grip && this.lastGesture !== 'pinch') {
            const tile = nearestTile(point, tiles, this.transforms, bounds.width * .07);
            if (tile !== null) this.grip = { tile, start: point, transform: this.transforms[tile] ?? { x: 0, y: 0, scale: 1 } };
          }
          if (this.grip) {
            const { tile, start, transform } = this.grip;
            const box = tiles.find(t => t.id === tile);
            if (!box) { this.grip = null; this.zoom = null; }
            else {
              const other = frame.hands.find(h => h.id !== hand.id);
              let scale = this.transforms[tile]?.scale ?? transform.scale;
              if (other) {
                if (!this.zoom || this.zoom.hand !== other.id) this.zoom = { hand: other.id, gap: Math.max(.15, other.pinch), scale };
                scale = clamp(this.zoom.scale * Math.max(.1, other.pinch) / this.zoom.gap, .65, 2.2);
              } else this.zoom = null;
              const marginX = Math.min(bounds.width / 2, box.width * scale / 2);
              const marginY = Math.min(bounds.height / 2, box.height * scale / 2);
              const cx = box.x + box.width / 2, cy = box.y + box.height / 2;
              const x = clamp(cx + transform.x + point.x - start.x, bounds.x + marginX, bounds.x + bounds.width - marginX) - cx;
              const y = clamp(cy + transform.y + point.y - start.y, bounds.y + marginY, bounds.y + bounds.height - marginY) - cy;
              this.transforms = { ...this.transforms, [tile]: { x, y, scale } };
              label = other ? `Ampliar · ${Math.round(scale * 100)} %` : 'Mover foto · separa los dedos para soltar';
            }
          } else label = 'Acerca el cursor a una fotografía';
        } else {
          this.grip = null; this.zoom = null;
          drawing = hand.gesture === 'draw';
          label = drawing ? 'Dibujando' : hand.gesture === 'fist' ? 'Interacción reanudada' : 'Índice: dibujar · pellizco: mover';
        }
      }
      this.lastGesture = hand.gesture;
    }
    return { transforms: this.transforms, selected: this.grip?.tile ?? null, cursor: hand?.point ?? null, drawing, clear, label, paused: this.paused };
  }
}
