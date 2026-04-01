export interface LeetCodeProfile {
  username: string;
  submitStats: {
    acSubmissionNum: Array<{ difficulty: string; count: number }>;
  };
}

export interface RecentSubmission {
  id: string;
  title: string;
  titleSlug: string;
  timestamp: string;
  statusDisplay: string;
  lang: string;
}

export interface QuestionData {
  title: string;
  titleSlug: string;
  difficulty: 'Easy' | 'Medium' | 'Hard';
  acRate: number;
  topicTags: Array<{ slug: string; name: string }>;
}

export interface QuestionSummary {
  title: string;
  titleSlug: string;
  difficulty: 'Easy' | 'Medium' | 'Hard';
  summary: string;
}

const GRAPHQL_URL = 'https://leetcode.com/graphql';

async function gql<T>(query: string, variables: Record<string, unknown> = {}): Promise<T> {
  const res = await fetch(GRAPHQL_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': 'LeetArena-Bot/1.0',
    },
    body: JSON.stringify({ query, variables }),
  });

  if (!res.ok) {
    throw new Error(`LeetCode GraphQL error: ${res.status}`);
  }

  const json = (await res.json()) as { data: T; errors?: unknown[] };
  if (json.errors?.length) {
    throw new Error(`GraphQL errors: ${JSON.stringify(json.errors)}`);
  }
  return json.data;
}

export async function getUserProfile(username: string): Promise<LeetCodeProfile | null> {
  try {
    const data = await gql<{ matchedUser: LeetCodeProfile | null }>(
      `query userPublicProfile($username: String!) {
        matchedUser(username: $username) {
          username
          submitStats {
            acSubmissionNum {
              difficulty
              count
            }
          }
        }
      }`,
      { username }
    );
    return data.matchedUser;
  } catch {
    return null;
  }
}

export async function getRecentAcceptedSubmissions(
  username: string,
  limit = 20
): Promise<RecentSubmission[]> {
  try {
    const data = await gql<{ recentAcSubmissionList: RecentSubmission[] }>(
      `query recentAcSubmissionList($username: String!, $limit: Int!) {
        recentAcSubmissionList(username: $username, limit: $limit) {
          id
          title
          titleSlug
          timestamp
          statusDisplay
          lang
        }
      }`,
      { username, limit }
    );
    return data.recentAcSubmissionList ?? [];
  } catch {
    return [];
  }
}

export async function getQuestionData(titleSlug: string): Promise<QuestionData | null> {
  try {
    const data = await gql<{ question: QuestionData | null }>(
      `query questionData($titleSlug: String!) {
        question(titleSlug: $titleSlug) {
          title
          titleSlug
          difficulty
          acRate
          topicTags {
            slug
            name
          }
        }
      }`,
      { titleSlug }
    );
    return data.question;
  } catch {
    return null;
  }
}

export async function getQuestionSummary(titleSlug: string): Promise<QuestionSummary | null> {
  try {
    const data = await gql<{ question: {
      title: string;
      titleSlug: string;
      difficulty: 'Easy' | 'Medium' | 'Hard';
      content: string | null;
    } | null }>(
      `query questionSummary($titleSlug: String!) {
        question(titleSlug: $titleSlug) {
          title
          titleSlug
          difficulty
          content
        }
      }`,
      { titleSlug }
    );

    const question = data.question;
    if (!question) return null;

    const summary = extractSummaryFromHtml(question.content);
    if (!summary) return null;

    return {
      title: question.title,
      titleSlug: question.titleSlug,
      difficulty: question.difficulty,
      summary,
    };
  } catch {
    return null;
  }
}

function extractSummaryFromHtml(html: string | null): string | null {
  if (!html || typeof html !== 'string') return null;

  const withoutCodeBlocks = html
    .replace(/<pre[\s\S]*?<\/pre>/gi, ' ')
    .replace(/<code[\s\S]*?<\/code>/gi, ' ');

  const text = decodeHtmlEntities(
    withoutCodeBlocks
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
  );

  if (!text) return null;

  const maxLen = 320;
  const sentences = text.split(/(?<=[.!?])\s+/).filter(Boolean);
  let summary = '';
  let sentenceCount = 0;

  for (const sentence of sentences) {
    const next = (summary ? `${summary} ${sentence}` : sentence).trim();
    if (next.length > maxLen) break;
    summary = next;
    sentenceCount += 1;
    if (sentenceCount >= 2) break;
  }

  if (!summary) {
    summary = text.slice(0, maxLen).trim();
  }

  if (summary.length < text.length && !/[.!?]$/.test(summary)) {
    summary = `${summary}...`;
  }

  return summary;
}

function decodeHtmlEntities(input: string): string {
  return input
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x([0-9a-fA-F]+);/g, (_match, hex) => {
      const codePoint = Number.parseInt(hex, 16);
      return Number.isFinite(codePoint) ? String.fromCodePoint(codePoint) : '';
    })
    .replace(/&#(\d+);/g, (_match, dec) => {
      const codePoint = Number.parseInt(dec, 10);
      return Number.isFinite(codePoint) ? String.fromCodePoint(codePoint) : '';
    });
}
