<script lang="ts">
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import { authHydrated, currentUser, hasAuthSession } from '$lib/stores';
  import { notify } from '$lib/stores';
  import { supabase } from '$lib/supabase';
  import Home from 'lucide-svelte/icons/home';
  import Package from 'lucide-svelte/icons/package';
  import Layers3 from 'lucide-svelte/icons/layers-3';
  import Blocks from 'lucide-svelte/icons/blocks';
  import Swords from 'lucide-svelte/icons/swords';
  import Trophy from 'lucide-svelte/icons/trophy';
  import Coins from 'lucide-svelte/icons/coins';
  import LogOut from 'lucide-svelte/icons/log-out';
  import UserRound from 'lucide-svelte/icons/user-round';
  import Sparkles from 'lucide-svelte/icons/sparkles';

  const navItems = [
    { href: '/', label: 'Home', icon: Home },
    { href: '/packs', label: 'Packs', icon: Package },
    { href: '/collection', label: 'Collection', icon: Layers3 },
    { href: '/deck-builder', label: 'Deck Builder', icon: Blocks },
    { href: '/battle', label: 'Battle', icon: Swords },
    { href: '/leaderboard', label: 'Leaderboard', icon: Trophy },
  ];

  let signingOut = false;

  function isNavActive(href: string, pathname: string): boolean {
    if (href === '/') return pathname === '/';
    return pathname === href || pathname.startsWith(`${href}/`);
  }

  async function tryLocalSignOutWithTimeout(ms = 2500) {
    const timeout = new Promise<{ error: null }>((resolve) => {
      setTimeout(() => resolve({ error: null }), ms);
    });

    try {
      await Promise.race([supabase.auth.signOut({ scope: 'local' }), timeout]);
    } catch {
      // We still clear local UI state and redirect even if provider revoke fails.
    }
  }

  async function signOut() {
    if (signingOut) return;
    signingOut = true;
    try {
      hasAuthSession.set(false);
      currentUser.set(null);
      await tryLocalSignOutWithTimeout();
      await goto('/login', { replaceState: true });
      notify('success', 'Signed out');
    } finally {
      signingOut = false;
    }
  }
</script>

<nav class="glass-panel sticky top-0 z-40 border-b border-white/10">
  <div class="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
    <!-- Logo -->
    <a href="/" class="group flex items-center gap-2 font-black text-xl tracking-tight">
      <span class="w-8 h-8 rounded-lg bg-sky-400/15 text-sky-300 border border-sky-300/30 flex items-center justify-center transition-all duration-300 group-hover:-translate-y-0.5 group-hover:scale-105">
        <Sparkles size={16} />
      </span>
      <span class="text-white transition-colors duration-300 group-hover:text-sky-100">Leet<span class="text-sky-300">Arena</span></span>
    </a>

    <!-- Nav links -->
    <div class="hidden md:flex items-center gap-1">
      {#each navItems as item}
        <a
          href={item.href}
          class="group px-3 py-2 rounded-lg text-sm font-medium transition-all duration-300 inline-flex items-center gap-2
                 {isNavActive(item.href, $page.url.pathname)
                   ? 'bg-sky-400/20 text-sky-200 border border-sky-300/25'
                   : 'text-slate-300 hover:text-white hover:bg-white/5 hover:-translate-y-0.5 hover:border-white/20 border border-transparent'}"
        >
          <span class="transition-transform duration-300 group-hover:scale-110 group-hover:-rotate-3">
            <svelte:component this={item.icon} size={14} />
          </span>
          {item.label}
        </a>
      {/each}
    </div>

    <!-- User section -->
    <div class="flex items-center gap-3">
      {#if !$authHydrated}
        <div class="h-8 w-28 rounded-lg bg-gray-800/70 border border-gray-700/80"></div>
      {:else if $hasAuthSession}
        <div class="flex items-center gap-2">
          {#if $currentUser}
            <span class="text-sky-200 text-sm font-bold inline-flex items-center gap-1.5">
              <Coins size={14} /> {$currentUser.coins.toLocaleString()}
            </span>
            <span class="text-gray-400 text-sm hidden sm:inline">
              #{$currentUser.rating}
            </span>
            <a href="/profile" class="text-sm text-gray-300 hover:text-white transition-colors inline-flex items-center gap-1.5">
              <UserRound size={14} />
              {$currentUser.username}
            </a>
          {:else}
            <a href="/profile" class="text-sm text-gray-300 hover:text-white transition-colors inline-flex items-center gap-1.5">
              <UserRound size={14} />
              Account
            </a>
          {/if}
          <button
            type="button"
            on:click={signOut}
            disabled={signingOut}
            class="text-xs text-gray-500 hover:text-red-300 transition-colors px-2 py-1 rounded inline-flex items-center gap-1"
          >
            <LogOut size={12} />
            Sign out
          </button>
        </div>
      {:else}
        <a
          href="/login"
          class="px-4 py-1.5 bg-amber-500 hover:bg-amber-400 hover:-translate-y-0.5 text-black font-bold rounded-lg text-sm transition-all duration-300"
        >
          Sign in
        </a>
      {/if}
    </div>
  </div>

  <!-- Mobile nav -->
  <div class="md:hidden flex border-t border-gray-800 overflow-x-auto">
    {#each navItems as item}
      <a
        href={item.href}
        class="flex-1 flex flex-col items-center py-2 text-xs font-medium min-w-[3.5rem] transition-all duration-300
               {isNavActive(item.href, $page.url.pathname) ? 'text-sky-300 bg-sky-400/5' : 'text-gray-500 hover:text-sky-200'}"
      >
        <svelte:component this={item.icon} size={16} />
        <span class="mt-0.5">{item.label}</span>
      </a>
    {/each}
  </div>
</nav>
