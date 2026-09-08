/**
 * Battle City 1990 - Payload Manager (Team Fortress 2 Cart Mode)
 * Simulates the armored payload cart along the Badwater Basin railway track.
 * Handles push auras, contested stalemates, idle rollback, checkpoint triggers,
 * and solid entity collision with tanks and bullets.
 */

import { Direction, Position, Tank, Bullet, PayloadStatus, PayloadCheckpoint, PayloadState } from '../types';
import { BADWATER_WAYPOINTS, BADWATER_CHECKPOINTS, BadwaterWaypoint } from './maps';
import { soundManager } from './SoundManager';

export interface Segment {
  start: BadwaterWaypoint;
  end: BadwaterWaypoint;
  length: number;
  dir: Direction;
  startDist: number;
}

export class PayloadManager {
  public attackerSlot: 1 | 2 = 1;
  public defenderSlot: 1 | 2 = 2;

  // Track geometry
  public waypoints: BadwaterWaypoint[] = BADWATER_WAYPOINTS;
  private rawCheckpoints: PayloadCheckpoint[] = BADWATER_CHECKPOINTS;
  private segments: Segment[] = [];
  public totalTrackLength: number = 0;
  public currentDistance: number = 0;

  // Cart properties
  public cartPosition: Position = { x: 264, y: 472 };
  public cartDirection: Direction = 'UP';
  public cartWidth: number = 30;
  public cartHeight: number = 30;
  public pushRadius: number = 54; // Pixel aura around cart center
  public isExploded: boolean = false;

  // Speed and timers
  public pushSpeed: number = 0.85; // Pixels per frame (approx 51 px/sec at 60fps)
  public rollbackSpeed: number = 0.40; // Pixels per frame (approx 24 px/sec)
  public idleFramesBeforeRollback: number = 300; // 5.0 seconds at 60fps
  private idleTimer: number = 0;

  // Match flow
  public timeRemainingSec: number = 150; // 2 minutes 30 seconds initial timer
  public elapsedTicks: number = 0;
  public status: PayloadStatus = 'IDLE';
  public checkpoints: PayloadCheckpoint[] = [];
  public currentCheckpointIdx: number = -1;
  public minAllowedDistance: number = 0;
  public winner: 1 | 2 | null = null;
  public matchOver: boolean = false;

  // Sound throttles
  private chugSoundTimer: number = 0;

  constructor(
    attackerSlot: 1 | 2 = 1,
    customWaypoints?: BadwaterWaypoint[],
    customCheckpoints?: PayloadCheckpoint[]
  ) {
    this.attackerSlot = attackerSlot;
    this.defenderSlot = attackerSlot === 1 ? 2 : 1;
    if (customWaypoints && customWaypoints.length >= 2) {
      this.waypoints = customWaypoints;
    }
    if (customCheckpoints && customCheckpoints.length >= 2) {
      this.rawCheckpoints = customCheckpoints;
    }
    this.initSegments();
    this.initCheckpoints();
    this.updatePositionFromDistance();
  }

  private initSegments() {
    this.segments = [];
    this.totalTrackLength = 0;

    for (let i = 0; i < this.waypoints.length - 1; i++) {
      const start = this.waypoints[i];
      const end = this.waypoints[i + 1];
      const dx = end.x - start.x;
      const dy = end.y - start.y;
      const length = Math.sqrt(dx * dx + dy * dy);

      let dir: Direction = 'UP';
      if (Math.abs(dx) > Math.abs(dy)) {
        dir = dx > 0 ? 'RIGHT' : 'LEFT';
      } else {
        dir = dy > 0 ? 'DOWN' : 'UP';
      }

      this.segments.push({
        start,
        end,
        length,
        dir,
        startDist: this.totalTrackLength,
      });

      this.totalTrackLength += length;
    }
  }

  private initCheckpoints() {
    this.checkpoints = this.rawCheckpoints.map((cp) => ({
      id: cp.id,
      name: cp.name,
      x: cp.x,
      y: cp.y,
      progress: cp.progress,
      captured: false,
    }));
    this.currentCheckpointIdx = -1;
    this.minAllowedDistance = 0;
  }

  public setExploded(exploded: boolean) {
    this.isExploded = exploded;
  }

  public reset(
    attackerSlot: 1 | 2 = 1,
    customWaypoints?: BadwaterWaypoint[],
    customCheckpoints?: PayloadCheckpoint[]
  ) {
    this.attackerSlot = attackerSlot;
    this.defenderSlot = attackerSlot === 1 ? 2 : 1;
    if (customWaypoints && customWaypoints.length >= 2) {
      this.waypoints = customWaypoints;
    }
    if (customCheckpoints && customCheckpoints.length >= 2) {
      this.rawCheckpoints = customCheckpoints;
    }
    this.currentDistance = 0;
    this.minAllowedDistance = 0;
    this.elapsedTicks = 0;
    this.timeRemainingSec = 150;
    this.status = 'IDLE';
    this.idleTimer = 0;
    this.winner = null;
    this.matchOver = false;
    this.isExploded = false;
    this.initSegments();
    this.initCheckpoints();
    this.updatePositionFromDistance();
  }

  public resetClock() {
    this.elapsedTicks = 0;
    this.timeRemainingSec = 150;
  }

  /**
   * Main simulation tick called from GameEngine update loop
   */
  public update(
    p1Tank: Tank | null,
    p2Tank: Tank | null,
    onStateNotice?: (text: string, color?: string) => void
  ): PayloadState {
    if (this.matchOver) {
      return this.getState();
    }

    // Precise fixed 60Hz frame-based countdown (starts at 150s = 02:30, decrements 1 sec every 60 simulation ticks)
    this.elapsedTicks++;
    this.timeRemainingSec = Math.max(0, 150 - Math.floor(this.elapsedTicks / 60));

    // Identify Attacker & Defender tanks
    const attackerTank = this.attackerSlot === 1 ? p1Tank : p2Tank;
    const defenderTank = this.defenderSlot === 1 ? p1Tank : p2Tank;

    // Check distances to cart center
    const cx = this.cartPosition.x;
    const cy = this.cartPosition.y;

    const attackerInAura =
      Boolean(attackerTank && attackerTank.hp > 0) &&
      this.getDistance(attackerTank!.x + 16, attackerTank!.y + 16, cx, cy) <= this.pushRadius;

    const defenderInAura =
      Boolean(defenderTank && defenderTank.hp > 0) &&
      this.getDistance(defenderTank!.x + 16, defenderTank!.y + 16, cx, cy) <= this.pushRadius;

    // Evaluate Push Status
    if (attackerInAura && defenderInAura) {
      // Contested stalemate (Both players inside aura)
      this.status = 'CONTESTED';
      this.idleTimer = 0;
    } else if (attackerInAura) {
      // Attacker advancing cart
      this.status = 'PUSHING';
      this.idleTimer = 0;
      this.currentDistance += this.pushSpeed;

      // Play cart mechanical rhythm
      this.chugSoundTimer++;
      if (this.chugSoundTimer % 24 === 0) {
        soundManager.playHitBrick();
      }
    } else {
      // Attacker not in aura
      if (defenderInAura) {
        // Defender near cart: blocks advance completely, no rollback acceleration
        this.status = 'CONTESTED';
        this.idleTimer = 0;
      } else {
        // Nobody pushing: count idle frames
        this.idleTimer++;
        if (this.idleTimer >= this.idleFramesBeforeRollback) {
          this.status = 'ROLLBACK';
          this.currentDistance = Math.max(this.minAllowedDistance, this.currentDistance - this.rollbackSpeed);
        } else {
          this.status = 'IDLE';
        }
      }
    }

    // Keep within bounds
    this.currentDistance = Math.max(this.minAllowedDistance, Math.min(this.totalTrackLength, this.currentDistance));
    this.updatePositionFromDistance();

    // Checkpoint triggers
    const progress = this.totalTrackLength > 0 ? this.currentDistance / this.totalTrackLength : 0;
    for (let i = 0; i < this.checkpoints.length; i++) {
      const cp = this.checkpoints[i];
      if (!cp.captured && progress >= cp.progress - 0.005) {
        cp.captured = true;
        this.currentCheckpointIdx = i;

        if (i < this.checkpoints.length - 1) {
          // Regular checkpoint: lock minimum rollback distance
          this.minAllowedDistance = this.currentDistance;
          soundManager.playPowerUpCollect();
          if (onStateNotice) {
            onStateNotice(`${cp.name} CAPTURED!`, '#58b8d8');
          }
        } else {
          // Final Point reached! Mass explosion and attacker victory!
          this.matchOver = true;
          this.winner = this.attackerSlot;
          soundManager.playEagleExplosion();
          if (onStateNotice) {
            onStateNotice(`FINAL POINT DETONATED! ATTACKER WINS!`, '#f8b800');
          }
        }
      }
    }

    // Check Time Expiration
    if (this.timeRemainingSec <= 0 && !this.matchOver) {
      this.matchOver = true;
      this.winner = this.defenderSlot;
      soundManager.playBigExplosion();
      if (onStateNotice) {
        onStateNotice(`TIME EXPIRED! DEFENDER WINS!`, '#55f855');
      }
    }

    return this.getState();
  }

  private updatePositionFromDistance() {
    if (this.segments.length === 0) return;

    let targetDist = this.currentDistance;

    for (let i = 0; i < this.segments.length; i++) {
      const seg = this.segments[i];
      if (targetDist <= seg.length || i === this.segments.length - 1) {
        const ratio = seg.length > 0 ? Math.min(1, Math.max(0, targetDist / seg.length)) : 0;
        this.cartPosition = {
          x: seg.start.x + (seg.end.x - seg.start.x) * ratio,
          y: seg.start.y + (seg.end.y - seg.start.y) * ratio,
        };
        this.cartDirection = seg.dir;
        return;
      }
      targetDist -= seg.length;
    }
  }

  private getDistance(x1: number, y1: number, x2: number, y2: number): number {
    const dx = x2 - x1;
    const dy = y2 - y1;
    return Math.sqrt(dx * dx + dy * dy);
  }

  /**
   * Checks if a tank collides with the solid payload cart.
   * Returns true if tank is touching or penetrating the cart hitbox.
   */
  public checkTankCollision(tank: Tank): boolean {
    const halfW = this.cartWidth / 2;
    const halfH = this.cartHeight / 2;
    const cartLeft = this.cartPosition.x - halfW;
    const cartRight = this.cartPosition.x + halfW;
    const cartTop = this.cartPosition.y - halfH;
    const cartBottom = this.cartPosition.y + halfH;

    const tankLeft = tank.x;
    const tankRight = tank.x + 32;
    const tankTop = tank.y;
    const tankBottom = tank.y + 32;

    return !(
      tankRight <= cartLeft ||
      tankLeft >= cartRight ||
      tankBottom <= cartTop ||
      tankTop >= cartBottom
    );
  }

  /**
   * Checks if a bullet hits the solid armored cart.
   * If hit, absorbs bullet and produces steel sparks.
   */
  public checkBulletHit(bullet: Bullet): boolean {
    const halfW = this.cartWidth / 2;
    const halfH = this.cartHeight / 2;
    const cartLeft = this.cartPosition.x - halfW;
    const cartRight = this.cartPosition.x + halfW;
    const cartTop = this.cartPosition.y - halfH;
    const cartBottom = this.cartPosition.y + halfH;

    const bx = bullet.x;
    const by = bullet.y;

    if (bx >= cartLeft && bx <= cartRight && by >= cartTop && by <= cartBottom) {
      soundManager.playHitSteel();
      return true;
    }
    return false;
  }

  public getState(): PayloadState {
    const progress = this.totalTrackLength > 0 ? this.currentDistance / this.totalTrackLength : 0;
    return {
      cartPosition: { ...this.cartPosition },
      cartDirection: this.cartDirection,
      progress: Math.min(1, Math.max(0, progress)),
      status: this.status,
      attackerSlot: this.attackerSlot,
      defenderSlot: this.defenderSlot,
      timeRemainingSec: Math.ceil(this.timeRemainingSec),
      currentCheckpointIdx: this.currentCheckpointIdx,
      checkpoints: this.checkpoints.map((cp) => ({ ...cp })),
      winner: this.winner,
      isExploded: this.isExploded,
    };
  }
}
