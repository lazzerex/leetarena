<script lang="ts">
  import { onMount } from 'svelte';
  import { currentUser, userCollection, notify } from '$lib/stores';
  import { api } from '$lib/api';
  import Card from '$lib/components/Card.svelte';
  import LoaderCircle from 'lucide-svelte/icons/loader-circle';
  import Layers3 from 'lucide-svelte/icons/layers-3';

  let loading = true;
  let search = '';
  let filterRarity = 'all';
  let filterElement = 'all';
  let filterTier = 'all';
  let selectedCard: any = null;

  const rarities = ['all', 'common', 'rare', 'epic', 'legendary'];
  const elements = ['all', 'Array', 'Graph', 'Tree', 'Math', 'DynamicProgramming', 'String'];
  const tiers = ['all', 'locked', 'base', 'proven', 'mastered'];

  onMount(async () => {
    if ($currentUser) {
      try {
        const collection = await api.getCollection($currentUser.id);
        userCollection.set(collection as any[]);
      } catch (e: any) {
        notify('error', 'Failed to load collection');
      }
    }
    loading = false;
  });

  $: filtered = $userCollection.filter((uc: any) => {
    const card = uc.card ?? uc;
    if (search && !card.title?.toLowerCase().includes(search.toLowerCase())) return false;
    if (filterRarity !== 'all' && card.rarity !== filterRarity) return false;
    if (filterElement !== 'all' && card.element_type !== filterElement) return false;
    if (filterTier !== 'all' && uc.tier !== filterTier) return false;
    return true;
  });

  $: stats = {
    total: $userCollection.length,
    mastered: $userCollection.filter((c: any) => c.tier === 'mastered').length,
    proven: $userCollection.filter((c: any) => c.tier === 'proven').length,
    legendary: $userCollection.filter((c: any) => (c.card ?? c).rarity === 'legendary').length,
  };
</script>

<svelte:head><title>Collection — LeetArena</title></svelte:head>

<div class="max-w-7xl mx-auto px-4 py-8">
  <!-- Header -->
  <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
    <div>
      <h1 class="text-3xl font-black">My Collection</h1>
      <p class="text-gray-500 text-sm mt-0.5">{$userCollection.length} cards owned</p>
    </div>

    <!-- Stats row -->
    <div class="flex gap-4 text-center">
      {#each [
        { label: 'Total', value: stats.total, color: 'text-white' },
        { label: 'Mastered', value: stats.mastered, color: 'text-amber-400' },
        { label: 'Proven', value: stats.proven, color: 'text-yellow-300' },
        { label: 'Legendary', value: stats.legendary, color: 'text-amber-500' },
      ] as stat}
        <div class="bg-gray-900 border border-gray-800 rounded-xl px-3 py-2 min-w-16">
          <div class="font-black text-lg {stat.color}">{stat.value}</div>
          <div class="text-gray-500 text-xs">{stat.label}</div>
        </div>
      {/each}
    </div>
  </div>

  <!-- Filters -->
  <div class="bg-gray-900 border border-gray-800 rounded-xl p-4 mb-6 flex flex-wrap gap-3 items-center">
    <input
      bind:value={search}
      placeholder="Search cards..."
      class="flex-1 min-w-40 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-gray-500 text-white placeholder-gray-500"
    />

    <select bind:value={filterRarity}
      class="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none">
      {#each rarities as r}
        <option value={r}>{r === 'all' ? 'All Rarities' : r.charAt(0).toUpperCase() + r.slice(1)}</option>
      {/each}
    </select>

    <select bind:value={filterElement}
      class="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none">
      {#each elements as e}
        <option value={e}>{e === 'all' ? 'All Elements' : e}</option>
      {/each}
    </select>

    <select bind:value={filterTier}
      class="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none">
      {#each tiers as t}
        <option value={t}>{t === 'all' ? 'All Tiers' : t.charAt(0).toUpperCase() + t.slice(1)}</option>
      {/each}
    </select>

    <span class="text-gray-500 text-sm ml-auto">{filtered.length} shown</span>
  </div>

  <!-- Cards grid -->
  {#if loading}
    <div class="flex items-center justify-center py-24">
      <LoaderCircle class="animate-spin text-slate-400" size={30} />
    </div>
  {:else if filtered.length === 0}
    <div class="text-center py-24">
      <div class="text-6xl mb-4 inline-flex text-slate-500"><Layers3 size={42} /></div>
      <p class="text-gray-400 text-lg font-bold mb-2">No cards found</p>
      <p class="text-gray-600 text-sm">
        {$userCollection.length === 0 ? 'Open some packs to start your collection!' : 'Try adjusting your filters.'}
      </p>
      {#if $userCollection.length === 0}
        <a href="/packs" class="inline-block mt-4 px-6 py-2 bg-amber-500 text-black font-bold rounded-xl hover:bg-amber-400 transition-colors">
          Open Packs →
        </a>
      {/if}
    </div>
  {:else}
    <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
      {#each filtered as uc (uc.id)}
        {@const card = uc.card ?? uc}
        <div>
          <Card
            title={card.title ?? ''}
            titleSlug={card.title_slug ?? card.titleSlug ?? ''}
            rarity={card.rarity ?? 'common'}
            elementType={card.element_type ?? card.elementType ?? 'Array'}
            baseAtk={card.base_atk ?? card.baseAtk ?? 0}
            baseDef={card.base_def ?? card.baseDef ?? 0}
            baseHp={card.base_hp ?? card.baseHp ?? 0}
            tier={uc.tier ?? 'base'}
            isBlind75={card.is_blind75 ?? card.isBlind75 ?? false}
            compact={true}
            onClick={() => selectedCard = uc}
          />
        </div>
      {/each}
    </div>
  {/if}
</div>

<!-- Card detail modal -->
{#if selectedCard}
  {@const card = selectedCard.card ?? selectedCard}
  <div class="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
       on:click={() => selectedCard = null}
       on:keypress={(e) => e.key === 'Escape' && (selectedCard = null)}
       role="dialog" tabindex="-1">
    <div class="bg-gray-900 border border-gray-800 rounded-2xl p-6 max-w-sm w-full"
         on:click|stopPropagation={() => {}}
         on:keypress|stopPropagation={() => {}}>
      <div class="flex justify-center mb-4">
        <Card
          title={card.title ?? ''}
          titleSlug={card.title_slug ?? card.titleSlug ?? ''}
          rarity={card.rarity ?? 'common'}
          elementType={card.element_type ?? card.elementType ?? 'Array'}
          baseAtk={card.base_atk ?? card.baseAtk ?? 0}
          baseDef={card.base_def ?? card.baseDef ?? 0}
          baseHp={card.base_hp ?? card.baseHp ?? 0}
          tier={selectedCard.tier ?? 'base'}
          isBlind75={card.is_blind75 ?? card.isBlind75 ?? false}
        />
      </div>

      <div class="space-y-2 text-sm">
        <div class="flex justify-between">
          <span class="text-gray-500">Tier</span>
          <span class="font-bold capitalize">{selectedCard.tier ?? 'base'}</span>
        </div>
        <div class="flex justify-between">
          <span class="text-gray-500">Difficulty</span>
          <span class="font-bold">{card.difficulty ?? '—'}</span>
        </div>
        <div class="flex justify-between">
          <span class="text-gray-500">Element</span>
          <span class="font-bold">{card.element_type ?? card.elementType ?? '—'}</span>
        </div>
        <div class="flex justify-between">
          <span class="text-gray-500">Tags</span>
          <span class="text-right text-gray-400 text-xs max-w-36 truncate">
            {(card.tags ?? []).join(', ') || '—'}
          </span>
        </div>
      </div>

      <a
        href="https://leetcode.com/problems/{card.title_slug ?? card.titleSlug}/"
        target="_blank"
        rel="noopener noreferrer"
        class="mt-4 w-full block text-center py-2 bg-amber-500 hover:bg-amber-400 text-black font-bold rounded-xl text-sm transition-colors"
      >
        Solve on LeetCode ↗
      </a>

      <button
        on:click={() => selectedCard = null}
        class="mt-2 w-full py-2 bg-gray-800 hover:bg-gray-700 text-gray-400 rounded-xl text-sm transition-colors"
      >
        Close
      </button>
    </div>
  </div>
{/if}
