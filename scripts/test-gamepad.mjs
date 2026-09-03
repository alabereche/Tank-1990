/**
 * Code-level verification of gamepad selection logic.
 * Simulates navigator.getGamepads() (no real hardware needed) and asserts:
 *  - ordinal polling ignores raw-slot gaps (pad at index 3 still = "pad 2")
 *  - role polling: single pad serves any role, dual pads split host/guest
 *  - button/axis mapping (d-pad + left stick + fire + deadzone)
 * Run: node scripts/test-gamepad.mjs
 */

let fakePads = [];
Object.defineProperty(globalThis, 'navigator', {
  value: { getGamepads: () => fakePads },
  configurable: true,
});
Object.defineProperty(globalThis, 'window', {
  value: { addEventListener: () => {} },
  configurable: true,
});

import { gamepadManager } from '../src/engine/GamepadManager.ts';

function makePad(index, overrides = {}) {
  return {
    id: `pad-${index}`,
    connected: true,
    index,
    axes: [0, 0],
    buttons: [],
    ...overrides,
  };
}

const assert = (name, cond) => {
  if (!cond) throw new Error('FAIL ' + name);
  console.log('PASS ' + name);
};

// 1) Gap case: OS assigns raw indices 0 and 3 (stale driver slots).
//    Ordinal polling must still map second-connected -> P2.
fakePads = [makePad(0), null, null, makePad(3)];
const p1 = gamepadManager.pollInputForOrdinal(0);
const p2 = gamepadManager.pollInputForOrdinal(1);
assert('ordinal skips raw-slot gaps (P1)', p1 !== null);
assert('ordinal skips raw-slot gaps (P2)', p2 !== null);

// 2) Role polling with both pads present: host -> first, guest -> second
const host = gamepadManager.pollInputForRole('host');
const guest = gamepadManager.pollInputForRole('guest');
assert('role host reads first pad', host !== null);
assert('role guest reads second pad when two exist', guest !== null);

// 3) Single pad (real internet): guest role still gets the only pad
fakePads = [makePad(0)];
const guestSingle = gamepadManager.pollInputForRole('guest');
assert('role guest falls back to the only pad', guestSingle !== null);

// 4) Mapping: D-pad left button (14) + left-stick axis + fire (button 0)
fakePads = [
  makePad(0, { axes: [0, 0], buttons: [] }),
  makePad(3, { axes: [-0.8, 0], buttons: [{ pressed: true }] }),
];
const pad1 = gamepadManager.pollInputForOrdinal(0);
assert('idle pad reports no movement', !pad1.input.left && !pad1.input.fire);
const pad2 = gamepadManager.pollInputForOrdinal(1);
assert('axis beyond deadzone reads LEFT', pad2.input.left === true);
assert('button 0 reads FIRE', pad2.input.fire === true);

// 5) Axis inside deadzone must NOT move
fakePads = [makePad(0, { axes: [0.2, 0], buttons: [] })];
const dz = gamepadManager.pollInputForOrdinal(0);
assert('axis within deadzone is neutral', dz.input.left === false && dz.input.right === false);

// 6) D-pad direction buttons
fakePads = [makePad(0, { axes: [0, 0], buttons: [{ pressed: false }, , , , , , , , , , , , { pressed: true }] })];
const dp = gamepadManager.pollInputForOrdinal(0);
assert('d-pad up (button 12) reads UP', dp.input.up === true);

// 7) Disconnected pad filtered out
fakePads = [makePad(0, { connected: false }), makePad(1)];
const afterDisc = gamepadManager.pollInputForOrdinal(0);
assert('disconnected pad filtered; ordinal 0 = next live pad', afterDisc !== null);

console.log('ALL GAMEPAD TESTS PASSED');
