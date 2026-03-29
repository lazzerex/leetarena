import { Hono } from 'hono';
import type { Env } from '../index';
import { createSupabase } from '../lib/supabase';
import { getAuthenticatedUser, isOwner } from '../lib/auth';

export const cardRoutes = new Hono<{ Bindings: Env }>();

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

  const userCards = await (await db.from('user_cards')).select(
    'id,tier,equipped_algo_1,equipped_algo_2,obtained_at,card:cards(*)',
    { user_id: `eq.${userId}` }
  );

  return c.json(userCards);
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

  await (await db.from('user_cards')).update(
    { tier: newTier },
    { user_id: `eq.${userId}`, card_id: `eq.${cardId}` }
  );

  return c.json({ success: true, newTier });
});

/** Equip an algorithm card to a problem card */
cardRoutes.post('/equip', async (c) => {
  const { userId, problemCardId, algoCardId, slot } = await c.req.json() as {
    userId: string;
    problemCardId: string;
    algoCardId: string;
    slot: 1 | 2;
  };

  const authUser = await getAuthenticatedUser(c);
  if (!authUser) return c.json({ error: 'Unauthorized' }, 401);
  if (!isOwner(authUser, userId)) return c.json({ error: 'Forbidden' }, 403);

  const db = createSupabase(c.env.SUPABASE_URL, c.env.SUPABASE_SERVICE_ROLE_KEY);
  const field = slot === 1 ? 'equipped_algo_1' : 'equipped_algo_2';

  await (await db.from('user_cards')).update(
    { [field]: algoCardId },
    { user_id: `eq.${userId}`, card_id: `eq.${problemCardId}` }
  );

  return c.json({ success: true });
});
