import { Hono } from 'hono';
import type { Env } from '../index';
import { createSupabase } from '../lib/supabase';
import { getAuthenticatedUser, isOwner } from '../lib/auth';
import {
  getUserProfile,
  getRecentAcceptedSubmissions,
  getQuestionData,
} from '../lib/leetcode';
import { computeCardStats, getAlgoTier } from '../lib/cards';
import { TAG_TO_ELEMENT } from '@leetarena/types';

export const syncRoutes = new Hono<{ Bindings: Env }>();

/** Manual sync trigger */
syncRoutes.post('/trigger/:userId', async (c) => {
  const userId = c.req.param('userId');

  const authUser = await getAuthenticatedUser(c);
  if (!authUser) return c.json({ error: 'Unauthorized' }, 401);
  if (!isOwner(authUser, userId)) return c.json({ error: 'Forbidden' }, 403);

  const db = createSupabase(c.env.SUPABASE_URL, c.env.SUPABASE_SERVICE_ROLE_KEY);

  // Fetch user
  const users = await (await db.from('users')).select('*', { id: `eq.${userId}` });
  const user = Array.isArray(users) ? users[0] : null;

  if (!user || !user.leetcode_username) {
    return c.json({ error: 'No LeetCode username set' }, 400);
  }

  const result = await performSync(userId, user.leetcode_username, db);
  return c.json(result);
});

/** Verify a LeetCode username exists */
syncRoutes.get('/verify/:username', async (c) => {
  const username = c.req.param('username');
  const profile = await getUserProfile(username);
  if (!profile) {
    return c.json({ valid: false });
  }
  return c.json({ valid: true, username: profile.username });
});

/** Internal sync logic — also called by the daily cron */
export async function performSync(
  userId: string,
  leetcodeUsername: string,
  db: Awaited<ReturnType<typeof createSupabase>>
) {
  const profile = await getUserProfile(leetcodeUsername);
  if (!profile) return { error: 'LeetCode user not found', synced: 0 };

  const submissions = await getRecentAcceptedSubmissions(leetcodeUsername, 50);

  // Get existing sync state
  const states = await (await db.from('leetcode_sync')).select('*', {
    user_id: `eq.${userId}`,
  });
  const state = Array.isArray(states) ? states[0] : null;
  const lastSubmissionId = state?.last_submission_id ?? '0';

  // Filter to new submissions only
  const newSubs = submissions.filter(
    (s) => parseInt(s.id) > parseInt(lastSubmissionId)
  );

  // Keep only the latest submission per problem slug to avoid duplicate work.
  const uniqueNewSubsMap = new Map<string, (typeof newSubs)[number]>();
  for (const sub of [...newSubs].sort((a, b) => parseInt(b.id) - parseInt(a.id))) {
    if (!uniqueNewSubsMap.has(sub.titleSlug)) {
      uniqueNewSubsMap.set(sub.titleSlug, sub);
    }
  }
  const uniqueNewSubs = Array.from(uniqueNewSubsMap.values());

  let synced = 0;
  let unlocked = 0;
  let upgraded = 0;

  for (const sub of uniqueNewSubs) {
    const questionData = await getQuestionData(sub.titleSlug);
    if (!questionData) continue;

    const tags = questionData.topicTags.map((t) => t.slug);
    const stats = computeCardStats({
      titleSlug: sub.titleSlug,
      difficulty: questionData.difficulty,
      acRate: questionData.acRate / 100,
      tags,
    });

    // Upsert the card into the global cards table
    const upsertedCards = await (await db.from('cards')).upsert<Array<{ id: string }>>({
      title_slug: sub.titleSlug,
      title: questionData.title,
      difficulty: questionData.difficulty,
      acceptance_rate: questionData.acRate / 100,
      element_type: stats.elementType,
      base_atk: stats.baseAtk,
      base_def: stats.baseDef,
      base_hp: stats.baseHp,
      rarity: stats.rarity,
      is_blind75: stats.isBlind75,
      tags,
    });

    // Unlock card into collection on first solve; otherwise promote base/locked to proven.
    const newTier = 'proven'; // runtime percentile not available in basic sync
    let cardId = upsertedCards[0]?.id;

    if (!cardId) {
      const cards = await (await db.from('cards')).select<Array<{ id: string }>>('id', {
        title_slug: `eq.${sub.titleSlug}`,
      });
      cardId = cards[0]?.id;
    }

    if (cardId) {
      const userCards = await (await db.from('user_cards')).select<Array<{ id: string; tier: string }>>(
        'id,tier',
        {
      user_id: `eq.${userId}`,
          card_id: `eq.${cardId}`,
        }
      );

      const existingUserCard = userCards[0];
      if (!existingUserCard) {
        await (await db.from('user_cards')).insert({
          user_id: userId,
          card_id: cardId,
          tier: newTier,
          obtained_at: new Date().toISOString(),
        });
        unlocked++;
      } else if (existingUserCard.tier === 'locked' || existingUserCard.tier === 'base') {
        await (await db.from('user_cards')).update(
          { tier: newTier },
          { id: `eq.${existingUserCard.id}` }
        );
        upgraded++;
      }
    }

    // Update algorithm card XP
    for (const tag of new Set(tags)) {
      const element = TAG_TO_ELEMENT[tag];
      if (!element) continue;

      const xpGain = questionData.difficulty === 'Easy' ? 1
        : questionData.difficulty === 'Medium' ? 2 : 4;

      const existingAlgoCards = await (await db.from('algorithm_cards')).select<Array<{
        id: string;
        solve_count: number;
      }>>('id,solve_count', {
        user_id: `eq.${userId}`,
        slug: `eq.${tag}`,
      });

      const existingAlgo = existingAlgoCards[0];
      if (existingAlgo) {
        const nextSolveCount = Number(existingAlgo.solve_count ?? 0) + xpGain;
        await (await db.from('algorithm_cards')).update(
          {
            solve_count: nextSolveCount,
            tier: getAlgoTier(nextSolveCount),
          },
          { id: `eq.${existingAlgo.id}` }
        );
      } else {
        await (await db.from('algorithm_cards')).insert({
          slug: tag,
          name: tag.replace(/-/g, ' '),
          user_id: userId,
          solve_count: xpGain,
          tier: getAlgoTier(xpGain),
        });
      }
    }

    synced++;
  }

  // Update sync state
  const latestId = submissions[0]?.id ?? lastSubmissionId;
  await (await db.from('leetcode_sync')).upsert({
    user_id: userId,
    last_synced_at: new Date().toISOString(),
    last_submission_id: latestId,
  });

  return {
    synced,
    newSubmissions: newSubs.length,
    uniqueProblems: uniqueNewSubs.length,
    unlocked,
    upgraded,
  };
}
