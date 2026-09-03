/**
 * FFA win-condition proof: kill target ends the match with the right champion.
 * Run: npx esbuild scripts/test-ffa-win.mjs --bundle --platform=node --format=cjs --outfile=scripts/.fw.cjs && node scripts/.fw.cjs
 */

import { soundManager } from '../src/engine/SoundManager.ts';
for (const m of ['playShoot','playExplosion','playBigExplosion','playHitBrick','playHitSteel','playPause','playGameOver','playPowerUpCollect','playPowerUpSpawn','updateEngineSound','stopEngineSound','playStageStart']) {
  soundManager[m] = () => {};
}
globalThis.requestAnimationFrame = () => 1;
globalThis.cancelAnimationFrame = () => {};
const noop = () => {};
const fakeCtx = new Proxy({}, { get: () => noop });
const fakeCanvas = { width: 0, height: 0, getContext: () => fakeCtx };

import { GameEngine } from '../src/engine/GameLoop.ts';
import { GameState } from '../src/types.ts';
import { BLOCK_SIZE } from '../src/engine/maps.ts';

const emptyMap = { name: 'empty', grid: Array.from({ length: 26 }, () => Array(26).fill(0)) };
const assert = (name, cond) => {
  if (!cond) throw new Error('FAIL ' + name);
  console.log('PASS ' + name);
};
const tick = (engine, n) => {
  for (let i = 0; i < n; i++) engine.onWorkerTick();
};

const bulletFrom = (slot) => ({
  id: 'b' + Math.random(), ownerId: 'p' + slot, isPlayer: true, playerIndex: slot,
  x: 0, y: 0, direction: 'UP', speed: 4, canDestroySteel: false, size: 4,
});

const engine = new GameEngine(fakeCanvas, emptyMap, () => {});
engine.roundIntroMs = 5;
engine.roundEndMs = 5;
engine.setMultiplayerMode('ffa', 'host');
engine.totalFfaPlayers = 4;
engine.startStage(1, emptyMap);
tick(engine, 60); // materialize all FFA tanks

assert('ffa: 4 tanks live', engine.playerTanks.size === 4);
assert('ffa: stats initialized', Object.keys(engine.scoreData.playerStats ?? {}).length === 4);

// Kill slot 3 29 times via slot-1 bullets -> not yet a champion
for (let k = 0; k < 29; k++) {
  const victim = engine.playerTanks.get(3);
  if (!victim) break;
  engine.handlePlayerTankKilled(victim, bulletFrom(1));
  // respawn fires after 1.5s real timer; force-materialize instead
  engine.spawnPlayer(3);
  tick(engine, 60);
}
assert('ffa: 29 kills not enough', (engine.scoreData.playerStats?.[1]?.kills ?? 0) === 29 && engine.gameState === GameState.PLAYING);

// 30th kill crowns slot 1 and ends the match
const victim = engine.playerTanks.get(3);
engine.handlePlayerTankKilled(victim, bulletFrom(1));
assert('ffa: kill target ends match', engine.gameState === GameState.MATCH_END);
assert('ffa: champion is slot 1', engine.scoreData.ffaWinner === 1);
assert('ffa: deaths recorded for victim', (engine.scoreData.playerStats?.[3]?.deaths ?? 0) === 30);
const snap = engine.getNetworkSnapshot();
assert('ffa: match result broadcast-ready', snap.gameState === GameState.MATCH_END && snap.scoreData.ffaWinner === 1);

console.log('ALL FFA-WIN TESTS PASSED');
