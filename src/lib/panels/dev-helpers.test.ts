import { afterAll, describe, expect, it } from 'vitest';
import { buildModel, type PwObject } from '../model';
import dump from '../fixture.dump.json';
import { i18n, loc } from '../i18n.svelte';
import { GROUP_TITLES, channelNames, codecOf, groupDevices, iconOf, profileLabel, routeChoices } from './dev-helpers';

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
