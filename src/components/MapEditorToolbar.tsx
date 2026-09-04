/**
 * Battle City 1990 - Full Construction Mode (Map Editor)
 * Interactive 26x26 grid editor with palette, brush size, presets,
 * JSON export/import, and instant Test Drive / Play mode.
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { StageMap, TileType } from '../types';
import {
  PRESET_MAPS,
  GRID_SIZE,
  BLOCK_SIZE,
  CANVAS_SIZE,
  cloneGrid,
  createEmptyGrid,
} from '../engine/maps';
import { SpriteRenderer } from '../engine/spriteRenderer';
import { BaseState } from '../types';
import {
  Play,
  Download,
  Upload,
  RotateCcw,
  Sparkles,
  Copy,
  Check,
  X,
  Layers,
  Eraser,
  HelpCircle,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
} from 'lucide-react';
import { soundManager } from '../engine/SoundManager';
import { gamepadManager } from '../engine/GamepadManager';

interface MapEditorProps {
  initialMap?: StageMap;
  onStartBattle: (map: StageMap) => void;
  onCancel: () => void;
}

/**
 * Authentic NES 8-bit Pixel Art Icon for Tile Palette materials
 */
const PixelTileIcon: React.FC<{ type: TileType | 'ERASE'; size?: number }> = ({ type, size = 28 }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, size, size);

    ctx.save();
    // Render at native 16x16 and scale up crisply with integer pixel ratio
    const scale = size / 16;
    ctx.scale(scale, scale);

    if (type === TileType.BRICK) {
      SpriteRenderer.renderBrick(ctx, 0, 0, 15);
    } else if (type === TileType.STEEL) {
      SpriteRenderer.renderSteel(ctx, 0, 0);
    } else if (type === TileType.WATER) {
      SpriteRenderer.renderWater(ctx, 0, 0, 0);
    } else if (type === TileType.TREES) {
      SpriteRenderer.renderTrees(ctx, 0, 0);
    } else if (type === TileType.ICE) {
      SpriteRenderer.renderIce(ctx, 0, 0);
    } else if (type === TileType.MUD) {
      SpriteRenderer.renderMud(ctx, 0, 0);
    } else if (type === 'ERASE' || type === TileType.EMPTY) {
      // 16x16 dark grid with pixel eraser cross
      ctx.fillStyle = '#101010';
      ctx.fillRect(0, 0, 16, 16);
      ctx.fillStyle = '#222222';
      ctx.fillRect(0, 0, 8, 8);
      ctx.fillRect(8, 8, 8, 8);
      ctx.strokeStyle = '#ef4444';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(3, 3);
      ctx.lineTo(13, 13);
      ctx.moveTo(13, 3);
      ctx.lineTo(3, 13);
      ctx.stroke();
    }

    ctx.restore();
  }, [type, size]);

  return (
    <canvas
      ref={canvasRef}
      width={size}
      height={size}
      className="pixelated block rounded-[2px] shadow-sm border border-black/80 pointer-events-none"
      style={{ width: `${size}px`, height: `${size}px` }}
    />
  );
};

// Handcrafted stage presets definition with accurate keys matching PRESET_MAPS
const STAGE_PRESETS_LIST = [
  { num: 1, key: 'stage1', label: 'Stage 1: Classic Citadel' },
  { num: 2, key: 'ironFortress', label: 'Stage 2: Iron Fortress' },
  { num: 3, key: 'riverCrossing', label: 'Stage 3: Twin Rivers' },
  { num: 4, key: 'amazonRainforest', label: 'Stage 4: Amazon Rainforest' },
  { num: 5, key: 'glacialArchipelago', label: 'Stage 5: Glacial Archipelago' },
  { num: 6, key: 'greatLabyrinth', label: 'Stage 6: The Great Labyrinth' },
  { num: 7, key: 'muddyBadlands', label: 'Stage 7: Muddy Badlands' },
  { num: 8, key: 'urbanGridlock', label: 'Stage 8: Urban Gridlock' },
  { num: 9, key: 'bunkerComplex', label: 'Stage 9: Bunker Complex' },
  { num: 10, key: 'deathValley', label: 'Stage 10: Death Valley Crater' },
];

const ALL_PRESET_KEYS = [
  ...STAGE_PRESETS_LIST.map((s) => s.key),
  'tacticalMaze',
  'cleanSlate',
];

const PALETTE_TOOLS: TileType[] = [
  TileType.BRICK,
  TileType.STEEL,
  TileType.WATER,
  TileType.TREES,
  TileType.ICE,
  TileType.MUD,
  TileType.EMPTY,
];

export const MapEditorToolbar: React.FC<MapEditorProps> = ({
  initialMap,
  onStartBattle,
  onCancel,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const [mapGrid, setMapGrid] = useState<number[][]>(() => {
    return initialMap ? cloneGrid(initialMap.grid) : cloneGrid(PRESET_MAPS.stage1.grid);
  });
  const [mapName, setMapName] = useState<string>(initialMap?.name || 'Stage 1: Classic Citadel');
  const [selectedTool, setSelectedTool] = useState<TileType>(TileType.BRICK);
  const [brushSize, setBrushSize] = useState<1 | 2>(2); // 1 = 16x16 sub-tile, 2 = 32x32 NES block
  const [isDrawing, setIsDrawing] = useState<boolean>(false);

  // Controller state
  const [cursorPos, setCursorPos] = useState<{ r: number; c: number }>({ r: 12, c: 12 });
  const [activeZone, setActiveZone] = useState<'grid' | 'toolbar'>('grid');
  const [toolbarFocus, setToolbarFocus] = useState<{ row: number; col: number }>({ row: 0, col: 0 });
  const [hasGamepad, setHasGamepad] = useState<boolean>(() => {
    return gamepadManager.getConnectedGamepad() !== null;
  });

  // Tracking refs to prevent stale closures in RAF loop
  const cursorPosRef = useRef(cursorPos);
  cursorPosRef.current = cursorPos;

  const activeZoneRef = useRef(activeZone);
  activeZoneRef.current = activeZone;

  const toolbarFocusRef = useRef(toolbarFocus);
  toolbarFocusRef.current = toolbarFocus;

  const selectedToolRef = useRef(selectedTool);
  selectedToolRef.current = selectedTool;

  const brushSizeRef = useRef(brushSize);
  brushSizeRef.current = brushSize;

  const showJsonModalRef = useRef(false);

  // JSON Import/Export Modal
  const [showJsonModal, setShowJsonModal] = useState<boolean>(false);
  showJsonModalRef.current = showJsonModal;
  const [jsonText, setJsonText] = useState<string>('');
  const [copySuccess, setCopySuccess] = useState<boolean>(false);
  const [jsonError, setJsonError] = useState<string | null>(null);

  // Redraw Canvas
  const currentGridSize = mapGrid.length;
  const currentCanvasSize = currentGridSize * BLOCK_SIZE;
  const baseR = currentGridSize - 2;
  const baseC = Math.floor(currentGridSize / 2) - 1;
  const baseX = baseC * BLOCK_SIZE;
  const baseY = baseR * BLOCK_SIZE;

  // Painting helper usable by both pointer and controller
  const paintAtCoords = useCallback(
    (col: number, row: number, tool: TileType, size: 1 | 2) => {
      const isBaseEagle = (r: number, c: number) =>
        (r === baseR || r === baseR + 1) && (c === baseC || c === baseC + 1);

      setMapGrid((prev) => {
        let changed = false;
        const next = cloneGrid(prev);
        for (let r = row; r < row + size; r++) {
          for (let c = col; c < col + size; c++) {
            if (r >= 0 && r < currentGridSize && c >= 0 && c < currentGridSize) {
              if (isBaseEagle(r, c)) continue;
              if (next[r][c] !== tool) {
                next[r][c] = tool;
                changed = true;
              }
            }
          }
        }
        return changed ? next : prev;
      });
    },
    [baseR, baseC, currentGridSize]
  );

  const drawEditor = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear background
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, currentCanvasSize, currentCanvasSize);

    // 1. Ice & Mud
    for (let r = 0; r < currentGridSize; r++) {
      for (let c = 0; c < currentGridSize; c++) {
        const t = mapGrid[r][c];
        if (t === TileType.ICE) {
          SpriteRenderer.renderIce(ctx, c * BLOCK_SIZE, r * BLOCK_SIZE);
        } else if (t === TileType.MUD) {
          SpriteRenderer.renderMud(ctx, c * BLOCK_SIZE, r * BLOCK_SIZE);
        }
      }
    }

    // 2. Water
    for (let r = 0; r < currentGridSize; r++) {
      for (let c = 0; c < currentGridSize; c++) {
        if (mapGrid[r][c] === TileType.WATER) {
          SpriteRenderer.renderWater(ctx, c * BLOCK_SIZE, r * BLOCK_SIZE, 0);
        }
      }
    }

    // 3. Brick & Steel
    for (let r = 0; r < currentGridSize; r++) {
      for (let c = 0; c < currentGridSize; c++) {
        const type = mapGrid[r][c];
        if (type === TileType.BRICK) {
          SpriteRenderer.renderBrick(ctx, c * BLOCK_SIZE, r * BLOCK_SIZE, 15);
        } else if (type === TileType.STEEL) {
          SpriteRenderer.renderSteel(ctx, c * BLOCK_SIZE, r * BLOCK_SIZE);
        }
      }
    }

    // 4. Base Eagle
    SpriteRenderer.renderBase(ctx, baseX, baseY, BaseState.ALIVE);

    // 5. Trees (Top Layer)
    for (let r = 0; r < currentGridSize; r++) {
      for (let c = 0; c < currentGridSize; c++) {
        if (mapGrid[r][c] === TileType.TREES) {
          SpriteRenderer.renderTrees(ctx, c * BLOCK_SIZE, r * BLOCK_SIZE);
        }
      }
    }

    // 6. Spawn markers & Player Spawn indicator
    ctx.save();
    ctx.strokeStyle = '#e82020';
    ctx.lineWidth = 1;
    ctx.setLineDash([2, 2]);
    ctx.strokeRect(0, 0, 32, 32);
    ctx.strokeRect(baseX, 0, 32, 32);
    ctx.strokeRect((currentGridSize - 2) * BLOCK_SIZE, 0, 32, 32);

    // Player spawn
    ctx.strokeStyle = '#f8b800';
    ctx.strokeRect(Math.max(0, (baseC - 4) * BLOCK_SIZE), baseY, 32, 32);
    ctx.restore();

    // 7. Subtle Grid lines for precision editing
    ctx.save();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
    ctx.lineWidth = 1;
    for (let i = 0; i <= currentCanvasSize; i += 32) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i, currentCanvasSize);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, i);
      ctx.lineTo(currentCanvasSize, i);
      ctx.stroke();
    }
    ctx.restore();

    // 8. Authentic NES Blinking Grid Cursor
    if (activeZone === 'grid') {
      const isBlinkOn = Math.floor(Date.now() / 250) % 2 === 0;
      const cursorPxX = cursorPos.c * BLOCK_SIZE;
      const cursorPxY = cursorPos.r * BLOCK_SIZE;
      const cursorPxSize = brushSize * BLOCK_SIZE;

      ctx.save();
      // Semi-transparent ghost preview of the selected tool
      if (selectedTool !== TileType.EMPTY) {
        ctx.globalAlpha = 0.45;
        if (selectedTool === TileType.BRICK) {
          SpriteRenderer.renderBrick(ctx, cursorPxX, cursorPxY, 15);
        } else if (selectedTool === TileType.STEEL) {
          SpriteRenderer.renderSteel(ctx, cursorPxX, cursorPxY);
        } else if (selectedTool === TileType.WATER) {
          SpriteRenderer.renderWater(ctx, cursorPxX, cursorPxY, 0);
        } else if (selectedTool === TileType.TREES) {
          SpriteRenderer.renderTrees(ctx, cursorPxX, cursorPxY);
        } else if (selectedTool === TileType.ICE) {
          SpriteRenderer.renderIce(ctx, cursorPxX, cursorPxY);
        } else if (selectedTool === TileType.MUD) {
          SpriteRenderer.renderMud(ctx, cursorPxX, cursorPxY);
        }
      } else {
        // Ghost eraser box
        ctx.globalAlpha = 0.35;
        ctx.fillStyle = 'rgba(239, 68, 68, 0.3)';
        ctx.fillRect(cursorPxX, cursorPxY, cursorPxSize, cursorPxSize);
      }

      // Blinking border with alternating retro gold and white
      ctx.globalAlpha = 1.0;
      ctx.strokeStyle = isBlinkOn ? '#f8b800' : '#ffffff';
      ctx.lineWidth = 2;
      ctx.strokeRect(cursorPxX + 1, cursorPxY + 1, cursorPxSize - 2, cursorPxSize - 2);

      // 4 Retro corner accents
      ctx.fillStyle = isBlinkOn ? '#f8b800' : '#ffffff';
      const cLen = Math.min(6, cursorPxSize / 2);
      ctx.fillRect(cursorPxX, cursorPxY, cLen, 2);
      ctx.fillRect(cursorPxX, cursorPxY, 2, cLen);
      ctx.fillRect(cursorPxX + cursorPxSize - cLen, cursorPxY, cLen, 2);
      ctx.fillRect(cursorPxX + cursorPxSize - 2, cursorPxY, 2, cLen);
      ctx.fillRect(cursorPxX, cursorPxY + cursorPxSize - 2, cLen, 2);
      ctx.fillRect(cursorPxX, cursorPxY + cursorPxSize - cLen, 2, cLen);
      ctx.fillRect(cursorPxX + cursorPxSize - cLen, cursorPxY + cursorPxSize - 2, cLen, 2);
      ctx.fillRect(cursorPxX + cursorPxSize - 2, cursorPxY + cursorPxSize - cLen, 2, cLen);

      ctx.restore();
    }
  }, [mapGrid, currentGridSize, currentCanvasSize, baseX, baseY, baseC, activeZone, cursorPos, brushSize, selectedTool]);

  useEffect(() => {
    drawEditor();
  }, [drawEditor]);

  // Handle Paint / Erase on Grid via pointer
  const applyBrush = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    let clientX = 0;
    let clientY = 0;

    if ('touches' in e) {
      if (e.touches.length === 0) return;
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }

    const scaleX = currentCanvasSize / rect.width;
    const scaleY = currentCanvasSize / rect.height;
    const x = (clientX - rect.left) * scaleX;
    const y = (clientY - rect.top) * scaleY;

    const subCol = Math.floor(x / BLOCK_SIZE);
    const subRow = Math.floor(y / BLOCK_SIZE);

    if (subCol < 0 || subCol >= currentGridSize || subRow < 0 || subRow >= currentGridSize) return;

    // Sync cursor position with mouse/touch click
    setCursorPos({
      c: Math.min(subCol, currentGridSize - brushSize),
      r: Math.min(subRow, currentGridSize - brushSize),
    });

    paintAtCoords(subCol, subRow, selectedTool, brushSize);
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    soundManager.unlockAudio();
    setIsDrawing(true);
    applyBrush(e);
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (isDrawing) {
      applyBrush(e);
    }
  };

  const handleMouseUp = () => {
    setIsDrawing(false);
  };

  // Presets State & Navigation
  const [activePresetKey, setActivePresetKey] = useState<string>(() => {
    const found = STAGE_PRESETS_LIST.find((s) => s.label === initialMap?.name);
    return found ? found.key : 'stage1';
  });

  // Presets Loader
  const loadPreset = useCallback((presetKey: string) => {
    soundManager.playHitBrick();
    setActivePresetKey(presetKey);
    const preset = PRESET_MAPS[presetKey];
    if (preset) {
      setMapGrid(cloneGrid(preset.grid));
      setMapName(preset.name);
    }
  }, []);

  const handlePrevPreset = useCallback(() => {
    const currentIdx = ALL_PRESET_KEYS.indexOf(activePresetKey);
    const prevIdx = currentIdx > 0 ? currentIdx - 1 : ALL_PRESET_KEYS.length - 1;
    loadPreset(ALL_PRESET_KEYS[prevIdx]);
  }, [activePresetKey, loadPreset]);

  const handleNextPreset = useCallback(() => {
    const currentIdx = ALL_PRESET_KEYS.indexOf(activePresetKey);
    const nextIdx = currentIdx < ALL_PRESET_KEYS.length - 1 ? currentIdx + 1 : 0;
    loadPreset(ALL_PRESET_KEYS[nextIdx]);
  }, [activePresetKey, loadPreset]);

  // Open Export Modal
  const handleOpenExport = useCallback(() => {
    const payload: StageMap = {
      name: mapName,
      grid: mapGrid,
    };
    setJsonText(JSON.stringify(payload, null, 2));
    setJsonError(null);
    setCopySuccess(false);
    setShowJsonModal(true);
  }, [mapName, mapGrid]);

  const handleTestDrive = useCallback(() => {
    soundManager.playPowerUpCollect();
    onStartBattle({
      name: mapName,
      grid: mapGrid,
    });
  }, [mapName, mapGrid, onStartBattle]);

  // Quick cycle palette materials with LB / RB / Select
  const cyclePalette = useCallback((direction: 1 | -1) => {
    const curIdx = PALETTE_TOOLS.indexOf(selectedToolRef.current);
    const nextIdx = (curIdx + direction + PALETTE_TOOLS.length) % PALETTE_TOOLS.length;
    setSelectedTool(PALETTE_TOOLS[nextIdx]);
    soundManager.playHitBrick();
  }, []);

  // Quick toggle brush size with Y button
  const toggleBrushSize = useCallback(() => {
    setBrushSize((prev) => (prev === 1 ? 2 : 1));
    soundManager.playHitBrick();
  }, []);

  // Helper for max columns in each toolbar row
  const getRowMaxCols = useCallback((row: number): number => {
    if (row === -1) return 3; // JSON, CANCEL, START BATTLE
    if (row === 0) return 2; // BRICK, STEEL
    if (row === 1) return 2; // WATER, TREES
    if (row === 2) return 2; // ICE, MUD
    if (row === 3) return 1; // ERASE
    if (row === 4) return 2; // 16px, 32px
    if (row === 5) return 3; // PREV, DROPDOWN, NEXT
    if (row === 6) return 5; // Stages 1-5
    if (row === 7) return 5; // Stages 6-10
    if (row === 8) return 2; // FFA, CLEAR
    return 1;
  }, []);

  // Activate toolbar item via controller A button or Enter/Space
  const activateToolbarItem = useCallback(
    (row: number, col: number) => {
      soundManager.playHitBrick();
      if (row === -1) {
        if (col === 0) handleOpenExport();
        else if (col === 1) onCancel();
        else if (col === 2) handleTestDrive();
      } else if (row === 0) {
        setSelectedTool(col === 0 ? TileType.BRICK : TileType.STEEL);
        setActiveZone('grid');
      } else if (row === 1) {
        setSelectedTool(col === 0 ? TileType.WATER : TileType.TREES);
        setActiveZone('grid');
      } else if (row === 2) {
        setSelectedTool(col === 0 ? TileType.ICE : TileType.MUD);
        setActiveZone('grid');
      } else if (row === 3) {
        setSelectedTool(TileType.EMPTY);
        setActiveZone('grid');
      } else if (row === 4) {
        setBrushSize(col === 0 ? 1 : 2);
        setActiveZone('grid');
      } else if (row === 5) {
        if (col === 0) handlePrevPreset();
        else handleNextPreset();
      } else if (row === 6) {
        if (col >= 0 && col < 5) loadPreset(STAGE_PRESETS_LIST[col].key);
      } else if (row === 7) {
        if (col >= 0 && col < 5) loadPreset(STAGE_PRESETS_LIST[col + 5].key);
      } else if (row === 8) {
        if (col === 0) loadPreset('tacticalMaze');
        else loadPreset('cleanSlate');
      }
    },
    [handleOpenExport, onCancel, handleTestDrive, handlePrevPreset, handleNextPreset, loadPreset]
  );

  // Gamepad Polling & Blinking Animation Loop
  useEffect(() => {
    let animId: number;
    const mountTime = Date.now();
    const MOUNT_COOLDOWN = 300;

    let lastDirMoveTime = 0;
    let isRepeatingDir = false;
    let lastDir = { up: false, down: false, left: false, right: false };

    const prevButtons = {
      buttonA: false,
      buttonB: false,
      buttonX: false,
      buttonY: false,
      lb: false,
      rb: false,
      start: false,
      select: false,
    };

    const poll = () => {
      animId = requestAnimationFrame(poll);

      // Continuously redraw editor to ensure authentic retro blink
      drawEditor();

      const padInput = gamepadManager.pollMenuInput();
      if (!padInput) return;

      setHasGamepad(true);

      const now = Date.now();
      if (now - mountTime < MOUNT_COOLDOWN) return;

      // Handle JSON modal if open
      if (showJsonModalRef.current) {
        if ((padInput.buttonB && !prevButtons.buttonB) || (padInput.cancel && !prevButtons.buttonB)) {
          setShowJsonModal(false);
        }
        prevButtons.buttonA = Boolean(padInput.buttonA);
        prevButtons.buttonB = Boolean(padInput.buttonB || padInput.cancel);
        prevButtons.buttonX = Boolean(padInput.buttonX);
        prevButtons.buttonY = Boolean(padInput.buttonY);
        prevButtons.lb = Boolean(padInput.lb);
        prevButtons.rb = Boolean(padInput.rb);
        prevButtons.start = Boolean(padInput.start);
        prevButtons.select = Boolean(padInput.select);
        return;
      }

      // Edge triggers
      const edgeA = Boolean(padInput.buttonA && !prevButtons.buttonA);
      const edgeB = Boolean((padInput.buttonB || padInput.cancel) && !prevButtons.buttonB);
      const edgeX = Boolean(padInput.buttonX && !prevButtons.buttonX);
      const edgeY = Boolean(padInput.buttonY && !prevButtons.buttonY);
      const edgeLB = Boolean(padInput.lb && !prevButtons.lb);
      const edgeRB = Boolean(padInput.rb && !prevButtons.rb);
      const edgeStart = Boolean(padInput.start && !prevButtons.start);
      const edgeSelect = Boolean(padInput.select && !prevButtons.select);

      // Update prevButtons
      prevButtons.buttonA = Boolean(padInput.buttonA);
      prevButtons.buttonB = Boolean(padInput.buttonB || padInput.cancel);
      prevButtons.buttonX = Boolean(padInput.buttonX);
      prevButtons.buttonY = Boolean(padInput.buttonY);
      prevButtons.lb = Boolean(padInput.lb);
      prevButtons.rb = Boolean(padInput.rb);
      prevButtons.start = Boolean(padInput.start);
      prevButtons.select = Boolean(padInput.select);

      // Global Start button -> Start Battle!
      if (edgeStart) {
        handleTestDrive();
        return;
      }

      // LB / RB / Select -> Quick cycle palette materials
      if (edgeLB) {
        cyclePalette(-1);
      } else if (edgeRB || edgeSelect) {
        cyclePalette(1);
      }

      // Y button -> Toggle brush size
      if (edgeY) {
        toggleBrushSize();
      }

      // Directional movement with auto-repeat
      const hasDir = padInput.up || padInput.down || padInput.left || padInput.right;
      const dirChanged =
        padInput.up !== lastDir.up ||
        padInput.down !== lastDir.down ||
        padInput.left !== lastDir.left ||
        padInput.right !== lastDir.right;

      let shouldStep = false;
      if (hasDir) {
        if (dirChanged || lastDirMoveTime === 0) {
          shouldStep = true;
          lastDirMoveTime = now;
          isRepeatingDir = false;
        } else {
          const repeatThreshold = isRepeatingDir ? 80 : 220;
          if (now - lastDirMoveTime >= repeatThreshold) {
            shouldStep = true;
            lastDirMoveTime = now;
            isRepeatingDir = true;
          }
        }
      } else {
        lastDirMoveTime = 0;
        isRepeatingDir = false;
      }
      lastDir = {
        up: padInput.up,
        down: padInput.down,
        left: padInput.left,
        right: padInput.right,
      };

      if (activeZoneRef.current === 'grid') {
        // Direct Action: B button exits to menu
        if (edgeB) {
          onCancel();
          return;
        }

        const bSize = brushSizeRef.current;
        let nextC = cursorPosRef.current.c;
        let nextR = cursorPosRef.current.r;

        if (shouldStep) {
          if (padInput.up) nextR -= bSize;
          if (padInput.down) nextR += bSize;
          if (padInput.left) {
            if (nextC === 0) {
              // Move smoothly to toolbar
              setActiveZone('toolbar');
              setToolbarFocus({ row: 0, col: 0 });
              soundManager.playHitBrick();
              return;
            } else {
              nextC -= bSize;
            }
          }
          if (padInput.right) nextC += bSize;

          // Clamp within grid
          nextC = Math.max(0, Math.min(currentGridSize - bSize, nextC));
          nextR = Math.max(0, Math.min(currentGridSize - bSize, nextR));

          if (nextC !== cursorPosRef.current.c || nextR !== cursorPosRef.current.r) {
            setCursorPos({ c: nextC, r: nextR });
            // Holding A while moving continuously paints!
            if (padInput.buttonA) {
              paintAtCoords(nextC, nextR, selectedToolRef.current, bSize);
            } else if (padInput.buttonX) {
              paintAtCoords(nextC, nextR, TileType.EMPTY, bSize);
            }
          }
        }

        // Tap A -> Paint selected tool
        if (edgeA) {
          paintAtCoords(cursorPosRef.current.c, cursorPosRef.current.r, selectedToolRef.current, bSize);
          soundManager.playHitBrick();
        }

        // Tap X -> Erase tile
        if (edgeX) {
          paintAtCoords(cursorPosRef.current.c, cursorPosRef.current.r, TileType.EMPTY, bSize);
          soundManager.playHitBrick();
        }
      } else {
        // activeZone === 'toolbar'
        // B button returns to grid
        if (edgeB) {
          setActiveZone('grid');
          soundManager.playHitBrick();
          return;
        }

        let curRow = toolbarFocusRef.current.row;
        let curCol = toolbarFocusRef.current.col;

        if (shouldStep) {
          if (padInput.up) {
            curRow = Math.max(-1, curRow - 1);
            curCol = Math.min(curCol, getRowMaxCols(curRow) - 1);
            soundManager.playHitBrick();
          } else if (padInput.down) {
            curRow = Math.min(8, curRow + 1);
            curCol = Math.min(curCol, getRowMaxCols(curRow) - 1);
            soundManager.playHitBrick();
          } else if (padInput.left) {
            if (curCol > 0) {
              curCol -= 1;
              soundManager.playHitBrick();
            }
          } else if (padInput.right) {
            if (curCol < getRowMaxCols(curRow) - 1) {
              curCol += 1;
              soundManager.playHitBrick();
            } else {
              // Exiting right returns to grid!
              setActiveZone('grid');
              soundManager.playHitBrick();
              return;
            }
          }

          setToolbarFocus({ row: curRow, col: curCol });
        }

        // Press A in toolbar -> Activate focused item
        if (edgeA) {
          activateToolbarItem(curRow, curCol);
        }
      }
    };

    animId = requestAnimationFrame(poll);
    return () => cancelAnimationFrame(animId);
  }, [
    drawEditor,
    currentGridSize,
    onCancel,
    handleTestDrive,
    cyclePalette,
    toggleBrushSize,
    paintAtCoords,
    activateToolbarItem,
    getRowMaxCols,
  ]);

  // Keyboard navigation & shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (showJsonModalRef.current) {
        if (e.key === 'Escape') setShowJsonModal(false);
        return;
      }

      // Do not capture inputs if user is typing a map name
      if (document.activeElement && document.activeElement.tagName === 'INPUT') {
        return;
      }

      if (e.key === 'Escape') {
        if (activeZoneRef.current === 'toolbar') {
          setActiveZone('grid');
        } else {
          onCancel();
        }
        return;
      }

      if (e.key === 'Tab') {
        e.preventDefault();
        setActiveZone((prev) => (prev === 'grid' ? 'toolbar' : 'grid'));
        return;
      }

      // Quick numbers 1-7 for tile materials
      if (['1', '2', '3', '4', '5', '6', '7'].includes(e.key)) {
        const idx = parseInt(e.key, 10) - 1;
        if (idx >= 0 && idx < PALETTE_TOOLS.length) {
          setSelectedTool(PALETTE_TOOLS[idx]);
          soundManager.playHitBrick();
        }
        return;
      }

      if (e.key.toLowerCase() === 'b') {
        toggleBrushSize();
        return;
      }

      if (activeZoneRef.current === 'grid') {
        const bSize = brushSizeRef.current;
        let c = cursorPosRef.current.c;
        let r = cursorPosRef.current.r;

        if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') {
          r = Math.max(0, r - bSize);
        } else if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') {
          r = Math.min(currentGridSize - bSize, r + bSize);
        } else if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') {
          if (c === 0) {
            setActiveZone('toolbar');
            setToolbarFocus({ row: 0, col: 0 });
            return;
          }
          c = Math.max(0, c - bSize);
        } else if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
          c = Math.min(currentGridSize - bSize, c + bSize);
        } else if (e.key === ' ' || e.key === 'Enter') {
          paintAtCoords(c, r, selectedToolRef.current, bSize);
          soundManager.playHitBrick();
          return;
        } else if (e.key === 'Delete' || e.key === 'Backspace') {
          paintAtCoords(c, r, TileType.EMPTY, bSize);
          soundManager.playHitBrick();
          return;
        }

        setCursorPos({ c, r });
      } else {
        // Toolbar mode
        let curRow = toolbarFocusRef.current.row;
        let curCol = toolbarFocusRef.current.col;

        if (e.key === 'ArrowUp') {
          curRow = Math.max(-1, curRow - 1);
          curCol = Math.min(curCol, getRowMaxCols(curRow) - 1);
        } else if (e.key === 'ArrowDown') {
          curRow = Math.min(8, curRow + 1);
          curCol = Math.min(curCol, getRowMaxCols(curRow) - 1);
        } else if (e.key === 'ArrowLeft') {
          if (curCol > 0) curCol -= 1;
        } else if (e.key === 'ArrowRight') {
          if (curCol < getRowMaxCols(curRow) - 1) {
            curCol += 1;
          } else {
            setActiveZone('grid');
            return;
          }
        } else if (e.key === ' ' || e.key === 'Enter') {
          activateToolbarItem(curRow, curCol);
          return;
        }

        setToolbarFocus({ row: curRow, col: curCol });
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentGridSize, onCancel, toggleBrushSize, paintAtCoords, activateToolbarItem, getRowMaxCols]);

  // Focus style helper: zero layout shift, authentic retro gold ring
  const isFocus = (row: number, col: number) =>
    activeZone === 'toolbar' && toolbarFocus.row === row && toolbarFocus.col === col
      ? 'ring-2 ring-amber-400 shadow-[0_0_8px_rgba(245,158,11,0.7)]'
      : '';

  // Apply Imported JSON
  const handleApplyJson = () => {
    try {
      const parsed = JSON.parse(jsonText);
      if (!parsed.grid || !Array.isArray(parsed.grid) || parsed.grid.length !== GRID_SIZE) {
        throw new Error(`Invalid map format: grid must be 26x26 array.`);
      }
      setMapGrid(parsed.grid);
      if (parsed.name) setMapName(parsed.name);
      setShowJsonModal(false);
      soundManager.playPowerUpSpawn();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Invalid JSON format';
      setJsonError(msg);
    }
  };

  const handleCopyJson = () => {
    navigator.clipboard.writeText(jsonText).then(() => {
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    });
  };

  const handleDownloadJson = () => {
    const blob = new Blob([jsonText], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${mapName.toLowerCase().replace(/\s+/g, '_')}_map.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div id="construction-mode-container" className="flex flex-col items-center w-full max-w-4xl mx-auto font-pixel p-2 sm:p-4">
      {/* Master Harmonious Arcade Frame */}
      <div className="w-full bg-[#242424] border-4 border-[#484848] rounded-xl shadow-2xl p-3 sm:p-4 flex flex-col gap-3.5">
        {/* Editor Header */}
        <div className="w-full flex flex-wrap items-center justify-between gap-3 px-3 py-2 bg-[#181818] border-2 border-[#383838] rounded-lg text-xs text-white shadow-inner">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-amber-400" />
            <span className="text-amber-400 font-bold tracking-wide">CONSTRUCTION MODE</span>
          </div>

          <div className="flex-1 min-w-[200px] max-w-sm flex items-center">
            <input
              type="text"
              value={mapName}
              onChange={(e) => setMapName(e.target.value)}
              className="w-full bg-black text-amber-300 px-2.5 py-1.5 border border-zinc-700 rounded text-[10px] font-pixel focus:outline-none focus:border-amber-400"
              placeholder="Map Name"
            />
          </div>

          <div className="flex items-center gap-2">
            <button
              id="editor-export-btn"
              onClick={handleOpenExport}
              className={`flex items-center gap-1 bg-[#333333] hover:bg-[#444444] text-zinc-200 px-2.5 py-1.5 rounded border border-zinc-600 text-[9px] transition-colors cursor-pointer ${isFocus(
                -1,
                0
              )}`}
              title="Import or Export JSON"
            >
              <Download className="w-3 h-3" />
              <span>JSON</span>
            </button>
            <button
              id="editor-cancel-btn"
              onClick={onCancel}
              className={`flex items-center gap-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 px-2.5 py-1.5 rounded border border-zinc-600 text-[9px] transition-colors cursor-pointer ${isFocus(
                -1,
                1
              )}`}
            >
              <X className="w-3 h-3" />
              <span>CANCEL</span>
            </button>
            <button
              id="editor-start-battle-btn"
              onClick={handleTestDrive}
              className={`flex items-center gap-1.5 bg-green-600 hover:bg-green-500 text-white px-3.5 py-1.5 rounded border border-green-700 text-[10px] shadow-md transition-colors cursor-pointer ${isFocus(
                -1,
                2
              )}`}
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>START BATTLE</span>
            </button>
          </div>
        </div>

        {/* Main Workspace: Toolbar + Canvas */}
        <div className="w-full flex flex-col md:flex-row gap-3.5 items-start justify-center">
          {/* Left Toolbar: Tile Palette & Brush Size */}
          <div className="w-full md:w-52 flex flex-col gap-3 bg-[#181818] p-3 border-2 border-[#383838] rounded-lg shadow-inner text-[10px]">
            <div className="text-[9px] text-amber-400 font-bold uppercase tracking-wider">
              Tile Palette
            </div>

            {/* Palette buttons */}
            <div className="grid grid-cols-3 md:grid-cols-2 gap-2 w-full">
              {/* Brick */}
              <button
                id="tool-brick"
                onClick={() => {
                  setSelectedTool(TileType.BRICK);
                  setActiveZone('grid');
                }}
                className={`p-2 rounded border flex flex-col items-center gap-1.5 transition-all cursor-pointer ${
                  selectedTool === TileType.BRICK
                    ? 'bg-amber-950/60 border-amber-400 text-amber-300 shadow-[0_0_8px_rgba(245,158,11,0.25)]'
                    : 'bg-[#252525] border-[#383838] text-zinc-300 hover:bg-[#2e2e2e] hover:border-[#505050]'
                } ${isFocus(0, 0)}`}
              >
                <PixelTileIcon type={TileType.BRICK} size={28} />
                <span className="text-[8px] font-bold tracking-wider">BRICK</span>
              </button>

              {/* Steel */}
              <button
                id="tool-steel"
                onClick={() => {
                  setSelectedTool(TileType.STEEL);
                  setActiveZone('grid');
                }}
                className={`p-2 rounded border flex flex-col items-center gap-1.5 transition-all cursor-pointer ${
                  selectedTool === TileType.STEEL
                    ? 'bg-amber-950/60 border-amber-400 text-amber-300 shadow-[0_0_8px_rgba(245,158,11,0.25)]'
                    : 'bg-[#252525] border-[#383838] text-zinc-300 hover:bg-[#2e2e2e] hover:border-[#505050]'
                } ${isFocus(0, 1)}`}
              >
                <PixelTileIcon type={TileType.STEEL} size={28} />
                <span className="text-[8px] font-bold tracking-wider">STEEL</span>
              </button>

              {/* Water */}
              <button
                id="tool-water"
                onClick={() => {
                  setSelectedTool(TileType.WATER);
                  setActiveZone('grid');
                }}
                className={`p-2 rounded border flex flex-col items-center gap-1.5 transition-all cursor-pointer ${
                  selectedTool === TileType.WATER
                    ? 'bg-amber-950/60 border-amber-400 text-amber-300 shadow-[0_0_8px_rgba(245,158,11,0.25)]'
                    : 'bg-[#252525] border-[#383838] text-zinc-300 hover:bg-[#2e2e2e] hover:border-[#505050]'
                } ${isFocus(1, 0)}`}
              >
                <PixelTileIcon type={TileType.WATER} size={28} />
                <span className="text-[8px] font-bold tracking-wider">WATER</span>
              </button>

              {/* Trees */}
              <button
                id="tool-trees"
                onClick={() => {
                  setSelectedTool(TileType.TREES);
                  setActiveZone('grid');
                }}
                className={`p-2 rounded border flex flex-col items-center gap-1.5 transition-all cursor-pointer ${
                  selectedTool === TileType.TREES
                    ? 'bg-amber-950/60 border-amber-400 text-amber-300 shadow-[0_0_8px_rgba(245,158,11,0.25)]'
                    : 'bg-[#252525] border-[#383838] text-zinc-300 hover:bg-[#2e2e2e] hover:border-[#505050]'
                } ${isFocus(1, 1)}`}
              >
                <PixelTileIcon type={TileType.TREES} size={28} />
                <span className="text-[8px] font-bold tracking-wider">TREES</span>
              </button>

              {/* Ice */}
              <button
                id="tool-ice"
                onClick={() => {
                  setSelectedTool(TileType.ICE);
                  setActiveZone('grid');
                }}
                className={`p-2 rounded border flex flex-col items-center gap-1.5 transition-all cursor-pointer ${
                  selectedTool === TileType.ICE
                    ? 'bg-amber-950/60 border-amber-400 text-amber-300 shadow-[0_0_8px_rgba(245,158,11,0.25)]'
                    : 'bg-[#252525] border-[#383838] text-zinc-300 hover:bg-[#2e2e2e] hover:border-[#505050]'
                } ${isFocus(2, 0)}`}
              >
                <PixelTileIcon type={TileType.ICE} size={28} />
                <span className="text-[8px] font-bold tracking-wider">ICE</span>
              </button>

              {/* Mud */}
              <button
                id="tool-mud"
                onClick={() => {
                  setSelectedTool(TileType.MUD);
                  setActiveZone('grid');
                }}
                className={`p-2 rounded border flex flex-col items-center gap-1.5 transition-all cursor-pointer ${
                  selectedTool === TileType.MUD
                    ? 'bg-amber-950/60 border-amber-400 text-amber-300 shadow-[0_0_8px_rgba(245,158,11,0.25)]'
                    : 'bg-[#252525] border-[#383838] text-zinc-300 hover:bg-[#2e2e2e] hover:border-[#505050]'
                } ${isFocus(2, 1)}`}
              >
                <PixelTileIcon type={TileType.MUD} size={28} />
                <span className="text-[8px] font-bold tracking-wider">MUD</span>
              </button>

              {/* Eraser */}
              <button
                id="tool-eraser"
                onClick={() => {
                  setSelectedTool(TileType.EMPTY);
                  setActiveZone('grid');
                }}
                className={`col-span-2 p-2 rounded border flex items-center justify-center gap-2 transition-all cursor-pointer ${
                  selectedTool === TileType.EMPTY
                    ? 'bg-red-950/60 border-red-400 text-red-300 shadow-[0_0_8px_rgba(239,68,68,0.25)]'
                    : 'bg-[#252525] border-[#383838] text-zinc-300 hover:bg-[#2e2e2e] hover:border-[#505050]'
                } ${isFocus(3, 0)}`}
              >
                <PixelTileIcon type="ERASE" size={20} />
                <span className="text-[8px] font-bold tracking-wider">ERASE</span>
              </button>
            </div>

            {/* Brush Size */}
            <div className="pt-2.5 border-t border-[#303030] flex flex-col gap-1.5 w-full">
              <span className="text-[8px] text-zinc-400 uppercase font-bold tracking-wider">Brush Size</span>
              <div className="flex gap-2">
                <button
                  id="brush-1x1"
                  onClick={() => {
                    setBrushSize(1);
                    setActiveZone('grid');
                  }}
                  className={`flex-1 py-1.5 rounded border text-[8px] font-bold transition-all cursor-pointer ${
                    brushSize === 1
                      ? 'bg-amber-600 border-amber-300 text-white shadow-sm'
                      : 'bg-[#252525] border-[#383838] text-zinc-300 hover:bg-[#2e2e2e]'
                  } ${isFocus(4, 0)}`}
                >
                  16px Sub
                </button>
                <button
                  id="brush-2x2"
                  onClick={() => {
                    setBrushSize(2);
                    setActiveZone('grid');
                  }}
                  className={`flex-1 py-1.5 rounded border text-[8px] font-bold transition-all cursor-pointer ${
                    brushSize === 2
                      ? 'bg-amber-600 border-amber-300 text-white shadow-sm'
                      : 'bg-[#252525] border-[#383838] text-zinc-300 hover:bg-[#2e2e2e]'
                  } ${isFocus(4, 1)}`}
                >
                  32px Block
                </button>
              </div>
            </div>

            {/* Quick Presets & Handcrafted Stages */}
            <div className="pt-2.5 border-t border-[#303030] flex flex-col gap-2 w-full">
              <div className="flex items-center justify-between">
                <span className="text-[9px] text-amber-400 uppercase font-bold tracking-wider">
                  STAGE PRESETS
                </span>
                <span className="text-[8px] text-zinc-400 font-sans">10 Maps</span>
              </div>

              {/* Row 1: Stepper + Custom Styled Dropdown */}
              <div className="flex items-center gap-1 w-full">
                <button
                  type="button"
                  id="preset-prev-btn"
                  onClick={handlePrevPreset}
                  className={`p-1.5 rounded bg-[#252525] hover:bg-[#323232] text-amber-400 hover:text-amber-300 border border-[#383838] hover:border-amber-400/60 transition-colors shrink-0 shadow-sm cursor-pointer ${isFocus(
                    5,
                    0
                  )}`}
                  title="Previous Preset"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                </button>

                <div className="relative flex-1 min-w-0">
                  <select
                    id="preset-select-dropdown"
                    value={activePresetKey}
                    onChange={(e) => loadPreset(e.target.value as keyof typeof PRESET_MAPS)}
                    className={`w-full bg-[#161616] text-amber-300 border border-[#383838] hover:border-amber-400/80 focus:border-amber-400 rounded px-2 py-1.5 text-[10px] font-sans font-bold cursor-pointer focus:outline-none transition-colors appearance-none pr-6 truncate shadow-inner ${isFocus(
                      5,
                      1
                    )}`}
                  >
                    <optgroup label="Handcrafted Stages (1-10)" className="bg-[#202020] text-amber-300 font-sans">
                      {STAGE_PRESETS_LIST.map((s) => (
                        <option key={s.key} value={s.key}>
                          {s.label}
                        </option>
                      ))}
                    </optgroup>
                    <optgroup label="Special Presets" className="bg-[#202020] text-zinc-300 font-sans">
                      <option value="tacticalMaze">Tactical Maze (FFA)</option>
                      <option value="cleanSlate">Clean Slate (Empty)</option>
                    </optgroup>
                  </select>
                  <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-1.5 text-amber-400">
                    <ChevronDown className="w-3.5 h-3.5" />
                  </div>
                </div>

                <button
                  type="button"
                  id="preset-next-btn"
                  onClick={handleNextPreset}
                  className={`p-1.5 rounded bg-[#252525] hover:bg-[#323232] text-amber-400 hover:text-amber-300 border border-[#383838] hover:border-amber-400/60 transition-colors shrink-0 shadow-sm cursor-pointer ${isFocus(
                    5,
                    2
                  )}`}
                  title="Next Preset"
                >
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Row 2 & 3: 10 Tactical Stage Number Chips (1 to 10) */}
              <div className="flex flex-col gap-1 w-full">
                <div className="grid grid-cols-5 gap-1 w-full">
                  {STAGE_PRESETS_LIST.slice(0, 5).map((s, idx) => {
                    const isSelected = activePresetKey === s.key;
                    return (
                      <button
                        key={s.key}
                        id={`chip-stage-${s.num}`}
                        type="button"
                        onClick={() => loadPreset(s.key)}
                        className={`py-1 rounded text-[9px] font-pixel transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-amber-600 border border-amber-300 text-white font-bold shadow-[0_0_6px_rgba(245,158,11,0.4)] ring-1 ring-amber-400'
                            : 'bg-[#222222] border border-[#383838] text-zinc-400 hover:text-white hover:bg-[#2d2d2d] hover:border-[#555555]'
                        } ${isFocus(6, idx)}`}
                        title={s.label}
                      >
                        {s.num}
                      </button>
                    );
                  })}
                </div>
                <div className="grid grid-cols-5 gap-1 w-full">
                  {STAGE_PRESETS_LIST.slice(5, 10).map((s, idx) => {
                    const isSelected = activePresetKey === s.key;
                    return (
                      <button
                        key={s.key}
                        id={`chip-stage-${s.num}`}
                        type="button"
                        onClick={() => loadPreset(s.key)}
                        className={`py-1 rounded text-[9px] font-pixel transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-amber-600 border border-amber-300 text-white font-bold shadow-[0_0_6px_rgba(245,158,11,0.4)] ring-1 ring-amber-400'
                            : 'bg-[#222222] border border-[#383838] text-zinc-400 hover:text-white hover:bg-[#2d2d2d] hover:border-[#555555]'
                        } ${isFocus(7, idx)}`}
                        title={s.label}
                      >
                        {s.num}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Row 4: Utility Presets: Tactical FFA & Clear Grid */}
              <div className="grid grid-cols-2 gap-1.5 w-full pt-0.5">
                <button
                  type="button"
                  id="btn-load-ffa"
                  onClick={() => loadPreset('tacticalMaze')}
                  className={`py-1 px-1 rounded border text-[9px] font-sans font-bold transition-all truncate cursor-pointer ${
                    activePresetKey === 'tacticalMaze'
                      ? 'bg-cyan-950/70 border-cyan-400 text-cyan-200 shadow-sm ring-1 ring-cyan-400'
                      : 'bg-[#222222] border-[#383838] text-zinc-300 hover:text-white hover:bg-[#2d2d2d]'
                  } ${isFocus(8, 0)}`}
                  title="Tactical Maze (FFA)"
                >
                  FFA MAZE
                </button>
                <button
                  type="button"
                  id="btn-load-clean"
                  onClick={() => loadPreset('cleanSlate')}
                  className={`py-1 px-1 rounded border text-[9px] font-sans font-bold transition-all truncate cursor-pointer ${
                    activePresetKey === 'cleanSlate'
                      ? 'bg-red-950/70 border-red-400 text-red-200 shadow-sm ring-1 ring-red-400'
                      : 'bg-[#222222] border-[#383838] text-red-300/80 hover:text-red-200 hover:bg-[#2d2d2d]'
                  } ${isFocus(8, 1)}`}
                  title="Clear Canvas"
                >
                  CLEAR GRID
                </button>
              </div>
            </div>
          </div>

          {/* Center: Editor Canvas with Drag/Draw */}
          <div className="flex-1 bg-[#181818] p-3 border-2 border-[#383838] rounded-lg shadow-inner flex flex-col items-center">
            <div className="bg-black p-1 rounded border-2 border-black shadow-2xl">
              <canvas
                ref={canvasRef}
                id="editor-canvas"
                width={currentCanvasSize}
                height={currentCanvasSize}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
                onTouchStart={(e) => {
                  setIsDrawing(true);
                  applyBrush(e);
                }}
                onTouchMove={applyBrush}
                onTouchEnd={() => setIsDrawing(false)}
                className="pixelated cursor-crosshair block aspect-square w-[300px] h-[300px] xs:w-[360px] xs:h-[360px] sm:w-[416px] sm:h-[416px] md:w-[480px] md:h-[480px] border border-zinc-900 shadow-inner"
              />
            </div>

            <div className="w-full flex flex-wrap items-center justify-between text-[8px] text-zinc-400 mt-2.5 px-1 font-pixel gap-2">
              <div className="flex items-center gap-1.5">
                <span className="inline-block w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
                {hasGamepad ? (
                  <span className="text-amber-300 font-bold tracking-wide">
                    🎮 [D-PAD] MOVE • [A] DRAW • [X] ERASE • [LB/RB] TILE • [Y] BRUSH • [START] PLAY • [B] CANCEL
                  </span>
                ) : (
                  <span>
                    MOUSE: DRAG • [ARROWS] MOVE • [SPACE] DRAW • [DEL] ERASE • [1-7] TILE • [B] BRUSH
                  </span>
                )}
              </div>
              <span className="text-amber-400 font-bold tracking-wider">BASE EAGLE PROTECTED</span>
            </div>
          </div>
        </div>
      </div>

      {/* JSON Import/Export Modal */}
      {showJsonModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
          <div className="bg-[#303030] border-4 border-[#606060] p-4 max-w-lg w-full rounded shadow-2xl text-xs font-pixel text-zinc-100 flex flex-col gap-3">
            <div className="flex items-center justify-between pb-2 border-b border-zinc-600">
              <span className="text-amber-400 font-bold">MAP JSON DATA</span>
              <button
                onClick={() => setShowJsonModal(false)}
                className="text-zinc-400 hover:text-white p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-[9px] text-zinc-300">
              Copy your map data to share, or paste custom map JSON below and click Apply:
            </p>

            <textarea
              value={jsonText}
              onChange={(e) => setJsonText(e.target.value)}
              rows={12}
              className="w-full bg-black text-green-400 p-2 font-mono text-[9px] border border-zinc-700 rounded focus:outline-none focus:border-amber-400 select-all"
            />

            {jsonError && (
              <div className="text-red-400 text-[8px] bg-red-950/60 p-1.5 border border-red-800 rounded">
                {jsonError}
              </div>
            )}

            <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-zinc-600">
              <div className="flex gap-2">
                <button
                  onClick={handleCopyJson}
                  className="flex items-center gap-1 bg-[#484848] hover:bg-[#585858] text-zinc-200 px-3 py-1.5 rounded border border-zinc-600 text-[9px]"
                >
                  {copySuccess ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copySuccess ? 'COPIED!' : 'COPY'}</span>
                </button>
                <button
                  onClick={handleDownloadJson}
                  className="flex items-center gap-1 bg-[#484848] hover:bg-[#585858] text-zinc-200 px-3 py-1.5 rounded border border-zinc-600 text-[9px]"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>DOWNLOAD</span>
                </button>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={handleApplyJson}
                  className="bg-amber-600 hover:bg-amber-500 text-white px-4 py-1.5 rounded border border-amber-400 text-[10px]"
                >
                  APPLY MAP
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
