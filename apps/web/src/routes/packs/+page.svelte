<script lang="ts">
  import { env } from '$env/dynamic/public';
  import {
    currentUser,
    packRevealAlgorithmCards,
    packRevealCards,
    packRevealOpen,
    notify,
  } from '$lib/stores';
  import { api } from '$lib/api';
  import SunMedium from 'lucide-svelte/icons/sun-medium';
  import Library from 'lucide-svelte/icons/library';
  import Gem from 'lucide-svelte/icons/gem';
  import Building2 from 'lucide-svelte/icons/building-2';
  import Coins from 'lucide-svelte/icons/coins';
  import Layers3 from 'lucide-svelte/icons/layers-3';
  import Trophy from 'lucide-svelte/icons/trophy';
  import Handshake from 'lucide-svelte/icons/handshake';
  import Code2 from 'lucide-svelte/icons/code-2';
  import CalendarDays from 'lucide-svelte/icons/calendar-days';
  import CircleCheckBig from 'lucide-svelte/icons/circle-check-big';
  import TrendingUp from 'lucide-svelte/icons/trending-up';
  import Gift from 'lucide-svelte/icons/gift';

  const packs = [
    {
      id: 'daily',
      name: 'Daily Pack',
      icon: SunMedium,
      description: '3 Common + 1 Rare card. Free every 24 hours.',
      cost: 'Free',
      costAmount: 0,
      size: 4,
      borderColor: 'border-slate-700',
      badge: 'FREE',
      badgeColor: 'bg-green-500',
      spriteX: -2,
      spriteY: -2,
    },
    {
      id: 'topic',
      name: 'Topic Pack',
      icon: Library,
      description: '4 cards guaranteed from one algorithm family.',
      cost: '500 coins',
      costAmount: 500,
      size: 4,
      borderColor: 'border-slate-700',
      badge: null,
      badgeColor: '',
      spriteX: -190,
      spriteY: -168,
    },
    {
      id: 'blind75',
      name: 'Blind 75 Pack',
      icon: Gem,
      description: '5 cards from the famous Blind 75 list. In the current core catalog, these are Legendary-tier.',
      cost: '1500 coins',
      costAmount: 1500,
      size: 5,
      borderColor: 'border-slate-700',
      badge: 'HOT',
      badgeColor: 'bg-amber-500',
      spriteX: -378,
      spriteY: -334,
    },
    {
      id: 'company',
      name: 'Company Pack',
      icon: Building2,
      description: '5 cards tagged with top tech companies (Google, Meta, Amazon…)',
      cost: '2000 coins',
      costAmount: 2000,
      size: 5,
      borderColor: 'border-slate-700',
      badge: null,
      badgeColor: '',
      spriteX: -566,
      spriteY: -500,
    },
  ];

  let opening: string | null = null;
  let selectedElement = 'Array';
  let includeExtendedPool = false;
  let beginnerStatusLoading = false;
  let beginnerClaiming = false;
  let beginnerClaimable = false;
  let beginnerClaimedAt: string | null = null;
  let beginnerLoadedForUserId: string | null = null;

  const extendedPacksEnabled = env.PUBLIC_ENABLE_EXTENDED_PACKS === 'true';

  const elements = ['Array', 'Graph', 'Tree', 'Math', 'DynamicProgramming', 'String'];

  async function openPack(packId: string, costAmount: number) {
    if (!$currentUser) {
      notify('error', 'Sign in to open packs');
      return;
    }
    if (costAmount > 0 && $currentUser.coins < costAmount) {
      notify('error', `Not enough coins! You need ${costAmount} coins.`);
      return;
    }

    opening = packId;
    try {
      const elementFilter = packId === 'topic' ? selectedElement : undefined;
      const result = await api.openPack(
        $currentUser.id,
        packId,
        elementFilter,
        includeExtendedPool && extendedPacksEnabled
      );
      const rewardByCardId = new Map((result.cardRewards ?? []).map((reward) => [reward.cardId, reward]));

      // Populate pack reveal store
      packRevealCards.set(
        (result.cards as any[]).map((c: any) => ({
          id: c.id,
          titleSlug: c.title_slug ?? c.titleSlug ?? '',
          title: c.title,
          rarity: c.rarity,
          elementType: c.element_type,
          catalogType: (c.catalog_type ?? c.catalogType) === 'extended' ? 'extended' : 'core',
          tier: rewardByCardId.get(c.id)?.tier ?? 'base',
          duplicateCount: rewardByCardId.get(c.id)?.duplicateCount ?? 0,
          baseAtk: c.base_atk,
          baseDef: c.base_def,
          baseHp: c.base_hp,
          isNew: rewardByCardId.get(c.id)?.isNew ?? false,
        }))
      );
      packRevealAlgorithmCards.set(
        (result.algorithmCards ?? []).map((card) => ({
          id: card.id,
          slug: card.slug,
          name: card.name,
          description: card.description,
          abilityName: card.abilityName,
          abilityDescription: card.abilityDescription,
          mode: card.mode,
          themeTemplate: card.themeTemplate,
          themeTokens: card.themeTokens,
          isNew: card.isNew,
        }))
      );
      packRevealOpen.set(true);

      // Deduct coins from local store
      currentUser.update((u) => u ? {
        ...u,
        coins: u.coins - result.coinsSpent + (result.duplicateCompensationCoins ?? 0),
      } : u);

      if (result.usedExtendedPool) {
        notify('info', 'Variety mode enabled: this pack may include extended catalog cards.');
      }

      if ((result.algorithmCards ?? []).length > 0) {
        notify('success', `Algorithm reward: ${(result.algorithmCards ?? []).length} trap/effect card${(result.algorithmCards ?? []).length > 1 ? 's' : ''} obtained.`);
      }

      if ((result.duplicateCompensationCoins ?? 0) > 0) {
        notify('info', `Duplicate algorithm compensation: +${result.duplicateCompensationCoins} coins`);
      }
    } catch (e: any) {
      notify('error', e.message ?? 'Failed to open pack');
    } finally {
      opening = null;
    }
  }

  async function loadBeginnerPackStatus(userId: string) {
    beginnerStatusLoading = true;
    try {
      const status = await api.getBeginnerPackStatus(userId);
      beginnerClaimable = status.claimable;
      beginnerClaimedAt = status.claimedAt;
    } catch (e: any) {
      // Don't hard-lock claim UI when status lookup fails transiently.
      beginnerClaimable = true;
      beginnerClaimedAt = null;
      notify('info', e?.message ?? 'Could not verify beginner pack status. You can still try to claim it.');
    } finally {
      beginnerStatusLoading = false;
    }
  }

  async function claimBeginnerPack() {
    if (!$currentUser || beginnerClaiming || !beginnerClaimable) return;

    beginnerClaiming = true;
    try {
      const result = await api.claimBeginnerPack($currentUser.id);

      packRevealCards.set(
        (result.coreCards ?? []).map((c) => ({
          id: c.id,
          titleSlug: c.titleSlug,
          title: c.title,
          rarity: c.rarity as any,
          elementType: c.elementType as any,
          catalogType: 'core' as const,
          tier: 'base' as const,
          duplicateCount: 0,
          baseAtk: c.baseAtk,
          baseDef: c.baseDef,
          baseHp: c.baseHp,
          isNew: c.isNew,
        }))
      );

      packRevealAlgorithmCards.set(
        (result.algorithmCards ?? []).map((card) => ({
          id: card.id,
          slug: card.slug,
          name: card.name,
          description: card.description,
          abilityName: card.abilityName,
          abilityDescription: card.abilityDescription,
          mode: card.mode,
          themeTemplate: card.themeTemplate,
          themeTokens: card.themeTokens,
          isNew: card.isNew,
        }))
      );

      packRevealOpen.set(true);
      beginnerClaimable = false;
      beginnerClaimedAt = result.claimedAt;
      notify('success', `Beginner pack claimed: ${result.coreCardCount} core cards and ${result.algorithmCardCount} algorithm cards granted.`);
    } catch (e: any) {
      const message = e?.message ?? 'Failed to claim beginner pack';
      if (typeof message === 'string' && message.toLowerCase().includes('already claimed')) {
        beginnerClaimable = false;
        await loadBeginnerPackStatus($currentUser.id);
      }
      notify('error', message);
    } finally {
      beginnerClaiming = false;
    }
  }

  $: if ($currentUser?.id && beginnerLoadedForUserId !== $currentUser.id) {
    beginnerLoadedForUserId = $currentUser.id;
    void loadBeginnerPackStatus($currentUser.id);
  }

  $: if (!$currentUser) {
    beginnerLoadedForUserId = null;
    beginnerClaimable = false;
    beginnerClaimedAt = null;
  }
</script>

<svelte:head><title>Open Packs — LeetArena</title></svelte:head>

<div class="pack-shop-shell max-w-5xl mx-auto px-4 py-10">
  <div class="mb-8">
    <h1 class="text-3xl font-black">Pack Shop</h1>
    <p class="text-gray-500 mt-1">Open packs to collect cards instantly, then level them up through LeetCode solves and duplicates.</p>
    <div class="mt-4 bg-gray-900 border border-gray-800 rounded-xl p-4 text-sm text-gray-300 space-y-1">
      <p>Default packs use the curated core catalog (LeetCode #1-#300).</p>
      <p>Pack pulls grant ownership immediately at Base tier.</p>
      <p>Core progression: solve the exact problem to reach Proven, then collect duplicates to push to Mastered.</p>
    </div>
  </div>

  {#if $currentUser}
    <div class="mb-6 bg-gray-900 border border-gray-800 rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
      <div>
        <h2 class="font-black text-lg inline-flex items-center gap-2"><Gift size={18} /> Beginner Onboarding Pack</h2>
        <p class="text-sm text-gray-400 mt-1">One-time reward: 20 core cards unlocked to base + 5 algorithm trap/effect cards.</p>
        {#if beginnerClaimedAt}
          <p class="text-xs text-emerald-300 mt-1">Claimed on {new Date(beginnerClaimedAt).toLocaleString()}</p>
        {:else}
          <p class="text-xs text-gray-500 mt-1">Recommended for new accounts before opening paid packs.</p>
        {/if}
      </div>

      <button
        on:click={claimBeginnerPack}
        disabled={beginnerStatusLoading || beginnerClaiming || !beginnerClaimable}
        class="px-5 py-2.5 rounded-xl font-bold text-sm transition-all bg-emerald-500 hover:bg-emerald-400 text-black disabled:opacity-40 disabled:cursor-not-allowed"
      >
        {#if beginnerStatusLoading}
          Checking...
        {:else if beginnerClaiming}
          Claiming...
        {:else if beginnerClaimable}
          Claim Beginner Pack
        {:else}
          Already Claimed
        {/if}
      </button>
    </div>
  {/if}

  {#if extendedPacksEnabled}
    <div class="mb-6 bg-gray-900 border border-gray-800 rounded-xl p-4 flex items-center justify-between gap-4">
      <div>
        <p class="font-semibold text-white">Variety Mode</p>
        <p class="text-sm text-gray-400">Allow extended catalog cards in pack generation.</p>
      </div>
      <label class="inline-flex items-center gap-2 text-sm text-gray-300">
        <input type="checkbox" bind:checked={includeExtendedPool} class="accent-amber-400" />
        Include extended pool
      </label>
    </div>
  {/if}

  <div class="grid grid-cols-1 sm:grid-cols-2 gap-5">
    {#each packs as pack}
      <div class="pack-tile relative border {pack.borderColor} rounded-2xl p-6 transition-all duration-300 hover:-translate-y-0.5 hover:border-slate-500">
        {#if pack.badge}
          <div class="absolute top-3 right-3 z-10 {pack.badgeColor} text-black text-xs font-black px-2.5 py-1 rounded-full">
            {pack.badge}
          </div>
        {/if}

        <div class="flex items-start gap-4 mb-4">
          <div class="pack-icon-shell w-11 h-11 rounded-xl flex items-center justify-center text-sky-200">
            <svelte:component this={pack.icon} size={22} />
          </div>
          <div>
            <h2 class="text-xl font-black">{pack.name}</h2>
            <p class="text-gray-400 text-sm mt-0.5">{pack.description}</p>
          </div>
        </div>

        <div class="pack-preview-wrap mb-4">
          <div
            class="pack-preview"
            style="--pack-sprite-x: {pack.spriteX}px; --pack-sprite-y: {pack.spriteY}px;"
            aria-hidden="true"
          ></div>
        </div>

        <!-- Card count indicator -->
        <div class="flex gap-1.5 mb-5">
          {#each Array(pack.size) as _}
            <div class="pack-mini-card h-8 w-6 rounded border flex items-center justify-center text-xs">
              <Layers3 size={12} />
            </div>
          {/each}
          <span class="text-gray-500 text-xs self-center ml-1">{pack.size} cards</span>
        </div>

        <!-- Topic pack element selector -->
        {#if pack.id === 'topic'}
          <div class="mb-4">
            <label for="topic-element-filter" class="text-xs text-gray-400 block mb-1.5">Element Filter</label>
            <select
              id="topic-element-filter"
              bind:value={selectedElement}
              class="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
            >
              {#each elements as el}
                <option value={el}>{el}</option>
              {/each}
            </select>
          </div>
        {/if}

        <div class="flex items-center justify-between">
          <span class="font-bold text-lg"
            class:text-green-400={pack.cost === 'Free'}
            class:text-amber-400={pack.cost !== 'Free'}
          >
            {pack.cost === 'Free' ? 'Free' : `${pack.cost}`}
          </span>

          <button
            on:click={() => openPack(pack.id, pack.costAmount)}
            disabled={opening !== null || !$currentUser ||
                      (pack.costAmount > 0 && ($currentUser?.coins ?? 0) < pack.costAmount)}
            class="px-5 py-2.5 rounded-xl font-bold text-sm transition-all
                   bg-amber-500 hover:bg-amber-400 text-black
                   disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {opening === pack.id ? 'Opening...' : 'Open Pack'}
          </button>
        </div>

        {#if pack.costAmount > 0 && ($currentUser?.coins ?? 0) < pack.costAmount}
          <p class="text-red-400 text-xs mt-2">
            Need {pack.costAmount - ($currentUser?.coins ?? 0)} more coins
          </p>
        {/if}
      </div>
    {/each}
  </div>

  <!-- How to earn coins -->
  <div class="mt-12 bg-gray-900 border border-gray-800 rounded-2xl p-6">
    <h2 class="font-black text-lg mb-4 inline-flex items-center gap-2"><Coins size={18} /> How to Earn Coins</h2>
    <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
      {#each [
        { icon: Trophy, action: 'Win a battle', reward: '+100 coins' },
        { icon: Handshake, action: 'Participate in a battle', reward: '+25 coins' },
        { icon: Code2, action: 'Solve a LeetCode problem (synced)', reward: '+50-150 coins' },
        { icon: CalendarDays, action: 'Daily login streak', reward: '+20 coins/day' },
        { icon: CircleCheckBig, action: 'Complete daily quests', reward: '+50-150 coins' },
        { icon: TrendingUp, action: 'Upgrade a card to Mastered', reward: '+75 coins' },
      ] as item}
        <div class="flex items-center gap-3 bg-gray-800/50 rounded-xl px-3 py-2">
          <span class="text-sky-200"><svelte:component this={item.icon} size={18} /></span>
          <div class="flex-1">
            <p class="text-gray-300">{item.action}</p>
          </div>
          <span class="text-amber-400 font-bold text-xs whitespace-nowrap">{item.reward}</span>
        </div>
      {/each}
    </div>
  </div>
</div>

<style>
  .pack-shop-shell {
    position: relative;
  }

  .pack-tile {
    overflow: hidden;
    background: rgba(7, 12, 22, 0.96);
  }

  .pack-icon-shell {
    border: 1px solid rgba(148, 163, 184, 0.26);
    background: rgba(15, 23, 42, 0.75);
  }

  .pack-mini-card {
    border-color: rgba(100, 116, 139, 0.6);
    color: rgba(148, 163, 184, 0.76);
    background: rgba(15, 23, 42, 0.85);
  }

  .pack-preview-wrap {
    display: flex;
    justify-content: center;
  }

  .pack-preview {
    width: 86px;
    height: 152px;
    border-radius: 0.85rem;
    border: 1px solid rgba(148, 163, 184, 0.18);
    background-image: url('/assets/card-packages/card-package-sheet.png');
    background-size: 849px 2829px;
    background-position: var(--pack-sprite-x) var(--pack-sprite-y);
    box-shadow: none;
  }
</style>
