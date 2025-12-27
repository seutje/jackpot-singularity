import React, { useState, useCallback, useEffect, useRef } from 'react';
import { GamePhase, GameState, CoinType, Artifact, CoinData } from './types';
import { INITIAL_DECK, COIN_CONFIG, SHOP_ARTIFACTS } from './constants';
import Scene3D from './components/Scene3D';
import GameHUD from './components/GameHUD';
import Shop from './components/Shop';
import { Play, RotateCcw, ShoppingCart } from 'lucide-react';
import * as THREE from 'three';

const INITIAL_STATE: GameState = {
  phase: GamePhase.MENU,
  score: 0,
  targetScore: 2000,
  cash: 100,
  ante: 1,
  deck: { ...INITIAL_DECK },
  artifacts: [],
  bonus: 0,
};

const App: React.FC = () => {
  const [gameState, setGameState] = useState<GameState>(INITIAL_STATE);
  const [activeCoins, setActiveCoins] = useState<CoinData[]>([]);
  const [timeScale, setTimeScale] = useState<number>(1);

  // Track last score time for bonus decay logic
  const lastScoreTimeRef = useRef<number>(Date.now());
  const gameStateRef = useRef<GameState>(gameState);

  // Sync ref with state
  useEffect(() => {
    gameStateRef.current = gameState;
  }, [gameState]);

  // Sound effects stub (would use AudioContext in full prod)
  const playSound = (type: 'drop' | 'collect' | 'win' | 'explode' | 'powerup' | 'jackpot') => {
    // console.log(`Audio: ${type}`);
  };

  // --- BONUS METER DECAY LOGIC ---
  useEffect(() => {
    const decayInterval = setInterval(() => {
      // Only run decay during Playing phase
      if (gameState.phase !== GamePhase.PLAYING) return;

      const now = Date.now();
      // If 2 seconds have passed since last score
      if (now - lastScoreTimeRef.current > 2000) {
        setGameState(prev => {
          if (prev.bonus <= 0) return prev;
          // Decay rate: ~20% per second (running at 100ms interval = 2 per tick)
          return { ...prev, bonus: Math.max(0, prev.bonus - 2) };
        });
      }
    }, 100);

    return () => clearInterval(decayInterval);
  }, [gameState.phase]);

  const startGame = () => {
    setGameState({ ...INITIAL_STATE, phase: GamePhase.PLAYING });
    lastScoreTimeRef.current = Date.now();

    // Pre-fill the machine with standard chips
    const initialCoins: CoinData[] = Array.from({ length: 60 }).map((_, i) => ({
      id: `start-${Math.random().toString(36).substr(2, 9)}`,
      type: CoinType.STANDARD,
      position: [
        (Math.random() - 0.5) * 8, // Width: -4 to 4
        2 + Math.random() * 5,     // Height: Drop them in a pile
        Math.random() * 7          // Depth: 0 to 7 (Spread along the bed)
      ],
      rotation: [0, Math.random() * Math.PI * 2, 0]
    }));

    setActiveCoins(initialCoins);
  };

  // Helper to spawn a coin (used by UI click and Jackpot)
  const spawnCoin = useCallback((type: CoinType, isFree: boolean = false) => {
    const state = gameStateRef.current;

    // Validation: If not free, must have deck count
    if (!isFree && state.deck[type] <= 0) return;

    // Calculate Position
    const extender = state.artifacts.find(a => a.id === 'extender');
    const extenderLevel = extender ? extender.level : 0;
    const dropWidth = 8 + (extenderLevel * 4);

    const xPos = (Math.random() - 0.5) * dropWidth;
    const zPos = (Math.random() * 3) - 1.5;
    const yPos = 8 + Math.random() * 2;

    const newCoin: CoinData = {
      id: (isFree ? 'bonus-' : '') + Math.random().toString(36).substr(2, 9),
      type,
      position: [xPos, yPos, zPos],
      rotation: [0, Math.random() * Math.PI * 2, 0]
    };

    // Update Active Coins
    setActiveCoins(currentCoins => [...currentCoins, newCoin]);

    // Update Game State (Deck and Audio)
    setGameState(prev => {
      const newDeck = isFree ? prev.deck : { ...prev.deck, [type]: prev.deck[type] - 1 };
      return { ...prev, deck: newDeck };
    });

    if (isFree) playSound('jackpot');
    else playSound('drop');
  }, []);

  const handleCoinDrop = (type: CoinType) => {
    spawnCoin(type, false);
  };

  const triggerJackpot = useCallback(() => {
    playSound('jackpot');
    // Drop 10 coins with slight stagger
    for (let i = 0; i < 10; i++) {
      setTimeout(() => {
        spawnCoin(CoinType.STANDARD, true);
      }, i * 150);
    }
  }, [spawnCoin]);

  // --- COIN MECHANICS HANDLERS ---

  const handleSplit = useCallback((id: string, position: THREE.Vector3) => {
    setActiveCoins(prev => {
      // Find original to mark as split
      const index = prev.findIndex(c => c.id === id);
      if (index === -1) return prev;
      if (prev[index].hasSplit) return prev; // Already split

      const updated = [...prev];
      updated[index] = { ...updated[index], hasSplit: true };

      // Create clone
      const clone: CoinData = {
        id: `clone-${Math.random().toString(36).substr(2, 9)}`,
        type: CoinType.SPLITTER,
        hasSplit: true,
        position: [position.x, position.y + 1, position.z],
        rotation: [0, Math.random() * Math.PI * 2, 0]
      };

      playSound('powerup');
      return [...updated, clone];
    });
  }, []);

  const handleExplode = useCallback((id: string) => {
    setActiveCoins(prev => prev.filter(c => c.id !== id));
    playSound('explode');
  }, []);

  const handleTransmute = useCallback((targetId: string) => {
    setActiveCoins(prev => {
      const index = prev.findIndex(c => c.id === targetId);
      if (index === -1) return prev;
      if (prev[index].type === CoinType.GOLD) return prev; // Already gold

      const updated = [...prev];
      updated[index] = { ...updated[index], type: CoinType.GOLD };
      playSound('powerup');
      return updated;
    });
  }, []);

  const handleCoinInteraction = useCallback((id1: string, id2: string, resultType: CoinType) => {
    setActiveCoins(prev => {
      const coin1 = prev.find(c => c.id === id1);
      const coin2 = prev.find(c => c.id === id2);

      if (!coin1 || !coin2) return prev;

      const remaining = prev.filter(c => c.id !== id1 && c.id !== id2);

      const newPos: [number, number, number] = [
        (coin1.position[0] + coin2.position[0]) / 2,
        (coin1.position[1] + coin2.position[1]) / 2,
        (coin1.position[2] + coin2.position[2]) / 2
      ];

      const newCoin: CoinData = {
        id: `merged-${Math.random().toString(36).substr(2, 9)}`,
        type: resultType,
        position: newPos,
        rotation: [0, 0, 0]
      };

      playSound('powerup');
      return [...remaining, newCoin];
    });
  }, []);

  // ------------------------------

  const handleCoinCollected = useCallback((id: string, type: CoinType) => {
    // Remove the collected coin from the active array
    setActiveCoins(prev => prev.filter(c => c.id !== id));

    const config = COIN_CONFIG[type];
    lastScoreTimeRef.current = Date.now(); // Reset decay timer

    setGameState(prev => {
      const multArtifact = prev.artifacts.find(a => a.id === 'mult');
      const level = multArtifact ? multArtifact.level : 0;
      const scoreMult = Math.pow(1.5, level);

      // Calculate Bonus Increase
      // Flat 4% per coin. 25 coins to fill.
      let newBonus = prev.bonus + 4;
      let bonusTriggered = false;

      if (newBonus >= 100) {
        newBonus = 0;
        bonusTriggered = true;
      }

      if (bonusTriggered) {
        // We need to trigger the jackpot effect. 
        // Since we are inside a state update, we can't easily call triggerJackpot directly 
        // without side effects. We'll use a timeout to break out of the state reducer.
        setTimeout(() => {
          triggerJackpot();
        }, 0);
      }

      return {
        ...prev,
        score: prev.score + Math.floor(config.score * scoreMult),
        cash: prev.cash + config.value,
        bonus: newBonus
      };
    });
    playSound('collect');
  }, [triggerJackpot]);

  const handleRoundEnd = () => {
    if (gameState.score >= gameState.targetScore) {
      setGameState(prev => ({
        ...prev,
        phase: GamePhase.SHOP,
        score: 0,
        bonus: 0 // Reset bonus between rounds
      }));
    } else {
      setGameState(prev => ({ ...prev, phase: GamePhase.GAME_OVER }));
    }
  };

  const nextRound = () => {
    setGameState(prev => ({
      ...prev,
      phase: GamePhase.PLAYING,
      ante: prev.ante + 1,
      targetScore: Math.floor(prev.targetScore * 1.5),
    }));
    lastScoreTimeRef.current = Date.now();
  };

  const buyItem = (itemType: 'coin' | 'artifact', id: string, cost: number) => {
    if (gameState.cash >= cost) {
      setGameState(prev => {
        const newState = { ...prev, cash: prev.cash - cost };

        if (itemType === 'coin') {
          newState.deck = {
            ...newState.deck,
            [id as CoinType]: newState.deck[id as CoinType] + 5
          };
        } else {
          const existingIndex = prev.artifacts.findIndex(a => a.id === id);

          if (existingIndex >= 0) {
            const updatedArtifacts = [...prev.artifacts];
            updatedArtifacts[existingIndex] = {
              ...updatedArtifacts[existingIndex],
              level: updatedArtifacts[existingIndex].level + 1
            };
            newState.artifacts = updatedArtifacts;
          } else {
            const baseArtifact = SHOP_ARTIFACTS.find(a => a.id === id);
            if (baseArtifact) {
              newState.artifacts = [...prev.artifacts, { ...baseArtifact, active: true, level: 1 }];
            }
          }
        }
        return newState;
      });
    }
  };

  return (
    <div className="relative w-full h-screen bg-black text-white font-sans overflow-hidden select-none">

      {/* 3D Scene Layer */}
      <div className="absolute inset-0 z-0">
        <Scene3D
          activeCoins={activeCoins}
          onCoinCollected={handleCoinCollected}
          onSplit={handleSplit}
          onExplode={handleExplode}
          onTransmute={handleTransmute}
          onInteraction={handleCoinInteraction}
          phase={gameState.phase}
          artifacts={gameState.artifacts}
          timeScale={timeScale}
        />
      </div>

      {/* UI Overlay Layer */}
      <div className="absolute inset-0 z-10 pointer-events-none">
        {gameState.phase === GamePhase.MENU && (
          <div className="flex flex-col items-center justify-center h-full bg-black/80 backdrop-blur-sm pointer-events-auto">
            <h1 className="text-6xl font-black text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-fuchsia-500 mb-8 tracking-tighter text-center filter drop-shadow-[0_0_10px_rgba(217,70,239,0.5)]">
              JACKPOT<br />SINGULARITY
            </h1>
            <p className="text-cyan-200 mb-8 max-w-md text-center border-l-4 border-fuchsia-500 pl-4 bg-black/50 p-4">
              Physics Arcade Roguelike.<br />
              Drop coins. Push the pile. Buy upgrades.<br />
              Reach the target score to survive.
            </p>
            <button
              onClick={startGame}
              className="group relative px-8 py-4 bg-cyan-600 text-white font-bold text-xl uppercase tracking-widest hover:bg-cyan-500 transition-all clip-path-polygon"
            >
              <span className="absolute inset-0 w-full h-full border-2 border-white opacity-20 group-hover:scale-105 transition-transform"></span>
              Initialize Run
            </button>
          </div>
        )}

        {gameState.phase === GamePhase.PLAYING && (
          <GameHUD
            gameState={gameState}
            onDrop={handleCoinDrop}
            onEndRound={handleRoundEnd}
            timeScale={timeScale}
            setTimeScale={setTimeScale}
          />
        )}

        {gameState.phase === GamePhase.SHOP && (
          <Shop
            gameState={gameState}
            onNextRound={nextRound}
            onBuy={buyItem}
          />
        )}

        {gameState.phase === GamePhase.GAME_OVER && (
          <div className="flex flex-col items-center justify-center h-full bg-red-900/90 backdrop-blur-md pointer-events-auto">
            <h2 className="text-5xl font-bold text-white mb-2">SYSTEM FAILURE</h2>
            <p className="text-xl text-red-200 mb-8">Target Score Not Met</p>
            <div className="text-2xl mb-8 font-mono">
              Final Score: <span className="text-yellow-400">{Math.floor(gameState.score)}</span>
            </div>
            <button
              onClick={() => {
                setGameState(INITIAL_STATE);
                setActiveCoins([]);
              }}
              className="flex items-center gap-2 px-6 py-3 bg-white text-red-900 font-bold hover:bg-gray-200"
            >
              <RotateCcw size={20} /> REBOOT SYSTEM
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default App;