import log from 'electron-log/main';
import fs from 'node:fs';
import path from 'node:path';
import { format as utilFormat } from 'node:util';
import { resolveOriginalLocation } from './source-map-resolver.js';

export type LevelStr = 'debug' | 'info' | 'warn' | 'error';
export type ProcessName = 'main' | 'renderer';

export const MAX_LOG_FILE_SIZE = 5 * 1024 * 1024;
export const ROLLED_LOG_FILES = 4;

const CONSOLE_TO_LEVEL: Record<string, LevelStr> = {
  log: 'debug',
  debug: 'debug',
  info: 'info',
  warn: 'warn',
  error: 'error',
};

/**
 * Shifts `<name>.log` -> `<name>.1.log` -> ... -> `<name>.<rolledFiles>.log`, dropping the
 * oldest. electron-log only keeps a single `.old.log` by default.
 */
export function rotateLogFile(filePath: string, rolledFiles = ROLLED_LOG_FILES): void {
  const { dir, name, ext } = path.parse(filePath);
  const rolled = (n: number): string => path.join(dir, `${name}.${n}${ext}`);

  fs.rmSync(rolled(rolledFiles), { force: true });
  for (let n = rolledFiles - 1; n >= 1; n--) {
    if (fs.existsSync(rolled(n))) fs.renameSync(rolled(n), rolled(n + 1));
  }
  fs.renameSync(filePath, rolled(1));
}

type ElectronLogger = typeof log;

function configure(logger: ElectronLogger, fileName: string): ElectronLogger {
  logger.transports.file.fileName = fileName;
  logger.transports.file.maxSize = MAX_LOG_FILE_SIZE;
  logger.transports.file.archiveLogFn = (file) => {
    try {
      rotateLogFile(file.toString());
    } catch (error) {
      process.stderr.write(
        `[logger] failed to rotate ${file.path}: ${error instanceof Error ? error.message : String(error)}\n`,
      );
      // Keep the recent tail (as electron-log's own default does) so a failed rename, e.g. a
      // file locked by antivirus on Windows, doesn't erase the log. Cropping also stops the
      // oversized file from triggering a rotation attempt on every write. `crop` exists at
      // runtime but is missing from electron-log's LogFile typings.
      (file as typeof file & { crop(bytesAfter: number): void }).crop(256 * 1024);
    }
  };
  // Our console wrappers already call the original console.*; ipc forwarding is not used.
  logger.transports.console.level = false;
  logger.transports.ipc.level = false;
  return logger;
}

const mainLog = configure(log, 'main.log');
// Renderer entries reach us over IPC and are written by the main process, so electron-log's
// own processType is 'browser' for both; a second logger instance gives them their own file.
const rendererLog = configure(log.create({ logId: 'renderer' }), 'renderer.log');

export function getLogDirectory(): string {
  return path.dirname(mainLog.transports.file.getFile().path);
}

export function writeLog(
  processName: ProcessName,
  level: LevelStr,
  message: string,
  filename: string | null = null,
  line: number | null = null,
): void {
  try {
    const location = filename ? `[${filename}${line === null ? '' : `:${line}`}] ` : '';
    (processName === 'renderer' ? rendererLog : mainLog)[level](`${location}${message}`);
  } catch (error) {
    process.stderr.write(
      `[logger] failed to write log: ${error instanceof Error ? error.message : String(error)}\n`,
    );
  }
}

// A V8 stack frame reads "at name (file:line:col)" or "at file:line:col". Matching the
// trailing ":line:col" greedily (rather than splitting on the first colon) keeps this correct
// for Windows paths, whose drive letter ("C:\...") also contains a colon.
const STACK_FRAME_PATTERN = /at\s+(?:.*\()?(.+):(\d+):(\d+)\)?\s*$/;

function callerLocation(
  stack: string | undefined,
): { filename: string; line: number; column: number } | null {
  // frames[0] (index 1 after the leading "Error" line) is where `new Error()` was constructed -
  // i.e. inside the console wrapper below. frames[1] (index 2) is that wrapper's caller, which
  // is the actual console.* call site we want to report.
  const frame = stack?.split('\n')[2];
  const match = frame ? STACK_FRAME_PATTERN.exec(frame) : null;
  return match ? { filename: match[1], line: Number(match[2]), column: Number(match[3]) } : null;
}

export function initLogger(): void {
  for (const [method, levelStr] of Object.entries(CONSOLE_TO_LEVEL)) {
    const original = (console as unknown as Record<string, unknown>)[method] as (
      ...args: unknown[]
    ) => void;
    (console as unknown as Record<string, unknown>)[method] = (...args: unknown[]): void => {
      original.call(console, ...args);
      const location = callerLocation(new Error().stack);
      const resolved = location
        ? resolveOriginalLocation(location.filename, location.line, location.column, 'electron')
        : null;
      writeLog(
        'main',
        levelStr,
        utilFormat(...args),
        resolved?.filename ?? location?.filename ?? null,
        resolved?.line ?? location?.line ?? null,
      );
    };
  }

  process.on('uncaughtException', (error: Error) => {
    writeLog('main', 'error', `Uncaught exception: ${error.stack ?? error.message}`);
    throw error;
  });

  process.on('unhandledRejection', (reason: unknown) => {
    const msg = reason instanceof Error ? (reason.stack ?? reason.message) : String(reason);
    writeLog('main', 'error', `Unhandled rejection: ${msg}`);
  });
}
