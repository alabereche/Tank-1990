/**
 * Battle City 1990 - Pure Procedural Pixel-Art Canvas Renderer
 * Renders all NES authentic tanks, tiles, base eagle, explosions,
 * shields, bullets, and power-up pickups with zero external image assets.
 */

import {
  BaseState,
  Direction,
  EnemyType,
  PowerUpType,
  Tank,
  TacticalItemType,
  ActiveSmokeScreen,
  ActiveBouncingGrenade,
  ActiveDeployableShield,
} from '../types';
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
   * Renders a 16x16 Mud sub-tile (swampy muddy terrain with authentic NES palette)
   */
  public static renderMud(ctx: CanvasRenderingContext2D, x: number, y: number) {
    // 1. Deep damp soil base
    ctx.fillStyle = '#382010';
    ctx.fillRect(x, y, 16, 16);

    // 2. Dark soggy peat trenches & clods
    ctx.fillStyle = '#1e1006';
    ctx.fillRect(x + 1, y + 2, 5, 2);
    ctx.fillRect(x + 9, y + 1, 6, 2);
    ctx.fillRect(x + 4, y + 6, 8, 3);
    ctx.fillRect(x + 1, y + 11, 6, 3);
    ctx.fillRect(x + 10, y + 10, 5, 4);

    // 3. Medium earth clods
    ctx.fillStyle = '#553018';
    ctx.fillRect(x + 2, y + 1, 3, 1);
    ctx.fillRect(x + 11, y + 3, 3, 2);
    ctx.fillRect(x + 6, y + 5, 4, 1);
    ctx.fillRect(x + 3, y + 10, 4, 1);
    ctx.fillRect(x + 8, y + 13, 3, 2);

    // 4. Lighter clay & dirt highlights
    ctx.fillStyle = '#764522';
    ctx.fillRect(x + 3, y + 2, 2, 1);
    ctx.fillRect(x + 12, y + 1, 2, 1);
    ctx.fillRect(x + 7, y + 7, 2, 1);
    ctx.fillRect(x + 2, y + 12, 2, 1);
    ctx.fillRect(x + 11, y + 11, 2, 1);

    // 5. Wet mud glints (specular pixel specks)
    ctx.fillStyle = '#a66a36';
    ctx.fillRect(x + 4, y + 2, 1, 1);
    ctx.fillRect(x + 13, y + 2, 1, 1);
    ctx.fillRect(x + 8, y + 7, 1, 1);
    ctx.fillRect(x + 12, y + 12, 1, 1);
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
    state: BaseState,
    palette: 'gold' | 'crimson' = 'gold'
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

    // ALIVE: Majestic Eagle Phoenix Emblem
    // Black background
    ctx.fillStyle = '#000000';
    ctx.fillRect(x, y, 32, 32);

    const primaryColor = palette === 'crimson' ? '#d82800' : '#f8b800';
    const highlightColor = palette === 'crimson' ? '#f87858' : '#ffe078';
    const crestColor = palette === 'crimson' ? '#f8b800' : '#d82800';

    // Wings
    ctx.fillStyle = primaryColor;
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
    ctx.fillStyle = highlightColor;
    ctx.fillRect(x + 4, y + 10, 4, 2);
    ctx.fillRect(x + 24, y + 10, 4, 2);
    ctx.fillRect(x + 14, y + 10, 4, 6);

    // Center emblem star
    ctx.fillStyle = crestColor;
    ctx.fillRect(x + 14, y + 14, 4, 4);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(x + 15, y + 15, 2, 2);

    // Talons & pedestal
    ctx.fillStyle = primaryColor;
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
      const pIdx = tank.playerIndex || 1;
      if (pIdx === 2) {
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
      } else if (pIdx === 3) {
        // Player 3 - Cyan / Ice Blue (Team A or FFA)
        bodyColor = '#0088e8';
        darkColor = '#003888';
        highlightColor = '#88d8ff';
      } else if (pIdx === 4) {
        // Player 4 - Crimson Red (Team B or FFA)
        bodyColor = '#d82828';
        darkColor = '#780808';
        highlightColor = '#ff8888';
      } else if (pIdx === 5) {
        // Player 5 - Royal Violet (FFA)
        bodyColor = '#a838d8';
        darkColor = '#581088';
        highlightColor = '#e898ff';
      } else if (pIdx === 6) {
        // Player 6 - Hot Amber Orange (FFA)
        bodyColor = '#e86800';
        darkColor = '#803000';
        highlightColor = '#ffb860';
      } else if (pIdx === 7) {
        // Player 7 - Metallic Silver (FFA)
        bodyColor = '#c0c0c0';
        darkColor = '#606060';
        highlightColor = '#ffffff';
      } else if (pIdx === 8) {
        // Player 8 - Neon Lime (FFA)
        bodyColor = '#78d800';
        darkColor = '#387800';
        highlightColor = '#b8ff60';
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

    // --- TEAM INDICATOR (2v2 Team Battles) ---
    if (isPlayer && (tank.team === 'A' || tank.team === 'B')) {
      const isTeamA = tank.team === 'A';
      ctx.fillStyle = isTeamA ? '#00b0f0' : '#e02020'; // Blue for Team A, Red for Team B
      ctx.fillRect(x + 13, y + 13, 6, 6);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(x + 14, y + 14, 4, 4);
      ctx.fillStyle = isTeamA ? '#00b0f0' : '#e02020';
      ctx.fillRect(x + 15, y + 15, 2, 2);
    }

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
   * Features:
   * - Multi-lobed stylized arcade fireball (#ffffff core, #f8b800 gold, #f85800 flame, #b81800 border)
   * - Expanding glowing shockwave ring
   * - Radiating shrapnel spark embers
   * - Billowing ash and smoke puffs
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
    if (progress >= 1 || progress < 0) return;

    ctx.save();

    if (isBig) {
      // --- BIG EXPLOSION (Tank Destroyed / Base / Grenade) ---
      const maxRadius = 28;
      // Fireball expansion and contraction envelope
      const expansion = progress < 0.35 
        ? Math.sin((progress / 0.35) * (Math.PI / 2)) 
        : Math.cos(((progress - 0.35) / 0.65) * (Math.PI / 2));
      const r = Math.max(1, maxRadius * expansion);

      // 1. Expanding Glowing Shockwave Ring (first 65% of frames)
      if (progress < 0.65) {
        const ringProgress = progress / 0.65;
        const ringRadius = 6 + ringProgress * 32;
        const ringAlpha = Math.max(0, 1 - ringProgress);
        ctx.strokeStyle = `rgba(255, 200, 80, ${ringAlpha * 0.75})`;
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(x, y, ringRadius, 0, Math.PI * 2);
        ctx.stroke();
      }

      // 2. Multi-Lobed Jagged Fireball (Retro Arcade Style)
      // Layer A: Deep Flame Red / Crimson Outline (#b81800)
      ctx.fillStyle = '#b81800';
      ctx.beginPath();
      for (let i = 0; i < 8; i++) {
        const angle = (i * Math.PI) / 4;
        const dist = r * (0.85 + (i % 2 === 0 ? 0.25 : -0.1));
        const px = x + Math.cos(angle) * dist;
        const py = y + Math.sin(angle) * dist;
        ctx.arc(px, py, r * 0.55, 0, Math.PI * 2);
      }
      ctx.fill();

      // Layer B: Blazing Fiery Orange (#f85800)
      ctx.fillStyle = '#f85800';
      ctx.beginPath();
      for (let i = 0; i < 8; i++) {
        const angle = (i * Math.PI) / 4 + Math.PI / 8;
        const dist = r * (0.65 + (i % 2 === 0 ? 0.2 : -0.08));
        const px = x + Math.cos(angle) * dist;
        const py = y + Math.sin(angle) * dist;
        ctx.arc(px, py, r * 0.42, 0, Math.PI * 2);
      }
      ctx.fill();

      // Layer C: Golden Solar Yellow (#f8b800)
      ctx.fillStyle = '#f8b800';
      ctx.beginPath();
      ctx.arc(x, y, r * 0.60, 0, Math.PI * 2);
      for (let i = 0; i < 6; i++) {
        const angle = (i * Math.PI) / 3;
        const px = x + Math.cos(angle) * (r * 0.4);
        const py = y + Math.sin(angle) * (r * 0.4);
        ctx.arc(px, py, r * 0.35, 0, Math.PI * 2);
      }
      ctx.fill();

      // Layer D: Blinding White-Hot Incandescent Core (#ffffff) (first 40% of frames)
      if (progress < 0.40) {
        const coreAlpha = 1 - progress / 0.40;
        ctx.fillStyle = `rgba(255, 255, 255, ${coreAlpha})`;
        ctx.beginPath();
        ctx.arc(x, y, r * 0.38, 0, Math.PI * 2);
        ctx.fill();
        // 4-point cross flare
        const flareSize = r * 0.55;
        ctx.fillRect(x - flareSize, y - 1, flareSize * 2, 3);
        ctx.fillRect(x - 1, y - flareSize, 3, flareSize * 2);
      }

      // 3. Flying Spark Embers / Shrapnel (radiating outward)
      const sparkCount = 8;
      for (let i = 0; i < sparkCount; i++) {
        const angle = (i * Math.PI * 2) / sparkCount + 0.2;
        const dist = 6 + progress * 36;
        const sx = x + Math.cos(angle) * dist;
        const sy = y + Math.sin(angle) * dist;
        const sparkAlpha = Math.max(0, 1 - progress * 1.1);
        ctx.fillStyle = i % 2 === 0 ? `rgba(255, 240, 120, ${sparkAlpha})` : `rgba(255, 120, 30, ${sparkAlpha})`;
        ctx.fillRect(sx - 1.5, sy - 1.5, 3, 3);
      }

      // 4. Billowing Ash & Smoke Puffs (cooling smoke in second half)
      if (progress > 0.35) {
        const smokeProgress = (progress - 0.35) / 0.65;
        const smokeAlpha = (1 - smokeProgress) * 0.85;
        ctx.fillStyle = `rgba(40, 40, 40, ${smokeAlpha})`;
        const puffOffsets = [
          [-12, -10, 11],
          [12, -8, 12],
          [0, 14, 10],
          [-8, 8, 9],
          [9, 10, 9],
        ];
        for (const [ox, oy, baseRad] of puffOffsets) {
          const puffRad = baseRad * (0.6 + smokeProgress * 0.8);
          const px = x + ox * (1 + smokeProgress * 0.5);
          const py = y + oy * (1 + smokeProgress * 0.5) - smokeProgress * 6;
          ctx.beginPath();
          ctx.arc(px, py, puffRad, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    } else {
      // --- SMALL EXPLOSION (Bullet hitting Wall / Brick / Steel) ---
      const maxRadius = 14;
      const expansion = progress < 0.4 
        ? Math.sin((progress / 0.4) * (Math.PI / 2)) 
        : Math.cos(((progress - 0.4) / 0.6) * (Math.PI / 2));
      const r = Math.max(1, maxRadius * expansion);

      // 1. Initial 4-point impact star flash
      if (progress < 0.35) {
        const flashAlpha = 1 - progress / 0.35;
        ctx.fillStyle = `rgba(255, 255, 255, ${flashAlpha})`;
        ctx.fillRect(x - r * 1.1, y - 1, r * 2.2, 2);
        ctx.fillRect(x - 1, y - r * 1.1, 2, r * 2.2);
      }

      // 2. Fiery blast petals
      ctx.fillStyle = '#f83800';
      ctx.beginPath();
      for (let i = 0; i < 4; i++) {
        const angle = (i * Math.PI) / 2 + Math.PI / 4;
        const px = x + Math.cos(angle) * (r * 0.6);
        const py = y + Math.sin(angle) * (r * 0.6);
        ctx.arc(px, py, r * 0.5, 0, Math.PI * 2);
      }
      ctx.fill();

      // 3. Bright golden center
      ctx.fillStyle = '#f8b800';
      ctx.beginPath();
      ctx.arc(x, y, r * 0.55, 0, Math.PI * 2);
      ctx.fill();

      // 4. White core
      if (progress < 0.5) {
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(x, y, r * 0.3, 0, Math.PI * 2);
        ctx.fill();
      }

      // 5. Impact sparks flying out
      const sparkDist = 4 + progress * 16;
      const sparkAlpha = Math.max(0, 1 - progress);
      ctx.fillStyle = `rgba(255, 220, 80, ${sparkAlpha})`;
      ctx.fillRect(x - sparkDist, y, 2, 2);
      ctx.fillRect(x + sparkDist, y, 2, 2);
      ctx.fillRect(x, y - sparkDist, 2, 2);
      ctx.fillRect(x, y + sparkDist, 2, 2);
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

  /**
   * Renders Tactical Text popups (+SMOKE, +BOMB, +SHIELD)
   */
  public static renderTacticalPopup(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    text: string
  ) {
    ctx.save();
    ctx.font = '8px "Press Start 2P", monospace, system-ui';
    ctx.fillStyle = '#00f8b8';
    ctx.shadowColor = '#000000';
    ctx.shadowBlur = 4;
    ctx.fillText(text, x - 18, y);
    ctx.restore();
  }

  /**
   * Renders a Tactical Item Pickup on the battlefield
   */
  public static renderTacticalPickup(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    type: TacticalItemType,
    flashFrame: number
  ) {
    ctx.save();
    const isFlashing = Math.floor(flashFrame / 8) % 2 === 0;

    // Glowing outer aura
    ctx.fillStyle = isFlashing ? 'rgba(255, 255, 255, 0.4)' : 'rgba(0, 200, 255, 0.2)';
    ctx.fillRect(x - 2, y - 2, 28, 28);

    // Dark badge base
    ctx.fillStyle = '#101010';
    ctx.fillRect(x, y, 24, 24);

    // Beveled border
    ctx.fillStyle = isFlashing ? '#ffffff' : type === 'SMOKE' ? '#70a0ff' : type === 'GRENADE' ? '#ff9020' : '#00e8ff';
    ctx.strokeRect(x + 0.5, y + 0.5, 23, 23);

    const cx = x + 12;
    const cy = y + 12;

    if (type === 'SMOKE') {
      // Smoke Canister
      ctx.fillStyle = '#c0c0c0'; // Silver can
      ctx.fillRect(cx - 4, cy - 5, 8, 12);
      ctx.fillStyle = '#3070b0'; // Blue identification stripe
      ctx.fillRect(cx - 4, cy - 1, 8, 3);
      ctx.fillStyle = '#505050'; // Valve neck
      ctx.fillRect(cx - 2, cy - 8, 4, 3);
      // Small smoke puffs
      ctx.fillStyle = isFlashing ? '#ffffff' : '#a0d0ff';
      ctx.fillRect(cx + 2, cy - 10, 3, 3);
      ctx.fillRect(cx + 5, cy - 12, 2, 2);
    } else if (type === 'GRENADE') {
      // Pineapple Bouncing Grenade
      ctx.fillStyle = '#285818'; // Olive grenade body
      ctx.beginPath();
      ctx.arc(cx, cy + 1, 6, 0, Math.PI * 2);
      ctx.fill();
      // Segmentation grid
      ctx.fillStyle = '#183808';
      ctx.fillRect(cx - 4, cy - 1, 8, 1);
      ctx.fillRect(cx - 1, cy - 4, 1, 8);
      // Fuse neck
      ctx.fillStyle = '#a08020';
      ctx.fillRect(cx - 2, cy - 7, 4, 3);
      // Sparking fuse tip
      ctx.fillStyle = isFlashing ? '#ffff00' : '#ff3000';
      ctx.fillRect(cx + 1, cy - 9, 3, 3);
    } else if (type === 'SHIELD') {
      // Deployable Tactical Shield Crest
      ctx.fillStyle = '#0080d0';
      ctx.beginPath();
      ctx.moveTo(cx, cy + 8);
      ctx.lineTo(cx - 7, cy + 2);
      ctx.lineTo(cx - 7, cy - 6);
      ctx.lineTo(cx + 7, cy - 6);
      ctx.lineTo(cx + 7, cy + 2);
      ctx.closePath();
      ctx.fill();
      // Inner glowing crest
      ctx.fillStyle = isFlashing ? '#ffffff' : '#00e8ff';
      ctx.fillRect(cx - 1, cy - 4, 2, 8);
      ctx.fillRect(cx - 4, cy - 2, 8, 2);
    }

    ctx.restore();
  }

  /**
   * Renders an Active Smoke Screen (Square Billowing NES Pixel Smoke Cloud)
   * Completely square, large footprint (112x112px), uniform density across the area
   * without any center target/tell, fully obscuring any tanks or terrain beneath.
   */
  public static renderSmokeScreen(
    ctx: CanvasRenderingContext2D,
    smoke: ActiveSmokeScreen
  ) {
    ctx.save();
    const globalFade = smoke.duration < 90 ? smoke.duration / 90 : 1;

    const half = smoke.radius; // 56px (total 112x112px square)
    const cx = Math.floor(smoke.x);
    const cy = Math.floor(smoke.y);
    const left = cx - half;
    const top = cy - half;
    const size = half * 2; // 112px

    // 1. Base Dense Charcoal Square Body (Stepped pixel corners for authentic arcade silhouette)
    const cornerStep = 8;
    ctx.globalAlpha = 0.90 * globalFade;
    ctx.fillStyle = '#1c1c1c';

    // Horizontal cross band
    ctx.fillRect(left, top + cornerStep, size, size - cornerStep * 2);
    // Vertical cross band
    ctx.fillRect(left + cornerStep, top, size - cornerStep * 2, size);
    // 4 Corner pixel bevels (4x4)
    ctx.fillRect(left + 4, top + 4, 4, 4);
    ctx.fillRect(left + size - 8, top + 4, 4, 4);
    ctx.fillRect(left + 4, top + size - 8, 4, 4);
    ctx.fillRect(left + size - 8, top + size - 8, 4, 4);

    // 2. Uniform Billowing Pixel Blocks (8x8 pixel blocks)
    // Distributed evenly across the whole square footprint — NO center focal point!
    const animTick = Math.floor(Date.now() / 150);
    const numBlocks = Math.floor(size / 8); // 14 blocks

    for (let r = 0; r < numBlocks; r++) {
      for (let c = 0; c < numBlocks; c++) {
        // Skip outer-most corner cuts to retain stepped pixel silhouette
        if (
          (r === 0 && (c === 0 || c === numBlocks - 1)) ||
          (r === numBlocks - 1 && (c === 0 || c === numBlocks - 1))
        ) {
          continue;
        }

        const bx = left + c * 8;
        const by = top + r * 8;

        // Deterministic pseudo-random variation based on grid pos + time
        const hash = (r * 23 + c * 41 + animTick * 11) % 100;

        let blockColor = '#303030';
        let blockAlpha = 0.65;

        if (hash < 20) {
          blockColor = '#242424';
          blockAlpha = 0.85;
        } else if (hash < 45) {
          blockColor = '#3c3c3c';
          blockAlpha = 0.75;
        } else if (hash < 70) {
          blockColor = '#545454';
          blockAlpha = 0.70;
        } else if (hash < 88) {
          blockColor = '#6c6c6c';
          blockAlpha = 0.65;
        } else {
          blockColor = '#808080';
          blockAlpha = 0.60;
        }

        ctx.globalAlpha = blockAlpha * globalFade;
        ctx.fillStyle = blockColor;
        ctx.fillRect(bx, by, 8, 8);

        // Retro NES checkered dither pattern on alternating blocks
        if ((r + c) % 2 === 0) {
          ctx.fillStyle = '#202020';
          ctx.globalAlpha = 0.35 * globalFade;
          ctx.fillRect(bx, by, 4, 4);
          ctx.fillRect(bx + 4, by + 4, 4, 4);
        }
      }
    }

    // 3. Billowing Square Edge Teeth (Active fluctuating pixel perimeter)
    const edgeTime = Date.now() * 0.0035;
    ctx.fillStyle = '#505050';
    for (let i = 1; i < numBlocks - 1; i++) {
      if (Math.sin(edgeTime + i * 1.4) > 0.25) {
        ctx.globalAlpha = 0.75 * globalFade;
        ctx.fillRect(left + i * 8, top - 3, 8, 3); // Top edge puff
      }
      if (Math.cos(edgeTime + i * 1.6) > 0.25) {
        ctx.globalAlpha = 0.75 * globalFade;
        ctx.fillRect(left + i * 8, top + size, 8, 3); // Bottom edge puff
      }
      if (Math.sin(edgeTime + i * 1.8) > 0.25) {
        ctx.globalAlpha = 0.75 * globalFade;
        ctx.fillRect(left - 3, top + i * 8, 3, 8); // Left edge puff
      }
      if (Math.cos(edgeTime + i * 1.2) > 0.25) {
        ctx.globalAlpha = 0.75 * globalFade;
        ctx.fillRect(left + size, top + i * 8, 3, 8); // Right edge puff
      }
    }

    // 4. Square Drifting Particles (Billowing pixel chunks)
    for (const p of smoke.particles) {
      ctx.globalAlpha = p.alpha * globalFade;
      ctx.fillStyle = p.color;
      ctx.fillRect(
        Math.floor(p.x - p.size / 2),
        Math.floor(p.y - p.size / 2),
        Math.floor(p.size),
        Math.floor(p.size)
      );
    }

    ctx.restore();
  }

  /**
   * Renders a Bouncing Grenade with altitude, shadow, and sparking fuse
   */
  public static renderBouncingGrenade(
    ctx: CanvasRenderingContext2D,
    grenade: ActiveBouncingGrenade
  ) {
    ctx.save();

    // 1. Ground shadow (scales inversely with height z)
    const shadowScale = Math.max(0.3, 1 - grenade.z * 0.025);
    const shadowAlpha = Math.max(0.15, 0.5 - grenade.z * 0.02);
    ctx.fillStyle = `rgba(0, 0, 0, ${shadowAlpha})`;
    ctx.beginPath();
    ctx.ellipse(grenade.x, grenade.y, 6 * shadowScale, 3 * shadowScale, 0, 0, Math.PI * 2);
    ctx.fill();

    // 2. Grenade elevated by altitude z
    const gx = grenade.x;
    const gy = grenade.y - Math.max(0, grenade.z);

    // Grenade body (8x8 pixel circle)
    ctx.fillStyle = '#204810'; // Dark olive
    ctx.beginPath();
    ctx.arc(gx, gy, 5, 0, Math.PI * 2);
    ctx.fill();

    // Highlight
    ctx.fillStyle = '#488828';
    ctx.fillRect(gx - 2, gy - 3, 2, 2);

    // Brass fuse pin
    ctx.fillStyle = '#d0a020';
    ctx.fillRect(gx - 1, gy - 7, 2, 3);

    // Sparkling fuse tip
    const spark = Math.floor(Date.now() / 60) % 2 === 0;
    ctx.fillStyle = spark ? '#ffff00' : '#ff2000';
    ctx.fillRect(gx - 2, gy - 9, 3, 3);

    ctx.restore();
  }

  /**
   * Renders a Deployable Shield Barricade (3 HP, 15s timer, directional)
   */
  public static renderDeployableShield(
    ctx: CanvasRenderingContext2D,
    shield: ActiveDeployableShield
  ) {
    ctx.save();

    // 3-second expiration warning blink
    if (shield.timer < 180 && Math.floor(shield.timer / 8) % 2 === 0) {
      ctx.globalAlpha = 0.4;
    }

    const x = shield.x;
    const y = shield.y;
    const w = shield.width;
    const h = shield.height;

    // Glowing aura
    ctx.fillStyle = shield.hp === 3 ? 'rgba(0, 220, 255, 0.25)' : shield.hp === 2 ? 'rgba(255, 200, 0, 0.25)' : 'rgba(255, 50, 0, 0.3)';
    ctx.fillRect(x - 2, y - 2, w + 4, h + 4);

    // Metallic chassis base
    ctx.fillStyle = '#182430';
    ctx.fillRect(x, y, w, h);

    // Reinforced steel corner brackets
    ctx.fillStyle = '#8090a0';
    ctx.fillRect(x, y, 4, 4);
    ctx.fillRect(x + w - 4, y, 4, 4);
    ctx.fillRect(x, y + h - 4, 4, 4);
    ctx.fillRect(x + w - 4, y + h - 4, 4, 4);

    // Energy field core
    ctx.fillStyle = shield.hp === 3 ? '#00e8ff' : shield.hp === 2 ? '#ffc020' : '#ff3820';
    if (w > h) {
      // Horizontal barrier
      ctx.fillRect(x + 4, y + 2, w - 8, h - 4);
      // Scanlines
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(x + 6, y + Math.floor(h / 2) - 1, w - 12, 2);
    } else {
      // Vertical barrier
      ctx.fillRect(x + 2, y + 4, w - 4, h - 8);
      // Scanlines
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(x + Math.floor(w / 2) - 1, y + 6, 2, h - 12);
    }

    // Damage cracks if hp < 3
    if (shield.hp <= 2) {
      ctx.fillStyle = '#000000';
      ctx.fillRect(x + Math.floor(w / 3), y + Math.floor(h / 3), 3, 2);
      ctx.fillRect(x + Math.floor(w / 3) + 2, y + Math.floor(h / 3) + 2, 2, 3);
    }
    if (shield.hp === 1) {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(x + Math.floor((w * 2) / 3), y + Math.floor(h / 2), 4, 2);
      ctx.fillRect(x + Math.floor((w * 2) / 3) + 2, y + Math.floor(h / 2) - 3, 2, 4);
    }

    // 3 Status pips (HP indicator)
    const pipColor = shield.hp >= 3 ? '#00ff60' : shield.hp === 2 ? '#ffb000' : '#ff2020';
    ctx.fillStyle = pipColor;
    if (w > h) {
      for (let i = 0; i < shield.hp; i++) {
        ctx.fillRect(x + Math.floor(w / 2) - 8 + i * 6, y + h - 3, 4, 2);
      }
    } else {
      for (let i = 0; i < shield.hp; i++) {
        ctx.fillRect(x + w - 3, y + Math.floor(h / 2) - 8 + i * 6, 2, 4);
      }
    }

    ctx.restore();
  }
}
