import { Hono } from 'hono';
import { z } from 'zod';
import type { Env } from '../index';
import { createSupabase } from '../lib/supabase';
import { getAuthenticatedUser, isOwner } from '../lib/auth';
import { getSyncFeatureFlags, type SyncFeatureFlags } from '../lib/feature-flags';
import {
  getUserProfile,
  getRecentAcceptedSubmissions,
  getQuestionData,
} from '../lib/leetcode';
import { computeCardStats } from '../lib/cards';
import { ensureCoreCollectionInitialized } from '../lib/core-collection';

export const syncRoutes = new Hono<{ Bindings: Env }>();

type CardTier = 'locked' | 'base' | 'proven' | 'mastered';
type CatalogType = 'core' | 'extended';

type SyncSubmission = {
  id: string;
  title: string;
  titleSlug: string;
  timestamp: string;
  statusDisplay: string;
  lang: string;
};

type SyncStateRow = {
  user_id: string;
  last_submission_id?: string;
  last_batch_synced_at?: string | null;
  targeted_window_started_at?: string | null;
  targeted_sync_count?: number;
  targeted_last_by_slug?: unknown;
};

type SubmissionOutcome =
  | 'unlocked'
  | 'upgraded'
  | 'no_change'
  | 'skipped_out_of_catalog'
  | 'skipped_no_metadata';

const CORE_SYNC_TARGET_TIER: CardTier = 'base';
const BATCH_SYNC_LIMIT = 20;
const BATCH_SYNC_COOLDOWN_MS = 60 * 60 * 1000;
const TARGETED_CARD_COOLDOWN_MS = 5 * 60 * 1000;
const TARGETED_WINDOW_MS = 60 * 60 * 1000;
const TARGETED_MAX_PER_WINDOW = 10;
const EXTENDED_GEMS_PER_PROMOTION = 1;

const TargetedSyncSchema = z.object({
  titleSlug: z.string().trim().min(1),
});

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

  const users = await (await db.from('users')).select('*', { id: `eq.${userId}` });
  const user = Array.isArray(users) ? users[0] : null;

  if (!user || !user.leetcode_username) {
    return c.json({ error: 'No LeetCode username set' }, 400);
  }

  await ensureCoreCollectionInitialized(userId, db);

  const state = await getSyncState(userId, db);
  const now = Date.now();
  const lastBatchAt = parseTimestamp(state?.last_batch_synced_at);
  if (lastBatchAt !== null && now - lastBatchAt < BATCH_SYNC_COOLDOWN_MS) {
    return c.json(
      {
        error: 'Batch sync cooldown active. Try again later.',
        nextAt: new Date(lastBatchAt + BATCH_SYNC_COOLDOWN_MS).toISOString(),
      },
      429
    );
  }

  const result = await performSync(userId, user.leetcode_username, db, syncFlags, {
    submissionLimit: BATCH_SYNC_LIMIT,
  });

  await (await db.from('leetcode_sync')).upsert({
    user_id: userId,
    last_batch_synced_at: new Date().toISOString(),
  });

  return c.json({
    ...result,
    mode: 'batch',
    batchLimit: BATCH_SYNC_LIMIT,
  });
});

syncRoutes.post('/targeted/:userId', async (c) => {
  const userId = c.req.param('userId');
  const syncFlags = getSyncFeatureFlags(c.env);

  if (!syncFlags.syncEnabled) {
    return c.json({ error: 'LeetCode sync is disabled by server configuration' }, 403);
  }

  const body = await c.req.json();
  const parsed = TargetedSyncSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400);

  const authUser = await getAuthenticatedUser(c);
  if (!authUser) return c.json({ error: 'Unauthorized' }, 401);
  if (!isOwner(authUser, userId)) return c.json({ error: 'Forbidden' }, 403);

  const db = createSupabase(c.env.SUPABASE_URL, c.env.SUPABASE_SERVICE_ROLE_KEY);

  const users = await (await db.from('users')).select('*', { id: `eq.${userId}` });
  const user = Array.isArray(users) ? users[0] : null;

  if (!user || !user.leetcode_username) {
    return c.json({ error: 'No LeetCode username set' }, 400);
  }

  await ensureCoreCollectionInitialized(userId, db);

  const normalizedSlug = normalizeTitleSlug(parsed.data.titleSlug);
  const state = await getSyncState(userId, db);
  const limitState = evaluateTargetedSyncLimits(state, normalizedSlug, Date.now());

  if (!limitState.allowed) {
    return c.json(
      {
        error: limitState.reason,
        nextAt: limitState.nextAt,
      },
      429
    );
  }

  const submissions = await getRecentAcceptedSubmissions(user.leetcode_username, 50);
  const matchedSubmission = submissions.find(
    (submission) => normalizeTitleSlug(submission.titleSlug) === normalizedSlug
  );

  const nextRateState = buildNextTargetedState(state, normalizedSlug, Date.now());

  if (!matchedSubmission) {
    await (await db.from('leetcode_sync')).upsert({
      user_id: userId,
      targeted_window_started_at: nextRateState.windowStartedAt,
      targeted_sync_count: nextRateState.count,
      targeted_last_by_slug: nextRateState.lastBySlug,
      last_synced_at: new Date().toISOString(),
    });

    return c.json({
      status: 'not_found',
      titleSlug: normalizedSlug,
      message: 'No accepted submission found for this problem in recent submissions',
    });
  }

  const outcome = await applySubmission({
    userId,
    submission: matchedSubmission,
    db,
    syncFlags,
  });
  const gemsAwarded = outcome.promotedExtendedCards * EXTENDED_GEMS_PER_PROMOTION;
  if (gemsAwarded > 0) {
    await addExtendedGems(userId, gemsAwarded, db);
  }

  await (await db.from('leetcode_sync')).upsert({
    user_id: userId,
    last_synced_at: new Date().toISOString(),
    last_submission_id: maxSubmissionId(state?.last_submission_id ?? '0', matchedSubmission.id),
    targeted_window_started_at: nextRateState.windowStartedAt,
    targeted_sync_count: nextRateState.count,
    targeted_last_by_slug: nextRateState.lastBySlug,
  });

  return c.json({
    status: mapOutcomeToTargetedStatus(outcome.outcome),
    titleSlug: normalizedSlug,
    unlocked: outcome.outcome === 'unlocked' ? 1 : 0,
    upgraded: outcome.outcome === 'upgraded' ? 1 : 0,
    promotedExtendedCards: outcome.promotedExtendedCards,
    gemsAwarded,
  });
});

syncRoutes.get('/verify/:username', async (c) => {
  const username = c.req.param('username');
  const profile = await getUserProfile(username);
  if (!profile) return c.json({ valid: false });
  return c.json({ valid: true, username: profile.username });
});

export async function performSync(
  userId: string,
  leetcodeUsername: string,
  db: Awaited<ReturnType<typeof createSupabase>>,
  syncFlags: SyncFeatureFlags = { syncEnabled: true, extendedCatalogEnabled: false },
  options: { submissionLimit?: number } = {}
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
      promotedExtendedCards: 0,
      gemsAwarded: 0,
      extendedCatalogEnabled: syncFlags.extendedCatalogEnabled,
      message: 'LeetCode sync is disabled by server configuration',
    };
  }

  const profile = await getUserProfile(leetcodeUsername);
  if (!profile) return { error: 'LeetCode user not found', synced: 0 };

  await ensureCoreCollectionInitialized(userId, db);

  const submissions = await getRecentAcceptedSubmissions(
    leetcodeUsername,
    options.submissionLimit ?? 50
  );

  const state = await getSyncState(userId, db);
  const lastSubmissionId = state?.last_submission_id ?? '0';

  const newSubs = submissions.filter(
    (submission) => parseInt(submission.id, 10) > parseInt(lastSubmissionId, 10)
  );

  const uniqueNewSubsMap = new Map<string, SyncSubmission>();
  for (const submission of [...newSubs].sort((a, b) => parseInt(b.id, 10) - parseInt(a.id, 10))) {
    const normalizedSlug = normalizeTitleSlug(submission.titleSlug);
    if (!uniqueNewSubsMap.has(normalizedSlug)) {
      uniqueNewSubsMap.set(normalizedSlug, submission);
    }
  }
  const uniqueNewSubs = Array.from(uniqueNewSubsMap.values());

  let synced = 0;
  let unlocked = 0;
  let upgraded = 0;
  let skippedOutOfCatalog = 0;
  let skippedNoMetadata = 0;
  let promotedExtendedCards = 0;

  for (const submission of uniqueNewSubs) {
    const outcome = await applySubmission({
      userId,
      submission,
      db,
      syncFlags,
    });

    if (outcome.outcome === 'unlocked') unlocked++;
    if (outcome.outcome === 'upgraded') upgraded++;
    if (outcome.outcome === 'skipped_out_of_catalog') skippedOutOfCatalog++;
    if (outcome.outcome === 'skipped_no_metadata') skippedNoMetadata++;
    promotedExtendedCards += outcome.promotedExtendedCards;

    if (outcome.outcome !== 'skipped_out_of_catalog' && outcome.outcome !== 'skipped_no_metadata') {
      synced++;
    }
  }

  const gemsAwarded = promotedExtendedCards * EXTENDED_GEMS_PER_PROMOTION;
  if (gemsAwarded > 0) {
    await addExtendedGems(userId, gemsAwarded, db);
  }

  await (await db.from('leetcode_sync')).upsert({
    user_id: userId,
    last_synced_at: new Date().toISOString(),
    last_submission_id: maxSubmissionId(lastSubmissionId, submissions[0]?.id ?? lastSubmissionId),
  });

  return {
    synced,
    newSubmissions: newSubs.length,
    uniqueProblems: uniqueNewSubs.length,
    unlocked,
    upgraded,
    skippedOutOfCatalog,
    skippedNoMetadata,
    promotedExtendedCards,
    gemsAwarded,
    extendedCatalogEnabled: syncFlags.extendedCatalogEnabled,
  };
}

async function addExtendedGems(
  userId: string,
  amount: number,
  db: Awaited<ReturnType<typeof createSupabase>>
): Promise<void> {
  if (amount <= 0) return;

  const users = await (await db.from('users')).select<Array<{ id: string; extended_gems?: number }>>(
    'id,extended_gems',
    { id: `eq.${userId}` }
  );

  const user = users[0];
  if (!user) return;

  const nextExtendedGems = Number(user.extended_gems ?? 0) + amount;
  await (await db.from('users')).update(
    { extended_gems: nextExtendedGems },
    { id: `eq.${userId}` }
  );
}

async function applySubmission(args: {
  userId: string;
  submission: SyncSubmission;
  db: Awaited<ReturnType<typeof createSupabase>>;
  syncFlags: SyncFeatureFlags;
}): Promise<{ outcome: SubmissionOutcome; promotedExtendedCards: number }> {
  const { userId, submission, db, syncFlags } = args;

  const titleSlug = normalizeTitleSlug(submission.titleSlug);
  const existingCards = await (await db.from('cards')).select<Array<{
    id: string;
    catalog_type?: CatalogType;
    is_seeded_core?: boolean;
    tags?: string[];
  }>>('id,catalog_type,is_seeded_core,tags', {
    title_slug: `eq.${titleSlug}`,
  });

  const existingCard = existingCards[0];
  let cardId = existingCard?.id;

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
    return { outcome: 'skipped_out_of_catalog', promotedExtendedCards: 0 };
  }

  if (catalogType === 'extended' && !syncFlags.extendedCatalogEnabled) {
    return { outcome: 'skipped_out_of_catalog', promotedExtendedCards: 0 };
  }

  const questionData = await getQuestionData(titleSlug);
  const solvedTags = questionData?.topicTags.map((tag) => tag.slug) ?? normalizeTagArray(existingCard?.tags);

  if (!cardId) {
    if (!questionData) {
      return { outcome: 'skipped_no_metadata', promotedExtendedCards: 0 };
    }

    const stats = computeCardStats({
      titleSlug,
      difficulty: questionData.difficulty,
      acRate: questionData.acRate / 100,
      tags: solvedTags,
    });

    const upserted = await (await db.from('cards')).upsert<Array<{ id: string }>>({
      title_slug: titleSlug,
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
      tags: solvedTags,
    });

    cardId = upserted[0]?.id;
    if (!cardId) {
      const cards = await (await db.from('cards')).select<Array<{ id: string }>>('id', {
        title_slug: `eq.${titleSlug}`,
      });
      cardId = cards[0]?.id;
    }

    catalogType = 'extended';
  }

  if (!cardId) {
    return { outcome: 'skipped_no_metadata', promotedExtendedCards: 0 };
  }

  const userCards = await (await db.from('user_cards')).select<Array<{ id: string; tier: CardTier }>>(
    'id,tier',
    {
      user_id: `eq.${userId}`,
      card_id: `eq.${cardId}`,
    }
  );

  const existingUserCard = userCards[0];
  let outcome: SubmissionOutcome = 'no_change';

  if (catalogType === 'core') {
    if (!existingUserCard) {
      await (await db.from('user_cards')).insert({
        user_id: userId,
        card_id: cardId,
        tier: CORE_SYNC_TARGET_TIER,
        duplicate_count: 0,
        obtained_at: new Date().toISOString(),
      });
      outcome = 'unlocked';
    } else if (existingUserCard.tier === 'locked') {
      await (await db.from('user_cards')).update(
        { tier: CORE_SYNC_TARGET_TIER },
        { id: `eq.${existingUserCard.id}` }
      );
      outcome = 'unlocked';
    }

    return { outcome, promotedExtendedCards: 0 };
  }

  if (!existingUserCard) {
    await (await db.from('user_cards')).insert({
      user_id: userId,
      card_id: cardId,
      tier: 'base',
      duplicate_count: 0,
      extended_progress_slugs: [],
      obtained_at: new Date().toISOString(),
    });
    outcome = 'unlocked';
  }

  const promotedIds = await applyExtendedProgressForSubmission(userId, titleSlug, solvedTags, db);
  if (promotedIds.length > 0 && outcome === 'no_change') {
    outcome = 'upgraded';
  }

  return {
    outcome,
    promotedExtendedCards: promotedIds.length,
  };
}

async function applyExtendedProgressForSubmission(
  userId: string,
  solvedTitleSlug: string,
  solvedTags: string[],
  db: Awaited<ReturnType<typeof createSupabase>>
): Promise<string[]> {
  if (!solvedTags.length) return [];

  const rows = await (await db.from('user_cards')).select<Array<{
    id: string;
    tier: CardTier;
    extended_progress_slugs?: string[];
    cards?: {
      id?: string;
      catalog_type?: CatalogType;
      tags?: string[];
    } | Array<{
      id?: string;
      catalog_type?: CatalogType;
      tags?: string[];
    }>;
  }>>('id,tier,extended_progress_slugs,cards(id,catalog_type,tags)', {
    user_id: `eq.${userId}`,
    tier: 'in.(base,proven)',
  });

  const promotedCardIds: string[] = [];

  for (const row of rows) {
    const card = readJoinedCard(row.cards);
    if (!card) continue;
    if (card.catalog_type !== 'extended') continue;

    const cardTags = normalizeTagArray(card.tags);
    if (!hasAnyTagOverlap(cardTags, solvedTags)) continue;

    const existingProgress = normalizeSlugList(row.extended_progress_slugs);
    if (existingProgress.includes(solvedTitleSlug)) continue;

    const nextProgress = [...existingProgress, solvedTitleSlug];
    const payload: { extended_progress_slugs: string[]; tier?: CardTier } = {
      extended_progress_slugs: nextProgress,
    };

    if (row.tier === 'base' && nextProgress.length >= 3) {
      payload.tier = 'proven';
      if (card.id) promotedCardIds.push(card.id);
    }

    await (await db.from('user_cards')).update(payload, { id: `eq.${row.id}` });
  }

  return promotedCardIds;
}

async function getSyncState(
  userId: string,
  db: Awaited<ReturnType<typeof createSupabase>>
): Promise<SyncStateRow | null> {
  const states = await (await db.from('leetcode_sync')).select<SyncStateRow[]>('*', {
    user_id: `eq.${userId}`,
  });
  return states[0] ?? null;
}

function evaluateTargetedSyncLimits(
  state: SyncStateRow | null,
  titleSlug: string,
  nowMs: number
): { allowed: true } | { allowed: false; reason: string; nextAt: string } {
  const lastBySlug = normalizeSlugTimestampMap(state?.targeted_last_by_slug);
  const lastForSlug = parseTimestamp(lastBySlug[titleSlug]);
  if (lastForSlug !== null && nowMs - lastForSlug < TARGETED_CARD_COOLDOWN_MS) {
    return {
      allowed: false,
      reason: 'Per-card targeted sync cooldown is active',
      nextAt: new Date(lastForSlug + TARGETED_CARD_COOLDOWN_MS).toISOString(),
    };
  }

  const windowStartedAt = parseTimestamp(state?.targeted_window_started_at);
  const count = Number(state?.targeted_sync_count ?? 0);
  if (windowStartedAt === null || nowMs - windowStartedAt >= TARGETED_WINDOW_MS) {
    return { allowed: true };
  }

  if (count >= TARGETED_MAX_PER_WINDOW) {
    return {
      allowed: false,
      reason: 'Targeted sync hourly limit reached',
      nextAt: new Date(windowStartedAt + TARGETED_WINDOW_MS).toISOString(),
    };
  }

  return { allowed: true };
}

function buildNextTargetedState(
  state: SyncStateRow | null,
  titleSlug: string,
  nowMs: number
): { windowStartedAt: string; count: number; lastBySlug: Record<string, string> } {
  const existingWindowStartedAt = parseTimestamp(state?.targeted_window_started_at);
  const resetWindow = existingWindowStartedAt === null || nowMs - existingWindowStartedAt >= TARGETED_WINDOW_MS;

  const windowStartedAt = resetWindow
    ? new Date(nowMs).toISOString()
    : new Date(existingWindowStartedAt).toISOString();

  const currentCount = resetWindow ? 0 : Number(state?.targeted_sync_count ?? 0);
  const nextCount = currentCount + 1;

  const lastBySlug = normalizeSlugTimestampMap(state?.targeted_last_by_slug);
  lastBySlug[titleSlug] = new Date(nowMs).toISOString();

  return {
    windowStartedAt,
    count: nextCount,
    lastBySlug,
  };
}

function mapOutcomeToTargetedStatus(outcome: SubmissionOutcome): string {
  if (outcome === 'unlocked') return 'unlocked';
  if (outcome === 'upgraded') return 'upgraded';
  if (outcome === 'skipped_out_of_catalog') return 'out_of_catalog';
  if (outcome === 'skipped_no_metadata') return 'no_metadata';
  return 'already_unlocked';
}

function normalizeTitleSlug(slug: string | null | undefined): string {
  return (slug ?? '').trim().replace(/^\/+|\/+$/g, '').toLowerCase();
}

function normalizeTagArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => String(entry).trim())
    .filter((entry) => entry.length > 0);
}

function normalizeSlugList(value: unknown): string[] {
  return normalizeTagArray(value).map((entry) => normalizeTitleSlug(entry));
}

function hasAnyTagOverlap(left: string[], right: string[]): boolean {
  if (!left.length || !right.length) return false;
  const rightSet = new Set(right);
  for (const tag of left) {
    if (rightSet.has(tag)) return true;
  }
  return false;
}

function parseTimestamp(value: string | null | undefined): number | null {
  if (!value) return null;
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) return null;
  return parsed;
}

function normalizeSlugTimestampMap(value: unknown): Record<string, string> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }

  const normalized: Record<string, string> = {};
  for (const [key, rawValue] of Object.entries(value as Record<string, unknown>)) {
    if (typeof rawValue !== 'string') continue;
    if (parseTimestamp(rawValue) === null) continue;
    const normalizedKey = normalizeTitleSlug(key);
    if (!normalizedKey) continue;
    normalized[normalizedKey] = rawValue;
  }

  return normalized;
}

function maxSubmissionId(currentId: string, nextId: string): string {
  const current = Number.parseInt(currentId, 10);
  const next = Number.parseInt(nextId, 10);
  if (!Number.isFinite(current)) return nextId;
  if (!Number.isFinite(next)) return currentId;
  return next > current ? nextId : currentId;
}

function readJoinedCard(cardsField: unknown): {
  id?: string;
  catalog_type?: CatalogType;
  tags?: string[];
} | null {
  if (Array.isArray(cardsField)) {
    return (cardsField[0] as {
      id?: string;
      catalog_type?: CatalogType;
      tags?: string[];
    }) ?? null;
  }

  if (cardsField && typeof cardsField === 'object') {
    return cardsField as {
      id?: string;
      catalog_type?: CatalogType;
      tags?: string[];
    };
  }

  return null;
}
