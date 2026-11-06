// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest';

describe('prefs', () => {
  beforeEach(() => { localStorage.clear(); vi.resetModules(); });
  it('remembers filters by default, and turning it off forgets the saved filter', async () => {
    const { prefs, setRememberFilters, FILTER_KEY } = await import('./prefs.svelte');
    expect(prefs.rememberFilters).toBe(true);
    localStorage.setItem(FILTER_KEY, '{"kind":"app-in"}');
    setRememberFilters(false);
    expect(localStorage.getItem(FILTER_KEY)).toBeNull();
    vi.resetModules();
    expect((await import('./prefs.svelte')).prefs.rememberFilters).toBe(false); // survives a restart
  });
});
