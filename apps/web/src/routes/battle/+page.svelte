<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { goto } from '$app/navigation';
  import { currentUser, battleState, resetBattle, notify } from '$lib/stores';
  import { supabase } from '$lib/supabase';
  import { api } from '$lib/api';
  import BattleBoard from '$lib/components/BattleBoard.svelte';
  import type { UserCardWithData } from '$lib/stores';

  let decks: any[] = [];
  let selectedDeckId = '';
  let queueing = false;
  let channel: any = null;

  onMount(async () => {
    if (!$currentUser) { goto('/login'); return; }
    const { data } = await supabase
      .from('decks')
      .select('*')
      .eq('user_id', $currentUser.id);
    decks = data ?? [];
    if (decks[0]) selectedDeckId = decks[0].id;
  });

  onDestroy(() => {
    if (channel) supabase.removeChannel(channel);
  });

  async function joinQueue() {
    if (!selectedDeckId || !$currentUser) return;
    queueing = true;

    try {
      // In production: use a matchmaking queue (Supabase table + realtime).
      // For MVP: create a battle against a bot / open challenge.
      notify('info', 'Looking for opponent...');

      // Subscribe to matchmaking channel
      channel = supabase.channel(`matchmaking:${$currentUser.id}`)
        .on('broadcast', { event: 'matched' }, async ({ payload }) => {
          const { battleId, opponentId, deck2Id } = payload as any;
          battleState.update((s) => ({
            ...s,
            battleId,
            phase: 'selecting',
            myPlayerId: $currentUser!.id,
            opponentId,
          }));
          await loadBattleCards(selectedDeckId);
          subscribeToChannel(battleId);
          queueing = false;
        })
        .subscribe();

      // Post to matchmaking table
      await supabase.from('matchmaking_queue').upsert({
        user_id: $currentUser.id,
        deck_id: selectedDeckId,
        queued_at: new Date().toISOString(),
      });

    } catch (e: any) {
      notify('error', e.message);
      queueing = false;
    }
  }

  async function loadBattleCards(deckId: string) {
    const { data: deck } = await supabase.from('decks').select('*').eq('id', deckId).single();
    if (!deck) return;

    const { data: userCards } = await supabase
      .from('user_cards')
      .select('*, cards(*)')
      .in('id', deck.card_ids);

    battleState.update((s) => ({
      ...s,
      myRemainingCards: (userCards ?? []) as UserCardWithData[],
    }));
  }

  function subscribeToChannel(battleId: string) {
    channel = supabase.channel(`battle:${battleId}`)
      .on('broadcast', { event: 'card_played' }, ({ payload }) => {
        if (payload.playerId !== $currentUser?.id) {
          battleState.update((s) => ({ ...s, opponentPlayed: true }));
        }
        checkBothPlayed(battleId);
      })
      .on('broadcast', { event: 'turn_result' }, ({ payload }) => {
        battleState.update((s) => ({
          ...s,
          phase: 'round-result',
          lastRound: payload.round,
        }));
      })
      .on('broadcast', { event: 'battle_end' }, ({ payload }) => {
        battleState.update((s) => ({
          ...s,
          phase: 'finished',
          winner: payload.winnerId,
        }));
        if (payload.winnerId === $currentUser?.id) {
          notify('success', `Victory. +${payload.rewards.winnerCoins} coins`);
        } else {
          notify('info', `Defeat. +${payload.rewards.loserCoins} coins`);
        }
      })
      .subscribe();
  }

  async function checkBothPlayed(battleId: string) {
    const s = $battleState;
    if (s.selectedCardId && s.opponentPlayed) {
      battleState.update((st) => ({ ...st, phase: 'revealing' }));
    }
  }

  async function selectCard(card: UserCardWithData) {
    battleState.update((s) => ({ ...s, selectedCardId: card.id }));
  }

  async function confirmPlay() {
    const s = $battleState;
    if (!s.selectedCardId || !s.battleId || !$currentUser) return;

    await supabase.channel(`battle:${s.battleId}`).send({
      type: 'broadcast',
      event: 'card_played',
      payload: { playerId: $currentUser.id, cardId: s.selectedCardId },
    });

    battleState.update((st) => ({ ...st, opponentPlayed: st.opponentPlayed }));
  }

  function leaveQueue() {
    queueing = false;
    if (channel) supabase.removeChannel(channel);
    supabase.from('matchmaking_queue').delete().eq('user_id', $currentUser?.id ?? '');
  }
</script>

<svelte:head><title>Battle — LeetArena</title></svelte:head>

<div class="max-w-7xl mx-auto px-4 py-8">
  {#if $battleState.phase === 'lobby'}
    <h1 class="text-3xl font-black mb-2">Battle Arena</h1>
    <p class="text-gray-500 mb-8">Challenge other trainers in real-time card battles.</p>

    <div class="max-w-md">
      <div class="bg-gray-900 border border-gray-800 rounded-2xl p-6">
        <h2 class="font-black text-xl mb-4">Find a Match</h2>

        {#if decks.length === 0}
          <div class="text-center py-6">
            <p class="text-gray-400 mb-4">You need a deck to battle!</p>
            <a href="/deck-builder" class="px-6 py-2 bg-amber-500 text-black font-bold rounded-xl hover:bg-amber-400 transition-colors">
              Build a Deck →
            </a>
          </div>
        {:else}
          <div class="mb-4">
            <label class="text-sm text-gray-400 block mb-1.5">Select Deck</label>
            <select bind:value={selectedDeckId}
              class="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white focus:outline-none">
              {#each decks as deck}
                <option value={deck.id}>{deck.name} ({deck.card_ids?.length ?? 0} cards)</option>
              {/each}
            </select>
          </div>

          {#if !queueing}
            <button
              on:click={joinQueue}
              disabled={!selectedDeckId}
              class="w-full py-3 bg-red-600 hover:bg-red-500 text-white font-black text-lg rounded-xl transition-colors disabled:opacity-40"
            >
              Find Opponent
            </button>
          {:else}
            <div class="text-center py-4">
              <div class="text-sm tracking-wide uppercase text-sky-200/80 mb-2">Matchmaking</div>
              <p class="text-gray-400 font-medium mb-4">Searching for opponent...</p>
              <button on:click={leaveQueue} class="text-sm text-red-400 hover:text-red-300 underline">
                Leave queue
              </button>
            </div>
          {/if}
        {/if}
      </div>

      <!-- Battle rules -->
      <div class="mt-6 bg-gray-900 border border-gray-800 rounded-2xl p-5 text-sm text-gray-400 space-y-2">
        <h3 class="text-white font-bold mb-3">Battle Rules</h3>
        <p>• Each player has 10 cards in their deck</p>
        <p>• Both players play 1 card face-down each turn</p>
        <p>• Cards are revealed simultaneously — highest ATK wins</p>
        <p>• Type advantage: 1.3× ATK when strong, 0.7× when weak</p>
        <p>• 30 seconds per turn — forfeit on timeout</p>
        <p>• First to discard all opponent's cards wins</p>
      </div>
    </div>

  {:else}
    <!-- Active battle -->
    <div class="h-[calc(100vh-80px)]">
      <BattleBoard onCardSelect={selectCard} onConfirmPlay={confirmPlay} />
    </div>
  {/if}
</div>
