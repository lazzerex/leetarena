#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CORE_START_ID = 1;
const CORE_END_ID = 300;
const GRAPHQL_URL = 'https://leetcode.com/graphql';
const ALL_PROBLEMS_URL = 'https://leetcode.com/api/problems/all/';

const BLIND_75_SLUGS = new Set([
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

const TAG_TO_ELEMENT = {
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

const QUESTION_QUERY = `
  query questionData($titleSlug: String!) {
    question(titleSlug: $titleSlug) {
      title
      titleSlug
      difficulty
      acRate
      topicTags {
        slug
      }
    }
  }
`;

function loadDevVars() {
  const devVarsPath = path.resolve(__dirname, '../.dev.vars');
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

function requiredEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing env ${name}. Set it in apps/api/.dev.vars or shell env.`);
  }
  return value;
}

async function gql(query, variables = {}) {
  const res = await fetch(GRAPHQL_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': 'LeetArena-Seed/1.0',
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

async function fetchCoreList() {
  const res = await fetch(ALL_PROBLEMS_URL, {
    headers: { 'User-Agent': 'LeetArena-Seed/1.0' },
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch ${ALL_PROBLEMS_URL} (${res.status})`);
  }

  const body = await res.json();
  const pairs = Array.isArray(body.stat_status_pairs) ? body.stat_status_pairs : [];

  const byId = new Map();

  for (const row of pairs) {
    const frontendId = Number(row?.stat?.frontend_question_id);
    const hidden = Boolean(row?.stat?.question__hide);
    const titleSlug = row?.stat?.question__title_slug;

    if (!Number.isInteger(frontendId)) continue;
    if (frontendId < CORE_START_ID || frontendId > CORE_END_ID) continue;
    if (hidden || !titleSlug) continue;

    if (!byId.has(frontendId)) {
      byId.set(frontendId, row);
    }
  }

  const missing = [];
  for (let id = CORE_START_ID; id <= CORE_END_ID; id += 1) {
    if (!byId.has(id)) missing.push(id);
  }

  if (missing.length) {
    throw new Error(
      `Missing core IDs from source: ${missing.join(', ')}. Aborting seed to keep catalog fixed.`
    );
  }

  const ordered = [];
  for (let id = CORE_START_ID; id <= CORE_END_ID; id += 1) {
    ordered.push(byId.get(id));
  }

  return ordered;
}

function mapDifficulty(level) {
  if (level === 1) return 'Easy';
  if (level === 2) return 'Medium';
  if (level === 3) return 'Hard';
  return 'Medium';
}

function calcHp(acceptanceRate) {
  return Math.round((1 - acceptanceRate) * 100);
}

function getElementFromTags(tags) {
  for (const tag of tags) {
    if (TAG_TO_ELEMENT[tag]) {
      return TAG_TO_ELEMENT[tag];
    }
  }
  return 'Array';
}

function getRarityFromDifficulty(difficulty, isBlind75) {
  if (isBlind75) return 'legendary';
  if (difficulty === 'Hard' || difficulty === 'Medium') return 'rare';
  return 'common';
}

function computeCardStats({ titleSlug, difficulty, acRate, tags }) {
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

async function resolveQuestionMetadata(row) {
  const slug = row?.stat?.question__title_slug;
  const title = row?.stat?.question__title;
  const accepted = Number(row?.stat?.total_acs ?? 0);
  const submitted = Number(row?.stat?.total_submitted ?? 0);
  const fallbackAcRate = submitted > 0 ? accepted / submitted : 0.5;
  const fallbackDifficulty = mapDifficulty(Number(row?.difficulty?.level));

  try {
    const data = await gql(QUESTION_QUERY, { titleSlug: slug });
    const q = data?.question;

    if (!q) {
      return {
        titleSlug: slug,
        title,
        difficulty: fallbackDifficulty,
        acRate: fallbackAcRate,
        tags: [],
      };
    }

    return {
      titleSlug: q.titleSlug ?? slug,
      title: q.title ?? title,
      difficulty: q.difficulty ?? fallbackDifficulty,
      acRate: typeof q.acRate === 'number' ? q.acRate / 100 : fallbackAcRate,
      tags: Array.isArray(q.topicTags) ? q.topicTags.map((t) => t.slug).filter(Boolean) : [],
    };
  } catch {
    return {
      titleSlug: slug,
      title,
      difficulty: fallbackDifficulty,
      acRate: fallbackAcRate,
      tags: [],
    };
  }
}

async function mapWithConcurrency(items, limit, mapper) {
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

async function upsertCards(supabaseUrl, serviceRoleKey, cards) {
  const endpoint = `${supabaseUrl.replace(/\/$/, '')}/rest/v1/cards?on_conflict=title_slug`;
  const chunkSize = 50;

  for (let i = 0; i < cards.length; i += chunkSize) {
    const chunk = cards.slice(i, i + chunkSize);
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
        Prefer: 'resolution=merge-duplicates,return=minimal',
      },
      body: JSON.stringify(chunk),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Supabase upsert failed on chunk ${i / chunkSize + 1}: ${text}`);
    }
  }
}

async function main() {
  loadDevVars();

  const supabaseUrl = requiredEnv('SUPABASE_URL');
  const serviceRoleKey = requiredEnv('SUPABASE_SERVICE_ROLE_KEY');

  console.log(`Fetching fixed core range ${CORE_START_ID}-${CORE_END_ID} from trusted source...`);
  const coreRows = await fetchCoreList();

  console.log('Resolving question metadata and computing card stats...');
  const enriched = await mapWithConcurrency(coreRows, 8, resolveQuestionMetadata);

  const records = enriched.map((q) => {
    const acRate = Math.max(0, Math.min(1, Number(q.acRate ?? 0.5)));
    const difficulty = q.difficulty === 'Easy' || q.difficulty === 'Hard' ? q.difficulty : 'Medium';
    const tags = Array.isArray(q.tags) ? q.tags : [];
    const stats = computeCardStats({
      titleSlug: q.titleSlug,
      difficulty,
      acRate,
      tags,
    });

    return {
      title_slug: q.titleSlug,
      title: q.title,
      difficulty,
      acceptance_rate: Number(acRate.toFixed(4)),
      element_type: stats.elementType,
      base_atk: stats.baseAtk,
      base_def: stats.baseDef,
      base_hp: stats.baseHp,
      rarity: stats.rarity,
      is_blind75: stats.isBlind75,
      tags,
    };
  });

  console.log(`Upserting ${records.length} core cards into public.cards...`);
  await upsertCards(supabaseUrl, serviceRoleKey, records);

  console.log('Core catalog seed complete.');
  console.log('Seeded IDs: 1-300');
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
