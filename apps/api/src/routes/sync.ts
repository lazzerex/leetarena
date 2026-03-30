import { Hono } from 'hono';
import type { Env } from '../index';
import { createSupabase } from '../lib/supabase';
import { getAuthenticatedUser, isOwner } from '../lib/auth';
import { getSyncFeatureFlags, type SyncFeatureFlags } from '../lib/feature-flags';
import {
  getUserProfile,
  getRecentAcceptedSubmissions,
  getQuestionData,
} from '../lib/leetcode';
import { computeCardStats, getAlgoTier } from '../lib/cards';
import { TAG_TO_ELEMENT } from '@leetarena/types';

export const syncRoutes = new Hono<{ Bindings: Env }>();

type CardTier = 'locked' | 'base' | 'proven' | 'mastered';
type CatalogType = 'core' | 'extended';

const CORE_SYNC_TARGET_TIER: CardTier = 'proven';

const TIER_RANK: Record<CardTier, number> = {
  locked: 0,
  base: 1,
  proven: 2,
  mastered: 3,
};

/** Manual sync trigger */
syncRoutes.post('/trigger/:userId', async (c) => {
  const userId = c.req.param('userId');
  const syncFlags = getSyncFeatureFlags(c.env);

  if (!syncFlags.syncEnabled) {
    return c.json({ error: 'LeetCode sync is disabled by server configuration' }, 403);
  }

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

  const result = await performSync(userId, user.leetcode_username, db, syncFlags);
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
  db: Awaited<ReturnType<typeof createSupabase>>,
  syncFlags: SyncFeatureFlags = { syncEnabled: true, extendedCatalogEnabled: false }
) {
  if (!syncFlags.syncEnabled) {
    return {
      synced: 0,
      newSubmissions: 0,
      uniqueProblems: 0,
      unlocked: 0,
      upgraded: 0,
      skippedOutOfCatalog: 0,
      skippedNoMetadata: 0,
      extendedCatalogEnabled: syncFlags.extendedCatalogEnabled,
      message: 'LeetCode sync is disabled by server configuration',
    };
  }

  const profile = await getUserProfile(leetcodeUsername);
  if (!profile) return { error: 'LeetCode user not found', synced: 0 };

  const submissions = await getRecentAcceptedSubmissions(leetcodeUsername, 50);

  // Get existing sync state
  const states = await (await db.from('leetcode_sync')).select('*', {
    user_id: `eq.${userId}`,
  });
  const state = Array.isArray(states) ? states[0] : null;
  const lastSubmissionId = state?.last_submission_id ?? '0';
  const pendingXpBySlug = normalizePendingXpMap(state?.pending_xp);

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
  let skippedOutOfCatalog = 0;
  let skippedNoMetadata = 0;

  for (const sub of uniqueNewSubs) {
    const existingCards = await (await db.from('cards')).select<Array<{
      id: string;
      catalog_type?: CatalogType;
      is_seeded_core?: boolean;
    }>>('id,catalog_type,is_seeded_core', {
      title_slug: `eq.${sub.titleSlug}`,
    });

    const existingCard = existingCards[0];
    let cardId = existingCard?.id;

    // Guard against legacy rows that were auto-defaulted to core during schema rollout.
    if (existingCard?.catalog_type === 'core' && !existingCard?.is_seeded_core) {
      await (await db.from('cards')).update(
        { catalog_type: 'extended' },
        { id: `eq.${existingCard.id}` }
      );
    }

    let catalogType: CatalogType = existingCard?.catalog_type === 'extended'
      ? 'extended'
      : existingCard?.is_seeded_core
        ? 'core'
        : 'extended';

    if (!cardId && !syncFlags.extendedCatalogEnabled) {
      skippedOutOfCatalog++;
      continue;
    }

    if (catalogType === 'extended' && !syncFlags.extendedCatalogEnabled) {
      skippedOutOfCatalog++;
      continue;
    }

    const questionData = await getQuestionData(sub.titleSlug);
    const tags = questionData?.topicTags.map((t) => t.slug) ?? [];

    if (!cardId) {
      if (!questionData) {
        skippedNoMetadata++;
        continue;
      }

      const stats = computeCardStats({
        titleSlug: sub.titleSlug,
        difficulty: questionData.difficulty,
        acRate: questionData.acRate / 100,
        tags,
      });

      const upsertedCards = await (await db.from('cards')).upsert<Array<{ id: string }>>({
        title_slug: sub.titleSlug,
        catalog_type: 'extended',
        is_seeded_core: false,
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

      cardId = upsertedCards[0]?.id;
      if (!cardId) {
        const cards = await (await db.from('cards')).select<Array<{ id: string }>>('id', {
          title_slug: `eq.${sub.titleSlug}`,
        });
        cardId = cards[0]?.id;
      }

      catalogType = 'extended';
    }

    if (!cardId) {
      continue;
    }

    const nextTier =
      catalogType === 'core'
        ? CORE_SYNC_TARGET_TIER
        : getTierForExtendedSolveCount(
          incrementSolveCounter(pendingXpBySlug, sub.titleSlug)
        );

    const userCards = await (await db.from('user_cards')).select<Array<{ id: string; tier: CardTier }>>(
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
        tier: nextTier,
        obtained_at: new Date().toISOString(),
      });
      unlocked++;
    } else if (shouldUpgradeTier(existingUserCard.tier, nextTier)) {
      await (await db.from('user_cards')).update(
        { tier: nextTier },
        { id: `eq.${existingUserCard.id}` }
      );
      upgraded++;
    }

    // Update algorithm card XP
    const difficultyForXp = questionData?.difficulty ?? 'Medium';
    for (const tag of new Set(tags)) {
      const element = TAG_TO_ELEMENT[tag];
      if (!element) continue;

      const xpGain = difficultyForXp === 'Easy' ? 1
        : difficultyForXp === 'Medium' ? 2 : 4;

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
    pending_xp: pendingXpBySlug,
  });

  return {
    synced,
    newSubmissions: newSubs.length,
    uniqueProblems: uniqueNewSubs.length,
    unlocked,
    upgraded,
    skippedOutOfCatalog,
    skippedNoMetadata,
    extendedCatalogEnabled: syncFlags.extendedCatalogEnabled,
  };
}

function shouldUpgradeTier(currentTier: CardTier, targetTier: CardTier): boolean {
  return TIER_RANK[targetTier] > TIER_RANK[currentTier];
}

function getTierForExtendedSolveCount(solveCount: number): CardTier {
  if (solveCount >= 4) return 'mastered';
  if (solveCount >= 2) return 'proven';
  return 'base';
}

function normalizePendingXpMap(value: unknown): Record<string, number> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }

  const normalized: Record<string, number> = {};
  for (const [key, rawValue] of Object.entries(value as Record<string, unknown>)) {
    const asNumber = Number(rawValue);
    if (Number.isFinite(asNumber) && asNumber > 0) {
      normalized[key] = Math.floor(asNumber);
    }
  }

  return normalized;
}

function incrementSolveCounter(counterBySlug: Record<string, number>, titleSlug: string): number {
  const next = (counterBySlug[titleSlug] ?? 0) + 1;
  counterBySlug[titleSlug] = next;
  return next;
}
