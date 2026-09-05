/**
 * Battle City 1990 - 1v1 Versus Round Flow Overlays
 * CS-style banners: ROUND N intro, round-winner reveal, and the match
 * result panel (first to 7 round wins takes the match).
 */

import React, { useState, useEffect, useRef } from 'react';
import { GameScore, GameState, MultiplayerMode } from '../types';
import { Trophy, RotateCcw, LogOut, Swords } from 'lucide-react';
import { soundManager } from '../engine/SoundManager';
import { gamepadManager } from '../engine/GamepadManager';

const GOLD = '#f8b800';
const GREEN = '#00d860';
const BLUE = '#4a9eff';
const RED = '#ff4a4a';

const TankIcon: React.FC<{ color: string; core: string; size?: number }> = ({ color, core, size = 7 }) => (
  <svg viewBox="0 0 16 16" width={size} height={size} style={{ fill: color }}>
    <rect x="1" y="2" width="3" height="12" />
    <rect x="12" y="2" width="3" height="12" />
    <rect x="4" y="4" width="8" height="8" />
    <rect x="7" y="0" width="2" height="5" />
    <rect x="6" y="6" width="4" height="4" fill={core} />
  </svg>
);

const Scoreline: React.FC<{ scoreData: GameScore; big?: boolean; is2v2?: boolean }> = ({ scoreData, big, is2v2 }) => {
  if (is2v2) {
    return (
      <div className={`flex items-center gap-4 font-mono font-bold ${big ? 'text-3xl' : 'text-xl'}`}>
        <span className="flex items-center gap-2" style={{ color: BLUE }}>
          <TankIcon color={BLUE} core="#ffffff" size={big ? 10 : 8} />
          <span>A: {scoreData.teamWinsA ?? 0}</span>
        </span>
        <span className="text-zinc-500 text-xs">:</span>
        <span className="flex items-center gap-2" style={{ color: RED }}>
          <span>{scoreData.teamWinsB ?? 0} :B</span>
          <TankIcon color={RED} core="#ffffff" size={big ? 10 : 8} />
        </span>
      </div>
    );
  }
  return (
    <div className={`flex items-center gap-4 font-mono font-bold ${big ? 'text-3xl' : 'text-xl'}`}>
      <span className="flex items-center gap-2" style={{ color: GOLD }}>
        <TankIcon color={GOLD} core="#fff" size={big ? 10 : 8} />
        {scoreData.roundWinsP1 ?? 0}
      </span>
      <span className="text-zinc-500 text-xs">:</span>
      <span className="flex items-center gap-2" style={{ color: GREEN }}>
        {scoreData.roundWinsP2 ?? 0}
        <TankIcon color={GREEN} core="#c8ffc8" size={big ? 10 : 8} />
      </span>
    </div>
  );
};

export const RoundBanner: React.FC<{ state: GameState; scoreData: GameScore; mode?: MultiplayerMode; defenderSlot?: number; mySlot?: number }> = ({ state, scoreData, mode, defenderSlot, mySlot }) => {
  const isIntro = state === GameState.ROUND_INTRO;
  const is2v2 = mode === '2v2' || scoreData.teamWinsA !== undefined;
  const winner = scoreData.roundWinner ?? 0;
  const teamWinner = scoreData.teamWinner;
  // 1v1 alternating eagle: personal objective for this round
  const myRole =
    mode === 'versus' && defenderSlot && mySlot
      ? mySlot === defenderSlot
        ? 'DEFEND'
        : 'ATTACK'
      : null;

  return (
    <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 bg-black/70 font-pixel select-none">
      <div className="w-4/5 max-w-md border-4 border-double border-[#3a3a3a] bg-[#101010]/95 px-6 py-5 flex flex-col items-center gap-3 shadow-2xl">
        {isIntro ? (
          <>
            <div className="flex items-center gap-2 text-zinc-300 text-sm tracking-widest">
              <Swords className="w-4 h-4 text-red-400" />
              ROUND {scoreData.roundNumber ?? 1}
            </div>
            <Scoreline scoreData={scoreData} is2v2={is2v2} />
            {myRole && (
              <div
                className="flex items-center gap-2 text-xs tracking-widest"
                style={{ color: myRole === 'DEFEND' ? '#58b8d8' : '#f87858' }}
              >
                {myRole === 'DEFEND' ? '[DEFEND] YOUR EAGLE' : '[DESTROY] THE ENEMY EAGLE'}
              </div>
            )}
            <div className="text-[9px] text-zinc-500 tracking-widest animate-pulse">
              {is2v2 ? '2V2 TEAM BATTLE — FIRST TO 5 WINS' : 'GET READY — FIRST TO 7 WINS'}
            </div>
          </>
        ) : (
          <>
            {is2v2 ? (
              teamWinner === 'DRAW' ? (
                <div className="text-amber-300 text-sm tracking-widest">ROUND DRAW!</div>
              ) : (
                <div
                  className="text-base tracking-widest"
                  style={{ color: teamWinner === 'A' ? BLUE : RED, textShadow: '0 0 12px currentColor' }}
                >
                  TEAM {teamWinner} WINS THE ROUND!
                </div>
              )
            ) : winner === 0 ? (
              <div className="text-amber-300 text-sm tracking-widest">DRAW!</div>
            ) : (
              <div
                className="text-base tracking-widest"
                style={{ color: winner === 1 ? GOLD : GREEN, textShadow: '0 0 12px currentColor' }}
              >
                {winner === 1 ? 'PLAYER 1' : 'PLAYER 2'} WINS THE ROUND!
              </div>
            )}
            <Scoreline scoreData={scoreData} is2v2={is2v2} />
            <div className="text-[9px] text-zinc-500 tracking-widest">
              {(is2v2 ? teamWinner === 'DRAW' : winner === 0) ? 'ROUND WILL BE REPLAYED' : 'NEXT ROUND STARTING...'}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export const MatchEndPanel: React.FC<{
  scoreData: GameScore;
  isHost: boolean;
  onRematch: () => void;
  onExit: () => void;
  mode?: MultiplayerMode;
}> = ({ scoreData, isHost, onRematch, onExit, mode }) => {
  const is2v2 = mode === '2v2' || scoreData.teamWinsA !== undefined;
  const isFfa = mode === 'ffa' || scoreData.ffaWinner !== undefined;
  const teamWin = (scoreData.teamWinsA ?? 0) >= (scoreData.teamWinsB ?? 0) ? 'A' : 'B';
  const winner = scoreData.matchWinner ?? 1;
  // FFA slot body colors mirror the engine's 8 palettes (spriteRenderer)
  const ffaColors = ['#f8b800', '#00a800', '#00a8a8', '#e40058', '#940088', '#f87800', '#b8b8b8', '#78d800'];
  const ffaSlot = scoreData.ffaWinner ?? 1;
  const color = isFfa ? ffaColors[(ffaSlot - 1) % 8] : is2v2 ? (teamWin === 'A' ? BLUE : RED) : winner === 1 ? GOLD : GREEN;
  const ffaKills = scoreData.playerStats?.[ffaSlot]?.kills ?? 0;

  // Selection & Focus Navigation (0 = REMATCH, 1 = EXIT TO MENU)
  const [selectedIdx, setSelectedIdx] = useState<number>(0);
  const selectedIdxRef = useRef<number>(0);
  selectedIdxRef.current = selectedIdx;

  const onRematchRef = useRef(onRematch);
  onRematchRef.current = onRematch;
  const onExitRef = useRef(onExit);
  onExitRef.current = onExit;

  // Keyboard Navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      if (key === 'arrowleft' || key === 'arrowup' || key === 'a' || key === 'w') {
        if (isHost) {
          e.preventDefault();
          setSelectedIdx((prev) => {
            const next = prev === 0 ? 1 : 0;
            soundManager.playMenuMove();
            return next;
          });
        }
      } else if (key === 'arrowright' || key === 'arrowdown' || key === 'd' || key === 's' || key === 'tab') {
        if (isHost) {
          e.preventDefault();
          setSelectedIdx((prev) => {
            const next = prev === 1 ? 0 : 1;
            soundManager.playMenuMove();
            return next;
          });
        }
      } else if (key === 'enter' || key === ' ') {
        e.preventDefault();
        soundManager.playMenuSelect();
        if (isHost && selectedIdxRef.current === 0) {
          onRematchRef.current();
        } else {
          onExitRef.current();
        }
      } else if (key === 'escape' || key === 'backspace') {
        e.preventDefault();
        soundManager.playMenuSelect();
        onExitRef.current();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isHost]);

  // Controller / Gamepad Navigation (Seamless Dual-Pad & Single-Pad Support)
  useEffect(() => {
    let animId: number;
    let initialized = false;
    let mountCooldownUntil = 0;

    let prevLeft = false;
    let prevRight = false;
    let prevConfirm = false;
    let prevCancel = false;

    let heldDirection: 'left' | 'right' | null = null;
    let holdTimer = 0;
    const INITIAL_HOLD_DELAY = 350;
    const REPEAT_RATE = 180;

    const poll = (time: number) => {
      const pad = gamepadManager.pollMenuInput();
      if (pad) {
        if (pad.anyButton) {
          soundManager.unlockAudio();
        }

        // On mount, absorb initial holds from intense gameplay upon modal appear
        if (!initialized) {
          initialized = true;
          mountCooldownUntil = time + 350;
          prevConfirm = Boolean(pad.confirm || pad.start);
          prevCancel = Boolean(pad.cancel);
          prevLeft = Boolean(pad.left || pad.up);
          prevRight = Boolean(pad.right || pad.down);
          animId = requestAnimationFrame(poll);
          return;
        }

        if (time >= mountCooldownUntil) {
          const isLeft = Boolean(pad.left || pad.up);
          const isRight = Boolean(pad.right || pad.down);

          // Fresh Directional Press
          if (isLeft && !prevLeft) {
            heldDirection = 'left';
            holdTimer = time + INITIAL_HOLD_DELAY;
            if (isHost) {
              setSelectedIdx((prev) => (prev === 0 ? 1 : 0));
              soundManager.playMenuMove();
            }
          } else if (isRight && !prevRight) {
            heldDirection = 'right';
            holdTimer = time + INITIAL_HOLD_DELAY;
            if (isHost) {
              setSelectedIdx((prev) => (prev === 1 ? 0 : 1));
              soundManager.playMenuMove();
            }
          } else if (heldDirection === 'left' && isLeft) {
            if (time >= holdTimer) {
              holdTimer = time + REPEAT_RATE;
              if (isHost) {
                setSelectedIdx((prev) => (prev === 0 ? 1 : 0));
                soundManager.playMenuMove();
              }
            }
          } else if (heldDirection === 'right' && isRight) {
            if (time >= holdTimer) {
              holdTimer = time + REPEAT_RATE;
              if (isHost) {
                setSelectedIdx((prev) => (prev === 1 ? 0 : 1));
                soundManager.playMenuMove();
              }
            }
          } else if (!isLeft && !isRight) {
            heldDirection = null;
          }

          // Confirm: A / X / Start
          const isConfirm = Boolean(pad.confirm || pad.start);
          if (isConfirm && !prevConfirm) {
            soundManager.playMenuSelect();
            if (isHost && selectedIdxRef.current === 0) {
              onRematchRef.current();
            } else {
              onExitRef.current();
            }
          }

          // Cancel: B / Circle
          const isCancel = Boolean(pad.cancel);
          if (isCancel && !prevCancel) {
            soundManager.playMenuSelect();
            onExitRef.current();
          }

          prevLeft = isLeft;
          prevRight = isRight;
          prevConfirm = isConfirm;
          prevCancel = isCancel;
        }
      }

      animId = requestAnimationFrame(poll);
    };

    animId = requestAnimationFrame(poll);
    return () => cancelAnimationFrame(animId);
  }, [isHost]);

  return (
    <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-black/85 font-pixel select-none">
      <div className="w-11/12 max-w-lg border-4 border-[#3a3a3a] bg-[#101010] px-6 py-6 flex flex-col items-center gap-4 shadow-2xl">
        <Trophy className="w-10 h-10" style={{ color, filter: `drop-shadow(0 0 10px ${color})` }} />
        <div className="text-lg tracking-widest text-center" style={{ color, textShadow: '0 0 14px currentColor' }}>
          {isFfa ? `PLAYER ${ffaSlot}` : is2v2 ? `TEAM ${teamWin}` : winner === 1 ? 'PLAYER 1' : 'PLAYER 2'}
          <br />
          WINS THE MATCH!
        </div>
        {isFfa ? (
          <div className="font-mono font-bold text-3xl" style={{ color }}>
            {ffaKills} KILLS
          </div>
        ) : (
          <Scoreline scoreData={scoreData} big is2v2={is2v2} />
        )}
        <div className="text-[9px] text-zinc-500 tracking-widest">
          {isFfa ? 'KILL TARGET REACHED' : is2v2 ? 'FIRST TO 5 ROUNDS ACHIEVED' : 'FIRST TO 7 ROUNDS ACHIEVED'}
        </div>

        <div className="flex items-center gap-4 mt-2">
          {isHost ? (
            <button
              onClick={() => {
                soundManager.playMenuSelect();
                onRematch();
              }}
              onMouseEnter={() => setSelectedIdx(0)}
              className={`flex items-center gap-2 px-5 py-2.5 rounded text-[11px] font-bold tracking-wider transition-all duration-150 active:translate-y-px ${
                selectedIdx === 0
                  ? 'bg-emerald-500 text-black border-2 border-white ring-4 ring-emerald-400 ring-offset-2 ring-offset-black scale-105 shadow-[0_0_20px_rgba(16,185,129,0.7)]'
                  : 'bg-emerald-800 hover:bg-emerald-700 border-2 border-emerald-500 text-emerald-100 opacity-80 hover:opacity-100'
              }`}
            >
              {selectedIdx === 0 && <span className="text-white animate-pulse">▶</span>}
              <RotateCcw className={`w-3.5 h-3.5 ${selectedIdx === 0 ? 'animate-spin-slow text-black' : ''}`} />
              REMATCH
            </button>
          ) : (
            <span className="text-[9px] text-zinc-400 animate-pulse px-4 py-2 border border-zinc-700 rounded">
              WAITING FOR HOST...
            </span>
          )}
          <button
            onClick={() => {
              soundManager.playMenuSelect();
              onExit();
            }}
            onMouseEnter={() => setSelectedIdx(isHost ? 1 : 0)}
            className={`flex items-center gap-2 px-5 py-2.5 rounded text-[11px] font-bold tracking-wider transition-all duration-150 active:translate-y-px ${
              (isHost ? selectedIdx === 1 : selectedIdx === 0)
                ? 'bg-amber-400 text-black border-2 border-white ring-4 ring-amber-400 ring-offset-2 ring-offset-black scale-105 shadow-[0_0_20px_rgba(245,158,11,0.7)]'
                : 'bg-[#383838] hover:bg-[#484848] border-2 border-[#666] text-zinc-300 opacity-80 hover:opacity-100'
            }`}
          >
            {(isHost ? selectedIdx === 1 : selectedIdx === 0) && <span className="text-black animate-pulse">▶</span>}
            <LogOut className="w-3.5 h-3.5" />
            EXIT TO MENU
          </button>
        </div>

        {/* Controller & Keyboard Navigation Legend */}
        <div className="flex items-center justify-center gap-3 text-[8px] text-zinc-400 tracking-widest mt-2 pt-3 border-t border-zinc-800/80 w-full font-mono">
          <span className="flex items-center gap-1"><span className="text-amber-400">D-PAD / STICK</span> NAVIGATE</span>
          <span className="text-zinc-600">•</span>
          <span className="flex items-center gap-1"><span className="text-emerald-400">[A / START]</span> SELECT</span>
          <span className="text-zinc-600">•</span>
          <span className="flex items-center gap-1"><span className="text-rose-400">[B]</span> EXIT</span>
        </div>
      </div>
    </div>
  );
};

