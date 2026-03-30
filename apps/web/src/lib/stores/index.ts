import { writable, derived } from 'svelte/store';
import type { User } from '@leetarena/types';
import type { Rarity, Element } from '@leetarena/types';

// ─── Auth Store ───────────────────────────────────────────────────────────────

export const currentUser = writable<User | null>(null);
export const isAuthenticated = derived(currentUser, ($u) => $u !== null);
export const authHydrated = writable(false);
export const hasAuthSession = writable(false);

// ─── Collection Store ─────────────────────────────────────────────────────────

export interface UserCardWithData {
  id: string;
  tier: 'locked' | 'base' | 'proven' | 'mastered';
  equippedAlgo1?: string;
  equippedAlgo2?: string;
  obtainedAt: string;
  card: {
    id: string;
    titleSlug: string;
    title_slug?: string;
    title: string;
    difficulty: string;
    elementType: Element;
    element_type?: Element;
    baseAtk: number;
    base_atk?: number;
    baseDef: number;
    base_def?: number;
    baseHp: number;
    base_hp?: number;
    rarity: Rarity;
    isBlind75: boolean;
    is_blind75?: boolean;
    tags: string[];
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

export const userCollection = writable<UserCardWithData[]>([]);
export const userAlgoCards = writable<unknown[]>([]);

// ─── Deck Builder Store ───────────────────────────────────────────────────────

export const deckBuilderCards = writable<UserCardWithData[]>([]);
export const deckName = writable('My Deck');

export function addToDeck(card: UserCardWithData) {
  deckBuilderCards.update((cards) => {
    if (cards.length >= 10) return cards;
    if (cards.find((c) => c.id === card.id)) return cards;
    return [...cards, card];
  });
}

export function removeFromDeck(cardId: string) {
  deckBuilderCards.update((cards) => cards.filter((c) => c.id !== cardId));
}

export const deckIsValid = derived(deckBuilderCards, ($cards) => {
  if ($cards.length !== 10) return false;
  const elements = new Set($cards.map((c) => c.card.elementType));
  return elements.size >= 2;
});

// ─── Battle Store ─────────────────────────────────────────────────────────────

export type BattlePhase =
  | 'lobby'
  | 'selecting'
  | 'revealing'
  | 'round-result'
  | 'finished';

export interface BattleState {
  battleId: string | null;
  phase: BattlePhase;
  myPlayerId: string | null;
  opponentId: string | null;
  myRemainingCards: UserCardWithData[];
  opponentRemainingCards: number; // count only
  selectedCardId: string | null;
  opponentPlayed: boolean;
  lastRound: unknown | null;
  winner: string | null;
  secondsLeft: number;
}

const initialBattleState: BattleState = {
  battleId: null,
  phase: 'lobby',
  myPlayerId: null,
  opponentId: null,
  myRemainingCards: [],
  opponentRemainingCards: 10,
  selectedCardId: null,
  opponentPlayed: false,
  lastRound: null,
  winner: null,
  secondsLeft: 30,
};

export const battleState = writable<BattleState>(initialBattleState);

export function resetBattle() {
  battleState.set(initialBattleState);
}

// ─── Pack Store ───────────────────────────────────────────────────────────────

export interface PackRevealCard {
  id: string;
  titleSlug: string;
  title: string;
  rarity: Rarity;
  elementType: Element;
  baseAtk: number;
  baseDef: number;
  baseHp: number;
  isNew: boolean;
}

export const packRevealCards = writable<PackRevealCard[]>([]);
export const packRevealOpen = writable(false);

// ─── Notification Store ───────────────────────────────────────────────────────

export interface Notification {
  id: string;
  type: 'success' | 'error' | 'info';
  message: string;
}

export const notifications = writable<Notification[]>([]);

export function notify(type: Notification['type'], message: string) {
  const id = crypto.randomUUID();
  notifications.update((n) => [...n, { id, type, message }]);
  setTimeout(() => {
    notifications.update((n) => n.filter((x) => x.id !== id));
  }, 4000);
}
