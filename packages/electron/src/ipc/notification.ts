import { ipcMain } from 'electron';
import { notify } from '../notification.js';

function asShortString(v: unknown, maxLen: number): string | null {
  if (typeof v !== 'string') return null;
  const s = v.trim();
  if (!s) return null;
  return s.length > maxLen ? s.slice(0, maxLen) : s;
}

function asPlainObject(v: unknown): Record<string, unknown> | null {
  return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
}

export function registerNotificationIpcHandlers(): void {
  ipcMain.handle('notification:show', async (_event, payload: unknown) => {
    const p = asPlainObject(payload) ?? {};

    const title = asShortString(p['title'], 120);
    const body = asShortString(p['body'], 600);

    if (!title) {
      return { ok: false, error: 'Missing title' };
    }

    const opts = asPlainObject(p['options']) as { silent?: boolean } | undefined;

    const n = notify(title, body ?? '', opts);

    return { ok: true, shown: !!n };
  });
}
