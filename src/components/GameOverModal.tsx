/**
 * Battle City 1990 - Score Tally & Game Over / Victory Modal
 * Lists authentic NES breakdown of tanks destroyed, points earned,
 * and high score with replay / next stage buttons.
 */

import React, { useEffect, useState } from 'react';
import { GameScore } from '../types';
import { soundManager } from '../engine/SoundManager';
import { Trophy, RotateCcw, ArrowRight, Home } from 'lucide-react';

interface GameOverModalProps {
  isVictory: boolean;
  scoreData: GameScore;
  onNextStage?: () => void;
  onRetry: () => void;
  onReturnToMenu: () => void;
}

export const GameOverModal: React.FC<GameOverModalProps> = ({
  isVictory,
  scoreData,
  onNextStage,
  onRetry,
  onReturnToMenu,
}) => {
  const [revealedIdx, setRevealedIdx] = useState<number>(0);

  const breakdown = [
    {
      type: 'BASIC',
      name: 'BASIC TANK',
      pts: 100,
      count: scoreData.destroyedEnemies.BASIC,
      color: '#a4a4a4',
    },
    {
      type: 'FAST',
      name: 'FAST TANK',
      pts: 200,
      count: scoreData.destroyedEnemies.FAST,
      color: '#58b8d8',
    },
    {
      type: 'POWER',
      name: 'POWER TANK',
      pts: 300,
      count: scoreData.destroyedEnemies.POWER,
      color: '#f8d838',
    },
    {
      type: 'ARMOR',
      name: 'ARMOR TANK',
      pts: 400,
      count: scoreData.destroyedEnemies.ARMOR,
      color: '#00a800',
    },
  ];

  const totalKills =
    scoreData.destroyedEnemies.BASIC +
    scoreData.destroyedEnemies.FAST +
    scoreData.destroyedEnemies.POWER +
    scoreData.destroyedEnemies.ARMOR;

  // Staggered reveal sound effects like NES Battle City tally!
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (revealedIdx < breakdown.length) {
      timer = setTimeout(() => {
        soundManager.playHitBrick();
        setRevealedIdx((prev) => prev + 1);
      }, 350);
    }
    return () => clearTimeout(timer);
  }, [revealedIdx, breakdown.length]);

  return (
    <div
      id="game-over-modal-container"
      className="flex flex-col items-center justify-between w-full max-w-lg mx-auto bg-black border-4 border-[#484848] p-6 text-white font-pixel select-none shadow-2xl"
    >
      {/* Stage & Header */}
      <div className="w-full flex items-center justify-between border-b border-zinc-800 pb-3 text-xs">
        <span className="text-[#f8b800]">HI-SCORE {scoreData.highScore}</span>
        <span className="text-zinc-300">STAGE {scoreData.stage}</span>
      </div>

      {/* Main Title Banner */}
      <div className="my-5 text-center">
        {isVictory ? (
          <h2 className="text-2xl sm:text-3xl font-extrabold text-[#f8b800] tracking-widest animate-pulse drop-shadow-[0_4px_0_#704000]">
            STAGE CLEAR!
          </h2>
        ) : (
          <h2 className="text-2xl sm:text-3xl font-extrabold text-red-600 tracking-widest drop-shadow-[0_4px_0_#400000]">
            GAME OVER
          </h2>
        )}
        <div className="text-[10px] text-zinc-400 mt-1">
          {isVictory ? 'ALL ENEMY TANKS DESTROYED!' : 'THE BASE EAGLE FELL IN BATTLE'}
        </div>
      </div>

      {/* Score Breakdown Table */}
      <div className="w-full bg-[#181818] border border-zinc-700 p-4 rounded flex flex-col gap-3 text-xs mb-4">
        <div className="text-center text-[10px] text-zinc-400 border-b border-zinc-800 pb-1">
          -- SCORE BREAKDOWN --
        </div>

        {breakdown.map((item, idx) => {
          const isRevealed = idx < revealedIdx;
          const totalPoints = item.count * item.pts;

          return (
            <div
              key={item.type}
              className={`flex items-center justify-between transition-opacity duration-200 ${
                isRevealed ? 'opacity-100' : 'opacity-0'
              }`}
            >
              <div className="flex items-center gap-2">
                <span className="text-yellow-400 font-bold">{item.pts}</span>
                <span className="text-zinc-400 text-[10px]">PTS</span>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-white font-bold">{item.count}</span>
                {/* Mini tank icon in enemy color */}
                <svg viewBox="0 0 16 16" className="w-4 h-4" style={{ fill: item.color }}>
                  <rect x="1" y="2" width="3" height="12" />
                  <rect x="12" y="2" width="3" height="12" />
                  <rect x="4" y="4" width="8" height="8" />
                  <rect x="7" y="0" width="2" height="5" />
                </svg>
              </div>

              <div className="text-right text-[#f8b800] font-bold w-20">
                {totalPoints}
              </div>
            </div>
          );
        })}

        {/* Total Summary Row */}
        <div className="border-t border-zinc-700 pt-2 flex items-center justify-between text-xs mt-1">
          <span className="text-zinc-300">TOTAL KILLS</span>
          <span className="text-white font-bold">{totalKills}</span>
        </div>

        <div className="flex items-center justify-between text-sm border-t border-zinc-800 pt-2">
          <span className="text-[#f8b800] font-bold">TOTAL SCORE</span>
          <span className="text-white font-extrabold tracking-wider">{scoreData.score}</span>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="w-full flex flex-wrap gap-2 items-center justify-center pt-2">
        {isVictory && onNextStage && (
          <button
            id="btn-next-stage"
            onClick={onNextStage}
            className="flex-1 min-w-[130px] flex items-center justify-center gap-1.5 bg-green-600 hover:bg-green-500 text-white py-2.5 px-3 rounded text-[10px] font-pixel border border-green-400 shadow-md animate-pulse"
          >
            <span>NEXT STAGE</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        )}

        <button
          id="btn-retry-stage"
          onClick={onRetry}
          className="flex-1 min-w-[130px] flex items-center justify-center gap-1.5 bg-amber-600 hover:bg-amber-500 text-white py-2.5 px-3 rounded text-[10px] font-pixel border border-amber-400 shadow-md"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>{isVictory ? 'REPLAY' : 'RETRY'}</span>
        </button>

        <button
          id="btn-return-menu"
          onClick={onReturnToMenu}
          className="flex-1 min-w-[130px] flex items-center justify-center gap-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 py-2.5 px-3 rounded text-[10px] font-pixel border border-zinc-600"
        >
          <Home className="w-3.5 h-3.5" />
          <span>MENU</span>
        </button>
      </div>
    </div>
  );
};
