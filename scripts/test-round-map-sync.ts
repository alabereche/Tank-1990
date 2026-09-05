import { GameEngine } from '../src/engine/GameLoop';
import { getStageMapForPresetAndStage } from '../src/engine/maps';
import { GameState } from '../src/types';

(globalThis as any).requestAnimationFrame = (cb: any) => setTimeout(cb, 16);
(globalThis as any).cancelAnimationFrame = (id: any) => clearTimeout(id);

// Mock Canvas & 2D Context for Node environment
function createMockCanvas(width: number, height: number) {
  return {
    width,
    height,
    getContext: () => ({
      fillRect: () => {},
      clearRect: () => {},
      drawImage: () => {},
      beginPath: () => {},
      arc: () => {},
      fill: () => {},
      stroke: () => {},
      save: () => {},
      restore: () => {},
      translate: () => {},
      rotate: () => {},
      scale: () => {},
      measureText: () => ({ width: 0 }),
      fillText: () => {},
      createImageData: () => ({ data: [] }),
      putImageData: () => {},
    }),
  } as any as HTMLCanvasElement;
}

async function runMapSyncTest() {
  console.log('--- Starting Map Synchronization Unit Test ---');

  const preset = 'classic';
  const stage1Map = getStageMapForPresetAndStage(1, preset, 'versus');
  const stage2Map = getStageMapForPresetAndStage(2, preset, 'versus');

  console.log(`Stage 1 Name: ${stage1Map.name}`);
  console.log(`Stage 2 Name: ${stage2Map.name}`);

  const hostCanvas = createMockCanvas(416, 416);
  const guestCanvas = createMockCanvas(416, 416);

  let hostEvents: any[] = [];
  let hostSnapshots: any[] = [];

  const hostEngine = new GameEngine(hostCanvas, stage1Map, () => {});
  hostEngine.setMultiplayerMode('versus', 'host');
  hostEngine.localPlayerSlot = 1;
  hostEngine.onGameEventBroadcast = (ev) => hostEvents.push(ev);
  hostEngine.onNetworkSync = (snap) => hostSnapshots.push(snap);

  const guestEngine = new GameEngine(guestCanvas, stage1Map, () => {});
  guestEngine.setMultiplayerMode('versus', 'guest');
  guestEngine.localPlayerSlot = 2;

  hostEngine.startStage(1, stage1Map);
  guestEngine.startStage(1, stage1Map);

  console.log('Initial Round on Host:', (hostEngine as any).scoreData.roundNumber);
  console.log('Initial Round on Guest:', (guestEngine as any).scoreData.roundNumber);

  // Trigger round 1 win for P1 on Host -> advance to Round 2
  (hostEngine as any).scoreData.roundWinsP1 = 1;
  (hostEngine as any).scoreData.roundWinner = 1;
  (hostEngine as any).resolveRoundAfterBanner();

  console.log('After round end on Host, roundNumber is:', (hostEngine as any).scoreData.roundNumber);
  console.log('Host currentMap is:', (hostEngine as any).currentMap.name);
  console.log('Host emitted net events count:', hostEvents.length);

  // Verify map_sync event was emitted
  const mapSyncEv = hostEvents.find((e) => e.t === 'map_sync');
  if (!mapSyncEv) {
    throw new Error('FAIL: Host did not emit map_sync event!');
  }
  console.log('✓ Host emitted map_sync event with gv:', mapSyncEv.gv, 'round:', mapSyncEv.round);

  // Relay map_sync event to Guest
  guestEngine.handleRemoteEvent(mapSyncEv);

  // Also simulate host sending snapshots during ROUND_INTRO
  (hostEngine as any).tickCount = 2;
  const snap = hostEngine.getNetworkSnapshot();
  guestEngine.applyNetworkSnapshot(snap);

  console.log('Guest roundNumber is now:', (guestEngine as any).scoreData.roundNumber);
  console.log('Guest gridVersion is now:', (guestEngine as any).gridVersion);
  console.log('Host gridVersion is:', (hostEngine as any).gridVersion);

  if ((guestEngine as any).scoreData.roundNumber !== 2) {
    throw new Error(`FAIL: Guest roundNumber is ${(guestEngine as any).scoreData.roundNumber}, expected 2!`);
  }

  if ((guestEngine as any).gridVersion !== (hostEngine as any).gridVersion) {
    throw new Error(`FAIL: Guest gridVersion ${(guestEngine as any).gridVersion} does not match Host ${(hostEngine as any).gridVersion}!`);
  }

  // Verify grid content comparison
  const hostEncoded = (hostEngine as any).encodeGrid();
  const guestEncoded = (guestEngine as any).encodeGrid();

  let diffCount = 0;
  for (let i = 0; i < hostEncoded.length; i++) {
    if (hostEncoded[i] !== guestEncoded[i]) diffCount++;
  }

  if (diffCount > 0) {
    throw new Error(`FAIL: Grids differ in ${diffCount} cells!`);
  }

  console.log('✓ 100% PERFECT MATCH: All grid cells and round versions are identical between Host and Guest!');
  console.log('--- Map Synchronization Test PASSED ---');
}

runMapSyncTest().catch((err) => {
  console.error('Test Failed:', err);
  process.exit(1);
});
