<script lang="ts">
  import { env } from '$env/dynamic/public';
  import { currentUser, packRevealCards, packRevealOpen, notify } from '$lib/stores';
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

  const packs = [
    {
      id: 'daily',
      name: 'Daily Pack',
      icon: SunMedium,
      description: '3 Common + 1 Rare card. Free every 24 hours.',
      cost: 'Free',
      costAmount: 0,
      size: 4,
      borderColor: 'border-gray-600',
      glowColor: 'shadow-gray-500/20',
      badge: 'FREE',
      badgeColor: 'bg-green-500',
    },
    {
      id: 'topic',
      name: 'Topic Pack',
      icon: Library,
      description: '4 cards guaranteed from one algorithm family.',
      cost: '500 coins',
      costAmount: 500,
      size: 4,
      borderColor: 'border-blue-600',
      glowColor: 'shadow-blue-500/20',
      badge: null,
      badgeColor: '',
    },
    {
      id: 'blind75',
      name: 'Blind 75 Pack',
      icon: Gem,
      description: '5 cards from the famous Blind 75 list. 15% Legendary rate!',
      cost: '1500 coins',
      costAmount: 1500,
      size: 5,
      borderColor: 'border-amber-500',
      glowColor: 'shadow-amber-500/30',
      badge: 'HOT',
      badgeColor: 'bg-amber-500',
    },
    {
      id: 'company',
      name: 'Company Pack',
      icon: Building2,
      description: '5 cards tagged with top tech companies (Google, Meta, Amazon…)',
      cost: '2000 coins',
      costAmount: 2000,
      size: 5,
      borderColor: 'border-purple-600',
      glowColor: 'shadow-purple-500/20',
      badge: null,
      badgeColor: '',
    },
  ];

  let opening: string | null = null;
  let selectedElement = 'Array';
  let includeExtendedPool = false;

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

      // Populate pack reveal store
      packRevealCards.set(
        (result.cards as any[]).map((c: any) => ({
          id: c.id,
          titleSlug: c.title_slug ?? c.titleSlug ?? '',
          title: c.title,
          rarity: c.rarity,
          elementType: c.element_type,
          baseAtk: c.base_atk,
          baseDef: c.base_def,
          baseHp: c.base_hp,
          isNew: true,
        }))
      );
      packRevealOpen.set(true);

      // Deduct coins from local store
      currentUser.update((u) => u ? { ...u, coins: u.coins - result.coinsSpent } : u);

      if (result.usedExtendedPool) {
        notify('info', 'Variety mode enabled: this pack may include extended catalog cards.');
      }
    } catch (e: any) {
      notify('error', e.message ?? 'Failed to open pack');
    } finally {
      opening = null;
    }
  }
</script>

<svelte:head><title>Open Packs — LeetArena</title></svelte:head>

<div class="max-w-5xl mx-auto px-4 py-10">
  <div class="mb-8">
    <h1 class="text-3xl font-black">Pack Shop</h1>
    <p class="text-gray-500 mt-1">Open packs to grow your collection. Solve problems to power up your cards.</p>
    <div class="mt-4 bg-gray-900 border border-gray-800 rounded-xl p-4 text-sm text-gray-300 space-y-1">
      <p>Default packs use the curated core catalog (LeetCode #1-#300).</p>
      <p>Solve sync unlocks and upgrades curated core cards by default.</p>
      <p>When variety mode is enabled, non-core problems can appear as extended catalog cards.</p>
    </div>
  </div>

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

  {#if $currentUser}
    <div class="flex items-center gap-2 mb-8 bg-gray-900 border border-gray-800 rounded-xl px-4 py-3 w-fit">
      <span class="text-sky-300"><Coins size={18} /></span>
      <span class="font-bold text-lg">{$currentUser.coins.toLocaleString()}</span>
      <span class="text-gray-500 text-sm">coins</span>
    </div>
  {/if}

  <div class="grid grid-cols-1 sm:grid-cols-2 gap-5">
    {#each packs as pack}
      <div class="relative bg-gray-900 border-2 {pack.borderColor} rounded-2xl p-6
                  hover:shadow-xl {pack.glowColor} transition-all duration-300 hover:-translate-y-1">
        {#if pack.badge}
          <div class="absolute -top-3 -right-3 {pack.badgeColor} text-black text-xs font-black px-2.5 py-1 rounded-full">
            {pack.badge}
          </div>
        {/if}

        <div class="flex items-start gap-4 mb-4">
          <div class="w-11 h-11 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-sky-200">
            <svelte:component this={pack.icon} size={22} />
          </div>
          <div>
            <h2 class="text-xl font-black">{pack.name}</h2>
            <p class="text-gray-400 text-sm mt-0.5">{pack.description}</p>
          </div>
        </div>

        <!-- Card count indicator -->
        <div class="flex gap-1.5 mb-5">
          {#each Array(pack.size) as _}
            <div class="h-8 w-6 rounded border border-gray-700 bg-gray-800 flex items-center justify-center text-gray-600 text-xs">
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
