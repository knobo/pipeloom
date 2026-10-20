// Pure graph layout: Model + view options -> positioned nodes, ports, groups, edges. No DOM, no Svelte.
import ELK from 'elkjs/lib/elk.bundled.js';
import type { ElkNode } from 'elkjs/lib/elk-api';
import type { Link, Model, Node, Port, Role } from '../model';

export type Media = Port['media'];
/** aspect: viewport width/height; sides get extra sub-columns until the layout roughly matches it. */
export interface LayoutOptions { hideUnused: boolean; showMonitors: boolean; media: Media[]; aspect?: number }
export const defaultOptions: LayoutOptions = { hideUnused: false, showMonitors: false, media: ['audio', 'midi', 'video', 'other'] };

/** Port position is relative to its node's top-left corner. */
export interface LPort { id: number; nodeId: number; dir: 'in' | 'out'; media: Media; label: string; alias: string; monitor: boolean; x: number; y: number }
export interface LNode { id: number; x: number; y: number; w: number; h: number; ports: LPort[] }
export interface LGroup { key: string; label: string; role: Role; members: number[]; x: number; y: number; w: number; h: number }
/** route: ELK's orthogonal path in layout coordinates (start, bends, end); empty if ELK gave none. */
export interface LEdge { id: number; from: number; to: number; outNode: number; inNode: number; media: Media; route: { x: number; y: number }[] }
export interface Layout { nodes: LNode[]; groups: LGroup[]; edges: LEdge[]; width: number; height: number }

export const NODE_W = 236, HEAD_H = 50, ROW_H = 22, FOOT = 10;
export const GROUP_PAD = 12, GROUP_HEAD = 24;
const GROUP_GAP = 12;
const COL_W = NODE_W + 2 * GROUP_PAD + 150, NODE_GAP = 36;

/** Signal-flow column: producers left, filters middle, consumers right. */
export const partitionOf = (r: Role) => (r === 'source' || r === 'app-out' ? 0 : r === 'sink' || r === 'app-in' ? 2 : 1);

const CH = ['MONO', 'FL', 'FR', 'FC', 'LFE', 'RL', 'RR', 'SL', 'SR', 'FLC', 'FRC', 'RC', 'TC'];
const chRank = (p: Port) => { const i = CH.indexOf(p.channel.toUpperCase()); return i < 0 ? CH.length : i; };
/** Channel order (FL, FR, …) so parallel wires never twist; monitors last. */
export const sortPorts = (ps: Port[]) =>
  [...ps].sort((a, b) => +a.monitor - +b.monitor || chRank(a) - chRank(b) || a.name.localeCompare(b.name) || a.id - b.id);

export const portLabel = (p: Port) => p.channel || p.name;

/** Changes only when what is drawn changes, not on volume/state updates. */
export function topologyKey(m: Model): string {
  const ns = [...m.nodes.values()].map((n) => `${n.id}:${[...n.inputs, ...n.outputs].map((p) => p.id).join(',')}`);
  const ls = m.links.map((l) => `${l.id}:${l.outPort}>${l.inPort}`);
  return ns.sort().join('|') + '#' + ls.sort().join('|');
}

/** Applies view options: which ports, links and nodes are visible. */
export function visible(m: Model, o: LayoutOptions) {
  const keep = (p: Port) => o.media.includes(p.media) && (o.showMonitors || !p.monitor);
  const ports = new Map<number, Port>();
  for (const n of m.nodes.values()) for (const p of [...n.inputs, ...n.outputs]) if (keep(p)) ports.set(p.id, p);
  const links = m.links.filter((l) => ports.has(l.outPort) && ports.has(l.inPort));
  const linked = new Set(links.flatMap((l) => [l.outNode, l.inNode]));
  const nodes = [...m.nodes.values()]
    .filter((n) => [...n.inputs, ...n.outputs].some((p) => ports.has(p.id)) && (!o.hideUnused || linked.has(n.id)));
  return { nodes, ports, links };
}

// WirePlumber exports its own helper nodes (MIDI bridges, …); grouping those by "app" says nothing.
const appOf = (n: Node) => (n.app && !n.app.startsWith('WirePlumber') ? n.app : undefined);
const groupKey = (n: Node) => `${partitionOf(n.role)}:${n.deviceId !== undefined ? `d${n.deviceId}` : appOf(n) ? `a${appOf(n)}` : `n${n.id}`}`;

const elk = new ELK();

export async function layout(m: Model, o: LayoutOptions = defaultOptions): Promise<Layout> {
  const { nodes, ports, links } = visible(m, o);

  // Size each node and place its port rows: inputs on the left edge, outputs on the right.
  const lnodes = new Map<number, LNode>();
  for (const n of nodes) {
    const ins = sortPorts(n.inputs.filter((p) => ports.has(p.id)));
    const outs = sortPorts(n.outputs.filter((p) => ports.has(p.id)));
    const row = (p: Port, i: number, x: number): LPort => ({
      id: p.id, nodeId: n.id, dir: p.dir, media: p.media, label: portLabel(p), alias: p.alias, monitor: p.monitor,
      x, y: HEAD_H + i * ROW_H + ROW_H / 2,
    });
    lnodes.set(n.id, {
      id: n.id, x: 0, y: 0, w: NODE_W, h: HEAD_H + Math.max(ins.length, outs.length, 1) * ROW_H + FOOT,
      ports: [...ins.map((p, i) => row(p, i, 0)), ...outs.map((p, i) => row(p, i, NODE_W))],
    });
  }

  // Same device / same app (within one column) become one ELK block with the members stacked inside,
  // so groups stay contiguous and ELK still sees every port at its exact position.
  const groups = new Map<string, Node[]>();
  const sorted = [...nodes].sort((a, b) => partitionOf(a.role) - partitionOf(b.role) || a.id - b.id);
  for (const n of sorted) groups.set(groupKey(n), [...(groups.get(groupKey(n)) ?? []), n]);
  for (const members of groups.values()) members.sort((a, b) => a.label.localeCompare(b.label) || a.id - b.id);
  const linked = new Set(links.flatMap((l) => [l.outNode, l.inNode]));

  const run = async () => {
    const blocks = [...groups].map(([key, members]) => makeBlock(key, members, lnodes, linked));
    assignColumns(blocks, o.aspect);
    const graph: ElkNode = {
      id: 'root',
      layoutOptions: ROOT_OPTIONS,
      children: blocks,
      edges: links.map((l) => ({ id: `e${l.id}`, sources: [`p${l.outPort}`], targets: [`p${l.inPort}`] })),
    };
    return { blocks, res: await elk.layout(graph) };
  };

  // Pass 1, then reorder members inside each group by where their wires go (barycenter), then pass 2.
  let { blocks, res } = await run();
  if (untangle(groups, blocks, res, links, lnodes)) ({ blocks, res } = await run());

  const out: Layout = { nodes: [], groups: [], edges: [], width: res.width ?? 0, height: res.height ?? 0 };
  for (const b of res.children ?? []) {
    const src = blocks.find((x) => x.id === b.id)!;
    const bx = b.x ?? 0, by = b.y ?? 0;
    src.members.forEach((n, i) => {
      const ln = lnodes.get(n.id)!;
      ln.x = bx + src.offsets[i][0]; ln.y = by + src.offsets[i][1];
      out.nodes.push(ln);
    });
    if (src.members.length > 1) {
      const n0 = src.members[0];
      const label = (n0.deviceId !== undefined && m.devices.get(n0.deviceId)?.description) || appOf(n0) || n0.label;
      out.groups.push({ key: src.id, label, role: n0.role, members: src.members.map((n) => n.id), x: bx, y: by, w: src.width!, h: src.height! });
    }
  }
  const routes = new Map((res.edges ?? []).map((e) => {
    const sec = (e as any).sections?.[0];
    return [e.id, sec ? [sec.startPoint, ...(sec.bendPoints ?? []), sec.endPoint] : []] as const;
  }));
  out.edges = links.map((l: Link) => ({
    id: l.id, from: l.outPort, to: l.inPort, outNode: l.outNode, inNode: l.inNode, media: ports.get(l.outPort)!.media,
    route: routes.get(`e${l.id}`) ?? [],
  }));
  return out;
}

const ROOT_OPTIONS: Record<string, string> = {
  'elk.algorithm': 'layered',
  'elk.direction': 'RIGHT',
  'elk.partitioning.activate': 'true',
  'elk.separateConnectedComponents': 'false', // otherwise idle nodes get packed outside their column
  'elk.layered.layering.strategy': 'NETWORK_SIMPLEX',
  'elk.layered.crossingMinimization.strategy': 'LAYER_SWEEP',
  'elk.layered.nodePlacement.strategy': 'NETWORK_SIMPLEX',
  'elk.layered.considerModelOrder.strategy': 'NODES_AND_EDGES',
  'elk.edgeRouting': 'ORTHOGONAL', // routed around cards, so wires never pass behind a node
  'elk.spacing.nodeNode': '36',
  'elk.spacing.edgeEdge': '8',
  'elk.layered.spacing.edgeEdgeBetweenLayers': '8',
  'elk.layered.spacing.nodeNodeBetweenLayers': '150',
  'elk.spacing.edgeNode': '24',
  'elk.padding': '[top=40,left=40,bottom=40,right=40]',
};

type GBlock = ElkNode & { members: Node[]; offsets: [number, number][]; side: number; connected: boolean };

function makeBlock(key: string, members: Node[], lnodes: Map<number, LNode>, linked: Set<number>): GBlock {
  const framed = members.length > 1;
  let y = framed ? GROUP_PAD + GROUP_HEAD : 0;
  const offsets: [number, number][] = [];
  for (const n of members) { offsets.push([framed ? GROUP_PAD : 0, y]); y += lnodes.get(n.id)!.h + GROUP_GAP; }
  const w = NODE_W + (framed ? 2 * GROUP_PAD : 0), h = y - GROUP_GAP + (framed ? GROUP_PAD : 0);
  return {
    id: key, width: w, height: h, members, offsets,
    layoutOptions: { 'elk.portConstraints': 'FIXED_POS' },
    side: partitionOf(members[0].role), connected: members.some((n) => linked.has(n.id)),
    ports: members.flatMap((n, i) => lnodes.get(n.id)!.ports.map((p) => ({
      id: `p${p.id}`, width: 1, height: 1, x: p.x + offsets[i][0] - (p.dir === 'in' ? 1 : 0), y: p.y + offsets[i][1],
      layoutOptions: { 'elk.port.side': p.dir === 'in' ? 'WEST' : 'EAST' },
    }))),
  };
}

/**
 * Reorders members of multi-node app groups by the mean y of the ports they connect to.
 * Device groups keep their natural order (HDMI 1, 2, 3 …) and act as anchors the apps follow.
 * Returns true if any order changed.
 */
export function untangle(groups: Map<string, Node[]>, blocks: GBlock[], res: ElkNode, links: Link[], lnodes: Map<number, LNode>) {
  const blockOf = new Map<number, GBlock>(), at = new Map<string, { x: number; y: number }>();
  for (const b of blocks) for (const n of b.members) blockOf.set(n.id, b);
  for (const c of res.children ?? []) at.set(c.id, { x: c.x ?? 0, y: c.y ?? 0 });
  // Estimated absolute port y for the current member order (block position from the last ELK pass).
  const portY = new Map<number, number>();
  const place = (b: GBlock, members: Node[]) => {
    let y = (at.get(b.id)?.y ?? 0) + (members.length > 1 ? GROUP_PAD + GROUP_HEAD : 0);
    for (const n of members) { const ln = lnodes.get(n.id)!; for (const p of ln.ports) portY.set(p.id, y + p.y); y += ln.h + GROUP_GAP; }
  };
  for (const b of blocks) place(b, groups.get(b.id)!);

  let changed = false;
  for (const side of [0, 2, 1, 0, 2]) {
    for (const b of blocks) {
      const members = groups.get(b.id)!;
      if (b.side !== side || members.length < 2 || members[0].deviceId !== undefined) continue;
      const score = (n: Node) => {
        const ys = links.flatMap((l) =>
          l.outNode === n.id && blockOf.get(l.inNode) !== b ? [portY.get(l.inPort)!]
          : l.inNode === n.id && blockOf.get(l.outNode) !== b ? [portY.get(l.outPort)!] : []).filter((y) => y !== undefined);
        return ys.length ? ys.reduce((a, c) => a + c, 0) / ys.length : Infinity;
      };
      const scored = members.map((n, i) => ({ n, i, s: score(n) }));
      scored.sort((a, c) => (a.s === c.s ? a.i - c.i : a.s === Infinity ? 1 : c.s === Infinity ? -1 : a.s - c.s));
      const next = scored.map((x) => x.n);
      if (next.some((n, i) => n !== members[i])) { changed = true; groups.set(b.id, next); place(b, next); }
    }
  }
  return changed;
}

type Block = ElkNode & { side: number; connected: boolean };

/**
 * Wide screens: split the source and sink sides into sub-columns until width/height ≈ aspect.
 * Connected blocks take the innermost sub-column (next to the middle) so their wires stay short.
 */
export function assignColumns(blocks: Block[], aspect = 0) {
  const sides = [0, 1, 2].map((s) => blocks.filter((b) => b.side === s)
    .sort((a, b) => +b.connected - +a.connected));
  const total = sides.map((bs) => bs.reduce((h, b) => h + b.height! + NODE_GAP, 0));
  const k = [1, 1, 1];
  const height = () => Math.max(...total.map((t, i) => t / k[i]));
  const width = () => k.reduce((w, n, i) => w + (sides[i].length ? n : 0), 0) * COL_W;
  while (aspect && width() / height() < aspect) {
    const i = total[0] / k[0] >= total[2] / k[2] ? 0 : 2;
    if (k[i] >= sides[i].length || k[i] >= 6) break;
    k[i]++;
  }
  // Greedy fill from the inner column outwards, each column up to the side's average height.
  const fill = (bs: Block[], n: number, cap: number) => {
    const col: number[] = []; let c = 0, h = 0;
    for (const b of bs) {
      if (h > 0 && h + b.height! > cap && c < n - 1) { c++; h = 0; }
      col.push(c); h += b.height! + NODE_GAP;
    }
    return col; // 0 = innermost
  };
  const left = fill(sides[0], k[0], total[0] / k[0]), right = fill(sides[2], k[2], total[2] / k[2]);
  const part = (b: Block, p: number) => ((b.layoutOptions ??= {})['elk.partitioning.partition'] = String(p));
  sides[0].forEach((b, i) => part(b, k[0] - 1 - left[i]));
  sides[1].forEach((b) => part(b, k[0]));
  sides[2].forEach((b, i) => part(b, k[0] + 1 + right[i]));
}

/** Output→input pairs for a node-to-node drop: match channel names, else pair by order when counts match. */
export function channelPairs(outs: Port[], ins: Port[]): [number, number][] {
  const o = sortPorts(outs), i = sortPorts(ins);
  const byCh = o.flatMap((p) => { const q = i.find((x) => x.channel && x.channel === p.channel); return q ? [[p.id, q.id] as [number, number]] : []; });
  if (byCh.length) return byCh;
  if (o.length === i.length) return o.map((p, k) => [p.id, i[k].id]);
  if (o.length === 1) return i.map((q) => [o[0].id, q.id]); // mono → all inputs
  return [];
}
