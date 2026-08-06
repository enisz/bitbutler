import { type BrowserWindow } from 'electron';
import { format as utilFormat } from 'node:util';
import db from './db.js';

type LevelStr = 'debug' | 'info' | 'warn' | 'error';
type ProcessName = 'main' | 'renderer';

const CONSOLE_TO_LEVEL: Record<string, LevelStr> = {
  log: 'debug',
  debug: 'debug',
  info: 'info',
  warn: 'warn',
  error: 'error',
};

const stmtInsertLog = db.prepare<[number, ProcessName, LevelStr, string]>(`
  INSERT INTO logs (timestamp, process, level, message)
  VALUES (?, ?, ?, ?)
`);

function insertLog(processName: ProcessName, level: LevelStr, message: string): void {
  try {
    stmtInsertLog.run(Date.now(), processName, level, message);
  } catch (error) {
    process.stderr.write(
      `[logger] failed to write log row: ${error instanceof Error ? error.message : String(error)}\n`,
    );
  }
}

export function initLogger(): void {
  for (const [method, levelStr] of Object.entries(CONSOLE_TO_LEVEL)) {
    const original = (console as unknown as Record<string, unknown>)[method] as (
      ...args: unknown[]
    ) => void;
    (console as unknown as Record<string, unknown>)[method] = (...args: unknown[]): void => {
      original.call(console, ...args);
      insertLog('main', levelStr, utilFormat(...args));
    };
  }

  process.on('uncaughtException', (error: Error) => {
    insertLog('main', 'error', `Uncaught exception: ${error.stack ?? error.message}`);
    throw error;
  });

  process.on('unhandledRejection', (reason: unknown) => {
    const msg = reason instanceof Error ? (reason.stack ?? reason.message) : String(reason);
    insertLog('main', 'error', `Unhandled rejection: ${msg}`);
  });
}

export function hookRenderer(window: BrowserWindow): void {
  window.webContents.on('console-message', (details) => {
    const levelStr: LevelStr = (details.level === 'warning' ? 'warn' : details.level) as LevelStr;
    insertLog(
      'renderer',
      levelStr,
      `${details.message} (${details.sourceId}:${details.lineNumber})`,
    );
  });
}
