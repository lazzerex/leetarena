import {
  type Element,
  type Rarity,
  type ProblemCardTier,
  type AlgoCardTier,
  TIER_STAT_MULTIPLIERS,
  ALGO_TIER_ATK_BOOST,
  ALGO_SOLVE_THRESHOLDS,
  getElementFromTags,
  getRarityFromDifficulty,
  calcHp,
} from '@leetarena/types';

export const BLIND_75_SLUGS = new Set([
  'two-sum', 'best-time-to-buy-and-sell-stock', 'contains-duplicate',
  'product-of-array-except-self', 'maximum-subarray', 'maximum-product-subarray',
  'find-minimum-in-rotated-sorted-array', 'search-in-rotated-sorted-array',
  '3sum', 'container-with-most-water', 'longest-substring-without-repeating-characters',
  'longest-repeating-character-replacement', 'minimum-window-substring',
  'valid-anagram', 'group-anagrams', 'valid-parentheses', 'valid-palindrome',
  'longest-palindromic-substring', 'palindromic-substrings', 'encode-and-decode-strings',
  'binary-search', 'find-minimum-in-rotated-sorted-array', 'reverse-linked-list',
  'linked-list-cycle', 'merge-two-sorted-lists', 'reorder-list',
  'remove-nth-node-from-end-of-list', 'lru-cache', 'merge-k-sorted-lists',
  'invert-binary-tree', 'maximum-depth-of-binary-tree', 'same-tree',
  'subtree-of-another-tree', 'lowest-common-ancestor-of-a-binary-search-tree',
  'binary-tree-level-order-traversal', 'validate-binary-search-tree',
  'kth-smallest-element-in-a-bst', 'construct-binary-tree-from-preorder-and-inorder-traversal',
  'binary-tree-maximum-path-sum', 'serialize-and-deserialize-binary-tree',
  'implement-trie-prefix-tree', 'add-and-search-word-data-structure-design',
  'word-search-ii', 'combination-sum', 'word-search', 'number-of-islands',
  'clone-graph', 'pacific-atlantic-water-flow', 'course-schedule',
  'number-of-connected-components-in-an-undirected-graph', 'graph-valid-tree',
  'alien-dictionary', 'climbing-stairs', 'coin-change', 'longest-increasing-subsequence',
  'house-robber', 'house-robber-ii', 'unique-paths', 'jump-game',
  'decode-ways', 'word-break', 'combination-sum-iv', 'partition-equal-subset-sum',
  'longest-common-subsequence', 'regular-expression-matching', 'edit-distance',
  'trapping-rain-water', 'find-median-from-data-stream',
  'kth-largest-element-in-an-array', 'top-k-frequent-elements',
  'meeting-rooms', 'meeting-rooms-ii', 'task-scheduler', 'hand-of-straights',
  'merge-intervals', 'insert-interval', 'non-overlapping-intervals',
  'rotate-image', 'spiral-matrix', 'set-matrix-zeroes', 'word-ladder',
]);

interface CardStatInput {
  titleSlug: string;
  difficulty: 'Easy' | 'Medium' | 'Hard';
  acRate: number; // 0.0 – 1.0
  tags: string[];
  isTopHardByAcceptance?: boolean;
}

interface ComputedCardStats {
  baseAtk: number;
  baseDef: number;
  baseHp: number;
  elementType: Element;
  rarity: Rarity;
  isBlind75: boolean;
}

/**
 * Derive stats from LeetCode problem metadata.
 * ATK maps to time complexity via difficulty proxy,
 * DEF maps to space complexity proxy.
 */
export function computeCardStats(input: CardStatInput): ComputedCardStats {
  const isBlind75 = BLIND_75_SLUGS.has(input.titleSlug);
  const elementType = getElementFromTags(input.tags);

  // Approximate complexity from difficulty
  const atkMap: Record<string, number> = { Easy: 70, Medium: 55, Hard: 30 };
  const defMap: Record<string, number> = { Easy: 80, Medium: 60, Hard: 40 };

  const baseAtk = atkMap[input.difficulty] ?? 50;
  const baseDef = defMap[input.difficulty] ?? 50;
  const baseHp = calcHp(input.acRate);
  const rarity = getRarityFromDifficulty(
    input.difficulty,
    isBlind75,
    input.isTopHardByAcceptance ?? false
  );

  return { baseAtk, baseDef, baseHp, elementType, rarity, isBlind75 };
}

/**
 * Apply tier multiplier to a stat value.
 */
export function applyTier(baseStat: number, tier: ProblemCardTier): number {
  return Math.round(baseStat * TIER_STAT_MULTIPLIERS[tier]);
}

/**
 * Calculate effective ATK with algorithm card boost.
 */
export function effectiveAtk(
  baseAtk: number,
  tier: ProblemCardTier,
  algoTier?: AlgoCardTier
): number {
  const tiered = applyTier(baseAtk, tier);
  if (!algoTier) return tiered;
  return Math.round(tiered * (1 + ALGO_TIER_ATK_BOOST[algoTier]));
}

/**
 * Determine algorithm card tier from solve count.
 */
export function getAlgoTier(solveCount: number): AlgoCardTier {
  if (solveCount >= ALGO_SOLVE_THRESHOLDS.legend) return 'legend';
  if (solveCount >= ALGO_SOLVE_THRESHOLDS.expert) return 'expert';
  if (solveCount >= ALGO_SOLVE_THRESHOLDS.practiced) return 'practiced';
  if (solveCount >= ALGO_SOLVE_THRESHOLDS.learned) return 'learned';
  return 'learned';
}
