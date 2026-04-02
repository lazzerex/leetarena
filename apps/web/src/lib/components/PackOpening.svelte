<script lang="ts">
  import { fly } from 'svelte/transition';
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
  let revealSessionSignature = '';

  $: cards = $packRevealCards;
  $: algorithmCards = $packRevealAlgorithmCards;
  $: revealItems = [
    ...cards.map((card) => ({ type: 'problem' as const, id: card.id, isNew: card.isNew, card })),
    ...algorithmCards.map((card) => ({ type: 'algorithm' as const, id: card.id, isNew: card.isNew, card })),
  ];

  $: revealItemsSignature = revealItems.map((item) => `${item.type}-${item.id}`).join('|');

  $: if ($packRevealOpen && revealItemsSignature && revealItemsSignature !== revealSessionSignature) {
    revealSessionSignature = revealItemsSignature;
    revealIndex = -1;
    allRevealed = false;
  }

  $: if (!$packRevealOpen) {
    revealSessionSignature = '';
  }

  $: newCards = revealItems.filter((item) => item.isNew);

  function isRevealed(index: number): boolean {
    return index <= revealIndex;
  }

  function isNextReveal(index: number): boolean {
    return index === revealIndex + 1;
  }

  function revealNext() {
    if (revealItems.length === 0) return;

    if (revealIndex < revealItems.length - 1) {
      revealIndex += 1;
      if (revealIndex >= revealItems.length - 1) {
        allRevealed = true;
      }
      return;
    }

    allRevealed = true;
  }

  function revealFromSlot(index: number) {
    if (!isNextReveal(index)) return;
    revealNext();
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
</script>

{#if $packRevealOpen}
  <div
    class="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4"
    transition:fly={{ y: 20, duration: 300 }}
  >
    <div class="pack-reveal-shell relative w-full max-w-6xl max-h-[94vh] rounded-2xl border border-white/10 shadow-2xl p-4 sm:p-6 flex flex-col">
      <h2 class="text-2xl sm:text-3xl font-bold text-white mb-2 tracking-widest uppercase text-center">Pack Opened!</h2>
      {#if newCards.length > 0}
        <p class="text-amber-400 text-sm mb-4 text-center">{newCards.length} new reward{newCards.length !== 1 ? 's' : ''}!</p>
      {:else}
        <p class="text-gray-400 text-sm mb-4 text-center">Tap cards to reveal</p>
      {/if}

      <div class="flex-1 min-h-0 overflow-y-auto overflow-x-hidden pr-1">
        <div class="pack-grid">
          {#each revealItems as item, i (`${item.type}-${item.id}`)}
            <div animate:flip={{ duration: 260 }} class="reveal-item text-center">
              <div class="reveal-scene">
                <div class="reveal-inner" class:is-revealed={isRevealed(i)}>
                  <div class="reveal-face reveal-front-face">
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
                        abilityName={item.card.abilityName}
                        abilityDescription={item.card.abilityDescription}
                        mode={item.card.mode}
                        themeTemplate={item.card.themeTemplate}
                        themeTokens={item.card.themeTokens}
                        compact={true}
                      />
                    {/if}
                  </div>

                  <div class="reveal-face reveal-back-face">
                    <div
                      class="reveal-back-card w-36 h-52 rounded-xl border-2 border-slate-500/80 flex items-center justify-center transition-all duration-200"
                      class:back-clickable={isNextReveal(i)}
                      class:back-locked={!isNextReveal(i)}
                    >
                      <div class="reveal-back-art absolute inset-0" style="background-image: url('/assets/scifi-card/back.png');"></div>
                      <div class="reveal-back-overlay absolute inset-0"></div>
                      <div class="text-center relative z-10">
                        <div class="text-3xl mb-1 inline-flex"><Swords size={24} /></div>
                        <div class="text-cyan-100/85 text-xs tracking-wide">
                          {#if isNextReveal(i)}Tap to reveal{:else}Queued{/if}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {#if item.card.isNew && isRevealed(i)}
                  <div class="absolute -top-2 -right-2 bg-green-500 text-white text-xs px-1.5 py-0.5 rounded-full font-bold z-10 pointer-events-none">
                    NEW
                  </div>
                {/if}

                <button
                  type="button"
                  class="reveal-overlay-btn absolute inset-0 z-20"
                  aria-label={`Reveal card ${i + 1}`}
                  on:click={() => revealFromSlot(i)}
                  disabled={!isNextReveal(i) || isRevealed(i)}
                  tabindex={isNextReveal(i) && !isRevealed(i) ? 0 : -1}
                />
              </div>

              {#if isRevealed(i)}
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
              {/if}
            </div>
          {/each}
        </div>
      </div>

      <div class="flex gap-3 justify-center mt-4 pt-4 border-t border-white/10">
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
  </div>
{/if}

<style>
  .pack-reveal-shell {
    overflow: hidden;
    background:
      radial-gradient(circle at 20% 10%, rgba(125, 211, 252, 0.2), transparent 40%),
      radial-gradient(circle at 78% 22%, rgba(56, 189, 248, 0.15), transparent 48%),
      linear-gradient(180deg, rgba(2, 6, 23, 0.92), rgba(2, 6, 23, 0.96));
  }

  .pack-reveal-shell::before {
    content: '';
    position: absolute;
    inset: 0;
    pointer-events: none;
    background-image: url('/assets/scifi-card/playboard.png');
    background-size: cover;
    background-position: center;
    opacity: 0.22;
  }

  .pack-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, 9rem);
    justify-content: center;
    gap: 1rem 0.95rem;
  }

  .reveal-item {
    width: 9rem;
  }

  .reveal-scene {
    position: relative;
    width: 9rem;
    height: 13rem;
    perspective: 1200px;
  }

  .reveal-inner {
    position: relative;
    width: 100%;
    height: 100%;
    transform: rotateY(0deg);
    transform-origin: center;
    transform-style: preserve-3d;
    -webkit-transform-style: preserve-3d;
    transition: transform 480ms cubic-bezier(0.22, 1, 0.36, 1);
    will-change: transform;
  }

  .reveal-inner.is-revealed {
    transform: rotateY(180deg);
  }

  .reveal-face {
    position: absolute;
    inset: 0;
    backface-visibility: hidden;
    -webkit-backface-visibility: hidden;
  }

  .reveal-front-face {
    transform: rotateY(180deg);
  }

  .reveal-back-face {
    transform: rotateY(0deg);
  }

  .reveal-back-card {
    position: relative;
    overflow: hidden;
    box-shadow: 0 10px 18px -14px rgba(34, 211, 238, 0.6);
  }

  .reveal-back-art {
    background-repeat: no-repeat;
    background-position: center;
    background-size: 100% 100%;
  }

  .reveal-back-overlay {
    background:
      radial-gradient(circle at 50% 52%, rgba(34, 211, 238, 0.34) 0%, rgba(2, 6, 23, 0.06) 42%, rgba(2, 6, 23, 0.34) 100%),
      repeating-linear-gradient(180deg, rgba(148, 163, 184, 0.08) 0, rgba(148, 163, 184, 0.08) 1px, transparent 1px, transparent 4px);
  }

  .reveal-overlay-btn {
    background: transparent;
    border: 0;
    padding: 0;
    margin: 0;
    cursor: default;
  }

  .reveal-overlay-btn:disabled {
    pointer-events: none;
  }

  .back-clickable {
    cursor: pointer;
    border-color: rgba(103, 232, 249, 0.8);
    animation: revealPulse 1.5s ease-in-out infinite;
  }

  .back-locked {
    opacity: 0.72;
    filter: grayscale(0.2);
  }

  .reveal-back-card:hover.back-clickable {
    transform: translateY(-2px);
  }

  @keyframes revealPulse {
    0%,
    100% {
      box-shadow: 0 8px 16px -12px rgba(34, 211, 238, 0.42);
    }
    50% {
      box-shadow: 0 14px 24px -14px rgba(34, 211, 238, 0.8);
    }
  }

  @media (max-width: 640px) {
    .pack-grid {
      gap: 0.9rem 0.8rem;
    }
  }
</style>
