/**
 * Battle City 1990 - Responsive Virtual Touch Controls
 * Mobile on-screen 4-way D-Pad and Fire button with multi-touch support
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { InputState } from '../types';
import { SmokeSvg, GrenadeSvg, ShieldSvg } from './TacticalIcons';

interface TouchControlsProps {
  onInput: (input: Partial<InputState>) => void;
  isTouchActive: boolean;
}

export const TouchControls: React.FC<TouchControlsProps> = ({ onInput, isTouchActive }) => {
  const [isTouchDevice, setIsTouchDevice] = useState<boolean>(false);
  const [activeDir, setActiveDir] = useState<string | null>(null);
  const [fireActive, setFireActive] = useState<boolean>(false);
  const currentDirRef = useRef<string | null>(null);

  useEffect(() => {
    // Detect touch support
    if (typeof window !== 'undefined') {
      const hasTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
      setIsTouchDevice(hasTouch || isTouchActive);
    }
  }, [isTouchActive]);

  const handleDirStart = useCallback(
    (dir: 'up' | 'down' | 'left' | 'right') => {
      currentDirRef.current = dir;
      setActiveDir(dir);
      onInput({
        up: dir === 'up',
        down: dir === 'down',
        left: dir === 'left',
        right: dir === 'right',
      });
    },
    [onInput]
  );

  const handleDirEnd = useCallback(() => {
    currentDirRef.current = null;
    setActiveDir(null);
    onInput({
      up: false,
      down: false,
      left: false,
      right: false,
    });
  }, [onInput]);

  const handleFireStart = useCallback(() => {
    setFireActive(true);
    onInput({ fire: true });
  }, [onInput]);

  const handleFireEnd = useCallback(() => {
    setFireActive(false);
    onInput({ fire: false });
  }, [onInput]);

  const handleTactical = useCallback(
    (type: 'smoke' | 'grenade' | 'shield') => {
      onInput({ [type]: true });
      setTimeout(() => {
        onInput({ [type]: false });
      }, 80);
    },
    [onInput]
  );

  // Always show on mobile / small screens or when touch is detected
  return (
    <div
      id="mobile-touch-controller"
      className="w-full mt-4 flex items-center justify-between px-4 py-2 select-none touch-none sm:hidden"
    >
      {/* 4-Way D-Pad */}
      <div className="relative w-36 h-36 flex items-center justify-center">
        {/* Background cross shape */}
        <div className="absolute w-12 h-36 bg-zinc-900 border-2 border-zinc-700 rounded-md" />
        <div className="absolute w-36 h-12 bg-zinc-900 border-2 border-zinc-700 rounded-md" />

        {/* Up Button */}
        <button
          type="button"
          id="touch-dpad-up"
          onTouchStart={(e) => {
            e.preventDefault();
            handleDirStart('up');
          }}
          onTouchEnd={(e) => {
            e.preventDefault();
            handleDirEnd();
          }}
          onMouseDown={() => handleDirStart('up')}
          onMouseUp={handleDirEnd}
          className={`absolute top-0 w-12 h-12 flex items-center justify-center z-10 transition-colors ${
            activeDir === 'up' ? 'bg-amber-500/80 text-black' : 'text-zinc-300'
          }`}
        >
          <span className="text-lg font-bold">▲</span>
        </button>

        {/* Down Button */}
        <button
          type="button"
          id="touch-dpad-down"
          onTouchStart={(e) => {
            e.preventDefault();
            handleDirStart('down');
          }}
          onTouchEnd={(e) => {
            e.preventDefault();
            handleDirEnd();
          }}
          onMouseDown={() => handleDirStart('down')}
          onMouseUp={handleDirEnd}
          className={`absolute bottom-0 w-12 h-12 flex items-center justify-center z-10 transition-colors ${
            activeDir === 'down' ? 'bg-amber-500/80 text-black' : 'text-zinc-300'
          }`}
        >
          <span className="text-lg font-bold">▼</span>
        </button>

        {/* Left Button */}
        <button
          type="button"
          id="touch-dpad-left"
          onTouchStart={(e) => {
            e.preventDefault();
            handleDirStart('left');
          }}
          onTouchEnd={(e) => {
            e.preventDefault();
            handleDirEnd();
          }}
          onMouseDown={() => handleDirStart('left')}
          onMouseUp={handleDirEnd}
          className={`absolute left-0 w-12 h-12 flex items-center justify-center z-10 transition-colors ${
            activeDir === 'left' ? 'bg-amber-500/80 text-black' : 'text-zinc-300'
          }`}
        >
          <span className="text-lg font-bold">◀</span>
        </button>

        {/* Right Button */}
        <button
          type="button"
          id="touch-dpad-right"
          onTouchStart={(e) => {
            e.preventDefault();
            handleDirStart('right');
          }}
          onTouchEnd={(e) => {
            e.preventDefault();
            handleDirEnd();
          }}
          onMouseDown={() => handleDirStart('right')}
          onMouseUp={handleDirEnd}
          className={`absolute right-0 w-12 h-12 flex items-center justify-center z-10 transition-colors ${
            activeDir === 'right' ? 'bg-amber-500/80 text-black' : 'text-zinc-300'
          }`}
        >
          <span className="text-lg font-bold">▶</span>
        </button>

        {/* Center hub */}
        <div className="absolute w-10 h-10 bg-zinc-950 rounded-full border border-zinc-700 z-0 pointer-events-none" />
      </div>

      {/* Tactical Abilities Touch Buttons */}
      <div className="flex flex-col gap-2 items-center">
        <button
          type="button"
          onTouchStart={(e) => { e.preventDefault(); handleTactical('smoke'); }}
          onMouseDown={() => handleTactical('smoke')}
          className="w-10 h-10 rounded-lg bg-blue-950 border-2 border-blue-400 text-blue-200 text-[9px] font-pixel flex flex-col items-center justify-center active:scale-95 shadow-md"
          title="Smoke Screen"
        >
          <SmokeSvg className="w-4 h-4 shrink-0" />
          <span className="text-[6px] text-zinc-300">SMK</span>
        </button>
        <button
          type="button"
          onTouchStart={(e) => { e.preventDefault(); handleTactical('grenade'); }}
          onMouseDown={() => handleTactical('grenade')}
          className="w-10 h-10 rounded-lg bg-amber-950 border-2 border-amber-400 text-amber-200 text-[9px] font-pixel flex flex-col items-center justify-center active:scale-95 shadow-md"
          title="Bouncing Bomb"
        >
          <GrenadeSvg className="w-4 h-4 shrink-0" />
          <span className="text-[6px] text-zinc-300">BMB</span>
        </button>
        <button
          type="button"
          onTouchStart={(e) => { e.preventDefault(); handleTactical('shield'); }}
          onMouseDown={() => handleTactical('shield')}
          className="w-10 h-10 rounded-lg bg-emerald-950 border-2 border-emerald-400 text-emerald-200 text-[9px] font-pixel flex flex-col items-center justify-center active:scale-95 shadow-md"
          title="Deployable Shield"
        >
          <ShieldSvg className="w-4 h-4 shrink-0" />
          <span className="text-[6px] text-zinc-300">SHD</span>
        </button>
      </div>

      {/* Arcade Fire Action Button */}
      <div className="flex flex-col items-center">
        <button
          type="button"
          id="touch-fire-btn"
          onTouchStart={(e) => {
            e.preventDefault();
            handleFireStart();
          }}
          onTouchEnd={(e) => {
            e.preventDefault();
            handleFireEnd();
          }}
          onMouseDown={handleFireStart}
          onMouseUp={handleFireEnd}
          className={`w-20 h-20 rounded-full font-pixel text-xs tracking-wider font-bold shadow-lg border-4 transition-all flex items-center justify-center ${
            fireActive
              ? 'bg-red-500 text-white border-yellow-300 scale-95 shadow-red-500/50'
              : 'bg-red-600 text-yellow-200 border-red-800 shadow-zinc-950'
          }`}
        >
          FIRE
        </button>
        <span className="text-[8px] font-pixel text-zinc-400 mt-1">SHELL</span>
      </div>
    </div>
  );
};
