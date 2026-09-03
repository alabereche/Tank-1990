import { createTacticalMaze, BLOCK_SIZE } from '../src/engine/maps.ts';
import { TileType } from '../src/types.ts';

for (const size of [34, 42]) {
  console.log(`Testing Tactical Maze on size ${size}x${size}...`);
  const grid = createTacticalMaze(size);

  if (grid.length !== size || grid[0].length !== size) {
    throw new Error(`Invalid grid dimensions: ${grid.length}x${grid[0].length}`);
  }

  const mid = Math.floor(size / 2);
  const baseC = mid - 1;

  // 8 spawns from GameLoop.ts:
  const spawns = [
    { name: 'Spawn 1 (BL)', r: size - 4, c: 2 },
    { name: 'Spawn 2 (TR)', r: 2, c: size - 4 },
    { name: 'Spawn 3 (BR)', r: size - 4, c: size - 4 },
    { name: 'Spawn 4 (TL)', r: 2, c: 2 },
    { name: 'Spawn 5 (TC)', r: 2, c: baseC },
    { name: 'Spawn 6 (BC)', r: size - 4, c: baseC },
    { name: 'Spawn 7 (LC)', r: mid, c: 2 },
    { name: 'Spawn 8 (RC)', r: mid, c: size - 4 },
  ];

  for (const sp of spawns) {
    // Check 2x2 tank footprint
    for (let dr = 0; dr < 2; dr++) {
      for (let dc = 0; dc < 2; dc++) {
        const cell = grid[sp.r + dr][sp.c + dc];
        if (cell !== TileType.EMPTY) {
          throw new Error(`${sp.name} at (${sp.r + dr}, ${sp.c + dc}) has non-empty tile: ${cell}`);
        }
      }
    }
  }

  // Check BFS connectivity between all 8 spawns through empty/trees corridors (without shooting bricks)
  const isPassable = (r, c) => {
    if (r < 0 || r + 1 >= size || c < 0 || c + 1 >= size) return false;
    for (let dr = 0; dr < 2; dr++) {
      for (let dc = 0; dc < 2; dc++) {
        const t = grid[r + dr][c + dc];
        if (t === TileType.STEEL || t === TileType.WATER) return false;
      }
    }
    return true;
  };

  // BFS from Spawn 4
  const visited = new Set();
  const queue = [{ r: spawns[3].r, c: spawns[3].c }];
  visited.add(`${spawns[3].r},${spawns[3].c}`);

  while (queue.length > 0) {
    const { r, c } = queue.shift();
    const dirs = [
      { dr: -1, dc: 0 },
      { dr: 1, dc: 0 },
      { dr: 0, dc: -1 },
      { dr: 0, dc: 1 },
    ];
    for (const d of dirs) {
      const nr = r + d.dr;
      const nc = c + d.dc;
      const key = `${nr},${nc}`;
      if (!visited.has(key) && isPassable(nr, nc)) {
        visited.add(key);
        queue.push({ r: nr, c: nc });
      }
    }
  }

  // Verify all other 7 spawns are reachable
  for (const sp of spawns) {
    if (!visited.has(`${sp.r},${sp.c}`)) {
      throw new Error(`${sp.name} is not reachable from Spawn 4!`);
    }
  }

  console.log(`PASS: All 8 spawns are clean and connected on size ${size}x${size}!`);
}

console.log('ALL MAZE TESTS PASSED!');
