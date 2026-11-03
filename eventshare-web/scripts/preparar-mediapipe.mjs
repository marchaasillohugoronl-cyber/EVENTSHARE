// Runtime assets come from the exact npm version. No CDN or camera uploads at runtime.
import { cpSync, mkdirSync, readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
const root = new URL('../', import.meta.url);
const source = new URL('node_modules/@mediapipe/tasks-vision/', root);
const target = new URL('public/magic-touch/vendor/', root);
const model = readFileSync(new URL('public/magic-touch/hand_landmarker.task', root));
if (createHash('sha256').update(model).digest('hex') !== 'fbc2a30080c3c557093b5ddfc334698132eb341044ccee322ccf8bcf3607cde1') throw new Error('El modelo de manos no coincide con la versión verificada.');
mkdirSync(target, { recursive: true });
cpSync(new URL('vision_bundle.js', source), new URL('vision_bundle.js', target));
cpSync(new URL('wasm/', source), new URL('wasm/', target), { recursive: true });
console.log('MediaPipe preparado: modelo y WASM locales.');
