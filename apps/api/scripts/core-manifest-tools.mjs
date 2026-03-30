#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

export const GRAPHQL_URL = 'https://leetcode.com/graphql';
export const ALL_PROBLEMS_URL = 'https://leetcode.com/api/problems/all/';

export const BLIND_75_SLUGS = new Set([
  'two-sum', 'best-time-to-buy-and-sell-stock', 'contains-duplicate',
  'product-of-array-except-self', 'maximum-subarray', 'maximum-product-subarray',
  'find-minimum-in-rotated-sorted-array', 'search-in-rotated-sorted-array',
  '3sum', 'container-with-most-water', 'longest-substring-without-repeating-characters',
  'longest-repeating-character-replacement', 'minimum-window-substring',
  'valid-anagram', 'group-anagrams', 'valid-parentheses', 'valid-palindrome',
  'longest-palindromic-substring', 'palindromic-substrings', 'encode-and-decode-strings',
  'binary-search', 'reverse-linked-list', 'linked-list-cycle',
  'merge-two-sorted-lists', 'reorder-list', 'remove-nth-node-from-end-of-list',
  'lru-cache', 'merge-k-sorted-lists', 'invert-binary-tree',
  'maximum-depth-of-binary-tree', 'same-tree', 'subtree-of-another-tree',
  'lowest-common-ancestor-of-a-binary-search-tree', 'binary-tree-level-order-traversal',
  'validate-binary-search-tree', 'kth-smallest-element-in-a-bst',
  'construct-binary-tree-from-preorder-and-inorder-traversal',
  'binary-tree-maximum-path-sum', 'serialize-and-deserialize-binary-tree',
  'implement-trie-prefix-tree', 'add-and-search-word-data-structure-design',
  'word-search-ii', 'combination-sum', 'word-search', 'number-of-islands',
  'clone-graph', 'pacific-atlantic-water-flow', 'course-schedule',
  'number-of-connected-components-in-an-undirected-graph', 'graph-valid-tree',
  'alien-dictionary', 'climbing-stairs', 'coin-change',
  'longest-increasing-subsequence', 'house-robber', 'house-robber-ii',
  'unique-paths', 'jump-game', 'decode-ways', 'word-break',
  'combination-sum-iv', 'partition-equal-subset-sum', 'longest-common-subsequence',
  'regular-expression-matching', 'edit-distance', 'trapping-rain-water',
  'find-median-from-data-stream', 'kth-largest-element-in-an-array',
  'top-k-frequent-elements', 'meeting-rooms', 'meeting-rooms-ii', 'task-scheduler',
  'hand-of-straights', 'merge-intervals', 'insert-interval',
  'non-overlapping-intervals', 'rotate-image', 'spiral-matrix',
  'set-matrix-zeroes', 'word-ladder',
]);

export const TAG_TO_ELEMENT = {
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

export function loadDevVars(devVarsPath) {
  if (!fs.existsSync(devVarsPath)) return;

  const content = fs.readFileSync(devVarsPath, 'utf8');
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const equalIndex = trimmed.indexOf('=');
    if (equalIndex <= 0) continue;

    const key = trimmed.slice(0, equalIndex).trim();
    const value = trimmed.slice(equalIndex + 1).trim();
    if (!(key in process.env)) {
      process.env[key] = value;
    }
  }
}

export function requiredEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing env ${name}. Set it in apps/api/.dev.vars or shell env.`);
  }
  return value;
}

export async function gql(query, variables = {}) {
  const res = await fetch(GRAPHQL_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': 'LeetArena-Catalog/1.0',
    },
    body: JSON.stringify({ query, variables }),
  });

  if (!res.ok) {
    throw new Error(`LeetCode GraphQL request failed (${res.status})`);
  }

  const json = await res.json();
  if (json.errors?.length) {
    throw new Error(`LeetCode GraphQL errors: ${JSON.stringify(json.errors)}`);
  }

  return json.data;
}

export async function mapWithConcurrency(items, limit, mapper) {
  const out = new Array(items.length);
  let nextIndex = 0;

  async function worker() {
    while (nextIndex < items.length) {
      const current = nextIndex;
      nextIndex += 1;
      out[current] = await mapper(items[current], current);
    }
  }

  const workers = [];
  for (let i = 0; i < limit; i += 1) {
    workers.push(worker());
  }

  await Promise.all(workers);
  return out;
}

export async function fetchProblemIndexRows() {
  const res = await fetch(ALL_PROBLEMS_URL, {
    headers: { 'User-Agent': 'LeetArena-Catalog/1.0' },
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch ${ALL_PROBLEMS_URL} (${res.status})`);
  }

  const body = await res.json();
  return Array.isArray(body.stat_status_pairs) ? body.stat_status_pairs : [];
}

const QUESTION_QUERY = `
  query questionData($titleSlug: String!) {
    question(titleSlug: $titleSlug) {
      title
      titleSlug
      difficulty
      acRate
      isPaidOnly
      topicTags {
        slug
      }
    }
  }
`;

export async function fetchQuestionData(titleSlug) {
  const data = await gql(QUESTION_QUERY, { titleSlug });
  return data?.question ?? null;
}

export function normalizeString(value) {
  return String(value ?? '').trim().replace(/\s+/g, ' ').toLowerCase();
}

export function mapDifficulty(level) {
  if (level === 1) return 'Easy';
  if (level === 2) return 'Medium';
  if (level === 3) return 'Hard';
  return 'Medium';
}

export function getElementFromTags(tags) {
  for (const tag of tags) {
    if (TAG_TO_ELEMENT[tag]) {
      return TAG_TO_ELEMENT[tag];
    }
  }
  return 'Array';
}

export function calcHp(acceptanceRate) {
  return Math.round((1 - acceptanceRate) * 100);
}

export function getRarityFromDifficulty(difficulty, isBlind75) {
  if (isBlind75) return 'legendary';
  if (difficulty === 'Hard' || difficulty === 'Medium') return 'rare';
  return 'common';
}

export function computeCardStats({ titleSlug, difficulty, acRate, tags }) {
  const isBlind75 = BLIND_75_SLUGS.has(titleSlug);
  const elementType = getElementFromTags(tags);

  const atkMap = { Easy: 70, Medium: 55, Hard: 30 };
  const defMap = { Easy: 80, Medium: 60, Hard: 40 };

  return {
    baseAtk: atkMap[difficulty] ?? 50,
    baseDef: defMap[difficulty] ?? 50,
    baseHp: calcHp(acRate),
    elementType,
    rarity: getRarityFromDifficulty(difficulty, isBlind75),
    isBlind75,
  };
}

export function writeJson(filePath, jsonValue) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(jsonValue, null, 2)}\n`, 'utf8');
}

export function readJson(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8');
  return JSON.parse(raw);
}
