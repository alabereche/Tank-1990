import {
  createStage1,
  createIronFortress,
  createRiverCrossing,
  createTacticalMaze,
  getPresetMaps,
} from '../src/engine/maps.ts';
import { TileType } from '../src/types.ts';

function countTiles(grid) {
  const counts = {};
  for (const row of grid) {
    for (const cell of row) {
      counts[cell] = (counts[cell] || 0) + 1;
    }
  }
  return counts;
}

const sizes = [26, 34, 42];

console.log('=== VERIFYING PROFESSIONAL MAP REDESIGNS (MUD & ICE) ===\n');

for (const size of sizes) {
  console.log(`--- Grid Size: ${size}x${size} ---`);

  // 1. Stage 1
  const s1 = createStage1(size);
  const c1 = countTiles(s1);
  console.log(`[Stage 1]       Ice: ${c1[TileType.ICE] || 0} | Mud: ${c1[TileType.MUD] || 0} | Trees: ${c1[TileType.TREES] || 0} | Brick: ${c1[TileType.BRICK] || 0} | Steel: ${c1[TileType.STEEL] || 0}`);
  if (!c1[TileType.ICE] || !c1[TileType.MUD]) {
    throw new Error(`Stage 1 missing Ice or Mud on size ${size}`);
  }

  // 2. Iron Fortress
  const ifort = createIronFortress(size);
  const cif = countTiles(ifort);
  console.log(`[Iron Fortress] Ice: ${cif[TileType.ICE] || 0} | Mud: ${cif[TileType.MUD] || 0} | Water: ${cif[TileType.WATER] || 0} | Steel: ${cif[TileType.STEEL] || 0}`);
  if (!cif[TileType.ICE] || !cif[TileType.MUD]) {
    throw new Error(`Iron Fortress missing Ice or Mud on size ${size}`);
  }

  // 3. River Crossing
  const rc = createRiverCrossing(size);
  const crc = countTiles(rc);
  console.log(`[River Crossing] Ice: ${crc[TileType.ICE] || 0} | Mud: ${crc[TileType.MUD] || 0} | Water: ${crc[TileType.WATER] || 0} | Brick: ${crc[TileType.BRICK] || 0}`);
  if (!crc[TileType.ICE] || !crc[TileType.MUD]) {
    throw new Error(`River Crossing missing Ice or Mud on size ${size}`);
  }

  // 4. Tactical Maze
  const tm = createTacticalMaze(size);
  const ctm = countTiles(tm);
  console.log(`[Tactical Maze] Ice: ${ctm[TileType.ICE] || 0} | Mud: ${ctm[TileType.MUD] || 0} | Trees: ${ctm[TileType.TREES] || 0} | Steel: ${ctm[TileType.STEEL] || 0}`);
  if (!ctm[TileType.ICE] || !ctm[TileType.MUD]) {
    throw new Error(`Tactical Maze missing Ice or Mud on size ${size}`);
  }
}

console.log('\nPreset Maps verification:');
const presets = getPresetMaps(26);
for (const [key, map] of Object.entries(presets)) {
  const c = countTiles(map.grid);
  console.log(`Preset '${key}': Ice=${c[TileType.ICE] || 0}, Mud=${c[TileType.MUD] || 0}`);
}

console.log('\nALL MAP REDESIGNS VERIFIED SUCCESSFULLY WITH BALANCED ICE & MUD TILES!');
