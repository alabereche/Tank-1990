import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { GameEngine } from '../src/engine/GameLoop';
import { getAdaptiveDelay } from '../src/network/interpolation';
import { PRESET_MAPS } from '../src/engine/maps';
import { InputState, Direction, Tank } from '../src/types';

// Polyfill rAF for headless Node.js testing
if (typeof globalThis.requestAnimationFrame === 'undefined') {
  (globalThis as any).requestAnimationFrame = (cb: (t: number) => void) =>
    setTimeout(() => cb(performance.now()), 16) as unknown as number;
  (globalThis as any).cancelAnimationFrame = (id: number) => clearTimeout(id);
}

// Complete mock Canvas 2D context using Proxy so rendering never throws in headless tests
function createMockCanvas(): HTMLCanvasElement {
  const dummyCtx = new Proxy(
    {
      measureText: () => ({ width: 50 }),
      createPattern: () => null,
      getImageData: () => ({ data: [] }),
    },
    {
      get: (target, prop) => {
        if (prop in target) return (target as any)[prop];
        return () => {};
      },
    }
  );

  return {
    getContext: () => dummyCtx,
    width: 544,
    height: 544,
  } as unknown as HTMLCanvasElement;
}

function createTestGuestEngine(): GameEngine {
  const canvas = createMockCanvas();
  const engine = new GameEngine(canvas, PRESET_MAPS.stage1, () => {});
  engine.setMultiplayerMode('versus', 'guest');
  engine.localPlayerSlot = 2;
  engine.startStage(1, PRESET_MAPS.stage1);
  // In multiplayer guest mode, initialize the player 2 tank as verified by the network
  const tank = (engine as any).createPlayerTank(256, 384, 2);
  engine.playerTanks.set(2, tank);
  return engine;
}

describe('Battle City 1990 - Gambetta Netcode Prediction Suite', () => {
  it('1. Adaptive Jitter Buffer calculates correct latency windows', () => {
    // Ultra-low latency LAN/VPS (e.g. 10ms - 20ms ping)
    const lowPing = getAdaptiveDelay(20);
    // oneWay = 15, jitter = 12, buffer = 15 + 12 + 45 = 72ms
    assert.equal(lowPing, 72, 'Low ping should adapt buffer to 72ms for mobile jitter safety');

    // Moderate internet latency (e.g. 60ms ping)
    const midPing = getAdaptiveDelay(60);
    // oneWay = 30, jitter = 12, buffer = 30 + 12 + 45 = 87ms
    assert.equal(midPing, 87, '60ms ping should adapt buffer to 87ms');

    // High latency / transatlantic (e.g. 250ms ping)
    const highPing = getAdaptiveDelay(250);
    assert.equal(highPing, 130, 'High ping should clamp to maximum 130ms safety limit');
  });

  it('2. Client-Side Input Sequencing & Replay converges without backward drag', () => {
    const guestEngine = createTestGuestEngine();

    try {
      const tank = guestEngine.playerTanks.get(2);
      assert.ok(tank, 'Player 2 tank should exist in versus mode');

      const startX = tank.x;
      const startY = tank.y;

      // Simulate 5 consecutive movement frames: moving RIGHT
      const rightInput: InputState = {
        up: false,
        down: false,
        left: false,
        right: true,
        fire: false,
        pause: false,
      };

      const seqs: number[] = [];
      for (let i = 0; i < 5; i++) {
        const seq = guestEngine.recordAndSendInput(2, rightInput);
        seqs.push(seq);
        guestEngine.simulatePlayerMovement(tank, rightInput);
      }

      const predictedXAfter5Frames = tank.x;
      assert.ok(predictedXAfter5Frames > startX, 'Tank should have advanced rightward');

      // Host authoritative snapshot arrives:
      // Host has only processed up to frame 3 so far (due to network transit time)
      // Create a virtual authoritative tank at frame 3's position
      const authTank: Tank = { ...tank, x: startX, y: startY };
      for (let i = 0; i < 3; i++) {
        guestEngine.simulatePlayerMovement(authTank, rightInput);
      }
      const authStateAtSeq3 = {
        x: authTank.x,
        y: authTank.y,
        dir: authTank.direction,
        moving: true,
      };

      // Guest reconciles with Host's acknowledgment for seq 3
      guestEngine.reconcileAndReplay(2, seqs[2], authStateAtSeq3);

      // After replaying unacknowledged inputs (seq 4 and 5), position must match predictedX exactly!
      const reconciledX = tank.x;
      const drift = Math.abs(reconciledX - predictedXAfter5Frames);
      assert.ok(drift < 0.001, `Position drift should be 0, got ${drift}`);
      assert.equal(reconciledX, predictedXAfter5Frames, 'Replay converged with 100% precision');
    } finally {
      guestEngine.stopLoop();
    }
  });

  it('3. Firing triggers 0ms muzzle feedback and applies authoritative bullets with zero duplicates', () => {
    const guestEngine = createTestGuestEngine();

    try {
      const tank = guestEngine.playerTanks.get(2);
      assert.ok(tank, 'Tank must exist');
      tank.shootCooldown = 0;
      tank.x = 200;
      tank.y = 200;
      tank.direction = 'UP';

      // Guest fires: triggers muzzle spark and sound immediately at 0ms
      guestEngine.firePredictiveBullet(tank, 42);
      const flashes = (guestEngine as any).muzzleFlashes;
      assert.ok(flashes.length > 0, 'Muzzle flash should be added immediately for 0ms feedback');

      // Host sends authoritative snapshot that confirms bullet 42 from Player 2, plus an enemy bullet
      const fakeSnapshot = {
        tick: 100,
        recvAt: performance.now(),
        p1: null,
        p2: null,
        enemies: [],
        spawning: [],
        powerUps: [],
        bullets: [
          {
            id: 'host_bullet_42',
            pIdx: 2,
            isPlayer: true,
            x: 200,
            y: 190,
            dir: 'UP' as Direction,
            inputSeq: 42,
          },
          {
            id: 'enemy_bullet_1',
            pIdx: undefined,
            isPlayer: false,
            x: 50,
            y: 50,
            dir: 'DOWN' as Direction,
          },
        ],
        players: [
          { slot: 2, pIdx: 2, x: 200, y: 200, dir: 'UP', moving: false, tier: 0, shield: 0 },
        ],
      };

      // Apply remote view
      (guestEngine as any).applyRemoteView(fakeSnapshot);

      // Verify:
      // 1. Total bullets for Player 2 should be exactly 1 (NO duplicate ghost bullet!)
      const p2Bullets = (guestEngine as any).bullets.filter((b: any) => b.playerIndex === 2);
      assert.equal(p2Bullets.length, 1, 'Player 2 must have exactly 1 active bullet (no double bullet)');

      // 2. Enemy bullet is preserved
      const enemyBullets = (guestEngine as any).bullets.filter((b: any) => !b.isPlayer);
      assert.equal(enemyBullets.length, 1, 'Enemy bullet must be rendered');
    } finally {
      guestEngine.stopLoop();
    }
  });
});
