<script lang="ts">
  import type { Model, Port } from '../model';
  import { channelNames, pct } from './dev-helpers';
  import { tr } from '../i18n.svelte';
  import VolumeRow from './dev-VolumeRow.svelte';
  import ProfilePicker from './dev-ProfilePicker.svelte';

  let { model, nodeId, onclose }: { model: Model; nodeId: number | null; onclose: () => void } = $props();

  const node = $derived(nodeId === null ? undefined : model.nodes.get(nodeId));
  const device = $derived(node?.deviceId === undefined ? undefined : model.devices.get(node.deviceId));
  const chNames = $derived(node ? channelNames(node) : []);

  let query = $state('');
  let copied = $state<string | null>(null);
  const rows = $derived.by(() => {
    const q = query.trim().toLowerCase();
    return Object.entries(node?.props ?? {})
      .map(([k, v]) => [k, typeof v === 'string' ? v : JSON.stringify(v)] as const)
      .filter(([k, v]) => !q || k.toLowerCase().includes(q) || v.toLowerCase().includes(q))
      .sort(([a], [b]) => a.localeCompare(b));
  });

  function peers(p: Port): string[] {
    const out = p.dir === 'out';
    return model.links.filter((l) => (out ? l.outPort : l.inPort) === p.id).map((l) => {
      const n = model.nodes.get(out ? l.inNode : l.outNode);
      const port = [...(n?.inputs ?? []), ...(n?.outputs ?? [])].find((x) => x.id === (out ? l.inPort : l.outPort));
      return `${n?.label ?? '?'} : ${port?.channel || port?.name || '?'}`;
    });
  }

  async function copy(k: string, v: string) {
    await navigator.clipboard?.writeText(v).catch(() => {});
    copied = k;
    setTimeout(() => copied === k && (copied = null), 1200);
  }

  function onkey(e: KeyboardEvent) {
    if (e.key === 'Escape' && !e.defaultPrevented) onclose();
  }
</script>

<svelte:window onkeydown={onkey} />

<aside class="drawer" aria-label={tr('Nodeinspektør', 'Node inspector')}>
  <header>
    <div class="title">
      <h2>{node?.label ?? `Node ${nodeId}`}</h2>
      {#if node}<div class="sub"><span class="role role-{node.role}">{node.role}</span> <code>#{node.id}</code></div>{/if}
    </div>
    <button class="close" onclick={onclose} aria-label={tr('Lukk (Esc)', 'Close (Esc)')} title={tr('Lukk (Esc)', 'Close (Esc)')}>×</button>
  </header>

  {#if !node}
    <p class="dim pad">{tr('Noden finnes ikke lenger.', 'This node no longer exists.')}</p>
  {:else}
    <div class="body">
      <dl>
        <dt>media.class</dt><dd>{node.mediaClass || '–'}</dd>
        <dt>{tr('Tilstand', 'State')}</dt><dd class="state state-{node.state}">{node.state}</dd>
        {#if node.app}<dt>App</dt><dd>{node.app}</dd>{/if}
        <dt>{tr('Navn', 'Name')}</dt><dd class="mono">{node.name}</dd>
        {#if device}<dt>{tr('Enhet', 'Device')}</dt><dd>{device.description}</dd>{/if}
      </dl>

      {#if node.volume !== undefined || /^Audio\/(Sink|Source)/.test(node.mediaClass)}
        <section>
          <h3>{tr('Volum', 'Volume')}</h3>
          <VolumeRow {node} />
          {#if node.channelVolumes && node.channelVolumes.length > 1}
            <div class="channels">
              {#each node.channelVolumes as v, i}
                <span class="ch">{chNames[i] ?? `${tr('K', 'Ch')}${i + 1}`}</span>
                <span class="bar"><span style:width="{Math.min(v / 1.5, 1) * 100}%"></span></span>
                <span class="mono dim">{pct(v)}</span>
              {/each}
            </div>
          {/if}
        </section>
      {/if}

      {#if device}
        <section>
          <h3>{tr('Enhet', 'Device')}</h3>
          <ProfilePicker {device} />
        </section>
      {/if}

      {#each [{ out: false, t: tr('Innganger', 'Inputs'), ps: node.inputs }, { out: true, t: tr('Utganger', 'Outputs'), ps: node.outputs }] as g (g.out)}
        {#if g.ps.length}
          <section>
            <h3>{g.t} <span class="dim">({g.ps.length})</span></h3>
            <ul class="ports">
              {#each g.ps as p (p.id)}
                {@const ls = peers(p)}
                <li>
                  <span class="dot dot-{p.media}"></span>
                  <span class="mono">{p.channel || p.name}</span>
                  {#if p.monitor}<span class="tag">monitor</span>{/if}
                  <span class="peers dim">{ls.length ? `${g.out ? '→' : '←'} ${ls.join(', ')}` : tr('ikke koblet', 'not connected')}</span>
                </li>
              {/each}
            </ul>
          </section>
        {/if}
      {/each}

      <section>
        <h3>{tr('Egenskaper', 'Properties')} <span class="dim">({rows.length})</span></h3>
        <input class="search" type="search" placeholder={tr('Filtrer nøkkel eller verdi …', 'Filter key or value …')} bind:value={query} aria-label={tr('Filtrer egenskaper', 'Filter properties')} />
        <table>
          <tbody>
            {#each rows as [k, v] (k)}
              <tr>
                <td class="k">{k}</td>
                <td class="v"><button onclick={() => copy(k, v)} title={tr('Klikk for å kopiere verdien', 'Click to copy the value')}>{copied === k ? tr('kopiert ✓', 'copied ✓') : v}</button></td>
              </tr>
            {/each}
          </tbody>
        </table>
      </section>
    </div>
  {/if}
</aside>

<style>
  .drawer {
    position: absolute; right: 0; top: 0; bottom: 0; width: 360px; max-width: 100%; z-index: 20;
    background: var(--bg-elev); border-left: 1px solid var(--border); box-shadow: var(--shadow);
    display: flex; flex-direction: column; animation: slide 0.18s ease-out;
  }
  @keyframes slide { from { transform: translateX(24px); opacity: 0; } }
  @media (prefers-reduced-motion: reduce) { .drawer { animation: none; } }
  header { display: flex; align-items: flex-start; gap: 8px; padding: 14px 16px 10px; border-bottom: 1px solid var(--border); }
  .title { flex: 1; min-width: 0; }
  h2 { margin: 0; font-size: 16px; overflow-wrap: anywhere; }
  .sub { margin-top: 4px; display: flex; gap: 8px; align-items: center; font-size: 12px; }
  .role { padding: 0 6px; border-radius: 5px; font-size: 11px; color: var(--bg); background: var(--role-other); }
  .role-source { background: var(--role-source); } .role-sink { background: var(--role-sink); }
  .role-filter { background: var(--role-filter); } .role-app-out { background: var(--role-app-out); }
  .role-app-in { background: var(--role-app-in); }
  .close { background: none; border: 0; font-size: 22px; line-height: 1; padding: 2px 8px; border-radius: 6px; cursor: pointer; color: var(--text-dim); }
  .close:hover { background: var(--bg-elev-2); color: var(--text); }
  .body { overflow: auto; padding: 4px 16px 24px; flex: 1; }
  .pad { padding: 16px; }
  section { margin-top: 16px; display: flex; flex-direction: column; gap: 8px; }
  h3 { margin: 0; font-size: 11px; text-transform: uppercase; letter-spacing: 0.08em; color: var(--text-dim); font-weight: 600; }
  dl { display: grid; grid-template-columns: auto 1fr; gap: 4px 12px; margin: 12px 0 0; font-size: 13px; }
  dt { color: var(--text-dim); }
  dd { margin: 0; overflow-wrap: anywhere; }
  .state-running { color: var(--accent); } .state-error { color: var(--danger); }
  .mono, code, .k, .v { font-family: var(--mono); font-size: 12px; }
  .dim { color: var(--text-dim); }
  .channels { display: grid; grid-template-columns: auto 1fr auto; gap: 4px 10px; align-items: center; }
  .ch { font: 11px var(--mono); color: var(--text-dim); }
  .bar { height: 4px; background: var(--bg-elev-2); border-radius: 2px; overflow: hidden; }
  .bar span { display: block; height: 100%; background: var(--accent); }
  .ports { list-style: none; margin: 0; padding: 0; font-size: 12px; display: flex; flex-direction: column; gap: 4px; }
  .ports li { display: flex; gap: 6px; align-items: baseline; flex-wrap: wrap; }
  .peers { flex-basis: 100%; padding-left: 14px; overflow-wrap: anywhere; }
  .dot { width: 8px; height: 8px; border-radius: 50%; background: var(--other); flex: none; align-self: center; }
  .dot-audio { background: var(--audio); } .dot-midi { background: var(--midi); } .dot-video { background: var(--video); }
  .tag { font-size: 10px; border: 1px solid var(--border); border-radius: 4px; padding: 0 4px; color: var(--text-dim); }
  .search { width: 100%; background: var(--bg-elev-2); border: 1px solid var(--border); border-radius: 8px; padding: 6px 10px; }
  table { width: 100%; border-collapse: collapse; table-layout: fixed; }
  .v button { all: unset; cursor: copy; display: block; width: 100%; overflow-wrap: anywhere; }
  .v button:focus-visible { outline: 2px solid var(--accent); }
  tr:hover { background: var(--bg-elev-2); }
  td { padding: 3px 4px; vertical-align: top; border-bottom: 1px solid color-mix(in srgb, var(--border) 50%, transparent); overflow-wrap: anywhere; }
  .k { color: var(--text-dim); width: 48%; }
</style>
