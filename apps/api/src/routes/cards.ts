import { Hono } from 'hono';
import type { Env } from '../index';
import { createSupabase } from '../lib/supabase';
import { getAuthenticatedUser, isOwner } from '../lib/auth';
import { ensureCoreCollectionInitialized } from '../lib/core-collection';
import { ALGORITHM_CARD_CATALOG } from '@leetarena/types';

export const cardRoutes = new Hono<{ Bindings: Env }>();
const EXTENDED_MASTER_GEM_COST = 5;

const algorithmDefinitionBySlug = new Map(
  ALGORITHM_CARD_CATALOG.map((definition) => [definition.slug, definition])
);

/** Get all cards (with optional rarity/element filters) */
cardRoutes.get('/', async (c) => {
  const db = createSupabase(c.env.SUPABASE_URL, c.env.SUPABASE_SERVICE_ROLE_KEY);
  const { rarity, element, difficulty } = c.req.query();

  const filters: Record<string, string> = {};
  if (rarity) filters['rarity'] = `eq.${rarity}`;
  if (element) filters['element_type'] = `eq.${element}`;
  if (difficulty) filters['difficulty'] = `eq.${difficulty}`;

  const cards = await (await db.from('cards')).select('*', filters);
  return c.json(cards);
});

/** Get a user's card collection */
cardRoutes.get('/collection/:userId', async (c) => {
  const userId = c.req.param('userId');

  const authUser = await getAuthenticatedUser(c);
  if (!authUser) return c.json({ error: 'Unauthorized' }, 401);
  if (!isOwner(authUser, userId)) return c.json({ error: 'Forbidden' }, 403);

  const db = createSupabase(c.env.SUPABASE_URL, c.env.SUPABASE_SERVICE_ROLE_KEY);
  await ensureCoreCollectionInitialized(userId, db);

  const userCards = await (await db.from('user_cards')).select(
    'id,tier,equipped_algo_1,equipped_algo_2,obtained_at,card:cards(*)',
    { user_id: `eq.${userId}` }
  );

  return c.json(userCards);
});

/** Get a user's algorithm trap/effect cards */
cardRoutes.get('/algorithms/:userId', async (c) => {
  const userId = c.req.param('userId');

  const authUser = await getAuthenticatedUser(c);
  if (!authUser) return c.json({ error: 'Unauthorized' }, 401);
  if (!isOwner(authUser, userId)) return c.json({ error: 'Forbidden' }, 403);

  const db = createSupabase(c.env.SUPABASE_URL, c.env.SUPABASE_SERVICE_ROLE_KEY);
  const rows = await (await db.from('algorithm_cards')).select<Array<{
    id: string;
    slug: string;
    name: string;
    created_at: string;
  }>>('id,slug,name,created_at', {
    user_id: `eq.${userId}`,
  });

  const enriched = rows.map((row) => {
    const definition = algorithmDefinitionBySlug.get(row.slug);
    return {
      id: row.id,
      slug: row.slug,
      name: row.name,
      description: definition?.description ?? 'Utility trap/effect card',
      abilityName: definition?.abilityName ?? row.name,
      abilityDescription: definition?.abilityDescription ?? 'Applies a tactical battle effect.',
      mode: definition?.mode ?? 'effect',
      tags: definition?.tags ?? [],
      themeTemplate: definition?.themeTemplate ?? 'stone',
      themeTokens: definition?.themeTokens ?? {
        surface: '#1d2430',
        border: '#94a3b8',
        accent: '#cbd5e1',
        chip: '#2a3342',
        text: '#e2e8f0',
        glow: 'rgba(148, 163, 184, 0.35)',
      },
      obtainedAt: row.created_at,
    };
  });

  return c.json(enriched);
});

/** Upgrade card tier manually (after mastered solve) */
cardRoutes.post('/upgrade', async (c) => {
  const { userId, cardId, newTier } = await c.req.json() as {
    userId: string;
    cardId: string;
    newTier: 'proven' | 'mastered';
  };

  const authUser = await getAuthenticatedUser(c);
  if (!authUser) return c.json({ error: 'Unauthorized' }, 401);
  if (!isOwner(authUser, userId)) return c.json({ error: 'Forbidden' }, 403);

  const db = createSupabase(c.env.SUPABASE_URL, c.env.SUPABASE_SERVICE_ROLE_KEY);

  const userCards = await (await db.from('user_cards')).select<Array<{
    id: string;
    tier: 'locked' | 'base' | 'proven' | 'mastered';
    cards?: { catalog_type?: 'core' | 'extended' } | Array<{ catalog_type?: 'core' | 'extended' }>;
  }>>('id,tier,cards(catalog_type)', {
    user_id: `eq.${userId}`,
    card_id: `eq.${cardId}`,
  });
  const row = userCards[0];
  if (!row) return c.json({ error: 'Card not found in user collection' }, 404);

  const linkedCard = readLinkedCard(row.cards);
  if (newTier === 'mastered' && linkedCard?.catalog_type === 'extended') {
    return c.json(
      { error: 'Extended cards require gem spending for proven -> mastered. Use /cards/upgrade-extended-mastered' },
      400
    );
  }

  await (await db.from('user_cards')).update(
    { tier: newTier },
    { id: `eq.${row.id}` }
  );

  return c.json({ success: true, newTier });
});

/** Upgrade an extended proven card to mastered by spending extended_gems */
cardRoutes.post('/upgrade-extended-mastered', async (c) => {
  const { userId, userCardId } = await c.req.json() as {
    userId: string;
    userCardId: string;
  };

  const authUser = await getAuthenticatedUser(c);
  if (!authUser) return c.json({ error: 'Unauthorized' }, 401);
  if (!isOwner(authUser, userId)) return c.json({ error: 'Forbidden' }, 403);

  const db = createSupabase(c.env.SUPABASE_URL, c.env.SUPABASE_SERVICE_ROLE_KEY);

  const userCards = await (await db.from('user_cards')).select<Array<{
    id: string;
    tier: 'locked' | 'base' | 'proven' | 'mastered';
    cards?: { catalog_type?: 'core' | 'extended' } | Array<{ catalog_type?: 'core' | 'extended' }>;
  }>>('id,tier,cards(catalog_type)', {
    id: `eq.${userCardId}`,
    user_id: `eq.${userId}`,
  });

  const userCard = userCards[0];
  if (!userCard) return c.json({ error: 'User card not found' }, 404);

  const linkedCard = readLinkedCard(userCard.cards);
  if (linkedCard?.catalog_type !== 'extended') {
    return c.json({ error: 'Only extended cards use gem-based mastered upgrades' }, 400);
  }

  if (userCard.tier !== 'proven') {
    return c.json({ error: 'Card must be at proven tier before upgrading to mastered' }, 400);
  }

  const users = await (await db.from('users')).select<Array<{ id: string; extended_gems?: number }>>(
    'id,extended_gems',
    { id: `eq.${userId}` }
  );
  const user = users[0];
  if (!user) return c.json({ error: 'User not found' }, 404);

  const currentExtendedGems = Number(user.extended_gems ?? 0);
  if (currentExtendedGems < EXTENDED_MASTER_GEM_COST) {
    return c.json(
      {
        error: 'Insufficient extended_gems',
        required: EXTENDED_MASTER_GEM_COST,
        current: currentExtendedGems,
      },
      402
    );
  }

  const remainingExtendedGems = currentExtendedGems - EXTENDED_MASTER_GEM_COST;
  await (await db.from('users')).update(
    { extended_gems: remainingExtendedGems },
    { id: `eq.${userId}` }
  );

  try {
    await (await db.from('user_cards')).update(
      { tier: 'mastered' },
      { id: `eq.${userCard.id}` }
    );
  } catch (error) {
    await (await db.from('users')).update(
      { extended_gems: currentExtendedGems },
      { id: `eq.${userId}` }
    );
    throw error;
  }

  return c.json({
    success: true,
    newTier: 'mastered',
    gemsSpent: EXTENDED_MASTER_GEM_COST,
    extendedGems: remainingExtendedGems,
  });
});

/** Equip an algorithm card to a problem card */
cardRoutes.post('/equip', async (c) => {
  const { userId, problemCardId, algoCardId, slot } = await c.req.json() as {
    userId: string;
    problemCardId: string;
    algoCardId: string | null;
    slot: 1 | 2;
  };

  const authUser = await getAuthenticatedUser(c);
  if (!authUser) return c.json({ error: 'Unauthorized' }, 401);
  if (!isOwner(authUser, userId)) return c.json({ error: 'Forbidden' }, 403);

  const db = createSupabase(c.env.SUPABASE_URL, c.env.SUPABASE_SERVICE_ROLE_KEY);
  const field = slot === 1 ? 'equipped_algo_1' : 'equipped_algo_2';

  if (algoCardId) {
    const algoCards = await (await db.from('algorithm_cards')).select<Array<{ id: string }>>('id', {
      id: `eq.${algoCardId}`,
      user_id: `eq.${userId}`,
    });

    if (!algoCards[0]) {
      return c.json({ error: 'Algorithm card not found in user inventory' }, 404);
    }
  }

  await (await db.from('user_cards')).update(
    { [field]: algoCardId },
    { user_id: `eq.${userId}`, card_id: `eq.${problemCardId}` }
  );

  return c.json({ success: true, action: algoCardId ? 'equipped' : 'unequipped' });
});

function readLinkedCard(cardsField: unknown): { catalog_type?: 'core' | 'extended' } | null {
  if (Array.isArray(cardsField)) {
    return (cardsField[0] as { catalog_type?: 'core' | 'extended' }) ?? null;
  }

  if (cardsField && typeof cardsField === 'object') {
    return cardsField as { catalog_type?: 'core' | 'extended' };
  }

  return null;
}
