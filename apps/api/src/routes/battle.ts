import { Hono } from 'hono';
import { z } from 'zod';
import type { Env } from '../index';
import { createSupabase } from '../lib/supabase';
import { getAuthenticatedUser, isOwner } from '../lib/auth';
import { getBattleFeatureFlags } from '../lib/feature-flags';
import { getTypeMultiplier } from '@leetarena/types';
import type { BattleRound, BattleRewards } from '@leetarena/types';

export const battleRoutes = new Hono<{ Bindings: Env }>();

const CreateBattleSchema = z.object({
  player1Id: z.string().uuid(),
  player2Id: z.string().uuid(),
  deck1Id: z.string().uuid(),
  deck2Id: z.string().uuid(),
});

const ResolveRoundSchema = z.object({
  battleId: z.string().uuid(),
  player1CardId: z.string().uuid(),
  player2CardId: z.string().uuid(),
});

const FinishBattleSchema = z.object({
  battleId: z.string().uuid(),
  winnerId: z.string().uuid(),
  loserId: z.string().uuid(),
});

/** Create a new battle */
battleRoutes.post('/create', async (c) => {
  const body = await c.req.json();
  const parsed = CreateBattleSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400);

  const authUser = await getAuthenticatedUser(c);
  if (!authUser) return c.json({ error: 'Unauthorized' }, 401);

  const db = createSupabase(c.env.SUPABASE_URL, c.env.SUPABASE_SERVICE_ROLE_KEY);
  const { player1Id, player2Id, deck1Id, deck2Id } = parsed.data;
  const { rankedCoreOnly } = getBattleFeatureFlags(c.env);

  if (!isOwner(authUser, player1Id)) {
    return c.json({ error: 'Forbidden: player1Id must match authenticated user' }, 403);
  }

  // Validate decks
  const [deck1, deck2] = await Promise.all([
    getDeckById(deck1Id, db),
    getDeckById(deck2Id, db),
  ]);

  if (!deck1 || !deck2) {
    return c.json({ error: 'Deck not found' }, 404);
  }

  if (deck1.user_id !== player1Id) {
    return c.json({ error: 'Deck 1 does not belong to player 1' }, 403);
  }

  if (deck2.user_id !== player2Id) {
    return c.json({ error: 'Deck 2 does not belong to player 2' }, 400);
  }

  const validationError1 = await validateDeck(deck1.card_ids ?? [], player1Id, rankedCoreOnly, db);
  const validationError2 = await validateDeck(deck2.card_ids ?? [], player2Id, rankedCoreOnly, db);
  if (validationError1) return c.json({ error: `Deck 1: ${validationError1}` }, 400);
  if (validationError2) return c.json({ error: `Deck 2: ${validationError2}` }, 400);

  // Coin flip for first player
  const goesFirst = Math.random() < 0.5 ? player1Id : player2Id;

  const battle = await (await db.from('battles')).insert({
    player1_id: player1Id,
    player2_id: player2Id,
    deck1_id: deck1Id,
    deck2_id: deck2Id,
    status: 'waiting',
    goes_first: goesFirst,
    started_at: new Date().toISOString(),
    replay_json: { rounds: [] },
  });

  return c.json({ battle, goesFirst });
});

/** Resolve a round when both players have played a card */
battleRoutes.post('/resolve-round', async (c) => {
  const body = await c.req.json();
  const parsed = ResolveRoundSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400);

  const authUser = await getAuthenticatedUser(c);
  if (!authUser) return c.json({ error: 'Unauthorized' }, 401);

  const { battleId, player1CardId, player2CardId } = parsed.data;

  const db = createSupabase(c.env.SUPABASE_URL, c.env.SUPABASE_SERVICE_ROLE_KEY);
  const battle = await getBattleById(battleId, db);

  if (!battle) return c.json({ error: 'Battle not found' }, 404);
  if (authUser.id !== battle.player1_id && authUser.id !== battle.player2_id) {
    return c.json({ error: 'Forbidden' }, 403);
  }

  // Fetch both cards
  const [card1, card2] = await Promise.all([
    getUserCardStats(player1CardId, db),
    getUserCardStats(player2CardId, db),
  ]);

  if (!card1 || !card2) {
    return c.json({ error: 'Card not found' }, 404);
  }

  const allowedOwners = new Set([battle.player1_id, battle.player2_id]);
  if (!allowedOwners.has(card1.ownerId) || !allowedOwners.has(card2.ownerId)) {
    return c.json({ error: 'Card does not belong to battle participants' }, 400);
  }

  // Type advantage
  const mult1 = getTypeMultiplier(card1.elementType, card2.elementType);
  const mult2 = getTypeMultiplier(card2.elementType, card1.elementType);

  const atk1 = Math.round(card1.baseAtk * mult1);
  const atk2 = Math.round(card2.baseAtk * mult2);

  let roundWinnerId: string | null = null;

  if (atk1 > atk2) {
    roundWinnerId = card1.ownerId;
  } else if (atk2 > atk1) {
    roundWinnerId = card2.ownerId;
  }
  // else tie — both discarded

  const round: BattleRound = {
    roundNumber: 0, // set by caller
    player1CardId,
    player2CardId,
    player1Atk: atk1,
    player2Atk: atk2,
    player1Multiplier: mult1,
    player2Multiplier: mult2,
    roundWinnerId,
  };

  return c.json({ round, card1, card2 });
});

/** Finish a battle and issue rewards */
battleRoutes.post('/finish', async (c) => {
  const body = await c.req.json();
  const parsed = FinishBattleSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400);

  const authUser = await getAuthenticatedUser(c);
  if (!authUser) return c.json({ error: 'Unauthorized' }, 401);

  const { battleId, winnerId, loserId } = parsed.data;

  const db = createSupabase(c.env.SUPABASE_URL, c.env.SUPABASE_SERVICE_ROLE_KEY);
  const battle = await getBattleById(battleId, db);

  if (!battle) return c.json({ error: 'Battle not found' }, 404);

  const participants = new Set([battle.player1_id, battle.player2_id]);
  if (!participants.has(authUser.id)) {
    return c.json({ error: 'Forbidden' }, 403);
  }

  if (!participants.has(winnerId) || !participants.has(loserId) || winnerId === loserId) {
    return c.json({ error: 'Invalid winner/loser payload' }, 400);
  }

  const rewards: BattleRewards = {
    winnerId,
    winnerCoins: 100,
    loserCoins: 25,
    winnerRatingDelta: 25,
    loserRatingDelta: -25,
  };

  // Update battle
  await (await db.from('battles')).update(
    {
      winner_id: winnerId,
      status: 'finished',
      ended_at: new Date().toISOString(),
    },
    { id: `eq.${battleId}` }
  );

  const [winnerRows, loserRows] = await Promise.all([
    (await db.from('users')).select<{ id: string; coins: number; rating: number }[]>(
      'id,coins,rating',
      { id: `eq.${winnerId}` }
    ),
    (await db.from('users')).select<{ id: string; coins: number; rating: number }[]>(
      'id,coins,rating',
      { id: `eq.${loserId}` }
    ),
  ]);

  const winner = winnerRows[0];
  const loser = loserRows[0];

  if (!winner || !loser) {
    return c.json({ error: 'Player not found' }, 404);
  }

  const nextWinnerCoins = Number(winner.coins) + rewards.winnerCoins;
  const nextWinnerRating = Number(winner.rating) + rewards.winnerRatingDelta;
  const nextLoserCoins = Number(loser.coins) + rewards.loserCoins;
  const nextLoserRating = Number(loser.rating) + rewards.loserRatingDelta;

  // Persist numeric values explicitly to avoid unsafe string arithmetic updates.
  await Promise.all([
    (await db.from('users')).update(
      { coins: nextWinnerCoins, rating: nextWinnerRating },
      { id: `eq.${winnerId}` }
    ),
    (await db.from('users')).update(
      { coins: nextLoserCoins, rating: nextLoserRating },
      { id: `eq.${loserId}` }
    ),
  ]);

  return c.json({ rewards });
});

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function getDeckById(deckId: string, db: any) {
  const decks = await (await db.from('decks')).select('*', { id: `eq.${deckId}` }) as any[];
  return decks[0] ?? null;
}

async function validateDeck(
  cardIds: string[],
  ownerId: string,
  enforceCoreOnly: boolean,
  db: any
): Promise<string | null> {
  if (cardIds.length !== 10) return 'Deck must have exactly 10 cards';

  const uniqueCardIds = new Set(cardIds);
  if (uniqueCardIds.size !== 10) return 'Deck cannot contain duplicate cards';

  const userCards = await (await db.from('user_cards')).select(
    'id,tier,cards(element_type,catalog_type,is_seeded_core)',
    {
      user_id: `eq.${ownerId}`,
      id: `in.(${cardIds.join(',')})`,
    }
  ) as Array<{ tier: string; cards: unknown }>;

  if (userCards.length !== 10) {
    return 'Deck contains invalid or unowned cards';
  }

  const hasLockedCard = userCards.some((card: { tier: string }) => card.tier === 'locked');
  if (hasLockedCard) {
    return 'Deck contains locked cards. Unlock cards before using them in battle';
  }

  const elementTypes = new Set(
    userCards
      .map((card: { cards: unknown }) => readElementType(card.cards))
      .filter((element: string | null): element is string => Boolean(element))
  );

  if (elementTypes.size < 2) {
    return 'Deck must include at least 2 different element types';
  }

  if (enforceCoreOnly) {
    const hasExtendedCard = userCards.some((card: { cards: unknown }) => {
      const catalogType = readCatalogType(card.cards);
      const isSeededCore = readIsSeededCore(card.cards);
      return !(catalogType === 'core' && isSeededCore);
    });
    if (hasExtendedCard) {
      return 'Ranked mode is core-only. Remove extended catalog cards from this deck';
    }
  }

  return null;
}

function readElementType(cardsField: unknown): string | null {
  if (Array.isArray(cardsField)) return cardsField[0]?.element_type ?? null;
  if (cardsField && typeof cardsField === 'object') {
    return (cardsField as { element_type?: string }).element_type ?? null;
  }
  return null;
}

function readCatalogType(cardsField: unknown): string {
  if (Array.isArray(cardsField)) return cardsField[0]?.catalog_type ?? 'core';
  if (cardsField && typeof cardsField === 'object') {
    return (cardsField as { catalog_type?: string }).catalog_type ?? 'core';
  }
  return 'core';
}

function readIsSeededCore(cardsField: unknown): boolean {
  if (Array.isArray(cardsField)) return Boolean(cardsField[0]?.is_seeded_core);
  if (cardsField && typeof cardsField === 'object') {
    return Boolean((cardsField as { is_seeded_core?: boolean }).is_seeded_core);
  }
  return false;
}

async function getUserCardStats(userCardId: string, db: any) {
  const userCards = await (await db.from('user_cards')).select(
    'id,user_id,cards(base_atk,base_def,base_hp,element_type)',
    { id: `eq.${userCardId}` }
  ) as any[];
  const userCard = userCards[0];
  if (!userCard) return null;

  const cardData = Array.isArray(userCard.cards) ? userCard.cards[0] : userCard.cards;
  if (!cardData) return null;

  return {
    id: userCard.id,
    ownerId: userCard.user_id,
    elementType: cardData.element_type,
    baseAtk: cardData.base_atk,
    baseDef: cardData.base_def,
    baseHp: cardData.base_hp,
  };
}

async function getBattleById(battleId: string, db: any) {
  const battles = await (await db.from('battles')).select(
    'id,player1_id,player2_id,status',
    { id: `eq.${battleId}` }
  ) as any[];
  return battles[0] ?? null;
}
