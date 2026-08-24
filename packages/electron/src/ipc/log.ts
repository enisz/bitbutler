import { ipcMain } from 'electron';
import { insertLog } from '../logger.js';

const VALID_LEVELS = ['debug', 'info', 'warn', 'error'] as const;
type LevelStr = (typeof VALID_LEVELS)[number];

function asNullableString(v: unknown, maxLen: number): string | null {
  if (typeof v !== 'string' || !v) return null;
  return v.length > maxLen ? v.slice(0, maxLen) : v;
}

function asNullableInt(v: unknown): number | null {
  return typeof v === 'number' && Number.isInteger(v) ? v : null;
}

export function registerLogIpcHandlers(): void {
  ipcMain.on('log:write', (_event, entry: unknown) => {
    const e = entry && typeof entry === 'object' ? (entry as Record<string, unknown>) : {};
    const level = VALID_LEVELS.includes(e['level'] as LevelStr) ? (e['level'] as LevelStr) : null;
    const message = asNullableString(e['message'], 2000);
    if (!level || !message) return;

    insertLog(
      'renderer',
      level,
      message,
      asNullableString(e['context'], 20000),
      asNullableString(e['filename'], 500),
      asNullableInt(e['line']),
    );
  });
}
