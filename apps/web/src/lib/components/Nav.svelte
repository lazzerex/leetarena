<script lang="ts">
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import { authHydrated, currentUser, hasAuthSession } from '$lib/stores';
  import { notify } from '$lib/stores';
  import { supabase } from '$lib/supabase';
  import Package from 'lucide-svelte/icons/package';
  import Layers3 from 'lucide-svelte/icons/layers-3';
  import Blocks from 'lucide-svelte/icons/blocks';
  import Swords from 'lucide-svelte/icons/swords';
  import Trophy from 'lucide-svelte/icons/trophy';
  import LogOut from 'lucide-svelte/icons/log-out';
  import UserRound from 'lucide-svelte/icons/user-round';
  import Zap from 'lucide-svelte/icons/zap';

  const navItems = [
    { href: '/packs',        label: 'Packs',       icon: Package },
    { href: '/collection',   label: 'Collection',  icon: Layers3 },
    { href: '/deck-builder', label: 'Deck Builder', icon: Blocks },
    { href: '/battle',       label: 'Battle',      icon: Swords },
    { href: '/leaderboard',  label: 'Leaderboard', icon: Trophy },
  ];

  let signingOut = false;

  function isActive(href: string, pathname: string): boolean {
    if (href === '/') return pathname === '/';
    return pathname === href || pathname.startsWith(`${href}/`);
  }

  async function signOut() {
    if (signingOut) return;
    signingOut = true;
    try {
      hasAuthSession.set(false);
      currentUser.set(null);
      const timeout = new Promise<void>((r) => setTimeout(r, 2500));
      await Promise.race([supabase.auth.signOut({ scope: 'local' }), timeout]);
      await goto('/login', { replaceState: true });
      notify('success', 'Signed out');
    } finally {
      signingOut = false;
    }
  }
</script>

<nav class="nav-bar sticky top-0 z-40">
  <!-- Subtle top accent line -->
  <div class="nav-top-line" aria-hidden="true"></div>

  <div class="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between gap-4">

    <!-- Logo -->
    <a href="/" class="logo group flex-shrink-0">
      <span class="logo-icon">
        <Zap size={14} strokeWidth={2.5} />
      </span>
      <span class="logo-text font-cinzel">
        Leet<span class="logo-accent">Arena</span>
      </span>
    </a>

    <!-- Nav links (scrollable on mobile) -->
    <div class="nav-links flex items-center gap-0.5 flex-1 justify-center overflow-x-auto hide-scrollbar">
      {#each navItems as item}
        {@const active = isActive(item.href, $page.url.pathname)}
        <a href={item.href} class="nav-item flex-shrink-0" class:active>
          <span class="nav-icon">
            <svelte:component this={item.icon} size={13} strokeWidth={active ? 2.5 : 2} />
          </span>
          <span>{item.label}</span>
        </a>
      {/each}
    </div>

    <!-- Right: user / sign-in -->
    <div class="flex items-center gap-2 flex-shrink-0">
      {#if !$authHydrated}
        <div class="skeleton w-24 h-7 rounded-lg"></div>

      {:else if $hasAuthSession}
        <div class="flex items-center gap-3">
          {#if $currentUser}
            <!-- Coin gem display -->
            <div class="coin-chip" title="Coins">
              <span class="coin-icon">◈</span>
              <span class="coin-value font-rajdhani">{$currentUser.coins.toLocaleString()}</span>
            </div>
            <!-- Rating -->
            <span class="rating-chip font-rajdhani" title="Battle Rating">
              #{$currentUser.rating}
            </span>
          {/if}

          <!-- Profile link -->
          <a href="/profile" class="profile-btn">
            <UserRound size={13} />
            <span class="hidden sm:inline">{$currentUser?.username ?? 'Account'}</span>
          </a>

          <!-- Sign out -->
          <button
            type="button"
            on:click={signOut}
            disabled={signingOut}
            class="signout-btn"
            title="Sign out"
          >
            <LogOut size={13} />
          </button>
        </div>

      {:else}
        <a href="/login" class="signin-btn btn-primary rounded-xl px-4 py-1.5 text-sm">
          Sign In
        </a>
      {/if}
    </div>
  </div>

</nav>

<style>
  /* ── Nav shell ───────────────────────────────────────────────── */

  .nav-bar {
    background: rgba(4, 6, 15, 0.88);
    border-bottom: 1px solid rgba(124, 58, 237, 0.18);
    backdrop-filter: blur(20px);
    -webkit-backdrop-filter: blur(20px);
  }

  .nav-top-line {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 1px;
    background: linear-gradient(
      90deg,
      transparent 0%,
      rgba(124, 58, 237, 0.6) 30%,
      rgba(245, 158, 11, 0.5) 60%,
      transparent 100%
    );
  }

  /* ── Logo ────────────────────────────────────────────────────── */

  .logo {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    text-decoration: none;
    transition: opacity 200ms ease;
  }

  .logo:hover { opacity: 0.85; }

  .logo-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    border-radius: 8px;
    background: linear-gradient(135deg, rgba(124,58,237,0.8) 0%, rgba(109,40,217,0.9) 100%);
    border: 1px solid rgba(167, 139, 250, 0.4);
    box-shadow: 0 0 12px -2px rgba(124,58,237,0.6), inset 0 1px 0 rgba(255,255,255,0.12);
    color: #e9d5ff;
    flex-shrink: 0;
    transition: box-shadow 280ms ease;
  }

  .logo:hover .logo-icon {
    box-shadow: 0 0 20px -1px rgba(124,58,237,0.8), inset 0 1px 0 rgba(255,255,255,0.15);
  }

  .logo-text {
    font-size: 1.05rem;
    font-weight: 700;
    letter-spacing: 0.02em;
    color: #e6ecff;
  }

  .logo-accent {
    color: #a78bfa;
  }

  /* ── Nav items ───────────────────────────────────────────────── */

  .nav-item {
    position: relative;
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    padding: 0.38rem 0.7rem;
    border-radius: 0.5rem;
    font-size: 0.8rem;
    font-weight: 600;
    letter-spacing: 0.01em;
    color: rgba(154, 165, 196, 0.85);
    text-decoration: none;
    border: 1px solid transparent;
    transition: color 200ms ease, background-color 200ms ease, border-color 200ms ease;
    white-space: nowrap;
  }

  .nav-item::after {
    content: '';
    position: absolute;
    bottom: -1px;
    left: 25%;
    right: 25%;
    height: 2px;
    border-radius: 999px;
    background: linear-gradient(90deg, #a78bfa, #c4b5fd);
    box-shadow: 0 0 6px 1px rgba(167,139,250,0.6);
    transform: scaleX(0);
    transition: transform 240ms cubic-bezier(0.22, 1, 0.36, 1);
  }

  .nav-icon {
    opacity: 0.7;
    transition: opacity 200ms ease, transform 200ms ease;
  }

  .nav-item:hover {
    color: #e6ecff;
    background: rgba(124, 58, 237, 0.08);
    border-color: rgba(124, 58, 237, 0.15);
  }

  .nav-item:hover .nav-icon { opacity: 1; transform: scale(1.1); }

  .nav-item.active {
    color: #c4b5fd;
    background: rgba(124, 58, 237, 0.13);
    border-color: rgba(124, 58, 237, 0.22);
  }

  .nav-item.active .nav-icon { opacity: 1; }
  .nav-item.active::after { transform: scaleX(1); }

  /* ── User chips ──────────────────────────────────────────────── */

  .coin-chip {
    display: inline-flex;
    align-items: center;
    gap: 0.3rem;
    padding: 0.2rem 0.6rem;
    border-radius: 999px;
    background: rgba(245, 158, 11, 0.1);
    border: 1px solid rgba(245, 158, 11, 0.28);
    font-size: 0.8rem;
    font-weight: 700;
    color: #fcd34d;
  }

  .coin-icon {
    font-size: 0.75rem;
    color: #f59e0b;
    line-height: 1;
  }

  .coin-value { letter-spacing: 0.02em; }

  .rating-chip {
    font-size: 0.78rem;
    font-weight: 700;
    color: rgba(154, 165, 196, 0.7);
    letter-spacing: 0.02em;
  }

  .profile-btn {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    padding: 0.25rem 0.65rem;
    border-radius: 0.5rem;
    font-size: 0.8rem;
    font-weight: 600;
    color: rgba(230, 236, 255, 0.8);
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid rgba(255, 255, 255, 0.09);
    text-decoration: none;
    transition: color 200ms ease, background-color 200ms ease, border-color 200ms ease;
  }

  .profile-btn:hover {
    color: #e6ecff;
    background: rgba(255, 255, 255, 0.08);
    border-color: rgba(255, 255, 255, 0.16);
  }

  .signout-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 30px;
    height: 30px;
    border-radius: 0.5rem;
    color: rgba(107, 122, 158, 0.7);
    background: transparent;
    border: 1px solid transparent;
    cursor: pointer;
    transition: color 200ms ease, background-color 200ms ease, border-color 200ms ease;
  }

  .signout-btn:hover {
    color: #fca5a5;
    background: rgba(239, 68, 68, 0.1);
    border-color: rgba(239, 68, 68, 0.2);
  }

  .signout-btn:disabled { opacity: 0.4; cursor: not-allowed; }

  /* ── Skeleton placeholder ────────────────────────────────────── */

  .skeleton {
    background: linear-gradient(90deg, rgba(255,255,255,0.04) 25%, rgba(255,255,255,0.08) 50%, rgba(255,255,255,0.04) 75%);
    background-size: 200% 100%;
    animation: shimmer 1.5s ease-in-out infinite;
  }

  @keyframes shimmer {
    0%   { background-position: -200% 0; }
    100% { background-position:  200% 0; }
  }

  /* ── Mobile nav scroll ───────────────────────────────────────── */

  .nav-links {
    -ms-overflow-style: none;
    scrollbar-width: none;
  }

  .nav-links::-webkit-scrollbar { display: none; }
</style>
