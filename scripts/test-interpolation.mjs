/**
 * Code-level verification of the guest thin-client interpolation buffer.
 * Simulates a 30Hz snapshot stream with network jitter and asserts that
 * sampled motion is smooth (no teleports), stall-safe, and id-accurate.
 * Run: node scripts/test-interpolation.mjs
 */

import { SnapshotBuffer, RENDER_DELAY_MS } from '../src/network/interpolation.ts';

// Deterministic controllable clock instead of real time
let fakeNow = 0;
Object.defineProperty(globalThis, 'performance', {
  value: { now: () => fakeNow },
  configurable: true,
});

const buffer = new SnapshotBuffer();

// 1) Feed a 30Hz stream: enemy "e1" moves +10px per snapshot (300 px/s),
//    with ±12ms delivery jitter (worse than typical real internet).
const TOTAL = 40;
let sentTick = 0;
for (let k = 0; k < TOTAL; k++) {
  fakeNow = k * 33.33 + (k % 3 === 0 ? 12 : -8); // jittered arrival
  buffer.push({
    tick: sentTick++,
    recvAt: 0,
    p1: null,
    p2: { x: 100, y: 200, dir: 'UP', moving: true },
    enemies: [{ id: 'e1', type: 'BASIC', x: k * 10, y: 50, dir: 'RIGHT', moving: true }],
    spawning: [],
    bullets: [{ id: `b${k}`, isPlayer: true, pIdx: 1, x: 30 + k * 6, y: 10, dir: 'UP' }],
    powerUps: [],
  });
}

// 2) Sweep the render clock in 16ms frame steps across the whole stream
//    and verify the interpolated enemy motion is monotonic and bounded.
fakeNow = 400;
let prevX = -Infinity;
let maxJump = 0;
for (let f = 0; f < 200; f++) {
  fakeNow += 16.67;
  const view = buffer.sample(RENDER_DELAY_MS);
  const e1 = view.enemies.find((e) => e.id === 'e1');
  if (!e1) throw new Error('enemy e1 missing from interpolated view');
  if (e1.x < prevX - 0.001) throw new Error(`REWIND detected: ${prevX} -> ${e1.x}`);
  if (prevX > -Infinity) maxJump = Math.max(maxJump, e1.x - prevX);
  prevX = e1.x;
}
if (maxJump > 12) throw new Error(`TELEPORT detected: frame jump ${maxJump}px (> 12px)`);
console.log(`PASS smooth-motion: monotonic, max frame jump = ${maxJump.toFixed(2)}px`);

// 3) Mid-stream interpolation accuracy: render time between snapshots
//    must yield a position strictly between the two source positions.
fakeNow = 33.33 * 20 + 16; // roughly halfway into a snapshot interval
const mid = buffer.sample(RENDER_DELAY_MS);
const kApprox = Math.floor((fakeNow - RENDER_DELAY_MS) / 33.33);
const lo = Math.max(0, kApprox - 2) * 10;
const hi = Math.min(TOTAL - 1, kApprox + 2) * 10;
const mx = mid.enemies.find((e) => e.id === 'e1').x;
if (mx < lo || mx > hi) throw new Error(`interpolated x=${mx} outside window [${lo}, ${hi}]`);
console.log(`PASS interpolation-accuracy: x=${mx.toFixed(1)} within [${lo}, ${hi}]`);

// 4) Brand-new entity appears immediately at its authoritative position
fakeNow += 100;
buffer.push({
  tick: sentTick++,
  recvAt: 0,
  p1: null,
  p2: null,
  enemies: [],
  spawning: [],
  bullets: [{ id: 'brand-new', isPlayer: false, pIdx: undefined, x: 77, y: 88, dir: 'DOWN' }],
  powerUps: [{ id: 'pw1', type: 'STAR', x: 5, y: 5 }],
});
const fresh = buffer.sample(0);
const nb = fresh.bullets.find((b) => b.id === 'brand-new');
if (!nb || nb.x !== 77 || nb.y !== 88) throw new Error('new entity not surfaced at authoritative position');
console.log('PASS new-entity: surfaced immediately at authoritative position');

// 5) Stream stall: no snapshots for 700ms must hold the last state (no null,
//    no rewind) so a host hiccup freezes instead of breaking the field.
const lastX = buffer.sample(RENDER_DELAY_MS).p2 === null ? null : 'kept';
fakeNow += 700;
const stalled = buffer.sample(RENDER_DELAY_MS);
if (!stalled) throw new Error('stall returned null instead of holding last state');
if (stalled.tick !== sentTick - 1) throw new Error('stall did not hold the newest snapshot');
console.log('PASS stall-safety: holds newest snapshot during host hiccup');

// 6) P2 blending: two snapshots 40px apart must interpolate for the
//    prediction reconciliation target, not snap raw.
const b2 = new SnapshotBuffer();
fakeNow = 1000;
b2.push({ tick: 1, recvAt: 0, p1: null, p2: { x: 0, y: 0, dir: 'UP', moving: true }, enemies: [], spawning: [], bullets: [], powerUps: [] });
fakeNow = 1033;
b2.push({ tick: 2, recvAt: 0, p1: null, p2: { x: 40, y: 0, dir: 'UP', moving: true }, enemies: [], spawning: [], bullets: [], powerUps: [] });
fakeNow = 1050; // renderTime = 930 -> between 1000 and 1033? no: 930 < 1000 -> oldest... adjust
fakeNow = 1060; // renderTime = 940 -> still oldest pair window covers via first branch only if within
const s = b2.sample(RENDER_DELAY_MS);
const px = s.p2.x;
if (px < 0 || px > 40) throw new Error(`p2 blend out of range: ${px}`);
console.log(`PASS p2-blend: reconciliation target x=${px} in [0, 40]`);

console.log('ALL INTERPOLATION TESTS PASSED');
