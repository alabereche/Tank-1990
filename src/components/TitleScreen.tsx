/**
 * Battle City 1990 - Authentic NES Title Screen
 * Displays high score, iconic logo, interactive tank cursor,
 * and game mode selector.
 */

import React, { useState, useEffect } from 'react';
import { soundManager } from '../engine/SoundManager';
import { Gamepad2, Trophy, HelpCircle, Settings, Maximize2, Minimize2 } from 'lucide-react';
import { toggleFullscreen, isFullscreen, onFullscreenChange } from '../utils/fullscreen';

interface TitleScreenProps {
  highScore: number;
  mapSizeLabel?: string;
  onStart1Player: () => void;
  onStartLocal2Player: (mode: 'coop' | 'versus') => void;
  onOpenMultiplayer: () => void;
  onOpenConstruction: () => void;
  onOpenSettings: () => void;
  inCabinet?: boolean;
}

export const TitleScreen: React.FC<TitleScreenProps> = ({
  highScore,
  mapSizeLabel,
  onStart1Player,
  onStartLocal2Player,
  onOpenMultiplayer,
  onOpenConstruction,
  onOpenSettings,
  inCabinet = false,
}) => {
  const [selectedIdx, setSelectedIdx] = useState<number>(0);
  const [showHelpModal, setShowHelpModal] = useState<boolean>(false);
  const [showLocal2PModal, setShowLocal2PModal] = useState<boolean>(false);
  const [local2PMode, setLocal2PMode] = useState<'coop' | 'versus'>('coop');
  const [fullscreenActive, setFullscreenActive] = useState<boolean>(isFullscreen());

  useEffect(() => {
    const unsub = onFullscreenChange((active) => {
      setFullscreenActive(active);
    });
    return unsub;
  }, []);

  const menuOptions = [
    { label: '1 PLAYER', action: onStart1Player },
    { label: '2 PLAYERS (LOCAL)', action: () => setShowLocal2PModal(true) },
    { label: 'ONLINE MULTIPLAYER', action: onOpenMultiplayer },
    { label: 'CONSTRUCTION', action: onOpenConstruction },
    { label: 'SETTINGS', action: onOpenSettings },
  ];

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      soundManager.unlockAudio();
      if (e.key === 'ArrowUp' || e.key === 'w') {
        setSelectedIdx((prev) => (prev > 0 ? prev - 1 : menuOptions.length - 1));
        soundManager.playHitSteel();
      } else if (e.key === 'ArrowDown' || e.key === 's') {
        setSelectedIdx((prev) => (prev < menuOptions.length - 1 ? prev + 1 : 0));
        soundManager.playHitSteel();
      } else if (e.key === 'Enter' || e.key === ' ') {
        soundManager.playPowerUpCollect();
        menuOptions[selectedIdx].action();
      } else if (e.key.toLowerCase() === 'f') {
        toggleFullscreen();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedIdx, menuOptions]);

  const handleToggleFullscreen = async () => {
    soundManager.unlockAudio();
    soundManager.playHitSteel();
    await toggleFullscreen();
  };

  return (
    <div
      id="title-screen-container"
      className={
        inCabinet
          ? "flex flex-col items-center justify-between w-full h-full p-2 sm:p-3.5 text-white font-pixel select-none relative overflow-hidden"
          : "flex flex-col items-center justify-between w-full max-w-lg mx-auto min-h-[540px] bg-black border-4 border-[#484848] p-6 text-white font-pixel select-none shadow-2xl relative"
      }
    >
      {/* High Score & Fullscreen Header */}
      <div className={`w-full flex items-center justify-between tracking-wider ${inCabinet ? 'text-[10px] sm:text-xs pb-1' : 'text-xs sm:text-sm pb-4 border-b border-zinc-800'}`}>
        <div className="flex items-center gap-1.5 sm:gap-2">
          <span className="text-red-500 font-bold drop-shadow">I-</span>
          <span className="text-white tracking-widest drop-shadow">00</span>
        </div>
        <div className="flex items-center gap-1.5 text-[#f8b800] drop-shadow">
          <Trophy className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-400" />
          <span>HI- {highScore.toString().padStart(5, '0')}</span>
        </div>
        <button
          id="btn-title-fullscreen"
          onClick={handleToggleFullscreen}
          className="p-1 sm:p-1.5 bg-zinc-900/60 border border-zinc-700/60 hover:border-amber-400/80 rounded text-zinc-300 hover:text-white transition-colors flex items-center gap-1 text-[8px] sm:text-[9px]"
          title="Toggle Fullscreen (F)"
        >
          {fullscreenActive ? (
            <Minimize2 className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-emerald-400" />
          ) : (
            <Maximize2 className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-amber-400" />
          )}
        </button>
      </div>

      {/* Retro Pixel Logo Banner */}
      <div className={`flex flex-col items-center ${inCabinet ? 'my-1 sm:my-2' : 'my-4'}`}>
        <div className="relative text-center">
          <h1 className={`font-extrabold tracking-widest text-red-600 select-none ${inCabinet ? 'text-2xl sm:text-3xl md:text-4xl drop-shadow-[0_4px_0_#400000]' : 'text-4xl sm:text-5xl drop-shadow-[0_6px_0_#400000]'}`}>
            BATTLE
          </h1>
          <h2 className={`font-extrabold tracking-wider text-[#f8b800] mt-0.5 select-none ${inCabinet ? 'text-xl sm:text-2xl md:text-3xl drop-shadow-[0_3px_0_#704000]' : 'text-3xl sm:text-4xl drop-shadow-[0_5px_0_#704000]'}`}>
            CITY 1990
          </h2>
          <div className="text-[8px] sm:text-[9px] text-zinc-400 tracking-widest mt-1 uppercase drop-shadow">
            NES 8-Bit Tank Combat
          </div>
          {mapSizeLabel && (
            <div className="inline-block mt-1.5 px-2 py-0.5 bg-zinc-900/70 border border-amber-500/40 rounded-full text-[8px] text-amber-300 font-sans shadow-sm">
              MAP: {mapSizeLabel}
            </div>
          )}
        </div>

        {/* Decorative Pixel Tanks */}
        <div className={`flex items-center justify-center gap-4 ${inCabinet ? 'mt-2 sm:mt-2.5' : 'mt-5'}`}>
          {/* Player Tank Sprite */}
          <div className="w-6 h-6 sm:w-7 sm:h-7 relative">
            <svg viewBox="0 0 16 16" className="w-full h-full fill-[#f8b800] drop-shadow-[0_2px_4px_rgba(248,184,0,0.5)]">
              <rect x="1" y="2" width="3" height="12" />
              <rect x="12" y="2" width="3" height="12" />
              <rect x="4" y="4" width="8" height="8" />
              <rect x="7" y="0" width="2" height="5" />
              <rect x="6" y="6" width="4" height="4" fill="#ffffff" />
            </svg>
          </div>

          <span className="text-[10px] text-zinc-500 font-bold drop-shadow">VS</span>

          {/* Enemy Tank Sprite */}
          <div className="w-6 h-6 sm:w-7 sm:h-7 relative">
            <svg viewBox="0 0 16 16" className="w-full h-full fill-[#58b8d8] drop-shadow-[0_2px_4px_rgba(88,184,216,0.5)]">
              <rect x="1" y="2" width="3" height="12" />
              <rect x="12" y="2" width="3" height="12" />
              <rect x="4" y="4" width="8" height="8" />
              <rect x="7" y="11" width="2" height="5" />
              <rect x="6" y="6" width="4" height="4" fill="#105878" />
            </svg>
          </div>
        </div>
      </div>

      {/* Menu Options with Tank Cursor */}
      <div className={`flex flex-col w-60 sm:w-68 max-w-full text-[10px] sm:text-xs tracking-wider ${inCabinet ? 'gap-1.5 sm:gap-2 my-1' : 'gap-3 my-3'}`}>
        {menuOptions.map((opt, idx) => {
          const isSelected = selectedIdx === idx;
          return (
            <button
              key={opt.label}
              id={`menu-option-${idx}`}
              onClick={() => {
                soundManager.unlockAudio();
                setSelectedIdx(idx);
                soundManager.playPowerUpCollect();
                opt.action();
              }}
              onMouseEnter={() => {
                setSelectedIdx(idx);
                soundManager.playHitSteel();
              }}
              className="flex items-center gap-2 sm:gap-2.5 py-1 px-1.5 text-left hover:text-amber-300 transition-colors group"
            >
              {/* Tank Cursor */}
              <div className="w-4 h-4 sm:w-5 sm:h-5 flex items-center justify-center shrink-0">
                {isSelected ? (
                  <svg viewBox="0 0 16 16" className="w-4 h-4 sm:w-5 sm:h-5 fill-[#f8b800] animate-pulse drop-shadow-[0_0_6px_rgba(248,184,0,0.8)]">
                    <rect x="2" y="1" width="12" height="3" />
                    <rect x="2" y="12" width="12" height="3" />
                    <rect x="4" y="4" width="8" height="8" />
                    <rect x="11" y="7" width="5" height="2" />
                  </svg>
                ) : (
                  <div className="w-1.5 h-1.5 bg-transparent" />
                )}
              </div>

              <span className={isSelected ? 'text-[#f8b800] underline decoration-2 drop-shadow-[0_0_8px_rgba(248,184,0,0.5)]' : 'text-white drop-shadow'}>
                {opt.label}
              </span>
            </button>
          );
        })}
      </div>

      {/* Controls & Settings Quick Buttons */}
      <div className={`flex items-center gap-2 ${inCabinet ? 'mt-1' : 'mt-3'}`}>
        <button
          id="btn-how-to-play"
          onClick={() => setShowHelpModal(true)}
          className="flex items-center gap-1 text-[8px] sm:text-[9px] text-zinc-300 hover:text-white bg-zinc-900/70 border border-zinc-700/60 hover:border-amber-400 px-2 sm:px-2.5 py-1 rounded transition-all"
        >
          <HelpCircle className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-amber-400" />
          <span>GUIDE</span>
        </button>
        <button
          id="btn-title-settings"
          onClick={onOpenSettings}
          className="flex items-center gap-1 text-[8px] sm:text-[9px] text-zinc-300 hover:text-amber-400 bg-zinc-900/70 border border-zinc-700/60 hover:border-amber-400 px-2 sm:px-2.5 py-1 rounded transition-all"
        >
          <Settings className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-amber-400" />
          <span>SETTINGS</span>
        </button>
        <button
          id="btn-title-fullscreen-bot"
          onClick={handleToggleFullscreen}
          className="flex items-center gap-1 text-[8px] sm:text-[9px] text-zinc-300 hover:text-emerald-400 bg-zinc-900/70 border border-zinc-700/60 hover:border-emerald-400 px-2 sm:px-2.5 py-1 rounded transition-all"
        >
          {fullscreenActive ? (
            <Minimize2 className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-emerald-400" />
          ) : (
            <Maximize2 className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-emerald-400" />
          )}
          <span>{fullscreenActive ? 'WIN' : 'FULL'}</span>
        </button>
      </div>

      {/* Footer Copyright */}
      <div className={`text-[7px] sm:text-[8px] text-zinc-400 tracking-wider text-center w-full ${inCabinet ? 'pt-1' : 'pt-4 border-t border-zinc-900'}`}>
        (C) 1980 1985 NAMCO LTD. / 1990 RETRO EDITION
      </div>

      {/* Controls & Rules Modal */}
      {showHelpModal && (
        <div className="fixed inset-0 bg-black/85 flex items-center justify-center p-4 z-50 backdrop-blur-sm font-pixel text-xs">
          <div className="bg-[#242424] border-4 border-[#555] p-5 max-w-md w-full rounded shadow-2xl flex flex-col gap-4 text-zinc-200">
            <div className="flex items-center justify-between border-b border-zinc-700 pb-2">
              <span className="text-amber-400 font-bold text-sm">MISSION BRIEFING</span>
              <button
                onClick={() => setShowHelpModal(false)}
                className="text-zinc-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <div className="flex flex-col gap-3 text-[9px] leading-relaxed">
              <div>
                <span className="text-yellow-400 font-bold">OBJECTIVE:</span> Defend the Eagle Base at the bottom center and destroy all 20 enemy tanks. If your base is hit or you run out of lives, Game Over!
              </div>

              <div>
                <span className="text-yellow-400 font-bold">KEYBOARD:</span>
                <ul className="list-disc pl-4 mt-1 space-y-0.5 text-zinc-300">
                  <li>Move: WASD or Arrow Keys</li>
                  <li>Fire: Spacebar or J / Z</li>
                  <li>Pause: Enter or P</li>
                  <li>Mute SFX: M</li>
                </ul>
              </div>

              <div>
                <span className="text-yellow-400 font-bold">GAMEPAD (PLUG & PLAY):</span>
                <ul className="list-disc pl-4 mt-1 space-y-0.5 text-zinc-300">
                  <li>Move: D-Pad or Left Joystick</li>
                  <li>Fire: Button A / Cross (0)</li>
                  <li>Pause: Start Button (9)</li>
                </ul>
              </div>

              <div>
                <span className="text-yellow-400 font-bold">POWER-UPS:</span>
                <div className="grid grid-cols-2 gap-1.5 mt-1 text-[8px] text-zinc-300">
                  <div>⭐ Star: Tank upgrade / 2 bullets</div>
                  <div>💣 Bomb: Destroy all enemies</div>
                  <div>⏱️ Timer: Freeze enemies 10s</div>
                  <div>🛡️ Helmet: Invulnerability shield</div>
                  <div>⛏️ Shovel: Steel base bunker 20s</div>
                  <div>🎖️ Tank: 1 Extra Player Life</div>
                </div>
              </div>
            </div>

            <button
              onClick={() => setShowHelpModal(false)}
              className="bg-amber-600 hover:bg-amber-500 text-white py-2 rounded text-[10px] font-bold mt-2"
            >
              UNDERSTOOD, COMMANDER!
            </button>
          </div>
        </div>
      )}

      {/* Local 2-Player Game Selection Modal */}
      {showLocal2PModal && (
        <div className="fixed inset-0 bg-black/85 flex items-center justify-center p-4 z-50 backdrop-blur-sm font-pixel text-xs">
          <div className="bg-[#242424] border-4 border-[#555] p-5 max-w-md w-full rounded shadow-2xl flex flex-col gap-4 text-zinc-200">
            <div className="flex items-center justify-between border-b border-zinc-700 pb-2">
              <div className="flex items-center gap-2 text-emerald-400 font-bold text-sm">
                <span>LOCAL 2 PLAYERS (SAME PC)</span>
              </div>
              <button
                onClick={() => setShowLocal2PModal(false)}
                className="text-zinc-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <div className="flex flex-col gap-3 text-[10px]">
              <div className="text-zinc-300">
                Play together on one keyboard or with two gamepads:
              </div>

              {/* Mode Selection */}
              <div className="grid grid-cols-2 gap-2 mt-1">
                <button
                  type="button"
                  onClick={() => setLocal2PMode('coop')}
                  className={`p-3 rounded border text-left flex flex-col gap-1 transition-all ${
                    local2PMode === 'coop'
                      ? 'border-[#f8b800] bg-amber-950/40 text-white shadow-md'
                      : 'border-zinc-700 bg-zinc-900/60 text-zinc-400 hover:border-zinc-500'
                  }`}
                >
                  <span className="font-bold text-[#f8b800] text-xs">CO-OP BATTLE</span>
                  <span className="text-[8px] text-zinc-400">Team up to defend the base against 20 tanks</span>
                </button>

                <button
                  type="button"
                  onClick={() => setLocal2PMode('versus')}
                  className={`p-3 rounded border text-left flex flex-col gap-1 transition-all ${
                    local2PMode === 'versus'
                      ? 'border-[#58b8d8] bg-sky-950/40 text-white shadow-md'
                      : 'border-zinc-700 bg-zinc-900/60 text-zinc-400 hover:border-zinc-500'
                  }`}
                >
                  <span className="font-bold text-[#58b8d8] text-xs">1V1 VERSUS</span>
                  <span className="text-[8px] text-zinc-400">Head-to-head duel across symmetrical battlefield</span>
                </button>
              </div>

              {/* Controls Layout Guide */}
              <div className="bg-black/60 p-2.5 rounded border border-zinc-800 flex flex-col gap-2 mt-2">
                <div className="flex items-center justify-between border-b border-zinc-800 pb-1 text-[9px]">
                  <span className="text-[#f8b800] font-bold">PLAYER 1 (GOLD TANK)</span>
                  <span className="text-zinc-400">[W, A, S, D] Move + [SPACE / J] Fire</span>
                </div>
                <div className="flex items-center justify-between text-[9px]">
                  <span className="text-[#55f855] font-bold">PLAYER 2 (GREEN TANK)</span>
                  <span className="text-zinc-400">[ARROWS] Move + [ENTER / K] Fire</span>
                </div>
              </div>

              <div className="text-[8px] text-zinc-400 italic text-center">
                * Dual gamepads supported: Gamepad 1 controls P1, Gamepad 2 controls P2.
              </div>
            </div>

            <div className="flex items-center gap-2 mt-2">
              <button
                type="button"
                onClick={() => setShowLocal2PModal(false)}
                className="flex-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 py-2 rounded text-[10px]"
              >
                CANCEL
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowLocal2PModal(false);
                  onStartLocal2Player(local2PMode);
                }}
                className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white py-2 rounded text-[10px] font-bold shadow-lg"
              >
                START BATTLE!
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
