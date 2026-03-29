import { Hono } from 'hono';
import { z } from 'zod';
import type { Env } from '../index';
import { createSupabase } from '../lib/supabase';
import { getTypeMultiplier } from '@leetarena/types';
import type { BattleRound, BattleRewards } from '@leetarena/types';

export const battleRoutes = new Hono<{ Bindings: Env }>();

const CreateBattleSchema = z.object({
  player1Id: z.string().uuid(),
  player2Id: z.string().uuid(),
  deck1Id: z.string().uuid(),
  deck2Id: z.string().uuid(),
});

const PlayCardSchema = z.object({
  battleId: z.string().uuid(),
  playerId: z.string().uuid(),
  cardId: z.string().uuid(),
});

/** Create a new battle */
battleRoutes.post('/create', async (c) => {
  const body = await c.req.json();
  const parsed = CreateBattleSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400);

  const db = createSupabase(c.env.SUPABASE_URL, c.env.SUPABASE_SERVICE_ROLE_KEY);
  const { player1Id, player2Id, deck1Id, deck2Id } = parsed.data;

  // Validate decks
  const deck1Cards = await getDeckCards(deck1Id, db);
  const deck2Cards = await getDeckCards(deck2Id, db);

  const validationError1 = validateDeck(deck1Cards);
  const validationError2 = validateDeck(deck2Cards);
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
  const { battleId, player1CardId, player2CardId } = body as {
    battleId: string;
    player1CardId: string;
    player2CardId: string;
  };

  const db = createSupabase(c.env.SUPABASE_URL, c.env.SUPABASE_SERVICE_ROLE_KEY);

  // Fetch both cards
  const [card1, card2] = await Promise.all([
    getCardStats(player1CardId, db),
    getCardStats(player2CardId, db),
  ]);

  if (!card1 || !card2) {
    return c.json({ error: 'Card not found' }, 404);
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
  const { battleId, winnerId, loserId } = await c.req.json() as {
    battleId: string;
    winnerId: string;
    loserId: string;
  };

  const db = createSupabase(c.env.SUPABASE_URL, c.env.SUPABASE_SERVICE_ROLE_KEY);

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

  // Update ratings & coins
  await Promise.all([
    (await db.from('users')).update(
      { coins: `coins + ${rewards.winnerCoins}`, rating: `rating + ${rewards.winnerRatingDelta}` },
      { id: `eq.${winnerId}` }
    ),
    (await db.from('users')).update(
      { coins: `coins + ${rewards.loserCoins}`, rating: `rating + ${rewards.loserRatingDelta}` },
      { id: `eq.${loserId}` }
    ),
  ]);

  return c.json({ rewards });
});

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function getDeckCards(deckId: string, db: any): Promise<any[]> {
  const decks = (await (await db.from('decks')).select('*', { id: `eq.${deckId}` })) as any[];
  const deck = decks[0];
  if (!deck) return [];
  return deck.card_ids ?? [];
}

function validateDeck(cardIds: string[]): string | null {
  if (cardIds.length !== 10) return 'Deck must have exactly 10 cards';
  return null;
}

async function getCardStats(cardId: string, db: any) {
  const cards = (await (await db.from('cards')).select('*', { id: `eq.${cardId}` })) as any[];
  const card = cards[0];
  if (!card) return null;
  return {
    id: card.id,
    ownerId: card.user_id,
    elementType: card.element_type,
    baseAtk: card.base_atk,
    baseDef: card.base_def,
    baseHp: card.base_hp,
  };
}
