// Two languages, text kept next to the code that uses it: tr('Graf', 'Graph').
// Reading i18n.lang inside tr() makes every call reactive in Svelte templates.
export type Lang = 'no' | 'en';
/** A text in both languages, for data tables (catalog entries etc.). */
export type L = { no: string; en: string };

const KEY = 'pipeloom.lang';
function detect(): Lang {
  try { const s = localStorage.getItem(KEY); if (s === 'no' || s === 'en') return s; } catch { /* storage unavailable */ }
  const nav = typeof navigator !== 'undefined' ? navigator.language : 'en';
  return /^(nb|nn|no)\b/i.test(nav) ? 'no' : 'en';
}

export const i18n = $state<{ lang: Lang }>({ lang: detect() });

export function setLang(l: Lang) {
  i18n.lang = l;
  try { localStorage.setItem(KEY, l); } catch { /* ignore */ }
  document.documentElement.lang = l === 'no' ? 'nb' : 'en';
}

export const tr = (no: string, en: string) => (i18n.lang === 'en' ? en : no);
export const loc = (x: L | string | undefined) => (x === undefined ? '' : typeof x === 'string' ? x : x[i18n.lang]);
