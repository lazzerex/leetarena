<script lang="ts">
  import { onMount } from 'svelte';
  import { supabase } from '$lib/supabase';
  import { currentUser } from '$lib/stores';
  import LoaderCircle from 'lucide-svelte/icons/loader-circle';

  let tab: 'rating' | 'mastered' | 'solves' = 'rating';
  let leaders: any[] = [];
  let loading = true;

  const tabs = [
    { id: 'rating', label: 'Battle Rating', col: 'rating' },
    { id: 'mastered', label: 'Most Mastered', col: 'mastered_count' },
    { id: 'solves', label: 'Most Solves', col: 'solve_count' },
  ] as const;

  async function loadLeaderboard() {
    loading = true;
    try {
      let query = supabase.from('users').select('id, username, rating, coins').limit(50);
      if (tab === 'rating') query = query.order('rating', { ascending: false });
      else if (tab === 'solves') query = query.order('solve_count', { ascending: false });

      const { data } = await query;
      leaders = data ?? [];
    } catch {}
    loading = false;
  }

  onMount(loadLeaderboard);
  $: tab, loadLeaderboard();

  $: myRank = leaders.findIndex((l) => l.id === $currentUser?.id) + 1;
</script>

<svelte:head><title>Leaderboard — LeetArena</title></svelte:head>

<div class="max-w-3xl mx-auto px-4 py-10">
  <h1 class="text-3xl font-black mb-2">Leaderboard</h1>
  <p class="text-gray-500 mb-6">Top trainers in the arena</p>

  <!-- Tabs -->
  <div class="flex gap-1 bg-gray-900 border border-gray-800 rounded-xl p-1 mb-6">
    {#each tabs as t}
      <button
        on:click={() => (tab = t.id)}
        class="flex-1 py-2 rounded-lg text-sm font-medium transition-colors
               {tab === t.id ? 'bg-amber-500 text-black' : 'text-gray-400 hover:text-white'}"
      >
        {t.label}
      </button>
    {/each}
  </div>

  <!-- My rank banner -->
  {#if $currentUser && myRank > 0}
    <div class="bg-amber-500/10 border border-amber-500/30 rounded-xl px-4 py-3 mb-4 flex items-center justify-between">
      <span class="text-amber-400 text-sm font-bold">Your rank: #{myRank}</span>
      <span class="text-gray-400 text-sm">{$currentUser.username} · Rating {$currentUser.rating}</span>
    </div>
  {/if}

  <!-- Leaderboard table -->
  <div class="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
    {#if loading}
      <div class="flex items-center justify-center py-16">
        <LoaderCircle class="animate-spin text-slate-400" size={28} />
      </div>
    {:else if leaders.length === 0}
      <div class="text-center py-16 text-gray-500">No data yet. Be the first to battle!</div>
    {:else}
      <div class="divide-y divide-gray-800">
        {#each leaders as leader, i}
          <div
            class="flex items-center gap-4 px-5 py-3.5 hover:bg-gray-800/50 transition-colors {leader.id === $currentUser?.id ? 'bg-amber-500/5' : ''}"
          >
            <!-- Rank -->
            <div class="w-8 text-center font-black"
                 class:text-amber-400={i === 0}
                 class:text-gray-400={i === 1}
                 class:text-orange-600={i === 2}
                 class:text-gray-600={i > 2}>
              #{i + 1}
            </div>

            <!-- Username -->
            <div class="flex-1 font-medium"
                 class:text-amber-400={leader.id === $currentUser?.id}>
              {leader.username}
              {#if leader.id === $currentUser?.id}
                <span class="text-xs text-gray-500 ml-1">(you)</span>
              {/if}
            </div>

            <!-- Stat -->
            <div class="text-right">
              {#if tab === 'rating'}
                <div class="font-black text-lg">{leader.rating ?? 1000}</div>
                <div class="text-gray-500 text-xs">rating</div>
              {:else if tab === 'mastered'}
                <div class="font-black text-lg text-amber-400">{leader.mastered_count ?? 0}</div>
                <div class="text-gray-500 text-xs">mastered</div>
              {:else}
                <div class="font-black text-lg text-blue-400">{leader.solve_count ?? 0}</div>
                <div class="text-gray-500 text-xs">solves</div>
              {/if}
            </div>
          </div>
        {/each}
      </div>
    {/if}
  </div>
</div>
