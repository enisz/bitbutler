import type { LogLevel } from '@bitbutler/shared';

const METHOD_TO_LEVEL: Record<string, LogLevel> = {
  log: 'debug',
  debug: 'debug',
  info: 'info',
  warn: 'warn',
  error: 'error',
};

// A V8 stack frame reads "at name (file:line:col)" or "at file:line:col".
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

function safeStringify(value: unknown): string | undefined {
  const seen = new WeakSet<object>();
  return JSON.stringify(value, (_key, val) => {
    if (typeof val === 'bigint') return val.toString();
    if (typeof val === 'object' && val !== null) {
      if (seen.has(val)) return '[Circular]';
      seen.add(val);
    }
    return val;
  });
}

function formatArg(arg: unknown): string {
  if (typeof arg === 'string') return arg;
  if (arg instanceof Error) return arg.stack ?? `${arg.name}: ${arg.message}`;
  if (arg === null || arg === undefined || typeof arg !== 'object') return String(arg);
  try {
    return safeStringify(arg) ?? String(arg);
  } catch {
    return String(arg);
  }
}

export function initRendererLogger(): void {
  for (const [method, level] of Object.entries(METHOD_TO_LEVEL)) {
    const original = (console as unknown as Record<string, unknown>)[method] as (
      ...args: unknown[]
    ) => void;
    (console as unknown as Record<string, unknown>)[method] = (...args: unknown[]): void => {
      original.apply(console, args);
      const location = callerLocation(new Error().stack);
      window.bitbutler.log.write({
        level,
        message: args.map(formatArg).join(' '),
        filename: location?.filename ?? null,
        line: location?.line ?? null,
        column: location?.column ?? null,
      });
    };
  }
}
