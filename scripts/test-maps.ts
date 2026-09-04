import { TileType } from '../src/types';

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

export function addNorthBaseBunker(grid: number[][], gridSize: number): void {
  const baseCol = Math.floor(gridSize / 2) - 1;

  grid[0][baseCol] = TileType.BASE;
  grid[0][baseCol + 1] = TileType.BASE;
  grid[1][baseCol] = TileType.BASE;
  grid[1][baseCol + 1] = TileType.BASE;

  for (let c = baseCol - 1; c <= baseCol + 2; c++) {
    if (c >= 0 && c < gridSize && 2 < gridSize) {
      grid[2][c] = TileType.BRICK;
    }
  }
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
 * Shared building helper to maintain safe spawn and base zones
 */
function createBuilder(gridSize: number) {
  const g = createEmptyGrid(gridSize);
  const mid = Math.floor(gridSize / 2);

  // Critical protected zones: Base bunkers and player/enemy spawns
  const isProtected = (r: number, c: number): boolean => {
    // South Base zone (Eagle + Bunker ring)
    if (r >= gridSize - 3 && c >= mid - 2 && c <= mid + 2) return true;
    // North Base zone (Dual Base mode reserve)
    if (r <= 2 && c >= mid - 2 && c <= mid + 2) return true;
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

// Stage 1: Classic Citadel (NES Tribute + Tactical Ice Avenues + Mud Choke Points)
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

  placeBlock(7 + offset, 12 + offset, TileType.STEEL);

  // Horizontal Middle Brick Gateways
  placeHLine(11 + offset, offset, 3 + offset, TileType.BRICK);
  placeHLine(11 + offset, 6 + offset, 9 + offset, TileType.BRICK);
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

  placeBlock(19 + offset, 12 + offset, TileType.STEEL);

  // Tactical ICE flank corridors
  placeVLine(4, gridSize - 6, 0, TileType.ICE);
  placeVLine(4, gridSize - 6, gridSize - 2, TileType.ICE);

  // Ambush Foliage
  placeVLine(7 + offset, 9 + offset, 4 + offset, TileType.TREES);
  placeVLine(7 + offset, 9 + offset, 20 + offset, TileType.TREES);

  // Midfield Mud Choke Points
  placeBlock(13 + offset, 8 + offset, TileType.MUD);
  placeBlock(13 + offset, 16 + offset, TileType.MUD);

  return b.g;
}

// Stage 2: Iron Fortress (Industrial Bastion with Steel Cross & Water Hazard Moat)
export function createIronFortress(gridSize: number = 26): number[][] {
  const b = createBuilder(gridSize);
  const { mid, placeBlock, placeVLine, placeHLine } = b;

  // Outer steel battlement teeth
  for (let c = 4; c < gridSize - 4; c += 4) {
    placeBlock(2, c, TileType.STEEL);
  }

  // Lateral ICE patrol slipway behind steel battlements
  placeHLine(4, 4, gridSize - 6, TileType.ICE);

  // Central Steel Cross
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

  // Brick defensive ramparts
  placeVLine(12, gridSize - 6, 4, TileType.BRICK);
  placeVLine(12, gridSize - 6, gridSize - 6, TileType.BRICK);

  // Concealment trees near south approach
  placeBlock(gridSize - 8, mid - 5, TileType.TREES);
  placeBlock(gridSize - 8, mid + 4, TileType.TREES);

  return b.g;
}

// Stage 3: Twin Rivers (Double River Crossing + Frozen Ice Bridge + Mud Shallows)
export function createRiverCrossing(gridSize: number = 26): number[][] {
  const b = createBuilder(gridSize);
  const { mid, placeBlock } = b;

  const r1 = Math.floor(gridSize * 0.32);
  const r2 = Math.floor(gridSize * 0.62);

  const bridgeLeft = Math.floor(gridSize * 0.2);
  const bridgeRight = Math.floor(gridSize * 0.72);

  // River 1 & River 2
  for (let r of [r1, r2]) {
    for (let c = 0; c < gridSize; c++) {
      if ((c >= bridgeLeft && c <= bridgeLeft + 1) || (c >= bridgeRight && c <= bridgeRight + 1)) {
        b.placeCell(r, c, TileType.BRICK);
        b.placeCell(r + 1, c, TileType.BRICK);
      } else if (c >= mid - 1 && c <= mid) {
        // Frozen Ice bridge in the middle
        b.placeCell(r, c, TileType.ICE);
        b.placeCell(r + 1, c, TileType.ICE);
      } else {
        b.placeCell(r, c, TileType.WATER);
        b.placeCell(r + 1, c, TileType.WATER);
      }
    }
    // Mud banks along the rivers
    for (let c = 2; c < gridSize - 2; c++) {
      if ((c < bridgeLeft - 1 || c > bridgeRight + 2) && (c < mid - 2 || c > mid + 1)) {
        if (Math.random) {
          b.placeCell(r - 1, c, TileType.MUD);
          b.placeCell(r + 2, c, TileType.MUD);
        }
      }
    }
  }

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

// Stage 4: Amazon Rainforest (Dense Jungle Warfare + Stealth Canopies + Ancient Temple)
export function createAmazonRainforest(gridSize: number = 26): number[][] {
  const b = createBuilder(gridSize);
  const { mid, placeBlock, placeVLine, placeHLine, placeRect } = b;

  // 1. Vast dense tree canopies covering quadrants
  const qSize = Math.floor(gridSize * 0.35);
  placeRect(4, 4 + qSize, 2, 2 + qSize, TileType.TREES);
  placeRect(4, 4 + qSize, gridSize - 4 - qSize, gridSize - 4, TileType.TREES);
  placeRect(gridSize - 6 - qSize, gridSize - 6, 2, 2 + qSize, TileType.TREES);
  placeRect(gridSize - 6 - qSize, gridSize - 6, gridSize - 4 - qSize, gridSize - 4, TileType.TREES);

  // 2. Central Sunken Temple Ruins (Brick walls + Steel Totems)
  // Temple outer brick perimeter
  placeHLine(mid - 4, mid - 4, mid + 3, TileType.BRICK);
  placeHLine(mid + 3, mid - 4, mid + 3, TileType.BRICK);
  placeVLine(mid - 4, mid + 3, mid - 4, TileType.BRICK);
  placeVLine(mid - 4, mid + 3, mid + 3, TileType.BRICK);

  // 4 Steel corner totems
  placeBlock(mid - 4, mid - 4, TileType.STEEL);
  placeBlock(mid - 4, mid + 3, TileType.STEEL);
  placeBlock(mid + 3, mid - 4, TileType.STEEL);
  placeBlock(mid + 3, mid + 3, TileType.STEEL);

  // Temple courtyard mud pit (rainwater pool)
  placeRect(mid - 1, mid, mid - 2, mid + 1, TileType.MUD);

  // 3. Serpentine mud trails through jungle
  placeVLine(6, gridSize - 8, mid - 6, TileType.MUD);
  placeVLine(6, gridSize - 8, mid + 5, TileType.MUD);

  // Clear corridors through jungle for tank movement
  placeHLine(mid, 0, 3, TileType.EMPTY);
  placeHLine(mid, gridSize - 4, gridSize - 1, TileType.EMPTY);

  return b.g;
}

// Stage 5: Glacial Archipelago (Vast Ice Fields + Water Lagoons + 4 Fortified Outposts)
export function createGlacialArchipelago(gridSize: number = 26): number[][] {
  const b = createBuilder(gridSize);
  const { mid, placeBlock, placeRect, placeVLine, placeHLine } = b;

  // 1. Broad lateral and diagonal Ice fields (>35% coverage)
  placeRect(3, gridSize - 5, 0, 2, TileType.ICE);
  placeRect(3, gridSize - 5, gridSize - 3, gridSize - 1, TileType.ICE);
  placeRect(mid - 2, mid + 1, 0, gridSize - 1, TileType.ICE);

  // Central ice highway
  placeRect(3, gridSize - 5, mid - 1, mid, TileType.ICE);

  // 2. Deep water lagoons separating sectors
  const wR1 = Math.floor(gridSize * 0.28);
  const wR2 = Math.floor(gridSize * 0.68);
  placeRect(wR1, wR1 + 1, 4, mid - 3, TileType.WATER);
  placeRect(wR1, wR1 + 1, mid + 2, gridSize - 5, TileType.WATER);
  placeRect(wR2, wR2 + 1, 4, mid - 3, TileType.WATER);
  placeRect(wR2, wR2 + 1, mid + 2, gridSize - 5, TileType.WATER);

  // 3. Four Fortified Outpost Islands (NW, NE, SW, SE)
  // Island 1 (NW)
  placeBlock(5, 5, TileType.BRICK);
  placeBlock(5, 7, TileType.STEEL);
  placeBlock(7, 5, TileType.BRICK);

  // Island 2 (NE)
  placeBlock(5, gridSize - 9, TileType.STEEL);
  placeBlock(5, gridSize - 7, TileType.BRICK);
  placeBlock(7, gridSize - 7, TileType.BRICK);

  // Island 3 (SW)
  placeBlock(gridSize - 9, 5, TileType.BRICK);
  placeBlock(gridSize - 9, 7, TileType.STEEL);
  placeBlock(gridSize - 7, 5, TileType.BRICK);

  // Island 4 (SE)
  placeBlock(gridSize - 9, gridSize - 9, TileType.STEEL);
  placeBlock(gridSize - 9, gridSize - 7, TileType.BRICK);
  placeBlock(gridSize - 7, gridSize - 7, TileType.BRICK);

  return b.g;
}

// Stage 6: The Great Labyrinth (Geometric 90° Maze with Steel Pillars & Breakable Shortcuts)
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

  // Center Chamber with Foliage Ambush & Ice Center
  b.placeCell(mid - 1, mid - 1, TileType.ICE);
  b.placeCell(mid - 1, mid, TileType.ICE);
  b.placeCell(mid, mid - 1, TileType.ICE);
  b.placeCell(mid, mid, TileType.ICE);

  placeBlock(mid - 3, mid - 1, TileType.TREES);
  placeBlock(mid + 2, mid - 1, TileType.TREES);

  // Mud traps in dead ends
  placeBlock(6, 6, TileType.MUD);
  placeBlock(6, gridSize - 8, TileType.MUD);
  placeBlock(gridSize - 8, 6, TileType.MUD);
  placeBlock(gridSize - 8, gridSize - 8, TileType.MUD);

  return b.g;
}

// Stage 7: Muddy Badlands (Quagmire Canyons + Dry Ridge Mesas + Steel Watchtowers)
export function createMuddyBadlands(gridSize: number = 26): number[][] {
  const b = createBuilder(gridSize);
  const { mid, placeBlock, placeVLine, placeHLine, placeRect } = b;

  // 1. Three deep vertical Mud Canyons (crawling 42% speed)
  const c1 = Math.floor(gridSize * 0.22);
  const c2 = mid - 1;
  const c3 = Math.floor(gridSize * 0.72);

  placeVLine(3, gridSize - 5, c1, TileType.MUD);
  placeVLine(3, gridSize - 5, c3, TileType.MUD);
  // Center mud canyon (interrupted near base)
  placeVLine(4, gridSize - 6, c2, TileType.MUD);

  // 2. High-Ground Brick Mesas (Fortified high dry ridges)
  placeVLine(5, 11, c1 - 3, TileType.BRICK);
  placeVLine(14, gridSize - 7, c1 - 3, TileType.BRICK);

  placeVLine(5, 11, c3 + 3, TileType.BRICK);
  placeVLine(14, gridSize - 7, c3 + 3, TileType.BRICK);

  // 3. Steel Watchtower Pillars on high ground
  placeBlock(8, c1 - 3, TileType.STEEL);
  placeBlock(17, c1 - 3, TileType.STEEL);
  placeBlock(8, c3 + 3, TileType.STEEL);
  placeBlock(17, c3 + 3, TileType.STEEL);

  // 4. Outer border Ice washouts (slick escape runways)
  placeVLine(4, gridSize - 5, 0, TileType.ICE);
  placeVLine(4, gridSize - 5, gridSize - 2, TileType.ICE);

  // Scrub bushes on canyon rims
  placeBlock(12, c1, TileType.TREES);
  placeBlock(12, c3, TileType.TREES);

  return b.g;
}

// Stage 8: Urban Gridlock (City Streets, 3x3 Blocks, Asphalt Ice Avenues & Park Fountain)
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

  // City Building Blocks (Brick buildings with steel vault corners)
  const buildBlock = (topR: number, leftC: number, w: number, h: number) => {
    placeRect(topR, topR + h - 1, leftC, leftC + w - 1, TileType.BRICK);
    placeBlock(topR, leftC, TileType.STEEL);
  };

  // Top-Left Block
  buildBlock(4, 2, street1 - 3, street1 - 5);
  // Top-Right Block
  buildBlock(4, street2 + 2, gridSize - street2 - 4, street1 - 5);
  // Bottom-Left Block
  buildBlock(street2 + 2, 2, street1 - 3, gridSize - street2 - 6);
  // Bottom-Right Block
  buildBlock(street2 + 2, street2 + 2, gridSize - street2 - 4, gridSize - street2 - 6);

  // Central City Park Plaza (Water fountain in center + tree park surrounding)
  placeRect(street1 + 2, street2 - 2, street1 + 2, street2 - 2, TileType.TREES);
  placeBlock(mid - 1, mid - 1, TileType.WATER);

  // Mud on side alleys (construction zones)
  placeBlock(street1 - 1, 0, TileType.MUD);
  placeBlock(street2 + 2, gridSize - 2, TileType.MUD);

  return b.g;
}

// Stage 9: Bunker Complex (Underground Bastion + 4 Cardinal Pillboxes + Water Security Moats)
export function createBunkerComplex(gridSize: number = 26): number[][] {
  const b = createBuilder(gridSize);
  const { mid, placeBlock, placeVLine, placeHLine, placeRect } = b;

  // 1. Central Diamond Bastion
  // 4 Cardinal Steel Pillboxes
  placeBlock(mid - 6, mid - 1, TileType.STEEL); // North Pillbox
  placeBlock(mid + 4, mid - 1, TileType.STEEL); // South Pillbox
  placeBlock(mid - 1, mid - 6, TileType.STEEL); // West Pillbox
  placeBlock(mid - 1, mid + 4, TileType.STEEL); // East Pillbox

  // Water Security Moats surrounding Pillboxes
  placeVLine(mid - 5, mid + 3, mid - 4, TileType.WATER);
  placeVLine(mid - 5, mid + 3, mid + 3, TileType.WATER);
  placeHLine(mid - 4, mid - 3, mid + 2, TileType.WATER);
  placeHLine(mid + 3, mid - 3, mid + 2, TileType.WATER);

  // 2. Thick Brick Blast Walls
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

// Stage 10: Death Valley Crater / The Caldera (Concentric Volcanic Rings + Central Steel Throne)
export function createDeathValley(gridSize: number = 26): number[][] {
  const b = createBuilder(gridSize);
  const { mid, placeBlock, placeRect, placeVLine, placeHLine } = b;

  // 1. Outer Ring: Ash & Quagmire Mud Swamp (Perimeter border)
  placeHLine(3, 4, gridSize - 5, TileType.MUD);
  placeHLine(gridSize - 5, 4, mid - 4, TileType.MUD);
  placeHLine(gridSize - 5, mid + 3, gridSize - 5, TileType.MUD);
  placeVLine(3, gridSize - 5, 3, TileType.MUD);
  placeVLine(3, gridSize - 5, gridSize - 5, TileType.MUD);

  // 2. Middle Ring: Segmented Brick Ramparts with 4 Diagonal Entry Avenues
  const rOffset = Math.floor(gridSize * 0.28);
  // Top segment
  placeHLine(mid - rOffset, mid - rOffset + 2, mid + rOffset - 3, TileType.BRICK);
  // Bottom segment
  placeHLine(mid + rOffset - 1, mid - rOffset + 2, mid + rOffset - 3, TileType.BRICK);
  // Left segment
  placeVLine(mid - rOffset + 2, mid + rOffset - 3, mid - rOffset, TileType.BRICK);
  // Right segment
  placeVLine(mid - rOffset + 2, mid + rOffset - 3, mid + rOffset - 1, TileType.BRICK);

  // 3. Inner Circular Ring Moat of Water
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

// Test runner for all 10 stages
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

let allPassed = true;

for (const size of sizes) {
  console.log(`\n=== Testing Grid Size ${size}x${size} ===`);
  const mid = Math.floor(size / 2);
  const baseR = size - 2;
  const baseC = mid - 1;

  for (const gen of generators) {
    const grid = gen.fn(size);

    // Verify grid shape
    if (grid.length !== size || !grid.every(r => r.length === size)) {
      console.error(`FAILED: ${gen.name} ${size}x${size} invalid grid dimensions!`);
      allPassed = false;
    }

    // Verify Base Eagle intact
    if (grid[baseR][baseC] !== TileType.BASE || grid[baseR][baseC+1] !== TileType.BASE ||
        grid[baseR+1][baseC] !== TileType.BASE || grid[baseR+1][baseC+1] !== TileType.BASE) {
      console.error(`FAILED: ${gen.name} ${size}x${size} Base Eagle broken!`);
      allPassed = false;
    }

    // Verify P1 and P2 spawns are not blocked by solid blocks
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

    // Test dual-base addition
    addNorthBaseBunker(grid, size);
    if (grid[0][baseC] !== TileType.BASE || grid[1][baseC+1] !== TileType.BASE) {
      console.error(`FAILED: ${gen.name} ${size}x${size} North Base broken!`);
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
  console.log("\n>>> ALL 10 STAGES PASSED VALIDATION ACROSS 26x26, 34x34, and 42x42! <<<");
} else {
  console.error("\n>>> SOME STAGE CHECKS FAILED! <<<");
  process.exit(1);
}
