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
