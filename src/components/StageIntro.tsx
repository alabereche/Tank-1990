/**
 * Battle City 1990 - Authentic NES Stage Briefing Curtain Banner
 * Faithful retro arcade curtain with "STAGE X", authentic NES jingle,
 * clean retro pixel typography, and seamless stage selection.
 * Pure 1990 arcade aesthetic with zero modern emojis or out-of-place elements.
 */

import React, { useEffect, useRef } from 'react';
import { soundManager } from '../engine/SoundManager';
import { gamepadManager } from '../engine/GamepadManager';
import { STAGES_METADATA } from '../engine/maps';

interface StageIntroProps {
  stage: number;
  onSelectStage?: (stage: number) => void;
  onComplete: () => void;
}

export const StageIntro: React.FC<StageIntroProps> = ({ stage, onSelectStage, onComplete }) => {
  const stageMod = ((stage - 1) % 10);
  const meta = STAGES_METADATA[stageMod] || STAGES_METADATA[0];
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const stageRef = useRef(stage);
  stageRef.current = stage;

  const onSelectStageRef = useRef(onSelectStage);
  onSelectStageRef.current = onSelectStage;

  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  useEffect(() => {
    // Unconditionally stop menu BGM when entering stage intro
    soundManager.stopMenuMusic();
    soundManager.unlockAudio();
    soundManager.playStageStart();

    timerRef.current = setTimeout(() => {
      onCompleteRef.current();
    }, 2800);

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === ' ' || e.key === 'Enter') {
        if (timerRef.current) clearTimeout(timerRef.current);
        onCompleteRef.current();
      } else if (e.key === 'ArrowLeft' || e.key === 'a') {
        if (onSelectStageRef.current) {
          const current = stageRef.current;
          const prevStage = current > 1 ? current - 1 : 10;
          onSelectStageRef.current(prevStage);
          soundManager.playMenuMove();
          if (timerRef.current) clearTimeout(timerRef.current);
          timerRef.current = setTimeout(onCompleteRef.current, 3500);
        }
      } else if (e.key === 'ArrowRight' || e.key === 'd') {
        if (onSelectStageRef.current) {
          const current = stageRef.current;
          const nextStage = current < 10 ? current + 1 : 1;
          onSelectStageRef.current(nextStage);
          soundManager.playMenuMove();
          if (timerRef.current) clearTimeout(timerRef.current);
          timerRef.current = setTimeout(onCompleteRef.current, 3500);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  // Controller / Gamepad Navigation in Stage Intro (Calm edge-triggered input)
  useEffect(() => {
    let animId: number;
    let prevLeft = false;
    let prevRight = false;
    let prevConfirm = false;

    const poll = () => {
      const pad = gamepadManager.pollMenuInput();
      if (pad) {
        if (pad.anyButton) {
          soundManager.unlockAudio();
        }

        const isLeft = pad.left;
        const isRight = pad.right;

        // Fresh press for Left / Right
        if (isLeft && !prevLeft && onSelectStageRef.current) {
          const current = stageRef.current;
          const prevStage = current > 1 ? current - 1 : 10;
          onSelectStageRef.current(prevStage);
          soundManager.playMenuMove();
          if (timerRef.current) clearTimeout(timerRef.current);
          timerRef.current = setTimeout(onCompleteRef.current, 3500);
        } else if (isRight && !prevRight && onSelectStageRef.current) {
          const current = stageRef.current;
          const nextStage = current < 10 ? current + 1 : 1;
          onSelectStageRef.current(nextStage);
          soundManager.playMenuMove();
          if (timerRef.current) clearTimeout(timerRef.current);
          timerRef.current = setTimeout(onCompleteRef.current, 3500);
        }

        prevLeft = isLeft;
        prevRight = isRight;

        // Fresh press for Confirm (A / Start / X)
        const confirmPressed = pad.confirm || pad.start;
        const confirmTrigger = confirmPressed && !prevConfirm;
        prevConfirm = confirmPressed;

        if (confirmTrigger) {
          if (timerRef.current) clearTimeout(timerRef.current);
          onCompleteRef.current();
        }
      } else {
        prevLeft = false;
        prevRight = false;
        prevConfirm = false;
      }
      animId = requestAnimationFrame(poll);
    };

    animId = requestAnimationFrame(poll);
    return () => cancelAnimationFrame(animId);
  }, []);

  return (
    <div
      id="stage-intro-curtain"
      onClick={onComplete}
      className="flex flex-col items-center justify-center w-full max-w-xl mx-auto h-[480px] bg-[#282828] border-4 border-[#505050] shadow-2xl font-pixel select-none cursor-pointer relative overflow-hidden px-6"
    >
      {/* Retro Curtains CRT Scanline Texture */}
      <div className="absolute inset-0 scanlines opacity-25 pointer-events-none" />

      <div className="relative z-10 flex flex-col items-center gap-5 text-center max-w-md animate-fade-in">
        {/* Authentic NES Stage Number Banner */}
        <div className="flex items-center justify-center gap-4">
          {onSelectStage && (
            <button
              id="btn-intro-prev-stage"
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                const prevStage = stage > 1 ? stage - 1 : 10;
                onSelectStage(prevStage);
                soundManager.playMenuMove();
                if (timerRef.current) clearTimeout(timerRef.current);
                timerRef.current = setTimeout(onComplete, 3500);
              }}
              className="text-[#f8b800] hover:text-yellow-300 text-lg sm:text-xl font-bold px-2.5 py-1 bg-black/60 hover:bg-black/90 rounded border border-zinc-700 hover:border-amber-400 transition-all active:scale-95"
              title="Previous Stage"
            >
              ◀
            </button>
          )}

          <div className="text-white text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-widest drop-shadow-[0_4px_0_#000000]">
            STAGE {stage.toString().padStart(2, ' ')}
          </div>

          {onSelectStage && (
            <button
              id="btn-intro-next-stage"
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                const nextStage = stage < 10 ? stage + 1 : 1;
                onSelectStage(nextStage);
                soundManager.playMenuMove();
                if (timerRef.current) clearTimeout(timerRef.current);
                timerRef.current = setTimeout(onComplete, 3500);
              }}
              className="text-[#f8b800] hover:text-yellow-300 text-lg sm:text-xl font-bold px-2.5 py-1 bg-black/60 hover:bg-black/90 rounded border border-zinc-700 hover:border-amber-400 transition-all active:scale-95"
              title="Next Stage"
            >
              ▶
            </button>
          )}
        </div>

        {/* Clean Retro Stage Name in Authentic Pixel Gold */}
        <div className="text-lg sm:text-xl font-bold text-[#f8b800] tracking-widest drop-shadow-[0_2px_0_#000000] border-t border-b border-zinc-700/80 py-2 w-full">
          {meta.name.toUpperCase()}
        </div>

        {/* Subtle English Tactical Subtitle */}
        <div className="text-[10px] sm:text-[11px] text-zinc-400 tracking-wider font-mono">
          {meta.subtitle.toUpperCase()}
        </div>

        {/* Authentic Arcade Deployment Prompt */}
        <div className="mt-4 text-[10px] sm:text-xs text-amber-400 tracking-widest font-bold animate-pulse drop-shadow">
          ▶ PRESS START OR SPACE TO DEPLOY ◀
        </div>
      </div>
    </div>
  );
};
