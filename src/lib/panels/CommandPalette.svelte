<script lang="ts" module>
  export type PaletteTarget =
    | { kind: 'setting'; key: string }
    | { kind: 'meta'; name: string; key: string }
    | { kind: 'node'; id: number }
    | { kind: 'device'; id: number };
</script>

<script lang="ts">
  import { tick } from 'svelte';
  import type { Model } from '../model';
  import { setSetting } from '../api';
  import { buildIndex, search, type Doc } from './catalog';
  import { tr } from '../i18n.svelte';

  let { model, open = $bindable(), onpick }: { model: Model; open: boolean; onpick: (t: PaletteTarget) => void } = $props();

  let query = $state('');
  let active = $state(0);
  let input = $state<HTMLInputElement>();
  let listEl = $state<HTMLElement>();
  let pending = $state<Record<string, boolean>>({});
  let error = $state<string | null>(null);

  $effect(() => { void model; pending = {}; });
  $effect(() => {
    if (open) { query = ''; active = 0; error = null; tick().then(() => input?.focus()); }
  });

  const docs = $derived(open ? buildIndex(model, { objects: true }) : []);
  // Keep ranking, but show grouped: groups ordered by their best hit.
  const results = $derived.by(() => {
    const hits = search(docs, query).slice(0, 60);
    const groups = new Map<string, Doc[]>();
    for (const d of hits) groups.set(d.group, [...(groups.get(d.group) ?? []), d]);
    return [...groups];
  });
  const flat = $derived(results.flatMap(([, ds]) => ds));
  $effect(() => { void query; active = 0; });

  const isBool = (d: Doc) => d.kind === 'wp' && d.type === 'bool';
  const val = (d: Doc) => (d.id in pending ? pending[d.id] : d.value);

  function target(d: Doc): PaletteTarget {
    if (d.kind === 'wp') return { kind: 'setting', key: d.key };
    if (d.kind === 'node' || d.kind === 'device') return { kind: d.kind, id: Number(d.id.split(':')[1]) };
    const i = d.id.indexOf(':'); // "settings:clock.quantum", "gem:<id>", "<metadata>:<key>"
    return { kind: 'meta', name: d.id.slice(0, i), key: d.id.slice(i + 1) };
  }

  function pick(d: Doc | undefined) {
    if (!d) return;
    open = false;
    onpick(target(d));
  }

  async function toggle(d: Doc) {
    if (!isBool(d)) return;
    const next = !val(d);
    pending[d.id] = next;
    error = null;
    try { await setSetting(d.key, next, true); } catch (e) { delete pending[d.id]; error = `${d.key}: ${e}`; }
  }

  function onkey(e: KeyboardEvent) {
    if (e.key === 'Escape') { e.preventDefault(); open = false; }
    else if (e.key === 'ArrowDown') { e.preventDefault(); active = Math.min(active + 1, flat.length - 1); scroll(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); active = Math.max(active - 1, 0); scroll(); }
    else if (e.key === 'Enter') { e.preventDefault(); pick(flat[active]); }
    else if (e.key === 'Tab' && flat[active] && isBool(flat[active])) { e.preventDefault(); toggle(flat[active]); }
  }
  const scroll = () => tick().then(() => listEl?.querySelector('.on')?.scrollIntoView({ block: 'nearest' }));

  const show = (v: unknown) => (v === undefined ? '' : typeof v === 'string' ? v : typeof v === 'number' ? String(+v.toFixed(3)) : JSON.stringify(v));
</script>

{#if open}
  <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
  <div class="backdrop" onclick={(e) => e.target === e.currentTarget && (open = false)}>
    <div class="box" role="dialog" aria-modal="true" aria-label={tr('Søk i alt', 'Search everything')}>
      <input bind:this={input} bind:value={query} onkeydown={onkey} placeholder={tr('Søk i innstillinger, symptomer, noder, enheter …', 'Search settings, symptoms, nodes, devices …')}
        role="combobox" aria-expanded="true" aria-controls="palette-list" aria-activedescendant={flat[active] ? `pal-${active}` : undefined} />
      {#if error}<div class="err" role="alert">{error}</div>{/if}
      <div class="list" id="palette-list" role="listbox" bind:this={listEl}>
        {#each results as [group, ds] (group)}
          <div class="group">{group}</div>
          {#each ds as d (d.id)}
            {@const i = flat.indexOf(d)}
            <!-- svelte-ignore a11y_click_events_have_key_events -->
            <div class="res" class:on={i === active} id={`pal-${i}`} role="option" tabindex="-1" aria-selected={i === active}
              onmousemove={() => (active = i)} onclick={() => pick(d)}>
              <div class="main">
                <div class="t">{d.title}{#if d.changed}<span class="dot" title={tr('Endret fra standard', 'Changed from default')}></span>{/if}</div>
                <div class="k">{d.key}{#if d.detail && d.kind !== 'meta'} · {d.detail}{/if}</div>
              </div>
              {#if d.type}<span class="badge">{d.type}</span>{/if}
              {#if isBool(d)}
                <button class="switch" role="switch" aria-checked={!!val(d)} aria-label={`${val(d) ? tr('Slå av', 'Turn off') : tr('Slå på', 'Turn on')} ${d.key}`}
                  onclick={(e) => { e.stopPropagation(); toggle(d); }}><span></span></button>
              {:else if d.kind === 'wp' || d.kind === 'core'}
                <span class="val">{show(val(d))}</span>
              {/if}
            </div>
          {/each}
        {:else}
          <div class="none">{tr('Ingen treff', 'No matches')}</div>
        {/each}
      </div>
      <div class="foot"><kbd>↑↓</kbd> {tr('velg', 'select')} <kbd>Enter</kbd> {tr('åpne', 'open')} <kbd>Tab</kbd> {tr('slå av/på (lagres)', 'toggle (saved)')} <kbd>Esc</kbd> {tr('lukk', 'close')}</div>
    </div>
  </div>
{/if}

<style>
  .backdrop { position: fixed; inset: 0; z-index: 100; background: rgb(0 0 0 / 0.45); display: flex; justify-content: center; align-items: flex-start; padding-top: 12vh; }
  .box { width: min(680px, 92vw); max-height: 70vh; display: flex; flex-direction: column; background: var(--bg-elev); border: 1px solid var(--border); border-radius: 14px; box-shadow: var(--shadow); overflow: hidden; }
  input { font-size: 17px; padding: 14px 16px; border: 0; border-bottom: 1px solid var(--border); background: transparent; outline: none; }
  .list { overflow: auto; padding: 6px; }
  .group { font-size: 11px; text-transform: uppercase; letter-spacing: 0.06em; color: var(--text-dim); padding: 10px 10px 4px; }
  .res { display: flex; align-items: center; gap: 10px; padding: 7px 10px; border-radius: 8px; cursor: pointer; }
  .res.on { background: var(--bg-elev-2); box-shadow: inset 2px 0 0 var(--accent); }
  .main { flex: 1; min-width: 0; }
  .t { font-weight: 500; }
  .k { font: 12px var(--mono); color: var(--text-dim); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .dot { display: inline-block; width: 7px; height: 7px; border-radius: 50%; background: var(--accent); margin-left: 6px; vertical-align: middle; }
  .badge { font: 11px var(--mono); padding: 1px 6px; border-radius: 6px; border: 1px solid var(--border); color: var(--text-dim); white-space: nowrap; max-width: 140px; overflow: hidden; text-overflow: ellipsis; }
  .val { font: 12px var(--mono); max-width: 120px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .none { padding: 20px; text-align: center; color: var(--text-dim); }
  .err { padding: 6px 16px; background: color-mix(in srgb, var(--danger) 18%, transparent); color: var(--danger); font-size: 12px; }
  .foot { border-top: 1px solid var(--border); padding: 8px 14px; font-size: 12px; color: var(--text-dim); display: flex; gap: 6px; align-items: center; flex-wrap: wrap; }
  kbd { font: 11px var(--mono); border: 1px solid var(--border); border-radius: 4px; padding: 0 4px; }
  .switch { width: 40px; height: 22px; border-radius: 999px; border: 1px solid var(--border); background: var(--bg-elev-2); position: relative; cursor: pointer; padding: 0; flex-shrink: 0; }
  .switch span { position: absolute; top: 2px; left: 2px; width: 16px; height: 16px; border-radius: 50%; background: var(--text-dim); transition: transform 0.15s; }
  .switch[aria-checked='true'] { background: color-mix(in srgb, var(--accent) 35%, transparent); border-color: var(--accent); }
  .switch[aria-checked='true'] span { transform: translateX(18px); background: var(--accent); }
</style>
