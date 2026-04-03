<script lang="ts">
  import type { AlgorithmThemeTokens } from '@leetarena/types';
  import { resolveAlgorithmTheme } from '$lib/algorithm-cards/theme';
  import ShieldAlert from 'lucide-svelte/icons/shield-alert';
  import Sparkles from 'lucide-svelte/icons/sparkles';
  import WandSparkles from 'lucide-svelte/icons/wand-sparkles';

  export let name = '';
  export let slug = '';
  export let description = '';
  export let abilityName = '';
  export let abilityDescription = '';
  export let mode: 'trap' | 'effect' = 'effect';
  export let themeTemplate = 'stone';
  export let themeTokens: Partial<AlgorithmThemeTokens> = {};
  export let compact = false;

  const MODE_FRAME_ASSETS = {
    effect: '/assets/algo-fantasy/frame-effect.png',
    trap: '/assets/algo-fantasy/frame-trap.png',
  } as const;

  const CARD_BACK_ASSET = '/assets/algo-fantasy/back.png';
  const ALGO_PANEL_ASSET = '/assets/algo-fantasy/panel.png';

  function compactSnippet(value: string, maxLength: number): string {
    const normalized = value.trim().replace(/\s+/g, ' ');
    if (normalized.length <= maxLength) return normalized;
    return `${normalized.slice(0, Math.max(0, maxLength - 1)).trim()}…`;
  }

  function shortenAbilityName(value: string, maxLength: number): string {
    let normalized = value.trim().replace(/\s+/g, ' ');
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

  $: resolvedTheme = resolveAlgorithmTheme(themeTemplate, themeTokens);
  $: ModeIcon = mode === 'trap' ? ShieldAlert : Sparkles;
  $: modeLabel = mode === 'trap' ? 'TRAP CARD' : 'EFFECT CARD';
  $: slugLabel = slug ? slug.replace(/-/g, ' ') : mode === 'trap' ? 'reaction protocol' : 'support protocol';
  $: frameAsset = MODE_FRAME_ASSETS[mode] ?? MODE_FRAME_ASSETS.effect;
  $: displayName = name || 'Algorithm Card';
  $: displayDescription = description || 'Tactical utility card for timed combat windows.';
  $: displayAbilityName = abilityName || 'Battle Protocol';
  $: formattedAbilityName = shortenAbilityName(displayAbilityName, compact ? 18 : 24);
  $: displayAbilityDescription = abilityDescription || 'Apply a tactical modifier to the active clash.';
  $: shortAbilityDescription = compactSnippet(displayAbilityDescription, compact ? 46 : 74);
</script>

<div
  class="algo-card-wrapper relative cursor-pointer select-none transition-all duration-300"
  class:compact={compact}
  title={displayDescription}
>
  <div
    class="algo-card relative overflow-hidden"
    class:w-36={compact}
    class:h-52={compact}
    class:w-48={!compact}
    class:h-68={!compact}
    style="
      --algo-surface: {resolvedTheme.surface};
      --algo-border: {resolvedTheme.border};
      --algo-accent: {resolvedTheme.accent};
      --algo-chip: {resolvedTheme.chip};
      --algo-text: {resolvedTheme.text};
      --algo-glow: {resolvedTheme.glow};
    "
  >
    <div class="card-back-art absolute inset-0" style="background-image: url('{CARD_BACK_ASSET}');"></div>
    <div class="frame-art absolute inset-0" style="background-image: url('{frameAsset}');"></div>
    <div class="surface-glow absolute inset-0"></div>

    <div class="algo-content relative z-10 h-full">
      <div class="algo-head">
        <div class="mode-chip inline-flex items-center gap-1.5">
          <svelte:component this={ModeIcon} size={11} />
          {modeLabel}
        </div>
        <span class="algo-chip text-[10px] px-2 py-0.5 rounded-full uppercase tracking-[0.12em]">{themeTemplate}</span>
      </div>

      <div class="art-zone">
        <div class="icon-wrap">
          <svelte:component this={ModeIcon} size={18} />
        </div>
        <p class="slug-label clamp-1">{slugLabel}</p>
      </div>

      <div class="ability-zone">
        <div class="ability-panel absolute inset-0" style="background-image: url('{ALGO_PANEL_ASSET}');"></div>
        <div class="ability-content relative z-10">
          <p class="card-name">{displayName}</p>
          <p class="ability-title inline-flex items-center gap-1.5" title={displayAbilityName}>
            <WandSparkles size={12} />
            {formattedAbilityName}
          </p>
          <p class="ability-text clamp-3">{shortAbilityDescription}</p>
        </div>
      </div>
    </div>
  </div>
</div>

<style>
  .algo-card-wrapper:hover .algo-card {
    transform: translateY(-2px);
  }

  .algo-card {
    border: 0;
    border-radius: 1rem;
    background: radial-gradient(circle at 50% 10%, #26140f 0%, #1a1016 54%, #120b10 100%);
    height: 17rem;
    box-shadow:
      0 14px 28px -18px rgba(2, 6, 18, 0.96),
      inset 0 0 0 1px rgba(255, 255, 255, 0.04);
    transition: transform 220ms ease;
  }

  .algo-card-wrapper.compact .algo-card {
    height: 13rem;
  }

  .card-back-art,
  .frame-art {
    z-index: 1;
    border-radius: inherit;
    background-repeat: no-repeat;
    background-position: center;
    background-size: cover;
  }

  .card-back-art {
    opacity: 0.22;
    filter: saturate(0.9);
  }

  .frame-art {
    opacity: 0.95;
    filter: drop-shadow(0 2px 9px rgba(17, 24, 39, 0.56));
  }

  .surface-glow {
    z-index: 1;
    border-radius: inherit;
    background:
      radial-gradient(circle at 50% 33%, color-mix(in srgb, var(--algo-accent) 23%, transparent 77%), transparent 55%),
      linear-gradient(180deg, rgba(15, 23, 42, 0.18), rgba(15, 23, 42, 0.56));
  }

  .algo-head {
    position: absolute;
    top: 4.5%;
    left: 7%;
    right: 7%;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 6px;
    min-width: 0;
  }

  .mode-chip {
    font-size: 8px;
    font-weight: 600;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: #dbe6f7;
    background: rgba(16, 27, 49, 0.88);
    border: 1px solid color-mix(in srgb, var(--algo-accent) 45%, #334155 55%);
    border-radius: 999px;
    padding: 3px 7px;
    white-space: nowrap;
  }

  .algo-chip {
    background: rgba(28, 20, 26, 0.92);
    color: var(--algo-accent);
    border: 1px solid color-mix(in srgb, var(--algo-border) 60%, #52384d 40%);
    white-space: nowrap;
  }

  .art-zone {
    position: absolute;
    top: 16.8%;
    left: 7%;
    right: 7%;
    height: 26.5%;
    border: 1px solid color-mix(in srgb, var(--algo-border) 45%, #4b3042 55%);
    background: radial-gradient(circle at 50% 26%, rgba(250, 204, 21, 0.11), rgba(34, 22, 30, 0.9) 65%);
    border-radius: 0.8rem;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-direction: column;
    gap: 0.35rem;
    overflow: hidden;
  }

  .art-zone::after {
    content: '';
    position: absolute;
    inset: 0;
    pointer-events: none;
    background:
      linear-gradient(180deg, rgba(17, 24, 39, 0.04), rgba(17, 24, 39, 0.28)),
      repeating-linear-gradient(180deg, rgba(196, 181, 253, 0.06) 0, rgba(196, 181, 253, 0.06) 1px, transparent 1px, transparent 4px);
  }

  .icon-wrap {
    width: 2.45rem;
    height: 2.45rem;
    border-radius: 0.75rem;
    border: 1px solid color-mix(in srgb, var(--algo-accent) 56%, #4b3042 44%);
    background: rgba(36, 26, 34, 0.9);
    color: color-mix(in srgb, var(--algo-accent) 55%, #f8fafc 45%);
    display: inline-flex;
    align-items: center;
    justify-content: center;
    backdrop-filter: blur(2px);
    position: relative;
    z-index: 1;
  }

  .slug-label {
    color: rgba(231, 222, 245, 0.78);
    font-size: 9px;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    max-width: 88%;
    text-align: center;
    position: relative;
    z-index: 1;
  }

  .ability-zone {
    position: absolute;
    top: 53%;
    left: 9%;
    right: 9%;
    bottom: 9.5%;
    overflow: hidden;
    border-radius: 0.75rem;
    border: 1px solid color-mix(in srgb, var(--algo-border) 50%, #4b3042 50%);
    background: rgba(26, 18, 24, 0.9);
  }

  .ability-panel {
    border-radius: inherit;
    background-repeat: no-repeat;
    background-position: center;
    background-size: contain;
    opacity: 0.2;
  }

  .ability-content {
    padding: 7px 9px;
    height: 100%;
    overflow: hidden;
  }

  .card-name {
    color: var(--algo-text);
    font-size: 14px;
    font-weight: 700;
    line-height: 1.16;
    width: 100%;
    display: block;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    margin: 0;
    text-shadow: 0 1px 4px rgba(8, 12, 22, 0.7);
  }

  .ability-title {
    color: color-mix(in srgb, var(--algo-accent) 72%, #f8fafc 28%);
    font-size: 10px;
    font-weight: 700;
    width: 100%;
    display: flex;
    align-items: center;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    line-height: 1.1;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    margin: 6px 0 0;
  }

  .ability-text {
    color: rgba(241, 232, 251, 0.82);
    font-size: 10px;
    line-height: 1.18;
    margin: 5px 0 0;
  }

  .algo-card-wrapper.compact .algo-head {
    top: 4.2%;
    left: 6.5%;
    right: 6.5%;
    gap: 4px;
  }

  .algo-card-wrapper.compact .art-zone {
    top: 16.2%;
    left: 6.5%;
    right: 6.5%;
    height: 25.5%;
    border-radius: 0.68rem;
  }

  .algo-card-wrapper.compact .icon-wrap {
    width: 2.05rem;
    height: 2.05rem;
    border-radius: 0.66rem;
  }

  .algo-card-wrapper.compact .slug-label {
    font-size: 8px;
  }

  .algo-card-wrapper.compact .ability-zone {
    top: 54.5%;
    left: 8.2%;
    right: 8.2%;
    bottom: 9.2%;
    border-radius: 0.64rem;
  }

  .algo-card-wrapper.compact .ability-content {
    padding: 4px 7px;
  }

  .algo-card-wrapper.compact .card-name {
    font-size: 10px;
    line-height: 1.14;
  }

  .algo-card-wrapper.compact .ability-title {
    font-size: 8px;
    margin-top: 3px;
  }

  .algo-card-wrapper.compact .ability-text {
    font-size: 8px;
    line-height: 1.2;
    margin-top: 4px;
    -webkit-line-clamp: 2;
    line-clamp: 2;
  }

  .algo-card-wrapper.compact .mode-chip {
    font-size: 7px;
    padding: 2px 6px;
  }

  .algo-card-wrapper.compact .algo-chip {
    font-size: 8px;
    padding: 2px 6px;
  }

  .clamp-1,
  .clamp-3 {
    display: -webkit-box;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  .clamp-1 {
    -webkit-line-clamp: 1;
    line-clamp: 1;
  }

  .clamp-3 {
    -webkit-line-clamp: 3;
    line-clamp: 3;
  }

</style>
