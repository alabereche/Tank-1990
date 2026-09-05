/**
 * Battle City 1990 - 60 FPS Core Game Engine
 * Handles physics, collision matrix, sub-quadrant brick destruction,
 * bullet collisions, enemy AI, power-ups, and game state.
 */

import {
  BaseEntity,
  BaseState,
  Bullet,
  Direction,
  EnemyType,
  Explosion,
  GameScore,
  GameState,
  InputState,
  Position,
  PowerUp,
  PowerUpType,
  ScorePopup,
  StageMap,
  SubTile,
  Tank,
  TileType,
  MultiplayerMode,
  MultiplayerRole,
  MudParticle,
  TacticalItemType,
  TacticalInventory,
  TacticalPickup,
  ActiveSmokeScreen,
  ActiveBouncingGrenade,
  ActiveDeployableShield,
  MapSizePreset,
} from '../types';
import { BLOCK_SIZE, cloneGrid, getStageMapForPresetAndStage } from './maps';
import { soundManager } from './SoundManager';
import { SpriteRenderer } from './spriteRenderer';
import { SnapshotBuffer, NetSnapshot, getAdaptiveDelay } from '../network/interpolation';
import { createTickWorker } from './tickWorker';

// 1v1 versus: first player to win this many rounds takes the match (CS-style)
const VERSUS_ROUNDS_TO_WIN = 7;
// FFA deathmatch: first player to reach this many kills takes the match
const FFA_KILLS_TO_WIN = 30;

interface SpawningTank {
  id: string;
  isPlayer: boolean;
  playerIndex?: number;
  type: EnemyType | 'PLAYER';
  x: number;
  y: number;
  direction: Direction;
  isFlashingBonus?: boolean;
  progress: number; // 0 to 1
}

export class GameEngine {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;

  // Arena Dimensions & Coordinates
  public gridSize: number = 26;
  public canvasSize: number = 416;
  public baseR: number = 24;
  public baseC: number = 12;
  public baseX: number = 192;
  public baseY: number = 384;
  public baseB_R: number = 0;
  public baseB_C: number = 12;
  public baseB_X: number = 192;
  public baseB_Y: number = 0;
  private spawnPoints: Position[] = [
    { x: 0, y: 0 },
    { x: 192, y: 0 },
    { x: 384, y: 0 },
  ];
  private playerSpawn: Position = { x: 128, y: 384 };
  private p2Spawn: Position = { x: 256, y: 384 };
  private playerBaseSpeed: number = 1.1;

  // Grid state: sub-tiles with damage mask
  private grid: SubTile[][] = [];
  public baseState: BaseState = BaseState.ALIVE;
  public baseStateB: BaseState = BaseState.ALIVE;
  public bases: Map<string, BaseEntity> = new Map();
  private shovelTimer: number = 0; // Frames remaining of steel base bunker
  private shovelBunkerTiles: { r: number; c: number; prevType: TileType }[] = [];

  // Entities - General Map for all players (1..8)
  public playerTanks: Map<number, Tank> = new Map();
  public get player(): Tank | null {
    return this.playerTanks.get(1) || null;
  }
  public set player(tank: Tank | null) {
    if (tank) this.playerTanks.set(1, tank);
    else this.playerTanks.delete(1);
  }
  public get player2(): Tank | null {
    return this.playerTanks.get(2) || null;
  }
  public set player2(tank: Tank | null) {
    if (tank) this.playerTanks.set(2, tank);
    else this.playerTanks.delete(2);
  }

  private enemies: Tank[] = [];
  private spawningTanks: SpawningTank[] = [];
  private bullets: Bullet[] = [];
  private explosions: Explosion[] = [];
  private powerUps: PowerUp[] = [];
  private scorePopups: ScorePopup[] = [];
  private mudParticles: MudParticle[] = [];
  private tacticalPickups: TacticalPickup[] = [];
  private activeSmokeScreens: ActiveSmokeScreen[] = [];
  private activeGrenades: ActiveBouncingGrenade[] = [];
  private activeShields: ActiveDeployableShield[] = [];
  private tacticalPopups: { id: string; x: number; y: number; text: string; timer: number }[] = [];
  private prevTacticalInputs: Map<number, { smoke: boolean; grenade: boolean; shield: boolean }> = new Map();

  // Multiplayer Engine State
  public multiMode: MultiplayerMode = 'single';
  public localRole: MultiplayerRole | 'local' = 'local';
  public localPlayerSlot: number = 1;
  public totalFfaPlayers: number = 8;
  public total2v2Players: number = 4;
  private playerSpawns: Map<number, Position> = new Map();
  private playerInputs: Map<number, InputState> = new Map();
  private prevPlayerFire: Map<number, boolean> = new Map();
  public hasCustomMap: boolean = false;

  private get p2Input(): InputState {
    return this.playerInputs.get(2) || {
      up: false,
      right: false,
      down: false,
      left: false,
      fire: false,
      pause: false,
    };
  }
  private set p2Input(val: InputState) {
    this.playerInputs.set(2, val);
  }
  private prevP2FireInput: boolean = false;
  private tauntMessage: { text: string; sender: 'P1' | 'P2' | string; timer: number } | null = null;
  public onNetworkSync?: (snapshot: any) => void;
  public onGameEventBroadcast?: (event: any) => void;

  // Guest thin-client state: authoritative snapshots, own-tank prediction,
  // and grid versioning so brick destruction syncs to the guest.
  private snapBuffer = new SnapshotBuffer();
  private p2AuthTarget: { x: number; y: number; dir: Direction; moving: boolean } | null = null;
  private gridVersion = 0;
  private lastSentGridVersion = -1;
  private gridSyncFramesRemaining = 0;
  private tickWorker: Worker | null = null;

  // --- Client-Side Prediction & Input Sequencing (Gambetta / Source Model) ---
  public lastPingMs: number = 50;
  private localInputSeq: number = 0;
  private pendingInputs: { seq: number; input: InputState; timestamp: number }[] = [];
  private predictiveBullets: Bullet[] = [];
  private retiredBulletSeqs: Set<number> = new Set();
  private hostLastProcessedSeq: Map<number, number> = new Map();
  private hostSlotInputSeq: Map<number, number> = new Map();
  private lastSentSeq: number = 0;

  // Versus round flow timers (public ms fields so tests can shorten them)
  public roundIntroMs = 2200;
  public roundEndMs = 2600;
  private roundTransitionTimer: ReturnType<typeof setTimeout> | null = null;

  // 1v1 alternating eagle: which slot defends the single eagle this round
  public vsDefenderSlot: 1 | 2 = 1;
  private pendingVsDefender: 1 | 2 | null = null;
  public isRoundEnding: boolean = false;

  public get isRemoteViewer(): boolean {
    return this.localRole === 'guest';
  }

  // Game Loop
  private animFrameId: number | null = null;
  private lastTimestamp: number = 0;
  private tickCount: number = 0;
  private isRunning: boolean = false;
  private isPaused: boolean = false;

  // Enemy Spawning Pool (Classic NES: 20 tanks per stage)
  private enemyPool: EnemyType[] = [];
  private nextSpawnPointIndex: number = 0;
  private enemySpawnCooldown: number = 60; // 1 sec between spawns
  private maxActiveEnemies: number = 4;
  private freezeEnemiesTimer: number = 0;

  // Input & Game State
  private currentInput: InputState = {
    up: false,
    right: false,
    down: false,
    left: false,
    fire: false,
    pause: false,
  };
  private prevFireInput: boolean = false;

  public scoreData: GameScore = {
    score: 0,
    highScore: 20000,
    playerLives: 3,
    player2Lives: 3,
    player2Score: 0,
    stage: 1,
    enemiesRemaining: [],
    activeEnemiesCount: 0,
    destroyedEnemies: { BASIC: 0, FAST: 0, POWER: 0, ARMOR: 0 },
  };

  private currentMap: StageMap;
  private onStateChange: (state: GameState, score: GameScore) => void;
  private gameState: GameState = GameState.STAGE_START;

  constructor(
    canvas: HTMLCanvasElement,
    map: StageMap,
    onStateChange: (state: GameState, score: GameScore) => void
  ) {
    this.canvas = canvas;
    const context = canvas.getContext('2d', { alpha: false });
    if (!context) throw new Error('Cannot get 2d context');
    this.ctx = context;
    this.currentMap = map;
    this.hasCustomMap = !!map && !map.name.startsWith('Stage ');
    this.onStateChange = onStateChange;

    this.setupDimensions(map);

    // Load High Score from localStorage if available
    try {
      const saved = localStorage.getItem('battle_city_high_score');
      if (saved) {
        this.scoreData.highScore = Math.max(20000, parseInt(saved, 10) || 20000);
      }
    } catch {}

    this.initGrid(map.grid);
  }

  public bindCanvas(canvas: HTMLCanvasElement) {
    if (!canvas || this.canvas === canvas) return;
    this.canvas = canvas;
    if (this.canvas.width !== this.canvasSize) {
      this.canvas.width = this.canvasSize;
      this.canvas.height = this.canvasSize;
    }
    const context = canvas.getContext('2d', { alpha: false });
    if (context) {
      this.ctx = context;
    }
    this.render();
  }

  public setupDimensions(map: StageMap) {
    this.gridSize = map.grid?.length || 26;
    this.canvasSize = this.gridSize * BLOCK_SIZE;
    this.baseR = this.gridSize - 2;
    this.baseC = Math.floor(this.gridSize / 2) - 1;
    this.baseX = this.baseC * BLOCK_SIZE;
    this.baseY = this.baseR * BLOCK_SIZE;

    // North Base (Team B / Player 2)
    this.baseB_R = 0;
    this.baseB_C = this.baseC;
    this.baseB_X = this.baseB_C * BLOCK_SIZE;
    this.baseB_Y = 0;

    // Register active bases
    this.bases.clear();
    this.bases.set('A', {
      id: 'base_a',
      team: 'A',
      ownerSlot: 1,
      x: this.baseX,
      y: this.baseY,
      r: this.baseR,
      c: this.baseC,
      state: this.baseState,
      palette: 'gold',
    });

    if (this.multiMode === 'versus' || this.multiMode === '2v2') {
      this.bases.set('B', {
        id: 'base_b',
        team: 'B',
        ownerSlot: 2,
        x: this.baseB_X,
        y: this.baseB_Y,
        r: this.baseB_R,
        c: this.baseB_C,
        state: this.baseStateB,
        palette: 'crimson',
      });
    }

    if (this.multiMode === 'versus') {
      // 1v1 Duel: opposite ends (flanking bases so tanks don't overlap eagle)
      this.playerSpawn = {
        x: (this.baseC - 4) * BLOCK_SIZE,
        y: this.baseR * BLOCK_SIZE,
      };
      this.p2Spawn = {
        x: (this.baseC + 4) * BLOCK_SIZE,
        y: 0,
      };
      this.playerSpawns.set(1, this.playerSpawn);
      this.playerSpawns.set(2, this.p2Spawn);
    } else if (this.multiMode === '2v2') {
      // Team A: bottom left & right of base
      const s1 = { x: Math.max(0, (this.baseC - 5)) * BLOCK_SIZE, y: this.baseR * BLOCK_SIZE };
      const s3 = { x: Math.min(this.gridSize - 2, (this.baseC + 5)) * BLOCK_SIZE, y: this.baseR * BLOCK_SIZE };
      // Team B: top left & right
      const s2 = { x: Math.max(0, (this.baseC - 5)) * BLOCK_SIZE, y: 0 };
      const s4 = { x: Math.min(this.gridSize - 2, (this.baseC + 5)) * BLOCK_SIZE, y: 0 };
      this.playerSpawns.set(1, s1);
      this.playerSpawns.set(2, s2);
      this.playerSpawns.set(3, s3);
      this.playerSpawns.set(4, s4);
      this.playerSpawn = s1;
      this.p2Spawn = s2;
    } else if (this.multiMode === 'ffa') {
      // 8 distinct perimeter and corner points
      const pSpawns: Position[] = [
        { x: 2 * BLOCK_SIZE, y: (this.gridSize - 4) * BLOCK_SIZE },
        { x: (this.gridSize - 4) * BLOCK_SIZE, y: 2 * BLOCK_SIZE },
        { x: (this.gridSize - 4) * BLOCK_SIZE, y: (this.gridSize - 4) * BLOCK_SIZE },
        { x: 2 * BLOCK_SIZE, y: 2 * BLOCK_SIZE },
        { x: this.baseC * BLOCK_SIZE, y: 2 * BLOCK_SIZE },
        { x: this.baseC * BLOCK_SIZE, y: (this.gridSize - 4) * BLOCK_SIZE },
        { x: 2 * BLOCK_SIZE, y: Math.floor(this.gridSize / 2) * BLOCK_SIZE },
        { x: (this.gridSize - 4) * BLOCK_SIZE, y: Math.floor(this.gridSize / 2) * BLOCK_SIZE },
      ];
      pSpawns.forEach((pt, idx) => {
        this.playerSpawns.set(idx + 1, pt);
      });
      this.playerSpawn = pSpawns[0];
      this.p2Spawn = pSpawns[1];
    } else {
      this.playerSpawn = {
        x: (this.baseC - 4) * BLOCK_SIZE,
        y: this.baseR * BLOCK_SIZE,
      };
      this.p2Spawn = {
        x: (this.baseC + 4) * BLOCK_SIZE,
        y: this.baseR * BLOCK_SIZE,
      };
      this.playerSpawns.set(1, this.playerSpawn);
      this.playerSpawns.set(2, this.p2Spawn);
    }

    this.spawnPoints = [
      { x: 0, y: 0 },
      { x: this.baseC * BLOCK_SIZE, y: 0 },
      { x: (this.gridSize - 2) * BLOCK_SIZE, y: 0 },
    ];

    if (this.canvas.width !== this.canvasSize || this.canvas.height !== this.canvasSize) {
      this.canvas.width = this.canvasSize;
      this.canvas.height = this.canvasSize;
    }
  }

  public setMultiplayerMode(mode: MultiplayerMode, role: MultiplayerRole | 'local' = 'local') {
    this.multiMode = mode;
    this.localRole = role;
    if (mode === 'versus') {
      this.scoreData.playerLives = 5;
      this.scoreData.player2Lives = 5;
      this.scoreData.player2Score = 0;
    } else if (mode === '2v2') {
      this.scoreData.teamWinsA = 0;
      this.scoreData.teamWinsB = 0;
      this.scoreData.playerLives = 1;
      this.scoreData.player2Lives = 1;
    } else if (mode === 'ffa') {
      this.scoreData.playerStats = {};
      for (let i = 1; i <= 8; i++) {
        this.scoreData.playerStats[i] = { kills: 0, deaths: 0, score: 0, lives: 3 };
      }
    } else if (mode === 'coop') {
      this.scoreData.playerLives = 3;
      this.scoreData.player2Lives = 3;
      this.scoreData.player2Score = 0;
    }
  }

  public recordAndSendInput(slot: number, input: InputState): number {
    this.localInputSeq++;
    const seq = this.localInputSeq;
    this.lastSentSeq = seq;
    this.pendingInputs.push({
      seq,
      input: { ...input },
      timestamp: performance.now(),
    });
    // Keep history bounded to avoid memory build-up
    if (this.pendingInputs.length > 120) {
      this.pendingInputs.shift();
    }
    this.setPlayerSlotInput(slot, input, seq);
    return seq;
  }

  public setPlayerSlotInput(slot: number, input: Partial<InputState>, seq?: number) {
    const current = this.playerInputs.get(slot) || {
      up: false,
      right: false,
      down: false,
      left: false,
      fire: false,
      pause: false,
    };
    this.playerInputs.set(slot, { ...current, ...input });
    if (seq !== undefined) {
      this.hostLastProcessedSeq.set(slot, seq);
      this.hostSlotInputSeq.set(slot, seq);
    }
    if (slot === 1) {
      this.currentInput = { ...this.currentInput, ...input };
    }
  }

  public setP2Input(input: Partial<InputState>, seq?: number) {
    this.setPlayerSlotInput(2, input, seq);
  }

  public triggerTaunt(text: string, sender: 'P1' | 'P2' | string) {
    this.tauntMessage = { text, sender, timer: 120 };
  }

  public setPlayerSpeed(speed: number) {
    this.playerBaseSpeed = speed;
    for (const p of this.playerTanks.values()) {
      if (p) {
        p.speed = p.tier >= 2 ? speed * 1.3 : speed;
      }
    }
  }

  /**
   * Initializes or resets the grid
   */
  public initGrid(gridTemplate: number[][]) {
    this.grid = Array(this.gridSize)
      .fill(0)
      .map((_, r) =>
        Array(this.gridSize)
          .fill(0)
          .map((_, c) => ({
            type: gridTemplate[r]?.[c] ?? TileType.EMPTY,
            damageMask: 15, // Fully intact
          }))
      );
    this.baseState = BaseState.ALIVE;
    this.baseStateB = BaseState.ALIVE;
    this.shovelTimer = 0;
    this.isRoundEnding = false;
    if (this.bases.get('A')) this.bases.get('A')!.state = BaseState.ALIVE;
    if (this.bases.get('B')) this.bases.get('B')!.state = BaseState.ALIVE;

    // 1v1: ONE alternating eagle — the defender's side keeps its eagle +
    // bunker, the attacker's side is stripped clean. Roles flip each round.
    if (this.multiMode === 'versus') {
      const defender: 1 | 2 =
        this.pendingVsDefender ?? (((this.scoreData.roundNumber ?? 1) % 2 === 1) ? 1 : 2);
      this.pendingVsDefender = null;
      this.vsDefenderSlot = defender;
      const bCol = this.baseC;
      if (defender === 2) {
        // North eagle (rows 0-1) + symmetrical bunker
        if (this.grid[0]?.[bCol]) this.grid[0][bCol] = { type: TileType.BASE, damageMask: 15 };
        if (this.grid[0]?.[bCol + 1]) this.grid[0][bCol + 1] = { type: TileType.BASE, damageMask: 15 };
        if (this.grid[1]?.[bCol]) this.grid[1][bCol] = { type: TileType.BASE, damageMask: 15 };
        if (this.grid[1]?.[bCol + 1]) this.grid[1][bCol + 1] = { type: TileType.BASE, damageMask: 15 };
        for (let c = bCol - 1; c <= bCol + 2; c++) {
          if (this.grid[2]?.[c]) this.grid[2][c] = { type: TileType.BRICK, damageMask: 15 };
        }
        if (this.grid[0]?.[bCol - 1]) this.grid[0][bCol - 1] = { type: TileType.BRICK, damageMask: 15 };
        if (this.grid[1]?.[bCol - 1]) this.grid[1][bCol - 1] = { type: TileType.BRICK, damageMask: 15 };
        if (this.grid[0]?.[bCol + 2]) this.grid[0][bCol + 2] = { type: TileType.BRICK, damageMask: 15 };
        if (this.grid[1]?.[bCol + 2]) this.grid[1][bCol + 2] = { type: TileType.BRICK, damageMask: 15 };
        // North Advance Deflector (row 4)
        if (this.grid[4]?.[bCol]) this.grid[4][bCol] = { type: TileType.STEEL, damageMask: 15 };
        if (this.grid[4]?.[bCol + 1]) this.grid[4][bCol + 1] = { type: TileType.STEEL, damageMask: 15 };
        if (this.grid[4]?.[bCol - 1]) this.grid[4][bCol - 1] = { type: TileType.BRICK, damageMask: 15 };
        if (this.grid[4]?.[bCol + 2]) this.grid[4][bCol + 2] = { type: TileType.BRICK, damageMask: 15 };
        this.clearBaseArea('south');
      } else {
        // South eagle lives in the map template — strip the north side only
        this.clearBaseArea('north');
      }
      this.bases.clear();
      if (defender === 1) {
        this.bases.set('A', {
          id: 'base_a', team: 'A', x: this.baseX, y: this.baseY, r: this.baseR, c: this.baseC,
          state: this.baseState, palette: 'gold',
        });
      } else {
        this.bases.set('B', {
          id: 'base_b', team: 'B', x: this.baseB_X, y: this.baseB_Y, r: this.baseB_R, c: this.baseB_C,
          state: this.baseStateB, palette: 'crimson',
        });
      }
    } else if (this.multiMode === '2v2') {
      const bCol = this.baseC;
      if (this.grid[0]?.[bCol]) this.grid[0][bCol] = { type: TileType.BASE, damageMask: 15 };
      if (this.grid[0]?.[bCol + 1]) this.grid[0][bCol + 1] = { type: TileType.BASE, damageMask: 15 };
      if (this.grid[1]?.[bCol]) this.grid[1][bCol] = { type: TileType.BASE, damageMask: 15 };
      if (this.grid[1]?.[bCol + 1]) this.grid[1][bCol + 1] = { type: TileType.BASE, damageMask: 15 };

      for (let c = bCol - 1; c <= bCol + 2; c++) {
        if (this.grid[2]?.[c]) this.grid[2][c] = { type: TileType.BRICK, damageMask: 15 };
      }
      if (this.grid[0]?.[bCol - 1]) this.grid[0][bCol - 1] = { type: TileType.BRICK, damageMask: 15 };
      if (this.grid[1]?.[bCol - 1]) this.grid[1][bCol - 1] = { type: TileType.BRICK, damageMask: 15 };
      if (this.grid[0]?.[bCol + 2]) this.grid[0][bCol + 2] = { type: TileType.BRICK, damageMask: 15 };
      if (this.grid[1]?.[bCol + 2]) this.grid[1][bCol + 2] = { type: TileType.BRICK, damageMask: 15 };
      // North Advance Deflector (row 4)
      if (this.grid[4]?.[bCol]) this.grid[4][bCol] = { type: TileType.STEEL, damageMask: 15 };
      if (this.grid[4]?.[bCol + 1]) this.grid[4][bCol + 1] = { type: TileType.STEEL, damageMask: 15 };
      if (this.grid[4]?.[bCol - 1]) this.grid[4][bCol - 1] = { type: TileType.BRICK, damageMask: 15 };
      if (this.grid[4]?.[bCol + 2]) this.grid[4][bCol + 2] = { type: TileType.BRICK, damageMask: 15 };
    }
  }

  /**
   * Sets up a new stage with a pool of 20 enemies
   */
  public startStage(stageNumber: number, customMap?: StageMap) {
    soundManager.stopEngineSound();
    if (customMap) {
      this.currentMap = customMap;
      this.hasCustomMap = !customMap.name.startsWith('Stage ');
    } else {
      const preset: MapSizePreset = this.gridSize === 42 ? 'giant' : this.gridSize === 34 ? 'large' : 'classic';
      this.currentMap = getStageMapForPresetAndStage(stageNumber || 1, preset, this.multiMode);
      this.hasCustomMap = false;
    }
    // FFA (8-Player) strictly enforces the expanded Large arena (34x34) to avoid overlapping
    if (this.multiMode === 'ffa' && this.currentMap && this.currentMap.grid.length < 34) {
      const isBlank = this.currentMap.name === 'empty' || !this.currentMap.grid.some((row) => row.some((cell) => cell !== 0));
      if (isBlank) {
        this.currentMap = {
          name: 'empty',
          grid: Array.from({ length: 34 }, () => Array(34).fill(0)),
        };
      } else {
        this.currentMap = getStageMapForPresetAndStage(stageNumber || 1, 'large', this.multiMode);
      }
    }
    this.setupDimensions(this.currentMap);
    // A versus stage always opens with round 1 (P1 defends the south eagle)
    if (this.multiMode === 'versus') this.pendingVsDefender = 1;
    this.initGrid(this.currentMap.grid);

    // Every spawn pocket (all modes) must have a tank-wide exit; the check
    // rewrites playerSpawns in place, fixing the old field-only re-pick gap.
    if (!this.isRemoteViewer) {
      this.hardenSpawnPoints();
    }

    this.scoreData.stage = stageNumber;
    this.playerTanks.clear();
    this.enemies = [];
    this.spawningTanks = [];
    this.bullets = [];
    this.predictiveBullets = [];
    this.retiredBulletSeqs.clear();
    this.pendingInputs = [];
    this.explosions = [];
    this.powerUps = [];
    this.scorePopups = [];
    this.mudParticles = [];
    this.tacticalPickups = [];
    this.activeSmokeScreens = [];
    this.activeGrenades = [];
    this.activeShields = [];
    this.tacticalPopups = [];
    this.prevTacticalInputs.clear();
    this.freezeEnemiesTimer = 0;
    this.shovelTimer = 0;
    this.snapBuffer.clear();
    this.p2AuthTarget = null;
    this.gridVersion++;
    this.lastSentGridVersion = -1;
    this.gridSyncFramesRemaining = 60;

    if (this.isRemoteViewer) {
      // Thin client: every entity arrives via host snapshots
      this.enemyPool = [];
      this.scoreData.enemiesRemaining = [];
    } else if (this.multiMode === 'versus') {
      this.enemyPool = [];
      this.scoreData.enemiesRemaining = [];
      // Round system: lives are per-round (one duel), match = first to 7
      this.scoreData.playerLives = 1;
      this.scoreData.player2Lives = 1;
      this.scoreData.player2Score = 0;
      this.scoreData.roundNumber = 1;
      this.scoreData.roundWinsP1 = 0;
      this.scoreData.roundWinsP2 = 0;
      this.scoreData.roundWinner = undefined;
      this.scoreData.matchWinner = undefined;
    } else if (this.multiMode === '2v2') {
      this.enemyPool = [];
      this.scoreData.enemiesRemaining = [];
      this.scoreData.roundNumber = 1;
      this.scoreData.teamWinsA = 0;
      this.scoreData.teamWinsB = 0;
      this.scoreData.teamWinner = undefined;
      this.scoreData.matchWinner = undefined;
    } else if (this.multiMode === 'ffa') {
      this.enemyPool = [];
      this.scoreData.enemiesRemaining = [];
      this.scoreData.playerStats = {};
      const ffaCount = Math.min(8, this.totalFfaPlayers || 8);
      for (let i = 1; i <= ffaCount; i++) {
        this.scoreData.playerStats[i] = { kills: 0, deaths: 0, score: 0, lives: 3 };
      }
    } else {
      // Generate 20 enemies with difficulty scaling based on stage
      this.enemyPool = this.generateEnemyPool(stageNumber);
      this.scoreData.enemiesRemaining = [...this.enemyPool];
      this.scoreData.playerLives = 3;
      if (this.multiMode === 'coop') {
        this.scoreData.player2Lives = 3;
        this.scoreData.player2Score = 0;
      }
    }
    this.scoreData.activeEnemiesCount = 0;

    // Clear spawn areas and spawn active players
    if (!this.isRemoteViewer) {
      if (this.multiMode === '2v2') {
        for (let i = 1; i <= 4; i++) {
          const pt = this.playerSpawns.get(i);
          if (pt) this.clearSpawnArea(pt.x, pt.y);
          this.spawnPlayer(i);
        }
      } else if (this.multiMode === 'ffa') {
        const ffaCount = Math.min(8, this.totalFfaPlayers || 8);
        for (let i = 1; i <= ffaCount; i++) {
          const pt = this.playerSpawns.get(i);
          if (pt) this.clearSpawnArea(pt.x, pt.y);
          this.spawnPlayer(i);
        }
      } else {
        this.clearSpawnArea(this.playerSpawn.x, this.playerSpawn.y);
        this.spawnPlayer(1);
        if (this.multiMode !== 'single') {
          this.clearSpawnArea(this.p2Spawn.x, this.p2Spawn.y);
          this.spawnPlayer(2);
        }
      }
    }

    if (this.multiMode === 'versus' || this.multiMode === '2v2') {
      this.beginRoundIntro(1);
    } else {
      this.gameState = GameState.PLAYING;
      this.onStateChange(this.gameState, this.scoreData);
    }

    soundManager.playStageStart();
    this.startLoop();
  }

  // --- Versus Round System (CS-style: first to 7 round wins takes the match) ---
  private clearRoundTimer() {
    if (this.roundTransitionTimer) {
      clearTimeout(this.roundTransitionTimer);
      this.roundTransitionTimer = null;
    }
  }

  private beginRoundIntro(roundNumber: number) {
    soundManager.stopEngineSound();
    for (const p of this.playerTanks.values()) {
      if (p) p.moving = false;
    }
    this.scoreData.roundNumber = roundNumber;
    this.gameState = GameState.ROUND_INTRO;
    this.onStateChange(this.gameState, this.scoreData);
    if (this.isRemoteViewer) return; // host drives the flow via snapshots
    this.clearRoundTimer();
    this.roundTransitionTimer = setTimeout(() => {
      this.roundTransitionTimer = null;
      if (this.gameState === GameState.ROUND_INTRO) {
        this.gameState = GameState.PLAYING;
        this.onStateChange(this.gameState, this.scoreData);
      }
    }, this.roundIntroMs);
  }

  private endRound(winner: 1 | 2) {
    this.isRoundEnding = false;
    soundManager.stopEngineSound();
    for (const p of this.playerTanks.values()) {
      if (p) p.moving = false;
    }
    if (this.gameState === GameState.ROUND_END) {
      // Mutual destruction: revoke the point just awarded and replay the round
      if (this.scoreData.roundWinner === 1) {
        this.scoreData.roundWinsP1 = Math.max(0, (this.scoreData.roundWinsP1 ?? 1) - 1);
      } else if (this.scoreData.roundWinner === 2) {
        this.scoreData.roundWinsP2 = Math.max(0, (this.scoreData.roundWinsP2 ?? 1) - 1);
      }
      this.scoreData.roundWinner = 0;
      this.onStateChange(this.gameState, this.scoreData);
      return;
    }
    if (winner === 1) this.scoreData.roundWinsP1 = (this.scoreData.roundWinsP1 ?? 0) + 1;
    else this.scoreData.roundWinsP2 = (this.scoreData.roundWinsP2 ?? 0) + 1;
    this.scoreData.roundWinner = winner;
    this.gameState = GameState.ROUND_END;
    soundManager.stopEngineSound();
    soundManager.playPowerUpCollect();
    this.onStateChange(this.gameState, this.scoreData);
    if (this.isRemoteViewer) return;
    this.clearRoundTimer();
    this.roundTransitionTimer = setTimeout(() => {
      this.roundTransitionTimer = null;
      this.resolveRoundAfterBanner();
    }, this.roundEndMs);
  }

  public endRound2v2(winner: 'A' | 'B' | 'DRAW') {
    this.isRoundEnding = false;
    soundManager.stopEngineSound();
    for (const p of this.playerTanks.values()) {
      if (p) p.moving = false;
    }
    if (this.gameState === GameState.ROUND_END) return;
    if (winner === 'A') {
      this.scoreData.teamWinsA = (this.scoreData.teamWinsA ?? 0) + 1;
      this.scoreData.teamWinner = 'A';
    } else if (winner === 'B') {
      this.scoreData.teamWinsB = (this.scoreData.teamWinsB ?? 0) + 1;
      this.scoreData.teamWinner = 'B';
    } else {
      this.scoreData.teamWinner = 'DRAW';
    }
    this.gameState = GameState.ROUND_END;
    soundManager.stopEngineSound();
    soundManager.playPowerUpCollect();
    this.onStateChange(this.gameState, this.scoreData);
    if (this.isRemoteViewer) return;
    this.clearRoundTimer();
    this.roundTransitionTimer = setTimeout(() => {
      this.roundTransitionTimer = null;
      this.resolveRoundAfterBanner();
    }, this.roundEndMs);
  }

  /** FFA: the kill target was reached - crown the champion and end the match. */
  private endFfaMatch(winnerSlot: number) {
    soundManager.stopEngineSound();
    for (const p of this.playerTanks.values()) {
      if (p) p.moving = false;
    }
    if (this.gameState === GameState.MATCH_END) return;
    this.scoreData.ffaWinner = winnerSlot;
    this.gameState = GameState.MATCH_END;
    soundManager.stopEngineSound();
    soundManager.playStageStart();
    this.onStateChange(this.gameState, this.scoreData);
  }

  /** Odd rounds: P1 defends the south eagle. Even rounds: P2 defends the north. */
  private versusDefenderForRound(roundNumber: number): 1 | 2 {
    return roundNumber % 2 === 1 ? 1 : 2;
  }

  private resolveRoundAfterBanner() {
    soundManager.stopEngineSound();
    for (const p of this.playerTanks.values()) {
      if (p) p.moving = false;
    }
    if (this.multiMode === '2v2') {
      const wA = this.scoreData.teamWinsA ?? 0;
      const wB = this.scoreData.teamWinsB ?? 0;
      const target = 5;
      if (wA >= target || wB >= target) {
        this.scoreData.matchWinner = wA >= target ? 1 : 2;
        this.gameState = GameState.MATCH_END;
        soundManager.stopEngineSound();
        soundManager.playStageStart();
        this.onStateChange(this.gameState, this.scoreData);
        return;
      }
      const nextRound = (this.scoreData.roundNumber ?? 1) + 1;
      this.scoreData.roundNumber = nextRound;
      this.resetRoundArena();
      this.beginRoundIntro(nextRound);
      return;
    }

    const w1 = this.scoreData.roundWinsP1 ?? 0;
    const w2 = this.scoreData.roundWinsP2 ?? 0;
    if (w1 >= VERSUS_ROUNDS_TO_WIN || w2 >= VERSUS_ROUNDS_TO_WIN) {
      this.scoreData.matchWinner = w1 >= VERSUS_ROUNDS_TO_WIN ? 1 : 2;
      this.gameState = GameState.MATCH_END;
      soundManager.stopEngineSound();
      soundManager.playStageStart();
      this.onStateChange(this.gameState, this.scoreData);
      return;
    }
    const nextRound = (this.scoreData.roundNumber ?? 1) + 1;
    this.scoreData.roundNumber = nextRound;
    // Eagle sides flip with round parity — decide BEFORE the arena re-init
    if (this.multiMode === 'versus') this.pendingVsDefender = this.versusDefenderForRound(nextRound);

    // Rotate to next distinct stage map if playing preset duel
    if (!this.hasCustomMap && this.multiMode === 'versus') {
      const preset: MapSizePreset = this.gridSize === 42 ? 'giant' : this.gridSize === 34 ? 'large' : 'classic';
      this.currentMap = getStageMapForPresetAndStage(nextRound, preset, this.multiMode);
    }

    this.resetRoundArena();
    this.beginRoundIntro(nextRound);
  }

  /** Fresh duel: same map, cleared field, both tanks back at their spawns. */
  private resetRoundArena() {
    this.playerTanks.clear();
    this.enemies = [];
    this.spawningTanks = [];
    this.bullets = [];
    this.predictiveBullets = [];
    this.retiredBulletSeqs.clear();
    this.pendingInputs = [];
    this.explosions = [];
    this.powerUps = [];
    this.scorePopups = [];
    this.mudParticles = [];
    this.tacticalPickups = [];
    this.activeSmokeScreens = [];
    this.activeGrenades = [];
    this.activeShields = [];
    this.tacticalPopups = [];
    this.prevTacticalInputs.clear();
    this.freezeEnemiesTimer = 0;
    this.shovelTimer = 0;
    this.initGrid(this.currentMap.grid);
    this.gridVersion++;
    this.lastSentGridVersion = -1;
    this.gridSyncFramesRemaining = 60;

    // Reliable broadcast of map sync to all peers
    this.emitNetEvent({
      t: 'map_sync',
      round: this.scoreData.roundNumber,
      grid: this.encodeGrid(),
      gv: this.gridVersion,
      gs: this.gridSize,
    });

    if (this.multiMode === '2v2') {
      for (let i = 1; i <= 4; i++) {
        const pt = this.playerSpawns.get(i);
        if (pt) this.clearSpawnArea(pt.x, pt.y);
        this.spawnPlayer(i);
      }
    } else {
      this.clearSpawnArea(this.playerSpawn.x, this.playerSpawn.y);
      this.clearSpawnArea(this.p2Spawn.x, this.p2Spawn.y);
      this.spawnPlayer(1);
      this.spawnPlayer(2);
    }
  }

  /** Strips an eagle + its bunker ring (11..14 band) from the grid. */
  private clearBaseArea(side: 'north' | 'south') {
    const bCol = this.baseC;
    const sR = this.baseR;
    const rows: [number, number][] = side === 'south'
      ? [[sR - 1, bCol - 1], [sR - 1, bCol], [sR - 1, bCol + 1], [sR - 1, bCol + 2],
         [sR, bCol - 1],     [sR, bCol],     [sR, bCol + 1],     [sR, bCol + 2],
         [sR + 1, bCol - 1], [sR + 1, bCol], [sR + 1, bCol + 1], [sR + 1, bCol + 2]]
      : [[0, bCol - 1], [0, bCol], [0, bCol + 1], [0, bCol + 2],
         [1, bCol - 1], [1, bCol], [1, bCol + 1], [1, bCol + 2],
         [2, bCol - 1], [2, bCol], [2, bCol + 1], [2, bCol + 2]];
    for (const [r, c] of rows) {
      if (this.grid[r]?.[c]) this.grid[r][c] = { type: TileType.EMPTY, damageMask: 0 };
    }
  }

  private generateEnemyPool(stage: number): EnemyType[] {
    const pool: EnemyType[] = [];
    // 20 tanks per stage
    const armorCount = Math.min(6, 2 + Math.floor(stage * 0.8));
    const powerCount = Math.min(6, 3 + Math.floor(stage * 0.6));
    const fastCount = Math.min(6, 4 + Math.floor(stage * 0.5));
    const basicCount = 20 - (armorCount + powerCount + fastCount);

    for (let i = 0; i < basicCount; i++) pool.push('BASIC');
    for (let i = 0; i < fastCount; i++) pool.push('FAST');
    for (let i = 0; i < powerCount; i++) pool.push('POWER');
    for (let i = 0; i < armorCount; i++) pool.push('ARMOR');

    // Shuffle pool
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    return pool;
  }

  private clearSpawnArea(x: number, y: number) {
    const startC = Math.max(0, Math.floor(x / BLOCK_SIZE));
    const startR = Math.max(0, Math.floor(y / BLOCK_SIZE));
    for (let r = startR; r < Math.min(this.gridSize, startR + 2); r++) {
      for (let c = startC; c < Math.min(this.gridSize, startC + 2); c++) {
        if (this.grid[r]?.[c]) {
          this.grid[r][c] = { type: TileType.EMPTY, damageMask: 15 };
        }
      }
    }
  }

  /**
   * Ensures EVERY player spawn pocket has a tank-wide exit, across all modes.
   * Rewrites the playerSpawns MAP in place — the previous per-field re-pick
   * never propagated there, so trapped pockets could still be used.
   */
  private hardenSpawnPoints() {
    for (const [slot, pt] of Array.from(this.playerSpawns.entries())) {
      if (this.isViableSpawn(pt.x, pt.y)) continue;
      const candidates = [
        pt.x,
        (this.baseC - 4) * BLOCK_SIZE,
        (this.baseC + 4) * BLOCK_SIZE,
        (this.baseC - 6) * BLOCK_SIZE,
        (this.baseC + 6) * BLOCK_SIZE,
        0,
        (this.gridSize - 2) * BLOCK_SIZE,
      ];
      for (const x of candidates) {
        if (this.isViableSpawn(x, pt.y)) {
          this.playerSpawns.set(slot, { x, y: pt.y });
          break;
        }
      }
    }
    this.playerSpawn = this.playerSpawns.get(1) ?? this.playerSpawn;
    this.p2Spawn = this.playerSpawns.get(2) ?? this.p2Spawn;
  }

  /**
   * A 32px spawn pocket is viable only if it avoids the eagle/steel/water
   * (which clearSpawnArea cannot carve) and has a tank-wide (2 sub-tile)
   * opening after the pocket is virtually cleared.
   */
  private isViableSpawn(x: number, y: number): boolean {
    const c0 = Math.floor(x / BLOCK_SIZE);
    const r0 = Math.floor(y / BLOCK_SIZE);
    if (c0 < 0 || r0 < 0 || c0 + 1 >= this.gridSize || r0 + 1 >= this.gridSize) return false;
    for (let r = r0; r <= r0 + 1; r++) {
      for (let c = c0; c <= c0 + 1; c++) {
        const t = this.grid[r]?.[c]?.type ?? TileType.EMPTY;
        if (t === TileType.BASE || t === TileType.STEEL || t === TileType.WATER) return false;
      }
    }
    const open = (r: number, c: number): boolean => {
      if (r >= r0 && r <= r0 + 1 && c >= c0 && c <= c0 + 1) return true; // pocket itself
      const t = this.grid[r]?.[c]?.type ?? TileType.BRICK; // outside the field = wall
      return t === TileType.EMPTY || t === TileType.TREES || t === TileType.ICE || t === TileType.MUD;
    };
    return (
      (open(r0 - 1, c0) && open(r0 - 1, c0 + 1)) || // up
      (open(r0 + 2, c0) && open(r0 + 2, c0 + 1)) || // down
      (open(r0, c0 - 1) && open(r0 + 1, c0 - 1)) || // left
      (open(r0, c0 + 2) && open(r0 + 1, c0 + 2)) // right
    );
  }

  /**
   * Picks the preferred X for an edge whose pocket actually has an exit.
   * Falls back through near-center lanes to the edges.
   * (Superseded by hardenSpawnPoints — kept for external callers/tests.)
   */
  private pickViableSpawn(edge: 'top' | 'bottom', preferredX: number): Position {
    const y = edge === 'top' ? 0 : (this.gridSize - 2) * BLOCK_SIZE;
    const candidates = [
      preferredX,
      (this.baseC - 4) * BLOCK_SIZE,
      (this.baseC + 4) * BLOCK_SIZE,
      0,
      (this.gridSize - 2) * BLOCK_SIZE,
    ];
    for (const x of candidates) {
      if (this.isViableSpawn(x, y)) return { x, y };
    }
    return { x: preferredX, y }; // unchanged behaviour + clearSpawnArea carve
  }

  private spawnPlayer(index: number = 1) {
    const pt = this.playerSpawns.get(index) || (index === 2 ? this.p2Spawn : this.playerSpawn);
    this.clearSpawnArea(pt.x, pt.y);
    const isTeamB = (this.multiMode === '2v2' && (index === 2 || index === 4)) || (this.multiMode === 'versus' && index === 2);
    this.spawningTanks.push({
      id: `player_${index}_spawn_${Date.now()}`,
      isPlayer: true,
      playerIndex: index,
      type: 'PLAYER',
      x: pt.x,
      y: pt.y,
      direction: isTeamB ? 'DOWN' : 'UP',
      progress: 0,
    });
  }

  private createPlayerTank(x: number, y: number, index: number = 1): Tank {
    const isTeamB = (this.multiMode === '2v2' && (index === 2 || index === 4)) || (this.multiMode === 'versus' && index === 2);
    let team: 'A' | 'B' | 'FFA' = 'FFA';
    if (this.multiMode === '2v2') {
      team = index % 2 === 1 ? 'A' : 'B';
    }
    return {
      id: `player_${index}`,
      isPlayer: true,
      playerIndex: index,
      team,
      slot: index,
      type: 'PLAYER',
      x,
      y,
      direction: isTeamB ? 'DOWN' : 'UP',
      desiredDirection: null,
      speed: this.playerBaseSpeed,
      moving: false,
      distanceTraveled: 0,
      tier: 0,
      maxHp: 1,
      hp: 1,
      shieldTimer: 180, // 3 seconds invulnerable on spawn
      slideFrames: 0,
      shootCooldown: 0,
      bulletSpeed: 4.5,
      tacticalInventory: { smoke: 1, grenade: 0, shield: 1 },
    };
  }

  private spawnEnemy(type: EnemyType) {
    // Search across all 3 spawn points for one that is completely clear
    let chosenSpawnPt: Position | null = null;
    let chosenIndex = this.nextSpawnPointIndex;

    for (let attempt = 0; attempt < 3; attempt++) {
      const idx = (this.nextSpawnPointIndex + attempt) % 3;
      const pt = this.spawnPoints[idx];

      // Check if spawn point is occupied by ANY tank or ANY active spawning animation
      const isOccupied =
        (this.player && this.rectIntersect(pt.x, pt.y, 32, 32, this.player.x, this.player.y, 32, 32)) ||
        this.enemies.some((e) => this.rectIntersect(pt.x, pt.y, 32, 32, e.x, e.y, 32, 32)) ||
        this.spawningTanks.some((s) => this.rectIntersect(pt.x, pt.y, 32, 32, s.x, s.y, 32, 32));

      if (!isOccupied) {
        chosenSpawnPt = pt;
        chosenIndex = (idx + 1) % 3;
        break;
      }
    }

    if (!chosenSpawnPt) {
      // All 3 spawn points currently occupied! Retry next tick
      this.enemyPool.unshift(type);
      return;
    }

    this.nextSpawnPointIndex = chosenIndex;

    // Flashing bonus tank chance (~1 in 5 tanks)
    const isFlashing = Math.random() < 0.25;

    this.spawningTanks.push({
      id: 'enemy_spawn_' + Math.random(),
      isPlayer: false,
      type,
      x: chosenSpawnPt.x,
      y: chosenSpawnPt.y,
      direction: 'DOWN',
      isFlashingBonus: isFlashing,
      progress: 0,
    });
  }

  private createEnemyTank(type: EnemyType, x: number, y: number, isFlashingBonus: boolean): Tank {
    let speed = 1.2;
    let bulletSpeed = 3.5;
    let hp = 1;

    if (type === 'FAST') {
      speed = 2.4; // High speed
      bulletSpeed = 4.0;
    } else if (type === 'POWER') {
      speed = 1.4;
      bulletSpeed = 6.0; // Rapid shot
    } else if (type === 'ARMOR') {
      speed = 1.1;
      hp = 4; // 4 hits to destroy!
    }

    return {
      id: 'enemy_' + Math.random(),
      isPlayer: false,
      type,
      x,
      y,
      direction: 'DOWN',
      desiredDirection: null,
      speed,
      moving: true,
      distanceTraveled: 0,
      tier: 0,
      maxHp: hp,
      hp,
      isFlashingBonus,
      shieldTimer: 0,
      slideFrames: 0,
      shootCooldown: Math.floor(Math.random() * 40 + 30),
      bulletSpeed,
      aiChangeDirTimer: Math.floor(Math.random() * 60 + 40),
      aiShootTimer: Math.floor(Math.random() * 50 + 20),
    };
  }

  // --- Input Management ---
  public updateInput(input: Partial<InputState>) {
    this.currentInput = { ...this.currentInput, ...input };
  }

  public setInput(input: InputState) {
    this.currentInput = { ...input };
  }

  public togglePause(): boolean {
    if (this.gameState !== GameState.PLAYING && this.gameState !== GameState.PAUSED) {
      return false;
    }
    this.isPaused = !this.isPaused;
    this.gameState = this.isPaused ? GameState.PAUSED : GameState.PLAYING;
    if (this.isPaused) {
      soundManager.stopEngineSound();
      for (const p of this.playerTanks.values()) {
        if (p) p.moving = false;
      }
    }
    soundManager.playPause();
    this.onStateChange(this.gameState, this.scoreData);
    return this.isPaused;
  }

  public getState(): GameState {
    return this.gameState;
  }

  public pause(): boolean {
    if (!this.isPaused) {
      return this.togglePause();
    }
    return this.isPaused;
  }

  public resume(): boolean {
    if (this.isPaused) {
      return this.togglePause();
    }
    return this.isPaused;
  }

  /** Live pause flag for diagnostics/UI without touching the engine. */
  public get paused(): boolean {
    return this.isPaused;
  }

  // --- Main Loop: simulate on a Worker pulse (host) or rAF, render on rAF ---
  // Browsers throttle rAF in hidden tabs, which used to freeze the host
  // simulation - and the whole match for the guest. The Worker ticker keeps
  // the host simulating while its tab is in the background.
  public startLoop() {
    if (this.isRunning) return;
    this.isRunning = true;
    this.lastTimestamp = performance.now();
    if (this.localRole === 'host') {
      this.tickWorker = createTickWorker();
      if (this.tickWorker) {
        this.tickWorker.onmessage = this.onWorkerTick;
        this.tickWorker.postMessage('start');
      }
    }
    this.animFrameId = requestAnimationFrame(this.loop);
  }

  public stopLoop() {
    this.isRunning = false;
    this.clearRoundTimer();
    soundManager.stopEngineSound();
    for (const p of this.playerTanks.values()) {
      if (p) p.moving = false;
    }
    if (this.tickWorker) {
      this.tickWorker.postMessage('stop');
      this.tickWorker.terminate();
      this.tickWorker = null;
    }
    if (this.animFrameId !== null) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }
  }

  private onWorkerTick = () => {
    if (!this.isRunning || this.isPaused) return;
    if (
      this.gameState !== GameState.PLAYING &&
      this.gameState !== GameState.ROUND_END &&
      this.gameState !== GameState.ROUND_INTRO
    ) {
      soundManager.stopEngineSound();
      return;
    }
    this.tickCount++;
    this.update();
  };

  private loop = (timestamp: number) => {
    if (!this.isRunning) return;

    if (
      this.localRole !== 'host' &&
      !this.isPaused &&
      (this.gameState === GameState.PLAYING ||
        this.gameState === GameState.ROUND_END ||
        this.gameState === GameState.ROUND_INTRO)
    ) {
      this.tickCount++;
      this.update();
    } else if (this.gameState !== GameState.PLAYING) {
      soundManager.stopEngineSound();
    }

    this.render();

    this.animFrameId = requestAnimationFrame(this.loop);
  };

  // --- Game State Update ---
  private update() {
    if (this.gameState !== GameState.PLAYING) {
      soundManager.stopEngineSound();
      for (const p of this.playerTanks.values()) {
        if (p) p.moving = false;
      }
    }

    // Guest thin-client: render interpolated host snapshots + own-tank prediction
    if (this.isRemoteViewer) {
      this.updateRemote();
      return;
    }

    // Round banners: end-phase keeps explosions/popups animating only;
    // intro-phase lets the spawn stars spin while the duel is frozen.
    if (this.gameState === GameState.ROUND_END) {
      soundManager.stopEngineSound();
      this.updateEffects();
      if (this.onNetworkSync && this.localRole === 'host' && this.tickCount % 2 === 0) {
        this.onNetworkSync(this.getNetworkSnapshot());
      }
      return;
    }
    if (this.gameState === GameState.ROUND_INTRO) {
      soundManager.stopEngineSound();
      this.updateSpawningTanks();
      if (this.onNetworkSync && this.localRole === 'host' && this.tickCount % 2 === 0) {
        this.onNetworkSync(this.getNetworkSnapshot());
      }
      return;
    }

    // 1. Update Spawning Stars
    this.updateSpawningTanks();

    // 2. Enemy Spawner (keep up to 4 enemies alive)
    if (
      this.enemies.length + this.spawningTanks.filter((s) => !s.isPlayer).length < this.maxActiveEnemies &&
      this.enemyPool.length > 0
    ) {
      this.enemySpawnCooldown--;
      if (this.enemySpawnCooldown <= 0) {
        this.enemySpawnCooldown = 90; // 1.5 sec
        const nextType = this.enemyPool.shift();
        if (nextType) {
          this.spawnEnemy(nextType);
          this.scoreData.enemiesRemaining = [...this.enemyPool];
          this.onStateChange(this.gameState, this.scoreData);
        }
      }
    }

    // 3. Update Shovel (Steel bunker around base timer)
    if (this.shovelTimer > 0) {
      this.shovelTimer--;
      if (this.shovelTimer === 0) {
        // Revert steel bunker to brick
        this.revertShovelBunker();
      }
    }

    // 4. Update Freeze Enemies Timer
    if (this.freezeEnemiesTimer > 0) {
      this.freezeEnemiesTimer--;
    }

    // 5. Update Player Tanks (All active players)
    for (const slot of this.playerTanks.keys()) {
      this.updatePlayerSlot(slot);
    }

    // 6. Update Enemy Tanks
    if (this.freezeEnemiesTimer <= 0) {
      this.updateEnemies();
    }

    // Active anti-entanglement & separation pass
    this.resolveTankIntersections();

    // 7. Update Bullets
    this.updateBullets();

    // 8. Update Power-Ups
    this.updatePowerUps();

    // 8b. Update Tactical Pickups & Active Entities
    this.updateTacticalEntities();

    // 9. Update Explosions & Score Popups
    this.updateEffects();

    // 10. Engine Sound
    let isPlayerDriving = false;
    let activeTerrain: 'normal' | 'mud' | 'ice' = 'normal';
    for (const p of this.playerTanks.values()) {
      if (p && p.moving) {
        isPlayerDriving = true;
        const centerC = Math.floor((p.x + 16) / BLOCK_SIZE);
        const centerR = Math.floor((p.y + 16) / BLOCK_SIZE);
        const tile = this.grid[centerR]?.[centerC];
        if (tile) {
          if (tile.type === TileType.MUD) activeTerrain = 'mud';
          else if (tile.type === TileType.ICE) activeTerrain = 'ice';
        }
        break;
      }
    }
    soundManager.updateEngineSound(isPlayerDriving, activeTerrain);

    // 11. Check Victory / Stage Cleared (Single Player and Co-Op only)
    if (this.multiMode !== 'versus' && this.multiMode !== '2v2' && this.multiMode !== 'ffa') {
      if (
        this.enemyPool.length === 0 &&
        this.enemies.length === 0 &&
        this.spawningTanks.filter((s) => !s.isPlayer).length === 0 &&
        this.baseState === BaseState.ALIVE &&
        this.gameState === GameState.PLAYING
      ) {
        this.handleVictory();
      }
    }

    // 12. Network State Synchronization (Host broadcasts snapshot)
    if (this.onNetworkSync && this.localRole === 'host' && this.tickCount % 2 === 0) {
      this.onNetworkSync(this.getNetworkSnapshot());
    }
  }

  // --- Guest Thin-Client: interpolated view + own-tank prediction ---
  private updateRemote() {
    if (this.gameState !== GameState.PLAYING) {
      soundManager.stopEngineSound();
      for (const p of this.playerTanks.values()) {
        if (p) p.moving = false;
      }
      return;
    }

    // Sample view with adaptive jitter delay based on measured ping
    const adaptiveDelay = getAdaptiveDelay(this.lastPingMs);
    const view = this.snapBuffer.sample(adaptiveDelay);
    if (view) this.applyRemoteView(view);

    // Advance local predictive bullets & perform boundary/solid collision check
    const canvasLimit = this.canvasSize;
    const toRemoveIndices = new Set<number>();
    for (let i = 0; i < this.predictiveBullets.length; i++) {
      const pb = this.predictiveBullets[i];
      if (pb.direction === 'UP') pb.y -= pb.speed;
      else if (pb.direction === 'DOWN') pb.y += pb.speed;
      else if (pb.direction === 'LEFT') pb.x -= pb.speed;
      else if (pb.direction === 'RIGHT') pb.x += pb.speed;

      // Boundary collision check
      if (pb.x < 0 || pb.x > canvasLimit || pb.y < 0 || pb.y > canvasLimit) {
        this.createExplosion(pb.x, pb.y, false);
        if (pb.inputSeq !== undefined) this.retiredBulletSeqs.add(pb.inputSeq);
        toRemoveIndices.add(i);
        continue;
      }

      // Check solid tile collision (sub-quadrant brick / steel)
      const subX = Math.floor(pb.x / BLOCK_SIZE);
      const subY = Math.floor(pb.y / BLOCK_SIZE);
      const tile = this.grid[subY]?.[subX];
      if (tile && (tile.type === TileType.STEEL || (tile.type === TileType.BRICK && tile.damageMask !== 0))) {
        this.createExplosion(pb.x, pb.y, false);
        if (tile.type === TileType.STEEL) {
          soundManager.playHitSteel();
        } else {
          soundManager.playExplosion();
          this.applyBrickDamage(tile, pb.direction);
        }
        if (pb.inputSeq !== undefined) this.retiredBulletSeqs.add(pb.inputSeq);
        toRemoveIndices.add(i);
        continue;
      }

      // Check collision with opponent player tanks
      const mySlot = this.localPlayerSlot || 2;
      for (const [slot, otherTank] of this.playerTanks.entries()) {
        if (slot !== mySlot && otherTank && otherTank.hp > 0) {
          if (this.rectIntersect(pb.x - 2, pb.y - 2, 8, 8, otherTank.x, otherTank.y, 32, 32)) {
            this.createExplosion(pb.x, pb.y, otherTank.shieldTimer <= 0);
            soundManager.playExplosion();
            if (pb.inputSeq !== undefined) this.retiredBulletSeqs.add(pb.inputSeq);
            toRemoveIndices.add(i);
            break;
          }
        }
      }
    }
    if (toRemoveIndices.size > 0) {
      this.predictiveBullets = this.predictiveBullets.filter((_, idx) => !toRemoveIndices.has(idx));
    }
    if (this.retiredBulletSeqs.size > 120) {
      this.retiredBulletSeqs.clear();
    }

    // Client-side prediction for the local player's own slot (reconcile is triggered by authoritative snapshots)
    if (this.gameState === GameState.PLAYING) {
      const mySlot = this.localPlayerSlot || 2;
      this.updatePlayerSlot(mySlot);
    }

    // Update Explosions, Mud Splatters, and Popups so they animate & cleanly vanish (no stuck sparks!)
    this.updateEffects();

    let driving = false;
    let remoteTerrain: 'normal' | 'mud' | 'ice' = 'normal';
    for (const p of this.playerTanks.values()) {
      if (p && p.moving) {
        driving = true;
        const centerC = Math.floor((p.x + 16) / BLOCK_SIZE);
        const centerR = Math.floor((p.y + 16) / BLOCK_SIZE);
        const tile = this.grid[centerR]?.[centerC];
        if (tile) {
          if (tile.type === TileType.MUD) remoteTerrain = 'mud';
          else if (tile.type === TileType.ICE) remoteTerrain = 'ice';
        }
        break;
      }
    }
    soundManager.updateEngineSound(driving, remoteTerrain);
  }

  private applyRemoteView(view: NetSnapshot) {
    if (Array.isArray(view.players)) {
      const activeSlots = new Set<number>();
      for (const p of view.players) {
        const slot = ((p as any).pIdx || (p as any).slot || 1) as number;
        activeSlots.add(slot);
        let tank = this.playerTanks.get(slot);
        if (!tank) {
          tank = this.createPlayerTank(p.x as number, p.y as number, slot);
          this.playerTanks.set(slot, tank);
        }
        if (slot !== this.localPlayerSlot) {
          const prevX = tank.x;
          const prevY = tank.y;
          tank.x = p.x as number;
          tank.y = p.y as number;
          tank.direction = p.dir as Direction;
          tank.moving = p.moving as boolean;
          tank.tier = (p.tier as number) || 0;
          tank.shieldTimer = (p.shield as number) || 0;
          tank.distanceTraveled += Math.abs(tank.x - prevX) + Math.abs(tank.y - prevY);
        }
      }
      for (const slot of Array.from(this.playerTanks.keys())) {
        if (!activeSlots.has(slot)) {
          this.playerTanks.delete(slot);
        }
      }
    } else {
      if (view.p1) {
        if (!this.player) this.player = this.createPlayerTank(view.p1.x as number, view.p1.y as number, 1);
        const prevX = this.player.x;
        const prevY = this.player.y;
        this.player.x = view.p1.x as number;
        this.player.y = view.p1.y as number;
        this.player.direction = view.p1.dir as Direction;
        this.player.moving = view.p1.moving as boolean;
        this.player.tier = view.p1.tier as number;
        this.player.shieldTimer = view.p1.shield as number;
        this.player.distanceTraveled += Math.abs(this.player.x - prevX) + Math.abs(this.player.y - prevY);
      } else {
        this.player = null;
      }

      if (view.p2) {
        if (!this.player2) this.player2 = this.createPlayerTank(view.p2.x as number, view.p2.y as number, 2);
      } else {
        this.player2 = null;
      }
    }

    const previous = new Map(this.enemies.map((e) => [e.id, e]));
    this.enemies = view.enemies.map((e) => {
      const old = previous.get(e.id);
      const dist = old ? Math.abs(e.x - old.x) + Math.abs(e.y - old.y) : 0;
      return {
        id: e.id,
        isPlayer: false,
        type: e.type as EnemyType,
        x: e.x,
        y: e.y,
        direction: e.dir as Direction,
        desiredDirection: null,
        speed: 1.2,
        moving: e.moving as boolean,
        distanceTraveled: ((old?.distanceTraveled as number) ?? 0) + dist,
        tier: 0,
        maxHp: e.maxHp as number,
        hp: e.hp as number,
        isFlashingBonus: e.isFlashingBonus as boolean,
        shieldTimer: 0,
        slideFrames: 0,
        shootCooldown: 0,
        bulletSpeed: 3.5,
      } as Tank;
    });

    // Authoritative bullets from snapshot
    const mySlot = this.localPlayerSlot || 2;
    const activePredSeqs = new Set(
      this.predictiveBullets.map((pb) => pb.inputSeq).filter((seq): seq is number => seq !== undefined)
    );

    const remoteBullets: Bullet[] = [];
    for (const b of view.bullets) {
      const bSlot = (b as any).pIdx || (b as any).playerIndex;
      const bSeq = (b as any).inputSeq;

      // If bullet belongs to local player:
      if (bSlot === mySlot) {
        // 1. If actively simulated locally or recently retired by exact inputSeq:
        if (bSeq !== undefined && (activePredSeqs.has(bSeq) || this.retiredBulletSeqs.has(bSeq))) {
          continue;
        }

        // 2. Spatial reconciliation: If we have an active predictive bullet heading in the same direction nearby,
        // hand off smoothly to the authoritative host bullet to prevent duplicate phantom bullets!
        const matchingPredIdx = this.predictiveBullets.findIndex(
          (pb) => pb.direction === b.dir && Math.hypot(pb.x - b.x, pb.y - b.y) < 96
        );
        if (matchingPredIdx !== -1) {
          const matched = this.predictiveBullets[matchingPredIdx];
          if (matched.inputSeq !== undefined) this.retiredBulletSeqs.add(matched.inputSeq);
          this.predictiveBullets.splice(matchingPredIdx, 1);
        }
      }

      remoteBullets.push({
        id: b.id,
        ownerId: '',
        isPlayer: b.isPlayer as boolean,
        playerIndex: bSlot as 1 | 2 | undefined,
        x: b.x,
        y: b.y,
        direction: b.dir as Direction,
        speed: 4.5,
        canDestroySteel: false,
        size: 4,
        inputSeq: bSeq,
      });
    }

    // Merge remote bullets with unconfirmed local predictive bullets, strictly enforcing player max bullets
    const localTank = this.playerTanks.get(mySlot) || (mySlot === 1 ? this.player : this.player2);
    const maxLocalBullets = (localTank?.tier ?? 0) >= 2 ? 2 : 1;
    const remoteMyBulletsCount = remoteBullets.filter((b) => b.playerIndex === mySlot).length;
    const allowedPredBullets = Math.max(0, maxLocalBullets - remoteMyBulletsCount);
    const trimmedPredictive = this.predictiveBullets.slice(0, allowedPredBullets);

    this.bullets = [...remoteBullets, ...trimmedPredictive];

    this.powerUps = view.powerUps.map(
      (p) => ({ id: p.id, type: p.type, x: p.x, y: p.y, flashFrame: 0, duration: 900 }) as PowerUp
    );

    this.spawningTanks = (view.spawning || []).map(
      (s) =>
        ({
          id: s.id,
          isPlayer: s.isPlayer as boolean,
          playerIndex: s.pIdx as 1 | 2 | undefined,
          type: 'BASIC' as EnemyType,
          x: s.x,
          y: s.y,
          direction: 'UP' as Direction,
          progress: s.progress as number,
        }) as SpawningTank
    );

    if (view.baseState !== undefined) {
      this.baseState = view.baseState as BaseState;
      if (this.bases.get('A')) this.bases.get('A')!.state = this.baseState;
    }
    if (view.baseStateB !== undefined) {
      this.baseStateB = view.baseStateB as BaseState;
      if (this.bases.get('B')) this.bases.get('B')!.state = this.baseStateB;
    }
  }

  public reconcileAndReplay(
    slot: number,
    ackSeq: number,
    auth: { x: number; y: number; dir: Direction; moving?: boolean } | null
  ) {
    if (!auth) return;
    const tank = this.playerTanks.get(slot);
    if (!tank) return;

    // 1. Discard acknowledged inputs
    this.pendingInputs = this.pendingInputs.filter((item) => item.seq > ackSeq);

    // 2. Start replay from authoritative state
    const replayTank: Tank = {
      ...tank,
      x: auth.x,
      y: auth.y,
      direction: auth.dir,
      moving: Boolean(auth.moving),
      slideFrames: 0,
    };

    // 3. Replay all unacknowledged inputs
    for (const item of this.pendingInputs) {
      this.simulatePlayerMovement(replayTank, item.input);
    }

    // 4. Compare replayed position with current predicted position
    const dx = replayTank.x - tank.x;
    const dy = replayTank.y - tank.y;
    const drift = Math.abs(dx) + Math.abs(dy);

    // Deadzone + Soft decay (Source Engine / Gambetta standard)
    if (drift > 20.0) {
      // Hard desync (obstacle/wall collision difference) -> snap to authoritative
      tank.x = replayTank.x;
      tank.y = replayTank.y;
      tank.direction = replayTank.direction;
      tank.moving = replayTank.moving;
      tank.slideFrames = replayTank.slideFrames;
    } else if (drift > 3.0) {
      // Soft drift: smooth decay without jarring visual snaps
      tank.x += dx * 0.25;
      tank.y += dy * 0.25;
      tank.direction = replayTank.direction;
      tank.moving = replayTank.moving;
    }
    // drift <= 3.0: within sub-pixel corridor tolerance, no correction needed!
  }

  public applyBrickDamage(tile: SubTile, dir: Direction) {
    if (!tile || tile.type !== TileType.BRICK || tile.damageMask === 0) return;
    this.gridVersion++;
    if (dir === 'UP') {
      if (tile.damageMask & 12) tile.damageMask &= ~12;
      else tile.damageMask &= ~3;
    } else if (dir === 'DOWN') {
      if (tile.damageMask & 3) tile.damageMask &= ~3;
      else tile.damageMask &= ~12;
    } else if (dir === 'LEFT') {
      if (tile.damageMask & 10) tile.damageMask &= ~10;
      else tile.damageMask &= ~5;
    } else if (dir === 'RIGHT') {
      if (tile.damageMask & 5) tile.damageMask &= ~5;
      else tile.damageMask &= ~10;
    }
    if (tile.damageMask === 0) {
      tile.type = TileType.EMPTY;
    }
  }

  // Discrete events relayed from the host drive guest-side sound & effects
  public handleRemoteEvent(ev: { t?: string; x?: number; y?: number; big?: boolean }) {
    if (!ev || !ev.t || !this.isRemoteViewer) return;
    switch (ev.t) {
      case 'boom':
        this.createExplosion(ev.x ?? 0, ev.y ?? 0, Boolean(ev.big));
        if (ev.big) soundManager.playBigExplosion();
        else soundManager.playExplosion();
        break;
      case 'shoot':
        soundManager.playShoot();
        break;
      case 'brick':
        soundManager.playHitBrick();
        break;
      case 'steel':
        soundManager.playHitSteel();
        break;
      case 'pickup':
        soundManager.playPowerUpCollect();
        break;
      case 'pspawn':
        soundManager.playPowerUpSpawn();
        break;
      case 'map_sync':
        if (Array.isArray((ev as any).grid) && typeof (ev as any).gv === 'number') {
          this.decodeGrid((ev as any).grid, (ev as any).gv, (ev as any).gs);
        }
        if (typeof (ev as any).round === 'number') {
          const newRound = (ev as any).round;
          this.scoreData.roundNumber = newRound;
          if (!this.hasCustomMap && this.multiMode === 'versus') {
            const preset: MapSizePreset = this.gridSize === 42 ? 'giant' : this.gridSize === 34 ? 'large' : 'classic';
            this.currentMap = getStageMapForPresetAndStage(newRound, preset, this.multiMode);
          }
          this.onStateChange(this.gameState, this.scoreData);
        }
        break;
    }
  }

  private emitNetEvent(ev: Record<string, unknown>) {
    if (this.onGameEventBroadcast) this.onGameEventBroadcast(ev);
  }

  private encodeGrid(): number[] {
    const out: number[] = [];
    for (let r = 0; r < this.gridSize; r++) {
      for (let c = 0; c < this.gridSize; c++) {
        const cell = this.grid[r]?.[c];
        out.push(cell ? cell.type * 16 + cell.damageMask : 0);
      }
    }
    return out;
  }

  private decodeGrid(flat: number[], version: number, hostGridSize?: number) {
    const size = hostGridSize && hostGridSize > 0 ? hostGridSize : this.gridSize;
    if (!Array.isArray(flat) || flat.length < size * size) return;
    if (size !== this.gridSize || !this.grid || this.grid.length !== size) {
      this.gridSize = size;
      this.canvasSize = size * BLOCK_SIZE;
      if (this.canvas && this.canvas.width !== this.canvasSize) {
        this.canvas.width = this.canvasSize;
        this.canvas.height = this.canvasSize;
      }
      this.grid = Array.from({ length: size }, () =>
        Array.from({ length: size }, () => ({ type: TileType.EMPTY, damageMask: 15 }))
      );
    }
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        const v = flat[r * size + c] | 0;
        this.grid[r][c] = { type: Math.floor(v / 16) as TileType, damageMask: v % 16 };
      }
    }
    this.gridVersion = version;
  }

  /** Advances spawn stars and materializes their tanks (used live and in round intros). */
  private updateSpawningTanks() {
    for (let i = this.spawningTanks.length - 1; i >= 0; i--) {
      const sp = this.spawningTanks[i];
      sp.progress += 0.025; // ~40 frames
      if (sp.progress >= 1) {
        if (sp.isPlayer) {
          const idx = sp.playerIndex || 1;
          const tank = this.createPlayerTank(sp.x, sp.y, idx);
          this.playerTanks.set(idx, tank);
          this.spawningTanks.splice(i, 1);
        } else {
          // Verify that spawn point is clear of other tanks before materializing
          const isBlocked =
            Array.from(this.playerTanks.values()).some((p) => p && this.rectIntersect(sp.x, sp.y, 32, 32, p.x, p.y, 32, 32)) ||
            this.enemies.some((e) => this.rectIntersect(sp.x, sp.y, 32, 32, e.x, e.y, 32, 32));

          if (isBlocked) {
            // Keep spawning star flashing until blocking tank moves away
            sp.progress = 0.85;
            continue;
          }

          const enemy = this.createEnemyTank(
            sp.type as EnemyType,
            sp.x,
            sp.y,
            Boolean(sp.isFlashingBonus)
          );
          this.enemies.push(enemy);
          this.spawningTanks.splice(i, 1);
        }
      }
    }
  }

  // --- Slot-based Player Physics (All Players 1..8) ---
  private updatePlayerSlot(slot: number) {
    const tank = this.playerTanks.get(slot);
    if (!tank) return;

    if (tank.shieldTimer > 0) {
      tank.shieldTimer--;
    }
    if (tank.shootCooldown > 0) {
      tank.shootCooldown--;
    }

    const slotInput = this.playerInputs.get(slot);
    const input =
      slot === 1
        ? {
            up: Boolean(this.currentInput.up || slotInput?.up),
            down: Boolean(this.currentInput.down || slotInput?.down),
            left: Boolean(this.currentInput.left || slotInput?.left),
            right: Boolean(this.currentInput.right || slotInput?.right),
            fire: Boolean(this.currentInput.fire || slotInput?.fire),
            pause: Boolean(this.currentInput.pause || slotInput?.pause),
            smoke: Boolean(this.currentInput.smoke || slotInput?.smoke),
            grenade: Boolean(this.currentInput.grenade || slotInput?.grenade),
            shield: Boolean(this.currentInput.shield || slotInput?.shield),
          }
        : (slotInput || {
            up: false,
            down: false,
            left: false,
            right: false,
            fire: false,
            pause: false,
            smoke: false,
            grenade: false,
            shield: false,
          });

    const prevFire = this.prevPlayerFire.get(slot) || false;
    const fireRequested = input.fire;
    if (fireRequested && (!prevFire || tank.tier >= 2)) {
      if (tank.shootCooldown <= 0) {
        if (this.isRemoteViewer && slot === this.localPlayerSlot) {
          this.firePredictiveBullet(tank, this.lastSentSeq);
        } else {
          this.fireBullet(tank, this.hostSlotInputSeq.get(slot));
        }
        tank.shootCooldown = tank.tier >= 2 ? 14 : 22;
      }
    }
    this.prevPlayerFire.set(slot, fireRequested);

    // Tactical Abilities Trigger (Edge-triggered per slot)
    const prevTac = this.prevTacticalInputs.get(slot) || { smoke: false, grenade: false, shield: false };
    if (input.smoke && !prevTac.smoke) {
      this.triggerSmokeAction(tank);
    }
    if (input.grenade && !prevTac.grenade) {
      this.triggerGrenadeAction(tank);
    }
    if (input.shield && !prevTac.shield) {
      this.triggerShieldAction(tank);
    }
    this.prevTacticalInputs.set(slot, {
      smoke: Boolean(input.smoke),
      grenade: Boolean(input.grenade),
      shield: Boolean(input.shield),
    });

    this.simulatePlayerMovement(tank, input);
  }

  public simulatePlayerMovement(tank: Tank, input: InputState): void {
    let dir: Direction | null = null;
    if (input.up) dir = 'UP';
    else if (input.down) dir = 'DOWN';
    else if (input.left) dir = 'LEFT';
    else if (input.right) dir = 'RIGHT';

    const isOnIce = this.isTankOnTileType(tank, TileType.ICE);
    const isOnMud = this.isTankOnTileType(tank, TileType.MUD);

    if (dir) {
      tank.direction = dir;
      // Moving on mud heavily reduces speed by ~58% (speed factor 0.42)
      const currentSpeed = isOnMud ? tank.speed * 0.42 : tank.speed;
      this.moveTankWithCorridorSnap(tank, dir, currentSpeed);
      tank.moving = true;

      if (isOnMud) {
        this.spawnMudParticles(tank);
        tank.slideFrames = 0; // Mud halts all sliding inertia
      } else if (isOnIce) {
        tank.slideFrames = 26; // ~0.43s of smooth retro ice momentum
        tank.slideDirection = dir;
      } else {
        tank.slideFrames = 0;
      }
    } else if (tank.slideFrames > 0) {
      // Keys released: continue gliding with smooth inertia & deceleration!
      const slideDir = tank.slideDirection || tank.direction;
      if (isOnMud) {
        tank.slideFrames = 0;
        tank.moving = false;
      } else {
        const progress = tank.slideFrames / 26;
        // Smooth deceleration curve: from ~85% speed down to ~15% before stopping
        const slideSpeed = tank.speed * (0.15 + 0.70 * progress) * (isOnIce ? 0.85 : 0.45);
        const moved = this.moveTankWithCorridorSnap(tank, slideDir, slideSpeed);
        tank.direction = slideDir;
        tank.distanceTraveled += slideSpeed * 0.5; // Smooth tread animation while sliding
        tank.moving = true;

        // If slid off ice onto regular terrain, friction decelerates twice as fast
        tank.slideFrames -= (isOnIce ? 1 : 2);

        if (!moved || tank.slideFrames <= 0) {
          tank.slideFrames = 0;
          tank.moving = false;
        }
      }
    } else {
      tank.moving = false;
      tank.slideFrames = 0;
    }
  }

  public firePredictiveBullet(tank: Tank, seq?: number): Bullet | null {
    if (!tank || !tank.direction) return null;
    const maxBullets = tank.tier >= 2 ? 2 : 1;
    const mySlot = tank.playerIndex ?? this.localPlayerSlot;
    const currentCount = this.bullets.filter(
      (b) => b.ownerId === tank.id || b.playerIndex === mySlot
    ).length;
    if (currentCount >= maxBullets) return null;

    let bx = tank.x + 16;
    let by = tank.y + 16;
    if (tank.direction === 'UP') by = tank.y - 2;
    else if (tank.direction === 'DOWN') by = tank.y + 34;
    else if (tank.direction === 'LEFT') bx = tank.x - 2;
    else if (tank.direction === 'RIGHT') bx = tank.x + 34;

    const bullet: Bullet = {
      id: 'pred_bullet_' + (seq ?? Math.random()),
      ownerId: tank.id,
      isPlayer: true,
      playerIndex: mySlot as 1 | 2 | undefined,
      team: tank.team,
      x: bx,
      y: by,
      direction: tank.direction,
      speed: tank.bulletSpeed,
      canDestroySteel: tank.tier >= 3,
      size: 4,
      inputSeq: seq,
      isPredicted: true,
    };

    this.predictiveBullets.push(bullet);
    this.bullets.push(bullet);
    soundManager.playShoot();
    return bullet;
  }

  private updatePlayer() {
    this.updatePlayerSlot(1);
  }

  private updatePlayer2() {
    this.updatePlayerSlot(2);
  }

  // --- Multi-point Check if any part of the tank treads occupies a specific TileType ---
  public isTankOnTileType(tank: Tank, type: TileType): boolean {
    if (!tank) return false;
    const minC = Math.floor((tank.x + 4) / BLOCK_SIZE);
    const maxC = Math.floor((tank.x + 27) / BLOCK_SIZE);
    const minR = Math.floor((tank.y + 4) / BLOCK_SIZE);
    const maxR = Math.floor((tank.y + 27) / BLOCK_SIZE);

    for (let r = minR; r <= maxR; r++) {
      if (r < 0 || r >= this.gridSize) continue;
      for (let c = minC; c <= maxC; c++) {
        if (c < 0 || c >= this.gridSize) continue;
        if (this.grid[r][c].type === type) {
          return true;
        }
      }
    }
    return false;
  }

  // --- Authentic 8-bit Mud Splatter Particles ---
  private spawnMudParticles(tank: Tank) {
    if (Math.random() > 0.45) return;
    if (this.mudParticles.length > 80) return;

    const colors = ['#261507', '#382010', '#502d15', '#6d401e', '#764522'];
    const isLeftTrack = Math.random() < 0.5;
    let trackOffsetX = isLeftTrack ? 5 : 23;
    let trackOffsetY = 16;

    let baseVx = 0;
    let baseVy = 0;
    if (tank.direction === 'UP') {
      trackOffsetY = 28;
      baseVy = Math.random() * 0.8 + 0.3;
      baseVx = (Math.random() - 0.5) * 0.6;
    } else if (tank.direction === 'DOWN') {
      trackOffsetY = 4;
      baseVy = -(Math.random() * 0.8 + 0.3);
      baseVx = (Math.random() - 0.5) * 0.6;
    } else if (tank.direction === 'LEFT') {
      trackOffsetX = 28;
      trackOffsetY = isLeftTrack ? 5 : 23;
      baseVx = Math.random() * 0.8 + 0.3;
      baseVy = (Math.random() - 0.5) * 0.6;
    } else if (tank.direction === 'RIGHT') {
      trackOffsetX = 4;
      trackOffsetY = isLeftTrack ? 5 : 23;
      baseVx = -(Math.random() * 0.8 + 0.3);
      baseVy = (Math.random() - 0.5) * 0.6;
    }

    this.mudParticles.push({
      id: Math.random().toString(),
      x: tank.x + trackOffsetX,
      y: tank.y + trackOffsetY,
      vx: baseVx,
      vy: baseVy,
      size: Math.random() < 0.5 ? 2 : 3,
      color: colors[Math.floor(Math.random() * colors.length)],
      life: Math.floor(Math.random() * 8 + 8),
      maxLife: 16,
    });
  }

  // --- Smooth Corridor Corner-Snapping (Authentic NES Navigation) ---
  // When a tank tries to turn into a corridor, snap perpendicular axis to 16px grid safely
  private moveTankWithCorridorSnap(tank: Tank, dir: Direction, speed: number): boolean {
    if (!tank || !dir) return false;
    const originalX = tank.x;
    const originalY = tank.y;
    const snapThreshold = 6; // px margin to auto-align into 16px sub-tiles

    if (dir === 'UP' || dir === 'DOWN') {
      // Auto-align X coordinate to nearest 16px column
      const remainderX = tank.x % BLOCK_SIZE;
      let snapX = tank.x;
      if (remainderX > 0 && remainderX <= snapThreshold) {
        snapX = tank.x - Math.min(remainderX, 1.5);
      } else if (remainderX >= BLOCK_SIZE - snapThreshold) {
        snapX = tank.x + Math.min(BLOCK_SIZE - remainderX, 1.5);
      }
      // Apply snap only if it is completely clear of obstacles and other tanks
      if (snapX !== tank.x && this.canTankMoveTo(tank, snapX, tank.y)) {
        tank.x = snapX;
      }
    } else if (dir === 'LEFT' || dir === 'RIGHT') {
      // Auto-align Y coordinate to nearest 16px row
      const remainderY = tank.y % BLOCK_SIZE;
      let snapY = tank.y;
      if (remainderY > 0 && remainderY <= snapThreshold) {
        snapY = tank.y - Math.min(remainderY, 1.5);
      } else if (remainderY >= BLOCK_SIZE - snapThreshold) {
        snapY = tank.y + Math.min(BLOCK_SIZE - remainderY, 1.5);
      }
      // Apply snap only if it is completely clear of obstacles and other tanks
      if (snapY !== tank.y && this.canTankMoveTo(tank, tank.x, snapY)) {
        tank.y = snapY;
      }
    }

    // Try move in desired direction
    let nextX = tank.x;
    let nextY = tank.y;

    if (dir === 'UP') nextY -= speed;
    else if (dir === 'DOWN') nextY += speed;
    else if (dir === 'LEFT') nextX -= speed;
    else if (dir === 'RIGHT') nextX += speed;

    // Check collision with boundary, tiles, and other tanks
    if (this.canTankMoveTo(tank, nextX, nextY)) {
      tank.x = nextX;
      tank.y = nextY;
      tank.distanceTraveled += speed;
    } else {
      // Partial step if blocked
      const step = speed * 0.5;
      let partialX = tank.x;
      let partialY = tank.y;
      if (dir === 'UP') partialY -= step;
      else if (dir === 'DOWN') partialY += step;
      else if (dir === 'LEFT') partialX -= step;
      else if (dir === 'RIGHT') partialX += step;

      if (this.canTankMoveTo(tank, partialX, partialY)) {
        tank.x = partialX;
        tank.y = partialY;
        tank.distanceTraveled += step;
      }
    }

    return tank.x !== originalX || tank.y !== originalY;
  }

  // --- World Bounds & Tile Collision Check ---
  public canTankOccupyTiles(targetX: number, targetY: number): boolean {
    const size = 32;
    // World bounds
    if (targetX < 0 || targetX + size > this.canvasSize || targetY < 0 || targetY + size > this.canvasSize) {
      return false;
    }

    // Snug bounding box with 2px padding for tight 16px corridor clearance
    const pad = 2;
    const boxX = targetX + pad;
    const boxY = targetY + pad;
    const boxW = size - pad * 2;
    const boxH = size - pad * 2;

    const startC = Math.floor(boxX / BLOCK_SIZE);
    const endC = Math.floor((boxX + boxW - 0.1) / BLOCK_SIZE);
    const startR = Math.floor(boxY / BLOCK_SIZE);
    const endR = Math.floor((boxY + boxH - 0.1) / BLOCK_SIZE);

    for (let r = startR; r <= endR; r++) {
      for (let c = startC; c <= endC; c++) {
        const tile = this.grid[r]?.[c];
        if (!tile) continue;

        // Impassable tiles: BRICK, STEEL, WATER, BASE
        if (tile.type === TileType.BRICK && tile.damageMask > 0) return false;
        if (tile.type === TileType.STEEL) return false;
        if (tile.type === TileType.WATER) return false;
        if (tile.type === TileType.BASE) return false;
        // TREES and ICE are passable
      }
    }
    return true;
  }

  // --- Tank vs Tank Collision with Separation Allowance ---
  // If two tanks are already touching/overlapping, any movement that SEPARATES them is ALLOWED.
  // Only moves that increase penetration or move into a new tank are blocked.
  private isTankBlockedByOtherTank(
    tank: Tank,
    targetX: number,
    targetY: number,
    other: Tank
  ): boolean {
    if (!other || other.id === tank.id) return false;

    const size = 32;
    const pad = 1; // 30x30 bounding box prevents visual overlap while fitting in 32px corridors
    const boxW = size - pad * 2;
    const boxH = size - pad * 2;

    const targetX1 = targetX + pad;
    const targetY1 = targetY + pad;
    const otherX1 = other.x + pad;
    const otherY1 = other.y + pad;

    // Check if target position intersects the other tank
    const overlapsTarget = this.rectIntersect(
      targetX1,
      targetY1,
      boxW,
      boxH,
      otherX1,
      otherY1,
      boxW,
      boxH
    );

    if (!overlapsTarget) {
      return false; // Target is completely clear of this tank
    }

    // Target DOES intersect. Check if current position was ALREADY intersecting:
    const currentX1 = tank.x + pad;
    const currentY1 = tank.y + pad;
    const overlapsCurrent = this.rectIntersect(
      currentX1,
      currentY1,
      boxW,
      boxH,
      otherX1,
      otherY1,
      boxW,
      boxH
    );

    if (overlapsCurrent) {
      // Calculate current overlap area vs proposed target overlap area
      const curOverX = Math.max(0, Math.min(currentX1 + boxW, otherX1 + boxW) - Math.max(currentX1, otherX1));
      const curOverY = Math.max(0, Math.min(currentY1 + boxH, otherY1 + boxH) - Math.max(currentY1, otherY1));
      const curArea = curOverX * curOverY;

      const tarOverX = Math.max(0, Math.min(targetX1 + boxW, otherX1 + boxW) - Math.max(targetX1, otherX1));
      const tarOverY = Math.max(0, Math.min(targetY1 + boxH, otherY1 + boxH) - Math.max(targetY1, otherY1));
      const tarArea = tarOverX * tarOverY;

      // If moving to target REDUCES overlap area (moving away), ALLOW it!
      // This guarantees tanks can ALWAYS pull apart and disentangle!
      if (tarArea < curArea - 0.01) {
        return false;
      }
    }

    return true; // Blocked: movement penetrates or maintains collision
  }

  // --- Collision Matrix for Tanks ---
  private canTankMoveTo(tank: Tank, targetX: number, targetY: number): boolean {
    if (!tank) return false;

    // 1. World Bounds & Tiles
    if (!this.canTankOccupyTiles(targetX, targetY)) {
      return false;
    }

    // 2. Tank vs Tank
    if (tank.isPlayer) {
      for (const otherPlayer of this.playerTanks.values()) {
        if (otherPlayer && otherPlayer !== tank) {
          if (this.isTankBlockedByOtherTank(tank, targetX, targetY, otherPlayer)) {
            return false;
          }
        }
      }
      for (const enemy of this.enemies) {
        if (this.isTankBlockedByOtherTank(tank, targetX, targetY, enemy)) {
          return false;
        }
      }
    } else {
      for (const p of this.playerTanks.values()) {
        if (p && this.isTankBlockedByOtherTank(tank, targetX, targetY, p)) {
          return false;
        }
      }
      for (const other of this.enemies) {
        if (this.isTankBlockedByOtherTank(tank, targetX, targetY, other)) {
          return false;
        }
      }
    }

    return true;
  }

  // --- Active Anti-Entanglement & Depenetration Pass ---
  // Guarantees no two tanks ever stay stuck or overlapping inside each other
  private resolveTankIntersections() {
    const allTanks: Tank[] = [];
    for (const p of this.playerTanks.values()) {
      if (p) allTanks.push(p);
    }
    for (const enemy of this.enemies) {
      if (enemy) allTanks.push(enemy);
    }

    const size = 32;
    const pad = 1;
    const boxW = size - pad * 2;
    const boxH = size - pad * 2;

    for (let i = 0; i < allTanks.length; i++) {
      for (let j = i + 1; j < allTanks.length; j++) {
        const a = allTanks[i];
        const b = allTanks[j];

        const aX = a.x + pad;
        const aY = a.y + pad;
        const bX = b.x + pad;
        const bY = b.y + pad;

        const overlapX = Math.min(aX + boxW, bX + boxW) - Math.max(aX, bX);
        const overlapY = Math.min(aY + boxH, bY + boxH) - Math.max(aY, bY);

        if (overlapX > 0 && overlapY > 0) {
          // Overlap detected! Separate tanks along shallowest penetration axis
          if (overlapX < overlapY) {
            const push = overlapX;
            const dirX = a.x < b.x ? -1 : 1;
            this.nudgeTank(a, (dirX * push) / 2, 0);
            this.nudgeTank(b, (-dirX * push) / 2, 0);
          } else {
            const push = overlapY;
            const dirY = a.y < b.y ? -1 : 1;
            this.nudgeTank(a, 0, (dirY * push) / 2);
            this.nudgeTank(b, 0, (-dirY * push) / 2);
          }
        }
      }
    }
  }

  private nudgeTank(tank: Tank, dx: number, dy: number) {
    const targetX = Math.max(0, Math.min(this.canvasSize - 32, tank.x + dx));
    const targetY = Math.max(0, Math.min(this.canvasSize - 32, tank.y + dy));

    if (this.canTankOccupyTiles(targetX, targetY)) {
      tank.x = targetX;
      tank.y = targetY;
    }
  }

  // --- Enemy AI ---
  private updateEnemies() {
    for (const enemy of this.enemies) {
      if (!enemy || !enemy.direction) continue;
      if (enemy.shieldTimer > 0) enemy.shieldTimer--;

      // AI Decision Timer
      if (!enemy.aiChangeDirTimer || enemy.aiChangeDirTimer <= 0) {
        enemy.aiChangeDirTimer = Math.floor(Math.random() * 60 + 40);

        // Smart steering: Bias towards Eagle Base or Player (blinded if player in smoke)
        const baseTargetX = this.baseX + 16;
        const baseTargetY = this.baseY;
        const canTargetPlayer = this.player && !this.player.inSmoke;
        const targetX = canTargetPlayer && Math.random() >= 0.6 ? this.player!.x : baseTargetX;
        const targetY = canTargetPlayer && Math.random() >= 0.6 ? this.player!.y : baseTargetY;

        const dirs: Direction[] = ['UP', 'DOWN', 'LEFT', 'RIGHT'];
        const weights = [1, 2, 1, 1]; // Down has natural bias

        if (targetY > enemy.y) weights[1] += 3; // DOWN
        if (targetY < enemy.y) weights[0] += 2; // UP
        if (targetX > enemy.x) weights[3] += 2; // RIGHT
        if (targetX < enemy.x) weights[2] += 2; // LEFT

        // Pick weighted direction
        const totalWeight = weights.reduce((a, b) => a + b, 0);
        let roll = Math.random() * totalWeight;
        let chosenDir = dirs[0];
        for (let i = 0; i < dirs.length; i++) {
          if (roll < weights[i]) {
            chosenDir = dirs[i];
            break;
          }
          roll -= weights[i];
        }
        enemy.direction = chosenDir;
      } else {
        enemy.aiChangeDirTimer--;
      }

      // Try move in current direction
      const prevX = enemy.x;
      const prevY = enemy.y;
      const isEnemyOnMud = this.isTankOnTileType(enemy, TileType.MUD);
      const enemySpeed = isEnemyOnMud ? enemy.speed * 0.42 : enemy.speed;
      if (isEnemyOnMud) {
        this.spawnMudParticles(enemy);
      }
      this.moveTankWithCorridorSnap(enemy, enemy.direction, enemySpeed);

      // If blocked, immediately turn towards an open path
      if (Math.abs(enemy.x - prevX) < 0.05 && Math.abs(enemy.y - prevY) < 0.05) {
        const allDirs: Direction[] = ['UP', 'DOWN', 'LEFT', 'RIGHT'];
        const openDirs = allDirs.filter((d) => {
          if (d === enemy.direction) return false;
          let testX = enemy.x;
          let testY = enemy.y;
          const testDist = 4;
          if (d === 'UP') testY -= testDist;
          else if (d === 'DOWN') testY += testDist;
          else if (d === 'LEFT') testX -= testDist;
          else if (d === 'RIGHT') testX += testDist;
          return this.canTankMoveTo(enemy, testX, testY);
        });

        if (openDirs.length > 0) {
          enemy.direction = openDirs[Math.floor(Math.random() * openDirs.length)];
        } else {
          const alternatives = allDirs.filter((d) => d !== enemy.direction);
          enemy.direction = alternatives[Math.floor(Math.random() * alternatives.length)];
        }
        enemy.aiChangeDirTimer = Math.floor(Math.random() * 45 + 30);
      }

      // Enemy Shooting
      if (!enemy.aiShootTimer || enemy.aiShootTimer <= 0) {
        enemy.aiShootTimer = Math.floor(Math.random() * 60 + 30);
        // Only fire if less than 1 bullet active for this enemy
        const enemyBulletCount = this.bullets.filter((b) => b.ownerId === enemy.id).length;
        if (enemyBulletCount < 1) {
          this.fireBullet(enemy);
        }
      } else {
        enemy.aiShootTimer--;
      }
    }
  }

  // --- Fire Bullet ---
  private fireBullet(tank: Tank, inputSeq?: number) {
    if (!tank || !tank.direction) return;
    // Max bullets check: Player tier 0-1 = 1 bullet; tier 2-3 = 2 bullets
    const maxBullets = tank.isPlayer ? (tank.tier >= 2 ? 2 : 1) : 1;
    const currentCount = this.bullets.filter((b) => b.ownerId === tank.id).length;
    if (currentCount >= maxBullets) return;

    let bx = tank.x + 16;
    let by = tank.y + 16;
    if (tank.direction === 'UP') by = tank.y - 2;
    else if (tank.direction === 'DOWN') by = tank.y + 34;
    else if (tank.direction === 'LEFT') bx = tank.x - 2;
    else if (tank.direction === 'RIGHT') bx = tank.x + 34;

    const bullet: Bullet = {
      id: 'bullet_' + Math.random(),
      ownerId: tank.id,
      isPlayer: tank.isPlayer,
      playerIndex: tank.playerIndex,
      team: tank.team,
      x: bx,
      y: by,
      direction: tank.direction,
      speed: tank.bulletSpeed,
      canDestroySteel: tank.isPlayer && tank.tier >= 3,
      size: 4,
      inputSeq,
    };

    this.bullets.push(bullet);
    if (tank.isPlayer) {
      soundManager.playShoot();
      this.emitNetEvent({ t: 'shoot' });
    }
  }

  // --- Bullet Physics & Destructible Quarters ---
  private updateBullets() {
    const bulletsToRemove = new Set<string>();

    // 1. Move bullets safely
    for (const bullet of this.bullets) {
      if (!bullet || !bullet.direction) continue;
      if (bullet.direction === 'UP') bullet.y -= bullet.speed;
      else if (bullet.direction === 'DOWN') bullet.y += bullet.speed;
      else if (bullet.direction === 'LEFT') bullet.x -= bullet.speed;
      else if (bullet.direction === 'RIGHT') bullet.x += bullet.speed;
    }

    // 2. Collision detection
    for (let bIdx = 0; bIdx < this.bullets.length; bIdx++) {
      const bullet = this.bullets[bIdx];
      if (!bullet || !bullet.direction || bulletsToRemove.has(bullet.id)) continue;

      // A. Boundary check
      if (bullet.x < 0 || bullet.x > this.canvasSize || bullet.y < 0 || bullet.y > this.canvasSize) {
        this.createExplosion(bullet.x, bullet.y, false);
        soundManager.playHitSteel();
        bulletsToRemove.add(bullet.id);
        continue;
      }

      // B. Bullet vs Bullet Collision
      let bulletCancelled = false;
      for (let oIdx = 0; oIdx < this.bullets.length; oIdx++) {
        if (oIdx === bIdx) continue;
        const other = this.bullets[oIdx];
        if (!other || !other.direction || bulletsToRemove.has(other.id)) continue;

        if (bullet.isPlayer !== other.isPlayer) {
          if (this.rectIntersect(bullet.x - 3, bullet.y - 3, 6, 6, other.x - 3, other.y - 3, 6, 6)) {
            this.createExplosion((bullet.x + other.x) / 2, (bullet.y + other.y) / 2, false);
            soundManager.playBulletClash();
            bulletsToRemove.add(bullet.id);
            bulletsToRemove.add(other.id);
            bulletCancelled = true;
            break;
          }
        }
      }
      if (bulletCancelled) continue;

      // C. Bullet vs Base Eagle (1v1 alternating single base / 2v2 dual base)
      if (this.multiMode !== 'ffa') {
        const southActive = this.multiMode !== 'versus' || this.vsDefenderSlot === 1;
        const northActive = this.multiMode === '2v2' || (this.multiMode === 'versus' && this.vsDefenderSlot === 2);
        // 1) Bullet vs South Base (Base A - Team A / Player 1)
        if (
          southActive &&
          this.baseState === BaseState.ALIVE &&
          this.rectIntersect(bullet.x - 3, bullet.y - 3, 6, 6, this.baseX, this.baseY, 32, 32)
        ) {
          if (this.multiMode === 'versus') {
            if (bullet.playerIndex === 1) {
              // Friendly fire protection: Player 1 cannot destroy own base
              soundManager.playHitSteel();
              this.createExplosion(bullet.x, bullet.y, false);
              bulletsToRemove.add(bullet.id);
              continue;
            } else {
              // Player 2 destroys Player 1's South Base -> Player 2 wins round
              this.destroyBase('A');
              bulletsToRemove.add(bullet.id);
              continue;
            }
          } else if (this.multiMode === '2v2') {
            if (bullet.team === 'A') {
              // Friendly fire protection: Team A cannot destroy own base
              soundManager.playHitSteel();
              this.createExplosion(bullet.x, bullet.y, false);
              bulletsToRemove.add(bullet.id);
              continue;
            } else {
              // Team B destroys Team A's South Base -> Team B wins round
              this.destroyBase('A');
              bulletsToRemove.add(bullet.id);
              continue;
            }
          } else {
            // Single Player & Co-op
            this.destroyBase('A');
            bulletsToRemove.add(bullet.id);
            continue;
          }
        }

        // 2) Bullet vs North Base (Base B - Team B / Player 2) in 1v1 and 2v2
        if (
          northActive &&
          this.baseStateB === BaseState.ALIVE &&
          this.rectIntersect(bullet.x - 3, bullet.y - 3, 6, 6, this.baseB_X, this.baseB_Y, 32, 32)
        ) {
          if (this.multiMode === 'versus') {
            if (bullet.playerIndex === 2) {
              // Friendly fire protection: Player 2 cannot destroy own base
              soundManager.playHitSteel();
              this.createExplosion(bullet.x, bullet.y, false);
              bulletsToRemove.add(bullet.id);
              continue;
            } else {
              // Player 1 destroys Player 2's North Base -> Player 1 wins round
              this.destroyBase('B');
              bulletsToRemove.add(bullet.id);
              continue;
            }
          } else if (this.multiMode === '2v2') {
            if (bullet.team === 'B') {
              // Friendly fire protection: Team B cannot destroy own base
              soundManager.playHitSteel();
              this.createExplosion(bullet.x, bullet.y, false);
              bulletsToRemove.add(bullet.id);
              continue;
            } else {
              // Team A destroys Team B's North Base -> Team A wins round
              this.destroyBase('B');
              bulletsToRemove.add(bullet.id);
              continue;
            }
          }
        }
      }

      // C2. Bullet vs Deployable Shields (3 hits, absorbs enemy bullets)
      let shieldHit = false;
      for (const shield of this.activeShields) {
        if (this.rectIntersect(bullet.x - 3, bullet.y - 3, 6, 6, shield.x, shield.y, shield.width, shield.height)) {
          const isFriendly = bullet.ownerId === shield.ownerId || (bullet.team && shield.team && bullet.team === shield.team && this.multiMode === '2v2');
          if (isFriendly) {
            // Friendly shot passes through the shield!
            continue;
          }
          shieldHit = true;
          shield.hp--;
          soundManager.playShieldHit();
          this.createExplosion(bullet.x, bullet.y, false);
          bulletsToRemove.add(bullet.id);
          if (shield.hp <= 0) {
            soundManager.playExplosion();
            this.createExplosion(shield.x + shield.width / 2, shield.y + shield.height / 2, false);
          }
          break;
        }
      }
      if (shieldHit) continue;

      // D. Bullet vs Tiles (Sub-quadrant brick chipping)
      let hitObstacle = false;
      const subX = Math.floor(bullet.x / BLOCK_SIZE);
      const subY = Math.floor(bullet.y / BLOCK_SIZE);

      // Check bullet neighborhood (current tile and adjacent edge tile)
      const tilesToCheck: [number, number][] = [
        [subY, subX],
        bullet.direction === 'UP' || bullet.direction === 'DOWN'
          ? [subY, Math.floor((bullet.x + 3) / BLOCK_SIZE)]
          : [Math.floor((bullet.y + 3) / BLOCK_SIZE), subX],
      ];

      for (const [r, c] of tilesToCheck) {
        if (r < 0 || r >= this.gridSize || c < 0 || c >= this.gridSize) continue;
        const tile = this.grid[r][c];
        if (!tile) continue;

        if (tile.type === TileType.STEEL) {
          hitObstacle = true;
          if (bullet.canDestroySteel) {
            // Tier 3 tank can destroy steel!
            tile.type = TileType.EMPTY;
            this.gridVersion++;
            this.createExplosion(c * BLOCK_SIZE + 8, r * BLOCK_SIZE + 8, false);
            soundManager.playExplosion();
          } else {
            soundManager.playHitSteel();
            this.emitNetEvent({ t: 'steel' });
            this.createExplosion(bullet.x, bullet.y, false);
          }
          break;
        } else if (tile.type === TileType.BRICK && tile.damageMask > 0) {
          hitObstacle = true;
          this.gridVersion++;
          // Authentic NES Quarter Destruction:
          // Damage mask (1: TL, 2: TR, 4: BL, 8: BR)
          if (bullet.direction === 'UP') {
            if (tile.damageMask & 12) {
              tile.damageMask &= ~12; // destroy bottom half
            } else {
              tile.damageMask &= ~3; // destroy top half
            }
          } else if (bullet.direction === 'DOWN') {
            if (tile.damageMask & 3) {
              tile.damageMask &= ~3; // destroy top half
            } else {
              tile.damageMask &= ~12; // destroy bottom half
            }
          } else if (bullet.direction === 'LEFT') {
            if (tile.damageMask & 10) {
              tile.damageMask &= ~10; // destroy right half
            } else {
              tile.damageMask &= ~5; // destroy left half
            }
          } else if (bullet.direction === 'RIGHT') {
            if (tile.damageMask & 5) {
              tile.damageMask &= ~5; // destroy left half
            } else {
              tile.damageMask &= ~10; // destroy right half
            }
          }

          if (tile.damageMask === 0) {
            tile.type = TileType.EMPTY;
            // 7.5% chance to spawn a tactical pickup when a brick is destroyed!
            if (Math.random() < 0.075) {
              this.spawnTacticalPickup(c * BLOCK_SIZE, r * BLOCK_SIZE);
            }
          }

          this.createExplosion(bullet.x, bullet.y, false);
          soundManager.playHitBrick();
          this.emitNetEvent({ t: 'brick' });
          break;
        }
      }

      if (hitObstacle) {
        bulletsToRemove.add(bullet.id);
        continue;
      }

      // E. Bullet vs Tanks
      if (bullet.isPlayer) {
        // Player bullet hitting enemy tank
        for (let eIdx = this.enemies.length - 1; eIdx >= 0; eIdx--) {
          const enemy = this.enemies[eIdx];
          if (!enemy) continue;

          if (this.rectIntersect(bullet.x - 3, bullet.y - 3, 6, 6, enemy.x + 2, enemy.y + 2, 28, 28)) {
            enemy.hp--;

            // Drop powerup if bonus tank
            if (enemy.isFlashingBonus) {
              enemy.isFlashingBonus = false;
              this.spawnPowerUp(enemy.x, enemy.y);
            }

            if (enemy.hp <= 0) {
              // Destroyed enemy!
              const points = this.getEnemyPoints(enemy.type as EnemyType);
              if (bullet.playerIndex === 2) {
                this.scoreData.player2Score = (this.scoreData.player2Score || 0) + points;
              } else {
                this.scoreData.score += points;
              }
              this.scoreData.destroyedEnemies[enemy.type as EnemyType]++;
              this.addScorePopup(enemy.x + 16, enemy.y + 16, points);

              if (this.scoreData.score > this.scoreData.highScore) {
                this.scoreData.highScore = this.scoreData.score;
                try {
                  localStorage.setItem('battle_city_high_score', this.scoreData.highScore.toString());
                } catch {}
              }

              this.createExplosion(enemy.x + 16, enemy.y + 16, true);
              soundManager.playBigExplosion();
              this.enemies.splice(eIdx, 1);
            } else {
              // Armor tank hit
              this.createExplosion(bullet.x, bullet.y, false);
              soundManager.playHitSteel();
            }

            bulletsToRemove.add(bullet.id);
            this.onStateChange(this.gameState, this.scoreData);
            break;
          }
        }
      } else {
        // Enemy bullet hitting any player tank
        for (const targetTank of this.playerTanks.values()) {
          if (!targetTank) continue;
          if (this.rectIntersect(bullet.x - 3, bullet.y - 3, 6, 6, targetTank.x + 2, targetTank.y + 2, 28, 28)) {
            if (targetTank.shieldTimer <= 0) {
              this.handlePlayerTankKilled(targetTank, bullet);
            } else {
              soundManager.playHitSteel();
              this.createExplosion(bullet.x, bullet.y, false);
            }
            bulletsToRemove.add(bullet.id);
            break;
          }
        }
      }

      // PvP hit checks (Versus, 2v2, FFA)
      if (bullet.isPlayer && (this.multiMode === 'versus' || this.multiMode === '2v2' || this.multiMode === 'ffa')) {
        for (const targetTank of this.playerTanks.values()) {
          if (!targetTank || targetTank.id === bullet.ownerId) continue;

          if (this.rectIntersect(bullet.x - 3, bullet.y - 3, 6, 6, targetTank.x + 2, targetTank.y + 2, 28, 28)) {
            // Friendly fire protection in 2v2:
            if (this.multiMode === '2v2' && bullet.team && targetTank.team && bullet.team === targetTank.team) {
              // Teammates cannot harm each other! Harmless ricochet
              soundManager.playHitSteel();
              this.createExplosion(bullet.x, bullet.y, false);
              bulletsToRemove.add(bullet.id);
              break;
            }

            if (targetTank.shieldTimer <= 0) {
              this.handlePlayerTankKilled(targetTank, bullet);
            } else {
              soundManager.playHitSteel();
              this.createExplosion(bullet.x, bullet.y, false);
            }
            bulletsToRemove.add(bullet.id);
            break;
          }
        }
      }
    }

    // Safely remove all bullets marked for removal
    if (bulletsToRemove.size > 0) {
      this.bullets = this.bullets.filter((b) => b && !bulletsToRemove.has(b.id));
    }
  }

  // --- Player Death & Respawn ---
  private handlePlayerTankKilled(tank: Tank, killerBullet?: Bullet) {
    if (!tank) return;
    this.createExplosion(tank.x + 16, tank.y + 16, true);
    soundManager.playBigExplosion();
    const slot = tank.playerIndex || 1;
    this.playerTanks.delete(slot);

    // If the base explosion is already resolving or round already ended, don't trigger secondary endRound
    if (this.isRoundEnding || this.gameState === GameState.ROUND_END) {
      return;
    }

    if (this.multiMode === 'versus') {
      soundManager.stopEngineSound();
      for (const p of this.playerTanks.values()) {
        if (p) p.moving = false;
      }
      this.endRound(slot === 1 ? 2 : 1);
      return;
    }

    if (this.multiMode === '2v2') {
      soundManager.stopEngineSound();
      for (const p of this.playerTanks.values()) {
        if (p) p.moving = false;
      }
      // Check if either team is completely eliminated
      const teamAAlive = [1, 3].some((s) => this.playerTanks.has(s));
      const teamBAlive = [2, 4].some((s) => this.playerTanks.has(s));
      if (!teamAAlive && !teamBAlive) {
        this.endRound2v2('DRAW');
      } else if (!teamAAlive) {
        this.endRound2v2('B');
      } else if (!teamBAlive) {
        this.endRound2v2('A');
      }
      return;
    }

    if (this.multiMode === 'ffa') {
      let champion: number | null = null;
      if (killerBullet && killerBullet.playerIndex) {
        const killer = killerBullet.playerIndex;
        if (this.scoreData.playerStats && this.scoreData.playerStats[killer]) {
          this.scoreData.playerStats[killer].kills++;
          this.scoreData.playerStats[killer].score += 100;
          if (this.scoreData.playerStats[killer].kills >= FFA_KILLS_TO_WIN) {
            champion = killer;
          }
        }
      }
      // Record the victim's death even on the crown-winning kill
      if (this.scoreData.playerStats && this.scoreData.playerStats[slot]) {
        this.scoreData.playerStats[slot].deaths++;
        this.scoreData.playerStats[slot].lives = Math.max(0, this.scoreData.playerStats[slot].lives - 1);
      }
      if (champion !== null) {
        soundManager.stopEngineSound();
        for (const p of this.playerTanks.values()) {
          if (p) p.moving = false;
        }
        this.endFfaMatch(champion);
        return;
      }
      this.onStateChange(this.gameState, this.scoreData);

      // Respawn in FFA after 1.5 seconds with fresh shield
      setTimeout(() => {
        if (this.gameState === GameState.PLAYING) {
          this.spawnPlayer(slot);
        }
      }, 1500);
      return;
    }

    // Single Player / Coop
    if (slot === 1) {
      this.scoreData.playerLives--;
      this.onStateChange(this.gameState, this.scoreData);
      setTimeout(() => {
        if (this.gameState === GameState.PLAYING && (this.baseState === BaseState.ALIVE || this.multiMode === 'versus')) {
          this.spawnPlayer(1);
        }
      }, 1000);
    } else if (slot === 2) {
      if (this.scoreData.player2Lives !== undefined) {
        this.scoreData.player2Lives--;
      }
      this.onStateChange(this.gameState, this.scoreData);
      setTimeout(() => {
        if (this.gameState === GameState.PLAYING && (this.baseState === BaseState.ALIVE || this.multiMode === 'versus')) {
          this.spawnPlayer(2);
        }
      }, 1000);
    }
  }

  private handlePlayerKilled() {
    if (this.player) this.handlePlayerTankKilled(this.player);
  }

  private handlePlayer2Killed() {
    if (this.player2) this.handlePlayerTankKilled(this.player2);
  }

  // --- Base Eagle Destroyed ---
  public destroyBase(baseId: 'A' | 'B' = 'A') {
    if (this.isRoundEnding) return;
    soundManager.stopEngineSound();
    for (const p of this.playerTanks.values()) {
      if (p) p.moving = false;
    }
    if (baseId === 'A') {
      if (this.baseState === BaseState.DESTROYED) return;
      this.baseState = BaseState.DESTROYED;
      const bA = this.bases.get('A');
      if (bA) bA.state = BaseState.DESTROYED;
      soundManager.playEagleExplosion();
      this.createExplosion(this.baseX + 16, this.baseY + 16, true);
      this.isRoundEnding = true;
      this.clearRoundTimer();
      if (this.multiMode === 'versus') {
        this.roundTransitionTimer = setTimeout(() => {
          this.roundTransitionTimer = null;
          this.endRound(2);
        }, 1200);
        return;
      }
      if (this.multiMode === '2v2') {
        this.roundTransitionTimer = setTimeout(() => {
          this.roundTransitionTimer = null;
          this.endRound2v2('B');
        }, 1200);
        return;
      }
      this.roundTransitionTimer = setTimeout(() => {
        this.roundTransitionTimer = null;
        this.handleGameOver();
      }, 1200);
    } else if (baseId === 'B') {
      if (this.baseStateB === BaseState.DESTROYED) return;
      this.baseStateB = BaseState.DESTROYED;
      const bB = this.bases.get('B');
      if (bB) bB.state = BaseState.DESTROYED;
      soundManager.playEagleExplosion();
      this.createExplosion(this.baseB_X + 16, this.baseB_Y + 16, true);
      this.isRoundEnding = true;
      this.clearRoundTimer();
      if (this.multiMode === 'versus') {
        this.roundTransitionTimer = setTimeout(() => {
          this.roundTransitionTimer = null;
          this.endRound(1);
        }, 1200);
        return;
      }
      if (this.multiMode === '2v2') {
        this.roundTransitionTimer = setTimeout(() => {
          this.roundTransitionTimer = null;
          this.endRound2v2('A');
        }, 1200);
        return;
      }
    }
  }

  // --- Game Over ---
  private handleGameOver() {
    this.gameState = GameState.GAME_OVER;
    soundManager.stopEngineSound();
    for (const p of this.playerTanks.values()) {
      if (p) p.moving = false;
    }
    soundManager.playGameOver();
    this.onStateChange(this.gameState, this.scoreData);
  }

  // --- Victory ---
  private handleVictory() {
    this.gameState = GameState.VICTORY;
    soundManager.stopEngineSound();
    for (const p of this.playerTanks.values()) {
      if (p) p.moving = false;
    }
    soundManager.playPowerUpCollect();
    this.onStateChange(this.gameState, this.scoreData);
  }

  // --- Power-Up System ---
  private spawnPowerUp(x: number, y: number) {
    const types: PowerUpType[] = ['STAR', 'BOMB', 'TIMER', 'SHOVEL', 'HELMET', 'LIFE'];
    const type = types[Math.floor(Math.random() * types.length)];

    // Clamp position within bounds
    const px = Math.max(16, Math.min(this.canvasSize - 46, x));
    const py = Math.max(16, Math.min(this.canvasSize - 46, y));

    this.powerUps.push({
      id: 'pup_' + Date.now(),
      type,
      x: px,
      y: py,
      flashFrame: 0,
      duration: 900, // 15 seconds before despawn
    });

    soundManager.playPowerUpSpawn();
    this.emitNetEvent({ t: 'pspawn' });
  }

  private updatePowerUps() {
    for (let i = this.powerUps.length - 1; i >= 0; i--) {
      const pup = this.powerUps[i];
      pup.duration--;
      pup.flashFrame++;

      if (pup.duration <= 0) {
        this.powerUps.splice(i, 1);
        continue;
      }

      // Check player collection
      for (const tank of this.playerTanks.values()) {
        if (tank && this.rectIntersect(tank.x, tank.y, 32, 32, pup.x, pup.y, 30, 30)) {
          this.collectPowerUp(pup.type, tank);
          this.addScorePopup(pup.x + 15, pup.y + 15, 500);
          this.scoreData.score += 500;
          this.onStateChange(this.gameState, this.scoreData);
          soundManager.playPowerUpCollect();
          this.emitNetEvent({ t: 'pickup' });
          this.powerUps.splice(i, 1);
          break;
        }
      }
    }
  }

  private collectPowerUp(type: PowerUpType, collector?: Tank) {
    const target = collector || this.player;
    if (!target) return;

    if (type === 'STAR') {
      target.tier = Math.min(3, target.tier + 1);
      if (target.tier >= 1) target.bulletSpeed = 6.0;
      if (target.tier >= 2) target.speed = this.playerBaseSpeed * 1.3;
    } else if (type === 'BOMB') {
      // Destroy all active enemy tanks
      for (const enemy of this.enemies) {
        this.createExplosion(enemy.x + 16, enemy.y + 16, true);
        const pts = this.getEnemyPoints(enemy.type as EnemyType);
        this.scoreData.score += pts;
        this.scoreData.destroyedEnemies[enemy.type as EnemyType]++;
      }
      this.enemies = [];
      soundManager.playBigExplosion();
    } else if (type === 'TIMER') {
      // Freeze enemies for 10 seconds (600 frames)
      this.freezeEnemiesTimer = 600;
    } else if (type === 'SHOVEL') {
      // Turn base bunker walls into steel for 20 seconds (1200 frames)
      if (this.multiMode === 'versus') {
        // In 1v1, fortify the active eagle only if collected by the defender
        if (target.playerIndex === this.vsDefenderSlot) {
          this.applyShovelBunker(this.vsDefenderSlot === 2 ? 'B' : 'A');
        }
      } else if (this.multiMode === '2v2') {
        const targetTeam = target.team === 'B' || target.playerIndex === 2 ? 'B' : 'A';
        this.applyShovelBunker(targetTeam);
      } else {
        this.applyShovelBunker('A');
      }
    } else if (type === 'HELMET') {
      // 15 seconds invulnerability
      target.shieldTimer = 900;
    } else if (type === 'LIFE') {
      if (target.playerIndex === 2 && this.scoreData.player2Lives !== undefined) {
        this.scoreData.player2Lives++;
      } else {
        this.scoreData.playerLives++;
      }
    }
  }

  private applyShovelBunker(team: 'A' | 'B' = 'A') {
    this.shovelTimer = 1200;
    this.shovelBunkerTiles = [];

    // Coordinates according to team's base:
    const bunkerCoords = team === 'B' ? [
      { r: 2, c: this.baseB_C - 1 },
      { r: 2, c: this.baseB_C },
      { r: 2, c: this.baseB_C + 1 },
      { r: 2, c: this.baseB_C + 2 },
      { r: 0, c: this.baseB_C - 1 },
      { r: 0, c: this.baseB_C + 2 },
      { r: 1, c: this.baseB_C - 1 },
      { r: 1, c: this.baseB_C + 2 },
    ] : [
      { r: this.baseR - 1, c: this.baseC - 1 },
      { r: this.baseR - 1, c: this.baseC },
      { r: this.baseR - 1, c: this.baseC + 1 },
      { r: this.baseR - 1, c: this.baseC + 2 },
      { r: this.baseR, c: this.baseC - 1 },
      { r: this.baseR, c: this.baseC + 2 },
      { r: this.baseR + 1, c: this.baseC - 1 },
      { r: this.baseR + 1, c: this.baseC + 2 },
    ];

    for (const { r, c } of bunkerCoords) {
      if (this.grid[r]?.[c]) {
        this.shovelBunkerTiles.push({
          r,
          c,
          prevType: this.grid[r][c].type,
        });
        this.grid[r][c].type = TileType.STEEL;
        this.grid[r][c].damageMask = 15;
      }
    }
    this.gridVersion++;
  }

  private revertShovelBunker() {
    for (const { r, c, prevType } of this.shovelBunkerTiles) {
      if (this.grid[r]?.[c]) {
        this.grid[r][c].type = prevType === TileType.EMPTY ? TileType.BRICK : prevType;
        this.grid[r][c].damageMask = 15;
      }
    }
    this.shovelBunkerTiles = [];
    this.gridVersion++;
  }

  // --- Tactical Items & Abilities Engine ---
  public spawnTacticalPickup(x: number, y: number) {
    // Weighted distribution: 55% GRENADE (so player can find and stockpile bombs), 25% SMOKE, 20% SHIELD
    const rand = Math.random();
    let type: TacticalItemType;
    if (rand < 0.55) {
      type = 'GRENADE';
    } else if (rand < 0.80) {
      type = 'SMOKE';
    } else {
      type = 'SHIELD';
    }
    this.tacticalPickups.push({
      id: 'tac_' + Date.now() + '_' + Math.random(),
      type,
      x: Math.max(8, Math.min(this.canvasSize - 32, x)),
      y: Math.max(8, Math.min(this.canvasSize - 32, y)),
      flashFrame: 0,
      duration: 720, // 12 seconds before despawning
    });
  }

  public getTacticalInventory(slot: number = 1): TacticalInventory {
    const t = this.playerTanks.get(slot);
    return t?.tacticalInventory || { smoke: 0, grenade: 0, shield: 0 };
  }

  private updateTacticalEntities() {
    this.updateTacticalPickups();
    this.updateSmokeScreens();
    this.updateGrenades();
    this.updateDeployableShields();
  }

  private updateTacticalPickups() {
    for (let i = this.tacticalPickups.length - 1; i >= 0; i--) {
      const p = this.tacticalPickups[i];
      p.duration--;
      p.flashFrame++;

      if (p.duration <= 0) {
        this.tacticalPickups.splice(i, 1);
        continue;
      }

      // Check player collection
      for (const tank of this.playerTanks.values()) {
        if (tank && this.rectIntersect(tank.x, tank.y, 32, 32, p.x, p.y, 24, 24)) {
          if (!tank.tacticalInventory) {
            tank.tacticalInventory = { smoke: 0, grenade: 0, shield: 0 };
          }
          if (p.type === 'SMOKE') {
            tank.tacticalInventory.smoke = Math.min(9, tank.tacticalInventory.smoke + 1);
            this.addTacticalPopup(p.x + 12, p.y + 12, '+SMOKE');
          } else if (p.type === 'GRENADE') {
            tank.tacticalInventory.grenade = Math.min(9, tank.tacticalInventory.grenade + 1);
            this.addTacticalPopup(p.x + 12, p.y + 12, '+BOMB');
          } else if (p.type === 'SHIELD') {
            tank.tacticalInventory.shield = Math.min(5, tank.tacticalInventory.shield + 1);
            this.addTacticalPopup(p.x + 12, p.y + 12, '+SHIELD');
          }
          soundManager.playPowerUpCollect();
          this.tacticalPickups.splice(i, 1);
          break;
        }
      }
    }

    // Update tactical text popups
    for (let i = this.tacticalPopups.length - 1; i >= 0; i--) {
      const pop = this.tacticalPopups[i];
      pop.timer--;
      pop.y -= 0.4;
      if (pop.timer <= 0) {
        this.tacticalPopups.splice(i, 1);
      }
    }
  }

  private addTacticalPopup(x: number, y: number, text: string) {
    this.tacticalPopups.push({
      id: 'tacpop_' + Math.random(),
      x,
      y,
      text,
      timer: 55,
    });
  }

  private triggerSmokeAction(tank: Tank) {
    if (!tank.tacticalInventory || tank.tacticalInventory.smoke <= 0) return;
    tank.tacticalInventory.smoke--;
    soundManager.playSmokeDeploy();

    const particles: ActiveSmokeScreen['particles'] = [];
    const colors = ['#282828', '#383838', '#4c4c4c', '#606060', '#747474', '#888888'];
    for (let i = 0; i < 36; i++) {
      const offsetX = (Math.random() - 0.5) * 88;
      const offsetY = (Math.random() - 0.5) * 88;
      particles.push({
        x: tank.x + 16 + offsetX,
        y: tank.y + 16 + offsetY,
        vx: (Math.random() - 0.5) * 0.7,
        vy: (Math.random() - 0.5) * 0.7,
        size: Math.random() * 8 + 6,
        alpha: Math.random() * 0.35 + 0.55,
        color: colors[Math.floor(Math.random() * colors.length)],
      });
    }

    this.activeSmokeScreens.push({
      id: 'smoke_' + Date.now() + '_' + Math.random(),
      x: tank.x + 16,
      y: tank.y + 16,
      radius: 56, // Square half-size (total size = 112x112px, 7x7 blocks)
      duration: 480, // ~8 seconds
      maxDuration: 480,
      particles,
    });
  }

  private triggerGrenadeAction(tank: Tank) {
    if (!tank.tacticalInventory || tank.tacticalInventory.grenade <= 0) return;
    tank.tacticalInventory.grenade--;

    let dirX = 0;
    let dirY = 0;
    if (tank.direction === 'UP') dirY = -1;
    else if (tank.direction === 'DOWN') dirY = 1;
    else if (tank.direction === 'LEFT') dirX = -1;
    else if (tank.direction === 'RIGHT') dirX = 1;

    let startX = tank.x + 16 + dirX * 18;
    let startY = tank.y + 16 + dirY * 18;
    let initVx = dirX * 3.8;
    let initVy = dirY * 3.8;

    // Point-blank check: if spawn position is inside a solid obstacle, start closer or ricochet immediately
    if (this.isSolidForGrenade(startX, startY)) {
      startX = tank.x + 16 + dirX * 10;
      startY = tank.y + 16 + dirY * 10;
      if (this.isSolidForGrenade(startX, startY)) {
        startX = tank.x + 16;
        startY = tank.y + 16;
        initVx = -dirX * 2.2;
        initVy = -dirY * 2.2;
        soundManager.playGrenadeBounce();
      }
    }

    this.activeGrenades.push({
      id: 'grenade_' + Date.now() + '_' + Math.random(),
      ownerId: tank.id,
      isPlayer: tank.isPlayer,
      team: tank.team,
      x: startX,
      y: startY,
      z: 14,
      vx: initVx,
      vy: initVy,
      vz: 3.5,
      bouncesLeft: 3,
      life: 180,
    });
  }

  private triggerShieldAction(tank: Tank) {
    if (!tank.tacticalInventory || tank.tacticalInventory.shield <= 0) return;
    tank.tacticalInventory.shield--;
    soundManager.playShieldDeploy();

    let sx = tank.x;
    let sy = tank.y;
    let sw = 32;
    let sh = 10;

    if (tank.direction === 'UP') {
      sx = tank.x;
      sy = Math.max(0, tank.y - 12);
      sw = 32;
      sh = 10;
    } else if (tank.direction === 'DOWN') {
      sx = tank.x;
      sy = Math.min(this.canvasSize - 10, tank.y + 32 + 2);
      sw = 32;
      sh = 10;
    } else if (tank.direction === 'LEFT') {
      sx = Math.max(0, tank.x - 12);
      sy = tank.y;
      sw = 10;
      sh = 32;
    } else if (tank.direction === 'RIGHT') {
      sx = Math.min(this.canvasSize - 10, tank.x + 32 + 2);
      sy = tank.y;
      sw = 10;
      sh = 32;
    }

    this.activeShields.push({
      id: 'shield_' + Date.now() + '_' + Math.random(),
      ownerId: tank.id,
      team: tank.team,
      x: sx,
      y: sy,
      width: sw,
      height: sh,
      hp: 3,
      maxHp: 3,
      timer: 900, // 15 seconds
      maxTimer: 900,
      direction: tank.direction,
    });
  }

  private updateSmokeScreens() {
    // Reset all tanks' inSmoke state
    for (const tank of this.playerTanks.values()) {
      if (tank) tank.inSmoke = false;
    }
    for (const enemy of this.enemies) {
      if (enemy) enemy.inSmoke = false;
    }

    for (let i = this.activeSmokeScreens.length - 1; i >= 0; i--) {
      const s = this.activeSmokeScreens[i];
      s.duration--;

      // Update particles
      for (const p of s.particles) {
        p.x += p.vx;
        p.y += p.vy;
        p.vx *= 0.98;
        p.vy *= 0.98;
        p.alpha -= 0.0012;
      }

      // Check which tanks are inside the square smoke screen
      const half = s.radius;
      const sx = s.x - half;
      const sy = s.y - half;
      const sSize = half * 2;

      for (const tank of this.playerTanks.values()) {
        if (tank && this.rectIntersect(tank.x, tank.y, 32, 32, sx, sy, sSize, sSize)) {
          tank.inSmoke = true;
        }
      }
      for (const enemy of this.enemies) {
        if (enemy && this.rectIntersect(enemy.x, enemy.y, 32, 32, sx, sy, sSize, sSize)) {
          enemy.inSmoke = true;
        }
      }

      if (s.duration <= 0) {
        this.activeSmokeScreens.splice(i, 1);
      }
    }
  }

  /**
   * Returns true if (px, py) collides with a solid barrier for thrown grenades:
   * Red Bricks (if intact sub-quadrant), Steel walls, Eagle Base, Map boundaries, or Deployable Shields.
   */
  public isSolidForGrenade(px: number, py: number): boolean {
    if (px <= 0 || px >= this.canvasSize || py <= 0 || py >= this.canvasSize) {
      return true;
    }

    const c = Math.floor(px / BLOCK_SIZE);
    const r = Math.floor(py / BLOCK_SIZE);
    if (r < 0 || r >= this.gridSize || c < 0 || c >= this.gridSize) {
      return true;
    }

    const tile = this.grid[r]?.[c];
    if (tile) {
      if (tile.type === TileType.STEEL || tile.type === TileType.BASE) {
        return true;
      }
      if (tile.type === TileType.BRICK) {
        if (!tile.damageMask || tile.damageMask === 0) return false;
        if (tile.damageMask === 15) return true;
        // Sub-quadrant bit check: 1=TL, 2=TR, 4=BL, 8=BR
        const subX = Math.floor(((px % BLOCK_SIZE) + BLOCK_SIZE) % BLOCK_SIZE / 8);
        const subY = Math.floor(((py % BLOCK_SIZE) + BLOCK_SIZE) % BLOCK_SIZE / 8);
        const bit = (1 << subX) << (subY * 2);
        return (tile.damageMask & bit) !== 0;
      }
    }

    // Active deployable shields placed by players
    for (const s of this.activeShields) {
      if (px >= s.x && px <= s.x + s.width && py >= s.y && py <= s.y + s.height) {
        return true;
      }
    }

    return false;
  }

  private updateGrenades() {
    const radius = 4.5;

    for (let i = this.activeGrenades.length - 1; i >= 0; i--) {
      const g = this.activeGrenades[i];
      g.life--;
      g.z += g.vz;
      g.vz -= 0.22; // Gravity

      // --- 1. Horizontal Movement & Obstacle Ricochet (Bricks, Steel, Borders, Shields) ---
      if (Math.abs(g.vx) > 0.001) {
        const nextX = g.x + g.vx;
        let collidesX = false;

        if (g.vx > 0) {
          const testX = nextX + radius;
          if (
            testX >= this.canvasSize ||
            this.isSolidForGrenade(testX, g.y - radius * 0.7) ||
            this.isSolidForGrenade(testX, g.y) ||
            this.isSolidForGrenade(testX, g.y + radius * 0.7)
          ) {
            collidesX = true;
          }
        } else {
          const testX = nextX - radius;
          if (
            testX <= 0 ||
            this.isSolidForGrenade(testX, g.y - radius * 0.7) ||
            this.isSolidForGrenade(testX, g.y) ||
            this.isSolidForGrenade(testX, g.y + radius * 0.7)
          ) {
            collidesX = true;
          }
        }

        if (collidesX) {
          const dirBefore = Math.sign(g.vx);
          // Realistic energy-damped rebound
          g.vx = -g.vx * 0.65;
          g.vy *= 0.88;
          // Step back away from the wall to prevent penetration
          g.x = Math.max(radius, Math.min(this.canvasSize - radius, g.x - dirBefore * 0.75));
          soundManager.playGrenadeBounce();
        } else {
          g.x = Math.max(radius, Math.min(this.canvasSize - radius, nextX));
        }
      }

      // --- 2. Vertical Movement & Obstacle Ricochet (Bricks, Steel, Borders, Shields) ---
      if (Math.abs(g.vy) > 0.001) {
        const nextY = g.y + g.vy;
        let collidesY = false;

        if (g.vy > 0) {
          const testY = nextY + radius;
          if (
            testY >= this.canvasSize ||
            this.isSolidForGrenade(g.x - radius * 0.7, testY) ||
            this.isSolidForGrenade(g.x, testY) ||
            this.isSolidForGrenade(g.x + radius * 0.7, testY)
          ) {
            collidesY = true;
          }
        } else {
          const testY = nextY - radius;
          if (
            testY <= 0 ||
            this.isSolidForGrenade(g.x - radius * 0.7, testY) ||
            this.isSolidForGrenade(g.x, testY) ||
            this.isSolidForGrenade(g.x + radius * 0.7, testY)
          ) {
            collidesY = true;
          }
        }

        if (collidesY) {
          const dirBefore = Math.sign(g.vy);
          // Realistic energy-damped rebound
          g.vy = -g.vy * 0.65;
          g.vx *= 0.88;
          // Step back away from the wall to prevent penetration
          g.y = Math.max(radius, Math.min(this.canvasSize - radius, g.y - dirBefore * 0.75));
          soundManager.playGrenadeBounce();
        } else {
          g.y = Math.max(radius, Math.min(this.canvasSize - radius, nextY));
        }
      }

      // --- 3. Ground Collision & Arc Bounce ---
      if (g.z <= 0) {
        g.z = 0;
        if (g.bouncesLeft > 0) {
          g.bouncesLeft--;
          g.vz = Math.abs(g.vz) * 0.62;
          g.vx *= 0.68;
          g.vy *= 0.68;
          soundManager.playGrenadeBounce();
        } else {
          // Finished 3 bounces -> Detonate!
          this.explodeGrenade(g);
          this.activeGrenades.splice(i, 1);
          continue;
        }
      }

      // Max lifetime safety or near-stopped
      if (g.life <= 0 || (g.bouncesLeft === 0 && Math.abs(g.vx) < 0.2 && Math.abs(g.vy) < 0.2 && g.z <= 0)) {
        this.explodeGrenade(g);
        this.activeGrenades.splice(i, 1);
      }
    }
  }

  private explodeGrenade(g: ActiveBouncingGrenade) {
    this.createExplosion(g.x, g.y, true);
    soundManager.playBigExplosion();
    const blastRadius = 44; // 44px AoE

    // 1. Destroy Bricks in blast radius
    const minSubX = Math.max(0, Math.floor((g.x - blastRadius) / BLOCK_SIZE));
    const maxSubX = Math.min(this.gridSize - 1, Math.floor((g.x + blastRadius) / BLOCK_SIZE));
    const minSubY = Math.max(0, Math.floor((g.y - blastRadius) / BLOCK_SIZE));
    const maxSubY = Math.min(this.gridSize - 1, Math.floor((g.y + blastRadius) / BLOCK_SIZE));

    for (let r = minSubY; r <= maxSubY; r++) {
      for (let c = minSubX; c <= maxSubX; c++) {
        const t = this.grid[r][c];
        if (t && t.type === TileType.BRICK) {
          const tileCenterX = c * BLOCK_SIZE + 8;
          const tileCenterY = r * BLOCK_SIZE + 8;
          const dist = Math.hypot(g.x - tileCenterX, g.y - tileCenterY);
          if (dist <= blastRadius) {
            t.damageMask = 0;
            t.type = TileType.EMPTY;
            this.gridVersion++;
            // 7.5% chance to spawn a tactical pickup when a brick is destroyed!
            if (Math.random() < 0.075) {
              this.spawnTacticalPickup(c * BLOCK_SIZE, r * BLOCK_SIZE);
            }
          }
        }
      }
    }

    // 2. Damage Enemies in blast radius
    for (let eIdx = this.enemies.length - 1; eIdx >= 0; eIdx--) {
      const enemy = this.enemies[eIdx];
      const dist = Math.hypot(g.x - (enemy.x + 16), g.y - (enemy.y + 16));
      if (dist <= blastRadius) {
        enemy.hp -= 2;
        if (enemy.hp <= 0) {
          const points = this.getEnemyPoints(enemy.type as EnemyType);
          this.scoreData.score += points;
          this.scoreData.destroyedEnemies[enemy.type as EnemyType]++;
          this.addScorePopup(enemy.x + 16, enemy.y + 16, points);
          if (this.scoreData.score > this.scoreData.highScore) {
            this.scoreData.highScore = this.scoreData.score;
            try {
              localStorage.setItem('battle_city_high_score', this.scoreData.highScore.toString());
            } catch {}
          }
          this.createExplosion(enemy.x + 16, enemy.y + 16, true);
          soundManager.playBigExplosion();
          this.enemies.splice(eIdx, 1);
          this.onStateChange(this.gameState, this.scoreData);
        } else {
          this.createExplosion(enemy.x + 16, enemy.y + 16, false);
        }
      }
    }

    // 3. Damage other players in PvP/FFA
    if (this.multiMode === 'versus' || this.multiMode === 'ffa' || this.multiMode === '2v2') {
      for (const playerTank of this.playerTanks.values()) {
        if (playerTank.id === g.ownerId) continue;
        if (g.team && playerTank.team && g.team === playerTank.team && this.multiMode === '2v2') continue;
        const dist = Math.hypot(g.x - (playerTank.x + 16), g.y - (playerTank.y + 16));
        if (dist <= blastRadius && playerTank.shieldTimer <= 0) {
          this.handlePlayerTankKilled(playerTank);
        }
      }
    }
  }

  private updateDeployableShields() {
    for (let i = this.activeShields.length - 1; i >= 0; i--) {
      const shield = this.activeShields[i];
      shield.timer--;
      if (shield.timer <= 0 || shield.hp <= 0) {
        this.activeShields.splice(i, 1);
      }
    }
  }

  // --- Explosions & Popups ---
  private createExplosion(x: number, y: number, isBig: boolean) {
    this.explosions.push({
      id: 'exp_' + Math.random(),
      x,
      y,
      frame: 0,
      maxFrames: isBig ? 32 : 16,
      isBig,
    });
    this.emitNetEvent({ t: 'boom', x, y, big: isBig });
  }

  private addScorePopup(x: number, y: number, points: number) {
    this.scorePopups.push({
      id: 'pop_' + Math.random(),
      x,
      y,
      points,
      timer: 45,
    });
  }

  private updateEffects() {
    // Explosions
    for (let i = this.explosions.length - 1; i >= 0; i--) {
      const exp = this.explosions[i];
      exp.frame++;
      if (exp.frame >= exp.maxFrames) {
        this.explosions.splice(i, 1);
      }
    }

    // Popups
    for (let i = this.scorePopups.length - 1; i >= 0; i--) {
      const pop = this.scorePopups[i];
      pop.timer--;
      pop.y -= 0.4;
      if (pop.timer <= 0) {
        this.scorePopups.splice(i, 1);
      }
    }

    // Mud Splatter Particles
    for (let i = this.mudParticles.length - 1; i >= 0; i--) {
      const p = this.mudParticles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.life--;
      if (p.life <= 0) {
        this.mudParticles.splice(i, 1);
      }
    }
  }

  // --- Rendering Pipeline ---
  public render() {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.canvasSize, this.canvasSize);

    // 1. Black Field Background
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, this.canvasSize, this.canvasSize);

    // 2. Render Ice & Mud (underneath tanks)
    for (let r = 0; r < this.gridSize; r++) {
      for (let c = 0; c < this.gridSize; c++) {
        const t = this.grid[r][c].type;
        if (t === TileType.ICE) {
          SpriteRenderer.renderIce(ctx, c * BLOCK_SIZE, r * BLOCK_SIZE);
        } else if (t === TileType.MUD) {
          SpriteRenderer.renderMud(ctx, c * BLOCK_SIZE, r * BLOCK_SIZE);
        }
      }
    }

    // 3. Render Water (animated)
    const animFrame = Math.floor(this.tickCount / 16);
    for (let r = 0; r < this.gridSize; r++) {
      for (let c = 0; c < this.gridSize; c++) {
        if (this.grid[r][c].type === TileType.WATER) {
          SpriteRenderer.renderWater(ctx, c * BLOCK_SIZE, r * BLOCK_SIZE, animFrame);
        }
      }
    }

    // 4. Render Brick & Steel Walls
    for (let r = 0; r < this.gridSize; r++) {
      for (let c = 0; c < this.gridSize; c++) {
        const tile = this.grid[r][c];
        if (tile.type === TileType.BRICK && tile.damageMask > 0) {
          SpriteRenderer.renderBrick(ctx, c * BLOCK_SIZE, r * BLOCK_SIZE, tile.damageMask);
        } else if (tile.type === TileType.STEEL) {
          // If shovel is blinking in last 3 seconds (180 frames)
          if (this.shovelTimer > 0 && this.shovelTimer < 180 && Math.floor(this.tickCount / 8) % 2 === 0) {
            SpriteRenderer.renderBrick(ctx, c * BLOCK_SIZE, r * BLOCK_SIZE, 15);
          } else {
            SpriteRenderer.renderSteel(ctx, c * BLOCK_SIZE, r * BLOCK_SIZE);
          }
        }
      }
    }

    // 5. Render Base Eagle(s) (All modes except FFA)
    if (this.multiMode !== 'ffa') {
      // South Base (Base A - Gold Phoenix for Team A / Player 1 / Classic)
      // 1v1: rendered only on rounds where the south defender owns it
      if (this.multiMode !== 'versus' || this.vsDefenderSlot === 1) {
        SpriteRenderer.renderBase(ctx, this.baseX, this.baseY, this.baseState, 'gold');
      }

      // North Base (Base B - Crimson Phoenix for Team B / Player 2 in 1v1 and 2v2)
      if (this.multiMode === '2v2' || (this.multiMode === 'versus' && this.vsDefenderSlot === 2)) {
        SpriteRenderer.renderBase(ctx, this.baseB_X, this.baseB_Y, this.baseStateB, 'crimson');
      }
    }

    // 6. Render Spawning Stars
    for (const sp of this.spawningTanks) {
      SpriteRenderer.renderSpawnAnimation(ctx, sp.x, sp.y, sp.progress);
    }

    // 6b. Render Deployable Shield Barricades
    for (const s of this.activeShields) {
      SpriteRenderer.renderDeployableShield(ctx, s);
    }

    // 7. Render Tanks (Enemies and All Active Player Tanks 1..8)
    for (const enemy of this.enemies) {
      if (enemy) {
        SpriteRenderer.renderTank(ctx, enemy, this.tickCount);
      }
    }
    for (const p of this.playerTanks.values()) {
      if (p) {
        SpriteRenderer.renderTank(ctx, p, this.tickCount);
      }
    }

    // 7b. Render Mud Splatters (Pixel particles kicked up by tank treads)
    for (const p of this.mudParticles) {
      ctx.fillStyle = p.color;
      ctx.fillRect(Math.floor(p.x), Math.floor(p.y), p.size, p.size);
    }

    // 8. Render Bullets
    for (const b of this.bullets) {
      if (b && b.direction) {
        SpriteRenderer.renderBullet(ctx, b.x, b.y, b.direction);
      }
    }

    // 9. Render Power-Up Pickups & Tactical Pickups
    for (const pup of this.powerUps) {
      SpriteRenderer.renderPowerUp(ctx, pup.type, pup.x, pup.y, this.tickCount);
    }
    for (const tac of this.tacticalPickups) {
      SpriteRenderer.renderTacticalPickup(ctx, tac.x, tac.y, tac.type, tac.flashFrame);
    }

    // 9b. Render Bouncing Grenades (with dynamic shadow and altitude)
    for (const g of this.activeGrenades) {
      SpriteRenderer.renderBouncingGrenade(ctx, g);
    }

    // 10. Top Layer: Trees / Foliage (Tanks and bullets drive UNDER trees!)
    for (let r = 0; r < this.gridSize; r++) {
      for (let c = 0; c < this.gridSize; c++) {
        if (this.grid[r][c].type === TileType.TREES) {
          SpriteRenderer.renderTrees(ctx, c * BLOCK_SIZE, r * BLOCK_SIZE);
        }
      }
    }

    // 10b. Render Smoke Screens (Billowing NES pixel clouds over battlefield)
    for (const s of this.activeSmokeScreens) {
      SpriteRenderer.renderSmokeScreen(ctx, s);
    }

    // 11. Render Explosions
    for (const exp of this.explosions) {
      SpriteRenderer.renderExplosion(ctx, exp.x, exp.y, exp.frame, exp.maxFrames, exp.isBig);
    }

    // 12. Score Popups & Tactical Popups
    for (const pop of this.scorePopups) {
      SpriteRenderer.renderScorePopup(ctx, pop.x, pop.y, pop.points);
    }
    for (const pop of this.tacticalPopups) {
      SpriteRenderer.renderTacticalPopup(ctx, pop.x, pop.y, pop.text);
    }

    // 13. Render Taunt Speech Bubble
    if (this.tauntMessage && this.tauntMessage.timer > 0) {
      this.tauntMessage.timer--;
      const targetTank = this.tauntMessage.sender === 'P1' ? this.player : (this.player2 || Array.from(this.playerTanks.values())[1]);
      if (targetTank) {
        ctx.save();
        ctx.fillStyle = '#f8b800';
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 2;
        const tx = Math.max(10, Math.min(this.canvasSize - 80, targetTank.x - 24));
        const ty = Math.max(12, targetTank.y - 18);
        ctx.fillRect(tx, ty, 78, 14);
        ctx.strokeRect(tx, ty, 78, 14);
        ctx.fillStyle = '#000000';
        ctx.font = '7px "Press Start 2P", monospace, system-ui';
        ctx.textAlign = 'center';
        ctx.fillText(this.tauntMessage.text, tx + 39, ty + 10);
        ctx.restore();
      }
    }

    // 13. Paused Overlay
    if (this.isPaused && Math.floor(this.tickCount / 30) % 2 === 0) {
      ctx.save();
      ctx.font = '20px "Press Start 2P", monospace, system-ui';
      ctx.fillStyle = '#e82020';
      ctx.textAlign = 'center';
      ctx.fillText('PAUSE', this.canvasSize / 2, this.canvasSize / 2);
      ctx.restore();
    }
  }

  // --- Helpers ---
  private rectIntersect(
    x1: number,
    y1: number,
    w1: number,
    h1: number,
    x2: number,
    y2: number,
    w2: number,
    h2: number
  ): boolean {
    return x1 < x2 + w2 && x1 + w1 > x2 && y1 < y2 + h2 && y1 + h1 > y2;
  }

  private getEnemyPoints(type: EnemyType): number {
    switch (type) {
      case 'BASIC':
        return 100;
      case 'FAST':
        return 200;
      case 'POWER':
        return 300;
      case 'ARMOR':
        return 400;
      default:
        return 100;
    }
  }

  public getNetworkSnapshot() {
    // Delta-encode grid: include when damaged or changed, or while gridSyncFramesRemaining > 0
    let sendGrid = this.gridVersion !== this.lastSentGridVersion;
    if (this.gridSyncFramesRemaining > 0) {
      sendGrid = true;
      this.gridSyncFramesRemaining--;
    }
    if (sendGrid) this.lastSentGridVersion = this.gridVersion;

    const playersList = Array.from(this.playerTanks.values()).map((p) => ({
      id: p.id,
      pIdx: p.playerIndex,
      team: p.team,
      slot: p.slot,
      x: p.x,
      y: p.y,
      dir: p.direction,
      moving: p.moving,
      tier: p.tier,
      shield: p.shieldTimer,
    }));

    return {
      tick: this.tickCount,
      p1: this.player
        ? {
            x: this.player.x,
            y: this.player.y,
            dir: this.player.direction,
            moving: this.player.moving,
            tier: this.player.tier,
            shield: this.player.shieldTimer,
          }
        : null,
      p2: this.player2
        ? {
            x: this.player2.x,
            y: this.player2.y,
            dir: this.player2.direction,
            moving: this.player2.moving,
            tier: this.player2.tier,
            shield: this.player2.shieldTimer,
          }
        : null,
      players: playersList,
      enemies: this.enemies.map((e) => ({
        id: e.id,
        type: e.type,
        x: e.x,
        y: e.y,
        dir: e.direction,
        moving: e.moving,
        hp: e.hp,
        maxHp: e.maxHp,
        isFlashingBonus: e.isFlashingBonus,
      })),
      spawning: this.spawningTanks.map((s) => ({
        id: s.id,
        isPlayer: s.isPlayer,
        pIdx: s.playerIndex,
        x: s.x,
        y: s.y,
        progress: s.progress,
      })),
      bullets: this.bullets.map((b) => ({
        id: b.id,
        isPlayer: b.isPlayer,
        pIdx: b.playerIndex,
        x: b.x,
        y: b.y,
        dir: b.direction,
        inputSeq: b.inputSeq,
      })),
      powerUps: this.powerUps.map((p) => ({
        id: p.id,
        type: p.type,
        x: p.x,
        y: p.y,
      })),
      scoreData: this.scoreData,
      baseState: this.baseState,
      baseStateB: this.baseStateB,
      bases: Array.from(this.bases.values()),
      vsDefenderSlot: this.vsDefenderSlot,
      gameState: this.gameState,
      ackSeqs: Object.fromEntries(this.hostLastProcessedSeq.entries()),
      gv: this.gridVersion,
      gs: this.gridSize,
      ...(sendGrid ? { grid: this.encodeGrid() } : {}),
    };
  }

  public applyNetworkSnapshot(data: any) {
    if (!data) return;

    if (this.isRemoteViewer) {
      // Thin client: buffer for interpolation + authoritative bookkeeping.
      // Entity positions come from the interpolated view, never written raw.
      this.snapBuffer.push(data);
      if (Array.isArray(data.players)) {
        const mySlot = this.localPlayerSlot || 2;
        const myAuth = data.players.find((p: any) => p.pIdx === mySlot || p.slot === mySlot);
        this.p2AuthTarget = myAuth
          ? { x: myAuth.x, y: myAuth.y, dir: myAuth.dir, moving: myAuth.moving }
          : null;
      } else {
        this.p2AuthTarget = data.p2
          ? { x: data.p2.x, y: data.p2.y, dir: data.p2.dir, moving: data.p2.moving }
          : null;
      }

      // Gambetta authoritative reconciliation: reconcile using acknowledged sequence number
      if (data.ackSeqs && typeof data.ackSeqs === 'object') {
        const mySlot = this.localPlayerSlot || 2;
        const ack = data.ackSeqs[mySlot];
        if (typeof ack === 'number' && this.p2AuthTarget) {
          this.reconcileAndReplay(mySlot, ack, this.p2AuthTarget);
        }
      }
      if (Array.isArray(data.grid) && typeof data.gv === 'number' && data.gv !== this.gridVersion) {
        this.decodeGrid(data.grid, data.gv, data.gs);
      }
      if (data.scoreData) {
        const prevRound = this.scoreData.roundNumber;
        this.scoreData = { ...this.scoreData, ...data.scoreData };
        if (prevRound !== this.scoreData.roundNumber && !this.hasCustomMap && this.multiMode === 'versus') {
          const preset: MapSizePreset = this.gridSize === 42 ? 'giant' : this.gridSize === 34 ? 'large' : 'classic';
          this.currentMap = getStageMapForPresetAndStage(this.scoreData.roundNumber || 1, preset, this.multiMode);
        }
        this.onStateChange(this.gameState, this.scoreData);
      }
      if (data.vsDefenderSlot !== undefined) {
        this.vsDefenderSlot = data.vsDefenderSlot;
      }
      if (Array.isArray(data.bases)) {
        this.bases.clear();
        for (const b of data.bases) {
          this.bases.set(b.team, b);
        }
      }
      if (data.baseState !== undefined) {
        this.baseState = data.baseState;
        if (this.bases.get('A')) this.bases.get('A')!.state = data.baseState;
      }
      if (data.baseStateB !== undefined) {
        this.baseStateB = data.baseStateB;
        if (this.bases.get('B')) this.bases.get('B')!.state = data.baseStateB;
      }
      if (data.gameState && data.gameState !== this.gameState) {
        this.gameState = data.gameState;
        this.onStateChange(this.gameState, this.scoreData);
      }
      return;
    }

    // Apply Player 1 (Gold Tank)
    if (data.p1) {
      if (!this.player) {
        this.player = this.createPlayerTank(data.p1.x, data.p1.y, 1);
      }
      this.player.x = data.p1.x;
      this.player.y = data.p1.y;
      this.player.direction = data.p1.dir;
      this.player.moving = data.p1.moving;
      this.player.tier = data.p1.tier;
      this.player.shieldTimer = data.p1.shield;
    } else {
      this.player = null;
    }

    // Apply Player 2 (Green Tank)
    if (data.p2) {
      if (!this.player2) {
        this.player2 = this.createPlayerTank(data.p2.x, data.p2.y, 2);
      }
      this.player2.x = data.p2.x;
      this.player2.y = data.p2.y;
      this.player2.direction = data.p2.dir;
      this.player2.moving = data.p2.moving;
      this.player2.tier = data.p2.tier;
      this.player2.shieldTimer = data.p2.shield;
    } else {
      this.player2 = null;
    }

    // Apply Enemies
    if (Array.isArray(data.enemies)) {
      this.enemies = data.enemies.map((e: any) => ({
        id: e.id,
        isPlayer: false,
        type: e.type,
        x: e.x,
        y: e.y,
        direction: e.dir,
        desiredDirection: null,
        speed: 1.2,
        moving: e.moving,
        distanceTraveled: 0,
        tier: 0,
        maxHp: e.maxHp,
        hp: e.hp,
        isFlashingBonus: e.isFlashingBonus,
        shieldTimer: 0,
        slideFrames: 0,
        shootCooldown: 0,
        bulletSpeed: 3.5,
      }));
    }

    // Apply Bullets
    if (Array.isArray(data.bullets)) {
      this.bullets = data.bullets.map((b: any) => ({
        id: b.id,
        ownerId: '',
        isPlayer: b.isPlayer,
        playerIndex: b.pIdx,
        x: b.x,
        y: b.y,
        direction: b.dir,
        speed: 4.5,
        canDestroySteel: false,
        size: 4,
      }));
    }

    // Apply Powerups
    if (Array.isArray(data.powerUps)) {
      this.powerUps = data.powerUps.map((p: any) => ({
        id: p.id,
        type: p.type,
        x: p.x,
        y: p.y,
        flashFrame: 0,
        duration: 900,
      }));
    }

    // Apply Score / Base / Game State
    if (data.scoreData) {
      this.scoreData = { ...this.scoreData, ...data.scoreData };
      this.onStateChange(this.gameState, this.scoreData);
    }
    if (data.vsDefenderSlot !== undefined) {
      this.vsDefenderSlot = data.vsDefenderSlot;
    }
    if (Array.isArray(data.bases)) {
      this.bases.clear();
      for (const b of data.bases) {
        this.bases.set(b.team, b);
      }
    }
    if (data.baseState !== undefined) {
      this.baseState = data.baseState;
      if (this.bases.get('A')) this.bases.get('A')!.state = data.baseState;
    }
    if (data.baseStateB !== undefined) {
      this.baseStateB = data.baseStateB;
      if (this.bases.get('B')) this.bases.get('B')!.state = data.baseStateB;
    }
    if (data.gameState && data.gameState !== this.gameState) {
      this.gameState = data.gameState;
      this.onStateChange(this.gameState, this.scoreData);
    }
  }
}
