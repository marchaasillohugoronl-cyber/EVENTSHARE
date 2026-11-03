import assert from 'node:assert/strict';
import { test } from 'node:test';
import { HandTracker, recognizeGesture, nearestTile, type Landmark, type RawHand, type TrackedHand, type Gesture } from '../src/lib/gestureRecognition';
import { GestureInteraction } from '../src/lib/gestureInteraction';

function landmarks(gesture: Gesture): Landmark[] {
  const p = Array.from({ length: 21 }, () => ({ x: .5, y: .9 }));
  p[1] = { x: .4, y: .78 }; p[2] = { x: .32, y: .7 }; p[3] = { x: .26, y: .6 }; p[4] = { x: .15, y: .5 };
  [5, 9, 13, 17].forEach((base, i) => {
    const x = .35 + i * .1;
    const straight = gesture === 'palm' || i === 0 && (gesture === 'draw' || gesture === 'pinch');
    p[base] = { x, y: .65 }; p[base + 1] = { x, y: .51 };
    p[base + 2] = { x: straight ? x : x + .03, y: straight ? .4 : .62 };
    p[base + 3] = { x, y: straight ? .29 : .74 };
  });
  if (gesture === 'pinch') p[4] = { x: p[8].x + .025, y: p[8].y };
  return p;
}
test('distingue índice, pellizco, palma y puño con diferentes tamaños y orientaciones', () => {
  for (const gesture of ['draw', 'pinch', 'palm', 'fist'] as const) {
    const original = landmarks(gesture);
    assert.equal(recognizeGesture(original).gesture, gesture);
    const transformed = original.map(p => ({ x: .5 + (p.y - .5) * .5, y: .5 - (p.x - .5) * .5 * (4 / 3) ** 2 }));
    assert.equal(recognizeGesture(transformed).gesture, gesture);
  }
});
test('histéresis de pellizco y rechazo de datos incompletos', () => {
  const p = landmarks('pinch');
  const palm = Math.hypot((p[0].x - p[9].x) * 4 / 3, p[0].y - p[9].y);
  p[4] = { x: p[8].x + .35 * palm / (4 / 3), y: p[8].y };
  assert.equal(recognizeGesture(p, true).gesture, 'pinch');
  assert.notEqual(recognizeGesture(p, false).gesture, 'pinch');
  assert.equal(recognizeGesture([]).gesture, 'none');
});
test('confianza, confirmación temporal, espejo, suavizado y pérdida de manos', () => {
  const tracker = new HandTracker();
  const hand: RawHand = { landmarks: landmarks('draw'), confidence: .99, side: 'Left' };
  assert.equal(tracker.update([{ ...hand, confidence: .5 }], 0).hands.length, 0);
  assert.equal(tracker.update([hand], 10).hands[0].gesture, 'none');
  const stable = tracker.update([hand], 200).hands[0];
  assert.equal(stable.gesture, 'draw'); assert.equal(stable.point.x, 1 - hand.landmarks[8].x);
  const moved = { ...hand, landmarks: hand.landmarks.map(p => ({ x: p.x + .1, y: p.y })) };
  const smooth = tracker.update([moved], 250).hands[0];
  assert.ok(smooth.point.x < stable.point.x && smooth.point.x > stable.point.x - .1);
  assert.deepEqual(tracker.update([], 300).hands, []);
  assert.equal(tracker.update([hand], 350).hands[0].gesture, 'none');
});
test('mantiene identidad si el detector cambia el orden de las dos manos', () => {
  const tracker = new HandTracker();
  const left: RawHand = { landmarks: landmarks('pinch'), confidence: .99, side: 'Left' };
  const right: RawHand = { ...left, side: 'Right', landmarks: left.landmarks.map(p => ({ x: p.x + .35, y: p.y })) };
  const before = tracker.update([left, right], 0).hands;
  const after = tracker.update([right, left], 100).hands;
  assert.equal(before[0].id, after[1].id); assert.equal(before[1].id, after[0].id);
});
const boxes = [{ id: 0, x: 100, y: 100, width: 100, height: 100 }, { id: 1, x: 500, y: 500, width: 100, height: 100 }];
const bounds = { x: 0, y: 0, width: 1000, height: 1000 };
const toSvg = (p: { x: number; y: number }) => ({ x: p.x * 1000, y: p.y * 1000 });
const hand = (gesture: Gesture, x = .15, y = .15, id = 1, pinch = .2): TrackedHand => ({ id, gesture, point: { x, y }, pinch });
test('selección, arrastre continuo, soltar y no seleccionar desde lejos', () => {
  const engine = new GestureInteraction();
  const update = (...hands: TrackedHand[]) => engine.update({ hands, timestamp: 0 }, toSvg, boxes, bounds);
  assert.equal(update(hand('pinch')).selected, 0);
  const moved = update(hand('pinch', .3, .3));
  assert.equal(moved.transforms[0].x, 150); assert.equal(moved.selected, 0);
  assert.equal(update(hand('none')).selected, null);
  assert.equal(update(hand('pinch', .95, .95)).selected, null);
  assert.equal(nearestTile({ x: 300, y: 300 }, boxes, moved.transforms, 50), 0);
});
test('zoom con segunda mano, límites y palma secundaria no pausa la selección', () => {
  const engine = new GestureInteraction();
  const update = (...hands: TrackedHand[]) => engine.update({ hands, timestamp: 0 }, toSvg, boxes, bounds);
  update(hand('pinch'), hand('none', .7, .7, 2, .3));
  let result = update(hand('pinch'), hand('palm', .7, .7, 2, 1.5));
  assert.equal(result.transforms[0].scale, 2.2); assert.equal(result.paused, false);
  result = update(hand('pinch'), hand('none', .7, .7, 2, .01));
  assert.equal(result.transforms[0].scale, .65);
  assert.equal(update().selected, null);
});
test('palma borra solo una vez, pausa; puño reanuda el dibujo', () => {
  const engine = new GestureInteraction();
  const update = (...hands: TrackedHand[]) => engine.update({ hands, timestamp: 0 }, toSvg, boxes, bounds);
  assert.equal(update(hand('draw')).drawing, true);
  assert.equal(update(hand('palm')).clear, true);
  assert.equal(update(hand('palm')).clear, false);
  assert.equal(update(hand('draw')).drawing, false);
  assert.equal(update(hand('fist')).paused, false);
  assert.equal(update(hand('draw')).drawing, true);
});
