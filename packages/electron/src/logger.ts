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

const stmtInsertLog = db.prepare<
  [number, ProcessName, LevelStr, string, string | null, string | null, number | null]
>(`
  INSERT INTO logs (timestamp, process, level, message, context, filename, line)
  VALUES (?, ?, ?, ?, ?, ?, ?)
`);

export function insertLog(
  processName: ProcessName,
  level: LevelStr,
  message: string,
  context: string | null = null,
  filename: string | null = null,
  line: number | null = null,
): void {
  try {
    stmtInsertLog.run(Date.now(), processName, level, message, context, filename, line);
  } catch (error) {
    process.stderr.write(
      `[logger] failed to write log row: ${error instanceof Error ? error.message : String(error)}\n`,
    );
  }
}

// A V8 stack frame reads "at name (file:line:col)" or "at file:line:col". Matching the
// trailing ":line:col" greedily (rather than splitting on the first colon) keeps this correct
// for Windows paths, whose drive letter ("C:\...") also contains a colon.
const STACK_FRAME_PATTERN = /at\s+(?:.*\()?(.+):(\d+):(\d+)\)?\s*$/;

function callerLocation(stack: string | undefined): { filename: string; line: number } | null {
  // frames[0] (index 1 after the leading "Error" line) is where `new Error()` was constructed -
  // i.e. inside the console wrapper below. frames[1] (index 2) is that wrapper's caller, which
  // is the actual console.* call site we want to report.
  const frame = stack?.split('\n')[2];
  const match = frame ? STACK_FRAME_PATTERN.exec(frame) : null;
  return match ? { filename: match[1], line: Number(match[2]) } : null;
}

export function initLogger(): void {
  for (const [method, levelStr] of Object.entries(CONSOLE_TO_LEVEL)) {
    const original = (console as unknown as Record<string, unknown>)[method] as (
      ...args: unknown[]
    ) => void;
    (console as unknown as Record<string, unknown>)[method] = (...args: unknown[]): void => {
      original.call(console, ...args);
      const location = callerLocation(new Error().stack);
      insertLog(
        'main',
        levelStr,
        utilFormat(...args),
        null,
        location?.filename ?? null,
        location?.line ?? null,
      );
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
