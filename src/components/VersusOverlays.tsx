/**
 * Battle City 1990 - 1v1 Versus Round Flow Overlays
 * CS-style banners: ROUND N intro, round-winner reveal, and the match
 * result panel (first to 7 round wins takes the match).
 */

import React from 'react';
import { GameScore, GameState, MultiplayerMode } from '../types';
import { Trophy, RotateCcw, LogOut, Swords } from 'lucide-react';

const GOLD = '#f8b800';
const GREEN = '#00d860';
const BLUE = '#4a9eff';
const RED = '#ff4a4a';

const TankIcon: React.FC<{ color: string; core: string; size?: number }> = ({ color, core, size = 7 }) => (
  <svg viewBox="0 0 16 16" width={size} height={size} style={{ fill: color }}>
    <rect x="1" y="2" width="3" height="12" />
    <rect x="12" y="2" width="3" height="12" />
    <rect x="4" y="4" width="8" height="8" />
    <rect x="7" y="0" width="2" height="5" />
    <rect x="6" y="6" width="4" height="4" fill={core} />
  </svg>
);

const Scoreline: React.FC<{ scoreData: GameScore; big?: boolean; is2v2?: boolean }> = ({ scoreData, big, is2v2 }) => {
  if (is2v2) {
    return (
      <div className={`flex items-center gap-4 font-mono font-bold ${big ? 'text-3xl' : 'text-xl'}`}>
        <span className="flex items-center gap-2" style={{ color: BLUE }}>
          <TankIcon color={BLUE} core="#ffffff" size={big ? 10 : 8} />
          <span>A: {scoreData.teamWinsA ?? 0}</span>
        </span>
        <span className="text-zinc-500 text-xs">:</span>
        <span className="flex items-center gap-2" style={{ color: RED }}>
          <span>{scoreData.teamWinsB ?? 0} :B</span>
          <TankIcon color={RED} core="#ffffff" size={big ? 10 : 8} />
        </span>
      </div>
    );
  }
  return (
    <div className={`flex items-center gap-4 font-mono font-bold ${big ? 'text-3xl' : 'text-xl'}`}>
      <span className="flex items-center gap-2" style={{ color: GOLD }}>
        <TankIcon color={GOLD} core="#fff" size={big ? 10 : 8} />
        {scoreData.roundWinsP1 ?? 0}
      </span>
      <span className="text-zinc-500 text-xs">:</span>
      <span className="flex items-center gap-2" style={{ color: GREEN }}>
        {scoreData.roundWinsP2 ?? 0}
        <TankIcon color={GREEN} core="#c8ffc8" size={big ? 10 : 8} />
      </span>
    </div>
  );
};

export const RoundBanner: React.FC<{ state: GameState; scoreData: GameScore; mode?: MultiplayerMode }> = ({ state, scoreData, mode }) => {
  const isIntro = state === GameState.ROUND_INTRO;
  const is2v2 = mode === '2v2' || scoreData.teamWinsA !== undefined;
  const winner = scoreData.roundWinner ?? 0;
  const teamWinner = scoreData.teamWinner;

  return (
    <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 bg-black/70 font-pixel select-none">
      <div className="w-4/5 max-w-md border-4 border-double border-[#3a3a3a] bg-[#101010]/95 px-6 py-5 flex flex-col items-center gap-3 shadow-2xl">
        {isIntro ? (
          <>
            <div className="flex items-center gap-2 text-zinc-300 text-sm tracking-widest">
              <Swords className="w-4 h-4 text-red-400" />
              ROUND {scoreData.roundNumber ?? 1}
            </div>
            <Scoreline scoreData={scoreData} is2v2={is2v2} />
            <div className="text-[9px] text-zinc-500 tracking-widest animate-pulse">
              {is2v2 ? '2V2 TEAM BATTLE — FIRST TO 5 WINS' : 'GET READY — FIRST TO 7 WINS'}
            </div>
          </>
        ) : (
          <>
            {is2v2 ? (
              teamWinner === 'DRAW' ? (
                <div className="text-amber-300 text-sm tracking-widest">ROUND DRAW!</div>
              ) : (
                <div
                  className="text-base tracking-widest"
                  style={{ color: teamWinner === 'A' ? BLUE : RED, textShadow: '0 0 12px currentColor' }}
                >
                  TEAM {teamWinner} WINS THE ROUND!
                </div>
              )
            ) : winner === 0 ? (
              <div className="text-amber-300 text-sm tracking-widest">DRAW!</div>
            ) : (
              <div
                className="text-base tracking-widest"
                style={{ color: winner === 1 ? GOLD : GREEN, textShadow: '0 0 12px currentColor' }}
              >
                {winner === 1 ? 'PLAYER 1' : 'PLAYER 2'} WINS THE ROUND!
              </div>
            )}
            <Scoreline scoreData={scoreData} is2v2={is2v2} />
            <div className="text-[9px] text-zinc-500 tracking-widest">
              {(is2v2 ? teamWinner === 'DRAW' : winner === 0) ? 'ROUND WILL BE REPLAYED' : 'NEXT ROUND STARTING...'}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export const MatchEndPanel: React.FC<{
  scoreData: GameScore;
  isHost: boolean;
  onRematch: () => void;
  onExit: () => void;
  mode?: MultiplayerMode;
}> = ({ scoreData, isHost, onRematch, onExit, mode }) => {
  const is2v2 = mode === '2v2' || scoreData.teamWinsA !== undefined;
  const isFfa = mode === 'ffa' || scoreData.ffaWinner !== undefined;
  const teamWin = (scoreData.teamWinsA ?? 0) >= (scoreData.teamWinsB ?? 0) ? 'A' : 'B';
  const winner = scoreData.matchWinner ?? 1;
  // FFA slot body colors mirror the engine's 8 palettes (spriteRenderer)
  const ffaColors = ['#f8b800', '#00a800', '#00a8a8', '#e40058', '#940088', '#f87800', '#b8b8b8', '#78d800'];
  const ffaSlot = scoreData.ffaWinner ?? 1;
  const color = isFfa ? ffaColors[(ffaSlot - 1) % 8] : is2v2 ? (teamWin === 'A' ? BLUE : RED) : winner === 1 ? GOLD : GREEN;
  const ffaKills = scoreData.playerStats?.[ffaSlot]?.kills ?? 0;

  return (
    <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-black/85 font-pixel select-none">
      <div className="w-11/12 max-w-lg border-4 border-[#3a3a3a] bg-[#101010] px-6 py-6 flex flex-col items-center gap-4 shadow-2xl">
        <Trophy className="w-10 h-10" style={{ color, filter: `drop-shadow(0 0 10px ${color})` }} />
        <div className="text-lg tracking-widest text-center" style={{ color, textShadow: '0 0 14px currentColor' }}>
          {isFfa ? `PLAYER ${ffaSlot}` : is2v2 ? `TEAM ${teamWin}` : winner === 1 ? 'PLAYER 1' : 'PLAYER 2'}
          <br />
          WINS THE MATCH!
        </div>
        {isFfa ? (
          <div className="font-mono font-bold text-3xl" style={{ color }}>
            {ffaKills} KILLS
          </div>
        ) : (
          <Scoreline scoreData={scoreData} big is2v2={is2v2} />
        )}
        <div className="text-[9px] text-zinc-500 tracking-widest">
          {isFfa ? 'KILL TARGET REACHED' : is2v2 ? 'FIRST TO 5 ROUNDS ACHIEVED' : 'FIRST TO 7 ROUNDS ACHIEVED'}
        </div>

        <div className="flex items-center gap-3 mt-2">
          {isHost ? (
            <button
              onClick={onRematch}
              className="flex items-center gap-2 px-4 py-2 bg-emerald-700 hover:bg-emerald-600 border-2 border-emerald-400 text-white text-[10px] rounded active:translate-y-px transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              REMATCH
            </button>
          ) : (
            <span className="text-[9px] text-zinc-400 animate-pulse px-4 py-2 border border-zinc-700 rounded">
              WAITING FOR HOST...
            </span>
          )}
          <button
            onClick={onExit}
            className="flex items-center gap-2 px-4 py-2 bg-[#383838] hover:bg-[#484848] border-2 border-[#555] text-zinc-200 text-[10px] rounded active:translate-y-px transition-colors"
          >
            <LogOut className="w-3.5 h-3.5" />
            EXIT TO MENU
          </button>
        </div>
      </div>
    </div>
  );
};
