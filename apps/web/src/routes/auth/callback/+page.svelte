<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { supabase } from '$lib/supabase';
  import { currentUser, notify } from '$lib/stores';
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

    // Ensure user profile exists; preserve existing profile data on repeat sign-ins.
    const { data: existingProfile } = await supabase
      .from('users')
      .select('*')
      .eq('id', user.id)
      .single();

    const username =
      user.user_metadata?.['user_name'] ??
      user.user_metadata?.['full_name'] ??
      user.email?.split('@')[0] ??
      'trainer';

    const { data: profile } = await supabase
      .from('users')
      .upsert({
        id: user.id,
        username: existingProfile?.username ?? username,
        coins: existingProfile?.coins ?? 500,
        rating: existingProfile?.rating ?? 1000,
        created_at: existingProfile?.created_at ?? new Date().toISOString(),
      }, { onConflict: 'id' })
      .select()
      .single();

    if (profile) {
      currentUser.set(profile);
      notify('success', `Welcome to LeetArena, ${profile.username}!`);
    }

    goto('/packs');
  });
</script>

<div class="min-h-screen flex items-center justify-center">
  <div class="text-center">
    <div class="text-4xl mb-4 inline-flex"><LoaderCircle class="animate-spin" size={30} /></div>
    <p class="text-gray-400">Signing you in...</p>
  </div>
</div>
