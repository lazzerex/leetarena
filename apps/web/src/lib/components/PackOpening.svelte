<script lang="ts">
  import { fly, scale } from 'svelte/transition';
  import { flip } from 'svelte/animate';
  import { buildLeetCodeProblemUrl } from '$lib/leetcode';
  import Card from './Card.svelte';
  import AlgorithmCard from './AlgorithmCard.svelte';
  import {
    packRevealAlgorithmCards,
    packRevealCards,
    packRevealOpen,
  } from '$lib/stores';
  import Swords from 'lucide-svelte/icons/swords';
  import Check from 'lucide-svelte/icons/check';

  let revealIndex = -1;
  let allRevealed = false;

  $: cards = $packRevealCards;
  $: algorithmCards = $packRevealAlgorithmCards;
  $: revealItems = [
    ...cards.map((card) => ({ type: 'problem' as const, id: card.id, isNew: card.isNew, card })),
    ...algorithmCards.map((card) => ({ type: 'algorithm' as const, id: card.id, isNew: card.isNew, card })),
  ];

  function revealNext() {
    if (revealIndex < revealItems.length - 1) {
      revealIndex++;
    } else {
      allRevealed = true;
    }
  }

  function revealAll() {
    revealIndex = revealItems.length - 1;
    allRevealed = true;
  }

  function close() {
    packRevealOpen.set(false);
    packRevealCards.set([]);
    packRevealAlgorithmCards.set([]);
    revealIndex = -1;
    allRevealed = false;
  }

  $: newCards = revealItems.filter((item) => item.isNew);
</script>

{#if $packRevealOpen}
  <div
    class="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex flex-col items-center justify-center p-4"
    transition:fly={{ y: 20, duration: 300 }}
  >
    <h2 class="text-3xl font-bold text-white mb-2 tracking-widest uppercase">Pack Opened!</h2>
    {#if newCards.length > 0}
      <p class="text-amber-400 text-sm mb-6">{newCards.length} new reward{newCards.length !== 1 ? 's' : ''}!</p>
    {:else}
      <p class="text-gray-400 text-sm mb-6">Tap cards to reveal</p>
    {/if}

    <!-- Cards grid -->
    <div class="flex flex-wrap gap-3 justify-center mb-8 max-w-2xl">
      {#each revealItems as item, i (`${item.type}-${item.id}`)}
        <div animate:flip={{ duration: 300 }}>
          {#if i <= revealIndex}
            <div in:scale={{ duration: 400, delay: 50 }} class="relative text-center">
              {#if item.type === 'problem'}
                <Card
                  title={item.card.title}
                  titleSlug={item.card.titleSlug}
                  rarity={item.card.rarity}
                  elementType={item.card.elementType}
                  baseAtk={item.card.baseAtk}
                  baseDef={item.card.baseDef}
                  baseHp={item.card.baseHp}
                  tier="base"
                  compact={true}
                />
              {:else}
                <AlgorithmCard
                  name={item.card.name}
                  slug={item.card.slug}
                  description={item.card.description}
                  abilityName={item.card.abilityName}
                  abilityDescription={item.card.abilityDescription}
                  mode={item.card.mode}
                  themeTemplate={item.card.themeTemplate}
                  themeTokens={item.card.themeTokens}
                  compact={true}
                />
              {/if}

              {#if item.card.isNew}
                <div class="absolute -top-2 -right-2 bg-green-500 text-white text-xs px-1.5 py-0.5 rounded-full font-bold z-10">
                  NEW
                </div>
              {/if}

              {#if item.type === 'problem'}
                <a
                  href={buildLeetCodeProblemUrl(item.card.titleSlug)}
                  target="_blank"
                  rel="noopener noreferrer"
                  class="mt-2 inline-block text-xs text-amber-300 hover:text-amber-200 underline"
                >
                  View on LeetCode
                </a>
              {:else}
                <p class="mt-2 text-[11px] text-sky-200/80 uppercase tracking-wide">Trap / Effect Ready</p>
              {/if}
            </div>
          {:else}
            <!-- Hidden card back -->
            <button
              class="w-36 h-52 rounded-xl border-2 border-gray-600 bg-gradient-to-b from-gray-900 to-gray-800
                     flex items-center justify-center cursor-pointer hover:border-gray-400 transition-colors"
              on:click={revealNext}
            >
              <div class="text-center">
                <div class="text-3xl mb-1 inline-flex"><Swords size={24} /></div>
                <div class="text-gray-500 text-xs">Tap to reveal</div>
              </div>
            </button>
          {/if}
        </div>
      {/each}
    </div>

    <!-- Actions -->
    <div class="flex gap-3">
      {#if !allRevealed}
        <button
          class="px-6 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg font-medium transition-colors"
          on:click={revealAll}
        >
          Reveal All
        </button>
        <button
          class="px-6 py-2 bg-amber-500 hover:bg-amber-400 text-black rounded-lg font-bold transition-colors"
          on:click={revealNext}
        >
          Next Card
        </button>
      {:else}
        <button
          class="px-8 py-3 bg-amber-500 hover:bg-amber-400 text-black rounded-lg font-bold text-lg transition-colors"
          on:click={close}
        >
          <span class="inline-flex items-center gap-2"><Check size={16} /> Collect Cards</span>
        </button>
      {/if}
    </div>
  </div>
{/if}
