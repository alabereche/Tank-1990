import { soundManager } from '../src/engine/SoundManager.ts';
for (const m of [
  'playShoot', 'playExplosion', 'playHitSteel', 'playHitBrick',
  'playPowerupAppear', 'playPowerupPick', 'playGameOver', 'playStageStart',
  'playPause', 'play1Up', 'playCount', 'playTread', 'stopTread'
]) {
  soundManager[m] = () => {};
}
globalThis.requestAnimationFrame = () => 1;
globalThis.cancelAnimationFrame = () => {};

import { GameEngine } from '../src/engine/GameLoop.ts';
import { TileType, GameState } from '../src/types.ts';
import { createEmptyGrid } from '../src/engine/maps.ts';

function createMockCanvas() {
  return {
    getContext: () => ({
      clearRect: () => {},
      fillRect: () => {},
      beginPath: () => {},
      moveTo: () => {},
      lineTo: () => {},
      stroke: () => {},
      arc: () => {},
      fill: () => {},
      save: () => {},
      restore: () => {},
      scale: () => {},
      translate: () => {},
      drawImage: () => {},
      measureText: () => ({ width: 10 }),
      fillText: () => {},
      strokeRect: () => {},
    }),
  };
}

let passed = 0;
let failed = 0;

function assert(description, condition) {
  if (condition) {
    console.log(`  [PASS] ${description}`);
    passed++;
  } else {
    console.error(`  [FAIL] ${description}`);
    failed++;
  }
}

console.log('--- TEST 1: TileType Enum & Backward Compatibility ---');
assert('TileType.EMPTY is 0', TileType.EMPTY === 0);
assert('TileType.BRICK is 1', TileType.BRICK === 1);
assert('TileType.STEEL is 2', TileType.STEEL === 2);
assert('TileType.WATER is 3', TileType.WATER === 3);
assert('TileType.TREES is 4', TileType.TREES === 4);
assert('TileType.ICE is 5', TileType.ICE === 5);
assert('TileType.BASE is 6 (Untouched!)', TileType.BASE === 6);
assert('TileType.MUD is 7', TileType.MUD === 7);

console.log('\n--- TEST 2: Mud Physics - Speed Reduction & Footprint ---');
const canvas = createMockCanvas();
const gridEmpty = createEmptyGrid(26);
const gridMud = createEmptyGrid(26);

// Fill rows 5 to 15 with Mud
for (let r = 5; r <= 15; r++) {
  for (let c = 5; c <= 15; c++) {
    gridMud[r][c] = TileType.MUD;
  }
}

const makeTestTank = (x, y, speed = 2.0) => ({
  id: 'p1',
  isPlayer: true,
  playerIndex: 1,
  slot: 1,
  type: 'PLAYER',
  x,
  y,
  direction: 'DOWN',
  desiredDirection: null,
  speed,
  moving: false,
  distanceTraveled: 0,
  tier: 0,
  maxHp: 1,
  hp: 1,
  shieldTimer: 0,
  slideFrames: 0,
  shootCooldown: 0,
  bulletSpeed: 4,
});

const tickPlayer = (engine, input) => {
  engine.updateInput(input);
  engine.updatePlayerSlot(1);
};

// Engine on empty ground
const mapEmpty = { name: 'empty', grid: gridEmpty };
const engineEmpty = new GameEngine(canvas, mapEmpty, () => {});
engineEmpty.initGrid(gridEmpty);
engineEmpty.gameState = GameState.PLAYING;
assert('Default playerBaseSpeed is 1.1 (Slow is natural default)', engineEmpty.playerBaseSpeed === 1.1);
engineEmpty.player = makeTestTank(100, 100, 2.0);
const pEmpty = engineEmpty.player;

// Move DOWN for 5 ticks on empty ground
for (let t = 0; t < 5; t++) {
  tickPlayer(engineEmpty, { up: false, down: true, left: false, right: false, fire: false });
}
const distEmpty = pEmpty.y - 100;

// Engine on MUD
const mapMud = { name: 'mud', grid: gridMud };
const engineMud = new GameEngine(canvas, mapMud, () => {});
engineMud.initGrid(gridMud);
engineMud.gameState = GameState.PLAYING;
engineMud.player = makeTestTank(100, 100, 2.0);
const pMud = engineMud.player;

assert('Engine detects player footprint is on MUD', engineMud.isTankOnTileType(pMud, TileType.MUD));

// Move DOWN for 5 ticks on MUD
for (let t = 0; t < 5; t++) {
  tickPlayer(engineMud, { up: false, down: true, left: false, right: false, fire: false });
}
const distMud = pMud.y - 100;

console.log(`    Distance on empty: ${distEmpty.toFixed(2)} px | Distance on mud: ${distMud.toFixed(2)} px`);
assert('Distance on mud is ~58% less than empty ground', distMud < distEmpty * 0.55);
assert('Mud slowdown ratio is approximately 0.42', Math.abs((distMud / distEmpty) - 0.42) < 0.05);

console.log('\n--- TEST 3: Ice Physics - Momentum & Smooth Deceleration ---');
const gridIce = createEmptyGrid(26);
// Fill arena with ICE
for (let r = 2; r <= 22; r++) {
  for (let c = 2; c <= 22; c++) {
    gridIce[r][c] = TileType.ICE;
  }
}

const mapIce = { name: 'ice', grid: gridIce };
const engineIce = new GameEngine(canvas, mapIce, () => {});
engineIce.initGrid(gridIce);
engineIce.gameState = GameState.PLAYING;
engineIce.player = makeTestTank(100, 100, 2.0);
const pIce = engineIce.player;

assert('Engine detects player footprint is on ICE', engineIce.isTankOnTileType(pIce, TileType.ICE));

// 1. Move RIGHT for 3 ticks on ICE
for (let t = 0; t < 3; t++) {
  tickPlayer(engineIce, { up: false, down: false, left: false, right: true, fire: false });
}
assert('Moving on ICE charges slideFrames to 26', pIce.slideFrames === 26);
assert('Slide direction recorded as RIGHT', pIce.slideDirection === 'RIGHT');

// 2. Release controls: Tank should continue sliding with decaying speed!
const startSlideX = pIce.x;
let prevX = pIce.x;
let speeds = [];

for (let frame = 0; frame < 26; frame++) {
  tickPlayer(engineIce, { up: false, down: false, left: false, right: false, fire: false });
  const stepSpeed = pIce.x - prevX;
  speeds.push(stepSpeed);
  prevX = pIce.x;
  if (pIce.slideFrames === 0) break;
}

const totalSlidDist = pIce.x - startSlideX;
console.log(`    Initial slide step speed: ${speeds[0]?.toFixed(2)} px/frame`);
console.log(`    Late slide step speed: ${speeds[speeds.length - 2]?.toFixed(2)} px/frame`);
console.log(`    Total distance slid on ice: ${totalSlidDist.toFixed(2)} px`);

assert('Tank slid forward in direction of momentum after release', totalSlidDist > 10);
assert('First slide step is faster than late slide step (Smooth Deceleration)', speeds[0] > speeds[speeds.length - 2]);
assert('Slide frames eventually reached 0 and tank stopped smoothly', pIce.slideFrames === 0 && !pIce.moving);

console.log('\n--- TEST 4: Mud Instantly Halts Ice Slide ---');
const engineIceMud = new GameEngine(canvas, mapIce, () => {});
engineIceMud.initGrid(gridIce);
engineIceMud.gameState = GameState.PLAYING;
engineIceMud.player = makeTestTank(100, 100, 2.0);
const pIM = engineIceMud.player;

// Charge slide
tickPlayer(engineIceMud, { up: false, down: false, left: false, right: true, fire: false });
assert('Slide charged on ice', pIM.slideFrames === 26);

// Place mud underneath tank
const curR = Math.floor((pIM.y + 16) / 16);
const curC = Math.floor((pIM.x + 16) / 16);
engineIceMud.grid[curR][curC].type = TileType.MUD;

// Release controls: Mud must swallow slide momentum immediately
tickPlayer(engineIceMud, { up: false, down: false, left: false, right: false, fire: false });
assert('Mud immediately absorbed slide momentum', pIM.slideFrames === 0 && !pIM.moving);

console.log('\n--- TEST 5: Bullet Traversal Over Mud ---');
const engineBullet = new GameEngine(canvas, mapMud, () => {});
engineBullet.initGrid(gridMud);
engineBullet.gameState = GameState.PLAYING;
engineBullet.player = makeTestTank(100, 100, 2.0);
const pBullet = engineBullet.player;
pBullet.direction = 'RIGHT';

// Fire bullet over MUD
pBullet.shootCooldown = 0;
tickPlayer(engineBullet, { up: false, down: false, left: false, right: false, fire: true });
engineBullet.prevPlayerFire.set(1, false);

assert('Bullet was spawned', engineBullet.bullets.length > 0);
const bullet = engineBullet.bullets[0];
const startBulletX = bullet.x;

// Step bullet across mud tiles
for (let t = 0; t < 10; t++) {
  engineBullet.updateBullets();
}

assert('Bullet passed through mud without colliding or exploding', bullet.x > startBulletX + 30);

console.log(`\n========================================`);
console.log(`TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
console.log(`========================================`);

if (failed > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
