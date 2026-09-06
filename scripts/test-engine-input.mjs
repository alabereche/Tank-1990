/**
 * Headless engine proof: input -> movement for BOTH players.
 * Runs the real GameEngine on a fake canvas (no browser): feeds input
 * exactly the way the unified composer does and asserts each tank moves,
 * snapshots reflect it, and pause freezes the simulation.
 * Run: npx esbuild scripts/test-engine-input.mjs --bundle --platform=node --format=cjs --outfile=scripts/.ei.cjs && node scripts/.ei.cjs
 */

import { soundManager } from '../src/engine/SoundManager.ts';

// Neutralize audio (Node has no WebAudio)
for (const m of [
  'playShoot', 'playExplosion', 'playBigExplosion', 'playHitBrick', 'playHitSteel',
  'playPause', 'playGameOver', 'playPowerUpCollect', 'playPowerUpSpawn',
  'updateEngineSound', 'stopEngineSound', 'playStageStart',
]) {
  soundManager[m] = () => {};
}

// Neutralize rAF (we tick the engine manually)
globalThis.requestAnimationFrame = () => 1;
globalThis.cancelAnimationFrame = () => {};

const noop = () => {};
const fakeCtx = new Proxy({}, { get: () => noop });
const fakeCanvas = { width: 0, height: 0, getContext: () => fakeCtx };

import { GameEngine } from '../src/engine/GameLoop.ts';

const emptyGrid = () => Array.from({ length: 26 }, () => Array(26).fill(0));
const emptyMap = { name: 'empty', grid: emptyGrid() };

const assert = (name, cond) => {
  if (!cond) throw new Error('FAIL ' + name);
  console.log('PASS ' + name);
};

// Tick through the REAL production host entry (worker pulse) - it carries
// the isPaused/gameState guards, unlike calling update() directly.
const tick = (engine, n) => {
  for (let i = 0; i < n; i++) engine.onWorkerTick();
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {

// ---------- VERSUS (local two-player duel) ----------
{
  const engine = new GameEngine(fakeCanvas, emptyMap, () => {});
  engine.roundIntroMs = 10;
  engine.roundEndMs = 10;
  engine.setMultiplayerMode('versus', 'local');
  engine.startStage(1, emptyMap);
  tick(engine, 60); // let spawn stars finish (round intro running)
  await sleep(40);  // intro elapses -> PLAYING

  assert('versus: P1 (gold) materialized', Boolean(engine.player));
  assert('versus: P2 (green) materialized', Boolean(engine.player2));

  // Host keyboard/pad input drives P1 upward
  const y0 = engine.player.y;
  engine.updateInput({ up: true });
  tick(engine, 30);
  assert('versus: P1 moves UP with updateInput', engine.player.y < y0);
  engine.updateInput({ up: false });

  // Guest networked input (host side) drives P2 leftward
  const x0 = engine.player2.x;
  engine.setP2Input({ left: true });
  tick(engine, 30);
  assert('versus: P2 moves LEFT with setP2Input', engine.player2.x < x0);
  engine.setP2Input({ left: false });

  // Snapshot must reflect both movements for the guest
  const snap = engine.getNetworkSnapshot();
  assert('snapshot carries P1 position', snap.p1 && snap.p1.y < y0);
  assert('snapshot carries P2 position', snap.p2 && snap.p2.x < x0);

  // Pause must freeze the simulation
  engine.togglePause();
  const yFrozen = engine.player.y;
  engine.updateInput({ up: true });
  tick(engine, 20);
  assert('pause freezes P1 movement', engine.player.y === yFrozen);
}

// ---------- DEDICATED SERVER MODEL (umpire host + sequenced network inputs) ----------
{
  const engine = new GameEngine(fakeCanvas, emptyMap, () => {});
  engine.roundIntroMs = 10;
  engine.roundEndMs = 10;
  engine.setMultiplayerMode('versus', 'host'); // server-style umpire
  engine.localPlayerSlot = 0;
  engine.startStage(1, emptyMap);
  tick(engine, 60);
  await sleep(40);

  assert('umpire: both tanks spawned', Boolean(engine.player && engine.player2));

  // Slot 1 is driven ONLY by sequenced network inputs (ServerPeer path)
  const y0 = engine.player.y;
  engine.enqueuePlayerInput(1, { up: true, fire: false, pause: false }, 1);
  tick(engine, 30);
  assert('umpire: slot 1 moves via enqueuePlayerInput', engine.player.y < y0);

  // Slot 2 the same
  const x0 = engine.player2.x;
  engine.enqueuePlayerInput(2, { left: true, fire: false, pause: false }, 1);
  tick(engine, 30);
  assert('umpire: slot 2 moves via enqueuePlayerInput', engine.player2.x < x0);

  // The host's ack must advance so clients can reconcile
  assert('umpire: processed seq tracked', (engine.hostLastProcessedSeq.get(1) ?? 0) >= 1);
}

// ---------- COOP (host) ----------
{
  const engine = new GameEngine(fakeCanvas, emptyMap, () => {});
  engine.setMultiplayerMode('coop', 'local');
  engine.startStage(1, emptyMap);
  tick(engine, 60);

  assert('coop: both players materialized', Boolean(engine.player && engine.player2));

  const y0 = engine.player.y;
  const x0 = engine.player2.x;
  engine.updateInput({ up: true }); // P1 spawns on the bottom edge: UP is open
  engine.setP2Input({ right: true });
  tick(engine, 30);
  assert('coop: P1 moves UP', engine.player.y < y0);
  assert('coop: P2 moves RIGHT (relay/prediction path)', engine.player2.x > x0);

  // Enemies spawn and the pool drains over time (AI runs on host)
  const enemiesSeen = engine.enemies.length > 0 || engine.scoreData.enemiesRemaining.length < 20;
  assert('coop: enemy spawner active', enemiesSeen);
}

// ---------- Merge semantics of the composer (host P2 = net OR pad2) ----------
{
  const engine = new GameEngine(fakeCanvas, emptyMap, () => {});
  engine.setMultiplayerMode('coop', 'local');
  engine.startStage(1, emptyMap);
  tick(engine, 60);

  // net={up}, pad2={right} -> OR -> tank takes last-pressed priority order of
  // updatePlayer2 (up checked first) => moves UP
  const y0 = engine.player2.y;
  engine.setP2Input({ up: true, right: true });
  tick(engine, 30);
  assert('OR-merge: P2 moves (up priority) with net+pad combined', engine.player2.y < y0);
}

console.log('ALL ENGINE-INPUT TESTS PASSED');
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
