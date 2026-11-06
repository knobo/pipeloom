<script lang="ts">
  // Where an app stream plays (or records from): a pill showing the live destination, opening a menu of devices.
  import { tick } from 'svelte';
  import type { Model, Node } from '../model';
  import { deleteMetadata, setMetadata } from '../api';
  import { appPinned, linkedTarget, nodeKind, pinnedByApp, pinnedTarget, run, targetChoices } from './dev-helpers';
  import { tr } from '../i18n.svelte';
  import Icon from './dev-Icon.svelte';

  let { node, model }: { node: Node; model: Model } = $props();

  const out = $derived(node.role === 'app-out');
  const pinned = $derived(pinnedTarget(node, model));
  const linked = $derived(linkedTarget(node, model));
  const byApp = $derived(!!pinned && pinnedByApp(node, model));
  const choices = $derived(targetChoices(node, model));
  const shown = $derived(pinned ?? linked);
  const shownKind = $derived(shown ? nodeKind(shown, model) : undefined);
  const live = $derived(node.state === 'running');

  let open = $state(false);
  let up = $state(false);
  let trigger: HTMLButtonElement;
  let menu = $state<HTMLDivElement>();
  const uid = $derived(`route-${node.id}`);

  // Pinning via target.object is what pavucontrol does. For "default": delete the key, or write "-1" when the app
  // pinned itself, since only "-1" overrides the stream's own target.object.
  function pick(target: string) {
    run(target ? setMetadata('default', node.id, 'target.object', target)
      : appPinned(node) ? setMetadata('default', node.id, 'target.object', '-1')
      : deleteMetadata('default', node.id, 'target.object'));
    close();
  }

  // Keyboard opens focus the selected option; a mouse click focuses the list itself, so no ring appears
  // until the arrow keys are used.
  async function show(kbd: boolean) {
    const r = trigger.getBoundingClientRect(), need = Math.min(360, 80 + 52 * choices.length);
    up = innerHeight - r.bottom < need + 12 && r.top > innerHeight - r.bottom;
    open = true;
    await tick();
    const sel = menu?.querySelector<HTMLElement>('[aria-selected="true"]') ?? menu?.querySelector<HTMLElement>('[role="option"]');
    (kbd ? sel : menu)?.focus();
  }
  function close(refocus = true) {
    open = false;
    if (refocus) trigger?.focus();
  }

  function onkey(e: KeyboardEvent) {
    const items = [...(menu?.querySelectorAll<HTMLElement>('[role="option"]') ?? [])];
    const i = items.indexOf(document.activeElement as HTMLElement);
    // from the list itself, the first arrow press lands on the selected option
    if (i < 0 && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
      e.preventDefault();
      return (items.find((x) => x.getAttribute('aria-selected') === 'true') ?? items[0])?.focus();
    }
    const go = (j: number) => { e.preventDefault(); items[(j + items.length) % items.length]?.focus(); };
    if (e.key === 'ArrowDown') go(i + 1);
    else if (e.key === 'ArrowUp') go(i - 1);
    else if (e.key === 'Home') go(0);
    else if (e.key === 'End') go(items.length - 1);
    else if (e.key === 'Escape') { e.preventDefault(); close(); }
    else if (e.key === 'Tab') close(false);
  }
</script>

<svelte:window onpointerdown={(e) => open && !(e.target as Element).closest(`#${uid}-wrap`) && close(false)} />

<div class="wrap" id="{uid}-wrap">
  <button bind:this={trigger} class="pill" class:pinned={!!pinned} class:byapp={byApp}
    aria-haspopup="listbox" aria-expanded={open} aria-controls="{uid}-menu"
    aria-label={`${out ? tr('Spiller på', 'Playing on') : tr('Tar opp fra', 'Recording from')} ${shown?.label ?? tr('ingenting', 'nothing')}${pinned ? '' : tr(', følger standard', ', following default')}`}
    title={byApp ? tr('Appen har selv valgt denne enheten og følger ikke standarden', 'The app chose this device itself and does not follow the default') : undefined}
    onclick={(e) => (open ? close() : show(e.detail === 0))}>
    <span class="dev"><Icon kind={shownKind?.icon ?? (out ? 'speaker' : 'mic')} size={15} /></span>
    <span class="lbl">{shown?.label ?? tr('Ikke koblet', 'Not connected')}</span>
    {#if pinned}<span class="mark" aria-hidden="true"><Icon kind="pin" size={13} /></span>{/if}
    <span class="chev" class:flip={open}><Icon kind="chevron" size={14} /></span>
  </button>

  {#if open}
    <div bind:this={menu} class="menu" class:up id="{uid}-menu" role="listbox" tabindex="-1"
      aria-label={out ? tr('Velg utgang', 'Choose output') : tr('Velg inngang', 'Choose input')} onkeydown={onkey}>
      {#if byApp}
        <p class="note">{tr('Appen valgte denne enheten selv, så den hopper ikke med når du bytter standard.', 'The app picked this device itself, so it will not move when you change the default.')}</p>
      {/if}
      <button class="opt" role="option" aria-selected={!pinned} onclick={() => pick('')}>
        <span class="tile follow"><Icon kind="follow" size={17} /></span>
        <span class="txt">
          <span class="t">{tr('Følg standard', 'Follow default')}</span>
          <span class="s">{tr('Bytter når standarden byttes', 'Moves when the default changes')}</span>
        </span>
        {#if !pinned}<span class="tick"><Icon kind="check" size={16} /></span>{/if}
      </button>
      <div class="sep" role="presentation"></div>
      {#each choices as c (c.id)}
        {@const k = nodeKind(c, model)}
        {@const here = linked?.id === c.id}
        <button class="opt" role="option" aria-selected={pinned?.id === c.id} onclick={() => pick(c.name)}>
          <span class="tile" class:here><Icon kind={k.icon} size={17} /></span>
          <span class="txt">
            <span class="t">{c.label}</span>
            <span class="s">{k.kind}{c.isDefault ? ` · ${tr('standard', 'default')}` : ''}</span>
          </span>
          {#if here}
            <span class="eq" class:live aria-label={live ? tr('spiller her nå', 'playing here now') : tr('koblet hit', 'connected here')}><i></i><i></i><i></i></span>
          {/if}
          {#if pinned?.id === c.id}<span class="tick"><Icon kind="check" size={16} /></span>{/if}
        </button>
      {/each}
    </div>
  {/if}
</div>

<style>
  .wrap { position: relative; flex: none; }
  .pill {
    display: inline-flex; align-items: center; gap: 7px; max-width: 280px; height: 30px; padding: 0 8px 0 5px;
    border-radius: 999px; border: 1px solid var(--border); background: var(--bg-elev-2); cursor: pointer;
    font-size: 13px; transition: border-color 0.15s, background-color 0.15s;
  }
  .pill:hover, .pill[aria-expanded='true'] { border-color: color-mix(in srgb, var(--accent) 55%, var(--border)); }
  .dev {
    width: 22px; height: 22px; border-radius: 50%; display: grid; place-items: center; flex: none;
    background: color-mix(in srgb, var(--accent) 16%, transparent); color: var(--accent);
  }
  .lbl { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-weight: 500; }
  .mark { color: var(--accent); display: grid; }
  .byapp .mark, .byapp .dev { color: var(--warn); }
  .byapp .dev { background: color-mix(in srgb, var(--warn) 16%, transparent); }
  .chev { color: var(--text-dim); display: grid; transition: transform 0.2s cubic-bezier(0.16, 1, 0.3, 1); }
  .chev.flip { transform: rotate(180deg); }

  .menu {
    position: absolute; right: 0; top: calc(100% + 6px); z-index: 20; width: 320px; max-height: 360px; overflow: auto;
    padding: 6px; border-radius: 14px; border: 1px solid var(--border); background: var(--bg-elev);
    box-shadow: var(--shadow), 0 1px 2px rgb(0 0 0 / 0.2);
    outline: none; transform-origin: top right; animation: pop 0.18s cubic-bezier(0.16, 1, 0.3, 1);
  }
  .menu.up { top: auto; bottom: calc(100% + 6px); transform-origin: bottom right; }
  @keyframes pop { from { opacity: 0; transform: translateY(-4px) scale(0.97); } }
  .menu.up { animation-name: popup; }
  @keyframes popup { from { opacity: 0; transform: translateY(4px) scale(0.97); } }

  .note { margin: 4px 6px 8px; padding: 8px 10px; border-radius: 9px; font-size: 12px; line-height: 1.4;
    color: var(--warn); background: color-mix(in srgb, var(--warn) 10%, transparent); }
  .opt {
    width: 100%; display: flex; align-items: center; gap: 11px; padding: 7px 8px; border: 0; border-radius: 9px;
    background: none; text-align: left; cursor: pointer;
  }
  .opt:hover, .opt:focus-visible { background: var(--bg-elev-2); outline: none; }
  .opt:focus-visible { box-shadow: inset 0 0 0 1.5px var(--accent); }
  .tile {
    width: 34px; height: 34px; border-radius: 9px; display: grid; place-items: center; flex: none;
    background: var(--bg-elev-2); color: var(--text-dim); transition: color 0.15s, background-color 0.15s;
  }
  .opt:hover .tile { background: var(--bg); }
  .tile.here, .opt[aria-selected='true'] .tile { color: var(--accent); background: color-mix(in srgb, var(--accent) 14%, transparent); }
  .txt { display: flex; flex-direction: column; min-width: 0; flex: 1; }
  .t { font-weight: 500; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .s { font-size: 12px; color: var(--text-dim); }
  .tick { color: var(--accent); display: grid; flex: none; }
  .sep { height: 1px; background: var(--border); margin: 5px 8px; }

  /* "plays here": three bars, moving only while audio actually runs */
  .eq { display: inline-flex; align-items: flex-end; gap: 2px; height: 14px; flex: none; }
  .eq i { width: 3px; height: 40%; border-radius: 2px; background: var(--accent); opacity: 0.55; }
  .eq.live i { opacity: 1; animation: eq 0.9s ease-in-out infinite alternate; }
  .eq.live i:nth-child(2) { animation-delay: -0.3s; }
  .eq.live i:nth-child(3) { animation-delay: -0.6s; }
  @keyframes eq { from { height: 25%; } to { height: 100%; } }

  @media (prefers-reduced-motion: reduce) {
    .menu, .eq.live i { animation: none; }
    .chev { transition: none; }
  }
</style>
