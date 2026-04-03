<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { supabase } from '$lib/supabase';
  import { notify } from '$lib/stores';
  import LoaderCircle from 'lucide-svelte/icons/loader-circle';

  onMount(async () => {
    const { data, error } = await supabase.auth.getSession();

    if (error || !data.session) {
      notify('error', 'Authentication failed. Please try again.');
      goto('/login');
      return;
    }

    const { data: userData, error: userError } = await supabase.auth.getUser();
    const user = userData.user ?? data.session.user;
    if (userError || !user) {
      notify('error', 'Unable to read authenticated user. Please try again.');
      goto('/login');
      return;
    }

    const username =
      user.user_metadata?.['user_name'] ??
      user.user_metadata?.['full_name'] ??
      user.email?.split('@')[0] ??
      'trainer';

    notify('success', `Welcome to LeetArena, ${username}!`);

    goto('/packs');
  });
</script>

<div class="min-h-screen flex items-center justify-center">
  <div class="text-center">
    <div class="text-4xl mb-4 inline-flex"><LoaderCircle class="animate-spin" size={30} /></div>
    <p class="text-gray-400">Signing you in...</p>
  </div>
</div>
