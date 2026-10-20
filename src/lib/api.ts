// Contract between the Svelte UI and the Rust backend (src-tauri/src/main.rs).
// The backend streams raw `pw-dump` objects; every mutation goes through a typed command.
import { invoke } from '@tauri-apps/api/core';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import type { PwObject } from './model';

/** Full, current pw-dump object list. Emitted on every (debounced) change. */
export const SNAPSHOT_EVENT = 'pw-snapshot';

export const onSnapshot = (cb: (objs: PwObject[]) => void): Promise<UnlistenFn> =>
  listen<PwObject[]>(SNAPSHOT_EVENT, (e) => cb(e.payload));

export const getSnapshot = () => invoke<PwObject[]>('get_snapshot');

/** `wpctl settings [--save] key value`. value is JSON-encoded by the backend. */
export const setSetting = (key: string, value: unknown, save: boolean) =>
  invoke<void>('set_setting', { key, value, save });
/** `wpctl settings --reset key` (back to schema default, removes the saved value). */
export const resetSetting = (key: string) => invoke<void>('reset_setting', { key });

/** `pw-link <outPort> <inPort>` (port ids). */
export const link = (outPort: number, inPort: number) => invoke<void>('link', { outPort, inPort });
/** `pw-link -d <linkId>` */
export const unlink = (linkId: number) => invoke<void>('unlink', { linkId });

/** `wpctl set-volume <id> <volume>`; volume uses wpctl's cubic scale, 1.0 = 100 %. */
export const setVolume = (id: number, volume: number) => invoke<void>('set_volume', { id, volume });
export const setMute = (id: number, mute: boolean) => invoke<void>('set_mute', { id, mute });
/** `wpctl set-default <nodeId>` */
export const setDefault = (id: number) => invoke<void>('set_default', { id });
/** `wpctl set-profile <deviceId> <profileIndex>` */
export const setProfile = (deviceId: number, index: number) =>
  invoke<void>('set_profile', { deviceId, index });
/** `pw-cli s <deviceId> Route { index, device, save: true }` */
export const setRoute = (deviceId: number, index: number, device: number) =>
  invoke<void>('set_route', { deviceId, index, device });

/** `pw-metadata -n <name> <subject> <key> <value> [type]`; value is sent verbatim as a string. */
export const setMetadata = (name: string, subject: number, key: string, value: string, type?: string) =>
  invoke<void>('set_metadata', { name, subject, key, value, type: type ?? null });
/** `pw-metadata -n <name> -d <subject> <key>` */
export const deleteMetadata = (name: string, subject: number, key: string) =>
  invoke<void>('delete_metadata', { name, subject, key });
