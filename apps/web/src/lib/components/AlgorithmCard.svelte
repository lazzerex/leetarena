<script lang="ts">
  import type { AlgorithmThemeTokens } from '@leetarena/types';
  import { resolveAlgorithmTheme } from '$lib/algorithm-cards/theme';
  import ShieldAlert from 'lucide-svelte/icons/shield-alert';
  import Sparkles from 'lucide-svelte/icons/sparkles';

  export let name = '';
  export let slug = '';
  export let description = '';
  export let abilityName = '';
  export let abilityDescription = '';
  export let mode: 'trap' | 'effect' = 'effect';
  export let themeTemplate = 'stone';
  export let themeTokens: Partial<AlgorithmThemeTokens> = {};
  export let compact = false;

  $: resolvedTheme = resolveAlgorithmTheme(themeTemplate, themeTokens);
  $: ModeIcon = mode === 'trap' ? ShieldAlert : Sparkles;
</script>

<div
  class="algo-card rounded-xl border p-3"
  class:compact={compact}
  style="
    --algo-surface: {resolvedTheme.surface};
    --algo-border: {resolvedTheme.border};
    --algo-accent: {resolvedTheme.accent};
    --algo-chip: {resolvedTheme.chip};
    --algo-text: {resolvedTheme.text};
    --algo-glow: {resolvedTheme.glow};
  "
>
  <div class="flex items-center justify-between gap-2 mb-2">
    <div class="inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-slate-100/90">
      <svelte:component this={ModeIcon} size={12} />
      {mode}
    </div>
    <span class="algo-chip text-[10px] px-2 py-0.5 rounded-full uppercase tracking-wide">{themeTemplate}</span>
  </div>

  <p class="font-bold text-sm leading-tight mb-1 text-[var(--algo-text)]">{name}</p>
  <p class="text-[11px] text-slate-200/80 mb-2 line-clamp-2">{description}</p>

  <div class="rounded-lg border p-2 bg-black/20 border-white/10">
    <p class="text-xs font-semibold text-[var(--algo-accent)] leading-tight">{abilityName}</p>
    <p class="text-[11px] text-slate-100/75 leading-tight mt-1 line-clamp-2">{abilityDescription}</p>
  </div>

  <p class="mt-2 text-[10px] text-slate-300/70 font-mono">{slug}</p>
</div>

<style>
  .algo-card {
    background: linear-gradient(180deg, color-mix(in srgb, var(--algo-surface) 88%, #000 12%), var(--algo-surface));
    border-color: var(--algo-border);
    box-shadow: 0 0 16px var(--algo-glow);
    min-height: 176px;
  }

  .algo-card.compact {
    min-height: 156px;
  }

  .algo-chip {
    background: color-mix(in srgb, var(--algo-chip) 72%, #000 28%);
    color: var(--algo-accent);
    border: 1px solid color-mix(in srgb, var(--algo-border) 80%, transparent 20%);
  }
</style>
