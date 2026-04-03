<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { authHydrated, currentUser, notify } from '$lib/stores';
  import { supabase } from '$lib/supabase';
  import LoaderCircle from 'lucide-svelte/icons/loader-circle';

  type DeckRecord = {
    id: string;
    name: string;
    card_ids: string[];
    created_at: string | null;
  };

  let loading = true;
  let deletingDeckId: string | null = null;
  let loadedForUserId: string | null = null;
  let redirectingToLogin = false;
  let decks: DeckRecord[] = [];

  function normalizeDeck(deck: any): DeckRecord {
    return {
      id: String(deck?.id ?? ''),
      name: String(deck?.name ?? 'My Deck'),
      card_ids: Array.isArray(deck?.card_ids) ? deck.card_ids : [],
      created_at: typeof deck?.created_at === 'string' ? deck.created_at : null,
    };
  }

  function formatDeckCreatedAt(value: string | null): string {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    return date.toLocaleDateString();
  }

  async function loadDecks(userId: string) {
    loading = true;
    decks = [];
    try {
      const { data, error } = await supabase
        .from('decks')
        .select('id,name,card_ids,created_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      decks = (data ?? []).map(normalizeDeck).filter((deck) => deck.id);
    } catch (e: any) {
      decks = [];
      notify('error', e?.message ?? 'Failed to load decks');
    } finally {
      loading = false;
    }
  }

  onMount(() => {
    loading = true;
  });

  $: if ($currentUser?.id && loadedForUserId !== $currentUser.id) {
    loadedForUserId = $currentUser.id;
    void loadDecks($currentUser.id);
  }

  $: if ($authHydrated && !$currentUser?.id && !redirectingToLogin) {
    redirectingToLogin = true;
    loading = false;
    decks = [];
    goto('/login');
  }

  async function openDeckBuilder(deckId: string) {
    await goto(`/deck-builder?deckId=${deckId}`);
  }

  async function createNewDeck() {
    await goto('/deck-builder');
  }

  async function deleteDeck(deckId: string) {
    if (!$currentUser) return;

    deletingDeckId = deckId;
    try {
      const { error } = await supabase
        .from('decks')
        .delete()
        .eq('id', deckId)
        .eq('user_id', $currentUser.id);

      if (error) throw error;

      decks = decks.filter((deck) => deck.id !== deckId);
      notify('success', 'Deck deleted');
    } catch (e: any) {
      notify('error', e?.message ?? 'Failed to delete deck');
    } finally {
      deletingDeckId = null;
    }
  }
</script>

<svelte:head><title>Deck Management — LeetArena</title></svelte:head>

<div class="max-w-6xl mx-auto px-4 py-8">
  <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
    <div>
      <h1 class="text-3xl font-black">Deck Management</h1>
      <p class="text-gray-500 text-sm mt-1">Choose a saved deck to edit, or start a fresh build.</p>
    </div>

    <div class="flex gap-2">
      <a
        href="/deck-builder"
        class="px-3 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg text-sm transition-colors"
      >
        Back to Builder
      </a>
      <button
        on:click={createNewDeck}
        class="px-3 py-2 bg-amber-500 hover:bg-amber-400 text-black font-bold rounded-lg text-sm transition-colors"
      >
        Build New Deck
      </button>
    </div>
  </div>

  {#if loading}
    <div class="bg-gray-900 border border-gray-800 rounded-2xl p-8 flex items-center justify-center">
      <LoaderCircle class="animate-spin text-slate-400" size={28} />
    </div>
  {:else if decks.length === 0}
    <div class="bg-gray-900 border border-gray-800 rounded-2xl p-10 text-center">
      <p class="text-lg font-bold text-white">No decks saved yet</p>
      <p class="text-sm text-gray-500 mt-1">Create your first deck in Deck Builder.</p>
      <button
        on:click={createNewDeck}
        class="mt-4 px-4 py-2 bg-amber-500 hover:bg-amber-400 text-black font-bold rounded-lg text-sm transition-colors"
      >
        Build New Deck
      </button>
    </div>
  {:else}
    <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
      {#each decks as deck (deck.id)}
        <article class="bg-gray-900 border border-gray-800 rounded-2xl p-4">
          <div class="flex items-start justify-between gap-3">
            <div class="min-w-0">
              <h2 class="font-black text-white truncate">{deck.name}</h2>
              <p class="text-xs text-gray-500 mt-1">
                {deck.card_ids.length}/10 cards
                {#if deck.created_at}
                  · created {formatDeckCreatedAt(deck.created_at)}
                {/if}
              </p>
            </div>
          </div>

          <div class="mt-4 flex gap-2">
            <button
              on:click={() => openDeckBuilder(deck.id)}
              class="flex-1 py-2 bg-sky-700 hover:bg-sky-600 text-white font-semibold rounded-lg text-sm transition-colors"
            >
              Edit in Builder
            </button>
            <button
              on:click={() => deleteDeck(deck.id)}
              disabled={deletingDeckId === deck.id}
              class="px-3 py-2 bg-gray-800 hover:bg-red-900/40 text-gray-400 hover:text-red-300 rounded-lg text-sm transition-colors disabled:opacity-40"
            >
              {deletingDeckId === deck.id ? 'Deleting...' : 'Delete'}
            </button>
          </div>
        </article>
      {/each}
    </div>
  {/if}
</div>
