import { Hono } from 'hono';
import { z } from 'zod';
import type { Env } from '../index';
import { createSupabase } from '../lib/supabase';
import { getAuthenticatedUser, isOwner } from '../lib/auth';
import { getPackFeatureFlags } from '../lib/feature-flags';
import { rollPackRarities } from '../lib/rng';
import type { PackType, Rarity } from '@leetarena/types';
import { PACK_COSTS } from '@leetarena/types';

export const packRoutes = new Hono<{ Bindings: Env }>();

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

  // Cost check
  const cost = PACK_COSTS[packType];
  if (typeof cost === 'number' && user.coins < cost) {
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

  // Deduct coins
  if (typeof cost === 'number') {
    await (await db.from('users')).update(
      { coins: user.coins - cost },
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

  // Grant cards to user collection
  const userCards = cardIds.map((cardId) => ({
    user_id: userId,
    card_id: cardId,
    tier: 'base',
    obtained_at: new Date().toISOString(),
  }));
  await (await db.from('user_cards')).upsert(userCards);

  // Return full card data for animation
  const cards = (await (await db.from('cards')).select('*', {
    id: `in.(${cardIds.join(',')})`,
  })) as any[];

  return c.json({
    cards,
    rarities,
    coinsSpent: typeof cost === 'number' ? cost : 0,
    usedExtendedPool: useExtendedPool,
  });
});

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
  const owned = (await (await db.from('user_cards')).select('card_id', {
    user_id: `eq.${userId}`,
  })) as any[];
  const ownedIds = new Set(owned.map((c: any) => c.card_id));
  const unowned = cards.filter((c: any) => !ownedIds.has(c.id));

  const pool = unowned.length > 0 ? unowned : cards;
  return pool[Math.floor(Math.random() * pool.length)] ?? null;
}

function getNextMidnight(): string {
  const d = new Date();
  d.setUTCHours(24, 0, 0, 0);
  return d.toISOString();
}
