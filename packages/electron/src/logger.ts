import { type BrowserWindow, app } from 'electron';
import log from 'electron-log/main';
import { existsSync, renameSync, statSync, unlinkSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import { format as utilFormat } from 'node:util';

type LevelStr = 'debug' | 'info' | 'warn' | 'error';

const CONSOLE_TO_LEVEL: Record<string, LevelStr> = {
  log: 'debug',
  debug: 'debug',
  info: 'info',
  warn: 'warn',
  error: 'error',
};

const MAX_SIZE = 10 * 1024 * 1024;
const MAX_ARCHIVES = 3;

export function formatTimestamp(date: Date): string {
  const pad = (n: number, len = 2): string => String(n).padStart(len, '0');
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ` +
    `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}.${pad(date.getMilliseconds(), 3)}`
  );
}

export function archiveLog(logFilePath: string): void {
  const dir = dirname(logFilePath);
  const stem = basename(logFilePath, '.log');

  for (let i = MAX_ARCHIVES - 1; i >= 0; i--) {
    const archivePath = join(dir, `${stem}.old.${i}.log`);
    if (existsSync(archivePath)) {
      if (i === MAX_ARCHIVES - 1) {
        unlinkSync(archivePath);
      } else {
        renameSync(archivePath, join(dir, `${stem}.old.${i + 1}.log`));
      }
    }
  }

  renameSync(logFilePath, join(dir, `${stem}.old.0.log`));
}

export function initLogger(): void {
  const logPath = join(app.getPath('logs'), 'bitbutler.log');

  if (existsSync(logPath) && statSync(logPath).size >= MAX_SIZE) {
    archiveLog(logPath);
  }

  log.transports.console.level = false;
  log.transports.file.resolvePathFn = () => logPath;
  log.transports.file.maxSize = MAX_SIZE;
  log.transports.file.archiveLog = (file) => archiveLog(file.toString());
  log.transports.file.format = ({ message }) => [
    `[${formatTimestamp(message.date)}] ${utilFormat(...message.data)}`,
  ];

  for (const [method, levelStr] of Object.entries(CONSOLE_TO_LEVEL)) {
    const original = (console as unknown as Record<string, unknown>)[method] as (
      ...args: unknown[]
    ) => void;
    (console as unknown as Record<string, unknown>)[method] = (...args: unknown[]): void => {
      original.call(console, ...args);
      log.info(`[main] [${levelStr}]`, ...args);
    };
  }

  process.on('uncaughtException', (error: Error) => {
    log.info(`[main] [error] Uncaught exception: ${error.stack ?? error.message}`);
    throw error;
  });

  process.on('unhandledRejection', (reason: unknown) => {
    const msg = reason instanceof Error ? (reason.stack ?? reason.message) : String(reason);
    log.info(`[main] [error] Unhandled rejection: ${msg}`);
  });
}

export function hookRenderer(window: BrowserWindow): void {
  window.webContents.on('console-message', (details) => {
    const levelStr: LevelStr = (details.level === 'warning' ? 'warn' : details.level) as LevelStr;
    log.info(
      `[renderer] [${levelStr}] ${details.message} (${details.sourceId}:${details.lineNumber})`,
    );
  });
}

export { log };
