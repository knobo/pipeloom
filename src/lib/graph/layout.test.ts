import { describe, expect, it } from 'vitest';
import { buildModel, type PwObject } from '../model';
import dump from '../fixture.dump.json';
import { channelPairs, defaultOptions, layout, topologyKey } from './layout';

const m = buildModel(dump as PwObject[]);
const all = { ...defaultOptions, showMonitors: true };

describe('layout', () => {
  it('puts producers left of consumers, even unconnected ones', async () => {
    for (const o of [defaultOptions, all]) {
      const l = await layout(m, o);
      const role = (id: number) => m.nodes.get(id)!.role;
      const left = l.nodes.filter((n) => ['source', 'app-out'].includes(role(n.id)));
      const right = l.nodes.filter((n) => ['sink', 'app-in'].includes(role(n.id)));
      expect(left.length).toBeGreaterThan(0);
      expect(right.length).toBeGreaterThan(0);
      const maxLeft = Math.max(...left.map((n) => n.x + n.w));
      for (const n of right) expect(n.x).toBeGreaterThan(maxLeft);
    }
  });

  it('produces finite numbers and resolvable edges', async () => {
    const l = await layout(m, all);
    expect(l.edges.length).toBe(m.links.length);
    const ports = new Set(l.nodes.flatMap((n) => n.ports.map((p) => p.id)));
    for (const e of l.edges) { expect(ports.has(e.from)).toBe(true); expect(ports.has(e.to)).toBe(true); }
    const nums = [...l.nodes.flatMap((n) => [n.x, n.y, n.w, n.h, ...n.ports.flatMap((p) => [p.x, p.y])]),
      ...l.groups.flatMap((g) => [g.x, g.y, g.w, g.h]), l.width, l.height];
    for (const v of nums) expect(Number.isFinite(v)).toBe(true);
  });

  it('hides monitor links by default and unused nodes on request', async () => {
    expect((await layout(m)).edges.length).toBeLessThan(m.links.length);
    const l = await layout(m, { ...all, hideUnused: true });
    const used = new Set(m.links.flatMap((x) => [x.outNode, x.inNode]));
    for (const n of l.nodes) expect(used.has(n.id)).toBe(true);
  });

  it('is deterministic', async () => {
    expect(JSON.stringify(await layout(m, all))).toBe(JSON.stringify(await layout(m, all)));
  });

  it('topology key ignores volume and state changes', () => {
    const objs = structuredClone(dump) as PwObject[];
    for (const o of objs) {
      const props = o.info?.params?.Props;
      if (props) for (const p of props) if (p?.channelVolumes) p.channelVolumes = p.channelVolumes.map(() => 0.01);
      if (o.info?.state) o.info.state = 'idle';
    }
    const m2 = buildModel(objs);
    expect([...m2.nodes.values()].some((n) => n.volume !== m.nodes.get(n.id)?.volume)).toBe(true);
    expect(topologyKey(m2)).toBe(topologyKey(m));
    expect(topologyKey(buildModel(objs.filter((o) => !o.type.endsWith('Link'))))).not.toBe(topologyKey(m));
  });

  it('pairs channels FL→FL, FR→FR', () => {
    const p = (id: number, channel: string, dir: 'in' | 'out') =>
      ({ id, nodeId: 0, name: '', alias: '', dir, channel, monitor: false, physical: false, media: 'audio' as const });
    expect(channelPairs([p(1, 'FR', 'out'), p(2, 'FL', 'out')], [p(3, 'FL', 'in'), p(4, 'FR', 'in')])).toEqual([[2, 3], [1, 4]]);
    expect(channelPairs([p(1, 'MONO', 'out')], [p(3, 'FL', 'in'), p(4, 'FR', 'in')])).toEqual([[1, 3], [1, 4]]);
  });
});

describe('wide screens', () => {
  it('spreads into sub-columns to match the viewport aspect, keeping producers left of consumers', async () => {
    const m = buildModel(dump as PwObject[]);
    const narrow = await layout(m, defaultOptions);
    const wide = await layout(m, { ...defaultOptions, aspect: 2.5 });
    expect(wide.width / wide.height).toBeGreaterThan(narrow.width / narrow.height);
    const x = (l: typeof wide, roles: string[]) => l.nodes.filter((n) => roles.includes(m.nodes.get(n.id)!.role)).map((n) => n.x);
    expect(Math.max(...x(wide, ['source', 'app-out']))).toBeLessThan(Math.min(...x(wide, ['sink', 'app-in'])));
  });
});
