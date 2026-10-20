// @vitest-environment happy-dom
import { describe, expect, it, vi } from 'vitest';
import { flushSync, mount, unmount } from 'svelte';
import { buildModel, type PwObject } from '../model';
import dump from '../fixture.dump.json';

vi.mock('../api', () => ({
  setSetting: vi.fn(() => Promise.resolve()), resetSetting: vi.fn(() => Promise.resolve()),
  setMetadata: vi.fn(() => Promise.resolve()), deleteMetadata: vi.fn(() => Promise.resolve()),
}));
import * as api from '../api';
import SettingsPanel from './SettingsPanel.svelte';

const KEY = 'device.routes.mute-on-bluetooth-playback-removed';

describe('SettingsPanel bool switch', () => {
  it('click calls setSetting and flips the switch', () => {
    const target = document.createElement('div');
    document.body.append(target);
    const c = mount(SettingsPanel, { target, props: { model: buildModel(dump as PwObject[]), focusKey: null } });
    flushSync();
    const sw = target.querySelector<HTMLButtonElement>(`[data-id="${KEY}"] [role=switch]`)!;
    const before = sw.getAttribute('aria-checked');
    sw.click();
    flushSync();
    expect(api.setSetting).toHaveBeenCalledWith(KEY, before !== 'true', true);
    expect(target.querySelector(`[data-id="${KEY}"] [role=switch]`)!.getAttribute('aria-checked')).toBe(String(before !== 'true'));
    unmount(c);
  });
});
