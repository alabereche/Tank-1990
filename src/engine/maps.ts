/**
 * Battle City 1990 - Handcrafted Professional Stages & Generator
 * Supports Classic (26x26), Large (34x34), and Giant (42x42) battlefield arenas.
 * Features 10 completely distinct handcrafted stages, each with unique tactical layouts,
 * biome profiles, obstacle combinations, and combat signatures.
 */

import { StageMap, TileType, MapSizePreset, PayloadCheckpoint } from '../types';

export const BLOCK_SIZE = 16; // 16px per sub-tile
export const DEFAULT_GRID_SIZE = 26;
export const DEFAULT_CANVAS_SIZE = 416;

// For backwards compatibility
export const GRID_SIZE = 26;
export const CANVAS_SIZE = 416;

export interface MapSizeConfig {
  size: number;
  canvasSize: number;
  name: string;
  label: string;
  desc: string;
}

export const MAP_SIZE_CONFIGS: Record<MapSizePreset, MapSizeConfig> = {
  classic: {
    size: 26,
    canvasSize: 416,
    name: 'Classic (26x26)',
    label: 'Classic (26x26)',
    desc: 'Original Battle City 1990 combat grid (416x416 px)',
  },
  large: {
    size: 34,
    canvasSize: 544,
    name: 'Large (34x34)',
    label: 'Large (34x34)',
    desc: 'Expanded +70% battlefield with tactical corridors (544x544 px)',
  },
  giant: {
    size: 42,
    canvasSize: 672,
    name: 'Giant (42x42)',
    label: 'Giant (42x42)',
    desc: 'Epic super-sized war arena with extra maneuvering space (672x672 px)',
  },
};

export function getGridSizeForPreset(preset: MapSizePreset): number {
  return MAP_SIZE_CONFIGS[preset]?.size ?? 26;
}

export function getCanvasSizeForPreset(preset: MapSizePreset): number {
  return MAP_SIZE_CONFIGS[preset]?.canvasSize ?? 416;
}

/**
 * Creates an empty grid with the Base Eagle, standard protective brick bunker,
 * and an Advance Blast Deflector to eliminate spawn-to-eagle sniper vulnerabilities.
 */
export function createEmptyGrid(gridSize: number = 26): number[][] {
  const grid: number[][] = Array(gridSize)
    .fill(0)
    .map(() => Array(gridSize).fill(TileType.EMPTY));

  const baseRow = gridSize - 2;
  const baseCol = Math.floor(gridSize / 2) - 1;

  // Set Eagle Base (2x2 sub-tiles)
  grid[baseRow][baseCol] = TileType.BASE;
  grid[baseRow][baseCol + 1] = TileType.BASE;
  grid[baseRow + 1][baseCol] = TileType.BASE;
  grid[baseRow + 1][baseCol + 1] = TileType.BASE;

  // Standard brick bunker around Base Eagle
  for (let c = baseCol - 1; c <= baseCol + 2; c++) {
    if (c >= 0 && c < gridSize && baseRow - 1 >= 0) {
      grid[baseRow - 1][c] = TileType.BRICK;
    }
  }
  if (baseCol - 1 >= 0) {
    grid[baseRow][baseCol - 1] = TileType.BRICK;
    grid[baseRow + 1][baseCol - 1] = TileType.BRICK;
  }
  if (baseCol + 2 < gridSize) {
    grid[baseRow][baseCol + 2] = TileType.BRICK;
    grid[baseRow + 1][baseCol + 2] = TileType.BRICK;
  }

  // Tactical Advance Blast Deflector (حاجز الصد المتقدم ضد القنص المباشر)
  // Positioned at baseRow - 4 leaving a full 2-tile (32px) maneuvering corridor at rows baseRow - 3 and baseRow - 2
  const defR = baseRow - 4;
  if (defR >= 0) {
    grid[defR][baseCol] = TileType.STEEL;
    grid[defR][baseCol + 1] = TileType.STEEL;
    if (baseCol - 1 >= 0) grid[defR][baseCol - 1] = TileType.BRICK;
    if (baseCol + 2 < gridSize) grid[defR][baseCol + 2] = TileType.BRICK;
  }

  return grid;
}

/**
 * Adds the North Base Eagle, symmetrical protective brick bunker, and North Advance Blast Deflector
 * for dual-base modes (1v1, 2v2).
 */
export function addNorthBaseBunker(grid: number[][], gridSize: number): void {
  const baseCol = Math.floor(gridSize / 2) - 1;

  // Set North Eagle Base (2x2 sub-tiles at row 0, 1)
  grid[0][baseCol] = TileType.BASE;
  grid[0][baseCol + 1] = TileType.BASE;
  grid[1][baseCol] = TileType.BASE;
  grid[1][baseCol + 1] = TileType.BASE;

  // Symmetrical brick bunker in front of North Base (row 2)
  for (let c = baseCol - 1; c <= baseCol + 2; c++) {
    if (c >= 0 && c < gridSize && 2 < gridSize) {
      grid[2][c] = TileType.BRICK;
    }
  }
  // Symmetrical brick bunker sides (row 0, 1)
  if (baseCol - 1 >= 0) {
    grid[0][baseCol - 1] = TileType.BRICK;
    grid[1][baseCol - 1] = TileType.BRICK;
  }
  if (baseCol + 2 < gridSize) {
    grid[0][baseCol + 2] = TileType.BRICK;
    grid[1][baseCol + 2] = TileType.BRICK;
  }

  // Symmetrical North Advance Blast Deflector at row 4
  if (4 < gridSize) {
    grid[4][baseCol] = TileType.STEEL;
    grid[4][baseCol + 1] = TileType.STEEL;
    if (baseCol - 1 >= 0) grid[4][baseCol - 1] = TileType.BRICK;
    if (baseCol + 2 < gridSize) grid[4][baseCol + 2] = TileType.BRICK;
  }
}

/**
 * Shared building helper to maintain safe spawn and base zones across all 10 stages
 */
function createBuilder(gridSize: number) {
  const g = createEmptyGrid(gridSize);
  const mid = Math.floor(gridSize / 2);

  // Protected zones: Base bunkers + deflectors, P1 & P2 spawns, and enemy spawn pockets
  const isProtected = (r: number, c: number): boolean => {
    // South Base zone (Eagle + Bunker ring + Advance Deflector)
    if (r >= gridSize - 5 && c >= mid - 3 && c <= mid + 2) return true;
    // North Base zone (Dual Base mode reserve + Advance Deflector)
    if (r <= 4 && c >= mid - 3 && c <= mid + 2) return true;
    // Player 1 spawn pocket
    if (r >= gridSize - 3 && c >= mid - 5 && c <= mid - 3) return true;
    // Player 2 spawn pocket
    if (r >= gridSize - 3 && c >= mid + 3 && c <= mid + 5) return true;
    // Top-left enemy spawn
    if (r <= 2 && c <= 2) return true;
    // Top-right enemy spawn
    if (r <= 2 && c >= gridSize - 3) return true;
    return false;
  };

  const placeCell = (r: number, c: number, type: TileType) => {
    if (r >= 0 && r < gridSize && c >= 0 && c < gridSize && !isProtected(r, c)) {
      g[r][c] = type;
    }
  };

  const placeBlock = (r: number, c: number, type: TileType) => {
    for (let dr = 0; dr < 2; dr++) {
      for (let dc = 0; dc < 2; dc++) {
        placeCell(r + dr, c + dc, type);
      }
    }
  };

  const placeVLine = (startR: number, endR: number, c: number, type: TileType) => {
    for (let r = startR; r <= endR; r++) {
      placeCell(r, c, type);
      placeCell(r, c + 1, type);
    }
  };

  const placeHLine = (r: number, startC: number, endC: number, type: TileType) => {
    for (let c = startC; c <= endC; c++) {
      placeCell(r, c, type);
      placeCell(r + 1, c, type);
    }
  };

  const placeRect = (startR: number, endR: number, startC: number, endC: number, type: TileType) => {
    for (let r = startR; r <= endR; r++) {
      for (let c = startC; c <= endC; c++) {
        placeCell(r, c, type);
      }
    }
  };

  return { g, mid, placeCell, placeBlock, placeVLine, placeHLine, placeRect, isProtected };
}

// ---------------------------------------------------------------------------
// STAGE 1: Classic Imperial Citadel (القلعة الإمبراطورية الكلاسيكية)
// NES Tribute + Outermost Ice Avenues + Ambush Foliage + Midfield Gatehouse
// ---------------------------------------------------------------------------
export function createStage1(gridSize: number = 26): number[][] {
  const b = createBuilder(gridSize);
  const { mid, placeBlock, placeVLine, placeHLine } = b;
  const offset = Math.floor((gridSize - 26) / 2);

  // Vertical Brick Pillars
  placeVLine(2 + offset, 9 + offset, 2 + offset, TileType.BRICK);
  placeVLine(2 + offset, 9 + offset, 6 + offset, TileType.BRICK);
  placeVLine(2 + offset, 6 + offset, 10 + offset, TileType.BRICK);
  placeVLine(2 + offset, 6 + offset, 14 + offset, TileType.BRICK);
  placeVLine(2 + offset, 9 + offset, 18 + offset, TileType.BRICK);
  placeVLine(2 + offset, 9 + offset, 22 + offset, TileType.BRICK);

  // Upper Steel Redoubt
  placeBlock(7 + offset, 12 + offset, TileType.STEEL);

  // Horizontal Middle Brick Gateways & Central Fortress Gatehouse
  placeHLine(11 + offset, offset, 3 + offset, TileType.BRICK);
  placeHLine(11 + offset, 6 + offset, 9 + offset, TileType.BRICK);
  placeBlock(11 + offset, 12 + offset, TileType.BRICK); // Midfield gatehouse barrier
  placeHLine(11 + offset, 16 + offset, 19 + offset, TileType.BRICK);
  placeHLine(11 + offset, 22 + offset, 25 + offset, TileType.BRICK);

  placeVLine(13 + offset, 14 + offset, offset, TileType.STEEL);
  placeVLine(13 + offset, 14 + offset, 24 + offset, TileType.STEEL);

  // Lower Defense Pillars
  placeVLine(15 + offset, 20 + offset, 2 + offset, TileType.BRICK);
  placeVLine(15 + offset, 20 + offset, 6 + offset, TileType.BRICK);
  placeVLine(15 + offset, 18 + offset, 10 + offset, TileType.BRICK);
  placeVLine(15 + offset, 18 + offset, 14 + offset, TileType.BRICK);
  placeVLine(15 + offset, 20 + offset, 18 + offset, TileType.BRICK);
  placeVLine(15 + offset, 20 + offset, 22 + offset, TileType.BRICK);

  // Lower Central Steel Bastion
  placeBlock(19 + offset, 12 + offset, TileType.STEEL);

  // High-speed Ice corridors on the far edges for rapid flanking
  placeVLine(4, gridSize - 6, 0, TileType.ICE);
  placeVLine(4, gridSize - 6, gridSize - 2, TileType.ICE);

  // Ambush Foliage flanking central columns
  placeVLine(7 + offset, 9 + offset, 4 + offset, TileType.TREES);
  placeVLine(7 + offset, 9 + offset, 20 + offset, TileType.TREES);

  // Midfield Mud Choke Points
  placeBlock(13 + offset, 8 + offset, TileType.MUD);
  placeBlock(13 + offset, 16 + offset, TileType.MUD);

  return b.g;
}

// ---------------------------------------------------------------------------
// STAGE 2: Iron Bastion Complex (مجمع الحصون الفولاذية)
// Heavy Industrial Bastion + Steel Cross + Water Hazard Moat + Ice Slipways
// ---------------------------------------------------------------------------
export function createIronFortress(gridSize: number = 26): number[][] {
  const b = createBuilder(gridSize);
  const { mid, placeBlock, placeVLine, placeHLine } = b;

  // Outer steel battlement teeth
  for (let c = 4; c < gridSize - 4; c += 4) {
    placeBlock(2, c, TileType.STEEL);
  }

  // Lateral ICE patrol slipway behind steel battlements
  placeHLine(4, 4, gridSize - 6, TileType.ICE);

  // Central Steel Cross & Interlocking Bastion
  for (let r = mid - 3; r <= mid + 2; r++) {
    b.placeCell(r, mid - 1, TileType.STEEL);
    b.placeCell(r, mid, TileType.STEEL);
  }
  for (let c = mid - 5; c <= mid + 4; c++) {
    b.placeCell(mid - 1, c, TileType.STEEL);
    b.placeCell(mid, c, TileType.STEEL);
  }

  // Ice sprint lanes flanking center cross
  placeHLine(mid - 4, mid - 6, mid + 5, TileType.ICE);
  placeHLine(mid + 3, mid - 6, mid + 5, TileType.ICE);

  // Flank water moats
  const moatEnd = Math.floor(gridSize / 3);
  for (let c = 2; c <= moatEnd; c++) {
    b.placeCell(8, c, TileType.WATER);
    b.placeCell(9, c, TileType.WATER);
    b.placeCell(8, gridSize - 1 - c, TileType.WATER);
    b.placeCell(9, gridSize - 1 - c, TileType.WATER);
    // Mud banks along water
    b.placeCell(10, c, TileType.MUD);
    b.placeCell(10, gridSize - 1 - c, TileType.MUD);
  }

  // Brick defensive ramparts with ample demolition corridors
  placeVLine(12, gridSize - 6, 4, TileType.BRICK);
  placeVLine(12, gridSize - 6, gridSize - 6, TileType.BRICK);

  // Concealment trees near south approach
  placeBlock(gridSize - 8, mid - 5, TileType.TREES);
  placeBlock(gridSize - 8, mid + 4, TileType.TREES);

  return b.g;
}

// ---------------------------------------------------------------------------
// STAGE 3: Twin Rivers Delta (دلتا النهرين التكتيكية)
// Double River Channels + Staggered Chicane Bridges + Fort Delta Island Bastion
// ---------------------------------------------------------------------------
export function createRiverCrossing(gridSize: number = 26): number[][] {
  const b = createBuilder(gridSize);
  const { mid, placeBlock } = b;

  const r1 = Math.floor(gridSize * 0.32);
  const r2 = Math.floor(gridSize * 0.62);
  const bridgeLeft = Math.floor(gridSize * 0.2);
  const bridgeRight = Math.floor(gridSize * 0.72);

  // River 1: Drivable Ice crossing at cols mid-2..mid-1 (cols 11..12) and flank bridges
  for (let c = 0; c < gridSize; c++) {
    if ((c >= bridgeLeft && c <= bridgeLeft + 1) || (c >= bridgeRight && c <= bridgeRight + 1)) {
      b.placeCell(r1, c, TileType.ICE);
      b.placeCell(r1 + 1, c, TileType.ICE);
    } else if (c >= mid - 2 && c <= mid - 1) {
      b.placeCell(r1, c, TileType.ICE);
      b.placeCell(r1 + 1, c, TileType.ICE);
    } else {
      b.placeCell(r1, c, TileType.WATER);
      b.placeCell(r1 + 1, c, TileType.WATER);
    }
  }

  // River 2: Drivable Ice crossing at cols mid..mid+1 (cols 13..14) and flank bridges
  for (let c = 0; c < gridSize; c++) {
    if ((c >= bridgeLeft && c <= bridgeLeft + 1) || (c >= bridgeRight && c <= bridgeRight + 1)) {
      b.placeCell(r2, c, TileType.ICE);
      b.placeCell(r2 + 1, c, TileType.ICE);
    } else if (c >= mid && c <= mid + 1) {
      b.placeCell(r2, c, TileType.ICE);
      b.placeCell(r2 + 1, c, TileType.ICE);
    } else {
      b.placeCell(r2, c, TileType.WATER);
      b.placeCell(r2 + 1, c, TileType.WATER);
    }
  }

  // Mud banks along the rivers
  for (const r of [r1, r2]) {
    for (let c = 2; c < gridSize - 2; c++) {
      if ((c < bridgeLeft - 1 || c > bridgeRight + 2) && (c < mid - 3 || c > mid + 2)) {
        b.placeCell(r - 1, c, TileType.MUD);
        b.placeCell(r + 2, c, TileType.MUD);
      }
    }
  }

  // Central Fort Delta Island Bastion between River 1 and River 2:
  // Solid Steel core in columns mid-1..mid (cols 12-13)
  placeBlock(mid - 1, mid - 1, TileType.STEEL);
  // Staggered baffle teeth that intercept cross-river sniper angles
  b.placeCell(r1 - 1, mid, TileType.BRICK);
  b.placeCell(r1 - 1, mid + 1, TileType.BRICK);
  b.placeCell(r2 + 2, mid - 2, TileType.BRICK);
  b.placeCell(r2 + 2, mid - 1, TileType.BRICK);

  // Willow trees along riverbanks
  for (let c = bridgeLeft + 3; c < mid - 2; c++) {
    b.placeCell(r1 - 1, c, TileType.TREES);
    b.placeCell(r2 - 1, c, TileType.TREES);
  }
  for (let c = mid + 2; c < bridgeRight - 2; c++) {
    b.placeCell(r1 - 1, c, TileType.TREES);
    b.placeCell(r2 - 1, c, TileType.TREES);
  }

  // Steel sentinel towers guarding bridges
  placeBlock(r1 - 3, bridgeLeft, TileType.STEEL);
  placeBlock(r1 - 3, bridgeRight, TileType.STEEL);
  placeBlock(r2 + 3, bridgeLeft, TileType.STEEL);
  placeBlock(r2 + 3, bridgeRight, TileType.STEEL);

  return b.g;
}

// ---------------------------------------------------------------------------
// STAGE 4: Amazonian Temple of Doom (معبد الغابة الاستوائية)
// Dense Jungle Warfare (>35% Trees) + Stepped Aztec Pyramid + Sacred Steel Altar
// ---------------------------------------------------------------------------
export function createAmazonRainforest(gridSize: number = 26): number[][] {
  const b = createBuilder(gridSize);
  const { mid, placeBlock, placeVLine, placeHLine, placeRect } = b;

  // 1. Vast dense tree canopies covering quadrants
  const qSize = Math.floor(gridSize * 0.35);
  placeRect(4, 4 + qSize, 2, 2 + qSize, TileType.TREES);
  placeRect(4, 4 + qSize, gridSize - 4 - qSize, gridSize - 4, TileType.TREES);
  placeRect(gridSize - 6 - qSize, gridSize - 6, 2, 2 + qSize, TileType.TREES);
  placeRect(gridSize - 6 - qSize, gridSize - 6, gridSize - 4 - qSize, gridSize - 4, TileType.TREES);

  // 2. Central Stepped Temple Ruins (Concentric Brick Walls + Steel Totems)
  placeHLine(mid - 4, mid - 4, mid + 3, TileType.BRICK);
  placeHLine(mid + 3, mid - 4, mid + 3, TileType.BRICK);
  placeVLine(mid - 4, mid + 3, mid - 4, TileType.BRICK);
  placeVLine(mid - 4, mid + 3, mid + 3, TileType.BRICK);

  // 4 Steel corner totems
  placeBlock(mid - 4, mid - 4, TileType.STEEL);
  placeBlock(mid - 4, mid + 3, TileType.STEEL);
  placeBlock(mid + 3, mid - 4, TileType.STEEL);
  placeBlock(mid + 3, mid + 3, TileType.STEEL);

  // Sacred Steel Altar with destructible brick pedestal
  placeBlock(mid - 1, mid - 1, TileType.STEEL);
  b.placeCell(mid - 1, mid - 2, TileType.BRICK);
  b.placeCell(mid, mid - 2, TileType.BRICK);
  b.placeCell(mid - 1, mid + 1, TileType.BRICK);
  b.placeCell(mid, mid + 1, TileType.BRICK);

  // 3. Serpentine mud trails through jungle
  placeVLine(6, gridSize - 8, mid - 6, TileType.MUD);
  placeVLine(6, gridSize - 8, mid + 5, TileType.MUD);

  // Clear corridors through jungle for tank movement
  placeHLine(mid, 0, 3, TileType.EMPTY);
  placeHLine(mid, gridSize - 4, gridSize - 1, TileType.EMPTY);

  return b.g;
}

// ---------------------------------------------------------------------------
// STAGE 5: Arctic Archipelago & Glacial Keep (قلعة الأرخبيل القطبي)
// Arctic Ice Sheets + Blue Water Lagoons + 4 Fortified Outposts + Central Glacial Keep
// ---------------------------------------------------------------------------
export function createGlacialArchipelago(gridSize: number = 26): number[][] {
  const b = createBuilder(gridSize);
  const { mid, placeBlock, placeRect } = b;

  // 1. Broad lateral and diagonal Ice fields (>35% coverage)
  placeRect(3, gridSize - 5, 0, 2, TileType.ICE);
  placeRect(3, gridSize - 5, gridSize - 3, gridSize - 1, TileType.ICE);
  placeRect(mid - 2, mid + 1, 0, gridSize - 1, TileType.ICE);

  // 2. Central Glacial Keep Bastion (Solid Steel Core and Reinforced Brick Ramparts)
  placeBlock(mid - 1, mid - 1, TileType.STEEL);
  b.placeCell(mid - 2, mid - 1, TileType.BRICK);
  b.placeCell(mid - 2, mid, TileType.BRICK);
  b.placeCell(mid + 1, mid - 1, TileType.BRICK);
  b.placeCell(mid + 1, mid, TileType.BRICK);
  b.placeCell(mid - 1, mid - 2, TileType.BRICK);
  b.placeCell(mid, mid - 2, TileType.BRICK);
  b.placeCell(mid - 1, mid + 1, TileType.BRICK);
  b.placeCell(mid, mid + 1, TileType.BRICK);

  // 3. Deep water lagoons separating sectors
  const wR1 = Math.floor(gridSize * 0.28);
  const wR2 = Math.floor(gridSize * 0.68);
  placeRect(wR1, wR1 + 1, 4, mid - 3, TileType.WATER);
  placeRect(wR1, wR1 + 1, mid + 2, gridSize - 5, TileType.WATER);
  placeRect(wR2, wR2 + 1, 4, mid - 3, TileType.WATER);
  placeRect(wR2, wR2 + 1, mid + 2, gridSize - 5, TileType.WATER);

  // Staggered ice and stone bridges over lagoons preventing straight-line sniping
  b.placeCell(wR1, mid - 2, TileType.ICE);
  b.placeCell(wR1 + 1, mid - 2, TileType.ICE);
  b.placeCell(wR1, mid - 1, TileType.ICE);
  b.placeCell(wR1 + 1, mid - 1, TileType.ICE);
  placeBlock(wR1, mid, TileType.STEEL);

  b.placeCell(wR2, mid, TileType.ICE);
  b.placeCell(wR2 + 1, mid, TileType.ICE);
  b.placeCell(wR2, mid + 1, TileType.ICE);
  b.placeCell(wR2 + 1, mid + 1, TileType.ICE);
  placeBlock(wR2, mid - 2, TileType.STEEL);

  // 4. Four Fortified Outpost Islands (NW, NE, SW, SE)
  placeBlock(5, 5, TileType.BRICK);
  placeBlock(5, 7, TileType.STEEL);
  placeBlock(7, 5, TileType.BRICK);

  placeBlock(5, gridSize - 9, TileType.STEEL);
  placeBlock(5, gridSize - 7, TileType.BRICK);
  placeBlock(7, gridSize - 7, TileType.BRICK);

  placeBlock(gridSize - 9, 5, TileType.BRICK);
  placeBlock(gridSize - 9, 7, TileType.STEEL);
  placeBlock(gridSize - 7, 5, TileType.BRICK);

  placeBlock(gridSize - 9, gridSize - 9, TileType.STEEL);
  placeBlock(gridSize - 9, gridSize - 7, TileType.BRICK);
  placeBlock(gridSize - 7, gridSize - 7, TileType.BRICK);

  return b.g;
}

// ---------------------------------------------------------------------------
// STAGE 6: The Minotaur's Grand Labyrinth (متاهة المينوتور الكبرى)
// Geometric 90° Maze + Steel Vault Core + Secret Destructible Brick Shortcuts
// ---------------------------------------------------------------------------
export function createGreatLabyrinth(gridSize: number = 26): number[][] {
  const b = createBuilder(gridSize);
  const { mid, placeBlock, placeVLine, placeHLine } = b;

  // Symmetrical maze corridors (strictly 2 tiles wide = 32px)
  // Outer Ring Walls
  placeHLine(4, 4, mid - 4, TileType.BRICK);
  placeHLine(4, mid + 3, gridSize - 5, TileType.BRICK);
  placeVLine(4, mid - 4, 4, TileType.BRICK);
  placeVLine(4, mid - 4, gridSize - 6, TileType.BRICK);

  placeVLine(mid + 3, gridSize - 6, 4, TileType.BRICK);
  placeVLine(mid + 3, gridSize - 6, gridSize - 6, TileType.BRICK);

  // Steel Corner Junctions (Indestructible pivot points)
  placeBlock(4, 4, TileType.STEEL);
  placeBlock(4, gridSize - 6, TileType.STEEL);
  placeBlock(gridSize - 6, 4, TileType.STEEL);
  placeBlock(gridSize - 6, gridSize - 6, TileType.STEEL);

  // Inner Maze Rings
  placeHLine(8, 8, mid - 2, TileType.BRICK);
  placeHLine(8, mid + 1, gridSize - 9, TileType.BRICK);
  placeHLine(gridSize - 9, 8, mid - 2, TileType.BRICK);
  placeHLine(gridSize - 9, mid + 1, gridSize - 9, TileType.BRICK);

  placeVLine(8, gridSize - 9, 8, TileType.BRICK);
  placeVLine(8, gridSize - 9, gridSize - 10, TileType.BRICK);

  placeBlock(8, 8, TileType.STEEL);
  placeBlock(8, gridSize - 10, TileType.STEEL);
  placeBlock(gridSize - 9, 8, TileType.STEEL);
  placeBlock(gridSize - 9, gridSize - 10, TileType.STEEL);

  // Center Vault Chamber: Solid Steel Core + Brick Enclosure
  placeBlock(mid - 1, mid - 1, TileType.STEEL);
  b.placeCell(mid - 1, mid - 2, TileType.BRICK);
  b.placeCell(mid, mid - 2, TileType.BRICK);
  b.placeCell(mid - 1, mid + 1, TileType.BRICK);
  b.placeCell(mid, mid + 1, TileType.BRICK);

  // Inner baffle gates that eliminate straight-line sniper trajectories
  placeBlock(5, mid - 1, TileType.BRICK);
  placeBlock(gridSize - 7, mid - 1, TileType.BRICK);

  // Ambush foliage pockets
  placeBlock(mid - 3, mid - 1, TileType.TREES);
  placeBlock(mid + 2, mid - 1, TileType.TREES);

  // Mud traps in dead ends
  placeBlock(6, 6, TileType.MUD);
  placeBlock(6, gridSize - 8, TileType.MUD);
  placeBlock(gridSize - 8, 6, TileType.MUD);
  placeBlock(gridSize - 8, gridSize - 8, TileType.MUD);

  return b.g;
}

// ---------------------------------------------------------------------------
// STAGE 7: Badlands Quagmire & Mesas (وادي الأخاديد والهضاب الصخرية)
// Quagmire Canyons (42% Speed) + Dry High-Ground Mesas + Thunder Mesa Citadel
// ---------------------------------------------------------------------------
export function createMuddyBadlands(gridSize: number = 26): number[][] {
  const b = createBuilder(gridSize);
  const { mid, placeBlock, placeVLine } = b;

  // 1. Vertical Mud Canyons (crawling 42% speed)
  const c1 = Math.floor(gridSize * 0.22);
  const c2 = mid - 1;
  const c3 = Math.floor(gridSize * 0.72);

  placeVLine(3, gridSize - 5, c1, TileType.MUD);
  placeVLine(3, gridSize - 5, c3, TileType.MUD);
  placeVLine(4, gridSize - 6, c2, TileType.MUD);

  // 2. High-Ground Thunder Mesa Citadel in the center of the canyon
  placeBlock(mid - 1, mid - 1, TileType.STEEL);
  b.placeCell(mid - 2, mid - 1, TileType.BRICK);
  b.placeCell(mid - 2, mid, TileType.BRICK);
  b.placeCell(mid + 1, mid - 1, TileType.BRICK);
  b.placeCell(mid + 1, mid, TileType.BRICK);
  b.placeCell(mid - 1, mid - 2, TileType.BRICK);
  b.placeCell(mid, mid - 2, TileType.BRICK);
  b.placeCell(mid - 1, mid + 1, TileType.BRICK);
  b.placeCell(mid, mid + 1, TileType.BRICK);

  // Rock pillars breaking up the mud canyon
  placeBlock(5, mid - 1, TileType.BRICK);
  placeBlock(gridSize - 7, mid - 1, TileType.BRICK);

  // 3. High-Ground Brick Mesas (Fortified high dry ridges with ample demolition)
  placeVLine(5, 11, c1 - 3, TileType.BRICK);
  placeVLine(14, gridSize - 7, c1 - 3, TileType.BRICK);
  placeVLine(5, 11, c3 + 3, TileType.BRICK);
  placeVLine(14, gridSize - 7, c3 + 3, TileType.BRICK);

  // 4. Steel Watchtower Pillars on high ground
  placeBlock(8, c1 - 3, TileType.STEEL);
  placeBlock(17, c1 - 3, TileType.STEEL);
  placeBlock(8, c3 + 3, TileType.STEEL);
  placeBlock(17, c3 + 3, TileType.STEEL);

  // 5. Outer border Ice washouts (slick escape runways)
  placeVLine(4, gridSize - 5, 0, TileType.ICE);
  placeVLine(4, gridSize - 5, gridSize - 2, TileType.ICE);

  // Scrub bushes on canyon rims
  placeBlock(12, c1, TileType.TREES);
  placeBlock(12, c3, TileType.TREES);

  return b.g;
}

// ---------------------------------------------------------------------------
// STAGE 8: Metropolis Warzone (مدينة الحرب الحضرية الكبرى)
// Street Grid + 4 Massive Destructible Skyscraper Complexes + City Hall Monument
// ---------------------------------------------------------------------------
export function createUrbanGridlock(gridSize: number = 26): number[][] {
  const b = createBuilder(gridSize);
  const { mid, placeBlock, placeRect, placeHLine, placeVLine } = b;

  // Broad orthogonal avenues paved with smooth ice/asphalt
  const street1 = Math.floor(gridSize * 0.28);
  const street2 = Math.floor(gridSize * 0.68);

  placeHLine(street1, 0, gridSize - 1, TileType.ICE);
  placeHLine(street2, 0, gridSize - 1, TileType.ICE);
  placeVLine(0, gridSize - 1, street1, TileType.ICE);
  placeVLine(0, gridSize - 1, street2, TileType.ICE);

  // City Building Blocks (Brick buildings with steel vault cores for demolition joy)
  const buildBlock = (topR: number, leftC: number, w: number, h: number) => {
    placeRect(topR, topR + h - 1, leftC, leftC + w - 1, TileType.BRICK);
    placeBlock(topR, leftC, TileType.STEEL);
  };

  buildBlock(4, 2, street1 - 3, street1 - 5);
  buildBlock(4, street2 + 2, gridSize - street2 - 4, street1 - 5);
  buildBlock(street2 + 2, 2, street1 - 3, gridSize - street2 - 6);
  buildBlock(street2 + 2, street2 + 2, gridSize - street2 - 4, gridSize - street2 - 6);

  // Central City Park Plaza (Tree groves surrounding solid civic monument)
  placeRect(street1 + 2, street2 - 2, street1 + 2, street2 - 2, TileType.TREES);

  // City Hall Monument in the center
  placeBlock(mid - 1, mid - 1, TileType.STEEL);
  b.placeCell(mid - 2, mid - 1, TileType.BRICK);
  b.placeCell(mid - 2, mid, TileType.BRICK);
  b.placeCell(mid + 1, mid - 1, TileType.BRICK);
  b.placeCell(mid + 1, mid, TileType.BRICK);
  b.placeCell(mid - 1, mid - 2, TileType.BRICK);
  b.placeCell(mid, mid - 2, TileType.BRICK);
  b.placeCell(mid - 1, mid + 1, TileType.BRICK);
  b.placeCell(mid, mid + 1, TileType.BRICK);

  // Reinforced Park Gates
  placeBlock(street1 + 2, mid - 1, TileType.BRICK);
  placeBlock(street2 - 3, mid - 1, TileType.BRICK);

  // Mud on side alleys (construction zones)
  placeBlock(street1 - 1, 0, TileType.MUD);
  placeBlock(street2 + 2, gridSize - 2, TileType.MUD);

  return b.g;
}

// ---------------------------------------------------------------------------
// STAGE 9: Deep Bunker Complex (مجمع المخابئ والأنفاق العسكرية)
// Underground Bastion + 4 Cardinal Steel Pillboxes + Sealed Brick Blast Curtains
// ---------------------------------------------------------------------------
export function createBunkerComplex(gridSize: number = 26): number[][] {
  const b = createBuilder(gridSize);
  const { mid, placeBlock, placeVLine, placeHLine } = b;

  // 1. Central Diamond Bastion - 4 Cardinal Steel Pillboxes
  placeBlock(mid - 6, mid - 1, TileType.STEEL); // North Pillbox
  placeBlock(mid + 4, mid - 1, TileType.STEEL); // South Pillbox
  placeBlock(mid - 1, mid - 6, TileType.STEEL); // West Pillbox
  placeBlock(mid - 1, mid + 4, TileType.STEEL); // East Pillbox

  // Solid connecting blast walls across columns mid-2 and mid+1 (sealing the sniper channel)
  placeVLine(mid - 4, mid + 3, mid - 2, TileType.BRICK);
  placeVLine(mid - 4, mid + 3, mid + 1, TileType.BRICK);

  // Water Security Moats flanking Pillboxes
  placeVLine(mid - 5, mid + 3, mid - 4, TileType.WATER);
  placeVLine(mid - 5, mid + 3, mid + 3, TileType.WATER);
  placeHLine(mid - 4, mid - 3, mid + 2, TileType.WATER);
  placeHLine(mid + 3, mid - 3, mid + 2, TileType.WATER);

  // 2. Thick Brick Outer Armor Walls (Rich demolition opportunities)
  placeHLine(5, 5, mid - 4, TileType.BRICK);
  placeHLine(5, mid + 3, gridSize - 6, TileType.BRICK);
  placeHLine(gridSize - 7, 5, mid - 4, TileType.BRICK);
  placeHLine(gridSize - 7, mid + 3, gridSize - 6, TileType.BRICK);

  placeVLine(5, gridSize - 7, 5, TileType.BRICK);
  placeVLine(5, gridSize - 7, gridSize - 7, TileType.BRICK);

  // Mud Drag-Traps in entrance corridors
  placeBlock(5, mid - 1, TileType.MUD);
  placeBlock(mid - 1, 5, TileType.MUD);
  placeBlock(mid - 1, gridSize - 7, TileType.MUD);

  // Internal Ice Supply Corridors
  placeVLine(7, gridSize - 9, 2, TileType.ICE);
  placeVLine(7, gridSize - 9, gridSize - 4, TileType.ICE);

  return b.g;
}

// ---------------------------------------------------------------------------
// STAGE 10: The Obsidian Caldera (فوهة البركان الأسطورية)
// Concentric Volcanic Caldera + Ash Swamps + Elevated Central Steel Throne
// ---------------------------------------------------------------------------
export function createDeathValley(gridSize: number = 26): number[][] {
  const b = createBuilder(gridSize);
  const { mid, placeBlock, placeVLine, placeHLine } = b;

  // 1. Outer Ring: Ash & Quagmire Mud Swamp (Perimeter border)
  placeHLine(3, 4, gridSize - 5, TileType.MUD);
  placeHLine(gridSize - 5, 4, mid - 4, TileType.MUD);
  placeHLine(gridSize - 5, mid + 3, gridSize - 5, TileType.MUD);
  placeVLine(3, gridSize - 5, 3, TileType.MUD);
  placeVLine(3, gridSize - 5, gridSize - 5, TileType.MUD);

  // 2. Middle Ring: Segmented Obsidian Brick Ramparts with 4 Diagonal Entry Avenues
  const rOffset = Math.floor(gridSize * 0.28);
  placeHLine(mid - rOffset, mid - rOffset + 2, mid + rOffset - 3, TileType.BRICK);
  placeHLine(mid + rOffset - 1, mid - rOffset + 2, mid + rOffset - 3, TileType.BRICK);
  placeVLine(mid - rOffset + 2, mid + rOffset - 3, mid - rOffset, TileType.BRICK);
  placeVLine(mid - rOffset + 2, mid + rOffset - 3, mid + rOffset - 1, TileType.BRICK);

  // 3. Inner Circular Ring Moat of Lava / Water
  placeHLine(mid - 3, mid - 3, mid + 2, TileType.WATER);
  placeHLine(mid + 2, mid - 3, mid + 2, TileType.WATER);
  placeVLine(mid - 3, mid + 2, mid - 3, TileType.WATER);
  placeVLine(mid - 3, mid + 2, mid + 2, TileType.WATER);

  // 4. Central Elevated "Steel Throne" Island (King of the Hill)
  placeBlock(mid - 1, mid - 1, TileType.STEEL);

  // 4 Cardinal Brick Bridges over the inner water ring into the Throne
  b.placeCell(mid - 3, mid - 1, TileType.BRICK);
  b.placeCell(mid - 3, mid, TileType.BRICK);
  b.placeCell(mid + 2, mid - 1, TileType.BRICK);
  b.placeCell(mid + 2, mid, TileType.BRICK);
  b.placeCell(mid - 1, mid - 3, TileType.BRICK);
  b.placeCell(mid, mid - 3, TileType.BRICK);
  b.placeCell(mid - 1, mid + 2, TileType.BRICK);
  b.placeCell(mid, mid + 2, TileType.BRICK);

  // Ambush trees in diagonal crater sectors
  placeBlock(mid - rOffset + 1, mid - rOffset + 1, TileType.TREES);
  placeBlock(mid - rOffset + 1, mid + rOffset - 2, TileType.TREES);
  placeBlock(mid + rOffset - 2, mid - rOffset + 1, TileType.TREES);
  placeBlock(mid + rOffset - 2, mid + rOffset - 2, TileType.TREES);

  return b.g;
}

// ---------------------------------------------------------------------------
// FFA Tactical Maze (8-Player Arena)
// ---------------------------------------------------------------------------
export function createTacticalMaze(gridSize: number = 34): number[][] {
  const g = Array.from({ length: gridSize }, () => Array(gridSize).fill(TileType.EMPTY));
  const mid = Math.floor(gridSize / 2);

  const placeBlock = (r: number, c: number, type: TileType) => {
    if (r >= 0 && r + 1 < gridSize && c >= 0 && c + 1 < gridSize) {
      g[r][c] = type;
      g[r + 1][c] = type;
      g[r][c + 1] = type;
      g[r + 1][c + 1] = type;
    }
  };

  const placeVLine = (startR: number, endR: number, c: number, type: TileType) => {
    for (let r = startR; r <= endR; r++) {
      if (r >= 0 && r < gridSize && c >= 0 && c + 1 < gridSize) {
        g[r][c] = type;
        g[r][c + 1] = type;
      }
    }
  };

  const placeHLine = (r: number, startC: number, endC: number, type: TileType) => {
    for (let c = startC; c <= endC; c++) {
      if (r >= 0 && r + 1 < gridSize && c >= 0 && c < gridSize) {
        g[r][c] = type;
        g[r + 1][c] = type;
      }
    }
  };

  // Center Skirmish Hub
  placeBlock(mid - 4, mid - 4, TileType.STEEL);
  placeBlock(mid - 4, mid + 2, TileType.STEEL);
  placeBlock(mid + 2, mid - 4, TileType.STEEL);
  placeBlock(mid + 2, mid + 2, TileType.STEEL);

  // Central Ice Arena floor for slippery duels
  for (let r = mid - 2; r <= mid + 1; r++) {
    for (let c = mid - 2; c <= mid + 1; c++) {
      g[r][c] = TileType.ICE;
    }
  }

  // Foliage concealment
  g[mid - 3][mid - 1] = TileType.TREES;
  g[mid - 3][mid] = TileType.TREES;
  g[mid + 2][mid - 1] = TileType.TREES;
  g[mid + 2][mid] = TileType.TREES;
  g[mid - 1][mid - 3] = TileType.TREES;
  g[mid][mid - 3] = TileType.TREES;
  g[mid - 1][mid + 2] = TileType.TREES;
  g[mid][mid + 2] = TileType.TREES;

  // Breakable brick gates guarding center entrances
  placeHLine(mid - 4, mid - 1, mid, TileType.BRICK);
  placeHLine(mid + 3, mid - 1, mid, TileType.BRICK);
  placeVLine(mid - 1, mid, mid - 4, TileType.BRICK);
  placeVLine(mid - 1, mid, mid + 3, TileType.BRICK);

  // Inner Maze Ring & Interlocking Corridors
  placeHLine(4, 6, mid - 5, TileType.BRICK);
  placeVLine(6, mid - 5, 4, TileType.BRICK);
  placeHLine(mid - 4, 6, mid - 5, TileType.BRICK);
  placeBlock(mid - 7, mid - 7, TileType.STEEL);
  placeVLine(6, mid - 6, mid - 7, TileType.BRICK);
  placeBlock(8, 8, TileType.MUD);

  placeHLine(4, mid + 4, gridSize - 7, TileType.BRICK);
  placeVLine(6, mid - 5, gridSize - 6, TileType.BRICK);
  placeHLine(mid - 4, mid + 4, gridSize - 7, TileType.BRICK);
  placeBlock(mid - 7, mid + 5, TileType.STEEL);
  placeVLine(6, mid - 6, mid + 5, TileType.BRICK);
  placeBlock(8, gridSize - 10, TileType.MUD);

  placeHLine(gridSize - 6, 6, mid - 5, TileType.BRICK);
  placeVLine(mid + 4, gridSize - 7, 4, TileType.BRICK);
  placeHLine(mid + 3, 6, mid - 5, TileType.BRICK);
  placeBlock(mid + 5, mid - 7, TileType.STEEL);
  placeVLine(mid + 5, gridSize - 7, mid - 7, TileType.BRICK);
  placeBlock(gridSize - 10, 8, TileType.MUD);

  placeHLine(gridSize - 6, mid + 4, gridSize - 7, TileType.BRICK);
  placeVLine(mid + 4, gridSize - 7, gridSize - 6, TileType.BRICK);
  placeHLine(mid + 3, mid + 4, gridSize - 7, TileType.BRICK);
  placeBlock(mid + 5, mid + 5, TileType.STEEL);
  placeVLine(mid + 5, gridSize - 7, mid + 5, TileType.BRICK);
  placeBlock(gridSize - 10, gridSize - 10, TileType.MUD);

  // Clear area around spawns
  const clearArea = (startR: number, startC: number) => {
    for (let r = startR; r < startR + 3; r++) {
      for (let c = startC; c < startC + 3; c++) {
        if (r >= 0 && r < gridSize && c >= 0 && c < gridSize) {
          g[r][c] = TileType.EMPTY;
        }
      }
    }
  };
  clearArea(gridSize - 5, 1);
  clearArea(1, gridSize - 5);
  clearArea(gridSize - 5, gridSize - 5);
  clearArea(1, 1);
  clearArea(1, mid - 2);
  clearArea(gridSize - 5, mid - 2);
  clearArea(mid - 1, 1);
  clearArea(mid - 1, gridSize - 5);

  return g;
}

// ---------------------------------------------------------------------------
// Stage Metadata: Rich Arabic & English info, icons, and tactical brief
// ---------------------------------------------------------------------------
export interface StageMetadata {
  stage: number;
  name: string;
  nameAr: string;
  subtitle: string;
  subtitleAr: string;
  icon: string;
  theme: string;
}

export const STAGES_METADATA: StageMetadata[] = [
  {
    stage: 1,
    name: 'Classic Citadel',
    nameAr: 'القلعة الكلاسيكية',
    subtitle: 'Original 1990 tribute with tactical flank ice avenues',
    subtitleAr: 'تحية للميدان الأصلي مع ممرات جليد جانبية خاطفة',
    icon: '01',
    theme: 'citadel',
  },
  {
    stage: 2,
    name: 'Iron Fortress',
    nameAr: 'الحصن الحديدي',
    subtitle: 'Heavy steel cross bulkheads, lateral slipways & water moats',
    subtitleAr: 'صليب فولاذي منيع مع خنادق مائية وممرات انزلاق دفاعية',
    icon: '02',
    theme: 'fortress',
  },
  {
    stage: 3,
    name: 'Twin Rivers',
    nameAr: 'معبر النهرين',
    subtitle: 'Double river barrier, frozen ice bridge & muddy riverbanks',
    subtitleAr: 'حاجز نهرين مائيين مع جسر جليدي وخنادق وحلية على الضفاف',
    icon: '03',
    theme: 'rivers',
  },
  {
    stage: 4,
    name: 'Amazon Rainforest',
    nameAr: 'غابة الأمازون الكثيفة',
    subtitle: 'Dense 40% jungle canopy, stealth ambushes & sunken temple',
    subtitleAr: 'غطاء شجري كثيف 40% للكمائن الخفية ومعبد غارق في الوحل',
    icon: '04',
    theme: 'jungle',
  },
  {
    stage: 5,
    name: 'Glacial Archipelago',
    nameAr: 'الأرخبيل الجليدي',
    subtitle: 'High-speed drift ice sheets & 4 fortified island outposts',
    subtitleAr: 'مسطحات جليدية للانزلاق السريع و4 جزر حصينة عبر المياه',
    icon: '05',
    theme: 'arctic',
  },
  {
    stage: 6,
    name: 'The Great Labyrinth',
    nameAr: 'المتاهة الكبرى',
    subtitle: 'Geometric 90° corridors, steel junction pillars & breakable shortcuts',
    subtitleAr: 'ممرات هندسية 90 درجة مع أعمدة فولاذية وجدران قابلة للاختراق',
    icon: '06',
    theme: 'labyrinth',
  },
  {
    stage: 7,
    name: 'Muddy Badlands',
    nameAr: 'وادي الوحل والخنادق',
    subtitle: 'Three quagmire canyons (42% speed), brick mesas & steel watchtowers',
    subtitleAr: 'ثلاثة خنادق وحلية عميقة تبطئ الحركة وهضاب مراقبة فولاذية',
    icon: '07',
    theme: 'badlands',
  },
  {
    stage: 8,
    name: 'Urban Gridlock',
    nameAr: 'مدينة الحرب الحضرية',
    subtitle: 'Symmetrical street avenues, 3x3 city blocks & central park plaza',
    subtitleAr: 'شوارع أسفلتية متقاطعة مع مجمعات سكنية وحديقة مركزية بنافورة',
    icon: '08',
    theme: 'urban',
  },
  {
    stage: 9,
    name: 'Bunker Complex',
    nameAr: 'مجمع المخابئ العسكرية',
    subtitle: 'Underground diamond bastion, 4 cardinal pillboxes & security moats',
    subtitleAr: 'حصن ألماسي تحت الأرض مع 4 دشم فولاذية وخنادق أمنية مائية',
    icon: '09',
    theme: 'bunker',
  },
  {
    stage: 10,
    name: 'Death Valley Crater',
    nameAr: 'فوهة بركان الموت',
    subtitle: 'Concentric volcanic caldera, ash swamps & central elevated Steel Throne',
    subtitleAr: 'فوهة بركانية دائرية مع مستنقع رماد وحلي وعرش فولاذي مركزي',
    icon: '10',
    theme: 'crater',
  },
];

/**
 * Generates preset dictionary for Map Editor with all 10 stages
 */
export interface BadwaterWaypoint {
  x: number;
  y: number;
}

export interface BadwaterCheckpointInfo extends PayloadCheckpoint {}

/**
 * High-precision waypoints for Badwater Basin Payload track (34x34 grid, 16px blocks = 544x544 px)
 */
export const BADWATER_WAYPOINTS: BadwaterWaypoint[] = [
  { x: 264, y: 488 }, // 0: BLU Start (col 16.5, row 30.5)
  { x: 264, y: 408 }, // 1: North to Canyon Turn (col 16.5, row 25.5)
  { x: 184, y: 408 }, // 2: West to Point 1 Approach (col 11.5, row 25.5)
  { x: 184, y: 352 }, // 3: POINT 1 (A) (col 11.5, row 22.0)
  { x: 184, y: 248 }, // 4: Tunnel Exit (col 11.5, row 15.5)
  { x: 280, y: 248 }, // 5: POINT 2 (B) - Great Warehouse (col 17.5, row 15.5)
  { x: 408, y: 248 }, // 6: East past warehouse (col 25.5, row 15.5)
  { x: 408, y: 128 }, // 7: POINT 3 (C) - Twin Silos (col 25.5, row 8.0)
  { x: 456, y: 128 }, // 8: East over bridge (col 28.5, row 8.0)
  { x: 456, y: 328 }, // 9: South down Red Road (col 28.5, row 20.5)
  { x: 344, y: 328 }, // 10: FINAL BLAST PIT (col 21.5, row 20.5)
];

export const BADWATER_CHECKPOINTS: BadwaterCheckpointInfo[] = [
  { id: 'cp1', name: 'POINT 1 (A)', x: 184, y: 352, progress: 0.21, waypointIndex: 3, captured: false },
  { id: 'cp2', name: 'POINT 2 (B)', x: 280, y: 248, progress: 0.41, waypointIndex: 5, captured: false },
  { id: 'cp3', name: 'POINT 3 (C)', x: 408, y: 128, progress: 0.65, waypointIndex: 7, captured: false },
  { id: 'cp_final', name: 'FINAL BLAST PIT', x: 344, y: 328, progress: 1.0, waypointIndex: 10, captured: false },
];

/**
 * Handcrafted 34x34 Battle City recreation of Team Fortress 2's Badwater Basin (pl_badwater)
 * High-density tactical map: 4 distinct combat sectors, zero base eagles, zero empty voids.
 */
export function createBadwaterBasinGrid(size: number = 34): number[][] {
  const grid: number[][] = Array(size)
    .fill(0)
    .map(() => Array(size).fill(TileType.EMPTY));

  // --- 1. OUTER CANYON BOUNDARY WALLS ---
  for (let c = 0; c < size; c++) {
    // Top border with mountain passes
    if (c !== 7 && c !== 21 && c !== 28) {
      grid[0][c] = c % 2 === 0 ? TileType.STEEL : TileType.BRICK;
    }
    // Bottom border with BLU gate
    if (c < 14 || c > 18) {
      grid[size - 1][c] = c % 3 === 0 ? TileType.STEEL : TileType.BRICK;
    }
  }
  for (let r = 0; r < size; r++) {
    // West mountain cliff
    grid[r][0] = r % 2 === 0 ? TileType.STEEL : TileType.BRICK;
    // East mountain cliff
    grid[r][size - 1] = r % 2 === 0 ? TileType.STEEL : TileType.BRICK;
  }

  // --- 2. SECTOR 1: NORTHWEST INDUSTRIAL COMPLEX & COOLANT CANAL (Rows 1-13, Cols 1-15) ---
  // Industrial Power Station (Rows 2-5, Cols 2-6)
  for (let r = 2; r <= 5; r++) {
    for (let c = 2; c <= 6; c++) {
      if (r === 2 || r === 5 || c === 2 || c === 6) {
        grid[r][c] = TileType.STEEL;
      } else {
        grid[r][c] = TileType.BRICK;
      }
    }
  }
  grid[5][4] = TileType.EMPTY; // Entrance

  // Barracks Complex (Rows 8-11, Cols 2-6)
  for (let r = 8; r <= 11; r++) {
    for (let c = 2; c <= 6; c++) {
      if (r === 8 || r === 11 || c === 2 || c === 6) {
        grid[r][c] = TileType.BRICK;
      } else {
        grid[r][c] = TileType.EMPTY;
      }
    }
  }
  grid[9][4] = TileType.BRICK;
  grid[10][4] = TileType.BRICK;
  grid[8][4] = TileType.EMPTY; // Entrance

  // Coolant Canal (Rows 2-13, Cols 8-9)
  for (let r = 2; r <= 13; r++) {
    grid[r][8] = TileType.WATER;
    grid[r][9] = TileType.WATER;
  }
  // Twin crossing bridges over canal
  grid[6][8] = TileType.BRICK;
  grid[6][9] = TileType.BRICK;
  grid[11][8] = TileType.BRICK;
  grid[11][9] = TileType.BRICK;

  // Ice Refrigeration Bay (Rows 3-6, Cols 11-13)
  for (let r = 3; r <= 6; r++) {
    for (let c = 11; c <= 13; c++) {
      grid[r][c] = TileType.ICE;
    }
  }
  grid[2][11] = TileType.STEEL; grid[2][12] = TileType.STEEL; grid[2][13] = TileType.STEEL;
  grid[7][11] = TileType.BRICK; grid[7][12] = TileType.BRICK; grid[7][13] = TileType.BRICK;
  grid[4][14] = TileType.STEEL; grid[5][14] = TileType.STEEL;

  // Pine Forest Cover (Rows 8-12, Cols 11-14)
  for (let r = 8; r <= 12; r++) {
    for (let c = 11; c <= 14; c++) {
      grid[r][c] = TileType.TREES;
    }
  }

  // --- 3. SECTOR 2: NORTHEAST TWIN SILOS & BRIDGE (Rows 1-13, Cols 16-32) ---
  // Silo 1 (Rows 3-6, Cols 18-22)
  for (let r = 3; r <= 6; r++) {
    for (let c = 18; c <= 22; c++) {
      const isEdge = r === 3 || r === 6 || c === 18 || c === 22;
      grid[r][c] = isEdge ? TileType.STEEL : TileType.BRICK;
    }
  }
  // Silo 2 (Rows 9-12, Cols 18-22)
  for (let r = 9; r <= 12; r++) {
    for (let c = 18; c <= 22; c++) {
      const isEdge = r === 9 || r === 12 || c === 18 || c === 22;
      grid[r][c] = isEdge ? TileType.STEEL : TileType.BRICK;
    }
  }
  // Catwalk connect (Row 7, Cols 18-22)
  for (let c = 18; c <= 22; c++) {
    grid[7][c] = TileType.BRICK;
  }

  // Northeast RED Defense Headquarters (Rows 2-5, Cols 26-31)
  for (let r = 2; r <= 5; r++) {
    grid[r][26] = TileType.BRICK;
    grid[r][31] = TileType.STEEL;
  }
  for (let c = 26; c <= 31; c++) {
    grid[2][c] = TileType.STEEL;
  }

  // Industrial Cargo Depot (Rows 9-12, Cols 30-32)
  for (let r = 9; r <= 12; r++) {
    grid[r][30] = TileType.BRICK;
    grid[r][31] = TileType.BRICK;
  }

  // --- 4. SECTOR 3: TUNNEL CHOKEPOINT & WEST DRAINAGE (Rows 14-22, Cols 1-15) ---
  // West Mud Silt Passage (Rows 14-21, Cols 1-3)
  for (let r = 14; r <= 21; r++) {
    for (let c = 1; c <= 3; c++) {
      grid[r][c] = TileType.MUD;
    }
  }
  // Canal continuation (Rows 14-22, Cols 4-5)
  for (let r = 14; r <= 22; r++) {
    grid[r][4] = TileType.WATER;
    grid[r][5] = TileType.WATER;
  }
  grid[17][4] = TileType.BRICK; // Bridge
  grid[17][5] = TileType.BRICK;

  // Reinforced Tunnel Wall (Left of track, Rows 14-21, Cols 7-9)
  for (let r = 14; r <= 21; r++) {
    grid[r][7] = TileType.STEEL;
    grid[r][8] = TileType.BRICK;
    grid[r][9] = TileType.STEEL;
  }

  // Warehouse dividing wall (Right of track tunnel, Rows 16-21, Cols 13-14)
  for (let r = 16; r <= 21; r++) {
    grid[r][13] = TileType.BRICK;
    grid[r][14] = TileType.STEEL;
  }

  // --- 5. SECTOR 4: THE GREAT WAREHOUSE & RED CITADEL & FINAL PIT (Rows 13-23, Cols 15-32) ---
  // Great Warehouse outer shell (Point 2 at Row 15, Col 17)
  for (let c = 14; c <= 24; c++) {
    if (c !== 17 && c !== 18) { // Rail door
      grid[13][c] = TileType.STEEL;
    }
  }
  for (let r = 14; r <= 17; r++) {
    grid[r][24] = TileType.STEEL;
  }
  // Warehouse internal storage bays
  grid[16][16] = TileType.BRICK;
  grid[16][17] = TileType.BRICK;
  grid[16][19] = TileType.BRICK;
  grid[16][20] = TileType.BRICK;

  // RED Defense Citadel (Rows 16-18, Cols 19-24)
  // RED spawn is at Col 21, Row 17
  grid[16][19] = TileType.STEEL; grid[16][20] = TileType.STEEL; grid[16][22] = TileType.STEEL; grid[16][23] = TileType.STEEL;
  grid[17][19] = TileType.STEEL; grid[17][23] = TileType.STEEL;
  grid[18][19] = TileType.BRICK; grid[18][23] = TileType.BRICK;

  // Final Blast Pit Surroundings (Point 4 at Row 20, Col 21)
  // Steel blast barriers
  grid[21][19] = TileType.STEEL; grid[21][20] = TileType.STEEL; grid[21][22] = TileType.STEEL; grid[21][23] = TileType.STEEL;
  grid[22][19] = TileType.BRICK; grid[22][20] = TileType.BRICK; grid[22][22] = TileType.BRICK; grid[22][23] = TileType.BRICK;
  grid[19][18] = TileType.STEEL; grid[20][18] = TileType.STEEL; grid[21][18] = TileType.STEEL;
  grid[19][24] = TileType.STEEL; grid[20][24] = TileType.STEEL; grid[21][24] = TileType.STEEL;

  // East Pit Approach Walls (Rows 14-22, Cols 30-32)
  for (let r = 14; r <= 22; r++) {
    if (r % 2 === 0) {
      grid[r][30] = TileType.BRICK;
      grid[r][31] = TileType.STEEL;
    }
  }

  // --- 6. SECTOR 5: BLU STAGING, LOWER CANYON & POINT 1 (Rows 22-33, Cols 0-33) ---
  // Point 1 Guard Bunker (Row 22, Col 8-9)
  grid[21][8] = TileType.STEEL; grid[21][9] = TileType.BRICK;
  grid[22][8] = TileType.STEEL; grid[22][9] = TileType.BRICK;
  grid[23][8] = TileType.STEEL; grid[23][9] = TileType.BRICK;
  // Ambush foliage east of Point 1
  grid[22][13] = TileType.TREES; grid[22][14] = TileType.TREES;
  grid[23][13] = TileType.TREES; grid[23][14] = TileType.TREES;

  // Canyon Ridge Walls
  for (let r = 24; r <= 28; r++) {
    grid[r][7] = TileType.STEEL;
    grid[r][8] = TileType.BRICK;
    grid[r][19] = TileType.BRICK;
    grid[r][20] = TileType.STEEL;
  }

  // Southwest Quarry (Rows 24-32, Cols 1-6)
  for (let r = 26; r <= 30; r++) {
    for (let c = 2; c <= 5; c++) {
      grid[r][c] = TileType.MUD;
    }
  }
  for (let c = 2; c <= 5; c++) {
    grid[25][c] = TileType.BRICK;
    grid[31][c] = TileType.BRICK;
  }

  // Southeast Observation Cliff (Rows 24-32, Cols 22-32)
  for (let r = 25; r <= 27; r++) {
    for (let c = 23; c <= 27; c++) {
      grid[r][c] = TileType.BRICK;
    }
  }
  for (let r = 28; r <= 32; r++) {
    for (let c = 25; c <= 31; c++) {
      grid[r][c] = TileType.TREES;
    }
  }

  // BLU Armored Staging Hangar (Rows 29-33, Cols 12-21)
  for (let r = 29; r <= 32; r++) {
    grid[r][12] = TileType.STEEL;
    grid[r][21] = TileType.STEEL;
  }
  for (let c = 12; c <= 21; c++) {
    grid[33][c] = TileType.STEEL;
  }
  grid[30][19] = TileType.BRICK; grid[30][20] = TileType.BRICK;

  // --- 7. CLEAR RAIL TRACK CORRIDORS (Ensure ZERO solid blocks on rails) ---
  const clearCorridors = [
    // WP0 -> WP1: col 16, rows 25..31 (2-tile wide cols 15-17)
    { r1: 25, r2: 31, c1: 15, c2: 17 },
    // WP1 -> WP2: row 25, cols 11..16 (2-tile wide rows 24-26)
    { r1: 24, r2: 26, c1: 10, c2: 17 },
    // WP2 -> WP3: cols 11, rows 22..25 (2-tile wide cols 10-12)
    { r1: 21, r2: 25, c1: 10, c2: 12 },
    // WP3 -> WP4: cols 11, rows 15..22 (2-tile wide cols 10-12)
    { r1: 14, r2: 22, c1: 10, c2: 12 },
    // WP4 -> WP5: row 15, cols 11..18 (2-tile wide rows 14-16)
    { r1: 14, r2: 16, c1: 11, c2: 18 },
    // WP5 -> WP6: row 15, cols 17..26 (2-tile wide rows 14-16)
    { r1: 14, r2: 16, c1: 17, c2: 26 },
    // WP6 -> WP7: col 25, rows 8..15 (2-tile wide cols 24-26)
    { r1: 7, r2: 15, c1: 24, c2: 26 },
    // WP7 -> WP8: row 8, cols 25..29 (2-tile wide rows 7-9)
    { r1: 7, r2: 9, c1: 25, c2: 29 },
    // WP8 -> WP9: col 28, rows 8..21 (2-tile wide cols 27-29)
    { r1: 8, r2: 21, c1: 27, c2: 29 },
    // WP9 -> WP10: row 20, cols 21..29 (2-tile wide rows 19-21)
    { r1: 19, r2: 21, c1: 20, c2: 29 },
  ];

  for (const box of clearCorridors) {
    for (let r = box.r1; r <= box.r2; r++) {
      for (let c = box.c1; c <= box.c2; c++) {
        if (r >= 0 && r < size && c >= 0 && c < size) {
          grid[r][c] = TileType.EMPTY;
        }
      }
    }
  }

  // Clear Spawn Points
  // P1 (BLU Attacker) spawn at Col 13, Row 30 (Open staging floor, clear of cart and south wall)
  for (let r = 29; r <= 32; r++) {
    for (let c = 13; c <= 15; c++) {
      grid[r][c] = TileType.EMPTY;
    }
  }

  // P2 (RED Defender) spawn at Col 28, Row 4 (Northeast Defense Headquarters)
  // Far from the starting path, giving BLU space to advance along the track
  for (let r = 3; r <= 7; r++) {
    for (let c = 27; c <= 30; c++) {
      grid[r][c] = TileType.EMPTY;
    }
  }

  return grid;
}

export function getPresetMaps(gridSize: number = 26): Record<string, StageMap> {
  return {
    stage1: {
      name: 'Stage 1: Classic Citadel',
      grid: createStage1(gridSize),
    },
    ironFortress: {
      name: 'Stage 2: Iron Fortress',
      grid: createIronFortress(gridSize),
    },
    riverCrossing: {
      name: 'Stage 3: Twin Rivers',
      grid: createRiverCrossing(gridSize),
    },
    amazonRainforest: {
      name: 'Stage 4: Amazon Rainforest',
      grid: createAmazonRainforest(gridSize),
    },
    glacialArchipelago: {
      name: 'Stage 5: Glacial Archipelago',
      grid: createGlacialArchipelago(gridSize),
    },
    greatLabyrinth: {
      name: 'Stage 6: The Great Labyrinth',
      grid: createGreatLabyrinth(gridSize),
    },
    muddyBadlands: {
      name: 'Stage 7: Muddy Badlands',
      grid: createMuddyBadlands(gridSize),
    },
    urbanGridlock: {
      name: 'Stage 8: Urban Gridlock',
      grid: createUrbanGridlock(gridSize),
    },
    bunkerComplex: {
      name: 'Stage 9: Bunker Complex',
      grid: createBunkerComplex(gridSize),
    },
    deathValley: {
      name: 'Stage 10: Death Valley Crater',
      grid: createDeathValley(gridSize),
    },
    badwaterBasin: {
      name: 'Badwater Basin (TF2 Payload)',
      grid: createBadwaterBasinGrid(34),
    },
    tacticalMaze: {
      name: 'Tactical Maze (FFA)',
      grid: createTacticalMaze(gridSize),
    },
    cleanSlate: {
      name: 'Clean Slate',
      grid: createEmptyGrid(gridSize),
    },
  };
}

export const PRESET_MAPS: Record<string, StageMap> = getPresetMaps(26);

/**
 * Returns a StageMap tailored to the specific stage number and map size preset
 */
export function getStageMapForPresetAndStage(
  stage: number,
  preset: MapSizePreset = 'classic',
  mode?: string,
  versusSubMode?: string
): StageMap {
  const gridSize = getGridSizeForPreset(preset);
  if (mode === 'payload' || versusSubMode === 'payload') {
    return {
      name: 'Badwater Basin (TF2 Payload)',
      grid: createBadwaterBasinGrid(34),
    };
  }
  if (mode === 'ffa') {
    return {
      name: `Tactical Maze Arena (${MAP_SIZE_CONFIGS[preset]?.name || 'Expanded'})`,
      grid: createTacticalMaze(gridSize),
    };
  }

  // 10 distinct handcrafted stages with modulo wrapping
  const stageMod = ((stage - 1) % 10) + 1;
  let grid: number[][];
  let stageName: string;

  switch (stageMod) {
    case 1:
      stageName = `Stage ${stage}: Classic Citadel`;
      grid = createStage1(gridSize);
      break;
    case 2:
      stageName = `Stage ${stage}: Iron Fortress`;
      grid = createIronFortress(gridSize);
      break;
    case 3:
      stageName = `Stage ${stage}: Twin Rivers`;
      grid = createRiverCrossing(gridSize);
      break;
    case 4:
      stageName = `Stage ${stage}: Amazon Rainforest`;
      grid = createAmazonRainforest(gridSize);
      break;
    case 5:
      stageName = `Stage ${stage}: Glacial Archipelago`;
      grid = createGlacialArchipelago(gridSize);
      break;
    case 6:
      stageName = `Stage ${stage}: The Great Labyrinth`;
      grid = createGreatLabyrinth(gridSize);
      break;
    case 7:
      stageName = `Stage ${stage}: Muddy Badlands`;
      grid = createMuddyBadlands(gridSize);
      break;
    case 8:
      stageName = `Stage ${stage}: Urban Gridlock`;
      grid = createUrbanGridlock(gridSize);
      break;
    case 9:
      stageName = `Stage ${stage}: Bunker Complex`;
      grid = createBunkerComplex(gridSize);
      break;
    case 10:
    default:
      stageName = `Stage ${stage}: Death Valley Crater`;
      grid = createDeathValley(gridSize);
      break;
  }

  if (mode === 'versus' || mode === '2v2') {
    addNorthBaseBunker(grid, gridSize);
  }

  return { name: stageName, grid };
}

/**
 * Deep clones a grid of any dimensions
 */
export function cloneGrid(grid: number[][]): number[][] {
  return grid.map((row) => [...row]);
}
