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
} from 'lucide-react';
import { soundManager } from '../engine/SoundManager';

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

export const MapEditorToolbar: React.FC<MapEditorProps> = ({
  initialMap,
  onStartBattle,
  onCancel,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const [mapGrid, setMapGrid] = useState<number[][]>(() => {
    return initialMap ? cloneGrid(initialMap.grid) : cloneGrid(PRESET_MAPS.stage1.grid);
  });
  const [mapName, setMapName] = useState<string>(initialMap?.name || 'Custom Arena');
  const [selectedTool, setSelectedTool] = useState<TileType>(TileType.BRICK);
  const [brushSize, setBrushSize] = useState<1 | 2>(2); // 1 = 16x16 sub-tile, 2 = 32x32 NES block
  const [isDrawing, setIsDrawing] = useState<boolean>(false);

  // JSON Import/Export Modal
  const [showJsonModal, setShowJsonModal] = useState<boolean>(false);
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
    // Top-left, top-center, top-right enemy spawns
    ctx.save();
    ctx.strokeStyle = '#e82020';
    ctx.lineWidth = 1;
    ctx.setLineDash([2, 2]);
    ctx.strokeRect(0, 0, 32, 32);
    ctx.strokeRect(baseX, 0, 32, 32);
    ctx.strokeRect((currentGridSize - 2) * BLOCK_SIZE, 0, 32, 32);

    // Player spawn: (baseC - 4) * BLOCK_SIZE, baseY
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
  }, [mapGrid, currentGridSize, currentCanvasSize, baseX, baseY, baseC]);

  useEffect(() => {
    drawEditor();
  }, [drawEditor]);

  // Handle Paint / Erase on Grid
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

    // Do not overwrite the Base Eagle (baseR..baseR+1, baseC..baseC+1)
    const isBaseEagle = (subRow === baseR || subRow === baseR + 1) && (subCol === baseC || subCol === baseC + 1);
    if (isBaseEagle) return;

    setMapGrid((prev) => {
      const next = cloneGrid(prev);
      const size = brushSize; // 1 or 2

      for (let r = subRow; r < subRow + size; r++) {
        for (let c = subCol; c < subCol + size; c++) {
          if (r < currentGridSize && c < currentGridSize) {
            // Keep eagle protected
            if ((r === baseR || r === baseR + 1) && (c === baseC || c === baseC + 1)) continue;
            next[r][c] = selectedTool;
          }
        }
      }
      return next;
    });
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

  // Presets Loader
  const loadPreset = (presetKey: keyof typeof PRESET_MAPS) => {
    soundManager.playHitBrick();
    const preset = PRESET_MAPS[presetKey];
    setMapGrid(cloneGrid(preset.grid));
    setMapName(preset.name);
  };

  // Open Export Modal
  const handleOpenExport = () => {
    const payload: StageMap = {
      name: mapName,
      grid: mapGrid,
    };
    setJsonText(JSON.stringify(payload, null, 2));
    setJsonError(null);
    setCopySuccess(false);
    setShowJsonModal(true);
  };

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

  const handleTestDrive = () => {
    soundManager.playPowerUpCollect();
    onStartBattle({
      name: mapName,
      grid: mapGrid,
    });
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
              className="flex items-center gap-1 bg-[#333333] hover:bg-[#444444] text-zinc-200 px-2.5 py-1.5 rounded border border-zinc-600 text-[9px] transition-colors"
              title="Import or Export JSON"
            >
              <Download className="w-3 h-3" />
              <span>JSON</span>
            </button>
            <button
              id="editor-cancel-btn"
              onClick={onCancel}
              className="flex items-center gap-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 px-2.5 py-1.5 rounded border border-zinc-600 text-[9px] transition-colors"
            >
              <X className="w-3 h-3" />
              <span>CANCEL</span>
            </button>
            <button
              id="editor-start-battle-btn"
              onClick={handleTestDrive}
              className="flex items-center gap-1.5 bg-green-600 hover:bg-green-500 text-white px-3.5 py-1.5 rounded border border-green-700 text-[10px] shadow-md transition-colors"
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
                onClick={() => setSelectedTool(TileType.BRICK)}
                className={`p-2 rounded border flex flex-col items-center gap-1.5 transition-all ${
                  selectedTool === TileType.BRICK
                    ? 'bg-amber-950/60 border-amber-400 text-amber-300 shadow-[0_0_8px_rgba(245,158,11,0.25)]'
                    : 'bg-[#252525] border-[#383838] text-zinc-300 hover:bg-[#2e2e2e] hover:border-[#505050]'
                }`}
              >
                <PixelTileIcon type={TileType.BRICK} size={28} />
                <span className="text-[8px] font-bold tracking-wider">BRICK</span>
              </button>

              {/* Steel */}
              <button
                id="tool-steel"
                onClick={() => setSelectedTool(TileType.STEEL)}
                className={`p-2 rounded border flex flex-col items-center gap-1.5 transition-all ${
                  selectedTool === TileType.STEEL
                    ? 'bg-amber-950/60 border-amber-400 text-amber-300 shadow-[0_0_8px_rgba(245,158,11,0.25)]'
                    : 'bg-[#252525] border-[#383838] text-zinc-300 hover:bg-[#2e2e2e] hover:border-[#505050]'
                }`}
              >
                <PixelTileIcon type={TileType.STEEL} size={28} />
                <span className="text-[8px] font-bold tracking-wider">STEEL</span>
              </button>

              {/* Water */}
              <button
                id="tool-water"
                onClick={() => setSelectedTool(TileType.WATER)}
                className={`p-2 rounded border flex flex-col items-center gap-1.5 transition-all ${
                  selectedTool === TileType.WATER
                    ? 'bg-amber-950/60 border-amber-400 text-amber-300 shadow-[0_0_8px_rgba(245,158,11,0.25)]'
                    : 'bg-[#252525] border-[#383838] text-zinc-300 hover:bg-[#2e2e2e] hover:border-[#505050]'
                }`}
              >
                <PixelTileIcon type={TileType.WATER} size={28} />
                <span className="text-[8px] font-bold tracking-wider">WATER</span>
              </button>

              {/* Trees */}
              <button
                id="tool-trees"
                onClick={() => setSelectedTool(TileType.TREES)}
                className={`p-2 rounded border flex flex-col items-center gap-1.5 transition-all ${
                  selectedTool === TileType.TREES
                    ? 'bg-amber-950/60 border-amber-400 text-amber-300 shadow-[0_0_8px_rgba(245,158,11,0.25)]'
                    : 'bg-[#252525] border-[#383838] text-zinc-300 hover:bg-[#2e2e2e] hover:border-[#505050]'
                }`}
              >
                <PixelTileIcon type={TileType.TREES} size={28} />
                <span className="text-[8px] font-bold tracking-wider">TREES</span>
              </button>

              {/* Ice */}
              <button
                id="tool-ice"
                onClick={() => setSelectedTool(TileType.ICE)}
                className={`p-2 rounded border flex flex-col items-center gap-1.5 transition-all ${
                  selectedTool === TileType.ICE
                    ? 'bg-amber-950/60 border-amber-400 text-amber-300 shadow-[0_0_8px_rgba(245,158,11,0.25)]'
                    : 'bg-[#252525] border-[#383838] text-zinc-300 hover:bg-[#2e2e2e] hover:border-[#505050]'
                }`}
              >
                <PixelTileIcon type={TileType.ICE} size={28} />
                <span className="text-[8px] font-bold tracking-wider">ICE</span>
              </button>

              {/* Mud */}
              <button
                id="tool-mud"
                onClick={() => setSelectedTool(TileType.MUD)}
                className={`p-2 rounded border flex flex-col items-center gap-1.5 transition-all ${
                  selectedTool === TileType.MUD
                    ? 'bg-amber-950/60 border-amber-400 text-amber-300 shadow-[0_0_8px_rgba(245,158,11,0.25)]'
                    : 'bg-[#252525] border-[#383838] text-zinc-300 hover:bg-[#2e2e2e] hover:border-[#505050]'
                }`}
              >
                <PixelTileIcon type={TileType.MUD} size={28} />
                <span className="text-[8px] font-bold tracking-wider">MUD</span>
              </button>

              {/* Eraser */}
              <button
                id="tool-eraser"
                onClick={() => setSelectedTool(TileType.EMPTY)}
                className={`col-span-2 p-2 rounded border flex items-center justify-center gap-2 transition-all ${
                  selectedTool === TileType.EMPTY
                    ? 'bg-red-950/60 border-red-400 text-red-300 shadow-[0_0_8px_rgba(239,68,68,0.25)]'
                    : 'bg-[#252525] border-[#383838] text-zinc-300 hover:bg-[#2e2e2e] hover:border-[#505050]'
                }`}
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
                  onClick={() => setBrushSize(1)}
                  className={`flex-1 py-1.5 rounded border text-[8px] font-bold transition-all ${
                    brushSize === 1
                      ? 'bg-amber-600 border-amber-300 text-white shadow-sm'
                      : 'bg-[#252525] border-[#383838] text-zinc-300 hover:bg-[#2e2e2e]'
                  }`}
                >
                  16px Sub
                </button>
                <button
                  id="brush-2x2"
                  onClick={() => setBrushSize(2)}
                  className={`flex-1 py-1.5 rounded border text-[8px] font-bold transition-all ${
                    brushSize === 2
                      ? 'bg-amber-600 border-amber-300 text-white shadow-sm'
                      : 'bg-[#252525] border-[#383838] text-zinc-300 hover:bg-[#2e2e2e]'
                  }`}
                >
                  32px Block
                </button>
              </div>
            </div>

            {/* Quick Presets */}
            <div className="pt-2.5 border-t border-[#303030] flex flex-col gap-1.5 w-full">
              <span className="text-[8px] text-zinc-400 uppercase font-bold tracking-wider">Presets</span>
              <button
                id="preset-stage1"
                onClick={() => loadPreset('stage1')}
                className="w-full text-left px-2.5 py-1.5 rounded bg-[#252525] hover:bg-[#303030] text-zinc-200 text-[8px] border border-[#303030] hover:border-[#444] transition-colors"
              >
                Stage 1 Default
              </button>
              <button
                id="preset-iron"
                onClick={() => loadPreset('ironFortress')}
                className="w-full text-left px-2.5 py-1.5 rounded bg-[#252525] hover:bg-[#303030] text-zinc-200 text-[8px] border border-[#303030] hover:border-[#444] transition-colors"
              >
                Iron Fortress
              </button>
              <button
                id="preset-river"
                onClick={() => loadPreset('riverCrossing')}
                className="w-full text-left px-2.5 py-1.5 rounded bg-[#252525] hover:bg-[#303030] text-zinc-200 text-[8px] border border-[#303030] hover:border-[#444] transition-colors"
              >
                River Crossing
              </button>
              <button
                id="preset-clean"
                onClick={() => loadPreset('cleanSlate')}
                className="w-full text-left px-2.5 py-1.5 rounded bg-[#252525] hover:bg-[#303030] text-zinc-200 text-[8px] border border-[#303030] hover:border-[#444] transition-colors"
              >
                Clean Slate
              </button>
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

            <div className="w-full flex items-center justify-between text-[8px] text-zinc-400 mt-2.5 px-1 font-pixel">
              <span className="flex items-center gap-1.5">
                <span className="inline-block w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
                DRAW: CLICK & DRAG
              </span>
              <span className="text-amber-400 font-bold">BASE EAGLE PROTECTED</span>
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
