import { Hono } from 'hono';
import { z } from 'zod';
import type { Env } from '../index';
import { createSupabase } from '../lib/supabase';
import { getAuthenticatedUser, isOwner } from '../lib/auth';
import { getPackFeatureFlags } from '../lib/feature-flags';
import { rollPackRarities } from '../lib/rng';
import { ensureCoreCollectionInitialized } from '../lib/core-collection';
import type { AlgorithmCardDefinition, PackType, Rarity } from '@leetarena/types';
import { ALGORITHM_CARD_CATALOG, PACK_COSTS } from '@leetarena/types';

export const packRoutes = new Hono<{ Bindings: Env }>();

type CardTier = 'locked' | 'base' | 'proven' | 'mastered';

const CORE_DUPLICATES_TO_PROVEN = 5;
const CORE_DUPLICATES_TO_MASTERED = 20;
const ALGORITHM_DUPLICATE_COMPENSATION_COINS = 80;

const ALGORITHM_REWARDS_PER_PACK: Record<PackType, number> = {
  daily: 1,
  topic: 1,
  blind75: 2,
  contest: 1,
  company: 2,
};

type AlgorithmPackReward = {
  id: string;
  slug: string;
  name: string;
  description: string;
  abilityName: string;
  abilityDescription: string;
  mode: 'trap' | 'effect';
  themeTemplate: string;
  themeTokens: {
    surface: string;
    border: string;
    accent: string;
    chip: string;
    text: string;
    glow: string;
  };
  isNew: boolean;
};

const OpenPackSchema = z.object({
  userId: z.string().uuid(),
  packType: z.enum(['daily', 'topic', 'blind75', 'contest', 'company']),
  elementFilter: z.string().optional(), // for topic packs
  includeExtendedPool: z.boolean().optional(),
});

packRoutes.post('/open', async (c) => {
  const body = await c.req.json();
  const parsed = OpenPackSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400);

  const { userId, packType, elementFilter, includeExtendedPool } = parsed.data;

  const authUser = await getAuthenticatedUser(c);
  if (!authUser) return c.json({ error: 'Unauthorized' }, 401);
  if (!isOwner(authUser, userId)) return c.json({ error: 'Forbidden' }, 403);

  const { varietyModeEnabled } = getPackFeatureFlags(c.env);
  const useExtendedPool = varietyModeEnabled && includeExtendedPool === true;

  const db = createSupabase(c.env.SUPABASE_URL, c.env.SUPABASE_SERVICE_ROLE_KEY);

  // Fetch user
  const users = (await (await db.from('users')).select('*', { id: `eq.${userId}` })) as any[];
  const user = users[0];
  if (!user) return c.json({ error: 'User not found' }, 404);

  await ensureCoreCollectionInitialized(userId, db);

  // Cost check
  const cost = PACK_COSTS[packType];
  const costAmount = typeof cost === 'number' ? cost : 0;
  if (costAmount > 0 && user.coins < costAmount) {
    return c.json({ error: 'Insufficient coins' }, 402);
  }

  // Daily pack cooldown check
  if (packType === 'daily') {
    const packs = (await (await db.from('packs')).select('*', {
      user_id: `eq.${userId}`,
      pack_type: `eq.daily`,
    })) as any[];
    const lastDaily = packs.sort(
      (a: any, b: any) => new Date(b.opened_at).getTime() - new Date(a.opened_at).getTime()
    )[0];
    if (lastDaily) {
      const hoursSince =
        (Date.now() - new Date(lastDaily.opened_at).getTime()) / (1000 * 60 * 60);
      if (hoursSince < 24) {
        return c.json({ error: 'Daily pack already opened today', nextAt: getNextMidnight() }, 429);
      }
    }
  }

  // Pity counter
  const syncStates = (await (await db.from('leetcode_sync')).select('*', {
    user_id: `eq.${userId}`,
  })) as any[];
  const packsSinceLegendary: number = syncStates[0]?.packs_since_legendary ?? 0;

  // Roll rarities
  const rarities = rollPackRarities(packType as PackType, packsSinceLegendary);
  const hasLegendary = rarities.includes('legendary');

  // Pick cards for each rarity slot
  const cardIds: string[] = [];
  const missingRarities: Rarity[] = [];
  for (const rarity of rarities) {
    const card = await pickCardForRarity(
      rarity,
      userId,
      packType as PackType,
      elementFilter,
      useExtendedPool,
      db
    );
    if (!card) {
      missingRarities.push(rarity);
      continue;
    }
    cardIds.push(card.id);
  }

  if (missingRarities.length > 0) {
    return c.json(
      {
        error: 'No valid card pool available for this pack configuration',
        missingRarities,
      },
      409
    );
  }

  const algorithmRewards = await drawAlgorithmRewards(userId, packType as PackType, db);

  // Deduct coins and compensate algorithm duplicates in one update.
  const finalCoins = user.coins - costAmount + algorithmRewards.duplicateCompensationCoins;
  if (costAmount > 0 || algorithmRewards.duplicateCompensationCoins > 0) {
    await (await db.from('users')).update(
      { coins: finalCoins },
      { id: `eq.${userId}` }
    );
  }

  // Update pity counter
  const newPity = hasLegendary ? 0 : packsSinceLegendary + 1;
  await (await db.from('leetcode_sync')).upsert({
    user_id: userId,
    packs_since_legendary: newPity,
  });

  // Record pack
  await (await db.from('packs')).insert({
    user_id: userId,
    pack_type: packType,
    cards_received: cardIds,
    opened_at: new Date().toISOString(),
  });

  // Return full card data for animation
  const cards = (await (await db.from('cards')).select('*', {
    id: `in.(${cardIds.join(',')})`,
  })) as any[];

  await grantPackCardsToCollection(userId, cardIds, cards, db);

  return c.json({
    cards,
    algorithmCards: algorithmRewards.rewards,
    rarities,
    coinsSpent: costAmount,
    duplicateCompensationCoins: algorithmRewards.duplicateCompensationCoins,
    usedExtendedPool: useExtendedPool,
  });
});

function pickAlgorithmDefinitionsForPack(packType: PackType): AlgorithmCardDefinition[] {
  const count = Math.max(1, ALGORITHM_REWARDS_PER_PACK[packType] ?? 1);
  const shuffled = [...ALGORITHM_CARD_CATALOG].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, Math.min(count, shuffled.length));
}

async function drawAlgorithmRewards(
  userId: string,
  packType: PackType,
  db: any
): Promise<{ rewards: AlgorithmPackReward[]; duplicateCompensationCoins: number }> {
  const rewards: AlgorithmPackReward[] = [];
  let duplicateCompensationCoins = 0;

  const selectedDefinitions = pickAlgorithmDefinitionsForPack(packType);
  if (selectedDefinitions.length === 0) {
    return { rewards, duplicateCompensationCoins };
  }

  const existingAlgoRows = await (await db.from('algorithm_cards')).select('id,slug,name', {
    user_id: `eq.${userId}`,
  }) as Array<{ id: string; slug: string; name: string }>;

  const existingBySlug = new Map(existingAlgoRows.map((row) => [row.slug, row]));

  for (const definition of selectedDefinitions) {
    const existing = existingBySlug.get(definition.slug);
    if (existing) {
      duplicateCompensationCoins += ALGORITHM_DUPLICATE_COMPENSATION_COINS;
      rewards.push({
        id: existing.id,
        slug: definition.slug,
        name: existing.name || definition.name,
        description: definition.description,
        abilityName: definition.abilityName,
        abilityDescription: definition.abilityDescription,
        mode: definition.mode,
        themeTemplate: definition.themeTemplate,
        themeTokens: definition.themeTokens,
        isNew: false,
      });
      continue;
    }

    let algorithmCardId: string | undefined;
    try {
      const inserted = await (await db.from('algorithm_cards')).insert<Array<{ id: string }>>({
        user_id: userId,
        slug: definition.slug,
        name: definition.name,
        tier: 'learned',
        solve_count: 0,
      });
      algorithmCardId = inserted[0]?.id;
    } catch {
      // If a concurrent request inserted this card first, fall back to fetch.
      algorithmCardId = undefined;
    }

    if (!algorithmCardId) {
      const rows = await (await db.from('algorithm_cards')).select<Array<{ id: string }>>('id', {
        user_id: `eq.${userId}`,
        slug: `eq.${definition.slug}`,
      });
      algorithmCardId = rows[0]?.id;
    }

    if (!algorithmCardId) {
      continue;
    }

    existingBySlug.set(definition.slug, {
      id: algorithmCardId,
      slug: definition.slug,
      name: definition.name,
    });

    rewards.push({
      id: algorithmCardId,
      slug: definition.slug,
      name: definition.name,
      description: definition.description,
      abilityName: definition.abilityName,
      abilityDescription: definition.abilityDescription,
      mode: definition.mode,
      themeTemplate: definition.themeTemplate,
      themeTokens: definition.themeTokens,
      isNew: true,
    });
  }

  return { rewards, duplicateCompensationCoins };
}

async function pickCardForRarity(
  rarity: Rarity,
  userId: string,
  packType: PackType,
  elementFilter: string | undefined,
  includeExtendedPool: boolean,
  db: any
): Promise<{ id: string } | null> {
  const filters: Record<string, string> = { rarity: `eq.${rarity}` };
  if (!includeExtendedPool) {
    filters['catalog_type'] = 'eq.core';
    filters['is_seeded_core'] = 'eq.true';
  }
  if (elementFilter) filters['element_type'] = `eq.${elementFilter}`;
  if (packType === 'blind75') filters['is_blind75'] = 'eq.true';

  const cards = (await (await db.from('cards')).select('id', filters)) as any[];
  if (!cards.length) return null;

  // Prefer cards the user doesn't own yet
  const owned = (await (await db.from('user_cards')).select('card_id,tier', {
    user_id: `eq.${userId}`,
  })) as any[];
  const ownedUnlockedIds = new Set(
    owned
      .filter((row: any) => row.tier !== 'locked')
      .map((row: any) => row.card_id)
  );
  const unowned = cards.filter((c: any) => !ownedUnlockedIds.has(c.id));

  const pool = unowned.length > 0 ? unowned : cards;
  return pool[Math.floor(Math.random() * pool.length)] ?? null;
}

function getNextMidnight(): string {
  const d = new Date();
  d.setUTCHours(24, 0, 0, 0);
  return d.toISOString();
}

function getCoreTierByDuplicateCount(currentTier: CardTier, duplicateCount: number): CardTier {
  if (currentTier === 'mastered') return 'mastered';
  if (duplicateCount >= CORE_DUPLICATES_TO_MASTERED) return 'mastered';
  if (duplicateCount >= CORE_DUPLICATES_TO_PROVEN) return 'proven';
  return currentTier;
}

async function grantPackCardsToCollection(
  userId: string,
  cardIds: string[],
  cards: Array<{ id: string; catalog_type?: string; is_seeded_core?: boolean }>,
  db: any
) {
  if (cardIds.length === 0) return;

  const existingRows = await (await db.from('user_cards')).select('id,card_id,tier,duplicate_count', {
    user_id: `eq.${userId}`,
    card_id: `in.(${cardIds.join(',')})`,
  }) as Array<{
    id: string;
    card_id: string;
    tier: CardTier;
    duplicate_count?: number;
  }>;

  const existingByCardId = new Map(existingRows.map((row) => [row.card_id, row]));
  const cardMetaById = new Map(cards.map((card) => [card.id, card]));

  for (const cardId of cardIds) {
    const existing = existingByCardId.get(cardId);
    const cardMeta = cardMetaById.get(cardId);

    if (!existing) {
      await (await db.from('user_cards')).insert({
        user_id: userId,
        card_id: cardId,
        tier: 'base',
        duplicate_count: 0,
        obtained_at: new Date().toISOString(),
      });
      continue;
    }

    if (existing.tier === 'locked') {
      await (await db.from('user_cards')).update(
        {
          tier: 'base',
          obtained_at: new Date().toISOString(),
        },
        { id: `eq.${existing.id}` }
      );
      continue;
    }

    const isSeededCore = cardMeta?.catalog_type === 'core' && Boolean(cardMeta?.is_seeded_core);
    if (!isSeededCore) {
      continue;
    }

    const nextDuplicateCount = Number(existing.duplicate_count ?? 0) + 1;
    const nextTier = getCoreTierByDuplicateCount(existing.tier, nextDuplicateCount);

    await (await db.from('user_cards')).update(
      {
        duplicate_count: nextDuplicateCount,
        tier: nextTier,
      },
      { id: `eq.${existing.id}` }
    );
  }
}
