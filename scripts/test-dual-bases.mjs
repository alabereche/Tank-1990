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
  assert('Snapshot carries vsDefenderSlot (round 3 -> slot 1)', snapshot.vsDefenderSlot === 1);

  // Test applyNetworkSnapshot on guest engine for Round 2 (vsDefenderSlot = 2)
  const guestEngine = new GameEngine(fakeCanvas, dualBaseMap(), () => {});
  guestEngine.setMultiplayerMode('versus', 'guest');
  assert('Guest initial vsDefenderSlot is 1', guestEngine.vsDefenderSlot === 1);
  guestEngine.applyNetworkSnapshot({
    vsDefenderSlot: 2,
    bases: [{ id: 'base_b', team: 'B', x: 192, y: 0, r: 0, c: 12, state: BaseState.ALIVE, palette: 'crimson' }],
  });
  assert('Guest synced vsDefenderSlot is 2', guestEngine.vsDefenderSlot === 2);
  assert('Guest synced bases has Base B', guestEngine.bases.has('B') && !guestEngine.bases.has('A'));

  console.log('--- 4b. Dynamic clearBaseArea on Large 34x34 map ---');
  const largeMap = { name: 'large', grid: Array.from({ length: 34 }, () => Array(34).fill(0)) };
  addNorthBaseBunker(largeMap.grid, 34);
  const largeC = 16;
  const largeR = 32;
  largeMap.grid[largeR][largeC] = TileType.BASE;
  largeMap.grid[largeR][largeC + 1] = TileType.BASE;
  const engineLarge = new GameEngine(fakeCanvas, largeMap, () => {});
  engineLarge.setMultiplayerMode('versus', 'host');
  engineLarge.startStage(1, largeMap);
  // Transition to Round 2: defender flips to P2 (North), south base at row 32 must be stripped clean
  engineLarge.pendingVsDefender = 2;
  engineLarge.initGrid(largeMap.grid);
  assert('Large map defender is P2', engineLarge.vsDefenderSlot === 2);
  assert('Large map South base is cleared at row 32', engineLarge.grid[largeR][largeC].type === TileType.EMPTY);

  console.log('--- 4c. Shovel power-up logic in 1v1 ---');
  // Round 1: Defender is P1 (South). If attacker P2 picks up shovel, active base should NOT fortify empty north!
  const engineShovel = new GameEngine(fakeCanvas, dualBaseMap(), () => {});
  engineShovel.setMultiplayerMode('versus', 'host');
  engineShovel.startStage(1, dualBaseMap());
  const p2Mock = { playerIndex: 2, team: 'B', tier: 0, speed: 2 };
  const p1Mock = { playerIndex: 1, team: 'A', tier: 0, speed: 2 };
  // Attacker P2 collects shovel -> no bunker change on empty North
  engineShovel.collectPowerUp('SHOVEL', p2Mock);
  assert('Attacker P2 shovel does not create steel in North', engineShovel.grid[2][12].type === TileType.EMPTY);
  // Defender P1 collects shovel -> fortifies South bunker
  engineShovel.collectPowerUp('SHOVEL', p1Mock);
  assert('Defender P1 shovel fortifies South base bunker', engineShovel.grid[23][12].type === TileType.STEEL);

  console.log('--- 4d. Eagle destruction race condition prevention ---');
  const engineRace = new GameEngine(fakeCanvas, dualBaseMap(), () => {});
  engineRace.roundIntroMs = 20;
  engineRace.roundEndMs = 20;
  engineRace.setMultiplayerMode('versus', 'host');
  engineRace.startStage(1, dualBaseMap());
  await sleep(40);
  // Destroy base A (P2 attacker wins)
  engineRace.destroyBase('A');
  assert('Engine isRoundEnding is true', engineRace.isRoundEnding === true);
  // During the explosion, P2 tank is killed
  engineRace.handlePlayerTankKilled(engineRace.playerTanks.get(2));
  // Player kill must NOT overturn base victory
  await sleep(1350);
  assert('Attacker P2 win is preserved despite dying during explosion', engineRace.scoreData.roundWinsP2 === 1 && (engineRace.scoreData.roundWinsP1 ?? 0) === 0);

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
