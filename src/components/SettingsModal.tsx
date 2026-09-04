/**
 * Battle City 1990 - Settings Modal
 * Configures Battlefield Map Size (Classic 26x26, Large 34x34, Giant 42x42),
 * Player Tank Speed, Fullscreen toggle, CRT Scanlines, and Audio.
 */

import React, { useState, useEffect } from 'react';
import { GameSettings, MapSizePreset, WindowScalePreset } from '../types';
import { MAP_SIZE_CONFIGS } from '../engine/maps';
import { soundManager } from '../engine/SoundManager';
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

  useEffect(() => {
    const unsub = onFullscreenChange((active) => {
      setCurrentFullscreen(active);
    });
    return unsub;
  }, []);

  const handleSelectMapSize = (preset: MapSizePreset) => {
    soundManager.unlockAudio();
    soundManager.playHitSteel();
    onUpdateSettings({
      ...settings,
      mapSize: preset,
    });
  };

  const handleToggleScanlines = () => {
    soundManager.unlockAudio();
    soundManager.playHitSteel();
    onUpdateSettings({
      ...settings,
      showScanlines: !settings.showScanlines,
    });
  };

  const handleSelectWindowScale = (scale: WindowScalePreset) => {
    soundManager.unlockAudio();
    soundManager.playHitSteel();
    onUpdateSettings({
      ...settings,
      windowScale: scale,
    });
  };

  const handleToggleSound = () => {
    soundManager.unlockAudio();
    const nextMuted = soundManager.toggleMute();
    onUpdateSettings({
      ...settings,
      soundEnabled: !nextMuted,
    });
  };

  const handleToggleFullscreen = async () => {
    soundManager.unlockAudio();
    soundManager.playPowerUpCollect();
    await toggleFullscreen();
    setCurrentFullscreen(isFullscreen());
  };

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
              {(['classic', 'large', 'giant'] as MapSizePreset[]).map((preset) => {
                const isSelected = settings.mapSize === preset;
                const config = MAP_SIZE_CONFIGS[preset];
                return (
                  <button
                    key={preset}
                    id={`btn-map-size-${preset}`}
                    onClick={() => handleSelectMapSize(preset)}
                    className={`relative flex flex-col p-3 rounded border-2 text-left transition-all ${
                      isSelected
                        ? 'bg-amber-950/40 border-[#f8b800] text-amber-200 shadow-md shadow-amber-950/50'
                        : 'bg-zinc-900/80 border-zinc-700 text-zinc-300 hover:border-zinc-500 hover:bg-zinc-800'
                    }`}
                  >
                    <div className="flex items-center justify-between w-full mb-1">
                      <span className="font-bold text-xs uppercase tracking-wide">
                        {preset}
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
              ].map((w) => {
                const isSelected = (settings.windowScale || 'large') === w.scale;
                return (
                  <button
                    key={w.scale}
                    id={`btn-window-scale-${w.scale}`}
                    onClick={() => handleSelectWindowScale(w.scale)}
                    className={`p-3 rounded border-2 text-left transition-all ${
                      isSelected
                        ? 'bg-purple-950/40 border-purple-400 text-purple-200 shadow-md shadow-purple-950/50'
                        : 'bg-zinc-900 border-zinc-700 text-zinc-300 hover:border-zinc-500 hover:bg-zinc-800'
                    }`}
                  >
                    <div className="flex items-center justify-between w-full mb-1">
                      <span className="font-bold text-xs uppercase tracking-wide">{w.name}</span>
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
                onClick={handleToggleFullscreen}
                className={`p-2.5 rounded border-2 flex items-center justify-between transition-colors ${
                  currentFullscreen
                    ? 'bg-emerald-950/50 border-emerald-500 text-emerald-300'
                    : 'bg-zinc-900 border-zinc-700 text-zinc-300 hover:border-zinc-500'
                }`}
              >
                <div className="flex items-center gap-2 text-left">
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
                onClick={handleToggleScanlines}
                className={`p-2.5 rounded border-2 flex items-center justify-between transition-colors ${
                  settings.showScanlines
                    ? 'bg-indigo-950/50 border-indigo-500 text-indigo-300'
                    : 'bg-zinc-900 border-zinc-700 text-zinc-300 hover:border-zinc-500'
                }`}
              >
                <div className="flex items-center gap-2 text-left">
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
                onClick={handleToggleSound}
                className={`p-2.5 rounded border-2 flex items-center justify-between transition-colors ${
                  settings.soundEnabled
                    ? 'bg-amber-950/40 border-amber-500 text-amber-300'
                    : 'bg-zinc-900 border-zinc-700 text-zinc-400 hover:border-zinc-500'
                }`}
              >
                <div className="flex items-center gap-2 text-left">
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

        {/* Footer actions */}
        <div className="mt-6 pt-4 border-t border-zinc-800 flex items-center justify-between">
          <div className="text-[9px] text-zinc-400 font-sans">
            Settings apply immediately and are saved automatically.
          </div>
          <button
            id="btn-save-settings"
            onClick={onClose}
            className="px-4 py-2 bg-[#f8b800] hover:bg-[#e0a000] text-black font-pixel text-xs rounded transition-colors shadow-lg"
          >
            CONFIRM
          </button>
        </div>
      </div>
    </div>
  );
};
