import { ipcMain } from 'electron';
import db from '../db.js';

export function registerSettingsIpcHandlers(): void {
  ipcMain.handle('settings:get', async (_event, payload: unknown) => settingsGet(payload));
  ipcMain.handle('settings:upsert', async (_event, payload: unknown) => settingsUpsert(payload));
  ipcMain.handle('settings:delete', async (_event, payload: unknown) => settingsDelete(payload));
}

const stmtGet = db.prepare<[string], { json: string }>(`
  SELECT json
  FROM settings
  WHERE id = ?
`);

const stmtUpsert = db.prepare<[string, string]>(`
  INSERT INTO settings(id, json)
  VALUES (?, ?)
  ON CONFLICT(id)
  DO UPDATE SET json = excluded.json
`);

const stmtDelete = db.prepare<[string]>(`
  DELETE FROM settings
  WHERE id = ?
`);

function normalizeId(id: unknown): string {
  const v = (id ?? '').toString().trim();
  if (!v) throw new Error('settings: id is required');
  return v;
}

function settingsGet(payload: unknown): unknown {
  const settingId = normalizeId((payload as Record<string, unknown>)?.id);
  const row = stmtGet.get(settingId);

  if (!row?.json) return null;

  try {
    return JSON.parse(row.json);
  } catch {
    return null;
  }
}

function settingsUpsert(payload: unknown): { ok: true } {
  const p = payload as Record<string, unknown>;
  const settingId = normalizeId(p?.id);
  stmtUpsert.run(settingId, JSON.stringify(p?.value ?? null));
  return { ok: true };
}

function settingsDelete(payload: unknown): { ok: true } {
  const settingId = normalizeId((payload as Record<string, unknown>)?.id);
  stmtDelete.run(settingId);
  return { ok: true };
}

export function getInitialLanguage(): string {
  try {
    const row = stmtGet.get('GeneralSettingsService');
    if (!row?.json) return 'us';
    const settings = JSON.parse(row.json) as Record<string, unknown>;
    const lang = (settings?.language as Record<string, unknown>)?.language;
    return typeof lang === 'string' && lang ? lang : 'us';
  } catch {
    return 'us';
  }
}

export function getStartupSettings(): { openAtLogin: boolean; startMinimized: boolean } {
  try {
    const row = stmtGet.get('GeneralSettingsService');
    if (!row?.json) return { openAtLogin: false, startMinimized: false };
    const settings = JSON.parse(row.json) as Record<string, unknown>;
    const startup = settings?.startup as Record<string, unknown> | undefined;
    return {
      openAtLogin: !!startup?.openAtLogin,
      startMinimized: !!startup?.startMinimized,
    };
  } catch {
    return { openAtLogin: false, startMinimized: false };
  }
}
