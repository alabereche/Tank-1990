/**
 * Battle City 1990 - Pure Procedural Pixel-Art Canvas Renderer
 * Renders all NES authentic tanks, tiles, base eagle, explosions,
 * shields, bullets, and power-up pickups with zero external image assets.
 */

import { BaseState, Direction, EnemyType, PowerUpType, Tank } from '../types';
import { BLOCK_SIZE } from './maps';

export class SpriteRenderer {
  /**
   * Renders a 16x16 Brick sub-tile with 4-quadrant damage mask
   * mask: 4-bit integer (1: TL, 2: TR, 4: BL, 8: BR)
   */
  public static renderBrick(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    mask: number = 15
  ) {
    if (mask === 0) return;

    // Draw intact quadrants (8x8 each)
    // Quadrant 0: Top-Left (mask & 1)
    // Quadrant 1: Top-Right (mask & 2)
    // Quadrant 2: Bottom-Left (mask & 4)
    // Quadrant 3: Bottom-Right (mask & 8)
    const renderQuadrant = (qx: number, qy: number) => {
      // 8x8 brick texture
      ctx.fillStyle = '#b84418'; // Main terracotta brick
      ctx.fillRect(qx, qy, 8, 8);

      ctx.fillStyle = '#682008'; // Dark brick shadow
      ctx.fillRect(qx + 1, qy + 1, 6, 2);
      ctx.fillRect(qx + 1, qy + 5, 6, 2);

      ctx.fillStyle = '#e07040'; // Brick highlight
      ctx.fillRect(qx, qy, 7, 1);
      ctx.fillRect(qx, qy + 4, 7, 1);

      // Mortar lines (dark gray/black)
      ctx.fillStyle = '#000000';
      ctx.fillRect(qx, qy + 3, 8, 1);
      ctx.fillRect(qx, qy + 7, 8, 1);
      ctx.fillRect(qx + 3, qy, 1, 3);
      ctx.fillRect(qx + 7, qy + 4, 1, 3);
    };

    if (mask & 1) renderQuadrant(x, y);
    if (mask & 2) renderQuadrant(x + 8, y);
    if (mask & 4) renderQuadrant(x, y + 8);
    if (mask & 8) renderQuadrant(x + 8, y + 8);
  }

  /**
   * Renders a 16x16 Steel sub-tile with metallic bevels and rivets
   */
  public static renderSteel(ctx: CanvasRenderingContext2D, x: number, y: number) {
    // Metal base
    ctx.fillStyle = '#b4b4b4';
    ctx.fillRect(x, y, 16, 16);

    // Bevel highlights (top and left)
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(x, y, 16, 2);
    ctx.fillRect(x, y, 2, 16);

    // Bevel shadows (bottom and right)
    ctx.fillStyle = '#505050';
    ctx.fillRect(x, y + 14, 16, 2);
    ctx.fillRect(x + 14, y, 2, 16);

    // Center divider
    ctx.fillStyle = '#808080';
    ctx.fillRect(x + 7, y + 2, 2, 12);
    ctx.fillRect(x + 2, y + 7, 12, 2);

    // Rivets in 4 quadrants
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(x + 4, y + 4, 1, 1);
    ctx.fillRect(x + 11, y + 4, 1, 1);
    ctx.fillRect(x + 4, y + 11, 1, 1);
    ctx.fillRect(x + 11, y + 11, 1, 1);

    ctx.fillStyle = '#000000';
    ctx.fillRect(x + 5, y + 5, 1, 1);
    ctx.fillRect(x + 12, y + 5, 1, 1);
    ctx.fillRect(x + 5, y + 12, 1, 1);
    ctx.fillRect(x + 12, y + 12, 1, 1);
  }

  /**
   * Renders a 16x16 Animated Water sub-tile
   */
  public static renderWater(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    animFrame: number
  ) {
    // Deep blue background
    ctx.fillStyle = '#2038ec';
    ctx.fillRect(x, y, 16, 16);

    // Cyan animated waves
    ctx.fillStyle = '#64b0ff';
    const shift = (animFrame % 2) * 4;

    for (let row = 0; row < 4; row++) {
      const wy = y + row * 4 + 1;
      const wx = x + ((row % 2 === 0 ? shift : 4 - shift) % 8);
      ctx.fillRect(wx, wy, 4, 1);
      ctx.fillRect(wx + 8, wy, 4, 1);
      if (wx - 8 >= x) ctx.fillRect(wx - 8, wy, 4, 1);
    }

    // White foam speckles
    ctx.fillStyle = '#ffffff';
    if (animFrame % 2 === 0) {
      ctx.fillRect(x + 3, y + 2, 1, 1);
      ctx.fillRect(x + 11, y + 10, 1, 1);
    } else {
      ctx.fillRect(x + 7, y + 6, 1, 1);
      ctx.fillRect(x + 13, y + 14, 1, 1);
    }
  }

  /**
   * Renders a 16x16 Ice sub-tile
   */
  public static renderIce(ctx: CanvasRenderingContext2D, x: number, y: number) {
    // Base pale cyan/white
    ctx.fillStyle = '#d0e0ec';
    ctx.fillRect(x, y, 16, 16);

    // Gloss highlights
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(x + 1, y + 1, 14, 1);
    ctx.fillRect(x + 1, y + 1, 1, 14);

    // Cross glint pattern
    ctx.fillStyle = '#b0c4de';
    ctx.fillRect(x + 4, y + 4, 8, 1);
    ctx.fillRect(x + 4, y + 8, 8, 1);
    ctx.fillRect(x + 4, y + 12, 8, 1);
  }

  /**
   * Renders a 16x16 Trees / Foliage sub-tile (drawn in top layer over tanks)
   */
  public static renderTrees(ctx: CanvasRenderingContext2D, x: number, y: number) {
    // Dark forest green base
    ctx.fillStyle = '#007800';
    ctx.fillRect(x, y, 16, 16);

    // Bright green leaves
    ctx.fillStyle = '#58d858';
    ctx.fillRect(x + 2, y + 1, 4, 3);
    ctx.fillRect(x + 10, y + 2, 4, 3);
    ctx.fillRect(x + 5, y + 8, 5, 4);
    ctx.fillRect(x + 1, y + 11, 4, 3);
    ctx.fillRect(x + 11, y + 10, 4, 4);

    // Lime highlights
    ctx.fillStyle = '#b8f818';
    ctx.fillRect(x + 3, y + 2, 2, 1);
    ctx.fillRect(x + 11, y + 3, 2, 1);
    ctx.fillRect(x + 6, y + 9, 2, 1);
    ctx.fillRect(x + 2, y + 12, 2, 1);
    ctx.fillRect(x + 12, y + 11, 2, 1);

    // Shadow notches
    ctx.fillStyle = '#004000';
    ctx.fillRect(x, y + 7, 2, 2);
    ctx.fillRect(x + 14, y + 6, 2, 2);
    ctx.fillRect(x + 8, y + 14, 2, 2);
  }

  /**
   * Renders the 32x32 Phoenix / Eagle Base Emblem
   */
  public static renderBase(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    state: BaseState
  ) {
    if (state === BaseState.DESTROYED) {
      // Burnt, destroyed eagle / flag
      ctx.fillStyle = '#000000';
      ctx.fillRect(x, y, 32, 32);

      // Crumpled gray debris
      ctx.fillStyle = '#505050';
      ctx.fillRect(x + 4, y + 16, 24, 14);

      // Burnt flag pole & white surrender banner
      ctx.fillStyle = '#808080';
      ctx.fillRect(x + 14, y + 4, 4, 20);

      ctx.fillStyle = '#ffffff';
      ctx.fillRect(x + 18, y + 6, 10, 6);
      ctx.fillRect(x + 18, y + 12, 6, 4);

      // Red fire embers
      ctx.fillStyle = '#e04000';
      ctx.fillRect(x + 6, y + 24, 4, 3);
      ctx.fillRect(x + 22, y + 22, 4, 3);
      ctx.fillRect(x + 14, y + 26, 4, 3);
      return;
    }

    // ALIVE: Majestic Golden Eagle Phoenix Emblem
    // Black background
    ctx.fillStyle = '#000000';
    ctx.fillRect(x, y, 32, 32);

    // Golden wings
    ctx.fillStyle = '#f8b800'; // Rich NES Gold
    // Left Wing
    ctx.fillRect(x + 4, y + 8, 8, 4);
    ctx.fillRect(x + 2, y + 12, 10, 8);
    ctx.fillRect(x + 4, y + 20, 8, 6);

    // Right Wing
    ctx.fillRect(x + 20, y + 8, 8, 4);
    ctx.fillRect(x + 20, y + 12, 10, 8);
    ctx.fillRect(x + 20, y + 20, 8, 6);

    // Center body & head
    ctx.fillRect(x + 12, y + 6, 8, 20);

    // Head crest
    ctx.fillRect(x + 14, y + 2, 4, 4);

    // Beak
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(x + 15, y + 4, 2, 2);

    // Highlight feathers
    ctx.fillStyle = '#ffe078';
    ctx.fillRect(x + 4, y + 10, 4, 2);
    ctx.fillRect(x + 24, y + 10, 4, 2);
    ctx.fillRect(x + 14, y + 10, 4, 6);

    // Center emblem star
    ctx.fillStyle = '#d82800'; // Red center crest
    ctx.fillRect(x + 14, y + 14, 4, 4);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(x + 15, y + 15, 2, 2);

    // Talons & pedestal
    ctx.fillStyle = '#f8b800';
    ctx.fillRect(x + 8, y + 26, 16, 4);
  }

  /**
   * Renders a 32x32 Tank sprite with directional rotation and tread animation
   */
  public static renderTank(
    ctx: CanvasRenderingContext2D,
    tank: Tank,
    tick: number
  ) {
    if (!tank || !tank.direction) return;
    const { x, y, direction, isPlayer, type, distanceTraveled, isFlashingBonus, hp } = tank;

    // Determine colors
    let bodyColor = '#d8a038'; // Player yellow/amber
    let darkColor = '#805800';
    let highlightColor = '#f8e878';
    let treadColor = '#404040';

    if (isPlayer) {
      if (tank.playerIndex === 2) {
        // Player 2 - Authentic NES Battle City Green Tank
        if (tank.tier === 0) {
          bodyColor = '#00a800'; // Forest Green
          darkColor = '#004c00';
          highlightColor = '#80f880';
        } else if (tank.tier === 1) {
          bodyColor = '#24c424'; // Bright Green
          darkColor = '#086808';
          highlightColor = '#a0ffa0';
        } else if (tank.tier === 2) {
          bodyColor = '#00b8b8'; // Teal Green
          darkColor = '#005858';
          highlightColor = '#80ffff';
        } else {
          bodyColor = '#50e020'; // Neon Heavy Green
          darkColor = '#1c6400';
          highlightColor = '#c0ff90';
        }
      } else {
        // Player 1 - Classic Gold / Amber Tank
        if (tank.tier === 0) {
          bodyColor = '#f8b800'; // Yellow
          darkColor = '#885800';
          highlightColor = '#fff090';
        } else if (tank.tier === 1) {
          bodyColor = '#e89800'; // Amber level 1
          darkColor = '#804800';
          highlightColor = '#ffe080';
        } else if (tank.tier === 2) {
          bodyColor = '#0088e8'; // Blue level 2
          darkColor = '#003888';
          highlightColor = '#88d8ff';
        } else {
          bodyColor = '#e85800'; // Gold/Orange heavy tier 3
          darkColor = '#802800';
          highlightColor = '#ffd088';
        }
      }
    } else {
      // Enemy tank palette
      const enemyType = type as EnemyType;
      if (enemyType === 'BASIC') {
        bodyColor = '#a4a4a4'; // Silver
        darkColor = '#505050';
        highlightColor = '#ffffff';
      } else if (enemyType === 'FAST') {
        bodyColor = '#58b8d8'; // Light Cyan Scout
        darkColor = '#105878';
        highlightColor = '#d8f8ff';
      } else if (enemyType === 'POWER') {
        bodyColor = '#f8d838'; // Yellow Power Tank
        darkColor = '#887800';
        highlightColor = '#fffff0';
      } else if (enemyType === 'ARMOR') {
        // Armor tank changes color as HP drops: 4 hits (Green -> Yellow -> Orange -> Red)
        if (hp >= 4) {
          bodyColor = '#00a800'; // Heavy Green
          darkColor = '#004800';
          highlightColor = '#70f870';
        } else if (hp === 3) {
          bodyColor = '#e8c020'; // Yellow
          darkColor = '#705800';
          highlightColor = '#fff080';
        } else if (hp === 2) {
          bodyColor = '#e87010'; // Orange
          darkColor = '#703000';
          highlightColor = '#ffa060';
        } else {
          bodyColor = '#e82020'; // Critical Red
          darkColor = '#700000';
          highlightColor = '#ff8080';
        }
      }

      // Flashing bonus tank effect (drops power-up)
      if (isFlashingBonus && Math.floor(tick / 6) % 2 === 0) {
        bodyColor = '#ff3030';
        darkColor = '#800000';
        highlightColor = '#ffffff';
      }
    }

    ctx.save();
    // Center rotation at (x + 16, y + 16)
    ctx.translate(x + 16, y + 16);

    let angle = 0;
    if (direction === 'RIGHT') angle = Math.PI / 2;
    else if (direction === 'DOWN') angle = Math.PI;
    else if (direction === 'LEFT') angle = -Math.PI / 2;
    ctx.rotate(angle);

    // Tread animation phase: flips every 4px traveled or tick if moving
    const treadFrame = Math.floor(distanceTraveled / 4) % 2 === 0;

    // --- LEFT TREAD (-14 to -8) ---
    ctx.fillStyle = treadColor;
    ctx.fillRect(-14, -14, 6, 28);
    // Tread teeth
    ctx.fillStyle = highlightColor;
    for (let i = -14; i <= 10; i += 6) {
      const ty = treadFrame ? i : i + 3;
      if (ty >= -14 && ty <= 10) {
        ctx.fillRect(-14, ty, 6, 2);
      }
    }

    // --- RIGHT TREAD (8 to 14) ---
    ctx.fillStyle = treadColor;
    ctx.fillRect(8, -14, 6, 28);
    // Tread teeth
    ctx.fillStyle = highlightColor;
    for (let i = -14; i <= 10; i += 6) {
      const ty = treadFrame ? i : i + 3;
      if (ty >= -14 && ty <= 10) {
        ctx.fillRect(8, ty, 6, 2);
      }
    }

    // --- MAIN HULL / CHASSIS (-8 to 8) ---
    ctx.fillStyle = darkColor;
    ctx.fillRect(-8, -12, 16, 24);

    ctx.fillStyle = bodyColor;
    ctx.fillRect(-7, -11, 14, 22);

    // Chassis highlights & bevel
    ctx.fillStyle = highlightColor;
    ctx.fillRect(-7, -11, 14, 2);
    ctx.fillRect(-7, -11, 2, 22);

    // --- TURRET & BARREL ---
    // Central turret dome
    ctx.fillStyle = darkColor;
    ctx.fillRect(-5, -5, 10, 10);

    ctx.fillStyle = bodyColor;
    ctx.fillRect(-4, -4, 8, 8);

    ctx.fillStyle = highlightColor;
    ctx.fillRect(-3, -3, 3, 3);

    // Gun Barrel extending upward (-Y in local rotated coordinates)
    ctx.fillStyle = darkColor;
    ctx.fillRect(-2, -16, 4, 12);

    ctx.fillStyle = highlightColor;
    ctx.fillRect(-1, -16, 2, 12);

    // Muzzle tip
    ctx.fillStyle = darkColor;
    ctx.fillRect(-3, -16, 6, 2);

    ctx.restore();

    // --- INVULNERABILITY SHIELD RING ---
    if (tank.shieldTimer > 0) {
      SpriteRenderer.renderShield(ctx, x + 16, y + 16, tick);
    }
  }

  /**
   * Invulnerability Forcefield Shield
   */
  public static renderShield(
    ctx: CanvasRenderingContext2D,
    cx: number,
    cy: number,
    tick: number
  ) {
    const colors = ['#ffffff', '#00f8f8', '#0078f8', '#e8f800'];
    const color = colors[Math.floor(tick / 3) % colors.length];

    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(cx, cy, 18, 0, Math.PI * 2);
    ctx.stroke();

    // 4 spinning energy nodes around ring
    const rot = (tick * 0.15) % (Math.PI * 2);
    for (let i = 0; i < 4; i++) {
      const a = rot + (i * Math.PI) / 2;
      const px = cx + Math.cos(a) * 18;
      const py = cy + Math.sin(a) * 18;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(px - 2, py - 2, 4, 4);
    }
    ctx.restore();
  }

  /**
   * Spawning Star Animation (Iconic NES Battle City spawn star)
   */
  public static renderSpawnAnimation(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    progress: number // 0 to 1
  ) {
    const cx = x + 16;
    const cy = y + 16;
    const size = 12 * Math.sin(progress * Math.PI);
    const colors = ['#ffffff', '#f8d838', '#00f8f8', '#e82020'];
    const color = colors[Math.floor(progress * 16) % colors.length];

    ctx.save();
    ctx.fillStyle = color;
    // 4-pointed star
    ctx.fillRect(cx - size, cy - 2, size * 2, 4);
    ctx.fillRect(cx - 2, cy - size, 4, size * 2);
    ctx.restore();
  }

  /**
   * Renders a Bullet
   */
  public static renderBullet(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    direction: Direction
  ) {
    if (!direction) return;
    ctx.save();
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(x - 2, y - 2, 4, 4);

    ctx.fillStyle = '#f85800'; // Orange tracer
    if (direction === 'UP') ctx.fillRect(x - 1, y, 2, 4);
    else if (direction === 'DOWN') ctx.fillRect(x - 1, y - 4, 2, 4);
    else if (direction === 'LEFT') ctx.fillRect(x, y - 1, 4, 2);
    else if (direction === 'RIGHT') ctx.fillRect(x - 4, y - 1, 4, 2);

    ctx.restore();
  }

  /**
   * Renders an Explosion
   */
  public static renderExplosion(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    frame: number,
    maxFrames: number,
    isBig: boolean
  ) {
    const progress = frame / maxFrames;
    const radius = (isBig ? 24 : 12) * (1 - Math.pow(progress - 0.5, 2) * 2);
    if (radius <= 0) return;

    ctx.save();
    // Outer flame (orange)
    ctx.fillStyle = '#f83800';
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();

    // Inner bright core (yellow)
    ctx.fillStyle = '#f8b800';
    ctx.beginPath();
    ctx.arc(x, y, radius * 0.65, 0, Math.PI * 2);
    ctx.fill();

    // Hot center (white)
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(x, y, radius * 0.35, 0, Math.PI * 2);
    ctx.fill();

    // Black smoke puffs on big explosions
    if (isBig && progress > 0.4) {
      ctx.fillStyle = '#303030';
      const puffRad = 8 * (progress - 0.4);
      ctx.beginPath();
      ctx.arc(x - 10, y - 8, puffRad, 0, Math.PI * 2);
      ctx.arc(x + 10, y - 6, puffRad, 0, Math.PI * 2);
      ctx.arc(x, y + 10, puffRad, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  /**
   * Renders Power-Up Pickups
   */
  public static renderPowerUp(
    ctx: CanvasRenderingContext2D,
    type: PowerUpType,
    x: number,
    y: number,
    tick: number
  ) {
    // Flashing border (alternates every 8 frames)
    const isFlashing = Math.floor(tick / 8) % 2 === 0;

    ctx.save();
    // 30x30 background container
    ctx.fillStyle = isFlashing ? '#ffffff' : '#000000';
    ctx.fillRect(x, y, 30, 30);

    ctx.fillStyle = isFlashing ? '#000000' : '#ffffff';
    ctx.fillRect(x + 2, y + 2, 26, 26);

    // Inner icon depending on type
    const cx = x + 15;
    const cy = y + 15;

    if (type === 'STAR') {
      // Golden Star
      ctx.fillStyle = '#f8b800';
      ctx.fillRect(cx - 2, cy - 8, 4, 16);
      ctx.fillRect(cx - 8, cy - 2, 16, 4);
      ctx.fillRect(cx - 5, cy - 5, 10, 10);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(cx - 2, cy - 2, 4, 4);
    } else if (type === 'BOMB') {
      // Grenade / Bomb
      ctx.fillStyle = '#00a800'; // Green grenade body
      ctx.fillRect(cx - 6, cy - 4, 12, 12);
      ctx.fillStyle = '#004800';
      ctx.fillRect(cx - 4, cy, 8, 2);
      ctx.fillRect(cx - 1, cy - 4, 2, 8);
      // Fuse
      ctx.fillStyle = '#f83800';
      ctx.fillRect(cx - 2, cy - 8, 4, 4);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(cx, cy - 9, 2, 2);
    } else if (type === 'TIMER') {
      // Stopwatch
      ctx.fillStyle = '#0088e8'; // Blue rim
      ctx.beginPath();
      ctx.arc(cx, cy + 1, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(cx, cy + 1, 6, 0, Math.PI * 2);
      ctx.fill();
      // Hands
      ctx.fillStyle = '#000000';
      ctx.fillRect(cx - 1, cy - 3, 2, 4);
      ctx.fillRect(cx, cy, 3, 2);
      // Top button
      ctx.fillStyle = '#f83800';
      ctx.fillRect(cx - 3, cy - 8, 6, 2);
    } else if (type === 'SHOVEL') {
      // Shovel
      ctx.fillStyle = '#a05000'; // Wood handle
      ctx.fillRect(cx - 1, cy - 6, 2, 12);
      ctx.fillStyle = '#ffffff'; // Top grip
      ctx.fillRect(cx - 3, cy - 8, 6, 3);
      // Metal spade
      ctx.fillStyle = '#808080';
      ctx.fillRect(cx - 5, cy + 3, 10, 6);
      ctx.fillStyle = '#b0b0b0';
      ctx.fillRect(cx - 3, cy + 6, 6, 3);
    } else if (type === 'HELMET') {
      // Helmet (shield)
      ctx.fillStyle = '#f83800'; // Red helmet
      ctx.beginPath();
      ctx.arc(cx, cy + 1, 8, Math.PI, 0);
      ctx.fill();
      ctx.fillRect(cx - 8, cy + 1, 16, 4);
      // White shield cross
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(cx - 1, cy - 4, 2, 6);
      ctx.fillRect(cx - 4, cy - 2, 8, 2);
    } else if (type === 'LIFE') {
      // 1UP Tank Icon
      ctx.fillStyle = '#f8b800';
      ctx.fillRect(cx - 6, cy - 4, 12, 10);
      ctx.fillRect(cx - 2, cy - 8, 4, 5);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(cx - 1, cy - 1, 2, 3);
    }

    ctx.restore();
  }

  /**
   * Renders Score popups (100, 200, 300, 400, 500)
   */
  public static renderScorePopup(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    points: number
  ) {
    ctx.save();
    ctx.font = '10px "Press Start 2P", monospace, system-ui';
    ctx.fillStyle = '#ffffff';
    ctx.fillText(`${points}`, x - 10, y + 4);
    ctx.restore();
  }
}
