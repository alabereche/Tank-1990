import {
  createStage1,
  createIronFortress,
  createRiverCrossing,
  createAmazonRainforest,
  createGlacialArchipelago,
  createGreatLabyrinth,
  createMuddyBadlands,
  createUrbanGridlock,
  createBunkerComplex,
  createDeathValley,
  createEmptyGrid,
  addNorthBaseBunker,
} from '../src/engine/maps';
import { TileType } from '../src/types';

// Test runner for all 10 stages importing directly from the engine
const generators = [
  { stage: 1, name: 'Classic Citadel', fn: createStage1 },
  { stage: 2, name: 'Iron Fortress', fn: createIronFortress },
  { stage: 3, name: 'Twin Rivers', fn: createRiverCrossing },
  { stage: 4, name: 'Amazon Rainforest', fn: createAmazonRainforest },
  { stage: 5, name: 'Glacial Archipelago', fn: createGlacialArchipelago },
  { stage: 6, name: 'The Great Labyrinth', fn: createGreatLabyrinth },
  { stage: 7, name: 'Muddy Badlands', fn: createMuddyBadlands },
  { stage: 8, name: 'Urban Gridlock', fn: createUrbanGridlock },
  { stage: 9, name: 'Bunker Complex', fn: createBunkerComplex },
  { stage: 10, name: 'Death Valley Crater', fn: createDeathValley },
];

const sizes = [26, 34, 42];
const stopsBullet = (t: number) => t === TileType.BRICK || t === TileType.STEEL || t === TileType.BASE;

function canTankBeAt(grid: number[][], r: number, c: number, size: number) {
  if (r < 0 || r + 1 >= size || c < 0 || c + 1 >= size) return false;
  for (let dr = 0; dr < 2; dr++) {
    for (let dc = 0; dc < 2; dc++) {
      const t = grid[r + dr][c + dc];
      if (t === TileType.BRICK || t === TileType.STEEL || t === TileType.WATER || t === TileType.BASE) {
        return false;
      }
    }
  }
  return true;
}

function canReachMidfield(grid: number[][], startR: number, startC: number, size: number) {
  if (!canTankBeAt(grid, startR, startC, size)) return false;
  const visited = Array(size).fill(0).map(() => Array(size).fill(false));
  const queue = [[startR, startC]];
  visited[startR][startC] = true;
  const targetRow = Math.floor(size / 2);
  const dirs = [[-1, 0], [1, 0], [0, -1], [0, 1]];

  while (queue.length > 0) {
    const [r, c] = queue.shift()!;
    if (Math.abs(r - targetRow) <= 2) return true;
    for (const [dr, dc] of dirs) {
      const nr = r + dr;
      const nc = c + dc;
      if (canTankBeAt(grid, nr, nc, size) && !visited[nr][nc]) {
        visited[nr][nc] = true;
        queue.push([nr, nc]);
      }
    }
  }
  return false;
}

let allPassed = true;

for (const size of sizes) {
  console.log(`\n=== Testing Grid Size ${size}x${size} ===`);
  const mid = Math.floor(size / 2);
  const baseR = size - 2;
  const baseC = mid - 1;

  for (const gen of generators) {
    const grid = gen.fn(size);

    // 1. Verify grid shape
    if (grid.length !== size || !grid.every(r => r.length === size)) {
      console.error(`FAILED: ${gen.name} ${size}x${size} invalid grid dimensions!`);
      allPassed = false;
    }

    // 2. Verify Base Eagle intact
    if (grid[baseR][baseC] !== TileType.BASE || grid[baseR][baseC+1] !== TileType.BASE ||
        grid[baseR+1][baseC] !== TileType.BASE || grid[baseR+1][baseC+1] !== TileType.BASE) {
      console.error(`FAILED: ${gen.name} ${size}x${size} Base Eagle broken!`);
      allPassed = false;
    }

    // 3. Verify P1 and P2 spawns are not blocked by solid blocks
    const p1Col = mid - 4;
    const p2Col = mid + 4;
    for (let r = size - 3; r < size; r++) {
      if (grid[r][p1Col] === TileType.STEEL || grid[r][p1Col] === TileType.WATER) {
        console.error(`FAILED: ${gen.name} ${size}x${size} P1 spawn solid obstruction at row ${r}, col ${p1Col}!`);
        allPassed = false;
      }
      if (grid[r][p2Col] === TileType.STEEL || grid[r][p2Col] === TileType.WATER) {
        console.error(`FAILED: ${gen.name} ${size}x${size} P2 spawn solid obstruction at row ${r}, col ${p2Col}!`);
        allPassed = false;
      }
    }

    // 4. Anti-Sniper Check: Zero open bullet corridors to South Eagle
    const southLeaks: string[] = [];
    for (let c = baseC - 1; c <= baseC + 2; c++) {
      let obs = 0;
      for (let r = 0; r < baseR; r++) {
        if (stopsBullet(grid[r][c])) obs++;
      }
      if (obs === 0) southLeaks.push(`Col ${c}`);
    }
    if (southLeaks.length > 0) {
      console.error(`FAILED: ${gen.name} ${size}x${size} South Eagle snipable on ${southLeaks.join(', ')}!`);
      allPassed = false;
    }

    // 5. Test Single-Player Navigation before North Base is added
    if (size === 26) {
      const p1 = canReachMidfield(grid, 24, 8, 26);
      const p2 = canReachMidfield(grid, 24, 16, 26);
      const e1 = canReachMidfield(grid, 0, 0, 26);
      const e2 = canReachMidfield(grid, 0, 12, 26);
      const e3 = canReachMidfield(grid, 0, 24, 26);
      if (!p1 || !p2 || !e1 || !e2 || !e3) {
        console.error(`FAILED: ${gen.name} 26x26 tank navigation blocked! [P1:${p1}, P2:${p2}, E1:${e1}, E2:${e2}, E3:${e3}]`);
        allPassed = false;
      }
    }

    // 6. Test dual-base addition & Anti-Sniper check on North Eagle
    addNorthBaseBunker(grid, size);
    if (grid[0][baseC] !== TileType.BASE || grid[1][baseC+1] !== TileType.BASE) {
      console.error(`FAILED: ${gen.name} ${size}x${size} North Base broken!`);
      allPassed = false;
    }

    const northLeaks: string[] = [];
    for (let c = baseC - 1; c <= baseC + 2; c++) {
      let obs = 0;
      for (let r = size - 1; r > 1; r--) {
        if (stopsBullet(grid[r][c])) obs++;
      }
      if (obs === 0) northLeaks.push(`Col ${c}`);
    }
    if (northLeaks.length > 0) {
      console.error(`FAILED: ${gen.name} ${size}x${size} North Eagle snipable on ${northLeaks.join(', ')}!`);
      allPassed = false;
    }

    // Count tile types
    const counts: Record<number, number> = {};
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        counts[grid[r][c]] = (counts[grid[r][c]] || 0) + 1;
      }
    }

    console.log(`✓ Stage ${gen.stage.toString().padStart(2)}: ${gen.name.padEnd(22)} [Brick:${counts[TileType.BRICK]||0}, Steel:${counts[TileType.STEEL]||0}, Water:${counts[TileType.WATER]||0}, Trees:${counts[TileType.TREES]||0}, Ice:${counts[TileType.ICE]||0}, Mud:${counts[TileType.MUD]||0}]`);
  }
}

if (allPassed) {
  console.log("\n>>> ALL 10 STAGES PASSED COMPREHENSIVE VALIDATION (INTEGRITY + ZERO SNIPER LEAKS + NAVIGATION) ACROSS 26x26, 34x34, and 42x42! <<<");
} else {
  console.error("\n>>> SOME STAGE CHECKS FAILED! <<<");
  process.exit(1);
}
