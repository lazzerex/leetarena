import { PUBLIC_API_URL } from '$env/static/public';
import { supabase } from '$lib/supabase';
import type { AlgorithmThemeTokens } from '@leetarena/types';

const API_TIMEOUT_MS = 12000;
const SYNC_API_TIMEOUT_MS = 90000;
const TARGETED_SYNC_TIMEOUT_MS = 45000;

function joinApiUrl(baseUrl: string, path: string): string {
  const normalizedBase = baseUrl.trim().replace(/\/+$/, '');
  const normalizedPath = path.replace(/^\/+/, '');
  return `${normalizedBase}/${normalizedPath}`;
}

async function apiFetch<T>(path: string, options: RequestInit = {}, timeoutMs = API_TIMEOUT_MS): Promise<T> {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  const headers = new Headers(options.headers ?? {});
  headers.set('Content-Type', 'application/json');

  if (session?.access_token) {
    headers.set('Authorization', `Bearer ${session.access_token}`);
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  let res: Response;
  try {
    res = await fetch(joinApiUrl(PUBLIC_API_URL, path), {
      ...options,
      headers,
      credentials: 'include',
      signal: controller.signal,
    });
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('Request timed out. Please try again.');
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error((err as { error: string }).error ?? 'API error');
  }
  return res.json() as Promise<T>;
}

export const api = {
  // Sync
  verifyLeetCode: (username: string) =>
    apiFetch<{ valid: boolean; username?: string }>(`/sync/verify/${username}`),
  triggerSync: (userId: string, options?: { resetCheckpoint?: boolean }) =>
    apiFetch<{
      synced: number;
      fetchedAcceptedSubmissions: number;
      newSubmissions: number;
      uniqueProblems: number;
      duplicateProblemSubmissions: number;
      unchangedProblems: number;
      unlocked: number;
      upgraded: number;
      skippedOutOfCatalog: number;
      skippedNoMetadata: number;
      gemsAwarded: number;
      extendedCatalogEnabled: boolean;
      submissionErrors?: number;
      checkpointUpdated?: boolean;
      batchCheckpointUpdated?: boolean;
      checkpointResetApplied?: boolean;
    }>(`/sync/trigger/${userId}`, {
      method: 'POST',
      body: JSON.stringify({ resetCheckpoint: options?.resetCheckpoint === true }),
    }, SYNC_API_TIMEOUT_MS),
  targetedSync: (userId: string, titleSlug: string) =>
    apiFetch<{
      status: 'unlocked' | 'upgraded' | 'already_unlocked' | 'out_of_catalog' | 'no_metadata' | 'not_found';
      titleSlug: string;
      unlocked: number;
      upgraded: number;
      promotedExtendedCards: number;
      gemsAwarded: number;
      message?: string;
    }>(`/sync/targeted/${userId}`, {
      method: 'POST',
      body: JSON.stringify({ titleSlug }),
    }, TARGETED_SYNC_TIMEOUT_MS),

  // Packs
  openPack: (userId: string, packType: string, elementFilter?: string, includeExtendedPool = false) =>
    apiFetch<{
      cards: unknown[];
      cardRewards: Array<{
        cardId: string;
        tier: 'locked' | 'base' | 'proven' | 'mastered';
        isNew: boolean;
        duplicateCount: number;
      }>;
      algorithmCards: Array<{
        id: string;
        slug: string;
        name: string;
        description: string;
        abilityName: string;
        abilityDescription: string;
        mode: 'trap' | 'effect';
        themeTemplate: string;
        themeTokens: AlgorithmThemeTokens;
        isNew: boolean;
      }>;
      rarities: string[];
      rolledRarities: string[];
      coinsSpent: number;
      duplicateCompensationCoins: number;
      usedExtendedPool: boolean;
    }>('/packs/open', {
      method: 'POST',
      body: JSON.stringify({ userId, packType, elementFilter, includeExtendedPool }),
    }),
  getBeginnerPackStatus: (userId: string) =>
    apiFetch<{
      claimable: boolean;
      claimedAt: string | null;
      rewardSpec: {
        coreCards: number;
        algorithmCards: number;
        solveOnlyCoreUnlock: boolean;
        storageMode?: 'users-column' | 'sync-fallback';
      };
    }>(`/packs/beginner/status/${userId}`),
  claimBeginnerPack: (userId: string) =>
    apiFetch<{
      claimedAt: string;
      coreCards: Array<{
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
      }>;
      algorithmCards: Array<{
        id: string;
        slug: string;
        name: string;
        description: string;
        abilityName: string;
        abilityDescription: string;
        mode: 'trap' | 'effect';
        themeTemplate: string;
        themeTokens: AlgorithmThemeTokens;
        isNew: boolean;
      }>;
      coreCardCount: number;
      algorithmCardCount: number;
    }>('/packs/claim-beginner', {
      method: 'POST',
      body: JSON.stringify({ userId }),
    }),

  // Cards
  getCollection: (userId: string) =>
    apiFetch<unknown[]>(`/cards/collection/${userId}`),
  getAlgorithmCollection: (userId: string) =>
    apiFetch<Array<{
      id: string;
      slug: string;
      name: string;
      description: string;
      abilityName: string;
      abilityDescription: string;
      mode: 'trap' | 'effect';
      tags: string[];
      themeTemplate: string;
      themeTokens: AlgorithmThemeTokens;
      obtainedAt: string;
    }>>(`/cards/algorithms/${userId}`),
  getAllCards: (filters?: Record<string, string>) => {
    const params = new URLSearchParams(filters ?? {}).toString();
    return apiFetch<unknown[]>(`/cards?${params}`);
  },
  upgradeCard: (userId: string, cardId: string, newTier: string) =>
    apiFetch('/cards/upgrade', {
      method: 'POST',
      body: JSON.stringify({ userId, cardId, newTier }),
    }),
  upgradeExtendedToMastered: (userId: string, userCardId: string) =>
    apiFetch<{
      success: boolean;
      newTier: 'mastered';
      gemsSpent: number;
      extendedGems: number;
    }>('/cards/upgrade-extended-mastered', {
      method: 'POST',
      body: JSON.stringify({ userId, userCardId }),
    }),
  equipAlgo: (userId: string, problemCardId: string, algoCardId: string | null, slot: 1 | 2) =>
    apiFetch<{
      success: boolean;
      action: 'equipped' | 'unequipped';
      movedFromCards: number;
      slot: 1 | 2;
    }>('/cards/equip', {
      method: 'POST',
      body: JSON.stringify({ userId, problemCardId, algoCardId, slot }),
    }),
  getProblemSummary: (titleSlug: string) =>
    apiFetch<{
      title?: string;
      titleSlug: string;
      difficulty?: 'Easy' | 'Medium' | 'Hard';
      summary: string | null;
      source: 'leetcode' | 'unavailable';
    }>(`/cards/summary/${encodeURIComponent(titleSlug)}`),

  // Battle
  createBattle: (player1Id: string, player2Id: string, deck1Id: string, deck2Id: string) =>
    apiFetch<{ battle: unknown; goesFirst: string }>('/battle/create', {
      method: 'POST',
      body: JSON.stringify({ player1Id, player2Id, deck1Id, deck2Id }),
    }),
  resolveRound: (battleId: string, player1CardId: string, player2CardId: string) =>
    apiFetch('/battle/resolve-round', {
      method: 'POST',
      body: JSON.stringify({ battleId, player1CardId, player2CardId }),
    }),
  finishBattle: (battleId: string, winnerId: string, loserId: string) =>
    apiFetch('/battle/finish', {
      method: 'POST',
      body: JSON.stringify({ battleId, winnerId, loserId }),
    }),
  finishBotBattle: (userId: string, difficulty: 'easy' | 'normal' | 'hard', didWin: boolean) =>
    apiFetch<{
      success: boolean;
      userId: string;
      didWin: boolean;
      difficulty: 'easy' | 'normal' | 'hard';
      coinsAwarded: number;
      totalCoins: number;
    }>('/battle/finish-bot', {
      method: 'POST',
      body: JSON.stringify({ userId, difficulty, didWin }),
    }),
};
