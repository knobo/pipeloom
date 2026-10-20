<script lang="ts">
  // One node: name (opens inspector), volume slider, mute, "set as default".
  import type { Node } from '../model';
  import { setDefault, setMute, setVolume } from '../api';
  import { run } from './dev-helpers';
  import { tr } from '../i18n.svelte';
  import Slider from './ui-Slider.svelte';
  import Icon from './dev-Icon.svelte';

  let { node, onselect, big = false, sub }: {
    node: Node; onselect?: (id: number) => void; big?: boolean; sub?: string;
  } = $props();
  const canDefault = $derived(/^Audio\/(Sink|Source)/.test(node.mediaClass));
</script>

<div class="row" class:big class:muted={node.mute}>
  <div class="head">
    {#if onselect}
      <button class="name link" onclick={() => onselect(node.id)} title={tr(`Vis detaljer for ${node.name}`, `Show details for ${node.name}`)}>{node.label}</button>
    {:else}
      <span class="name">{node.label}</span>
    {/if}
    {#if sub}<span class="sub">{sub}</span>{/if}
  </div>
  <div class="ctl">
    {#if node.volume !== undefined}
      <button class="icon" aria-pressed={!!node.mute} aria-label={node.mute ? tr('Slå på lyd', 'Unmute') : tr('Demp', 'Mute')}
        title={node.mute ? tr('Slå på lyd', 'Unmute') : tr('Demp', 'Mute')} onclick={() => run(setMute(node.id, !node.mute))}>
        <Icon kind={node.mute ? 'muted' : 'volume'} size={big ? 22 : 18} />
      </button>
      <Slider value={node.volume} {big} label={tr(`Volum ${node.label}`, `Volume ${node.label}`)} onchange={(v) => run(setVolume(node.id, v))} />
    {:else}
      <span class="sub">{tr('ingen volumkontroll', 'no volume control')}</span>
    {/if}
    {#if canDefault}
      {@const pending = node.isConfiguredDefault && !node.isDefault}
      {@const tip = node.isDefault ? tr('Er standard', 'Is default')
        : pending ? tr('Valgt som standard, men ikke tilgjengelig nå – WirePlumber bruker en annen enhet til den kommer tilbake',
                       'Chosen as default, but not available right now – WirePlumber uses another device until it returns')
        : tr('Sett som standard', 'Set as default')}
      <button class="icon star" class:on={node.isDefault} class:pending aria-pressed={node.isDefault}
        aria-label={tip} title={tip}
        onclick={() => !node.isDefault && run(setDefault(node.id))}>
        <Icon kind={node.isDefault ? 'star-filled' : 'star'} size={big ? 22 : 18} />
      </button>
    {/if}
  </div>
</div>

<style>
  .row { display: flex; flex-direction: column; gap: 2px; padding: 6px 0; }
  .head { display: flex; align-items: baseline; gap: 8px; min-width: 0; }
  .name { font-weight: 500; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .big .name { font-size: 16px; }
  .link { background: none; border: 0; padding: 0; cursor: pointer; text-align: left; }
  .link:hover { color: var(--accent); text-decoration: underline; }
  .sub { color: var(--text-dim); font-size: 12px; white-space: nowrap; }
  .ctl { display: flex; align-items: center; gap: 8px; }
  .icon { background: none; border: 0; padding: 4px; border-radius: 6px; cursor: pointer; color: var(--text-dim); display: grid; place-items: center; flex: none; }
  .icon:hover { background: var(--bg-elev-2); color: var(--text); }
  .muted .icon[aria-pressed='true'] { color: var(--danger); }
  .muted :global(.slider) { opacity: 0.5; }
  .star.on { color: var(--warn); cursor: default; }
  .star.pending { color: color-mix(in srgb, var(--warn) 60%, transparent); }
</style>
