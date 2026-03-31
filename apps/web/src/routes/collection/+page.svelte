<script lang="ts">
  import { onMount } from 'svelte';
  import { currentUser, userAlgoCards, userCollection, notify } from '$lib/stores';
  import { api } from '$lib/api';
  import { buildLeetCodeProblemUrl } from '$lib/leetcode';
  import AlgorithmCard from '$lib/components/AlgorithmCard.svelte';
  import Card from '$lib/components/Card.svelte';
  import LoaderCircle from 'lucide-svelte/icons/loader-circle';
  import Layers3 from 'lucide-svelte/icons/layers-3';

  let loading = true;
  let search = '';
  let filterRarity = 'all';
  let filterElement = 'all';
  let filterTier = 'owned';
  let catalogView: 'core' | 'extended' | 'all' = 'core';
  let selectedCard: any = null;
  let equipping = false;
  let targetedSyncing = false;
  let targetedSyncingSlug: string | null = null;
  let syncGuideOpen = false;
  let syncFeedback: { type: 'error' | 'info' | 'success'; message: string } | null = null;
  let loadedForUserId: string | null = null;

  const rarities = ['all', 'common', 'rare', 'epic', 'legendary'];
  const elements = ['all', 'Array', 'Graph', 'Tree', 'Math', 'DynamicProgramming', 'String'];
  const tiers = ['owned', 'all', 'locked', 'base', 'proven', 'mastered'];

  function pickCard(uc: any) {
    const raw = uc?.card ?? uc?.cards ?? uc;
    return Array.isArray(raw) ? (raw[0] ?? {}) : raw;
  }

  function isBattleCoreCard(uc: any): boolean {
    const card = pickCard(uc);
    return card?.catalog_type === 'core' && Boolean(card?.is_seeded_core);
  }

  function isExtendedCard(uc: any): boolean {
    return !isBattleCoreCard(uc);
  }

  function getCardTitleSlug(card: any): string {
    return (card?.title_slug ?? card?.titleSlug ?? '').trim();
  }

  function isSeededCoreCatalogCard(card: any): boolean {
    const catalogType = card?.catalog_type ?? card?.catalogType;
    const isSeededCore = Boolean(card?.is_seeded_core ?? card?.isSeededCore);
    return catalogType === 'core' && isSeededCore;
  }

  function matchesTierFilter(userCardTier: string | undefined): boolean {
    const tier = userCardTier ?? 'base';
    if (filterTier === 'all') return true;
    if (filterTier === 'owned') return tier !== 'locked';
    return tier === filterTier;
  }

  function setModalSyncFeedback(
    titleSlug: string,
    feedback: { type: 'error' | 'info' | 'success'; message: string }
  ) {
    const selectedSlug = getCardTitleSlug(pickCard(selectedCard));
    if (selectedSlug === titleSlug) {
      syncFeedback = feedback;
    }
  }

  function openCardModal(uc: any) {
    selectedCard = uc;
    syncGuideOpen = false;
    syncFeedback = null;
  }

  function closeCardModal() {
    selectedCard = null;
    syncGuideOpen = false;
    syncFeedback = null;
  }

  async function loadCollectionData(userId: string) {
    loading = true;

    try {
      const collection = await api.getCollection(userId);
      userCollection.set(collection as any[]);
    } catch (e: any) {
      notify('error', e?.message ?? 'Failed to load collection');
      userCollection.set([]);
    }

    try {
      const algorithms = await api.getAlgorithmCollection(userId);
      userAlgoCards.set(algorithms as any[]);
    } catch {
      // Keep core collection visible even if algorithm cards endpoint is unavailable.
      userAlgoCards.set([]);
    }

    loading = false;
  }

  onMount(() => {
    loading = true;
  });

  $: if ($currentUser?.id && loadedForUserId !== $currentUser.id) {
    loadedForUserId = $currentUser.id;
    void loadCollectionData($currentUser.id);
  }

  $: algoNameById = new Map($userAlgoCards.map((algo) => [algo.id, algo.name]));

  function getEquippedAlgoName(algoId: string | undefined | null): string {
    if (!algoId) return 'None';
    return algoNameById.get(algoId) ?? 'Unknown';
  }

  async function equipAlgorithm(slot: 1 | 2, algoId: string) {
    if (!$currentUser || !selectedCard || equipping) return;
    const card = pickCard(selectedCard);
    if (!card?.id) return;

    const field = slot === 1 ? 'equipped_algo_1' : 'equipped_algo_2';
    const currentAlgoId = selectedCard?.[field] ?? null;
    const nextAlgoId: string | null = currentAlgoId === algoId ? null : algoId;

    equipping = true;
    try {
      await api.equipAlgo($currentUser.id, card.id, nextAlgoId, slot);

      selectedCard = {
        ...selectedCard,
        [field]: nextAlgoId,
      };

      userCollection.update((rows) => rows.map((row: any) =>
        row.id === selectedCard.id
          ? { ...row, [field]: nextAlgoId }
          : row
      ));

      if (nextAlgoId) {
        notify('success', `Equipped ${getEquippedAlgoName(nextAlgoId)} to slot ${slot}`);
      } else {
        notify('success', `Unequipped slot ${slot}`);
      }
    } catch (e: any) {
      notify('error', e.message ?? 'Failed to equip algorithm card');
    } finally {
      equipping = false;
    }
  }

  $: hasLinkedLeetCode = Boolean(($currentUser as any)?.leetcodeUsername ?? ($currentUser as any)?.leetcode_username);

  async function syncSelectedLockedCoreCard() {
    if (!selectedCard) return;
    await syncLockedCoreCard(selectedCard);
  }

  async function syncLockedCoreCard(uc: any) {
    if (!$currentUser || !uc || targetedSyncing) return;

    const card = pickCard(uc);
    if (uc.tier !== 'locked' || !isSeededCoreCatalogCard(card)) {
      return;
    }

    const titleSlug = getCardTitleSlug(card);
    if (!titleSlug) {
      setModalSyncFeedback(titleSlug, { type: 'error', message: 'Cannot sync this card: missing title slug.' });
      notify('error', 'Cannot sync this card: missing title slug');
      return;
    }

    setModalSyncFeedback(titleSlug, { type: 'info', message: 'Sync in progress...' });
    targetedSyncing = true;
    targetedSyncingSlug = titleSlug;
    try {
      const result = await api.targetedSync($currentUser.id, titleSlug);

      if (result.status === 'unlocked' || result.status === 'upgraded' || result.status === 'already_unlocked') {
        userCollection.update((rows) =>
          rows.map((row: any) => {
            const rowCard = pickCard(row);
            if (getCardTitleSlug(rowCard) !== titleSlug) return row;
            if (row.tier !== 'locked') return row;
            return { ...row, tier: 'base' };
          })
        );

        if (selectedCard && getCardTitleSlug(pickCard(selectedCard)) === titleSlug) {
          selectedCard = {
            ...selectedCard,
            tier: 'base',
          };
        }

        setModalSyncFeedback(titleSlug, {
          type: 'success',
          message: `Synced successfully. ${card.title ?? titleSlug} is now unlocked.`,
        });
        notify('success', `Unlocked ${card.title ?? titleSlug} via targeted sync`);
        return;
      }

      if (result.status === 'not_found') {
        setModalSyncFeedback(titleSlug, {
          type: 'info',
          message: result.message ?? 'No accepted submission found for this problem yet.',
        });
        notify('info', result.message ?? 'No accepted submission found for this problem yet');
      } else if (result.status === 'out_of_catalog') {
        setModalSyncFeedback(titleSlug, {
          type: 'info',
          message: 'This problem is not currently eligible for core unlock sync.',
        });
        notify('info', 'This problem is not currently eligible for core unlock sync');
      } else if (result.status === 'no_metadata') {
        setModalSyncFeedback(titleSlug, {
          type: 'error',
          message: 'Unable to fetch metadata for this problem right now. Please retry shortly.',
        });
        notify('error', 'Unable to fetch metadata for this problem right now');
      } else {
        setModalSyncFeedback(titleSlug, { type: 'info', message: `Sync status: ${result.status}` });
        notify('info', `Sync status: ${result.status}`);
      }
    } catch (e: any) {
      setModalSyncFeedback(titleSlug, {
        type: 'error',
        message: e?.message ?? 'Targeted sync failed. Please try again in a moment.',
      });
      notify('error', e?.message ?? 'Targeted sync failed');
    } finally {
      targetedSyncing = false;
      targetedSyncingSlug = null;
    }
  }

  $: filtered = $userCollection.filter((uc: any) => {
    const card = pickCard(uc);

    if (catalogView === 'core' && !isBattleCoreCard(uc)) return false;
    if (catalogView === 'extended' && !isExtendedCard(uc)) return false;

    if (search && !card.title?.toLowerCase().includes(search.toLowerCase())) return false;
    if (filterRarity !== 'all' && card.rarity !== filterRarity) return false;
    if (filterElement !== 'all' && card.element_type !== filterElement) return false;
    if (!matchesTierFilter(uc.tier)) return false;
    return true;
  });

  $: ownedCards = $userCollection.filter((c: any) => c.tier !== 'locked');
  $: coreBattleCards = $userCollection.filter((c: any) => isBattleCoreCard(c));
  $: extendedCards = $userCollection.filter((c: any) => isExtendedCard(c));
  $: coreOwnedCards = coreBattleCards.filter((c: any) => c.tier !== 'locked');
  $: extendedOwnedCards = extendedCards.filter((c: any) => c.tier !== 'locked');

  $: stats = {
    total: ownedCards.length,
    mastered: $userCollection.filter((c: any) => c.tier === 'mastered').length,
    proven: $userCollection.filter((c: any) => c.tier === 'proven').length,
    legendary: ownedCards.filter((c: any) => pickCard(c).rarity === 'legendary').length,
  };
</script>

<svelte:head><title>Collection — LeetArena</title></svelte:head>

<div class="max-w-7xl mx-auto px-4 py-8">
  <!-- Header -->
  <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
    <div>
      <h1 class="text-3xl font-black">My Collection</h1>
      <p class="text-gray-500 text-sm mt-0.5">{ownedCards.length} cards owned</p>
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

  <div class="mb-4 bg-gray-900 border border-gray-800 rounded-xl p-3">
    <div class="flex flex-wrap items-center gap-2">
      <button
        on:click={() => (catalogView = 'core')}
        class="px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors"
        class:bg-sky-700={catalogView === 'core'}
        class:text-white={catalogView === 'core'}
        class:bg-gray-800={catalogView !== 'core'}
        class:text-gray-300={catalogView !== 'core'}
      >
        Core Battle List ({coreOwnedCards.length} unlocked / {coreBattleCards.length} total)
      </button>
      <button
        on:click={() => (catalogView = 'extended')}
        class="px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors"
        class:bg-violet-700={catalogView === 'extended'}
        class:text-white={catalogView === 'extended'}
        class:bg-gray-800={catalogView !== 'extended'}
        class:text-gray-300={catalogView !== 'extended'}
      >
        Extended Sync List ({extendedOwnedCards.length} unlocked / {extendedCards.length} total)
      </button>
      <button
        on:click={() => (catalogView = 'all')}
        class="px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors"
        class:bg-amber-600={catalogView === 'all'}
        class:text-black={catalogView === 'all'}
        class:bg-gray-800={catalogView !== 'all'}
        class:text-gray-300={catalogView !== 'all'}
      >
        All Catalog ({$userCollection.length})
      </button>
    </div>
    <p class="text-xs text-gray-500 mt-2">
      Core list is battle-eligible seeded catalog. Extended list shows optional synced variety cards.
    </p>
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
        <option value={t}>
          {#if t === 'owned'}
            Owned (Unlocked)
          {:else if t === 'all'}
            All Tiers
          {:else}
            {t.charAt(0).toUpperCase() + t.slice(1)}
          {/if}
        </option>
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
        {#if $userCollection.length === 0}
          Open some packs to start your collection!
        {:else if catalogView === 'core'}
          No cards in core battle list match your filters.
        {:else if catalogView === 'extended'}
          No cards in extended sync list match your filters.
        {:else}
          Try adjusting your filters.
        {/if}
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
        {@const card = pickCard(uc)}
        <div class="space-y-2">
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
            onClick={() => openCardModal(uc)}
          />

          {#if uc.tier === 'locked' && isSeededCoreCatalogCard(card)}
            <button
              on:click={() => syncLockedCoreCard(uc)}
              disabled={targetedSyncing || !hasLinkedLeetCode}
              class="w-full py-1.5 px-2 rounded-lg text-xs font-semibold transition-colors disabled:opacity-50 bg-sky-700 hover:bg-sky-600 text-white"
            >
              {#if targetedSyncing && targetedSyncingSlug === getCardTitleSlug(card)}
                Syncing...
              {:else if !hasLinkedLeetCode}
                Link LeetCode To Sync
              {:else}
                Sync Unlock
              {/if}
            </button>
          {/if}
        </div>
      {/each}
    </div>
  {/if}

  <section class="mt-10 bg-gray-900 border border-gray-800 rounded-2xl p-5">
    <div class="flex items-center justify-between gap-4 mb-4">
      <div>
        <h2 class="text-xl font-black">Algorithm Trap/Effect Cards</h2>
        <p class="text-xs text-gray-500 mt-1">Pack-obtainable and immediately usable. No leveling tiers.</p>
      </div>
      <span class="text-sm text-sky-200 font-semibold">{$userAlgoCards.length} owned</span>
    </div>

    {#if $userAlgoCards.length === 0}
      <p class="text-sm text-gray-500">Open packs to obtain your first trap/effect card.</p>
    {:else}
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {#each $userAlgoCards as algo (algo.id)}
          <AlgorithmCard
            name={algo.name}
            slug={algo.slug}
            description={algo.description}
            abilityName={algo.abilityName}
            abilityDescription={algo.abilityDescription}
            mode={algo.mode}
            themeTemplate={algo.themeTemplate}
            themeTokens={algo.themeTokens}
            compact={true}
          />
        {/each}
      </div>
    {/if}
  </section>
</div>

<!-- Card detail modal -->
{#if selectedCard}
  {@const card = pickCard(selectedCard)}
  <!-- svelte-ignore a11y-no-static-element-interactions -->
  <!-- svelte-ignore a11y-no-noninteractive-element-interactions -->
  <div class="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
      on:click={closeCardModal}
      on:keypress={(e) => e.key === 'Escape' && closeCardModal()}
       role="dialog" tabindex="-1">
    <!-- svelte-ignore a11y-no-static-element-interactions -->
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
        <div class="flex justify-between">
          <span class="text-gray-500">Trap Slot 1</span>
          <span class="font-bold text-xs">{getEquippedAlgoName(selectedCard.equipped_algo_1)}</span>
        </div>
        <div class="flex justify-between">
          <span class="text-gray-500">Trap Slot 2</span>
          <span class="font-bold text-xs">{getEquippedAlgoName(selectedCard.equipped_algo_2)}</span>
        </div>
      </div>

      <div class="mt-4 border-t border-gray-800 pt-4">
        <p class="text-xs uppercase tracking-wide text-gray-400 mb-2">Equip Trap/Effect Card</p>
        {#if $userAlgoCards.length === 0}
          <p class="text-xs text-gray-500">No algorithm cards available yet.</p>
        {:else}
          <div class="max-h-40 overflow-y-auto space-y-2 pr-1">
            {#each $userAlgoCards as algo (algo.id)}
              <div class="bg-gray-800/70 border border-gray-700 rounded-lg p-2 flex items-center justify-between gap-2">
                <div class="min-w-0">
                  <p class="text-xs font-semibold truncate">{algo.name}</p>
                  <p class="text-[11px] text-gray-400 truncate">{algo.abilityName}</p>
                </div>
                <div class="flex gap-1 shrink-0">
                  <button
                    on:click={() => equipAlgorithm(1, algo.id)}
                    disabled={equipping}
                    class="px-2 py-1 rounded text-[11px] font-semibold text-white disabled:opacity-50"
                    class:bg-rose-700={selectedCard.equipped_algo_1 === algo.id}
                    class:hover:bg-rose-600={selectedCard.equipped_algo_1 === algo.id}
                    class:bg-sky-700={selectedCard.equipped_algo_1 !== algo.id}
                    class:hover:bg-sky-600={selectedCard.equipped_algo_1 !== algo.id}
                  >
                    {selectedCard.equipped_algo_1 === algo.id ? 'Unequip 1' : 'Slot 1'}
                  </button>
                  <button
                    on:click={() => equipAlgorithm(2, algo.id)}
                    disabled={equipping}
                    class="px-2 py-1 rounded text-[11px] font-semibold text-white disabled:opacity-50"
                    class:bg-rose-700={selectedCard.equipped_algo_2 === algo.id}
                    class:hover:bg-rose-600={selectedCard.equipped_algo_2 === algo.id}
                    class:bg-indigo-700={selectedCard.equipped_algo_2 !== algo.id}
                    class:hover:bg-indigo-600={selectedCard.equipped_algo_2 !== algo.id}
                  >
                    {selectedCard.equipped_algo_2 === algo.id ? 'Unequip 2' : 'Slot 2'}
                  </button>
                </div>
              </div>
            {/each}
          </div>
        {/if}
      </div>

      <a
        href={buildLeetCodeProblemUrl(card.title_slug ?? card.titleSlug)}
        target="_blank"
        rel="noopener noreferrer"
        class="mt-4 w-full block text-center py-2 bg-amber-500 hover:bg-amber-400 text-black font-bold rounded-xl text-sm transition-colors"
      >
        View on LeetCode ↗
      </a>

      {#if selectedCard.tier === 'locked' && isSeededCoreCatalogCard(card)}
        <button
          on:click={syncSelectedLockedCoreCard}
          disabled={targetedSyncing || !hasLinkedLeetCode}
          class="mt-2 w-full py-2 bg-sky-700 hover:bg-sky-600 text-white font-semibold rounded-xl text-sm transition-colors disabled:opacity-50"
        >
          {#if targetedSyncing}
            Syncing...
          {:else if !hasLinkedLeetCode}
            Connect LeetCode In Profile To Sync
          {:else}
            Sync This Locked Core Card
          {/if}
        </button>
        <p class="mt-1 text-[11px] text-gray-500">
          Targeted sync checks this problem only. Subject to per-card and hourly sync limits.
        </p>

        <button
          on:click={() => (syncGuideOpen = true)}
          class="mt-2 w-full py-2 bg-gray-800 hover:bg-gray-700 text-gray-200 font-semibold rounded-xl text-sm transition-colors"
        >
          How Sync Works
        </button>

        {#if syncFeedback}
          <div
            class={`mt-2 rounded-xl border px-3 py-2 text-xs leading-relaxed ${syncFeedback.type === 'error'
              ? 'border-red-500/40 bg-red-500/10 text-red-200'
              : syncFeedback.type === 'success'
                ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-200'
                : 'border-sky-500/40 bg-sky-500/10 text-sky-200'}`}
          >
            {syncFeedback.message}
          </div>
        {/if}
      {/if}

      <button
        on:click={closeCardModal}
        class="mt-2 w-full py-2 bg-gray-800 hover:bg-gray-700 text-gray-400 rounded-xl text-sm transition-colors"
      >
        Close
      </button>
    </div>
  </div>
{/if}

{#if selectedCard && syncGuideOpen}
  <!-- svelte-ignore a11y-no-static-element-interactions -->
  <!-- svelte-ignore a11y-no-noninteractive-element-interactions -->
  <div
    class="fixed inset-0 z-[60] bg-black/75 backdrop-blur-sm flex items-center justify-center p-4"
    on:click={() => (syncGuideOpen = false)}
    on:keypress={(e) => e.key === 'Escape' && (syncGuideOpen = false)}
    role="dialog"
    tabindex="-1"
  >
    <!-- svelte-ignore a11y-no-static-element-interactions -->
    <div
      class="bg-gray-900 border border-gray-700 rounded-2xl p-5 max-w-md w-full"
      on:click|stopPropagation={() => {}}
      on:keypress|stopPropagation={() => {}}
    >
      <h3 class="text-lg font-black">Locked Core Sync Guide</h3>
      <p class="text-xs text-gray-400 mt-1">Use targeted sync to unlock one seeded core card at a time.</p>

      <div class="mt-4 space-y-3 text-sm text-gray-200">
        <div class="rounded-xl border border-gray-700 bg-gray-800/60 p-3">
          <p class="font-semibold text-amber-300">1. Link your LeetCode username</p>
          <p class="text-xs text-gray-300 mt-1">Set it in Profile first. Sync is disabled until it is linked.</p>
        </div>
        <div class="rounded-xl border border-gray-700 bg-gray-800/60 p-3">
          <p class="font-semibold text-amber-300">2. Solve this exact problem</p>
          <p class="text-xs text-gray-300 mt-1">You need an accepted submission for this card's title slug.</p>
        </div>
        <div class="rounded-xl border border-gray-700 bg-gray-800/60 p-3">
          <p class="font-semibold text-amber-300">3. Respect sync limits</p>
          <p class="text-xs text-gray-300 mt-1">There is a per-card cooldown and an hourly cap for targeted sync attempts.</p>
        </div>
      </div>

      <div class="mt-4 rounded-xl border border-gray-700 bg-gray-800/60 p-3 text-xs text-gray-300">
        If sync returns an error, an in-modal message will explain what failed so you can retry after fixing the issue.
      </div>

      <button
        on:click={() => (syncGuideOpen = false)}
        class="mt-4 w-full py-2 bg-sky-700 hover:bg-sky-600 text-white font-semibold rounded-xl text-sm transition-colors"
      >
        Got It
      </button>
    </div>
  </div>
{/if}
