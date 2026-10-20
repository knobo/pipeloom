// Pure helpers for the devices panel and inspector: friendly profile labels, grouping, icons.
import type { Device, Model, Node, Profile, Route } from '../model';
import { tr, type L } from '../i18n.svelte';

const CODECS: Record<string, string> = {
  sbc: 'SBC', sbc_xq: 'SBC-XQ', aac: 'AAC', aac_eld: 'AAC-ELD', aptx: 'aptX', aptx_hd: 'aptX HD',
  aptx_ll: 'aptX LL', aptx_ll_duplex: 'aptX LL Duplex', ldac: 'LDAC', lc3: 'LC3', lc3plus_hr: 'LC3plus HR',
  opus_05: 'Opus', opus_g: 'Opus', faststream: 'FastStream', msbc: 'mSBC', cvsd: 'CVSD', lc3_swb: 'LC3-SWB',
};
const prettyCodec = (c: string) => CODECS[c.toLowerCase().replace(/-/g, '_')] ?? c;

/** Bluetooth codec of a bluez profile. The description is authoritative: "a2dp-sink" alone is AAC on some devices. */
export function codecOf(p: Pick<Profile, 'name' | 'description'>): string | undefined {
  const m = /codec ([^)]+)\)/.exec(p.description ?? '');
  if (m) return prettyCodec(m[1]);
  const s = /^(?:a2dp-(?:sink|source)|headset-head-unit|headset-audio-gateway|bap-[a-z]+)-(.+)$/.exec(p.name);
  return s ? prettyCodec(s[1]) : undefined;
}

/** HSP/HFP profiles: mic works, but mono narrow-band audio on a shared SCO link. */
export const isHeadsetProfile = (p: Pick<Profile, 'name'>) => /^headset-/.test(p.name);

export function profileLabel(p: Pick<Profile, 'name' | 'description'>, api: string): string {
  if (p.name === 'off') return tr('Av', 'Off');
  if (p.name === 'pro-audio') return 'Pro Audio';
  if (api !== 'bluez5') return p.description || p.name;
  const c = codecOf(p), sfx = c ? ` – ${c}` : '';
  if (/^a2dp-sink/.test(p.name)) return `${tr('Høy kvalitet', 'High quality')}${sfx}`;
  if (/^headset-head-unit/.test(p.name)) return `${tr('Headset (mikrofon)', 'Headset (microphone)')}${sfx}`;
  if (/^a2dp-source/.test(p.name)) return `${tr('Mottaker (A2DP)', 'Receiver (A2DP)')}${sfx}`;
  if (/^headset-audio-gateway/.test(p.name)) return `${tr('Telefon-gateway', 'Phone gateway')}${sfx}`;
  if (/^bap-duplex/.test(p.name)) return `${tr('LE Audio (mikrofon)', 'LE Audio (microphone)')}${sfx}`;
  if (/^bap-/.test(p.name)) return `LE Audio${sfx}`;
  return p.description || p.name;
}

export type Group = 'outputs' | 'inputs' | 'bluetooth' | 'other';
export const GROUPS: Group[] = ['outputs', 'inputs', 'bluetooth', 'other'];
export const GROUP_TITLES: Record<Group, L> = {
  outputs: { no: 'Utganger', en: 'Outputs' }, inputs: { no: 'Innganger', en: 'Inputs' },
  bluetooth: { no: 'Bluetooth', en: 'Bluetooth' }, other: { no: 'Annet', en: 'Other' },
};

export function groupOf(d: Device, m: Model): Group {
  if (d.api === 'bluez5') return 'bluetooth';
  const ns = d.nodes.map((id) => m.nodes.get(id)).filter((n): n is Node => !!n);
  if (d.api === 'alsa' || ns.some((n) => /^Audio\//.test(n.mediaClass))) {
    if (ns.some((n) => n.role === 'sink') || d.routes.some((r) => r.direction === 'Output')) return 'outputs';
    if (ns.some((n) => n.role === 'source') || d.routes.some((r) => r.direction === 'Input')) return 'inputs';
  }
  return 'other';
}

export function groupDevices(m: Model): [Group, Device[]][] {
  const out = new Map<Group, Device[]>(GROUPS.map((g) => [g, []]));
  for (const d of m.devices.values()) out.get(groupOf(d, m))!.push(d);
  for (const ds of out.values()) ds.sort((a, b) => a.description.localeCompare(b.description));
  return [...out].filter(([, ds]) => ds.length > 0);
}

export type IconKind = 'speaker' | 'headphones' | 'mic' | 'bluetooth' | 'camera' | 'hdmi';

export function iconOf(d: Device, m: Model): IconKind {
  if (d.api === 'bluez5') return 'bluetooth';
  if (d.api === 'v4l2' || d.api === 'libcamera') return 'camera';
  const active = d.activeRoutes.find((r) => r.direction === 'Output');
  const text = `${d.description} ${d.icon ?? ''} ${active?.name ?? ''}`;
  if (/hdmi|displayport/i.test(text)) return 'hdmi';
  if (/head(phone|set)/i.test(text)) return 'headphones';
  return groupOf(d, m) === 'inputs' ? 'mic' : 'speaker';
}

/** Routes selectable for one direction: those belonging to the same profile-device as the active route. */
export function routeChoices(d: Device, direction: 'Input' | 'Output'): { active?: Route; choices: Route[] } {
  const active = d.activeRoutes.find((r) => r.direction === direction);
  const choices = d.routes.filter((r) => r.direction === direction && (active?.device === undefined || r.devices.includes(active.device)));
  return { active, choices };
}

/** "[ FL, FR ]" -> ["FL", "FR"] */
export const channelNames = (n: Node): string[] =>
  String(n.props['audio.position'] ?? '').replace(/[[\]\s]/g, '').split(',').filter(Boolean);

export const pct = (v: number) => `${Math.round(v * 100)} %`;

/** Fire-and-forget a backend command; the next snapshot shows the result. */
export const run = (p: Promise<unknown>) => void p.catch((e) => console.error('pipeloom:', e));
