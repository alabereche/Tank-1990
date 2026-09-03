import { soundManager } from '../src/engine/SoundManager.ts';

for (const m of [
  'playShoot', 'playExplosion', 'playBigExplosion', 'playHitBrick', 'playHitSteel',
  'playPause', 'playGameOver', 'playPowerUpCollect', 'playPowerUpSpawn',
  'updateEngineSound', 'stopEngineSound', 'playStageStart',
]) {
  // @ts-ignore
  soundManager[m] = () => {};
}
// @ts-ignore
globalThis.requestAnimationFrame = () => 1;
// @ts-ignore
globalThis.cancelAnimationFrame = () => {};

const noop = () => {};
const fakeCtx = new Proxy({}, { get: () => noop });
const fakeCanvas = { width: 416, height: 416, getContext: () => fakeCtx };

import { GameEngine } from '../src/engine/GameLoop.ts';
import { GameState } from '../src/types.ts';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const emptyMap = { id: 'empty', name: 'empty', grid: Array.from({ length: 26 }, () => Array(26).fill(0)) };
const tick = (engine, n) => {
  for (let i = 0; i < n; i++) engine.onWorkerTick();
};
const assert = (name, cond) => {
  if (!cond) throw new Error('FAIL ' + name);
  console.log('PASS ' + name);
};

async function runTests() {
  console.log('--- Testing 2v2 Team Battle Mode ---');
  {
    let state = GameState.STAGE_START;
    // @ts-ignore
    const engine = new GameEngine(fakeCanvas, emptyMap, (newState) => {
      state = newState;
    });
    engine.roundIntroMs = 25;
    engine.roundEndMs = 25;

    engine.setMultiplayerMode('2v2', 'host');
    // @ts-ignore
    engine.startStage(1, emptyMap);

    // Fast-forward spawn animations
    tick(engine, 60);

    // Transition out of ROUND_INTRO into active PLAYING combat
    engine.gameState = GameState.PLAYING;

    // 1. Check spawns: 4 player tanks materialized
    assert('2v2: 4 player tanks materialized', engine.playerTanks.size === 4);

    const p1 = engine.playerTanks.get(1);
    const p2 = engine.playerTanks.get(2);
    const p3 = engine.playerTanks.get(3);
    const p4 = engine.playerTanks.get(4);

    assert('2v2: All 4 tanks exist', Boolean(p1 && p2 && p3 && p4));
    assert('2v2: Team A (P1, P3) assigned', p1.team === 'A' && p3.team === 'A');
    assert('2v2: Team B (P2, P4) assigned', p2.team === 'B' && p4.team === 'B');

    // 2. Friendly Fire Test: P1 shoots at P3 (Team A teammate)
    p1.x = 100;
    p1.y = 100;
    p1.direction = 'RIGHT';
    p1.shieldTimer = 0;
    p3.x = 130;
    p3.y = 100;
    p3.shieldTimer = 0;
    const p3InitialHp = p3.hp;

    engine.bullets.push({
      id: 'bullet_p1_teammate',
      ownerId: p1.id,
      x: 125,
      y: 114,
      direction: 'RIGHT',
      speed: 4,
      isPlayer: true,
      playerIndex: 1,
      team: 'A',
      power: 1,
    });

    tick(engine, 5);

    assert('2v2: Friendly fire immunity - P3 alive', engine.playerTanks.has(3));
    assert('2v2: Friendly fire immunity - 0 damage', engine.playerTanks.get(3)?.hp === p3InitialHp);

    // 3. Enemy Fire Test: P1 shoots at P2 (Team B enemy)
    p2.x = 200;
    p2.y = 100;
    p2.shieldTimer = 0;
    p2.hp = 1;

    engine.bullets.push({
      id: 'bullet_p1_enemy',
      ownerId: p1.id,
      x: 195,
      y: 114,
      direction: 'RIGHT',
      speed: 8,
      isPlayer: true,
      playerIndex: 1,
      team: 'A',
      power: 1,
    });

    tick(engine, 5);
    assert('2v2: Enemy team damage - P2 killed by P1', !engine.playerTanks.has(2));

    // 4. Test 2v2 Round End Flow (Kill P4 so all Team B is eliminated)
    engine.playerTanks.delete(4);
    engine.endRound2v2('A');

    assert('2v2: Round end triggered, Team A leads 1-0', engine.scoreData.teamWinsA === 1 && engine.scoreData.teamWinner === 'A');

    // 5. Test First-to-5 Match End Target
    // Reset round end state so endRound2v2 is accepted
    engine.gameState = GameState.PLAYING;
    engine.scoreData.teamWinsA = 4;
    engine.endRound2v2('A');
    await sleep(35);
    assert('2v2: Match ends at 5 round wins with team champion', engine.scoreData.teamWinsA === 5 && engine.scoreData.teamWinner === 'A' && state === GameState.MATCH_END);

    // 6. Network Snapshot test for 2v2
    const snap = engine.getNetworkSnapshot();
    assert('2v2: Network snapshot carries players array', Array.isArray(snap.players));
  }

  console.log('\n--- Testing 8-Player Free-For-All Mode ---');
  {
    let state = GameState.STAGE_START;
    // @ts-ignore
    const engine = new GameEngine(fakeCanvas, emptyMap, (newState) => {
      state = newState;
    });
    engine.roundIntroMs = 25;
    engine.roundEndMs = 25;

    engine.setMultiplayerMode('ffa', 'host');
    // @ts-ignore
    engine.startStage(1, emptyMap);

    // Fast-forward spawn animations
    tick(engine, 60);

    // Active PLAYING combat
    engine.gameState = GameState.PLAYING;

    // 1. Verify 8 player tanks spawned
    assert('FFA: All 8 player tanks materialized', engine.playerTanks.size === 8);

    // 2. Verify distinct perimeter spawn points
    const spawnPositions = new Set();
    for (let slot = 1; slot <= 8; slot++) {
      const tank = engine.playerTanks.get(slot);
      assert(`FFA: Player tank ${slot} exists and is FFA team`, Boolean(tank && tank.team === 'FFA'));
      const key = `${Math.round(tank.x)},${Math.round(tank.y)}`;
      spawnPositions.add(key);
    }
    assert('FFA: 8 distinct perimeter spawn positions verified', spawnPositions.size === 8);

    // 3. Verify FFA kill tracking
    const p1 = engine.playerTanks.get(1);
    const p2 = engine.playerTanks.get(2);
    p1.x = 50;
    p1.y = 50;
    p2.x = 80;
    p2.y = 50;
    p2.shieldTimer = 0;
    p2.hp = 1;

    engine.bullets.push({
      id: 'ffa_bullet_1',
      ownerId: p1.id,
      x: 75,
      y: 64,
      direction: 'RIGHT',
      speed: 8,
      isPlayer: true,
      playerIndex: 1,
      team: 'FFA',
      power: 1,
    });

    tick(engine, 5);

    assert('FFA: Kill and death stats accurately tracked', !engine.playerTanks.has(2) && engine.scoreData.playerStats?.[1]?.kills === 1 && engine.scoreData.playerStats?.[2]?.deaths === 1);

    // 4. Verify Respawn in FFA
    engine.spawnPlayer(2);
    tick(engine, 60);
    const p2Respawned = engine.playerTanks.get(2);
    assert('FFA: Player respawn with temporary shield protection', Boolean(p2Respawned && p2Respawned.shieldTimer > 0));

    // 5. Network Snapshot test for 8 players
    const snap = engine.getNetworkSnapshot();
    assert('FFA: Authoritative network snapshot synchronizes all 8 tanks', Array.isArray(snap.players) && snap.players.length === 8);
  }

  console.log('\n=============================================');
  console.log('ALL MULTIPLAYER 2v2 AND 8 FFA TESTS PASSED!');
  console.log('=============================================');
}

runTests().catch((err) => {
  console.error('TEST FAILED:', err);
  process.exit(1);
});
