<script lang="ts">
  import { untrack } from 'svelte';
  import type { Model, Node, Port } from '../model';
  import { link, unlink } from '../api';
  import {
    layout, topologyKey, channelPairs, defaultOptions, GROUP_PAD, GROUP_HEAD, HEAD_H,
    type Layout, type LayoutOptions, type LPort, type LNode, type LEdge, type Media,
  } from './layout';
  import { tr } from '../i18n.svelte';

  let { model, selected, onselect }: { model: Model; selected: number | null; onselect: (id: number | null) => void } = $props();

  let opts = $state<LayoutOptions>({ ...defaultOptions, media: [...defaultOptions.media] });
  let lay = $state<Layout | null>(null);
  let pos = $state<Record<number, { x: number; y: number }>>({});
  let view = $state({ x: 0, y: 0, k: 1 });
  let W = $state(0), H = $state(0);
  let svg: SVGSVGElement;
  let relayoutTick = $state(0);
  // Hand-placed cards, keyed by node.name so they survive restarts (ids don't).
  const PIN_KEY = 'pipeloom.pins';
  let pins: Record<string, { x: number; y: number }> = {};
  try { pins = JSON.parse(localStorage.getItem(PIN_KEY) ?? '{}'); } catch { /* storage unavailable */ }
  const savePins = () => { try { localStorage.setItem(PIN_KEY, JSON.stringify(pins)); } catch { /* ignore */ } };
  const nameOf = (id: number) => model.nodes.get(id)?.name ?? String(id);
  let fitPending = true;
  let hoverEdge = $state<number | null>(null);
  let selEdge = $state<number | null>(null);
  let err = $state<string | null>(null);

  const reduceMotion = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Relayout only when the drawn topology or view options change; volume/state updates just re-render.
  // Quantized viewport shape, so resizing only relayouts when the shape really changes.
  const aspect = $derived(W && H > 100 ? Math.round((W / (H - 56)) * 2) / 2 : 0);
  let lastAspect = 0;
  const key = $derived(`${topologyKey(model)}§${JSON.stringify(opts)}§${relayoutTick}§${aspect}`);
  let run = 0;
  $effect(() => {
    key;
    const my = ++run;
    const m = untrack(() => model), o = { ...(untrack(() => $state.snapshot(opts)) as LayoutOptions), aspect };
    if (aspect !== lastAspect) { lastAspect = aspect; fitPending = true; }
    layout(m, o).then((l) => { if (my === run) apply(l); }, (e) => { err = `${tr('Layout feilet', 'Layout failed')}: ${e}`; console.error(err, e?.stack); });
  });

  let frame = 0;
  function apply(l: Layout) {
    const from = $state.snapshot(pos);
    const to: Record<number, { x: number; y: number }> = {};
    for (const n of l.nodes) to[n.id] = pins[untrack(() => nameOf(n.id))] ?? { x: n.x, y: n.y };
    lay = l;
    cancelAnimationFrame(frame);
    if (reduceMotion || fitPending) pos = to;
    else {
      const t0 = performance.now();
      const step = (t: number) => {
        const a = Math.min(1, (t - t0) / 450), e = 1 - (1 - a) ** 3;
        const cur: typeof to = {};
        for (const id in to) {
          const f = from[id] ?? to[id];
          cur[id] = { x: f.x + (to[id].x - f.x) * e, y: f.y + (to[id].y - f.y) * e };
        }
        pos = cur;
        if (a < 1) frame = requestAnimationFrame(step);
      };
      frame = requestAnimationFrame(step);
    }
    if (fitPending && l.nodes.length) { fitPending = false; requestAnimationFrame(fit); }
  }

  function fit() {
    if (!lay?.nodes.length || !W || !H) return;
    const at = (n: LNode) => pos[n.id] ?? n;
    const xs = lay.nodes.flatMap((n) => [at(n).x, at(n).x + n.w]), ys = lay.nodes.flatMap((n) => [at(n).y - GROUP_HEAD - GROUP_PAD, at(n).y + n.h]);
    const x0 = Math.min(...xs) - 40, x1 = Math.max(...xs) + 40, y0 = Math.min(...ys) - 30, y1 = Math.max(...ys) + 30;
    const top = 56; // keep clear of the toolbar
    const k = Math.min(W / (x1 - x0), (H - top) / (y1 - y0), 1.2);
    view = { k, x: (W - (x1 - x0) * k) / 2 - x0 * k, y: top + (H - top - (y1 - y0) * k) / 2 - y0 * k };
  }

  // ---------- derived lookups ----------
  const portAt = $derived(new Map(lay?.nodes.flatMap((n) => n.ports.map((p) => [p.id, p] as const)) ?? []));
  const linkById = $derived(new Map(model.links.map((l) => [l.id, l])));
  const linkedPairs = $derived(new Set(model.links.map((l) => `${l.outPort}>${l.inPort}`)));
  const abs = (p: LPort) => { const o = pos[p.nodeId] ?? { x: 0, y: 0 }; return { x: o.x + p.x, y: o.y + p.y }; };

  function wire(a: { x: number; y: number }, b: { x: number; y: number }) {
    const dx = Math.max(50, Math.abs(b.x - a.x) * 0.5);
    return { d: `M${a.x},${a.y} C${a.x + dx},${a.y} ${b.x - dx},${b.y} ${b.x},${b.y}`, mid: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 } }; // symmetric cubic: t=.5 is the midpoint
  }

  // ELK's orthogonal route with rounded corners; only valid while both nodes sit where ELK put them.
  function routed(e: LEdge) {
    const a = lay!.nodes.find((n) => n.id === e.outNode), b = lay!.nodes.find((n) => n.id === e.inNode);
    const settled = (n?: LNode) => n && pos[n.id]?.x === n.x && pos[n.id]?.y === n.y;
    if (!e.route || e.route.length < 2 || !settled(a) || !settled(b)) return null;
    const pts = e.route, R = 10;
    let d = `M${pts[0].x},${pts[0].y}`;
    for (let i = 1; i < pts.length - 1; i++) {
      const p = pts[i - 1], c = pts[i], n = pts[i + 1];
      const r = Math.min(R, Math.hypot(c.x - p.x, c.y - p.y) / 2, Math.hypot(n.x - c.x, n.y - c.y) / 2);
      const ux = Math.sign(c.x - p.x), uy = Math.sign(c.y - p.y), vx = Math.sign(n.x - c.x), vy = Math.sign(n.y - c.y);
      d += ` L${c.x - ux * r},${c.y - uy * r} Q${c.x},${c.y} ${c.x + vx * r},${c.y + vy * r}`;
    }
    const last = pts[pts.length - 1];
    d += ` L${last.x},${last.y}`;
    // midpoint along the polyline, for the ✕ button
    const segs = pts.slice(1).map((q, i) => Math.hypot(q.x - pts[i].x, q.y - pts[i].y));
    let half = segs.reduce((x, y) => x + y, 0) / 2, mid = pts[0];
    for (let i = 0; i < segs.length; i++) {
      if (half <= segs[i]) { const t = segs[i] ? half / segs[i] : 0; mid = { x: pts[i].x + (pts[i + 1].x - pts[i].x) * t, y: pts[i].y + (pts[i + 1].y - pts[i].y) * t }; break; }
      half -= segs[i];
    }
    return { d, mid };
  }

  const groupBox = (members: number[]) => {
    const ns = members.map((id) => lay!.nodes.find((n) => n.id === id)!).filter(Boolean);
    const x0 = Math.min(...ns.map((n) => pos[n.id]?.x ?? n.x)), y0 = Math.min(...ns.map((n) => pos[n.id]?.y ?? n.y));
    const y1 = Math.max(...ns.map((n) => (pos[n.id]?.y ?? n.y) + n.h)), x1 = Math.max(...ns.map((n) => (pos[n.id]?.x ?? n.x) + n.w));
    return { x: x0 - GROUP_PAD, y: y0 - GROUP_PAD - GROUP_HEAD, w: x1 - x0 + 2 * GROUP_PAD, h: y1 - y0 + 2 * GROUP_PAD + GROUP_HEAD };
  };

  const grouped = $derived(new Set(lay?.groups.flatMap((g) => g.members)));
  /** "Radeon HD Audio Controller HDMI 1 Output" → title "HDMI 1 Output", device name moves to the subtitle (or the group frame). */
  function names(n: Node) {
    const d = n.deviceId !== undefined ? model.devices.get(n.deviceId)?.description : undefined;
    const rest = d && n.label.startsWith(d) ? n.label.slice(d.length).trim() : '';
    const title = rest.length > 2 && !rest.startsWith('(') ? rest : n.label;
    const app = n.app && n.app !== n.label && !n.app.startsWith('WirePlumber') ? n.app : undefined;
    return { title, sub: (grouped.has(n.id) ? undefined : title !== n.label ? d : app) ?? n.mediaClass };
  }

  const clip = (s: string, n: number) => (s.length > n ? s.slice(0, n - 1) + '…' : s);

  // ---------- pan / zoom ----------
  const toGraph = (e: PointerEvent | WheelEvent) => {
    const r = svg.getBoundingClientRect();
    return { x: (e.clientX - r.left - view.x) / view.k, y: (e.clientY - r.top - view.y) / view.k };
  };

  function onwheel(e: WheelEvent) {
    e.preventDefault();
    const r = svg.getBoundingClientRect(), mx = e.clientX - r.left, my = e.clientY - r.top;
    const k = Math.min(3, Math.max(0.15, view.k * Math.exp(-e.deltaY * 0.0015)));
    view = { k, x: mx - ((mx - view.x) * k) / view.k, y: my - ((my - view.y) * k) / view.k };
  }

  let pan: { sx: number; sy: number; vx: number; vy: number; moved: boolean } | null = null;
  let panning = $state(false);

  // ---------- wire drawing ----------
  type Drag = { port: LPort; at: { x: number; y: number }; target: LPort | null; targetNode: number | null };
  let drag = $state<Drag | null>(null);

  const modelPort = (p: LPort): Port | undefined => {
    const n = model.nodes.get(p.nodeId);
    return [...(n?.inputs ?? []), ...(n?.outputs ?? [])].find((x) => x.id === p.id);
  };
  const pairKey = (a: LPort, b: LPort) => (a.dir === 'out' ? `${a.id}>${b.id}` : `${b.id}>${a.id}`);
  const compatible = (a: LPort, b: LPort) =>
    b.dir !== a.dir && b.media === a.media && b.nodeId !== a.nodeId && !linkedPairs.has(pairKey(a, b));

  /** Port pairs to create when dropping a wire from `src` onto a whole node. */
  function nodePairs(src: LPort, nodeId: number): [number, number][] {
    const a = model.nodes.get(src.nodeId), b = model.nodes.get(nodeId);
    if (!a || !b || nodeId === src.nodeId) return [];
    const vis = new Set(lay?.nodes.flatMap((n) => n.ports.map((p) => p.id)));
    const sel = (ps: Port[], mon: boolean) => ps.filter((p) => p.media === src.media && vis.has(p.id) && p.monitor === mon);
    const [outs, ins] = src.dir === 'out'
      ? [sel(a.outputs, src.monitor), sel(b.inputs, false)]
      : [sel(b.outputs, false), sel(a.inputs, false)];
    return channelPairs(outs, ins).filter(([o, i]) => !linkedPairs.has(`${o}>${i}`));
  }

  function startWire(e: PointerEvent, p: LPort) {
    e.stopPropagation();
    if (e.button !== 0) return;
    svg.setPointerCapture(e.pointerId);
    drag = { port: p, at: abs(p), target: null, targetNode: null };
  }

  // ---------- moving cards ----------
  type Move = { ids: number[]; sx: number; sy: number; from: Record<number, { x: number; y: number }>; moved: boolean; click?: number };
  let move: Move | null = null;
  function startMove(e: PointerEvent, ids: number[], click?: number) {
    e.stopPropagation();
    if (e.button !== 0) return;
    svg.setPointerCapture(e.pointerId);
    move = { ids, sx: e.clientX, sy: e.clientY, from: Object.fromEntries(ids.map((id) => [id, pos[id]])), moved: false, click };
  }

  function onpointerdown(e: PointerEvent) {
    if (e.button !== 0 && e.button !== 1) return;
    svg.setPointerCapture(e.pointerId);
    pan = { sx: e.clientX, sy: e.clientY, vx: view.x, vy: view.y, moved: false };
  }

  function onpointermove(e: PointerEvent) {
    if (move) {
      const dx = (e.clientX - move.sx) / view.k, dy = (e.clientY - move.sy) / view.k;
      if (Math.hypot(dx, dy) * view.k > 3) move.moved = true;
      if (move.moved) {
        cancelAnimationFrame(frame);
        const next = { ...pos };
        for (const id of move.ids) next[id] = { x: move.from[id].x + dx, y: move.from[id].y + dy };
        pos = next;
      }
    } else if (drag) {
      const g = toGraph(e);
      let best: LPort | null = null, bd = 28 / view.k;
      for (const p of portAt.values()) {
        if (!compatible(drag.port, p)) continue;
        const a = abs(p), d = Math.hypot(a.x - g.x, a.y - g.y);
        if (d < bd) { bd = d; best = p; }
      }
      const over = best ? null : lay?.nodes.find((n) => {
        const o = pos[n.id]; return o && g.x >= o.x && g.x <= o.x + n.w && g.y >= o.y && g.y <= o.y + n.h;
      });
      drag = { ...drag, at: g, target: best, targetNode: over && nodePairs(drag.port, over.id).length ? over.id : null };
    } else if (pan) {
      const dx = e.clientX - pan.sx, dy = e.clientY - pan.sy;
      if (Math.hypot(dx, dy) > 3) { pan.moved = true; panning = true; }
      if (pan.moved) view = { ...view, x: pan.vx + dx, y: pan.vy + dy };
    }
  }

  async function onpointerup() {
    const d = drag, p = pan, mv = move;
    drag = null; pan = null; panning = false; move = null;
    if (mv) {
      if (!mv.moved) { if (mv.click !== undefined) onselect(mv.click); return; }
      for (const id of mv.ids) pins[nameOf(id)] = pos[id];
      savePins();
      return;
    }
    if (p && !p.moved) { selEdge = null; onselect(null); }
    if (!d) return;
    const pairs: [number, number][] = d.target
      ? [d.port.dir === 'out' ? [d.port.id, d.target.id] : [d.target.id, d.port.id]]
      : d.targetNode !== null ? nodePairs(d.port, d.targetNode) : [];
    try { for (const [o, i] of pairs) await link(o, i); } catch (e) { err = `${tr('Kunne ikke koble', 'Could not connect')}: ${e}`; }
  }

  async function remove(id: number) {
    selEdge = null; hoverEdge = null;
    try { await unlink(id); } catch (e) { err = `${tr('Kunne ikke koble fra', 'Could not disconnect')}: ${e}`; }
  }

  function onkeydown(e: KeyboardEvent) {
    if ((e.target as HTMLElement)?.closest?.('input, textarea, select, [contenteditable]')) return;
    if ((e.key === 'Delete' || e.key === 'Backspace') && selEdge !== null) { e.preventDefault(); remove(selEdge); }
    if (e.key === 'Escape') { selEdge = null; drag = null; }
  }

  // ---------- toolbar ----------
  const MEDIA: Media[] = ['audio', 'midi', 'video'];
  const mediaName = (m: Media) => (m === 'audio' ? tr('Lyd', 'Audio') : m === 'midi' ? 'MIDI' : 'Video');
  const toggleMedia = (m: Media) =>
    (opts.media = opts.media.includes(m) ? opts.media.filter((x) => x !== m) : [...opts.media, m]);
  const relayout = () => { pins = {}; savePins(); fitPending = true; relayoutTick++; };

  const wiring = $derived(drag !== null);
  const isTarget = (p: LPort) => !!drag && compatible(drag.port, p);
</script>

<svelte:window {onkeydown} />

<div
  class="graph"
  class:panning
  bind:clientWidth={W}
  bind:clientHeight={H}
  style="background-position: {view.x}px {view.y}px; background-size: {24 * view.k}px {24 * view.k}px"
>
  <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
  <svg
    bind:this={svg}
    role="application"
    aria-label={tr('Lydgraf', 'Audio graph')}
    {onwheel}
    {onpointerdown}
    {onpointermove}
    {onpointerup}
    onpointercancel={onpointerup}
  >
    {#if lay}
      <g transform="translate({view.x},{view.y}) scale({view.k})">
        {#each lay.groups as g (g.key)}
          {@const b = groupBox(g.members)}
          <g class="group" style="--role: var(--role-{g.role})" role="presentation" onpointerdown={(ev) => startMove(ev, g.members)}>
            <rect x={b.x} y={b.y} width={b.w} height={b.h} rx="18" />
            <text x={b.x + 14} y={b.y + 21}>{clip(g.label, 34)}</text>
          </g>
        {/each}

        {#each lay.edges as e (e.id)}
          {@const a = portAt.get(e.from)}
          {@const b = portAt.get(e.to)}
          {@const l = linkById.get(e.id)}
          {#if a && b}
            {@const w = routed(e) ?? wire(abs(a), abs(b))}
            {@const active = l?.state === 'active'}
            {@const flowing = active && model.nodes.get(e.outNode)?.state === 'running'}
            {@const mine = selected !== null && (e.outNode === selected || e.inNode === selected)}
            <g
              class="edge"
              class:active
              class:hot={hoverEdge === e.id || selEdge === e.id || mine}
              class:dim={selected !== null && !mine}
              style="--c: var(--{e.media})"
            >
              {#if active}<path class="glow" d={w.d} />{/if}
              <path class="line" d={w.d} />
              {#if flowing}<path class="flow" d={w.d} />{/if}
              <!-- svelte-ignore a11y_click_events_have_key_events -->
              <path
                class="hit"
                d={w.d}
                role="button"
                tabindex="-1"
                aria-label={tr('Kobling', 'Link')}
                onpointerenter={() => (hoverEdge = e.id)}
                onpointerleave={() => (hoverEdge = null)}
                onpointerdown={(ev) => ev.stopPropagation()}
                onclick={() => (selEdge = selEdge === e.id ? null : e.id)}
              ><title>{a.alias} → {b.alias}{l ? ` (${l.state})` : ''}</title></path>
            </g>
          {/if}
        {/each}

        {#each lay.nodes as ln (ln.id)}
          {@const n = model.nodes.get(ln.id)}
          {@const o = pos[ln.id]}
          {#if n && o}
            {@const running = n.state === 'running'}
            {@const nm = names(n)}
            <!-- svelte-ignore a11y_click_events_have_key_events -->
            <g
              class="node"
              class:sel={selected === ln.id}
              class:droptarget={drag?.targetNode === ln.id}
              class:muted={n.mute}
              transform="translate({o.x},{o.y})"
              style="--role: var(--role-{n.role})"
              role="button"
              tabindex="-1"
              aria-label={n.label}
              onpointerdown={(ev) => startMove(ev, [ln.id], ln.id)}
            >
              <rect class="ring" x="-4" y="-4" width={ln.w + 8} height={ln.h + 8} rx="15" />
              <rect class="card" width={ln.w} height={ln.h} rx="12" />
              <path class="head" d="M0,12 a12,12 0 0 1 12,-12 h{ln.w - 24} a12,12 0 0 1 12,12 v{HEAD_H - 12} h{-ln.w} z" />
              <rect class="stripe" width={ln.w} height="3" rx="1.5" x="0" y="0" />
              <circle class="state" class:running cx="16" cy="19" r="4"><title>{n.state}</title></circle>
              <text class="label" x="28" y="23">{clip(nm.title, n.isDefault ? 24 : 27)}<title>{n.label}</title></text>
              <text class="sub" x="28" y="39">{clip(nm.sub, 32)}</text>
              {#if n.isDefault}<text class="star" x={ln.w - 14} y="24" text-anchor="middle">★<title>{tr('Standard', 'Default')}</title></text>{/if}
              {#if n.volume !== undefined}
                <rect class="vol-track" x="12" y={HEAD_H - 6} width={ln.w - 24} height="2.5" rx="1.25" />
                <rect class="vol" x="12" y={HEAD_H - 6} width={(ln.w - 24) * Math.min(1, n.volume)} height="2.5" rx="1.25">
                  <title>{n.mute ? tr('Dempet', 'Muted') : `${Math.round(n.volume * 100)} %`}</title>
                </rect>
              {/if}
              {#each ln.ports as p (p.id)}
                <g class="port {p.dir}" class:target={isTarget(p)} class:snap={drag?.target?.id === p.id} class:monitor={p.monitor} style="--c: var(--{p.media})">
                  <text x={p.dir === 'in' ? 14 : ln.w - 14} y={p.y + 4} text-anchor={p.dir === 'in' ? 'start' : 'end'}>
                    {p.monitor ? `mon ${p.label}` : clip(p.label, 14)}
                  </text>
                  <circle
                    cx={p.x}
                    cy={p.y}
                    r="5"
                    role="button"
                    tabindex="-1"
                    aria-label={p.alias}
                    onpointerdown={(ev) => startWire(ev, p)}
                  ><title>{p.alias}</title></circle>
                </g>
              {/each}
            </g>
          {/if}
        {/each}

        {#if drag}
          {@const a = abs(drag.port)}
          {@const b = drag.target ? abs(drag.target) : drag.at}
          {@const w = drag.port.dir === 'out' ? wire(a, b) : wire(b, a)}
          <path class="rubber" class:ok={drag.target || drag.targetNode !== null} d={w.d} style="--c: var(--{drag.port.media})" />
        {/if}

        {#if selEdge !== null}
          {@const e = lay.edges.find((x) => x.id === selEdge)}
          {@const a = e && portAt.get(e.from)}
          {@const b = e && portAt.get(e.to)}
          {#if a && b}
            {@const m = (routed(e!) ?? wire(abs(a), abs(b))).mid}
            <!-- svelte-ignore a11y_click_events_have_key_events -->
            <g
              class="cut"
              transform="translate({m.x},{m.y})"
              role="button"
              tabindex="-1"
              aria-label={tr('Koble fra', 'Disconnect')}
              onpointerdown={(ev) => ev.stopPropagation()}
              onclick={() => remove(selEdge!)}
            >
              <circle r="11" />
              <path d="M-4,-4 L4,4 M4,-4 L-4,4" />
              <title>{tr('Koble fra (Delete)', 'Disconnect (Delete)')}</title>
            </g>
          {/if}
        {/if}
      </g>
    {/if}
  </svg>

  {#if lay && !lay.nodes.length}
    <div class="empty">{tr('Ingen noder å vise', 'No nodes to show')}</div>
  {/if}

  <div class="toolbar" class:wiring>
    <button onclick={fit} title={tr('Tilpass visningen', 'Fit to view')}>⤢ {tr('Tilpass', 'Fit')}</button>
    <button onclick={relayout} title={tr('Beregn oppsettet på nytt', 'Recompute the layout')}>↻ {tr('Nytt oppsett', 'Re-layout')}</button>
    <span class="sep"></span>
    <button class:on={opts.hideUnused} aria-pressed={opts.hideUnused} onclick={() => (opts.hideUnused = !opts.hideUnused)}>{tr('Skjul ubrukte', 'Hide unused')}</button>
    <button class:on={opts.showMonitors} aria-pressed={opts.showMonitors} onclick={() => (opts.showMonitors = !opts.showMonitors)}>{tr('Monitorer', 'Monitors')}</button>
    <span class="sep"></span>
    {#each MEDIA as m (m)}
      <button class="chip" class:on={opts.media.includes(m)} aria-pressed={opts.media.includes(m)} style="--c: var(--{m})" onclick={() => toggleMedia(m)}>
        <i></i>{mediaName(m)}
      </button>
    {/each}
  </div>

  {#if err}
    <button class="err" onclick={() => (err = null)} title={tr('Lukk', 'Close')}>{err}</button>
  {/if}
</div>

<style>
  .graph {
    position: absolute; inset: 0; overflow: hidden; user-select: none;
    background-color: var(--bg);
    background-image: radial-gradient(circle, color-mix(in srgb, var(--text-dim) 22%, transparent) 1px, transparent 1.4px);
  }
  svg { display: block; width: 100%; height: 100%; cursor: grab; touch-action: none; }
  .panning svg { cursor: grabbing; }

  .group rect { fill: color-mix(in srgb, var(--role) 5%, transparent); stroke: color-mix(in srgb, var(--role) 28%, transparent); stroke-width: 1; }
  .group text { fill: color-mix(in srgb, var(--role) 70%, var(--text-dim)); font: 600 10.5px var(--font); letter-spacing: 0.08em; text-transform: uppercase; }

  .edge path { fill: none; stroke-linecap: round; transition: opacity 0.2s, stroke-width 0.15s; }
  .edge .line { stroke: var(--c); stroke-width: 2; opacity: 0.55; }
  .edge.active .line { opacity: 0.9; }
  .edge .glow { stroke: var(--c); stroke-width: 7; opacity: 0.12; }
  .edge .flow { stroke: color-mix(in srgb, var(--c) 40%, white); stroke-width: 2; stroke-dasharray: 2 14; opacity: 0.8; animation: flow 1.1s linear infinite; }
  .edge .hit { stroke: transparent; stroke-width: 14; cursor: pointer; pointer-events: stroke; }
  .edge.hot .line { stroke-width: 3; opacity: 1; }
  .edge.hot .glow { opacity: 0.3; stroke-width: 10; }
  .edge.dim { opacity: 0.18; }
  @keyframes flow { to { stroke-dashoffset: -16; } }

  .group rect { cursor: move; }
  .node { cursor: move; animation: appear 0.35s ease-out; }
  .node .card { fill: var(--bg-elev); stroke: var(--border); filter: drop-shadow(0 6px 16px rgb(0 0 0 / 0.28)); }
  .node .head { fill: color-mix(in srgb, var(--role) 16%, var(--bg-elev)); }
  .node .stripe { fill: var(--role); opacity: 0.9; }
  .node .ring { fill: none; stroke: var(--accent); stroke-width: 2; opacity: 0; transition: opacity 0.2s; }
  .node.sel .ring { opacity: 1; }
  .node.droptarget .ring { opacity: 0.7; stroke-dasharray: 5 4; }
  .node:hover .card { stroke: color-mix(in srgb, var(--role) 50%, var(--border)); }
  .node .label { fill: var(--text); font: 600 13px var(--font); }
  .node .sub { fill: var(--text-dim); font: 11px var(--font); }
  .node .star { fill: var(--warn); font: 14px var(--font); }
  .node .state { fill: var(--text-dim); opacity: 0.5; }
  .node .state.running { fill: var(--role-source); opacity: 1; filter: drop-shadow(0 0 4px var(--role-source)); }
  .node .vol-track { fill: color-mix(in srgb, var(--text-dim) 20%, transparent); }
  .node .vol { fill: var(--role); }
  .node.muted .vol { fill: var(--text-dim); opacity: 0.5; }

  .port text { fill: var(--text-dim); font: 500 11px var(--mono); }
  .port.monitor text { opacity: 0.6; }
  .port circle { fill: var(--bg-elev); stroke: var(--c); stroke-width: 2.5; cursor: crosshair; transition: r 0.12s; }
  .port circle:hover, .port.snap circle { r: 7; fill: var(--c); }
  .port.target circle { r: 6.5; stroke-width: 3; fill: color-mix(in srgb, var(--c) 45%, var(--bg-elev)); filter: drop-shadow(0 0 6px var(--c)); }

  .rubber { fill: none; stroke: var(--c); stroke-width: 2.5; stroke-dasharray: 6 5; opacity: 0.7; pointer-events: none; }
  .rubber.ok { stroke-dasharray: none; opacity: 1; }

  .cut { cursor: pointer; }
  .cut circle { fill: var(--danger); filter: drop-shadow(0 2px 6px rgb(0 0 0 / 0.4)); }
  .cut path { stroke: white; stroke-width: 2; stroke-linecap: round; }

  @keyframes appear { from { opacity: 0; } }
  @media (prefers-reduced-motion: reduce) {
    .edge .flow { animation: none; }
    .node { animation: none; }
  }

  .toolbar {
    position: absolute; top: 12px; left: 12px; display: flex; flex-wrap: wrap; align-items: center; gap: 4px;
    padding: 5px; border-radius: 12px; background: color-mix(in srgb, var(--bg-elev) 85%, transparent);
    border: 1px solid var(--border); box-shadow: var(--shadow); backdrop-filter: blur(8px); max-width: calc(100% - 400px); min-width: 300px;
  }
  .toolbar.wiring { pointer-events: none; opacity: 0.5; }
  .toolbar button {
    background: none; border: 0; border-radius: 8px; padding: 5px 10px; color: var(--text-dim); cursor: pointer; font-size: 12.5px; white-space: nowrap;
  }
  .toolbar button:hover { background: var(--bg-elev-2); color: var(--text); }
  .toolbar button.on { background: var(--bg-elev-2); color: var(--text); box-shadow: inset 0 0 0 1px var(--border); }
  .toolbar .chip i { display: inline-block; width: 8px; height: 8px; border-radius: 50%; margin-right: 6px; border: 2px solid var(--c); vertical-align: 0; }
  .toolbar .chip.on i { background: var(--c); }
  .sep { width: 1px; height: 18px; background: var(--border); margin: 0 4px; }

  .empty { position: absolute; inset: 0; display: grid; place-items: center; color: var(--text-dim); pointer-events: none; }
  .err {
    position: absolute; left: 12px; bottom: 12px; max-width: 480px; text-align: left; cursor: pointer;
    background: color-mix(in srgb, var(--danger) 18%, var(--bg-elev)); border: 1px solid var(--danger); border-radius: 10px; padding: 8px 12px;
  }
</style>
