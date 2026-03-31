<script lang="ts">
  import { onMount } from 'svelte';
  import { currentUser, userCollection, deckBuilderCards, deckName, deckIsValid,
           addToDeck, removeFromDeck, notify } from '$lib/stores';
  import { api } from '$lib/api';
  import { supabase } from '$lib/supabase';
  import { buildLeetCodeProblemUrl } from '$lib/leetcode';
  import Card from '$lib/components/Card.svelte';
  import LoaderCircle from 'lucide-svelte/icons/loader-circle';

  let loading = true;
  let saving = false;
  let search = '';
  let filterElement = 'all';
  let loadedForUserId: string | null = null;

  const elements = ['all', 'Array', 'Graph', 'Tree', 'Math', 'DynamicProgramming', 'String'];

  function pickCard(uc: any) {
    const raw = uc?.card ?? uc?.cards ?? uc;
    return Array.isArray(raw) ? (raw[0] ?? {}) : raw;
  }

  async function loadDeckBuilderData(userId: string) {
    loading = true;
    try {
      const collection = await api.getCollection(userId);
      userCollection.set(collection as any[]);
    } catch (e: any) {
      userCollection.set([]);
      notify('error', e?.message ?? 'Failed to load collection for deck builder');
    } finally {
      loading = false;
    }
  }

  onMount(() => {
    loading = true;
  });

  $: if ($currentUser?.id && loadedForUserId !== $currentUser.id) {
    loadedForUserId = $currentUser.id;
    deckBuilderCards.set([]);
    void loadDeckBuilderData($currentUser.id);
  }

  $: available = $userCollection.filter((uc: any) => {
    const card = pickCard(uc);
    if (uc.tier === 'locked') return false;
    const inDeck = $deckBuilderCards.find((d) => d.id === uc.id);
    if (inDeck) return false;
    if (search && !card.title?.toLowerCase().includes(search.toLowerCase())) return false;
    if (filterElement !== 'all' && (card.element_type ?? card.elementType) !== filterElement) return false;
    return true;
  });

  $: deckSlots = Array.from({ length: 10 }, (_unused, index) => $deckBuilderCards[index] ?? null);

  $: deckElements = new Set($deckBuilderCards.map((c) => c.card?.element_type ?? c.card?.elementType));

  async function saveDeck() {
    if (!$currentUser) return;
    if (!$deckIsValid) {
      notify('error', 'Deck needs exactly 10 cards with at least 2 different elements');
      return;
    }
    saving = true;
    try {
      await supabase.from('decks').insert({
        user_id: $currentUser.id,
        name: $deckName,
        card_ids: $deckBuilderCards.map((c) => c.id),
        created_at: new Date().toISOString(),
      });
      notify('success', `Deck "${$deckName}" saved!`);
    } catch (e: any) {
      notify('error', 'Failed to save deck');
    } finally {
      saving = false;
    }
  }

  function clearDeck() {
    deckBuilderCards.set([]);
  }

  function addCardToDeck(uc: any) {
    if (uc?.tier === 'locked') {
      notify('error', 'Locked cards cannot be added to deck');
      return;
    }
    addToDeck(uc);
  }
</script>

<svelte:head><title>Deck Builder — LeetArena</title></svelte:head>

<div class="max-w-7xl mx-auto px-4 py-8">
  <h1 class="text-3xl font-black mb-6">Deck Builder</h1>

  <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
    <!-- Left: Collection to pick from -->
    <div class="lg:col-span-2">
      <div class="bg-gray-900 border border-gray-800 rounded-2xl p-4">
        <div class="flex flex-wrap gap-2 mb-4">
          <input
            bind:value={search}
            placeholder="Search collection..."
            class="flex-1 min-w-40 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-gray-500 text-white placeholder-gray-500"
          />
          <select bind:value={filterElement}
            class="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none">
            {#each elements as e}
              <option value={e}>{e === 'all' ? 'All Elements' : e}</option>
            {/each}
          </select>
        </div>

        {#if loading}
          <div class="flex items-center justify-center py-12">
            <LoaderCircle class="animate-spin text-slate-400" size={26} />
          </div>
        {:else if available.length === 0}
          <div class="text-center py-12 text-gray-500">
            {$userCollection.length === 0 ? 'Open packs to get cards first!' : 'No matching cards'}
          </div>
        {:else}
          <div class="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3 max-h-[600px] overflow-y-auto pr-1">
            {#each available as uc (uc.id)}
              {@const card = pickCard(uc)}
              <div class="cursor-pointer hover:scale-105 transition-transform"
                   on:click={() => addCardToDeck(uc)}
                   on:keypress={(e) => e.key === 'Enter' && addCardToDeck(uc)}
                   role="button" tabindex="0">
                <Card
                  title={card.title ?? ''}
                  titleSlug={card.title_slug ?? card.titleSlug ?? ''}
                  rarity={card.rarity ?? 'common'}
                  elementType={card.element_type ?? card.elementType ?? 'Array'}
                  baseAtk={card.base_atk ?? card.baseAtk ?? 0}
                  baseDef={card.base_def ?? card.baseDef ?? 0}
                  baseHp={card.base_hp ?? card.baseHp ?? 0}
                  tier={uc.tier ?? 'base'}
                  compact={true}
                />
              </div>
            {/each}
          </div>
        {/if}
      </div>
    </div>

    <!-- Right: Deck being built -->
    <div>
      <div class="bg-gray-900 border border-gray-800 rounded-2xl p-4 sticky top-20">
        <div class="flex items-center justify-between mb-3">
          <h2 class="font-black text-lg">Your Deck</h2>
          <span class="text-sm font-bold"
            class:text-green-400={$deckBuilderCards.length === 10}
            class:text-gray-400={$deckBuilderCards.length < 10}
          >
            {$deckBuilderCards.length}/10
          </span>
        </div>

        <!-- Deck name -->
        <input
          bind:value={$deckName}
          placeholder="Deck name..."
          class="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm mb-3 focus:outline-none focus:border-gray-500 text-white"
        />

        <!-- Element diversity indicator -->
        {#if $deckBuilderCards.length > 0}
          <div class="mb-3 flex flex-wrap gap-1">
            {#each [...deckElements] as el}
              <span class="text-xs px-2 py-0.5 rounded-full bg-gray-800 border border-gray-700 text-gray-300">{el}</span>
            {/each}
            {#if deckElements.size < 2}
              <span class="text-xs text-red-400">⚠ Need 2+ element types</span>
            {/if}
          </div>
        {/if}

        <!-- Stable 10 deck slots -->
        <div class="space-y-1.5 mb-4 max-h-80 overflow-y-auto">
          {#each deckSlots as uc, i}
            {#if uc}
              {@const card = pickCard(uc)}
              <div class="flex items-center gap-2 bg-gray-800 rounded-lg px-3 py-2">
                <span class="text-gray-500 text-xs w-4">{i + 1}</span>
                <div class="flex-1 min-w-0">
                  <p class="text-sm font-medium truncate">{card.title}</p>
                  <p class="text-xs text-gray-500">{card.element_type ?? card.elementType} · {card.rarity}</p>
                </div>
                <a
                  href={buildLeetCodeProblemUrl(card.title_slug ?? card.titleSlug)}
                  target="_blank"
                  rel="noopener noreferrer"
                  class="text-xs text-amber-300 hover:text-amber-200 underline"
                >
                  View
                </a>
                <button
                  on:click={() => removeFromDeck(uc.id)}
                  class="text-gray-600 hover:text-red-400 text-lg leading-none transition-colors"
                >×</button>
              </div>
            {:else}
              <div class="flex items-center gap-2 bg-gray-800/40 border border-dashed border-gray-700 rounded-lg px-3 py-2">
                <span class="text-gray-600 text-xs w-4">{i + 1}</span>
                <span class="text-gray-700 text-sm">Empty slot</span>
              </div>
            {/if}
          {/each}
        </div>

        <!-- Actions -->
        <div class="flex gap-2">
          <button
            on:click={clearDeck}
            disabled={$deckBuilderCards.length === 0}
            class="px-3 py-2 bg-gray-800 hover:bg-gray-700 text-gray-400 rounded-lg text-sm transition-colors disabled:opacity-40"
          >
            Clear
          </button>
          <button
            on:click={saveDeck}
            disabled={!$deckIsValid || saving}
            class="flex-1 py-2 bg-amber-500 hover:bg-amber-400 text-black font-bold rounded-lg text-sm transition-colors disabled:opacity-40"
          >
            {saving ? 'Saving...' : $deckIsValid ? '✓ Save Deck' : 'Needs 10 cards'}
          </button>
        </div>
      </div>
    </div>
  </div>
</div>
