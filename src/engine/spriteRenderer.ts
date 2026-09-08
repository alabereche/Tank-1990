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
  PayloadStatus,
  PayloadCheckpoint,
} from '../types';
import { BLOCK_SIZE, BadwaterWaypoint } from './maps';

export class SpriteRenderer {
  // --- Offscreen Sprite Cache for High-Performance GPU Blitting ---
  private static spriteCache: Map<string, HTMLCanvasElement> = new Map();

  private static getOrCreateSprite(
    key: string,
    width: number,
    height: number,
    renderFn: (c: CanvasRenderingContext2D) => void
  ): HTMLCanvasElement | null {
    if (typeof document === 'undefined') return null;
    let cached = SpriteRenderer.spriteCache.get(key);
    if (cached) return cached;
    try {
      cached = document.createElement('canvas');
      cached.width = width;
      cached.height = height;
      const c = cached.getContext('2d', { alpha: true });
      if (c) {
        c.imageSmoothingEnabled = false;
        renderFn(c);
        SpriteRenderer.spriteCache.set(key, cached);
        return cached;
      }
    } catch {}
    return null;
  }

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
    const sprite = SpriteRenderer.getOrCreateSprite(`brick_${mask}`, 16, 16, (c) => {
      SpriteRenderer.drawProceduralBrick(c, 0, 0, mask);
    });
    if (sprite) {
      ctx.drawImage(sprite, x, y);
      return;
    }
    SpriteRenderer.drawProceduralBrick(ctx, x, y, mask);
  }

  public static drawProceduralBrick(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    mask: number = 15
  ) {
    if (mask === 0) return;

    // Draw intact quadrants (8x8 each)
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
    const sprite = SpriteRenderer.getOrCreateSprite('steel', 16, 16, (c) => {
      SpriteRenderer.drawProceduralSteel(c, 0, 0);
    });
    if (sprite) {
      ctx.drawImage(sprite, x, y);
      return;
    }
    SpriteRenderer.drawProceduralSteel(ctx, x, y);
  }

  public static drawProceduralSteel(ctx: CanvasRenderingContext2D, x: number, y: number) {
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
    const frame = animFrame % 2;
    const sprite = SpriteRenderer.getOrCreateSprite(`water_${frame}`, 16, 16, (c) => {
      SpriteRenderer.drawProceduralWater(c, 0, 0, frame);
    });
    if (sprite) {
      ctx.drawImage(sprite, x, y);
      return;
    }
    SpriteRenderer.drawProceduralWater(ctx, x, y, animFrame);
  }

  public static drawProceduralWater(
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
    const sprite = SpriteRenderer.getOrCreateSprite('ice', 16, 16, (c) => {
      SpriteRenderer.drawProceduralIce(c, 0, 0);
    });
    if (sprite) {
      ctx.drawImage(sprite, x, y);
      return;
    }
    SpriteRenderer.drawProceduralIce(ctx, x, y);
  }

  public static drawProceduralIce(ctx: CanvasRenderingContext2D, x: number, y: number) {
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
    const sprite = SpriteRenderer.getOrCreateSprite('mud', 16, 16, (c) => {
      SpriteRenderer.drawProceduralMud(c, 0, 0);
    });
    if (sprite) {
      ctx.drawImage(sprite, x, y);
      return;
    }
    SpriteRenderer.drawProceduralMud(ctx, x, y);
  }

  public static drawProceduralMud(ctx: CanvasRenderingContext2D, x: number, y: number) {
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
    const sprite = SpriteRenderer.getOrCreateSprite('trees', 16, 16, (c) => {
      SpriteRenderer.drawProceduralTrees(c, 0, 0);
    });
    if (sprite) {
      ctx.drawImage(sprite, x, y);
      return;
    }
    SpriteRenderer.drawProceduralTrees(ctx, x, y);
  }

  public static drawProceduralTrees(ctx: CanvasRenderingContext2D, x: number, y: number) {
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
    const sprite = SpriteRenderer.getOrCreateSprite(`base_${palette}_${state}`, 32, 32, (c) => {
      SpriteRenderer.drawProceduralBase(c, 0, 0, state, palette);
    });
    if (sprite) {
      ctx.drawImage(sprite, x, y);
      return;
    }
    SpriteRenderer.drawProceduralBase(ctx, x, y, state, palette);
  }

  public static drawProceduralBase(
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
      if (tank.palette === 'blu') {
        // Team Fortress 2 BLU Team Primary (Attacker / Pusher)
        if (tank.tier === 0) {
          bodyColor = '#1e6cc4'; // Deep TF2 BLU Navy
          darkColor = '#0d3b70';
          highlightColor = '#60b8ff';
        } else if (tank.tier === 1) {
          bodyColor = '#247ce0'; // Bright Cyan-Blue
          darkColor = '#0e498c';
          highlightColor = '#7dc8ff';
        } else if (tank.tier === 2) {
          bodyColor = '#00a6f0'; // Electric Blue
          darkColor = '#005d8f';
          highlightColor = '#9de0ff';
        } else {
          bodyColor = '#00c4f8'; // Heavy Overcharged Cyan
          darkColor = '#007090';
          highlightColor = '#c4f2ff';
        }
        treadColor = '#24303c';
      } else if (tank.palette === 'red') {
        // Team Fortress 2 RED Team Primary (Defender)
        if (tank.tier === 0) {
          bodyColor = '#c42020'; // Deep TF2 RED Crimson
          darkColor = '#680a0a';
          highlightColor = '#ff6868';
        } else if (tank.tier === 1) {
          bodyColor = '#dc2626'; // Bright Scarlet Red
          darkColor = '#7a1010';
          highlightColor = '#ff8585';
        } else if (tank.tier === 2) {
          bodyColor = '#e83428'; // Fiery Flame Red
          darkColor = '#881810';
          highlightColor = '#ffa090';
        } else {
          bodyColor = '#ff4528'; // Heavy Inferno Red
          darkColor = '#9a2010';
          highlightColor = '#ffc0a8';
        }
        treadColor = '#342424';
      } else {
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
    const colors = ['#ffffff', '#00f8f8', '#0090ff', '#ffe820'];
    const color = colors[Math.floor(tick / 3) % colors.length];

    ctx.save();
    // 1. Heavy Outer Energy Forcefield Ring (3px bold stroke)
    ctx.strokeStyle = color;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(cx, cy, 19, 0, Math.PI * 2);
    ctx.stroke();

    // 2. Inner Crisp White Energy Ring
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(cx, cy, 16, 0, Math.PI * 2);
    ctx.stroke();

    // 3. 4 Heavy Orbiting Energy Node Brackets (with sharp black rim for contrast)
    const rot = (tick * 0.12) % (Math.PI * 2);
    for (let i = 0; i < 4; i++) {
      const a = rot + (i * Math.PI) / 2;
      const px = Math.floor(cx + Math.cos(a) * 19);
      const py = Math.floor(cy + Math.sin(a) * 19);

      ctx.fillStyle = '#000000';
      ctx.fillRect(px - 3, py - 3, 6, 6);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(px - 2, py - 2, 4, 4);
      ctx.fillStyle = color;
      ctx.fillRect(px - 1, py - 1, 2, 2);
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
   * High-contrast, dense arcade billowing white/silver clouds that fully obscure
   * tanks and battlefield without any transparency loss on dark mobile screens.
   * Ultra-lightweight: ~15 fast fillRect calls with zero loop drag.
   */
  public static renderSmokeScreen(
    ctx: CanvasRenderingContext2D,
    smoke: ActiveSmokeScreen
  ) {
    ctx.save();
    // Global fade out smoothly only during the final 60 ticks
    const globalFade = smoke.duration < 60 ? smoke.duration / 60 : 1;
    ctx.globalAlpha = Math.max(0.35, globalFade);

    const half = smoke.radius; // 56px (total 112x112px square)
    const cx = Math.floor(smoke.x);
    const cy = Math.floor(smoke.y);
    const left = cx - half;
    const top = cy - half;
    const size = half * 2; // 112px
    const cornerStep = 10;

    // 1. High-Contrast Outer Silhouette (Dark charcoal/navy rim)
    ctx.fillStyle = '#1c2430';
    ctx.fillRect(left, top + cornerStep, size, size - cornerStep * 2);
    ctx.fillRect(left + cornerStep, top, size - cornerStep * 2, size);
    ctx.fillRect(left + 4, top + 4, size - 8, size - 8);

    // 2. Solid Dense Cloud Mass (100% opaque light cloud silver/white)
    ctx.fillStyle = '#d6e2ee';
    ctx.fillRect(left + 2, top + cornerStep + 2, size - 4, size - (cornerStep + 2) * 2);
    ctx.fillRect(left + cornerStep + 2, top + 2, size - (cornerStep + 2) * 2, size - 4);
    ctx.fillRect(left + 6, top + 6, size - 12, size - 12);

    // 3. Billowing Arcade Cloud Clusters (Stylized retro billows with pure white highlights)
    const animTick = Math.floor(Date.now() / 180) % 2;
    const puffOffset = animTick === 0 ? 0 : 2;

    // Cloud clusters: center & quadrants
    const puffs = [
      // Center puffs
      { x: cx - 22, y: cy - 22, w: 44, h: 44, col: '#ffffff' },
      // Top-left
      { x: left + 14 + puffOffset, y: top + 14, w: 32, h: 28, col: '#edf4fa' },
      // Top-right
      { x: left + 62, y: top + 14 + puffOffset, w: 34, h: 28, col: '#ffffff' },
      // Bottom-left
      { x: left + 14, y: top + 64 + puffOffset, w: 34, h: 32, col: '#b8cce0' },
      // Bottom-right
      { x: left + 64 - puffOffset, y: top + 64, w: 32, h: 32, col: '#d0e0f0' },
      // Upper crest
      { x: cx - 20, y: top + 6, w: 40, h: 18, col: '#ffffff' },
      // Lower shaded crest
      { x: cx - 24, y: top + size - 24, w: 48, h: 16, col: '#98acc0' },
      // Left crest
      { x: left + 6, y: cy - 20, w: 18, h: 40, col: '#e2edf6' },
      // Right crest
      { x: left + size - 24, y: cy - 20, w: 18, h: 40, col: '#c8d8ea' },
    ];

    for (const p of puffs) {
      ctx.fillStyle = p.col;
      ctx.fillRect(p.x, p.y, p.w, p.h);
      // Highlight rim on puffs
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(p.x + 2, p.y + 2, Math.floor(p.w * 0.5), 3);
    }

    // 4. Stepped Cloud Billow Teeth around perimeter (animated pixel breathing)
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(cx - 16, top - 2, 32, 4);
    ctx.fillRect(cx - 16, top + size - 2, 32, 4);
    ctx.fillRect(left - 2, cy - 16, 4, 32);
    ctx.fillRect(left + size - 2, cy - 16, 4, 32);

    // 5. Square Drifting Sparks/Smoke Particles (if any)
    if (smoke.particles && smoke.particles.length > 0) {
      for (const p of smoke.particles) {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(
          Math.floor(p.x - p.size / 2),
          Math.floor(p.y - p.size / 2),
          Math.floor(p.size),
          Math.floor(p.size)
        );
      }
    }

    ctx.restore();
  }

  /**
   * Renders a Bouncing Grenade with altitude, shadow, and sparking fuse
   * High-contrast 14px arcade design with bold rim, vibrant body, and bright spark.
   */
  public static renderBouncingGrenade(
    ctx: CanvasRenderingContext2D,
    grenade: ActiveBouncingGrenade
  ) {
    ctx.save();

    const gz = Math.max(0, grenade.z);
    const gx = Math.floor(grenade.x);
    const gy = Math.floor(grenade.y - gz);

    // 1. High-Contrast Ground Target Shadow (Scales with altitude)
    const shadowScale = Math.max(0.4, 1 - gz * 0.025);
    // Outer contrast beacon
    ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
    ctx.fillRect(
      Math.floor(grenade.x - 7 * shadowScale),
      Math.floor(grenade.y - 2 * shadowScale),
      Math.floor(14 * shadowScale),
      Math.floor(4 * shadowScale)
    );
    // Core black shadow
    ctx.fillStyle = '#000000';
    ctx.fillRect(
      Math.floor(grenade.x - 5 * shadowScale),
      Math.floor(grenade.y - 1.5 * shadowScale),
      Math.floor(10 * shadowScale),
      Math.floor(3 * shadowScale)
    );

    // 2. Black Outer Rim Outline (Radius 7.5px) for 100% background contrast
    ctx.fillStyle = '#000000';
    ctx.beginPath();
    ctx.arc(gx, gy, 7.5, 0, Math.PI * 2);
    ctx.fill();

    // 3. Vibrant High-Visibility Pine-Green Grenade Body (Radius 6.5px)
    ctx.fillStyle = '#38a820';
    ctx.beginPath();
    ctx.arc(gx, gy, 6.5, 0, Math.PI * 2);
    ctx.fill();

    // 4. Segmentation Grooves
    ctx.fillStyle = '#18580c';
    ctx.fillRect(gx - 5, gy - 1, 10, 2);
    ctx.fillRect(gx - 1, gy - 5, 2, 10);

    // 5. Pulsing Red/White Detonation Warning Band
    const isCritical = grenade.life < 60;
    const pulseTick = Math.floor(Date.now() / (isCritical ? 60 : 120)) % 2 === 0;
    ctx.fillStyle = pulseTick ? '#ff2020' : '#ffffff';
    ctx.fillRect(gx - 2, gy - 2, 4, 4);

    // 6. Crisp Specular Highlights
    ctx.fillStyle = '#9cf838';
    ctx.fillRect(gx - 4, gy - 4, 3, 2);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(gx - 3, gy - 4, 1, 1);

    // 7. Brass Detonator Neck & Safety Pin
    ctx.fillStyle = '#f8d838';
    ctx.fillRect(gx - 2, gy - 10, 4, 4);
    ctx.fillStyle = '#a88818';
    ctx.fillRect(gx - 1, gy - 9, 2, 2);

    // 8. Dynamic Flashing Fuse Spark (White/Yellow/Flame-Orange star)
    const sparkFrame = Math.floor(Date.now() / 45) % 3;
    const sparkColor = sparkFrame === 0 ? '#ffffff' : sparkFrame === 1 ? '#ffff00' : '#ff4000';
    ctx.fillStyle = sparkColor;
    ctx.fillRect(gx - 3, gy - 14, 6, 2);
    ctx.fillRect(gx - 1, gy - 16, 2, 6);

    ctx.restore();
  }

  /**
   * Renders a Deployable Shield Barricade (3 HP, 15s timer, directional)
   * High-contrast, solid neon-cyan/steel forcefield barrier with zero transparency.
   */
  public static renderDeployableShield(
    ctx: CanvasRenderingContext2D,
    shield: ActiveDeployableShield
  ) {
    ctx.save();

    // 3-second expiration warning blink
    if (shield.timer < 180 && Math.floor(shield.timer / 8) % 2 === 0) {
      ctx.globalAlpha = 0.55;
    }

    const x = shield.x;
    const y = shield.y;
    const w = shield.width;
    const h = shield.height;

    // Palette based on HP (HP3: Cyan, HP2: Gold, HP1: Red)
    const isHp3 = shield.hp >= 3;
    const isHp2 = shield.hp === 2;
    const coreColor = isHp3 ? '#00f8f8' : isHp2 ? '#f8d000' : '#ff2828';
    const glowColor = isHp3 ? '#0088f8' : isHp2 ? '#e87000' : '#b00000';
    const animTick = Math.floor(Date.now() / 80) % 4;

    // 1. Black outer contrast rim
    ctx.fillStyle = '#000000';
    ctx.fillRect(x - 1, y - 1, w + 2, h + 2);

    // 2. High-voltage energy aura border (Solid)
    ctx.fillStyle = glowColor;
    ctx.fillRect(x, y, w, h);

    if (w > h) {
      // Horizontal Barrier (32px wide, 10px high)
      // Solid electric core
      ctx.fillStyle = coreColor;
      ctx.fillRect(x + 2, y + 2, w - 4, h - 4);

      // Brilliant white central energy beam
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(x + 4, y + 4, w - 8, 2);

      // Heavy reinforced corner brackets (Solid steel metallic silver)
      ctx.fillStyle = '#d0e4f4';
      ctx.fillRect(x, y, 4, h);
      ctx.fillRect(x + w - 4, y, 4, h);
      ctx.fillStyle = '#607898';
      ctx.fillRect(x + 1, y + 1, 2, h - 2);
      ctx.fillRect(x + w - 3, y + 1, 2, h - 2);

      // Animated electric pulse node along the beam
      ctx.fillStyle = '#ffffff';
      const nodeX = x + 6 + ((animTick * 6) % (w - 14));
      ctx.fillRect(nodeX, y + 3, 3, 4);

      // 3 HP status pips (Solid high-visibility bright jewels)
      const pipColor = isHp3 ? '#00ff40' : isHp2 ? '#ffcc00' : '#ff2020';
      ctx.fillStyle = pipColor;
      for (let i = 0; i < shield.hp; i++) {
        ctx.fillRect(x + Math.floor(w / 2) - 9 + i * 7, y + h - 3, 5, 2);
      }
    } else {
      // Vertical Barrier (10px wide, 32px high)
      ctx.fillStyle = coreColor;
      ctx.fillRect(x + 2, y + 2, w - 4, h - 4);

      // Brilliant white central energy beam
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(x + 4, y + 4, 2, h - 8);

      // Heavy reinforced corner brackets
      ctx.fillStyle = '#d0e4f4';
      ctx.fillRect(x, y, w, 4);
      ctx.fillRect(x, y + h - 4, w, 4);
      ctx.fillStyle = '#607898';
      ctx.fillRect(x + 1, y + 1, w - 2, 2);
      ctx.fillRect(x + 1, y + h - 3, w - 2, 2);

      // Animated electric pulse node
      ctx.fillStyle = '#ffffff';
      const nodeY = y + 6 + ((animTick * 6) % (h - 14));
      ctx.fillRect(x + 3, nodeY, 4, 3);

      // 3 HP status pips
      const pipColor = isHp3 ? '#00ff40' : isHp2 ? '#ffcc00' : '#ff2020';
      ctx.fillStyle = pipColor;
      for (let i = 0; i < shield.hp; i++) {
        ctx.fillRect(x + w - 3, y + Math.floor(h / 2) - 9 + i * 7, 2, 5);
      }
    }

    ctx.restore();
  }

  /*    * Renders authentic high-density arcade-grade railway tracks with crushed basalt gravel ballast,
    * heavy timber sleepers, steel tie plates with spike bolts, and continuous 3D dual steel rails.
    */
  public static renderRailTrack(
    ctx: CanvasRenderingContext2D,
    waypoints: BadwaterWaypoint[]
  ) {
    if (!waypoints || waypoints.length < 2) return;

    ctx.save();
    ctx.imageSmoothingEnabled = false;

    const ballastWidth = 26;

    // --- PASS 1: Crushed Basalt Gravel Ballast Bed (Roadbed) ---
    ctx.lineCap = 'square';
    ctx.lineJoin = 'miter';

    // 1a. Dark earth excavation trench / outer border
    ctx.strokeStyle = '#141210';
    ctx.lineWidth = ballastWidth + 4;
    ctx.beginPath();
    ctx.moveTo(waypoints[0].x, waypoints[0].y);
    for (let i = 1; i < waypoints.length; i++) {
      ctx.lineTo(waypoints[i].x, waypoints[i].y);
    }
    ctx.stroke();

    // 1b. Main compacted basalt crushed stone
    ctx.strokeStyle = '#25221f';
    ctx.lineWidth = ballastWidth;
    ctx.beginPath();
    ctx.moveTo(waypoints[0].x, waypoints[0].y);
    for (let i = 1; i < waypoints.length; i++) {
      ctx.lineTo(waypoints[i].x, waypoints[i].y);
    }
    ctx.stroke();

    // 1c. Gravel stone texture speckles along segments
    for (let i = 0; i < waypoints.length - 1; i++) {
      const p1 = waypoints[i];
      const p2 = waypoints[i + 1];
      const dx = p2.x - p1.x;
      const dy = p2.y - p1.y;
      const len = Math.sqrt(dx * dx + dy * dy);
      if (len === 0) continue;

      const angle = Math.atan2(dy, dx);
      const perpX = -Math.sin(angle);
      const perpY = Math.cos(angle);

      for (let d = 3; d < len; d += 6) {
        const cx = p1.x + (dx * d) / len;
        const cy = p1.y + (dy * d) / len;
        const seed = Math.floor(cx * 13 + cy * 29);
        const offset = ((seed % 17) - 8) * 1.2;
        ctx.fillStyle = seed % 3 === 0 ? '#3c362f' : seed % 3 === 1 ? '#181614' : '#2e2a25';
        ctx.fillRect(
          Math.floor(cx + perpX * offset - 1),
          Math.floor(cy + perpY * offset - 1),
          2,
          2
        );
      }
    }

    // --- PASS 2: Heavy Timber Sleepers (Cross-ties) with Tie Plates & Spikes ---
    const tieSpacing = 10;
    const tieLength = 22;   // perpendicular to track
    const tieThickness = 4; // parallel to track

    for (let i = 0; i < waypoints.length - 1; i++) {
      const p1 = waypoints[i];
      const p2 = waypoints[i + 1];
      const dx = p2.x - p1.x;
      const dy = p2.y - p1.y;
      const len = Math.sqrt(dx * dx + dy * dy);
      if (len === 0) continue;

      const angle = Math.atan2(dy, dx);
      const normX = dx / len;
      const normY = dy / len;
      const numTies = Math.floor(len / tieSpacing);

      for (let t = 0; t <= numTies; t++) {
        const dist = t * tieSpacing;
        if (dist > len) break;
        const cx = p1.x + normX * dist;
        const cy = p1.y + normY * dist;

        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(angle);

        // Sleeper shadow beneath
        ctx.fillStyle = '#180f07';
        ctx.fillRect(-tieThickness / 2 - 1, -tieLength / 2 - 1, tieThickness + 2, tieLength + 2);

        // Creosote treated wood body
        ctx.fillStyle = '#3e2614';
        ctx.fillRect(-tieThickness / 2, -tieLength / 2, tieThickness, tieLength);

        // Top edge bevel highlight
        ctx.fillStyle = '#5c391e';
        ctx.fillRect(-tieThickness / 2, -tieLength / 2, 1.5, tieLength);

        // Heavy cast-iron tie plates under each rail seat (offset -6 and +6)
        ctx.fillStyle = '#1a1d21';
        ctx.fillRect(-tieThickness / 2 - 0.5, -8.5, tieThickness + 1, 5);
        ctx.fillRect(-tieThickness / 2 - 0.5, 3.5, tieThickness + 1, 5);

        // Steel railroad spike rivets
        ctx.fillStyle = '#9cb0c4';
        ctx.fillRect(-tieThickness / 2 + 1, -7.5, 1.5, 1.5);
        ctx.fillRect(-tieThickness / 2 + 1, 4.5, 1.5, 1.5);

        ctx.restore();
      }
    }

    // --- PASS 3: Corner Junction Steel Switchplates (Under rails) ---
    for (let i = 1; i < waypoints.length - 1; i++) {
      const wp = waypoints[i];
      ctx.fillStyle = '#181b20';
      ctx.fillRect(wp.x - 8, wp.y - 8, 16, 16);
      ctx.fillStyle = '#282f38';
      ctx.fillRect(wp.x - 7, wp.y - 7, 14, 14);

      // Corner industrial bolt studs
      ctx.fillStyle = '#8a9cb0';
      ctx.fillRect(wp.x - 6, wp.y - 6, 2, 2);
      ctx.fillRect(wp.x + 4, wp.y - 6, 2, 2);
      ctx.fillRect(wp.x - 6, wp.y + 4, 2, 2);
      ctx.fillRect(wp.x + 4, wp.y + 4, 2, 2);
    }

    // --- PASS 4: Orthogonal Parallel Dual Steel Rails (Gauge = 12px, offset +/- 6px) ---
    // Pure segment-by-segment straight parallel rails with 6px extension at corners
    // Guarantees zero diagonal skewing and perfect 90-degree right angle joints!
    const railOffset = 6;
    interface RailSegment {
      x1: number;
      y1: number;
      x2: number;
      y2: number;
    }
    const rails: RailSegment[] = [];

    for (let i = 0; i < waypoints.length - 1; i++) {
      const p1 = waypoints[i];
      const p2 = waypoints[i + 1];

      if (p1.x === p2.x) {
        // Vertical segment: rails run straight vertically at cx - 6 and cx + 6
        const cx = p1.x;
        const minY = Math.min(p1.y, p2.y) - railOffset;
        const maxY = Math.max(p1.y, p2.y) + railOffset;
        rails.push({ x1: cx - railOffset, y1: minY, x2: cx - railOffset, y2: maxY });
        rails.push({ x1: cx + railOffset, y1: minY, x2: cx + railOffset, y2: maxY });
      } else if (p1.y === p2.y) {
        // Horizontal segment: rails run straight horizontally at cy - 6 and cy + 6
        const cy = p1.y;
        const minX = Math.min(p1.x, p2.x) - railOffset;
        const maxX = Math.max(p1.x, p2.x) + railOffset;
        rails.push({ x1: minX, y1: cy - railOffset, x2: maxX, y2: cy - railOffset });
        rails.push({ x1: minX, y1: cy + railOffset, x2: maxX, y2: cy + railOffset });
      } else {
        // General non-orthogonal fallback with normalized perpendicular offsets
        const dx = p2.x - p1.x;
        const dy = p2.y - p1.y;
        const len = Math.sqrt(dx * dx + dy * dy);
        const perpX = (-dy / len) * railOffset;
        const perpY = (dx / len) * railOffset;
        rails.push({ x1: p1.x - perpX, y1: p1.y - perpY, x2: p2.x - perpX, y2: p2.y - perpY });
        rails.push({ x1: p1.x + perpX, y1: p1.y + perpY, x2: p2.x + perpX, y2: p2.y + perpY });
      }
    }

    ctx.lineCap = 'butt';
    ctx.lineJoin = 'miter';

    // 4a. Heavy dark steel base & flange shadow
    ctx.strokeStyle = '#101316';
    ctx.lineWidth = 4.0;
    ctx.beginPath();
    for (const r of rails) {
      ctx.moveTo(r.x1, r.y1);
      ctx.lineTo(r.x2, r.y2);
    }
    ctx.stroke();

    // 4b. Rolled steel rail body profile
    ctx.strokeStyle = '#5a6676';
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    for (const r of rails) {
      ctx.moveTo(r.x1, r.y1);
      ctx.lineTo(r.x2, r.y2);
    }
    ctx.stroke();

    // 4c. Specular polished chrome railhead highlight
    ctx.strokeStyle = '#edf4fc';
    ctx.lineWidth = 1.0;
    ctx.beginPath();
    for (const r of rails) {
      ctx.moveTo(r.x1, r.y1);
      ctx.lineTo(r.x2, r.y2);
    }
    ctx.stroke();

    ctx.restore();
  }

  /**
   * Renders Badwater tactical control checkpoints with illuminated platforms and the Final Blast Pit Silo
   */
  public static renderCheckpoints(
    ctx: CanvasRenderingContext2D,
    checkpoints: PayloadCheckpoint[],
    tick: number = 0
  ) {
    if (!checkpoints) return;
    ctx.save();
    ctx.imageSmoothingEnabled = false;

    for (let i = 0; i < checkpoints.length; i++) {
      const cp = checkpoints[i];
      const cx = cp.x;
      const cy = cp.y;
      const isFinal = i === checkpoints.length - 1;

      if (isFinal) {
        // --- FINAL POINT: THE MASSIVE SUBTERRANEAN BLAST PIT SILO ---
        const size = 42;
        const half = size / 2;
        const bx = cx - half;
        const by = cy - half;

        // Concrete & titanium silo rim
        ctx.fillStyle = '#14161a';
        ctx.fillRect(bx - 2, by - 2, size + 4, size + 4);
        ctx.fillStyle = '#2a2e36';
        ctx.fillRect(bx, by, size, size);

        // Outer Red/White Hazard Chevron Border
        for (let s = 0; s < size; s += 7) {
          ctx.fillStyle = '#d82800';
          ctx.fillRect(bx + s, by, 4, 3);
          ctx.fillRect(bx + s, by + size - 3, 4, 3);
          ctx.fillRect(bx, by + s, 3, 4);
          ctx.fillRect(bx + size - 3, by + s, 3, 4);
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(bx + s + 4, by, 3, 3);
          ctx.fillRect(bx + s + 4, by + size - 3, 3, 3);
          ctx.fillRect(bx, by + s + 4, 3, 3);
          ctx.fillRect(bx + size - 3, by + s + 4, 3, 3);
        }

        // Inner Subterranean Abyss Pit
        ctx.fillStyle = '#0a0808';
        ctx.beginPath();
        ctx.arc(cx, cy, 15, 0, Math.PI * 2);
        ctx.fill();

        // Pulsing Core Nuclear Red Glow
        const pulse = Math.sin(tick * 0.1) * 0.3 + 0.7;
        ctx.fillStyle = `rgba(220, 30, 20, ${0.4 * pulse})`;
        ctx.beginPath();
        ctx.arc(cx, cy, 13, 0, Math.PI * 2);
        ctx.fill();

        // Steel blast hatch grating cross
        ctx.strokeStyle = '#3e4450';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(cx - 14, cy);
        ctx.lineTo(cx + 14, cy);
        ctx.moveTo(cx, cy - 14);
        ctx.lineTo(cx, cy + 14);
        ctx.stroke();

        // Red Flashing Warning Beacon
        const beaconOn = tick % 30 < 15;
        ctx.fillStyle = beaconOn ? '#ff2222' : '#881111';
        ctx.beginPath();
        ctx.arc(cx, cy, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = beaconOn ? '#ffffff' : '#440000';
        ctx.fillRect(cx - 1, cy - 1, 2, 2);

        // Warning Beacon (without text label)

      } else {
        // --- TACTICAL CONTROL CHECKPOINTS 1, 2, 3 ---
        const size = 32;
        const half = size / 2;
        const bx = cx - half;
        const by = cy - half;

        // Heavy industrial steel deck base
        ctx.fillStyle = '#16191d';
        ctx.fillRect(bx - 1, by - 1, size + 2, size + 2);
        ctx.fillStyle = '#262b33';
        ctx.fillRect(bx, by, size, size);

        // Yellow & Black Hazard Chevron Border
        for (let s = 0; s < size; s += 6) {
          ctx.fillStyle = '#f8b800';
          ctx.fillRect(bx + s, by, 3, 2.5);
          ctx.fillRect(bx + s, by + size - 2.5, 3, 2.5);
          ctx.fillStyle = '#000000';
          ctx.fillRect(bx + s + 3, by, 3, 2.5);
          ctx.fillRect(bx + s + 3, by + size - 2.5, 3, 2.5);
        }

        // Circular Recessed Pad
        ctx.fillStyle = '#15171b';
        ctx.beginPath();
        ctx.arc(cx, cy, 11, 0, Math.PI * 2);
        ctx.fill();

        // Status Glow Ring
        const isNextTarget = !cp.captured && (i === 0 || checkpoints[i - 1].captured);
        let ringColor = '#3c4450';
        let badgeColor = '#606a78';

        if (cp.captured) {
          ringColor = '#00e5ff';
          badgeColor = '#00e5ff';
        } else if (isNextTarget) {
          const pulse = Math.sin(tick * 0.12) > 0;
          ringColor = pulse ? '#ffb800' : '#885800';
          badgeColor = '#ffb800';
        }

        ctx.strokeStyle = ringColor;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(cx, cy, 10, 0, Math.PI * 2);
        ctx.stroke();

        // Checkpoint Alphanumeric Letter: "A", "B", "C"
        const letters = ['A', 'B', 'C'];
        ctx.fillStyle = badgeColor;
        ctx.font = 'bold 11px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(letters[i] || `${i + 1}`, cx, cy);
      }
    }

    ctx.restore();
  }

  /**
   * Renders the Armored Payload Bomb Cart and subtle holographic push aura
   */
  public static renderPayloadCart(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    dir: Direction,
    status: PayloadStatus,
    tick: number = 0,
    pushRadius: number = 54
  ) {
    ctx.save();
    ctx.imageSmoothingEnabled = false;

    // 1. SUBTLE HOLOGRAPHIC TACTICAL PUSH AURA
    let auraField = 'rgba(0, 180, 255, 0.04)';
    let ringColor = 'rgba(0, 190, 255, 0.70)';
    let innerDashColor = 'rgba(0, 190, 255, 0.35)';

    if (status === 'PUSHING') {
      auraField = 'rgba(0, 255, 130, 0.07)';
      ringColor = 'rgba(0, 255, 130, 0.85)';
      innerDashColor = 'rgba(0, 255, 130, 0.45)';
    } else if (status === 'CONTESTED') {
      const flash = tick % 16 < 8;
      auraField = flash ? 'rgba(255, 40, 40, 0.10)' : 'rgba(255, 180, 0, 0.10)';
      ringColor = flash ? '#ff3333' : '#f8b800';
      innerDashColor = flash ? 'rgba(255, 60, 60, 0.5)' : 'rgba(248, 184, 0, 0.5)';
    } else if (status === 'ROLLBACK') {
      auraField = 'rgba(248, 184, 0, 0.06)';
      ringColor = 'rgba(248, 184, 0, 0.80)';
      innerDashColor = 'rgba(248, 184, 0, 0.40)';
    }

    // Gentle translucent ground aura
    ctx.fillStyle = auraField;
    ctx.beginPath();
    ctx.arc(x, y, pushRadius, 0, Math.PI * 2);
    ctx.fill();

    // Rotating inner holographic dotted ring
    ctx.strokeStyle = innerDashColor;
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 5]);
    ctx.lineDashOffset = -tick * 0.6;
    ctx.beginPath();
    ctx.arc(x, y, pushRadius - 4, 0, Math.PI * 2);
    ctx.stroke();

    // Solid perimeter ring
    ctx.strokeStyle = ringColor;
    ctx.lineWidth = 1.5;
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.arc(x, y, pushRadius, 0, Math.PI * 2);
    ctx.stroke();

    // 4 Corner Tactical Bracket Accents
    const bracketDist = pushRadius * 0.72;
    ctx.strokeStyle = ringColor;
    ctx.lineWidth = 1.5;
    for (const sx of [-1, 1]) {
      for (const sy of [-1, 1]) {
        const bx = x + sx * bracketDist;
        const by = y + sy * bracketDist;
        ctx.beginPath();
        ctx.moveTo(bx, by - sy * 6);
        ctx.lineTo(bx, by);
        ctx.lineTo(bx - sx * 6, by);
        ctx.stroke();
      }
    }

    // 2. ARMORED BOMB CART (32x32 heavy military rail wagon)
    const bx = Math.floor(x - 16);
    const by = Math.floor(y - 16);

    // Flanged Steel Railway Wheels (Aligned with rails at offset +/- 6px)
    ctx.fillStyle = '#14171a';
    ctx.fillRect(bx + 2, by + 1, 5, 8);
    ctx.fillRect(bx + 25, by + 1, 5, 8);
    ctx.fillRect(bx + 2, by + 23, 5, 8);
    ctx.fillRect(bx + 25, by + 23, 5, 8);

    // Wheel steel rims
    ctx.fillStyle = '#647282';
    ctx.fillRect(bx + 3, by + 2, 3, 6);
    ctx.fillRect(bx + 26, by + 2, 3, 6);
    ctx.fillRect(bx + 3, by + 24, 3, 6);
    ctx.fillRect(bx + 26, by + 24, 3, 6);

    // Cart Heavy Armored Chassis (32x32)
    ctx.fillStyle = '#2a3038';
    ctx.fillRect(bx + 2, by + 2, 28, 28);

    // Bevel highlights & shadow rims
    ctx.fillStyle = '#505c6c';
    ctx.fillRect(bx + 2, by + 2, 28, 2);
    ctx.fillRect(bx + 2, by + 2, 2, 28);
    ctx.fillStyle = '#14181c';
    ctx.fillRect(bx + 2, by + 28, 28, 2);
    ctx.fillRect(bx + 28, by + 2, 2, 28);

    // Front and Rear Hazard Chevron Bumpers
    for (let c = 0; c < 28; c += 6) {
      ctx.fillStyle = '#f8b800';
      ctx.fillRect(bx + 2 + c, by + 2, 3, 3);
      ctx.fillRect(bx + 2 + c, by + 27, 3, 3);
      ctx.fillStyle = '#000000';
      ctx.fillRect(bx + 5 + c, by + 2, 3, 3);
      ctx.fillRect(bx + 5 + c, by + 27, 3, 3);
    }

    // 3. THE ATOMIC BOMB CARGO (Large spherical tactical warhead in cradle)
    // Shadow under bomb
    ctx.fillStyle = '#101215';
    ctx.beginPath();
    ctx.arc(x, y, 11, 0, Math.PI * 2);
    ctx.fill();

    // Dark iron bomb casing
    ctx.fillStyle = '#20242a';
    ctx.beginPath();
    ctx.arc(x, y, 10, 0, Math.PI * 2);
    ctx.fill();

    // Specular light reflection on casing
    ctx.fillStyle = '#44505e';
    ctx.beginPath();
    ctx.arc(x - 3, y - 3, 5, 0, Math.PI * 2);
    ctx.fill();

    // Central Olive-Drab Titanium Reinforcement Belt
    ctx.fillStyle = '#3a4436';
    ctx.fillRect(x - 9, y - 2, 18, 4);

    // Yellow Radiation Trefoil Stencil in center
    ctx.fillStyle = '#f8b800';
    ctx.beginPath();
    ctx.arc(x, y, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#20242a';
    ctx.beginPath();
    ctx.arc(x, y, 1.2, 0, Math.PI * 2);
    ctx.fill();

    // Blinking Digital Detonation Timer LED Display
    const ledFlash = status === 'CONTESTED' ? tick % 10 < 5 : (status === 'PUSHING' ? tick % 18 < 9 : tick % 36 < 18);
    ctx.fillStyle = '#121416';
    ctx.fillRect(x - 4, y - 13, 8, 4);
    ctx.fillStyle = ledFlash ? '#ff2020' : '#600808';
    ctx.fillRect(x - 3, y - 12, 6, 2);
    if (ledFlash) {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(x - 1, y - 12, 2, 2);
    }

    // Corner heavy armor rivets
    ctx.fillStyle = '#8e9eaf';
    ctx.fillRect(bx + 4, by + 7, 2, 2);
    ctx.fillRect(bx + 26, by + 7, 2, 2);
    ctx.fillRect(bx + 4, by + 23, 2, 2);
    ctx.fillRect(bx + 26, by + 23, 2, 2);

    ctx.restore();
  }
}
