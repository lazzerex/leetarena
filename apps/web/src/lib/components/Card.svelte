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

  let wrapperEl: HTMLDivElement | undefined;
  let tiltX = 0;
  let tiltY = 0;
  let isPointerOver = false;

  const RARITY_GLOW: Record<Rarity, string> = {
    common:    'rgba(100,116,139,0.55)',
    rare:      'rgba(59,130,246,0.6)',
    epic:      'rgba(168,85,247,0.65)',
    legendary: 'rgba(245,158,11,0.7)',
  };

  const CORE_RARITY_FRAME_ASSETS: Record<Rarity, string> = {
    common:    '/assets/scifi-card/frame-common.png',
    rare:      '/assets/scifi-card/frame-rare.png',
    epic:      '/assets/scifi-card/frame-epic.png',
    legendary: '/assets/scifi-card/frame-legendary.png',
  };

  const EXTENDED_RARITY_FRAME_ASSETS: Record<Rarity, string> = {
    common:    '/assets/extended-card/frame-common.png',
    rare:      '/assets/extended-card/frame-rare.png',
    epic:      '/assets/extended-card/frame-epic.png',
    legendary: '/assets/extended-card/frame-legendary.png',
  };

  const CORE_CARD_BACK_ASSET     = '/assets/scifi-card/back.png';
  const EXTENDED_CARD_BACK_ASSET = '/assets/extended-card/back.png';
  const EXTENDED_TEMPLATE_ASSET  = '/assets/extended-card/deco.png';

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
    Tree:  '#84cc16',
    Math:  '#fb923c',
    DynamicProgramming: '#a78bfa',
    String: '#f472b6',
    Array:  '#22d3ee',
  };

  const ELEMENT_LABELS: Record<string, string> = {
    Graph: 'GRAPH',
    Tree:  'TREE',
    Math:  'MATH',
    DynamicProgramming: 'DP',
    String: 'STRING',
    Array:  'ARRAY',
  };

  const RARITY_TEXT_COLOR: Record<Rarity, string> = {
    common:    '#94a3b8',
    rare:      '#60a5fa',
    epic:      '#c084fc',
    legendary: '#fbbf24',
  };

  function handlePointerMove(e: PointerEvent) {
    if (flipped || !wrapperEl) return;
    const rect = wrapperEl.getBoundingClientRect();
    tiltY = ((e.clientX - rect.left) / rect.width  - 0.5) * 18;
    tiltX = (0.5 - (e.clientY - rect.top)  / rect.height) * 18;
    isPointerOver = true;
  }

  function handlePointerLeave() {
    tiltX = 0;
    tiltY = 0;
    isPointerOver = false;
  }

  $: glowColor = RARITY_GLOW[rarity] ?? RARITY_GLOW.common;
  // perspective() removed from transform — it now lives as a CSS property on the wrapper
  $: tiltTransform = `rotateX(${tiltX}deg) rotateY(${tiltY}deg)`;
  $: tiltTransition = isPointerOver
    ? 'transform 0.08s ease-out, box-shadow 0.12s ease'
    : 'transform 0.55s cubic-bezier(0.22,1,0.36,1), box-shadow 0.4s ease';

  $: tierMultiplier = { locked: 0, base: 1, proven: 1.15, mastered: 1.3 }[tier];
  $: effectiveAtk = Math.round(baseAtk * tierMultiplier);
  $: effectiveDef = Math.round(baseDef * tierMultiplier);
  $: effectiveHp  = Math.round(baseHp  * tierMultiplier);
  $: elementColor   = ELEMENT_COLORS[elementType]  ?? '#94a3b8';
  $: rarityColor    = RARITY_TEXT_COLOR[rarity]    ?? '#94a3b8';
  $: tierBadge = tier === 'proven' ? 'PROVEN' : tier === 'mastered' ? 'MASTERED' : '';
  $: rarityLabel = rarity.toUpperCase();
  $: compactRarityLabel =
    rarity === 'legendary' ? 'LEG' :
    rarity === 'common'    ? 'COM' :
    rarity === 'rare'      ? 'RAR' : 'EPC';
  $: displayRarityLabel = compact ? compactRarityLabel : rarityLabel;
  $: elementLabel  = ELEMENT_LABELS[elementType] ?? elementType.toUpperCase();
  $: slugDisplay   = (titleSlug || title).replace(/-/g, ' ').trim();
  $: ElementIcon   = ELEMENT_ICONS[elementType] ?? TableProperties;
  $: isExtended    = catalogType === 'extended';
  $: frameAsset    = isExtended
    ? (EXTENDED_RARITY_FRAME_ASSETS[rarity] ?? EXTENDED_RARITY_FRAME_ASSETS.common)
    : (CORE_RARITY_FRAME_ASSETS[rarity]     ?? CORE_RARITY_FRAME_ASSETS.common);
  $: cardBackAsset      = isExtended ? EXTENDED_CARD_BACK_ASSET : CORE_CARD_BACK_ASSET;
  $: catalogTemplateAsset = isExtended ? EXTENDED_TEMPLATE_ASSET : null;
  $: backGlow = isExtended ? 'rgba(244,63,94,0.3)' : 'rgba(124,58,237,0.3)';
</script>

<!-- svelte-ignore a11y-click-events-have-key-events -->
<!-- svelte-ignore a11y-no-static-element-interactions -->
<div
  bind:this={wrapperEl}
  class="card-wrapper relative cursor-pointer select-none"
  class:scale-105={selected}
  class:opacity-70={tier === 'locked'}
  class:compact
  class:is-extended={isExtended}
  style="
    transform: {tiltTransform};
    transition: {tiltTransition};
    box-shadow: {isPointerOver && !flipped ? `0 0 36px -8px ${glowColor}` : 'none'};
  "
  on:pointermove={handlePointerMove}
  on:pointerleave={handlePointerLeave}
  on:click={onClick}
>
  <div
    class="card relative overflow-hidden"
    class:w-36={compact}
    class:h-52={compact}
    class:w-48={!compact}
    class:h-68={!compact}
    style="
      transform-style: preserve-3d;
      transform: rotateY({flipped ? '180deg' : '0deg'});
      --element-accent: {elementColor};
      --rarity-color: {rarityColor};
      --back-glow: {backGlow};
    "
  >
    <!-- Front face -->
    <div class="card-face absolute inset-0" style="backface-visibility: hidden;">

      <!-- Frame PNG — sits above card body, below content -->
      <div class="frame-art absolute inset-0" style="background-image: url('{frameAsset}');"></div>

      <!-- Extended deco template -->
      {#if catalogTemplateAsset}
        <div class="catalog-template absolute inset-0" style="background-image: url('{catalogTemplateAsset}');"></div>
      {/if}

      <div class="card-content">

        <!-- Header row -->
        <div class="card-head">
          <span class="chip chip-element inline-flex items-center gap-1">
            <svelte:component this={ElementIcon} size={11} />
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

        <!-- Art zone — sits inside the frame's art window -->
        <div class="art-zone relative">
          {#if tier === 'locked'}
            <div class="absolute inset-0 flex items-center justify-center flex-col gap-1.5">
              <span class="icon-wrap w-9 h-9 rounded-full flex items-center justify-center">
                <Lock size={15} />
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

        <!-- Title -->
        <div class="title-zone text-center">
          <p class="title-text">{title}</p>
          {#if tierBadge}
            <span class="tier-chip" class:tier-mastered={tier === 'mastered'}>{tierBadge}</span>
          {/if}
        </div>

        <!-- Stats -->
        {#if tier !== 'locked'}
          <div class="stats-row">
            <div class="stat-pill">
              <div class="stat-value stat-atk">{effectiveAtk}</div>
              <div class="stat-label">ATK</div>
            </div>
            <div class="stat-pill">
              <div class="stat-value stat-def">{effectiveDef}</div>
              <div class="stat-label">DEF</div>
            </div>
            <div class="stat-pill">
              <div class="stat-value stat-hp">{effectiveHp}</div>
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
      <div class="text-center relative z-10 flex flex-col items-center gap-2">
        <div class="emblem-wrap flex items-center justify-center">
          <Shield size={38} strokeWidth={1.5} />
        </div>
        <div class="back-wordmark font-cinzel">LEETARENA</div>
      </div>
    </div>
  </div>

  <!-- Selected ring -->
  {#if selected}
    <div class="absolute -inset-1 rounded-xl border-2 border-white/60 pointer-events-none"></div>
  {/if}
</div>

<style>
  /* ── Wrapper: perspective lives here (NOT in transform function) ─ */
  .card-wrapper {
    perspective: 900px;
    transform-style: preserve-3d;
  }

  /* ── Card body ────────────────────────────────────────────────── */
  .card {
    height: 17rem;
    border-radius: 1rem;
    background: radial-gradient(circle at 50% 8%, #1a2540 0%, #0e1628 54%, #080f1d 100%);
    box-shadow:
      0 18px 40px -16px rgba(2, 5, 16, 0.95),
      inset 0 0 0 1px rgba(255,255,255,0.03);
    transition: transform 0.65s cubic-bezier(0.22, 1, 0.36, 1);
  }

  :global(.card-wrapper.compact .card) { height: 13rem; }

  .card-wrapper.is-extended .card {
    background: radial-gradient(circle at 50% 8%, #2a0f1a 0%, #18090f 54%, #0e050a 100%);
  }

  /* ── Frame PNG overlay ───────────────────────────────────────── */
  .card-face { border-radius: inherit; }

  .frame-art {
    z-index: 1;
    border-radius: inherit;
    background-repeat: no-repeat;
    background-position: center;
    background-size: 100% 100%;
    /* drop-shadow sharpens the frame edge against the background */
    filter: drop-shadow(0 2px 6px rgba(2, 6, 18, 0.6));
  }

  .card-wrapper.is-extended .frame-art {
    filter: hue-rotate(128deg) saturate(1.2) brightness(1.02)
            drop-shadow(0 2px 6px rgba(30, 8, 18, 0.6));
  }

  .catalog-template {
    z-index: 2;
    border-radius: inherit;
    background-repeat: no-repeat;
    background-position: center 34%;
    background-size: 64% auto;
    opacity: 0.22;
    mix-blend-mode: screen;
    pointer-events: none;
  }

  /* ── Content layer (sits above frame) ────────────────────────── */
  .card-content {
    position: relative;
    z-index: 3;
    height: 100%;
  }

  /* ── Header ───────────────────────────────────────────────────── */
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

  /* ── Chips ────────────────────────────────────────────────────── */
  .chip {
    font-size: 8px;
    letter-spacing: 0.07em;
    text-transform: uppercase;
    border-radius: 999px;
    padding: 2px 6px;
    /* Glassmorphism: blurs the frame behind the chip */
    background: rgba(6, 11, 22, 0.72);
    border: 1px solid rgba(255, 255, 255, 0.1);
    backdrop-filter: blur(6px);
    -webkit-backdrop-filter: blur(6px);
    color: rgba(200, 214, 236, 0.9);
    white-space: nowrap;
    min-width: 0;
  }

  .chip-element {
    border-color: color-mix(in srgb, var(--element-accent) 40%, rgba(255,255,255,0.1) 60%);
    color: color-mix(in srgb, var(--element-accent) 60%, #e2e8f0 40%);
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
    border-color: rgba(251,191,36,0.8);
    font-weight: 700;
  }

  .chip-rarity {
    color: var(--rarity-color);
    border-color: color-mix(in srgb, var(--rarity-color) 35%, rgba(255,255,255,0.1) 65%);
  }

  .chip-catalog {
    color: #fda4af;
    border-color: rgba(244, 63, 94, 0.45);
    background: rgba(60, 10, 24, 0.8);
    font-weight: 700;
  }

  /* ── Art zone ─────────────────────────────────────────────────── */
  .art-zone {
    position: absolute;
    top: 16.8%;
    left: 8%;
    right: 8%;
    height: 42%;
    border-radius: 0.55rem;
    /* Transparent — frame PNG provides the visual boundary */
    background: transparent;
    overflow: hidden;
  }

  .icon-wrap {
    background: rgba(6, 11, 22, 0.7);
    border: 1px solid color-mix(in srgb, var(--element-accent) 45%, rgba(255,255,255,0.08) 55%);
    color: color-mix(in srgb, var(--element-accent) 60%, #e2e8f0 40%);
    backdrop-filter: blur(4px);
    -webkit-backdrop-filter: blur(4px);
    box-shadow: 0 0 12px -4px color-mix(in srgb, var(--element-accent) 50%, transparent 50%);
  }

  .lock-copy {
    color: rgba(148, 163, 184, 0.7);
    font-size: 9px;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    text-shadow: 0 1px 4px rgba(2,6,18,0.9);
  }

  .slug-label {
    color: rgba(148, 163, 184, 0.65);
    font-size: 9px;
    letter-spacing: 0.07em;
    text-transform: uppercase;
    max-width: 90%;
    text-shadow: 0 1px 4px rgba(2,6,18,0.9);
  }

  /* ── Title zone ───────────────────────────────────────────────── */
  .title-zone {
    position: absolute;
    top: 60%;
    left: 10%;
    right: 10%;
    min-height: 13%;
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
    text-shadow: 0 1px 8px rgba(2, 6, 23, 0.95), 0 0 24px rgba(2, 6, 23, 0.7);
  }

  .card-wrapper.is-extended .title-text { color: #ffd6dc; }

  .tier-chip {
    display: inline-block;
    margin-top: 4px;
    padding: 2px 7px;
    border-radius: 999px;
    background: rgba(6, 11, 22, 0.78);
    border: 1px solid rgba(255, 255, 255, 0.12);
    backdrop-filter: blur(4px);
    -webkit-backdrop-filter: blur(4px);
    color: #93c5fd;
    font-size: 9px;
    font-weight: 600;
    letter-spacing: 0.12em;
  }

  .tier-chip.tier-mastered {
    border-color: rgba(251, 191, 36, 0.4);
    color: #fef3c7;
  }

  /* ── Stats ────────────────────────────────────────────────────── */
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
    border-radius: 0.55rem;
    background: rgba(6, 11, 22, 0.75);
    border: 1px solid rgba(255, 255, 255, 0.08);
    backdrop-filter: blur(6px);
    -webkit-backdrop-filter: blur(6px);
    min-height: 42px;
    padding: 4px 2px;
    text-align: center;
    min-width: 0;
  }

  .stat-value {
    font-size: 12px;
    font-weight: 700;
    line-height: 1.05;
    font-variant-numeric: tabular-nums;
  }

  .stat-atk { color: #fca5a5; }
  .stat-def { color: #93c5fd; }
  .stat-hp  { color: #6ee7b7; }

  .stat-label {
    margin-top: 2px;
    color: rgba(148, 163, 184, 0.5);
    font-size: 9px;
    letter-spacing: 0.11em;
  }

  /* ── Card back ────────────────────────────────────────────────── */
  .card-back { border-radius: inherit; overflow: hidden; }

  .card-back-art {
    border-radius: inherit;
    background-repeat: no-repeat;
    background-position: center;
    background-size: 100% 100%;
  }

  .card-wrapper.is-extended .card-back-art {
    filter: hue-rotate(128deg) saturate(1.2) brightness(1.02);
  }

  .card-back-glow {
    border-radius: inherit;
    background: radial-gradient(circle at 50% 50%, var(--back-glow) 0%, transparent 62%);
  }

  .emblem-wrap {
    width: 72px;
    height: 72px;
    border-radius: 999px;
    border: 1px solid rgba(255,255,255,0.15);
    background: rgba(6, 11, 22, 0.5);
    backdrop-filter: blur(6px);
    -webkit-backdrop-filter: blur(6px);
    color: rgba(196, 181, 253, 0.85);
  }

  .card-wrapper.is-extended .emblem-wrap { color: rgba(253, 164, 175, 0.85); }

  .back-wordmark {
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.22em;
    color: rgba(196,181,253,0.75);
    text-shadow: 0 0 12px rgba(124,58,237,0.5);
  }

  .card-wrapper.is-extended .back-wordmark {
    color: rgba(253,164,175,0.75);
    text-shadow: 0 0 12px rgba(244,63,94,0.5);
  }

  /* ── Compact overrides ────────────────────────────────────────── */
  :global(.card-wrapper.compact .card-head) {
    top: 4%;
    left: 6.5%;
    right: 6.5%;
    gap: 4px;
  }

  :global(.card-wrapper.compact .art-zone) {
    top: 16%;
    left: 7%;
    right: 7%;
    height: 40%;
  }

  :global(.card-wrapper.compact .title-zone) {
    top: 58%;
    left: 9%;
    right: 9%;
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
    letter-spacing: 0.05em;
  }

  :global(.card-wrapper.compact .chip-element) { max-width: 52px; }

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

  :global(.card-wrapper.compact .stat-value) { font-size: 11px; }
  :global(.card-wrapper.compact .stat-label)  { font-size: 8px; }
  :global(.card-wrapper.compact .icon-wrap)   { width: 34px; height: 34px; }
</style>
