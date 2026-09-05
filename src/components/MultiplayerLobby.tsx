/**
 * Battle City 1990 - Authentic NES Multiplayer Lobby
 * High performance room creation, room join with 6-digit code,
 * 2P Co-Op vs Enemies & 1v1 PvP Versus mode selection,
 * latency meter, and real-time player presence.
 */

import React, { useState, useEffect, useRef } from 'react';
import { multiplayerClient } from '../network/MultiplayerClient';
import { soundManager } from '../engine/SoundManager';
import { gamepadManager } from '../engine/GamepadManager';
import { MultiplayerMode, MultiplayerRole, MultiplayerPlayerInfo } from '../types';
import {
  Users,
  Swords,
  Shield,
  Crown,
  Wifi,
  Copy,
  Check,
  ArrowLeft,
  Play,
  Radio,
  Gamepad2,
  AlertTriangle,
  Zap,
} from 'lucide-react';

interface MultiplayerLobbyProps {
  onBack: () => void;
  onLaunchGame: (config: {
    roomCode: string;
    role: MultiplayerRole;
    mode: MultiplayerMode;
    mapSize: 'classic' | 'large' | 'giant';
    stage: number;
    customMapGrid?: number[][];
    slot?: number;
    team?: 'A' | 'B' | 'FFA';
  }) => void;
}

export const MultiplayerLobby: React.FC<MultiplayerLobbyProps> = ({
  onBack,
  onLaunchGame,
}) => {
  const [tab, setTab] = useState<'create' | 'join'>('create');
  const [mode, setMode] = useState<MultiplayerMode>('coop');
  const [mapSize, setMapSize] = useState<'classic' | 'large' | 'giant'>('classic');
  const [stage, setStage] = useState<number>(1);
  const [roomCodeInput, setRoomCodeInput] = useState<string>('');
  const [createdRoomCode, setCreatedRoomCode] = useState<string | null>(null);
  const [peerJoined, setPeerJoined] = useState<boolean>(false);
  const [connectedPlayers, setConnectedPlayers] = useState<MultiplayerPlayerInfo[]>([]);
  const [ping, setPing] = useState<number>(0);
  const [serverConnected, setServerConnected] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [copied, setCopied] = useState<boolean>(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  const countdownIntervalRef = useRef<number | null>(null);

  // Check if room code was passed in URL query param (e.g., ?room=CITY88)
  useEffect(() => {
    try {
      const urlParams = new URLSearchParams(window.location.search);
      const urlRoom = urlParams.get('room');
      if (urlRoom && urlRoom.length >= 4) {
        setRoomCodeInput(urlRoom.toUpperCase());
        setTab('join');
      }
    } catch {}
  }, []);

  // Connect to WebSocket server on mount
  useEffect(() => {
    soundManager.unlockAudio();
    multiplayerClient.connect().then((connected) => {
      setServerConnected(connected);
    });

    const unsubPing = multiplayerClient.on('ping_updated', (data) => {
      setPing(data.ping);
      setServerConnected(true);
    });

    const unsubCreated = multiplayerClient.on('room_created', (data) => {
      soundManager.playPowerUpCollect();
      setCreatedRoomCode(data.code);
      setMode(data.mode);
      if (data.players) setConnectedPlayers(data.players);
      else setConnectedPlayers([{ slot: data.slot || 1, team: data.team || (data.mode === '2v2' ? 'A' : 'FFA'), role: 'host' }]);
      setErrorMessage(null);
    });

    const unsubPlayerJoined = multiplayerClient.on('player_joined', (data) => {
      soundManager.playPowerUpSpawn();
      setPeerJoined(true);
      if (data.players) setConnectedPlayers(data.players);
    });

    const unsubRoomJoined = multiplayerClient.on('room_joined', (data) => {
      soundManager.playPowerUpCollect();
      setCreatedRoomCode(data.code);
      if (data.mode) setMode(data.mode);
      if (data.mapSize) setMapSize(data.mapSize);
      if (data.stage) setStage(data.stage);
      setPeerJoined(true);
      if (data.players) setConnectedPlayers(data.players);
      setErrorMessage(null);
    });

    const unsubCountdown = multiplayerClient.on('game_countdown', (data) => {
      soundManager.playHitSteel();
      let current = data.count || 3;
      setCountdown(current);

      if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = window.setInterval(() => {
        current -= 1;
        if (current > 0) {
          soundManager.playHitSteel();
          setCountdown(current);
        } else {
          soundManager.playStageStart();
          setCountdown(null);
          if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);

          onLaunchGame({
            roomCode: data.code || multiplayerClient.getRoomCode() || 'CITY01',
            role: multiplayerClient.getRole() || 'guest',
            mode: data.mode || mode,
            mapSize: data.mapSize || mapSize,
            stage: data.stage || stage,
            slot: multiplayerClient.getSlot(),
            team: multiplayerClient.getTeam(),
            customMapGrid: data.customMapGrid,
          });
        }
      }, 1000);
    });

    const unsubPlayerLeft = multiplayerClient.on('player_left', (data) => {
      soundManager.playHitSteel();
      if (data.players) {
        setConnectedPlayers(data.players);
        setPeerJoined(data.players.length > 1);
      }
    });

    const unsubPeerDisconnected = multiplayerClient.on('peer_disconnected', () => {
      soundManager.playHitSteel();
      setPeerJoined(false);
      setErrorMessage('PARTNER DISCONNECTED');
    });

    const unsubError = multiplayerClient.on('error', (err) => {
      setErrorMessage(err.message || 'CONNECTION ERROR');
      soundManager.playHitSteel();
    });

    return () => {
      unsubPing();
      unsubCreated();
      unsubPlayerJoined();
      unsubRoomJoined();
      unsubCountdown();
      unsubPlayerLeft();
      unsubPeerDisconnected();
      unsubError();
      if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
    };
  }, [mode, mapSize, stage, onLaunchGame]);

  const handleCreateRoom = () => {
    soundManager.unlockAudio();
    soundManager.playHitSteel();
    setErrorMessage(null);
    const finalMapSize = mode === 'ffa' && mapSize === 'classic' ? 'large' : mapSize;
    multiplayerClient.createRoom(mode, finalMapSize, stage);
  };

  const handleJoinRoom = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    soundManager.unlockAudio();
    soundManager.playHitSteel();
    if (!roomCodeInput.trim()) {
      setErrorMessage('ENTER A VALID ROOM CODE');
      return;
    }
    setErrorMessage(null);
    multiplayerClient.joinRoom(roomCodeInput);
  };

  const handleStartGame = () => {
    soundManager.unlockAudio();
    soundManager.playPowerUpCollect();
    multiplayerClient.requestStartGame();
  };

  const copyRoomCode = () => {
    if (!createdRoomCode) return;
    soundManager.playHitSteel();
    navigator.clipboard.writeText(createdRoomCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const copyInviteLink = () => {
    if (!createdRoomCode) return;
    soundManager.playHitSteel();
    const url = `${window.location.origin}${window.location.pathname}?room=${createdRoomCode}`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Controller / Gamepad Navigation Grid
  const [currentRow, setCurrentRow] = useState<number>(1); // Defaults to Tabs row
  const [currentCol, setCurrentCol] = useState<number>(0);

  const getActiveRows = () => {
    if (createdRoomCode) {
      const rows = [
        ['back'],
        ['copy-code', 'copy-link'],
      ];
      if (multiplayerClient.getRole() === 'host') {
        rows.push(['btn-start']);
      }
      return rows;
    }

    if (tab === 'create') {
      const rows = [
        ['back'],
        ['tab-create', 'tab-join'],
        ['mode-coop', 'mode-versus'],
        ['mode-2v2', 'mode-ffa'],
        ['size-classic', 'size-large', 'size-giant'],
      ];
      if (mode === 'coop') {
        rows.push(['stage']);
      }
      rows.push(['btn-create']);
      return rows;
    }

    // tab === 'join'
    return [
      ['back'],
      ['tab-create', 'tab-join'],
      ['join-input', 'join-paste'],
      ['btn-join'],
    ];
  };

  const activeRows = getActiveRows();
  const safeRow = Math.min(currentRow, activeRows.length - 1);
  const safeCol = Math.min(currentCol, (activeRows[safeRow]?.length || 1) - 1);
  const focusedId = activeRows[safeRow]?.[safeCol] || '';

  const focusedIdRef = useRef(focusedId);
  focusedIdRef.current = focusedId;

  const currentRowRef = useRef(safeRow);
  currentRowRef.current = safeRow;

  const currentColRef = useRef(safeCol);
  currentColRef.current = safeCol;

  const activeRowsRef = useRef(activeRows);
  activeRowsRef.current = activeRows;

  const createdRoomCodeRef = useRef(createdRoomCode);
  createdRoomCodeRef.current = createdRoomCode;

  const tabRef = useRef(tab);
  tabRef.current = tab;

  const modeRef = useRef(mode);
  modeRef.current = mode;

  const mapSizeRef = useRef(mapSize);
  mapSizeRef.current = mapSize;

  const stageRef = useRef(stage);
  stageRef.current = stage;

  const onBackRef = useRef(onBack);
  onBackRef.current = onBack;

  const handleCreateRoomRef = useRef(handleCreateRoom);
  handleCreateRoomRef.current = handleCreateRoom;

  const handleJoinRoomRef = useRef(handleJoinRoom);
  handleJoinRoomRef.current = handleJoinRoom;

  const handleStartGameRef = useRef(handleStartGame);
  handleStartGameRef.current = handleStartGame;

  const copyRoomCodeRef = useRef(copyRoomCode);
  copyRoomCodeRef.current = copyRoomCode;

  const copyInviteLinkRef = useRef(copyInviteLink);
  copyInviteLinkRef.current = copyInviteLink;

  const activateFocused = () => {
    const id = focusedIdRef.current;
    if (id === 'back') {
      soundManager.playHitSteel();
      multiplayerClient.disconnect();
      if (createdRoomCodeRef.current) {
        setCreatedRoomCode(null);
        setPeerJoined(false);
        setConnectedPlayers([]);
      } else {
        onBackRef.current();
      }
      return;
    }
    if (id === 'tab-create') {
      soundManager.playHitSteel();
      setTab('create');
      setErrorMessage(null);
      return;
    }
    if (id === 'tab-join') {
      soundManager.playHitSteel();
      setTab('join');
      setErrorMessage(null);
      return;
    }
    if (id === 'mode-coop') {
      soundManager.playHitSteel();
      setMode('coop');
      return;
    }
    if (id === 'mode-versus') {
      soundManager.playHitSteel();
      setMode('versus');
      return;
    }
    if (id === 'mode-2v2') {
      soundManager.playHitSteel();
      setMode('2v2');
      return;
    }
    if (id === 'mode-ffa') {
      soundManager.playHitSteel();
      setMode('ffa');
      if (mapSizeRef.current === 'classic') setMapSize('large');
      return;
    }
    if (id === 'size-classic') {
      if (modeRef.current !== 'ffa') {
        soundManager.playHitSteel();
        setMapSize('classic');
      }
      return;
    }
    if (id === 'size-large') {
      soundManager.playHitSteel();
      setMapSize('large');
      return;
    }
    if (id === 'size-giant') {
      soundManager.playHitSteel();
      setMapSize('giant');
      return;
    }
    if (id === 'btn-create') {
      handleCreateRoomRef.current();
      return;
    }
    if (id === 'join-input') {
      const el = document.getElementById('lobby-room-code-input') as HTMLInputElement;
      if (el) el.focus();
      return;
    }
    if (id === 'join-paste') {
      navigator.clipboard.readText().then((txt) => {
        if (txt) setRoomCodeInput(txt.trim().toUpperCase());
      }).catch(() => {});
      return;
    }
    if (id === 'btn-join') {
      handleJoinRoomRef.current();
      return;
    }
    if (id === 'copy-code') {
      copyRoomCodeRef.current();
      return;
    }
    if (id === 'copy-link') {
      copyInviteLinkRef.current();
      return;
    }
    if (id === 'btn-start') {
      handleStartGameRef.current();
      return;
    }
  };

  const activateFocusedRef = useRef(activateFocused);
  activateFocusedRef.current = activateFocused;

  // Gamepad & Keyboard Navigation Loop
  useEffect(() => {
    let animId: number;
    let prevUp = false;
    let prevDown = false;
    let prevLeft = false;
    let prevRight = false;
    let prevConfirm = false;
    let prevCancel = false;
    let prevStart = false;
    let holdTimer = 0;
    let heldDirection: 'up' | 'down' | 'left' | 'right' | null = null;

    const INITIAL_HOLD_DELAY = 450;
    const REPEAT_RATE = 250;

    const moveNav = (dir: 'up' | 'down' | 'left' | 'right') => {
      const rows = activeRowsRef.current;
      const curR = currentRowRef.current;
      const curC = currentColRef.current;

      if (dir === 'up') {
        soundManager.playMenuMove();
        const nextR = curR > 0 ? curR - 1 : rows.length - 1;
        setCurrentRow(nextR);
        setCurrentCol(Math.min(curC, (rows[nextR]?.length || 1) - 1));
      } else if (dir === 'down') {
        soundManager.playMenuMove();
        const nextR = curR < rows.length - 1 ? curR + 1 : 0;
        setCurrentRow(nextR);
        setCurrentCol(Math.min(curC, (rows[nextR]?.length || 1) - 1));
      } else if (dir === 'left') {
        if (focusedIdRef.current === 'stage') {
          soundManager.playHitSteel();
          setStage((prev) => Math.max(1, prev - 1));
        } else {
          soundManager.playMenuMove();
          const rowLen = rows[curR]?.length || 1;
          const nextC = curC > 0 ? curC - 1 : rowLen - 1;
          setCurrentCol(nextC);
        }
      } else if (dir === 'right') {
        if (focusedIdRef.current === 'stage') {
          soundManager.playHitSteel();
          setStage((prev) => Math.min(35, prev + 1));
        } else {
          soundManager.playMenuMove();
          const rowLen = rows[curR]?.length || 1;
          const nextC = curC < rowLen - 1 ? curC + 1 : 0;
          setCurrentCol(nextC);
        }
      }
    };

    let initialized = false;
    let mountCooldownUntil = 0;

    const poll = (time: number) => {
      const pad = gamepadManager.pollMenuInput();
      if (pad) {
        if (pad.anyButton) {
          soundManager.unlockAudio();
        }

        // On initial mount, absorb any held buttons
        if (!initialized) {
          initialized = true;
          mountCooldownUntil = time + 250;
          prevConfirm = pad.confirm;
          prevCancel = pad.cancel;
          prevStart = pad.start;
          prevUp = pad.up;
          prevDown = pad.down;
          prevLeft = pad.left;
          prevRight = pad.right;
          animId = requestAnimationFrame(poll);
          return;
        }

        const isUp = pad.up;
        const isDown = pad.down;
        const isLeft = pad.left;
        const isRight = pad.right;

        // Fresh press
        if (isLeft && !prevLeft) {
          heldDirection = 'left';
          holdTimer = time + INITIAL_HOLD_DELAY;
          moveNav('left');
        } else if (isRight && !prevRight) {
          heldDirection = 'right';
          holdTimer = time + INITIAL_HOLD_DELAY;
          moveNav('right');
        } else if (isUp && !prevUp) {
          heldDirection = 'up';
          holdTimer = time + INITIAL_HOLD_DELAY;
          moveNav('up');
        } else if (isDown && !prevDown) {
          heldDirection = 'down';
          holdTimer = time + INITIAL_HOLD_DELAY;
          moveNav('down');
        } else if (heldDirection && ((heldDirection === 'left' && isLeft) || (heldDirection === 'right' && isRight) || (heldDirection === 'up' && isUp) || (heldDirection === 'down' && isDown))) {
          if (time >= holdTimer) {
            holdTimer = time + REPEAT_RATE;
            moveNav(heldDirection);
          }
        } else if (!isUp && !isDown && !isLeft && !isRight) {
          heldDirection = null;
          holdTimer = 0;
        }

        prevUp = isUp;
        prevDown = isDown;
        prevLeft = isLeft;
        prevRight = isRight;

        // Confirm: Button 0 (A) or Button 2 (X)
        const confirmPressed = pad.confirm;
        const confirmTrigger = confirmPressed && !prevConfirm;
        prevConfirm = confirmPressed;

        if (confirmTrigger && time >= mountCooldownUntil) {
          activateFocusedRef.current();
        }

        // Start: Button 9
        const startPressed = pad.start;
        const startTrigger = startPressed && !prevStart;
        prevStart = startPressed;

        if (startTrigger && time >= mountCooldownUntil) {
          if (createdRoomCodeRef.current) {
            handleStartGameRef.current();
          } else if (tabRef.current === 'create') {
            handleCreateRoomRef.current();
          } else {
            handleJoinRoomRef.current();
          }
        }

        // Cancel: Button 1 (B)
        const cancelPressed = pad.cancel;
        const cancelTrigger = cancelPressed && !prevCancel;
        prevCancel = cancelPressed;

        if (cancelTrigger && time >= mountCooldownUntil) {
          soundManager.playHitSteel();
          if (createdRoomCodeRef.current) {
            multiplayerClient.disconnect();
            setCreatedRoomCode(null);
            setPeerJoined(false);
            setConnectedPlayers([]);
          } else {
            multiplayerClient.disconnect();
            onBackRef.current();
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
        prevStart = false;
      }

      animId = requestAnimationFrame(poll);
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        if (e.key === 'Escape') {
          (e.target as HTMLElement).blur();
        }
        return;
      }

      e.stopPropagation();

      if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') {
        e.preventDefault();
        moveNav('left');
      } else if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
        e.preventDefault();
        moveNav('right');
      } else if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') {
        e.preventDefault();
        moveNav('up');
      } else if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') {
        e.preventDefault();
        moveNav('down');
      } else if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        activateFocusedRef.current();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        soundManager.playHitSteel();
        if (createdRoomCodeRef.current) {
          multiplayerClient.disconnect();
          setCreatedRoomCode(null);
          setPeerJoined(false);
          setConnectedPlayers([]);
        } else {
          multiplayerClient.disconnect();
          onBackRef.current();
        }
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
      id="multiplayer-lobby-container"
      className="flex flex-col items-center justify-between w-full max-w-xl mx-auto max-h-[96vh] sm:max-h-[92vh] overflow-y-auto bg-[#1a1a1a] border-4 border-[#444] p-3 sm:p-5 text-white font-pixel select-none shadow-2xl relative my-auto scrollbar-thin"
    >
      <style>{`
        @media (max-height: 520px) {
          #multiplayer-lobby-container {
            min-height: auto !important;
            max-height: 98vh !important;
            padding: 8px 12px !important;
            overflow-y: auto !important;
          }
          #lobby-header-logo {
            margin-top: 2px !important;
            margin-bottom: 4px !important;
          }
          #lobby-header-h2 {
            font-size: 1.05rem !important;
            line-height: 1.2 !important;
          }
          #lobby-header-sub {
            font-size: 7px !important;
            margin-top: 1px !important;
          }
          #lobby-tabs {
            margin-bottom: 6px !important;
          }
          #tab-create-room, #tab-join-room {
            padding-top: 4px !important;
            padding-bottom: 4px !important;
            font-size: 10px !important;
          }
          #lobby-create-form, #lobby-join-form {
            padding: 8px !important;
            gap: 6px !important;
          }
          .protocol-btn {
            padding: 4px 6px !important;
          }
          .protocol-desc {
            display: none !important;
          }
          .protocol-title {
            font-size: 10px !important;
          }
          #arena-dimensions-grid button {
            padding: 3px 4px !important;
            font-size: 8px !important;
          }
          #btn-confirm-create-room, #btn-confirm-join-room {
            margin-top: 4px !important;
            padding: 6px 8px !important;
            font-size: 10px !important;
          }
        }
      `}</style>

      {/* Top Bar: Back button, Server status, Ping */}
      <div className="w-full flex items-center justify-between pb-2 sm:pb-3 border-b-2 border-zinc-800">
        <button
          id="lobby-back-btn"
          onClick={() => {
            soundManager.playHitSteel();
            multiplayerClient.disconnect();
            onBack();
          }}
          className={`flex items-center gap-1.5 text-[9px] sm:text-xs transition-all py-1 px-2.5 bg-zinc-900 border rounded ${
            focusedId === 'back'
              ? 'ring-2 ring-[#f8b800] ring-offset-2 ring-offset-black text-[#f8b800] border-[#f8b800] scale-105 font-bold shadow-[0_0_10px_rgba(248,184,0,0.5)]'
              : 'border-zinc-700 text-zinc-400 hover:text-amber-400'
          }`}
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>{createdRoomCode ? 'LEAVE ROOM' : 'TITLE'}</span>
        </button>

        <div className="flex items-center gap-2">
          {/* Connection status beacon */}
          <div className="flex items-center gap-1 text-[8px] sm:text-[9px] bg-zinc-900 border border-zinc-700 px-2 py-1 rounded">
            <Radio
              className={`w-3 h-3 ${
                serverConnected ? 'text-emerald-400 animate-pulse' : 'text-red-500'
              }`}
            />
            <span className={serverConnected ? 'text-emerald-400' : 'text-red-400'}>
              {serverConnected ? 'SERVER OK' : 'CONNECTING...'}
            </span>
          </div>

          {/* Latency Indicator */}
          <div className="flex items-center gap-1 text-[8px] sm:text-[9px] bg-zinc-900 border border-zinc-700 px-2 py-1 rounded text-amber-400">
            <Wifi className="w-3 h-3 text-amber-400" />
            <span>{ping > 0 ? `${ping}ms` : '-- ms'}</span>
          </div>
        </div>
      </div>

      {/* Lobby Header Logo */}
      <div id="lobby-header-logo" className="flex flex-col items-center my-2 sm:my-3 text-center">
        <h2 id="lobby-header-h2" className="text-lg sm:text-2xl font-bold tracking-widest text-[#f8b800] drop-shadow-[0_3px_0_#704000]">
          ONLINE COMBAT LOBBY
        </h2>
        <div id="lobby-header-sub" className="text-[7px] sm:text-[9px] text-zinc-400 tracking-wider mt-1 uppercase">
          LOW-LATENCY WEBSOCKET MULTIPLAYER
        </div>
      </div>

      {/* Countdown Splash Overlay */}
      {countdown !== null && (
        <div className="absolute inset-0 bg-black/90 z-50 flex flex-col items-center justify-center backdrop-blur-sm animate-fade-in">
          <div className="text-6xl font-extrabold text-[#f8b800] animate-bounce">
            {countdown}
          </div>
          <div className="text-sm tracking-widest text-white mt-3 uppercase animate-pulse">
            PREPARE FOR BATTLE!
          </div>
        </div>
      )}

      {/* Error / Alert Message */}
      {errorMessage && (
        <div className="w-full bg-red-950/80 border border-red-700 text-red-300 text-[9px] py-1.5 px-3 rounded flex items-center gap-2 mb-2">
          <AlertTriangle className="w-3.5 h-3.5 text-red-400 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Main Mode / Room Selection */}
      {!createdRoomCode ? (
        <div className="w-full flex-1 flex flex-col items-center">
          {/* Tabs: CREATE or JOIN */}
          <div className="w-full grid grid-cols-2 gap-2 mb-4">
            <button
              id="tab-create-room"
              onClick={() => {
                soundManager.playHitSteel();
                setTab('create');
                setErrorMessage(null);
              }}
              className={`py-2 text-xs text-center border-2 transition-all ${
                focusedId === 'tab-create'
                  ? 'ring-2 ring-[#f8b800] ring-offset-2 ring-offset-black scale-[1.02] z-10 shadow-[0_0_12px_rgba(248,184,0,0.6)]'
                  : ''
              } ${
                tab === 'create'
                  ? 'bg-amber-500/20 border-[#f8b800] text-[#f8b800] font-bold shadow-md'
                  : 'bg-zinc-900 border-zinc-700 text-zinc-400 hover:text-white'
              }`}
            >
              {focusedId === 'tab-create' && <span className="text-[#f8b800] animate-pulse mr-1">▶</span>}
              CREATE ROOM
            </button>
            <button
              id="tab-join-room"
              onClick={() => {
                soundManager.playHitSteel();
                setTab('join');
                setErrorMessage(null);
              }}
              className={`py-2 text-xs text-center border-2 transition-all ${
                focusedId === 'tab-join'
                  ? 'ring-2 ring-[#f8b800] ring-offset-2 ring-offset-black scale-[1.02] z-10 shadow-[0_0_12px_rgba(248,184,0,0.6)]'
                  : ''
              } ${
                tab === 'join'
                  ? 'bg-amber-500/20 border-[#f8b800] text-[#f8b800] font-bold shadow-md'
                  : 'bg-zinc-900 border-zinc-700 text-zinc-400 hover:text-white'
              }`}
            >
              {focusedId === 'tab-join' && <span className="text-[#f8b800] animate-pulse mr-1">▶</span>}
              JOIN ROOM
            </button>
          </div>

          {tab === 'create' ? (
            /* CREATE ROOM VIEW */
            <div id="lobby-create-form" className="w-full flex flex-col gap-3.5 text-[10px] bg-zinc-900/60 p-4 rounded border border-zinc-800">
              {/* Game Mode */}
              <div>
                <label className="text-zinc-400 block mb-1.5 font-bold uppercase tracking-wider">
                  COMBAT PROTOCOL
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      soundManager.playHitSteel();
                      setMode('coop');
                    }}
                    className={`protocol-btn p-2.5 rounded border text-left flex flex-col gap-1 transition-all ${
                      focusedId === 'mode-coop'
                        ? 'ring-2 ring-[#f8b800] ring-offset-2 ring-offset-black scale-[1.02] z-10 shadow-[0_0_12px_rgba(248,184,0,0.6)]'
                        : ''
                    } ${
                      mode === 'coop'
                        ? 'bg-emerald-950/40 border-emerald-500 text-emerald-300'
                        : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:border-zinc-700'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 font-bold text-xs">
                      {focusedId === 'mode-coop' && <span className="text-[#f8b800] animate-pulse">▶</span>}
                      <span className="text-emerald-400 font-mono text-[9px]">[2P]</span>
                      <span className="protocol-title">2P CO-OP</span>
                    </div>
                    <div className="text-[8px] text-zinc-400 leading-tight protocol-desc">
                      Defend Eagle Base vs 20 Enemy Tanks!
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      soundManager.playHitSteel();
                      setMode('versus');
                    }}
                    className={`protocol-btn p-2.5 rounded border text-left flex flex-col gap-1 transition-all ${
                      focusedId === 'mode-versus'
                        ? 'ring-2 ring-[#f8b800] ring-offset-2 ring-offset-black scale-[1.02] z-10 shadow-[0_0_12px_rgba(248,184,0,0.6)]'
                        : ''
                    } ${
                      mode === 'versus'
                        ? 'bg-red-950/40 border-red-500 text-red-300'
                        : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:border-zinc-700'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 font-bold text-xs">
                      {focusedId === 'mode-versus' && <span className="text-[#f8b800] animate-pulse">▶</span>}
                      <span className="text-red-400 font-mono text-[9px]">[1V1]</span>
                      <span className="protocol-title">1V1 VERSUS</span>
                    </div>
                    <div className="text-[8px] text-zinc-400 leading-tight protocol-desc">
                      Duel! P1 vs P2 with 5 lives each!
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      soundManager.playHitSteel();
                      setMode('2v2');
                    }}
                    className={`protocol-btn p-2.5 rounded border text-left flex flex-col gap-1 transition-all ${
                      focusedId === 'mode-2v2'
                        ? 'ring-2 ring-[#f8b800] ring-offset-2 ring-offset-black scale-[1.02] z-10 shadow-[0_0_12px_rgba(248,184,0,0.6)]'
                        : ''
                    } ${
                      mode === '2v2'
                        ? 'bg-blue-950/40 border-blue-500 text-blue-300'
                        : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:border-zinc-700'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 font-bold text-xs">
                      {focusedId === 'mode-2v2' && <span className="text-[#f8b800] animate-pulse">▶</span>}
                      <span className="text-blue-400 font-mono text-[9px]">[2V2]</span>
                      <span className="protocol-title">2V2 TEAMS</span>
                    </div>
                    <div className="text-[8px] text-zinc-400 leading-tight protocol-desc">
                      Team A vs Team B with Friendly Shield!
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      soundManager.playHitSteel();
                      setMode('ffa');
                      if (mapSize === 'classic') {
                        setMapSize('large');
                      }
                    }}
                    className={`protocol-btn p-2.5 rounded border text-left flex flex-col gap-1 transition-all ${
                      focusedId === 'mode-ffa'
                        ? 'ring-2 ring-[#f8b800] ring-offset-2 ring-offset-black scale-[1.02] z-10 shadow-[0_0_12px_rgba(248,184,0,0.6)]'
                        : ''
                    } ${
                      mode === 'ffa'
                        ? 'bg-purple-950/40 border-purple-500 text-purple-300'
                        : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:border-zinc-700'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 font-bold text-xs">
                      {focusedId === 'mode-ffa' && <span className="text-[#f8b800] animate-pulse">▶</span>}
                      <span className="text-purple-400 font-mono text-[9px]">[8P]</span>
                      <span className="protocol-title">8 FREE-FOR-ALL</span>
                    </div>
                    <div className="text-[8px] text-zinc-400 leading-tight protocol-desc">
                      8 tanks battle in expanded arena!
                    </div>
                  </button>
                </div>
              </div>

              {/* Map Size Selector */}
              <div>
                <label className="text-zinc-400 block mb-1.5 font-bold uppercase tracking-wider">
                  ARENA DIMENSIONS
                </label>
                <div id="arena-dimensions-grid" className="grid grid-cols-3 gap-2">
                  {(['classic', 'large', 'giant'] as const).map((sz) => {
                    const isClassicFfaDisabled = mode === 'ffa' && sz === 'classic';
                    const szId = `size-${sz}`;
                    const isFocused = focusedId === szId;
                    return (
                      <button
                        key={sz}
                        type="button"
                        disabled={isClassicFfaDisabled}
                        onClick={() => {
                          soundManager.playHitSteel();
                          setMapSize(sz);
                        }}
                        className={`py-1.5 px-2 rounded border text-center uppercase text-[9px] transition-all ${
                          isFocused
                            ? 'ring-2 ring-[#f8b800] ring-offset-2 ring-offset-black scale-105 z-10 shadow-[0_0_12px_rgba(248,184,0,0.6)]'
                            : ''
                        } ${
                          isClassicFfaDisabled
                            ? 'opacity-30 cursor-not-allowed bg-zinc-900 border-zinc-800 text-zinc-600'
                            : mapSize === sz
                            ? 'bg-amber-500/20 border-[#f8b800] text-[#f8b800] font-bold'
                            : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:border-zinc-700'
                        }`}
                        title={isClassicFfaDisabled ? '8-Player FFA requires Large or Giant arena' : undefined}
                      >
                        {isFocused && <span className="text-[#f8b800] animate-pulse mr-1">▶</span>}
                        {sz === 'classic'
                          ? (mode === 'ffa' ? '26x26 (LOCKED)' : '26x26 STD')
                          : sz === 'large'
                          ? '34x34 LRG'
                          : '42x42 MAX'}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Stage Selector */}
              {mode === 'coop' && (
                <div
                  className={`transition-all rounded p-1.5 ${
                    focusedId === 'stage'
                      ? 'ring-2 ring-[#f8b800] ring-offset-2 ring-offset-black bg-zinc-950/80'
                      : ''
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-zinc-400 font-bold uppercase flex items-center gap-1">
                      {focusedId === 'stage' && <span className="text-[#f8b800] animate-pulse">▶</span>}
                      <span>MISSION STAGE</span>
                    </span>
                    <span className="text-amber-400 font-bold font-mono">STAGE {stage}</span>
                  </div>
                  <input
                    type="range"
                    min="1"
                    max="35"
                    value={stage}
                    onChange={(e) => setStage(parseInt(e.target.value, 10))}
                    className="w-full accent-amber-500 h-2 bg-zinc-800 rounded appearance-none cursor-pointer"
                  />
                  {focusedId === 'stage' && (
                    <div className="text-[8px] text-amber-400/80 font-mono mt-0.5 text-center">
                      [← / →] ADJUST STAGE (1-35)
                    </div>
                  )}
                </div>
              )}

              {/* Create Button */}
              <button
                id="btn-confirm-create-room"
                onClick={handleCreateRoom}
                className={`mt-2 w-full py-2.5 bg-[#f8b800] hover:bg-amber-400 text-black font-bold rounded text-xs tracking-wider transition-all active:translate-y-px shadow-lg ${
                  focusedId === 'btn-create'
                    ? 'ring-4 ring-white ring-offset-2 ring-offset-black scale-[1.02] shadow-[0_0_16px_rgba(248,184,0,0.9)] font-extrabold'
                    : ''
                }`}
              >
                {focusedId === 'btn-create' && <span className="mr-1.5 animate-pulse">▶</span>}
                GENERATE BATTLE ROOM
              </button>
            </div>
          ) : (
            /* JOIN ROOM VIEW */
            <form
              id="lobby-join-form"
              onSubmit={handleJoinRoom}
              className="w-full flex flex-col gap-4 text-[10px] bg-zinc-900/60 p-4 rounded border border-zinc-800"
            >
              <div>
                <label className="text-zinc-400 block mb-1.5 font-bold uppercase tracking-wider">
                  ENTER 6-DIGIT ROOM CODE
                </label>
                <div className="flex gap-2">
                  <input
                    id="lobby-room-code-input"
                    type="text"
                    maxLength={8}
                    value={roomCodeInput}
                    onChange={(e) => setRoomCodeInput(e.target.value.toUpperCase())}
                    placeholder="e.g. CITY77"
                    autoFocus
                    className={`flex-1 bg-black border-2 px-3 py-2 text-center text-sm font-bold text-[#f8b800] tracking-widest uppercase rounded outline-none font-mono transition-all ${
                      focusedId === 'join-input'
                        ? 'border-[#f8b800] ring-2 ring-[#f8b800] ring-offset-2 ring-offset-black'
                        : 'border-zinc-700 focus:border-[#f8b800]'
                    }`}
                  />
                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        const text = await navigator.clipboard.readText();
                        if (text) setRoomCodeInput(text.trim().toUpperCase());
                      } catch {}
                    }}
                    className={`px-3 bg-zinc-800 hover:bg-zinc-700 border rounded text-zinc-300 text-[9px] transition-all ${
                      focusedId === 'join-paste'
                        ? 'border-[#f8b800] text-[#f8b800] ring-2 ring-[#f8b800] ring-offset-2 ring-offset-black scale-105'
                        : 'border-zinc-600'
                    }`}
                  >
                    {focusedId === 'join-paste' && <span className="text-[#f8b800] animate-pulse mr-1">▶</span>}
                    PASTE
                  </button>
                </div>
              </div>

              <button
                type="submit"
                id="btn-confirm-join-room"
                className={`w-full py-2.5 bg-[#f8b800] hover:bg-amber-400 text-black font-bold rounded text-xs tracking-wider transition-all active:translate-y-px shadow-lg ${
                  focusedId === 'btn-join'
                    ? 'ring-4 ring-white ring-offset-2 ring-offset-black scale-[1.02] shadow-[0_0_16px_rgba(248,184,0,0.9)] font-extrabold'
                    : ''
                }`}
              >
                {focusedId === 'btn-join' && <span className="mr-1.5 animate-pulse">▶</span>}
                CONNECT & JOIN
              </button>
            </form>
          )}
        </div>
      ) : (
        /* ROOM ACTIVE LOBBY (HOST / GUEST CONNECTED) */
        <div className="w-full flex-1 flex flex-col justify-between bg-zinc-900/60 p-4 rounded border border-zinc-800">
          {/* Room Code Banner */}
          <div className="flex flex-col items-center bg-black/60 border border-zinc-700 p-3 rounded text-center">
            <div className="text-[9px] text-zinc-400 tracking-wider uppercase mb-1">
              ROOM ACCESS CODE
            </div>
            <div className="text-2xl sm:text-3xl font-bold font-mono tracking-widest text-[#f8b800] my-1">
              {createdRoomCode}
            </div>

            <div className="flex items-center gap-2 mt-2">
              <button
                type="button"
                onClick={copyRoomCode}
                className={`flex items-center gap-1 text-[8px] sm:text-[9px] bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border px-2.5 py-1 rounded transition-all ${
                  focusedId === 'copy-code'
                    ? 'border-[#f8b800] ring-2 ring-[#f8b800] ring-offset-2 ring-offset-black text-[#f8b800] scale-105'
                    : 'border-zinc-600'
                }`}
              >
                {focusedId === 'copy-code' && <span className="text-[#f8b800] animate-pulse mr-0.5">▶</span>}
                {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                <span>{copied ? 'COPIED!' : 'COPY CODE'}</span>
              </button>
              <button
                type="button"
                onClick={copyInviteLink}
                className={`flex items-center gap-1 text-[8px] sm:text-[9px] bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border px-2.5 py-1 rounded transition-all ${
                  focusedId === 'copy-link'
                    ? 'border-[#f8b800] ring-2 ring-[#f8b800] ring-offset-2 ring-offset-black text-[#f8b800] scale-105'
                    : 'border-zinc-600'
                }`}
              >
                {focusedId === 'copy-link' && <span className="text-[#f8b800] animate-pulse mr-0.5">▶</span>}
                <Zap className="w-3 h-3 text-amber-400" />
                <span>COPY INVITE LINK</span>
              </button>
            </div>
          </div>

          {/* Player Cards (Adaptive for 2P, 2v2 Teams, and 8 FFA) */}
          {mode === '2v2' ? (
            <div className="grid grid-cols-2 gap-3 my-4">
              {/* Team A (Slots 1 & 3) */}
              <div className="bg-blue-950/30 border-2 border-blue-500/60 p-2.5 rounded flex flex-col gap-2">
                <div className="text-[9px] font-bold text-blue-300 flex items-center justify-between border-b border-blue-800/60 pb-1">
                  <span>TEAM A (BLUE)</span>
                  <span className="text-[8px] bg-blue-900/60 px-1.5 py-0.5 rounded text-blue-200">BASE DEFENSE</span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {[1, 3].map((slot) => {
                    const isOccupied = connectedPlayers.some((p) => p.slot === slot) || (slot === 1 && multiplayerClient.getRole() === 'host') || (slot === multiplayerClient.getSlot());
                    const color = slot === 1 ? '#f8b800' : '#00a8a8';
                    const core = slot === 1 ? '#ffffff' : '#88f8f8';
                    const label = slot === 1 ? 'P1 (GOLD)' : 'P3 (CYAN)';
                    return (
                      <div key={slot} className={`p-2 rounded flex flex-col items-center text-center border ${isOccupied ? 'bg-zinc-950 border-blue-400/60' : 'bg-zinc-950/40 border-zinc-800'}`}>
                        <div className="w-5 h-5 my-1">
                          <svg viewBox="0 0 16 16" className="w-5 h-5" style={{ fill: isOccupied ? color : '#444' }}>
                            <rect x="1" y="2" width="3" height="12" />
                            <rect x="12" y="2" width="3" height="12" />
                            <rect x="4" y="4" width="8" height="8" />
                            <rect x="7" y="0" width="2" height="5" />
                            <rect x="6" y="6" width="4" height="4" fill={isOccupied ? core : '#222'} />
                          </svg>
                        </div>
                        <div className="text-[8px] font-bold" style={{ color: isOccupied ? color : '#666' }}>{label}</div>
                        <div className={`text-[7px] font-mono mt-0.5 ${isOccupied ? 'text-emerald-400' : 'text-zinc-600'}`}>
                          {isOccupied ? '[READY]' : '[OPEN]'}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Team B (Slots 2 & 4) */}
              <div className="bg-red-950/30 border-2 border-red-500/60 p-2.5 rounded flex flex-col gap-2">
                <div className="text-[9px] font-bold text-red-300 flex items-center justify-between border-b border-red-800/60 pb-1">
                  <span>TEAM B (RED)</span>
                  <span className="text-[8px] bg-red-900/60 px-1.5 py-0.5 rounded text-red-200">NORTH ATTACK</span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {[2, 4].map((slot) => {
                    const isOccupied = connectedPlayers.some((p) => p.slot === slot) || (slot === multiplayerClient.getSlot());
                    const color = slot === 2 ? '#00a800' : '#e40058';
                    const core = slot === 2 ? '#78f878' : '#f87898';
                    const label = slot === 2 ? 'P2 (GREEN)' : 'P4 (RED)';
                    return (
                      <div key={slot} className={`p-2 rounded flex flex-col items-center text-center border ${isOccupied ? 'bg-zinc-950 border-red-400/60' : 'bg-zinc-950/40 border-zinc-800'}`}>
                        <div className="w-5 h-5 my-1">
                          <svg viewBox="0 0 16 16" className="w-5 h-5" style={{ fill: isOccupied ? color : '#444' }}>
                            <rect x="1" y="2" width="3" height="12" />
                            <rect x="12" y="2" width="3" height="12" />
                            <rect x="4" y="4" width="8" height="8" />
                            <rect x="7" y="0" width="2" height="5" />
                            <rect x="6" y="6" width="4" height="4" fill={isOccupied ? core : '#222'} />
                          </svg>
                        </div>
                        <div className="text-[8px] font-bold" style={{ color: isOccupied ? color : '#666' }}>{label}</div>
                        <div className={`text-[7px] font-mono mt-0.5 ${isOccupied ? 'text-emerald-400' : 'text-zinc-600'}`}>
                          {isOccupied ? '[READY]' : '[OPEN]'}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          ) : mode === 'ffa' ? (
            <div className="grid grid-cols-4 gap-2 my-3">
              {[
                { slot: 1, name: 'P1 GOLD', fill: '#f8b800', core: '#fff' },
                { slot: 2, name: 'P2 GRN', fill: '#00a800', core: '#78f878' },
                { slot: 3, name: 'P3 CYAN', fill: '#00a8a8', core: '#88f8f8' },
                { slot: 4, name: 'P4 RED', fill: '#e40058', core: '#f87898' },
                { slot: 5, name: 'P5 VIO', fill: '#940088', core: '#f878f8' },
                { slot: 6, name: 'P6 ORG', fill: '#f87800', core: '#fce4a0' },
                { slot: 7, name: 'P7 SILV', fill: '#b8b8b8', core: '#fff' },
                { slot: 8, name: 'P8 LIME', fill: '#78f800', core: '#c8ff78' },
              ].map((p) => {
                const isOccupied = connectedPlayers.some((cp) => cp.slot === p.slot) || (p.slot === 1 && multiplayerClient.getRole() === 'host') || (p.slot === multiplayerClient.getSlot());
                return (
                  <div key={p.slot} className={`p-1.5 rounded flex flex-col items-center text-center border ${isOccupied ? 'bg-zinc-950 border-amber-400/60' : 'bg-zinc-950/40 border-zinc-800'}`}>
                    <div className="w-4 h-4 my-1">
                      <svg viewBox="0 0 16 16" className="w-4 h-4" style={{ fill: isOccupied ? p.fill : '#444' }}>
                        <rect x="1" y="2" width="3" height="12" />
                        <rect x="12" y="2" width="3" height="12" />
                        <rect x="4" y="4" width="8" height="8" />
                        <rect x="7" y="0" width="2" height="5" />
                        <rect x="6" y="6" width="4" height="4" fill={isOccupied ? p.core : '#222'} />
                      </svg>
                    </div>
                    <div className="text-[7px] font-bold truncate w-full" style={{ color: isOccupied ? p.fill : '#666' }}>{p.name}</div>
                    <div className={`text-[6px] font-mono mt-0.5 ${isOccupied ? 'text-emerald-400' : 'text-zinc-600'}`}>
                      {isOccupied ? 'READY' : 'OPEN'}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 my-4">
              {/* Player 1 Slot (Gold Tank) */}
              <div className="bg-zinc-950 border-2 border-amber-500/60 p-3 rounded flex flex-col items-center text-center">
                <div className="text-[8px] text-zinc-400 font-bold mb-1">PLAYER 1 (HOST)</div>
                <div className="w-7 h-7 my-1">
                  <svg viewBox="0 0 16 16" className="w-7 h-7 fill-[#f8b800]">
                    <rect x="1" y="2" width="3" height="12" />
                    <rect x="12" y="2" width="3" height="12" />
                    <rect x="4" y="4" width="8" height="8" />
                    <rect x="7" y="0" width="2" height="5" />
                    <rect x="6" y="6" width="4" height="4" fill="#ffffff" />
                  </svg>
                </div>
                <div className="text-[9px] text-[#f8b800] font-bold">GOLD TANK</div>
                <div className="text-[8px] text-emerald-400 mt-1 font-mono">[READY]</div>
              </div>

              {/* Player 2 Slot (Green Tank) */}
              <div
                className={`p-3 rounded flex flex-col items-center text-center border-2 transition-all ${
                  peerJoined
                    ? 'bg-zinc-950 border-emerald-500/60'
                    : 'bg-zinc-950/60 border-zinc-800 animate-pulse'
                }`}
              >
                <div className="text-[8px] text-zinc-400 font-bold mb-1">PLAYER 2 (GUEST)</div>
                <div className="w-7 h-7 my-1">
                  <svg
                    viewBox="0 0 16 16"
                    className={`w-7 h-7 ${peerJoined ? 'fill-[#00a800]' : 'fill-zinc-700'}`}
                  >
                    <rect x="1" y="2" width="3" height="12" />
                    <rect x="12" y="2" width="3" height="12" />
                    <rect x="4" y="4" width="8" height="8" />
                    <rect x="7" y="0" width="2" height="5" />
                    <rect x="6" y="6" width="4" height="4" fill={peerJoined ? '#78f878' : '#333'} />
                  </svg>
                </div>
                <div className={`text-[9px] font-bold ${peerJoined ? 'text-[#00a800]' : 'text-zinc-500'}`}>
                  {peerJoined ? 'GREEN TANK' : 'WAITING FOR PEER...'}
                </div>
                <div
                  className={`text-[8px] mt-1 font-mono ${
                    peerJoined ? 'text-emerald-400' : 'text-amber-500 animate-pulse'
                  }`}
                >
                  {peerJoined ? '[CONNECTED]' : 'SHARE CODE OR LINK'}
                </div>
              </div>
            </div>
          )}

          {/* Mission Info Badge */}
          <div className="text-center text-[9px] text-zinc-400 mb-3">
            MODE: <span className="text-white font-bold">{mode.toUpperCase()}</span> | MAP:{' '}
            <span className="text-white font-bold">{mapSize.toUpperCase()}</span>
            {mode === 'coop' && (
              <span>
                {' '}
                | STAGE: <span className="text-white font-bold">{stage}</span>
              </span>
            )}
          </div>

          {/* Action Button: Start or Waiting */}
          {multiplayerClient.getRole() === 'host' ? (
            <button
              id="btn-host-start-battle"
              disabled={!(connectedPlayers.length >= 2 || peerJoined)}
              onClick={handleStartGame}
              className={`w-full py-3 rounded text-xs font-bold tracking-widest uppercase transition-all shadow-lg flex items-center justify-center gap-2 ${
                focusedId === 'btn-start'
                  ? 'ring-4 ring-white ring-offset-2 ring-offset-black scale-[1.02] shadow-[0_0_16px_rgba(16,185,129,0.9)]'
                  : ''
              } ${
                connectedPlayers.length >= 2 || peerJoined
                  ? 'bg-emerald-500 hover:bg-emerald-400 text-black cursor-pointer active:translate-y-px'
                  : 'bg-zinc-800 text-zinc-500 border border-zinc-700 cursor-not-allowed'
              }`}
            >
              {focusedId === 'btn-start' && <span className="text-black font-extrabold mr-1 animate-pulse">▶</span>}
              <Play className="w-4 h-4 fill-current" />
              <span>{connectedPlayers.length >= 2 || peerJoined ? 'START MISSION' : 'WAITING FOR PLAYERS...'}</span>
            </button>
          ) : (
            <div className="w-full py-3 bg-zinc-900 border border-zinc-700 rounded text-center text-[10px] text-amber-400 font-bold animate-pulse">
              WAITING FOR HOST TO LAUNCH BATTLE...
            </div>
          )}
        </div>
      )}

      {/* Footer Info & Controller Guide */}
      <div className="w-full pt-3 border-t border-zinc-800 flex flex-col sm:flex-row items-center justify-between gap-2 text-center">
        <div className="text-[8px] sm:text-[9px] text-[#f8b800] font-mono tracking-wider">
          [D-PAD / STICK] MOVE • [A] SELECT • [B] BACK / LEAVE • [START] LAUNCH
        </div>
        <div className="text-[7px] sm:text-[8px] text-zinc-500 tracking-wider">
          BATTLE CITY 1990 ONLINE ENGINE
        </div>
      </div>
    </div>
  );
};
