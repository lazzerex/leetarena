<script lang="ts">
  import { fly, scale } from 'svelte/transition';
  import Card from './Card.svelte';
  import { battleState } from '$lib/stores';
  import type { UserCardWithData } from '$lib/stores';
  import Swords from 'lucide-svelte/icons/swords';
  import Check from 'lucide-svelte/icons/check';
  import Trophy from 'lucide-svelte/icons/trophy';
  import OctagonX from 'lucide-svelte/icons/octagon-x';

  export let onCardSelect: (card: UserCardWithData) => void = () => {};
  export let onConfirmPlay: () => void = () => {};

  interface LastRoundView {
    playerCardTitle?: string;
    botCardTitle?: string;
    playerAtk?: number;
    botAtk?: number;
    winner?: 'player' | 'bot' | 'tie';
  }

  function readLastRound(value: unknown): LastRoundView | null {
    if (!value || typeof value !== 'object') return null;
    return value as LastRoundView;
  }

  $: state = $battleState;
  $: myCards = state.myRemainingCards;
  $: selectedCard = myCards.find((c) => c.id === state.selectedCardId);
  $: phase = state.phase;
  $: lastRound = readLastRound(state.lastRound);
  $: playerRevealTitle = lastRound?.playerCardTitle ?? selectedCard?.card.title ?? 'Hidden';
  $: opponentRevealTitle = lastRound?.botCardTitle ?? 'Hidden';
  $: revealWinner = lastRound?.winner;
  $: revealPlayerAtk = lastRound?.playerAtk;
  $: revealBotAtk = lastRound?.botAtk;
</script>

<div class="flex flex-col h-full bg-gray-950 rounded-2xl overflow-hidden border border-gray-800">
  <!-- Opponent zone -->
  <div class="shrink-0 flex flex-col items-center justify-center px-4 py-3 md:py-4 border-b border-gray-800 min-h-[170px]">
    <p class="text-gray-400 text-sm mb-2 uppercase tracking-widest">Opponent ({state.opponentRemainingCards})</p>
    <div class="w-full overflow-x-auto">
      <div class="flex gap-2 min-w-max mx-auto px-1">
        {#each Array(state.opponentRemainingCards) as _, i}
          <div class="w-12 h-16 rounded-lg border border-gray-700 bg-gray-900 flex items-center justify-center">
            <span class="text-gray-600"><Swords size={12} /></span>
          </div>
        {/each}
      </div>
    </div>

    {#if state.opponentPlayed}
      <div in:scale class="mt-4 bg-green-900/40 border border-green-700 px-4 py-2 rounded-full text-green-400 text-sm font-medium">
        <span class="inline-flex items-center gap-1"><Check size={14} /> Opponent is ready</span>
      </div>
    {:else}
      <div class="mt-4 text-gray-600 text-sm">Waiting for opponent...</div>
    {/if}
  </div>

  <!-- Battle arena / last round result -->
  <div class="shrink-0 py-3 px-4 md:px-6 bg-gray-900/60 text-center min-h-[124px] flex items-center justify-center">
    {#if phase === 'revealing' || phase === 'round-result'}
      <div class="flex items-center gap-6" in:fly={{ y: -20, duration: 400 }}>
        <div class="text-center">
          <p class="text-xs text-gray-500 mb-1">You</p>
          <div class="w-24 h-28 rounded-lg border border-white/20 bg-gray-800/80 flex flex-col items-center justify-center text-gray-200 text-xs text-center p-2">
            <span class="line-clamp-2">{playerRevealTitle}</span>
            {#if typeof revealPlayerAtk === 'number' && phase === 'round-result'}
              <span class="mt-1 text-[11px] text-rose-300">ATK {revealPlayerAtk}</span>
            {/if}
          </div>
        </div>
        <div class="text-center min-w-[52px]">
          <div class="text-2xl font-bold text-white">VS</div>
          {#if phase === 'round-result' && revealWinner}
            <div
              class="mt-1 text-[11px] font-semibold uppercase tracking-wide"
              class:text-emerald-300={revealWinner === 'player'}
              class:text-rose-300={revealWinner === 'bot'}
              class:text-gray-300={revealWinner === 'tie'}
            >
              {revealWinner === 'player' ? 'You Win' : revealWinner === 'bot' ? 'Bot Wins' : 'Tie'}
            </div>
          {/if}
        </div>
        <div class="text-center">
          <p class="text-xs text-gray-500 mb-1">Opponent</p>
          <div class="w-24 h-28 rounded-lg border border-white/20 bg-gray-800/80 flex flex-col items-center justify-center text-gray-200 text-xs text-center p-2">
            <span class="line-clamp-2">{opponentRevealTitle}</span>
            {#if typeof revealBotAtk === 'number' && phase === 'round-result'}
              <span class="mt-1 text-[11px] text-rose-300">ATK {revealBotAtk}</span>
            {/if}
          </div>
        </div>
      </div>
    {:else if phase === 'finished'}
      <div class="text-center" in:scale>
        {#if state.winner === state.myPlayerId}
          <p class="text-3xl font-black text-amber-400 inline-flex items-center gap-2"><Trophy size={28} /> Victory</p>
        {:else}
          <p class="text-3xl font-black text-gray-400 inline-flex items-center gap-2"><OctagonX size={28} /> Defeat</p>
        {/if}
      </div>
    {:else}
      <p class="text-gray-600 text-sm">
        {phase === 'selecting' ? 'Select a card to play' : 'Battle arena'}
      </p>
    {/if}
  </div>

  <!-- Timer -->
  {#if phase === 'selecting'}
    <div class="shrink-0 px-4 md:px-6 py-2 bg-gray-900 text-center">
      <div class="flex items-center justify-center gap-2">
        <div class="h-1.5 flex-1 bg-gray-700 rounded-full overflow-hidden">
          <div
            class="h-full rounded-full transition-all duration-1000"
            class:bg-green-500={state.secondsLeft > 15}
            class:bg-yellow-500={state.secondsLeft <= 15 && state.secondsLeft > 5}
            class:bg-red-500={state.secondsLeft <= 5}
            style="width: {(state.secondsLeft / 30) * 100}%"
          ></div>
        </div>
        <span class="text-sm font-mono text-gray-400 w-6">{state.secondsLeft}s</span>
      </div>
    </div>
  {/if}

  <!-- My hand -->
  <div class="flex-1 min-h-0 p-4 bg-gray-950 flex flex-col">
    <p class="text-gray-400 text-sm mb-3 text-center uppercase tracking-widest">Your Hand ({myCards.length})</p>
    <div class="flex-1 min-h-0 overflow-x-auto overflow-y-hidden pb-2">
      <div class="flex items-start gap-3 sm:gap-4 min-w-max mx-auto px-3 pt-1 pb-3">
        {#each myCards as card (card.id)}
          <div
            class={`shrink-0 cursor-pointer transition-transform hover:-translate-y-1 rounded-2xl ${
              card.id === state.selectedCardId ? 'ring-2 ring-white/70 ring-offset-2 ring-offset-gray-950' : ''
            }`}
            on:click={() => onCardSelect(card)}
            on:keypress={(e) => e.key === 'Enter' && onCardSelect(card)}
            role="button"
            tabindex="0"
          >
            <Card
              title={card.card.title}
              titleSlug={card.card.titleSlug}
              rarity={card.card.rarity}
              elementType={card.card.elementType}
              catalogType={(card.card.catalog_type ?? card.card.catalogType) === 'extended' ? 'extended' : 'core'}
              baseAtk={card.card.baseAtk}
              baseDef={card.card.baseDef}
              baseHp={card.card.baseHp}
              tier={card.tier}
              compact={true}
              selected={false}
            />
          </div>
        {/each}
      </div>
    </div>

    {#if selectedCard && phase === 'selecting'}
      <div class="mt-4 text-center" in:fly={{ y: 10, duration: 200 }}>
        <button
          class="px-8 py-3 bg-red-600 hover:bg-red-500 text-white font-bold rounded-xl text-lg transition-colors shadow-lg"
          on:click={onConfirmPlay}
        >
          <span class="inline-flex items-center gap-2"><Swords size={18} /> Play {selectedCard.card.title}</span>
        </button>
      </div>
    {/if}
  </div>
</div>
