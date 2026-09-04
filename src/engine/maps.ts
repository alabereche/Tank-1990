/**
 * Battle City 1990 - Preset Maps & Generator
 * Supports Classic (26x26), Large (34x34), and Giant (42x42) battlefield arenas.
 */

import { StageMap, TileType, MapSizePreset } from '../types';

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
 * Creates an empty grid with the Base Eagle and standard protective brick bunker
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

  return grid;
}

/**
 * Adds the North Base Eagle and symmetrical protective brick bunker for dual-base modes (1v1, 2v2)
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
}

/**
 * NES Battle City Stage 1 Original Map Layout (with dynamic scaling for larger arenas)
 * Redesigned with tactical Ice flank corridors, ambush tree groves, and mid-field Mud choke points.
 */
export function createStage1(gridSize: number = 26): number[][] {
  const g = createEmptyGrid(gridSize);

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

  if (gridSize === 26) {
    // Exact Classic NES Stage 1 Core Pillars
    placeVLine(2, 9, 2, TileType.BRICK);
    placeVLine(2, 9, 6, TileType.BRICK);
    placeVLine(2, 6, 10, TileType.BRICK);
    placeVLine(2, 6, 14, TileType.BRICK);
    placeVLine(2, 9, 18, TileType.BRICK);
    placeVLine(2, 9, 22, TileType.BRICK);

    placeBlock(7, 12, TileType.STEEL);

    // Horizontal Brick Gates
    placeHLine(11, 0, 3, TileType.BRICK);
    placeHLine(11, 6, 9, TileType.BRICK);
    placeHLine(11, 16, 19, TileType.BRICK);
    placeHLine(11, 22, 25, TileType.BRICK);

    placeVLine(13, 14, 0, TileType.STEEL);
    placeVLine(13, 14, 24, TileType.STEEL);

    // Lower Defenses
    placeVLine(15, 20, 2, TileType.BRICK);
    placeVLine(15, 20, 6, TileType.BRICK);
    placeVLine(15, 18, 10, TileType.BRICK);
    placeVLine(15, 18, 14, TileType.BRICK);
    placeVLine(15, 20, 18, TileType.BRICK);
    placeVLine(15, 20, 22, TileType.BRICK);

    placeBlock(19, 12, TileType.STEEL);

    // --- Tactical Enhancements (ICE, MUD & TREES) ---
    // 1. High-speed Flank ICE corridors (columns 0-1 and 24-25, rows 4-10)
    placeVLine(4, 10, 0, TileType.ICE);
    placeVLine(4, 10, 24, TileType.ICE);

    // 2. Ambush Foliage (Trees) flanking center columns
    placeVLine(7, 9, 4, TileType.TREES);
    placeVLine(7, 9, 20, TileType.TREES);

    // 3. Tactical Mud Choke Points at mid-field intersections
    placeBlock(13, 8, TileType.MUD);
    placeBlock(13, 16, TileType.MUD);

    return g;
  }

  // Expanded Arena Layout for 34x34 or 42x42
  const offset = Math.floor((gridSize - 26) / 2);

  // Core Stage 1 structure shifted inward
  placeVLine(2 + offset, 9 + offset, 2 + offset, TileType.BRICK);
  placeVLine(2 + offset, 9 + offset, 6 + offset, TileType.BRICK);
  placeVLine(2 + offset, 6 + offset, 10 + offset, TileType.BRICK);
  placeVLine(2 + offset, 6 + offset, 14 + offset, TileType.BRICK);
  placeVLine(2 + offset, 9 + offset, 18 + offset, TileType.BRICK);
  placeVLine(2 + offset, 9 + offset, 22 + offset, TileType.BRICK);

  placeBlock(7 + offset, 12 + offset, TileType.STEEL);

  placeHLine(11 + offset, offset, 3 + offset, TileType.BRICK);
  placeHLine(11 + offset, 6 + offset, 9 + offset, TileType.BRICK);
  placeHLine(11 + offset, 16 + offset, 19 + offset, TileType.BRICK);
  placeHLine(11 + offset, 22 + offset, 25 + offset, TileType.BRICK);

  placeVLine(13 + offset, 14 + offset, offset, TileType.STEEL);
  placeVLine(13 + offset, 14 + offset, 24 + offset, TileType.STEEL);

  placeVLine(15 + offset, 20 + offset, 2 + offset, TileType.BRICK);
  placeVLine(15 + offset, 20 + offset, 6 + offset, TileType.BRICK);
  placeVLine(15 + offset, 18 + offset, 10 + offset, TileType.BRICK);
  placeVLine(15 + offset, 18 + offset, 14 + offset, TileType.BRICK);
  placeVLine(15 + offset, 20 + offset, 18 + offset, TileType.BRICK);
  placeVLine(15 + offset, 20 + offset, 22 + offset, TileType.BRICK);

  placeBlock(19 + offset, 12 + offset, TileType.STEEL);

  // Tactical Ice & Mud in Core Zone
  placeVLine(4 + offset, 10 + offset, offset, TileType.ICE);
  placeVLine(4 + offset, 10 + offset, 24 + offset, TileType.ICE);
  placeVLine(7 + offset, 9 + offset, 4 + offset, TileType.TREES);
  placeVLine(7 + offset, 9 + offset, 20 + offset, TileType.TREES);
  placeBlock(13 + offset, 8 + offset, TileType.MUD);
  placeBlock(13 + offset, 16 + offset, TileType.MUD);

  // Outer Wings & Flank Bastions for larger battlefields
  placeVLine(4, gridSize - 6, 2, TileType.BRICK);
  placeBlock(Math.floor(gridSize / 2) - 1, 0, TileType.STEEL);
  placeVLine(4, gridSize - 6, gridSize - 4, TileType.BRICK);
  placeBlock(Math.floor(gridSize / 2) - 1, gridSize - 2, TileType.STEEL);

  // Outer Ice Slipways along border lanes
  placeVLine(6, gridSize - 8, 0, TileType.ICE);
  placeVLine(6, gridSize - 8, gridSize - 2, TileType.ICE);

  // Upper perimeter tactical columns
  placeHLine(2, 4, 8, TileType.BRICK);
  placeHLine(2, gridSize - 9, gridSize - 5, TileType.BRICK);

  // Mud traps at outer corridor entrances
  placeBlock(gridSize - 8, 4, TileType.MUD);
  placeBlock(gridSize - 8, gridSize - 6, TileType.MUD);

  // Mid foliage in expanded zones
  for (let r = offset; r < offset + 4; r++) {
    for (let c = 4; c < offset; c++) {
      if (r < gridSize && c < gridSize) g[r][c] = TileType.TREES;
    }
    for (let c = gridSize - offset; c < gridSize - 4; c++) {
      if (r < gridSize && c < gridSize) g[r][c] = TileType.TREES;
    }
  }

  return g;
}


/**
 * Preset: Iron Fortress
 * Heavy defensive citadel with outer steel teeth, swamp mud moats,
 * internal ice slipways for high-speed lateral defense, and water hazard trenches.
 */
export function createIronFortress(gridSize: number = 26): number[][] {
  const g = createEmptyGrid(gridSize);
  const mid = Math.floor(gridSize / 2);

  const placeBlock = (r: number, c: number, type: TileType) => {
    if (r >= 0 && r + 1 < gridSize && c >= 0 && c + 1 < gridSize) {
      g[r][c] = type;
      g[r + 1][c] = type;
      g[r][c + 1] = type;
      g[r + 1][c + 1] = type;
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

  // Outer steel battlement teeth
  for (let c = 4; c < gridSize - 4; c += 4) {
    if (c + 1 < gridSize) {
      g[2][c] = TileType.STEEL;
      g[2][c + 1] = TileType.STEEL;
      g[3][c] = TileType.STEEL;
      g[3][c + 1] = TileType.STEEL;
    }
  }

  // Lateral ICE patrol slipway behind steel battlements
  placeHLine(4, 6, gridSize - 7, TileType.ICE);

  // Steel cross in center
  for (let r = mid - 3; r <= mid + 2; r++) {
    if (r >= 0 && r < gridSize) {
      g[r][mid - 1] = TileType.STEEL;
      g[r][mid] = TileType.STEEL;
    }
  }
  for (let c = mid - 5; c <= mid + 4; c++) {
    if (c >= 0 && c < gridSize) {
      g[mid - 1][c] = TileType.STEEL;
      g[mid][c] = TileType.STEEL;
    }
  }

  // Central ICE courtyard lanes flanking the steel cross (fast transit)
  for (let c = mid - 5; c <= mid - 2; c++) {
    if (mid - 3 >= 0 && c >= 0) g[mid - 3][c] = TileType.ICE;
    if (mid + 2 < gridSize && c >= 0) g[mid + 2][c] = TileType.ICE;
  }
  for (let c = mid + 1; c <= mid + 4; c++) {
    if (mid - 3 >= 0 && c < gridSize) g[mid - 3][c] = TileType.ICE;
    if (mid + 2 < gridSize && c < gridSize) g[mid + 2][c] = TileType.ICE;
  }

  // Brick bunkers surrounding corridors
  for (let r = 5; r <= 10; r++) {
    if (r < gridSize) {
      g[r][2] = TileType.BRICK;
      g[r][3] = TileType.BRICK;
      g[r][gridSize - 4] = TileType.BRICK;
      g[r][gridSize - 3] = TileType.BRICK;
    }
  }

  for (let r = gridSize - 11; r <= gridSize - 6; r++) {
    if (r < gridSize) {
      g[r][4] = TileType.BRICK;
      g[r][5] = TileType.BRICK;
      g[r][gridSize - 6] = TileType.BRICK;
      g[r][gridSize - 5] = TileType.BRICK;
    }
  }

  // Water trenches
  for (let c = 2; c <= Math.floor(gridSize / 3); c++) {
    if (c < gridSize) {
      g[8][c] = TileType.WATER;
      g[9][c] = TileType.WATER;
    }
  }
  for (let c = gridSize - Math.floor(gridSize / 3) - 1; c < gridSize - 2; c++) {
    if (c < gridSize) {
      g[8][c] = TileType.WATER;
      g[9][c] = TileType.WATER;
    }
  }

  // Swamp MUD moats flanking water hazards & side fortress approaches
  for (let c = 2; c <= Math.floor(gridSize / 3); c++) {
    if (10 < gridSize && c < gridSize) {
      g[10][c] = TileType.MUD;
    }
  }
  for (let c = gridSize - Math.floor(gridSize / 3) - 1; c < gridSize - 2; c++) {
    if (10 < gridSize && c < gridSize) {
      g[10][c] = TileType.MUD;
    }
  }
  // Flank approach mud patches
  placeBlock(6, 4, TileType.MUD);
  placeBlock(6, gridSize - 6, TileType.MUD);

  // Tree cover / concealment groves
  for (let r = gridSize - 9; r <= gridSize - 5; r++) {
    for (let c = mid - 5; c <= mid - 3; c++) {
      if (r < gridSize && c < gridSize && c >= 0) g[r][c] = TileType.TREES;
    }
    for (let c = mid + 2; c <= mid + 4; c++) {
      if (r < gridSize && c < gridSize) g[r][c] = TileType.TREES;
    }
  }

  return g;
}

/**
 * Preset: River Crossing
 * Tactical natural landscape featuring a wide river divided into brick bridges,
 * a central frozen ice crossing, muddy riverbank shallows, and lush concealment groves.
 */
export function createRiverCrossing(gridSize: number = 26): number[][] {
  const g = createEmptyGrid(gridSize);
  const mid = Math.floor(gridSize / 2);
  const riverRow1 = Math.floor(gridSize * 0.38);
  const riverRow2 = riverRow1 + 1;

  const bridge1Start = Math.floor(gridSize * 0.22);
  const bridge1End = bridge1Start + 2;
  const bridge2Start = Math.floor(gridSize * 0.7);
  const bridge2End = bridge2Start + 2;

  // Water river spanning across with two brick bridges and a central frozen ice crossing
  for (let c = 0; c < gridSize; c++) {
    if ((c >= bridge1Start && c <= bridge1End) || (c >= bridge2Start && c <= bridge2End)) {
      g[riverRow1][c] = TileType.BRICK;
      g[riverRow2][c] = TileType.BRICK;
    } else if (c >= mid - 2 && c <= mid + 1) {
      // FROZEN RIVER SECTION (ICE) - high-risk, high-speed slippery crossing
      g[riverRow1][c] = TileType.ICE;
      g[riverRow2][c] = TileType.ICE;
    } else {
      g[riverRow1][c] = TileType.WATER;
      g[riverRow2][c] = TileType.WATER;
    }
  }

  // Muddy Riverbanks: North (riverRow1 - 1) & South (riverRow2 + 1)
  // Tanks leaving or entering the water/ice hit thick mud shallows
  for (let c = bridge1Start - 2; c <= bridge1Start - 1; c++) {
    if (c >= 0 && riverRow1 - 1 >= 0) g[riverRow1 - 1][c] = TileType.MUD;
    if (c >= 0 && riverRow2 + 1 < gridSize) g[riverRow2 + 1][c] = TileType.MUD;
  }
  for (let c = bridge1End + 1; c <= bridge1End + 2; c++) {
    if (c < gridSize && riverRow1 - 1 >= 0) g[riverRow1 - 1][c] = TileType.MUD;
    if (c < gridSize && riverRow2 + 1 < gridSize) g[riverRow2 + 1][c] = TileType.MUD;
  }
  for (let c = bridge2Start - 2; c <= bridge2Start - 1; c++) {
    if (c >= 0 && riverRow1 - 1 >= 0) g[riverRow1 - 1][c] = TileType.MUD;
    if (c >= 0 && riverRow2 + 1 < gridSize) g[riverRow2 + 1][c] = TileType.MUD;
  }
  for (let c = bridge2End + 1; c <= bridge2End + 2; c++) {
    if (c < gridSize && riverRow1 - 1 >= 0) g[riverRow1 - 1][c] = TileType.MUD;
    if (c < gridSize && riverRow2 + 1 < gridSize) g[riverRow2 + 1][c] = TileType.MUD;
  }

  // Mud flats flanking the frozen ice crossing
  for (let c = mid - 4; c <= mid - 3; c++) {
    if (c >= 0 && riverRow1 - 1 >= 0) g[riverRow1 - 1][c] = TileType.MUD;
    if (c >= 0 && riverRow2 + 1 < gridSize) g[riverRow2 + 1][c] = TileType.MUD;
  }
  for (let c = mid + 2; c <= mid + 3; c++) {
    if (c < gridSize && riverRow1 - 1 >= 0) g[riverRow1 - 1][c] = TileType.MUD;
    if (c < gridSize && riverRow2 + 1 < gridSize) g[riverRow2 + 1][c] = TileType.MUD;
  }

  // Ice aprons further down south for momentum sliding
  for (let c = 2; c <= mid - 4; c++) {
    if (riverRow2 + 2 < gridSize) {
      g[riverRow2 + 2][c] = TileType.ICE;
    }
  }
  for (let c = mid + 4; c < gridSize - 2; c++) {
    if (riverRow2 + 2 < gridSize) {
      g[riverRow2 + 2][c] = TileType.ICE;
    }
  }

  // Dense foliage / tree clusters
  for (let r = 3; r <= riverRow1 - 2; r++) {
    for (let c = bridge1End + 2; c < bridge2Start - 2; c++) {
      if (r < gridSize && c < gridSize) g[r][c] = TileType.TREES;
    }
  }

  // Flank brick forts
  for (let r = riverRow2 + 4; r <= gridSize - 7; r++) {
    if (r < gridSize) {
      g[r][2] = TileType.BRICK;
      g[r][3] = TileType.BRICK;
      g[r][gridSize - 4] = TileType.BRICK;
      g[r][gridSize - 3] = TileType.BRICK;
    }
  }

  // Defensive steel pillars
  g[5][3] = TileType.STEEL;
  g[5][4] = TileType.STEEL;
  g[5][gridSize - 5] = TileType.STEEL;
  g[5][gridSize - 4] = TileType.STEEL;

  return g;
}

/**
 * Preset: 8-Player Tactical Maze Arena (Labyrinth of Steel & Brick)
 * Symmetrical 4-quadrant maze specifically balanced for 8-Player FFA and 2v2 Team Battles.
 * Guarantees wide corridors (>= 32px), zero cross-map sniping lines,
 * breakable shortcut walls, fortified spawn bunkers, a slippery Central Ice Arena,
 * and tactical mud trenches in the outer flanking corridors.
 */
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

  // --- 1. Center Tactical Core (The Skirmish Hub & Central Ice Arena) ---
  // Four steel corner pillars around central chamber
  placeBlock(mid - 4, mid - 4, TileType.STEEL);
  placeBlock(mid - 4, mid + 2, TileType.STEEL);
  placeBlock(mid + 2, mid - 4, TileType.STEEL);
  placeBlock(mid + 2, mid + 2, TileType.STEEL);

  // Central Ice Arena floor for slippery, high-momentum duels
  for (let r = mid - 2; r <= mid + 1; r++) {
    for (let c = mid - 2; c <= mid + 1; c++) {
      g[r][c] = TileType.ICE;
    }
  }

  // Foliage concealment lining the outer rim of the center
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

  // --- 2. Inner Maze Ring & Interlocking Corridors ---
  // Quadrant 1 (Top-Left)
  placeHLine(4, 6, mid - 5, TileType.BRICK);
  placeVLine(6, mid - 5, 4, TileType.BRICK);
  placeHLine(mid - 4, 6, mid - 5, TileType.BRICK);
  placeBlock(mid - 7, mid - 7, TileType.STEEL);
  placeVLine(6, mid - 6, mid - 7, TileType.BRICK);
  // Quadrant 1 Mud Trench (tactical risk/reward shortcut)
  placeBlock(8, 8, TileType.MUD);

  // Quadrant 2 (Top-Right)
  placeHLine(4, mid + 4, gridSize - 7, TileType.BRICK);
  placeVLine(6, mid - 5, gridSize - 6, TileType.BRICK);
  placeHLine(mid - 4, mid + 4, gridSize - 7, TileType.BRICK);
  placeBlock(mid - 7, mid + 5, TileType.STEEL);
  placeVLine(6, mid - 6, mid + 5, TileType.BRICK);
  // Quadrant 2 Mud Trench
  placeBlock(8, gridSize - 10, TileType.MUD);

  // Quadrant 3 (Bottom-Left)
  placeHLine(gridSize - 6, 6, mid - 5, TileType.BRICK);
  placeVLine(mid + 4, gridSize - 7, 4, TileType.BRICK);
  placeHLine(mid + 3, 6, mid - 5, TileType.BRICK);
  placeBlock(mid + 5, mid - 7, TileType.STEEL);
  placeVLine(mid + 5, gridSize - 7, mid - 7, TileType.BRICK);
  // Quadrant 3 Mud Trench
  placeBlock(gridSize - 10, 8, TileType.MUD);

  // Quadrant 4 (Bottom-Right)
  placeHLine(gridSize - 6, mid + 4, gridSize - 7, TileType.BRICK);
  placeVLine(mid + 4, gridSize - 7, gridSize - 6, TileType.BRICK);
  placeHLine(mid + 3, mid + 4, gridSize - 7, TileType.BRICK);
  placeBlock(mid + 5, mid + 5, TileType.STEEL);
  placeVLine(mid + 5, gridSize - 7, mid + 5, TileType.BRICK);
  // Quadrant 4 Mud Trench
  placeBlock(gridSize - 10, gridSize - 10, TileType.MUD);

  // --- 3. Fortified Bunkers around all 8 Spawn Zones ---
  // Guarantees spawn pockets are free, with adjacent cover shielding against spawn-campers
  placeBlock(gridSize - 5, 4, TileType.BRICK);
  placeBlock(gridSize - 7, 2, TileType.STEEL);

  placeBlock(3, gridSize - 6, TileType.BRICK);
  placeBlock(5, gridSize - 4, TileType.STEEL);

  placeBlock(gridSize - 5, gridSize - 6, TileType.BRICK);
  placeBlock(gridSize - 7, gridSize - 4, TileType.STEEL);

  placeBlock(3, 4, TileType.BRICK);
  placeBlock(5, 2, TileType.STEEL);

  placeBlock(4, mid - 3, TileType.BRICK);
  placeBlock(4, mid + 2, TileType.BRICK);

  placeBlock(gridSize - 6, mid - 3, TileType.BRICK);
  placeBlock(gridSize - 6, mid + 2, TileType.BRICK);

  placeBlock(mid - 3, 4, TileType.BRICK);
  placeBlock(mid + 2, 4, TileType.BRICK);

  placeBlock(mid - 3, gridSize - 6, TileType.BRICK);
  placeBlock(mid + 2, gridSize - 6, TileType.BRICK);

  // Clear 4x4 area around each of the 8 spawns so tanks never touch solids at spawn
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

export function getPresetMaps(gridSize: number = 26): Record<string, StageMap> {
  return {
    stage1: {
      name: 'Stage 1 Default',
      grid: createStage1(gridSize),
    },
    ironFortress: {
      name: 'Iron Fortress',
      grid: createIronFortress(gridSize),
    },
    riverCrossing: {
      name: 'River Crossing',
      grid: createRiverCrossing(gridSize),
    },
    tacticalMaze: {
      name: 'Tactical Maze',
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
  mode?: string
): StageMap {
  const gridSize = getGridSizeForPreset(preset);
  if (mode === 'ffa') {
    return {
      name: `Tactical Maze Arena (${MAP_SIZE_CONFIGS[preset]?.name || 'Expanded'})`,
      grid: createTacticalMaze(gridSize),
    };
  }
  const stageMod = ((stage - 1) % 3) + 1;
  let grid: number[][];
  let name: string;

  if (stageMod === 1) {
    name = `Stage ${stage} (${MAP_SIZE_CONFIGS[preset]?.name || 'Default'})`;
    grid = createStage1(gridSize);
  } else if (stageMod === 2) {
    name = `Stage ${stage} - Iron Fortress (${MAP_SIZE_CONFIGS[preset]?.name || 'Large'})`;
    grid = createIronFortress(gridSize);
  } else {
    name = `Stage ${stage} - River Crossing (${MAP_SIZE_CONFIGS[preset]?.name || 'Giant'})`;
    grid = createRiverCrossing(gridSize);
  }

  if (mode === 'versus' || mode === '2v2') {
    addNorthBaseBunker(grid, gridSize);
  }

  return { name, grid };
}

/**
 * Deep clones a grid of any dimensions
 */
export function cloneGrid(grid: number[][]): number[][] {
  return grid.map((row) => [...row]);
}
