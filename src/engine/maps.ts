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
 * NES Battle City Stage 1 Original Map Layout (with dynamic scaling for larger arenas)
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
    // Exact Classic NES Stage 1
    placeVLine(2, 9, 2, TileType.BRICK);
    placeVLine(2, 9, 6, TileType.BRICK);
    placeVLine(2, 6, 10, TileType.BRICK);
    placeVLine(2, 6, 14, TileType.BRICK);
    placeVLine(2, 9, 18, TileType.BRICK);
    placeVLine(2, 9, 22, TileType.BRICK);

    placeBlock(7, 12, TileType.STEEL);

    placeHLine(11, 0, 3, TileType.BRICK);
    placeHLine(11, 6, 9, TileType.BRICK);
    placeHLine(11, 16, 19, TileType.BRICK);
    placeHLine(11, 22, 25, TileType.BRICK);

    placeVLine(13, 14, 0, TileType.STEEL);
    placeVLine(13, 14, 24, TileType.STEEL);

    placeVLine(15, 20, 2, TileType.BRICK);
    placeVLine(15, 20, 6, TileType.BRICK);
    placeVLine(15, 18, 10, TileType.BRICK);
    placeVLine(15, 18, 14, TileType.BRICK);
    placeVLine(15, 20, 18, TileType.BRICK);
    placeVLine(15, 20, 22, TileType.BRICK);

    placeBlock(19, 12, TileType.STEEL);
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

  // Outer Wings & Flank Bastions for larger battlefields
  // Left wing
  placeVLine(4, gridSize - 6, 2, TileType.BRICK);
  placeBlock(Math.floor(gridSize / 2) - 1, 0, TileType.STEEL);
  // Right wing
  placeVLine(4, gridSize - 6, gridSize - 4, TileType.BRICK);
  placeBlock(Math.floor(gridSize / 2) - 1, gridSize - 2, TileType.STEEL);

  // Upper perimeter tactical columns
  placeHLine(2, 4, 8, TileType.BRICK);
  placeHLine(2, gridSize - 9, gridSize - 5, TileType.BRICK);

  // Mid foliage and ice pockets in expanded zones
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
 */
export function createIronFortress(gridSize: number = 26): number[][] {
  const g = createEmptyGrid(gridSize);
  const mid = Math.floor(gridSize / 2);

  // Outer steel battlement teeth
  for (let c = 4; c < gridSize - 4; c += 4) {
    if (c + 1 < gridSize) {
      g[2][c] = TileType.STEEL;
      g[2][c + 1] = TileType.STEEL;
      g[3][c] = TileType.STEEL;
      g[3][c + 1] = TileType.STEEL;
    }
  }

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

  // Tree cover
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

  // Water river spanning across with two bridge crossings
  for (let c = 0; c < gridSize; c++) {
    if ((c >= bridge1Start && c <= bridge1End) || (c >= bridge2Start && c <= bridge2End)) {
      g[riverRow1][c] = TileType.BRICK;
      g[riverRow2][c] = TileType.BRICK;
    } else {
      g[riverRow1][c] = TileType.WATER;
      g[riverRow2][c] = TileType.WATER;
    }
  }

  // Ice zones near water
  for (let c = 2; c <= mid - 2; c++) {
    if (riverRow2 + 1 < gridSize) {
      g[riverRow2 + 1][c] = TileType.ICE;
      g[riverRow2 + 2][c] = TileType.ICE;
    }
  }
  for (let c = mid + 2; c < gridSize - 2; c++) {
    if (riverRow2 + 1 < gridSize) {
      g[riverRow2 + 1][c] = TileType.ICE;
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
export function getStageMapForPresetAndStage(stage: number, preset: MapSizePreset = 'classic'): StageMap {
  const gridSize = getGridSizeForPreset(preset);
  const stageMod = ((stage - 1) % 3) + 1;
  if (stageMod === 1) {
    return {
      name: `Stage ${stage} (${MAP_SIZE_CONFIGS[preset]?.name || 'Default'})`,
      grid: createStage1(gridSize),
    };
  } else if (stageMod === 2) {
    return {
      name: `Stage ${stage} - Iron Fortress (${MAP_SIZE_CONFIGS[preset]?.name || 'Large'})`,
      grid: createIronFortress(gridSize),
    };
  } else {
    return {
      name: `Stage ${stage} - River Crossing (${MAP_SIZE_CONFIGS[preset]?.name || 'Giant'})`,
      grid: createRiverCrossing(gridSize),
    };
  }
}

/**
 * Deep clones a grid of any dimensions
 */
export function cloneGrid(grid: number[][]): number[][] {
  return grid.map((row) => [...row]);
}
