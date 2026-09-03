/**
 * Battle City 1990 - Authentic Stage Start Curtain Banner
 * Wipes curtains with "STAGE X" in 8-bit style, playing intro jingle
 */

import React, { useEffect } from 'react';
import { soundManager } from '../engine/SoundManager';

interface StageIntroProps {
  stage: number;
  onComplete: () => void;
}

export const StageIntro: React.FC<StageIntroProps> = ({ stage, onComplete }) => {
  useEffect(() => {
    soundManager.unlockAudio();
    soundManager.playStageStart();

    const timer = setTimeout(() => {
      onComplete();
    }, 1800);

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === ' ' || e.key === 'Enter') {
        clearTimeout(timer);
        onComplete();
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      clearTimeout(timer);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [stage, onComplete]);

  return (
    <div
      id="stage-intro-curtain"
      onClick={onComplete}
      className="flex flex-col items-center justify-center w-full max-w-lg mx-auto h-[480px] bg-[#636363] border-4 border-[#303030] shadow-2xl font-pixel select-none cursor-pointer"
    >
      <div className="flex flex-col items-center gap-4 animate-bounce">
        <div className="text-black text-2xl sm:text-3xl font-extrabold tracking-widest">
          STAGE {stage}
        </div>
        <div className="text-[10px] text-zinc-800 tracking-wider">
          GET READY!
        </div>
      </div>
    </div>
  );
};
