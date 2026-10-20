import { describe, expect, it } from 'vitest';
import { buildModel, type PwObject } from '../model';
import dump from '../fixture.dump.json';
import { buildIndex, search, GEMS, SYMPTOMS, CORE_SETTINGS, parseCore } from './catalog';
import { i18n } from '../i18n.svelte';

i18n.lang = 'no';

const model = buildModel(dump as PwObject[]);
const docs = buildIndex(model, { objects: true });
const ids = (q: string) => search(docs, q).map((d) => d.id);

describe('catalog search', () => {
  it('"autoswitch" ranks the bluetooth autoswitch setting first', () => {
    expect(ids('autoswitch')[0]).toBe('bluetooth.autoswitch-to-headset-profile');
  });
  it('Norwegian symptom "hakker" finds quantum and suspend items', () => {
    const r = ids('hakker');
    expect(r).toContain('settings:clock.force-quantum');
    expect(r).toContain('gem:suspend-timeout');
    expect(r).toContain('gem:pulse-min-quantum');
  });
  it('"knitrer" (inflected) still finds knitring items', () => {
    expect(ids('knitrer')).toContain('settings:clock.force-quantum');
  });
  it('"mikrofon dårlig" finds the BT microphone advice', () => {
    const r = ids('mikrofon dårlig');
    expect(r).toContain('gem:bt-msbc');
  });
  it('"lyd forsinket" finds latency items', () => {
    expect(ids('forsinket')).toEqual(expect.arrayContaining(['gem:low-latency', 'settings:clock.quantum']));
  });
  it('"bluetooth" finds settings and gems', () => {
    const r = ids('bluetooth');
    expect(r).toContain('bluetooth.autoswitch-to-headset-profile');
    expect(r).toContain('gem:bt-hw-volume');
  });
  it('English synonyms work ("latency")', () => {
    expect(ids('latency')).toContain('settings:clock.force-quantum');
  });
  it('indexes nodes and devices and raw metadata', () => {
    expect(docs.some((d) => d.kind === 'node')).toBe(true);
    expect(docs.some((d) => d.kind === 'device')).toBe(true);
    expect(docs.some((d) => d.id === 'default:default.audio.sink')).toBe(true);
  });
  it('marks changed-from-default', () => {
    expect(docs.find((d) => d.id === 'bluetooth.autoswitch-to-headset-profile')!.changed).toBe(true);
    expect(docs.find((d) => d.id === 'settings:clock.quantum')!.changed).toBe(false);
  });
  it('English symptom words find the same items as Norwegian ones', () => {
    for (const [en, no] of [['crackling', 'knitring'], ['stutter', 'hakker'], ['choppy', 'hakker'], ['latency', 'forsinkelse']]) {
      for (const id of ['settings:clock.force-quantum', 'gem:suspend-timeout']) {
        expect(ids(en), `${en} ${id}`).toContain(id);
        expect(ids(no), `${no} ${id}`).toContain(id);
      }
    }
    expect(ids('crackling')).toContain('gem:pulse-min-quantum');
  });
  it('"mic quality" / "headset" find the BT microphone advice', () => {
    expect(ids('mic quality')).toContain('gem:bt-msbc');
    expect(ids('headset')).toEqual(expect.arrayContaining(['bluetooth.autoswitch-to-headset-profile', 'gem:bt-msbc']));
    expect(ids('bad microphone')).toContain('gem:bt-msbc');
  });
  it('English curated titles are indexed while the UI is Norwegian, and vice versa', () => {
    expect(ids('hide device')).toContain('gem:device-disabled'); // "Hide a device you never use"
    i18n.lang = 'en';
    try {
      const en = buildIndex(model);
      expect(search(en, 'hodesett-profil')[0].id).toBe('bluetooth.autoswitch-to-headset-profile');
      expect(en.find((d) => d.id === 'gem:bt-msbc')!.title).toBe('Better microphone on Bluetooth headsets (mSBC)');
      expect(search(en, 'mikrofon dårlig').map((d) => d.id)).toContain('gem:bt-msbc');
    } finally { i18n.lang = 'no'; }
  });
  it('no match → empty', () => {
    expect(ids('zzqqxx')).toEqual([]);
  });
});

describe('catalog integrity', () => {
  const all = new Set(docs.map((d) => d.id));
  it('every symptom/related target exists', () => {
    for (const s of SYMPTOMS) for (const t of s.targets) expect(all.has(t), t).toBe(true);
    for (const g of GEMS) if (g.related) expect(all.has(g.related), g.related).toBe(true);
  });
  it('snippets have balanced brackets and live under ~/.config', () => {
    for (const g of GEMS) {
      const code = g.snippet.replace(/#.*$/gm, '').replace(/"[^"]*"/g, '');
      for (const [o, c] of [['{', '}'], ['[', ']']]) expect(code.split(o).length, `${g.id} ${o}`).toBe(code.split(c).length);
      expect(g.file).toMatch(/^~\/\.config\/(wireplumber\/wireplumber|pipewire\/(pipewire|pipewire-pulse|client))\.conf\.d\/.+\.conf$/);
    }
  });
  it('parses core values', () => {
    expect(parseCore('[ 44100 48000 ]')).toEqual([44100, 48000]);
    expect(parseCore(1024)).toBe(1024);
    expect(CORE_SETTINGS.length).toBe(8);
  });
});

describe('panels render (SSR smoke test)', () => {
  it('SettingsPanel and CommandPalette render with the fixture', async () => {
    const { render } = await import('svelte/server');
    const Settings = (await import('./SettingsPanel.svelte')).default;
    const Palette = (await import('./CommandPalette.svelte')).default;
    const html = render(Settings, { props: { model, focusKey: null } }).body;
    expect(html).toContain('Bytt automatisk til hodesett-profil');
    expect(html).toContain('51-disable-suspension.conf');
    expect(html).toContain('Rå metadata');
    i18n.lang = 'en';
    try {
      const en = render(Settings, { props: { model, focusKey: null } }).body;
      expect(en).toContain('Auto-switch to headset profile');
      expect(en).toContain('Hidden gems (config files)');
      expect(en).toContain('Crackling / stuttering');
      expect(en).not.toContain('Tilbakestill');
    } finally { i18n.lang = 'no'; }
    expect(render(Palette, { props: { model, open: true, onpick: () => {} } }).body).toContain('bluetooth.autoswitch-to-headset-profile');
  });
});
