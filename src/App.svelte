<script lang="ts">
  import { onMount } from 'svelte';
  import { pw, startStore } from './lib/store.svelte';
  import { i18n, setLang, tr, type Lang } from './lib/i18n.svelte';
  import GraphView from './lib/graph/GraphView.svelte';
  import Inspector from './lib/panels/Inspector.svelte';
  import DevicesPanel from './lib/panels/DevicesPanel.svelte';
  import SettingsPanel from './lib/panels/SettingsPanel.svelte';
  import CommandPalette, { type PaletteTarget } from './lib/panels/CommandPalette.svelte';

  type Tab = 'graph' | 'devices' | 'settings';
  let tab = $state<Tab>('devices');
  let selected = $state<number | null>(null);
  let focusKey = $state<string | null>(null);
  let paletteOpen = $state(false);

  onMount(() => { setLang(i18n.lang); startStore(); });

  function pick(t: PaletteTarget) {
    paletteOpen = false;
    if (t.kind === 'node') { tab = 'graph'; selected = t.id; }
    else if (t.kind === 'device') { tab = 'devices'; focusKey = `device:${t.id}`; }
    else { tab = 'settings'; focusKey = t.kind === 'setting' ? t.key : `${t.name}:${t.key}`; }
  }

  function onkey(e: KeyboardEvent) {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); paletteOpen = !paletteOpen; }
  }
</script>

<svelte:window onkeydown={onkey} />

<div class="shell">
  <header>
    <div class="brand">pipeloom</div>
    <nav>
      <button class:on={tab === 'graph'} onclick={() => (tab = 'graph')}>{tr('Graf', 'Graph')}</button>
      <button class:on={tab === 'devices'} onclick={() => (tab = 'devices')}>{tr('Enheter', 'Devices')}</button>
      <button class:on={tab === 'settings'} onclick={() => (tab = 'settings')}>{tr('Innstillinger', 'Settings')}</button>
    </nav>
    <button class="search" onclick={() => (paletteOpen = true)}>{tr('Søk i alt …', 'Search everything …')} <kbd>Ctrl K</kbd></button>
    <div class="lang" role="group" aria-label={tr('Språk', 'Language')}>
      {#each [['no', 'NO'], ['en', 'EN']] as [l, label] (l)}
        <button class:on={i18n.lang === l} aria-pressed={i18n.lang === l} onclick={() => setLang(l as Lang)}>{label}</button>
      {/each}
    </div>
  </header>

  {#if pw.error}<div class="error">{pw.error}</div>{/if}

  <main>
    {#if tab === 'graph'}
      <GraphView model={pw.model} {selected} onselect={(id) => (selected = id)} />
      {#if selected !== null}
        <Inspector model={pw.model} nodeId={selected} onclose={() => (selected = null)} />
      {/if}
    {:else if tab === 'devices'}
      <DevicesPanel model={pw.model} {focusKey} onselect={(id) => { tab = 'graph'; selected = id; }} />
    {:else}
      <SettingsPanel model={pw.model} {focusKey} />
    {/if}
  </main>
</div>

<CommandPalette model={pw.model} bind:open={paletteOpen} onpick={pick} />

<style>
  .shell { display: flex; flex-direction: column; height: 100%; }
  header { display: flex; align-items: center; gap: 24px; padding: 10px 16px; border-bottom: 1px solid var(--border); background: var(--bg-elev); }
  .brand { font-weight: 700; letter-spacing: 0.02em; color: var(--accent); }
  nav { display: flex; gap: 4px; }
  nav button { background: none; border: 0; padding: 6px 12px; border-radius: 8px; color: var(--text-dim); cursor: pointer; }
  nav button.on { background: var(--bg-elev-2); color: var(--text); }
  .search { margin-left: auto; min-width: 260px; text-align: left; background: var(--bg-elev-2); border: 1px solid var(--border); border-radius: 8px; padding: 6px 10px; color: var(--text-dim); cursor: pointer; display: flex; justify-content: space-between; gap: 12px; }
  .lang { display: flex; border: 1px solid var(--border); border-radius: 8px; overflow: hidden; }
  .lang button { background: none; border: 0; padding: 5px 8px; font-size: 12px; font-weight: 600; color: var(--text-dim); cursor: pointer; }
  .lang button.on { background: var(--bg-elev-2); color: var(--text); }
  kbd { font: 12px var(--mono); opacity: 0.7; }
  .error { background: color-mix(in srgb, var(--danger) 20%, transparent); padding: 6px 16px; }
  main { position: relative; flex: 1; min-height: 0; overflow: hidden; }
</style>
