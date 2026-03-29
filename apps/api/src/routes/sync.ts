import { Hono } from 'hono';
import type { Env } from '../index';
import { createSupabase } from '../lib/supabase';
import {
  getUserProfile,
  getRecentAcceptedSubmissions,
  getQuestionData,
} from '../lib/leetcode';
import { computeCardStats, getAlgoTier } from '../lib/cards';
import { TAG_TO_ELEMENT } from '@leetarena/types';

export const syncRoutes = new Hono<{ Bindings: Env }>();

/** Manual sync trigger (rate-limited via Upstash Redis) */
syncRoutes.post('/trigger/:userId', async (c) => {
  const userId = c.req.param('userId');
  const db = createSupabase(c.env.SUPABASE_URL, c.env.SUPABASE_SERVICE_ROLE_KEY);

  // Fetch user
  const users = await (await db.from('users')).select('*', { id: `eq.${userId}` });
  const user = Array.isArray(users) ? users[0] : null;

  if (!user || !user.leetcode_username) {
    return c.json({ error: 'No LeetCode username set' }, 400);
  }

  // Rate limit: once per hour (simplified — in prod use Upstash Redis)
  const syncStates = await (await db.from('leetcode_sync')).select('*', {
    user_id: `eq.${userId}`,
  });
  const syncState = Array.isArray(syncStates) ? syncStates[0] : null;

  if (syncState) {
    const lastSync = new Date(syncState.last_synced_at).getTime();
    const oneHour = 60 * 60 * 1000;
    if (Date.now() - lastSync < oneHour) {
      return c.json({ error: 'Rate limited. Try again in an hour.' }, 429);
    }
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

  let synced = 0;

  for (const sub of newSubs) {
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
    await (await db.from('cards')).upsert({
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

    // Update user_cards tier if they own this card
    // Proven = any solve, Mastered = runtime top 20%
    const newTier = 'proven'; // runtime percentile not available in basic sync
    const userCards = await (await db.from('user_cards')).select('*', {
      user_id: `eq.${userId}`,
      'card_id->>title_slug': `eq.${sub.titleSlug}`,
    });

    // Update algorithm card XP
    for (const tag of tags) {
      const element = TAG_TO_ELEMENT[tag];
      if (!element) continue;

      const xpGain = questionData.difficulty === 'Easy' ? 1
        : questionData.difficulty === 'Medium' ? 2 : 4;

      // Upsert algo card solve count
      await (await db.from('algorithm_cards')).upsert({
        slug: tag,
        name: tag.replace(/-/g, ' '),
        user_id: userId,
        solve_count: xpGain, // Will be summed server-side in prod via RPC
        tier: 'learned',
      });
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

  return { synced, newSubmissions: newSubs.length };
}
