import { ipcMain } from 'electron';
import { notify } from '../notification.js';

function asShortString(v, maxLen) {
  if (typeof v !== 'string') return null;
  const s = v.trim();
  if (!s) return null;
  return s.length > maxLen ? s.slice(0, maxLen) : s;
}

function asPlainObject(v) {
  return v && typeof v === 'object' && !Array.isArray(v) ? v : null;
}

export function registerNotificationIpcHandlers() {
  ipcMain.handle('notification:show', async (_event, payload) => {
    const p = asPlainObject(payload) ?? {};

    const title = asShortString(p.title, 120);
    const body = asShortString(p.body, 600);

    if (!title) {
      return { ok: false, error: 'Missing title' };
    }

    const opts = asPlainObject(p.options) ?? undefined;

    const n = notify(title, body ?? '', opts);

    return { ok: true, shown: !!n };
  });
}
