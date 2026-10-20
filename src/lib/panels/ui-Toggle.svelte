<script lang="ts">
  let { checked, onchange, label, disabled = false }: {
    checked: boolean; onchange: (v: boolean) => void; label: string; disabled?: boolean;
  } = $props();
</script>

<button
  type="button" role="switch" aria-checked={checked} aria-label={label} title={label} {disabled}
  class="toggle" class:on={checked} onclick={() => onchange(!checked)}
><span></span></button>

<style>
  .toggle {
    width: 36px; height: 20px; padding: 0; border-radius: 10px; border: 1px solid var(--border);
    background: var(--bg-elev-2); position: relative; cursor: pointer; flex: none; transition: background 0.15s;
  }
  .toggle span {
    position: absolute; top: 2px; left: 2px; width: 14px; height: 14px; border-radius: 50%;
    background: var(--text-dim); transition: transform 0.15s, background 0.15s;
  }
  .toggle.on { background: color-mix(in srgb, var(--accent) 35%, var(--bg-elev-2)); border-color: var(--accent); }
  .toggle.on span { transform: translateX(16px); background: var(--accent); }
  .toggle:disabled { opacity: 0.4; cursor: default; }
  @media (prefers-reduced-motion: reduce) { .toggle, .toggle span { transition: none; } }
</style>
