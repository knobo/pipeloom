<script lang="ts">
  import type { Device } from '../model';
  import { setProfile, setRoute } from '../api';
  import { tr } from '../i18n.svelte';
  import { isHeadsetProfile, profileLabel, routeChoices, run } from './dev-helpers';

  let { device }: { device: Device } = $props();
  const current = $derived(device.profiles.find((p) => p.index === device.profile));
  const bt = $derived(device.api === 'bluez5');
  const hasHeadset = $derived(bt && device.profiles.some(isHeadsetProfile));
  const routeSets = $derived(
    (['Output', 'Input'] as const).map((dir) => ({ dir, ...routeChoices(device, dir) })).filter((r) => r.choices.length > 1),
  );
</script>

{#if device.profiles.length > 1}
  <label class="field">
    <span>{bt ? tr('Modus / kodek', 'Mode / codec') : tr('Profil', 'Profile')}</span>
    <select value={device.profile} onchange={(e) => run(setProfile(device.id, +e.currentTarget.value))}>
      {#each device.profiles as p (p.index)}
        <option value={p.index} disabled={p.available === 'no' && p.index !== device.profile}>
          {profileLabel(p, device.api)}{p.available === 'no' ? tr(' (utilgjengelig)', ' (unavailable)') : ''}
        </option>
      {/each}
    </select>
  </label>
  {#if hasHeadset}
    <p class="hint" class:warn={current && isHeadsetProfile(current)}>
      {tr('Headset-modus gir mikrofon, men mono lav kvalitet – og den tar Bluetooth-båndbredde, så lyden kan hakke og BT-mus/tastatur bli treg.',
        'Headset mode enables the microphone, but in low-quality mono – and it uses Bluetooth bandwidth, so audio may stutter and BT mice/keyboards may lag.')}
    </p>
  {/if}
{/if}

{#each routeSets as r (r.dir)}
  <label class="field">
    <span>{r.dir === 'Output' ? tr('Utgang', 'Output') : tr('Inngang', 'Input')}</span>
    <select value={r.active?.index}
      onchange={(e) => {
        const idx = +e.currentTarget.value;
        const route = r.choices.find((x) => x.index === idx);
        const dev = r.active?.device ?? route?.devices[0];
        if (dev !== undefined) run(setRoute(device.id, idx, dev));
      }}>
      {#each r.choices as c (c.index)}
        <option value={c.index}>{c.description}{c.available === 'no' ? tr(' (ikke tilkoblet)', ' (not connected)') : ''}</option>
      {/each}
    </select>
  </label>
{/each}

<style>
  .field { display: flex; align-items: center; gap: 10px; font-size: 13px; }
  .field span { color: var(--text-dim); min-width: 90px; }
  select {
    flex: 1; min-width: 0; background: var(--bg-elev-2); border: 1px solid var(--border); border-radius: 8px; padding: 5px 8px; cursor: pointer;
  }
  .hint { margin: 0; font-size: 12px; color: var(--text-dim); }
  .hint.warn { color: var(--warn); }
</style>
