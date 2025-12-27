export enum GamePhase {
  MENU = 'MENU',
  PLAYING = 'PLAYING',
  SHOP = 'SHOP',
  GAME_OVER = 'GAME_OVER'
}

export enum CoinType {
  STANDARD = 'STANDARD',
  SPLITTER = 'SPLITTER',
  HEAVY = 'HEAVY',
  GOLD = 'GOLD',
  BOMB = 'BOMB',
  // New Interactive Coins
  SEED = 'SEED',
  WATER = 'WATER',
  MAGMA = 'MAGMA',
  ICE = 'ICE',
  KEY = 'KEY',
  CHEST = 'CHEST',
  // Resulting Coins (Not typically bought, but created)
  TREE = 'TREE',
  OBSIDIAN = 'OBSIDIAN',
  DIAMOND = 'DIAMOND'
}

export interface CoinData {
  id: string;
  type: CoinType;
  position: [number, number, number];
  rotation: [number, number, number];
  hasSplit?: boolean; // Track if a splitter has already cloned itself
  isActive?: boolean;
}

export interface DeckItem {
  type: CoinType;
  count: number;
  name: string;
  value: number; // Cash value when collected
  score: number; // Score value when collected
  cost: number; // Cost in shop
  color: string;
  description: string;
}

export interface Artifact {
  id: string;
  name: string;
  description: string;
  cost: number;
  active: boolean; // Kept for potential flags, but level is primary
  level: number;   // Level of the upgrade (0 = not owned)
}

export interface GameState {
  phase: GamePhase;
  score: number;
  targetScore: number;
  cash: number;
  ante: number;
  deck: Record<CoinType, number>; // Count of each coin type in hand
  artifacts: Artifact[];
  bonus: number; // 0 to 100 momentum meter
}