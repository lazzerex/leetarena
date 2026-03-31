import type { SupabaseClient } from './supabase';

export async function ensureCoreCollectionInitialized(
  userId: string,
  db: SupabaseClient
): Promise<{ inserted: number }> {
  const coreCards = await (await db.from('cards')).select<Array<{ id: string }>>('id', {
    catalog_type: 'eq.core',
    is_seeded_core: 'eq.true',
  });

  if (!Array.isArray(coreCards) || coreCards.length === 0) {
    return { inserted: 0 };
  }

  const existing = await (await db.from('user_cards')).select<Array<{ card_id: string }>>(
    'card_id',
    { user_id: `eq.${userId}` }
  );

  const owned = new Set((existing ?? []).map((row) => row.card_id));
  const missingCardIds = coreCards
    .map((row) => row.id)
    .filter((cardId) => !owned.has(cardId));

  if (missingCardIds.length === 0) {
    return { inserted: 0 };
  }

  await (await db.from('user_cards')).insert(
    missingCardIds.map((cardId) => ({
      user_id: userId,
      card_id: cardId,
      tier: 'locked',
      duplicate_count: 0,
      extended_progress_slugs: [],
      obtained_at: new Date().toISOString(),
    }))
  );

  return { inserted: missingCardIds.length };
}
