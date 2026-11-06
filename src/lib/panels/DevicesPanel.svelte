<script lang="ts">
  import { tick } from 'svelte';
  import type { Model, Node } from '../model';
  import { GROUP_TITLES, groupDevices, iconOf } from './dev-helpers';
  import { loc, tr } from '../i18n.svelte';
  import { FILTER_KEY, prefs } from '../prefs.svelte';
  import Icon from './dev-Icon.svelte';
  import VolumeRow from './dev-VolumeRow.svelte';
  import ProfilePicker from './dev-ProfilePicker.svelte';
  import RoutePicker from './dev-RoutePicker.svelte';

  let { model, focusKey, onselect }: { model: Model; focusKey: string | null; onselect: (nodeId: number) => void } = $props();

  const byName = (name?: string) => [...model.nodes.values()].find((n) => n.name === name);
  const sink = $derived(byName(model.defaults['default.audio.sink']));
  const source = $derived(byName(model.defaults['default.audio.source']));
  const apps = $derived(
    // Internal (WirePlumber's BT loopbacks) and monitor streams (pavucontrol's peak meters) are plumbing, not apps.
    [...model.nodes.values()].filter((n) => (n.role === 'app-out' || n.role === 'app-in') && n.volume !== undefined
      && !/Internal/.test(n.mediaClass) && !n.props['stream.monitor'])
      .sort((a, b) => a.role.localeCompare(b.role) || (a.app ?? a.label).localeCompare(b.app ?? b.label)),
  );
  let saved: { kind?: string; activeOnly?: boolean } = {};
  if (prefs.rememberFilters) try { saved = JSON.parse(localStorage.getItem(FILTER_KEY) ?? '{}'); } catch { /* storage unavailable */ }
  let appKind = $state<'all' | 'app-out' | 'app-in'>(saved.kind === 'app-out' || saved.kind === 'app-in' ? saved.kind : 'all');
  let activeOnly = $state(saved.activeOnly === true);
  $effect(() => {
    const v = JSON.stringify({ kind: appKind, activeOnly });
    if (prefs.rememberFilters) try { localStorage.setItem(FILTER_KEY, v); } catch { /* ignore */ }
  });
  const count = (k: typeof appKind) => apps.filter((n) => k === 'all' || n.role === k).length;
  const shownApps = $derived(apps.filter((n) => (appKind === 'all' || n.role === appKind) && (!activeOnly || n.state === 'running')));
  const groups = $derived(groupDevices(model));
  /** What is playing (a tab title, a song) beats the generic "playing"; the state only when it is not running. */
  const appSub = (n: Node) => {
    const what = n.props['media.name'], app = n.app && n.app !== n.label ? n.app : undefined;
    const main = what && what !== n.label && !/^(playback|record|capture)$/i.test(what) ? what : app;
    const idle = n.state === 'running' ? '' : tr('pause', 'paused');
    return [main, idle].filter(Boolean).join(' · ') || undefined;
  };
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
      <div class="apps-head">
        <h2>{tr('Apper', 'Apps')}</h2>
        <div class="seg" role="radiogroup" aria-label={tr('Vis apper', 'Show apps')}>
          {#each [['all', tr('Alle', 'All')], ['app-out', tr('Avspilling', 'Playback')], ['app-in', tr('Opptak', 'Recording')]] as [k, label] (k)}
            {@const c = count(k as typeof appKind)}
            <button role="radio" aria-checked={appKind === k} disabled={c === 0 && k !== 'all'} onclick={() => (appKind = k as typeof appKind)}>
              {label}<span class="n">{c}</span>
            </button>
          {/each}
        </div>
        <button class="chip" aria-pressed={activeOnly} onclick={() => (activeOnly = !activeOnly)}>
          <span class="dot" aria-hidden="true"></span>{tr('Bare aktive', 'Active only')}
        </button>
      </div>
      <div class="card list">
        {#each shownApps as n (n.id)}
          <VolumeRow node={n} {onselect} sub={appSub(n)}>
            {#snippet aside()}<RoutePicker node={n} {model} />{/snippet}
          </VolumeRow>
        {:else}
          <p class="empty pad">{activeOnly ? tr('Ingen apper spiller eller tar opp akkurat nå.', 'No app is playing or recording right now.') : tr('Ingen apper i denne kategorien.', 'No apps in this category.')}</p>
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
  .apps-head { display: flex; align-items: center; gap: 12px; margin-bottom: 10px; flex-wrap: wrap; }
  .apps-head h2 { margin: 0; margin-right: auto; }
  .seg { display: inline-flex; padding: 3px; gap: 2px; border-radius: 10px; background: var(--bg-elev); border: 1px solid var(--border); }
  .seg button {
    display: inline-flex; align-items: center; gap: 6px; border: 0; background: none; border-radius: 7px;
    padding: 4px 10px; font-size: 13px; color: var(--text-dim); cursor: pointer; transition: background-color 0.15s, color 0.15s;
  }
  .seg button:hover:not(:disabled) { color: var(--text); }
  .seg button[aria-checked='true'] { background: var(--bg-elev-2); color: var(--text); box-shadow: 0 1px 2px rgb(0 0 0 / 0.25); }
  .seg button:disabled { opacity: 0.4; cursor: default; }
  .n { font: 11px var(--mono); font-variant-numeric: tabular-nums; color: var(--text-dim); }
  .chip {
    display: inline-flex; align-items: center; gap: 7px; height: 30px; padding: 0 12px; border-radius: 999px; font-size: 13px;
    border: 1px solid var(--border); background: var(--bg-elev); color: var(--text-dim); cursor: pointer; transition: all 0.15s;
  }
  .chip .dot { width: 7px; height: 7px; border-radius: 50%; background: var(--text-dim); opacity: 0.5; transition: inherit; }
  .chip[aria-pressed='true'] { color: var(--text); border-color: color-mix(in srgb, var(--accent) 55%, var(--border)); }
  .chip[aria-pressed='true'] .dot { background: var(--accent); opacity: 1; box-shadow: 0 0 0 3px color-mix(in srgb, var(--accent) 22%, transparent); }
  .empty.pad { padding: 14px 0; }
  .empty { margin: 0; color: var(--text-dim); font-size: 13px; }
  @media (prefers-reduced-motion: reduce) { .card { transition: none; } }
</style>
