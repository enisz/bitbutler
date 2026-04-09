import { ipcMain } from 'electron';
import db from '../db.js';

export function registerSettingsIpcHandlers() {
  ipcMain.handle('settings:get', async (_event, payload) => settingsGet(payload));
  ipcMain.handle('settings:upsert', async (_event, payload) => settingsUpsert(payload));
  ipcMain.handle('settings:delete', async (_event, payload) => settingsDelete(payload));
}

const stmtGet = db.prepare(`
  SELECT json
  FROM settings
  WHERE id = ?
`);

const stmtUpsert = db.prepare(`
  INSERT INTO settings(id, json)
  VALUES (?, ?)
  ON CONFLICT(id)
  DO UPDATE SET json = excluded.json
`);

const stmtDelete = db.prepare(`
  DELETE FROM settings
  WHERE id = ?
`);

function normalizeId(id) {
  const v = (id ?? '').toString().trim();
  if (!v) throw new Error('settings: id is required');
  return v;
}

function settingsGet(payload = {}) {
  const settingId = normalizeId(payload.id);
  const row = stmtGet.get(settingId);

  if (!row?.json) return null;

  try {
    return JSON.parse(row.json);
  } catch {
    return null;
  }
}

function settingsUpsert(payload = {}) {
  const settingId = normalizeId(payload.id);
  stmtUpsert.run(settingId, JSON.stringify(payload.value ?? null));
  return { ok: true };
}

function settingsDelete(payload = {}) {
  const settingId = normalizeId(payload.id);
  stmtDelete.run(settingId);
  return { ok: true };
}
