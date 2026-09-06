import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { GameEngine } from '../src/engine/GameLoop';
import { getStageMapForPresetAndStage } from '../src/engine/maps';
import { InputState, GameState } from '../src/types';

describe('Battle City 1990 - Authoritative Dedicated Server Suite', () => {
  it('1. Headless GameEngine initializes, spawns players, and ticks deterministically without Canvas', () => {
    const stageMap = getStageMapForPresetAndStage(1, 'classic', 'versus');
    let stateChanges: string[] = [];
    let receivedSnapshots: any[] = [];
    let receivedEvents: any[] = [];

    const engine = new GameEngine(null, stageMap, (state) => {
      stateChanges.push(state);
    });

    engine.roundIntroMs = 50; // shorten intro for rapid testing
    engine.setMultiplayerMode('versus', 'host');
    engine.localPlayerSlot = 0; // Dedicated Server Umpire
    engine.onNetworkSync = (snap) => receivedSnapshots.push(snap);
    engine.onGameEventBroadcast = (ev) => receivedEvents.push(ev);

    engine.startStage(1, stageMap);

    // Initial state: Spawning stars active for both players
    assert.ok(
      (engine as any).spawningTanks.some((s: any) => s.playerIndex === 1),
      'Player 1 spawning star should exist on server'
    );
    assert.ok(
      (engine as any).spawningTanks.some((s: any) => s.playerIndex === 2),
      'Player 2 spawning star should exist on server'
    );

    // Fast-forward spawning stars (65 ticks)
    for (let t = 0; t < 65; t++) {
      engine.tick();
    }

    // Now tanks are fully spawned in the arena
    assert.ok(engine.playerTanks.has(1), 'Player 1 tank should be active in arena');
    assert.ok(engine.playerTanks.has(2), 'Player 2 tank should be active in arena');

    // Both players send inputs to the server
    const p1Input: InputState = {
      up: false,
      down: false,
      left: false,
      right: true,
      fire: false,
      pause: false,
    };
    const p2Input: InputState = {
      up: false,
      down: false,
      left: true,
      right: false,
      fire: false,
      pause: false,
    };

    engine.setPlayerSlotInput(1, p1Input, 101);
    engine.setPlayerSlotInput(2, p2Input, 201);

    // Force PLAYING state for simulation test
    (engine as any).gameState = GameState.PLAYING;

    // Run 10 ticks of server simulation
    for (let t = 0; t < 10; t++) {
      engine.tick();
    }

    // Verify snapshots were generated
    assert.ok(receivedSnapshots.length > 0, 'Server should emit network snapshots');
    const latestSnapshot = receivedSnapshots[receivedSnapshots.length - 1];

    // Verify sequence acknowledgments
    assert.equal(latestSnapshot.ackSeqs[1], 101, 'Server should acknowledge P1 input sequence 101');
    assert.equal(latestSnapshot.ackSeqs[2], 201, 'Server should acknowledge P2 input sequence 201');

    // Clean up
    engine.stopLoop();
  });

  it('2. Simultaneous gunfire from both players is resolved authoritatively on server', () => {
    const stageMap = getStageMapForPresetAndStage(1, 'classic', 'versus');
    let capturedEvents: any[] = [];

    const engine = new GameEngine(null, stageMap, () => {});
    engine.setMultiplayerMode('versus', 'host');
    engine.localPlayerSlot = 0;
    engine.onGameEventBroadcast = (ev) => capturedEvents.push(ev);

    engine.startStage(1, stageMap);

    // Fast-forward spawning stars (65 ticks)
    for (let t = 0; t < 65; t++) {
      engine.tick();
    }

    // Put in PLAYING state and reset cooldowns
    (engine as any).gameState = GameState.PLAYING;
    const p1 = engine.playerTanks.get(1)!;
    const p2 = engine.playerTanks.get(2)!;
    p1.shootCooldown = 0;
    p2.shootCooldown = 0;

    const fireInput: InputState = {
      up: false,
      down: false,
      left: false,
      right: false,
      fire: true,
      pause: false,
    };

    // Both players fire
    engine.setPlayerSlotInput(1, fireInput, 1);
    engine.setPlayerSlotInput(2, fireInput, 1);

    for (let t = 0; t < 5; t++) {
      engine.tick();
    }

    const snap = engine.getNetworkSnapshot();
    assert.ok(Array.isArray(snap.bullets), 'Bullets should be present in server snapshot');
    assert.ok(snap.bullets.length > 0, 'Server should simulate active bullets');

    engine.stopLoop();
  });

  it('3. Server Input Queue catches up burst inputs without dropping frames or desyncing ack sequence', () => {
    const stageMap = getStageMapForPresetAndStage(1, 'classic', 'versus');
    const engine = new GameEngine(null, stageMap, () => {});
    engine.setMultiplayerMode('versus', 'host');
    engine.localPlayerSlot = 0;
    engine.startStage(1, stageMap);

    // Fast-forward spawning phase
    for (let t = 0; t < 65; t++) engine.tick();
    (engine as any).gameState = GameState.PLAYING;

    const p2 = engine.playerTanks.get(2)!;
    assert.ok(p2, 'Player 2 tank should exist');
    const startX = p2.x;

    const leftInput: InputState = {
      up: false,
      down: false,
      left: true,
      right: false,
      fire: false,
      pause: false,
    };

    // Client sends two sequential inputs that arrive in the same server tick window
    engine.enqueuePlayerInput(2, leftInput, 101);
    engine.enqueuePlayerInput(2, leftInput, 102);

    // Server ticks once
    engine.tick();

    // The server should have simulated both queued steps
    const snap = engine.getNetworkSnapshot();
    assert.equal(snap.ackSeqs[2], 102, 'Server should acknowledge the latest processed input sequence');
    assert.ok(p2.x < startX - 1.5, `Tank should have advanced leftward by multiple steps, start: ${startX}, current: ${p2.x}`);

    engine.stopLoop();
  });

  it('4. Smoke screen is serialized in server snapshot, emits audio event, and applies to opponent client', () => {
    const stageMap = getStageMapForPresetAndStage(1, 'classic', 'versus');
    let capturedEvents: any[] = [];
    const serverEngine = new GameEngine(null, stageMap, () => {});
    serverEngine.setMultiplayerMode('versus', 'host');
    serverEngine.localPlayerSlot = 0;
    serverEngine.onGameEventBroadcast = (ev) => capturedEvents.push(ev);
    serverEngine.startStage(1, stageMap);

    // Fast-forward spawning phase
    for (let t = 0; t < 65; t++) serverEngine.tick();
    (serverEngine as any).gameState = GameState.PLAYING;

    const p1 = serverEngine.playerTanks.get(1)!;
    assert.ok(p1, 'Player 1 tank should exist on server');
    p1.tacticalInventory = { smoke: 2, grenade: 1, shield: 1 };

    // Player 1 activates Smoke
    const smokeInput: InputState = {
      up: false,
      down: false,
      left: false,
      right: false,
      fire: false,
      pause: false,
      smoke: true,
    };
    serverEngine.enqueuePlayerInput(1, smokeInput, 301);
    serverEngine.tick();

    // Verify event was broadcast for audio
    const smokeEvent = capturedEvents.find((e) => e.t === 'smoke');
    assert.ok(smokeEvent, 'Server should emit a smoke event for audio synchronization');

    // Verify snapshot includes the active smoke screen
    const snap = serverEngine.getNetworkSnapshot();
    assert.ok(Array.isArray(snap.smokes), 'Server snapshot should have smokes array');
    assert.equal(snap.smokes.length, 1, 'Snapshot should contain exactly 1 active smoke screen');
    assert.equal(snap.smokes[0].radius, 56, 'Smoke screen radius should be 56px');

    // Now test opponent client receiving the snapshot
    const clientEngine = new GameEngine(null, stageMap, () => {});
    clientEngine.setMultiplayerMode('versus', 'guest');
    clientEngine.localPlayerSlot = 2; // Opponent is Player 2
    (clientEngine as any).gameState = GameState.PLAYING;

    // Apply snapshot to opponent client
    clientEngine.applyNetworkSnapshot(snap);
    // Sample interpolated view
    (clientEngine as any).updateRemote();

    // Opponent client now sees the smoke screen!
    const clientSmokes = (clientEngine as any).activeSmokeScreens;
    assert.equal(clientSmokes.length, 1, 'Opponent client must now possess the active smoke screen');
    assert.ok(clientSmokes[0].particles.length > 0, 'Opponent client must have generated billowing smoke particles');

    serverEngine.stopLoop();
    clientEngine.stopLoop();
  });

  it('5. Single Authoritative Bullet guarantee: Zero duplicate bullets and zero fakehit phantom bullets', () => {
    const stageMap = getStageMapForPresetAndStage(1, 'classic', 'versus');
    const serverEngine = new GameEngine(null, stageMap, () => {});
    serverEngine.setMultiplayerMode('versus', 'host');
    serverEngine.localPlayerSlot = 0;
    serverEngine.startStage(1, stageMap);
    for (let t = 0; t < 65; t++) serverEngine.tick();
    (serverEngine as any).gameState = GameState.PLAYING;

    // Create client
    const clientEngine = new GameEngine(null, stageMap, () => {});
    clientEngine.setMultiplayerMode('versus', 'guest');
    clientEngine.localPlayerSlot = 1;
    (clientEngine as any).gameState = GameState.PLAYING;

    // Local client presses fire
    const clientP1 = (clientEngine as any).createPlayerTank(100, 200, 1);
    clientEngine.playerTanks.set(1, clientP1);
    clientEngine.setPlayerSlotInput(1, { fire: true });
    // Local client tick (runs updateRemote, adds muzzle flash, no duplicate local bullet)
    (clientEngine as any).updateRemote();

    // Server processes the fire input
    serverEngine.enqueuePlayerInput(1, { fire: true, up: false, down: false, left: false, right: false, pause: false }, 501);
    serverEngine.tick();

    const serverSnap = serverEngine.getNetworkSnapshot();
    assert.equal(serverSnap.bullets.length, 1, 'Server should produce exactly 1 authoritative bullet');

    // Client receives server snapshot
    clientEngine.applyNetworkSnapshot(serverSnap);
    (clientEngine as any).updateRemote();

    const clientBullets = (clientEngine as any).bullets;
    assert.equal(clientBullets.length, 1, 'Client must have exactly 1 bullet on screen - no double bullets!');
    assert.equal(clientBullets[0].id, serverSnap.bullets[0].id, 'Client bullet ID must match authoritative server bullet');

    serverEngine.stopLoop();
    clientEngine.stopLoop();
  });
});
