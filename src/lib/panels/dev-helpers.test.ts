import { afterAll, describe, expect, it } from 'vitest';
import { buildModel, type PwObject } from '../model';
import dump from '../fixture.dump.json';
import { i18n, loc } from '../i18n.svelte';
import { GROUP_TITLES, appPinned, channelNames, nodeKind, pinnedByApp, codecOf, groupDevices, iconOf, linkedTarget, pinnedTarget, profileLabel, routeChoices, targetChoices } from './dev-helpers';

const p = (name: string, description = '') => ({ name, description });

describe('bluez profile labels', () => {
  i18n.lang = 'no';
  it('takes the codec from the description, since a bare a2dp-sink can be AAC', () => {
    expect(codecOf(p('a2dp-sink', 'High Fidelity Playback (A2DP Sink, codec AAC)'))).toBe('AAC');
    expect(profileLabel(p('a2dp-sink', 'High Fidelity Playback (A2DP Sink, codec AAC)'), 'bluez5')).toBe('Høy kvalitet – AAC');
    expect(profileLabel(p('headset-head-unit', 'Headset Head Unit (HSP/HFP, codec MSBC)'), 'bluez5')).toBe('Headset (mikrofon) – mSBC');
  });
  it('falls back to the codec suffix of the name', () => {
    expect(profileLabel(p('a2dp-sink-sbc_xq'), 'bluez5')).toBe('Høy kvalitet – SBC-XQ');
    expect(profileLabel(p('headset-head-unit-cvsd'), 'bluez5')).toBe('Headset (mikrofon) – CVSD');
    expect(profileLabel(p('a2dp-sink'), 'bluez5')).toBe('Høy kvalitet');
  });
  it('handles off and ALSA profiles', () => {
    expect(profileLabel(p('off', 'Off'), 'bluez5')).toBe('Av');
    expect(profileLabel(p('HiFi', 'Play HiFi quality Music'), 'alsa')).toBe('Play HiFi quality Music');
    expect(profileLabel(p('pro-audio', 'Pro Audio'), 'alsa')).toBe('Pro Audio');
  });
});

describe('bluez profile labels in English', () => {
  it('translates the friendly labels but keeps codec names', () => {
    i18n.lang = 'en';
    expect(profileLabel(p('a2dp-sink', 'High Fidelity Playback (A2DP Sink, codec AAC)'), 'bluez5')).toBe('High quality – AAC');
    expect(profileLabel(p('headset-head-unit-cvsd'), 'bluez5')).toBe('Headset (microphone) – CVSD');
    expect(profileLabel(p('off', 'Off'), 'bluez5')).toBe('Off');
    expect(loc(GROUP_TITLES.outputs)).toBe('Outputs');
  });
  afterAll(() => { i18n.lang = 'no'; });
});

describe('device grouping on the fixture', () => {
  const m = buildModel(dump as PwObject[]);
  const groups = Object.fromEntries(groupDevices(m).map(([g, ds]) => [g, ds.map((d) => d.id)]));
  it('puts sound cards under outputs and cameras under other', () => {
    expect(groups.outputs).toEqual(expect.arrayContaining([51, 52]));
    expect(groups.other).toEqual(expect.arrayContaining([53, 57]));
    expect(iconOf(m.devices.get(51)!, m)).toBe('hdmi');
    expect(iconOf(m.devices.get(53)!, m)).toBe('camera');
  });
  it('offers routes of the active profile-device only', () => {
    const { active, choices } = routeChoices(m.devices.get(52)!, 'Output');
    expect(active?.name).toBe('[Out] Speaker');
    expect(choices.every((r) => r.direction === 'Output')).toBe(true);
  });
  it('parses channel positions', () => {
    expect(channelNames(m.nodes.get(61)!)).toEqual(['FL', 'FR']);
  });
});

describe('stream targets', () => {
  const node = (id: number, name: string, cls: string, extra: Record<string, any> = {}) =>
    ({ id, type: 'PipeWire:Interface:Node', info: { props: { 'node.name': name, 'media.class': cls, ...extra } } });
  const objs = (md: any[] = []): PwObject[] => [
    node(1, 'chrome', 'Stream/Output/Audio'),
    node(2, 'bluez_output.x', 'Audio/Sink', { 'object.serial': 200 }),
    node(3, 'bluez_output.x.1', 'Audio/Sink/Internal'),
    node(4, 'alsa_output.analog', 'Audio/Sink', { 'object.serial': 400 }),
    node(5, 'mic', 'Audio/Source'),
    { id: 9, type: 'PipeWire:Interface:Link', info: { 'output-node-id': 1, 'output-port-id': 11, 'input-node-id': 4, 'input-port-id': 41 } },
    { id: 41, type: 'PipeWire:Interface:Metadata', props: { 'metadata.name': 'default' }, metadata: md },
  ];
  it('offers real sinks only, and finds the current link', () => {
    const m = buildModel(objs());
    const s = m.nodes.get(1)!;
    expect(targetChoices(s, m).map((n) => n.id)).toEqual([4, 2]);
    expect(nodeKind(m.nodes.get(4)!, m)).toEqual({ icon: 'speaker', kind: 'Virtuell' }); // no device object
    expect(linkedTarget(s, m)?.id).toBe(4);
    expect(pinnedTarget(s, m)).toBeUndefined();
  });
  it('resolves target.object by name or serial', () => {
    const md = (value: any) => [{ subject: 1, key: 'target.object', type: '', value }];
    expect(pinnedTarget(buildModel(objs(md('alsa_output.analog'))).nodes.get(1)!, buildModel(objs(md('alsa_output.analog'))))?.id).toBe(4);
    const m = buildModel(objs(md('200')));
    expect(pinnedTarget(m.nodes.get(1)!, m)?.id).toBe(2);
    const none = buildModel(objs(md(-1)));
    expect(pinnedTarget(none.nodes.get(1)!, none)).toBeUndefined();
  });
  it('sees a target the app chose itself, and lets metadata "-1" override it', () => {
    const own = (md: any[] = []) => objs(md).map((o) => (o.id === 1 ? node(1, 'chrome', 'Stream/Output/Audio', { 'target.object': 400 }) : o));
    const m = buildModel(own());
    expect(appPinned(m.nodes.get(1)!)).toBe(true);
    expect(pinnedTarget(m.nodes.get(1)!, m)?.id).toBe(4);
    expect(pinnedByApp(m.nodes.get(1)!, m)).toBe(true);
    const o = buildModel(own([{ subject: 1, key: 'target.object', type: '', value: '-1' }]));
    expect(pinnedTarget(o.nodes.get(1)!, o)).toBeUndefined();
    expect(pinnedByApp(o.nodes.get(1)!, o)).toBe(false);
  });
});
