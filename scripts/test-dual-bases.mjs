/**
 * 1v1 ALTERNATING EAGLE + 2v2 DUAL BASE test suite.
 * 1v1: ONE eagle per round — odd rounds P1 defends the south eagle, even
 * rounds P2 defends the north eagle. The attacker's side is stripped clean.
 * Verifies: parity layout, side stripping (real grid), friendly ricochet,
 * attacker-destroys-eagle round wins, 2v2 dual bases, snapshot sync, SP compat.
 * Run: npx esbuild scripts/test-dual-bases.mjs --bundle --platform=node --format=cjs --outfile=scripts/.db.cjs && node scripts/.db.cjs
 */

import { soundManager } from '../src/engine/SoundManager.ts';
for (const m of [
  'playShoot', 'playExplosion', 'playBigExplosion', 'playHitBrick', 'playHitSteel',
  'playPause', 'playGameOver', 'playPowerUpCollect', 'playPowerUpSpawn',
  'updateEngineSound', 'stopEngineSound', 'playStageStart',
]) {
  soundManager[m] = () => {};
}
globalThis.requestAnimationFrame = () => 1;
globalThis.cancelAnimationFrame = () => {};

const noop = () => {};
const fakeCtx = new Proxy({}, { get: () => noop });
const fakeCanvas = { width: 0, height: 0, getContext: () => fakeCtx };

import { GameEngine } from '../src/engine/GameLoop.ts';
import { GameState, BaseState, TileType } from '../src/types.ts';
import { addNorthBaseBunker } from '../src/engine/maps.ts';

const emptyMap = { name: 'empty', grid: Array.from({ length: 26 }, () => Array(26).fill(0)) };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const tick = (engine, n = 1) => {
  for (let i = 0; i < n; i++) engine.onWorkerTick();
};
const assert = (name, cond) => {
  if (!cond) throw new Error('FAIL: ' + name);
  console.log('PASS: ' + name);
};

// Bake BOTH eagles + bunkers into one map so side-stripping is observable
function dualBaseMap() {
  const grid = Array.from({ length: 26 }, () => Array(26).fill(0));
  addNorthBaseBunker(grid, 26);
  const c = 12; // baseC
  grid[23][c - 1] = TileType.BRICK; grid[23][c] = TileType.BRICK;
  grid[23][c + 1] = TileType.BRICK; grid[23][c + 2] = TileType.BRICK;
  grid[24][c - 1] = TileType.BRICK; grid[24][c] = TileType.BASE;
  grid[24][c + 1] = TileType.BASE; grid[24][c + 2] = TileType.BRICK;
  grid[25][c - 1] = TileType.BRICK; grid[25][c] = TileType.BASE;
  grid[25][c + 1] = TileType.BASE; grid[25][c + 2] = TileType.BRICK;
  return { name: 'dual', grid };
}

const bulletAt = (id, slot, team, x, y, dir) => ({
  id, ownerId: 'p' + slot, isPlayer: true, playerIndex: slot, team,
  x, y, direction: dir, speed: 4, canDestroySteel: false, size: 4,
});

async function main() {
  console.log('--- 1. Round 1: P1 DEFENDS the south eagle (north stripped) ---');
  const engine = new GameEngine(fakeCanvas, dualBaseMap(), () => {});
  engine.roundIntroMs = 20;
  engine.roundEndMs = 20;
  engine.setMultiplayerMode('versus', 'host');
  engine.startStage(1, dualBaseMap());

  assert('Round 1 defender is P1', engine.vsDefenderSlot === 1);
  assert('Only Base A registered', engine.bases.has('A') && !engine.bases.has('B'));
  assert('South eagle tiles intact', engine.grid[24][12].type === TileType.BASE);
  assert('North side STRIPPED', engine.grid[0][12].type === TileType.EMPTY && engine.grid[2][12].type === TileType.EMPTY);

  await sleep(40);
  assert('Playing after intro', engine.gameState === GameState.PLAYING);

  console.log('--- 2. Defender ricochet + attacker destroys the eagle ---');
  // P1 (defender) shoots his own eagle -> harmless ricochet
  engine.bullets.push(bulletAt('b_def', 1, 'A', engine.baseX + 16, engine.baseY + 16, 'DOWN'));
  tick(engine, 1);
  assert('Defender bullet ricochets (eagle alive)', engine.baseState === BaseState.ALIVE);
  assert('Defender bullet removed', !engine.bullets.some((b) => b.id === 'b_def'));

  // P2 (attacker) destroys the south eagle -> P2 wins the round
  engine.bullets.push(bulletAt('b_atk', 2, 'B', engine.baseX + 16, engine.baseY + 16, 'DOWN'));
  tick(engine, 1);
  assert('Eagle destroyed by attacker', engine.baseState === BaseState.DESTROYED);

  await sleep(1350);
  assert('Attacker P2 won the round', engine.scoreData.roundWinsP2 === 1);

  console.log('--- 3. Round 2: roles FLIP — P2 defends the north eagle ---');
  await sleep(60);
  assert('Round 2 defender is P2', engine.vsDefenderSlot === 2);
  assert('Only Base B registered', engine.bases.has('B') && !engine.bases.has('A'));
  assert('North eagle tiles enforced', engine.grid[0][12].type === TileType.BASE);
  assert('South side STRIPPED', engine.grid[24][12].type === TileType.EMPTY && engine.grid[23][12].type === TileType.EMPTY);

  await sleep(40);
  // P1 is now the attacker: destroys the north eagle -> P1 wins
  engine.bullets.push(bulletAt('b_atk2', 1, 'A', engine.baseB_X + 16, engine.baseB_Y + 16, 'UP'));
  tick(engine, 1);
  assert('North eagle destroyed by P1', engine.baseStateB === BaseState.DESTROYED);
  await sleep(1350);
  assert('Score 1-1', engine.scoreData.roundWinsP1 === 1 && engine.scoreData.roundWinsP2 === 1);

  console.log('--- 4. Snapshot sync ---');
  const snapshot = engine.getNetworkSnapshot();
  assert('Snapshot carries baseState', snapshot.baseState !== undefined);
  assert('Snapshot carries bases list (active only)', Array.isArray(snapshot.bases) && snapshot.bases.length === 1);

  console.log('--- 5. 2v2 keeps DUAL bases (both sides, untouched) ---');
  const engine2v2 = new GameEngine(fakeCanvas, dualBaseMap(), () => {});
  engine2v2.roundIntroMs = 20;
  engine2v2.roundEndMs = 20;
  engine2v2.setMultiplayerMode('2v2', 'host');
  engine2v2.startStage(1, dualBaseMap());
  await sleep(40);
  assert('2v2 both bases registered', engine2v2.bases.has('A') && engine2v2.bases.has('B'));
  assert('2v2 south eagle intact', engine2v2.grid[24][12].type === TileType.BASE);
  assert('2v2 north eagle intact', engine2v2.grid[0][12].type === TileType.BASE);

  engine2v2.bullets.push(bulletAt('b_teamB', 2, 'B', engine2v2.baseX + 16, engine2v2.baseY + 16, 'DOWN'));
  tick(engine2v2, 1);
  assert('Team B destroys south base', engine2v2.baseState === BaseState.DESTROYED);
  await sleep(1300);
  assert('Team B won the round', engine2v2.scoreData.teamWinsB === 1);

  console.log('--- 6. Single-player backward compatibility ---');
  const engineSP = new GameEngine(fakeCanvas, dualBaseMap(), () => {});
  engineSP.setMultiplayerMode('single');
  engineSP.startStage(1, dualBaseMap());
  assert('SP only has Base A', engineSP.bases.has('A') && !engineSP.bases.has('B'));
  assert('SP Base A is ALIVE', engineSP.baseState === BaseState.ALIVE);

  console.log('\n=============================================');
  console.log('ALL ALTERNATING EAGLE TESTS PASSED (100%)!');
  console.log('=============================================');
}

main().catch((err) => {
  console.error('FAIL:', err.message);
  process.exit(1);
});
