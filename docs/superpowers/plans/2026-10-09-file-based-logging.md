# File-based logging Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace DB-backed logging and the in-app logs view with rotating log files (`main.log`, `renderer.log`) written through `electron-log`, plus an "Open Logs Folder" action.

**Architecture:** `packages/electron/src/logger.ts` owns two `electron-log` logger instances (main and renderer) and one `writeLog()` entry point used by the console wrappers and the `log:write` IPC handler. Caller `file:line` capture and source-map resolution are kept. A tiny entry file loads the logger before anything that touches the DB. The `logs` table, the logs page/grid, export modal and list/clear/export IPC are removed.

**Tech Stack:** Electron main (TypeScript, ESM, vitest), Angular 22 (vitest via `ng test`), `electron-log` v5, `better-sqlite3`.

**Spec:** `docs/superpowers/specs/2026-10-09-file-based-logging-design.md`

## Global Constraints

- Branch `329-add-logs-view`; commit format `#329: short description`; end commit messages with `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.
- Use `-` (hyphen), never `—`, in all written output, comments and commit messages.
- `npm run lint` allows zero warnings.
- Files: 5 per process (1 active + 4 rolled), `maxSize` 5 MB each, rolled names `<name>.1.log` ... `<name>.4.log`.
- Log line: electron-log default `[YYYY-MM-DD HH:mm:ss.SSS] [level] text`, `text` = `[file:line] message` (prefix omitted when no location).
- Toasts: title is short Title-Case outcome, message is only the variable detail. No toast on success of "Open Logs Folder".
- Keep all non-logs UI work already on the branch (datepicker-range-filter, `_toolbar-button.scss`, `grid.lib`, button-bar scss, the `TORRENT_DELETED` case in `torrent-command-handler.service.ts`).
- Do not touch the user guide / docs in this plan (CLAUDE.md: docs only once the feature is stable).
- Prettier sorts imports (`@trivago/prettier-plugin-sort-imports`) and moves side-effect imports; never rely on import position inside a file for ordering.

## Review Focus

- Log write failure (disk full, read-only dir) must never throw out of `console.*` or crash the app: Task 1 test "does not throw when the logger throws".
- A message containing an object with a circular reference or a BigInt sent from the renderer must not throw in `console.*`: Task 2 renderer-logger tests.
- A very long renderer message must be capped, not dropped: Task 1 `log:write` test.
- Rotation with some rolled files missing (gaps) and with a fresh install (no rolled files): Task 1 rotation tests.
- Existing installs have a `logs` table with up to 100k rows: Task 4 migration test (table, index, trigger dropped).
- `shell.openPath` failing (folder missing/permission) must surface an error, not a silent no-op: Task 1 and Task 5 tests.

---

### Task 1: Main-process file logger and log IPC

**Files:**

- Modify: `package.json` (via npm install in `packages/electron`)
- Rewrite: `packages/electron/src/logger.ts`
- Rewrite: `packages/electron/src/logger.spec.ts`
- Delete: `packages/electron/src/logger.integration.spec.ts`
- Create: `packages/electron/src/logger.rotation.spec.ts`
- Create: `packages/electron/src/logger-bootstrap.ts`
- Create: `packages/electron/src/logger-bootstrap.spec.ts`
- Create: `packages/electron/src/index.ts`
- Modify: `packages/electron/src/main.ts` (remove `initLogger` import and call)
- Modify: root `package.json` (`main`, `electron-hot` script, `build.main` entries pointing at `packages/electron/dist/main.js`)
- Rewrite: `packages/electron/src/ipc/log.ts`, `packages/electron/src/ipc/log.spec.ts`

**Interfaces:**

- Produces (`logger.ts`):
  - `type LevelStr = 'debug' | 'info' | 'warn' | 'error'`, `type ProcessName = 'main' | 'renderer'`
  - `MAX_LOG_FILE_SIZE = 5 * 1024 * 1024`, `ROLLED_LOG_FILES = 4`
  - `rotateLogFile(filePath: string, rolledFiles?: number): void`
  - `writeLog(processName: ProcessName, level: LevelStr, message: string, filename?: string | null, line?: number | null): void` (never throws)
  - `getLogDirectory(): string`
  - `initLogger(): void`
- Produces (`ipc/log.ts`): `registerLogIpcHandlers()` handling `log:write` (renderer entry) and `log:open-folder` returning `Promise<{ ok: boolean; error?: string }>`.
- Consumes: `resolveOriginalLocation(filename, line, column, 'electron' | 'app')` from `source-map-resolver.ts` (unchanged).

- [ ] **Step 1: Install electron-log**

Run: `npm install electron-log --workspace=packages/electron`
Expected: `electron-log` added under `dependencies` of `packages/electron/package.json`.

- [ ] **Step 2: Write the rotation tests (failing)**

Create `packages/electron/src/logger.rotation.spec.ts`:

```ts
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('electron-log/main', () => ({
  default: {
    transports: { file: {}, console: {}, ipc: {} },
    create: () => ({ transports: { file: {}, console: {}, ipc: {} } }),
  },
}));
vi.mock('./source-map-resolver.js', () => ({ resolveOriginalLocation: vi.fn() }));

describe('rotateLogFile', () => {
  let dir: string;

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bb-log-'));
  });

  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  const write = (name: string, content: string) => fs.writeFileSync(path.join(dir, name), content);
  const read = (name: string) => fs.readFileSync(path.join(dir, name), 'utf8');
  const files = () => fs.readdirSync(dir).sort();

  it('moves the active file to .1 when nothing has been rolled yet', async () => {
    const { rotateLogFile } = await import('./logger.js');
    write('main.log', 'active');

    rotateLogFile(path.join(dir, 'main.log'));

    expect(files()).toEqual(['main.1.log']);
    expect(read('main.1.log')).toBe('active');
  });

  it('shifts every rolled file up by one and drops the oldest', async () => {
    const { rotateLogFile } = await import('./logger.js');
    write('main.log', 'active');
    write('main.1.log', 'one');
    write('main.2.log', 'two');
    write('main.3.log', 'three');
    write('main.4.log', 'four');

    rotateLogFile(path.join(dir, 'main.log'));

    expect(files()).toEqual(['main.1.log', 'main.2.log', 'main.3.log', 'main.4.log']);
    expect(read('main.1.log')).toBe('active');
    expect(read('main.2.log')).toBe('one');
    expect(read('main.3.log')).toBe('two');
    expect(read('main.4.log')).toBe('three');
  });

  it('copes with gaps in the rolled sequence', async () => {
    const { rotateLogFile } = await import('./logger.js');
    write('main.log', 'active');
    write('main.2.log', 'two');

    rotateLogFile(path.join(dir, 'main.log'));

    expect(files()).toEqual(['main.1.log', 'main.3.log']);
    expect(read('main.3.log')).toBe('two');
  });

  it('leaves the other process files alone', async () => {
    const { rotateLogFile } = await import('./logger.js');
    write('main.log', 'm');
    write('renderer.log', 'r');
    write('renderer.1.log', 'r1');

    rotateLogFile(path.join(dir, 'main.log'));

    expect(files()).toEqual(['main.1.log', 'renderer.1.log', 'renderer.log']);
  });
});
```

- [ ] **Step 3: Write the logger tests (failing)**

Replace `packages/electron/src/logger.spec.ts` entirely:

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const fakes = vi.hoisted(() => {
  const make = () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    transports: {
      file: {
        fileName: 'main.log',
        maxSize: 0,
        archiveLogFn: undefined as unknown,
        getFile: vi.fn(() => ({ path: '/fake/logs/main.log' })),
      },
      console: { level: 'silly' as unknown },
      ipc: { level: 'silly' as unknown },
    },
  });
  const rendererLog = make();
  const mainLog = { ...make(), create: vi.fn(() => rendererLog) };
  return { mainLog, rendererLog };
});
const mockResolveOriginalLocation = vi.hoisted(() => vi.fn());

vi.mock('electron-log/main', () => ({ default: fakes.mainLog }));
vi.mock('./source-map-resolver.js', () => ({
  resolveOriginalLocation: mockResolveOriginalLocation,
}));

type ConsoleFn = (...args: unknown[]) => void;
const consoleOf = () => console as unknown as Record<string, ConsoleFn>;

describe('logger', () => {
  let originalConsole: Record<string, ConsoleFn>;

  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    mockResolveOriginalLocation.mockReturnValue(null);
    originalConsole = {
      log: console.log,
      debug: console.debug,
      info: console.info,
      warn: console.warn,
      error: console.error,
    };
  });

  afterEach(() => {
    Object.assign(console, originalConsole);
    process.removeAllListeners('uncaughtException');
    process.removeAllListeners('unhandledRejection');
  });

  describe('configuration', () => {
    it('configures the main and renderer file transports', async () => {
      await import('./logger.js');

      expect(fakes.mainLog.create).toHaveBeenCalledWith({ logId: 'renderer' });
      expect(fakes.mainLog.transports.file.fileName).toBe('main.log');
      expect(fakes.rendererLog.transports.file.fileName).toBe('renderer.log');
      for (const l of [fakes.mainLog, fakes.rendererLog]) {
        expect(l.transports.file.maxSize).toBe(5 * 1024 * 1024);
        expect(typeof l.transports.file.archiveLogFn).toBe('function');
        expect(l.transports.console.level).toBe(false);
        expect(l.transports.ipc.level).toBe(false);
      }
    });

    it('getLogDirectory returns the directory of the main log file', async () => {
      const { getLogDirectory } = await import('./logger.js');
      expect(getLogDirectory().replace(/\\/g, '/')).toBe('/fake/logs');
    });
  });

  describe('writeLog', () => {
    it('writes main entries to the main logger with a [file:line] prefix', async () => {
      const { writeLog } = await import('./logger.js');
      writeLog('main', 'warn', 'hello', 'packages/electron/src/a.ts', 7);
      expect(fakes.mainLog.warn).toHaveBeenCalledWith('[packages/electron/src/a.ts:7] hello');
      expect(fakes.rendererLog.warn).not.toHaveBeenCalled();
    });

    it('writes renderer entries to the renderer logger', async () => {
      const { writeLog } = await import('./logger.js');
      writeLog('renderer', 'error', 'boom', 'packages/app/src/b.ts', 3);
      expect(fakes.rendererLog.error).toHaveBeenCalledWith('[packages/app/src/b.ts:3] boom');
      expect(fakes.mainLog.error).not.toHaveBeenCalled();
    });

    it('omits the prefix when there is no location', async () => {
      const { writeLog } = await import('./logger.js');
      writeLog('main', 'info', 'plain');
      expect(fakes.mainLog.info).toHaveBeenCalledWith('plain');
    });

    it('omits the line when only a filename is known', async () => {
      const { writeLog } = await import('./logger.js');
      writeLog('main', 'info', 'x', 'a.ts', null);
      expect(fakes.mainLog.info).toHaveBeenCalledWith('[a.ts] x');
    });

    it('does not throw and reports to stderr when the logger throws', async () => {
      const stderr = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
      fakes.mainLog.error.mockImplementation(() => {
        throw new Error('disk full');
      });
      const { writeLog } = await import('./logger.js');

      expect(() => writeLog('main', 'error', 'oops')).not.toThrow();

      expect(stderr).toHaveBeenCalledWith(
        expect.stringContaining('[logger] failed to write log: disk full'),
      );
      stderr.mockRestore();
      fakes.mainLog.error.mockReset();
    });
  });

  describe('initLogger', () => {
    it.each([
      ['log', 'debug'],
      ['debug', 'debug'],
      ['info', 'info'],
      ['warn', 'warn'],
      ['error', 'error'],
    ])('writes console.%s as "%s" and preserves terminal output', async (method, level) => {
      const spy = vi.fn();
      consoleOf()[method] = spy;
      const { initLogger } = await import('./logger.js');
      initLogger();

      consoleOf()[method]('hello', 42);

      expect(spy).toHaveBeenCalledWith('hello', 42);
      expect(
        (fakes.mainLog as unknown as Record<string, ReturnType<typeof vi.fn>>)[level],
      ).toHaveBeenCalledWith(expect.stringMatching(/^\[.*logger\.spec\.ts:\d+\] hello 42$/));
    });

    it('uses the source-map-resolved location when available', async () => {
      mockResolveOriginalLocation.mockReturnValue({
        filename: 'packages/electron/src/logger.ts',
        line: 42,
      });
      const { initLogger } = await import('./logger.js');
      initLogger();

      console.info('hello');

      expect(fakes.mainLog.info).toHaveBeenCalledWith('[packages/electron/src/logger.ts:42] hello');
    });

    it('renders objects with util.format instead of [object Object]', async () => {
      const { initLogger } = await import('./logger.js');
      initLogger();

      console.info('state', { a: 1 });

      expect(fakes.mainLog.info).toHaveBeenCalledWith(expect.stringContaining('state { a: 1 }'));
    });

    it('logs uncaught exceptions with the stack and rethrows', async () => {
      const { initLogger } = await import('./logger.js');
      initLogger();

      expect(() => process.emit('uncaughtException', new Error('boom'))).toThrow('boom');

      expect(fakes.mainLog.error).toHaveBeenCalledWith(
        expect.stringContaining('Uncaught exception: Error: boom'),
      );
    });

    it('logs unhandled rejections without throwing', async () => {
      const { initLogger } = await import('./logger.js');
      initLogger();

      expect(() =>
        process.emit('unhandledRejection', new Error('nope'), Promise.resolve()),
      ).not.toThrow();

      expect(fakes.mainLog.error).toHaveBeenCalledWith(
        expect.stringContaining('Unhandled rejection: Error: nope'),
      );
    });
  });
});
```

- [ ] **Step 4: Run the new tests to verify they fail**

Run: `npm test --workspace=packages/electron -- src/logger.spec.ts src/logger.rotation.spec.ts`
Expected: FAIL (`writeLog`, `rotateLogFile`, `getLogDirectory` are not exported; old module imports `./db.js`).

- [ ] **Step 5: Rewrite `logger.ts`**

Replace `packages/electron/src/logger.ts`:

```ts
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
      // Without this the oversized file would trigger a rotation attempt on every write.
      file.clear();
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
```

- [ ] **Step 6: Run the logger and rotation tests**

Run: `npm test --workspace=packages/electron -- src/logger.spec.ts src/logger.rotation.spec.ts`
Expected: PASS. If `tsc`-style errors appear about `import log from 'electron-log/main'` (it is `export =`), keep the default import (`esModuleInterop` is the repo default); only change the import form if `npm run build:electron` in Task 3 fails.

- [ ] **Step 7: Delete the DB integration spec**

Run: `git rm packages/electron/src/logger.integration.spec.ts`

- [ ] **Step 8: Add the bootstrap, entry file and its test**

Create `packages/electron/src/logger-bootstrap.ts`:

```ts
import { initLogger } from './logger.js';

// Evaluated before main.ts (see index.ts) so console wrappers and crash handlers exist before
// db.js / better-sqlite3 load and any startup failure there is written to the log file.
initLogger();
```

Create `packages/electron/src/index.ts`:

```ts
// Electron entry point. Import order matters here: the logger bootstrap must be evaluated
// before main.js pulls in the database. "logger-bootstrap" sorts before "main", so the repo's
// import sorter keeps this order.
import './logger-bootstrap.js';
import './main.js';
```

Create `packages/electron/src/logger-bootstrap.spec.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockInitLogger = vi.hoisted(() => vi.fn());
vi.mock('./logger.js', () => ({ initLogger: mockInitLogger }));

describe('logger-bootstrap', () => {
  beforeEach(() => {
    vi.resetModules();
    mockInitLogger.mockClear();
  });

  it('initializes the logger when imported', async () => {
    await import('./logger-bootstrap.js');
    expect(mockInitLogger).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 9: Remove `initLogger` from `main.ts` and repoint the entry**

In `packages/electron/src/main.ts` delete the line `import { initLogger } from './logger.js';` and the call `initLogger();` (keep the following `console.info('[BitButler] Starting ...')`).

In root `package.json` change all three `packages/electron/dist/main.js` occurrences (the `"main"` field, the `electron-hot` script and `build.main`) to `packages/electron/dist/index.js`.

Run: `npx prettier --check packages/electron/src/index.ts packages/electron/src/main.ts package.json`
Expected: all pass; confirm `index.ts` still lists `./logger-bootstrap.js` before `./main.js` (`git diff` shows no reorder).

- [ ] **Step 10: Write the log IPC tests (failing)**

Replace `packages/electron/src/ipc/log.spec.ts`:

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const ipcHandlers = vi.hoisted(() => new Map<string, (...args: unknown[]) => unknown>());
const mockWriteLog = vi.hoisted(() => vi.fn());
const mockGetLogDirectory = vi.hoisted(() => vi.fn(() => '/fake/logs'));
const mockResolveOriginalLocation = vi.hoisted(() => vi.fn());
const mockOpenPath = vi.hoisted(() => vi.fn());

vi.mock('electron', () => ({
  ipcMain: {
    on: vi.fn((channel: string, handler: (...args: unknown[]) => unknown) => {
      ipcHandlers.set(channel, handler);
    }),
    handle: vi.fn((channel: string, handler: (...args: unknown[]) => unknown) => {
      ipcHandlers.set(channel, handler);
    }),
  },
  shell: { openPath: mockOpenPath },
}));
vi.mock('../logger.js', () => ({
  writeLog: mockWriteLog,
  getLogDirectory: mockGetLogDirectory,
}));
vi.mock('../source-map-resolver.js', () => ({
  resolveOriginalLocation: mockResolveOriginalLocation,
}));

describe('log IPC handlers', () => {
  beforeEach(() => {
    vi.resetModules();
    ipcHandlers.clear();
    vi.clearAllMocks();
    mockResolveOriginalLocation.mockReturnValue(null);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  async function register() {
    const { registerLogIpcHandlers } = await import('./log.js');
    registerLogIpcHandlers();
  }

  describe('log:write', () => {
    it('writes a renderer entry through writeLog', async () => {
      await register();

      ipcHandlers.get('log:write')!(null, {
        level: 'error',
        message: 'Unhandled command',
        filename: 'app.js',
        line: 12,
        column: 3,
      });

      expect(mockWriteLog).toHaveBeenCalledWith(
        'renderer',
        'error',
        'Unhandled command',
        'app.js',
        12,
      );
    });

    it('prefers the source-map-resolved location', async () => {
      mockResolveOriginalLocation.mockReturnValue({
        filename: 'packages/app/src/a.ts',
        line: 9,
      });
      await register();

      ipcHandlers.get('log:write')!(null, {
        level: 'info',
        message: 'x',
        filename: 'main.js',
        line: 1,
        column: 2,
      });

      expect(mockResolveOriginalLocation).toHaveBeenCalledWith('main.js', 1, 2, 'app');
      expect(mockWriteLog).toHaveBeenCalledWith(
        'renderer',
        'info',
        'x',
        'packages/app/src/a.ts',
        9,
      );
    });

    it('accepts entries without a location', async () => {
      await register();

      ipcHandlers.get('log:write')!(null, { level: 'warn', message: 'no loc' });

      expect(mockWriteLog).toHaveBeenCalledWith('renderer', 'warn', 'no loc', null, null);
    });

    it('caps very long messages instead of dropping them', async () => {
      await register();

      ipcHandlers.get('log:write')!(null, { level: 'info', message: 'a'.repeat(50000) });

      const message = mockWriteLog.mock.calls[0][2] as string;
      expect(message).toHaveLength(20000);
    });

    it.each([
      ['unknown level', { level: 'trace', message: 'x' }],
      ['missing message', { level: 'info' }],
      ['empty message', { level: 'info', message: '' }],
      ['non-object payload', 'nope'],
      ['null payload', null],
    ])('ignores an invalid entry (%s)', async (_label, payload) => {
      await register();

      ipcHandlers.get('log:write')!(null, payload);

      expect(mockWriteLog).not.toHaveBeenCalled();
    });
  });

  describe('log:open-folder', () => {
    it('opens the log directory and reports success', async () => {
      mockOpenPath.mockResolvedValue('');
      await register();

      const result = await ipcHandlers.get('log:open-folder')!(null);

      expect(mockOpenPath).toHaveBeenCalledWith('/fake/logs');
      expect(result).toEqual({ ok: true });
    });

    it('reports the error string when the folder cannot be opened', async () => {
      mockOpenPath.mockResolvedValue('Failed to open path');
      await register();

      const result = await ipcHandlers.get('log:open-folder')!(null);

      expect(result).toEqual({ ok: false, error: 'Failed to open path' });
    });
  });

  it('no longer registers the list, clear and export channels', async () => {
    await register();
    expect(ipcHandlers.has('log:list')).toBe(false);
    expect(ipcHandlers.has('log:clear')).toBe(false);
    expect(ipcHandlers.has('log:export')).toBe(false);
  });
});
```

- [ ] **Step 11: Run to verify failure**

Run: `npm test --workspace=packages/electron -- src/ipc/log.spec.ts`
Expected: FAIL (`log.ts` still imports `db.js`/`insertLog`).

- [ ] **Step 12: Rewrite `ipc/log.ts`**

Replace `packages/electron/src/ipc/log.ts`:

```ts
import { ipcMain, shell } from 'electron';
import { getLogDirectory, writeLog } from '../logger.js';
import { resolveOriginalLocation } from '../source-map-resolver.js';

const VALID_LEVELS = ['debug', 'info', 'warn', 'error'] as const;
type LevelStr = (typeof VALID_LEVELS)[number];

const MAX_MESSAGE_LENGTH = 20000;

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
    const message = asNullableString(e['message'], MAX_MESSAGE_LENGTH);
    if (!level || !message) return;

    const filename = asNullableString(e['filename'], 500);
    const line = asNullableInt(e['line']);
    const column = asNullableInt(e['column']);
    const resolved =
      filename !== null && line !== null && column !== null
        ? resolveOriginalLocation(filename, line, column, 'app')
        : null;

    writeLog(
      'renderer',
      level,
      message,
      resolved ? asNullableString(resolved.filename, 500) : filename,
      resolved?.line ?? line,
    );
  });

  ipcMain.handle('log:open-folder', async (): Promise<{ ok: boolean; error?: string }> => {
    const error = await shell.openPath(getLogDirectory());
    return error ? { ok: false, error } : { ok: true };
  });
}
```

- [ ] **Step 13: Run all electron tests and type-check**

Run: `npm test --workspace=packages/electron -- src/ipc/log.spec.ts src/logger.spec.ts src/logger.rotation.spec.ts src/logger-bootstrap.spec.ts`
Expected: PASS.
Run: `npx tsc --noEmit -p packages/electron/tsconfig.json`
Expected: errors only from files still referencing removed things (`db.spec.ts` is untouched; `preload.ts`/shared types still compile). Fix anything in files this task touched.

- [ ] **Step 14: Commit**

```bash
git add -A packages/electron package.json package-lock.json
git commit -m "#329: write logs to rotating files with electron-log"
```

---

### Task 2: Shared contract, renderer logger, and removal of the logs view

**Files:**

- Modify: `packages/shared/src/models/log.model.ts`, `packages/shared/src/index.ts`, `packages/shared/src/ipc.types.ts`
- Modify: `packages/electron/src/preload.ts`
- Rewrite: `packages/app/src/app/renderer-logger.ts`, `packages/app/src/app/renderer-logger.spec.ts`
- Modify: `packages/app/src/test-setup.ts`, `packages/app/src/app/app.routes.ts`
- Modify: `packages/app/public/i18n/us.json`, `packages/app/public/i18n/hu.json`
- Delete: `packages/app/src/app/pages/logs/` (whole folder), `packages/app/src/app/modals/export-logs/` (whole folder), `packages/app/src/app/services/log.service.ts`, `log.service.spec.ts`, `log-grid.settings.service.ts`, `log-grid.settings.service.spec.ts`, `packages/app/src/app/models/log-grid.model.ts`

**Interfaces:**

- Consumes: Task 1 `log:write` and `log:open-folder` channels.
- Produces: `RendererLogEntry = { level: LogLevel; message: string; filename: string | null; line: number | null; column: number | null }`; `BitButlerAPI.log = { write(entry: RendererLogEntry): void; openFolder(): Promise<{ ok: boolean; error?: string }> }`. `LogEntry` and `LogProcess` no longer exist.

- [ ] **Step 1: Write the renderer-logger tests (failing)**

Replace `packages/app/src/app/renderer-logger.spec.ts`:

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { initRendererLogger } from './renderer-logger';

type ConsoleFn = (...args: unknown[]) => void;
const consoleOf = () => console as unknown as Record<string, ConsoleFn>;

describe('initRendererLogger', () => {
  let original: Record<string, ConsoleFn>;
  let write: ReturnType<typeof vi.spyOn>;
  let originals: Record<string, ReturnType<typeof vi.fn>>;

  beforeEach(() => {
    original = {
      log: console.log,
      debug: console.debug,
      info: console.info,
      warn: console.warn,
      error: console.error,
    };
    write = vi.spyOn(window.bitbutler.log, 'write');
    originals = {};
    for (const m of Object.keys(original)) {
      originals[m] = vi.fn();
      consoleOf()[m] = originals[m];
    }
    initRendererLogger();
  });

  afterEach(() => {
    Object.assign(console, original);
    write.mockRestore();
  });

  const lastEntry = () => write.mock.calls.at(-1)![0] as Record<string, unknown>;

  it.each([
    ['log', 'debug'],
    ['debug', 'debug'],
    ['info', 'info'],
    ['warn', 'warn'],
    ['error', 'error'],
  ])('maps console.%s to level %s', (method, level) => {
    consoleOf()[method]('hello');
    expect(lastEntry()).toMatchObject({ level, message: 'hello' });
  });

  it('joins primitives and keeps null/undefined readable', () => {
    console.info('a', 1, true, null, undefined);
    expect(lastEntry()['message']).toBe('a 1 true null undefined');
  });

  it('renders Errors as their stack', () => {
    const err = new Error('boom');
    console.error('failed:', err);
    expect(lastEntry()['message']).toContain('failed: ');
    expect(lastEntry()['message']).toContain('Error: boom');
  });

  it('renders objects as JSON instead of [object]', () => {
    console.info('state', { a: 1, b: [2] });
    expect(lastEntry()['message']).toBe('state {"a":1,"b":[2]}');
  });

  it('survives circular objects', () => {
    const o: Record<string, unknown> = { name: 'x' };
    o['self'] = o;
    expect(() => console.info('c', o)).not.toThrow();
    expect(lastEntry()['message']).toContain('[Circular]');
  });

  it('survives BigInt and functions', () => {
    expect(() => console.info('n', 10n, () => 1)).not.toThrow();
    expect(lastEntry()['message']).toContain('10');
  });

  it('sends the caller location of the console call', () => {
    console.info('where');
    expect(String(lastEntry()['filename'])).toContain('renderer-logger.spec');
    expect(lastEntry()['line']).toEqual(expect.any(Number));
    expect(lastEntry()['column']).toEqual(expect.any(Number));
    expect(lastEntry()).not.toHaveProperty('context');
  });

  it('still calls the original console method with the same arguments', () => {
    console.info('forwarded', 1);
    expect(originals['info']).toHaveBeenCalledWith('forwarded', 1);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npm test --workspace=packages/app -- --include='**/renderer-logger.spec.ts'`
Expected: FAIL (messages still use `[object]` and a `context` field).

- [ ] **Step 3: Rewrite `renderer-logger.ts`**

Replace `packages/app/src/app/renderer-logger.ts`:

```ts
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
```

Note: `typeof arg !== 'object'` also covers functions (`String(fn)`), symbols and bigint (`String(10n)`).

- [ ] **Step 4: Update shared types, preload and test-setup**

`packages/shared/src/models/log.model.ts` becomes:

```ts
export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface RendererLogEntry {
  level: LogLevel;
  message: string;
  filename: string | null;
  line: number | null;
  column: number | null;
}
```

`packages/shared/src/index.ts`: change the log export line to `export type { LogLevel, RendererLogEntry } from './models/log.model.js';`

`packages/shared/src/ipc.types.ts`: change the import back to `import type { RendererLogEntry } from './models/log.model.js';` and the `log` block to:

```ts
  log: {
    write(entry: RendererLogEntry): void;
    openFolder(): Promise<{ ok: boolean; error?: string }>;
  };
```

`packages/electron/src/preload.ts`, `log` block becomes:

```ts
  log: {
    write: (entry: RendererLogEntry) => ipcRenderer.send('log:write', entry),
    openFolder: () => ipcRenderer.invoke('log:open-folder'),
  },
```

`packages/app/src/test-setup.ts`, `log` block becomes:

```ts
  log: {
    write: noop,
    openFolder: () => Promise.resolve({ ok: true }),
  },
```

- [ ] **Step 5: Delete the logs view code**

```bash
git rm -r packages/app/src/app/pages/logs packages/app/src/app/modals/export-logs
git rm packages/app/src/app/services/log.service.ts packages/app/src/app/services/log.service.spec.ts \
       packages/app/src/app/services/log-grid.settings.service.ts packages/app/src/app/services/log-grid.settings.service.spec.ts \
       packages/app/src/app/models/log-grid.model.ts
```

In `packages/app/src/app/app.routes.ts` remove the `logs` route block:

```ts
      {
        path: 'logs',
        loadComponent: () => import('./pages/logs/logs').then((mod) => mod.Logs),
      },
```

- [ ] **Step 6: Remove the logs i18n keys**

Run (removes `components.modals.export-logs`, `pages.logs` and `general.button.export` from both languages, then re-formats):

```bash
node -e "
const fs=require('fs');
for (const f of ['us','hu']) {
  const p='packages/app/public/i18n/'+f+'.json';
  const j=JSON.parse(fs.readFileSync(p,'utf8'));
  delete j.components.modals['export-logs'];
  delete j.pages.logs;
  delete j.general.button.export;
  fs.writeFileSync(p, JSON.stringify(j,null,2)+'\n');
}"
npx prettier --write packages/app/public/i18n/us.json packages/app/public/i18n/hu.json
git diff --stat packages/app/public/i18n
```

Expected: only deletions (no unrelated reformatting). `copy-rows-as-json` / `rows-as-json` keys stay (used by `grid.lib`).

- [ ] **Step 7: Find leftovers**

Run: `grep -rn "LogEntry\|LogProcess\|log-grid\|LogService\|pages.logs\|export-logs\|general.button.export\|log\.list\|log\.clear\|log\.export" packages --include=*.ts --include=*.html --include=*.json -l --exclude-dir=node_modules --exclude-dir=dist --exclude-dir=.angular`
Expected: no results (apart from `RendererLogEntry`, which is a different identifier). Fix any hit.

- [ ] **Step 8: Run tests, lint and type-check**

Run: `npm test --workspace=packages/app` then `npm run lint` then `npx tsc --noEmit -p packages/app/tsconfig.app.json` and `npm run build:electron`
Expected: all PASS / no errors.

- [ ] **Step 9: Commit**

```bash
git add -A packages
git commit -m "#329: remove the logs view and simplify the renderer log contract"
```

---

### Task 3: Menu - Help > Open Logs Folder, remove Debug > Logs

**Files:**

- Modify: `packages/electron/src/menu.ts`, `packages/electron/src/menu.spec.ts`
- Modify: `packages/app/public/i18n/us.json`, `packages/app/public/i18n/hu.json` (`electron.menu.open-logs-folder`)

**Interfaces:**

- Consumes: `getLogDirectory()` from `./logger.js` (Task 1).

- [ ] **Step 1: Update the menu tests (failing)**

In `packages/electron/src/menu.spec.ts`:

1. Add hoisted mocks next to the others:

```ts
const mockOpenPath = vi.hoisted(() => vi.fn(() => Promise.resolve('')));
const mockGetLogDirectory = vi.hoisted(() => vi.fn(() => '/fake/logs'));
```

2. Extend the electron mock with `shell: { openPath: mockOpenPath },` and add:

```ts
vi.mock('./logger.js', () => ({ getLogDirectory: mockGetLogDirectory }));
```

3. Replace the test `sends view.select for the logs view when Logs is clicked` with:

```ts
it('no longer has a Logs item', async () => {
  const template = await buildMenu(createFakeWindow());
  expect(findItem(template, byLabel('Logs'))).toBeUndefined();
});
```

4. Inside `describe('Help menu', ...)` add:

```ts
it('opens the log folder from Help > Open Logs Folder, even when logged out', async () => {
  const template = await buildMenu(createFakeWindow());
  const item = findItem(template, byLabel('electron.menu.open-logs-folder'))!;
  expect(item).toBeDefined();

  (item.click as () => void)();

  expect(mockOpenPath).toHaveBeenCalledWith('/fake/logs');
});

it('logs an error when the folder cannot be opened', async () => {
  const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
  mockOpenPath.mockResolvedValueOnce('Failed to open path');
  const template = await buildMenu(createFakeWindow());
  const item = findItem(template, byLabel('electron.menu.open-logs-folder'))!;

  (item.click as () => void)();
  await Promise.resolve();
  await Promise.resolve();

  expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('Failed to open path'));
  errorSpy.mockRestore();
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npm test --workspace=packages/electron -- src/menu.spec.ts`
Expected: FAIL (no Open Logs Folder item; Logs item still present).

- [ ] **Step 3: Implement**

In `packages/electron/src/menu.ts`:

- Change the first import to `import { Menu, app, shell } from 'electron';` and add `import { getLogDirectory } from './logger.js';` (prettier will sort it).
- Add above `rebuildMenu`:

```ts
function openLogsFolder(): void {
  void shell.openPath(getLogDirectory()).then((error) => {
    if (error) console.error(`[menu] failed to open the logs folder: ${error}`);
  });
}
```

- In the Help submenu, after the "check-for-updates" item and before the separator preceding About, add:

```ts
        {
          label: t('electron.menu.open-logs-folder'),
          click: openLogsFolder,
        },
```

- In the Debug items remove the block:

```ts
            {
              label: 'Logs',
              click: () => sendMenuAction(mainWindow, 'view.select', { viewId: 'logs' }),
            },
            { type: 'separator' },
```

- [ ] **Step 4: Add the translations**

In `packages/app/public/i18n/us.json`, `electron.menu`, add after `"check-for-updates"`: `"open-logs-folder": "Open Logs Folder",`. In `hu.json` add `"open-logs-folder": "Naplómappa megnyitása",` at the same place. Run `npx prettier --check packages/app/public/i18n/*.json`.

- [ ] **Step 5: Run tests**

Run: `npm test --workspace=packages/electron -- src/menu.spec.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add -A packages
git commit -m "#329: add Help > Open Logs Folder and drop the Debug logs entry"
```

---

### Task 4: Drop the legacy `logs` table

**Files:**

- Modify: `packages/electron/src/db.ts` (the `logs` block, roughly lines 133-171)
- Rewrite: `packages/electron/src/db.spec.ts` (logs describes only; keep any other describes already in the file)

**Interfaces:** none produced.

- [ ] **Step 1: Write the migration tests (failing)**

In `packages/electron/src/db.spec.ts` keep the existing `electron` mock, delete the `describe('logs table', ...)` and `describe('logs retention trigger', ...)` blocks, and replace the `better-sqlite3` mock and add tests:

```ts
const legacySetup = vi.hoisted(() => ({
  run: null as null | ((db: { exec: (sql: string) => void }) => void),
}));

vi.mock('better-sqlite3', async () => {
  const actual = await vi.importActual<typeof import('better-sqlite3')>('better-sqlite3');
  const RealDatabase = actual.default;
  return {
    default: class extends RealDatabase {
      constructor() {
        super(':memory:');
        legacySetup.run?.(this);
      }
    },
  };
});

const names = (db: { prepare: (sql: string) => { all: () => unknown[] } }, type: string) =>
  (
    db.prepare('SELECT name FROM sqlite_master WHERE type = ?') as unknown as {
      all: (t: string) => { name: string }[];
    }
  )
    .all(type)
    .map((r) => r.name);

describe('legacy logs table', () => {
  beforeEach(() => {
    vi.resetModules();
    legacySetup.run = null;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('does not create a logs table on a fresh database', async () => {
    const { default: db } = await import('./db.js');
    expect(names(db, 'table')).not.toContain('logs');
    expect(names(db, 'trigger')).not.toContain('trg_logs_retention');
  });

  it('drops the logs table, index and retention trigger left by older versions', async () => {
    legacySetup.run = (legacy) =>
      legacy.exec(`
        CREATE TABLE logs (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          timestamp INTEGER NOT NULL,
          process TEXT NOT NULL,
          level TEXT NOT NULL,
          message TEXT NOT NULL,
          context TEXT, filename TEXT, line INTEGER
        );
        CREATE INDEX idx_logs_timestamp ON logs(timestamp);
        CREATE TRIGGER trg_logs_retention AFTER INSERT ON logs BEGIN SELECT 1; END;
        INSERT INTO logs (timestamp, process, level, message) VALUES (1, 'main', 'info', 'old');
      `);

    const { default: db } = await import('./db.js');

    expect(names(db, 'table')).not.toContain('logs');
    expect(names(db, 'index')).not.toContain('idx_logs_timestamp');
    expect(names(db, 'trigger')).not.toContain('trg_logs_retention');
    expect(names(db, 'table')).toContain('servers');
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npm test --workspace=packages/electron -- src/db.spec.ts`
Expected: FAIL (db.ts still creates `logs` on a fresh DB).

- [ ] **Step 3: Replace the logs block in `db.ts`**

Delete from `db.exec(\`CREATE TABLE IF NOT EXISTS logs ...`through the`trg_logs_retention`trigger creation (everything between the settings-id migration loop and`export default db;`) and put in its place:

```ts
// Logs now live in rotating files (see logger.ts). Older versions stored them here, so drop the
// leftovers and reclaim the space (the table could hold up to 100000 rows).
const hadLogsTable = db
  .prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'logs'")
  .get();
db.exec(`DROP TRIGGER IF EXISTS trg_logs_retention`);
db.exec(`DROP INDEX IF EXISTS idx_logs_timestamp`);
db.exec(`DROP TABLE IF EXISTS logs`);
if (hadLogsTable) db.exec('VACUUM');
```

`ColInfo` is still used by the servers migrations; do not remove it.

- [ ] **Step 4: Run tests and lint**

Run: `npm test --workspace=packages/electron` then `npm run lint`
Expected: PASS, zero warnings.

- [ ] **Step 5: Commit**

```bash
git add -A packages/electron
git commit -m "#329: drop the legacy logs table from the database"
```

---

### Task 5: "Open Logs Folder" in General settings

**Files:**

- Modify: `packages/app/src/app/modals/settings/general/general.ts`, `general.html`, `general.spec.ts`
- Modify: `packages/app/public/i18n/us.json`, `packages/app/public/i18n/hu.json`

**Interfaces:**

- Consumes: `window.bitbutler.log.openFolder(): Promise<{ ok: boolean; error?: string }>` (Task 2), `ToastService.danger(html, title)`.

- [ ] **Step 1: Write the component tests (failing)**

In `general.spec.ts` add the import `import { ToastService } from '../../../services/toast.service';`, a `toastServiceMock` (`{ danger: vi.fn() }`) provided via `{ provide: ToastService, useValue: toastServiceMock }`, and:

```ts
describe('open logs folder', () => {
  it('opens the folder without a toast on success', async () => {
    const open = vi.spyOn(window.bitbutler.log, 'openFolder').mockResolvedValue({ ok: true });

    await component.openLogsFolder();

    expect(open).toHaveBeenCalledTimes(1);
    expect(toastServiceMock.danger).not.toHaveBeenCalled();
  });

  it('shows an error toast with the error string on failure', async () => {
    vi.spyOn(window.bitbutler.log, 'openFolder').mockResolvedValue({
      ok: false,
      error: 'Failed to open path',
    });

    await component.openLogsFolder();

    expect(toastServiceMock.danger).toHaveBeenCalledWith('Failed to open path', expect.any(String));
  });

  it('shows an error toast when the call itself rejects', async () => {
    vi.spyOn(window.bitbutler.log, 'openFolder').mockRejectedValue(new Error('ipc down'));

    await component.openLogsFolder();

    expect(toastServiceMock.danger).toHaveBeenCalledWith('ipc down', expect.any(String));
  });
});
```

(Declare `let toastServiceMock: { danger: ReturnType<typeof vi.fn> };` next to the other mocks and initialize it in `beforeEach` before `configureTestingModule`.)

- [ ] **Step 2: Run to verify failure**

Run: `npm test --workspace=packages/app -- --include='**/general.spec.ts'`
Expected: FAIL (`openLogsFolder` is not a function).

- [ ] **Step 3: Implement the method**

In `general.ts`: add `faFolderOpen` to the `@fortawesome/free-solid-svg-icons` import and to the `icons` record, import `ToastService` from `'../../../services/toast.service'`, inject it (`private readonly toastService = inject(ToastService);`) and add:

```ts
  public async openLogsFolder(): Promise<void> {
    try {
      const result = await window.bitbutler.log.openFolder();
      if (!result.ok) throw new Error(result.error);
    } catch (err) {
      console.error(General.name, 'openLogsFolder', err);
      this.toastService.danger(
        err instanceof Error ? err.message : String(err),
        this.translateService.instant(
          'pages.settings.tab.general.logs.toast.open-failed-title',
        ),
      );
    }
  }
```

- [ ] **Step 4: Add the UI**

In `general.html` insert a new fieldset after the Appearance fieldset (before `</form>`):

```html
<fieldset class="bb-fieldset">
  <legend>{{ 'pages.settings.tab.general.label.logs' | translate }}</legend>

  <div class="bb-options">
    <div class="bb-option">
      <div class="bb-option__text">
        <span class="bb-option__label"
          >{{ 'pages.settings.tab.general.logs.open-folder.label' | translate }}</span
        >
        <span class="bb-option__sub"
          >{{ 'pages.settings.tab.general.logs.open-folder.sub' | translate }}</span
        >
      </div>
      <button type="button" class="btn btn-sm btn-secondary" (click)="openLogsFolder()">
        <bb-btn-content
          [icon]="icons['faFolderOpen']"
          [text]="'pages.settings.tab.general.logs.open-folder.button' | translate"
        ></bb-btn-content>
      </button>
    </div>
  </div>
</fieldset>
```

In `us.json` under `pages.settings.tab.general`: add `"logs"` to `label` (`"logs": "Logs"`) and a sibling `logs` object next to `label`:

```json
"logs": {
  "open-folder": {
    "label": "Log files",
    "sub": "BitButler writes main.log and renderer.log, rotated at 5 MB, keeping up to 5 files each.",
    "button": "Open Logs Folder"
  },
  "toast": {
    "open-failed-title": "Failed to Open Logs Folder"
  }
}
```

In `hu.json` the same structure: `"logs": "Naplók"`, and

```json
"logs": {
  "open-folder": {
    "label": "Naplófájlok",
    "sub": "A BitButler main.log és renderer.log fájlokat ír, 5 MB-onként forgatva, processzenként legfeljebb 5 fájlt megtartva.",
    "button": "Naplómappa megnyitása"
  },
  "toast": {
    "open-failed-title": "A naplómappa megnyitása sikertelen"
  }
}
```

Run `npx prettier --write` on the touched files.

- [ ] **Step 5: Run tests and lint**

Run: `npm test --workspace=packages/app -- --include='**/general.spec.ts'` then `npm run lint`
Expected: PASS, zero warnings.

- [ ] **Step 6: Commit**

```bash
git add -A packages/app
git commit -m "#329: add an Open Logs Folder button to the general settings"
```

---

### Task 6: Full verification and manual check

**Files:** none (fixes only if something fails).

- [ ] **Step 1: Full automated pass**

Run, in order: `npm run lint`, `npm test`, `npm run build:electron`, `npm run build`
Expected: zero lint warnings, all tests pass, both builds succeed. Fix anything that fails in the task that owns it and re-run.

- [ ] **Step 2: Leftover scan**

Run: `grep -rn "insertLog\|FROM logs\|INTO logs\|log:list\|log:clear\|log:export" packages --include=*.ts --exclude-dir=node_modules --exclude-dir=dist --exclude-dir=.angular`
Expected: no results.

- [ ] **Step 3: Manual run (use the `run` skill / `npm start`)**

Check, and report what was observed (do not claim success without looking):

1. After startup, `main.log` and `renderer.log` exist in the folder opened by Help > Open Logs Folder (Windows: `%APPDATA%\bitbutler\logs`).
2. A main log line looks like `[2026-10-09 12:00:00.000] [info] [packages/electron/src/main.ts:NN] [BitButler] Starting (...)`; a renderer line carries a `packages/app/src/...` path; an object logged from the renderer is readable JSON, not `[object]`.
3. The same button in Settings > General opens the folder, and the Help menu item works while logged out (login page).
4. Temporarily set `MAX_LOG_FILE_SIZE` to `20 * 1024`, log enough to rotate several times, confirm `main.1.log` ... `main.4.log` appear and there is never a `main.5.log`; restore the constant.
5. Open an existing profile that still has a `logs` table: after startup the DB no longer has it (`sqlite3 bitbutler.db ".tables"`), and the DB file shrank.

- [ ] **Step 4: Remove spec and plan, per CLAUDE.md, in their own commit**

Only when everything above passed and before the PR is opened:

```bash
git rm -r docs
git commit -m "#329: removed spec and plan"
```
