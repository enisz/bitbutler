import type { LogEntry } from '@bitbutler/shared';
import { ipcMain } from 'electron';
import db from '../db.js';
import { insertLog } from '../logger.js';
import { resolveOriginalLocation } from '../source-map-resolver.js';

const VALID_LEVELS = ['debug', 'info', 'warn', 'error'] as const;
type LevelStr = (typeof VALID_LEVELS)[number];

interface LogRow {
  id: number;
  timestamp: number;
  process: 'main' | 'renderer';
  level: LevelStr;
  message: string;
  context: string | null;
  filename: string | null;
  line: number | null;
}

const stmtList = db.prepare<[], LogRow>('SELECT * FROM logs');
const stmtClear = db.prepare('DELETE FROM logs');

function asNullableString(v: unknown, maxLen: number): string | null {
  if (typeof v !== 'string' || !v) return null;
  return v.length > maxLen ? v.slice(0, maxLen) : v;
}

function asNullableInt(v: unknown): number | null {
  return typeof v === 'number' && Number.isInteger(v) ? v : null;
}

export function registerLogIpcHandlers(): void {
  ipcMain.handle('log:list', async () => logList());
  ipcMain.handle('log:clear', async () => logClear());

  ipcMain.on('log:write', (_event, entry: unknown) => {
    const e = entry && typeof entry === 'object' ? (entry as Record<string, unknown>) : {};
    const level = VALID_LEVELS.includes(e['level'] as LevelStr) ? (e['level'] as LevelStr) : null;
    const message = asNullableString(e['message'], 2000);
    if (!level || !message) return;

    const filename = asNullableString(e['filename'], 500);
    const line = asNullableInt(e['line']);
    const column = asNullableInt(e['column']);
    const resolved =
      filename !== null && line !== null && column !== null
        ? resolveOriginalLocation(filename, line, column, 'app')
        : null;

    insertLog(
      'renderer',
      level,
      message,
      asNullableString(e['context'], 20000),
      resolved ? asNullableString(resolved.filename, 500) : filename,
      resolved?.line ?? line,
    );
  });
}

function logList(): LogEntry[] {
  return stmtList.all().map((row) => ({ ...row, timestamp: Math.floor(row.timestamp / 1000) }));
}

function logClear(): { ok: true } {
  stmtClear.run();
  return { ok: true };
}
