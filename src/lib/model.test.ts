import { describe, expect, it } from 'vitest';
import { buildModel, type PwObject } from './model';
import dump from './fixture.dump.json';

describe('buildModel', () => {
  const m = buildModel(dump as PwObject[]);
  it('derives nodes, links and ports from a real pw-dump', () => {
    expect(m.nodes.size).toBeGreaterThan(0);
    for (const l of m.links) {
      expect(m.nodes.get(l.outNode)?.outputs.some((p) => p.id === l.outPort)).toBe(true);
      expect(m.nodes.get(l.inNode)?.inputs.some((p) => p.id === l.inPort)).toBe(true);
    }
  });
  it('reads WirePlumber settings with schema and saved state', () => {
    const s = m.settings.find((x) => x.key === 'bluetooth.autoswitch-to-headset-profile')!;
    expect(s.type).toBe('bool');
    expect(s.default).toBe(true);
    expect(s.value).toBe(false);
    expect(s.isSaved).toBe(true);
  });
});
