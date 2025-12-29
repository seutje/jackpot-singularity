import React from 'react';
import { GameState, CoinType } from '../types';
import { COIN_CONFIG } from '../constants';
import { StopCircle, Zap } from 'lucide-react';
import useRepeatAction from '../hooks/useRepeatAction';

interface GameHUDProps {
  gameState: GameState;
  onDrop: (type: CoinType) => void;
  onEndRound: () => void;
  queuedJackpots: number;
}

// Sub-component to handle individual coin button logic with the hook
const CoinDropButton: React.FC<{ 
  type: CoinType, 
  count: number, 
  onDrop: (type: CoinType) => void 
}> = ({ type, count, onDrop }) => {
  const config = COIN_CONFIG[type];
  
  // Use the hook for hold-to-drop functionality. 
  // Interval 120ms for satisfying rapid fire.
  const repeatHandlers = useRepeatAction(() => onDrop(type), count === 0, 120);

  if (count === 0 && type !== CoinType.STANDARD) return null;

  return (
    <button
      disabled={count === 0}
      {...repeatHandlers}
      className={`
        relative group flex flex-col items-center transition-transform active:scale-95 touch-none select-none
        ${count === 0 ? 'opacity-50 grayscale' : 'opacity-100'}
      `}
    >
      <div 
        className="w-16 h-16 rounded-full border-4 shadow-lg flex items-center justify-center text-lg font-bold text-black pointer-events-none"
        style={{ 
          backgroundColor: config.color, 
          borderColor: 'white',
          boxShadow: `0 0 20px ${config.color}80` 
        }}
      >
       {type === CoinType.STANDARD ? '$' : type[0]}
      </div>
      
      <div className="absolute -top-3 -right-2 bg-black border border-white text-white text-xs font-bold w-6 h-6 flex items-center justify-center rounded-full z-10 pointer-events-none">
        {count}
      </div>

      <div className="mt-2 text-xs font-bold text-white bg-black/50 px-2 py-1 rounded backdrop-blur-sm border border-white/20 pointer-events-none">
        {config.name}
      </div>
    </button>
  );
};

const GameHUD: React.FC<GameHUDProps> = ({ gameState, onDrop, onEndRound, queuedJackpots }) => {
  const progress = Math.min(100, (gameState.score / gameState.targetScore) * 100);
  const bonusProgress = Math.min(100, gameState.bonus);

  return (
    <div className="w-full h-full flex flex-col justify-between p-4 pointer-events-none">
      
      {/* Top Bar: Stats */}
      <div className="flex justify-between items-start pointer-events-auto">
        <div className="flex flex-col gap-2">
            {/* Score Target */}
            <div className="bg-slate-900/90 border border-cyan-500/50 p-4 rounded-lg backdrop-blur shadow-[0_0_15px_rgba(6,182,212,0.3)] min-w-[300px]">
            <div className="flex justify-between mb-2">
                <span className="text-cyan-400 font-bold tracking-widest text-xs uppercase">Target Protocol</span>
                <span className="text-white font-mono">{gameState.score} / {gameState.targetScore}</span>
            </div>
            <div className="w-full h-3 bg-gray-800 rounded-full overflow-hidden border border-gray-700">
                <div 
                className="h-full bg-gradient-to-r from-cyan-500 to-fuchsia-500 transition-all duration-300"
                style={{ width: `${progress}%` }}
                />
            </div>
            </div>

            {/* Bonus Momentum Meter */}
            <div className="bg-slate-900/80 border border-yellow-500/30 p-2 rounded-lg backdrop-blur flex items-center gap-3">
                <div className="text-yellow-400 font-bold text-xs uppercase flex items-center gap-1">
                    <Zap size={14} className={bonusProgress > 80 ? 'animate-pulse' : ''}/> Bonus
                </div>
                <div className="px-2 py-1 rounded bg-yellow-500/20 border border-yellow-400/40 text-yellow-200 text-xs font-mono min-w-[44px] text-center">
                  {gameState.bonusLevel}x
                </div>
                <div className="px-2 py-1 rounded bg-yellow-500/10 border border-yellow-400/30 text-yellow-200 text-xs font-mono min-w-[64px] text-center">
                  Queue {queuedJackpots}
                </div>
                <div className="flex-grow h-2 bg-gray-800 rounded-full overflow-hidden border border-gray-700 relative">
                    <div 
                        className={`h-full transition-all duration-200 ${bonusProgress >= 95 ? 'bg-white' : 'bg-yellow-500'}`}
                        style={{ width: `${bonusProgress}%` }}
                    />
                    {bonusProgress >= 95 && (
                         <div className="absolute inset-0 bg-yellow-200 opacity-50 animate-pulse"></div>
                    )}
                </div>
                <div className="text-yellow-200 font-mono text-xs w-8 text-right">
                    {Math.floor(bonusProgress)}%
                </div>
            </div>
        </div>

        <div className="bg-slate-900/90 border border-yellow-500/50 p-4 rounded-lg backdrop-blur h-fit">
          <div className="text-right">
            <div className="text-xs text-yellow-500 uppercase tracking-widest">Cash Reserve</div>
            <div className="text-2xl font-mono text-yellow-300">${gameState.cash}</div>
          </div>
          <div className="text-right mt-1">
            <div className="text-xs text-fuchsia-400 uppercase tracking-widest">Ante Level</div>
            <div className="text-xl font-mono text-fuchsia-300">{gameState.ante}</div>
          </div>
        </div>
      </div>

      {/* Middle Right: Controls */}
      <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-auto flex flex-col gap-4">
          <button 
            onClick={onEndRound}
            className="w-16 h-32 bg-red-900/80 border-2 border-red-500 flex flex-col items-center justify-center gap-2 hover:bg-red-800 transition-colors rounded"
            title="Audit Round (End)"
          >
            <StopCircle size={32} className="text-red-200" />
            <span className="text-xs font-bold text-red-200 rotate-90 whitespace-nowrap">AUDIT</span>
          </button>
      </div>

      {/* Bottom Bar: Deck / Hand */}
      <div className="pointer-events-auto">
        <div className="flex justify-center items-end gap-4 pb-4">
          {Object.values(CoinType).map((type) => (
            <CoinDropButton 
              key={type} 
              type={type} 
              count={gameState.deck[type]} 
              onDrop={onDrop} 
            />
          ))}
        </div>
        <div className="text-center text-gray-400 text-xs mb-2">TAP COIN TO DROP • PHYSICS ACTIVE</div>
      </div>
    </div>
  );
};

export default GameHUD;
