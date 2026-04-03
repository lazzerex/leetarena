<script lang="ts">
  import { fly } from 'svelte/transition';
  import { currentUser } from '$lib/stores';
  import Sparkles from 'lucide-svelte/icons/sparkles';
  import Package from 'lucide-svelte/icons/package';
  import Code2 from 'lucide-svelte/icons/code-2';
  import Swords from 'lucide-svelte/icons/swords';
  import Network from 'lucide-svelte/icons/network';
  import GitBranch from 'lucide-svelte/icons/git-branch';
  import Sigma from 'lucide-svelte/icons/sigma';
  import RefreshCw from 'lucide-svelte/icons/refresh-cw';
  import Type from 'lucide-svelte/icons/type';
  import TableProperties from 'lucide-svelte/icons/table-properties';

  const features = [
    {
      icon: Package,
      title: 'Open Packs',
      desc: 'Collect problem cards from themed packs and grow your codex.'
    },
    {
      icon: Code2,
      title: 'Solve Problems',
      desc: 'Solve on LeetCode and improve card progression through optional sync.'
    },
    {
      icon: Swords,
      title: 'Battle Players',
      desc: 'Build a ten-card deck and compete with element and stat strategy.'
    }
  ];

  const elements = [
    { name: 'Graph', icon: Network, strong: 'Tree', weak: 'Math' },
    { name: 'Tree', icon: GitBranch, strong: 'Math', weak: 'Graph' },
    { name: 'Math', icon: Sigma, strong: 'Dynamic Programming', weak: 'Tree' },
    { name: 'Dynamic Programming', icon: RefreshCw, strong: 'Graph', weak: 'String' },
    { name: 'String', icon: Type, strong: 'Array', weak: 'Dynamic Programming' },
    { name: 'Array', icon: TableProperties, strong: 'String', weak: 'Graph' }
  ];
</script>

<svelte:head>
  <title>LeetArena</title>
</svelte:head>

<section class="max-w-6xl mx-auto px-4 pt-24 pb-20">
  <div class="soft-panel rounded-3xl p-8 sm:p-12 relative">

    <div class="relative z-10 max-w-3xl" in:fly={{ y: 22, duration: 500 }}>
      <div class="inline-flex items-center gap-2 text-xs uppercase tracking-[0.16em] text-sky-200/90 border border-sky-300/25 rounded-full px-3 py-1.5 mb-5">
        <Sparkles size={14} />
        Beta
      </div>

      <h1 class="text-4xl sm:text-6xl font-bold leading-tight mb-4 text-shimmer">
        Competitive card battles powered by coding problems.
      </h1>
      <p class="text-slate-300 max-w-2xl text-lg mb-8">
        LeetArena turns problem-solving progress into collectible cards, strategic deck building, and modern PvP gameplay.
      </p>

      <div class="flex flex-wrap gap-3">
        {#if $currentUser}
          <a href="/packs" class="btn-primary rounded-xl px-6 py-3 font-semibold transition-transform hover:-translate-y-0.5">Open Packs</a>
          <a href="/battle" class="soft-panel cta-secondary rounded-xl px-6 py-3 font-semibold hover:bg-white/10">Enter Battle</a>
        {:else}
          <a href="/login" class="btn-primary rounded-xl px-6 py-3 font-semibold transition-transform hover:-translate-y-0.5">Get Started</a>
          <a href="/collection" class="soft-panel cta-secondary rounded-xl px-6 py-3 font-semibold hover:bg-white/10">Browse Collection</a>
        {/if}
      </div>
    </div>
  </div>
</section>

<section class="max-w-6xl mx-auto px-4 py-10">
  <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
    {#each features as feature, i}
      <div class="soft-panel hover-lift group rounded-2xl p-6" in:fly={{ y: 18, duration: 450, delay: i * 90 }}>
        <div class="w-10 h-10 rounded-lg bg-sky-300/15 border border-sky-300/20 flex items-center justify-center text-sky-200 mb-4 transition-all duration-300 group-hover:scale-110 group-hover:-rotate-3 group-hover:bg-sky-300/25">
          <svelte:component this={feature.icon} size={18} />
        </div>
        <h2 class="font-semibold text-lg mb-2 transition-colors duration-300 group-hover:text-sky-100">{feature.title}</h2>
        <p class="text-slate-300 text-sm leading-relaxed">{feature.desc}</p>
      </div>
    {/each}
  </div>
</section>

<section class="max-w-6xl mx-auto px-4 py-10 mb-12">
  <div class="soft-panel rounded-3xl p-8">
    <div class="flex items-center justify-between gap-4 flex-wrap mb-6">
      <h2 class="text-2xl font-semibold">Element Matchups</h2>
      <p class="text-sm text-slate-400">Attack modifier: 1.3x strong, 0.7x weak</p>
    </div>

    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
      {#each elements as item, i}
        <div
          class="rounded-xl border border-white/10 bg-white/5 p-4 hover:bg-white/10 hover-lift group"
          in:fly={{ y: 14, duration: 380, delay: i * 70 }}
        >
          <div class="flex items-center gap-2 mb-3 text-slate-100">
            <span class="transition-transform duration-300 group-hover:scale-110 group-hover:-rotate-3">
              <svelte:component this={item.icon} size={16} />
            </span>
            <span class="font-medium">{item.name}</span>
          </div>
          <p class="text-xs text-slate-400 mb-1">Strong against: <span class="text-emerald-300">{item.strong}</span></p>
          <p class="text-xs text-slate-400">Weak against: <span class="text-rose-300">{item.weak}</span></p>
        </div>
      {/each}
    </div>
  </div>
</section>

<style>
  .cta-secondary {
    transition:
      transform 260ms cubic-bezier(0.22, 1, 0.36, 1),
      border-color 220ms ease,
      background-color 220ms ease;
  }

  .cta-secondary:hover {
    transform: translateY(-2px);
    border-color: rgba(255, 255, 255, 0.22);
    background: rgba(255, 255, 255, 0.11);
  }
</style>
