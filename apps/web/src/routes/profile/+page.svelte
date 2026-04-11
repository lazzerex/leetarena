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
  let targetedSyncing = false;
  let lastSynced: string | null = null;
  let pendingSyncCheckpointReset = false;
  let targetedTitleSlug = '';
  let targetedResult: {
    status: 'unlocked' | 'upgraded' | 'already_unlocked' | 'out_of_catalog' | 'no_metadata' | 'not_found';
    titleSlug: string;
    unlocked: number;
    upgraded: number;
    promotedExtendedCards: number;
    gemsAwarded: number;
    message?: string;
  } | null = null;
  let syncResult: {
    synced: number;
    fetchedAcceptedSubmissions: number;
    newSubmissions: number;
    uniqueProblems: number;
    duplicateProblemSubmissions: number;
    unchangedProblems: number;
    unlocked: number;
    upgraded: number;
    skippedOutOfCatalog: number;
    skippedNoMetadata: number;
    extendedCatalogEnabled: boolean;
    submissionErrors?: number;
    checkpointUpdated?: boolean;
    batchCheckpointUpdated?: boolean;
    checkpointResetApplied?: boolean;
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
      .maybeSingle();
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

      const verifiedUsername = (result.username ?? leetcodeUsername).trim();
      const previousUsername = connectedLeetCodeUsername.trim().toLowerCase();
      const nextUsername = verifiedUsername.toLowerCase();
      const usernameChanged = previousUsername !== nextUsername;

      await supabase.from('users').update({ leetcode_username: verifiedUsername }).eq('id', $currentUser.id);
      currentUser.update((u) => u ? { ...u, leetcodeUsername: verifiedUsername, leetcode_username: verifiedUsername } as any : u);
      leetcodeUsername = verifiedUsername;

      if (usernameChanged) {
        pendingSyncCheckpointReset = true;
        lastSynced = null;
        syncResult = null;
        targetedResult = null;
      } else {
        pendingSyncCheckpointReset = false;
      }

      notify('success', usernameChanged
        ? `Connected to @${verifiedUsername} on LeetCode. Next sync will reset the checkpoint for this account.`
        : `Connected to @${verifiedUsername} on LeetCode!`
      );
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
      syncResult = await api.triggerSync($currentUser.id, {
        resetCheckpoint: pendingSyncCheckpointReset,
      });
      lastSynced = new Date().toISOString();
      pendingSyncCheckpointReset = false;
      const hasWarnings =
        (syncResult.submissionErrors ?? 0) > 0 ||
        syncResult.checkpointUpdated === false ||
        syncResult.batchCheckpointUpdated === false;

      if (hasWarnings) {
        notify(
          'info',
          `Sync completed with warnings. Processed ${syncResult.synced} solve${syncResult.synced !== 1 ? 's' : ''}; please run sync again if you still have unsynced solves.`
        );
      } else if (syncResult.newSubmissions === 0) {
        notify('info', 'No new accepted LeetCode submissions found since your last sync checkpoint.');
      } else if (syncResult.unlocked + syncResult.upgraded === 0) {
        notify(
          'info',
          `Sync complete: ${syncResult.newSubmissions} new accepted submission${syncResult.newSubmissions !== 1 ? 's' : ''} checked, but no card changes were needed.`
        );
      } else {
        notify(
          'success',
          `Sync complete: ${syncResult.unlocked} unlock${syncResult.unlocked !== 1 ? 's' : ''}, ${syncResult.upgraded} upgrade${syncResult.upgraded !== 1 ? 's' : ''}.`
        );
      }
    } catch (e: any) {
      notify('error', e.message ?? 'Sync failed');
    } finally {
      syncing = false;
    }
  }

  async function triggerTargetedSync() {
    if (!$currentUser || !targetedTitleSlug.trim()) return;
    targetedSyncing = true;
    targetedResult = null;
    try {
      targetedResult = await api.targetedSync($currentUser.id, targetedTitleSlug.trim());

      if (targetedResult.status === 'unlocked') {
        notify('success', `Unlocked ${targetedResult.titleSlug}`);
      } else if (targetedResult.status === 'upgraded') {
        notify('success', `Progress updated for ${targetedResult.titleSlug}`);
      } else if (targetedResult.status === 'already_unlocked') {
        notify('info', `${targetedResult.titleSlug} is already unlocked`);
      } else if (targetedResult.status === 'not_found') {
        notify('info', targetedResult.message ?? 'No accepted submission found for this problem yet');
      } else {
        notify('info', `No unlock applied for ${targetedResult.titleSlug}`);
      }
    } catch (e: any) {
      notify('error', e.message ?? 'Targeted sync failed');
    } finally {
      targetedSyncing = false;
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

      {#if pendingSyncCheckpointReset}
        <p class="mt-2 text-xs text-amber-300">
          Next sync will reset your checkpoint because you changed the connected LeetCode username.
        </p>
      {/if}

      {#if syncResult}
        <div class="mt-3 text-green-400 text-sm font-medium">
          <span class="inline-flex items-center gap-1.5"><CircleCheckBig size={14} /> Processed {syncResult.uniqueProblems} unique problem{syncResult.uniqueProblems !== 1 ? 's' : ''}</span>
        </div>
        <div class="mt-2 text-xs text-gray-400 space-y-1">
          <p>Recent accepted fetched: {syncResult.fetchedAcceptedSubmissions} · New since checkpoint: {syncResult.newSubmissions}</p>
          {#if syncResult.duplicateProblemSubmissions > 0}
            <p>Duplicate accepted submissions on same problem collapsed: {syncResult.duplicateProblemSubmissions}</p>
          {/if}
          {#if syncResult.unchangedProblems > 0}
            <p>No card change needed after processing: {syncResult.unchangedProblems}</p>
          {/if}
          <p>Unlocked: {syncResult.unlocked} · Upgraded: {syncResult.upgraded}</p>
          <p>
            Non-core submissions skipped: {syncResult.skippedOutOfCatalog} · Missing metadata: {syncResult.skippedNoMetadata}
            {syncResult.extendedCatalogEnabled ? ' (extended catalog enabled)' : ' (extended catalog disabled)'}
          </p>
        </div>
      {/if}

      <p class="text-xs text-gray-600 mt-3">
        Sync is optional and only runs for users who connect and verify their LeetCode username.
        Batch sync reads your recent accepted-submission window and counts one result per problem slug to avoid duplicate processing.
        Solving non-core problems only unlocks extended catalog cards when the server enables variety mode.
      </p>

      <div class="mt-5 border-t border-gray-800 pt-4">
        <p class="text-sm font-semibold mb-2">Targeted Sync (Single Problem)</p>
        <p class="text-xs text-gray-500 mb-3">
          Enter a LeetCode title slug to verify and sync one specific problem result.
        </p>

        <div class="flex gap-2">
          <input
            bind:value={targetedTitleSlug}
            placeholder="e.g. two-sum"
            class="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-gray-500 text-white placeholder-gray-500"
          />
          <button
            on:click={triggerTargetedSync}
            disabled={targetedSyncing || !targetedTitleSlug.trim() || !connectedLeetCodeUsername}
            class="px-4 py-2 bg-sky-700 hover:bg-sky-600 text-white font-bold rounded-lg text-sm transition-colors disabled:opacity-40"
          >
            {targetedSyncing ? 'Checking...' : 'Run'}
          </button>
        </div>

        {#if targetedResult}
          <div class="mt-3 text-xs text-gray-300 bg-gray-800/50 rounded-lg px-3 py-2">
            <p>Status: <span class="font-semibold">{targetedResult.status}</span></p>
            <p>Slug: {targetedResult.titleSlug}</p>
            <p>Unlocked: {targetedResult.unlocked} · Upgraded: {targetedResult.upgraded}</p>
            {#if targetedResult.promotedExtendedCards > 0}
              <p>Extended promotions: {targetedResult.promotedExtendedCards}</p>
            {/if}
            {#if targetedResult.gemsAwarded > 0}
              <p>Extended gems awarded: +{targetedResult.gemsAwarded}</p>
            {/if}
            {#if targetedResult.message}
              <p>{targetedResult.message}</p>
            {/if}
          </div>
        {/if}
      </div>
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
