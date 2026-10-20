<script lang="ts">
  import { tick } from 'svelte';
  import type { Model, Node } from '../model';
  import { GROUP_TITLES, groupDevices, iconOf } from './dev-helpers';
  import { loc, tr } from '../i18n.svelte';
  import Icon from './dev-Icon.svelte';
  import VolumeRow from './dev-VolumeRow.svelte';
  import ProfilePicker from './dev-ProfilePicker.svelte';

  let { model, focusKey, onselect }: { model: Model; focusKey: string | null; onselect: (nodeId: number) => void } = $props();

  const byName = (name?: string) => [...model.nodes.values()].find((n) => n.name === name);
  const sink = $derived(byName(model.defaults['default.audio.sink']));
  const source = $derived(byName(model.defaults['default.audio.source']));
  const apps = $derived(
    [...model.nodes.values()].filter((n) => (n.role === 'app-out' || n.role === 'app-in') && n.volume !== undefined)
      .sort((a, b) => a.role.localeCompare(b.role) || (a.app ?? a.label).localeCompare(b.app ?? b.label)),
  );
  const groups = $derived(groupDevices(model));
  const nodesOf = (ids: number[]) => ids.map((id) => model.nodes.get(id)).filter((n): n is Node => !!n);

  let highlight = $state<number | null>(null);
  $effect(() => {
    const m = /^device:(\d+)$/.exec(focusKey ?? '');
    if (!m) return;
    const id = +m[1];
    highlight = id;
    tick().then(() => document.getElementById(`dev-card-${id}`)?.scrollIntoView({
      block: 'center', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
    }));
    const t = setTimeout(() => (highlight = null), 2500);
    return () => clearTimeout(t);
  });
</script>

<div class="panel">
  <section class="defaults">
    <h2>{tr('Standard', 'Defaults')}</h2>
    <div class="cards two">
      {#each [{ n: sink, kind: 'speaker' as const, title: tr('Utgang', 'Output'), empty: tr('Ingen standardutgang valgt', 'No default output selected') }, { n: source, kind: 'mic' as const, title: tr('Inngang', 'Input'), empty: tr('Ingen standardinngang valgt', 'No default input selected') }] as d (d.kind)}
        <div class="card hero">
          <div class="hero-head"><Icon kind={d.kind} size={28} /><span class="eyebrow">{d.title}</span></div>
          {#if d.n}
            <VolumeRow node={d.n} {onselect} big />
          {:else}
            <p class="empty">{d.empty}</p>
          {/if}
        </div>
      {/each}
    </div>
  </section>

  {#if apps.length}
    <section>
      <h2>{tr('Apper', 'Apps')}</h2>
      <div class="card list">
        {#each apps as n (n.id)}
          <VolumeRow node={n} {onselect} sub={`${n.role === 'app-out' ? tr('spiller', 'playing') : tr('tar opp', 'recording')}${n.app && n.app !== n.label ? ` · ${n.app}` : ''}${n.state === 'running' ? '' : ` · ${n.state}`}`} />
        {/each}
      </div>
    </section>
  {/if}

  {#each groups as [group, devices] (group)}
    <section>
      <h2>{loc(GROUP_TITLES[group])}</h2>
      <div class="cards">
        {#each devices as d (d.id)}
          {@const ns = nodesOf(d.nodes)}
          <article class="card" id="dev-card-{d.id}" class:hl={highlight === d.id}>
            <header>
              <span class="icon"><Icon kind={iconOf(d, model)} /></span>
              <div class="title">
                <h3>{d.description || d.name}</h3>
                <div class="badges">
                  <span class="badge">{d.api}</span>
                  {#if d.bus}<span class="badge">{d.bus}</span>{/if}
                </div>
              </div>
            </header>
            <ProfilePicker device={d} />
            {#if ns.length}
              <div class="nodes">
                {#each ns as n (n.id)}
                  <VolumeRow node={n} {onselect} />
                {/each}
              </div>
            {:else if d.profiles.length}
              <p class="empty">{tr('Ingen aktive noder i denne profilen', 'No active nodes in this profile')}</p>
            {/if}
          </article>
        {/each}
      </div>
    </section>
  {/each}
</div>

<style>
  .panel { height: 100%; overflow: auto; padding: 20px 24px 40px; }
  section { max-width: 1200px; margin: 0 auto 28px; }
  h2 { font-size: 12px; text-transform: uppercase; letter-spacing: 0.08em; color: var(--text-dim); margin: 0 0 10px; font-weight: 600; }
  .cards { display: grid; grid-template-columns: repeat(auto-fill, minmax(340px, 1fr)); gap: 14px; }
  .card {
    background: var(--bg-elev); border: 1px solid var(--border); border-radius: var(--radius);
    padding: 14px 16px; display: flex; flex-direction: column; gap: 10px;
    transition: border-color 0.3s, box-shadow 0.3s;
  }
  .card.hl { border-color: var(--accent); box-shadow: 0 0 0 3px color-mix(in srgb, var(--accent) 25%, transparent); }
  .card.list { gap: 0; padding: 6px 16px; }
  .card.list > :global(*:not(:last-child)) { border-bottom: 1px solid var(--border); }
  .hero { background: linear-gradient(160deg, color-mix(in srgb, var(--accent) 8%, var(--bg-elev)), var(--bg-elev)); }
  .hero-head { display: flex; align-items: center; gap: 10px; color: var(--accent); }
  .eyebrow { font-size: 12px; text-transform: uppercase; letter-spacing: 0.08em; color: var(--text-dim); }
  header { display: flex; gap: 12px; align-items: center; }
  .icon { width: 40px; height: 40px; border-radius: 10px; display: grid; place-items: center; background: var(--bg-elev-2); color: var(--accent); flex: none; }
  .title { min-width: 0; }
  h3 { margin: 0; font-size: 15px; font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .badges { display: flex; gap: 6px; margin-top: 3px; }
  .badge { font: 11px var(--mono); color: var(--text-dim); background: var(--bg-elev-2); border: 1px solid var(--border); border-radius: 5px; padding: 0 6px; }
  .nodes { border-top: 1px solid var(--border); padding-top: 4px; }
  .empty { margin: 0; color: var(--text-dim); font-size: 13px; }
  @media (prefers-reduced-motion: reduce) { .card { transition: none; } }
</style>
