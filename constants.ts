import { CoinType, DeckItem, Artifact } from './types';

export const COLORS = {
  NEON_PINK: '#d946ef',
  NEON_CYAN: '#06b6d4',
  NEON_PURPLE: '#8b5cf6',
  NEON_YELLOW: '#facc15',
  DARK_BG: '#0a0a0a',
  FLOOR: '#111111',
};

export const COIN_CONFIG: Record<CoinType, DeckItem> = {
  [CoinType.STANDARD]: {
    type: CoinType.STANDARD,
    count: 0,
    name: "Standard Chip",
    value: 10,
    score: 100,
    cost: 5,
    color: '#cd7f32', // Bronze
    description: "Basic reliable currency."
  },
  [CoinType.SPLITTER]: {
    type: CoinType.SPLITTER,
    count: 0,
    name: "Splitter Cell",
    value: 15,
    score: 150,
    cost: 50,
    color: '#22c55e', // Green
    description: "High bounciness. Unstable."
  },
  [CoinType.HEAVY]: {
    type: CoinType.HEAVY,
    count: 0,
    name: "Heavy Anchor",
    value: 20,
    score: 300,
    cost: 80,
    color: '#475569', // Slate
    description: "Massive weight. Pushes piles."
  },
  [CoinType.GOLD]: {
    type: CoinType.GOLD,
    count: 0,
    name: "Midas Touch",
    value: 100,
    score: 1000,
    cost: 200,
    color: '#facc15', // Gold
    description: "High value target."
  },
  [CoinType.BOMB]: {
    type: CoinType.BOMB,
    count: 0,
    name: "Cluster Bomb",
    value: 5,
    score: 50,
    cost: 150,
    color: '#ef4444', // Red
    description: "Explodes on impact."
  },
  // --- NEW INTERACTIVE COINS ---
  [CoinType.SEED]: {
    type: CoinType.SEED,
    count: 0,
    name: "Nanoseed",
    value: 5,
    score: 50,
    cost: 40,
    color: '#84cc16', // Lime Green
    description: "Combine with Hydro-Vial."
  },
  [CoinType.WATER]: {
    type: CoinType.WATER,
    count: 0,
    name: "Hydro-Vial",
    value: 5,
    score: 50,
    cost: 40,
    color: '#3b82f6', // Blue
    description: "Combine with Nanoseed."
  },
  [CoinType.MAGMA]: {
    type: CoinType.MAGMA,
    count: 0,
    name: "Pyro-Core",
    value: 10,
    score: 80,
    cost: 60,
    color: '#f97316', // Orange
    description: "Hot! Combine with Cryo-Cell."
  },
  [CoinType.ICE]: {
    type: CoinType.ICE,
    count: 0,
    name: "Cryo-Cell",
    value: 10,
    score: 80,
    cost: 60,
    color: '#a5f3fc', // Cyan Ice
    description: "Cold! Combine with Pyro-Core."
  },
  [CoinType.KEY]: {
    type: CoinType.KEY,
    count: 0,
    name: "Access Key",
    value: 50,
    score: 200,
    cost: 120,
    color: '#e2e8f0', // Silver
    description: "Unlocks Cached Chests."
  },
  [CoinType.CHEST]: {
    type: CoinType.CHEST,
    count: 0,
    name: "Locked Cache",
    value: 50,
    score: 200,
    cost: 120,
    color: '#78350f', // Brown/Bronze
    description: "Needs an Access Key."
  },
  // --- RESULTS (High Cost to discourage direct buy, mostly for display) ---
  [CoinType.TREE]: {
    type: CoinType.TREE,
    count: 0,
    name: "Yggdrasil Node",
    value: 500,
    score: 5000,
    cost: 9999,
    color: '#14532d', // Dark Green
    description: "Grown from Seed + Water."
  },
  [CoinType.OBSIDIAN]: {
    type: CoinType.OBSIDIAN,
    count: 0,
    name: "Obsidian Slab",
    value: 300,
    score: 3000,
    cost: 9999,
    color: '#1e1b4b', // Very Dark Blue/Black
    description: "Forged from Fire + Ice. Heavy."
  },
  [CoinType.DIAMOND]: {
    type: CoinType.DIAMOND,
    count: 0,
    name: "Quantum Diamond",
    value: 1000,
    score: 10000,
    cost: 9999,
    color: '#ffffff', // White
    description: "Unlocked from Cache."
  }
};

export const INITIAL_DECK = {
  [CoinType.STANDARD]: 30,
  [CoinType.SPLITTER]: 2,
  [CoinType.HEAVY]: 1,
  [CoinType.GOLD]: 0,
  [CoinType.BOMB]: 0,
  [CoinType.SEED]: 3,
  [CoinType.WATER]: 3,
  [CoinType.MAGMA]: 0,
  [CoinType.ICE]: 0,
  [CoinType.KEY]: 0,
  [CoinType.CHEST]: 0,
  [CoinType.TREE]: 0,
  [CoinType.OBSIDIAN]: 0,
  [CoinType.DIAMOND]: 0,
};

export const SHOP_ARTIFACTS: Artifact[] = [
  { id: 'magnet', name: 'Flux Magnet', description: 'Coins settle faster per level.', cost: 300, active: false, level: 0 },
  { id: 'extender', name: 'Bed Extender', description: 'Widens playing area.', cost: 500, active: false, level: 0 },
  { id: 'mult', name: 'Score Multiplier', description: 'Score x1.5 per level.', cost: 800, active: false, level: 0 },
];