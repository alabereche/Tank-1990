/**
 * Battle City 1990 - Settings Modal
 * Configures Battlefield Map Size (Classic 26x26, Large 34x34, Giant 42x42),
 * Player Tank Speed, Fullscreen toggle, CRT Scanlines, and Audio.
 */

import React, { useState, useEffect, useRef } from 'react';
import { GameSettings, MapSizePreset, WindowScalePreset } from '../types';
import { MAP_SIZE_CONFIGS } from '../engine/maps';
import { soundManager } from '../engine/SoundManager';
import { gamepadManager } from '../engine/GamepadManager';
import { toggleFullscreen, isFullscreen, onFullscreenChange } from '../utils/fullscreen';
import {
  Settings,
  Maximize2,
  Minimize2,
  Tv,
  Volume2,
  VolumeX,
  Check,
  X,
  MapPin,
  Sparkles,
  Scaling,
} from 'lucide-react';

interface SettingsModalProps {
  settings: GameSettings;
  onUpdateSettings: (newSettings: GameSettings) => void;
  onClose: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  settings,
  onUpdateSettings,
  onClose,
}) => {
  const [currentFullscreen, setCurrentFullscreen] = useState<boolean>(isFullscreen());
  // Focus index:
  // 0, 1, 2: Map Size (Classic, Large, Giant)
  // 3, 4, 5: Window Scale (Standard, Large, Max)
  // 6, 7, 8: Display & Audio (Fullscreen, Scanlines, Sound)
  // 9: CONFIRM button
  const [focusIndex, setFocusIndex] = useState<number>(0);

  const focusIndexRef = useRef(focusIndex);
  focusIndexRef.current = focusIndex;

  const settingsRef = useRef(settings);
  settingsRef.current = settings;

  const onUpdateSettingsRef = useRef(onUpdateSettings);
  onUpdateSettingsRef.current = onUpdateSettings;

  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    const unsub = onFullscreenChange((active) => {
      setCurrentFullscreen(active);
    });
    return unsub;
  }, []);

  const handleSelectMapSize = (preset: MapSizePreset) => {
    soundManager.unlockAudio();
    soundManager.playHitSteel();
    onUpdateSettingsRef.current({
      ...settingsRef.current,
      mapSize: preset,
    });
  };

  const handleToggleScanlines = () => {
    soundManager.unlockAudio();
    soundManager.playHitSteel();
    onUpdateSettingsRef.current({
      ...settingsRef.current,
      showScanlines: !settingsRef.current.showScanlines,
    });
  };

  const handleSelectWindowScale = (scale: WindowScalePreset) => {
    soundManager.unlockAudio();
    soundManager.playHitSteel();
    onUpdateSettingsRef.current({
      ...settingsRef.current,
      windowScale: scale,
    });
  };

  const handleToggleSound = () => {
    soundManager.unlockAudio();
    const nextMuted = soundManager.toggleMute();
    onUpdateSettingsRef.current({
      ...settingsRef.current,
      soundEnabled: !nextMuted,
    });
  };

  const handleToggleFullscreen = async () => {
    soundManager.unlockAudio();
    soundManager.playPowerUpCollect();
    await toggleFullscreen();
    setCurrentFullscreen(isFullscreen());
  };

  const handleSelectMapSizeRef = useRef(handleSelectMapSize);
  handleSelectMapSizeRef.current = handleSelectMapSize;

  const handleToggleScanlinesRef = useRef(handleToggleScanlines);
  handleToggleScanlinesRef.current = handleToggleScanlines;

  const handleSelectWindowScaleRef = useRef(handleSelectWindowScale);
  handleSelectWindowScaleRef.current = handleSelectWindowScale;

  const handleToggleSoundRef = useRef(handleToggleSound);
  handleToggleSoundRef.current = handleToggleSound;

  const handleToggleFullscreenRef = useRef(handleToggleFullscreen);
  handleToggleFullscreenRef.current = handleToggleFullscreen;

  // Execute currently focused item
  const activateFocusedItem = (idx: number) => {
    switch (idx) {
      case 0:
        handleSelectMapSizeRef.current('classic');
        break;
      case 1:
        handleSelectMapSizeRef.current('large');
        break;
      case 2:
        handleSelectMapSizeRef.current('giant');
        break;
      case 3:
        handleSelectWindowScaleRef.current('standard');
        break;
      case 4:
        handleSelectWindowScaleRef.current('large');
        break;
      case 5:
        handleSelectWindowScaleRef.current('max');
        break;
      case 6:
        handleToggleFullscreenRef.current();
        break;
      case 7:
        handleToggleScanlinesRef.current();
        break;
      case 8:
        handleToggleSoundRef.current();
        break;
      case 9:
        soundManager.playMenuSelect();
        onCloseRef.current();
        break;
    }
  };

  const activateFocusedItemRef = useRef(activateFocusedItem);
  activateFocusedItemRef.current = activateFocusedItem;

  // Gamepad & Keyboard Navigation Loop
  useEffect(() => {
    let animId: number;
    let prevUp = false;
    let prevDown = false;
    let prevLeft = false;
    let prevRight = false;
    let prevConfirm = false;
    let prevCancel = false;
    let prevStart = false;
    let holdTimer = 0;
    let heldDirection: 'up' | 'down' | 'left' | 'right' | null = null;

    const INITIAL_HOLD_DELAY = 450;
    const REPEAT_RATE = 250;

    const moveFocus = (dir: 'up' | 'down' | 'left' | 'right') => {
      soundManager.playMenuMove();
      setFocusIndex((prev) => {
        if (dir === 'left') {
          if (prev >= 0 && prev <= 2) return prev > 0 ? prev - 1 : 2;
          if (prev >= 3 && prev <= 5) return prev > 3 ? prev - 1 : 5;
          if (prev >= 6 && prev <= 8) return prev > 6 ? prev - 1 : 8;
          return prev;
        }
        if (dir === 'right') {
          if (prev >= 0 && prev <= 2) return prev < 2 ? prev + 1 : 0;
          if (prev >= 3 && prev <= 5) return prev < 5 ? prev + 1 : 3;
          if (prev >= 6 && prev <= 8) return prev < 8 ? prev + 1 : 6;
          return prev;
        }
        if (dir === 'up') {
          if (prev >= 0 && prev <= 2) return 9; // wrap to confirm button
          if (prev >= 3 && prev <= 5) return prev - 3;
          if (prev >= 6 && prev <= 8) return prev - 3;
          if (prev === 9) return 7; // up from confirm goes to middle of row 2
        }
        if (dir === 'down') {
          if (prev >= 0 && prev <= 2) return prev + 3;
          if (prev >= 3 && prev <= 5) return prev + 3;
          if (prev >= 6 && prev <= 8) return 9; // down from row 2 goes to confirm
          if (prev === 9) return 1; // wrap to middle of row 0
        }
        return prev;
      });
    };

    let initialized = false;
    let initialCooldownUntil = 0;

    const poll = (time: number) => {
      const pad = gamepadManager.pollMenuInput();
      if (pad) {
        if (pad.anyButton) {
          soundManager.unlockAudio();
        }

        // On mount, absorb initial button hold (e.g. A or Start pressed to open settings)
        if (!initialized) {
          initialized = true;
          initialCooldownUntil = time + 220;
          prevConfirm = pad.confirm;
          prevCancel = pad.cancel;
          prevStart = pad.start;
          prevUp = pad.up;
          prevDown = pad.down;
          prevLeft = pad.left;
          prevRight = pad.right;
          animId = requestAnimationFrame(poll);
          return;
        }

        const isUp = pad.up;
        const isDown = pad.down;
        const isLeft = pad.left;
        const isRight = pad.right;

        // Fresh press: Left
        if (isLeft && !prevLeft) {
          heldDirection = 'left';
          holdTimer = time + INITIAL_HOLD_DELAY;
          moveFocus('left');
        } else if (isRight && !prevRight) {
          heldDirection = 'right';
          holdTimer = time + INITIAL_HOLD_DELAY;
          moveFocus('right');
        } else if (isUp && !prevUp) {
          heldDirection = 'up';
          holdTimer = time + INITIAL_HOLD_DELAY;
          moveFocus('up');
        } else if (isDown && !prevDown) {
          heldDirection = 'down';
          holdTimer = time + INITIAL_HOLD_DELAY;
          moveFocus('down');
        } else if (heldDirection && ((heldDirection === 'left' && isLeft) || (heldDirection === 'right' && isRight) || (heldDirection === 'up' && isUp) || (heldDirection === 'down' && isDown))) {
          if (time >= holdTimer) {
            holdTimer = time + REPEAT_RATE;
            moveFocus(heldDirection);
          }
        } else if (!isUp && !isDown && !isLeft && !isRight) {
          heldDirection = null;
          holdTimer = 0;
        }

        prevUp = isUp;
        prevDown = isDown;
        prevLeft = isLeft;
        prevRight = isRight;

        // Confirm: Button 0 (A) or Button 2 (X)
        const confirmPressed = pad.confirm;
        const confirmTrigger = confirmPressed && !prevConfirm;
        prevConfirm = confirmPressed;

        if (confirmTrigger && time >= initialCooldownUntil) {
          activateFocusedItemRef.current(focusIndexRef.current);
        }

        // Start: Button 9 confirms and closes
        const startPressed = pad.start;
        const startTrigger = startPressed && !prevStart;
        prevStart = startPressed;

        if (startTrigger && time >= initialCooldownUntil) {
          soundManager.playMenuSelect();
          onCloseRef.current();
        }

        // Cancel: Button 1 (B) closes settings
        const cancelPressed = pad.cancel;
        const cancelTrigger = cancelPressed && !prevCancel;
        prevCancel = cancelPressed;

        if (cancelTrigger && time >= initialCooldownUntil) {
          soundManager.playMenuMove();
          onCloseRef.current();
        }
      } else {
        prevUp = false;
        prevDown = false;
        prevLeft = false;
        prevRight = false;
        heldDirection = null;
        prevConfirm = false;
        prevCancel = false;
        prevStart = false;
      }

      animId = requestAnimationFrame(poll);
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (e.stopImmediatePropagation) {
        e.stopImmediatePropagation();
      }

      if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') {
        moveFocus('left');
      } else if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
        moveFocus('right');
      } else if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') {
        moveFocus('up');
      } else if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') {
        moveFocus('down');
      } else if (e.key === 'Enter' || e.key === ' ') {
        activateFocusedItemRef.current(focusIndexRef.current);
      } else if (e.key === 'Escape') {
        soundManager.playMenuMove();
        onCloseRef.current();
      }
    };

    window.addEventListener('keydown', handleKeyDown, { capture: true });
    animId = requestAnimationFrame(poll);

    return () => {
      window.removeEventListener('keydown', handleKeyDown, { capture: true });
      cancelAnimationFrame(animId);
    };
  }, []);

  return (
    <div
      id="settings-modal-overlay"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm p-4 animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        id="settings-modal-content"
        className="relative w-full max-w-xl bg-[#252525] border-4 border-[#505050] text-white font-pixel p-5 sm:p-6 shadow-2xl rounded-sm"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b-2 border-[#404040] pb-3 mb-4">
          <div className="flex items-center gap-2 text-[#f8b800]">
            <Settings className="w-5 h-5 text-amber-400 animate-spin-slow" />
            <h2 className="text-base sm:text-lg tracking-wider">SETTINGS</h2>
          </div>
          <button
            id="btn-close-settings"
            onClick={onClose}
            className="text-zinc-400 hover:text-white p-1 hover:bg-zinc-800 rounded transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-5 text-xs">
          {/* Section 1: Map Size Preset */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[#58b8d8] flex items-center gap-1.5 font-bold">
                <MapPin className="w-4 h-4 text-cyan-400" />
                <span>BATTLEFIELD MAP SIZE</span>
              </span>
              <span className="text-[10px] text-zinc-400">
                {MAP_SIZE_CONFIGS[settings.mapSize].size}x{MAP_SIZE_CONFIGS[settings.mapSize].size} Tiles
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              {(['classic', 'large', 'giant'] as MapSizePreset[]).map((preset, pIdx) => {
                const isSelected = settings.mapSize === preset;
                const isFocused = focusIndex === pIdx;
                const config = MAP_SIZE_CONFIGS[preset];
                return (
                  <button
                    key={preset}
                    id={`btn-map-size-${preset}`}
                    onClick={() => {
                      setFocusIndex(pIdx);
                      handleSelectMapSize(preset);
                    }}
                    className={`relative flex flex-col p-3 rounded border-2 text-left transition-all ${
                      isFocused
                        ? 'ring-2 ring-[#f8b800] ring-offset-2 ring-offset-black scale-[1.03] shadow-[0_0_12px_rgba(248,184,0,0.6)] z-10'
                        : ''
                    } ${
                      isSelected
                        ? 'bg-amber-950/40 border-[#f8b800] text-amber-200 shadow-md shadow-amber-950/50'
                        : 'bg-zinc-900/80 border-zinc-700 text-zinc-300 hover:border-zinc-500 hover:bg-zinc-800'
                    }`}
                  >
                    <div className="flex items-center justify-between w-full mb-1">
                      <span className="font-bold text-xs uppercase tracking-wide flex items-center gap-1.5">
                        {isFocused && <span className="text-[#f8b800] animate-pulse">▶</span>}
                        <span>{preset}</span>
                      </span>
                      {isSelected && (
                        <Check className="w-3.5 h-3.5 text-[#f8b800] stroke-[3]" />
                      )}
                    </div>
                    <div className="text-[11px] font-sans font-semibold text-zinc-200 mb-1">
                      {config.label}
                    </div>
                    <div className="text-[9px] text-zinc-400 font-mono">
                      {config.size}x{config.size} ({config.canvasSize}px)
                    </div>
                    <div className="text-[9px] font-sans text-zinc-400 mt-2 leading-relaxed line-clamp-2">
                      {config.desc}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Section 2: Game Window Size */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[#a78bfa] flex items-center gap-1.5 font-bold">
                <Scaling className="w-4 h-4 text-purple-400" />
                <span>GAME WINDOW SIZE</span>
              </span>
              <span className="text-[10px] text-zinc-400 font-mono">
                {settings.windowScale === 'max'
                  ? 'Fit Screen / Max'
                  : settings.windowScale === 'large'
                  ? 'Large 1.5x'
                  : 'Standard 1x'}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              {[
                {
                  scale: 'standard' as WindowScalePreset,
                  name: 'STANDARD',
                  ratio: '1X Scale',
                  desc: 'Classic compact retro console window',
                },
                {
                  scale: 'large' as WindowScalePreset,
                  name: 'LARGE',
                  ratio: '1.5X Scale',
                  desc: 'Expanded arcade cabinet for laptop screens',
                },
                {
                  scale: 'max' as WindowScalePreset,
                  name: 'FIT SCREEN',
                  ratio: 'Full Window',
                  desc: 'Maximizes window to fill screen without browser fullscreen',
                },
              ].map((w, wIdx) => {
                const isSelected = (settings.windowScale || 'large') === w.scale;
                const isFocused = focusIndex === 3 + wIdx;
                return (
                  <button
                    key={w.scale}
                    id={`btn-window-scale-${w.scale}`}
                    onClick={() => {
                      setFocusIndex(3 + wIdx);
                      handleSelectWindowScale(w.scale);
                    }}
                    className={`p-3 rounded border-2 text-left transition-all ${
                      isFocused
                        ? 'ring-2 ring-[#f8b800] ring-offset-2 ring-offset-black scale-[1.03] shadow-[0_0_12px_rgba(248,184,0,0.6)] z-10'
                        : ''
                    } ${
                      isSelected
                        ? 'bg-purple-950/40 border-purple-400 text-purple-200 shadow-md shadow-purple-950/50'
                        : 'bg-zinc-900 border-zinc-700 text-zinc-300 hover:border-zinc-500 hover:bg-zinc-800'
                    }`}
                  >
                    <div className="flex items-center justify-between w-full mb-1">
                      <span className="font-bold text-xs uppercase tracking-wide flex items-center gap-1.5">
                        {isFocused && <span className="text-[#f8b800] animate-pulse">▶</span>}
                        <span>{w.name}</span>
                      </span>
                      {isSelected && <Check className="w-3.5 h-3.5 text-purple-400 stroke-[3]" />}
                    </div>
                    <div className="text-[10px] font-sans font-semibold text-zinc-200 mb-0.5">
                      {w.ratio}
                    </div>
                    <div className="text-[8px] font-sans text-zinc-400 leading-relaxed">
                      {w.desc}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Section 4: Display & Fullscreen */}
          <div className="pt-2 border-t border-zinc-800">
            <span className="text-emerald-400 flex items-center gap-1.5 font-bold mb-2.5">
              <Sparkles className="w-4 h-4" />
              <span>DISPLAY & AUDIO</span>
            </span>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              {/* Fullscreen Toggle Button */}
              <button
                id="btn-toggle-fullscreen-modal"
                onClick={() => {
                  setFocusIndex(6);
                  handleToggleFullscreen();
                }}
                className={`p-2.5 rounded border-2 flex items-center justify-between transition-all ${
                  focusIndex === 6
                    ? 'ring-2 ring-[#f8b800] ring-offset-2 ring-offset-black scale-[1.03] shadow-[0_0_12px_rgba(248,184,0,0.6)] z-10'
                    : ''
                } ${
                  currentFullscreen
                    ? 'bg-emerald-950/50 border-emerald-500 text-emerald-300'
                    : 'bg-zinc-900 border-zinc-700 text-zinc-300 hover:border-zinc-500'
                }`}
              >
                <div className="flex items-center gap-2 text-left">
                  {focusIndex === 6 && <span className="text-[#f8b800] animate-pulse">▶</span>}
                  {currentFullscreen ? (
                    <Minimize2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  ) : (
                    <Maximize2 className="w-4 h-4 text-amber-400 shrink-0" />
                  )}
                  <div>
                    <div className="text-[10px] font-bold">FULLSCREEN</div>
                    <div className="text-[9px] font-sans text-zinc-400">Toggle (F)</div>
                  </div>
                </div>
                <span
                  className={`text-[9px] px-1.5 py-0.5 rounded font-mono ${
                    currentFullscreen ? 'bg-emerald-800 text-white' : 'bg-zinc-800 text-zinc-400'
                  }`}
                >
                  {currentFullscreen ? 'ON' : 'OFF'}
                </span>
              </button>

              {/* CRT Scanlines Toggle */}
              <button
                id="btn-toggle-scanlines-modal"
                onClick={() => {
                  setFocusIndex(7);
                  handleToggleScanlines();
                }}
                className={`p-2.5 rounded border-2 flex items-center justify-between transition-all ${
                  focusIndex === 7
                    ? 'ring-2 ring-[#f8b800] ring-offset-2 ring-offset-black scale-[1.03] shadow-[0_0_12px_rgba(248,184,0,0.6)] z-10'
                    : ''
                } ${
                  settings.showScanlines
                    ? 'bg-indigo-950/50 border-indigo-500 text-indigo-300'
                    : 'bg-zinc-900 border-zinc-700 text-zinc-300 hover:border-zinc-500'
                }`}
              >
                <div className="flex items-center gap-2 text-left">
                  {focusIndex === 7 && <span className="text-[#f8b800] animate-pulse">▶</span>}
                  <Tv className="w-4 h-4 text-indigo-400 shrink-0" />
                  <div>
                    <div className="text-[10px] font-bold">CRT LINES</div>
                    <div className="text-[9px] font-sans text-zinc-400">Retro Scanlines</div>
                  </div>
                </div>
                <span
                  className={`text-[9px] px-1.5 py-0.5 rounded font-mono ${
                    settings.showScanlines ? 'bg-indigo-800 text-white' : 'bg-zinc-800 text-zinc-400'
                  }`}
                >
                  {settings.showScanlines ? 'ON' : 'OFF'}
                </span>
              </button>

              {/* Audio Toggle */}
              <button
                id="btn-toggle-audio-modal"
                onClick={() => {
                  setFocusIndex(8);
                  handleToggleSound();
                }}
                className={`p-2.5 rounded border-2 flex items-center justify-between transition-all ${
                  focusIndex === 8
                    ? 'ring-2 ring-[#f8b800] ring-offset-2 ring-offset-black scale-[1.03] shadow-[0_0_12px_rgba(248,184,0,0.6)] z-10'
                    : ''
                } ${
                  settings.soundEnabled
                    ? 'bg-amber-950/40 border-amber-500 text-amber-300'
                    : 'bg-zinc-900 border-zinc-700 text-zinc-400 hover:border-zinc-500'
                }`}
              >
                <div className="flex items-center gap-2 text-left">
                  {focusIndex === 8 && <span className="text-[#f8b800] animate-pulse">▶</span>}
                  {settings.soundEnabled ? (
                    <Volume2 className="w-4 h-4 text-amber-400 shrink-0" />
                  ) : (
                    <VolumeX className="w-4 h-4 text-red-400 shrink-0" />
                  )}
                  <div>
                    <div className="text-[10px] font-bold">SOUND FX</div>
                    <div className="text-[9px] font-sans text-zinc-400">Audio (M)</div>
                  </div>
                </div>
                <span
                  className={`text-[9px] px-1.5 py-0.5 rounded font-mono ${
                    settings.soundEnabled ? 'bg-amber-800 text-white' : 'bg-zinc-800 text-zinc-400'
                  }`}
                >
                  {settings.soundEnabled ? 'ON' : 'OFF'}
                </span>
              </button>
            </div>
          </div>
        </div>

        {/* Footer actions & Controller Guide */}
        <div className="mt-5 pt-3 border-t border-zinc-800 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="text-[8px] sm:text-[9px] text-[#f8b800] font-mono tracking-wider flex items-center gap-2">
            <span>[D-PAD / STICK] MOVE</span>
            <span>•</span>
            <span>[A] TOGGLE / SELECT</span>
            <span>•</span>
            <span>[B / START] EXIT</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              id="btn-quit-desktop"
              type="button"
              onClick={() => {
                soundManager.playMenuSelect();
                if (window.electronAPI?.quit) {
                  window.electronAPI.quit();
                } else {
                  window.close();
                }
              }}
              className="px-3 py-2 bg-red-950/70 hover:bg-red-900 border border-red-700 hover:border-red-500 text-red-300 hover:text-white font-pixel text-[10px] rounded transition-all cursor-pointer shadow-md"
            >
              QUIT GAME
            </button>
            <button
              id="btn-save-settings"
              onClick={onClose}
              className={`px-5 py-2 bg-[#f8b800] hover:bg-[#e0a000] text-black font-pixel text-xs rounded transition-all shadow-lg cursor-pointer ${
                focusIndex === 9
                  ? 'ring-4 ring-white ring-offset-2 ring-offset-black scale-105 font-extrabold shadow-[0_0_16px_rgba(248,184,0,0.9)]'
                  : ''
              }`}
            >
              CONFIRM
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
