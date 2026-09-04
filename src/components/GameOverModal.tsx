/**
 * Battle City 1990 - Score Tally & Game Over / Victory Modal
 * Lists authentic NES breakdown of tanks destroyed, points earned,
 * and high score with replay / next stage buttons.
 */

import React, { useEffect, useState, useRef } from 'react';
import { GameScore } from '../types';
import { soundManager } from '../engine/SoundManager';
import { gamepadManager } from '../engine/GamepadManager';
import { Trophy, RotateCcw, ArrowRight, Home } from 'lucide-react';

interface GameOverModalProps {
  isVictory: boolean;
  scoreData: GameScore;
  onNextStage?: () => void;
  onRetry: () => void;
  onReturnToMenu: () => void;
}

export const GameOverModal: React.FC<GameOverModalProps> = ({
  isVictory,
  scoreData,
  onNextStage,
  onRetry,
  onReturnToMenu,
}) => {
  const [revealedIdx, setRevealedIdx] = useState<number>(0);
  const [selectedBtnIdx, setSelectedBtnIdx] = useState<number>(0);

  const breakdown = [
    {
      type: 'BASIC',
      name: 'BASIC TANK',
      pts: 100,
      count: scoreData.destroyedEnemies.BASIC,
      color: '#a4a4a4',
    },
    {
      type: 'FAST',
      name: 'FAST TANK',
      pts: 200,
      count: scoreData.destroyedEnemies.FAST,
      color: '#58b8d8',
    },
    {
      type: 'POWER',
      name: 'POWER TANK',
      pts: 300,
      count: scoreData.destroyedEnemies.POWER,
      color: '#f8d838',
    },
    {
      type: 'ARMOR',
      name: 'ARMOR TANK',
      pts: 400,
      count: scoreData.destroyedEnemies.ARMOR,
      color: '#00a800',
    },
  ];

  const totalKills =
    scoreData.destroyedEnemies.BASIC +
    scoreData.destroyedEnemies.FAST +
    scoreData.destroyedEnemies.POWER +
    scoreData.destroyedEnemies.ARMOR;

  // Staggered reveal sound effects like NES Battle City tally!
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (revealedIdx < breakdown.length) {
      timer = setTimeout(() => {
        soundManager.playHitBrick();
        setRevealedIdx((prev) => prev + 1);
      }, 350);
    }
    return () => clearTimeout(timer);
  }, [revealedIdx, breakdown.length]);

  const actionButtons = [
    ...(isVictory && onNextStage ? [{ id: 'next', label: 'NEXT STAGE', action: onNextStage }] : []),
    { id: 'retry', label: isVictory ? 'REPLAY' : 'RETRY', action: onRetry },
    { id: 'menu', label: 'MENU', action: onReturnToMenu },
  ];

  const actionButtonsRef = useRef(actionButtons);
  actionButtonsRef.current = actionButtons;

  const selectedBtnIdxRef = useRef(selectedBtnIdx);
  selectedBtnIdxRef.current = selectedBtnIdx;

  const onReturnToMenuRef = useRef(onReturnToMenu);
  onReturnToMenuRef.current = onReturnToMenu;

  // Gamepad & Keyboard Navigation on GameOver Screen
  useEffect(() => {
    let animId: number;
    let prevLeft = false;
    let prevRight = false;
    let prevUp = false;
    let prevDown = false;
    let prevConfirm = false;
    let prevCancel = false;
    let prevStart = false;
    let holdTimer = 0;
    let heldDirection: 'prev' | 'next' | null = null;

    const INITIAL_HOLD_DELAY = 450;
    const REPEAT_RATE = 250;

    let initialized = false;
    let mountCooldownUntil = 0;

    const poll = (time: number) => {
      const pad = gamepadManager.pollMenuInput();
      if (pad) {
        if (pad.anyButton) {
          soundManager.unlockAudio();
        }

        // Absorb button holds from gameplay upon modal mount
        if (!initialized) {
          initialized = true;
          mountCooldownUntil = time + 300;
          prevConfirm = pad.confirm;
          prevStart = pad.start;
          prevCancel = pad.cancel;
          prevLeft = pad.left;
          prevRight = pad.right;
          prevUp = pad.up;
          prevDown = pad.down;
          animId = requestAnimationFrame(poll);
          return;
        }

        const isPrev = pad.left || pad.up;
        const isNext = pad.right || pad.down;

        const wasPrev = prevLeft || prevUp;
        const wasNext = prevRight || prevDown;

        // Fresh press
        if (isPrev && !wasPrev) {
          heldDirection = 'prev';
          holdTimer = time + INITIAL_HOLD_DELAY;
          soundManager.playMenuMove();
          setSelectedBtnIdx((prev) => (prev > 0 ? prev - 1 : actionButtonsRef.current.length - 1));
        } else if (isNext && !wasNext) {
          heldDirection = 'next';
          holdTimer = time + INITIAL_HOLD_DELAY;
          soundManager.playMenuMove();
          setSelectedBtnIdx((prev) => (prev < actionButtonsRef.current.length - 1 ? prev + 1 : 0));
        } else if (heldDirection === 'prev' && isPrev) {
          if (time >= holdTimer) {
            holdTimer = time + REPEAT_RATE;
            soundManager.playMenuMove();
            setSelectedBtnIdx((prev) => (prev > 0 ? prev - 1 : actionButtonsRef.current.length - 1));
          }
        } else if (heldDirection === 'next' && isNext) {
          if (time >= holdTimer) {
            holdTimer = time + REPEAT_RATE;
            soundManager.playMenuMove();
            setSelectedBtnIdx((prev) => (prev < actionButtonsRef.current.length - 1 ? prev + 1 : 0));
          }
        } else if (!isPrev && !isNext) {
          heldDirection = null;
          holdTimer = 0;
        }

        prevLeft = pad.left;
        prevRight = pad.right;
        prevUp = pad.up;
        prevDown = pad.down;

        // Confirm: Button 0 (A) or Button 2 (X) activates the selected button
        const confirmPressed = pad.confirm;
        const confirmTrigger = confirmPressed && !prevConfirm;
        prevConfirm = confirmPressed;

        if (confirmTrigger && time >= mountCooldownUntil) {
          soundManager.playMenuSelect();
          actionButtonsRef.current[selectedBtnIdxRef.current]?.action();
        }

        // Physical Menu / Start button (Button 9) OR Cancel (Button 1 / B) exits directly to Menu
        const startPressed = pad.start;
        const startTrigger = startPressed && !prevStart;
        prevStart = startPressed;

        const cancelPressed = pad.cancel;
        const cancelTrigger = cancelPressed && !prevCancel;
        prevCancel = cancelPressed;

        if ((startTrigger || cancelTrigger) && time >= mountCooldownUntil) {
          soundManager.playMenuMove();
          onReturnToMenuRef.current();
        }
      } else {
        prevLeft = false;
        prevRight = false;
        prevUp = false;
        prevDown = false;
        heldDirection = null;
        prevConfirm = false;
        prevStart = false;
        prevCancel = false;
      }

      animId = requestAnimationFrame(poll);
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      e.stopPropagation();

      if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A' || e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') {
        e.preventDefault();
        setSelectedBtnIdx((prev) => (prev > 0 ? prev - 1 : actionButtonsRef.current.length - 1));
        soundManager.playMenuMove();
      } else if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D' || e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') {
        e.preventDefault();
        setSelectedBtnIdx((prev) => (prev < actionButtonsRef.current.length - 1 ? prev + 1 : 0));
        soundManager.playMenuMove();
      } else if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        soundManager.playMenuSelect();
        actionButtonsRef.current[selectedBtnIdxRef.current]?.action();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        soundManager.playMenuMove();
        onReturnToMenuRef.current();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    animId = requestAnimationFrame(poll);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      cancelAnimationFrame(animId);
    };
  }, []);

  return (
    <div
      id="game-over-modal-container"
      className="flex flex-col items-center justify-between w-full max-w-lg mx-auto bg-black border-4 border-[#484848] p-6 text-white font-pixel select-none shadow-2xl"
    >
      {/* Stage & Header */}
      <div className="w-full flex items-center justify-between border-b border-zinc-800 pb-3 text-xs">
        <span className="text-[#f8b800]">HI-SCORE {scoreData.highScore}</span>
        <span className="text-zinc-300">STAGE {scoreData.stage}</span>
      </div>

      {/* Main Title Banner */}
      <div className="my-5 text-center">
        {isVictory ? (
          <h2 className="text-2xl sm:text-3xl font-extrabold text-[#f8b800] tracking-widest animate-pulse drop-shadow-[0_4px_0_#704000]">
            STAGE CLEAR!
          </h2>
        ) : (
          <h2 className="text-2xl sm:text-3xl font-extrabold text-red-600 tracking-widest drop-shadow-[0_4px_0_#400000]">
            GAME OVER
          </h2>
        )}
        <div className="text-[10px] text-zinc-400 mt-1">
          {isVictory ? 'ALL ENEMY TANKS DESTROYED!' : 'THE BASE EAGLE FELL IN BATTLE'}
        </div>
      </div>

      {/* Score Breakdown Table */}
      <div className="w-full bg-[#181818] border border-zinc-700 p-4 rounded flex flex-col gap-3 text-xs mb-4">
        <div className="text-center text-[10px] text-zinc-400 border-b border-zinc-800 pb-1">
          -- SCORE BREAKDOWN --
        </div>

        {breakdown.map((item, idx) => {
          const isRevealed = idx < revealedIdx;
          const totalPoints = item.count * item.pts;

          return (
            <div
              key={item.type}
              className={`flex items-center justify-between transition-opacity duration-200 ${
                isRevealed ? 'opacity-100' : 'opacity-0'
              }`}
            >
              <div className="flex items-center gap-3">
                <span className="text-white font-bold w-6 text-right">
                  {item.count}
                </span>
                <span className="text-zinc-400 text-[10px]">PTS</span>
                <div
                  className="w-3 h-3 rounded-xs border border-white/40"
                  style={{ backgroundColor: item.color }}
                />
                <span className="text-zinc-300 text-[10px] tracking-wider">
                  {item.name}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <svg viewBox="0 0 16 16" className="w-3.5 h-3.5 fill-red-500">
                  <path d="M8 2 L10 6 L14 7 L11 10 L12 14 L8 12 L4 14 L5 10 L2 7 L6 6 Z" />
                </svg>
              </div>

              <div className="text-right text-[#f8b800] font-bold w-20">
                {totalPoints}
              </div>
            </div>
          );
        })}

        {/* Total Summary Row */}
        <div className="border-t border-zinc-700 pt-2 flex items-center justify-between text-xs mt-1">
          <span className="text-zinc-300">TOTAL KILLS</span>
          <span className="text-white font-bold">{totalKills}</span>
        </div>

        <div className="flex items-center justify-between text-sm border-t border-zinc-800 pt-2">
          <span className="text-[#f8b800] font-bold">TOTAL SCORE</span>
          <span className="text-white font-extrabold tracking-wider">{scoreData.score}</span>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="w-full flex flex-wrap gap-2 items-center justify-center pt-2">
        {actionButtons.map((btn, idx) => {
          const isSelected = selectedBtnIdx === idx;
          const isPrimary = btn.id === 'next';
          const isRetry = btn.id === 'retry';

          return (
            <button
              key={btn.id}
              id={`btn-score-${btn.id}`}
              onClick={() => {
                soundManager.playMenuSelect();
                btn.action();
              }}
              onMouseEnter={() => {
                setSelectedBtnIdx(idx);
                soundManager.playMenuMove();
              }}
              className={`flex-1 min-w-[130px] flex items-center justify-center gap-1.5 py-2.5 px-3 rounded text-[10px] font-pixel border transition-all cursor-pointer ${
                isPrimary
                  ? 'bg-green-600 hover:bg-green-500 text-white border-green-400 shadow-md'
                  : isRetry
                  ? 'bg-amber-600 hover:bg-amber-500 text-white border-amber-400 shadow-md'
                  : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border-zinc-600'
              } ${
                isSelected
                  ? 'ring-2 ring-[#f8b800] ring-offset-2 ring-offset-black scale-105 shadow-xl'
                  : 'opacity-90'
              }`}
            >
              {isPrimary && <ArrowRight className="w-3.5 h-3.5 order-2" />}
              {isRetry && <RotateCcw className="w-3.5 h-3.5" />}
              {btn.id === 'menu' && <Home className="w-3.5 h-3.5" />}
              <span>{btn.label}</span>
            </button>
          );
        })}
      </div>

      {/* Controller Guide Legend */}
      <div className="w-full text-center pt-2.5 mt-1 text-[8px] sm:text-[9px] text-zinc-400 border-t border-zinc-800 tracking-wider flex items-center justify-center flex-wrap gap-x-2 gap-y-1">
        <span>[D-PAD / STICK] SELECT</span>
        <span>•</span>
        <span>[A / ENTER] CONFIRM</span>
        <span>•</span>
        <span>[B / MENU] TITLE SCREEN</span>
      </div>
    </div>
  );
};
