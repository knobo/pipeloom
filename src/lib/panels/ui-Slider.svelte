<script lang="ts">
  // Volume-style slider. Native range input for keyboard/a11y; local value while the user is
  // interacting so incoming snapshots don't yank the thumb; throttled onchange.
  import { tr } from '../i18n.svelte';
  let {
    value, onchange, label, min = 0, max = 1.5, step = 0.01, reset = 1, big = false, disabled = false,
  }: {
    value: number; onchange: (v: number) => void; label: string;
    min?: number; max?: number; step?: number; reset?: number; big?: boolean; disabled?: boolean;
  } = $props();

  let local = $state<number | null>(null);
  const shown = $derived(local ?? value);
  let el: HTMLInputElement;
  let lastSent = 0, pending: ReturnType<typeof setTimeout> | undefined, release: ReturnType<typeof setTimeout> | undefined;

  function set(v: number, final = false) {
    v = Math.min(max, Math.max(min, Math.round(v / step) * step));
    local = v;
    clearTimeout(pending);
    const wait = 30 - (Date.now() - lastSent);
    if (final || wait <= 0) { lastSent = Date.now(); onchange(v); }
    else pending = setTimeout(() => { lastSent = Date.now(); onchange(v); }, wait);
    // hold the local value until the backend's snapshot has had time to catch up
    clearTimeout(release);
    release = setTimeout(() => (local = null), 600);
  }

  $effect(() => {
    // wheel must be non-passive to stop the page scrolling
    const wheel = (e: WheelEvent) => {
      if (disabled) return;
      e.preventDefault();
      set(shown + (e.deltaY < 0 ? 1 : -1) * 0.02);
    };
    el.addEventListener('wheel', wheel, { passive: false });
    return () => el.removeEventListener('wheel', wheel);
  });

  const fill = $derived(((shown - min) / (max - min)) * 100);
  const resetMark = $derived(((reset - min) / (max - min)) * 100);
</script>

<div class="slider" class:big class:over={shown > reset + 1e-6}>
  <input
    bind:this={el}
    type="range" {min} {max} {step} {disabled}
    value={shown}
    aria-label={label}
    aria-valuetext={`${Math.round(shown * 100)} %`}
    title={tr('Dobbeltklikk: 100 %', 'Double-click: 100 %')}
    style:--fill="{fill}%"
    style:--mark="{resetMark}%"
    oninput={(e) => set(+e.currentTarget.value)}
    onchange={(e) => set(+e.currentTarget.value, true)}
    ondblclick={() => set(reset, true)}
  />
  <output>{Math.round(shown * 100)} %</output>
</div>

<style>
  .slider { display: flex; align-items: center; gap: 10px; min-width: 0; flex: 1; }
  output { font: 12px var(--mono); color: var(--text-dim); min-width: 4.5ch; text-align: right; font-variant-numeric: tabular-nums; }
  .over output { color: var(--warn); }
  input {
    flex: 1; min-width: 60px; appearance: none; background: none; height: 20px; margin: 0; cursor: pointer;
  }
  input:disabled { opacity: 0.4; cursor: default; }
  input::-webkit-slider-runnable-track {
    height: 6px; border-radius: 3px;
    background:
      linear-gradient(90deg, transparent calc(var(--mark) - 1px), var(--text-dim) calc(var(--mark) - 1px), var(--text-dim) calc(var(--mark) + 1px), transparent calc(var(--mark) + 1px)),
      linear-gradient(90deg, var(--accent) var(--fill), var(--bg-elev-2) var(--fill));
    border: 1px solid var(--border);
  }
  .over input::-webkit-slider-runnable-track {
    background:
      linear-gradient(90deg, var(--accent) var(--mark), var(--warn) var(--mark), var(--warn) var(--fill), var(--bg-elev-2) var(--fill));
  }
  input::-webkit-slider-thumb {
    appearance: none; width: 16px; height: 16px; margin-top: -6px; border-radius: 50%;
    background: var(--text); border: 2px solid var(--accent); box-shadow: 0 1px 4px rgb(0 0 0 / 0.4);
    transition: transform 0.1s;
  }
  input:active::-webkit-slider-thumb { transform: scale(1.15); }
  .big input { height: 28px; }
  .big input::-webkit-slider-runnable-track { height: 10px; border-radius: 5px; }
  .big input::-webkit-slider-thumb { width: 22px; height: 22px; margin-top: -7px; }
  .big output { font-size: 14px; color: var(--text); }
  /* Firefox (dev in browser) */
  input::-moz-range-track { height: 6px; border-radius: 3px; background: var(--bg-elev-2); border: 1px solid var(--border); }
  input::-moz-range-progress { height: 6px; border-radius: 3px; background: var(--accent); }
  input::-moz-range-thumb { width: 14px; height: 14px; border-radius: 50%; background: var(--text); border: 2px solid var(--accent); }
  @media (prefers-reduced-motion: reduce) { input::-webkit-slider-thumb { transition: none; } }
</style>
