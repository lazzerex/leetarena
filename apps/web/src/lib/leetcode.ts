export function normalizeTitleSlug(slug: string | null | undefined): string {
  return (slug ?? '').trim().replace(/^\/+|\/+$/g, '');
}

export function buildLeetCodeProblemUrl(slug: string | null | undefined): string {
  const normalized = normalizeTitleSlug(slug);
  return normalized ? `https://leetcode.com/problems/${normalized}/` : 'https://leetcode.com/problemset/';
}
