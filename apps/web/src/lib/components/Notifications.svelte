<script lang="ts">
  import { fly } from 'svelte/transition';
  import { flip } from 'svelte/animate';
  import { notifications } from '$lib/stores';
  import CheckCircle2 from 'lucide-svelte/icons/check-circle-2';
  import CircleAlert from 'lucide-svelte/icons/circle-alert';
  import CircleHelp from 'lucide-svelte/icons/circle-help';
</script>

<div class="fixed top-4 right-4 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none">
  {#each $notifications as notif (notif.id)}
    <div
      in:fly={{ x: 60, duration: 300 }}
      out:fly={{ x: 60, duration: 200 }}
      animate:flip={{ duration: 200 }}
      class="pointer-events-auto px-4 py-3 rounded-xl shadow-xl text-sm font-medium border"
      class:bg-green-900={notif.type === 'success'}
      class:border-green-700={notif.type === 'success'}
      class:text-green-200={notif.type === 'success'}
      class:bg-red-900={notif.type === 'error'}
      class:border-red-700={notif.type === 'error'}
      class:text-red-200={notif.type === 'error'}
      class:bg-gray-800={notif.type === 'info'}
      class:border-gray-600={notif.type === 'info'}
      class:text-gray-200={notif.type === 'info'}
    >
      <span class="inline-flex items-center gap-2">
        {#if notif.type === 'success'}
          <CheckCircle2 size={16} />
        {:else if notif.type === 'error'}
          <CircleAlert size={16} />
        {:else}
          <CircleHelp size={16} />
        {/if}
        {notif.message}
      </span>
    </div>
  {/each}
</div>
