/**
 * Battle City 1990 - Local Wi-Fi Co-Op & Cross-Play Modal
 * Connects two devices (Phone <-> Phone, PC <-> Phone, PC <-> PC)
 * over local Wi-Fi / Hotspot via WebRTC P2P DataChannel.
 */

import React, { useState, useEffect, useRef } from 'react';
import { localP2PService, P2PConnectionState } from '../services/LocalP2PService';
import { soundManager } from '../engine/SoundManager';
import { Wifi, Users, Smartphone, Monitor, Check, X, ArrowRight, RefreshCw, AlertCircle } from 'lucide-react';

interface WifiCoopModalProps {
  onClose: () => void;
  onStartBattle: (config: {
    roomCode: string;
    role: 'host' | 'guest';
    mode: 'coop' | 'versus';
    versusSubMode?: 'classic' | 'payload';
  }) => void;
}

export const WifiCoopModal: React.FC<WifiCoopModalProps> = ({ onClose, onStartBattle }) => {
  const [activeTab, setActiveTab] = useState<'host' | 'join'>('host');
  const [roomCode, setRoomCode] = useState<string>('');
  const [joinCode, setJoinCode] = useState<string>('');
  const [gameMode, setGameMode] = useState<'coop' | 'versus' | 'payload'>('coop');
  const [connState, setConnState] = useState<P2PConnectionState>('disconnected');
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [latency, setLatency] = useState<number | null>(null);
  const [isOfflineMode, setIsOfflineMode] = useState<boolean>(false);
  const [offlineToken, setOfflineToken] = useState<string>('');
  const [importToken, setImportToken] = useState<string>('');

  useEffect(() => {
    localP2PService.setCallbacks({
      onStateChange: (state, msg) => {
        setConnState(state);
        if (msg) setStatusMessage(msg);
        if (state === 'connected') {
          soundManager.playPowerUpCollect();
        }
      },
      onLatencyUpdate: (ms) => {
        setLatency(ms);
      },
      onStageStart: (stage) => {
        // If we are guest and host starts stage, launch automatically
        onStartBattle({
          roomCode: localP2PService.getRoomCode(),
          role: 'guest',
          mode: gameMode === 'payload' ? 'versus' : gameMode,
          versusSubMode: gameMode === 'payload' ? 'payload' : 'classic',
        });
      },
    });

    return () => {
      // Don't disconnect if we transition to battle
    };
  }, [gameMode, onStartBattle]);

  // Host: Automatically generate room code on tab select
  useEffect(() => {
    if (activeTab === 'host') {
      const code = Math.floor(1000 + Math.random() * 9000).toString();
      setRoomCode(code);
      localP2PService.createRoom(code).catch(() => {});
    } else {
      localP2PService.disconnect();
      setConnState('disconnected');
      setStatusMessage('');
    }
  }, [activeTab]);

  const handleJoin = async () => {
    if (joinCode.length < 4) return;
    soundManager.unlockAudio();
    soundManager.playMenuSelect();
    try {
      await localP2PService.joinRoom(joinCode);
    } catch (err: any) {
      soundManager.playHitBrick();
    }
  };

  const handleStartAsHost = () => {
    soundManager.unlockAudio();
    soundManager.playStageStart();
    localP2PService.sendStageStart(1);
    onStartBattle({
      roomCode,
      role: 'host',
      mode: gameMode === 'payload' ? 'versus' : gameMode,
      versusSubMode: gameMode === 'payload' ? 'payload' : 'classic',
    });
  };

  const handleRefreshHostCode = () => {
    soundManager.playMenuMove();
    const code = Math.floor(1000 + Math.random() * 9000).toString();
    setRoomCode(code);
    localP2PService.createRoom(code).catch(() => {});
  };

  return (
    <div
      id="wifi-coop-modal-overlay"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-xs p-2 sm:p-4 select-none animate-in fade-in duration-100"
      onClick={onClose}
    >
      <div
        id="wifi-coop-modal-content"
        className="relative w-full max-w-lg max-h-[96vh] flex flex-col bg-[#141418] border-2 sm:border-4 border-[#3c3c48] rounded shadow-2xl text-white font-pixel overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-3 sm:px-4 py-2 bg-[#1c1c24] border-b border-[#2d2d38] shrink-0">
          <div className="flex items-center gap-2 text-[#58b8d8]">
            <Wifi className="w-4 h-4 text-cyan-400 animate-pulse" />
            <span className="text-[10px] sm:text-xs tracking-widest font-bold">WI-FI LOCAL CO-OP & CROSS-PLAY</span>
          </div>
          <button
            onClick={onClose}
            className="text-zinc-400 hover:text-white px-2 py-0.5 text-[9px] sm:text-[10px] border border-zinc-700 bg-zinc-800 rounded font-pixel"
          >
            [X]
          </button>
        </div>

        {/* Tab Selection */}
        <div className="grid grid-cols-2 p-1.5 bg-[#0f0f14] border-b border-[#252530] gap-1.5 shrink-0">
          <button
            type="button"
            onClick={() => {
              soundManager.playMenuMove();
              setActiveTab('host');
            }}
            className={`py-1.5 px-3 text-[9px] sm:text-[10px] rounded border transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
              activeTab === 'host'
                ? 'bg-amber-950/70 border-[#f8b800] text-[#f8b800] font-bold shadow'
                : 'bg-zinc-900/60 border-zinc-800 text-zinc-400 hover:border-zinc-700'
            }`}
          >
            <span>HOST ROOM (P1 GOLD)</span>
          </button>

          <button
            type="button"
            onClick={() => {
              soundManager.playMenuMove();
              setActiveTab('join');
            }}
            className={`py-1.5 px-3 text-[9px] sm:text-[10px] rounded border transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
              activeTab === 'join'
                ? 'bg-emerald-950/70 border-emerald-400 text-emerald-300 font-bold shadow'
                : 'bg-zinc-900/60 border-zinc-800 text-zinc-400 hover:border-zinc-700'
            }`}
          >
            <span>JOIN ROOM (P2 GREEN)</span>
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2.5 text-xs">
          {activeTab === 'host' ? (
            <>
              {/* Room Code Display */}
              <div className="bg-black/60 border-2 border-amber-500/60 p-3 rounded flex flex-col items-center justify-center text-center">
                <span className="text-[8.5px] text-zinc-400 tracking-wider">YOUR 4-DIGIT WI-FI ROOM PIN:</span>
                <div className="flex items-center gap-3 my-1.5">
                  <span className="text-3xl sm:text-4xl text-[#f8b800] font-mono font-bold tracking-[0.3em] pl-[0.3em]">
                    {roomCode || '----'}
                  </span>
                  <button
                    type="button"
                    onClick={handleRefreshHostCode}
                    className="p-1.5 text-zinc-400 hover:text-amber-400 bg-zinc-800 border border-zinc-700 rounded active:scale-95"
                    title="Generate New Code"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                  </button>
                </div>
                <span className="text-[7.5px] text-zinc-400 font-sans">
                  Tell Player 2 (Phone or PC on the same Wi-Fi) to tap 'JOIN ROOM' and enter this PIN.
                </span>
              </div>

              {/* Mode Selector */}
              <div>
                <span className="text-[9px] text-zinc-300 block mb-1">SELECT BATTLE MODE:</span>
                <div className="grid grid-cols-3 gap-1.5">
                  <button
                    type="button"
                    onClick={() => setGameMode('coop')}
                    className={`p-1.5 rounded border text-left transition-all ${
                      gameMode === 'coop'
                        ? 'border-amber-400 bg-amber-950/50 text-amber-300'
                        : 'border-zinc-800 bg-zinc-900/50 text-zinc-400'
                    }`}
                  >
                    <div className="font-bold text-[8.5px] sm:text-[9.5px]">2P CO-OP</div>
                    <div className="text-[7px] text-zinc-400 font-sans mt-0.5">Defend eagle together</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setGameMode('versus')}
                    className={`p-1.5 rounded border text-left transition-all ${
                      gameMode === 'versus'
                        ? 'border-sky-400 bg-sky-950/50 text-sky-300'
                        : 'border-zinc-800 bg-zinc-900/50 text-zinc-400'
                    }`}
                  >
                    <div className="font-bold text-[8.5px] sm:text-[9.5px]">1V1 DUEL</div>
                    <div className="text-[7px] text-zinc-400 font-sans mt-0.5">Classic versus duel</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setGameMode('payload')}
                    className={`p-1.5 rounded border text-left transition-all ${
                      gameMode === 'payload'
                        ? 'border-red-500 bg-red-950/50 text-red-300'
                        : 'border-zinc-800 bg-zinc-900/50 text-zinc-400'
                    }`}
                  >
                    <div className="font-bold text-[8.5px] sm:text-[9.5px]">TF2 PAYLOAD</div>
                    <div className="text-[7px] text-zinc-400 font-sans mt-0.5">Push / Defend Cart</div>
                  </button>
                </div>
              </div>

              {/* Status Indicator */}
              <div className="bg-[#181820] border border-zinc-800 p-2.5 rounded flex items-center justify-between text-[8.5px]">
                <div className="flex items-center gap-2">
                  <div
                    className={`w-2.5 h-2.5 rounded-full ${
                      connState === 'connected'
                        ? 'bg-emerald-400 animate-ping'
                        : connState === 'connecting'
                        ? 'bg-amber-400 animate-pulse'
                        : 'bg-zinc-600'
                    }`}
                  />
                  <span className="text-zinc-300">
                    {connState === 'connected'
                      ? 'PLAYER 2 READY (CONNECTED)'
                      : statusMessage || 'WAITING FOR PLAYER 2...'}
                  </span>
                </div>
                {latency !== null && (
                  <span className="text-emerald-400 font-mono text-[8px]">{latency} ms (WI-FI)</span>
                )}
              </div>
            </>
          ) : (
            <>
              {/* Join Room PIN Form */}
              <div className="bg-black/60 border-2 border-emerald-500/60 p-3 rounded flex flex-col items-center justify-center text-center">
                <span className="text-[8.5px] text-zinc-400 tracking-wider">ENTER 4-DIGIT HOST ROOM PIN:</span>
                <input
                  type="text"
                  maxLength={4}
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value.replace(/\D/g, ''))}
                  placeholder="0000"
                  className="my-2 w-36 text-center text-3xl text-emerald-400 font-mono font-bold tracking-[0.3em] bg-zinc-900 border-2 border-zinc-700 rounded p-1 outline-none focus:border-emerald-400"
                />
                <button
                  type="button"
                  disabled={joinCode.length < 4 || connState === 'connecting'}
                  onClick={handleJoin}
                  className={`py-2 px-6 rounded text-[10px] font-pixel border font-bold transition-all cursor-pointer ${
                    joinCode.length === 4
                      ? 'bg-emerald-600 hover:bg-emerald-500 text-white border-emerald-400 shadow-lg'
                      : 'bg-zinc-800 text-zinc-500 border-zinc-700 cursor-not-allowed'
                  }`}
                >
                  {connState === 'connecting' ? 'CONNECTING...' : 'CONNECT TO WI-FI ROOM'}
                </button>
              </div>

              {/* Status Indicator for Guest */}
              <div className="bg-[#181820] border border-zinc-800 p-2.5 rounded flex items-center justify-between text-[8.5px]">
                <div className="flex items-center gap-2">
                  <div
                    className={`w-2.5 h-2.5 rounded-full ${
                      connState === 'connected'
                        ? 'bg-emerald-400'
                        : connState === 'connecting'
                        ? 'bg-amber-400 animate-pulse'
                        : 'bg-zinc-600'
                    }`}
                  />
                  <span className="text-zinc-300">
                    {connState === 'connected'
                      ? 'CONNECTED TO HOST! WAITING FOR DEPLOYMENT...'
                      : statusMessage || 'ENTER PIN TO JOIN'}
                  </span>
                </div>
                {latency !== null && (
                  <span className="text-emerald-400 font-mono text-[8px]">{latency} ms</span>
                )}
              </div>
            </>
          )}

          {/* Cross-Platform Wi-Fi Compatibility Banner */}
          <div className="bg-zinc-900/60 border border-zinc-800 p-2 rounded text-[7.5px] text-zinc-400 leading-relaxed font-sans flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 shrink-0">
              <Smartphone className="w-3.5 h-3.5 text-amber-400" />
              <span>MOBILE (APK / WEB)</span>
            </div>
            <span className="text-zinc-500 font-mono font-bold">CROSS-PLAY</span>
            <div className="flex items-center gap-2 shrink-0">
              <Monitor className="w-3.5 h-3.5 text-cyan-400" />
              <span>PC (.EXE / BROWSER)</span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-3 sm:px-4 py-2 bg-[#1c1c24] border-t border-[#2d2d38] flex items-center justify-between gap-2 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-[9px] rounded border border-zinc-600 cursor-pointer"
          >
            CANCEL
          </button>

          {activeTab === 'host' && (
            <button
              type="button"
              disabled={connState !== 'connected'}
              onClick={handleStartAsHost}
              className={`py-1.5 px-4 rounded text-[10px] font-pixel font-bold tracking-wider border transition-all cursor-pointer ${
                connState === 'connected'
                  ? 'bg-emerald-600 hover:bg-emerald-500 text-white border-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.7)] animate-pulse'
                  : 'bg-zinc-800 text-zinc-500 border-zinc-700 cursor-not-allowed'
              }`}
            >
              DEPLOY TO BATTLE!
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
