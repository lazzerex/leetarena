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
  export let catalogType: 'core' | 'extended' = 'core';
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
    Graph: '#34d399',
    Tree: '#84cc16',
    Math: '#fb923c',
    DynamicProgramming: '#a78bfa',
    String: '#f472b6',
    Array: '#22d3ee',
  };

  const ELEMENT_LABELS: Record<string, string> = {
    Graph: 'GRAPH',
    Tree: 'TREE',
    Math: 'MATH',
    DynamicProgramming: 'DP',
    String: 'STRING',
    Array: 'ARRAY',
  };

  const rarityFrame: Record<Rarity, string> = {
    common: '#64748b',
    rare: '#38bdf8',
    epic: '#818cf8',
    legendary: '#fbbf24',
  };

  const CORE_RARITY_FRAME_ASSETS: Record<Rarity, string> = {
    common: '/assets/scifi-card/frame-common.png',
    rare: '/assets/scifi-card/frame-rare.png',
    epic: '/assets/scifi-card/frame-epic.png',
    legendary: '/assets/scifi-card/frame-legendary.png',
  };

  const EXTENDED_RARITY_FRAME_ASSETS: Record<Rarity, string> = {
    common: '/assets/extended-card/frame-common.png',
    rare: '/assets/extended-card/frame-rare.png',
    epic: '/assets/extended-card/frame-epic.png',
    legendary: '/assets/extended-card/frame-legendary.png',
  };

  const CORE_CARD_BACK_ASSET = '/assets/scifi-card/back.png';
  const EXTENDED_CARD_BACK_ASSET = '/assets/extended-card/back.png';
  const EXTENDED_TEMPLATE_ASSET = '/assets/extended-card/deco.png';

  $: tierMultiplier = { locked: 0, base: 1, proven: 1.15, mastered: 1.3 }[tier];
  $: effectiveAtk = Math.round(baseAtk * tierMultiplier);
  $: effectiveDef = Math.round(baseDef * tierMultiplier);
  $: effectiveHp = Math.round(baseHp * tierMultiplier);
  $: elementColor = ELEMENT_COLORS[elementType] ?? '#94a3b8';
  $: frameColor = rarityFrame[rarity] ?? rarityFrame.common;
  $: tierBadge = tier === 'proven' ? 'PROVEN' : tier === 'mastered' ? 'MASTERED' : '';
  $: rarityLabel = rarity.toUpperCase();
  $: compactRarityLabel =
    rarity === 'legendary'
      ? 'LEG'
      : rarity === 'common'
      ? 'COM'
      : rarity === 'rare'
      ? 'RAR'
      : 'EPC';
  $: displayRarityLabel = compact ? compactRarityLabel : rarityLabel;
  $: elementLabel = ELEMENT_LABELS[elementType] ?? elementType.toUpperCase();
  $: slugDisplay = (titleSlug || title).replace(/-/g, ' ').trim();
  $: ElementIcon = ELEMENT_ICONS[elementType] ?? TableProperties;
  $: isExtended = catalogType === 'extended';
  $: frameAsset = isExtended
    ? EXTENDED_RARITY_FRAME_ASSETS[rarity] ?? EXTENDED_RARITY_FRAME_ASSETS.common
    : CORE_RARITY_FRAME_ASSETS[rarity] ?? CORE_RARITY_FRAME_ASSETS.common;
  $: cardBackAsset = isExtended ? EXTENDED_CARD_BACK_ASSET : CORE_CARD_BACK_ASSET;
  $: catalogTemplateAsset = isExtended ? EXTENDED_TEMPLATE_ASSET : null;
</script>

<!-- svelte-ignore a11y-click-events-have-key-events -->
<!-- svelte-ignore a11y-no-static-element-interactions -->
<div
  class="card-wrapper relative cursor-pointer select-none transition-all duration-300"
  class:scale-105={selected}
  class:opacity-70={tier === 'locked'}
  class:compact={compact}
  class:is-extended={isExtended}
  style="perspective: 1000px;"
  on:click={onClick}
>
  <div
    class="card relative overflow-hidden transition-transform duration-700"
    class:w-36={compact}
    class:h-52={compact}
    class:w-48={!compact}
    class:h-68={!compact}
    style="
      transform-style: preserve-3d;
      transform: rotateY({flipped ? '180deg' : '0deg'});
      --element-accent: {elementColor};
      --frame-color: {frameColor};
      --catalog-accent: {isExtended ? '#f43f5e' : '#22d3ee'};
      --back-glow: {isExtended ? 'rgba(244, 63, 94, 0.35)' : 'rgba(34, 211, 238, 0.36)'};
    "
  >
    <!-- Front face -->
    <div class="card-face absolute inset-0" style="backface-visibility: hidden;">
      <div class="frame-art absolute inset-0" style="background-image: url('{frameAsset}');"></div>
      {#if catalogTemplateAsset}
        <div class="catalog-template absolute inset-0" style="background-image: url('{catalogTemplateAsset}');"></div>
      {/if}

      <div class="card-content">
        <div class="card-head">
          <span class="chip chip-element inline-flex items-center gap-1">
            <svelte:component this={ElementIcon} size={12} />
            {elementLabel}
          </span>

          <div class="chip-group inline-flex items-center gap-1">
            {#if isExtended}
              <span class="chip chip-catalog">EXT</span>
            {/if}
            {#if isBlind75}
              <span class="chip chip-b75">B75</span>
            {/if}
            <span class="chip chip-rarity">{displayRarityLabel}</span>
          </div>
        </div>

        <div class="art-zone relative">
          {#if tier === 'locked'}
            <div class="absolute inset-0 flex items-center justify-center flex-col gap-1.5 text-slate-300/85">
              <span class="icon-wrap w-9 h-9 rounded-full flex items-center justify-center">
                <Lock size={16} />
              </span>
              <p class="lock-copy">LOCKED</p>
            </div>
          {:else}
            <div class="absolute inset-0 flex items-center justify-center flex-col gap-1.5 p-2">
              <span class="icon-wrap w-10 h-10 rounded-2xl flex items-center justify-center">
                <svelte:component this={ElementIcon} size={18} />
              </span>
              {#if !compact}
                <span class="slug-label text-center leading-tight line-clamp-1">{slugDisplay}</span>
              {/if}
            </div>
          {/if}
        </div>

        <div class="title-zone text-center">
          <p class="title-text">{title}</p>
          {#if tierBadge}
            <span class="tier-chip" class:tier-mastered={tier === 'mastered'}>{tierBadge}</span>
          {/if}
        </div>

        {#if tier !== 'locked'}
          <div class="stats-row">
            <div class="stat-pill">
              <div class="stat-value text-rose-300">{effectiveAtk}</div>
              <div class="stat-label">ATK</div>
            </div>
            <div class="stat-pill">
              <div class="stat-value text-sky-300">{effectiveDef}</div>
              <div class="stat-label">DEF</div>
            </div>
            <div class="stat-pill">
              <div class="stat-value text-emerald-300">{effectiveHp}</div>
              <div class="stat-label">HP</div>
            </div>
          </div>
        {/if}
      </div>
    </div>

    <!-- Back face -->
    <div
      class="card-back absolute inset-0 flex items-center justify-center"
      style="backface-visibility: hidden; transform: rotateY(180deg);"
    >
      <div class="card-back-art absolute inset-0" style="background-image: url('{cardBackAsset}');"></div>
      <div class="card-back-glow absolute inset-0"></div>
      <div class="text-center relative z-10">
        <div class="text-5xl mb-2 inline-flex items-center justify-center emblem-wrap">
          <Shield size={42} />
        </div>
        <div class="text-slate-200 text-sm font-semibold tracking-[0.18em]">LEETARENA</div>
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
    border-radius: 1rem;
    border: 0;
    box-shadow:
      0 14px 28px -18px rgba(3, 7, 18, 0.95),
      0 0 0 1px rgba(255, 255, 255, 0.02) inset;
    background: radial-gradient(circle at 50% 8%, #1f2a44 0%, #111a2f 54%, #0b1220 100%);
  }

  :global(.card-wrapper.compact .card) {
    height: 13rem;
  }

  .card-wrapper:hover .card {
    transform: translateY(-2px);
  }

  .card-wrapper.is-extended .card {
    background: radial-gradient(circle at 50% 8%, #3b1020 0%, #25101b 54%, #160b12 100%);
  }

  .card-face {
    border-radius: inherit;
  }

  .frame-art {
    z-index: 1;
    border-radius: inherit;
    background-repeat: no-repeat;
    background-position: center;
    background-size: 100% 100%;
    filter: drop-shadow(0 3px 8px rgba(2, 6, 18, 0.5));
  }

  .card-wrapper.is-extended .frame-art,
  .card-wrapper.is-extended .card-back-art {
    filter: hue-rotate(128deg) saturate(1.22) brightness(1.03) drop-shadow(0 3px 8px rgba(31, 10, 21, 0.55));
  }

  .catalog-template {
    z-index: 2;
    border-radius: inherit;
    background-repeat: no-repeat;
    background-position: center 34%;
    background-size: 64% auto;
    opacity: 0.26;
    mix-blend-mode: screen;
    pointer-events: none;
    filter: drop-shadow(0 0 7px color-mix(in srgb, var(--catalog-accent) 48%, transparent));
  }

  .card-content {
    position: relative;
    z-index: 3;
    height: 100%;
  }

  .card-head {
    position: absolute;
    top: 4.5%;
    left: 7%;
    right: 7%;
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    align-items: center;
    gap: 5px;
    min-width: 0;
  }

  .chip {
    font-size: 8px;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    border-radius: 999px;
    padding: 3px 6px;
    border: 1px solid rgba(148, 163, 184, 0.44);
    color: #e6edf9;
    background: rgba(16, 27, 49, 0.86);
    backdrop-filter: blur(1px);
    white-space: nowrap;
    min-width: 0;
  }

  .chip-element {
    border-color: color-mix(in srgb, var(--element-accent) 58%, #334155 42%);
    color: color-mix(in srgb, var(--element-accent) 44%, #e2e8f0 56%);
    max-width: 100%;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .chip-group {
    min-width: 0;
    justify-self: end;
  }

  .chip-b75 {
    color: #111827;
    background: #fcd34d;
    border-color: #fcd34d;
    font-weight: 700;
  }

  .chip-rarity {
    border-color: color-mix(in srgb, var(--frame-color) 58%, #334155 42%);
  }

  .chip-catalog {
    color: #ffe4e6;
    border-color: rgba(244, 63, 94, 0.62);
    background: rgba(78, 16, 37, 0.78);
    font-weight: 700;
  }

  .art-zone {
    position: absolute;
    top: 16.8%;
    left: 7%;
    right: 7%;
    height: 42%;
    border-radius: 0.8rem;
    border: 1px solid rgba(79, 95, 129, 0.54);
    background: radial-gradient(circle at 50% 30%, rgba(34, 211, 238, 0.12), rgba(12, 22, 42, 0.92) 58%);
    overflow: hidden;
    backdrop-filter: blur(1px);
  }

  .card-wrapper.is-extended .art-zone {
    border-color: rgba(244, 63, 94, 0.52);
    background: radial-gradient(circle at 50% 30%, rgba(251, 113, 133, 0.2), rgba(45, 15, 28, 0.92) 58%);
  }

  .art-zone::after {
    content: '';
    position: absolute;
    inset: 0;
    pointer-events: none;
    background:
      linear-gradient(180deg, rgba(15, 23, 42, 0) 0%, rgba(15, 23, 42, 0.2) 100%),
      repeating-linear-gradient(180deg, rgba(148, 163, 184, 0.06) 0, rgba(148, 163, 184, 0.06) 1px, transparent 1px, transparent 4px);
  }

  .icon-wrap {
    border: 1px solid color-mix(in srgb, var(--element-accent) 60%, #334155 40%);
    background: rgba(15, 26, 49, 0.9);
    color: color-mix(in srgb, var(--element-accent) 44%, #e2e8f0 56%);
    backdrop-filter: blur(2px);
  }

  .lock-copy {
    color: #a8b4c8;
    font-size: 9px;
    letter-spacing: 0.14em;
    text-transform: uppercase;
  }

  .slug-label {
    color: #9fb1c9;
    font-size: 9px;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    max-width: 92%;
  }

  .title-zone {
    position: absolute;
    top: 59.8%;
    left: 12%;
    right: 12%;
    min-height: 13.5%;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 2px 4px;
  }

  .title-text {
    color: #eaf1ff;
    font-size: 13px;
    font-weight: 700;
    line-height: 1.22;
    margin: 0;
    display: -webkit-box;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    overflow: hidden;
    overflow-wrap: anywhere;
    word-break: break-word;
    text-shadow: 0 1px 5px rgba(2, 6, 23, 0.7);
  }

  .card-wrapper.is-extended .title-text {
    color: #ffe4e6;
  }

  .tier-chip {
    display: inline-block;
    margin-top: 4px;
    padding: 2px 7px;
    border-radius: 999px;
    border: 1px solid rgba(148, 163, 184, 0.35);
    color: #bfdbfe;
    background: rgba(15, 26, 49, 0.92);
    font-size: 9px;
    font-weight: 600;
    letter-spacing: 0.12em;
  }

  .tier-chip.tier-mastered {
    border-color: rgba(251, 191, 36, 0.52);
    color: #fef3c7;
    background: #2b1d0c;
  }

  .stats-row {
    position: absolute;
    left: 7%;
    right: 7%;
    bottom: 3%;
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 4px;
    align-items: end;
    min-width: 0;
  }

  .stat-pill {
    border-radius: 0.6rem;
    border: 1px solid rgba(148, 163, 184, 0.25);
    background: rgba(15, 26, 49, 0.82);
    min-height: 42px;
    padding: 4px 2px;
    text-align: center;
    min-width: 0;
    backdrop-filter: blur(2px);
  }

  .stat-value {
    font-size: 12px;
    font-weight: 600;
    line-height: 1.05;
  }

  .stat-label {
    margin-top: 1px;
    color: rgba(203, 214, 233, 0.65);
    font-size: 9px;
    letter-spacing: 0.11em;
  }

  .card-back {
    border-radius: inherit;
    overflow: hidden;
  }

  .card-back-art {
    border-radius: inherit;
    background-repeat: no-repeat;
    background-position: center;
    background-size: 100% 100%;
  }

  .card-back-glow {
    border-radius: inherit;
    background:
      radial-gradient(circle at 50% 52%, var(--back-glow) 0%, rgba(13, 20, 38, 0.12) 42%, rgba(13, 20, 38, 0.42) 100%);
  }

  .emblem-wrap {
    width: 76px;
    height: 76px;
    border-radius: 999px;
    border: 1px solid rgba(148, 163, 184, 0.52);
    background: rgba(9, 16, 31, 0.45);
    backdrop-filter: blur(3px);
  }

  :global(.card-wrapper.compact .card-head) {
    top: 4%;
    left: 6.5%;
    right: 6.5%;
    gap: 4px;
  }

  :global(.card-wrapper.compact .art-zone) {
    top: 16%;
    left: 6.5%;
    right: 6.5%;
    height: 40%;
  }

  :global(.card-wrapper.compact .title-zone) {
    top: 58.9%;
    left: 11%;
    right: 11%;
    min-height: 13%;
  }

  :global(.card-wrapper.compact .title-text) {
    font-size: 10px;
    -webkit-line-clamp: 2;
    line-clamp: 2;
  }

  :global(.card-wrapper.compact .chip) {
    font-size: 7px;
    padding: 2px 5px;
    letter-spacing: 0.06em;
  }

  :global(.card-wrapper.compact .chip-element) {
    max-width: 52px;
  }

  :global(.card-wrapper.compact .tier-chip) {
    margin-top: 3px;
    font-size: 8px;
    padding: 2px 6px;
  }

  :global(.card-wrapper.compact .stats-row) {
    left: 6.5%;
    right: 6.5%;
    bottom: 2.4%;
    gap: 3px;
  }

  :global(.card-wrapper.compact .stat-pill) {
    min-height: 35px;
    padding: 3px 2px;
  }

  :global(.card-wrapper.compact .stat-value) {
    font-size: 11px;
  }

  :global(.card-wrapper.compact .stat-label) {
    font-size: 8px;
  }

  :global(.card-wrapper.compact .icon-wrap) {
    width: 34px;
    height: 34px;
  }
</style>
