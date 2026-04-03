<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { authHydrated, currentUser, userAlgoCards, userCollection, notify } from '$lib/stores';
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
  let filtered: any[] = [];
  let catalogView: 'core' | 'extended' | 'all' = 'core';
  let selectedCard: any = null;
  let selectedAlgoCard: any = null;
  let equipping = false;
  let targetedSyncing = false;
  let targetedSyncingSlug: string | null = null;
  let syncGuideOpen = false;
  let syncFeedback: { type: 'error' | 'info' | 'success'; message: string } | null = null;
  let loadedForUserId: string | null = null;
  let problemSummaryLoading = false;
  let problemSummaryText: string | null = null;
  let problemSummarySource: 'leetcode' | 'fallback' | 'unavailable' = 'fallback';
  let problemSummaryLoadedSlug: string | null = null;
  let problemSummaryRequestId = 0;
  let redirectingToLogin = false;
  const problemSummaryCache = new Map<string, { summary: string | null; source: 'leetcode' | 'unavailable' }>();

  const rarities = ['all', 'common', 'rare', 'epic', 'legendary'];
  const elements = ['all', 'Array', 'Graph', 'Tree', 'Math', 'DynamicProgramming', 'String'];
  const tiers = ['owned', 'all', 'locked', 'base', 'proven', 'mastered'];
  const PROBLEM_TIER_ORDER = ['locked', 'base', 'proven', 'mastered'] as const;
  const CORE_DUPLICATES_TO_MASTERED = 20;
  const EXTENDED_MATCHED_SOLVES_TO_PROVEN = 3;
  const EXTENDED_GEMS_TO_MASTERED = 5;

  type ProblemTier = typeof PROBLEM_TIER_ORDER[number];

  function pickCard(uc: any) {
    const raw = uc?.card ?? uc?.cards ?? uc;
    return Array.isArray(raw) ? (raw[0] ?? {}) : raw;
  }

  function isBattleCoreCard(uc: any): boolean {
    const card = pickCard(uc);
    const catalogType = card?.catalog_type ?? card?.catalogType;
    const isSeededCore = Boolean(card?.is_seeded_core ?? card?.isSeededCore);
    return catalogType === 'core' && isSeededCore;
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

  function getElementLabel(element: string | undefined): string {
    if (!element) return 'Algorithm';
    if (element === 'DynamicProgramming') return 'Dynamic Programming';
    return element;
  }

  function shortenAlgoAbilityName(value: string, maxLength: number): string {
    let normalized = value.trim().replace(/\s+/g, ' ');
    if (!normalized) return 'Battle Protocol';
    if (normalized.length <= maxLength) return normalized;

    const replacements: Array<[RegExp, string]> = [
      [/\bcompression\b/gi, 'compress'],
      [/\bprotocol\b/gi, 'proto'],
      [/\boptimization\b/gi, 'opt'],
      [/\bability\b/gi, 'abil.'],
      [/\balgorithm\b/gi, 'algo'],
      [/\bwithout\b/gi, 'w/o'],
    ];

    for (const [pattern, replacement] of replacements) {
      normalized = normalized.replace(pattern, replacement).replace(/\s+/g, ' ').trim();
      if (normalized.length <= maxLength) return normalized;
    }

    return `${normalized.slice(0, Math.max(0, maxLength - 1)).trim()}…`;
  }

  function normalizeProblemTier(value: unknown): ProblemTier {
    return PROBLEM_TIER_ORDER.includes(value as ProblemTier)
      ? (value as ProblemTier)
      : 'base';
  }

  function getProblemTierIndex(tier: ProblemTier): number {
    return PROBLEM_TIER_ORDER.indexOf(tier);
  }

  function formatProblemTier(tier: ProblemTier): string {
    if (tier === 'locked') return 'Locked';
    if (tier === 'base') return 'Base';
    if (tier === 'proven') return 'Proven';
    return 'Mastered';
  }

  function getCardCatalogType(card: any): 'core' | 'extended' {
    const catalogType = card?.catalog_type ?? card?.catalogType;
    return catalogType === 'extended' ? 'extended' : 'core';
  }

  function normalizeElementKey(value: unknown): string {
    return String(value ?? '')
      .trim()
      .replace(/\s+/g, '')
      .toLowerCase();
  }

  function getCardElement(card: any): string {
    return String(card?.element_type ?? card?.elementType ?? '').trim();
  }

  function getCardRarity(card: any): string {
    return String(card?.rarity ?? '').trim().toLowerCase();
  }

  function getDuplicateCount(uc: any): number {
    const raw = Number(uc?.duplicate_count ?? 0);
    if (!Number.isFinite(raw) || raw < 0) return 0;
    return Math.floor(raw);
  }

  function getExtendedProgressCount(uc: any): number {
    const slugs = uc?.extended_progress_slugs;
    if (!Array.isArray(slugs)) return 0;
    return slugs.filter((entry: unknown) => typeof entry === 'string' && entry.trim().length > 0).length;
  }

  function clamp01(value: number): number {
    if (!Number.isFinite(value)) return 0;
    if (value <= 0) return 0;
    if (value >= 1) return 1;
    return value;
  }

  function getTierProgressPercent(uc: any, card: any): number {
    const tier = normalizeProblemTier(uc?.tier);
    const catalogType = getCardCatalogType(card);

    if (tier === 'mastered') return 100;
    if (tier === 'locked') return 4;

    if (catalogType === 'core') {
      const duplicates = getDuplicateCount(uc);

      if (tier === 'base') {
        return (1 / 3) * 100;
      }

      const stage = clamp01(
        duplicates / CORE_DUPLICATES_TO_MASTERED
      );
      return ((2 + stage) / 3) * 100;
    }

    if (tier === 'base') {
      const progress = getExtendedProgressCount(uc);
      const stage = clamp01(progress / EXTENDED_MATCHED_SOLVES_TO_PROVEN);
      return ((1 + stage) / 3) * 100;
    }

    return (2 / 3) * 100;
  }

  function getTierConditionSummary(uc: any, card: any): { current: string; next: string | null } {
    const tier = normalizeProblemTier(uc?.tier);
    const catalogType = getCardCatalogType(card);

    if (catalogType === 'core') {
      const duplicates = getDuplicateCount(uc);

      if (tier === 'locked') {
        return {
          current: 'Locked tier: not battle-ready yet.',
          next: 'Ownership condition: open this card from packs, or sync an accepted solve for this exact problem.',
        };
      }

      if (tier === 'base') {
        return {
          current: 'Base tier: standard battle stats are active.',
          next: `Level up condition: solve this exact problem on LeetCode and run Sync to reach Proven. Duplicate progress toward Mastered is tracked (${duplicates}/${CORE_DUPLICATES_TO_MASTERED}).`,
        };
      }

      if (tier === 'proven') {
        return {
          current: 'Proven tier: improved battle stats are active.',
          next: `Level up condition: collect ${CORE_DUPLICATES_TO_MASTERED} total duplicates to reach Mastered (${duplicates}/${CORE_DUPLICATES_TO_MASTERED}).`,
        };
      }

      return {
        current: 'Mastered tier: maximum battle stats unlocked.',
        next: null,
      };
    }

    const progress = getExtendedProgressCount(uc);

    if (tier === 'locked') {
      return {
        current: 'Locked tier: not battle-ready yet.',
        next: 'Level up condition: sync an accepted solve for this specific problem to unlock Base tier.',
      };
    }

    if (tier === 'base') {
      return {
        current: 'Base tier: extended progression tracks unique tag-matching solves.',
        next: `Level up condition: solve ${EXTENDED_MATCHED_SOLVES_TO_PROVEN} unique tag-matching problems to reach Proven (${progress}/${EXTENDED_MATCHED_SOLVES_TO_PROVEN}).`,
      };
    }

    if (tier === 'proven') {
      return {
        current: 'Proven tier: improved battle stats are active.',
        next: `Level up condition: spend ${EXTENDED_GEMS_TO_MASTERED} Extended Gems to upgrade to Mastered tier.`,
      };
    }

    return {
      current: 'Mastered tier: maximum battle stats unlocked.',
      next: null,
    };
  }

  function buildFallbackCardSummary(card: any, tier: string): string {
    const difficulty = card?.difficulty ?? 'Unknown';
    const element = getElementLabel(card?.element_type ?? card?.elementType);
    const tags = Array.isArray(card?.tags) ? card.tags.filter(Boolean) : [];
    const tagsSnippet = tags.length > 0 ? ` Focused on ${tags.slice(0, 2).join(' and ')}.` : '';

    if (tier === 'locked') {
      return `${difficulty} ${element} card.${tagsSnippet} Obtain it from packs (or sync an accepted solve) to unlock it for deck use.`;
    }

    if (tier === 'mastered') {
      return `${difficulty} ${element} card in mastered form.${tagsSnippet} This one is fully battle-ready for your deck.`;
    }

    return `${difficulty} ${element} card.${tagsSnippet} Keep solving and collecting duplicates to push it to higher tiers.`;
  }

  async function loadCardProblemSummary(card: any) {
    const titleSlug = getCardTitleSlug(card);
    problemSummaryLoadedSlug = titleSlug || null;
    problemSummaryText = null;
    problemSummarySource = 'fallback';

    if (!titleSlug) {
      problemSummaryLoading = false;
      return;
    }

    const cached = problemSummaryCache.get(titleSlug);
    if (cached) {
      problemSummaryText = cached.summary;
      problemSummarySource = cached.source;
      problemSummaryLoading = false;
      return;
    }

    const requestId = ++problemSummaryRequestId;
    problemSummaryLoading = true;

    try {
      const response = await api.getProblemSummary(titleSlug);
      if (requestId !== problemSummaryRequestId) return;

      const summary = typeof response.summary === 'string' && response.summary.trim().length > 0
        ? response.summary.trim()
        : null;

      problemSummaryCache.set(titleSlug, {
        summary,
        source: response.source,
      });

      problemSummaryText = summary;
      problemSummarySource = response.source;
    } catch {
      if (requestId !== problemSummaryRequestId) return;
      problemSummaryText = null;
      problemSummarySource = 'unavailable';
    } finally {
      if (requestId === problemSummaryRequestId) {
        problemSummaryLoading = false;
      }
    }
  }

  function matchesTierFilter(userCardTier: string | undefined, activeFilterTier: string): boolean {
    const tier = userCardTier ?? 'base';
    if (activeFilterTier === 'all') return true;
    if (activeFilterTier === 'owned') return tier !== 'locked';
    return tier === activeFilterTier;
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
    void loadCardProblemSummary(pickCard(uc));
  }

  function closeCardModal() {
    selectedCard = null;
    syncGuideOpen = false;
    syncFeedback = null;
    problemSummaryRequestId += 1;
    problemSummaryLoading = false;
    problemSummaryText = null;
    problemSummarySource = 'fallback';
    problemSummaryLoadedSlug = null;
  }

  function openAlgoCardModal(algo: any) {
    selectedAlgoCard = algo;
  }

  function closeAlgoCardModal() {
    selectedAlgoCard = null;
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

  $: if ($authHydrated && !$currentUser?.id && !redirectingToLogin) {
    redirectingToLogin = true;
    loading = false;
    userCollection.set([]);
    userAlgoCards.set([]);
    goto('/login');
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
    const otherField = slot === 1 ? 'equipped_algo_2' : 'equipped_algo_1';
    const selectedCardRowId = selectedCard.id;
    const currentAlgoId = selectedCard?.[field] ?? null;
    const nextAlgoId: string | null = currentAlgoId === algoId ? null : algoId;

    equipping = true;
    try {
      const result = await api.equipAlgo($currentUser.id, card.id, nextAlgoId, slot);

      const nextSelectedCard = {
        ...selectedCard,
        [field]: nextAlgoId,
      };
      if (nextAlgoId && nextSelectedCard[otherField] === nextAlgoId) {
        nextSelectedCard[otherField] = null;
      }
      selectedCard = nextSelectedCard;

      userCollection.update((rows) => rows.map((row: any) =>
        row.id === selectedCardRowId
          ? (() => {
              const updated = { ...row, [field]: nextAlgoId };
              if (nextAlgoId && updated[otherField] === nextAlgoId) {
                updated[otherField] = null;
              }
              return updated;
            })()
          : nextAlgoId && (row.equipped_algo_1 === nextAlgoId || row.equipped_algo_2 === nextAlgoId)
            ? {
                ...row,
                equipped_algo_1: row.equipped_algo_1 === nextAlgoId ? null : row.equipped_algo_1,
                equipped_algo_2: row.equipped_algo_2 === nextAlgoId ? null : row.equipped_algo_2,
              }
            : row
      ));

      if (nextAlgoId) {
        notify('success', `Equipped ${getEquippedAlgoName(nextAlgoId)} to slot ${slot}`);
        if ((result?.movedFromCards ?? 0) > 0) {
          notify('info', 'This algorithm card was moved from another problem card to keep equip limits valid.');
        }
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
        const refreshedCollection = await api.getCollection($currentUser.id);
        userCollection.set(refreshedCollection as any[]);

        const updatedRow = (refreshedCollection as any[]).find((row: any) => {
          const rowCard = pickCard(row);
          return getCardTitleSlug(rowCard) === titleSlug;
        });
        if (updatedRow && selectedCard && getCardTitleSlug(pickCard(selectedCard)) === titleSlug) {
          selectedCard = updatedRow;
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
    const title = String(card?.title ?? '').toLowerCase();
    const rarity = getCardRarity(card);
    const cardElementKey = normalizeElementKey(getCardElement(card));
    const filterElementKey = normalizeElementKey(filterElement);

    if (catalogView === 'core' && !isBattleCoreCard(uc)) return false;
    if (catalogView === 'extended' && !isExtendedCard(uc)) return false;

    if (search && !title.includes(search.toLowerCase())) return false;
    if (filterRarity !== 'all' && rarity !== filterRarity.toLowerCase()) return false;
    if (filterElement !== 'all' && cardElementKey !== filterElementKey) return false;
    if (!matchesTierFilter(uc.tier, filterTier)) return false;
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
      <p class="text-gray-500 text-sm mt-0.5">{ownedCards.length} unlocked cards</p>
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
            catalogType={getCardCatalogType(card)}
            baseAtk={card.base_atk ?? card.baseAtk ?? 0}
            baseDef={card.base_def ?? card.baseDef ?? 0}
            baseHp={card.base_hp ?? card.baseHp ?? 0}
            tier={uc.tier ?? 'base'}
            isBlind75={card.is_blind75 ?? card.isBlind75 ?? false}
            compact={true}
            onClick={() => openCardModal(uc)}
          />

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
      <p class="text-[11px] text-gray-500 mb-3">Click any algorithm card to view full details.</p>
      <div class="flex flex-wrap gap-3">
        {#each $userAlgoCards as algo (algo.id)}
          <button
            type="button"
            on:click={() => openAlgoCardModal(algo)}
            class="text-left rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/70"
          >
            <AlgorithmCard
              name={algo.name}
              slug={algo.slug}
              abilityName={algo.abilityName}
              abilityDescription={algo.abilityDescription}
              mode={algo.mode}
              themeTemplate={algo.themeTemplate}
              themeTokens={algo.themeTokens}
              compact={true}
            />
          </button>
        {/each}
      </div>
    {/if}
  </section>
</div>

{#if selectedAlgoCard}
  <!-- svelte-ignore a11y-no-static-element-interactions -->
  <!-- svelte-ignore a11y-no-noninteractive-element-interactions -->
  <div
    class="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
    on:click={closeAlgoCardModal}
    on:keypress={(e) => e.key === 'Escape' && closeAlgoCardModal()}
    role="dialog"
    tabindex="-1"
  >
    <!-- svelte-ignore a11y-no-static-element-interactions -->
    <div
      class="bg-gray-900 border border-gray-800 rounded-2xl p-5 sm:p-6 max-w-lg w-full max-h-[88vh] overflow-y-auto"
      on:click|stopPropagation={() => {}}
      on:keypress|stopPropagation={() => {}}
    >
      <div class="flex justify-center mb-4">
        <AlgorithmCard
          name={selectedAlgoCard.name}
          slug={selectedAlgoCard.slug}
          abilityName={selectedAlgoCard.abilityName}
          abilityDescription={selectedAlgoCard.abilityDescription}
          mode={selectedAlgoCard.mode}
          themeTemplate={selectedAlgoCard.themeTemplate}
          themeTokens={selectedAlgoCard.themeTokens}
          compact={false}
        />
      </div>

      <div class="space-y-3 text-sm">
        <div class="flex justify-between gap-3">
          <span class="text-gray-500">Type</span>
          <span class="font-bold uppercase">{selectedAlgoCard.mode ?? 'effect'} card</span>
        </div>
        <div class="flex justify-between gap-3">
          <span class="text-gray-500">Theme</span>
          <span class="font-bold uppercase">{selectedAlgoCard.themeTemplate ?? 'stone'}</span>
        </div>
        <div class="rounded-xl border border-gray-800 bg-gray-800/50 px-3 py-2">
          <p class="text-[11px] uppercase tracking-wide text-gray-400 mb-1">Description</p>
          <p class="text-sm text-gray-200 leading-relaxed">{selectedAlgoCard.description || 'No description available.'}</p>
        </div>
        <div class="rounded-xl border border-gray-800 bg-gray-800/50 px-3 py-2">
          <p class="text-[11px] uppercase tracking-wide text-gray-400 mb-1">Ability</p>
          <p class="text-sm font-semibold text-sky-200" title={selectedAlgoCard.abilityName || 'Battle Protocol'}>
            {shortenAlgoAbilityName(selectedAlgoCard.abilityName || 'Battle Protocol', 24)}
          </p>
          <p class="text-sm text-gray-200 leading-relaxed mt-1">{selectedAlgoCard.abilityDescription || 'No ability detail available.'}</p>
        </div>
      </div>

      <button
        on:click={closeAlgoCardModal}
        class="mt-4 w-full py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-xl text-sm transition-colors"
      >
        Close
      </button>
    </div>
  </div>
{/if}

<!-- Card detail modal -->
{#if selectedCard}
  {@const card = pickCard(selectedCard)}
  {@const currentTier = normalizeProblemTier(selectedCard.tier)}
  {@const currentTierIndex = getProblemTierIndex(currentTier)}
  {@const tierProgressPercent = getTierProgressPercent(selectedCard, card)}
  {@const tierConditionSummary = getTierConditionSummary(selectedCard, card)}
  <!-- svelte-ignore a11y-no-static-element-interactions -->
  <!-- svelte-ignore a11y-no-noninteractive-element-interactions -->
  <div class="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
      on:click={closeCardModal}
      on:keypress={(e) => e.key === 'Escape' && closeCardModal()}
       role="dialog" tabindex="-1">
    <!-- svelte-ignore a11y-no-static-element-interactions -->
    <div class="bg-gray-900 border border-gray-800 rounded-2xl p-5 sm:p-6 max-w-xl w-full max-h-[88vh] overflow-y-auto"
         on:click|stopPropagation={() => {}}
         on:keypress|stopPropagation={() => {}}>
      <div class="flex justify-center mb-3">
        <Card
          title={card.title ?? ''}
          titleSlug={card.title_slug ?? card.titleSlug ?? ''}
          rarity={card.rarity ?? 'common'}
          elementType={card.element_type ?? card.elementType ?? 'Array'}
          catalogType={getCardCatalogType(card)}
          baseAtk={card.base_atk ?? card.baseAtk ?? 0}
          baseDef={card.base_def ?? card.baseDef ?? 0}
          baseHp={card.base_hp ?? card.baseHp ?? 0}
          tier={selectedCard.tier ?? 'base'}
          isBlind75={card.is_blind75 ?? card.isBlind75 ?? false}
          compact={true}
        />
      </div>

      <div class="mb-3 rounded-xl border border-gray-800 bg-gray-800/45 px-3 py-2.5">
        <p class="text-[11px] uppercase tracking-wide text-gray-400 mb-1">Full Problem Name</p>
        <p class="text-base sm:text-lg font-black text-gray-100 leading-tight break-words">
          {card.title ?? 'Untitled Problem'}
        </p>
        {#if getCardTitleSlug(card)}
          <p class="text-[11px] text-gray-500 mt-1">Slug: {getCardTitleSlug(card)}</p>
        {/if}
      </div>

      <div class="mb-4 rounded-xl border border-sky-700/30 bg-sky-900/10 px-3 py-2.5">
        <p class="text-[11px] uppercase tracking-wide text-sky-300/80 mb-1">LeetCode Problem Summary</p>
        {#if problemSummaryLoading && problemSummaryLoadedSlug === getCardTitleSlug(card)}
          <p class="text-sm text-gray-400 leading-relaxed">Loading summary from LeetCode...</p>
        {:else if problemSummaryText}
          <p class="text-sm text-gray-200 leading-relaxed">{problemSummaryText}</p>
          {#if problemSummarySource === 'leetcode'}
            <p class="text-[11px] text-gray-500 mt-1">Source: LeetCode</p>
          {/if}
        {:else}
          <p class="text-sm text-gray-200 leading-relaxed">{buildFallbackCardSummary(card, selectedCard.tier ?? 'base')}</p>
          <p class="text-[11px] text-gray-500 mt-1">Live LeetCode summary unavailable right now.</p>
        {/if}
      </div>

      <div class="mb-4 rounded-xl border border-amber-500/25 bg-amber-900/10 px-3 py-3">
        <div class="flex items-center justify-between gap-3 mb-2">
          <p class="text-[11px] uppercase tracking-wide text-amber-300/80">Tier Progress</p>
          <span class="text-xs font-bold uppercase tracking-wide text-amber-100">{formatProblemTier(currentTier)}</span>
        </div>

        <div class="h-2 w-full rounded-full bg-gray-800 overflow-hidden">
          <div
            class="h-full rounded-full bg-gradient-to-r from-sky-500 via-indigo-500 to-amber-400 transition-[width] duration-300"
            style={`width: ${Math.max(4, Math.min(100, tierProgressPercent)).toFixed(1)}%`}
          ></div>
        </div>

        <div class="mt-2 grid grid-cols-4 gap-2 text-[10px] uppercase tracking-wide">
          {#each PROBLEM_TIER_ORDER as tierStep, index}
            <span
              class="font-semibold text-center"
              class:text-sky-200={index <= currentTierIndex}
              class:text-gray-500={index > currentTierIndex}
            >
              {formatProblemTier(tierStep)}
            </span>
          {/each}
        </div>

        <p class="mt-2 text-xs text-gray-200 leading-relaxed">{tierConditionSummary.current}</p>
        {#if tierConditionSummary.next}
          <p class="mt-1 text-[11px] text-sky-200 leading-relaxed">{tierConditionSummary.next}</p>
        {/if}
      </div>

      <div class="space-y-2 text-sm">
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
          <span class="text-right text-gray-400 text-xs max-w-[14rem] break-words leading-snug">
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
        <p class="text-[11px] text-gray-500 mb-2">Each algorithm card can be equipped to only one slot on one problem card at a time.</p>
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
