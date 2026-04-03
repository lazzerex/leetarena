// ─── Element System ──────────────────────────────────────────────────────────

export type Element =
  | 'Graph'
  | 'Tree'
  | 'Math'
  | 'DynamicProgramming'
  | 'String'
  | 'Array';

export const ELEMENT_ADVANTAGES: Record<Element, Element> = {
  Graph: 'Tree',
  Tree: 'Math',
  Math: 'DynamicProgramming',
  DynamicProgramming: 'Graph',
  String: 'Array',
  Array: 'String',
};

export function getTypeMultiplier(attacker: Element, defender: Element): number {
  if (ELEMENT_ADVANTAGES[attacker] === defender) return 1.3;
  if (ELEMENT_ADVANTAGES[defender] === attacker) return 0.7;
  return 1.0;
}

export const TAG_TO_ELEMENT: Record<string, Element> = {
  graph: 'Graph',
  'breadth-first-search': 'Graph',
  'depth-first-search': 'Graph',
  'topological-sort': 'Graph',
  tree: 'Tree',
  'binary-tree': 'Tree',
  trie: 'Tree',
  math: 'Math',
  'bit-manipulation': 'Math',
  'number-theory': 'Math',
  'dynamic-programming': 'DynamicProgramming',
  memoization: 'DynamicProgramming',
  string: 'String',
  'sliding-window': 'String',
  'two-pointers': 'String',
  array: 'Array',
  sorting: 'Array',
  'binary-search': 'Array',
  'hash-table': 'Array',
};

// ─── Rarity ──────────────────────────────────────────────────────────────────

export type Rarity = 'common' | 'rare' | 'epic' | 'legendary';

export const RARITY_DROP_RATES: Record<Rarity, number> = {
  common: 0.6,
  rare: 0.3,
  epic: 0.08,
  legendary: 0.02,
};

export const RARITY_COLORS: Record<Rarity, string> = {
  common: '#9ca3af',
  rare: '#3b82f6',
  epic: '#a855f7',
  legendary: '#f59e0b',
};

// ─── Card Tiers ───────────────────────────────────────────────────────────────

export type ProblemCardTier = 'locked' | 'base' | 'proven' | 'mastered';
export type AlgoCardTier = 'learned' | 'practiced' | 'expert' | 'legend';

export const TIER_STAT_MULTIPLIERS: Record<ProblemCardTier, number> = {
  locked: 0,
  base: 1.0,
  proven: 1.15,
  mastered: 1.3,
};

export const ALGO_TIER_ATK_BOOST: Record<AlgoCardTier, number> = {
  learned: 0.05,
  practiced: 0.10,
  expert: 0.20,
  legend: 0.35,
};

export const ALGO_SOLVE_THRESHOLDS: Record<AlgoCardTier, number> = {
  learned: 1,
  practiced: 3,
  expert: 10,
  legend: 25,
};

// ─── Problem Card ─────────────────────────────────────────────────────────────

export interface ProblemCard {
  id: string;
  titleSlug: string;
  title: string;
  difficulty: 'Easy' | 'Medium' | 'Hard';
  acceptanceRate: number;
  elementType: Element;
  baseAtk: number;
  baseDef: number;
  baseHp: number;
  rarity: Rarity;
  isBlind75: boolean;
  tags: string[];
}

export interface UserProblemCard extends ProblemCard {
  tier: ProblemCardTier;
  equippedAlgo1?: string;
  equippedAlgo2?: string;
  obtainedAt: string;
}

// ─── Algorithm Card ───────────────────────────────────────────────────────────

export interface AlgorithmCard {
  id: string;
  slug: string;
  name: string;
  description: string;
  abilityName?: string;
  abilityDescription?: string;
  mode?: 'trap' | 'effect';
  tags: string[];
  themeTemplate?: string;
  themeTokens?: AlgorithmThemeTokens;
}

export interface UserAlgorithmCard extends AlgorithmCard {
  tier: AlgoCardTier;
  solveCount: number;
}

export interface AlgorithmThemeTokens {
  surface: string;
  border: string;
  accent: string;
  chip: string;
  text: string;
  glow: string;
}

export interface AlgorithmCardDefinition {
  slug: string;
  name: string;
  description: string;
  abilityName: string;
  abilityDescription: string;
  mode: 'trap' | 'effect';
  tags: string[];
  themeTemplate: string;
  themeTokens: AlgorithmThemeTokens;
}

export const ALGORITHM_CARD_CATALOG: readonly AlgorithmCardDefinition[] = [
  {
    slug: 'binary-search-snare',
    name: 'Binary Search Snare',
    description: 'Set a precision trap that punishes overconfident openers.',
    abilityName: 'Midpoint Snap',
    abilityDescription: 'When triggered, reduce enemy opening ATK by 15% this round.',
    mode: 'trap',
    tags: ['array', 'binary-search'],
    themeTemplate: 'tide',
    themeTokens: {
      surface: '#0d1f2f',
      border: '#3ba7e5',
      accent: '#7dd3fc',
      chip: '#11344c',
      text: '#e0f2fe',
      glow: 'rgba(56, 189, 248, 0.35)',
    },
  },
  {
    slug: 'union-find-barrier',
    name: 'Union-Find Barrier',
    description: 'A structural shield that absorbs impact before collapse.',
    abilityName: 'Path Compression Wall',
    abilityDescription: 'On use, grant your active card +20 DEF for the current reveal.',
    mode: 'effect',
    tags: ['graph', 'union-find'],
    themeTemplate: 'forest',
    themeTokens: {
      surface: '#10261c',
      border: '#38b26f',
      accent: '#86efac',
      chip: '#183629',
      text: '#dcfce7',
      glow: 'rgba(34, 197, 94, 0.35)',
    },
  },
  {
    slug: 'dp-overclock',
    name: 'DP Overclock',
    description: 'Bank previous states and convert them into immediate tempo.',
    abilityName: 'Memo Burst',
    abilityDescription: 'Increase your revealed card ATK by 12% for this round.',
    mode: 'effect',
    tags: ['dynamic-programming', 'memoization'],
    themeTemplate: 'neon',
    themeTokens: {
      surface: '#1a1433',
      border: '#8b5cf6',
      accent: '#c4b5fd',
      chip: '#2a1f4d',
      text: '#ede9fe',
      glow: 'rgba(139, 92, 246, 0.35)',
    },
  },
  {
    slug: 'greedy-fakeout',
    name: 'Greedy Fakeout',
    description: 'A bait line that lures the opponent into suboptimal sequencing.',
    abilityName: 'Local Optimum',
    abilityDescription: 'When triggered, enemy multiplier is clamped to 1.0 this reveal.',
    mode: 'trap',
    tags: ['greedy', 'array'],
    themeTemplate: 'ember',
    themeTokens: {
      surface: '#2b170f',
      border: '#f97316',
      accent: '#fdba74',
      chip: '#3a2015',
      text: '#ffedd5',
      glow: 'rgba(249, 115, 22, 0.35)',
    },
  },
  {
    slug: 'segment-tree-lock',
    name: 'Segment Tree Lock',
    description: 'Range control tool that stalls sudden momentum swings.',
    abilityName: 'Range Freeze',
    abilityDescription: 'Prevent opponent bonus effects from applying this round.',
    mode: 'trap',
    tags: ['tree', 'segment-tree'],
    themeTemplate: 'stone',
    themeTokens: {
      surface: '#1d2430',
      border: '#94a3b8',
      accent: '#cbd5e1',
      chip: '#2a3342',
      text: '#e2e8f0',
      glow: 'rgba(148, 163, 184, 0.35)',
    },
  },
  {
    slug: 'string-hash-jam',
    name: 'String Hash Jam',
    description: 'Corrupts readable patterns and muddles clear reads.',
    abilityName: 'Collision Storm',
    abilityDescription: 'Reduce opponent DEF by 18% for the active clash.',
    mode: 'effect',
    tags: ['string', 'hash-table'],
    themeTemplate: 'rose',
    themeTokens: {
      surface: '#2c1220',
      border: '#ec4899',
      accent: '#f9a8d4',
      chip: '#3d1b2d',
      text: '#fce7f3',
      glow: 'rgba(236, 72, 153, 0.35)',
    },
  },
] as const;

const ALGORITHM_CARD_INDEX = new Map(
  ALGORITHM_CARD_CATALOG.map((definition) => [definition.slug, definition])
);

export function getAlgorithmCardDefinition(slug: string): AlgorithmCardDefinition | undefined {
  return ALGORITHM_CARD_INDEX.get(slug);
}

// ─── Stat Calculation Helpers ─────────────────────────────────────────────────

export function calcAtk(timeComplexity: 'O(1)' | 'O(log n)' | 'O(n)' | 'O(n log n)' | 'O(n²)'): number {
  const map = { 'O(1)': 100, 'O(log n)': 85, 'O(n)': 70, 'O(n log n)': 55, 'O(n²)': 30 };
  return map[timeComplexity] ?? 50;
}

export function calcDef(spaceComplexity: 'O(1)' | 'O(log n)' | 'O(n)' | 'O(n²)'): number {
  const map = { 'O(1)': 100, 'O(log n)': 80, 'O(n)': 60, 'O(n²)': 30 };
  return map[spaceComplexity] ?? 50;
}

export function calcHp(acceptanceRate: number): number {
  return Math.round((1 - acceptanceRate) * 100);
}

export function getElementFromTags(tags: string[]): Element {
  for (const tag of tags) {
    const el = TAG_TO_ELEMENT[tag];
    if (el) return el;
  }
  return 'Array';
}

export function getRarityFromDifficulty(
  difficulty: 'Easy' | 'Medium' | 'Hard',
  isBlind75: boolean,
  isTopHardByAcceptance: boolean
): Rarity {
  if (isBlind75) return 'legendary';
  if (difficulty === 'Hard' && isTopHardByAcceptance) return 'epic';
  if (difficulty === 'Hard') return 'rare';
  if (difficulty === 'Medium') return 'rare';
  return 'common';
}

// ─── Deck ─────────────────────────────────────────────────────────────────────

export interface Deck {
  id: string;
  userId: string;
  name: string;
  cardIds: string[];
  createdAt: string;
}

// ─── Battle ───────────────────────────────────────────────────────────────────

export type BattleStatus = 'waiting' | 'active' | 'finished';

export interface Battle {
  id: string;
  player1Id: string;
  player2Id: string;
  winnerId?: string;
  deck1Id: string;
  deck2Id: string;
  replayJson?: BattleReplay;
  startedAt: string;
  endedAt?: string;
  status: BattleStatus;
}

export interface BattleRound {
  roundNumber: number;
  player1CardId: string;
  player2CardId: string;
  player1Atk: number;
  player2Atk: number;
  player1Multiplier: number;
  player2Multiplier: number;
  roundWinnerId: string | null; // null = tie
}

export interface BattleReplay {
  rounds: BattleRound[];
}

// ─── Realtime Events ──────────────────────────────────────────────────────────

export type BattleEvent =
  | { type: 'card_played'; playerId: string }
  | { type: 'cards_revealed'; player1CardId: string; player2CardId: string }
  | { type: 'turn_result'; round: BattleRound }
  | { type: 'battle_end'; winnerId: string; rewards: BattleRewards }
  | { type: 'timer_tick'; playerId: string; secondsLeft: number };

export interface BattleRewards {
  winnerId: string;
  winnerCoins: number;
  loserCoins: number;
  winnerRatingDelta: number;
  loserRatingDelta: number;
}

// ─── Pack ─────────────────────────────────────────────────────────────────────

export type PackType = 'daily' | 'core' | 'topic' | 'blind75' | 'contest' | 'company';

export interface Pack {
  id: string;
  userId: string;
  packType: PackType;
  cardsReceived: string[];
  openedAt: string;
}

export const PACK_COSTS: Record<PackType, number | 'free' | 'earned'> = {
  daily: 'free',
  core: 300,
  topic: 500,
  blind75: 1500,
  contest: 'earned',
  company: 2000,
};

// ─── LeetCode Sync ────────────────────────────────────────────────────────────

export interface LeetCodeSubmission {
  titleSlug: string;
  status: string;
  timestamp: number;
  tags: string[];
  difficulty: 'Easy' | 'Medium' | 'Hard';
  runtimePercentile: number;
}

export interface SyncState {
  userId: string;
  lastSyncedAt: string;
  lastSubmissionId: string;
  pendingXp: Record<string, number>;
}

// ─── Quest / Achievement ──────────────────────────────────────────────────────

export interface DailyQuest {
  id: string;
  description: string;
  reward: number;
  rewardType: 'coins' | 'xp';
  progress: number;
  target: number;
  completed: boolean;
}

export interface Achievement {
  id: string;
  name: string;
  description: string;
  unlockedAt?: string;
}

// ─── User ─────────────────────────────────────────────────────────────────────

export interface User {
  id: string;
  username: string;
  leetcodeUsername?: string;
  coins: number;
  rating: number;
  createdAt: string;
}
