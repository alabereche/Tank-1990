/**
 * Regression test for the 1v1 versus spawn trap.
 * The old bottom spawn (x=192) was the eagle bunker pocket - enclosed on
 * three sides, so the gold tank could never leave. Asserts the new spawn
 * pockets have a tank-wide exit on ALL combat preset maps.
 * Run (bundle first - extensionless TS imports): see test-gamepad.mjs note
 *   npx esbuild scripts/test-versus-spawn.mjs --bundle --platform=node --format=cjs --outfile=scripts/.vs.cjs && node scripts/.vs.cjs
 */

import { PRESET_MAPS, BLOCK_SIZE } from '../src/engine/maps.ts';

const TILE = { EMPTY: 0, BRICK: 1, STEEL: 2, WATER: 3, TREES: 4, ICE: 5, BASE: 6 };

// Independent implementation of the engine's pocket-exit rule
function isViableSpawn(grid, x, y) {
  const size = grid.length;
  const c0 = Math.floor(x / BLOCK_SIZE);
  const r0 = Math.floor(y / BLOCK_SIZE);
  if (c0 < 0 || r0 < 0 || c0 + 1 >= size || r0 + 1 >= size) return false;
  for (let r = r0; r <= r0 + 1; r++) {
    for (let c = c0; c <= c0 + 1; c++) {
      const t = grid[r]?.[c] ?? TILE.EMPTY;
      if (t === TILE.BASE || t === TILE.STEEL || t === TILE.WATER) return false;
    }
  }
  const open = (r, c) => {
    if (r >= r0 && r <= r0 + 1 && c >= c0 && c <= c0 + 1) return true;
    const t = grid[r]?.[c] ?? TILE.BRICK;
    return t === TILE.EMPTY || t === TILE.TREES || t === TILE.ICE;
  };
  return (
    (open(r0 - 1, c0) && open(r0 - 1, c0 + 1)) ||
    (open(r0 + 2, c0) && open(r0 + 2, c0 + 1)) ||
    (open(r0, c0 - 1) && open(r0 + 1, c0 - 1)) ||
    (open(r0, c0 + 2) && open(r0 + 1, c0 + 2))
  );
}

const MAPS = ['stage1', 'ironFortress', 'riverCrossing'];
const OLD_TRAP = { x: 192, y: 384 }; // eagle bunker pocket (the reported bug)
const NEW_BOTTOM = { x: 128, y: 384 }; // (baseC-4)*16, proven coop pocket
const NEW_TOP = { x: 192, y: 0 }; // top-center corridor

// 1) Document the old trap on the classic map
if (isViableSpawn(PRESET_MAPS.stage1.grid, OLD_TRAP.x, OLD_TRAP.y)) {
  throw new Error('expected OLD versus spawn (192,384) to be TRAPPED on stage1');
}
console.log('PASS old spawn (192,384) confirmed trapped on stage1 (bug reproduced)');

// 2) New spawns must be viable on every combat map
for (const name of MAPS) {
  const grid = PRESET_MAPS[name].grid;
  if (!isViableSpawn(grid, NEW_BOTTOM.x, NEW_BOTTOM.y)) {
    throw new Error(`NEW bottom spawn trapped on ${name}`);
  }
  if (!isViableSpawn(grid, NEW_TOP.x, NEW_TOP.y)) {
    throw new Error(`NEW top spawn trapped on ${name}`);
  }
  console.log(`PASS ${name}: bottom (128,384) and top (192,0) both have tank-wide exits`);
}

console.log('ALL VERSUS-SPAWN TESTS PASSED');
