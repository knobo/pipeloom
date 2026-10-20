// Turns raw pw-dump objects into the shape the UI works with. Pure, no Tauri imports.

export interface MetaEntry { subject: number; key: string; type: string; value: any }
export interface PwObject {
  id: number;
  type: string; // e.g. "PipeWire:Interface:Node"
  info?: { props?: Record<string, any>; params?: Record<string, any[]>; [k: string]: any } | null;
  props?: Record<string, any>; // Metadata objects keep props here
  metadata?: MetaEntry[] | null;
}

/** Where a node belongs in the left→right flow. */
export type Role = 'source' | 'sink' | 'filter' | 'app-out' | 'app-in' | 'other';

export interface Port {
  id: number; nodeId: number; name: string; alias: string;
  dir: 'in' | 'out'; channel: string; monitor: boolean; physical: boolean;
  media: 'audio' | 'midi' | 'video' | 'other';
}
export interface Node {
  id: number; name: string; label: string; mediaClass: string; role: Role;
  deviceId?: number; clientId?: number; app?: string; icon?: string; state: string;
  inputs: Port[]; outputs: Port[];
  volume?: number; mute?: boolean; channelVolumes?: number[];
  /** isDefault: what WirePlumber actually uses. isConfiguredDefault: what the user picked (may be unavailable). */
  isDefault: boolean; isConfiguredDefault: boolean; props: Record<string, any>;
}
export interface Link { id: number; outNode: number; outPort: number; inNode: number; inPort: number; state: string }
export interface Profile { index: number; name: string; description: string; available: string; priority: number }
export interface Route { index: number; name: string; description: string; direction: string; available: string; devices: number[]; device?: number }
export interface Device {
  id: number; name: string; description: string; api: string; bus?: string; icon?: string;
  profiles: Profile[]; profile?: number; routes: Route[]; activeRoutes: Route[];
  nodes: number[]; props: Record<string, any>;
}
export interface Setting {
  key: string; name: string; description: string;
  type: string; // 'bool' | 'int' | 'float' | 'string' | 'array' | 'object' as given by the schema
  default: any; min?: number; max?: number; value: any; saved?: any; isSaved: boolean;
}
export interface Metadata { id: number; name: string; entries: MetaEntry[] }
export interface Model {
  nodes: Map<number, Node>; links: Link[]; devices: Map<number, Device>;
  clients: Map<number, Record<string, any>>; settings: Setting[];
  metadata: Map<string, Metadata>; defaults: Record<string, string>; // e.g. 'default.audio.sink' -> node.name
}

const kind = (o: PwObject) => o.type.split(':').pop();

function roleOf(mediaClass: string, nIn: number, nOut: number): Role {
  if (/^Stream\/Output/.test(mediaClass)) return 'app-out';
  if (/^Stream\/Input/.test(mediaClass)) return 'app-in';
  if (/Source|Video\/Source|Midi\/Bridge/.test(mediaClass) && nIn === 0) return 'source';
  if (/Sink/.test(mediaClass)) return 'sink';
  if (/Duplex|Filter/.test(mediaClass) || (nIn > 0 && nOut > 0)) return 'filter';
  if (nOut > 0 && nIn === 0) return 'source';
  if (nIn > 0 && nOut === 0) return 'sink';
  return 'other';
}

function mediaOf(p: Record<string, any>): Port['media'] {
  const f = String(p['format.dsp'] ?? '');
  if (/midi/i.test(f)) return 'midi';
  if (/audio/i.test(f)) return 'audio';
  if (/video/i.test(f) || p['port.name']?.startsWith('video')) return 'video';
  return 'other';
}

const firstParam = (o: PwObject, k: string) => o.info?.params?.[k]?.[0];

export function buildModel(objects: PwObject[]): Model {
  const metadata = new Map<string, Metadata>();
  for (const o of objects) {
    if (kind(o) !== 'Metadata') continue;
    const name = o.props?.['metadata.name'] ?? String(o.id);
    metadata.set(name, { id: o.id, name, entries: o.metadata ?? [] });
  }
  const defaults: Record<string, string> = {};
  for (const e of metadata.get('default')?.entries ?? []) defaults[e.key] = e.value?.name ?? e.value;
  const defaultNames = new Set(Object.entries(defaults).filter(([k]) => !k.startsWith('default.configured.')).map(([, v]) => v));
  const configuredNames = new Set(Object.entries(defaults).filter(([k]) => k.startsWith('default.configured.')).map(([, v]) => v));

  const ports: Port[] = objects.filter((o) => kind(o) === 'Port').map((o) => {
    const p = o.info?.props ?? {};
    return {
      id: o.id, nodeId: p['node.id'], name: p['port.name'] ?? '', alias: p['port.alias'] ?? p['port.name'] ?? '',
      dir: o.info?.direction === 'input' ? 'in' : 'out', channel: p['audio.channel'] ?? '',
      monitor: !!p['port.monitor'], physical: !!p['port.physical'], media: mediaOf(p),
    };
  });

  const clients = new Map<number, Record<string, any>>();
  for (const o of objects) if (kind(o) === 'Client') clients.set(o.id, o.info?.props ?? {});

  const nodes = new Map<number, Node>();
  for (const o of objects) {
    if (kind(o) !== 'Node') continue;
    const p = o.info?.props ?? {};
    const mine = ports.filter((x) => x.nodeId === o.id);
    const inputs = mine.filter((x) => x.dir === 'in'), outputs = mine.filter((x) => x.dir === 'out');
    const mediaClass = p['media.class'] ?? '';
    const vp = (o.info?.params?.Props ?? []).find((x: any) => x?.channelVolumes);
    const cv: number[] | undefined = vp?.channelVolumes;
    const name = p['node.name'] ?? `node-${o.id}`;
    nodes.set(o.id, {
      id: o.id, name, mediaClass,
      label: p['node.description'] ?? p['node.nick'] ?? p['application.name'] ?? name,
      role: roleOf(mediaClass, inputs.length, outputs.length),
      deviceId: p['device.id'], clientId: p['client.id'],
      app: p['application.name'] ?? clients.get(p['client.id'])?.['application.name'],
      icon: p['device.icon-name'] ?? p['application.icon-name'],
      state: o.info?.state ?? 'unknown', inputs, outputs,
      // wpctl shows volume on a cubic scale
      volume: cv?.length ? Math.cbrt(cv.reduce((a, b) => a + b, 0) / cv.length) : undefined,
      mute: vp?.mute, channelVolumes: cv?.map(Math.cbrt),
      isDefault: defaultNames.has(name), isConfiguredDefault: configuredNames.has(name), props: p,
    });
  }

  const links: Link[] = objects.filter((o) => kind(o) === 'Link').map((o) => ({
    id: o.id, outNode: o.info?.['output-node-id'], outPort: o.info?.['output-port-id'],
    inNode: o.info?.['input-node-id'], inPort: o.info?.['input-port-id'], state: o.info?.state ?? '',
  }));

  const devices = new Map<number, Device>();
  for (const o of objects) {
    if (kind(o) !== 'Device') continue;
    const p = o.info?.props ?? {}, pa = o.info?.params ?? {};
    const route = (r: any): Route => ({
      index: r.index, name: r.name, description: r.description, direction: r.direction,
      available: r.available, devices: r.devices ?? [], device: r.device,
    });
    devices.set(o.id, {
      id: o.id, name: p['device.name'] ?? '', description: p['device.description'] ?? p['device.nick'] ?? p['device.name'] ?? '',
      api: p['device.api'] ?? '', bus: p['device.bus'], icon: p['device.icon-name'],
      profiles: (pa.EnumProfile ?? []).map((x: any) => ({
        index: x.index, name: x.name, description: x.description, available: x.available, priority: x.priority,
      })),
      profile: firstParam(o, 'Profile')?.index,
      routes: (pa.EnumRoute ?? []).map(route), activeRoutes: (pa.Route ?? []).map(route),
      nodes: [...nodes.values()].filter((n) => n.deviceId === o.id).map((n) => n.id), props: p,
    });
  }

  const value = new Map((metadata.get('sm-settings')?.entries ?? []).map((e) => [e.key, e.value]));
  const saved = new Map((metadata.get('persistent-sm-settings')?.entries ?? []).map((e) => [e.key, e.value]));
  const settings: Setting[] = (metadata.get('schema-sm-settings')?.entries ?? []).map((e) => ({
    key: e.key, name: e.value?.name ?? e.key, description: e.value?.description ?? '',
    type: e.value?.type ?? 'string', default: e.value?.default, min: e.value?.min, max: e.value?.max,
    value: value.has(e.key) ? value.get(e.key) : e.value?.default,
    saved: saved.get(e.key), isSaved: saved.has(e.key),
  })).sort((a, b) => a.key.localeCompare(b.key));

  return { nodes, links, devices, clients, settings, metadata, defaults };
}
