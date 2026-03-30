import { PUBLIC_API_URL } from '$env/static/public';
import { supabase } from '$lib/supabase';

const API_TIMEOUT_MS = 12000;

async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  const headers = new Headers(options.headers ?? {});
  headers.set('Content-Type', 'application/json');

  if (session?.access_token) {
    headers.set('Authorization', `Bearer ${session.access_token}`);
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), API_TIMEOUT_MS);

  let res: Response;
  try {
    res = await fetch(`${PUBLIC_API_URL}${path}`, {
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
  triggerSync: (userId: string) =>
    apiFetch<{
      synced: number;
      unlocked: number;
      upgraded: number;
      skippedOutOfCatalog: number;
      extendedCatalogEnabled: boolean;
    }>(`/sync/trigger/${userId}`, { method: 'POST' }),

  // Packs
  openPack: (userId: string, packType: string, elementFilter?: string, includeExtendedPool = false) =>
    apiFetch<{
      cards: unknown[];
      rarities: string[];
      coinsSpent: number;
      usedExtendedPool: boolean;
    }>('/packs/open', {
      method: 'POST',
      body: JSON.stringify({ userId, packType, elementFilter, includeExtendedPool }),
    }),

  // Cards
  getCollection: (userId: string) =>
    apiFetch<unknown[]>(`/cards/collection/${userId}`),
  getAllCards: (filters?: Record<string, string>) => {
    const params = new URLSearchParams(filters ?? {}).toString();
    return apiFetch<unknown[]>(`/cards?${params}`);
  },
  upgradeCard: (userId: string, cardId: string, newTier: string) =>
    apiFetch('/cards/upgrade', {
      method: 'POST',
      body: JSON.stringify({ userId, cardId, newTier }),
    }),
  equipAlgo: (userId: string, problemCardId: string, algoCardId: string, slot: 1 | 2) =>
    apiFetch('/cards/equip', {
      method: 'POST',
      body: JSON.stringify({ userId, problemCardId, algoCardId, slot }),
    }),

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
};
