/**
 * Battle City 1990 - Retro Arcade In-Game Pause Menu
 * Displays RESUME and QUIT TO MENU options when game is paused/frozen.
 * Fully navigable via Gamepad (D-pad, Left Stick, A, B, Start) and Keyboard.
 */

import React, { useEffect, useState, useRef } from 'react';
import { soundManager } from '../engine/SoundManager';
import { gamepadManager } from '../engine/GamepadManager';
import { Play, LogOut, AlertTriangle } from 'lucide-react';

interface PauseModalProps {
  onResume: () => void;
  onQuit: () => void;
  isOnlineGuest?: boolean;
  initialFocusQuit?: boolean;
}

export const PauseModal: React.FC<PauseModalProps> = ({
  onResume,
  onQuit,
  isOnlineGuest = false,
  initialFocusQuit = false,
}) => {
  // 0: RESUME, 1: QUIT - Default to RESUME (0)
  const [selectedIdx, setSelectedIdx] = useState<number>(initialFocusQuit ? 1 : 0);
  // Confirmation sub-state when QUIT is selected
  const [showConfirmQuit, setShowConfirmQuit] = useState<boolean>(false);
  // 0: YES, 1: NO in confirmation
  const [confirmIdx, setConfirmIdx] = useState<number>(0);

  const selectedIdxRef = useRef(selectedIdx);
  selectedIdxRef.current = selectedIdx;

  const showConfirmQuitRef = useRef(showConfirmQuit);
  showConfirmQuitRef.current = showConfirmQuit;

  const confirmIdxRef = useRef(confirmIdx);
  confirmIdxRef.current = confirmIdx;

  const onResumeRef = useRef(onResume);
  onResumeRef.current = onResume;

  const onQuitRef = useRef(onQuit);
  onQuitRef.current = onQuit;

  // Sound and action handlers
  const handleExecuteResume = () => {
    soundManager.playMenuSelect();
    onResumeRef.current();
  };

  const handleExecuteQuit = () => {
    soundManager.playMenuSelect();
    onQuitRef.current();
  };

  const handlePromptQuit = () => {
    soundManager.playMenuSelect();
    setConfirmIdx(0);
    setShowConfirmQuit(true);
  };

  const handleCancelQuitConfirm = () => {
    soundManager.playMenuMove();
    setShowConfirmQuit(false);
  };

  // Keyboard Navigation Listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();
      soundManager.unlockAudio();

      const key = e.key.toLowerCase();

      if (showConfirmQuitRef.current) {
        // Confirmation mode: YES / NO
        if (key === 'arrowleft' || key === 'a') {
          setConfirmIdx(0);
          soundManager.playMenuMove();
        } else if (key === 'arrowright' || key === 'd') {
          setConfirmIdx(1);
          soundManager.playMenuMove();
        } else if (key === 'enter' || key === ' ') {
          if (confirmIdxRef.current === 0) {
            handleExecuteQuit();
          } else {
            handleCancelQuitConfirm();
          }
        } else if (key === 'escape' || key === 'backspace') {
          handleCancelQuitConfirm();
        }
        return;
      }

      // Main Pause Menu: RESUME / QUIT
      if (key === 'arrowup' || key === 'w') {
        if (selectedIdxRef.current !== 0) {
          setSelectedIdx(0);
          soundManager.playMenuMove();
        }
      } else if (key === 'arrowdown' || key === 's') {
        if (selectedIdxRef.current !== 1) {
          setSelectedIdx(1);
          soundManager.playMenuMove();
        }
      } else if (key === 'enter' || key === ' ') {
        if (selectedIdxRef.current === 0) {
          handleExecuteResume();
        } else {
          handlePromptQuit();
        }
      } else if (key === 'escape' || key === 'p') {
        handleExecuteResume();
      }
    };

    window.addEventListener('keydown', handleKeyDown, { capture: true });
    return () => window.removeEventListener('keydown', handleKeyDown, { capture: true });
  }, []);

  // Gamepad Navigation Loop (D-pad, Left Stick, A/B/Start)
  useEffect(() => {
    let animId: number;
    let initialized = false;
    let mountCooldownUntil = 0;

    let prevUp = false;
    let prevDown = false;
    let prevLeft = false;
    let prevRight = false;
    let prevConfirm = false;
    let prevCancel = false;
    let prevStart = false;

    const poll = (time: number) => {
      const pad = gamepadManager.pollMenuInput();
      if (pad) {
        if (pad.anyButton) {
          soundManager.unlockAudio();
        }

        // On mount, absorb initial holds from the button that paused the game (e.g. Start or Select)
        if (!initialized) {
          initialized = true;
          mountCooldownUntil = time + 250;
          prevConfirm = Boolean(pad.confirm);
          prevCancel = Boolean(pad.cancel);
          prevStart = Boolean(pad.start);
          prevUp = Boolean(pad.up);
          prevDown = Boolean(pad.down);
          prevLeft = Boolean(pad.left);
          prevRight = Boolean(pad.right);
          animId = requestAnimationFrame(poll);
          return;
        }

        // During initial cooldown, continually absorb held buttons so stale triggers don't leak
        if (time < mountCooldownUntil) {
          prevConfirm = Boolean(pad.confirm);
          prevCancel = Boolean(pad.cancel);
          prevStart = Boolean(pad.start);
          prevUp = Boolean(pad.up);
          prevDown = Boolean(pad.down);
          prevLeft = Boolean(pad.left);
          prevRight = Boolean(pad.right);
          animId = requestAnimationFrame(poll);
          return;
        }

        const isUp = Boolean(pad.up);
        const isDown = Boolean(pad.down);
        const isLeft = Boolean(pad.left);
        const isRight = Boolean(pad.right);

        // 1. Directional navigation
        if (showConfirmQuitRef.current) {
          // Confirmation sub-menu: Left = YES (0), Right = NO (1)
          if (isLeft && !prevLeft) {
            setConfirmIdx(0);
            soundManager.playMenuMove();
          } else if (isRight && !prevRight) {
            setConfirmIdx(1);
            soundManager.playMenuMove();
          }
        } else {
          // Main pause menu: UP moves to RESUME (0), DOWN moves to QUIT (1)
          if ((isUp && !prevUp) || (isLeft && !prevLeft)) {
            if (selectedIdxRef.current !== 0) {
              setSelectedIdx(0);
              soundManager.playMenuMove();
            }
          } else if ((isDown && !prevDown) || (isRight && !prevRight)) {
            if (selectedIdxRef.current !== 1) {
              setSelectedIdx(1);
              soundManager.playMenuMove();
            }
          }
        }

        prevUp = isUp;
        prevDown = isDown;
        prevLeft = isLeft;
        prevRight = isRight;

        // 2. Button actions
        const confirmPressed = Boolean(pad.confirm);
        const confirmTrigger = confirmPressed && !prevConfirm;
        prevConfirm = confirmPressed;

        const startPressed = Boolean(pad.start);
        const startTrigger = startPressed && !prevStart;
        prevStart = startPressed;

        const cancelPressed = Boolean(pad.cancel);
        const cancelTrigger = cancelPressed && !prevCancel;
        prevCancel = cancelPressed;

        // START button: Immediately resumes if on pause menu, or cancels quit confirmation
        if (startTrigger) {
          if (showConfirmQuitRef.current) {
            handleCancelQuitConfirm();
          } else {
            handleExecuteResume();
          }
          animId = requestAnimationFrame(poll);
          return;
        }

        // B / CANCEL button: Immediately resumes if on pause menu, or cancels quit confirmation
        if (cancelTrigger) {
          if (showConfirmQuitRef.current) {
            handleCancelQuitConfirm();
          } else {
            handleExecuteResume();
          }
          animId = requestAnimationFrame(poll);
          return;
        }

        // A / CONFIRM button: Executes focused action
        if (confirmTrigger) {
          if (showConfirmQuitRef.current) {
            if (confirmIdxRef.current === 0) {
              handleExecuteQuit();
            } else {
              handleCancelQuitConfirm();
            }
          } else {
            if (selectedIdxRef.current === 0) {
              handleExecuteResume();
            } else {
              handlePromptQuit();
            }
          }
        }
      } else {
        prevUp = false;
        prevDown = false;
        prevLeft = false;
        prevRight = false;
        prevConfirm = false;
        prevCancel = false;
        prevStart = false;
      }

      animId = requestAnimationFrame(poll);
    };

    animId = requestAnimationFrame(poll);
    return () => cancelAnimationFrame(animId);
  }, []);

  return (
    <div
      id="pause-menu-overlay"
      className="absolute inset-0 z-40 flex items-center justify-center bg-black/80 backdrop-blur-[2px] p-4 animate-in fade-in duration-100 select-none"
    >
      <div
        id="pause-menu-content"
        className="relative w-full max-w-[320px] bg-[#1a1a1a] border-4 border-[#606060] rounded p-5 shadow-[0_0_30px_rgba(0,0,0,0.95)] text-white font-pixel flex flex-col items-center"
      >
        {/* Title */}
        <div className="flex flex-col items-center mb-5">
          <span className="text-[#f8b800] text-xl sm:text-2xl tracking-[0.25em] font-bold animate-pulse drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)]">
            PAUSE
          </span>
          {isOnlineGuest && (
            <span className="text-[9px] text-zinc-400 font-mono tracking-widest mt-1">
              ONLINE MATCH (GUEST)
            </span>
          )}
        </div>

        {/* Menu Body */}
        {!showConfirmQuit ? (
          <div className="w-full flex flex-col gap-3 mb-5">
            {/* RESUME Option */}
            <button
              id="pause-btn-resume"
              type="button"
              onClick={handleExecuteResume}
              onMouseEnter={() => {
                if (selectedIdx !== 0) {
                  setSelectedIdx(0);
                  soundManager.playMenuMove();
                }
              }}
              className={`w-full py-3 px-4 rounded border-2 flex items-center justify-between transition-all cursor-pointer ${
                selectedIdx === 0
                  ? 'bg-amber-950/60 border-[#f8b800] text-[#f8b800] scale-[1.03] shadow-[0_0_15px_rgba(248,184,0,0.5)]'
                  : 'bg-[#262626] border-[#454545] text-zinc-300 hover:border-zinc-400'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <span className={`text-xs ${selectedIdx === 0 ? 'text-[#f8b800] animate-bounce' : 'opacity-0'}`}>
                  ▶
                </span>
                <Play className="w-4 h-4 text-emerald-400 shrink-0" />
                <span className="text-xs tracking-widest font-bold">RESUME</span>
              </div>
              <span className="text-[9px] text-zinc-500 font-mono">[A / START / B]</span>
            </button>

            {/* QUIT Option */}
            <button
              id="pause-btn-quit"
              type="button"
              onClick={handlePromptQuit}
              onMouseEnter={() => {
                if (selectedIdx !== 1) {
                  setSelectedIdx(1);
                  soundManager.playMenuMove();
                }
              }}
              className={`w-full py-3 px-4 rounded border-2 flex items-center justify-between transition-all cursor-pointer ${
                selectedIdx === 1
                  ? 'bg-red-950/60 border-red-500 text-red-300 scale-[1.03] shadow-[0_0_15px_rgba(239,68,68,0.5)]'
                  : 'bg-[#262626] border-[#454545] text-zinc-300 hover:border-zinc-400'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <span className={`text-xs ${selectedIdx === 1 ? 'text-red-400 animate-bounce' : 'opacity-0'}`}>
                  ▶
                </span>
                <LogOut className="w-4 h-4 text-red-400 shrink-0" />
                <span className="text-xs tracking-widest font-bold">QUIT</span>
              </div>
              <span className="text-[9px] text-zinc-500 font-mono">[A]</span>
            </button>
          </div>
        ) : (
          /* Confirmation Sub-Modal */
          <div className="w-full flex flex-col items-center bg-[#222] border-2 border-red-800/80 rounded p-4 mb-4 animate-in zoom-in-95 duration-100">
            <div className="flex items-center gap-1.5 text-red-400 font-bold text-xs tracking-wider mb-1">
              <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
              <span>QUIT TO MENU?</span>
            </div>
            <p className="text-[9px] text-zinc-400 text-center mb-4 leading-relaxed font-sans">
              Are you sure you want to exit the current battle?
            </p>

            <div className="w-full grid grid-cols-2 gap-3">
              {/* YES Button */}
              <button
                id="pause-confirm-btn-yes"
                type="button"
                onClick={handleExecuteQuit}
                onMouseEnter={() => setConfirmIdx(0)}
                className={`py-2 px-3 rounded border-2 text-center text-xs tracking-wider font-bold transition-all cursor-pointer ${
                  confirmIdx === 0
                    ? 'bg-red-700 border-red-400 text-white scale-105 shadow-[0_0_12px_rgba(239,68,68,0.8)]'
                    : 'bg-red-950/50 border-red-900 text-red-300 hover:bg-red-900/60'
                }`}
              >
                {confirmIdx === 0 && '▶ '}YES
              </button>

              {/* NO Button */}
              <button
                id="pause-confirm-btn-no"
                type="button"
                onClick={handleCancelQuitConfirm}
                onMouseEnter={() => setConfirmIdx(1)}
                className={`py-2 px-3 rounded border-2 text-center text-xs tracking-wider font-bold transition-all cursor-pointer ${
                  confirmIdx === 1
                    ? 'bg-zinc-700 border-white text-white scale-105 shadow-[0_0_12px_rgba(255,255,255,0.6)]'
                    : 'bg-zinc-800 border-zinc-600 text-zinc-300 hover:bg-zinc-700'
                }`}
              >
                {confirmIdx === 1 && '▶ '}NO
              </button>
            </div>
          </div>
        )}

        {/* Controller / Keyboard Guide Footer */}
        <div className="w-full pt-3 border-t border-[#383838] flex flex-col items-center gap-1 text-[8px] sm:text-[9px] text-zinc-400 font-mono tracking-wider">
          {!showConfirmQuit ? (
            <>
              <div className="flex items-center gap-1.5 text-[#f8b800]">
                <span>[D-PAD] MOVE</span>
                <span>•</span>
                <span>[A / START] SELECT</span>
              </div>
              <div className="text-zinc-500">
                <span>[B] RESUME GAME</span>
              </div>
            </>
          ) : (
            <div className="flex items-center gap-1.5 text-zinc-300">
              <span>[←/→] CHOOSE</span>
              <span>•</span>
              <span>[A] CONFIRM</span>
              <span>•</span>
              <span>[B] CANCEL</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
