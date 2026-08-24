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

function callerLocation(stack: string | undefined): { filename: string; line: number } | null {
  // frames[0] (index 1 after the leading "Error" line) is where `new Error()` was constructed -
  // i.e. inside the console wrapper below. frames[1] (index 2) is that wrapper's caller, which
  // is the actual console.* call site we want to report.
  const frame = stack?.split('\n')[2];
  const match = frame ? STACK_FRAME_PATTERN.exec(frame) : null;
  return match ? { filename: match[1], line: Number(match[2]) } : null;
}

function serializeArg(arg: unknown): unknown {
  if (arg instanceof Error) {
    return { name: arg.name, message: arg.message, stack: arg.stack };
  }
  return arg;
}

function safeStringify(value: unknown): string {
  const seen = new WeakSet<object>();
  return JSON.stringify(value, (_key, val) => {
    if (typeof val === 'object' && val !== null) {
      if (seen.has(val)) return '[Circular]';
      seen.add(val);
    }
    return val;
  });
}

function buildLogPayload(args: unknown[]): { message: string; context: string | null } {
  const structured: unknown[] = [];

  const messageParts = args.map((arg) => {
    if (arg === null || arg === undefined) return String(arg);
    if (typeof arg === 'string' || typeof arg === 'number' || typeof arg === 'boolean') {
      return String(arg);
    }
    structured.push(serializeArg(arg));
    return arg instanceof Error ? `${arg.name}: ${arg.message}` : '[object]';
  });

  return {
    message: messageParts.join(' '),
    context: structured.length > 0 ? safeStringify(structured) : null,
  };
}

export function initRendererLogger(): void {
  for (const [method, level] of Object.entries(METHOD_TO_LEVEL)) {
    const original = (console as unknown as Record<string, unknown>)[method] as (
      ...args: unknown[]
    ) => void;
    (console as unknown as Record<string, unknown>)[method] = (...args: unknown[]): void => {
      original.apply(console, args);
      const location = callerLocation(new Error().stack);
      const { message, context } = buildLogPayload(args);
      window.bitbutler.log.write({
        level,
        message,
        context,
        filename: location?.filename ?? null,
        line: location?.line ?? null,
      });
    };
  }
}
