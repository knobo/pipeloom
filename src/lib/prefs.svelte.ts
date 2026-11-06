// pipeloom's own preferences (not PipeWire's), kept in localStorage like the language and graph pins.
const KEY = 'pipeloom.prefs';
export const FILTER_KEY = 'pipeloom.apps-filter';

function load(): { rememberFilters: boolean } {
  try { return { rememberFilters: JSON.parse(localStorage.getItem(KEY) ?? '{}').rememberFilters !== false }; }
  catch { return { rememberFilters: true }; }
}

export const prefs = $state(load());

export function setRememberFilters(on: boolean) {
  prefs.rememberFilters = on;
  try {
    localStorage.setItem(KEY, JSON.stringify({ rememberFilters: on }));
    if (!on) localStorage.removeItem(FILTER_KEY); // off means forget, not just stop saving
  } catch { /* storage unavailable */ }
}
