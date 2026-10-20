<script lang="ts">
  import { tick } from 'svelte';
  import type { Model, Setting } from '../model';
  import { setSetting, resetSetting, setMetadata, deleteMetadata } from '../api';
  import {
    buildIndex, search, same, parseCore, sectionOf, sectionTitle, WP_TEXT, CORE_SETTINGS, GEMS, SYMPTOMS,
    RESTART_CMD, HIDDEN_META, type CoreSetting,
  } from './catalog';
  import { tr, loc } from '../i18n.svelte';

  let { model, focusKey }: { model: Model; focusKey: string | null } = $props();

  let query = $state('');
  let onlyChanged = $state(false);
  let save = $state(true);
  let pending = $state<Record<string, unknown>>({}); // optimistic values until the next snapshot
  let errors = $state<Record<string, string>>({});
  let drafts = $state<Record<string, string>>({});
  let copied = $state<string | null>(null);
  let flash = $state<string | null>(null);
  let root: HTMLElement;

  // A new snapshot is the truth: drop optimistic values.
  $effect(() => { void model; pending = {}; });

  const docs = $derived(buildIndex(model));
  const hits = $derived(new Set(search(docs, query).map((d) => d.id)));
  const changedIds = $derived(new Set(docs.filter((d) => d.changed).map((d) => d.id)));
  const visible = (id: string) => hits.has(id) && (!onlyChanged || changedIds.has(id) || id in pending);
  const titleOf = (id: string) => docs.find((d) => d.id === id)?.title ?? id;

  const queryToks = $derived(query.toLowerCase().split(/\s+/).filter((t) => t.length >= 3));
  const matchedSymptoms = $derived(SYMPTOMS.filter((s) => queryToks.some((t) => `${s.label.no} ${s.label.en} ${s.words}`.toLowerCase().includes(t))));

  const wpGroups = $derived.by(() => {
    const g = new Map<string, Setting[]>();
    for (const s of model.settings) if (visible(s.key)) g.set(sectionOf(s.key), [...(g.get(sectionOf(s.key)) ?? []), s]);
    return [...g];
  });
  const coreValues = $derived(new Map((model.metadata.get('settings')?.entries ?? []).filter((e) => e.subject === 0).map((e) => [e.key, e.value])));
  const coreList = $derived(CORE_SETTINGS.filter((c) => visible(`settings:${c.key}`)));
  const gemList = $derived(GEMS.filter((g) => visible(`gem:${g.id}`)));
  const rawMeta = $derived([...model.metadata.values()].filter((m) => !HIDDEN_META.has(m.name))
    .map((m) => ({ name: m.name, entries: m.entries.filter((e) => visible(`${m.name}:${e.key}`)) }))
    .filter((m) => m.entries.length));
  const nothing = $derived(!wpGroups.length && !coreList.length && !gemList.length && !rawMeta.length);

  async function run(id: string, fn: () => Promise<unknown>, optimistic?: unknown) {
    delete errors[id];
    try {
      // Start the call before the optimistic write: fn may read values derived from `pending`
      // (the bool switch's `!v`), and writing first made it send the old value back.
      const p = fn();
      if (optimistic !== undefined) pending[id] = optimistic;
      await p;
    } catch (e) {
      delete pending[id];
      errors[id] = String(e);
      setTimeout(() => delete errors[id], 8000);
    }
  }

  async function copy(id: string, text: string) {
    try { await navigator.clipboard.writeText(text); copied = id; setTimeout(() => copied === id && (copied = null), 1500); }
    catch (e) { errors[id] = `${tr('Kunne ikke kopiere', 'Could not copy')}: ${e}`; }
  }

  async function focusTo(id: string) {
    query = ''; onlyChanged = false;
    await tick();
    const el = root?.querySelector<HTMLElement>(`[data-id="${CSS.escape(id)}"]`);
    if (!el) return;
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    flash = id;
    setTimeout(() => flash === id && (flash = null), 1800);
  }
  $effect(() => { if (focusKey) focusTo(focusKey); });

  const show = (v: unknown) => (v === undefined ? '—' : typeof v === 'string' ? v : typeof v === 'number' ? String(+v.toFixed(3)) : JSON.stringify(v));

  // --- WirePlumber ---
  const wpVal = (s: Setting) => (s.key in pending ? pending[s.key] : s.value);
  const isNum = (s: Setting) => s.type === 'int' || s.type === 'float';
  function commitNum(s: Setting, raw: string) {
    let n = Number(raw);
    if (raw.trim() === '' || Number.isNaN(n)) { errors[s.key] = tr('Ikke et tall', 'Not a number'); return; }
    if (s.type === 'int') n = Math.round(n);
    if (s.min !== undefined) n = Math.max(s.min, n);
    if (s.max !== undefined) n = Math.min(s.max, n);
    run(s.key, () => setSetting(s.key, n, save), n);
  }
  function jsonError(s: Setting): string | null {
    const d = drafts[s.key];
    if (d === undefined) return null;
    try {
      const v = JSON.parse(d);
      if (s.type === 'array' && !Array.isArray(v)) return tr('Må være en JSON-liste [ … ]', 'Must be a JSON list [ … ]');
      if (s.type === 'object' && (typeof v !== 'object' || v === null || Array.isArray(v))) return tr('Må være et JSON-objekt { … }', 'Must be a JSON object { … }');
      return null;
    } catch (e) { return String((e as Error).message); }
  }

  // --- PipeWire core ---
  const coreId = (c: CoreSetting) => `settings:${c.key}`;
  const coreVal = (c: CoreSetting) => (coreId(c) in pending ? pending[coreId(c)] : coreValues.get(c.key));
  const setCore = (c: CoreSetting, value: string) => run(coreId(c), () => setMetadata('settings', 0, c.key, value), value);
  const resetCore = (c: CoreSetting) =>
    run(coreId(c), () => (c.reset !== undefined ? setMetadata('settings', 0, c.key, c.reset) : deleteMetadata('settings', 0, c.key)));
  function commitRates(c: CoreSetting, raw: string) {
    const nums = raw.split(/[\s,\[\]]+/).filter(Boolean).map(Number);
    if (!nums.length || nums.some((n) => !Number.isInteger(n) || n < 8000 || n > 768000)) { errors[coreId(c)] = tr('Skriv rater i Hz, f.eks. 44100 48000', 'Enter rates in Hz, e.g. 44100 48000'); return; }
    setCore(c, `[ ${nums.join(' ')} ]`);
  }
  const permanentFor = (id: string) => GEMS.find((g) => g.related === id);
</script>

{#snippet toast(id: string)}
  {#if errors[id]}<div class="toast" role="alert">{errors[id]}</div>{/if}
{/snippet}

{#snippet copyBtn(id: string, text: string, label = tr('Kopier', 'Copy'))}
  <button class="ghost small" onclick={() => copy(id, text)}>{copied === id ? tr('Kopiert ✓', 'Copied ✓') : label}</button>
{/snippet}

<div class="page" bind:this={root}>
  <div class="top">
    <input class="q" type="search" placeholder={tr('Søk: «autoswitch», «knitring», «mikrofon dårlig», «forsinkelse» …', 'Search: “autoswitch”, “crackling”, “bad mic”, “latency” …')}
      bind:value={query} aria-label={tr('Søk i innstillinger', 'Search settings')} />
    <div class="row">
      <div class="chips">
        {#each SYMPTOMS as s (s.words)}
          <button class="chip" class:on={matchedSymptoms.includes(s)} onclick={() => (query = s.words.split(' ')[0])}>{loc(s.label)}</button>
        {/each}
      </div>
      <label class="opt"><input type="checkbox" bind:checked={onlyChanged} /> {tr('Vis bare endrede', 'Show only changed')} ({changedIds.size})</label>
      <label class="opt" title={tr('Av: endringen gjelder bare til WirePlumber startes på nytt', 'Off: the change only lasts until WirePlumber restarts')}>
        <input type="checkbox" bind:checked={save} /> {tr('Lagre permanent', 'Save permanently')}
      </label>
    </div>
    {#if matchedSymptoms.length}
      <div class="hint">
        {#each matchedSymptoms as s (s.words)}
          <div><b>{loc(s.label)}?</b> {tr('Se på:', 'Look at:')}
            {#each s.targets as t, i (t)}{#if i}, {/if}<button class="link" onclick={() => focusTo(t)}>{titleOf(t)}</button>{/each}
          </div>
        {/each}
      </div>
    {/if}
  </div>

  {#if nothing}<p class="empty">{tr('Ingen treff. Prøv et annet ord — både norsk og engelsk virker.', 'No matches. Try another word — both English and Norwegian work.')}</p>{/if}

  {#if wpGroups.length}
    <h2>WirePlumber <span class="sub">— {tr('endres med', 'changed with')} <code>wpctl settings</code></span></h2>
    {#each wpGroups as [prefix, list] (prefix)}
      <h3>{sectionTitle(prefix)}</h3>
      {#each list as s (s.key)}
        {@const v = wpVal(s)}
        {@const changed = !same(v, s.default)}
        {@const t = WP_TEXT[s.key]}
        <section class="item" class:changed class:flash={flash === s.key} data-id={s.key}>
          <div class="head">
            <div class="titles">
              <div class="title">{t ? loc(t.title) : s.name}</div>
              <code class="key">{s.key}</code>
            </div>
            <div class="control">
              {#if s.type === 'bool'}
                <button class="switch" role="switch" aria-checked={!!v} aria-label={t ? loc(t.title) : s.name}
                  onclick={() => run(s.key, () => setSetting(s.key, !v, save), !v)}><span></span></button>
              {:else if isNum(s) && s.min !== undefined && s.max !== undefined}
                <input type="range" min={s.min} max={s.max} step={s.type === 'int' ? 1 : (s.max - s.min) / 100}
                  value={v as number} onchange={(e) => commitNum(s, e.currentTarget.value)} aria-label={s.key} />
                <input class="num" type="number" min={s.min} max={s.max} step={s.type === 'int' ? 1 : 0.01}
                  value={v as number} onchange={(e) => commitNum(s, e.currentTarget.value)} aria-label={s.key} />
              {:else if isNum(s)}
                <input class="num" type="number" value={v as number} onchange={(e) => commitNum(s, e.currentTarget.value)} aria-label={s.key} />
              {:else if s.type === 'string'}
                <input class="text" value={String(v ?? '')} aria-label={s.key}
                  onchange={(e) => { const x = e.currentTarget.value; run(s.key, () => setSetting(s.key, x, save), x); }} />
              {/if}
            </div>
          </div>
          {#if s.type === 'array' || s.type === 'object'}
            {@const err = jsonError(s)}
            <textarea class="json" class:bad={err} rows="4" aria-label={s.key}
              value={drafts[s.key] ?? JSON.stringify(v, null, 2)} oninput={(e) => (drafts[s.key] = e.currentTarget.value)}></textarea>
            <div class="meta">
              {#if err}<span class="bad-text">{err}</span>{/if}
              <button class="small" disabled={!!err || drafts[s.key] === undefined}
                onclick={() => { const x = JSON.parse(drafts[s.key]); delete drafts[s.key]; run(s.key, () => setSetting(s.key, x, save), x); }}>{tr('Bruk', 'Apply')}</button>
            </div>
          {/if}
          <p class="desc">{t ? loc(t.text) : s.description}</p>
          <div class="meta">
            <span>{tr('Nå', 'Now')}: <b>{show(v)}</b></span>
            <span>{tr('Standard', 'Default')}: {show(s.default)}</span>
            {#if s.min !== undefined}<span>{tr('Område', 'Range')}: {s.min}–{s.max}</span>{/if}
            {#if s.isSaved && same(s.saved, v)}<span class="badge ok">{tr('lagret', 'saved')}</span>
            {:else if s.isSaved}<span class="badge warn">{tr('lagret', 'saved')}: {show(s.saved)} — {tr('live avviker', 'live differs')}</span>
            {:else if changed}<span class="badge warn">{tr('kun denne økten', 'this session only')}</span>{/if}
            {#if changed}<span class="badge acc">{tr('endret', 'changed')}</span>{/if}
            {#if changed || s.isSaved}
              <button class="ghost small" onclick={() => run(s.key, () => resetSetting(s.key), s.default)}>{tr('Tilbakestill', 'Reset')}</button>
            {/if}
          </div>
          {@render toast(s.key)}
        </section>
      {/each}
    {/each}
  {/if}

  {#if coreList.length}
    <h2>{tr('PipeWire-kjerne (kjøretid)', 'PipeWire core (runtime)')} <span class="sub">— {tr('gjelder til PipeWire startes på nytt, lagres ikke', 'lasts until PipeWire restarts, not saved')}</span></h2>
    {#each coreList as c (c.key)}
      {@const id = coreId(c)}
      {@const raw = coreVal(c)}
      {@const cur = parseCore(raw)}
      {@const changed = cur !== undefined && !same(cur, c.stock)}
      {@const perm = permanentFor(id)}
      <section class="item" class:changed class:flash={flash === id} data-id={id}>
        <div class="head">
          <div class="titles">
            <div class="title">{loc(c.title)}</div>
            <code class="key">{c.key}</code>
          </div>
          <div class="control">
            {#if c.kind === 'rates'}
              <input class="text" value={Array.isArray(cur) ? cur.join(' ') : ''} aria-label={c.key}
                onchange={(e) => commitRates(c, e.currentTarget.value)} />
            {:else if c.options}
              <select value={String(cur ?? '')} aria-label={c.key} onchange={(e) => setCore(c, e.currentTarget.value)}>
                {#if cur !== undefined && !c.options.some((o) => o.value === cur)}<option value={String(cur)}>{show(cur)}</option>{/if}
                {#each c.options as o (o.value)}<option value={String(o.value)}>{loc(o.label)}</option>{/each}
              </select>
            {:else}
              <input class="num" type="number" min={c.min} max={c.max} value={cur as number} aria-label={c.key}
                onchange={(e) => setCore(c, e.currentTarget.value)} />
            {/if}
          </div>
        </div>
        <p class="desc">{loc(c.text)}</p>
        <p class="why"><b>{tr('Hvorfor endre?', 'Why change it?')}</b> {loc(c.why)}</p>
        <div class="meta">
          <span>{tr('Nå', 'Now')}: <b>{show(raw)}</b></span>
          <span>{tr('PipeWire-standard', 'PipeWire default')}: {show(c.stock)}</span>
          <span class="badge warn">{tr('kun kjøretid', 'runtime only')}</span>
          {#if changed}<span class="badge acc">{tr('endret', 'changed')}</span>
            <button class="ghost small" onclick={() => resetCore(c)}>{tr('Tilbakestill', 'Reset')}</button>{/if}
          {#if perm}<button class="link" onclick={() => focusTo(`gem:${perm.id}`)}>{tr('Gjør permanent →', 'Make permanent →')}</button>{/if}
        </div>
        {@render toast(id)}
      </section>
    {/each}
  {/if}

  {#if gemList.length}
    <h2>{tr('Skjulte perler (konfigfiler)', 'Hidden gems (config files)')} <span class="sub">— {tr('kan ikke endres mens lyden kjører; legg inn filen og start tjenesten på nytt', 'can’t be changed while audio runs; add the file and restart the service')}</span></h2>
    {#each gemList as g (g.id)}
      {@const id = `gem:${g.id}`}
      <section class="item gem" class:flash={flash === id} data-id={id}>
        <div class="title">{loc(g.title)}</div>
        <div class="chips">
          {#each g.symptoms as s (s.no)}<span class="chip static">{loc(s)}</span>{/each}
        </div>
        <p class="desc">{loc(g.text)}</p>
        <div class="meta">{#each g.keys as k (k)}<code class="key">{k}</code>{/each}</div>
        <div class="file"><code>{g.file}</code>{@render copyBtn(`${id}:file`, g.file, tr('Kopier sti', 'Copy path'))}</div>
        <div class="snip">
          <pre>{g.snippet}</pre>
          <div class="snip-btn">{@render copyBtn(id, g.snippet)}</div>
        </div>
        {#if g.note}<p class="why">{loc(g.note)}</p>{/if}
        <div class="meta">
          <span>{tr('Etterpå', 'Afterwards')}:</span><code>{RESTART_CMD[g.restart]}</code>{@render copyBtn(`${id}:cmd`, RESTART_CMD[g.restart])}
          {#if g.related}<button class="link" onclick={() => focusTo(g.related!)}>{tr('Beslektet', 'Related')}: {titleOf(g.related)}</button>{/if}
        </div>
        {@render toast(id)}
        {@render toast(`${id}:file`)}
        {@render toast(`${id}:cmd`)}
      </section>
    {/each}
  {/if}

  {#if rawMeta.length && !onlyChanged}
    <h2>{tr('Rå metadata', 'Raw metadata')} <span class="sub">— {tr('skrivebeskyttet visning', 'read-only view')}</span></h2>
    {#each rawMeta as m (m.name)}
      <h3>{m.name}</h3>
      <div class="raw">
        {#each m.entries as e (`${e.subject}:${e.key}`)}
          {@const id = `${m.name}:${e.key}`}
          <div class="raw-row" class:flash={flash === id} data-id={id}>
            <code class="key">{e.key}{#if e.subject}<span class="dim"> @{e.subject}</span>{/if}</code>
            <code class="val">{show(e.value)}</code>
          </div>
        {/each}
      </div>
    {/each}
  {/if}
</div>

<style>
  .page { height: 100%; overflow: auto; padding: 0 24px 48px; }
  .top { position: sticky; top: 0; z-index: 2; background: var(--bg); padding: 16px 0 10px; border-bottom: 1px solid var(--border); }
  .q { width: 100%; font-size: 17px; padding: 12px 14px; border-radius: var(--radius); border: 1px solid var(--border); background: var(--bg-elev); }
  .q:focus { outline: 2px solid var(--accent); }
  .row { display: flex; flex-wrap: wrap; gap: 10px 16px; align-items: center; margin-top: 10px; }
  .opt { display: flex; gap: 6px; align-items: center; color: var(--text-dim); white-space: nowrap; }
  .chips { display: flex; flex-wrap: wrap; gap: 6px; flex: 1; }
  .chip { border: 1px solid var(--border); background: var(--bg-elev); border-radius: 999px; padding: 2px 10px; font-size: 12px; color: var(--text-dim); cursor: pointer; }
  .chip.on, .chip:hover { border-color: var(--accent); color: var(--text); }
  .chip.static { cursor: default; color: var(--warn); border-color: color-mix(in srgb, var(--warn) 40%, transparent); }
  .hint { margin-top: 10px; padding: 8px 12px; border-radius: 8px; background: color-mix(in srgb, var(--accent) 10%, transparent); font-size: 13px; }
  h2 { margin: 28px 0 8px; font-size: 18px; }
  h3 { margin: 18px 0 6px; font-size: 13px; text-transform: uppercase; letter-spacing: 0.06em; color: var(--text-dim); }
  .sub { font-size: 13px; font-weight: 400; color: var(--text-dim); }
  .empty { color: var(--text-dim); margin-top: 32px; }
  .item { background: var(--bg-elev); border: 1px solid var(--border); border-left: 3px solid transparent; border-radius: var(--radius); padding: 12px 14px; margin: 8px 0; transition: box-shadow 0.3s; }
  .item.changed { border-left-color: var(--accent); }
  .flash { animation: flash 1.8s ease-out; }
  @keyframes flash { 0%, 30% { box-shadow: 0 0 0 3px var(--accent); background: color-mix(in srgb, var(--accent) 14%, var(--bg-elev)); } }
  .head { display: flex; justify-content: space-between; gap: 16px; align-items: center; }
  .titles { min-width: 0; }
  .title { font-weight: 600; }
  .key { font: 12px var(--mono); color: var(--text-dim); word-break: break-all; }
  .control { display: flex; gap: 8px; align-items: center; flex-shrink: 0; }
  .desc { margin: 6px 0; color: var(--text-dim); }
  .why { margin: 6px 0; font-size: 13px; }
  .meta { display: flex; flex-wrap: wrap; gap: 6px 12px; align-items: center; font-size: 12px; color: var(--text-dim); }
  .meta code { font: 12px var(--mono); }
  .badge { border-radius: 999px; padding: 1px 8px; font-weight: 600; }
  .badge.ok { background: color-mix(in srgb, var(--role-source) 20%, transparent); color: var(--role-source); }
  .badge.warn { background: color-mix(in srgb, var(--warn) 18%, transparent); color: var(--warn); }
  .badge.acc { background: color-mix(in srgb, var(--accent) 18%, transparent); color: var(--accent); }
  input.num { width: 90px; } input.text { width: 220px; }
  input.num, input.text, select, textarea { background: var(--bg-elev-2); border: 1px solid var(--border); border-radius: 6px; padding: 4px 8px; }
  input[type='range'] { width: 180px; accent-color: var(--accent); }
  textarea.json { width: 100%; font: 12px var(--mono); margin-top: 8px; }
  textarea.bad { border-color: var(--danger); }
  .bad-text { color: var(--danger); }
  button.small { font-size: 12px; padding: 2px 10px; border-radius: 6px; border: 1px solid var(--border); background: var(--bg-elev-2); cursor: pointer; }
  button.ghost { background: none; }
  button.link { background: none; border: 0; padding: 0; color: var(--accent); cursor: pointer; text-decoration: underline; font-size: inherit; }
  .switch { width: 44px; height: 24px; border-radius: 999px; border: 1px solid var(--border); background: var(--bg-elev-2); position: relative; cursor: pointer; padding: 0; transition: background 0.2s; }
  .switch span { position: absolute; top: 2px; left: 2px; width: 18px; height: 18px; border-radius: 50%; background: var(--text-dim); transition: transform 0.2s, background 0.2s; }
  .switch[aria-checked='true'] { background: color-mix(in srgb, var(--accent) 35%, transparent); border-color: var(--accent); }
  .switch[aria-checked='true'] span { transform: translateX(20px); background: var(--accent); }
  .toast { margin-top: 8px; padding: 6px 10px; border-radius: 6px; background: color-mix(in srgb, var(--danger) 18%, transparent); color: var(--danger); font-size: 12px; }
  .gem .chips { margin: 6px 0; }
  .file { display: flex; gap: 8px; align-items: center; margin-top: 8px; font: 12px var(--mono); }
  .snip { position: relative; margin: 6px 0; }
  .snip pre { margin: 0; padding: 10px 12px; background: var(--bg); border: 1px solid var(--border); border-radius: 8px; font: 12px/1.5 var(--mono); overflow-x: auto; }
  .snip-btn { position: absolute; top: 6px; right: 6px; }
  .raw { border: 1px solid var(--border); border-radius: var(--radius); overflow: hidden; }
  .raw-row { display: grid; grid-template-columns: minmax(200px, 1fr) 2fr; gap: 12px; padding: 6px 12px; border-top: 1px solid var(--border); }
  .raw-row:first-child { border-top: 0; }
  .raw-row .val { font: 12px var(--mono); word-break: break-all; }
  .dim { opacity: 0.6; }
</style>
