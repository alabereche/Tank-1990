/**
 * Battle City 1990 - Game Canvas Viewport
 * Houses the 416x416 HTML5 2D canvas with pixel-perfect integer scaling,
 * keyboard listeners, gamepad polling, and HUD frame.
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { GameEngine } from '../engine/GameLoop';
import { Hud } from './Hud';
import { BLOCK_SIZE, PRESET_MAPS } from '../engine/maps';
import {
  GameScore,
  GameSettings,
  GameState,
  InputState,
  StageMap,
  WindowScalePreset,
  MultiplayerMode,
  MultiplayerRole,
} from '../types';
import { multiplayerClient } from '../network/MultiplayerClient';
import { gamepadManager, GamepadInfo } from '../engine/GamepadManager';
import { soundManager } from '../engine/SoundManager';
import { TouchControls } from './TouchControls';
import { RoundBanner, MatchEndPanel } from './VersusOverlays';
import { toggleFullscreen, isFullscreen, onFullscreenChange } from '../utils/fullscreen';
import {
  Settings,
  RefreshCw,
  Eye,
  EyeOff,
  Maximize2,
  Minimize2,
  Sliders,
  Scaling,
  Wifi,
  Radio,
  MessageSquare,
  AlertTriangle,
  Users,
} from 'lucide-react';

interface GameCanvasProps {
  currentStage: number;
  customMap?: StageMap;
  settings: GameSettings;
  multiplayerConfig?: {
    roomCode: string;
    role: MultiplayerRole;
    mode: MultiplayerMode;
    mapSize: 'classic' | 'large' | 'giant';
    stage: number;
    customMapGrid?: number[][];
    slot?: number;
    team?: 'A' | 'B' | 'FFA';
  };
  onGameOver: (finalScore: GameScore) => void;
  onVictory: (finalScore: GameScore) => void;
  onOpenEditor: () => void;
  onOpenSettings?: () => void;
  onReturnToMenu: () => void;
  onUpdateSettings?: (newSettings: GameSettings) => void;
}

export const GameCanvas: React.FC<GameCanvasProps> = ({
  currentStage,
  customMap,
  settings,
  multiplayerConfig,
  onGameOver,
  onVictory,
  onOpenEditor,
  onOpenSettings,
  onReturnToMenu,
  onUpdateSettings,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const engineRef = useRef<GameEngine | null>(null);

  const [scoreData, setScoreData] = useState<GameScore>({
    score: 0,
    highScore: 20000,
    playerLives: 3,
    player2Lives: multiplayerConfig ? (multiplayerConfig.mode === 'versus' ? 5 : 3) : undefined,
    player2Score: 0,
    stage: currentStage,
    enemiesRemaining: [],
    activeEnemiesCount: 0,
    destroyedEnemies: { BASIC: 0, FAST: 0, POWER: 0, ARMOR: 0 },
  });

  const [gameState, setGameState] = useState<GameState>(GameState.PLAYING);
  const [isMuted, setIsMuted] = useState<boolean>(soundManager.getMuted());
  const [showScanlines, setShowScanlines] = useState<boolean>(settings.showScanlines);
  const [gamepad, setGamepad] = useState<GamepadInfo | null>(gamepadManager.getConnectedGamepad());
  const [touchActive, setTouchActive] = useState<boolean>(false);
  const [fullscreenActive, setFullscreenActive] = useState<boolean>(isFullscreen());
  const [multiplayerPing, setMultiplayerPing] = useState<number>(0);
  const [partnerDisconnected, setPartnerDisconnected] = useState<boolean>(false);

  // Listen for Fullscreen changes
  useEffect(() => {
    const unsub = onFullscreenChange((active) => {
      setFullscreenActive(active);
    });
    return unsub;
  }, []);

  // Sync scanlines if changed in settings
  useEffect(() => {
    setShowScanlines(settings.showScanlines);
  }, [settings.showScanlines]);

  // Active window scale derived from settings or fallback
  const windowScale = settings.windowScale || 'large';

  const onGameOverRef = useRef(onGameOver);
  const onVictoryRef = useRef(onVictory);
  useEffect(() => {
    onGameOverRef.current = onGameOver;
    onVictoryRef.current = onVictory;
  }, [onGameOver, onVictory]);

  const cycleWindowScaleRef = useRef<() => void>(() => {});

  const handleCycleWindowScale = useCallback(() => {
    soundManager.unlockAudio();
    soundManager.playHitSteel();
    const currentScale = settings.windowScale || 'large';
    const nextScale: WindowScalePreset =
      currentScale === 'standard' ? 'large' : currentScale === 'large' ? 'max' : 'standard';

    if (onUpdateSettings) {
      onUpdateSettings({
        ...settings,
        windowScale: nextScale,
      });
    }
  }, [onUpdateSettings, settings]);

  useEffect(() => {
    cycleWindowScaleRef.current = handleCycleWindowScale;
  }, [handleCycleWindowScale]);

  // Sync player speed if changed
  useEffect(() => {
    if (engineRef.current && settings?.playerSpeed) {
      engineRef.current.setPlayerSpeed(settings.playerSpeed);
    }
  }, [settings?.playerSpeed]);

  // Keyboard input state tracking
  const keysDown = useRef<{ [key: string]: boolean }>({});

  const handleStateChange = useCallback(
    (state: GameState, score: GameScore) => {
      setGameState(state);
      setScoreData({ ...score });

      if (state === GameState.GAME_OVER) {
        setTimeout(() => {
          onGameOverRef.current(score);
        }, 0);
      } else if (state === GameState.VICTORY) {
        setTimeout(() => {
          onVictoryRef.current(score);
        }, 0);
      }
    },
    []
  );

  // Derive canvas dimensions based on map
  const mapToLoad = customMap || PRESET_MAPS.stage1;
  const currentGridSize = mapToLoad?.grid?.length || 26;
  const currentCanvasSize = currentGridSize * BLOCK_SIZE;

  // Initialize Canvas & Engine
  useEffect(() => {
    if (!canvasRef.current) return;

    const map = customMap || PRESET_MAPS.stage1;
    const engine = new GameEngine(canvasRef.current, map, handleStateChange);
    engineRef.current = engine;

    if (multiplayerConfig) {
      engine.setMultiplayerMode(multiplayerConfig.mode, multiplayerConfig.role);
      engine.localPlayerSlot = multiplayerConfig.slot || (multiplayerConfig.role === 'host' ? 1 : 2);
    }

    if (settings?.playerSpeed) {
      engine.setPlayerSpeed(settings.playerSpeed);
    }

    engine.startStage(currentStage, map);

    // Host sends snapshots across the wire to Guest (Online only)
    if (multiplayerConfig?.role === 'host' && multiplayerConfig?.roomCode !== 'LOCAL') {
      engine.onNetworkSync = (snapshot) => {
        multiplayerClient.sendSyncState(snapshot);
      };
      // Discrete events (booms, shots, brick hits) relay for guest audio/FX
      engine.onGameEventBroadcast = (event) => {
        multiplayerClient.sendGameEvent(event);
      };
    }

    // Track gamepad connections
    const unsubscribeGamepad = gamepadManager.onConnectionChange((gp) => {
      setGamepad(gp);
    });

    return () => {
      engine.stopLoop();
      unsubscribeGamepad();
    };
  }, [currentStage, customMap, handleStateChange, settings?.playerSpeed, multiplayerConfig]);

  // Network Event Handlers for Multiplayer (Online only)
  useEffect(() => {
    if (!multiplayerConfig || multiplayerConfig.roomCode === 'LOCAL') return;

    const unsubPing = multiplayerClient.on('ping_updated', (data) => {
      setMultiplayerPing(data.ping);
    });

    // Host receives input packets from Guest (Player 2..8) - stored and fed to engine
    const unsubInput = multiplayerClient.on('player_input', (data) => {
      if (multiplayerConfig.role === 'host') {
        const slot = data.slot || 2;
        if (engineRef.current) {
          engineRef.current.setPlayerSlotInput(slot, data.input);
        }
        if (slot === 2) {
          netP2Input.current = data.input;
        }
      }
    });

    // Guest receives full authoritative snapshots from Host
    const unsubSync = multiplayerClient.on('sync_state', (data) => {
      if (engineRef.current && multiplayerConfig.role === 'guest') {
        engineRef.current.applyNetworkSnapshot(data.snapshot);
      }
    });

    // Guest receives discrete events for sound & explosion effects
    const unsubEvent = multiplayerClient.on('game_event', (data) => {
      if (engineRef.current && multiplayerConfig.role === 'guest') {
        engineRef.current.handleRemoteEvent(data);
      }
    });

    // Both players receive quick tactical taunts
    const unsubTaunt = multiplayerClient.on('taunt', (data) => {
      if (engineRef.current) {
        soundManager.playPowerUpSpawn();
        engineRef.current.triggerTaunt(data.text, data.sender);
      }
    });

    // Peer disconnection handling
    const unsubDisconnect = multiplayerClient.on('peer_disconnected', () => {
      setPartnerDisconnected(true);
      soundManager.playHitSteel();
    });

    return () => {
      unsubPing();
      unsubInput();
      unsubSync();
      unsubEvent();
      unsubTaunt();
      unsubDisconnect();
    };
  }, [multiplayerConfig]);

  const triggerQuickTaunt = useCallback(
    (phrase: string) => {
      if (!multiplayerConfig || !engineRef.current) return;
      const sender = multiplayerConfig.role === 'host' ? 'P1' : 'P2';
      soundManager.unlockAudio();
      soundManager.playHitSteel();
      engineRef.current.triggerTaunt(phrase, sender);
      multiplayerClient.sendTaunt(phrase, sender);
    },
    [multiplayerConfig]
  );

  // Keyboard Event Handlers
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      soundManager.unlockAudio();

      const key = e.key.toLowerCase();
      keysDown.current[key] = true;

      // Prevent page scrolling on arrow keys and spacebar
      if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' ', 'w', 'a', 's', 'd'].includes(key)) {
        e.preventDefault();
      }

      // Quick tactical taunts for multiplayer: 1, 2, 3, 4
      if (multiplayerConfig) {
        if (key === '1') triggerQuickTaunt('ATTACK!');
        else if (key === '2') triggerQuickTaunt('DEFEND!');
        else if (key === '3') triggerQuickTaunt('GOOD JOB!');
        else if (key === '4') triggerQuickTaunt('WATCH OUT!');
      }

      // Mute toggle: 'M'
      if (key === 'm') {
        const muted = soundManager.toggleMute();
        setIsMuted(muted);
      }

      // Fullscreen toggle: 'F'
      if (key === 'f') {
        toggleFullscreen();
      }

      // Window Scale toggle: 'V'
      if (key === 'v') {
        cycleWindowScaleRef.current();
      }

      // Pause toggle: 'Enter' or 'P' (single player); 'P' also for the
      // online HOST - an always-available escape hatch if a match freezes.
      if (key === 'p' && multiplayerConfig?.role === 'host') {
        engineRef.current?.togglePause();
      }
      if (key === 'enter' || key === 'p') {
        if (engineRef.current && !multiplayerConfig) {
          engineRef.current.togglePause();
        }
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      keysDown.current[key] = false;
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [multiplayerConfig, triggerQuickTaunt]);

  // --- Unified Input Composer -------------------------------------------
  // ONE per-frame writer merges Keyboard + Gamepad (+Touch) into the FULL
  // input state per player and writes it exactly once. Because the complete
  // state is recomposed every frame, no device can stomp another and no
  // stale key can stick. Previous event-driven + latch mix caused exactly
  // that cross-talk.

  const touchInput = useRef<Partial<InputState>>({});
  const lastSentInput = useRef('');
  const lastSentRelayInput = useRef('');
  const netP2Input = useRef<Partial<InputState>>({});
  const padTrusted = useRef(false);
  const dbgRef = useRef({ inSig: '00000', sent: '-', p2Sig: '00000', pads: 0 });
  const [inputDebug, setInputDebug] = useState('');

  const mergeInput = (
    ...inputs: (Partial<InputState> | null | undefined)[]
  ): InputState => ({
    up: inputs.some((i) => Boolean(i?.up)),
    down: inputs.some((i) => Boolean(i?.down)),
    left: inputs.some((i) => Boolean(i?.left)),
    right: inputs.some((i) => Boolean(i?.right)),
    fire: inputs.some((i) => Boolean(i?.fire)),
    pause: inputs.some((i) => Boolean(i?.pause)),
  });

  const inputSig = (i: InputState) =>
    `${i.up ? 1 : 0}${i.down ? 1 : 0}${i.left ? 1 : 0}${i.right ? 1 : 0}${i.fire ? 1 : 0}`;

  useEffect(() => {
    let animId: number;
    const inputLoop = () => {
      const engine = engineRef.current;
      const kd = keysDown.current;

      if (multiplayerConfig?.roomCode === 'LOCAL') {
        // Split keyboard: WASD+Space/J = P1, Arrows+Enter/K = P2. Pad N = player N.
        const kbP1 = {
          up: Boolean(kd['w']),
          down: Boolean(kd['s']),
          left: Boolean(kd['a']),
          right: Boolean(kd['d']),
          fire: Boolean(kd[' '] || kd['j'] || kd['z']),
        };
        const kbP2 = {
          up: Boolean(kd['arrowup']),
          down: Boolean(kd['arrowdown']),
          left: Boolean(kd['arrowleft']),
          right: Boolean(kd['arrowright']),
          fire: Boolean(kd['enter'] || kd['k'] || kd['numpad0']),
        };
        const pad1 = gamepadManager.pollInputForOrdinal(0)?.input;
        const pad2 = gamepadManager.pollInputForOrdinal(1)?.input;
        const m1 = mergeInput(kbP1, pad1, touchInput.current);
        const m2 = mergeInput(kbP2, pad2);
        engine?.updateInput(m1);
        engine?.setP2Input(m2);
        dbgRef.current = {
          inSig: inputSig(m1),
          sent: '-',
          p2Sig: inputSig(m2),
          pads: gamepadManager.getConnectedPads().length,
        };
      } else {
        // Online / single: the local player drives their own tank. With two
        // pads on one machine, host reads the first and guest the second.
        const role = multiplayerConfig?.role === 'guest' ? 'guest' : multiplayerConfig?.role === 'host' ? 'host' : 'any';
        const kb = {
          up: Boolean(kd['arrowup'] || kd['w']),
          down: Boolean(kd['arrowdown'] || kd['s']),
          left: Boolean(kd['arrowleft'] || kd['a']),
          right: Boolean(kd['arrowright'] || kd['d']),
          fire: Boolean(kd[' '] || kd['j'] || kd['z'] || kd['control']),
        };
        // Poll the pad exactly ONCE per frame - readPad() consumes button
        // edges (Start), so a second call would drop them.
        const pad = gamepadManager.pollInputForRole(role)?.input;
        const merged = mergeInput(kb, pad, touchInput.current);
        dbgRef.current = {
          inSig: inputSig(merged),
          sent: lastSentInput.current,
          p2Sig: '-',
          pads: gamepadManager.getConnectedPads().length,
        };

        if (multiplayerConfig?.role === 'guest') {
          // Prediction locally + transmit on change with slot (host is the authority)
          const mySlot = multiplayerConfig.slot || 2;
          engine?.setPlayerSlotInput(mySlot, merged);
          const sig = inputSig(merged);
          if (sig !== lastSentInput.current) {
            lastSentInput.current = sig;
            multiplayerClient.sendInput({ ...merged, pause: false }, mySlot);
          }

          // Same-machine dual-pad relay: if 2 pads are connected on this PC and guest window is focused,
          // relay Pad 0 to Host for Slot 1 (P1) so Player 1 isn't frozen by Chromium focus isolation!
          const connectedPads = gamepadManager.getConnectedPads();
          if (connectedPads.length >= 2) {
            const pad0Raw = gamepadManager.pollInputForOrdinal(0)?.input;
            if (pad0Raw) {
              const fullPad0 = mergeInput(pad0Raw);
              const sig0 = inputSig(fullPad0);
              if (sig0 !== lastSentRelayInput.current) {
                lastSentRelayInput.current = sig0;
                multiplayerClient.sendInput({ ...fullPad0, pause: false }, 1);
              }
            }
          }
        } else {
          // Host drives P1 locally (keyboard, gamepad, touch)
          engine?.updateInput(merged);

          // P2 input: driven by guest packet over network.
          // If testing on the same PC with 2 pads plugged into the host, allow Pad 1 to drive P2 locally when guest is idle!
          let p2 = netP2Input.current ? (netP2Input.current as InputState) : null;
          const isNetP2Active = Boolean(p2 && (p2.up || p2.down || p2.left || p2.right || p2.fire));
          if (!isNetP2Active) {
            const connectedPads = gamepadManager.getConnectedPads();
            if (connectedPads.length >= 2) {
              const pad1Raw = gamepadManager.pollInputForOrdinal(1)?.input;
              if (pad1Raw && (pad1Raw.up || pad1Raw.down || pad1Raw.left || pad1Raw.right || pad1Raw.fire)) {
                p2 = mergeInput(pad1Raw);
              }
            }
          }
          const finalP2 = p2 || { up: false, down: false, left: false, right: false, fire: false, pause: false };
          engine?.setP2Input(finalP2);
          dbgRef.current.p2Sig = inputSig(finalP2);

          // Host pause controls
          const padActive = Boolean(pad && (pad.up || pad.down || pad.left || pad.right || pad.fire));
          if (padActive) padTrusted.current = true;
          if (pad?.pause && padTrusted.current) engine?.togglePause();
        }
      }
      animId = requestAnimationFrame(inputLoop);
    };
    animId = requestAnimationFrame(inputLoop);
    return () => cancelAnimationFrame(animId);
  }, [multiplayerConfig]);

  // Live input diagnostics (online only): ground truth for "a tank won't
  // move" - shows pad count, role, local input bits, last sent packet,
  // pause flag and ping, refreshed 4x per second.
  useEffect(() => {
    if (!multiplayerConfig || multiplayerConfig.roomCode === 'LOCAL') return;
    const id = window.setInterval(() => {
      const d = dbgRef.current;
      setInputDebug(
        `PADS:${d.pads} ROLE:${multiplayerConfig.role} IN:${d.inSig} SENT:${d.sent} PAUSED:${engineRef.current?.paused ? 1 : 0} PING:${multiplayerClient.getPing()}ms`
      );
    }, 250);
    return () => window.clearInterval(id);
  }, [multiplayerConfig]);

  // Touch controls input bridge: stored in a ref and merged by the unified
  // per-frame input composer (direct engine writes would be stomped).
  const handleTouchInput = (input: Partial<InputState>) => {
    soundManager.unlockAudio();
    setTouchActive(true);
    touchInput.current = { ...touchInput.current, ...input };
  };

  const toggleMute = () => {
    const muted = soundManager.toggleMute();
    setIsMuted(muted);
  };

  const handlePause = () => {
    if (engineRef.current) {
      engineRef.current.togglePause();
    }
  };

  const handleRestartStage = () => {
    if (engineRef.current) {
      engineRef.current.startStage(currentStage, customMap || PRESET_MAPS.stage1);
    }
  };

  const handleToggleFullscreen = async () => {
    soundManager.unlockAudio();
    soundManager.playHitSteel();
    await toggleFullscreen();
  };

  return (
    <div id="game-view-container" className="inline-flex flex-col items-center justify-center select-none max-w-full">
      {/* Authentic NES Console Cabinet (Unified Top Bar + Screen + HUD in One Seamless Frame) */}
      <div className="flex flex-col bg-[#303030] border-4 border-[#505050] rounded shadow-2xl overflow-hidden max-w-full">
        {/* Top Header Bar: Score, High Score & Action Controls - flush with game border */}
        <div className="w-full flex items-center justify-between px-3 py-1.5 bg-[#404040] border-b-4 border-[#252525] font-pixel text-xs text-white">
          <div className="flex items-center gap-2">
            <span className="text-[#f8b800]">I-</span>
            <span className="text-white tracking-widest">{scoreData.score.toString().padStart(6, '0')}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[#d82800]">HI-</span>
            <span className="text-[#f8b800] tracking-widest">{scoreData.highScore.toString().padStart(6, '0')}</span>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Window Scale Toggle (Fit Screen / Maximize Window / 1X / 1.5X) */}
            <button
              id="btn-window-scale-toggle"
              onClick={handleCycleWindowScale}
              className={`p-1 sm:p-1.5 rounded flex items-center gap-1 transition-all ${
                windowScale === 'max'
                  ? 'bg-purple-950/70 text-purple-300 border border-purple-400 shadow-sm shadow-purple-500/30'
                  : windowScale === 'large'
                  ? 'bg-zinc-700/60 text-amber-300 border border-amber-500/40'
                  : 'text-zinc-300 hover:text-white hover:bg-zinc-700/50'
              }`}
              title={`حجم نافذة اللعبة: ${
                windowScale === 'max'
                  ? 'ملء النافذة (Fit Screen - اضغط V)'
                  : windowScale === 'large'
                  ? 'حجم كبير (Large 1.5x - اضغط V)'
                  : 'حجم عادي (Standard 1x - اضغط V)'
              }`}
            >
              <Scaling className="w-3.5 h-3.5 text-purple-400 shrink-0" />
              <span className="text-[9px] font-bold font-pixel">
                {windowScale === 'max' ? 'FIT WIN' : windowScale === 'large' ? '1.5X' : '1X'}
              </span>
            </button>

            {/* Fullscreen Toggle */}
            <button
              id="btn-fullscreen-toggle"
              onClick={handleToggleFullscreen}
              className="text-zinc-300 hover:text-white p-1 rounded hover:bg-zinc-700/50 flex items-center gap-1 transition-colors"
              title={fullscreenActive ? 'Exit Fullscreen (F)' : 'Enter Fullscreen (F)'}
            >
              {fullscreenActive ? (
                <Minimize2 className="w-3.5 h-3.5 text-emerald-400" />
              ) : (
                <Maximize2 className="w-3.5 h-3.5 text-amber-400" />
              )}
            </button>

            {/* CRT Scanlines Toggle */}
            <button
              id="btn-scanlines-toggle"
              onClick={() => setShowScanlines(!showScanlines)}
              className="text-zinc-300 hover:text-white p-1 rounded hover:bg-zinc-700/50 transition-colors"
              title={showScanlines ? 'Disable CRT Scanlines' : 'Enable CRT Scanlines'}
            >
              {showScanlines ? <Eye className="w-3.5 h-3.5 text-cyan-400" /> : <EyeOff className="w-3.5 h-3.5" />}
            </button>

            {/* Restart Stage */}
            <button
              id="btn-restart-stage"
              onClick={handleRestartStage}
              className="text-zinc-300 hover:text-white p-1 rounded hover:bg-zinc-700/50 transition-colors"
              title="Restart Stage"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>

            {/* Settings Modal */}
            {onOpenSettings && (
              <button
                id="btn-game-settings-open"
                onClick={onOpenSettings}
                className="text-zinc-300 hover:text-amber-400 p-1 rounded hover:bg-zinc-700/50 transition-colors"
                title="Game Settings"
              >
                <Sliders className="w-3.5 h-3.5" />
              </button>
            )}

            {/* Construction Editor */}
            <button
              id="btn-editor-open"
              onClick={onOpenEditor}
              className="text-zinc-300 hover:text-yellow-400 p-1 rounded hover:bg-zinc-700/50 transition-colors"
              title="Construction Mode (Map Editor)"
            >
              <Settings className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Multiplayer Status Bar (When in Online Room or Local 2P) */}
        {multiplayerConfig && (
          <div className="w-full bg-[#242424] px-3 py-1.5 border-b-2 border-[#181818] flex items-center justify-between text-[10px] font-pixel text-zinc-300">
            <div className="flex items-center gap-3">
              {multiplayerConfig.roomCode === 'LOCAL' ? (
                <span className="flex items-center gap-1 text-emerald-400 font-bold">
                  <Users className="w-3.5 h-3.5" />
                  <span>LOCAL 2 PLAYERS</span>
                </span>
              ) : (
                <span className="flex items-center gap-1 text-emerald-400">
                  <Radio className="w-3 h-3 animate-pulse" />
                  <span>ROOM: {multiplayerConfig.roomCode}</span>
                </span>
              )}
              <span className="px-1.5 py-0.5 bg-zinc-800 border border-zinc-600 rounded text-[9px] text-[#f8b800]">
                {multiplayerConfig.mode === 'coop'
                  ? '2P CO-OP'
                  : multiplayerConfig.mode === 'versus'
                  ? '1V1 VERSUS'
                  : multiplayerConfig.mode === '2v2'
                  ? '2V2 TEAMS'
                  : '8 FREE-FOR-ALL'}
              </span>
              <span className="text-[9px] text-zinc-400 hidden sm:inline">
                {multiplayerConfig.roomCode === 'LOCAL'
                  ? 'P1: WASD / P2: ARROWS'
                  : multiplayerConfig.role === 'host'
                  ? 'YOU: P1 (GOLD)'
                  : `YOU: P${multiplayerConfig.slot || 2} (${multiplayerConfig.team === 'A' ? 'TEAM A' : multiplayerConfig.team === 'B' ? 'TEAM B' : 'FFA'})`}
              </span>
            </div>

            {multiplayerConfig.roomCode !== 'LOCAL' && (
              <div className="flex items-center gap-2">
                <div
                  className={`flex items-center gap-1 text-[9px] px-1.5 py-0.5 rounded border ${
                    multiplayerPing <= 50
                      ? 'text-emerald-400 border-emerald-800 bg-emerald-950/40'
                      : multiplayerPing <= 120
                      ? 'text-amber-400 border-amber-800 bg-amber-950/40'
                      : 'text-red-400 border-red-800 bg-red-950/40'
                  }`}
                >
                  <Wifi className="w-3 h-3" />
                  <span>{multiplayerPing}ms</span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Partner Disconnected Alert */}
        {partnerDisconnected && (
          <div className="w-full bg-red-900/90 text-white px-3 py-1 text-center font-pixel text-[9px] border-b border-red-700 flex items-center justify-center gap-2 animate-pulse">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-300 shrink-0" />
            <span>OPPONENT DISCONNECTED - MATCH PAUSED</span>
          </div>
        )}

        {/* Center: Main Game Screen + Authentic Right-Side HUD Panel */}
        <div
          className={`relative flex items-stretch justify-center ${
            windowScale === 'max' ? 'p-1 sm:p-2' : 'p-2 sm:p-3'
          }`}
        >
          {/* Main Canvas Viewport */}
          <div className="relative bg-black border-4 border-[#202020] shadow-inner overflow-hidden flex items-center justify-center">
            <canvas
              ref={canvasRef}
              id="battle-city-canvas"
              width={currentCanvasSize}
              height={currentCanvasSize}
              className={`game-canvas pixelated block aspect-square object-contain cursor-crosshair transition-all duration-150 ${
                windowScale === 'max'
                  ? 'w-[min(82vh,calc(95vw-130px))] h-[min(82vh,calc(95vw-130px))] min-w-[300px] min-h-[300px] max-w-[960px] max-h-[960px]'
                  : windowScale === 'large'
                  ? 'w-[360px] h-[360px] xs:w-[420px] xs:h-[420px] sm:w-[512px] sm:h-[512px] md:w-[608px] md:h-[608px] lg:w-[672px] lg:h-[672px] max-w-[80vw] max-h-[76vh]'
                  : 'w-[300px] h-[300px] xs:w-[350px] xs:h-[350px] sm:w-[416px] sm:h-[416px] md:w-[460px] md:h-[460px] max-w-[75vw] max-h-[70vh]'
              }`}
              onClick={() => soundManager.unlockAudio()}
            />

            {/* CRT Scanline Visual Effect Overlay */}
            {showScanlines && <div className="absolute inset-0 scanlines pointer-events-none" />}

            {/* Versus & 2v2 round flow: intro/winner banners + match result panel */}
            {(multiplayerConfig?.mode === 'versus' || multiplayerConfig?.mode === '2v2') &&
              (gameState === GameState.ROUND_INTRO || gameState === GameState.ROUND_END) && (
                <RoundBanner
                  state={gameState}
                  scoreData={scoreData}
                  mode={multiplayerConfig.mode}
                  defenderSlot={multiplayerConfig.mode === 'versus' ? ((scoreData.roundNumber ?? 1) % 2 === 1 ? 1 : 2) : undefined}
                  mySlot={multiplayerConfig.slot || (multiplayerConfig.role === 'host' ? 1 : 2)}
                />
              )}
            {(multiplayerConfig?.mode === 'versus' || multiplayerConfig?.mode === '2v2' || multiplayerConfig?.mode === 'ffa') &&
              gameState === GameState.MATCH_END && (
              <MatchEndPanel
                scoreData={scoreData}
                isHost={!multiplayerConfig || multiplayerConfig.role === 'host' || multiplayerConfig.roomCode === 'LOCAL'}
                onRematch={handleRestartStage}
                onExit={onReturnToMenu}
                mode={multiplayerConfig.mode}
              />
            )}
          </div>

          {/* Authentic Right-Side HUD Panel */}
          <Hud
            scoreData={scoreData}
            isMuted={isMuted}
            onToggleMute={toggleMute}
            gamepad={gamepad}
            onOpenConstruction={onOpenEditor}
            onPauseToggle={handlePause}
            isPaused={gameState === GameState.PAUSED}
            isMaxScale={windowScale === 'max'}
            versus={multiplayerConfig?.mode === 'versus'}
            mode={multiplayerConfig?.mode}
          />
        </div>
      </div>

      {/* Live Input Diagnostics (online) */}
      {multiplayerConfig && inputDebug && (
        <div className="w-full text-center text-[8px] font-mono text-zinc-500 mt-1 tracking-wider select-none">
          [INPUT] {inputDebug} &nbsp;|&nbsp; IN/SENT bits = U·D·L·R·F
        </div>
      )}

      {/* Quick Tactical Taunts for Multiplayer */}
      {multiplayerConfig && (
        <div className="w-full flex items-center justify-between gap-1 mt-2 bg-[#252525] p-1.5 rounded border border-[#3a3a3a] text-[9px] font-pixel">
          <div className="flex items-center gap-1 text-[#f8b800] px-1">
            <MessageSquare className="w-3 h-3 text-[#f8b800]" />
            <span className="hidden sm:inline">QUICK COMMS:</span>
          </div>
          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              onClick={() => triggerQuickTaunt('ATTACK!')}
              className="px-2 py-1 bg-[#383838] hover:bg-[#484848] text-white rounded border border-[#555] active:translate-y-px transition-colors"
              title="Press 1"
            >
              [1] ATTACK!
            </button>
            <button
              onClick={() => triggerQuickTaunt('DEFEND!')}
              className="px-2 py-1 bg-[#383838] hover:bg-[#484848] text-white rounded border border-[#555] active:translate-y-px transition-colors"
              title="Press 2"
            >
              [2] DEFEND!
            </button>
            <button
              onClick={() => triggerQuickTaunt('GOOD JOB!')}
              className="px-2 py-1 bg-[#383838] hover:bg-[#484848] text-[#78f878] rounded border border-[#555] active:translate-y-px transition-colors"
              title="Press 3"
            >
              [3] GOOD JOB!
            </button>
            <button
              onClick={() => triggerQuickTaunt('WATCH OUT!')}
              className="px-2 py-1 bg-[#383838] hover:bg-[#484848] text-[#f87878] rounded border border-[#555] active:translate-y-px transition-colors"
              title="Press 4"
            >
              [4] WATCH OUT!
            </button>
          </div>
        </div>
      )}

      {/* Action shortcuts & instructions bar - flush with cabinet width */}
      <div className="w-full flex items-center justify-between text-[10px] text-zinc-400 font-pixel mt-2 px-1">
        <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
          {multiplayerConfig?.roomCode === 'LOCAL' ? (
            <>
              <span className="text-[#f8b800]">P1: [WASD] + [SPACE/J]</span>
              <span className="text-[#55f855]">P2: [ARROWS] + [ENTER/K]</span>
            </>
          ) : (
            <>
              <span>MOVE: [WASD / ARROWS]</span>
              <span>FIRE: [SPACE / J]</span>
            </>
          )}
          <span>PAUSE: [P]</span>
          <span className={windowScale === 'max' ? 'text-purple-400 font-bold' : 'text-zinc-300'}>
            WIN: [V]
          </span>
          <span>FULL: [F]</span>
        </div>
        <div className="flex items-center gap-3">
          {onOpenSettings && (
            <button
              onClick={onOpenSettings}
              className="text-amber-400 hover:text-amber-300 underline decoration-dotted transition-colors"
            >
              SETTINGS
            </button>
          )}
          <button
            onClick={onReturnToMenu}
            className="text-zinc-300 hover:text-amber-400 underline decoration-dotted transition-colors"
          >
            MENU
          </button>
        </div>
      </div>

      {/* Responsive Virtual Touch Controller for Mobile / Tablets */}
      <TouchControls onInput={handleTouchInput} isTouchActive={touchActive} />
    </div>
  );
};
