<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { goto } from '$app/navigation';
  import { authHydrated, currentUser, battleState, hasAuthSession, resetBattle, notify } from '$lib/stores';
  import { api } from '$lib/api';
  import { supabase } from '$lib/supabase';
  import BattleBoard from '$lib/components/BattleBoard.svelte';
  import type { UserCardWithData } from '$lib/stores';
  import type { Element } from '@leetarena/types';
  import { getTypeMultiplier } from '@leetarena/types';

  type DeckRecord = {
    id: string;
    name: string;
    card_ids: string[];
  };

  type BotDifficulty = 'easy' | 'normal' | 'hard';

  interface BotPreset {
    label: string;
    statScale: number;
    winCoins: number;
    loseCoins: number;
    description: string;
  }

  interface RoundPreview {
    roundNumber: number;
    playerCardTitle: string;
    botCardTitle: string;
    playerAtk: number;
    botAtk: number;
    playerMultiplier: number;
    botMultiplier: number;
    winner: 'player' | 'bot' | 'tie';
  }

  const TURN_SECONDS = 30;
  const MAX_BATTLE_ROUNDS = 30;
  const ELEMENTS: Element[] = ['Graph', 'Tree', 'Math', 'DynamicProgramming', 'String', 'Array'];
  const difficultyOrder: BotDifficulty[] = ['easy', 'normal', 'hard'];

  const BOT_PRESETS: Record<BotDifficulty, BotPreset> = {
    easy: {
      label: 'Easy Bot',
      statScale: 0.92,
      winCoins: 60,
      loseCoins: 20,
      description: 'Relaxed pacing with weaker stats and random moves.',
    },
    normal: {
      label: 'Normal Bot',
      statScale: 1,
      winCoins: 100,
      loseCoins: 25,
      description: 'Balanced stats with semi-smart card choices.',
    },
    hard: {
      label: 'Hard Bot',
      statScale: 1.08,
      winCoins: 150,
      loseCoins: 35,
      description: 'Stronger stats and optimal counter picks.',
    },
  };

  const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

  let decks: DeckRecord[] = [];
  let selectedDeckId = '';
  let selectedDifficulty: BotDifficulty = 'normal';
  let activePreset: BotPreset = BOT_PRESETS[selectedDifficulty];
  let loadingDecks = true;
  let startingBattle = false;
  let resolvingRound = false;

  let timer: ReturnType<typeof setInterval> | null = null;
  let timedOutThisTurn = false;

  let botRemainingCards: UserCardWithData[] = [];
  let playerRoundWins = 0;
  let botRoundWins = 0;
  let roundPreview: RoundPreview | null = null;
  let roundsPlayed = 0;
  let loadedForUserId: string | null = null;
  let redirectedToLogin = false;
  let checkingSessionBeforeRedirect = false;
  let activeBattleDifficulty: BotDifficulty = 'normal';
  let rewardedBattleId: string | null = null;
  let rewardingBattle = false;

  $: activePreset = BOT_PRESETS[selectedDifficulty];
  $: hasSessionUser = Boolean($currentUser?.id) && $hasAuthSession;

  $: if ($authHydrated && !$hasAuthSession && !redirectedToLogin && !checkingSessionBeforeRedirect) {
    void confirmRedirectIfNoSession();
  }

  $: if (hasSessionUser && loadedForUserId !== $currentUser!.id) {
    loadedForUserId = $currentUser!.id;
    void loadDecks();
  }

  onMount(() => {
    resetBattle();
  });

  onDestroy(() => {
    stopTurnTimer();
  });

  async function confirmRedirectIfNoSession() {
    checkingSessionBeforeRedirect = true;
    try {
      const { data, error } = await supabase.auth.getSession();
      if (error) throw error;

      if (data.session?.user) {
        hasAuthSession.set(true);
        return;
      }

      redirectedToLogin = true;
      await goto('/login');
    } catch {
      redirectedToLogin = true;
      await goto('/login');
    } finally {
      checkingSessionBeforeRedirect = false;
    }
  }

  async function loadDecks() {
    if (!$currentUser) return;

    loadingDecks = true;
    try {
      const { data, error } = await supabase
        .from('decks')
        .select('id,name,card_ids')
        .eq('user_id', $currentUser.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      decks = (data ?? []).map((deck: any) => ({
        id: deck.id,
        name: deck.name,
        card_ids: Array.isArray(deck.card_ids) ? deck.card_ids : [],
      }));

      if (decks.length > 0) {
        selectedDeckId = selectedDeckId || decks[0].id;
      }
    } catch (error: any) {
      decks = [];
      notify('error', error?.message ?? 'Failed to load decks');
    } finally {
      loadingDecks = false;
    }
  }

  async function startBotBattle() {
    if (!$currentUser) return;
    if (!selectedDeckId) {
      notify('error', 'Select a deck to start a bot battle');
      return;
    }

    startingBattle = true;
    try {
      const playerCards = await loadPlayableDeck(selectedDeckId);
      if (playerCards.length !== 10) {
        notify('error', 'Deck must contain 10 unlocked cards to start a battle');
        return;
      }

      const elements = new Set(playerCards.map((card) => readElement(card)));
      if (elements.size < 2) {
        notify('error', 'Deck needs at least 2 different element types');
        return;
      }

      botRemainingCards = createBotDeck(playerCards, selectedDifficulty);
      activeBattleDifficulty = selectedDifficulty;
      roundPreview = null;
      roundsPlayed = 0;
      playerRoundWins = 0;
      botRoundWins = 0;
      timedOutThisTurn = false;
      rewardedBattleId = null;

      battleState.set({
        battleId: `bot-${Date.now()}`,
        phase: 'selecting',
        myPlayerId: $currentUser.id,
        opponentId: 'bot',
        myRemainingCards: playerCards,
        opponentRemainingCards: botRemainingCards.length,
        selectedCardId: null,
        opponentPlayed: false,
        lastRound: null,
        winner: null,
        secondsLeft: TURN_SECONDS,
      });

      startTurnTimer();
      notify('info', `${activePreset.label} engaged. Multiplayer PvP is coming soon.`);
    } catch (error: any) {
      notify('error', error?.message ?? 'Failed to start bot battle');
      resetBattle();
    } finally {
      startingBattle = false;
    }
  }

  async function loadPlayableDeck(deckId: string): Promise<UserCardWithData[]> {
    if (!$currentUser) return [];

    const deck = decks.find((item) => item.id === deckId);
    if (!deck || deck.card_ids.length === 0) return [];

    const { data, error } = await supabase
      .from('user_cards')
      .select('id,tier,equipped_algo_1,equipped_algo_2,obtained_at,cards(*)')
      .eq('user_id', $currentUser.id)
      .in('id', deck.card_ids);

    if (error) throw new Error(error.message);

    const normalized = (data ?? [])
      .map((row: any) => normalizeUserCard(row))
      .filter((card) => card.tier !== 'locked');

    const byId = new Map(normalized.map((card) => [card.id, card]));
    return deck.card_ids
      .map((cardId) => byId.get(cardId))
      .filter((card): card is UserCardWithData => Boolean(card));
  }

  function normalizeUserCard(row: any): UserCardWithData {
    const rawCard = Array.isArray(row?.cards) ? row.cards[0] : row?.cards;
    const element = asElement(rawCard?.element_type ?? rawCard?.elementType);

    const baseAtk = Number(rawCard?.base_atk ?? rawCard?.baseAtk ?? 0);
    const baseDef = Number(rawCard?.base_def ?? rawCard?.baseDef ?? 0);
    const baseHp = Number(rawCard?.base_hp ?? rawCard?.baseHp ?? 0);
    const titleSlug = (rawCard?.title_slug ?? rawCard?.titleSlug ?? '').trim();
    const isBlind75 = Boolean(rawCard?.is_blind75 ?? rawCard?.isBlind75 ?? false);

    return {
      id: row.id,
      tier: row.tier,
      equippedAlgo1: row.equipped_algo_1 ?? row.equipped_algo1 ?? row.equippedAlgo1,
      equippedAlgo2: row.equipped_algo_2 ?? row.equipped_algo2 ?? row.equippedAlgo2,
      obtainedAt: row.obtained_at ?? row.obtainedAt ?? '',
      card: {
        id: rawCard?.id ?? '',
        titleSlug,
        title_slug: titleSlug,
        title: rawCard?.title ?? 'Unknown Problem',
        difficulty: rawCard?.difficulty ?? 'Easy',
        elementType: element,
        element_type: element,
        baseAtk,
        base_atk: baseAtk,
        baseDef,
        base_def: baseDef,
        baseHp,
        base_hp: baseHp,
        rarity: rawCard?.rarity ?? 'common',
        isBlind75,
        is_blind75: isBlind75,
        tags: Array.isArray(rawCard?.tags) ? rawCard.tags : [],
      },
    };
  }

  function createBotDeck(playerDeck: UserCardWithData[], difficulty: BotDifficulty): UserCardWithData[] {
    const preset = BOT_PRESETS[difficulty];
    return playerDeck
      .map((playerCard, index) => {
        const jitter = difficulty === 'normal' ? 1 + (Math.random() * 0.08 - 0.04) : 1;
        const scale = preset.statScale * jitter;

        const atk = Math.max(1, Math.round(readBaseAtk(playerCard) * scale));
        const def = Math.max(1, Math.round(readBaseDef(playerCard) * scale));
        const hp = Math.max(1, Math.round(readBaseHp(playerCard) * scale));

        return {
          ...playerCard,
          id: `bot-${index}-${playerCard.id}`,
          card: {
            ...playerCard.card,
            baseAtk: atk,
            base_atk: atk,
            baseDef: def,
            base_def: def,
            baseHp: hp,
            base_hp: hp,
          },
        };
      })
      .sort(() => Math.random() - 0.5);
  }

  function startTurnTimer() {
    stopTurnTimer();
    timedOutThisTurn = false;

    timer = setInterval(() => {
      battleState.update((state) => {
        if (state.phase !== 'selecting') return state;

        const nextSeconds = Math.max(0, state.secondsLeft - 1);
        if (nextSeconds === 0 && !timedOutThisTurn) {
          timedOutThisTurn = true;
          queueMicrotask(() => {
            void handleTurnTimeout();
          });
        }

        return { ...state, secondsLeft: nextSeconds };
      });
    }, 1000);
  }

  function stopTurnTimer() {
    if (timer) {
      clearInterval(timer);
      timer = null;
    }
    timedOutThisTurn = false;
  }

  async function handleTurnTimeout() {
    if (resolvingRound || $battleState.phase !== 'selecting') return;

    const state = $battleState;
    if (!state.selectedCardId) {
      const autoCard = pickRandom(state.myRemainingCards);
      if (!autoCard) {
        await finishBotBattle('bot');
        return;
      }

      battleState.update((current) => ({ ...current, selectedCardId: autoCard.id }));
      notify('info', `Time up. Auto-played ${readTitle(autoCard)}.`);
    }

    await confirmPlay();
  }

  function selectCard(card: UserCardWithData) {
    if ($battleState.phase !== 'selecting' || resolvingRound) return;
    battleState.update((state) => ({ ...state, selectedCardId: card.id }));
  }

  async function confirmPlay() {
    if (resolvingRound || !$currentUser) return;

    const state = $battleState;
    if (state.phase !== 'selecting') return;

    const playerCard = state.myRemainingCards.find((card) => card.id === state.selectedCardId);
    if (!playerCard) {
      notify('error', 'Select a card before confirming');
      return;
    }

    const botCard = chooseBotCard(playerCard);
    if (!botCard) {
      await finishBotBattle($currentUser.id);
      return;
    }

    resolvingRound = true;
    stopTurnTimer();

    try {
      battleState.update((current) => ({
        ...current,
        opponentPlayed: true,
        phase: 'revealing',
        lastRound: {
          roundNumber: roundsPlayed + 1,
          playerCardTitle: readTitle(playerCard),
          botCardTitle: readTitle(botCard),
        },
      }));

      await sleep(700);
      roundsPlayed += 1;

      let result = resolveRound(playerCard, botCard, roundsPlayed);

      const nextPlayerCards = state.myRemainingCards.filter((card) => card.id !== playerCard.id);
      const nextBotCards = botRemainingCards.filter((card) => card.id !== botCard.id);

      if (result.winner === 'player') {
        playerRoundWins += 1;
      } else if (result.winner === 'bot') {
        botRoundWins += 1;
      }

      botRemainingCards = nextBotCards;
      roundPreview = result;

      battleState.update((current) => ({
        ...current,
        phase: 'round-result',
        selectedCardId: null,
        myRemainingCards: nextPlayerCards,
        opponentRemainingCards: nextBotCards.length,
        lastRound: result,
        secondsLeft: TURN_SECONDS,
      }));

      await sleep(1200);
      let winnerId = determineBattleWinner(nextPlayerCards, nextBotCards);
      if (!winnerId && roundsPlayed >= MAX_BATTLE_ROUNDS) {
        winnerId = determineFallbackWinner(nextPlayerCards, nextBotCards);
      }

      if (winnerId) {
        await finishBotBattle(winnerId);
      } else {
        battleState.update((current) => ({
          ...current,
          phase: 'selecting',
          opponentPlayed: false,
          selectedCardId: null,
          secondsLeft: TURN_SECONDS,
        }));
        startTurnTimer();
      }
    } catch (error: any) {
      notify('error', error?.message ?? 'Failed to resolve round');
      battleState.update((current) => ({
        ...current,
        phase: 'selecting',
        opponentPlayed: false,
        secondsLeft: TURN_SECONDS,
      }));
      startTurnTimer();
    } finally {
      resolvingRound = false;
    }
  }

  function chooseBotCard(playerCard: UserCardWithData): UserCardWithData | null {
    if (botRemainingCards.length === 0) return null;

    const ranked = [...botRemainingCards].sort(
      (left, right) => scoreBotCard(right, playerCard) - scoreBotCard(left, playerCard)
    );

    if (selectedDifficulty === 'easy') {
      const lowerHalf = ranked.slice(Math.floor(ranked.length / 2));
      return pickRandom(lowerHalf.length > 0 ? lowerHalf : ranked);
    }

    if (selectedDifficulty === 'normal') {
      const topPool = ranked.slice(0, Math.min(3, ranked.length));
      return pickRandom(topPool);
    }

    return ranked[0] ?? null;
  }

  function scoreBotCard(botCard: UserCardWithData, playerCard: UserCardWithData): number {
    const multiplier = getTypeMultiplier(readElement(botCard), readElement(playerCard));
    return readBaseAtk(botCard) * multiplier + readBaseDef(botCard) * 0.12 + readBaseHp(botCard) * 0.06;
  }

  function resolveRound(
    playerCard: UserCardWithData,
    botCard: UserCardWithData,
    roundNumber: number
  ): RoundPreview {
    const playerMultiplier = getTypeMultiplier(readElement(playerCard), readElement(botCard));
    const botMultiplier = getTypeMultiplier(readElement(botCard), readElement(playerCard));

    const playerAtk = Math.round(readBaseAtk(playerCard) * playerMultiplier);
    const botAtk = Math.round(readBaseAtk(botCard) * botMultiplier);

    let winner: RoundPreview['winner'] = 'tie';
    if (playerAtk > botAtk) winner = 'player';
    if (botAtk > playerAtk) winner = 'bot';

    return {
      roundNumber,
      playerCardTitle: readTitle(playerCard),
      botCardTitle: readTitle(botCard),
      playerAtk,
      botAtk,
      playerMultiplier,
      botMultiplier,
      winner,
    };
  }

  function determineBattleWinner(
    playerCards: UserCardWithData[],
    botCards: UserCardWithData[]
  ): string | null {
    if (!$currentUser) return 'bot';

    if (playerCards.length === 0 && botCards.length === 0) {
      if (playerRoundWins >= botRoundWins) return $currentUser.id;
      return 'bot';
    }

    if (botCards.length === 0) return $currentUser.id;
    if (playerCards.length === 0) return 'bot';
    return null;
  }

  function determineFallbackWinner(
    playerCards: UserCardWithData[],
    botCards: UserCardWithData[]
  ): string {
    if (!$currentUser) return 'bot';

    if (playerCards.length > botCards.length) return $currentUser.id;
    if (botCards.length > playerCards.length) return 'bot';
    if (playerRoundWins >= botRoundWins) return $currentUser.id;
    return 'bot';
  }

  async function finishBotBattle(winnerId: string) {
    const battleId = $battleState.battleId;
    if (battleId && rewardedBattleId === battleId) {
      return;
    }

    stopTurnTimer();

    battleState.update((state) => ({
      ...state,
      phase: 'finished',
      winner: winnerId,
      opponentPlayed: true,
      secondsLeft: 0,
    }));

    if (!$currentUser) return;

    const didWin = winnerId === $currentUser.id;

    if (rewardingBattle) {
      return;
    }

    rewardingBattle = true;

    try {
      const reward = await api.finishBotBattle($currentUser.id, activeBattleDifficulty, didWin);
      if (battleId) {
        rewardedBattleId = battleId;
      }

      currentUser.update((user) => {
        if (!user || user.id !== reward.userId) return user;
        return {
          ...user,
          coins: reward.totalCoins,
        };
      });

      const battleLabel = BOT_PRESETS[activeBattleDifficulty].label;
      if (didWin) {
        notify('success', `Victory vs ${battleLabel}. +${reward.coinsAwarded} coins.`);
      } else {
        notify('info', `Defeat vs ${battleLabel}. +${reward.coinsAwarded} coins.`);
      }
    } catch (error: any) {
      notify('error', error?.message ?? 'Failed to grant bot battle reward');
    } finally {
      rewardingBattle = false;
    }
  }

  function leaveBattle() {
    stopTurnTimer();
    botRemainingCards = [];
    roundPreview = null;
    roundsPlayed = 0;
    playerRoundWins = 0;
    botRoundWins = 0;
    resolvingRound = false;
    rewardingBattle = false;
    rewardedBattleId = null;
    resetBattle();
  }

  async function rematchBot() {
    leaveBattle();
    await startBotBattle();
  }

  function readTitle(card: UserCardWithData): string {
    return card.card?.title ?? 'Unknown';
  }

  function readElement(card: UserCardWithData): Element {
    return asElement(card.card?.elementType ?? card.card?.element_type);
  }

  function readBaseAtk(card: UserCardWithData): number {
    return Number(card.card?.baseAtk ?? card.card?.base_atk ?? 0);
  }

  function readBaseDef(card: UserCardWithData): number {
    return Number(card.card?.baseDef ?? card.card?.base_def ?? 0);
  }

  function readBaseHp(card: UserCardWithData): number {
    return Number(card.card?.baseHp ?? card.card?.base_hp ?? 0);
  }

  function asElement(value: unknown): Element {
    if (typeof value === 'string' && ELEMENTS.includes(value as Element)) {
      return value as Element;
    }
    return 'Array';
  }

  function pickRandom<T>(items: T[]): T | null {
    if (items.length === 0) return null;
    return items[Math.floor(Math.random() * items.length)] ?? null;
  }
</script>

<svelte:head><title>Battle — LeetArena</title></svelte:head>

<div class="max-w-7xl mx-auto px-4 py-8">
  {#if !$authHydrated}
    <div class="max-w-xl rounded-2xl border border-gray-800 bg-gray-900/80 px-5 py-6 text-gray-300">
      Restoring session...
    </div>
  {:else if !$hasAuthSession}
    <div class="max-w-xl rounded-2xl border border-gray-800 bg-gray-900/80 px-5 py-6 text-gray-300">
      Redirecting to sign in...
    </div>
  {:else if $battleState.phase === 'lobby'}
    <h1 class="text-3xl font-black mb-2">Battle Arena</h1>
    <p class="text-gray-400 mb-8">
      PvE bot battles are live for beta. Real-time multiplayer PvP is marked as coming soon.
    </p>

    <div class="grid grid-cols-1 xl:grid-cols-3 gap-6">
      <section class="xl:col-span-2 bg-gray-900 border border-gray-800 rounded-2xl p-6">
        <div class="flex flex-wrap items-start justify-between gap-3 mb-6">
          <div>
            <h2 class="font-black text-xl text-white">Quick Battle vs Bot</h2>
            <p class="text-sm text-gray-400 mt-1">{activePreset.description}</p>
          </div>
          <span class="px-2.5 py-1 text-xs font-semibold rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
            Beta PvE
          </span>
        </div>

        {#if loadingDecks}
          <div class="rounded-xl border border-gray-800 bg-gray-950/70 px-4 py-6 text-center text-gray-500">
            Loading your decks...
          </div>
        {:else if decks.length === 0}
          <div class="rounded-xl border border-gray-800 bg-gray-950/70 px-4 py-8 text-center">
            <p class="text-gray-300 mb-4">Build a legal 10-card deck first to start bot battles.</p>
            <a
              href="/deck-builder"
              class="inline-flex items-center px-6 py-2.5 bg-amber-500 text-black font-bold rounded-xl hover:bg-amber-400 transition-colors"
            >
              Build Deck
            </a>
          </div>
        {:else}
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-5">
            <label class="block">
              <span class="text-sm text-gray-400 block mb-1.5">Select Deck</span>
              <select
                bind:value={selectedDeckId}
                class="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-gray-500"
              >
                {#each decks as deck}
                  <option value={deck.id}>{deck.name} ({deck.card_ids.length} cards)</option>
                {/each}
              </select>
            </label>

            <div>
              <p class="text-sm text-gray-400 mb-1.5">Bot Difficulty</p>
              <div class="grid grid-cols-3 gap-2">
                {#each difficultyOrder as difficulty}
                  <button
                    type="button"
                    on:click={() => (selectedDifficulty = difficulty)}
                    class={`rounded-lg border px-2 py-2 text-xs font-semibold transition-colors ${
                      selectedDifficulty === difficulty
                        ? 'border-amber-400 bg-amber-500/20 text-amber-200'
                        : 'border-gray-700 bg-gray-800 text-gray-300'
                    }`}
                  >
                    {BOT_PRESETS[difficulty].label.replace(' Bot', '')}
                  </button>
                {/each}
              </div>
            </div>
          </div>

          <button
            on:click={startBotBattle}
            disabled={startingBattle || !selectedDeckId}
            class="w-full py-3 bg-red-600 hover:bg-red-500 text-white font-black text-lg rounded-xl transition-colors disabled:opacity-50"
          >
            {startingBattle ? 'Starting Battle...' : `Start ${activePreset.label}`}
          </button>

          <p class="text-xs text-gray-500 mt-3">
            Reward preview: Win +{activePreset.winCoins} coins, loss +{activePreset.loseCoins} coins.
          </p>
        {/if}
      </section>

      <aside class="bg-gray-900 border border-gray-800 rounded-2xl p-6">
        <span class="inline-flex px-2.5 py-1 text-xs font-semibold rounded-full bg-sky-500/20 text-sky-300 border border-sky-500/40 mb-3">
          Coming Soon
        </span>
        <h2 class="font-black text-xl text-white mb-2">Multiplayer PvP</h2>
        <p class="text-sm text-gray-400 mb-5">
          Live queue matchmaking is deferred until post-beta while bot combat and progression balance are tuned.
        </p>

        <button
          type="button"
          disabled
          class="w-full py-3 bg-gray-800 text-gray-500 border border-gray-700 rounded-xl font-semibold cursor-not-allowed"
        >
          Queue Live Match (Coming Soon)
        </button>

        <div class="mt-5 rounded-xl border border-gray-800 bg-gray-950/70 p-4 text-sm text-gray-400 space-y-2">
          <p>Current beta flow: Deck select -> Bot battle -> Reward preview.</p>
          <p>PvP will return after realtime reliability and matchmaking polish.</p>
        </div>
      </aside>
    </div>
  {:else}
    <div class="flex flex-col gap-4 mb-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h1 class="text-3xl font-black">Bot Battle</h1>
        <p class="text-gray-400 mt-1">
          {activePreset.label} · Round score {playerRoundWins} - {botRoundWins}
        </p>
      </div>

      <div class="flex items-center gap-2">
        {#if resolvingRound}
          <span class="px-3 py-1 text-xs rounded-full bg-gray-800 border border-gray-700 text-gray-300">
            Resolving Round...
          </span>
        {/if}

        <button
          type="button"
          on:click={leaveBattle}
          class="px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-gray-300 hover:text-white hover:border-gray-500 transition-colors"
        >
          Exit to Lobby
        </button>
      </div>
    </div>

    <div class="h-[calc(100vh-220px)] min-h-[600px] lg:min-h-[640px]">
      <BattleBoard onCardSelect={selectCard} onConfirmPlay={confirmPlay} />
    </div>

    {#if roundPreview}
      <div class="mt-4 bg-gray-900 border border-gray-800 rounded-2xl p-4">
        <div class="flex flex-wrap items-center justify-between gap-2 mb-3">
          <h2 class="font-bold text-white">Round {roundPreview.roundNumber} Recap</h2>
          <span
            class={`text-xs font-semibold px-2.5 py-1 rounded-full ${
              roundPreview.winner === 'player'
                ? 'bg-emerald-500/20 text-emerald-300'
                : roundPreview.winner === 'bot'
                  ? 'bg-rose-500/20 text-rose-300'
                  : 'bg-gray-700/60 text-gray-300'
            }`}
          >
            {roundPreview.winner === 'player' ? 'You won this clash' : roundPreview.winner === 'bot' ? 'Bot won this clash' : 'Clash tied'}
          </span>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
          <div class="rounded-xl bg-gray-950/80 border border-gray-800 p-3">
            <p class="text-gray-500 text-xs uppercase tracking-wide mb-1">You</p>
            <p class="text-white font-semibold">{roundPreview.playerCardTitle}</p>
            <p class="text-gray-400 mt-1">ATK {roundPreview.playerAtk} ({roundPreview.playerMultiplier.toFixed(1)}x)</p>
          </div>

          <div class="rounded-xl bg-gray-950/80 border border-gray-800 p-3">
            <p class="text-gray-500 text-xs uppercase tracking-wide mb-1">Bot</p>
            <p class="text-white font-semibold">{roundPreview.botCardTitle}</p>
            <p class="text-gray-400 mt-1">ATK {roundPreview.botAtk} ({roundPreview.botMultiplier.toFixed(1)}x)</p>
          </div>
        </div>
      </div>
    {/if}

    {#if $battleState.phase === 'finished'}
      <div class="mt-4 flex flex-wrap gap-3">
        <button
          type="button"
          on:click={rematchBot}
          class="px-5 py-2.5 bg-red-600 hover:bg-red-500 text-white font-bold rounded-lg transition-colors"
        >
          Rematch Same Bot
        </button>
        <button
          type="button"
          on:click={leaveBattle}
          class="px-5 py-2.5 bg-gray-800 border border-gray-700 text-gray-300 rounded-lg hover:text-white hover:border-gray-500 transition-colors"
        >
          Back to Lobby
        </button>
      </div>
    {/if}
  {/if}
</div>
