/**
 * Round system proof for 1v1 versus (first to 7 round wins).
 * Runs the real engine headless with fast timers and walks a full match:
 * intro -> fight -> kill -> winner banner -> arena reset -> ... -> MATCH_END,
 * including the draw (mutual destruction) rule and frozen-intro rule.
 * Run: npx esbuild scripts/test-versus-rounds.mjs --bundle --platform=node --format=cjs --outfile=scripts/.vr.cjs && node scripts/.vr.cjs
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
import { GameState } from '../src/types.ts';

const emptyMap = { name: 'empty', grid: Array.from({ length: 26 }, () => Array(26).fill(0)) };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const tick = (engine, n) => {
  for (let i = 0; i < n; i++) engine.onWorkerTick();
};
const assert = (name, cond) => {
  if (!cond) throw new Error('FAIL ' + name);
  console.log('PASS ' + name);
};

const engine = new GameEngine(fakeCanvas, emptyMap, () => {});
engine.roundIntroMs = 25;
engine.roundEndMs = 25;

async function main() {
engine.setMultiplayerMode('versus', 'host');
engine.startStage(1, emptyMap);

assert('match opens in ROUND_INTRO', engine.gameState === GameState.ROUND_INTRO);
assert('round 1, score 0-0', (engine.scoreData.roundNumber ?? 0) === 1 && engine.scoreData.roundWinsP1 === 0 && engine.scoreData.roundWinsP2 === 0);

await sleep(70);
assert('intro elapses into PLAYING', engine.gameState === GameState.PLAYING);

tick(engine, 60);
assert('both duelists spawned', Boolean(engine.player && engine.player2));
const p1SpawnX = engine.player.x;
const p2SpawnY = engine.player2.y;

// Tanks are frozen while a round banner is up
engine.gameState = GameState.ROUND_INTRO;
engine.updateInput({ up: true });
tick(engine, 20);
const frozenY = engine.player.y;
assert('movement frozen during ROUND_INTRO', engine.player.y === frozenY);
engine.gameState = GameState.PLAYING;

// --- Round 1: green dies -> gold takes the round ---
engine.handlePlayer2Killed();
assert('kill switches to ROUND_END', engine.gameState === GameState.ROUND_END);
assert('gold leads 1-0', engine.scoreData.roundWinsP1 === 1 && engine.scoreData.roundWinsP2 === 0);
assert('snapshot carries round state', engine.getNetworkSnapshot().scoreData.roundWinsP1 === 1);

await sleep(35); // end banner (25ms) elapsed, round intro (25ms) still running
assert('next round intro', engine.gameState === GameState.ROUND_INTRO && engine.scoreData.roundNumber === 2);
await sleep(70);
assert('round 2 fight live', engine.gameState === GameState.PLAYING);
tick(engine, 60);
assert('arena reset: both tanks back at spawns', Boolean(engine.player && engine.player2) && engine.player.x === p1SpawnX && engine.player2.y === p2SpawnY);

// --- Round 2: first kill decides instantly; a second kill during the
// banner is ignored (no draw under the dedicated-server rules) ---
engine.handlePlayerKilled();
assert('first kill ends the round', engine.gameState === GameState.ROUND_END);
assert('opponent takes it 1-1', engine.scoreData.roundWinsP1 === 1 && engine.scoreData.roundWinsP2 === 1);
engine.handlePlayer2Killed();
assert('second kill during banner ignored', engine.scoreData.roundWinner !== 0);
await sleep(35);
assert('round replays as next intro', engine.gameState === GameState.ROUND_INTRO);

// --- Fast-forward the match: gold wins every remaining round ---
let guard = 0;
while (engine.gameState !== GameState.MATCH_END && guard++ < 60) {
  if (engine.gameState === GameState.ROUND_INTRO || engine.gameState === GameState.ROUND_END) {
    await sleep(35);
    continue;
  }
  if (!engine.player2) tick(engine, 60); // materialize spawn stars
  if (engine.player2) engine.handlePlayer2Killed();
  await sleep(35);
}

assert('match ends at 7 round wins', engine.gameState === GameState.MATCH_END && engine.scoreData.roundWinsP1 === 7);
assert('match winner recorded', engine.scoreData.matchWinner === 1);
const snap = engine.getNetworkSnapshot();
assert('final snapshot carries match result', snap.gameState === GameState.MATCH_END && snap.scoreData.matchWinner === 1);

console.log('ALL VERSUS-ROUNDS TESTS PASSED');
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
