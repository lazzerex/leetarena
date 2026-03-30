<script lang="ts">
  import { onMount } from 'svelte';
  import { currentUser, notify } from '$lib/stores';
  import { api } from '$lib/api';
  import { supabase } from '$lib/supabase';
  import { goto } from '$app/navigation';
  import UserRound from 'lucide-svelte/icons/user-round';
  import Coins from 'lucide-svelte/icons/coins';
  import RefreshCw from 'lucide-svelte/icons/refresh-cw';
  import CircleCheckBig from 'lucide-svelte/icons/circle-check-big';
  import Swords from 'lucide-svelte/icons/swords';
  import Package from 'lucide-svelte/icons/package';
  import Code2 from 'lucide-svelte/icons/code-2';
  import Layers3 from 'lucide-svelte/icons/layers-3';

  let leetcodeUsername = '';
  let verifying = false;
  let syncing = false;
  let lastSynced: string | null = null;
  let syncResult: {
    synced: number;
    unlocked: number;
    upgraded: number;
    skippedOutOfCatalog: number;
    extendedCatalogEnabled: boolean;
  } | null = null;
  let stats = { wins: 0, battles: 0, collection: 0, mastered: 0 };

  function getLeetCodeUsername(user: any): string {
    return user?.leetcodeUsername ?? user?.leetcode_username ?? '';
  }

  $: connectedLeetCodeUsername = getLeetCodeUsername($currentUser);

  onMount(async () => {
    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
    const sessionUserId = sessionData.session?.user?.id;

    if (sessionError || !sessionUserId) {
      goto('/login');
      return;
    }

    let activeProfile: any = $currentUser && $currentUser.id === sessionUserId
      ? $currentUser
      : null;

    if (!activeProfile) {
      const { data: profile } = await supabase
        .from('users')
        .select('*')
        .eq('id', sessionUserId)
        .single();

      if (!profile) {
        goto('/login');
        return;
      }

      activeProfile = profile;
      currentUser.set(profile as any);
    }

    leetcodeUsername = getLeetCodeUsername(activeProfile);

    // Load last sync info
    const { data: syncState } = await supabase
      .from('leetcode_sync')
      .select('last_synced_at')
      .eq('user_id', sessionUserId)
      .single();
    lastSynced = syncState?.last_synced_at ?? null;

    // Load stats
    const [{ count: battles }, { count: wins }, { count: collection }, { count: mastered }] =
      await Promise.all([
        supabase.from('battles').select('*', { count: 'exact', head: true })
          .or(`player1_id.eq.${sessionUserId},player2_id.eq.${sessionUserId}`),
        supabase.from('battles').select('*', { count: 'exact', head: true })
          .eq('winner_id', sessionUserId),
        supabase.from('user_cards').select('*', { count: 'exact', head: true })
          .eq('user_id', sessionUserId),
        supabase.from('user_cards').select('*', { count: 'exact', head: true })
          .eq('user_id', sessionUserId).eq('tier', 'mastered'),
      ]);

    stats = {
      battles: battles ?? 0,
      wins: wins ?? 0,
      collection: collection ?? 0,
      mastered: mastered ?? 0,
    };
  });

  async function saveLeetCodeUsername() {
    if (!$currentUser) return;
    verifying = true;
    try {
      const result = await api.verifyLeetCode(leetcodeUsername);
      if (!result.valid) {
        notify('error', 'LeetCode username not found');
        return;
      }
      await supabase.from('users').update({ leetcode_username: leetcodeUsername }).eq('id', $currentUser.id);
      currentUser.update((u) => u ? { ...u, leetcodeUsername, leetcode_username: leetcodeUsername } as any : u);
      notify('success', `Connected to @${leetcodeUsername} on LeetCode!`);
    } catch (e: any) {
      notify('error', e.message);
    } finally {
      verifying = false;
    }
  }

  async function triggerSync() {
    if (!$currentUser) return;
    syncing = true;
    try {
      syncResult = await api.triggerSync($currentUser.id);
      lastSynced = new Date().toISOString();
      notify('success', `Sync complete: ${syncResult.synced} new solve${syncResult.synced !== 1 ? 's' : ''} processed.`);
    } catch (e: any) {
      notify('error', e.message ?? 'Sync failed');
    } finally {
      syncing = false;
    }
  }

  function formatDate(iso: string | null) {
    if (!iso) return 'Never';
    return new Date(iso).toLocaleString();
  }
</script>

<svelte:head><title>Profile — LeetArena</title></svelte:head>

<div class="max-w-2xl mx-auto px-4 py-10">
  {#if $currentUser}
    <!-- Avatar + name -->
    <div class="flex items-center gap-4 mb-8">
      <div class="w-16 h-16 rounded-2xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-3xl">
        <UserRound size={28} />
      </div>
      <div>
        <h1 class="text-2xl font-black">{$currentUser.username}</h1>
        <div class="flex gap-3 mt-1 text-sm">
          <span class="text-amber-400 inline-flex items-center gap-1.5"><Coins size={14} /> {$currentUser.coins.toLocaleString()} coins</span>
          <span class="text-gray-400">• Rating {$currentUser.rating}</span>
        </div>
      </div>
    </div>

    <!-- Stats grid -->
    <div class="grid grid-cols-4 gap-3 mb-8">
      {#each [
        { label: 'Battles', value: stats.battles },
        { label: 'Wins', value: stats.wins },
        { label: 'Cards', value: stats.collection },
        { label: 'Mastered', value: stats.mastered },
      ] as s}
        <div class="bg-gray-900 border border-gray-800 rounded-xl p-3 text-center">
          <div class="text-2xl font-black">{s.value}</div>
          <div class="text-gray-500 text-xs">{s.label}</div>
        </div>
      {/each}
    </div>

    <!-- LeetCode Sync -->
    <div class="bg-gray-900 border border-gray-800 rounded-2xl p-6 mb-6">
      <h2 class="font-black text-lg mb-1">LeetCode Sync</h2>
      <p class="text-gray-500 text-sm mb-4">
        Connect your LeetCode account to unlock and upgrade curated core catalog cards when you solve problems.
      </p>

      <div class="flex gap-2 mb-4">
        <input
          bind:value={leetcodeUsername}
          placeholder="Your LeetCode username"
          class="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-gray-500 text-white placeholder-gray-500"
        />
        <button
          on:click={saveLeetCodeUsername}
          disabled={verifying || !leetcodeUsername}
          class="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-lg text-sm transition-colors disabled:opacity-40"
        >
          {verifying ? '...' : 'Verify'}
        </button>
      </div>

      <div class="flex items-center justify-between bg-gray-800/50 rounded-xl px-4 py-3">
        <div>
          <p class="text-sm font-medium">
            {connectedLeetCodeUsername ? `@${connectedLeetCodeUsername}` : 'No account connected'}
          </p>
          <p class="text-xs text-gray-500">Last synced: {formatDate(lastSynced)}</p>
        </div>
        <button
          on:click={triggerSync}
          disabled={syncing || !connectedLeetCodeUsername}
          class="px-4 py-2 bg-green-700 hover:bg-green-600 text-white font-bold rounded-lg text-sm transition-colors disabled:opacity-40"
        >
          <span class="inline-flex items-center gap-1.5"><RefreshCw size={14} /> {syncing ? 'Syncing...' : 'Sync Now'}</span>
        </button>
      </div>

      {#if syncResult}
        <div class="mt-3 text-green-400 text-sm font-medium">
          <span class="inline-flex items-center gap-1.5"><CircleCheckBig size={14} /> Synced {syncResult.synced} new submission{syncResult.synced !== 1 ? 's' : ''}</span>
        </div>
        <div class="mt-2 text-xs text-gray-400 space-y-1">
          <p>Unlocked: {syncResult.unlocked} · Upgraded: {syncResult.upgraded}</p>
          <p>
            Non-core submissions skipped: {syncResult.skippedOutOfCatalog}
            {syncResult.extendedCatalogEnabled ? ' (extended catalog enabled)' : ' (extended catalog disabled)'}
          </p>
        </div>
      {/if}

      <p class="text-xs text-gray-600 mt-3">
        Sync is optional and only runs for users who connect and verify their LeetCode username.
        Solving non-core problems only unlocks extended catalog cards when the server enables variety mode.
      </p>
    </div>

    <!-- Daily quests (static UI for MVP) -->
    <div class="bg-gray-900 border border-gray-800 rounded-2xl p-6">
      <h2 class="font-black text-lg mb-4">Daily Quests</h2>
      <div class="space-y-3">
        {#each [
          { icon: Swords, task: 'Win 2 battles', reward: '100 coins', progress: 0, target: 2 },
          { icon: Package, task: 'Open a pack', reward: '50 coins', progress: 0, target: 1 },
          { icon: Code2, task: 'Solve a LeetCode problem', reward: '150 coins', progress: 0, target: 1 },
          { icon: Layers3, task: 'Play 5 algorithm cards in battles', reward: '80 coins', progress: 0, target: 5 },
        ] as quest}
          <div class="flex items-center gap-3 bg-gray-800/50 rounded-xl px-4 py-3">
            <span class="text-sky-200"><svelte:component this={quest.icon} size={18} /></span>
            <div class="flex-1 min-w-0">
              <p class="text-sm font-medium">{quest.task}</p>
              <div class="flex items-center gap-2 mt-1">
                <div class="flex-1 h-1.5 bg-gray-700 rounded-full overflow-hidden">
                  <div class="h-full bg-amber-500 rounded-full transition-all"
                       style="width: {(quest.progress / quest.target) * 100}%"></div>
                </div>
                <span class="text-xs text-gray-500">{quest.progress}/{quest.target}</span>
              </div>
            </div>
            <span class="text-amber-400 text-xs font-bold whitespace-nowrap">+{quest.reward}</span>
          </div>
        {/each}
      </div>
    </div>
  {/if}
</div>
