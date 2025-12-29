import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { GamePhase, GameState, CoinType, Artifact, CoinData } from './types';
import { INITIAL_DECK, COIN_CONFIG, SHOP_ARTIFACTS, MACHINE_DIMENSIONS } from './constants';
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
  bonusLevel: 1,
};

const App: React.FC = () => {
  const [gameState, setGameState] = useState<GameState>(INITIAL_STATE);
  const [coinState, setCoinState] = useState<{
    coinMap: Map<string, CoinData>;
    coinOrder: string[];
  }>({
    coinMap: new Map(),
    coinOrder: []
  });
  const [timeScale, setTimeScale] = useState<number>(1);
  const [isTabActive, setIsTabActive] = useState<boolean>(true);

  // Track last score time for bonus decay logic (physics time seconds)
  const physicsTimeRef = useRef<number>(0);
  const lastScoreTimeRef = useRef<number>(0);
  const lastBonusDecayTimeRef = useRef<number>(0);
  const gameStateRef = useRef<GameState>(gameState);

  // Sync ref with state
  useEffect(() => {
    gameStateRef.current = gameState;
  }, [gameState]);

  const activeCoins = useMemo(() => {
    return coinState.coinOrder
      .map(id => coinState.coinMap.get(id))
      .filter((coin): coin is CoinData => Boolean(coin));
  }, [coinState]);

  // Sound effects stub (would use AudioContext in full prod)
  const playSound = (type: 'drop' | 'collect' | 'win' | 'explode' | 'powerup' | 'jackpot') => {
    // console.log(`Audio: ${type}`);
  };

  // --- BONUS METER DECAY LOGIC ---
  useEffect(() => {
    if (gameState.phase !== GamePhase.PLAYING || !isTabActive) return;

    const decayInterval = setInterval(() => {
      const now = physicsTimeRef.current;
      const sinceScore = now - lastScoreTimeRef.current;
      if (sinceScore <= 2) {
        lastBonusDecayTimeRef.current = now;
        return;
      }

      const decayDelta = now - lastBonusDecayTimeRef.current;
      if (decayDelta <= 0) return;

      const decayRatePerSecond = 20;
      lastBonusDecayTimeRef.current = now;

      setGameState(prev => {
        if (prev.bonus <= 0) return prev;
        const nextBonus = Math.max(0, prev.bonus - decayRatePerSecond * decayDelta);
        return {
          ...prev,
          bonus: nextBonus,
          bonusLevel: nextBonus === 0 ? 1 : prev.bonusLevel
        };
      });
    }, 100);

    return () => clearInterval(decayInterval);
  }, [gameState.phase, isTabActive]);

  useEffect(() => {
    const updateTabActive = () => {
      const active = !document.hidden && document.hasFocus();
      setIsTabActive(active);
    };

    updateTabActive();
    document.addEventListener('visibilitychange', updateTabActive);
    window.addEventListener('focus', updateTabActive);
    window.addEventListener('blur', updateTabActive);

    return () => {
      document.removeEventListener('visibilitychange', updateTabActive);
      window.removeEventListener('focus', updateTabActive);
      window.removeEventListener('blur', updateTabActive);
    };
  }, []);

  const handlePhysicsTick = useCallback((deltaSeconds: number) => {
    physicsTimeRef.current += deltaSeconds;
  }, []);

  const startGame = () => {
    setGameState({ ...INITIAL_STATE, phase: GamePhase.PLAYING });
    physicsTimeRef.current = 0;
    lastScoreTimeRef.current = 0;
    lastBonusDecayTimeRef.current = 0;

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

    setCoinState({
      coinMap: new Map(initialCoins.map(coin => [coin.id, coin])),
      coinOrder: initialCoins.map(coin => coin.id)
    });
  };

  // Helper to spawn a coin (used by UI click and Jackpot)
  const spawnCoin = useCallback((type: CoinType, isFree: boolean = false) => {
    const state = gameStateRef.current;

    // Validation: If not free, must have deck count
    if (!isFree && state.deck[type] <= 0) return;

    // Calculate Position
    const extender = state.artifacts.find(a => a.id === 'extender');
    const extenderLevel = extender ? extender.level : 0;
    const dropWidth = MACHINE_DIMENSIONS.baseDropWidth + (extenderLevel * MACHINE_DIMENSIONS.widthPerLevel);

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
    setCoinState(prev => ({
      coinMap: new Map(prev.coinMap).set(newCoin.id, newCoin),
      coinOrder: [...prev.coinOrder, newCoin.id]
    }));

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

  const triggerJackpot = useCallback((bonusLevel: number) => {
    playSound('jackpot');
    const bonusMult = 1 + 0.1 * (bonusLevel - 1);
    const extender = gameStateRef.current.artifacts.find(a => a.id === 'extender');
    const extenderLevel = extender ? extender.level : 0;
    const dropWidth = MACHINE_DIMENSIONS.baseDropWidth + (extenderLevel * MACHINE_DIMENSIONS.widthPerLevel);
    const bedWidth = MACHINE_DIMENSIONS.baseWidth + (extenderLevel * MACHINE_DIMENSIONS.widthPerLevel);
    const bedAreaScale = (bedWidth * MACHINE_DIMENSIONS.bedLength) / (MACHINE_DIMENSIONS.baseWidth * MACHINE_DIMENSIONS.bedLength);
    const maxJackpotCoins = Math.max(1, Math.round(12 * bedAreaScale));
    const jackpotCoins = Math.min(maxJackpotCoins, Math.max(1, Math.round(10 * bonusMult)));
    const newCoins: CoinData[] = Array.from({ length: jackpotCoins }).map(() => {
      const xPos = (Math.random() - 0.5) * dropWidth;
      const zPos = (Math.random() * 3) - 1.5;
      const yPos = 8 + Math.random() * 2;
      return {
        id: `bonus-${Math.random().toString(36).substr(2, 9)}`,
        type: CoinType.STANDARD,
        position: [xPos, yPos, zPos],
        rotation: [0, Math.random() * Math.PI * 2, 0]
      };
    });

    setCoinState(prev => ({
      coinMap: new Map([...prev.coinMap, ...newCoins.map(coin => [coin.id, coin] as const)]),
      coinOrder: [...prev.coinOrder, ...newCoins.map(coin => coin.id)]
    }));
  }, []);

  // --- COIN MECHANICS HANDLERS ---

  const handleSplit = useCallback((id: string, position: THREE.Vector3) => {
    setCoinState(prev => {
      const original = prev.coinMap.get(id);
      if (!original || original.hasSplit) return prev; // Already split or missing

      const coinMap = new Map(prev.coinMap);
      coinMap.set(id, { ...original, hasSplit: true });

      // Create clone
      const clone: CoinData = {
        id: `clone-${Math.random().toString(36).substr(2, 9)}`,
        type: CoinType.SPLITTER,
        hasSplit: true,
        position: [position.x, position.y + 1, position.z],
        rotation: [0, Math.random() * Math.PI * 2, 0]
      };

      coinMap.set(clone.id, clone);
      playSound('powerup');
      return {
        coinMap,
        coinOrder: [...prev.coinOrder, clone.id]
      };
    });
  }, []);

  const handleExplode = useCallback((id: string) => {
    setCoinState(prev => {
      if (!prev.coinMap.has(id)) return prev;
      const coinMap = new Map(prev.coinMap);
      coinMap.delete(id);
      return {
        coinMap,
        coinOrder: prev.coinOrder.filter(coinId => coinId !== id)
      };
    });
    playSound('explode');
  }, []);

  const handleTransmute = useCallback((targetId: string) => {
    setCoinState(prev => {
      const target = prev.coinMap.get(targetId);
      if (!target) return prev;
      if (target.type === CoinType.GOLD) return prev; // Already gold

      const coinMap = new Map(prev.coinMap);
      coinMap.set(targetId, { ...target, type: CoinType.GOLD });
      playSound('powerup');
      return { ...prev, coinMap };
    });
  }, []);

  const handleCoinInteraction = useCallback((id1: string, id2: string, resultType: CoinType) => {
    setCoinState(prev => {
      const coin1 = prev.coinMap.get(id1);
      const coin2 = prev.coinMap.get(id2);

      if (!coin1 || !coin2) return prev;

      const coinMap = new Map(prev.coinMap);
      coinMap.delete(id1);
      coinMap.delete(id2);

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

      coinMap.set(newCoin.id, newCoin);
      playSound('powerup');
      return {
        coinMap,
        coinOrder: [
          ...prev.coinOrder.filter(coinId => coinId !== id1 && coinId !== id2),
          newCoin.id
        ]
      };
    });
  }, []);

  // ------------------------------

  const handleCoinCollected = useCallback((id: string, type: CoinType) => {
    // Remove the collected coin from the active array
    setCoinState(prev => {
      if (!prev.coinMap.has(id)) return prev;
      const coinMap = new Map(prev.coinMap);
      coinMap.delete(id);
      return {
        coinMap,
        coinOrder: prev.coinOrder.filter(coinId => coinId !== id)
      };
    });

    const config = COIN_CONFIG[type];
    lastScoreTimeRef.current = physicsTimeRef.current; // Reset decay timer

    const state = gameStateRef.current;
    const multArtifact = state.artifacts.find(a => a.id === 'mult');
    const level = multArtifact ? multArtifact.level : 0;
    const scoreMult = Math.pow(1.5, level);
    const bonusMult = 1 + 0.1 * (state.bonusLevel - 1);

    // Calculate Bonus Increase
    // Flat 4% per coin. 25 coins to fill.
    let newBonus = state.bonus + 4;
    let nextBonusLevel = state.bonusLevel;

    if (newBonus >= 100) {
      newBonus = 0;
      nextBonusLevel = state.bonusLevel + 1;
      // Trigger the jackpot effect (now safely once)
      setTimeout(() => {
        triggerJackpot(nextBonusLevel);
      }, 0);
    }

    setGameState(prev => ({
      ...prev,
      score: prev.score + Math.floor(config.score * scoreMult * bonusMult),
      cash: prev.cash + config.value,
      bonus: newBonus,
      bonusLevel: nextBonusLevel
    }));
    playSound('collect');
  }, [triggerJackpot]);

  const handleRoundEnd = () => {
    if (gameState.score >= gameState.targetScore) {
      setGameState(prev => ({
        ...prev,
        phase: GamePhase.SHOP,
        score: 0,
        bonus: 0, // Reset bonus between rounds
        bonusLevel: 1
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
    lastScoreTimeRef.current = physicsTimeRef.current;
    lastBonusDecayTimeRef.current = physicsTimeRef.current;
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
          isTabActive={isTabActive}
          onPhysicsTick={handlePhysicsTick}
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
                setCoinState({ coinMap: new Map(), coinOrder: [] });
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
