/**
 * Battle City 1990 - NES Retro Side HUD Panel
 * Authentic 8-bit right side panel with 20 enemy tank counters,
 * player lives, stage flag, score, and audio/controller controls.
 */

import React from 'react';
import { GameScore, MultiplayerMode, TacticalInventory } from '../types';
import { Volume2, VolumeX, Gamepad2, Keyboard } from 'lucide-react';
import { soundManager } from '../engine/SoundManager';
import { GamepadInfo } from '../engine/GamepadManager';
import { SmokeSvg, GrenadeSvg, ShieldSvg } from './TacticalIcons';

interface HudProps {
  scoreData: GameScore;
  isMuted: boolean;
  onToggleMute: () => void;
  gamepad: GamepadInfo | null;
  onOpenConstruction?: () => void;
  onPauseToggle?: () => void;
  isPaused?: boolean;
  isMaxScale?: boolean;
  versus?: boolean;
  mode?: MultiplayerMode;
  tacticalInventory?: TacticalInventory;
  tacticalInventoryP2?: TacticalInventory;
}

export const Hud: React.FC<HudProps> = ({
  scoreData,
  isMuted,
  onToggleMute,
  gamepad,
  onOpenConstruction,
  onPauseToggle,
  isPaused,
  isMaxScale = false,
  versus = false,
  mode = 'single',
  tacticalInventory,
  tacticalInventoryP2,
}) => {
  // 20 enemy icons total: remaining enemies in pool + active enemies on field
  const totalRemainingCount = scoreData.enemiesRemaining.length;

  return (
    <aside
      id="nes-hud-panel"
      className={`bg-[#636363] border-l-4 border-[#303030] flex flex-col justify-between items-center text-black select-none font-pixel transition-all ${
        isMaxScale
          ? 'w-24 sm:w-28 md:w-32 p-2 sm:p-3 text-[10px] sm:text-[11px]'
          : 'w-24 sm:w-28 p-2 sm:p-2.5 text-[10px]'
      }`}
    >
      {/* Top: 2v2 Teams / FFA Leaderboard / Versus round scoreboard / Co-Op enemy grid */}
      <div className="w-full flex flex-col items-center">
        {mode === '2v2' || scoreData.teamWinsA !== undefined ? (
          <div className="w-full flex flex-col items-center mb-3">
            <div className="text-[8px] text-zinc-900 mb-1 tracking-wider uppercase font-bold">TEAMS (FT5)</div>
            <div className="w-full bg-[#505050] rounded border border-[#383838] shadow-inner p-2 flex items-center justify-between">
              <div className="flex flex-col items-center">
                <span className="text-[7px] text-blue-300 font-bold tracking-wider">TEAM A</span>
                <span className="font-mono font-bold text-base text-[#4a9eff]">
                  {scoreData.teamWinsA ?? 0}
                </span>
              </div>
              <span className="text-[8px] text-zinc-400 font-bold">:</span>
              <div className="flex flex-col items-center">
                <span className="text-[7px] text-red-300 font-bold tracking-wider">TEAM B</span>
                <span className="font-mono font-bold text-base text-[#ff4a4a]">
                  {scoreData.teamWinsB ?? 0}
                </span>
              </div>
            </div>
          </div>
        ) : mode === 'ffa' || scoreData.playerStats ? (
          <div className="w-full flex flex-col items-center mb-3">
            <div className="text-[8px] text-zinc-900 mb-1 tracking-wider uppercase font-bold">KILLS (FT30)</div>
            <div className="w-full bg-[#505050] rounded border border-[#383838] shadow-inner p-1.5 flex flex-col gap-1">
              {Object.entries(scoreData.playerStats || {})
                .map(([slotStr, stats]) => ({ slot: parseInt(slotStr, 10), stats: stats as { kills: number; deaths: number } }))
                .sort((a, b) => b.stats.kills - a.stats.kills)
                .slice(0, 4)
                .map(({ slot: s, stats }) => {
                  const colors = [
                    '#f8b800', '#00a800', '#00a8a8', '#e40058',
                    '#940088', '#f87800', '#b8b8b8', '#78f800',
                  ];
                  const col = colors[(s - 1) % colors.length] || '#fff';
                  return (
                    <div key={s} className="flex items-center justify-between text-[8px] font-mono font-bold">
                      <span style={{ color: col }}>P{s}</span>
                      <span className="text-zinc-200">{stats.kills} K</span>
                    </div>
                  );
                })}
            </div>
          </div>
        ) : versus ? (
          <div className="w-full flex flex-col items-center mb-3">
            <div className="text-[8px] text-zinc-900 mb-1 tracking-wider uppercase font-bold">ROUNDS</div>
            <div className="w-full bg-[#505050] rounded border border-[#383838] shadow-inner p-2 flex items-center justify-between">
              <span className="flex items-center gap-1 font-mono font-bold text-base text-[#f8b800]">
                <svg viewBox="0 0 16 16" className="w-4 h-4 fill-[#d89000]">
                  <rect x="1" y="2" width="3" height="12" />
                  <rect x="12" y="2" width="3" height="12" />
                  <rect x="4" y="4" width="8" height="8" />
                  <rect x="7" y="0" width="2" height="5" />
                  <rect x="6" y="6" width="4" height="4" fill="#fff" />
                </svg>
                {scoreData.roundWinsP1 ?? 0}
              </span>
              <span className="text-[7px] text-zinc-300 tracking-wider">FT7</span>
              <span className="flex items-center gap-1 font-mono font-bold text-base text-[#00a800]">
                {scoreData.roundWinsP2 ?? 0}
                <svg viewBox="0 0 16 16" className="w-4 h-4 fill-[#00a800]">
                  <rect x="1" y="2" width="3" height="12" />
                  <rect x="12" y="2" width="3" height="12" />
                  <rect x="4" y="4" width="8" height="8" />
                  <rect x="7" y="0" width="2" height="5" />
                  <rect x="6" y="6" width="4" height="4" fill="#78f878" />
                </svg>
              </span>
            </div>
          </div>
        ) : (
          <div className="w-full flex flex-col items-center">
            <div className="text-[8px] text-zinc-900 mb-1 tracking-wider uppercase font-bold">ENEMIES</div>
            <div className="grid grid-cols-2 gap-1 p-1 bg-[#505050] rounded border border-[#383838] shadow-inner mb-3">
              {Array.from({ length: 20 }).map((_, idx) => {
                const isRemaining = idx < totalRemainingCount;
                return (
                  <div
                    key={idx}
                    className="w-3.5 h-3.5 flex items-center justify-center"
                    title={isRemaining ? 'Enemy Tank' : 'Destroyed'}
                  >
                    {isRemaining ? (
                      <svg viewBox="0 0 16 16" className="w-3.5 h-3.5 fill-black">
                        <rect x="1" y="2" width="3" height="12" />
                        <rect x="12" y="2" width="3" height="12" />
                        <rect x="4" y="4" width="8" height="8" />
                        <rect x="7" y="1" width="2" height="4" />
                        <rect x="6" y="6" width="4" height="4" fill="#636363" />
                      </svg>
                    ) : (
                      <div className="w-1.5 h-1.5 rounded-full bg-[#404040]" />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Player 1 Lives Counter (NES IP style) - Co-Op mode only */}
        {!versus && mode !== '2v2' && mode !== 'ffa' && (
          <div className="w-full bg-[#787878] p-1.5 rounded border border-[#404040] mb-2 flex flex-col items-center shadow-sm">
            <div className="text-[9px] font-bold text-black tracking-widest mb-0.5">I P</div>
            <div className="flex items-center gap-1.5">
              <svg viewBox="0 0 16 16" className="w-4 h-4 fill-[#d89000]">
                <rect x="1" y="2" width="3" height="12" />
                <rect x="12" y="2" width="3" height="12" />
                <rect x="4" y="4" width="8" height="8" />
                <rect x="7" y="0" width="2" height="5" />
                <rect x="6" y="6" width="4" height="4" fill="#fff" />
              </svg>
              <span className="text-black text-xs font-bold font-mono">{scoreData.playerLives}</span>
            </div>
          </div>
        )}

        {/* Player 2 Lives Counter (NES II P style, Green Tank) */}
        {!versus && mode !== '2v2' && mode !== 'ffa' && scoreData.player2Lives !== undefined && (
          <div className="w-full bg-[#787878] p-1.5 rounded border border-[#404040] mb-2 flex flex-col items-center shadow-sm">
            <div className="text-[9px] font-bold text-black tracking-widest mb-0.5">II P</div>
            <div className="flex items-center gap-1.5">
              <svg viewBox="0 0 16 16" className="w-4 h-4 fill-[#00a800]">
                <rect x="1" y="2" width="3" height="12" />
                <rect x="12" y="2" width="3" height="12" />
                <rect x="4" y="4" width="8" height="8" />
                <rect x="7" y="0" width="2" height="5" />
                <rect x="6" y="6" width="4" height="4" fill="#78f878" />
              </svg>
              <span className="text-black text-xs font-bold font-mono">{scoreData.player2Lives}</span>
            </div>
          </div>
        )}

        {/* Stage Flag / Round Indicator */}
        <div className="w-full bg-[#787878] p-1.5 rounded border border-[#404040] mb-3 flex flex-col items-center shadow-sm">
          <div className="flex items-center gap-1">
            {/* Flag icon */}
            <svg viewBox="0 0 16 16" className="w-4 h-4 fill-[#d82800]">
              <path d="M2 1h2v14H2zm2 1h10l-3 4 3 4H4z" />
            </svg>
            <span className="text-black text-xs font-bold font-mono">
              {versus ? (scoreData.roundNumber ?? 1) : scoreData.stage}
            </span>
          </div>
        </div>

        {/* Tactical Weapons Counter - P1 */}
        {tacticalInventory && (
          <div className="w-full bg-[#3c3c3c] p-1.5 rounded border border-[#2a2a2a] shadow-inner mb-2 flex flex-col gap-1.5">
            <div className="text-[8px] text-[#f8b800] font-bold text-center tracking-wider border-b border-[#4d4d4d] pb-0.5 font-pixel flex items-center justify-center gap-1">
              {tacticalInventoryP2 && (
                <span className="w-1.5 h-1.5 rounded-full bg-[#f8b800] inline-block" />
              )}
              <span>{tacticalInventoryP2 ? 'I P TACTICAL' : 'TACTICAL'}</span>
            </div>
            <div className="flex items-center justify-between px-0.5 text-[9px]" title="Smoke Screen [Q / L1]">
              <div className="flex items-center gap-1.5">
                <SmokeSvg className="w-4 h-4 shrink-0 drop-shadow" />
                <span className="px-1 py-px bg-[#262626] border border-[#555] rounded text-[6px] text-zinc-300 font-mono font-bold leading-none">Q</span>
              </div>
              <span className={`font-mono font-bold ${tacticalInventory.smoke > 0 ? 'text-white' : 'text-zinc-500'}`}>
                {tacticalInventory.smoke}
              </span>
            </div>
            <div className="flex items-center justify-between px-0.5 text-[9px]" title="Bouncing Bomb [E / R1]">
              <div className="flex items-center gap-1.5">
                <GrenadeSvg className="w-4 h-4 shrink-0 drop-shadow" />
                <span className="px-1 py-px bg-[#262626] border border-[#555] rounded text-[6px] text-zinc-300 font-mono font-bold leading-none">E</span>
              </div>
              <span className={`font-mono font-bold ${tacticalInventory.grenade > 0 ? 'text-white' : 'text-zinc-500'}`}>
                {tacticalInventory.grenade}
              </span>
            </div>
            <div className="flex items-center justify-between px-0.5 text-[9px]" title="Deployable Shield [R / L2]">
              <div className="flex items-center gap-1.5">
                <ShieldSvg className="w-4 h-4 shrink-0 drop-shadow" />
                <span className="px-1 py-px bg-[#262626] border border-[#555] rounded text-[6px] text-zinc-300 font-mono font-bold leading-none">R</span>
              </div>
              <span className={`font-mono font-bold ${tacticalInventory.shield > 0 ? 'text-white' : 'text-zinc-500'}`}>
                {tacticalInventory.shield}
              </span>
            </div>
          </div>
        )}

        {/* Tactical Weapons Counter - P2 (Versus / Coop / 2v2) */}
        {tacticalInventoryP2 && (
          <div className="w-full bg-[#3c3c3c] p-1.5 rounded border border-[#2a2a2a] shadow-inner mb-2 flex flex-col gap-1.5">
            <div className="text-[8px] text-[#00e000] font-bold text-center tracking-wider border-b border-[#4d4d4d] pb-0.5 font-pixel flex items-center justify-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-[#00e000] inline-block" />
              <span>II P TACTICAL</span>
            </div>
            <div className="flex items-center justify-between px-0.5 text-[9px]" title="P2 Smoke Screen [U / Num 7 / L1]">
              <div className="flex items-center gap-1.5">
                <SmokeSvg className="w-4 h-4 shrink-0 drop-shadow" />
                <span className="px-1 py-px bg-[#262626] border border-[#555] rounded text-[6px] text-zinc-300 font-mono font-bold leading-none">U</span>
              </div>
              <span className={`font-mono font-bold ${tacticalInventoryP2.smoke > 0 ? 'text-white' : 'text-zinc-500'}`}>
                {tacticalInventoryP2.smoke}
              </span>
            </div>
            <div className="flex items-center justify-between px-0.5 text-[9px]" title="P2 Bouncing Bomb [I / Num 8 / R1]">
              <div className="flex items-center gap-1.5">
                <GrenadeSvg className="w-4 h-4 shrink-0 drop-shadow" />
                <span className="px-1 py-px bg-[#262626] border border-[#555] rounded text-[6px] text-zinc-300 font-mono font-bold leading-none">I</span>
              </div>
              <span className={`font-mono font-bold ${tacticalInventoryP2.grenade > 0 ? 'text-white' : 'text-zinc-500'}`}>
                {tacticalInventoryP2.grenade}
              </span>
            </div>
            <div className="flex items-center justify-between px-0.5 text-[9px]" title="P2 Deployable Shield [O / Num 9 / L2]">
              <div className="flex items-center gap-1.5">
                <ShieldSvg className="w-4 h-4 shrink-0 drop-shadow" />
                <span className="px-1 py-px bg-[#262626] border border-[#555] rounded text-[6px] text-zinc-300 font-mono font-bold leading-none">O</span>
              </div>
              <span className={`font-mono font-bold ${tacticalInventoryP2.shield > 0 ? 'text-white' : 'text-zinc-500'}`}>
                {tacticalInventoryP2.shield}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Bottom: Controls, Sound, Gamepad status */}
      <div className="w-full flex flex-col items-center gap-1.5 pt-2 border-t border-[#505050]">
        {/* Pause Button */}
        {onPauseToggle && (
          <button
            id="hud-pause-btn"
            onClick={onPauseToggle}
            className={`w-full py-1.5 px-1 rounded text-[8px] font-pixel border transition-all ${
              isPaused
                ? 'bg-red-600 text-white border-red-800 animate-pulse'
                : 'bg-[#505050] text-zinc-100 border-[#383838] hover:bg-[#454545] active:translate-y-px'
            }`}
          >
            {isPaused ? 'RESUME' : 'PAUSE'}
          </button>
        )}

        {/* Sound Mute/Unmute */}
        <button
          id="hud-sound-toggle-btn"
          onClick={onToggleMute}
          className="w-full flex items-center justify-center gap-1 py-1.5 bg-[#505050] text-zinc-100 hover:bg-[#454545] active:translate-y-px rounded border border-[#383838] text-[8px] transition-colors"
          title={isMuted ? 'Unmute Audio' : 'Mute Audio'}
        >
          {isMuted ? <VolumeX className="w-3.5 h-3.5 text-red-400" /> : <Volume2 className="w-3.5 h-3.5 text-emerald-400" />}
          <span>{isMuted ? 'MUTE' : 'SFX'}</span>
        </button>

        {/* Gamepad / Keyboard status */}
        <div
          className={`w-full py-1 px-1 rounded text-[7px] text-center border flex items-center justify-center gap-1 ${
            gamepad?.connected
              ? 'bg-emerald-900/60 text-emerald-200 border-emerald-700'
              : 'bg-[#505050] text-zinc-300 border-[#383838]'
          }`}
          title={gamepad ? `Gamepad: ${gamepad.id}` : 'Keyboard controls active'}
        >
          {gamepad?.connected ? (
            <>
              <Gamepad2 className="w-3 h-3 text-emerald-300 shrink-0" />
              <span className="truncate">PAD</span>
            </>
          ) : (
            <>
              <Keyboard className="w-3 h-3 text-zinc-300 shrink-0" />
              <span>KEYS</span>
            </>
          )}
        </div>
      </div>
    </aside>
  );
};
