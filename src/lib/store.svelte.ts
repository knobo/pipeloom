// Single reactive source of truth for the UI. Components read `pw.model`.
import { invoke } from '@tauri-apps/api/core';
import { getSnapshot, onSnapshot } from './api';
import { buildModel, type Model, type PwObject } from './model';

export const pw = $state<{ objects: PwObject[]; model: Model; error?: string }>({
  objects: [], model: buildModel([]),
});

function apply(objs: PwObject[]) {
  pw.objects = objs;
  pw.model = buildModel(objs);
}

function report(msg: string) {
  pw.error = msg;
  invoke('ui_log', { msg }).catch(() => {});
}

export async function startStore() {
  addEventListener('error', (e) => report(`${e.message} @ ${e.filename}:${e.lineno}`));
  addEventListener('unhandledrejection', (e) => report(`Unhandled: ${e.reason?.stack ?? e.reason}`));
  const origErr = console.error;
  console.error = (...a) => { origErr(...a); report(a.map(String).join(' ')); };
  await onSnapshot(apply);
  try { apply(await getSnapshot()); } catch (e) { pw.error = String(e); }
}
