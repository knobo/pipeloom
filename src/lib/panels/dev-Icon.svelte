<script lang="ts">
  import type { IconKind } from './dev-helpers';
  let { kind, size = 22 }: { kind: IconKind | 'muted' | 'volume' | 'star' | 'star-filled'; size?: number } = $props();
</script>

<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"
  stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
  {#if kind === 'speaker'}
    <rect x="5" y="2.5" width="14" height="19" rx="2.5" /><circle cx="12" cy="14.5" r="3.5" /><circle cx="12" cy="7" r="1.2" />
  {:else if kind === 'headphones'}
    <path d="M4 15v-3a8 8 0 0 1 16 0v3" /><rect x="3" y="14" width="4.5" height="7" rx="1.5" /><rect x="16.5" y="14" width="4.5" height="7" rx="1.5" />
  {:else if kind === 'mic'}
    <rect x="9" y="2.5" width="6" height="11" rx="3" /><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21M8.5 21h7" />
  {:else if kind === 'bluetooth'}
    <path d="M7 7l10 10-5 4.5V2.5l5 4.5L7 17" />
  {:else if kind === 'camera'}
    <rect x="2.5" y="6" width="13" height="12" rx="2" /><path d="M15.5 10.5 21.5 7v10l-6-3.5" />
  {:else if kind === 'hdmi'}
    <rect x="2.5" y="4" width="19" height="13" rx="1.5" /><path d="M8 21h8M12 17v4" />
  {:else if kind === 'volume' || kind === 'muted'}
    <path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" />
    {#if kind === 'volume'}<path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11" />{:else}<path d="m16 9.5 5 5m0-5-5 5" />{/if}
  {:else}
    <path d="m12 3 2.7 5.6 6.1.8-4.5 4.2 1.1 6.1L12 16.8l-5.4 2.9 1.1-6.1-4.5-4.2 6.1-.8z" fill={kind === 'star-filled' ? 'currentColor' : 'none'} />
  {/if}
</svg>
