<script lang="ts">
  import type { Rarity, Element } from '@leetarena/types';
  import Network from 'lucide-svelte/icons/network';
  import GitBranch from 'lucide-svelte/icons/git-branch';
  import Sigma from 'lucide-svelte/icons/sigma';
  import RefreshCw from 'lucide-svelte/icons/refresh-cw';
  import Type from 'lucide-svelte/icons/type';
  import TableProperties from 'lucide-svelte/icons/table-properties';
  import Lock from 'lucide-svelte/icons/lock';
  import Shield from 'lucide-svelte/icons/shield';

  export let title: string = '';
  export let titleSlug: string = '';
  export let rarity: Rarity = 'common';
  export let elementType: Element = 'Array';
  export let baseAtk: number = 0;
  export let baseDef: number = 0;
  export let baseHp: number = 0;
  export let tier: 'locked' | 'base' | 'proven' | 'mastered' = 'base';
  export let isBlind75: boolean = false;
  export let flipped: boolean = false;
  export let selected: boolean = false;
  export let compact: boolean = false;
  export let onClick: (() => void) | null = null;

  const ELEMENT_ICONS = {
    Graph: Network,
    Tree: GitBranch,
    Math: Sigma,
    DynamicProgramming: RefreshCw,
    String: Type,
    Array: TableProperties,
  };

  const ELEMENT_COLORS: Record<string, string> = {
    Graph: 'from-emerald-900 to-emerald-700',
    Tree: 'from-lime-900 to-lime-700',
    Math: 'from-orange-900 to-orange-700',
    DynamicProgramming: 'from-violet-900 to-violet-700',
    String: 'from-pink-900 to-pink-700',
    Array: 'from-cyan-900 to-cyan-700',
  };

  const rarityBorder: Record<string, string> = {
    common: 'border-slate-500',
    rare: 'border-sky-400',
    epic: 'border-indigo-400',
    legendary: 'border-amber-300',
  };

  const rarityGlow: Record<string, string> = {
    common: '',
    rare: 'shadow-[0_0_12px_rgba(59,130,246,0.5)]',
    epic: 'shadow-[0_0_12px_rgba(168,85,247,0.6)]',
    legendary: 'shadow-[0_0_20px_rgba(245,158,11,0.8)] animate-glow',
  };

  $: tierMultiplier = { locked: 0, base: 1, proven: 1.15, mastered: 1.3 }[tier];
  $: effectiveAtk = Math.round(baseAtk * tierMultiplier);
  $: effectiveDef = Math.round(baseDef * tierMultiplier);
  $: effectiveHp = Math.round(baseHp * tierMultiplier);
  $: elementColor = ELEMENT_COLORS[elementType] ?? 'from-gray-900 to-gray-700';
  $: tierBadge = tier === 'proven' ? 'Proven' : tier === 'mastered' ? 'Mastered' : '';
  $: ElementIcon = ELEMENT_ICONS[elementType] ?? TableProperties;
</script>

<!-- svelte-ignore a11y-click-events-have-key-events -->
<!-- svelte-ignore a11y-no-static-element-interactions -->
<div
  class="card-wrapper relative cursor-pointer select-none transition-all duration-200"
  class:scale-105={selected}
  class:opacity-50={tier === 'locked'}
  style="perspective: 1000px;"
  on:click={onClick}
>
  <div
    class="card relative rounded-xl border overflow-hidden
           bg-gradient-to-b {elementColor}
           {rarityBorder[rarity]} {rarityGlow[rarity]}
           transition-transform duration-600"
    class:w-36={compact}
    class:h-52={compact}
    class:w-48={!compact}
    class:h-68={!compact}
    style="transform-style: preserve-3d; transform: rotateY({flipped ? '180deg' : '0deg'});"
  >
    <!-- Front face -->
    <div class="absolute inset-0 p-2 flex flex-col" style="backface-visibility: hidden;">
      <!-- Rarity shimmer for legendary/epic -->
      {#if rarity === 'legendary'}
        <div class="absolute inset-0 opacity-20 pointer-events-none"
          style="background: linear-gradient(135deg, transparent 0%, #f59e0b 50%, transparent 100%);
                 background-size: 200% 200%; animation: shimmer 2s linear infinite;">
        </div>
      {/if}

      <!-- Header -->
      <div class="flex items-center justify-between mb-1">
        <span class="w-6 h-6 rounded-md bg-black/20 border border-white/10 flex items-center justify-center">
          <svelte:component this={ElementIcon} size={14} />
        </span>
        {#if isBlind75}
          <span class="text-xs bg-amber-500 text-black px-1 rounded font-bold">B75</span>
        {/if}
        <span class="text-xs text-gray-300 uppercase tracking-wide">{rarity}</span>
      </div>

      <!-- Card Art Area (programmatic) -->
      <div class="flex-1 rounded-lg overflow-hidden mb-2 relative
                  bg-gradient-to-br {elementColor} border border-white/10">
        {#if tier === 'locked'}
          <div class="absolute inset-0 flex items-center justify-center opacity-40">
            <Lock size={28} />
          </div>
        {:else}
          <div class="absolute inset-0 flex items-center justify-center flex-col gap-1 p-2">
            <span class="w-10 h-10 rounded-xl bg-black/25 border border-white/10 flex items-center justify-center">
              <svelte:component this={ElementIcon} size={20} />
            </span>
            <span class="text-xs text-center text-white/60 font-mono leading-tight">
              {titleSlug.replace(/-/g, ' ')}
            </span>
          </div>
        {/if}
      </div>

      <!-- Title -->
      <div class="text-center mb-1">
        <p class="text-white font-bold text-xs leading-tight line-clamp-2">{title}</p>
        {#if tierBadge}
          <span class="text-xs font-semibold"
            class:text-amber-400={tier === 'mastered'}
            class:text-yellow-300={tier === 'proven'}
          >{tierBadge}</span>
        {/if}
      </div>

      <!-- Stats -->
      {#if tier !== 'locked'}
        <div class="grid grid-cols-3 gap-1 text-center border-t border-white/20 pt-1">
          <div>
            <div class="text-red-400 font-bold text-sm">{effectiveAtk}</div>
            <div class="text-gray-400 text-xs">ATK</div>
          </div>
          <div>
            <div class="text-blue-400 font-bold text-sm">{effectiveDef}</div>
            <div class="text-gray-400 text-xs">DEF</div>
          </div>
          <div>
            <div class="text-green-400 font-bold text-sm">{effectiveHp}</div>
            <div class="text-gray-400 text-xs">HP</div>
          </div>
        </div>
      {/if}
    </div>

    <!-- Back face -->
    <div
      class="absolute inset-0 bg-gradient-to-b from-gray-900 to-gray-800 flex items-center justify-center"
      style="backface-visibility: hidden; transform: rotateY(180deg);"
    >
      <div class="text-center">
        <div class="text-5xl mb-2 inline-flex items-center justify-center">
          <Shield size={42} />
        </div>
        <div class="text-gray-400 text-sm font-bold tracking-widest">LEETARENA</div>
      </div>
    </div>
  </div>

  <!-- Selected ring -->
  {#if selected}
    <div class="absolute -inset-1 rounded-xl border-2 border-white/60 pointer-events-none"></div>
  {/if}
</div>

<style>
  .card {
    height: 17rem;
  }
  :global(.card-wrapper.compact .card) {
    height: 13rem;
  }
</style>
