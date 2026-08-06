# Database-backed Logging Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace BitButler's file-based `electron-log` logging with rows written to a new `logs` table in the existing SQLite database, self-pruned by a hardcoded 30-day retention trigger, and remove the now-obsolete "Open Log Path" debug menu item.

**Architecture:** `packages/electron/src/db.ts` gains a `logs` table, a `timestamp` index, and an `AFTER INSERT` trigger that deletes rows older than 30 days on every write. `packages/electron/src/logger.ts` keeps its existing console-monkey-patching and renderer `console-message` hook, but writes rows to that table via a prepared statement instead of formatting lines for an `electron-log` file transport. The `electron-log` dependency and its file-rotation logic (`formatTimestamp`, `archiveLog`) are deleted entirely, as is the dev-only "Open Log Path" menu item in `menu.ts` that opened the (now nonexistent) log folder.

**Tech Stack:** TypeScript, better-sqlite3, Electron main process, Vitest.

## Global Constraints

- `timestamp` is stored as milliseconds since epoch (`Date.now()`), not seconds - this is what later Angular code will feed into `new Date(timestamp)`.
- `process` column values are exactly `'main'` or `'renderer'`.
- `level` column values are exactly `'debug'`, `'info'`, `'warn'`, `'error'`.
- Retention is a hardcoded 30 days for this plan - not configurable, not read from the `settings` table. Configurability is future UI-step work, out of scope here.
- No new IPC surface for querying/paginating logs - out of scope here.
- `npm run lint` must stay at zero warnings (enforced by CI and pre-commit hooks) - do not leave unused imports/vars behind after deleting code.
- Commit message format: `#261: <description>` (this work tracks GitHub issue #261).

---

### Task 1: Add the `logs` table, index, and retention trigger to the database

**Files:**

- Modify: `packages/electron/src/db.ts:80-120` (insert new schema block before `export default db;`)
- Create: `packages/electron/src/db.spec.ts`

**Interfaces:**

- Produces: a `logs` SQLite table reachable through the default-exported `db` from `./db.js`, with columns `id INTEGER PRIMARY KEY AUTOINCREMENT`, `timestamp INTEGER NOT NULL`, `process TEXT NOT NULL CHECK (process IN ('main','renderer'))`, `level TEXT NOT NULL CHECK (level IN ('debug','info','warn','error'))`, `message TEXT NOT NULL`. Rows are inserted with `db.prepare('INSERT INTO logs (timestamp, process, level, message) VALUES (?, ?, ?, ?)').run(timestamp, process, level, message)`. An `AFTER INSERT` trigger named `trg_logs_retention` prunes rows older than 30 days on every insert.

- [ ] **Step 1: Write the failing tests**

Create `packages/electron/src/db.spec.ts`. This test overrides the `better-sqlite3` constructor so the real `db.ts` module runs its real schema SQL against a genuine in-memory database (not a mock), which is the only way to actually exercise the trigger's SQL logic:

```typescript
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('electron', () => ({
  app: { getPath: () => '/fake' },
}));

vi.mock('better-sqlite3', async () => {
  const actual = await vi.importActual<typeof import('better-sqlite3')>('better-sqlite3');
  const RealDatabase = actual.default;
  return {
    default: class extends RealDatabase {
      constructor() {
        super(':memory:');
      }
    },
  };
});

describe('logs table', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('accepts a row with a valid process and level', async () => {
    const { default: db } = await import('./db.js');
    expect(() =>
      db
        .prepare('INSERT INTO logs (timestamp, process, level, message) VALUES (?, ?, ?, ?)')
        .run(Date.now(), 'main', 'info', 'hello'),
    ).not.toThrow();
  });

  it('rejects an invalid process value', async () => {
    const { default: db } = await import('./db.js');
    expect(() =>
      db
        .prepare('INSERT INTO logs (timestamp, process, level, message) VALUES (?, ?, ?, ?)')
        .run(Date.now(), 'worker', 'info', 'hello'),
    ).toThrow();
  });

  it('rejects an invalid level value', async () => {
    const { default: db } = await import('./db.js');
    expect(() =>
      db
        .prepare('INSERT INTO logs (timestamp, process, level, message) VALUES (?, ?, ?, ?)')
        .run(Date.now(), 'main', 'verbose', 'hello'),
    ).toThrow();
  });
});

describe('logs retention trigger', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('deletes rows older than 30 days when a new row is inserted', async () => {
    const { default: db } = await import('./db.js');
    const insert = db.prepare(
      'INSERT INTO logs (timestamp, process, level, message) VALUES (?, ?, ?, ?)',
    );
    const THIRTY_ONE_DAYS_MS = 31 * 24 * 60 * 60 * 1000;
    insert.run(Date.now() - THIRTY_ONE_DAYS_MS, 'main', 'info', 'old entry');

    insert.run(Date.now(), 'main', 'info', 'new entry');

    const rows = db.prepare('SELECT message FROM logs').all() as { message: string }[];
    expect(rows).toEqual([{ message: 'new entry' }]);
  });

  it('keeps rows within the retention window', async () => {
    const { default: db } = await import('./db.js');
    const insert = db.prepare(
      'INSERT INTO logs (timestamp, process, level, message) VALUES (?, ?, ?, ?)',
    );
    const TWENTY_NINE_DAYS_MS = 29 * 24 * 60 * 60 * 1000;
    insert.run(Date.now() - TWENTY_NINE_DAYS_MS, 'main', 'info', 'recent entry');

    insert.run(Date.now(), 'main', 'info', 'new entry');

    const rows = db.prepare('SELECT message FROM logs').all() as { message: string }[];
    expect(rows).toHaveLength(2);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test --workspace=packages/electron -- db.spec.ts`
Expected: FAIL - all five tests error with `SqliteError: no such table: logs` (the table doesn't exist yet).

- [ ] **Step 3: Add the schema to `db.ts`**

Open `packages/electron/src/db.ts`. Insert this block immediately before the final `export default db;` line (currently line 120):

```typescript
db.exec(`
  CREATE TABLE IF NOT EXISTS logs (
    id        INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp INTEGER NOT NULL,
    process   TEXT NOT NULL CHECK (process IN ('main','renderer')),
    level     TEXT NOT NULL CHECK (level IN ('debug','info','warn','error')),
    message   TEXT NOT NULL
  );
`);

db.exec(`
  CREATE INDEX IF NOT EXISTS idx_logs_timestamp
  ON logs(timestamp);
`);

db.exec(`
  CREATE TRIGGER IF NOT EXISTS trg_logs_retention
  AFTER INSERT ON logs
  BEGIN
    DELETE FROM logs
    WHERE timestamp < (CAST(strftime('%s','now') AS INTEGER) - 30*24*60*60) * 1000;
  END;
`);
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test --workspace=packages/electron -- db.spec.ts`
Expected: PASS - all five tests green.

- [ ] **Step 5: Commit**

```bash
git add packages/electron/src/db.ts packages/electron/src/db.spec.ts
git commit -m "#261: add logs table with 30-day retention trigger"
```

---

### Task 2: Rewrite the logger to write to the database instead of a file

**Files:**

- Modify: `packages/electron/src/logger.ts` (full rewrite)
- Modify: `packages/electron/src/logger.spec.ts` (full rewrite)
- Modify: `packages/electron/package.json:6-9` (remove `electron-log` dependency)

**Interfaces:**

- Consumes: the `logs` table from Task 1, written via `db.prepare('INSERT INTO logs (timestamp, process, level, message) VALUES (?, ?, ?, ?)')` on the default-exported `db` from `./db.js`.
- Produces: `initLogger(): void` and `hookRenderer(window: BrowserWindow): void` - same names and signatures as before, so `packages/electron/src/main.ts` (which imports `{ hookRenderer, initLogger } from './logger.js'`) needs no changes.

- [ ] **Step 1: Write the failing tests**

Replace the entire contents of `packages/electron/src/logger.spec.ts` with:

```typescript
import { type BrowserWindow } from 'electron';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mockRun = vi.hoisted(() => vi.fn());

vi.mock('electron', () => ({
  app: { getPath: () => '/fake' },
}));

vi.mock('./db.js', () => ({
  default: {
    prepare: () => ({ run: mockRun }),
  },
}));

describe('initLogger', () => {
  let originalConsole: Record<string, (...args: unknown[]) => void>;

  beforeEach(() => {
    vi.resetModules();
    mockRun.mockReset();
    originalConsole = {
      log: console.log,
      debug: console.debug,
      info: console.info,
      warn: console.warn,
      error: console.error,
    };
  });

  afterEach(() => {
    vi.clearAllMocks();
    Object.assign(console, originalConsole);
    process.removeAllListeners('uncaughtException');
    process.removeAllListeners('unhandledRejection');
  });

  it.each([
    ['log', 'debug'],
    ['debug', 'debug'],
    ['info', 'info'],
    ['warn', 'warn'],
    ['error', 'error'],
  ])(
    'inserts a "main" row at level "%s" for console.%s and preserves terminal output',
    async (method, expectedLevel) => {
      const spy = vi.fn();
      (console as unknown as Record<string, unknown>)[method] = spy;
      const { initLogger } = await import('./logger.js');
      initLogger();

      (console as unknown as Record<string, (...args: unknown[]) => void>)[method]('hello', 42);

      expect(spy).toHaveBeenCalledWith('hello', 42);
      expect(mockRun).toHaveBeenCalledWith(expect.any(Number), 'main', expectedLevel, 'hello 42');
    },
  );

  it('inserts a "main" "error" row on uncaught exceptions and rethrows', async () => {
    const { initLogger } = await import('./logger.js');
    initLogger();
    const error = new Error('boom');

    expect(() => process.emit('uncaughtException', error)).toThrow('boom');

    expect(mockRun).toHaveBeenCalledWith(
      expect.any(Number),
      'main',
      'error',
      expect.stringContaining('Uncaught exception:'),
    );
  });

  it('inserts a "main" "error" row on unhandled rejections without throwing', async () => {
    const { initLogger } = await import('./logger.js');
    initLogger();

    expect(() =>
      process.emit('unhandledRejection', new Error('nope'), Promise.resolve()),
    ).not.toThrow();

    expect(mockRun).toHaveBeenCalledWith(
      expect.any(Number),
      'main',
      'error',
      expect.stringContaining('Unhandled rejection:'),
    );
  });
});

describe('hookRenderer', () => {
  let consoleMessageHandler: (details: {
    level: string;
    message: string;
    lineNumber: number;
    sourceId: string;
  }) => void;
  let mockWindow: { webContents: { on: ReturnType<typeof vi.fn> } };

  beforeEach(() => {
    vi.resetModules();
    mockRun.mockReset();
    mockWindow = {
      webContents: {
        on: vi.fn((event: string, handler: typeof consoleMessageHandler) => {
          if (event === 'console-message') consoleMessageHandler = handler;
        }),
      },
    };
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('attaches a console-message listener to webContents', async () => {
    const { hookRenderer } = await import('./logger.js');
    hookRenderer(mockWindow as unknown as BrowserWindow);
    expect(mockWindow.webContents.on).toHaveBeenCalledWith('console-message', expect.any(Function));
  });

  it.each([
    ['debug', 'debug'],
    ['info', 'info'],
    ['warning', 'warn'],
    ['error', 'error'],
  ])('inserts a "renderer" row mapping level "%s" to "%s"', async (level, expectedLevel) => {
    const { hookRenderer } = await import('./logger.js');
    hookRenderer(mockWindow as unknown as BrowserWindow);

    consoleMessageHandler({ level, message: 'test message', lineNumber: 10, sourceId: 'app.js' });

    expect(mockRun).toHaveBeenCalledWith(
      expect.any(Number),
      'renderer',
      expectedLevel,
      'test message (app.js:10)',
    );
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test --workspace=packages/electron -- logger.spec.ts`
Expected: FAIL - `mockRun` was never called (the current `logger.ts` still writes to `electron-log`'s file transport, not the mocked `./db.js`), and the `db.js` mock is unused by the old implementation.

- [ ] **Step 3: Rewrite `logger.ts`**

Replace the entire contents of `packages/electron/src/logger.ts` with:

```typescript
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
  stmtInsertLog.run(Date.now(), processName, level, message);
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
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test --workspace=packages/electron -- logger.spec.ts`
Expected: PASS - all tests green.

- [ ] **Step 5: Remove the `electron-log` dependency**

Edit `packages/electron/package.json`. Remove the `"electron-log": "^5.4.4",` line from `dependencies` (the file should end up with only `"@bitbutler/shared": "*"` under `dependencies`). Then from the repo root, run:

```bash
npm install
```

Expected: `package-lock.json` updates to drop `electron-log` and its now-unused transitive deps; no errors.

- [ ] **Step 6: Run the full electron package test suite**

Run: `npm test --workspace=packages/electron`
Expected: PASS - no leftover references to `electron-log` anywhere (confirm with a quick search if anything fails).

- [ ] **Step 7: Commit**

```bash
git add packages/electron/src/logger.ts packages/electron/src/logger.spec.ts packages/electron/package.json package-lock.json
git commit -m "#261: write logs to the database instead of a file"
```

---

### Task 3: Remove the obsolete "Open Log Path" debug menu item

**Files:**

- Modify: `packages/electron/src/menu.ts:88-97`
- Modify: `packages/electron/src/menu.spec.ts` (remove one test, two now-unused mocks)

**Interfaces:**

- Consumes: nothing from Task 1/2 - independent cleanup.
- Produces: no change to any exported signature; `rebuildMenu` still exists with the same shape, just without the "Open Log Path" item in the dev-only "Debug" submenu.

This is a pure removal - there's no new behavior to drive with a failing test, so the verification here is: remove the code, remove the test that asserted it, then confirm the rest of the suite and lint stay green.

- [ ] **Step 1: Remove the menu item from `menu.ts`**

In `packages/electron/src/menu.ts`, delete this block (currently lines 93-97), which sits between the "Open DevTools" item and the `{ type: 'separator' }` that precedes "Show a Notification":

```typescript
            {
              label: 'Open Log Path',
              accelerator: 'CmdOrCtrl+Alt+L',
              click: () => shell.openPath(app.getPath('logs')),
            },
```

Leave the `{ type: 'separator' }` in place - it still separates the "Open DevTools" item from the "Show a Notification"/"Show a toast" debug groups below it.

- [ ] **Step 2: Remove the corresponding test and unused mocks from `menu.spec.ts`**

In `packages/electron/src/menu.spec.ts`:

1. Delete the test (currently lines 276-283):

```typescript
it('opens the log folder when Open Log Path is clicked', async () => {
  const template = await buildMenu();
  const item = findItem(template, byLabel('Open Log Path'))!;
  expect(item.accelerator).toBe('CmdOrCtrl+Alt+L');
  (item.click as () => void)();
  expect(mockAppGetPath).toHaveBeenCalledWith('logs');
  expect(mockShellOpenPath).toHaveBeenCalledWith('/fake/logs');
});
```

2. Delete the now-unused mock declarations (currently lines 8-9):

```typescript
const mockAppGetPath = vi.hoisted(() => vi.fn(() => '/fake/logs'));
const mockShellOpenPath = vi.hoisted(() => vi.fn());
```

3. Update the `appMock` declaration (currently line 20) from:

```typescript
const appMock = vi.hoisted(() => ({ isPackaged: false, getPath: mockAppGetPath }));
```

to:

```typescript
const appMock = vi.hoisted(() => ({ isPackaged: false }));
```

4. Update the `electron` mock's `shell` field (currently line 28) from:

```typescript
  shell: { openPath: mockShellOpenPath, openExternal: mockShellOpenExternal },
```

to:

```typescript
  shell: { openExternal: mockShellOpenExternal },
```

- [ ] **Step 3: Run the electron package test suite**

Run: `npm test --workspace=packages/electron`
Expected: PASS - the removed test is gone, all remaining tests (including the other "Debug" submenu tests) still pass.

- [ ] **Step 4: Run lint**

Run: `npm run lint`
Expected: PASS with zero warnings - confirms no unused imports/vars were left behind in either file.

- [ ] **Step 5: Commit**

```bash
git add packages/electron/src/menu.ts packages/electron/src/menu.spec.ts
git commit -m "#261: remove obsolete Open Log Path debug menu item"
```

---

### Task 4: Full verification

**Files:** none (verification only).

**Interfaces:** none.

- [ ] **Step 1: Run the full test suite across all workspaces**

Run: `npm test`
Expected: PASS.

- [ ] **Step 2: Run lint across the whole repo**

Run: `npm run lint`
Expected: PASS with zero warnings.

- [ ] **Step 3: Compile the Electron TypeScript**

Run: `npm run build:electron`
Expected: PASS - confirms no leftover type errors from the removed `electron-log` types or deleted exports (`formatTimestamp`, `archiveLog`, `log`) anywhere else in the codebase.

- [ ] **Step 4: Confirm no remaining references to removed code**

Run: `grep -rn "electron-log\|formatTimestamp\|archiveLog" packages/electron/src packages/electron/package.json`
Expected: no matches.
