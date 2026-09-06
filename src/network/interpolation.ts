/**
 * Battle City 1990 - Snapshot Interpolation Buffer (Guest Thin-Client)
 * Holds recent authoritative snapshots from the host and produces a smooth,
 * delayed view by blending entity positions between the two snapshots that
 * surround the render timestamp. The guest renders ONLY this view - its own
 * simulation stays off, which removes the double-simulation jitter.
 */

export interface NetEntity {
  id: string;
  x: number;
  y: number;
  [key: string]: unknown;
}

export interface NetSnapshot {
  tick: number;
  recvAt: number;
  p1: Record<string, any> | null;
  p2: Record<string, any> | null;
  players?: NetEntity[];
  enemies: NetEntity[];
  spawning: NetEntity[];
  bullets: NetEntity[];
  powerUps: NetEntity[];
  smokes?: NetEntity[];
  grenades?: NetEntity[];
  shields?: NetEntity[];
  tacPickups?: NetEntity[];
  scoreData?: unknown;
  baseState?: unknown;
  baseStateB?: unknown;
  bases?: unknown[];
  vsDefenderSlot?: 1 | 2;
  gameState?: unknown;
  gv?: number;
  grid?: number[];
  ackSeqs?: Record<number, number>;
}

export const RENDER_DELAY_MS = 80;

/**
 * Calculates adaptive render delay for jitter buffering based on real RTT.
 * Clamped between 65ms (fast network) and 130ms (high latency / mobile connection)
 * to ensure mobile jitter never causes the buffer to run dry and stutter.
 */
export function getAdaptiveDelay(ping: number, jitter: number = 12): number {
  const oneWay = Math.max(15, ping * 0.5);
  // Ensure buffer covers 2.2 snapshot intervals (70ms) + one-way latency + jitter
  const calculated = oneWay + jitter + 45;
  return Math.min(130, Math.max(65, Math.round(calculated)));
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function blendTank(older: Record<string, any> | null, newer: Record<string, any> | null, t: number): Record<string, any> | null {
  if (!newer) return null;
  if (!older) return { ...newer };
  return { ...newer, x: lerp(older.x, newer.x, t), y: lerp(older.y, newer.y, t) };
}

function blendEntity(
  older: NetEntity | undefined,
  newer: NetEntity,
  t: number
): NetEntity {
  if (!older) return { ...newer }; // Brand-new entity: appear at authoritative position
  return { ...newer, x: lerp(older.x, newer.x, t), y: lerp(older.y, newer.y, t) };
}

function blendGrenade(
  older: NetEntity | undefined,
  newer: NetEntity,
  t: number
): NetEntity {
  if (!older) return { ...newer };
  return {
    ...newer,
    x: lerp(older.x, newer.x, t),
    y: lerp(older.y, newer.y, t),
    z: lerp((older.z as number) ?? 0, (newer.z as number) ?? 0, t),
  };
}

export class SnapshotBuffer {
  private snaps: NetSnapshot[] = [];
  private readonly limit = 30;

  public push(s: NetSnapshot): void {
    s.recvAt = performance.now();
    this.snaps.push(s);
    if (this.snaps.length > this.limit) this.snaps.shift();
  }

  public clear(): void {
    this.snaps = [];
  }

  public get count(): number {
    return this.snaps.length;
  }

  /**
   * Interpolated view for (now - delayMs). Falls back to the newest snapshot
   * when the stream stalls (host pause / hiccup) so the field never rewinds.
   */
  public sample(delayMs: number = RENDER_DELAY_MS): NetSnapshot | null {
    if (this.snaps.length === 0) return null;
    const now = performance.now();
    const newest = this.snaps[this.snaps.length - 1];
    if (now - newest.recvAt > 600) return newest;

    const renderTime = now - delayMs;
    if (renderTime >= newest.recvAt) return newest; // caught up: hold newest
    if (renderTime <= this.snaps[0].recvAt) return this.snaps[0];
    for (let i = this.snaps.length - 1; i > 0; i--) {
      const older = this.snaps[i - 1];
      const newer = this.snaps[i];
      if (older.recvAt <= renderTime && renderTime <= newer.recvAt) {
        const span = newer.recvAt - older.recvAt || 1;
        const t = Math.min(1, Math.max(0, (renderTime - older.recvAt) / span));
        return this.blendPair(older, newer, t);
      }
    }
    return newest;
  }

  private blendPair(older: NetSnapshot, newer: NetSnapshot, t: number): NetSnapshot {
    const olderEnemies = new Map(older.enemies.map((e) => [e.id, e]));
    const olderBullets = new Map(older.bullets.map((b) => [b.id, b]));
    const olderPlayers = older.players ? new Map(older.players.map((p) => [p.id, p])) : null;
    const olderGrenades = older.grenades ? new Map(older.grenades.map((g) => [g.id, g])) : null;

    return {
      ...newer,
      p1: blendTank(older.p1, newer.p1, t),
      p2: blendTank(older.p2, newer.p2, t),
      players: newer.players
        ? newer.players.map((p) => blendEntity(olderPlayers?.get(p.id), p, t))
        : undefined,
      enemies: newer.enemies.map((e) => blendEntity(olderEnemies.get(e.id), e, t)),
      bullets: newer.bullets.map((b) => blendEntity(olderBullets.get(b.id), b, t)),
      powerUps: newer.powerUps,
      spawning: newer.spawning,
      smokes: newer.smokes,
      grenades: newer.grenades
        ? newer.grenades.map((g) => blendGrenade(olderGrenades?.get(g.id), g, t))
        : undefined,
      shields: newer.shields,
      tacPickups: newer.tacPickups,
    };
  }
}
