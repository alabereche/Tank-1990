/**
 * Battle City 1990 - Secret Admin Analytics Dashboard
 * Displays real-time counts for visitors, downloads, and game sessions.
 * Opened discreetly via ?stats query param or tapping the title logo 5 times.
 */

import React, { useEffect, useState } from 'react';
import { analyticsService, StatsData } from '../services/AnalyticsService';
import { BarChart3, Users, Download, Play, RefreshCw, X, Eye, HardDrive, Smartphone, Monitor } from 'lucide-react';
import { soundManager } from '../engine/SoundManager';

interface SecretStatsModalProps {
  onClose: () => void;
}

export const SecretStatsModal: React.FC<SecretStatsModalProps> = ({ onClose }) => {
  const [stats, setStats] = useState<StatsData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const loadStats = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await analyticsService.fetchStats();
      if (data) {
        setStats(data);
      } else {
        setError('Could not connect to stats server. Make sure server.cjs is running on VPS.');
      }
    } catch {
      setError('Connection failed.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStats();
  }, []);

  return (
    <div
      id="secret-stats-modal-overlay"
      className="fixed inset-0 z-[999999] flex items-center justify-center bg-black/90 backdrop-blur-sm p-3 select-none animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        id="secret-stats-modal-content"
        className="relative w-full max-w-xl max-h-[96vh] flex flex-col bg-[#121216] border-2 sm:border-4 border-[#f8b800] rounded shadow-[0_0_40px_rgba(248,184,0,0.4)] text-white font-pixel overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-3 sm:px-4 py-2 bg-[#1a1a22] border-b-2 border-[#333] shrink-0">
          <div className="flex items-center gap-2 text-[#f8b800]">
            <BarChart3 className="w-4 h-4 text-amber-400" />
            <span className="text-xs sm:text-sm font-bold tracking-wider">LIVE TELEMETRY &amp; STATS</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                soundManager.playMenuMove();
                loadStats();
              }}
              disabled={loading}
              className="p-1 sm:px-2 sm:py-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white rounded border border-zinc-600 text-[9px] flex items-center gap-1 cursor-pointer"
            >
              <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">REFRESH</span>
            </button>
            <button
              onClick={onClose}
              className="px-2 py-0.5 sm:py-1 text-zinc-400 hover:text-white border border-zinc-700 bg-zinc-800 rounded text-[9px] cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-3">
          {loading && !stats && (
            <div className="py-12 flex flex-col items-center justify-center gap-2 text-amber-400">
              <RefreshCw className="w-6 h-6 animate-spin" />
              <span className="text-[10px]">LOADING REALTIME STATS...</span>
            </div>
          )}

          {error && (
            <div className="p-3 bg-red-950/60 border border-red-800 text-red-300 text-[9px] rounded leading-relaxed">
              {error}
            </div>
          )}

          {stats && (
            <>
              {/* Primary KPI Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {/* Total Visits */}
                <div className="p-2.5 sm:p-3 bg-black/60 border border-zinc-800 rounded flex flex-col gap-1">
                  <div className="flex items-center justify-between text-zinc-400 text-[8px] sm:text-[9px]">
                    <span>TOTAL VISITS</span>
                    <Eye className="w-3.5 h-3.5 text-sky-400" />
                  </div>
                  <div className="text-lg sm:text-2xl font-bold font-mono text-sky-400">
                    {stats.totalVisits.toLocaleString()}
                  </div>
                  <div className="text-[7.5px] text-zinc-500 font-sans">Page views &amp; app launches</div>
                </div>

                {/* Unique Visitors */}
                <div className="p-2.5 sm:p-3 bg-black/60 border border-zinc-800 rounded flex flex-col gap-1">
                  <div className="flex items-center justify-between text-zinc-400 text-[8px] sm:text-[9px]">
                    <span>UNIQUE VISITORS</span>
                    <Users className="w-3.5 h-3.5 text-emerald-400" />
                  </div>
                  <div className="text-lg sm:text-2xl font-bold font-mono text-emerald-400">
                    {stats.uniqueVisitors.toLocaleString()}
                  </div>
                  <div className="text-[7.5px] text-zinc-500 font-sans">Distinct unique clients</div>
                </div>

                {/* Games Played */}
                <div className="p-2.5 sm:p-3 bg-black/60 border border-zinc-800 rounded flex flex-col gap-1">
                  <div className="flex items-center justify-between text-zinc-400 text-[8px] sm:text-[9px]">
                    <span>GAMES PLAYED</span>
                    <Play className="w-3.5 h-3.5 text-amber-400" />
                  </div>
                  <div className="text-lg sm:text-2xl font-bold font-mono text-amber-400">
                    {stats.gamesPlayed.toLocaleString()}
                  </div>
                  <div className="text-[7.5px] text-zinc-500 font-sans">Battle matches launched</div>
                </div>

                {/* APK Downloads */}
                <div className="p-2.5 sm:p-3 bg-black/60 border border-zinc-800 rounded flex flex-col gap-1">
                  <div className="flex items-center justify-between text-zinc-400 text-[8px] sm:text-[9px]">
                    <span>ANDROID APK</span>
                    <Smartphone className="w-3.5 h-3.5 text-green-400" />
                  </div>
                  <div className="text-lg sm:text-2xl font-bold font-mono text-green-400">
                    {stats.apkDownloads.toLocaleString()}
                  </div>
                  <div className="text-[7.5px] text-zinc-500 font-sans">APK downloads count</div>
                </div>

                {/* EXE Downloads */}
                <div className="p-2.5 sm:p-3 bg-black/60 border border-zinc-800 rounded flex flex-col gap-1">
                  <div className="flex items-center justify-between text-zinc-400 text-[8px] sm:text-[9px]">
                    <span>WINDOWS EXE</span>
                    <Monitor className="w-3.5 h-3.5 text-cyan-400" />
                  </div>
                  <div className="text-lg sm:text-2xl font-bold font-mono text-cyan-400">
                    {stats.exeDownloads.toLocaleString()}
                  </div>
                  <div className="text-[7.5px] text-zinc-500 font-sans">EXE downloads count</div>
                </div>

                {/* Total Downloads */}
                <div className="p-2.5 sm:p-3 bg-black/60 border border-zinc-800 rounded flex flex-col gap-1">
                  <div className="flex items-center justify-between text-zinc-400 text-[8px] sm:text-[9px]">
                    <span>TOTAL DOWNLOADS</span>
                    <Download className="w-3.5 h-3.5 text-purple-400" />
                  </div>
                  <div className="text-lg sm:text-2xl font-bold font-mono text-purple-400">
                    {(stats.apkDownloads + stats.exeDownloads).toLocaleString()}
                  </div>
                  <div className="text-[7.5px] text-zinc-500 font-sans">Combined APK + EXE</div>
                </div>
              </div>

              {/* Today's Stats Card */}
              {stats.today && (
                <div className="p-2.5 sm:p-3 bg-[#181820] border border-zinc-700 rounded space-y-1.5">
                  <div className="flex items-center justify-between border-b border-zinc-800 pb-1 text-[9px]">
                    <span className="text-amber-400 font-bold">TODAY'S ACTIVITY ({stats.today.date})</span>
                    <span className="text-zinc-500 font-mono text-[8px]">ACTIVE RECORD</span>
                  </div>
                  <div className="grid grid-cols-4 gap-2 text-center pt-1 font-mono">
                    <div>
                      <div className="text-zinc-400 text-[7.5px]">VISITS</div>
                      <div className="text-xs sm:text-sm font-bold text-white">{stats.today.visits}</div>
                    </div>
                    <div>
                      <div className="text-zinc-400 text-[7.5px]">APK DL</div>
                      <div className="text-xs sm:text-sm font-bold text-emerald-400">{stats.today.apk}</div>
                    </div>
                    <div>
                      <div className="text-zinc-400 text-[7.5px]">EXE DL</div>
                      <div className="text-xs sm:text-sm font-bold text-cyan-400">{stats.today.exe}</div>
                    </div>
                    <div>
                      <div className="text-zinc-400 text-[7.5px]">PLAYS</div>
                      <div className="text-xs sm:text-sm font-bold text-amber-400">{stats.today.plays}</div>
                    </div>
                  </div>
                </div>
              )}

              {/* Timestamp */}
              <div className="text-[7.5px] text-zinc-500 font-mono text-center pt-1">
                Last Synchronized: {new Date(stats.lastUpdated).toLocaleString()}
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-3 sm:px-4 py-2 bg-[#1a1a22] border-t border-[#2d2d38] flex items-center justify-between shrink-0">
          <span className="text-[7.5px] sm:text-[8px] text-zinc-400 font-mono">
            DISCREET TELEMETRY &bull; BATTLE CITY 1990
          </span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-[#f8b800] hover:bg-amber-400 text-black font-bold text-[9px] sm:text-[10px] rounded cursor-pointer active:scale-95"
          >
            CLOSE
          </button>
        </div>
      </div>
    </div>
  );
};
