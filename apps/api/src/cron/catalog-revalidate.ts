import { CORE_CATALOG_MANIFEST } from '../catalog/core-manifest.v1';

type ManifestItem = (typeof CORE_CATALOG_MANIFEST.items)[number];

type BlockingIssue = {
  type: string;
  title_slug: string;
  expected?: string;
  actual?: string;
  detail?: string;
};

type IndexRow = {
  title: string;
  hidden: boolean;
  paidOnly: boolean;
  difficulty: 'Easy' | 'Medium' | 'Hard';
};

const ALL_PROBLEMS_URL = 'https://leetcode.com/api/problems/all/';
const GRAPHQL_URL = 'https://leetcode.com/graphql';

function mapDifficulty(level: number): 'Easy' | 'Medium' | 'Hard' {
  if (level === 1) return 'Easy';
  if (level === 2) return 'Medium';
  if (level === 3) return 'Hard';
  return 'Medium';
}

function normalizeString(value: string | null | undefined): string {
  return (value ?? '').trim().replace(/\s+/g, ' ').toLowerCase();
}

async function fetchProblemIndex() {
  const res = await fetch(ALL_PROBLEMS_URL, {
    headers: { 'User-Agent': 'LeetArena-CatalogCron/1.0' },
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch ${ALL_PROBLEMS_URL} (${res.status})`);
  }

  const body = await res.json() as { stat_status_pairs?: Array<any> };
  const pairs = Array.isArray(body.stat_status_pairs) ? body.stat_status_pairs : [];

  const bySlug = new Map<string, IndexRow>();
  for (const row of pairs) {
    const slug = row?.stat?.question__title_slug as string | undefined;
    if (!slug || bySlug.has(slug)) continue;

    bySlug.set(slug, {
      title: String(row?.stat?.question__title ?? ''),
      hidden: Boolean(row?.stat?.question__hide),
      paidOnly: Boolean(row?.paid_only ?? row?.stat?.question__paid_only),
      difficulty: mapDifficulty(Number(row?.difficulty?.level ?? 2)),
    });
  }

  return bySlug;
}

async function fetchQuestion(titleSlug: string) {
  const query = `
    query questionData($titleSlug: String!) {
      question(titleSlug: $titleSlug) {
        title
        difficulty
        isPaidOnly
      }
    }
  `;

  const res = await fetch(GRAPHQL_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': 'LeetArena-CatalogCron/1.0',
    },
    body: JSON.stringify({ query, variables: { titleSlug } }),
  });

  if (!res.ok) {
    throw new Error(`GraphQL request failed (${res.status}) for ${titleSlug}`);
  }

  const json = await res.json() as { data?: { question?: { title: string; difficulty: string; isPaidOnly: boolean } }; errors?: unknown[] };
  if (json.errors?.length) {
    throw new Error(`GraphQL error for ${titleSlug}`);
  }

  return json.data?.question ?? null;
}

async function mapWithConcurrency<TInput, TOutput>(
  items: readonly TInput[],
  limit: number,
  mapper: (value: TInput) => Promise<TOutput>
): Promise<TOutput[]> {
  const out = new Array<TOutput>(items.length);
  let index = 0;

  async function worker() {
    while (index < items.length) {
      const current = index++;
      const value = items[current];
      if (value === undefined) continue;
      out[current] = await mapper(value);
    }
  }

  await Promise.all(Array.from({ length: limit }, () => worker()));
  return out;
}

export async function revalidateCatalogManifestCron() {
  const indexBySlug = await fetchProblemIndex();
  const blockingIssues: BlockingIssue[] = [];

  for (const item of CORE_CATALOG_MANIFEST.items) {
    const indexRow = indexBySlug.get(item.title_slug);
    if (!indexRow) {
      blockingIssues.push({ type: 'missing_slug', title_slug: item.title_slug });
      continue;
    }

    if (indexRow.hidden) {
      blockingIssues.push({ type: 'hidden_problem', title_slug: item.title_slug });
    }

    if (indexRow.paidOnly) {
      blockingIssues.push({ type: 'premium_problem_index', title_slug: item.title_slug });
    }

    if (indexRow.difficulty !== item.difficulty) {
      blockingIssues.push({
        type: 'difficulty_mismatch_index',
        title_slug: item.title_slug,
        expected: item.difficulty,
        actual: indexRow.difficulty,
      });
    }

    if (normalizeString(indexRow.title) !== normalizeString(item.title)) {
      blockingIssues.push({
        type: 'title_mismatch_index',
        title_slug: item.title_slug,
      });
    }
  }

  const graphqlChecks = await mapWithConcurrency(
    CORE_CATALOG_MANIFEST.items,
    8,
    async (item): Promise<{ item: ManifestItem; issue: BlockingIssue | null }> => {
      try {
        const question = await fetchQuestion(item.title_slug);
        if (!question) {
          return { item, issue: { type: 'missing_question_graphql', title_slug: item.title_slug } };
        }

        if (question.isPaidOnly) {
          return { item, issue: { type: 'premium_problem_graphql', title_slug: item.title_slug } };
        }

        if (question.difficulty !== item.difficulty) {
          return {
            item,
            issue: {
              type: 'difficulty_mismatch_graphql',
              title_slug: item.title_slug,
              expected: item.difficulty,
              actual: question.difficulty,
            },
          };
        }

        if (normalizeString(question.title) !== normalizeString(item.title)) {
          return { item, issue: { type: 'title_mismatch_graphql', title_slug: item.title_slug } };
        }

        return { item, issue: null };
      } catch (error) {
        return {
          item,
          issue: {
            type: 'graphql_error',
            title_slug: item.title_slug,
            detail: error instanceof Error ? error.message : String(error),
          },
        };
      }
    }
  );

  for (const result of graphqlChecks) {
    if (result.issue) {
      blockingIssues.push(result.issue);
    }
  }

  if (blockingIssues.length > 0) {
    console.error(`[catalog:revalidate] blocking issues: ${blockingIssues.length}`);
    console.error(JSON.stringify(blockingIssues.slice(0, 20), null, 2));
    throw new Error('[catalog:revalidate] Manifest drift detected');
  }

  console.log(
    `[catalog:revalidate] passed for ${CORE_CATALOG_MANIFEST.items.length} items (${CORE_CATALOG_MANIFEST.catalog_version})`
  );

  return {
    ok: true,
    catalogVersion: CORE_CATALOG_MANIFEST.catalog_version,
    checkedItems: CORE_CATALOG_MANIFEST.items.length,
  };
}
