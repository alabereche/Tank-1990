/**
 * Battle City 1990 - Responsive Virtual Joystick & Touch Action Controls
 * Analog thumbstick ("العمود وتسحبه") for intuitive 360-degree drag steering
 * plus arcade Fire and tactical ability triggers with multi-touch isolation.
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { InputState, TacticalInventory } from '../types';
import { SmokeSvg, GrenadeSvg, ShieldSvg } from './TacticalIcons';

// --- Virtual Joystick / Thumbstick Component ---
interface VirtualJoystickProps {
  onDirectionChange: (dir: { up: boolean; down: boolean; left: boolean; right: boolean }) => void;
  size?: number;
}

export const VirtualJoystick: React.FC<VirtualJoystickProps> = ({
  onDirectionChange,
  size = 140,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const knobRef = useRef<HTMLDivElement | null>(null);
  const touchIdRef = useRef<number | null>(null);
  const originRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const isDraggingRef = useRef<boolean>(false);
  const [activeDir, setActiveDir] = useState<'UP' | 'DOWN' | 'LEFT' | 'RIGHT' | null>(null);
  const activeDirRef = useRef<'UP' | 'DOWN' | 'LEFT' | 'RIGHT' | null>(null);

  const radius = size / 2;
  const maxKnobDist = radius - 16; // Maximum travel distance for knob
  const deadzone = 3; // Ultra-sensitive: only 3px displacement required to activate movement

  const triggerHaptic = useCallback(() => {
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      try {
        navigator.vibrate(5);
      } catch {
        // Ignore haptic errors
      }
    }
  }, []);

  const updateJoystick = useCallback(
    (clientX: number, clientY: number) => {
      if (!isDraggingRef.current || !containerRef.current) return;

      let dx = clientX - originRef.current.x;
      let dy = clientY - originRef.current.y;
      const dist = Math.hypot(dx, dy);

      // Follow-through dynamic anchor: if dragging past maxKnobDist, slide origin along with finger
      // This ensures reversing direction or turning requires only 3px of thumb motion!
      if (dist > maxKnobDist) {
        const excess = dist - maxKnobDist;
        const angle = Math.atan2(dy, dx);
        originRef.current.x += Math.cos(angle) * excess;
        originRef.current.y += Math.sin(angle) * excess;
        dx = clientX - originRef.current.x;
        dy = clientY - originRef.current.y;
      }

      // Visual knob positioning clamped to max travel
      const currentDist = Math.hypot(dx, dy);
      const clampedDist = Math.min(currentDist, maxKnobDist);
      const angle = Math.atan2(dy, dx);
      const knobX = Math.cos(angle) * clampedDist;
      const knobY = Math.sin(angle) * clampedDist;

      // Direct GPU hardware transform on the knob: 0ms delay, zero React re-renders while steering
      if (knobRef.current) {
        knobRef.current.style.transform = `translate3d(${knobX}px, ${knobY}px, 0)`;
      }

      // Deadzone check (3px threshold)
      if (currentDist < deadzone) {
        if (activeDirRef.current !== null) {
          activeDirRef.current = null;
          setActiveDir(null);
          onDirectionChange({ up: false, down: false, left: false, right: false });
        }
        return;
      }

      // Fast dominant axis detection with 4-way orthogonal steering
      let newDir: 'UP' | 'DOWN' | 'LEFT' | 'RIGHT';
      if (Math.abs(dx) > Math.abs(dy)) {
        newDir = dx > 0 ? 'RIGHT' : 'LEFT';
      } else {
        newDir = dy > 0 ? 'DOWN' : 'UP';
      }

      if (activeDirRef.current !== newDir) {
        activeDirRef.current = newDir;
        setActiveDir(newDir);
        triggerHaptic();
        onDirectionChange({
          up: newDir === 'UP',
          down: newDir === 'DOWN',
          left: newDir === 'LEFT',
          right: newDir === 'RIGHT',
        });
      }
    },
    [deadzone, maxKnobDist, onDirectionChange, triggerHaptic]
  );

  const startJoystick = useCallback(
    (clientX: number, clientY: number) => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;

      // Distance from pad's physical center
      const distFromCenter = Math.hypot(clientX - centerX, clientY - centerY);

      // If user tapped outside the inner core (intentional outer compass tap), anchor to center
      // If user placed thumb near center, anchor to touchdown point so all 4 directions have 100% equal instant sensitivity
      if (distFromCenter > 22) {
        originRef.current = { x: centerX, y: centerY };
      } else {
        originRef.current = { x: clientX, y: clientY };
      }

      isDraggingRef.current = true;
      if (knobRef.current) {
        knobRef.current.style.transition = 'none';
      }

      // Process initial position immediately
      updateJoystick(clientX, clientY);
    },
    [updateJoystick]
  );

  const resetJoystick = useCallback(() => {
    touchIdRef.current = null;
    isDraggingRef.current = false;
    if (knobRef.current) {
      knobRef.current.style.transition = 'transform 80ms cubic-bezier(0.1, 0.9, 0.2, 1)';
      knobRef.current.style.transform = 'translate3d(0px, 0px, 0)';
    }
    if (activeDirRef.current !== null) {
      activeDirRef.current = null;
      setActiveDir(null);
      onDirectionChange({ up: false, down: false, left: false, right: false });
    }
  }, [onDirectionChange]);

  // Native non-passive touch and mouse listeners with window tracking
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const onTouchStart = (e: TouchEvent) => {
      e.preventDefault();
      if (touchIdRef.current !== null) return;
      const touch = e.changedTouches[0];
      touchIdRef.current = touch.identifier;
      startJoystick(touch.clientX, touch.clientY);
    };

    const onTouchMove = (e: TouchEvent) => {
      e.preventDefault();
      if (touchIdRef.current === null) return;
      for (let i = 0; i < e.changedTouches.length; i++) {
        const touch = e.changedTouches[i];
        if (touch.identifier === touchIdRef.current) {
          updateJoystick(touch.clientX, touch.clientY);
          break;
        }
      }
    };

    const onTouchEnd = (e: TouchEvent) => {
      if (touchIdRef.current === null) return;
      for (let i = 0; i < e.changedTouches.length; i++) {
        if (e.changedTouches[i].identifier === touchIdRef.current) {
          resetJoystick();
          break;
        }
      }
    };

    const onTouchCancel = (e: TouchEvent) => {
      if (touchIdRef.current === null) return;
      resetJoystick();
    };

    const onMouseDown = (e: MouseEvent) => {
      if (e.button !== 0) return;
      e.preventDefault();
      startJoystick(e.clientX, e.clientY);

      const onMouseMove = (ev: MouseEvent) => {
        ev.preventDefault();
        updateJoystick(ev.clientX, ev.clientY);
      };
      const onMouseUp = (ev: MouseEvent) => {
        ev.preventDefault();
        resetJoystick();
        window.removeEventListener('mousemove', onMouseMove);
        window.removeEventListener('mouseup', onMouseUp);
      };

      window.addEventListener('mousemove', onMouseMove);
      window.addEventListener('mouseup', onMouseUp);
    };

    el.addEventListener('touchstart', onTouchStart, { passive: false });
    window.addEventListener('touchmove', onTouchMove, { passive: false });
    window.addEventListener('touchend', onTouchEnd, { passive: false });
    window.addEventListener('touchcancel', onTouchCancel, { passive: false });
    el.addEventListener('mousedown', onMouseDown);

    return () => {
      el.removeEventListener('touchstart', onTouchStart);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchend', onTouchEnd);
      window.removeEventListener('touchcancel', onTouchCancel);
      el.removeEventListener('mousedown', onMouseDown);
    };
  }, [startJoystick, updateJoystick, resetJoystick]);

  return (
    <div
      ref={containerRef}
      id="virtual-joystick-pad"
      className="relative flex items-center justify-center select-none touch-none cursor-pointer"
      style={{ width: `${size}px`, height: `${size}px` }}
    >
      {/* Outer Chassis Base Circle */}
      <div
        className="absolute inset-0 rounded-full bg-gradient-to-b from-[#1c1c20] to-[#0f0f13] border-4 border-[#33333d] shadow-[inset_0_4px_10px_rgba(0,0,0,0.8),0_4px_12px_rgba(0,0,0,0.6)] flex items-center justify-center pointer-events-none"
      >
        {/* Directional Guides / Cross indicators */}
        <div
          className={`absolute top-2 w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-b-[9px] transition-colors ${
            activeDir === 'UP' ? 'border-b-amber-400 scale-125' : 'border-b-zinc-600/60'
          }`}
        />
        <div
          className={`absolute bottom-2 w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[9px] transition-colors ${
            activeDir === 'DOWN' ? 'border-t-amber-400 scale-125' : 'border-t-zinc-600/60'
          }`}
        />
        <div
          className={`absolute left-2 w-0 h-0 border-t-[6px] border-t-transparent border-b-[6px] border-b-transparent border-r-[9px] transition-colors ${
            activeDir === 'LEFT' ? 'border-r-amber-400 scale-125' : 'border-r-zinc-600/60'
          }`}
        />
        <div
          className={`absolute right-2 w-0 h-0 border-t-[6px] border-t-transparent border-b-[6px] border-b-transparent border-l-[9px] transition-colors ${
            activeDir === 'RIGHT' ? 'border-l-amber-400 scale-125' : 'border-l-zinc-600/60'
          }`}
        />

        {/* Concentric Guide Ring */}
        <div className="w-16 h-16 rounded-full border border-dashed border-zinc-700/50" />
      </div>

      {/* Floating Joystick Thumbstick Knob */}
      <div
        ref={knobRef}
        id="joystick-thumbstick-knob"
        className="absolute w-14 h-14 rounded-full bg-gradient-to-b from-[#4a4a55] via-[#2f2f38] to-[#1e1e24] border-2 border-zinc-400/80 shadow-[0_6px_14px_rgba(0,0,0,0.8),inset_0_2px_4px_rgba(255,255,255,0.3)] flex items-center justify-center pointer-events-none"
        style={{
          transform: 'translate3d(0px, 0px, 0)',
        }}
      >
        {/* Tactile thumb indent / inner groove */}
        <div className="w-8 h-8 rounded-full bg-gradient-to-b from-[#25252c] to-[#3a3a45] border border-zinc-500/50 flex items-center justify-center shadow-inner">
          <div
            className={`w-3 h-3 rounded-full transition-colors ${
              activeDir ? 'bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.8)]' : 'bg-zinc-500'
            }`}
          />
        </div>
      </div>
    </div>
  );
};

// --- Action Buttons (Fire + Tacticals) Component ---
interface TouchActionButtonsProps {
  onInput: (input: Partial<InputState>) => void;
  tacticalInventory?: TacticalInventory;
  compact?: boolean;
}

export const TouchActionButtons: React.FC<TouchActionButtonsProps> = ({
  onInput,
  tacticalInventory = { smoke: 1, grenade: 0, shield: 1 },
  compact = false,
}) => {
  const [fireActive, setFireActive] = useState<boolean>(false);
  const fireTouchIdRef = useRef<number | null>(null);
  const lastTouchTimeRef = useRef<number>(0);
  const lastFireTimeRef = useRef<number>(0);

  const triggerHaptic = useCallback(() => {
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      try {
        navigator.vibrate(15);
      } catch {
        // Ignore haptic errors
      }
    }
  }, []);

  const handleFireStart = (e: React.TouchEvent | React.MouseEvent) => {
    e.preventDefault();
    const isTouch = 'changedTouches' in e;
    const now = Date.now();

    if (isTouch) {
      lastTouchTimeRef.current = now;
      if (fireTouchIdRef.current === null) {
        fireTouchIdRef.current = e.changedTouches[0].identifier;
      }
    } else {
      // Suppress synthesized mouse events following a touch event within 650ms
      if (now - lastTouchTimeRef.current < 650) {
        return;
      }
    }

    // Debounce rapid touch chatter (minimum 120ms between distinct button presses)
    if (now - lastFireTimeRef.current < 120) {
      return;
    }
    lastFireTimeRef.current = now;

    setFireActive(true);
    triggerHaptic();
    onInput({ fire: true });
  };

  const handleFireEnd = (e: React.TouchEvent | React.MouseEvent) => {
    e.preventDefault();
    const isTouch = 'changedTouches' in e;
    const now = Date.now();

    if (isTouch) {
      lastTouchTimeRef.current = now;
      if (fireTouchIdRef.current !== null) {
        for (let i = 0; i < e.changedTouches.length; i++) {
          if (e.changedTouches[i].identifier === fireTouchIdRef.current) {
            fireTouchIdRef.current = null;
            break;
          }
        }
      } else {
        fireTouchIdRef.current = null;
      }
    } else {
      if (now - lastTouchTimeRef.current < 650) {
        return;
      }
      fireTouchIdRef.current = null;
    }

    setFireActive(false);
    onInput({ fire: false });
  };

  const handleTactical = (type: 'smoke' | 'grenade' | 'shield') => {
    triggerHaptic();
    onInput({ [type]: true });
    setTimeout(() => {
      onInput({ [type]: false });
    }, 80);
  };

  const isMouseSuppressed = () => {
    return Date.now() - lastTouchTimeRef.current < 650;
  };

  return (
    <div className="flex items-center gap-3 select-none touch-none">
      {/* Tactical Abilities Cluster */}
      <div className="flex flex-col gap-2 items-center">
        {/* Smoke Screen Button */}
        <button
          type="button"
          onTouchStart={(e) => {
            e.preventDefault();
            lastTouchTimeRef.current = Date.now();
            handleTactical('smoke');
          }}
          onMouseDown={(e) => {
            e.preventDefault();
            if (isMouseSuppressed()) return;
            handleTactical('smoke');
          }}
          className="relative w-11 h-11 rounded-xl bg-gradient-to-b from-blue-900 to-blue-950 border-2 border-blue-400 text-blue-200 flex flex-col items-center justify-center active:scale-90 shadow-lg transition-transform"
          title="Smoke Screen (Q)"
        >
          <SmokeSvg className="w-4 h-4 shrink-0" />
          <span className="text-[7px] font-pixel text-blue-100 font-bold">SMK</span>
          <span className="absolute -top-1.5 -right-1.5 bg-blue-500 text-white font-pixel text-[8px] px-1 rounded-full border border-white">
            {tacticalInventory.smoke ?? 0}
          </span>
        </button>

        {/* Grenade Button */}
        <button
          type="button"
          onTouchStart={(e) => {
            e.preventDefault();
            lastTouchTimeRef.current = Date.now();
            handleTactical('grenade');
          }}
          onMouseDown={(e) => {
            e.preventDefault();
            if (isMouseSuppressed()) return;
            handleTactical('grenade');
          }}
          className="relative w-11 h-11 rounded-xl bg-gradient-to-b from-amber-900 to-amber-950 border-2 border-amber-400 text-amber-200 flex flex-col items-center justify-center active:scale-90 shadow-lg transition-transform"
          title="Bouncing Bomb (E)"
        >
          <GrenadeSvg className="w-4 h-4 shrink-0" />
          <span className="text-[7px] font-pixel text-amber-100 font-bold">BMB</span>
          <span className="absolute -top-1.5 -right-1.5 bg-amber-500 text-black font-pixel text-[8px] px-1 rounded-full border border-black font-bold">
            {tacticalInventory.grenade ?? 0}
          </span>
        </button>

        {/* Shield Button */}
        <button
          type="button"
          onTouchStart={(e) => {
            e.preventDefault();
            lastTouchTimeRef.current = Date.now();
            handleTactical('shield');
          }}
          onMouseDown={(e) => {
            e.preventDefault();
            if (isMouseSuppressed()) return;
            handleTactical('shield');
          }}
          className="relative w-11 h-11 rounded-xl bg-gradient-to-b from-emerald-900 to-emerald-950 border-2 border-emerald-400 text-emerald-200 flex flex-col items-center justify-center active:scale-90 shadow-lg transition-transform"
          title="Deployable Shield (R)"
        >
          <ShieldSvg className="w-4 h-4 shrink-0" />
          <span className="text-[7px] font-pixel text-emerald-100 font-bold">SHD</span>
          <span className="absolute -top-1.5 -right-1.5 bg-emerald-500 text-white font-pixel text-[8px] px-1 rounded-full border border-white">
            {tacticalInventory.shield ?? 0}
          </span>
        </button>
      </div>

      {/* Big Arcade Fire Action Button */}
      <div className="flex flex-col items-center">
        <button
          type="button"
          id="touch-fire-btn"
          onTouchStart={handleFireStart}
          onTouchEnd={handleFireEnd}
          onTouchCancel={handleFireEnd}
          onMouseDown={handleFireStart}
          onMouseUp={handleFireEnd}
          onMouseLeave={handleFireEnd}
          className={`rounded-full font-pixel font-bold tracking-wider shadow-2xl border-4 transition-all flex flex-col items-center justify-center select-none ${
            compact ? 'w-18 h-18 text-xs' : 'w-20 h-20 text-xs'
          } ${
            fireActive
              ? 'bg-gradient-to-b from-red-500 to-red-700 text-white border-yellow-300 scale-95 shadow-[0_0_20px_rgba(239,68,68,0.8)]'
              : 'bg-gradient-to-b from-red-600 to-red-800 text-yellow-200 border-red-900 shadow-[0_6px_16px_rgba(0,0,0,0.8)]'
          }`}
        >
          <span className="drop-shadow-md">FIRE</span>
        </button>
        <span className="text-[8px] font-pixel text-zinc-400 mt-1">SHELL</span>
      </div>
    </div>
  );
};

// --- Combined Default TouchControls (Backwards-Compatible & Portrait Friendly) ---
interface TouchControlsProps {
  onInput: (input: Partial<InputState>) => void;
  isTouchActive: boolean;
  tacticalInventory?: TacticalInventory;
}

export const TouchControls: React.FC<TouchControlsProps> = ({
  onInput,
  isTouchActive,
  tacticalInventory,
}) => {
  const [isTouchDevice, setIsTouchDevice] = useState<boolean>(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const hasTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
      setIsTouchDevice(hasTouch || isTouchActive);
    }
  }, [isTouchActive]);

  if (!isTouchDevice) return null;

  return (
    <div
      id="mobile-touch-controller"
      className="w-full max-w-lg mt-3 flex items-center justify-between px-3 py-1 select-none touch-none sm:hidden"
    >
      {/* 360-Degree Analog Virtual Joystick */}
      <VirtualJoystick onDirectionChange={onInput} size={130} />

      {/* Fire + Tactical Buttons */}
      <TouchActionButtons onInput={onInput} tacticalInventory={tacticalInventory} compact={true} />
    </div>
  );
};
