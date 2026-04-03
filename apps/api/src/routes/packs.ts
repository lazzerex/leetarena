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

const CORE_DUPLICATES_TO_MASTERED = 20;
const ALGORITHM_DUPLICATE_COMPENSATION_COINS = 80;
const BEGINNER_CORE_REWARD_COUNT = 20;
const BEGINNER_ALGORITHM_REWARD_COUNT = 5;
const BEGINNER_PACK_FALLBACK_KEY = '__beginner_pack_claimed_at';

const ALGORITHM_REWARDS_PER_PACK: Record<PackType, number> = {
  daily: 1,
  core: 0,
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

type ProblemPackReward = {
  cardId: string;
  tier: CardTier;
  isNew: boolean;
  duplicateCount: number;
};

type PackCandidateCard = {
  id: string;
  rarity: Rarity;
};

const OpenPackSchema = z.object({
  userId: z.string().uuid(),
  packType: z.enum(['daily', 'core', 'topic', 'blind75', 'contest', 'company']),
  elementFilter: z.string().optional(), // for topic packs
  includeExtendedPool: z.boolean().optional(),
});

const ClaimBeginnerPackSchema = z.object({
  userId: z.string().uuid(),
});

type BeginnerCoreReward = {
  id: string;
  titleSlug: string;
  title: string;
  rarity: string;
  elementType: string;
  baseAtk: number;
  baseDef: number;
  baseHp: number;
  isBlind75: boolean;
  isNew: boolean;
};

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

  const baseFilters = buildPackBaseFilters(
    packType as PackType,
    elementFilter,
    useExtendedPool
  );

  const candidateCards = await fetchPackCandidates(baseFilters, db);
  if (!candidateCards.length) {
    return c.json(
      {
        error: 'No valid card pool available for this pack configuration',
      },
      409
    );
  }

  // Pity counter
  const syncStates = (await (await db.from('leetcode_sync')).select('*', {
    user_id: `eq.${userId}`,
  })) as any[];
  const packsSinceLegendary: number = syncStates[0]?.packs_since_legendary ?? 0;

  // Roll rarities and resolve them against currently available pool rarities.
  const availableRarities = getAvailableRarities(candidateCards);
  const rolledRarities = rollPackRarities(packType as PackType, packsSinceLegendary);
  const rarities = rolledRarities.map((requested) =>
    resolvePackSlotRarity(requested, availableRarities)
  );

  // Prefer cards the user doesn't own yet; avoid in-pack duplicates until pool pressure forces repeats.
  const owned = (await (await db.from('user_cards')).select('card_id,tier', {
    user_id: `eq.${userId}`,
  })) as any[];
  const ownedUnlockedIds = new Set(
    owned
      .filter((row: any) => row.tier !== 'locked')
      .map((row: any) => row.card_id)
  );

  const cardIds: string[] = [];
  const selectedInPackIds = new Set<string>();
  for (const rarity of rarities) {
    const cardId = pickCardIdForRaritySlot(
      rarity,
      candidateCards,
      ownedUnlockedIds,
      selectedInPackIds
    );
    if (!cardId) {
      return c.json(
        {
          error: 'No valid card pool available for this pack configuration',
        },
        409
      );
    }
    cardIds.push(cardId);
    selectedInPackIds.add(cardId);
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

  // Fetch full card data for animation and pity tracking.
  // Preserve slot order and duplicates from cardIds for reliable reveal UX.
  const uniqueCardIds = Array.from(new Set(cardIds));
  const fetchedCards = (await (await db.from('cards')).select('*', {
    id: `in.(${uniqueCardIds.join(',')})`,
  })) as any[];
  const cardById = new Map(fetchedCards.map((card: any) => [card.id, card]));
  const cards = cardIds
    .map((cardId) => cardById.get(cardId))
    .filter((card): card is any => Boolean(card));

  if (cards.length !== cardIds.length) {
    return c.json({ error: 'Pack card lookup failed' }, 500);
  }

  const hasLegendaryAwarded = cards.some((card: any) => card.rarity === 'legendary');

  // Update pity counter
  const newPity = hasLegendaryAwarded ? 0 : packsSinceLegendary + 1;
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

  const problemRewardByCardId = await grantPackCardsToCollection(userId, cardIds, cards, db);
  const cardRewards: ProblemPackReward[] = cardIds.map((cardId) => {
    const reward = problemRewardByCardId.get(cardId);
    return {
      cardId,
      tier: reward?.tier ?? 'base',
      isNew: reward?.isNew ?? false,
      duplicateCount: reward?.duplicateCount ?? 0,
    };
  });

  return c.json({
    cards,
    cardRewards,
    algorithmCards: algorithmRewards.rewards,
    rarities,
    rolledRarities,
    coinsSpent: costAmount,
    duplicateCompensationCoins: algorithmRewards.duplicateCompensationCoins,
    usedExtendedPool: useExtendedPool,
  });
});

packRoutes.get('/beginner/status/:userId', async (c) => {
  const userId = c.req.param('userId');

  const authUser = await getAuthenticatedUser(c);
  if (!authUser) return c.json({ error: 'Unauthorized' }, 401);
  if (!isOwner(authUser, userId)) return c.json({ error: 'Forbidden' }, 403);

  const db = createSupabase(c.env.SUPABASE_URL, c.env.SUPABASE_SERVICE_ROLE_KEY);
  const claimStatus = await resolveBeginnerClaimStatus(userId, db);

  if (!claimStatus.userExists) {
    return c.json({ error: 'User not found' }, 404);
  }

  return c.json({
    claimable: !claimStatus.claimedAt,
    claimedAt: claimStatus.claimedAt,
    rewardSpec: {
      coreCards: BEGINNER_CORE_REWARD_COUNT,
      algorithmCards: BEGINNER_ALGORITHM_REWARD_COUNT,
      solveOnlyCoreUnlock: false,
      storageMode: claimStatus.storage,
    },
  });
});

packRoutes.post('/claim-beginner', async (c) => {
  const body = await c.req.json();
  const parsed = ClaimBeginnerPackSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400);

  const { userId } = parsed.data;

  const authUser = await getAuthenticatedUser(c);
  if (!authUser) return c.json({ error: 'Unauthorized' }, 401);
  if (!isOwner(authUser, userId)) return c.json({ error: 'Forbidden' }, 403);

  const db = createSupabase(c.env.SUPABASE_URL, c.env.SUPABASE_SERVICE_ROLE_KEY);

  const claimStatus = await resolveBeginnerClaimStatus(userId, db);
  if (!claimStatus.userExists) return c.json({ error: 'User not found' }, 404);
  if (claimStatus.claimedAt) {
    return c.json({ error: 'Beginner pack already claimed' }, 409);
  }

  await ensureCoreCollectionInitialized(userId, db);

  const claimTimestamp = new Date().toISOString();
  if (claimStatus.storage === 'users-column') {
    const lockRows = await (await db.from('users')).update(
      { beginner_pack_claimed_at: claimTimestamp },
      {
        id: `eq.${userId}`,
        beginner_pack_claimed_at: 'is.null',
      }
    ) as Array<{ id: string }>;

    if (!Array.isArray(lockRows) || lockRows.length === 0) {
      return c.json({ error: 'Beginner pack already claimed' }, 409);
    }
  } else {
    const lockApplied = await tryApplyBeginnerFallbackLock(userId, claimTimestamp, db);
    if (!lockApplied) {
      return c.json({ error: 'Beginner pack already claimed' }, 409);
    }
  }

  try {
    const coreCards = await grantBeginnerCoreRewards(userId, db);
    const algorithmCards = await grantBeginnerAlgorithmRewards(userId, db);

    return c.json({
      claimedAt: claimTimestamp,
      coreCards,
      algorithmCards,
      coreCardCount: coreCards.length,
      algorithmCardCount: algorithmCards.length,
    });
  } catch (error) {
    if (claimStatus.storage === 'users-column') {
      await (await db.from('users')).update(
        { beginner_pack_claimed_at: null },
        {
          id: `eq.${userId}`,
          beginner_pack_claimed_at: `eq.${claimTimestamp}`,
        }
      );
    } else {
      await rollbackBeginnerFallbackLock(userId, claimTimestamp, db);
    }
    throw error;
  }
});

async function resolveBeginnerClaimStatus(
  userId: string,
  db: any
): Promise<{ userExists: boolean; claimedAt: string | null; storage: 'users-column' | 'sync-fallback' }> {
  try {
    const users = await (await db.from('users')).select<Array<{
      id: string;
      beginner_pack_claimed_at?: string | null;
    }>>('id,beginner_pack_claimed_at', {
      id: `eq.${userId}`,
    });

    const user = users[0];
    if (!user) return { userExists: false, claimedAt: null, storage: 'users-column' };

    return {
      userExists: true,
      claimedAt: user.beginner_pack_claimed_at ?? null,
      storage: 'users-column',
    };
  } catch (error: any) {
    if (!isMissingBeginnerPackColumnError(error)) {
      throw error;
    }

    const users = await (await db.from('users')).select<Array<{ id: string }>>('id', {
      id: `eq.${userId}`,
    });
    if (!users[0]) return { userExists: false, claimedAt: null, storage: 'sync-fallback' };

    const stateRows = await (await db.from('leetcode_sync')).select<Array<{ pending_xp?: unknown }>>(
      'pending_xp',
      { user_id: `eq.${userId}` }
    );
    const markerValue = readBeginnerFallbackMarker(stateRows[0]?.pending_xp);

    return {
      userExists: true,
      claimedAt: markerValue,
      storage: 'sync-fallback',
    };
  }
}

function isMissingBeginnerPackColumnError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error ?? '');
  const normalized = message.toLowerCase();
  return normalized.includes('beginner_pack_claimed_at') && normalized.includes('column');
}

function readBeginnerFallbackMarker(pendingXp: unknown): string | null {
  if (!pendingXp || typeof pendingXp !== 'object' || Array.isArray(pendingXp)) {
    return null;
  }

  const marker = (pendingXp as Record<string, unknown>)[BEGINNER_PACK_FALLBACK_KEY];
  if (typeof marker !== 'string' || marker.length === 0) return null;
  return marker;
}

function normalizePendingXp(payload: unknown): Record<string, unknown> {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return {};
  }
  return { ...(payload as Record<string, unknown>) };
}

async function tryApplyBeginnerFallbackLock(
  userId: string,
  claimTimestamp: string,
  db: any
): Promise<boolean> {
  const stateRows = await (await db.from('leetcode_sync')).select<Array<{ pending_xp?: unknown }>>(
    'pending_xp',
    { user_id: `eq.${userId}` }
  );

  const pendingXp = normalizePendingXp(stateRows[0]?.pending_xp);
  if (typeof pendingXp[BEGINNER_PACK_FALLBACK_KEY] === 'string') {
    return false;
  }

  pendingXp[BEGINNER_PACK_FALLBACK_KEY] = claimTimestamp;

  await (await db.from('leetcode_sync')).upsert({
    user_id: userId,
    pending_xp: pendingXp,
  });

  return true;
}

async function rollbackBeginnerFallbackLock(
  userId: string,
  claimTimestamp: string,
  db: any
): Promise<void> {
  const stateRows = await (await db.from('leetcode_sync')).select<Array<{ pending_xp?: unknown }>>(
    'pending_xp',
    { user_id: `eq.${userId}` }
  );

  const pendingXp = normalizePendingXp(stateRows[0]?.pending_xp);
  if (pendingXp[BEGINNER_PACK_FALLBACK_KEY] !== claimTimestamp) {
    return;
  }

  delete pendingXp[BEGINNER_PACK_FALLBACK_KEY];

  await (await db.from('leetcode_sync')).upsert({
    user_id: userId,
    pending_xp: pendingXp,
  });
}

function pickAlgorithmDefinitionsForPack(packType: PackType): AlgorithmCardDefinition[] {
  const count = Math.max(0, ALGORITHM_REWARDS_PER_PACK[packType] ?? 1);
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

async function grantBeginnerCoreRewards(
  userId: string,
  db: any
): Promise<BeginnerCoreReward[]> {
  const lockedRows = await (await db.from('user_cards')).select<Array<{
    id: string;
    card_id: string;
    duplicate_count?: number;
    cards?: {
      id?: string;
      title_slug?: string;
      title?: string;
      rarity?: string;
      element_type?: string;
      base_atk?: number;
      base_def?: number;
      base_hp?: number;
      is_blind75?: boolean;
      catalog_type?: string;
      is_seeded_core?: boolean;
    } | Array<{
      id?: string;
      title_slug?: string;
      title?: string;
      rarity?: string;
      element_type?: string;
      base_atk?: number;
      base_def?: number;
      base_hp?: number;
      is_blind75?: boolean;
      catalog_type?: string;
      is_seeded_core?: boolean;
    }>;
  }>>('id,card_id,duplicate_count,cards(id,title_slug,title,rarity,element_type,base_atk,base_def,base_hp,is_blind75,catalog_type,is_seeded_core)', {
    user_id: `eq.${userId}`,
    tier: 'eq.locked',
  });

  const candidates = lockedRows
    .map((row) => {
      const card = readJoinedCard(row.cards);
      if (!card) return null;
      const isSeededCore = card.catalog_type === 'core' && Boolean(card.is_seeded_core);
      if (!isSeededCore || !card.id) return null;
      return {
        id: row.id,
        cardId: row.card_id,
        card,
      };
    })
    .filter((row): row is {
      id: string;
      cardId: string;
      card: {
        id: string;
        title_slug?: string;
        title?: string;
        rarity?: string;
        element_type?: string;
        base_atk?: number;
        base_def?: number;
        base_hp?: number;
        is_blind75?: boolean;
      };
    } => Boolean(row));

  if (candidates.length < BEGINNER_CORE_REWARD_COUNT) {
    throw new Error('Not enough locked seeded core cards to grant beginner rewards');
  }

  const selected = pickBeginnerCoreSelection(candidates, BEGINNER_CORE_REWARD_COUNT);
  const now = new Date().toISOString();

  for (const row of selected) {
    await (await db.from('user_cards')).update(
      {
        tier: 'base',
        obtained_at: now,
      },
      { id: `eq.${row.id}` }
    );
  }

  return selected.map((row) => ({
    id: row.card.id,
    titleSlug: row.card.title_slug ?? '',
    title: row.card.title ?? row.card.title_slug ?? 'Unknown Problem',
    rarity: row.card.rarity ?? 'common',
    elementType: row.card.element_type ?? 'Array',
    baseAtk: Number(row.card.base_atk ?? 0),
    baseDef: Number(row.card.base_def ?? 0),
    baseHp: Number(row.card.base_hp ?? 0),
    isBlind75: Boolean(row.card.is_blind75),
    isNew: true,
  }));
}

function pickBeginnerCoreSelection(
  candidates: Array<{
    id: string;
    cardId: string;
    card: {
      id: string;
      title_slug?: string;
      title?: string;
      rarity?: string;
      element_type?: string;
      base_atk?: number;
      base_def?: number;
      base_hp?: number;
      is_blind75?: boolean;
    };
  }>,
  count: number
): Array<{
  id: string;
  cardId: string;
  card: {
    id: string;
    title_slug?: string;
    title?: string;
    rarity?: string;
    element_type?: string;
    base_atk?: number;
    base_def?: number;
    base_hp?: number;
    is_blind75?: boolean;
  };
}> {
  const shuffled = [...candidates].sort(() => Math.random() - 0.5);
  const selected = shuffled.slice(0, count);

  const hasTwoElements = () => {
    const elements = new Set(selected.map((row) => row.card.element_type ?? 'Array'));
    return elements.size >= 2;
  };

  if (!hasTwoElements() && selected.length > 0) {
    const firstElement = selected[0].card.element_type ?? 'Array';
    const replacement = shuffled.slice(count).find((row) => (row.card.element_type ?? 'Array') !== firstElement);
    if (replacement) {
      selected[selected.length - 1] = replacement;
    }
  }

  if (!hasTwoElements()) {
    throw new Error('Beginner pack selection could not satisfy 2+ element deck-readiness guarantee');
  }

  return selected;
}

async function grantBeginnerAlgorithmRewards(
  userId: string,
  db: any
): Promise<AlgorithmPackReward[]> {
  const existingAlgoRows = await (await db.from('algorithm_cards')).select<Array<{ id: string; slug: string; name: string }>>(
    'id,slug,name',
    { user_id: `eq.${userId}` }
  );

  const existingBySlug = new Map(existingAlgoRows.map((row) => [row.slug, row]));
  const ownedSlugs = new Set(existingBySlug.keys());

  const selectedDefinitions = pickBeginnerAlgorithmDefinitions(ownedSlugs, BEGINNER_ALGORITHM_REWARD_COUNT);
  const rewards: AlgorithmPackReward[] = [];

  for (const definition of selectedDefinitions) {
    const hadBefore = ownedSlugs.has(definition.slug);
    let existing = existingBySlug.get(definition.slug);

    if (!existing) {
      let insertedId: string | undefined;
      try {
        const inserted = await (await db.from('algorithm_cards')).insert<Array<{ id: string }>>({
          user_id: userId,
          slug: definition.slug,
          name: definition.name,
          tier: 'learned',
          solve_count: 0,
        });
        insertedId = inserted[0]?.id;
      } catch {
        insertedId = undefined;
      }

      if (!insertedId) {
        const rows = await (await db.from('algorithm_cards')).select<Array<{ id: string }>>('id', {
          user_id: `eq.${userId}`,
          slug: `eq.${definition.slug}`,
        });
        insertedId = rows[0]?.id;
      }

      if (!insertedId) {
        continue;
      }

      existing = {
        id: insertedId,
        slug: definition.slug,
        name: definition.name,
      };
      existingBySlug.set(definition.slug, existing);
    }

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
      isNew: !hadBefore,
    });
  }

  return rewards;
}

function pickBeginnerAlgorithmDefinitions(
  ownedSlugs: Set<string>,
  requestedCount: number
): AlgorithmCardDefinition[] {
  const targetCount = Math.min(requestedCount, ALGORITHM_CARD_CATALOG.length);

  const missing = ALGORITHM_CARD_CATALOG
    .filter((definition) => !ownedSlugs.has(definition.slug))
    .sort(() => Math.random() - 0.5);

  const selected = missing.slice(0, targetCount);
  if (selected.length >= targetCount) {
    return selected;
  }

  const fallback = ALGORITHM_CARD_CATALOG
    .filter((definition) => !selected.some((picked) => picked.slug === definition.slug))
    .sort(() => Math.random() - 0.5)
    .slice(0, targetCount - selected.length);

  return [...selected, ...fallback];
}

function buildPackBaseFilters(
  packType: PackType,
  elementFilter: string | undefined,
  includeExtendedPool: boolean
): Record<string, string> {
  const baseFilters: Record<string, string> = {};
  if (!includeExtendedPool) {
    baseFilters.catalog_type = 'eq.core';
    baseFilters.is_seeded_core = 'eq.true';
  }
  if (elementFilter) {
    baseFilters.element_type = `eq.${elementFilter}`;
  }
  if (packType === 'blind75') {
    baseFilters.is_blind75 = 'eq.true';
  }
  return baseFilters;
}

async function fetchPackCandidates(
  baseFilters: Record<string, string>,
  db: any
): Promise<PackCandidateCard[]> {
  const rows = (await (await db.from('cards')).select('id,rarity', baseFilters)) as Array<{
    id: string;
    rarity: string;
  }>;

  return rows.filter((row): row is PackCandidateCard => {
    return (
      Boolean(row.id) &&
      (row.rarity === 'common' ||
        row.rarity === 'rare' ||
        row.rarity === 'epic' ||
        row.rarity === 'legendary')
    );
  });
}

function getAvailableRarities(cards: PackCandidateCard[]): Set<Rarity> {
  return new Set(cards.map((card) => card.rarity));
}

const RARITY_FALLBACK_ORDER: Record<Rarity, readonly Rarity[]> = {
  legendary: ['legendary', 'epic', 'rare', 'common'],
  epic: ['epic', 'rare', 'common', 'legendary'],
  rare: ['rare', 'common', 'epic', 'legendary'],
  common: ['common', 'rare', 'epic', 'legendary'],
};

function resolvePackSlotRarity(requested: Rarity, available: Set<Rarity>): Rarity {
  for (const rarity of RARITY_FALLBACK_ORDER[requested]) {
    if (available.has(rarity)) return rarity;
  }
  // This path should not be reachable when candidate cards are present.
  return requested;
}

function pickCardIdForRaritySlot(
  rarity: Rarity,
  candidates: PackCandidateCard[],
  ownedUnlockedIds: Set<string>,
  selectedInPackIds: Set<string>
): string | null {
  const pool = candidates.filter((candidate) => candidate.rarity === rarity);
  if (pool.length === 0) return null;

  const unownedAndUnused = pool.filter(
    (candidate) =>
      !ownedUnlockedIds.has(candidate.id) && !selectedInPackIds.has(candidate.id)
  );
  const unused = pool.filter((candidate) => !selectedInPackIds.has(candidate.id));
  const unowned = pool.filter((candidate) => !ownedUnlockedIds.has(candidate.id));

  return (
    pickRandom(unownedAndUnused)?.id ??
    pickRandom(unused)?.id ??
    pickRandom(unowned)?.id ??
    pickRandom(pool)?.id ??
    null
  );
}

function pickRandom<T>(values: T[]): T | null {
  if (values.length === 0) return null;
  return values[Math.floor(Math.random() * values.length)] ?? null;
}

function getNextMidnight(): string {
  const d = new Date();
  d.setUTCHours(24, 0, 0, 0);
  return d.toISOString();
}

function getCoreTierByDuplicateCount(currentTier: CardTier, duplicateCount: number): CardTier {
  if (currentTier === 'mastered') return 'mastered';
  if (currentTier === 'proven' && duplicateCount >= CORE_DUPLICATES_TO_MASTERED) return 'mastered';
  if (currentTier === 'locked') return 'base';
  return currentTier;
}

async function grantPackCardsToCollection(
  userId: string,
  cardIds: string[],
  cards: Array<{ id: string; catalog_type?: string; is_seeded_core?: boolean }>,
  db: any
) {
  if (cardIds.length === 0) {
    return new Map<string, { tier: CardTier; isNew: boolean; duplicateCount: number }>();
  }

  const hitCounts = new Map<string, number>();
  for (const cardId of cardIds) {
    hitCounts.set(cardId, Number(hitCounts.get(cardId) ?? 0) + 1);
  }

  const uniqueCardIds = Array.from(hitCounts.keys());

  const existingRows = await (await db.from('user_cards')).select('id,card_id,tier,duplicate_count', {
    user_id: `eq.${userId}`,
    card_id: `in.(${uniqueCardIds.join(',')})`,
  }) as Array<{
    id: string;
    card_id: string;
    tier: CardTier;
    duplicate_count?: number;
  }>;

  const existingByCardId = new Map(existingRows.map((row) => [row.card_id, row]));
  const previousTierByCardId = new Map(existingRows.map((row) => [row.card_id, row.tier]));
  const cardMetaById = new Map(cards.map((card) => [card.id, card]));
  const nowIso = new Date().toISOString();

  for (const [cardId, hitCount] of hitCounts.entries()) {
    const existing = existingByCardId.get(cardId);
    const cardMeta = cardMetaById.get(cardId);
    const isSeededCore = cardMeta?.catalog_type === 'core' && Boolean(cardMeta?.is_seeded_core);
    const nextDuplicateCount = Number(existing?.duplicate_count ?? 0) + hitCount;

    if (!existing) {
      await (await db.from('user_cards')).insert({
        user_id: userId,
        card_id: cardId,
        tier: 'base',
        duplicate_count: nextDuplicateCount,
        obtained_at: nowIso,
      });
      continue;
    }

    if (existing.tier === 'locked') {
      await (await db.from('user_cards')).update(
        {
          tier: isSeededCore ? getCoreTierByDuplicateCount('locked', nextDuplicateCount) : 'base',
          duplicate_count: nextDuplicateCount,
          obtained_at: nowIso,
        },
        { id: `eq.${existing.id}` }
      );
      continue;
    }

    if (!isSeededCore) {
      await (await db.from('user_cards')).update(
        {
          duplicate_count: nextDuplicateCount,
        },
        { id: `eq.${existing.id}` }
      );
      continue;
    }

    const nextTier = getCoreTierByDuplicateCount(existing.tier, nextDuplicateCount);

    await (await db.from('user_cards')).update(
      {
        duplicate_count: nextDuplicateCount,
        tier: nextTier,
      },
      { id: `eq.${existing.id}` }
    );
  }

  const refreshedRows = await (await db.from('user_cards')).select('card_id,tier,duplicate_count', {
    user_id: `eq.${userId}`,
    card_id: `in.(${uniqueCardIds.join(',')})`,
  }) as Array<{
    card_id: string;
    tier: CardTier;
    duplicate_count?: number;
  }>;

  const rewardsByCardId = new Map<string, { tier: CardTier; isNew: boolean; duplicateCount: number }>();
  for (const row of refreshedRows) {
    const existedBefore = existingByCardId.has(row.card_id);
    const previousTier = previousTierByCardId.get(row.card_id);
    const transitionedFromLocked = previousTier === 'locked' && row.tier !== 'locked';
    rewardsByCardId.set(row.card_id, {
      tier: row.tier,
      isNew: (!existedBefore && row.tier !== 'locked') || transitionedFromLocked,
      duplicateCount: Number(row.duplicate_count ?? 0),
    });
  }

  return rewardsByCardId;
}

function readJoinedCard(cardsField: unknown): {
  id?: string;
  title_slug?: string;
  title?: string;
  rarity?: string;
  element_type?: string;
  base_atk?: number;
  base_def?: number;
  base_hp?: number;
  is_blind75?: boolean;
  catalog_type?: string;
  is_seeded_core?: boolean;
} | null {
  if (Array.isArray(cardsField)) {
    return (cardsField[0] as {
      id?: string;
      title_slug?: string;
      title?: string;
      rarity?: string;
      element_type?: string;
      base_atk?: number;
      base_def?: number;
      base_hp?: number;
      is_blind75?: boolean;
      catalog_type?: string;
      is_seeded_core?: boolean;
    }) ?? null;
  }

  if (cardsField && typeof cardsField === 'object') {
    return cardsField as {
      id?: string;
      title_slug?: string;
      title?: string;
      rarity?: string;
      element_type?: string;
      base_atk?: number;
      base_def?: number;
      base_hp?: number;
      is_blind75?: boolean;
      catalog_type?: string;
      is_seeded_core?: boolean;
    };
  }

  return null;
}
