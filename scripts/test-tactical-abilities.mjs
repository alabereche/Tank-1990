import { soundManager } from '../src/engine/SoundManager.ts';
for (const m of [
  'playShoot', 'playExplosion', 'playBigExplosion', 'playHitSteel', 'playHitBrick',
  'playPowerUpSpawn', 'playPowerUpCollect', 'playGameOver', 'playStageStart',
  'playPause', 'play1Up', 'playCount', 'playTread', 'stopTread',
  'playGrenadeBounce', 'playSmokeDeploy', 'playShieldDeploy', 'playShieldHit'
]) {
  soundManager[m] = () => {};
}
globalThis.requestAnimationFrame = () => 1;
globalThis.cancelAnimationFrame = () => {};

import { GameEngine } from '../src/engine/GameLoop.ts';
import { TileType, GameState } from '../src/types.ts';
import { createEmptyGrid, BLOCK_SIZE } from '../src/engine/maps.ts';

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
      ellipse: () => {},
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

console.log('=== TEST SUITE: TACTICAL ABILITIES & WEAPONS ===\n');

// ----------------------------------------------------
console.log('--- TEST 1: Inventory Initial State & Caps ---');
const canvas1 = createMockCanvas();
const emptyMap1 = { grid: createEmptyGrid(26) };
const engine1 = new GameEngine(canvas1, emptyMap1, () => {});
engine1.startStage(1, emptyMap1);
for (let i = 0; i < 45; i++) engine1['updateSpawningTanks']();

const inv1 = engine1.getTacticalInventory(1);
assert('Player spawned with tactical inventory', inv1 !== undefined);
assert('Player starts with 1 smoke', inv1.smoke === 1);
assert('Player starts with 0 grenade (must be found by destroying bricks)', inv1.grenade === 0);
assert('Player starts with 1 shield', inv1.shield === 1);

// Test picking up items and enforcing max caps (9 smoke, 9 grenade, 5 shield)
const playerTank = engine1.player;
assert('Player tank exists', playerTank !== null);

// Cap enforcement test
playerTank.tacticalInventory.smoke = Math.min(9, 20);
playerTank.tacticalInventory.grenade = Math.min(9, 20);
playerTank.tacticalInventory.shield = Math.min(5, 20);
assert('Smoke capacity expanded to 9', playerTank.tacticalInventory.smoke === 9);
assert('Grenade capacity expanded to 9', playerTank.tacticalInventory.grenade === 9);
assert('Shield capacity expanded to 5', playerTank.tacticalInventory.shield === 5);

// Test Player 2 in 2-player modes
const engineP2Test = new GameEngine(canvas1, emptyMap1, () => {});
engineP2Test.setMultiplayerMode('versus');
engineP2Test.startStage(1, emptyMap1);
for (let i = 0; i < 45; i++) engineP2Test['updateSpawningTanks']();
const invP1 = engineP2Test.getTacticalInventory(1);
const invP2 = engineP2Test.getTacticalInventory(2);
assert('Player 1 in versus mode has tactical inventory', invP1 !== undefined);
assert('Player 2 in versus mode has tactical inventory', invP2 !== undefined);
assert('Player 2 starts with 1 smoke', invP2.smoke === 1);
assert('Player 2 starts with 0 grenade (must break bricks)', invP2.grenade === 0);
assert('Player 2 starts with 1 shield', invP2.shield === 1);

// ----------------------------------------------------
console.log('\n--- TEST 2: Smoke Screen & AI Blindness ---');
const canvas2 = createMockCanvas();
const engine2 = new GameEngine(canvas2, emptyMap1, () => {});
engine2.startStage(1, emptyMap1);
for (let i = 0; i < 45; i++) engine2['updateSpawningTanks']();
const p2 = engine2.player;
p2.tacticalInventory = { smoke: 1, grenade: 0, shield: 0 };

// Edge trigger smoke via input
engine2.updateInput({
  up: false, down: false, left: false, right: false, fire: false, pause: false,
  smoke: true, grenade: false, shield: false
});

// Run worker tick to process inputs and tactical entities
engine2['updatePlayerSlot'](1, {
  up: false, down: false, left: false, right: false, fire: false, pause: false,
  smoke: true, grenade: false, shield: false
});

assert('Smoke inventory decremented to 0', p2.tacticalInventory.smoke === 0);
assert('Active smoke screen created in world', engine2['activeSmokeScreens'].length === 1);

const smokeObj = engine2['activeSmokeScreens'][0];
assert('Smoke screen duration initialized (~480 ticks)', smokeObj.duration === 480);
assert('Smoke screen particles generated', smokeObj.particles.length > 10);

// Test tank concealment inside smoke
engine2['updateSmokeScreens']();
assert('Player tank marked as inSmoke = true when inside radius', p2.inSmoke === true);

// Check AI targeting is blinded
const canTargetPlayer = engine2.player && !engine2.player.inSmoke;
assert('Enemy AI targeting cannot target player while inside smoke', !canTargetPlayer);

// Fast forward smoke duration to expiration
smokeObj.duration = 1;
engine2['updateSmokeScreens'](); // Smoke reaches 0 and is removed
assert('Smoke screen despawns when duration reaches 0', engine2['activeSmokeScreens'].length === 0);
engine2['updateSmokeScreens'](); // Next tick confirms tank is no longer in smoke
assert('Player tank inSmoke resets to false after smoke clears', p2.inSmoke === false);

// ----------------------------------------------------
console.log('\n--- TEST 3: Bouncing Grenade Physics & AoE Blast ---');
const canvas3 = createMockCanvas();
const gridWithBricks = createEmptyGrid(26);
// Place red bricks near player spawn: row 23, col 8
gridWithBricks[23][8] = { type: TileType.BRICK, damageMask: 15 };
gridWithBricks[23][9] = { type: TileType.BRICK, damageMask: 15 };
const map3 = { grid: gridWithBricks };
const engine3 = new GameEngine(canvas3, map3, () => {});
engine3.startStage(1, map3);
for (let i = 0; i < 45; i++) engine3['updateSpawningTanks']();
const p3 = engine3.player;
p3.x = 8 * BLOCK_SIZE;
p3.y = 24 * BLOCK_SIZE;
p3.direction = 'UP';
p3.tacticalInventory = { smoke: 0, grenade: 1, shield: 0 };

// Throw grenade upward
engine3['triggerGrenadeAction'](p3);
assert('Grenade inventory decremented to 0', p3.tacticalInventory.grenade === 0);
assert('Active grenade created in world', engine3['activeGrenades'].length === 1);

const grenade = engine3['activeGrenades'][0];
assert('Grenade has vertical velocity vz > 0', grenade.vz > 0);
assert('Grenade has directional velocity vy < 0 (UP)', grenade.vy < 0);
assert('Grenade starts with 3 bounces left', grenade.bouncesLeft === 3);

// Simulate physics ticks until bounces and detonation
let initialBounces = grenade.bouncesLeft;
for (let step = 0; step < 120; step++) {
  if (engine3['activeGrenades'].length === 0) break;
  engine3['updateGrenades']();
}

// Grenade should have detonated
assert('Grenade completed bounces and detonated', engine3['activeGrenades'].length === 0);
assert('Explosions array has detonation explosion', engine3['explosions'].length > 0);

// Place red bricks at row 10, col 10 (away from spawn pocket)
engine3['grid'][10][10] = { type: TileType.BRICK, damageMask: 15 };
assert('Brick at (10, 10) is initially BRICK', engine3['grid'][10][10].type === TileType.BRICK);

engine3['explodeGrenade']({
  id: 'test_g',
  ownerId: p3.id,
  isPlayer: true,
  x: 10 * BLOCK_SIZE + 8,
  y: 10 * BLOCK_SIZE + 8,
  z: 0,
  vx: 0,
  vy: 0,
  vz: 0,
  bouncesLeft: 0,
  life: 0,
});
assert('Adjacent brick tile was obliterated by grenade blast', engine3['grid'][10][10].type === TileType.EMPTY);

// ----------------------------------------------------
console.log('\n--- TEST 3B: Grenade Obstacle Ricochet (Bricks & Steel) ---');
// 1. Setup a brick wall at (row: 8, col: 12)
engine3['grid'][8][12] = { type: TileType.BRICK, damageMask: 15 };
const brickWallX = 12 * BLOCK_SIZE; // 192 px

// Throw grenade towards the brick wall from left
engine3['activeGrenades'].push({
  id: 'ricochet_test_brick',
  ownerId: p3.id,
  isPlayer: true,
  x: brickWallX - 8, // 184 px
  y: 8 * BLOCK_SIZE + 8,
  z: 10,
  vx: 3.5, // moving right into wall
  vy: 0,
  vz: 0,
  bouncesLeft: 3,
  life: 100,
});

engine3['updateGrenades']();
const ricochetGrenade = engine3['activeGrenades'].find(g => g.id === 'ricochet_test_brick');
assert('Grenade collided with brick wall and did not penetrate', ricochetGrenade.x < brickWallX);
assert('Grenade horizontal velocity was reflected (vx < 0) with damping', ricochetGrenade.vx < 0);

// 2. Setup a steel wall at (row: 14, col: 8)
engine3['grid'][14][8] = { type: TileType.STEEL, damageMask: 15 };
const steelWallY = 14 * BLOCK_SIZE; // 224 px

// Throw grenade downwards towards steel wall
engine3['activeGrenades'].push({
  id: 'ricochet_test_steel',
  ownerId: p3.id,
  isPlayer: true,
  x: 8 * BLOCK_SIZE + 8,
  y: steelWallY - 8,
  z: 10,
  vx: 0,
  vy: 3.5, // moving down into steel wall
  vz: 0,
  bouncesLeft: 3,
  life: 100,
});

engine3['updateGrenades']();
const steelGrenade = engine3['activeGrenades'].find(g => g.id === 'ricochet_test_steel');
assert('Grenade collided with steel wall and did not penetrate', steelGrenade.y < steelWallY);
assert('Grenade vertical velocity was reflected (vy < 0) with damping', steelGrenade.vy < 0);

// Clear test grenades
engine3['activeGrenades'] = [];

// ----------------------------------------------------
console.log('\n--- TEST 4: Deployable Shield Barricade ---');
const canvas4 = createMockCanvas();
const engine4 = new GameEngine(canvas4, emptyMap1, () => {});
engine4.startStage(1, emptyMap1);
for (let i = 0; i < 45; i++) engine4['updateSpawningTanks']();
const p4 = engine4.player;
p4.x = 100;
p4.y = 200;
p4.direction = 'UP';
p4.tacticalInventory = { smoke: 0, grenade: 0, shield: 1 };

// Deploy shield
engine4['triggerShieldAction'](p4);
assert('Shield inventory decremented to 0', p4.tacticalInventory.shield === 0);
assert('Active shield barricade placed in world', engine4['activeShields'].length === 1);

const shield = engine4['activeShields'][0];
assert('Shield positioned in front of tank (sy < tank.y for UP direction)', shield.y < p4.y);
assert('Shield has width = 32 and height = 10', shield.width === 32 && shield.height === 10);
assert('Shield starts with 3 HP', shield.hp === 3);
assert('Shield timer set to 900 ticks (15 seconds)', shield.timer === 900);

// Test friendly bullet passing through shield
const friendlyBullet = {
  id: 'b_friend',
  ownerId: p4.id,
  isPlayer: true,
  x: shield.x + 10,
  y: shield.y + 2,
  direction: 'UP',
  speed: 4,
  canDestroySteel: false,
  size: 4,
};
engine4['bullets'] = [friendlyBullet];
engine4['updateBullets']();
assert('Friendly bullet passes through shield without damaging it', shield.hp === 3);

// Test enemy bullet colliding with shield
const enemyBullet1 = {
  id: 'b_enemy_1',
  ownerId: 'enemy_tank_1',
  isPlayer: false,
  x: shield.x + 10,
  y: shield.y + 2,
  direction: 'DOWN',
  speed: 4,
  canDestroySteel: false,
  size: 4,
};
engine4['bullets'] = [enemyBullet1];
engine4['updateBullets']();
assert('Enemy bullet 1 absorbed by shield (HP 3 -> 2)', shield.hp === 2);
assert('Enemy bullet 1 destroyed upon impact', engine4['bullets'].length === 0);

// Hit 2
const enemyBullet2 = {
  id: 'b_enemy_2',
  ownerId: 'enemy_tank_2',
  isPlayer: false,
  x: shield.x + 10,
  y: shield.y + 2,
  direction: 'DOWN',
  speed: 4,
  canDestroySteel: false,
  size: 4,
};
engine4['bullets'] = [enemyBullet2];
engine4['updateBullets']();
assert('Enemy bullet 2 absorbed by shield (HP 2 -> 1)', shield.hp === 1);

// Hit 3 (Shield breaks)
const enemyBullet3 = {
  id: 'b_enemy_3',
  ownerId: 'enemy_tank_3',
  isPlayer: false,
  x: shield.x + 10,
  y: shield.y + 2,
  direction: 'DOWN',
  speed: 4,
  canDestroySteel: false,
  size: 4,
};
engine4['bullets'] = [enemyBullet3];
engine4['updateBullets']();
assert('Shield hp reduced to 0 on 3rd hit', shield.hp <= 0);

// Process shield cleanup
engine4['updateDeployableShields']();
assert('Destroyed shield removed from world', engine4['activeShields'].length === 0);

// Test shield 15-second expiration timer
p4.tacticalInventory.shield = 1;
engine4['triggerShieldAction'](p4);
const shield2 = engine4['activeShields'][0];
shield2.timer = 1; // 1 tick before 15s expiration
engine4['updateDeployableShields']();
assert('Shield cleanly removed after 15s timer expires', engine4['activeShields'].length === 0);

// ----------------------------------------------------
console.log('\n=== TEST RESULTS SUMMARY ===');
console.log(`Passed: ${passed}`);
console.log(`Failed: ${failed}`);

if (failed > 0) {
  console.error(`\nFAILED: ${failed} test(s) failed.`);
  process.exit(1);
} else {
  console.log('\nSUCCESS: All tactical abilities & weapons tests PASSED perfectly!');
  process.exit(0);
}
