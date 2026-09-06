/**
 * Battle City 1990 - Authentic NES Arcade Title Screen
 * Pure retro arcade aesthetic with perfectly centered layout, bold pixel typography,
 * interactive tank cursor, and seamless NES-style menu navigation.
 */

import React, { useState, useEffect, useRef } from 'react';
import { soundManager } from '../engine/SoundManager';
import { gamepadManager } from '../engine/GamepadManager';
import { toggleFullscreen, onFullscreenChange, isElectronApp } from '../utils/fullscreen';

interface TitleScreenProps {
  highScore: number;
  mapSizeLabel?: string;
  onStart1Player: () => void;
  onStartLocal2Player: (mode: 'coop' | 'versus') => void;
  onOpenConstruction: () => void;
  onOpenSettings: () => void;
  inCabinet?: boolean;
  disabled?: boolean;
}

export const TitleScreen: React.FC<TitleScreenProps> = ({
  highScore,
  mapSizeLabel,
  onStart1Player,
  onStartLocal2Player,
  onOpenConstruction,
  onOpenSettings,
  inCabinet = false,
  disabled = false,
}) => {
  const isElectron = isElectronApp();
  const [selectedIdx, setSelectedIdx] = useState<number>(0);
  const [showHelpModal, setShowHelpModal] = useState<boolean>(false);
  const [showLocal2PModal, setShowLocal2PModal] = useState<boolean>(false);
  const [local2PMode, setLocal2PMode] = useState<'coop' | 'versus'>('coop');
  const [fullscreenActive, setFullscreenActive] = useState<boolean>(false);
  const [showExitModal, setShowExitModal] = useState<boolean>(false);
  const [exitConfirmIdx, setExitConfirmIdx] = useState<number>(0); // 0: YES, 1: NO
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showInstallModal, setShowInstallModal] = useState<boolean>(false);
  const [showPcDownloadModal, setShowPcDownloadModal] = useState<boolean>(false);

  useEffect(() => {
    const unsub = onFullscreenChange((active) => {
      setFullscreenActive(active);
    });
    return unsub;
  }, []);

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstallApp = async () => {
    soundManager.unlockAudio();
    soundManager.playMenuSelect();
    if (deferredPrompt) {
      try {
        deferredPrompt.prompt();
        await deferredPrompt.userChoice;
      } catch {}
      setDeferredPrompt(null);
    } else {
      setShowInstallModal(true);
    }
  };

  const handleToggleFullscreen = () => {
    soundManager.unlockAudio();
    soundManager.playPowerUpCollect();
    if (window.electronAPI?.toggleFullscreen) {
      window.electronAPI.toggleFullscreen();
    } else {
      toggleFullscreen();
    }
  };

  const handleConfirmExit = () => {
    soundManager.playMenuSelect();
    if (window.electronAPI?.quit) {
      window.electronAPI.quit();
    } else {
      window.close();
    }
  };

  const menuOptions: { label: string; action: () => void; badge?: string }[] = [
    { label: '1 PLAYER', action: onStart1Player },
    { label: '2 PLAYERS (LOCAL)', action: () => setShowLocal2PModal(true) },
    { label: 'CONSTRUCTION', action: onOpenConstruction },
    { label: 'SETTINGS', action: onOpenSettings },
    { label: 'HOW TO PLAY', action: () => setShowHelpModal(true) },
    { label: 'INSTALL APP', action: handleInstallApp, badge: 'PWA' },
    { label: 'PC APP (.EXE)', action: () => setShowPcDownloadModal(true), badge: 'SOON' },
    ...(!isElectron ? [{ label: 'FULLSCREEN', action: handleToggleFullscreen }] : []),
    { label: 'EXIT GAME', action: () => { setExitConfirmIdx(0); setShowExitModal(true); } },
  ];

  // Stable references so polling and keyboard loops never re-create and never reset their state
  const disabledRef = useRef(disabled);
  disabledRef.current = disabled;

  const selectedIdxRef = useRef(selectedIdx);
  selectedIdxRef.current = selectedIdx;

  const showHelpModalRef = useRef(showHelpModal);
  showHelpModalRef.current = showHelpModal;

  const showLocal2PModalRef = useRef(showLocal2PModal);
  showLocal2PModalRef.current = showLocal2PModal;

  const showExitModalRef = useRef(showExitModal);
  showExitModalRef.current = showExitModal;

  const showInstallModalRef = useRef(showInstallModal);
  showInstallModalRef.current = showInstallModal;

  const showPcDownloadModalRef = useRef(showPcDownloadModal);
  showPcDownloadModalRef.current = showPcDownloadModal;

  const exitConfirmIdxRef = useRef(exitConfirmIdx);
  exitConfirmIdxRef.current = exitConfirmIdx;

  const local2PModeRef = useRef(local2PMode);
  local2PModeRef.current = local2PMode;

  const menuOptionsRef = useRef(menuOptions);
  menuOptionsRef.current = menuOptions;

  const onStartLocal2PlayerRef = useRef(onStartLocal2Player);
  onStartLocal2PlayerRef.current = onStartLocal2Player;

  // Keyboard navigation
  useEffect(() => {
    const mountTime = Date.now();
    const handleKeyDown = (e: KeyboardEvent) => {
      // Absorb initial key presses from previous screen upon mount
      if (Date.now() - mountTime < 350) return;
      if (disabledRef.current) return;
      soundManager.unlockAudio();

      if (showInstallModalRef.current) {
        if (e.key === 'Escape' || e.key === 'Enter' || e.key === ' ') {
          setShowInstallModal(false);
          soundManager.playMenuMove();
        }
        return;
      }

      if (showPcDownloadModalRef.current) {
        if (e.key === 'Escape' || e.key === 'Enter' || e.key === ' ') {
          setShowPcDownloadModal(false);
          soundManager.playMenuMove();
        }
        return;
      }

      if (showExitModalRef.current) {
        if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'ArrowRight' || e.key === 'd' || e.key === 'ArrowUp' || e.key === 'ArrowDown') {
          setExitConfirmIdx((prev) => (prev === 0 ? 1 : 0));
          soundManager.playMenuMove();
        } else if (e.key === 'Enter' || e.key === ' ') {
          if (exitConfirmIdxRef.current === 0) {
            handleConfirmExit();
          } else {
            setShowExitModal(false);
            soundManager.playMenuMove();
          }
        } else if (e.key === 'Escape') {
          setShowExitModal(false);
          soundManager.playMenuMove();
        }
        return;
      }

      if (showLocal2PModalRef.current) {
        if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'ArrowRight' || e.key === 'd') {
          setLocal2PMode((prev) => (prev === 'coop' ? 'versus' : 'coop'));
          soundManager.playMenuMove();
        } else if (e.key === 'Enter' || e.key === ' ') {
          setShowLocal2PModal(false);
          onStartLocal2PlayerRef.current(local2PModeRef.current);
          soundManager.playStageStart();
        } else if (e.key === 'Escape') {
          setShowLocal2PModal(false);
          soundManager.playMenuMove();
        }
        return;
      }

      if (showHelpModalRef.current) {
        const el = document.getElementById('field-manual-scroll-area');
        if (e.key === 'ArrowUp' || e.key === 'w') {
          if (el) el.scrollTop -= 70;
        } else if (e.key === 'ArrowDown' || e.key === 's') {
          if (el) el.scrollTop += 70;
        } else if (e.key === 'Enter' || e.key === ' ' || e.key === 'Escape' || e.key.toLowerCase() === 'h') {
          setShowHelpModal(false);
          soundManager.playMenuMove();
        }
        return;
      }

      if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') {
        setSelectedIdx((prev) => (prev > 0 ? prev - 1 : menuOptionsRef.current.length - 1));
        soundManager.playMenuMove();
      } else if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') {
        setSelectedIdx((prev) => (prev < menuOptionsRef.current.length - 1 ? prev + 1 : 0));
        soundManager.playMenuMove();
      } else if (e.key === 'Enter' || e.key === ' ') {
        soundManager.playMenuSelect();
        menuOptionsRef.current[selectedIdxRef.current]?.action();
      } else if (e.key.toLowerCase() === 'f') {
        if (!isElectron) {
          handleToggleFullscreen();
        }
      } else if (e.key.toLowerCase() === 'h') {
        setShowHelpModal((prev) => !prev);
      } else if (e.key === 'Escape') {
        setExitConfirmIdx(0);
        setShowExitModal(true);
        soundManager.playMenuMove();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Controller / Gamepad Navigation Loop (D-pad, Left Stick, A/B/Start/Select)
  // Uses empty dependency array [] so the loop and edge-trigger states are NEVER destroyed on state change
  useEffect(() => {
    let animId: number;
    let prevUp = false;
    let prevDown = false;
    let prevLeft = false;
    let prevRight = false;
    let holdTimer = 0;
    let heldDirection: 'up' | 'down' | 'left' | 'right' | null = null;
    let prevConfirm = false;
    let prevCancel = false;
    let prevSelect = false;
    let enableCooldownUntil = 0;
    let initialized = false;
    let mountCooldownUntil = 0;

    const INITIAL_HOLD_DELAY = 450; // ms before repeat starts when holding
    const REPEAT_RATE = 250;        // ms between repeats when held

    const poll = (time: number) => {
      // Absorb initial button holds from previous screen upon mount
      if (!initialized) {
        initialized = true;
        mountCooldownUntil = time + 350;
        const pad = gamepadManager.pollMenuInput();
        if (pad) {
          prevUp = pad.up;
          prevDown = pad.down;
          prevLeft = pad.left;
          prevRight = pad.right;
          prevConfirm = pad.confirm || pad.start;
          prevCancel = pad.cancel;
          prevSelect = pad.select;
        }
        animId = requestAnimationFrame(poll);
        return;
      }

      if (time < mountCooldownUntil) {
        const pad = gamepadManager.pollMenuInput();
        if (pad) {
          prevUp = pad.up;
          prevDown = pad.down;
          prevLeft = pad.left;
          prevRight = pad.right;
          prevConfirm = pad.confirm || pad.start;
          prevCancel = pad.cancel;
          prevSelect = pad.select;
        }
        animId = requestAnimationFrame(poll);
        return;
      }

      // IF DISABLED (e.g. SettingsModal is open on top), COMPLETELY SUSPEND TITLESCREEN GAMEPAD INPUT
      // While disabled, keep updating edge states so returning to this screen never triggers held buttons
      if (disabledRef.current) {
        const pad = gamepadManager.pollMenuInput();
        if (pad) {
          prevUp = pad.up;
          prevDown = pad.down;
          prevLeft = pad.left;
          prevRight = pad.right;
          prevConfirm = pad.confirm || pad.start;
          prevCancel = pad.cancel;
          prevSelect = pad.select;
        } else {
          prevUp = false;
          prevDown = false;
          prevLeft = false;
          prevRight = false;
          prevConfirm = false;
          prevCancel = false;
          prevSelect = false;
        }
        heldDirection = null;
        holdTimer = 0;
        enableCooldownUntil = time + 250;
        animId = requestAnimationFrame(poll);
        return;
      }

      // Re-enable grace period: absorb any buttons being released after closing modal
      if (time < enableCooldownUntil) {
        const pad = gamepadManager.pollMenuInput();
        if (pad) {
          prevUp = pad.up;
          prevDown = pad.down;
          prevLeft = pad.left;
          prevRight = pad.right;
          prevConfirm = pad.confirm || pad.start;
          prevCancel = pad.cancel;
          prevSelect = pad.select;
        }
        heldDirection = null;
        animId = requestAnimationFrame(poll);
        return;
      }

      const pad = gamepadManager.pollMenuInput();
      if (pad) {
        if (pad.anyButton) {
          soundManager.unlockAudio();
        }

        const isUp = pad.up;
        const isDown = pad.down;
        const isLeft = pad.left;
        const isRight = pad.right;

        // --- Handle Vertical Navigation (Up / Down) ---
        if (isUp && !prevUp) {
          // Fresh press: move once immediately
          heldDirection = 'up';
          holdTimer = time + INITIAL_HOLD_DELAY;
          if (showHelpModalRef.current) {
            const el = document.getElementById('field-manual-scroll-area');
            if (el) el.scrollTop -= 70;
          } else if (showExitModalRef.current) {
            setExitConfirmIdx((prev) => (prev === 0 ? 1 : 0));
            soundManager.playMenuMove();
          } else if (!showLocal2PModalRef.current) {
            setSelectedIdx((prev) => (prev > 0 ? prev - 1 : menuOptionsRef.current.length - 1));
            soundManager.playMenuMove();
          }
        } else if (isDown && !prevDown) {
          // Fresh press: move once immediately
          heldDirection = 'down';
          holdTimer = time + INITIAL_HOLD_DELAY;
          if (showHelpModalRef.current) {
            const el = document.getElementById('field-manual-scroll-area');
            if (el) el.scrollTop += 70;
          } else if (showExitModalRef.current) {
            setExitConfirmIdx((prev) => (prev === 0 ? 1 : 0));
            soundManager.playMenuMove();
          } else if (!showLocal2PModalRef.current) {
            setSelectedIdx((prev) => (prev < menuOptionsRef.current.length - 1 ? prev + 1 : 0));
            soundManager.playMenuMove();
          }
        } else if (heldDirection === 'up' && isUp) {
          // Holding Up
          if (time >= holdTimer) {
            holdTimer = time + REPEAT_RATE;
            if (showHelpModalRef.current) {
              const el = document.getElementById('field-manual-scroll-area');
              if (el) el.scrollTop -= 70;
            } else if (!showLocal2PModalRef.current && !showExitModalRef.current) {
              setSelectedIdx((prev) => (prev > 0 ? prev - 1 : menuOptionsRef.current.length - 1));
              soundManager.playMenuMove();
            }
          }
        } else if (heldDirection === 'down' && isDown) {
          // Holding Down
          if (time >= holdTimer) {
            holdTimer = time + REPEAT_RATE;
            if (showHelpModalRef.current) {
              const el = document.getElementById('field-manual-scroll-area');
              if (el) el.scrollTop += 70;
            } else if (!showLocal2PModalRef.current && !showExitModalRef.current) {
              setSelectedIdx((prev) => (prev < menuOptionsRef.current.length - 1 ? prev + 1 : 0));
              soundManager.playMenuMove();
            }
          }
        } else if (!isUp && !isDown) {
          if (heldDirection === 'up' || heldDirection === 'down') {
            heldDirection = null;
            holdTimer = 0;
          }
        }

        // --- Handle Horizontal Navigation (Left / Right for Modals) ---
        if (showExitModalRef.current) {
          const freshHorizontal = (isLeft && !prevLeft) || (isRight && !prevRight);
          if (freshHorizontal) {
            setExitConfirmIdx((prev) => (prev === 0 ? 1 : 0));
            soundManager.playMenuMove();
          }
        } else if (showLocal2PModalRef.current) {
          const freshHorizontal = (isLeft && !prevLeft) || (isRight && !prevRight) || (isUp && !prevUp) || (isDown && !prevDown);
          if (freshHorizontal) {
            setLocal2PMode((prev) => (prev === 'coop' ? 'versus' : 'coop'));
            soundManager.playMenuMove();
          }
        }

        prevUp = isUp;
        prevDown = isDown;
        prevLeft = isLeft;
        prevRight = isRight;

        // Confirm Button: A (Button 0) or Start (Button 9) or X (Button 2) - Pure Edge Trigger
        const confirmPressed = pad.confirm || pad.start;
        const confirmTrigger = confirmPressed && !prevConfirm;
        prevConfirm = confirmPressed;

        if (confirmTrigger) {
          soundManager.unlockAudio();
          if (showExitModalRef.current) {
            if (exitConfirmIdxRef.current === 0) {
              handleConfirmExit();
            } else {
              setShowExitModal(false);
              soundManager.playMenuMove();
            }
          } else if (showLocal2PModalRef.current) {
            setShowLocal2PModal(false);
            onStartLocal2PlayerRef.current(local2PModeRef.current);
          } else if (showHelpModalRef.current) {
            setShowHelpModal(false);
            soundManager.playMenuMove();
          } else {
            soundManager.playMenuSelect();
            menuOptionsRef.current[selectedIdxRef.current]?.action();
          }
        }

        // Cancel Button: B (Button 1) - Pure Edge Trigger
        const cancelPressed = pad.cancel;
        const cancelTrigger = cancelPressed && !prevCancel;
        prevCancel = cancelPressed;

        if (cancelTrigger) {
          soundManager.unlockAudio();
          if (showExitModalRef.current) {
            setShowExitModal(false);
            soundManager.playMenuMove();
          } else if (showLocal2PModalRef.current) {
            setShowLocal2PModal(false);
            soundManager.playMenuMove();
          } else if (showHelpModalRef.current) {
            setShowHelpModal(false);
            soundManager.playMenuMove();
          } else {
            setExitConfirmIdx(0);
            setShowExitModal(true);
            soundManager.playMenuMove();
          }
        }

        // Select Button: Select (Button 8) cycles options like classic NES Battle City
        const selectPressed = pad.select;
        const selectTrigger = selectPressed && !prevSelect;
        prevSelect = selectPressed;

        if (selectTrigger) {
          soundManager.unlockAudio();
          if (showExitModalRef.current) {
            setExitConfirmIdx((prev) => (prev === 0 ? 1 : 0));
            soundManager.playMenuMove();
          } else if (showLocal2PModalRef.current) {
            setLocal2PMode((prev) => (prev === 'coop' ? 'versus' : 'coop'));
            soundManager.playMenuMove();
          } else if (!showHelpModalRef.current && !showLocal2PModalRef.current) {
            setSelectedIdx((prev) => (prev < menuOptionsRef.current.length - 1 ? prev + 1 : 0));
            soundManager.playMenuMove();
          }
        }
      } else {
        prevUp = false;
        prevDown = false;
        prevLeft = false;
        prevRight = false;
        heldDirection = null;
        prevConfirm = false;
        prevCancel = false;
        prevSelect = false;
      }

      animId = requestAnimationFrame(poll);
    };

    animId = requestAnimationFrame(poll);
    return () => cancelAnimationFrame(animId);
  }, []); // <-- EMPTY DEPENDENCY ARRAY: Loop lives for the entire TitleScreen lifespan!

  return (
    <div
      id="title-screen-container"
      className="flex flex-col items-center justify-between w-full h-full text-white font-pixel select-none relative overflow-hidden py-2 sm:py-3.5 px-3"
    >
      <style>{`
        @media (max-height: 520px) {
          #title-screen-container {
            padding-top: 4px !important;
            padding-bottom: 4px !important;
          }
          #title-header-bar {
            padding-bottom: 3px !important;
            font-size: 10px !important;
          }
          #title-logo-banner {
            margin-top: 1px !important;
            margin-bottom: 2px !important;
          }
          #title-logo-h1, #title-logo-h2 {
            display: inline-block !important;
            font-size: 1.15rem !important;
            line-height: 1.1 !important;
            margin-right: 6px !important;
          }
          #title-tanks-duel {
            display: none !important;
          }
          #title-menu-grid {
            display: grid !important;
            grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
            max-width: 580px !important;
            gap: 1px 16px !important;
            margin-top: 2px !important;
            margin-bottom: 2px !important;
          }
          #title-menu-grid button {
            padding-top: 2px !important;
            padding-bottom: 2px !important;
          }
          #title-menu-grid span {
            font-size: 9px !important;
          }
          #title-screen-footer {
            padding-top: 3px !important;
            margin-top: 1px !important;
            gap: 2px !important;
          }
          #title-footer-hints {
            display: none !important;
          }
          #title-footer-copy {
            font-size: 8px !important;
            display: block !important;
          }
        }
      `}</style>

      {/* High Score Header (Authentic Arcade HUD) */}
      <div id="title-header-bar" className="w-full flex items-center justify-between px-2 sm:px-6 text-xs sm:text-sm tracking-widest border-b border-zinc-800/80 pb-1.5">
        <div className="flex items-center gap-2">
          <span className="text-red-500 font-bold drop-shadow">I-</span>
          <span className="text-white tracking-widest drop-shadow">00</span>
        </div>
        <div className="flex items-center gap-2 text-[#f8b800] drop-shadow">
          <span className="text-amber-400">HI-</span>
          <span>{highScore.toString().padStart(5, '0')}</span>
        </div>
      </div>

      {/* Main Center Stage: Logo, Pixel Tanks, and Navigation Menu */}
      <div className="flex-1 w-full flex flex-col items-center justify-center gap-1 sm:gap-4 my-auto">
        {/* Retro Pixel Logo Banner */}
        <div id="title-logo-banner" className="flex flex-col items-center text-center">
          <div>
            <h1 id="title-logo-h1" className="font-extrabold tracking-widest text-[#e52521] select-none text-3xl sm:text-5xl md:text-6xl drop-shadow-[0_4px_0_#500000]">
              BATTLE
            </h1>
            <h2 id="title-logo-h2" className="font-extrabold tracking-wider text-[#f8b800] select-none text-2xl sm:text-4xl md:text-5xl mt-0.5 drop-shadow-[0_4px_0_#704000]">
              CITY 1990
            </h2>
          </div>
          <div className="text-[9px] sm:text-xs text-zinc-400 tracking-widest uppercase mt-0.5 drop-shadow">
            NES 8-BIT TANK COMBAT
          </div>
          {mapSizeLabel && (
            <div className="inline-block mt-0.5 px-2.5 py-0.5 bg-black/70 border border-amber-500/40 rounded text-[8px] sm:text-[10px] text-amber-300 font-sans tracking-wide shadow-sm">
              ARENA: {mapSizeLabel}
            </div>
          )}
        </div>

        {/* Decorative Pixel Tanks Duel */}
        <div id="title-tanks-duel" className="flex items-center justify-center gap-4 sm:gap-6 my-0.5">
          {/* Player Gold Tank */}
          <div className="w-7 h-7 sm:w-8 sm:h-8 relative">
            <svg viewBox="0 0 16 16" className="w-full h-full fill-[#f8b800] drop-shadow-[0_2px_6px_rgba(248,184,0,0.6)]">
              <rect x="1" y="2" width="3" height="12" />
              <rect x="12" y="2" width="3" height="12" />
              <rect x="4" y="4" width="8" height="8" />
              <rect x="7" y="0" width="2" height="5" />
              <rect x="6" y="6" width="4" height="4" fill="#ffffff" />
            </svg>
          </div>

          <span className="text-xs sm:text-sm text-zinc-500 font-bold drop-shadow">VS</span>

          {/* Enemy Cyan Tank */}
          <div className="w-7 h-7 sm:w-8 sm:h-8 relative">
            <svg viewBox="0 0 16 16" className="w-full h-full fill-[#58b8d8] drop-shadow-[0_2px_6px_rgba(88,184,216,0.6)]">
              <rect x="1" y="2" width="3" height="12" />
              <rect x="12" y="2" width="3" height="12" />
              <rect x="4" y="4" width="8" height="8" />
              <rect x="7" y="11" width="2" height="5" />
              <rect x="6" y="6" width="4" height="4" fill="#105878" />
            </svg>
          </div>
        </div>

        {/* Menu Options with Animated Tank Cursor */}
        <div id="title-menu-grid" className="flex flex-col w-full max-w-[340px] sm:max-w-[400px] gap-1 sm:gap-2 my-1">
          {menuOptions.map((opt, idx) => {
            const isSelected = selectedIdx === idx;
            return (
              <button
                key={opt.label}
                id={`menu-option-${idx}`}
                onClick={() => {
                  soundManager.unlockAudio();
                  setSelectedIdx(idx);
                  soundManager.playMenuSelect();
                  opt.action();
                }}
                onMouseEnter={() => {
                  setSelectedIdx(idx);
                  soundManager.playMenuMove();
                }}
                className="flex items-center gap-2 sm:gap-3 py-0.5 sm:py-1 px-1.5 text-left transition-colors group cursor-pointer"
              >
                {/* Tank Cursor */}
                <div className="w-3.5 h-3.5 sm:w-5 sm:h-5 flex items-center justify-center shrink-0">
                  {isSelected ? (
                    <svg viewBox="0 0 16 16" className="w-3.5 h-3.5 sm:w-5 sm:h-5 fill-[#f8b800] animate-pulse drop-shadow-[0_0_8px_rgba(248,184,0,0.9)]">
                      <rect x="2" y="1" width="12" height="3" />
                      <rect x="2" y="12" width="12" height="3" />
                      <rect x="4" y="4" width="8" height="8" />
                      <rect x="11" y="7" width="5" height="2" />
                    </svg>
                  ) : (
                    <div className="w-2 h-2 bg-transparent" />
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <span
                    className={`text-[10px] sm:text-xs md:text-sm tracking-wider font-bold whitespace-nowrap transition-all ${
                      isSelected
                        ? 'text-[#f8b800] underline decoration-2 drop-shadow-[0_0_10px_rgba(248,184,0,0.6)] translate-x-1'
                        : 'text-zinc-200 group-hover:text-white drop-shadow'
                    }`}
                  >
                    {opt.label}
                  </span>
                  {opt.badge && (
                    <span
                      className={`text-[7px] font-pixel px-1.5 py-0.2 rounded font-bold border ${
                        opt.badge === 'PWA'
                          ? 'bg-emerald-950/80 text-emerald-400 border-emerald-500/80 animate-pulse'
                          : 'bg-zinc-800 text-zinc-400 border-zinc-600'
                      }`}
                    >
                      {opt.badge}
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Arcade Coin-Op Footer Prompt & Copyright */}
      <div id="title-screen-footer" className="w-full flex flex-col items-center gap-1.5 text-center pt-2 border-t border-zinc-800/80">
        <div id="title-footer-hints" className="text-[8px] sm:text-[10px] text-zinc-400 tracking-wider flex items-center justify-center flex-wrap gap-x-2 gap-y-1">
          <span>[W/S • D-PAD] SELECT</span>
          <span>•</span>
          <span>[ENTER / SPACE • A / START] CONFIRM</span>
          <span>•</span>
          <span>[SELECT] CYCLE</span>
          <span>•</span>
          <span>[F] FULLSCREEN</span>
        </div>
        <div id="title-footer-copy" className="text-[8px] sm:text-[9px] text-zinc-500 tracking-widest">
          © 1990 NAMCO LTD. / ENHANCED EDITION
        </div>
      </div>

      {/* Field Manual (Help Modal) - Authentic Pixel Theme */}
      {showHelpModal && (
        <div
          className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4 backdrop-blur-xs"
          onClick={() => setShowHelpModal(false)}
        >
          <div
            className="bg-[#141414] border-4 border-[#444] rounded max-w-lg w-full p-5 space-y-4 font-sans text-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-zinc-700 pb-2">
              <span className="font-pixel text-[#f8b800] text-sm tracking-wider">FIELD MANUAL</span>
              <button
                onClick={() => setShowHelpModal(false)}
                className="font-pixel text-zinc-400 hover:text-red-400 text-sm px-2 py-1 border border-zinc-700 hover:border-red-500"
              >
                [X]
              </button>
            </div>

            <div id="field-manual-scroll-area" className="space-y-3 text-zinc-300 text-xs leading-relaxed max-h-[60vh] overflow-y-auto pr-2">
              <div>
                <strong className="text-white font-pixel text-xs">MISSION OBJECTIVE:</strong>
                <p className="mt-1 text-zinc-300">
                  Destroy all 20 enemy tanks and defend the Phoenix Eagle Base at the bottom of the map. If your base is destroyed, the mission fails immediately!
                </p>
              </div>

              <div>
                <strong className="text-amber-400 font-pixel text-xs">10 HANDCRAFTED TACTICAL STAGES:</strong>
                <ul className="list-disc pl-5 mt-1.5 space-y-1 text-zinc-300 text-[11px]">
                  <li><strong>Stage 1:</strong> Classic Citadel - NES homage with high-speed flank ice avenues</li>
                  <li><strong>Stage 2:</strong> Iron Fortress - Impenetrable central steel cross & water moats</li>
                  <li><strong>Stage 3:</strong> Twin Rivers - Double river crossing with slippery central ice bridge</li>
                  <li><strong>Stage 4:</strong> Amazon Rainforest - Over 40% jungle canopy ambush cover & temple</li>
                  <li><strong>Stage 5:</strong> Glacial Archipelago - Polar drift ice sheets & 4 fortified island bases</li>
                  <li><strong>Stage 6:</strong> The Great Labyrinth - 90° maze corridors & breakable shortcut walls</li>
                  <li><strong>Stage 7:</strong> Muddy Badlands - Three deep quagmire canyons (42% speed) & ridges</li>
                  <li><strong>Stage 8:</strong> Urban Gridlock - City street avenues, 3x3 blocks & central fountain</li>
                  <li><strong>Stage 9:</strong> Bunker Complex - Underground diamond bastion & 4 steel pillboxes</li>
                  <li><strong>Stage 10:</strong> Death Valley Crater - Volcanic caldera, ash swamps & central Steel Throne</li>
                </ul>
              </div>

              <div>
                <strong className="text-amber-400 font-pixel text-xs">COMBAT CONTROLS:</strong>
                <ul className="list-disc pl-5 mt-1.5 space-y-1 text-zinc-300 text-[11px]">
                  <li><strong>Move Tank:</strong> [W, A, S, D] or [Arrow Keys] or [Gamepad D-Pad]</li>
                  <li><strong>Fire Cannon:</strong> [Space] or [J] or [Gamepad A / X]</li>
                  <li><strong>Tactical Items:</strong> [1] Smoke Screen, [2] Grenade, [3] Deployable Shield</li>
                  <li><strong>Fullscreen:</strong> [F] key anytime</li>
                </ul>
              </div>
            </div>

            <button
              onClick={() => setShowHelpModal(false)}
              className="w-full bg-[#e52521] hover:bg-red-600 text-white font-pixel text-xs py-2 border-2 border-red-800 transition-colors"
            >
              CLOSE MANUAL
            </button>
          </div>
        </div>
      )}

      {/* Local 2-Player Combat Modal - Authentic Pixel Theme */}
      {showLocal2PModal && (
        <div
          className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4 backdrop-blur-xs"
          onClick={() => setShowLocal2PModal(false)}
        >
          <div
            className="bg-[#141414] border-4 border-[#444] rounded max-w-md w-full p-5 space-y-4 font-pixel shadow-2xl text-white"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-zinc-700 pb-2">
              <span className="text-[#f8b800] text-xs tracking-wider">LOCAL 2-PLAYER COMBAT</span>
              <button
                type="button"
                onClick={() => setShowLocal2PModal(false)}
                className="text-zinc-400 hover:text-red-400 text-xs px-2 py-1 border border-zinc-700 hover:border-red-500"
              >
                [X]
              </button>
            </div>

            <div className="space-y-3">
              <div className="text-[10px] text-zinc-300">
                SELECT COMBAT RULES:
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={() => setLocal2PMode('coop')}
                  className={`p-3 rounded border-2 text-left flex flex-col gap-1 transition-all cursor-pointer ${
                    local2PMode === 'coop'
                      ? 'border-[#f8b800] bg-amber-950/50 text-white shadow-lg'
                      : 'border-zinc-700 bg-zinc-900/60 text-zinc-400 hover:border-zinc-500'
                  }`}
                >
                  <span className="font-bold text-[#f8b800] text-xs">CO-OP BATTLE</span>
                  <span className="text-[8px] text-zinc-300 font-sans mt-0.5">Team up to defend the eagle base against 20 tanks</span>
                </button>

                <button
                  type="button"
                  onClick={() => setLocal2PMode('versus')}
                  className={`p-3 rounded border-2 text-left flex flex-col gap-1 transition-all cursor-pointer ${
                    local2PMode === 'versus'
                      ? 'border-[#58b8d8] bg-sky-950/50 text-white shadow-lg'
                      : 'border-zinc-700 bg-zinc-900/60 text-zinc-400 hover:border-zinc-500'
                  }`}
                >
                  <span className="font-bold text-[#58b8d8] text-xs">1V1 VERSUS</span>
                  <span className="text-[8px] text-zinc-300 font-sans mt-0.5">Duel your friend across rotating battlefields</span>
                </button>
              </div>

              {/* Controls Layout Guide */}
              <div className="bg-black/70 p-3 rounded border border-zinc-800 flex flex-col gap-2 mt-2">
                <div className="flex items-center justify-between border-b border-zinc-800 pb-1 text-[9px]">
                  <span className="text-[#f8b800] font-bold">PLAYER 1 (GOLD)</span>
                  <span className="text-zinc-300 font-sans">[W, A, S, D] + [SPACE]</span>
                </div>
                <div className="flex items-center justify-between text-[9px]">
                  <span className="text-[#55f855] font-bold">PLAYER 2 (GREEN)</span>
                  <span className="text-zinc-300 font-sans">[ARROWS] + [ENTER]</span>
                </div>
              </div>

              <div className="text-[8px] text-zinc-400 italic text-center font-sans">
                * Dual gamepads supported: Gamepad 1 controls P1, Gamepad 2 controls P2.
              </div>
            </div>

            <div className="flex items-center gap-3 mt-3">
              <button
                type="button"
                onClick={() => setShowLocal2PModal(false)}
                className="flex-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 py-2 border border-zinc-600 text-xs transition-colors"
              >
                CANCEL
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowLocal2PModal(false);
                  onStartLocal2Player(local2PMode);
                }}
                className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white py-2 border border-emerald-400 text-xs font-bold shadow-lg transition-colors"
              >
                START BATTLE!
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Retro Quit Game Confirmation Modal */}
      {showExitModal && (
        <div
          className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4 backdrop-blur-xs select-none"
          onClick={() => setShowExitModal(false)}
        >
          <div
            className="bg-[#121216] border-4 border-red-600 rounded-md max-w-sm w-full p-5 space-y-4 font-pixel shadow-[0_0_30px_rgba(220,38,38,0.4)] text-white text-center"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-red-500 text-sm tracking-widest flex items-center justify-center gap-2">
              <span>[!]</span>
              <span>QUIT GAME?</span>
              <span>[!]</span>
            </div>

            <p className="text-[10px] text-zinc-300 leading-relaxed font-pixel">
              ARE YOU SURE YOU WANT TO EXIT BATTLE CITY 1990?
            </p>

            <div className="flex items-center justify-center gap-3 mt-4">
              <button
                type="button"
                onClick={handleConfirmExit}
                className={`flex-1 py-2.5 px-4 text-xs font-pixel border-2 transition-all cursor-pointer ${
                  exitConfirmIdx === 0
                    ? 'border-red-500 bg-red-600 text-white shadow-[0_0_15px_rgba(239,68,68,0.6)]'
                    : 'border-zinc-700 bg-zinc-800/80 text-zinc-400 hover:border-zinc-500'
                }`}
              >
                {exitConfirmIdx === 0 ? '► YES' : 'YES'}
              </button>

              <button
                type="button"
                onClick={() => setShowExitModal(false)}
                className={`flex-1 py-2.5 px-4 text-xs font-pixel border-2 transition-all cursor-pointer ${
                  exitConfirmIdx === 1
                    ? 'border-emerald-400 bg-emerald-600 text-white shadow-[0_0_15px_rgba(16,185,129,0.6)]'
                    : 'border-zinc-700 bg-zinc-800/80 text-zinc-400 hover:border-zinc-500'
                }`}
              >
                {exitConfirmIdx === 1 ? '► NO' : 'NO'}
              </button>
            </div>

            <div className="text-[8px] text-zinc-500 font-sans mt-2">
              Gamepad: [D-Pad] Select &bull; [A/Start] Confirm &bull; [B/ESC] Cancel
            </div>
          </div>
        </div>
      )}

      {/* PWA Mobile App Installation Modal */}
      {showInstallModal && (
        <div
          className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-3 backdrop-blur-xs select-none"
          onClick={() => setShowInstallModal(false)}
        >
          <div
            className="bg-[#0c0c0c] border-4 border-[#f8b800] max-w-md w-full p-4 space-y-3 font-pixel shadow-[0_0_25px_rgba(248,184,0,0.5)] text-white text-center"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-[#f8b800] text-xs sm:text-sm tracking-widest">
              INSTALL MOBILE APP (PWA)
            </div>

            <p className="text-[9px] text-zinc-300 leading-relaxed font-pixel text-left">
              RUN AS FULLSCREEN RETRO APP WITHOUT BROWSER TOOLBARS:
            </p>

            <div className="text-[8px] text-zinc-300 leading-relaxed text-left space-y-2 bg-black p-2.5 border-2 border-zinc-800 font-pixel">
              <div>
                <span className="text-emerald-400 font-bold block mb-0.5">&gt; ANDROID (CHROME):</span>
                <span className="text-zinc-400">TAP BROWSER MENU (⋮) THEN SELECT 'INSTALL APP' OR 'ADD TO HOME SCREEN'.</span>
              </div>
              <div className="border-t border-zinc-800 pt-1.5">
                <span className="text-cyan-400 font-bold block mb-0.5">&gt; APPLE IOS (SAFARI):</span>
                <span className="text-zinc-400">TAP SHARE BUTTON THEN SELECT 'ADD TO HOME SCREEN'.</span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowInstallModal(false)}
              className="w-full py-2 px-3 text-[10px] font-pixel border-2 border-[#f8b800] bg-amber-600 hover:bg-amber-500 text-black cursor-pointer transition-all shadow-md font-bold"
            >
              [ OK / CLOSE ]
            </button>
          </div>
        </div>
      )}

      {/* PC (.EXE) Download Coming Soon Modal */}
      {showPcDownloadModal && (
        <div
          className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-3 backdrop-blur-xs select-none"
          onClick={() => setShowPcDownloadModal(false)}
        >
          <div
            className="bg-[#0c0c0c] border-4 border-[#58b8d8] max-w-md w-full p-4 space-y-3 font-pixel shadow-[0_0_25px_rgba(88,184,216,0.5)] text-white text-center"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-[#58b8d8] text-xs sm:text-sm tracking-widest">
              PC DOWNLOAD (.EXE)
            </div>

            <div className="inline-block px-3 py-1 bg-zinc-900 border border-zinc-700 text-amber-300 text-[9px] font-pixel">
              STATUS: COMING SOON
            </div>

            <p className="text-[8px] text-zinc-300 leading-relaxed font-pixel text-left">
              THE STANDALONE WINDOWS PC EXECUTABLE (.EXE) IS BEING PACKAGED AND WILL BE AVAILABLE FOR DIRECT DOWNLOAD HERE.
            </p>

            <button
              type="button"
              onClick={() => setShowPcDownloadModal(false)}
              className="w-full py-2 px-3 text-[10px] font-pixel border-2 border-[#58b8d8] bg-cyan-700 hover:bg-cyan-600 text-white cursor-pointer transition-all shadow-md font-bold"
            >
              [ CLOSE ]
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
