<script lang="ts">
  import '../app.css';
  import Nav from '$lib/components/Nav.svelte';
  import Notifications from '$lib/components/Notifications.svelte';
  import PackOpening from '$lib/components/PackOpening.svelte';
  import { supabase } from '$lib/supabase';
  import { currentUser } from '$lib/stores';
  import { onMount } from 'svelte';

  onMount(async () => {
    const { data } = await supabase.auth.getSession();
    if (data.session?.user) {
      // Fetch user profile from our users table
      const { data: profile } = await supabase
        .from('users')
        .select('*')
        .eq('id', data.session.user.id)
        .single();
      if (profile) currentUser.set(profile);
    }

    supabase.auth.onAuthStateChange(async (_event, session) => {
      if (session?.user) {
        const { data: profile } = await supabase
          .from('users')
          .select('*')
          .eq('id', session.user.id)
          .single();
        if (profile) currentUser.set(profile);
      } else {
        currentUser.set(null);
      }
    });
  });
</script>

<div class="min-h-screen text-white relative overflow-x-hidden">
  <div class="pointer-events-none fixed inset-0 -z-10">
    <div class="absolute top-[-120px] right-[-140px] w-[520px] h-[520px] rounded-full blur-3xl bg-sky-400/10"></div>
    <div class="absolute bottom-[-160px] left-[-140px] w-[560px] h-[560px] rounded-full blur-3xl bg-amber-300/10"></div>
  </div>
  <Nav />
  <main class="relative z-10">
    <slot />
  </main>
  <Notifications />
  <PackOpening />
</div>
