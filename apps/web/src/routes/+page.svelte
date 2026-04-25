<script lang="ts">
  import { fly, fade } from 'svelte/transition';
  import { currentUser } from '$lib/stores';
  import Network from 'lucide-svelte/icons/network';
  import GitBranch from 'lucide-svelte/icons/git-branch';
  import Sigma from 'lucide-svelte/icons/sigma';
  import RefreshCw from 'lucide-svelte/icons/refresh-cw';
  import Type from 'lucide-svelte/icons/type';
  import TableProperties from 'lucide-svelte/icons/table-properties';
  import Package from 'lucide-svelte/icons/package';
  import Code2 from 'lucide-svelte/icons/code-2';
  import Swords from 'lucide-svelte/icons/swords';
  import ChevronRight from 'lucide-svelte/icons/chevron-right';
  import Zap from 'lucide-svelte/icons/zap';
  import Shield from 'lucide-svelte/icons/shield';
  import Star from 'lucide-svelte/icons/star';
  import Trophy from 'lucide-svelte/icons/trophy';

  const features = [
    {
      icon: Package,
      title: 'Open Packs',
      desc: 'Crack open themed packs and grow your problem card codex. Rare drops guaranteed.',
      color: 'rgba(245,158,11,0.15)',
      border: 'rgba(245,158,11,0.25)',
      iconColor: '#fcd34d',
    },
    {
      icon: Code2,
      title: 'Solve & Unlock',
      desc: 'Solve on LeetCode and sync your progress. Accepted solutions unlock and tier-up your core cards.',
      color: 'rgba(124,58,237,0.15)',
      border: 'rgba(124,58,237,0.25)',
      iconColor: '#a78bfa',
    },
    {
      icon: Swords,
      title: 'Battle Duel',
      desc: 'Build a 10-card deck and duel with element strategy. Type advantages decide each clash.',
      color: 'rgba(239,68,68,0.12)',
      border: 'rgba(239,68,68,0.22)',
      iconColor: '#fca5a5',
    },
  ];

  const elements = [
    { name: 'Graph',    icon: Network,         color: '#10b981', strong: 'Tree',             weak: 'Math' },
    { name: 'Tree',     icon: GitBranch,       color: '#84cc16', strong: 'Math',             weak: 'Graph' },
    { name: 'Math',     icon: Sigma,           color: '#f97316', strong: 'Dynamic Prog.',    weak: 'Tree' },
    { name: 'DP',       icon: RefreshCw,       color: '#8b5cf6', strong: 'Graph',            weak: 'String' },
    { name: 'String',   icon: Type,            color: '#ec4899', strong: 'Array',            weak: 'Dynamic Prog.' },
    { name: 'Array',    icon: TableProperties, color: '#06b6d4', strong: 'String',           weak: 'Graph' },
  ];

  const tiers = [
    { name: 'Base',     desc: 'Unlocked via solve or pack.',         color: '#64748b' },
    { name: 'Proven',   desc: '5 duplicate pulls.',                  color: '#3b82f6' },
    { name: 'Mastered', desc: '20 total duplicates. Peak power.',    color: '#f59e0b' },
  ];
</script>

<svelte:head><title>LeetArena — Solve to Conquer</title></svelte:head>

<!-- ═══ HERO ═══════════════════════════════════════════════════════ -->
<section class="hero-section">
  <div class="max-w-7xl mx-auto px-4 py-20 lg:py-28">
    <div class="hero-grid">

      <!-- Left: Copy -->
      <div class="hero-copy" in:fly={{ y: 28, duration: 600, delay: 80 }}>
        <div class="hero-badge" in:fade={{ duration: 500, delay: 200 }}>
          <Zap size={12} />
          Beta · Season 0
        </div>

        <h1 class="hero-heading font-cinzel" in:fly={{ y: 24, duration: 600, delay: 150 }}>
          Solve&nbsp;to<br />
          <span class="text-gradient-gold">Conquer</span>
        </h1>

        <p class="hero-sub" in:fly={{ y: 20, duration: 500, delay: 260 }}>
          LeetArena turns your LeetCode progress into collectible problem cards.
          Build your deck, master element matchups, and duel for supremacy.
        </p>

        <div class="hero-actions" in:fly={{ y: 16, duration: 500, delay: 340 }}>
          {#if $currentUser}
            <a href="/packs" class="btn-primary rounded-xl px-7 py-3 text-base">
              Open Packs <ChevronRight size={16} />
            </a>
            <a href="/battle" class="btn-ghost rounded-xl px-7 py-3 text-base">
              Enter Battle <Swords size={14} />
            </a>
          {:else}
            <a href="/login" class="btn-primary rounded-xl px-7 py-3 text-base">
              Start Playing <ChevronRight size={16} />
            </a>
            <a href="/leaderboard" class="btn-ghost rounded-xl px-7 py-3 text-base">
              Leaderboard <Trophy size={14} />
            </a>
          {/if}
        </div>

        <!-- Quick stats row -->
        <div class="hero-stats" in:fly={{ y: 12, duration: 450, delay: 440 }}>
          <div class="stat-item">
            <span class="stat-num font-rajdhani text-gradient-gold">300+</span>
            <span class="stat-label">Problem Cards</span>
          </div>
          <div class="stat-divider"></div>
          <div class="stat-item">
            <span class="stat-num font-rajdhani" style="color:#a78bfa">6</span>
            <span class="stat-label">Elements</span>
          </div>
          <div class="stat-divider"></div>
          <div class="stat-item">
            <span class="stat-num font-rajdhani" style="color:#fca5a5">3</span>
            <span class="stat-label">Tiers</span>
          </div>
        </div>
      </div>

      <!-- Right: Floating card fan -->
      <div class="hero-cards-area" in:fly={{ y: 20, x: 20, duration: 700, delay: 200 }} aria-hidden="true">
        <!-- Card 3 — back, right -->
        <div class="hero-card-slot slot-right animate-card-bob-3">
          <div class="preview-card preview-card--back preview-card--small">
            <div class="preview-card-back-art"></div>
            <div class="preview-back-emblem">
              <Shield size={28} />
              <span class="preview-back-name font-cinzel">LA</span>
            </div>
          </div>
        </div>

        <!-- Card 2 — back, left -->
        <div class="hero-card-slot slot-left animate-card-bob-1">
          <div class="preview-card preview-card--back preview-card--small">
            <div class="preview-card-back-art"></div>
            <div class="preview-back-emblem">
              <Shield size={28} />
              <span class="preview-back-name font-cinzel">LA</span>
            </div>
          </div>
        </div>

        <!-- Card 1 — front, center (legendary) -->
        <div class="hero-card-slot slot-center animate-card-bob-2">
          <div class="preview-card preview-card--legendary">
            <!-- Frame glow -->
            <div class="preview-frame-glow"></div>

            <!-- Header -->
            <div class="preview-header">
              <span class="preview-chip preview-chip--element" style="--ec: #f97316;">
                <Sigma size={9} /> MATH
              </span>
              <span class="preview-chip preview-chip--rarity" style="--rc: #f59e0b;">LEG</span>
            </div>

            <!-- Art zone -->
            <div class="preview-art-zone">
              <div class="preview-art-inner">
                <Sigma size={30} style="color: rgba(249,115,22,0.7);" />
              </div>
            </div>

            <!-- Title -->
            <div class="preview-title-zone">
              <p class="preview-title">Two Sum</p>
              <span class="preview-tier-chip">MASTERED</span>
            </div>

            <!-- Stats -->
            <div class="preview-stats">
              <div class="preview-stat">
                <span class="preview-stat-val" style="color:#fca5a5">312</span>
                <span class="preview-stat-lbl">ATK</span>
              </div>
              <div class="preview-stat">
                <span class="preview-stat-val" style="color:#7dd3fc">189</span>
                <span class="preview-stat-lbl">DEF</span>
              </div>
              <div class="preview-stat">
                <span class="preview-stat-val" style="color:#86efac">445</span>
                <span class="preview-stat-lbl">HP</span>
              </div>
            </div>

            <!-- Foil shimmer -->
            <div class="preview-foil"></div>
          </div>
        </div>
      </div>
    </div>
  </div>

  <!-- Bottom fade -->
  <div class="hero-bottom-fade" aria-hidden="true"></div>
</section>

<!-- ═══ HOW IT WORKS ══════════════════════════════════════════════ -->
<section class="max-w-7xl mx-auto px-4 py-16">
  <div class="section-header" in:fly={{ y: 18, duration: 450 }}>
    <h2 class="section-title font-cinzel">How It Works</h2>
    <p class="section-sub">Three loops, one arena.</p>
  </div>

  <div class="features-grid">
    {#each features as f, i}
      <div
        class="feature-card hover-lift"
        style="--fc: {f.color}; --fb: {f.border};"
        in:fly={{ y: 22, duration: 480, delay: i * 100 }}
      >
        <div class="feature-icon-wrap" style="background: {f.color}; border-color: {f.border};">
          <svelte:component this={f.icon} size={20} style="color:{f.iconColor}" />
        </div>
        <h3 class="feature-title">{f.title}</h3>
        <p class="feature-desc">{f.desc}</p>
      </div>
    {/each}
  </div>
</section>

<!-- ═══ CARD TIERS ════════════════════════════════════════════════ -->
<section class="max-w-7xl mx-auto px-4 py-10">
  <div class="tiers-row">
    <div class="tiers-copy" in:fly={{ y: 18, duration: 450 }}>
      <div class="eyebrow">Progression</div>
      <h2 class="section-title font-cinzel">Three Tiers.<br />One Path.</h2>
      <p class="section-sub mt-3">
        Solve problems to unlock cards. Collect duplicates to tier them up.
        Mastered cards hit hardest in the arena.
      </p>

      <div class="tiers-list">
        {#each tiers as tier, i}
          <div class="tier-item" in:fly={{ x: -16, duration: 400, delay: i * 80 }}>
            <span class="tier-dot" style="background:{tier.color}; box-shadow: 0 0 8px {tier.color}88;"></span>
            <div>
              <span class="tier-name" style="color:{tier.color}">{tier.name}</span>
              <span class="tier-desc"> — {tier.desc}</span>
            </div>
          </div>
        {/each}
      </div>
    </div>

    <!-- Element matchups table -->
    <div class="elements-grid" in:fly={{ y: 20, duration: 500, delay: 120 }}>
      <div class="elements-label">Element Matchups · 1.3× strong · 0.7× weak</div>
      {#each elements as el, i}
        <div class="element-row hover-lift" in:fly={{ x: 12, duration: 380, delay: i * 60 }}>
          <div class="el-name" style="color:{el.color};">
            <span class="el-icon"><svelte:component this={el.icon} size={13} /></span>
            {el.name}
          </div>
          <div class="el-matchups">
            <span class="el-strong">▲ {el.strong}</span>
            <span class="el-weak">▼ {el.weak}</span>
          </div>
        </div>
      {/each}
    </div>
  </div>
</section>

<!-- ═══ CTA BANNER ════════════════════════════════════════════════ -->
{#if !$currentUser}
  <section class="max-w-7xl mx-auto px-4 py-16 mb-8" in:fly={{ y: 20, duration: 500 }}>
    <div class="cta-banner panel-gold rounded-3xl">
      <span class="cta-star cta-star-1 animate-pulse-slow" aria-hidden="true"><Star size={18} /></span>
      <span class="cta-star cta-star-2 animate-pulse-slow" aria-hidden="true"><Star size={12} /></span>
      <h2 class="cta-heading font-cinzel text-gradient-gold">Ready to Duel?</h2>
      <p class="cta-sub">
        Connect your LeetCode account, sync your solves, and claim your starter deck.
      </p>
      <div class="cta-actions">
        <a href="/login" class="btn-primary rounded-xl px-8 py-3 text-base">
          Create Account <ChevronRight size={16} />
        </a>
        <a href="/leaderboard" class="btn-ghost rounded-xl px-8 py-3 text-base">
          View Rankings
        </a>
      </div>
    </div>
  </section>
{/if}

<style>
  /* ── Hero ────────────────────────────────────────────────────── */

  .hero-section {
    position: relative;
    overflow: hidden;
  }

  .hero-grid {
    display: grid;
    grid-template-columns: 1fr;
    gap: 3rem;
    align-items: center;
  }

  @media (min-width: 1024px) {
    .hero-grid {
      grid-template-columns: 1fr 1fr;
      gap: 4rem;
    }
  }

  .hero-copy {
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
  }

  .hero-badge {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    padding: 0.3rem 0.85rem;
    border-radius: 999px;
    border: 1px solid rgba(124, 58, 237, 0.35);
    background: rgba(124, 58, 237, 0.1);
    font-size: 0.7rem;
    font-weight: 700;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: #c4b5fd;
    width: fit-content;
  }

  .hero-heading {
    font-size: clamp(2.8rem, 7vw, 5rem);
    font-weight: 900;
    line-height: 1.06;
    color: #e6ecff;
    letter-spacing: -0.02em;
    margin: 0;
  }

  .hero-sub {
    font-size: 1.05rem;
    line-height: 1.65;
    color: rgba(154, 165, 196, 0.9);
    max-width: 34rem;
    margin: 0;
  }

  .hero-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 0.75rem;
    align-items: center;
  }

  .hero-stats {
    display: flex;
    align-items: center;
    gap: 1.25rem;
    padding-top: 0.5rem;
  }

  .stat-item {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .stat-num {
    font-size: 1.4rem;
    font-weight: 700;
    line-height: 1;
  }

  .stat-label {
    font-size: 0.7rem;
    font-weight: 600;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: rgba(107, 122, 158, 0.8);
  }

  .stat-divider {
    width: 1px;
    height: 32px;
    background: rgba(255,255,255,0.1);
  }

  .hero-bottom-fade {
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    height: 120px;
    background: linear-gradient(to bottom, transparent, rgba(4,6,15,0.5));
    pointer-events: none;
  }

  /* ── Hero cards (decorative) ─────────────────────────────────── */

  .hero-cards-area {
    position: relative;
    display: flex;
    justify-content: center;
    align-items: center;
    height: 380px;
    perspective: 900px;
  }

  @media (min-width: 1024px) {
    .hero-cards-area { height: 480px; }
  }

  .hero-card-slot {
    position: absolute;
  }

  .slot-center {
    z-index: 3;
    --card-rotate: 0deg;
  }

  .slot-left {
    z-index: 1;
    transform: rotate(-15deg) translateX(-110px) translateY(20px) scale(0.88);
    --card-rotate: -15deg;
  }

  .slot-right {
    z-index: 2;
    transform: rotate(12deg) translateX(115px) translateY(14px) scale(0.88);
    --card-rotate: 12deg;
  }

  /* ── Preview card ────────────────────────────────────────────── */

  .preview-card {
    position: relative;
    width: 172px;
    height: 248px;
    border-radius: 14px;
    overflow: hidden;
    background: radial-gradient(circle at 50% 8%, #1f2a44 0%, #111a2f 54%, #0b1220 100%);
    box-shadow:
      0 24px 50px -12px rgba(0, 0, 0, 0.9),
      0 0 0 1px rgba(255, 255, 255, 0.03) inset;
  }

  .preview-card--small {
    width: 145px;
    height: 208px;
  }

  .preview-card--legendary {
    border: 1px solid rgba(245, 158, 11, 0.45);
    box-shadow:
      0 24px 50px -10px rgba(0, 0, 0, 0.9),
      0 0 32px -8px rgba(245, 158, 11, 0.35),
      0 0 0 1px rgba(255, 255, 255, 0.04) inset;
  }

  .preview-card--back {
    background: radial-gradient(circle at 50% 45%, #1a1040 0%, #0b0b1e 60%, #06060f 100%);
    border: 1px solid rgba(124, 58, 237, 0.25);
  }

  /* Foil shimmer overlay */
  .preview-foil {
    position: absolute;
    inset: 0;
    border-radius: inherit;
    background: linear-gradient(
      105deg,
      transparent 35%,
      rgba(255, 215, 0, 0.18) 50%,
      transparent 65%
    );
    background-size: 200% 100%;
    animation: shimmer 4s linear infinite;
    pointer-events: none;
    mix-blend-mode: screen;
  }

  .preview-frame-glow {
    position: absolute;
    inset: 0;
    border-radius: inherit;
    border: 1px solid rgba(245, 158, 11, 0.5);
    box-shadow: 0 0 20px -4px rgba(245, 158, 11, 0.4) inset;
    pointer-events: none;
  }

  .preview-header {
    position: absolute;
    top: 5%;
    left: 7%;
    right: 7%;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 4px;
    z-index: 2;
  }

  .preview-chip {
    font-size: 7.5px;
    font-weight: 700;
    letter-spacing: 0.07em;
    text-transform: uppercase;
    padding: 2.5px 6px;
    border-radius: 999px;
    display: inline-flex;
    align-items: center;
    gap: 3px;
  }

  .preview-chip--element {
    border: 1px solid color-mix(in srgb, var(--ec) 55%, #334155 45%);
    color: color-mix(in srgb, var(--ec) 50%, #e2e8f0 50%);
    background: rgba(16, 27, 49, 0.88);
  }

  .preview-chip--rarity {
    border: 1px solid color-mix(in srgb, var(--rc) 55%, #334155 45%);
    color: color-mix(in srgb, var(--rc) 55%, #e2e8f0 45%);
    background: rgba(16, 27, 49, 0.88);
  }

  .preview-art-zone {
    position: absolute;
    top: 17%;
    left: 7%;
    right: 7%;
    height: 42%;
    border-radius: 10px;
    border: 1px solid rgba(245, 158, 11, 0.3);
    background: radial-gradient(circle at 50% 35%, rgba(245,158,11,0.14), rgba(12,22,42,0.9) 58%);
    overflow: hidden;
    z-index: 2;
  }

  .preview-art-inner {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .preview-title-zone {
    position: absolute;
    top: 60%;
    left: 10%;
    right: 10%;
    text-align: center;
    z-index: 2;
  }

  .preview-title {
    font-size: 12px;
    font-weight: 700;
    color: #fef3c7;
    margin: 0 0 3px;
    text-shadow: 0 1px 4px rgba(0,0,0,0.8);
  }

  .preview-tier-chip {
    display: inline-block;
    padding: 2px 7px;
    border-radius: 999px;
    font-size: 7.5px;
    font-weight: 700;
    letter-spacing: 0.1em;
    color: #fef3c7;
    background: rgba(43, 29, 12, 0.9);
    border: 1px solid rgba(245, 158, 11, 0.5);
  }

  .preview-stats {
    position: absolute;
    left: 7%;
    right: 7%;
    bottom: 3%;
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 4px;
    z-index: 2;
  }

  .preview-stat {
    text-align: center;
    padding: 4px 2px;
    border-radius: 8px;
    border: 1px solid rgba(148,163,184,0.18);
    background: rgba(15, 26, 49, 0.82);
  }

  .preview-stat-val {
    display: block;
    font-size: 12px;
    font-weight: 700;
    line-height: 1;
  }

  .preview-stat-lbl {
    display: block;
    font-size: 8px;
    letter-spacing: 0.09em;
    color: rgba(203, 214, 233, 0.55);
    margin-top: 2px;
  }

  /* Back card art */
  .preview-card-back-art {
    position: absolute;
    inset: 0;
    background:
      radial-gradient(circle at 50% 50%, rgba(124,58,237,0.22) 0%, transparent 60%),
      repeating-linear-gradient(45deg, rgba(124,58,237,0.04) 0, rgba(124,58,237,0.04) 1px, transparent 1px, transparent 10px);
    border-radius: inherit;
  }

  .preview-back-emblem {
    position: absolute;
    inset: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 6px;
    color: rgba(167, 139, 250, 0.7);
  }

  .preview-back-name {
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.16em;
    color: rgba(196, 181, 253, 0.6);
  }

  /* ── Sections ────────────────────────────────────────────────── */

  .section-header {
    text-align: center;
    margin-bottom: 2.5rem;
  }

  .section-title {
    font-size: clamp(1.6rem, 3.5vw, 2.4rem);
    font-weight: 800;
    color: #e6ecff;
    margin: 0 0 0.5rem;
    letter-spacing: -0.01em;
  }

  .section-sub {
    color: rgba(154, 165, 196, 0.8);
    font-size: 0.95rem;
    margin: 0;
  }

  .eyebrow {
    font-size: 0.7rem;
    font-weight: 700;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: #a78bfa;
    margin-bottom: 0.5rem;
  }

  /* ── Features grid ───────────────────────────────────────────── */

  .features-grid {
    display: grid;
    grid-template-columns: 1fr;
    gap: 1rem;
  }

  @media (min-width: 640px)  { .features-grid { grid-template-columns: 1fr 1fr; } }
  @media (min-width: 1024px) { .features-grid { grid-template-columns: repeat(3, 1fr); } }

  .feature-card {
    background: var(--fc);
    border: 1px solid var(--fb);
    border-radius: 1.25rem;
    padding: 1.75rem;
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .feature-icon-wrap {
    width: 44px;
    height: 44px;
    border-radius: 12px;
    border: 1px solid;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  .feature-title {
    font-size: 1.05rem;
    font-weight: 700;
    color: #e6ecff;
    margin: 0;
  }

  .feature-desc {
    font-size: 0.875rem;
    line-height: 1.6;
    color: rgba(154, 165, 196, 0.85);
    margin: 0;
  }

  /* ── Tiers + elements ────────────────────────────────────────── */

  .tiers-row {
    display: grid;
    grid-template-columns: 1fr;
    gap: 3rem;
    align-items: start;
  }

  @media (min-width: 1024px) {
    .tiers-row { grid-template-columns: 1fr 1fr; }
  }

  .tiers-list {
    display: flex;
    flex-direction: column;
    gap: 0.65rem;
    margin-top: 1rem;
  }

  .tier-item {
    display: flex;
    align-items: flex-start;
    gap: 0.75rem;
    font-size: 0.875rem;
  }

  .tier-dot {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    flex-shrink: 0;
    margin-top: 3px;
  }

  .tier-name { font-weight: 700; }
  .tier-desc { color: rgba(154, 165, 196, 0.75); }

  .elements-grid {
    background: rgba(255,255,255,0.025);
    border: 1px solid rgba(255,255,255,0.07);
    border-radius: 1.25rem;
    overflow: hidden;
  }

  .elements-label {
    padding: 0.75rem 1.25rem;
    font-size: 0.7rem;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: rgba(107, 122, 158, 0.8);
    border-bottom: 1px solid rgba(255,255,255,0.06);
  }

  .element-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    padding: 0.7rem 1.25rem;
    border-bottom: 1px solid rgba(255,255,255,0.04);
    transition: background-color 200ms ease;
  }

  .element-row:last-child { border-bottom: none; }
  .element-row:hover { background: rgba(255,255,255,0.03); }

  .el-name {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.85rem;
    font-weight: 700;
    min-width: 90px;
  }

  .el-icon { opacity: 0.85; line-height: 1; }

  .el-matchups {
    display: flex;
    align-items: center;
    gap: 1rem;
    font-size: 0.75rem;
    font-weight: 600;
  }

  .el-strong { color: #86efac; }
  .el-weak   { color: #fca5a5; }

  /* ── CTA banner ──────────────────────────────────────────────── */

  .cta-banner {
    position: relative;
    padding: 3.5rem 2rem;
    text-align: center;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1rem;
  }

  .cta-star {
    position: absolute;
    color: rgba(245,158,11,0.35);
  }

  .cta-star-1 { top: 1.5rem; right: 2.5rem; }
  .cta-star-2 { bottom: 2rem; left: 3rem; }

  .cta-heading {
    font-size: clamp(1.8rem, 4vw, 2.8rem);
    font-weight: 900;
    margin: 0;
    letter-spacing: -0.01em;
  }

  .cta-sub {
    color: rgba(154, 165, 196, 0.85);
    font-size: 1rem;
    max-width: 30rem;
    margin: 0;
  }

  .cta-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 0.75rem;
    justify-content: center;
    margin-top: 0.5rem;
  }

  @keyframes shimmer {
    0%   { background-position: -200% 0; }
    100% { background-position:  200% 0; }
  }
</style>
