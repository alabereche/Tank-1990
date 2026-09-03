/**
 * Battle City 1990 - Authentic NES Multiplayer Lobby
 * High performance room creation, room join with 6-digit code,
 * 2P Co-Op vs Enemies & 1v1 PvP Versus mode selection,
 * latency meter, and real-time player presence.
 */

import React, { useState, useEffect, useRef } from 'react';
import { multiplayerClient } from '../network/MultiplayerClient';
import { soundManager } from '../engine/SoundManager';
import { MultiplayerMode, MultiplayerRole } from '../types';
import {
  Users,
  Swords,
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
      setErrorMessage(null);
    });

    const unsubPlayerJoined = multiplayerClient.on('player_joined', () => {
      soundManager.playPowerUpSpawn();
      setPeerJoined(true);
    });

    const unsubRoomJoined = multiplayerClient.on('room_joined', (data) => {
      soundManager.playPowerUpCollect();
      setCreatedRoomCode(data.code);
      setMode(data.mode);
      setPeerJoined(true);
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
          });
        }
      }, 1000);
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
      unsubPeerDisconnected();
      unsubError();
      if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
    };
  }, [mode, mapSize, stage, onLaunchGame]);

  const handleCreateRoom = () => {
    soundManager.unlockAudio();
    soundManager.playHitSteel();
    setErrorMessage(null);
    multiplayerClient.createRoom(mode, mapSize, stage);
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

  return (
    <div
      id="multiplayer-lobby-container"
      className="flex flex-col items-center justify-between w-full max-w-xl mx-auto min-h-[560px] bg-[#1a1a1a] border-4 border-[#444] p-5 text-white font-pixel select-none shadow-2xl relative"
    >
      {/* Top Bar: Back button, Server status, Ping */}
      <div className="w-full flex items-center justify-between pb-3 border-b-2 border-zinc-800">
        <button
          id="lobby-back-btn"
          onClick={() => {
            soundManager.playHitSteel();
            multiplayerClient.disconnect();
            onBack();
          }}
          className="flex items-center gap-1.5 text-[9px] sm:text-xs text-zinc-400 hover:text-amber-400 transition-colors py-1 px-2 bg-zinc-900 border border-zinc-700 rounded"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>TITLE</span>
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
      <div className="flex flex-col items-center my-3 text-center">
        <h2 className="text-xl sm:text-2xl font-bold tracking-widest text-[#f8b800] drop-shadow-[0_3px_0_#704000]">
          ONLINE COMBAT LOBBY
        </h2>
        <div className="text-[8px] sm:text-[9px] text-zinc-400 tracking-wider mt-1 uppercase">
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
                tab === 'create'
                  ? 'bg-amber-500/20 border-[#f8b800] text-[#f8b800] font-bold shadow-md'
                  : 'bg-zinc-900 border-zinc-700 text-zinc-400 hover:text-white'
              }`}
            >
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
                tab === 'join'
                  ? 'bg-amber-500/20 border-[#f8b800] text-[#f8b800] font-bold shadow-md'
                  : 'bg-zinc-900 border-zinc-700 text-zinc-400 hover:text-white'
              }`}
            >
              JOIN ROOM
            </button>
          </div>

          {tab === 'create' ? (
            /* CREATE ROOM VIEW */
            <div className="w-full flex flex-col gap-3.5 text-[10px] bg-zinc-900/60 p-4 rounded border border-zinc-800">
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
                    className={`p-2.5 rounded border text-left flex flex-col gap-1 transition-all ${
                      mode === 'coop'
                        ? 'bg-emerald-950/40 border-emerald-500 text-emerald-300'
                        : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:border-zinc-700'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 font-bold text-xs">
                      <Users className="w-4 h-4 text-emerald-400" />
                      <span>2P CO-OP</span>
                    </div>
                    <div className="text-[8px] text-zinc-400 leading-tight">
                      Team up to defend Eagle Base vs 20 Enemy Tanks!
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      soundManager.playHitSteel();
                      setMode('versus');
                    }}
                    className={`p-2.5 rounded border text-left flex flex-col gap-1 transition-all ${
                      mode === 'versus'
                        ? 'bg-red-950/40 border-red-500 text-red-300'
                        : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:border-zinc-700'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 font-bold text-xs">
                      <Swords className="w-4 h-4 text-red-400" />
                      <span>1V1 VERSUS</span>
                    </div>
                    <div className="text-[8px] text-zinc-400 leading-tight">
                      Tank duel! P1 (Gold) vs P2 (Green) with 5 lives each!
                    </div>
                  </button>
                </div>
              </div>

              {/* Map Size Selector */}
              <div>
                <label className="text-zinc-400 block mb-1.5 font-bold uppercase tracking-wider">
                  ARENA DIMENSIONS
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {(['classic', 'large', 'giant'] as const).map((sz) => (
                    <button
                      key={sz}
                      type="button"
                      onClick={() => {
                        soundManager.playHitSteel();
                        setMapSize(sz);
                      }}
                      className={`py-1.5 px-2 rounded border text-center uppercase text-[9px] transition-all ${
                        mapSize === sz
                          ? 'bg-amber-500/20 border-[#f8b800] text-[#f8b800] font-bold'
                          : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:border-zinc-700'
                      }`}
                    >
                      {sz === 'classic' ? '26x26 STD' : sz === 'large' ? '32x32 LRG' : '40x40 MAX'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Stage Selector */}
              {mode === 'coop' && (
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-zinc-400 font-bold uppercase">MISSION STAGE</span>
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
                </div>
              )}

              {/* Create Button */}
              <button
                id="btn-confirm-create-room"
                onClick={handleCreateRoom}
                className="mt-2 w-full py-2.5 bg-[#f8b800] hover:bg-amber-400 text-black font-bold rounded text-xs tracking-wider transition-transform active:translate-y-px shadow-lg"
              >
                GENERATE BATTLE ROOM
              </button>
            </div>
          ) : (
            /* JOIN ROOM VIEW */
            <form
              onSubmit={handleJoinRoom}
              className="w-full flex flex-col gap-4 text-[10px] bg-zinc-900/60 p-4 rounded border border-zinc-800"
            >
              <div>
                <label className="text-zinc-400 block mb-1.5 font-bold uppercase tracking-wider">
                  ENTER 6-DIGIT ROOM CODE
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    maxLength={8}
                    value={roomCodeInput}
                    onChange={(e) => setRoomCodeInput(e.target.value.toUpperCase())}
                    placeholder="e.g. CITY77"
                    autoFocus
                    className="flex-1 bg-black border-2 border-zinc-700 focus:border-[#f8b800] px-3 py-2 text-center text-sm font-bold text-[#f8b800] tracking-widest uppercase rounded outline-none font-mono"
                  />
                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        const text = await navigator.clipboard.readText();
                        if (text) setRoomCodeInput(text.trim().toUpperCase());
                      } catch {}
                    }}
                    className="px-3 bg-zinc-800 hover:bg-zinc-700 border border-zinc-600 rounded text-zinc-300 text-[9px]"
                  >
                    PASTE
                  </button>
                </div>
              </div>

              <button
                type="submit"
                id="btn-confirm-join-room"
                className="w-full py-2.5 bg-[#f8b800] hover:bg-amber-400 text-black font-bold rounded text-xs tracking-wider transition-transform active:translate-y-px shadow-lg"
              >
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
                className="flex items-center gap-1 text-[8px] sm:text-[9px] bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-600 px-2.5 py-1 rounded transition-colors"
              >
                {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                <span>{copied ? 'COPIED!' : 'COPY CODE'}</span>
              </button>
              <button
                type="button"
                onClick={copyInviteLink}
                className="flex items-center gap-1 text-[8px] sm:text-[9px] bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-600 px-2.5 py-1 rounded transition-colors"
              >
                <Zap className="w-3 h-3 text-amber-400" />
                <span>COPY INVITE LINK</span>
              </button>
            </div>
          </div>

          {/* Player Cards (P1 & P2) */}
          <div className="grid grid-cols-2 gap-3 my-4">
            {/* Player 1 Slot (Gold Tank) */}
            <div className="bg-zinc-950 border-2 border-amber-500/60 p-3 rounded flex flex-col items-center text-center">
              <div className="text-[8px] text-zinc-400 font-bold mb-1">PLAYER 1 (HOST)</div>
              {/* Gold Tank Silhouette */}
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
              {/* Green Tank Silhouette */}
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
              disabled={!peerJoined}
              onClick={handleStartGame}
              className={`w-full py-3 rounded text-xs font-bold tracking-widest uppercase transition-all shadow-lg flex items-center justify-center gap-2 ${
                peerJoined
                  ? 'bg-emerald-500 hover:bg-emerald-400 text-black cursor-pointer active:translate-y-px'
                  : 'bg-zinc-800 text-zinc-500 border border-zinc-700 cursor-not-allowed'
              }`}
            >
              <Play className="w-4 h-4 fill-current" />
              <span>{peerJoined ? 'START MISSION' : 'WAITING FOR PLAYER 2...'}</span>
            </button>
          ) : (
            <div className="w-full py-3 bg-zinc-900 border border-zinc-700 rounded text-center text-[10px] text-amber-400 font-bold animate-pulse">
              WAITING FOR HOST TO LAUNCH BATTLE...
            </div>
          )}
        </div>
      )}

      {/* Footer Info */}
      <div className="text-[8px] text-zinc-500 tracking-wider text-center pt-3 border-t border-zinc-800 w-full">
        BATTLE CITY 1990 ONLINE ENGINE - ZERO DESYNC WEBSOCKET PROTOCOL
      </div>
    </div>
  );
};
