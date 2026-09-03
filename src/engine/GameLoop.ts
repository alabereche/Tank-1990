/**
 * Battle City 1990 - 60 FPS Core Game Engine
 * Handles physics, collision matrix, sub-quadrant brick destruction,
 * bullet collisions, enemy AI, power-ups, and game state.
 */

import {
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
} from '../types';
import { BLOCK_SIZE, cloneGrid } from './maps';
import { soundManager } from './SoundManager';
import { SpriteRenderer } from './spriteRenderer';
import { SnapshotBuffer, NetSnapshot } from '../network/interpolation';
import { createTickWorker } from './tickWorker';

// 1v1 versus: first player to win this many rounds takes the match (CS-style)
const VERSUS_ROUNDS_TO_WIN = 7;

interface SpawningTank {
  id: string;
  isPlayer: boolean;
  playerIndex?: 1 | 2;
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
  private spawnPoints: Position[] = [
    { x: 0, y: 0 },
    { x: 192, y: 0 },
    { x: 384, y: 0 },
  ];
  private playerSpawn: Position = { x: 128, y: 384 };
  private p2Spawn: Position = { x: 256, y: 384 };
  private playerBaseSpeed: number = 1.4;

  // Grid state: sub-tiles with damage mask
  private grid: SubTile[][] = [];
  private baseState: BaseState = BaseState.ALIVE;
  private shovelTimer: number = 0; // Frames remaining of steel base bunker
  private shovelBunkerTiles: { r: number; c: number; prevType: TileType }[] = [];

  // Entities
  private player: Tank | null = null;
  public player2: Tank | null = null;
  private enemies: Tank[] = [];
  private spawningTanks: SpawningTank[] = [];
  private bullets: Bullet[] = [];
  private explosions: Explosion[] = [];
  private powerUps: PowerUp[] = [];
  private scorePopups: ScorePopup[] = [];

  // Multiplayer Engine State
  public multiMode: MultiplayerMode = 'single';
  public localRole: MultiplayerRole | 'local' = 'local';
  private p2Input: InputState = {
    up: false,
    right: false,
    down: false,
    left: false,
    fire: false,
    pause: false,
  };
  private prevP2FireInput: boolean = false;
  private tauntMessage: { text: string; sender: 'P1' | 'P2'; timer: number } | null = null;
  public onNetworkSync?: (snapshot: any) => void;
  public onGameEventBroadcast?: (event: any) => void;

  // Guest thin-client state: authoritative snapshots, own-tank prediction,
  // and grid versioning so brick destruction syncs to the guest.
  private snapBuffer = new SnapshotBuffer();
  private p2AuthTarget: { x: number; y: number; dir: Direction; moving: boolean } | null = null;
  private gridVersion = 0;
  private lastSentGridVersion = -1;
  private tickWorker: Worker | null = null;

  // Versus round flow timers (public ms fields so tests can shorten them)
  public roundIntroMs = 2200;
  public roundEndMs = 2600;
  private roundTransitionTimer: ReturnType<typeof setTimeout> | null = null;

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

  public setupDimensions(map: StageMap) {
    this.gridSize = map.grid?.length || 26;
    this.canvasSize = this.gridSize * BLOCK_SIZE;
    this.baseR = this.gridSize - 2;
    this.baseC = Math.floor(this.gridSize / 2) - 1;
    this.baseX = this.baseC * BLOCK_SIZE;
    this.baseY = this.baseR * BLOCK_SIZE;

    if (this.multiMode === 'versus') {
      // 1v1 Duel: opposite ends. The bottom spawn must NEVER be the eagle
      // bunker pocket (cols 12-13 / rows 24-25) - it is enclosed on three
      // sides by the bunker walls, so the tank could never leave.
      this.playerSpawn = {
        x: (this.baseC - 4) * BLOCK_SIZE,
        y: this.baseR * BLOCK_SIZE,
      };
      this.p2Spawn = {
        x: this.baseC * BLOCK_SIZE,
        y: 0,
      };
    } else {
      this.playerSpawn = {
        x: (this.baseC - 4) * BLOCK_SIZE,
        y: this.baseR * BLOCK_SIZE,
      };
      this.p2Spawn = {
        x: (this.baseC + 4) * BLOCK_SIZE,
        y: this.baseR * BLOCK_SIZE,
      };
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
    } else if (mode === 'coop') {
      this.scoreData.playerLives = 3;
      this.scoreData.player2Lives = 3;
      this.scoreData.player2Score = 0;
    }
  }

  public setP2Input(input: Partial<InputState>) {
    this.p2Input = { ...this.p2Input, ...input };
  }

  public triggerTaunt(text: string, sender: 'P1' | 'P2') {
    this.tauntMessage = { text, sender, timer: 120 };
  }

  public setPlayerSpeed(speed: number) {
    this.playerBaseSpeed = speed;
    if (this.player) {
      this.player.speed = this.player.tier >= 2 ? speed * 1.3 : speed;
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
    this.shovelTimer = 0;
  }

  /**
   * Sets up a new stage with a pool of 20 enemies
   */
  public startStage(stageNumber: number, customMap?: StageMap) {
    if (customMap) {
      this.currentMap = customMap;
    }
    this.setupDimensions(this.currentMap);
    this.initGrid(this.currentMap.grid);

    // Versus duels resolve spawns against the REAL grid: a pocket is only
    // valid if the tank can actually drive out of it (any map, any preset).
    if (this.multiMode === 'versus' && !this.isRemoteViewer) {
      this.playerSpawn = this.pickViableSpawn('bottom', this.playerSpawn.x);
      this.p2Spawn = this.pickViableSpawn('top', this.p2Spawn.x);
    }

    this.scoreData.stage = stageNumber;
    this.player = null;
    this.player2 = null;
    this.enemies = [];
    this.spawningTanks = [];
    this.bullets = [];
    this.explosions = [];
    this.powerUps = [];
    this.scorePopups = [];
    this.freezeEnemiesTimer = 0;
    this.shovelTimer = 0;
    this.snapBuffer.clear();
    this.p2AuthTarget = null;
    this.gridVersion++;
    this.lastSentGridVersion = -1;

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

    // Clear 2x2 spawn area for Player 1 and Player 2 so they never overlap obstacles
    this.clearSpawnArea(this.playerSpawn.x, this.playerSpawn.y);
    if (this.multiMode !== 'single') {
      this.clearSpawnArea(this.p2Spawn.x, this.p2Spawn.y);
    }

    // Spawn Player 1 (host/single only - guest receives entities via snapshots)
    if (!this.isRemoteViewer) {
      this.spawnPlayer(1);
      if (this.multiMode !== 'single') {
        this.spawnPlayer(2);
      }
    }

    if (this.multiMode === 'versus') {
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
    soundManager.playPowerUpCollect();
    this.onStateChange(this.gameState, this.scoreData);
    if (this.isRemoteViewer) return;
    this.clearRoundTimer();
    this.roundTransitionTimer = setTimeout(() => {
      this.roundTransitionTimer = null;
      this.resolveRoundAfterBanner();
    }, this.roundEndMs);
  }

  private resolveRoundAfterBanner() {
    const w1 = this.scoreData.roundWinsP1 ?? 0;
    const w2 = this.scoreData.roundWinsP2 ?? 0;
    if (w1 >= VERSUS_ROUNDS_TO_WIN || w2 >= VERSUS_ROUNDS_TO_WIN) {
      this.scoreData.matchWinner = w1 >= VERSUS_ROUNDS_TO_WIN ? 1 : 2;
      this.gameState = GameState.MATCH_END;
      soundManager.playStageStart();
      this.onStateChange(this.gameState, this.scoreData);
      return;
    }
    this.resetRoundArena();
    this.beginRoundIntro((this.scoreData.roundNumber ?? 1) + 1);
  }

  /** Fresh duel: same map, cleared field, both tanks back at their spawns. */
  private resetRoundArena() {
    this.player = null;
    this.player2 = null;
    this.enemies = [];
    this.spawningTanks = [];
    this.bullets = [];
    this.explosions = [];
    this.powerUps = [];
    this.scorePopups = [];
    this.freezeEnemiesTimer = 0;
    this.shovelTimer = 0;
    this.initGrid(this.currentMap.grid);
    this.gridVersion++;
    this.clearSpawnArea(this.playerSpawn.x, this.playerSpawn.y);
    this.clearSpawnArea(this.p2Spawn.x, this.p2Spawn.y);
    this.spawnPlayer(1);
    this.spawnPlayer(2);
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
          this.grid[r][c] = {
            type: TileType.EMPTY,
            damageMask: 0,
          };
        }
      }
    }
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
      return t === TileType.EMPTY || t === TileType.TREES || t === TileType.ICE;
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

  private spawnPlayer(index: 1 | 2 = 1) {
    const isP2 = index === 2;
    const pt = isP2 ? this.p2Spawn : this.playerSpawn;
    this.clearSpawnArea(pt.x, pt.y);
    this.spawningTanks.push({
      id: (isP2 ? 'player2_spawn_' : 'player1_spawn_') + Date.now(),
      isPlayer: true,
      playerIndex: index,
      type: 'PLAYER',
      x: pt.x,
      y: pt.y,
      direction: isP2 && this.multiMode === 'versus' ? 'DOWN' : 'UP',
      progress: 0,
    });
  }

  private createPlayerTank(x: number, y: number, index: 1 | 2 = 1): Tank {
    const isP2 = index === 2;
    return {
      id: isP2 ? 'player_2' : 'player_1',
      isPlayer: true,
      playerIndex: index,
      type: 'PLAYER',
      x,
      y,
      direction: isP2 && this.multiMode === 'versus' ? 'DOWN' : 'UP',
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
    soundManager.playPause();
    this.onStateChange(this.gameState, this.scoreData);
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
    }

    this.render();

    this.animFrameId = requestAnimationFrame(this.loop);
  };

  // --- Game State Update ---
  private update() {
    // Guest thin-client: render interpolated host snapshots + own-tank prediction
    if (this.isRemoteViewer) {
      this.updateRemote();
      return;
    }

    // Round banners: end-phase keeps explosions/popups animating only;
    // intro-phase lets the spawn stars spin while the duel is frozen.
    if (this.gameState === GameState.ROUND_END) {
      this.updateEffects();
      return;
    }
    if (this.gameState === GameState.ROUND_INTRO) {
      this.updateSpawningTanks();
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

    // 5. Update Player Tanks
    this.updatePlayer();
    if (this.multiMode !== 'single') {
      this.updatePlayer2();
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

    // 9. Update Explosions & Score Popups
    this.updateEffects();

    // 10. Engine Sound
    const isPlayerDriving = Boolean((this.player && this.player.moving) || (this.player2 && this.player2.moving));
    soundManager.updateEngineSound(isPlayerDriving);

    // 11. Check Victory / Stage Cleared
    if (this.multiMode !== 'versus') {
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
    const view = this.snapBuffer.sample();
    if (view) this.applyRemoteView(view);

    // Client-side prediction only while the fight is live (frozen during
    // round banners; the host authority resets the arena between rounds)
    if (this.gameState === GameState.PLAYING) {
      this.updatePlayer2();
      this.reconcileP2();
    }

    this.updateEffects();
    const driving = Boolean((this.player && this.player.moving) || (this.player2 && this.player2.moving));
    soundManager.updateEngineSound(driving);
  }

  private applyRemoteView(view: NetSnapshot) {
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
      // P2 is the guest's own predicted tank - create it once, then let
      // updatePlayer2 (prediction) + reconcileP2 (authority) drive it.
      if (!this.player2) this.player2 = this.createPlayerTank(view.p2.x as number, view.p2.y as number, 2);
    } else {
      this.player2 = null;
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

    this.bullets = view.bullets.map(
      (b) =>
        ({
          id: b.id,
          ownerId: '',
          isPlayer: b.isPlayer as boolean,
          playerIndex: b.pIdx as 1 | 2 | undefined,
          x: b.x,
          y: b.y,
          direction: b.dir as Direction,
          speed: 4.5,
          canDestroySteel: false,
          size: 4,
        }) as Bullet
    );

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
  }

  private reconcileP2() {
    const auth = this.p2AuthTarget;
    if (!auth || !this.player2) return;
    const dx = auth.x - this.player2.x;
    const dy = auth.y - this.player2.y;
    const err = Math.abs(dx) + Math.abs(dy);
    if (err > 32) {
      // Large divergence (teleport/respawn/wall correction): snap
      this.player2.x = auth.x;
      this.player2.y = auth.y;
      this.player2.direction = auth.dir;
    } else if (err > 3) {
      // Small drift: ease toward the authoritative position
      this.player2.x += dx * 0.18;
      this.player2.y += dy * 0.18;
      if (!this.player2.moving) this.player2.direction = auth.dir;
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

  private decodeGrid(flat: number[], version: number) {
    if (!Array.isArray(flat) || flat.length < this.gridSize * this.gridSize) return;
    for (let r = 0; r < this.gridSize; r++) {
      for (let c = 0; c < this.gridSize; c++) {
        const v = flat[r * this.gridSize + c] | 0;
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
          if (sp.playerIndex === 2) {
            this.player2 = this.createPlayerTank(sp.x, sp.y, 2);
          } else {
            this.player = this.createPlayerTank(sp.x, sp.y, 1);
          }
          this.spawningTanks.splice(i, 1);
        } else {
          // Verify that spawn point is clear of other tanks before materializing
          const isBlocked =
            (this.player && this.rectIntersect(sp.x, sp.y, 32, 32, this.player.x, this.player.y, 32, 32)) ||
            (this.player2 && this.rectIntersect(sp.x, sp.y, 32, 32, this.player2.x, this.player2.y, 32, 32)) ||
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

  // --- Player 2 Tank Physics (Green Tank) ---
  private updatePlayer2() {
    if (!this.player2) return;

    if (this.player2.shieldTimer > 0) {
      this.player2.shieldTimer--;
    }
    if (this.player2.shootCooldown > 0) {
      this.player2.shootCooldown--;
    }

    // Fire Button (edge triggered or rapid if high tier)
    const fireRequested = this.p2Input.fire;
    if (fireRequested && (!this.prevP2FireInput || this.player2.tier >= 2)) {
      if (this.player2.shootCooldown <= 0) {
        // Remote viewer: the authoritative bullet spawns on the host and
        // arrives via snapshots - we only give instant audio feedback.
        if (this.isRemoteViewer) soundManager.playShoot();
        else this.fireBullet(this.player2);
        this.player2.shootCooldown = this.player2.tier >= 2 ? 14 : 22;
      }
    }
    this.prevP2FireInput = fireRequested;

    // Movement Direction
    let dir: Direction | null = null;
    if (this.p2Input.up) dir = 'UP';
    else if (this.p2Input.down) dir = 'DOWN';
    else if (this.p2Input.left) dir = 'LEFT';
    else if (this.p2Input.right) dir = 'RIGHT';

    // Ice slide mechanic
    const currentSubX = Math.floor((this.player2.x + 16) / BLOCK_SIZE);
    const currentSubY = Math.floor((this.player2.y + 16) / BLOCK_SIZE);
    const isOnIce = this.grid[currentSubY]?.[currentSubX]?.type === TileType.ICE;

    if (dir) {
      this.player2.direction = dir;
      this.moveTankWithCorridorSnap(this.player2, dir, this.player2.speed);
      this.player2.moving = true;
      if (isOnIce) {
        this.player2.slideFrames = 12;
      }
    } else if (this.player2.slideFrames > 0 && isOnIce) {
      this.moveTankWithCorridorSnap(this.player2, this.player2.direction, this.player2.speed * 0.7);
      this.player2.slideFrames--;
      this.player2.moving = true;
    } else {
      this.player2.moving = false;
      this.player2.slideFrames = 0;
    }
  }

  // --- Player Tank Physics ---
  private updatePlayer() {
    if (!this.player) return;

    if (this.player.shieldTimer > 0) {
      this.player.shieldTimer--;
    }
    if (this.player.shootCooldown > 0) {
      this.player.shootCooldown--;
    }

    // Fire Button (edge triggered or rapid if high tier)
    const fireRequested = this.currentInput.fire;
    if (fireRequested && (!this.prevFireInput || this.player.tier >= 2)) {
      if (this.player.shootCooldown <= 0) {
        this.fireBullet(this.player);
        this.player.shootCooldown = this.player.tier >= 2 ? 14 : 22;
      }
    }
    this.prevFireInput = fireRequested;

    // Movement Direction
    let dir: Direction | null = null;
    if (this.currentInput.up) dir = 'UP';
    else if (this.currentInput.down) dir = 'DOWN';
    else if (this.currentInput.left) dir = 'LEFT';
    else if (this.currentInput.right) dir = 'RIGHT';

    // Ice slide mechanic
    const currentSubX = Math.floor((this.player.x + 16) / BLOCK_SIZE);
    const currentSubY = Math.floor((this.player.y + 16) / BLOCK_SIZE);
    const isOnIce = this.grid[currentSubY]?.[currentSubX]?.type === TileType.ICE;

    if (dir) {
      this.player.direction = dir;
      this.moveTankWithCorridorSnap(this.player, dir, this.player.speed);
      this.player.moving = true;
      if (isOnIce) {
        this.player.slideFrames = 12; // Store momentum for sliding
      }
    } else if (this.player.slideFrames > 0 && isOnIce) {
      // Continue sliding forward
      this.moveTankWithCorridorSnap(this.player, this.player.direction, this.player.speed * 0.7);
      this.player.slideFrames--;
      this.player.moving = true;
    } else {
      this.player.moving = false;
      this.player.slideFrames = 0;
    }
  }

  // --- Smooth Corridor Corner-Snapping (Authentic NES Navigation) ---
  // When a tank tries to turn into a corridor, snap perpendicular axis to 16px grid safely
  private moveTankWithCorridorSnap(tank: Tank, dir: Direction, speed: number) {
    if (!tank || !dir) return;
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
      // Player 1 vs Player 2 collision
      if (tank === this.player && this.player2) {
        if (this.isTankBlockedByOtherTank(tank, targetX, targetY, this.player2)) {
          return false;
        }
      } else if (tank === this.player2 && this.player) {
        if (this.isTankBlockedByOtherTank(tank, targetX, targetY, this.player)) {
          return false;
        }
      }
      for (const enemy of this.enemies) {
        if (this.isTankBlockedByOtherTank(tank, targetX, targetY, enemy)) {
          return false;
        }
      }
    } else {
      // Enemy vs Player 1
      if (this.player && this.isTankBlockedByOtherTank(tank, targetX, targetY, this.player)) {
        return false;
      }
      // Enemy vs Player 2
      if (this.player2 && this.isTankBlockedByOtherTank(tank, targetX, targetY, this.player2)) {
        return false;
      }
      // Enemy vs Other Enemies
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
    if (this.player) allTanks.push(this.player);
    if (this.player2) allTanks.push(this.player2);
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

        // Smart steering: Bias towards Eagle Base or Player
        const baseTargetX = this.baseX + 16;
        const baseTargetY = this.baseY;
        const targetX = Math.random() < 0.6 ? baseTargetX : this.player?.x ?? baseTargetX;
        const targetY = Math.random() < 0.6 ? baseTargetY : this.player?.y ?? baseTargetY;

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
      this.moveTankWithCorridorSnap(enemy, enemy.direction, enemy.speed);

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
  private fireBullet(tank: Tank) {
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
      x: bx,
      y: by,
      direction: tank.direction,
      speed: tank.bulletSpeed,
      canDestroySteel: tank.isPlayer && tank.tier >= 3,
      size: 4,
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
            bulletsToRemove.add(bullet.id);
            bulletsToRemove.add(other.id);
            bulletCancelled = true;
            break;
          }
        }
      }
      if (bulletCancelled) continue;

      // C. Bullet vs Base Eagle
      if (
        this.multiMode !== 'versus' &&
        this.baseState === BaseState.ALIVE &&
        this.rectIntersect(bullet.x - 3, bullet.y - 3, 6, 6, this.baseX, this.baseY, 32, 32)
      ) {
        this.destroyBase();
        this.createExplosion(this.baseX + 16, this.baseY + 16, true);
        bulletsToRemove.add(bullet.id);
        continue;
      }

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
        // Enemy bullet hitting player 1 tank
        if (
          this.player &&
          this.rectIntersect(bullet.x - 3, bullet.y - 3, 6, 6, this.player.x + 2, this.player.y + 2, 28, 28)
        ) {
          if (this.player.shieldTimer <= 0) {
            this.handlePlayerKilled();
          } else {
            // Shield ricochet
            soundManager.playHitSteel();
            this.createExplosion(bullet.x, bullet.y, false);
          }
          bulletsToRemove.add(bullet.id);
          continue;
        }

        // Enemy bullet hitting player 2 tank
        if (
          this.player2 &&
          this.rectIntersect(bullet.x - 3, bullet.y - 3, 6, 6, this.player2.x + 2, this.player2.y + 2, 28, 28)
        ) {
          if (this.player2.shieldTimer <= 0) {
            this.handlePlayer2Killed();
          } else {
            // Shield ricochet
            soundManager.playHitSteel();
            this.createExplosion(bullet.x, bullet.y, false);
          }
          bulletsToRemove.add(bullet.id);
          continue;
        }
      }

      // 1v1 Versus Mode: Player vs Player direct hits
      if (this.multiMode === 'versus' && bullet.isPlayer) {
        if (bullet.playerIndex === 1 && this.player2) {
          if (this.rectIntersect(bullet.x - 3, bullet.y - 3, 6, 6, this.player2.x + 2, this.player2.y + 2, 28, 28)) {
            if (this.player2.shieldTimer <= 0) {
              this.handlePlayer2Killed();
            } else {
              soundManager.playHitSteel();
              this.createExplosion(bullet.x, bullet.y, false);
            }
            bulletsToRemove.add(bullet.id);
            continue;
          }
        } else if (bullet.playerIndex === 2 && this.player) {
          if (this.rectIntersect(bullet.x - 3, bullet.y - 3, 6, 6, this.player.x + 2, this.player.y + 2, 28, 28)) {
            if (this.player.shieldTimer <= 0) {
              this.handlePlayerKilled();
            } else {
              soundManager.playHitSteel();
              this.createExplosion(bullet.x, bullet.y, false);
            }
            bulletsToRemove.add(bullet.id);
            continue;
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
  private handlePlayerKilled() {
    if (!this.player) return;
    this.createExplosion(this.player.x + 16, this.player.y + 16, true);
    soundManager.playBigExplosion();
    this.player = null;

    if (this.multiMode === 'versus') {
      // Round system: gold destroyed = green takes the round
      this.endRound(2);
      return;
    }

    this.scoreData.playerLives--;
    this.onStateChange(this.gameState, this.scoreData);

    // Respawn Player 1
    setTimeout(() => {
      if (this.gameState === GameState.PLAYING && (this.baseState === BaseState.ALIVE || this.multiMode === 'versus')) {
        this.spawnPlayer(1);
      }
    }, 1000);
  }

  // --- Player 2 Death & Respawn ---
  private handlePlayer2Killed() {
    if (!this.player2) return;
    this.createExplosion(this.player2.x + 16, this.player2.y + 16, true);
    soundManager.playBigExplosion();
    this.player2 = null;

    if (this.multiMode === 'versus') {
      // Round system: green destroyed = gold takes the round
      this.endRound(1);
      return;
    }

    if (this.scoreData.player2Lives !== undefined) {
      this.scoreData.player2Lives--;
    }
    this.onStateChange(this.gameState, this.scoreData);

    // Respawn Player 2
    setTimeout(() => {
      if (this.gameState === GameState.PLAYING && (this.baseState === BaseState.ALIVE || this.multiMode === 'versus')) {
        this.spawnPlayer(2);
      }
    }, 1000);
  }

  // --- Base Eagle Destroyed ---
  private destroyBase() {
    this.baseState = BaseState.DESTROYED;
    soundManager.playBigExplosion();
    this.createExplosion(this.baseX + 16, this.baseY + 16, true);
    setTimeout(() => {
      this.handleGameOver();
    }, 1200);
  }

  // --- Game Over ---
  private handleGameOver() {
    this.gameState = GameState.GAME_OVER;
    soundManager.playGameOver();
    this.onStateChange(this.gameState, this.scoreData);
  }

  // --- Victory ---
  private handleVictory() {
    this.gameState = GameState.VICTORY;
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
      if (this.player && this.rectIntersect(this.player.x, this.player.y, 32, 32, pup.x, pup.y, 30, 30)) {
        this.collectPowerUp(pup.type);
        this.addScorePopup(pup.x + 15, pup.y + 15, 500);
        this.scoreData.score += 500;
        this.onStateChange(this.gameState, this.scoreData);
        soundManager.playPowerUpCollect();
        this.emitNetEvent({ t: 'pickup' });
        this.powerUps.splice(i, 1);
      }
    }
  }

  private collectPowerUp(type: PowerUpType) {
    if (!this.player) return;

    if (type === 'STAR') {
      this.player.tier = Math.min(3, this.player.tier + 1);
      if (this.player.tier >= 1) this.player.bulletSpeed = 6.0;
      if (this.player.tier >= 2) this.player.speed = this.playerBaseSpeed * 1.3;
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
      this.applyShovelBunker();
    } else if (type === 'HELMET') {
      // 15 seconds invulnerability
      this.player.shieldTimer = 900;
    } else if (type === 'LIFE') {
      this.scoreData.playerLives++;
    }
  }

  private applyShovelBunker() {
    this.shovelTimer = 1200;
    this.shovelBunkerTiles = [];

    // Base eagle surrounding coordinates:
    const bunkerCoords = [
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
  }

  // --- Rendering Pipeline ---
  public render() {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.canvasSize, this.canvasSize);

    // 1. Black Field Background
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, this.canvasSize, this.canvasSize);

    // 2. Render Ice (underneath tanks)
    for (let r = 0; r < this.gridSize; r++) {
      for (let c = 0; c < this.gridSize; c++) {
        if (this.grid[r][c].type === TileType.ICE) {
          SpriteRenderer.renderIce(ctx, c * BLOCK_SIZE, r * BLOCK_SIZE);
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

    // 5. Render Base Eagle (co-op and single-player only)
    if (this.multiMode !== 'versus') {
      SpriteRenderer.renderBase(ctx, this.baseX, this.baseY, this.baseState);
    }

    // 6. Render Spawning Stars
    for (const sp of this.spawningTanks) {
      SpriteRenderer.renderSpawnAnimation(ctx, sp.x, sp.y, sp.progress);
    }

    // 7. Render Tanks (Enemies, Player 1 Gold Tank, Player 2 Green Tank)
    for (const enemy of this.enemies) {
      if (enemy) {
        SpriteRenderer.renderTank(ctx, enemy, this.tickCount);
      }
    }
    if (this.player) {
      SpriteRenderer.renderTank(ctx, this.player, this.tickCount);
    }
    if (this.player2) {
      SpriteRenderer.renderTank(ctx, this.player2, this.tickCount);
    }

    // 8. Render Bullets
    for (const b of this.bullets) {
      if (b && b.direction) {
        SpriteRenderer.renderBullet(ctx, b.x, b.y, b.direction);
      }
    }

    // 9. Render Power-Up Pickups
    for (const pup of this.powerUps) {
      SpriteRenderer.renderPowerUp(ctx, pup.type, pup.x, pup.y, this.tickCount);
    }

    // 10. Top Layer: Trees / Foliage (Tanks and bullets drive UNDER trees!)
    for (let r = 0; r < this.gridSize; r++) {
      for (let c = 0; c < this.gridSize; c++) {
        if (this.grid[r][c].type === TileType.TREES) {
          SpriteRenderer.renderTrees(ctx, c * BLOCK_SIZE, r * BLOCK_SIZE);
        }
      }
    }

    // 11. Render Explosions
    for (const exp of this.explosions) {
      SpriteRenderer.renderExplosion(ctx, exp.x, exp.y, exp.frame, exp.maxFrames, exp.isBig);
    }

    // 12. Score Popups
    for (const pop of this.scorePopups) {
      SpriteRenderer.renderScorePopup(ctx, pop.x, pop.y, pop.points);
    }

    // 13. Render Taunt Speech Bubble
    if (this.tauntMessage && this.tauntMessage.timer > 0) {
      this.tauntMessage.timer--;
      const targetTank = this.tauntMessage.sender === 'P1' ? this.player : this.player2;
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
    }
  }

  public getNetworkSnapshot() {
    // Grid payload rides along only when the terrain actually changed -
    // brick destruction syncs to the guest without per-frame overhead.
    const sendGrid = this.gridVersion !== this.lastSentGridVersion;
    if (sendGrid) this.lastSentGridVersion = this.gridVersion;

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
      })),
      powerUps: this.powerUps.map((p) => ({
        id: p.id,
        type: p.type,
        x: p.x,
        y: p.y,
      })),
      scoreData: this.scoreData,
      baseState: this.baseState,
      gameState: this.gameState,
      gv: this.gridVersion,
      ...(sendGrid ? { grid: this.encodeGrid() } : {}),
    };
  }

  public applyNetworkSnapshot(data: any) {
    if (!data) return;

    if (this.isRemoteViewer) {
      // Thin client: buffer for interpolation + authoritative bookkeeping.
      // Entity positions come from the interpolated view, never written raw.
      this.snapBuffer.push(data);
      this.p2AuthTarget = data.p2
        ? { x: data.p2.x, y: data.p2.y, dir: data.p2.dir, moving: data.p2.moving }
        : null;
      if (Array.isArray(data.grid) && typeof data.gv === 'number' && data.gv !== this.gridVersion) {
        this.decodeGrid(data.grid, data.gv);
      }
      if (data.scoreData) {
        this.scoreData = { ...this.scoreData, ...data.scoreData };
        this.onStateChange(this.gameState, this.scoreData);
      }
      if (data.baseState !== undefined) {
        this.baseState = data.baseState;
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
    if (data.baseState !== undefined) {
      this.baseState = data.baseState;
    }
    if (data.gameState && data.gameState !== this.gameState) {
      this.gameState = data.gameState;
      this.onStateChange(this.gameState, this.scoreData);
    }
  }
}
