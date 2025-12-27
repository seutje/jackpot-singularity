import React from 'react';
import { GameState, CoinType, DeckItem, Artifact } from '../types';
import { COIN_CONFIG, SHOP_ARTIFACTS } from '../constants';
import { ArrowRight, ShoppingCart, Lock } from 'lucide-react';
import useRepeatAction from '../hooks/useRepeatAction';

interface ShopProps {
  gameState: GameState;
  onNextRound: () => void;
  onBuy: (type: 'coin' | 'artifact', id: string, cost: number) => void;
}

// Sub-component for Coin items
const ShopCoinItem: React.FC<{ 
  coin: DeckItem; 
  cash: number; 
  onBuy: (type: 'coin' | 'artifact', id: string, cost: number) => void; 
}> = ({ coin, cash, onBuy }) => {
  
  const canAfford = cash >= coin.cost;
  const repeatHandlers = useRepeatAction(
    () => onBuy('coin', coin.type, coin.cost), 
    !canAfford, 
    200 // Slightly slower for buying to avoid instant drainage
  );

  return (
    <div className="flex items-center justify-between bg-black/40 border border-gray-700 p-4 rounded hover:border-cyan-500 transition-colors group">
      <div className="flex items-center gap-4">
        <div className="w-10 h-10 rounded-full border-2 border-white" style={{ backgroundColor: coin.color }}></div>
        <div>
          <div className="font-bold text-white">{coin.name}</div>
          <div className="text-xs text-gray-400">{coin.description}</div>
        </div>
      </div>
      <button
        {...repeatHandlers}
        disabled={!canAfford}
        className="px-4 py-2 bg-gray-800 hover:bg-cyan-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-mono text-sm rounded transition-colors active:scale-95 touch-none select-none"
      >
        ${coin.cost}
      </button>
    </div>
  );
};

// Sub-component for Artifact items
const ShopArtifactItem: React.FC<{
  baseArtifact: Artifact;
  gameState: GameState;
  onBuy: (type: 'coin' | 'artifact', id: string, cost: number) => void;
}> = ({ baseArtifact, gameState, onBuy }) => {
  
  const owned = gameState.artifacts.find(a => a.id === baseArtifact.id);
  const currentLevel = owned ? owned.level : 0;
  const currentCost = Math.floor(baseArtifact.cost * Math.pow(1.5, currentLevel));
  const canAfford = gameState.cash >= currentCost;

  const repeatHandlers = useRepeatAction(
    () => onBuy('artifact', baseArtifact.id, currentCost),
    !canAfford,
    250 // Slower for upgrades
  );

  return (
    <div className="flex items-center justify-between bg-black/40 border border-gray-700 p-4 rounded hover:border-fuchsia-500 transition-colors">
      <div>
        <div className="font-bold text-white flex items-center gap-2">
            {baseArtifact.name} 
            <span className="text-xs text-fuchsia-400 bg-fuchsia-900/30 px-2 rounded border border-fuchsia-800">LVL {currentLevel}</span>
        </div>
        <div className="text-xs text-gray-400">{baseArtifact.description}</div>
      </div>
      <button
          {...repeatHandlers}
          disabled={!canAfford} 
          className="px-4 py-2 bg-gray-800 hover:bg-fuchsia-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-mono text-sm rounded transition-colors min-w-[80px] active:scale-95 touch-none select-none"
        >
        ${currentCost}
      </button>
    </div>
  );
};


const Shop: React.FC<ShopProps> = ({ gameState, onNextRound, onBuy }) => {
  return (
    <div className="flex flex-col items-center justify-start h-full bg-slate-900/95 backdrop-blur-md pointer-events-auto p-8 overflow-y-auto">
      
      <div className="w-full max-w-5xl mt-8">
        <header className="flex justify-between items-end mb-8 border-b border-fuchsia-500 pb-4">
          <div>
            <h2 className="text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-fuchsia-400 to-cyan-400">
              BLACK MARKET
            </h2>
            <p className="text-gray-400 mt-1">Acquire assets for Ante {gameState.ante + 1}</p>
          </div>
          <div className="text-right">
            <div className="text-sm text-gray-400 uppercase">Available Funds</div>
            <div className="text-4xl font-mono text-yellow-400">${gameState.cash}</div>
          </div>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
          {/* Coin Section */}
          <section>
            <h3 className="text-xl text-cyan-300 mb-4 font-bold uppercase tracking-widest flex items-center gap-2">
              <ShoppingCart size={20}/> Refill Payload (x5 Pack)
            </h3>
            <div className="grid grid-cols-1 gap-4">
              {Object.values(COIN_CONFIG).map((coin) => (
                <ShopCoinItem 
                  key={coin.type} 
                  coin={coin} 
                  cash={gameState.cash} 
                  onBuy={onBuy} 
                />
              ))}
            </div>
          </section>

          {/* Artifact Section */}
          <section>
            <h3 className="text-xl text-fuchsia-300 mb-4 font-bold uppercase tracking-widest flex items-center gap-2">
              <Lock size={20}/> System Upgrades
            </h3>
            <div className="grid grid-cols-1 gap-4">
              {SHOP_ARTIFACTS.map((baseArtifact) => (
                 <ShopArtifactItem 
                   key={baseArtifact.id}
                   baseArtifact={baseArtifact}
                   gameState={gameState}
                   onBuy={onBuy}
                 />
              ))}
              <div className="p-4 bg-yellow-900/20 border border-yellow-700/50 rounded text-center text-yellow-500 text-sm">
                Upgrades scale exponentially in cost and power.
              </div>
            </div>
          </section>
        </div>

        <div className="flex justify-end pt-4 border-t border-gray-800 pb-8">
          <button 
            onClick={onNextRound}
            className="flex items-center gap-2 px-8 py-4 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold text-xl rounded shadow-lg shadow-cyan-900/50 transition-all transform hover:scale-105"
          >
            NEXT ANTE <ArrowRight size={24} />
          </button>
        </div>

      </div>
    </div>
  );
};

export default Shop;