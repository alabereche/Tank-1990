/**
 * Battle City 1990 - Types and Interfaces
 */

export type Direction = 'UP' | 'RIGHT' | 'DOWN' | 'LEFT';

export enum TileType {
  EMPTY = 0,
  BRICK = 1,
  STEEL = 2,
  WATER = 3,
  TREES = 4,
  ICE = 5,
  BASE = 6,
}

// 16x16 sub-tile brick quadrant destruction mask (4 bits: TL=1, TR=2, BL=4, BR=8)
// 15 = fully intact (all 4 quadrants)
export interface SubTile {
  type: TileType;
  damageMask: number; // 0-15 bitmask for BRICK sub-quadrants
}

export type EnemyType = 'BASIC' | 'FAST' | 'POWER' | 'ARMOR';

export interface Position {
  x: number;
  y: number;
}

export interface Tank {
  id: string;
  isPlayer: boolean;
  playerIndex?: number; // 1 to 8 (1 = Gold, 2 = Green, etc.)
  team?: 'A' | 'B' | 'FFA';
  slot?: number;
  type: EnemyType | 'PLAYER';
  x: number;
  y: number;
  direction: Direction;
  desiredDirection: Direction | null;
  speed: number;
  moving: boolean;
  distanceTraveled: number; // For tread animation
  tier: number; // 0 to 3 for player
  maxHp: number;
  hp: number;
  isFlashingBonus?: boolean; // Enemy drops powerup when damaged
  shieldTimer: number; // Frames remaining of invulnerability
  slideFrames: number; // Frames remaining of ice slide
  shootCooldown: number; // Frames until can shoot again
  bulletSpeed: number;
  aiChangeDirTimer?: number;
  aiShootTimer?: number;
}

export interface Bullet {
  id: string;
  ownerId: string;
  isPlayer: boolean;
  playerIndex?: number;
  team?: 'A' | 'B' | 'FFA';
  x: number;
  y: number;
  direction: Direction;
  speed: number;
  canDestroySteel: boolean;
  size: number;
}

export type PowerUpType = 'STAR' | 'BOMB' | 'TIMER' | 'SHOVEL' | 'HELMET' | 'LIFE';

export interface PowerUp {
  id: string;
  type: PowerUpType;
  x: number;
  y: number;
  flashFrame: number;
  duration: number; // Frames before despawning
}

export interface Explosion {
  id: string;
  x: number;
  y: number;
  frame: number;
  maxFrames: number;
  isBig: boolean;
}

export interface ScorePopup {
  id: string;
  x: number;
  y: number;
  points: number;
  timer: number;
}

export type MapSizePreset = 'classic' | 'large' | 'giant';
export type WindowScalePreset = 'standard' | 'large' | 'max';

export interface GameSettings {
  mapSize: MapSizePreset;
  playerSpeed: number;
  showScanlines: boolean;
  soundEnabled: boolean;
  windowScale?: WindowScalePreset;
}

export enum BaseState {
  ALIVE = 'ALIVE',
  DESTROYED = 'DESTROYED',
}

export enum GameState {
  MENU = 'MENU',
  STAGE_START = 'STAGE_START',
  PLAYING = 'PLAYING',
  PAUSED = 'PAUSED',
  GAME_OVER = 'GAME_OVER',
  VICTORY = 'VICTORY',
  BUILDING = 'BUILDING',
  // 1v1 versus round flow (first to 7 round wins takes the match)
  ROUND_INTRO = 'ROUND_INTRO',
  ROUND_END = 'ROUND_END',
  MATCH_END = 'MATCH_END',
}

export interface StageMap {
  name: string;
  // 26 x 26 grid of sub-tiles (each sub-tile is 16x16 px)
  grid: number[][]; // TileType numbers
}

export interface GameScore {
  score: number;
  highScore: number;
  playerLives: number;
  player2Lives?: number;
  player2Score?: number;
  stage: number;
  enemiesRemaining: EnemyType[]; // Remaining pool of 20 enemies
  activeEnemiesCount: number;
  destroyedEnemies: {
    BASIC: number;
    FAST: number;
    POWER: number;
    ARMOR: number;
  };
  // 1v1 versus round system
  roundNumber?: number;
  roundWinsP1?: number;
  roundWinsP2?: number;
  roundWinner?: 0 | 1 | 2; // 0 = draw (mutual destruction)
  matchWinner?: 1 | 2;
  // 2v2 Team & 8 FFA stats
  teamWinsA?: number;
  teamWinsB?: number;
  teamWinner?: 'A' | 'B' | 'DRAW';
  playerStats?: Record<number, { kills: number; deaths: number; score: number; lives: number }>;
  ffaWinner?: number; // winning player slot when the FFA kill target is reached
}

export interface InputState {
  up: boolean;
  right: boolean;
  down: boolean;
  left: boolean;
  fire: boolean;
  pause: boolean;
}

export type MultiplayerMode = 'single' | 'coop' | 'versus' | '2v2' | 'ffa';
export type MultiplayerRole = 'host' | 'guest';

export interface MultiplayerPlayerInfo {
  slot: number;
  team?: 'A' | 'B' | 'FFA';
  role: MultiplayerRole;
  ping?: number;
  ready?: boolean;
}

export interface MultiplayerState {
  roomCode: string;
  role: MultiplayerRole;
  mode: MultiplayerMode;
  peerConnected: boolean;
  ping: number;
}

