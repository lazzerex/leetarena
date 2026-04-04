<script lang="ts">
  import '../app.css';
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import Nav from '$lib/components/Nav.svelte';
  import Notifications from '$lib/components/Notifications.svelte';
  import PackOpening from '$lib/components/PackOpening.svelte';
  import { supabase } from '$lib/supabase';
  import { authHydrated, currentUser, hasAuthSession } from '$lib/stores';
  import { onMount } from 'svelte';

  const AUTH_TIMEOUT_MS = 6000;
  const PROTECTED_ROUTE_PREFIXES = ['/collection', '/deck-builder', '/battle'];

  let protectedAuthRedirectInFlight = false;

  function isProtectedRoute(pathname: string): boolean {
    return PROTECTED_ROUTE_PREFIXES.some((prefix) =>
      pathname === prefix || pathname.startsWith(`${prefix}/`)
    );
  }

  $: currentPath = $page.url.pathname;
  $: routeIsProtected = isProtectedRoute(currentPath);

  $: if (routeIsProtected && $authHydrated && !$hasAuthSession && !protectedAuthRedirectInFlight) {
    protectedAuthRedirectInFlight = true;
    currentUser.set(null);
    void goto('/login', { replaceState: true }).finally(() => {
      protectedAuthRedirectInFlight = false;
    });
  }

  function withTimeout<T>(promiseLike: PromiseLike<T>, timeoutMs: number): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const id = setTimeout(() => reject(new Error('Auth request timed out')), timeoutMs);
      Promise.resolve(promiseLike)
        .then((result) => {
          clearTimeout(id);
          resolve(result);
        })
        .catch((error) => {
          clearTimeout(id);
          reject(error);
        });
    });
  }

  function toStoreUser(profile: any) {
    return {
      id: profile.id,
      username: profile.username,
      leetcodeUsername: profile.leetcode_username ?? profile.leetcodeUsername,
      coins: Number(profile.coins ?? 0),
      rating: Number(profile.rating ?? 1000),
      createdAt: profile.created_at ?? profile.createdAt ?? new Date().toISOString(),
    };
  }

  async function clearLocalAuthState() {
    hasAuthSession.set(false);
    currentUser.set(null);

    const timeout = new Promise<{ error: null }>((resolve) => {
      setTimeout(() => resolve({ error: null }), 2000);
    });

    try {
      await Promise.race([supabase.auth.signOut({ scope: 'local' }), timeout]);
    } catch {
      // Keep local state cleared even if auth client sign-out fails.
    }
  }

  async function verifySessionUser(session: any) {
    const accessToken = session?.access_token;
    if (!accessToken) return null;

    try {
      const { data, error } = await withTimeout(supabase.auth.getUser(accessToken), AUTH_TIMEOUT_MS);
      if (error || !data?.user?.id) return null;
      return data.user;
    } catch {
      return null;
    }
  }

  async function hydrateUserProfile(authUser: any) {
    const { data: existingProfile, error: profileError } = await withTimeout(
      supabase.from('users').select('*').eq('id', authUser.id).maybeSingle(),
      AUTH_TIMEOUT_MS
    );

    if (profileError) {
      throw profileError;
    }

    if (existingProfile) {
      return toStoreUser(existingProfile);
    }

    const username =
      authUser.user_metadata?.user_name ??
      authUser.user_metadata?.full_name ??
      authUser.email?.split('@')[0] ??
      'trainer';

    const { data: createdProfile, error: createError } = await withTimeout(
      supabase
        .from('users')
        .upsert(
          {
            id: authUser.id,
            username,
            coins: 500,
            rating: 1000,
            created_at: new Date().toISOString(),
          },
          { onConflict: 'id' }
        )
        .select('*')
        .single(),
      AUTH_TIMEOUT_MS
    );

    if (createError || !createdProfile) {
      throw createError ?? new Error('Unable to create user profile');
    }

    return toStoreUser(createdProfile);
  }

  let authRequestToken = 0;

  async function applySession(session: any) {
    const token = ++authRequestToken;
    const authUser = session?.user;

    if (!authUser) {
      hasAuthSession.set(false);
      currentUser.set(null);
      authHydrated.set(true);
      return;
    }

    const verifiedAuthUser = await verifySessionUser(session);
    if (!verifiedAuthUser) {
      if (token === authRequestToken) {
        await clearLocalAuthState();
        authHydrated.set(true);
      }
      return;
    }

    try {
      const hydratedUser = await hydrateUserProfile(verifiedAuthUser);
      if (token === authRequestToken) {
        hasAuthSession.set(true);
        currentUser.set(hydratedUser as any);
      }
    } catch {
      if (token === authRequestToken) {
        await clearLocalAuthState();
      }
    } finally {
      if (token === authRequestToken) {
        authHydrated.set(true);
      }
    }
  }

  onMount(() => {
    const hardFallback = setTimeout(() => {
      authHydrated.set(true);
    }, AUTH_TIMEOUT_MS + 500);

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      void applySession(session);
    });

    void (async () => {
      try {
        const { data } = await withTimeout(supabase.auth.getSession(), AUTH_TIMEOUT_MS);
        await applySession(data.session);
      } catch {
        // Keep existing session/profile state if onAuthStateChange already hydrated it.
        authHydrated.set(true);
      }
    })();

    return () => {
      clearTimeout(hardFallback);
      subscription.unsubscribe();
    };
  });
</script>

<div class="min-h-screen text-white relative overflow-x-hidden">
  <Nav />
  <main class="relative z-10">
    {#if routeIsProtected && (!$authHydrated || !$hasAuthSession)}
      <div class="max-w-7xl mx-auto px-4 py-8">
        <div class="max-w-xl rounded-2xl border border-gray-800 bg-gray-900/80 px-5 py-6 text-gray-300">
          {$authHydrated ? 'Redirecting to sign in...' : 'Restoring session...'}
        </div>
      </div>
    {:else}
      <slot />
    {/if}
  </main>
  <Notifications />
  <PackOpening />
</div>
