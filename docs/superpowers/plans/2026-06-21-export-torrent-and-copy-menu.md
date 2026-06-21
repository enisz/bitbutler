# Export .torrent + Copy menu rework Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a per-torrent "Export .torrent" context menu action gated by a cached `export_available` server field, and rework the "Copy" submenu into a fixed set of fields, with hover tooltips on disabled menu items throughout.

**Architecture:** A nullable `export_available` column on `servers` is probed lazily at login and read synchronously by the grid's context menu service to decide enabled/disabled state with zero extra network calls. A new electron IPC handler fetches and writes `.torrent` files via the existing `qbRequest` helper. The existing bulk `.bbe` export's legacy/full-mode detection switches from a live probe to reading the same cached field. Context-menu tooltips for disabled items use the Popover API, which requires disabled items to stop using the native `disabled` attribute (Chromium blocks hover on disabled buttons).

**Tech Stack:** Angular 20 (signals), Electron 39, better-sqlite3, Vitest.

## Global Constraints

- Issue: #177. Branch: `177-export-torrent-and-copy-menu` (already created and checked out).
- Commit format: `#177: short description`.
- `export_available` is nullable (`0 | 1 | null`), never `-1`. `NULL` = not yet checked.
- No success toast for the export action; only failures toast. Consistent with delete/pause/etc.
- All new UI strings need both `public/i18n/us.json` and `public/i18n/hu.json` entries.
- Spec: `docs/superpowers/specs/2026-06-21-export-torrent-and-copy-menu-design.md` (read this for full rationale; this plan assumes it).

---

### Task 1: `export_available` field — shared types, DB schema, electron `server.ts`

**Files:**

- Modify: `packages/shared/src/models/server.model.ts`
- Modify: `packages/shared/src/ipc.types.ts`
- Modify: `packages/electron/src/db.ts`
- Modify: `packages/electron/src/ipc/server.ts`
- Test: `packages/electron/src/ipc/server.spec.ts`

**Interfaces:**

- Produces: `ServerRecord.export_available: 0 | 1 | null`; electron-side `getExportAvailable(id: string): 0 | 1 | null` and `setExportAvailable(id: string, value: 0 | 1): void` (named exports from `server.ts`, consumed by Task 2); IPC channel `server:set-export-available`; `BitButlerAPI.server.setExportAvailable(payload: { id: string; value: 0 | 1 }): Promise<{ updated: boolean }>`.

- [ ] **Step 1: Add `export_available` to `ServerRecord`**

In `packages/shared/src/models/server.model.ts`, change:

```ts
export interface ServerRecord {
  id: string;
  name: string;
  host: string;
  protocol: ServerProtocol;
  port: number;
  username: string;
  auto_login: boolean;
  created_at: string;
  has_password: boolean;
}
```

to:

```ts
export interface ServerRecord {
  id: string;
  name: string;
  host: string;
  protocol: ServerProtocol;
  port: number;
  username: string;
  auto_login: boolean;
  created_at: string;
  has_password: boolean;
  export_available: 0 | 1 | null;
}
```

Do not add it to `NewServer` — it must not appear in the server editor form.

- [ ] **Step 2: Add the `server:set-export-available` method to the shared IPC contract**

In `packages/shared/src/ipc.types.ts`, find the `server: { ... }` block inside `BitButlerAPI` (around line 173) and add a line after `getByHost`:

```ts
  server: {
    list(): Promise<ServerRecord[]>;
    add(server: NewServer): Promise<{ id: string }>;
    update(payload: { id: string; changes: Partial<NewServer> }): Promise<{ updated: boolean }>;
    delete(payload: { id: string }): Promise<{ deleted: boolean }>;
    getById(payload: { id: string }): Promise<ServerRecord | null>;
    getByHost(payload: { host: string }): Promise<ServerRecord | null>;
    setExportAvailable(payload: { id: string; value: 0 | 1 }): Promise<{ updated: boolean }>;
    setActive(id: string | null): void;
  };
```

- [ ] **Step 3: Write the failing server.spec.ts tests for the new helpers**

Add to `packages/electron/src/ipc/server.spec.ts`, after the existing `describe('serverList', ...)` block:

```ts
describe('serverList export_available mapping', () => {
  beforeEach(() => {
    vi.resetModules();
    ipcHandlers.clear();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('passes through export_available = 1 unchanged', async () => {
    mockAll.mockReturnValue([
      {
        id: 'abc',
        name: 'Local',
        host: 'localhost',
        protocol: 'http',
        port: 8080,
        username: 'admin',
        auto_login: 1,
        created_at: '2024-01-01T00:00:00.000Z',
        has_password: 1,
        export_available: 1,
      },
    ]);
    const { serverList } = await import('./server.js');
    expect(serverList()[0].export_available).toBe(1);
  });

  it('passes through export_available = null unchanged', async () => {
    mockAll.mockReturnValue([
      {
        id: 'abc',
        name: 'Local',
        host: 'localhost',
        protocol: 'http',
        port: 8080,
        username: 'admin',
        auto_login: 1,
        created_at: '2024-01-01T00:00:00.000Z',
        has_password: 1,
        export_available: null,
      },
    ]);
    const { serverList } = await import('./server.js');
    expect(serverList()[0].export_available).toBeNull();
  });
});

describe('getExportAvailable', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('returns the cached value for a known server', async () => {
    mockGet.mockReturnValue({
      id: 'srv-1',
      name: 'Test',
      host: 'localhost',
      protocol: 'http',
      port: 8080,
      username: 'admin',
      auto_login: 0,
      created_at: '',
      has_password: 1,
      export_available: 1,
    });
    const { getExportAvailable } = await import('./server.js');
    expect(getExportAvailable('srv-1')).toBe(1);
  });

  it('returns null when the server is not found', async () => {
    mockGet.mockReturnValue(undefined);
    const { getExportAvailable } = await import('./server.js');
    expect(getExportAvailable('missing')).toBeNull();
  });
});

describe('setExportAvailable', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('runs an UPDATE with the given id and value', async () => {
    const { setExportAvailable } = await import('./server.js');
    setExportAvailable('srv-1', 1);
    expect(mockRun).toHaveBeenCalledWith(1, 'srv-1');
  });
});

describe('server:set-export-available IPC handler', () => {
  beforeEach(() => {
    vi.resetModules();
    ipcHandlers.clear();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  async function getHandler() {
    const { registerServerIpcHandlers } = await import('./server.js');
    registerServerIpcHandlers();
    return ipcHandlers.get('server:set-export-available')!;
  }

  it('returns { updated: true } and writes the value', async () => {
    const handler = await getHandler();
    const result = await handler(null, { id: 'srv-1', value: 1 });
    expect(result).toEqual({ updated: true });
    expect(mockRun).toHaveBeenCalledWith(1, 'srv-1');
  });

  it('throws when value is not 0 or 1', async () => {
    const handler = await getHandler();
    await expect(handler(null, { id: 'srv-1', value: 2 })).rejects.toThrow(
      "Field 'value' must be 0 or 1.",
    );
  });

  it('throws when id is missing', async () => {
    const handler = await getHandler();
    await expect(handler(null, { value: 1 })).rejects.toThrow("Field 'id' is required.");
  });
});
```

- [ ] **Step 4: Run the new tests to verify they fail**

Run: `npm run test --workspace=packages/electron`
Expected: FAIL — `export_available` is `undefined` in mapped records, `getExportAvailable`/`setExportAvailable` are not exported, and the `server:set-export-available` handler doesn't exist.

- [ ] **Step 5: Add the column to the DB schema**

In `packages/electron/src/db.ts`, change the `CREATE TABLE IF NOT EXISTS servers` block to add the column:

```ts
db.exec(`
  CREATE TABLE IF NOT EXISTS servers (
    id           TEXT PRIMARY KEY,
    name         TEXT NOT NULL,
    host         TEXT NOT NULL,
    protocol     TEXT NOT NULL CHECK (protocol IN ('http','https')),
    port         INTEGER NOT NULL CHECK (port BETWEEN 1 AND 65535),
    username     TEXT NOT NULL,
    password     BLOB NOT NULL,
    auto_login   INTEGER NOT NULL DEFAULT 0 CHECK (auto_login IN (0,1)),
    created_at   TEXT NOT NULL,
    export_available INTEGER CHECK (export_available IN (0,1))
  );
`);
```

Then, immediately after the existing nullable-password migration block (the one that ends with the `uq_servers_auto_login` index recreation, right before the `settings` table creation), add a guarded migration for existing installs:

```ts
// Migrate: add export_available column (nullable - NULL means "not yet checked").
const colsAfterPasswordMigration = db.pragma('table_info(servers)') as ColInfo[];
if (!colsAfterPasswordMigration.find((c) => c.name === 'export_available')) {
  db.exec(`
    ALTER TABLE servers ADD COLUMN export_available INTEGER CHECK (export_available IN (0,1))
  `);
}
```

- [ ] **Step 6: Update `server.ts` to read/write the new column**

In `packages/electron/src/ipc/server.ts`:

Add `export_available: number | null;` to the `ServerRow` interface:

```ts
interface ServerRow {
  id: string;
  name: string;
  host: string;
  protocol: string;
  port: number;
  username: string;
  password: Buffer;
  auto_login: number;
  created_at: string;
  has_password: number;
  export_available: number | null;
}
```

Add `export_available,` to the three `SELECT` statements (`stmtList`, `stmtGetById`, `stmtGetByHost`), e.g.:

```ts
const stmtList = db.prepare<[], ServerRow>(`
  SELECT
    id, name, host, protocol, port, username,
    auto_login,
    export_available,
    created_at,
    CASE WHEN password IS NOT NULL THEN 1 ELSE 0 END as has_password
  FROM servers
  ORDER BY datetime(created_at) DESC
`);
```

(apply the same `export_available,` addition to `stmtGetById` and `stmtGetByHost`).

Add the new prepared statement, near `stmtUnsetAutoLogin`/`stmtSetAutoLogin`:

```ts
const stmtSetExportAvailable = db.prepare<[number, string]>(`
  UPDATE servers SET export_available = ? WHERE id = ?
`);
```

Update `rowToRecord` to pass the field through unchanged (it's already `0 | 1 | null` compatible — no boolean coercion like `auto_login`):

```ts
function rowToRecord(row: ServerRow): ServerRecord {
  return {
    id: row.id,
    name: row.name,
    host: row.host,
    protocol: row.protocol as ServerRecord['protocol'],
    port: row.port,
    username: row.username,
    auto_login: row.auto_login === 1,
    created_at: row.created_at,
    has_password: row.has_password === 1,
    export_available: row.export_available as 0 | 1 | null,
  };
}
```

Add the two new exported functions, near `serverGetByHost`:

```ts
export function getExportAvailable(id: string): 0 | 1 | null {
  const row = stmtGetById.get(id);
  return row ? (row.export_available as 0 | 1 | null) : null;
}

export function setExportAvailable(id: string, value: 0 | 1): void {
  stmtSetExportAvailable.run(value, id);
}
```

Register the new IPC handler inside `registerServerIpcHandlers()`, after the `server:getByHost` line:

```ts
ipcMain.handle('server:set-export-available', async (_event, payload: unknown) =>
  serverSetExportAvailable(payload),
);
```

And add the handler function near `serverGetByHost`:

```ts
function serverSetExportAvailable(payload: unknown): { updated: boolean } {
  const p = payload as Record<string, unknown>;
  const id = requireString(p?.id, 'id');
  const value = p?.value;
  if (value !== 0 && value !== 1) {
    throw new Error("Field 'value' must be 0 or 1.");
  }
  setExportAvailable(id, value);
  return { updated: true };
}
```

- [ ] **Step 7: Run the tests to verify they pass**

Run: `npm run test --workspace=packages/electron`
Expected: PASS — all new and existing `server.spec.ts` tests green.

- [ ] **Step 8: Bridge `setExportAvailable` in preload.ts**

In `packages/electron/src/preload.ts`, in the `server: { ... }` block, add after `getByHost`:

```ts
    getByHost: ({ host }) => ipcRenderer.invoke('server:getByHost', { host }),
    setExportAvailable: ({ id, value }) =>
      ipcRenderer.invoke('server:set-export-available', { id, value }),
    setActive: (id) => ipcRenderer.send('server:set-active', id),
```

- [ ] **Step 9: Build the electron and shared packages to verify no type errors**

Run: `npm run build:electron`
Expected: compiles with no TypeScript errors.

- [ ] **Step 10: Commit**

```bash
git add packages/shared/src/models/server.model.ts packages/shared/src/ipc.types.ts \
  packages/electron/src/db.ts packages/electron/src/ipc/server.ts \
  packages/electron/src/ipc/server.spec.ts packages/electron/src/preload.ts
git commit -m "#177: added export_available server field"
```

---

### Task 2: `export.ts` — cached full-mode resolution + check-availability + save-torrent-files

**Files:**

- Modify: `packages/shared/src/ipc.types.ts`
- Modify: `packages/shared/src/index.ts`
- Modify: `packages/electron/src/ipc/export.ts`
- Modify: `packages/electron/src/preload.ts`
- Test: `packages/electron/src/ipc/export.spec.ts`

**Interfaces:**

- Consumes: `getExportAvailable(id: string): 0 | 1 | null` from `server.ts` (Task 1).
- Produces: `resolveFullMode(serverId: string): Promise<boolean>` (exported from `export.ts`); IPC channels `export:check-availability` and `export:save-torrent-files`; `BitButlerAPI.export.checkAvailability(serverId: string): Promise<{ available: boolean }>` and `BitButlerAPI.export.saveTorrentFiles(payload: { serverId: string; items: ExportTorrentFileItem[] }): Promise<ExportTorrentFilesResult>`, both consumed by Task 3 (login) and Task 5 (context menu).

- [ ] **Step 1: Add the new shared types and IPC methods**

In `packages/shared/src/ipc.types.ts`, add near the other `Export*` types (after `ExportDoneEvent`, around line 92):

```ts
export interface ExportTorrentFileItem {
  hash: string;
  name: string;
}

export interface ExportTorrentFilesResult {
  cancelled: boolean;
  savedPaths: string[];
  failed: { hash: string; name: string; error: string }[];
}
```

In the `export: { ... }` block inside `BitButlerAPI`, add two methods after `getServerInfo`:

```ts
    getServerInfo(serverId: string): Promise<BbeServerInfo>;
    checkAvailability(serverId: string): Promise<{ available: boolean }>;
    saveTorrentFiles(payload: {
      serverId: string;
      items: ExportTorrentFileItem[];
    }): Promise<ExportTorrentFilesResult>;
```

In `packages/shared/src/index.ts`, add `ExportTorrentFileItem` and `ExportTorrentFilesResult` to the alphabetically-sorted type export list from `./ipc.types.js` (between `ExportStartPayload` and `ExportTagScope`):

```ts
  ExportStartPayload,
  ExportTagScope,
  ExportTorrentFileItem,
  ExportTorrentFilesResult,
  ImportRestoreField,
```

- [ ] **Step 2: Write the failing tests for `resolveFullMode`**

Add to `packages/electron/src/ipc/export.spec.ts`, after the `describe('applyPathMappings', ...)` block:

```ts
describe('resolveFullMode', () => {
  const mockGetExportAvailable = vi.hoisted(() => vi.fn());
  const mockQbRequestProbe = vi.hoisted(() => vi.fn());

  beforeEach(() => {
    vi.resetModules();
    vi.doMock('./server.js', () => ({ getExportAvailable: mockGetExportAvailable }));
    vi.doMock('./qbittorrent.js', () => ({ qbRequest: mockQbRequestProbe }));
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.doUnmock('./server.js');
    vi.doUnmock('./qbittorrent.js');
  });

  async function setup() {
    return import('./export.js');
  }

  it('returns true without probing when cached value is 1', async () => {
    mockGetExportAvailable.mockReturnValue(1);
    const { resolveFullMode } = await setup();
    expect(await resolveFullMode('server-1')).toBe(true);
    expect(mockQbRequestProbe).not.toHaveBeenCalled();
  });

  it('returns false without probing when cached value is 0', async () => {
    mockGetExportAvailable.mockReturnValue(0);
    const { resolveFullMode } = await setup();
    expect(await resolveFullMode('server-1')).toBe(false);
    expect(mockQbRequestProbe).not.toHaveBeenCalled();
  });

  it('probes live when cached value is null', async () => {
    mockGetExportAvailable.mockReturnValue(null);
    mockQbRequestProbe.mockResolvedValue(Buffer.from(''));
    const { resolveFullMode } = await setup();
    expect(await resolveFullMode('server-1')).toBe(true);
    expect(mockQbRequestProbe).toHaveBeenCalled();
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `npm run test --workspace=packages/electron -- export.spec`
Expected: FAIL — `resolveFullMode` is not exported from `export.js`.

- [ ] **Step 4: Implement `resolveFullMode` and use it in the two existing call sites**

In `packages/electron/src/ipc/export.ts`, add the import:

```ts
import { getExportAvailable } from './server.js';
```

Add the new exported function, right after `probeFullMode`:

```ts
export async function resolveFullMode(serverId: string): Promise<boolean> {
  const cached = getExportAvailable(serverId);
  return cached === null ? probeFullMode(serverId) : cached === 1;
}
```

In the `export:get-server-info` handler, replace `probeFullMode(serverId)` with `resolveFullMode(serverId)`:

```ts
ipcMain.handle('export:get-server-info', async (_event, { serverId }: { serverId: string }) => {
  const [webapiVersion, qbVersion, isFullMode] = await Promise.all([
    qbRequest({ id: serverId, path: '/api/v2/app/webapiVersion' }) as Promise<string>,
    qbRequest({ id: serverId, path: '/api/v2/app/version' }) as Promise<string>,
    resolveFullMode(serverId),
  ]);
  return { webapiVersion: webapiVersion.trim(), qbVersion: qbVersion.trim(), isFullMode };
});
```

In `runExport`, replace `const isFullMode = await probeFullMode(serverId);` with:

```ts
const isFullMode = await resolveFullMode(serverId);
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npm run test --workspace=packages/electron -- export.spec`
Expected: PASS.

- [ ] **Step 6: Write the failing tests for `export:check-availability`**

Add to `packages/electron/src/ipc/export.spec.ts`:

```ts
describe('export:check-availability IPC handler', () => {
  const ipcHandlersCheck = vi.hoisted(() => new Map<string, (...args: unknown[]) => unknown>());
  const mockQbRequestAvail = vi.hoisted(() => vi.fn());

  beforeEach(() => {
    vi.resetModules();
    ipcHandlersCheck.clear();
    vi.doMock('electron', () => ({
      ipcMain: {
        handle: vi.fn((channel: string, handler: (...args: unknown[]) => unknown) => {
          ipcHandlersCheck.set(channel, handler);
        }),
        on: vi.fn(),
      },
      dialog: { showSaveDialog: vi.fn(), showOpenDialog: vi.fn() },
    }));
    vi.doMock('./qbittorrent.js', () => ({ qbRequest: mockQbRequestAvail }));
    vi.doMock('./server.js', () => ({ getExportAvailable: vi.fn() }));
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.doUnmock('electron');
    vi.doUnmock('./qbittorrent.js');
    vi.doUnmock('./server.js');
  });

  it('returns { available: true } when the probe succeeds', async () => {
    mockQbRequestAvail.mockResolvedValue(Buffer.from(''));
    const { registerExportIpcHandlers } = await import('./export.js');
    registerExportIpcHandlers();
    const handler = ipcHandlersCheck.get('export:check-availability')!;
    expect(await handler(null, { serverId: 'server-1' })).toEqual({ available: true });
  });

  it('returns { available: false } when the probe gets a 404', async () => {
    mockQbRequestAvail.mockRejectedValue(JSON.stringify({ status: 404 }));
    const { registerExportIpcHandlers } = await import('./export.js');
    registerExportIpcHandlers();
    const handler = ipcHandlersCheck.get('export:check-availability')!;
    expect(await handler(null, { serverId: 'server-1' })).toEqual({ available: false });
  });
});
```

- [ ] **Step 7: Run the test to verify it fails**

Run: `npm run test --workspace=packages/electron -- export.spec`
Expected: FAIL — `export:check-availability` is never registered.

- [ ] **Step 8: Register the `export:check-availability` handler**

In `registerExportIpcHandlers()` in `packages/electron/src/ipc/export.ts`, add after the `export:get-server-info` handler:

```ts
ipcMain.handle('export:check-availability', async (_event, { serverId }: { serverId: string }) => ({
  available: await probeFullMode(serverId),
}));
```

- [ ] **Step 9: Run the test to verify it passes**

Run: `npm run test --workspace=packages/electron -- export.spec`
Expected: PASS.

- [ ] **Step 10: Write the failing tests for `export:save-torrent-files`**

Add to `packages/electron/src/ipc/export.spec.ts`:

```ts
describe('export:save-torrent-files IPC handler', () => {
  const ipcHandlersSave = vi.hoisted(() => new Map<string, (...args: unknown[]) => unknown>());
  const mockShowSaveDialog = vi.hoisted(() => vi.fn());
  const mockShowOpenDialog = vi.hoisted(() => vi.fn());
  const mockQbRequestSave = vi.hoisted(() => vi.fn());
  const mockWriteFile = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));

  beforeEach(() => {
    vi.resetModules();
    ipcHandlersSave.clear();
    vi.doMock('electron', () => ({
      ipcMain: {
        handle: vi.fn((channel: string, handler: (...args: unknown[]) => unknown) => {
          ipcHandlersSave.set(channel, handler);
        }),
        on: vi.fn(),
      },
      dialog: { showSaveDialog: mockShowSaveDialog, showOpenDialog: mockShowOpenDialog },
    }));
    vi.doMock('./qbittorrent.js', () => ({ qbRequest: mockQbRequestSave }));
    vi.doMock('./server.js', () => ({ getExportAvailable: vi.fn() }));
    vi.doMock('node:fs', () => ({
      default: { promises: { writeFile: mockWriteFile } },
      promises: { writeFile: mockWriteFile },
    }));
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.doUnmock('electron');
    vi.doUnmock('./qbittorrent.js');
    vi.doUnmock('./server.js');
    vi.doUnmock('node:fs');
  });

  async function getHandler() {
    const { registerExportIpcHandlers } = await import('./export.js');
    registerExportIpcHandlers();
    return ipcHandlersSave.get('export:save-torrent-files')!;
  }

  it('returns cancelled when there are no items', async () => {
    const handler = await getHandler();
    const result = await handler(null, { serverId: 'server-1', items: [] });
    expect(result).toEqual({ cancelled: true, savedPaths: [], failed: [] });
  });

  it('shows a save dialog for a single item and writes the buffer', async () => {
    mockShowSaveDialog.mockResolvedValue({ canceled: false, filePath: '/tmp/My Torrent.torrent' });
    mockQbRequestSave.mockResolvedValue(Buffer.from('torrent-bytes'));
    const handler = await getHandler();
    const result = await handler(null, {
      serverId: 'server-1',
      items: [{ hash: 'abc', name: 'My Torrent' }],
    });
    expect(mockShowSaveDialog).toHaveBeenCalledWith(
      expect.objectContaining({ defaultPath: 'My Torrent.torrent' }),
    );
    expect(mockWriteFile).toHaveBeenCalledWith(
      '/tmp/My Torrent.torrent',
      Buffer.from('torrent-bytes'),
    );
    expect(result).toEqual({
      cancelled: false,
      savedPaths: ['/tmp/My Torrent.torrent'],
      failed: [],
    });
  });

  it('returns cancelled when the single-item save dialog is cancelled', async () => {
    mockShowSaveDialog.mockResolvedValue({ canceled: true, filePath: undefined });
    const handler = await getHandler();
    const result = await handler(null, {
      serverId: 'server-1',
      items: [{ hash: 'abc', name: 'My Torrent' }],
    });
    expect(result).toEqual({ cancelled: true, savedPaths: [], failed: [] });
    expect(mockQbRequestSave).not.toHaveBeenCalled();
  });

  it('shows a directory picker for multiple items and writes one file per item', async () => {
    mockShowOpenDialog.mockResolvedValue({ canceled: false, filePaths: ['/tmp/out'] });
    mockQbRequestSave.mockResolvedValue(Buffer.from('bytes'));
    const handler = await getHandler();
    const result = await handler(null, {
      serverId: 'server-1',
      items: [
        { hash: 'aaa', name: 'First' },
        { hash: 'bbb', name: 'Second' },
      ],
    });
    expect(mockWriteFile).toHaveBeenCalledWith(
      expect.stringContaining('First.torrent'),
      Buffer.from('bytes'),
    );
    expect(mockWriteFile).toHaveBeenCalledWith(
      expect.stringContaining('Second.torrent'),
      Buffer.from('bytes'),
    );
    expect(result.cancelled).toBe(false);
    expect(result.savedPaths).toHaveLength(2);
  });

  it('disambiguates a filename collision by appending the hash', async () => {
    mockShowOpenDialog.mockResolvedValue({ canceled: false, filePaths: ['/tmp/out'] });
    mockQbRequestSave.mockResolvedValue(Buffer.from('bytes'));
    const handler = await getHandler();
    const result = await handler(null, {
      serverId: 'server-1',
      items: [
        { hash: 'aaaaaaaa11', name: 'Same Name' },
        { hash: 'bbbbbbbb22', name: 'Same Name' },
      ],
    });
    expect(result.savedPaths.some((p: string) => p.includes('bbbbbbbb'))).toBe(true);
  });

  it('collects per-item failures without aborting the batch', async () => {
    mockShowOpenDialog.mockResolvedValue({ canceled: false, filePaths: ['/tmp/out'] });
    mockQbRequestSave
      .mockRejectedValueOnce(new Error('network error'))
      .mockResolvedValueOnce(Buffer.from('bytes'));
    const handler = await getHandler();
    const result = await handler(null, {
      serverId: 'server-1',
      items: [
        { hash: 'aaa', name: 'Fails' },
        { hash: 'bbb', name: 'Succeeds' },
      ],
    });
    expect(result.failed).toEqual([{ hash: 'aaa', name: 'Fails', error: 'network error' }]);
    expect(result.savedPaths).toHaveLength(1);
  });

  it('returns cancelled when the directory picker is cancelled', async () => {
    mockShowOpenDialog.mockResolvedValue({ canceled: true, filePaths: [] });
    const handler = await getHandler();
    const result = await handler(null, {
      serverId: 'server-1',
      items: [
        { hash: 'aaa', name: 'A' },
        { hash: 'bbb', name: 'B' },
      ],
    });
    expect(result).toEqual({ cancelled: true, savedPaths: [], failed: [] });
  });
});
```

- [ ] **Step 11: Run the test to verify it fails**

Run: `npm run test --workspace=packages/electron -- export.spec`
Expected: FAIL — `export:save-torrent-files` is never registered.

- [ ] **Step 12: Implement `sanitizeFilename` and `saveTorrentFiles`, register the handler**

In `packages/electron/src/ipc/export.ts`, add the import for `ExportTorrentFileItem`/`ExportTorrentFilesResult`:

```ts
import type {
  BbeMetadata,
  BbePathMapping,
  BbeTorrentEntry,
  BbeTorrentFile,
  ExportDoneEvent,
  ExportProgressEvent,
  ExportStartPayload,
  ExportTorrentFileItem,
  ExportTorrentFilesResult,
  ImportRestoreField,
  ImportStartPayload,
} from '@bitbutler/shared';
```

Register the handler in `registerExportIpcHandlers()`, after the `export:check-availability` handler added in Step 8:

```ts
ipcMain.handle(
  'export:save-torrent-files',
  async (_event, payload: { serverId: string; items: ExportTorrentFileItem[] }) =>
    saveTorrentFiles(payload),
);
```

Add the implementation functions near `buildExportEntry`:

```ts
function sanitizeFilename(name: string): string {
  return (name || 'torrent').replace(/[\\/:*?"<>|]/g, '_').trim() || 'torrent';
}

async function saveTorrentFiles(payload: {
  serverId: string;
  items: ExportTorrentFileItem[];
}): Promise<ExportTorrentFilesResult> {
  const { serverId, items } = payload;
  if (items.length === 0) return { cancelled: true, savedPaths: [], failed: [] };

  if (items.length === 1) {
    const { hash, name } = items[0];
    const { canceled, filePath } = await dialog.showSaveDialog({
      defaultPath: `${sanitizeFilename(name)}.torrent`,
      filters: [{ name: 'Torrent files', extensions: ['torrent'] }],
    });
    if (canceled || !filePath) return { cancelled: true, savedPaths: [], failed: [] };

    try {
      const buffer = (await qbRequest({
        id: serverId,
        path: '/api/v2/torrents/export',
        query: { hash },
        responseType: 'buffer',
      })) as Buffer;
      await fs.promises.writeFile(filePath, buffer);
      return { cancelled: false, savedPaths: [filePath], failed: [] };
    } catch (err) {
      return {
        cancelled: false,
        savedPaths: [],
        failed: [{ hash, name, error: (err as Error)?.message ?? String(err) }],
      };
    }
  }

  const { canceled, filePaths } = await dialog.showOpenDialog({ properties: ['openDirectory'] });
  if (canceled || !filePaths[0]) return { cancelled: true, savedPaths: [], failed: [] };
  const dir = filePaths[0];

  const usedNames = new Set<string>();
  const savedPaths: string[] = [];
  const failed: { hash: string; name: string; error: string }[] = [];

  for (const { hash, name } of items) {
    const base = sanitizeFilename(name);
    let filename = `${base}.torrent`;
    if (usedNames.has(filename)) filename = `${base}-${hash.slice(0, 8)}.torrent`;
    usedNames.add(filename);

    try {
      const buffer = (await qbRequest({
        id: serverId,
        path: '/api/v2/torrents/export',
        query: { hash },
        responseType: 'buffer',
      })) as Buffer;
      const fullPath = path.join(dir, filename);
      await fs.promises.writeFile(fullPath, buffer);
      savedPaths.push(fullPath);
    } catch (err) {
      failed.push({ hash, name, error: (err as Error)?.message ?? String(err) });
    }
  }

  return { cancelled: false, savedPaths, failed };
}
```

`dialog`, `fs`, `path`, and `qbRequest` are already imported at the top of `export.ts` — no new imports needed for those.

- [ ] **Step 13: Run the test to verify it passes**

Run: `npm run test --workspace=packages/electron -- export.spec`
Expected: PASS.

- [ ] **Step 14: Bridge the two new methods in preload.ts**

In `packages/electron/src/preload.ts`, in the `export: { ... }` block, add after `getServerInfo`:

```ts
    getServerInfo: (serverId: string) =>
      ipcRenderer.invoke('export:get-server-info', { serverId }) as Promise<BbeServerInfo>,
    checkAvailability: (serverId: string) =>
      ipcRenderer.invoke('export:check-availability', { serverId }) as Promise<{
        available: boolean;
      }>,
    saveTorrentFiles: (payload: { serverId: string; items: ExportTorrentFileItem[] }) =>
      ipcRenderer.invoke('export:save-torrent-files', payload) as Promise<ExportTorrentFilesResult>,
```

Add `ExportTorrentFileItem` and `ExportTorrentFilesResult` to the `import type { ... } from '@bitbutler/shared';` block at the top of the file.

- [ ] **Step 15: Run the full electron test suite and build**

Run: `npm run test --workspace=packages/electron && npm run build:electron`
Expected: all tests pass, build succeeds with no type errors.

- [ ] **Step 16: Commit**

```bash
git add packages/shared/src/ipc.types.ts packages/shared/src/index.ts \
  packages/electron/src/ipc/export.ts packages/electron/src/ipc/export.spec.ts \
  packages/electron/src/preload.ts
git commit -m "#177: added cached full-mode resolution and per-torrent .torrent export IPC"
```

---

### Task 3: Login-time `export_available` probe

**Files:**

- Modify: `packages/app/src/app/pages/login/login.ts`
- Modify: `packages/app/src/test-setup.ts`
- Test: `packages/app/src/app/pages/login/login.spec.ts`

**Interfaces:**

- Consumes: `window.bitbutler.export.checkAvailability(serverId: string): Promise<{ available: boolean }>` and `window.bitbutler.server.setExportAvailable(payload): Promise<{ updated: boolean }>` (Tasks 1–2); `ServerStoreService.refresh(): Promise<void>` and `ServerStoreService.currentServer(): ServerRecord | null` (existing).
- Produces: no new exports — this task only changes `connect()`'s control flow.

- [ ] **Step 1: Add the two new methods to the global test stub**

In `packages/app/src/test-setup.ts`, add to the `server: { ... }` block:

```ts
  server: {
    list: () => Promise.resolve([]),
    add: noopAsync,
    update: noopAsync,
    delete: noopAsync,
    getById: noopAsync,
    getByHost: noopAsync,
    setExportAvailable: noopAsync,
    setActive: noop,
  },
```

and to the `export: { ... }` block:

```ts
  export: {
    start: noop,
    cancel: noop,
    openBbePicker: () => Promise.resolve(undefined),
    readBbe: noopAsync,
    getServerInfo: noopAsync,
    checkAvailability: () => Promise.resolve({ available: false }),
    saveTorrentFiles: () => Promise.resolve({ cancelled: true, savedPaths: [], failed: [] }),
    importStart: noop,
    importCancel: noop,
    onProgress: noopSubscription,
    onDone: noopSubscription,
    onError: noopSubscription,
    onImportProgress: noopSubscription,
    onImportDone: noopSubscription,
    onImportError: noopSubscription,
  },
```

(`getServerInfo` was missing from the stub already — add it alongside the others so any future test calling it doesn't throw; it's not currently invoked by code under test in this file.)

- [ ] **Step 2: Write the failing tests for the login-time probe**

Add to `packages/app/src/app/pages/login/login.spec.ts`, as a new `describe('connect', ...)` block before the final closing `});` of the outer `describe('Login', ...)`:

```ts
describe('connect', () => {
  let qbServiceMock: { login: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    qbServiceMock = TestBed.inject(QbService) as any;
  });

  function setCurrentServer(overrides: Record<string, unknown> = {}) {
    serverStoreMock.currentServer.set({
      id: 'srv-1',
      name: 'Local',
      host: 'localhost',
      protocol: 'http',
      port: 8080,
      username: 'admin',
      has_password: true,
      export_available: null,
      ...overrides,
    });
  }

  it('probes availability and persists the result when export_available is null', async () => {
    setCurrentServer({ export_available: null });
    qbServiceMock.login.mockResolvedValue({ loggedIn: true });
    const checkAvailability = vi
      .spyOn(window.bitbutler.export, 'checkAvailability')
      .mockResolvedValue({ available: true });
    const setExportAvailable = vi
      .spyOn(window.bitbutler.server, 'setExportAvailable')
      .mockResolvedValue({ updated: true });

    await component.connect();

    expect(checkAvailability).toHaveBeenCalledWith('srv-1');
    expect(setExportAvailable).toHaveBeenCalledWith({ id: 'srv-1', value: 1 });
  });

  it('persists 0 when the probe reports unavailable', async () => {
    setCurrentServer({ export_available: null });
    qbServiceMock.login.mockResolvedValue({ loggedIn: true });
    vi.spyOn(window.bitbutler.export, 'checkAvailability').mockResolvedValue({
      available: false,
    });
    const setExportAvailable = vi
      .spyOn(window.bitbutler.server, 'setExportAvailable')
      .mockResolvedValue({ updated: true });

    await component.connect();

    expect(setExportAvailable).toHaveBeenCalledWith({ id: 'srv-1', value: 0 });
  });

  it('does not probe when export_available is already resolved', async () => {
    setCurrentServer({ export_available: 1 });
    qbServiceMock.login.mockResolvedValue({ loggedIn: true });
    const checkAvailability = vi.spyOn(window.bitbutler.export, 'checkAvailability');

    await component.connect();

    expect(checkAvailability).not.toHaveBeenCalled();
  });

  it('does not block login when the probe throws', async () => {
    setCurrentServer({ export_available: null });
    qbServiceMock.login.mockResolvedValue({ loggedIn: true });
    vi.spyOn(window.bitbutler.export, 'checkAvailability').mockRejectedValue(
      new Error('network error'),
    );
    const router = TestBed.inject(Router) as any;

    await component.connect();

    expect(router.navigate).toHaveBeenCalledWith(['/pages/main']);
  });

  it('does not probe when login did not succeed', async () => {
    setCurrentServer({ export_available: null });
    qbServiceMock.login.mockResolvedValue({ loggedIn: false });
    const checkAvailability = vi.spyOn(window.bitbutler.export, 'checkAvailability');

    await component.connect();

    expect(checkAvailability).not.toHaveBeenCalled();
  });
});
```

This requires `serverStoreMock.currentServer` to already be a writable signal (it is — `currentServer: signal(null)`, declared in the existing top-of-file `beforeEach`), and `QbService`/`Router` to be injectable via `TestBed.inject` (both are already provided in the existing `TestBed.configureTestingModule` call).

- [ ] **Step 3: Run the tests to verify they fail**

Run: `npm run test --workspace=packages/app -- login.spec`
Expected: FAIL — `checkAvailability`/`setExportAvailable` are never called because `connect()` doesn't call them yet.

- [ ] **Step 4: Implement the probe in `connect()`**

In `packages/app/src/app/pages/login/login.ts`, change the `.then(async (response) => { ... })` callback inside `connect()`:

```ts
this.qbittorrentService.auth
  .login(currentServer.id, runtimeUsername, runtimePassword)
  .then(async (response) => {
    if (!response.loggedIn) return;
    this.serverStoreService.clearAutoLoginSuppression();

    if (currentServer.export_available === null) {
      try {
        const { available } = await window.bitbutler.export.checkAvailability(currentServer.id);
        await window.bitbutler.server.setExportAvailable({
          id: currentServer.id,
          value: available ? 1 : 0,
        });
        await this.serverStoreService.refresh();
      } catch (e) {
        console.error(Login.name, 'connect', 'export_available probe failed', e);
      }
    }

    await this.windowService.setOpenFilesEnabled(true);
    loadingModalRef.close();
    this.router.navigate(['/pages/main']);
  });
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npm run test --workspace=packages/app -- login.spec`
Expected: PASS.

- [ ] **Step 6: Run the full app test suite**

Run: `npm run test --workspace=packages/app`
Expected: all tests pass (no regressions in unrelated specs from the `test-setup.ts` changes).

- [ ] **Step 7: Commit**

```bash
git add packages/app/src/app/pages/login/login.ts packages/app/src/app/pages/login/login.spec.ts \
  packages/app/src/test-setup.ts
git commit -m "#177: probe export_available lazily at login"
```

---

### Task 4: Tooltip mechanism for disabled context-menu items

**Files:**

- Modify: `packages/app/src/app/pages/main/grid/context-menu/context-menu.types.ts`
- Modify: `packages/app/src/app/pages/main/grid/context-menu/context-menu.ts`
- Modify: `packages/app/src/app/pages/main/grid/context-menu/context-menu.html`
- Modify: `packages/app/src/app/pages/main/grid/context-menu/context-menu.scss`
- Test: `packages/app/src/app/pages/main/grid/context-menu/context-menu.spec.ts`

**Interfaces:**

- Produces: `tooltip?: string` field on the `item` variant of `ContextMenuEntry` (consumed by Task 5/6); `ContextMenu.onItemMouseEnter(entry: ContextMenuEntry, target: HTMLElement): void` and `ContextMenu.onItemMouseLeave(): void` (template-only, no external consumers).

- [ ] **Step 1: Add the `tooltip` field to the type**

In `packages/app/src/app/pages/main/grid/context-menu/context-menu.types.ts`, change the `item` variant:

```ts
  | {
      kind: 'item';
      id: string;
      label: string;
      icon?: IconDefinition;
      variant?: ContextMenuVariant;
      disabled?: boolean;
      tooltip?: string;
      action?: AppCommand | (() => void);
      hint?: string;
    }
```

- [ ] **Step 2: Write the failing tests for hover show/hide and disabled-click no-op**

Add to `packages/app/src/app/pages/main/grid/context-menu/context-menu.spec.ts`, after the existing `describe('onEntryClick', ...)` block:

```ts
describe('tooltip popover', () => {
  let showPopoverSpy: ReturnType<typeof vi.spyOn>;
  let hidePopoverSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    showPopoverSpy = vi.spyOn(HTMLElement.prototype, 'showPopover').mockImplementation(() => {});
    hidePopoverSpy = vi.spyOn(HTMLElement.prototype, 'hidePopover').mockImplementation(() => {});
  });

  afterEach(() => {
    showPopoverSpy.mockRestore();
    hidePopoverSpy.mockRestore();
  });

  function makeTarget(): HTMLElement {
    const el = document.createElement('button');
    vi.spyOn(el, 'getBoundingClientRect').mockReturnValue({
      top: 10,
      left: 20,
      right: 80,
      bottom: 30,
      width: 60,
      height: 20,
      x: 20,
      y: 10,
      toJSON: () => ({}),
    } as DOMRect);
    return el;
  }

  it('shows the popover with the tooltip text for a disabled item with a tooltip', () => {
    const entry: ContextMenuEntry = {
      kind: 'item',
      id: 'x',
      label: 'X',
      disabled: true,
      tooltip: 'Not available right now',
    };
    component.onItemMouseEnter(entry, makeTarget());
    expect(component.tooltipText()).toBe('Not available right now');
    expect(showPopoverSpy).toHaveBeenCalled();
  });

  it('does nothing for an enabled item even if it has a tooltip', () => {
    const entry: ContextMenuEntry = {
      kind: 'item',
      id: 'x',
      label: 'X',
      disabled: false,
      tooltip: 'Should not show',
    };
    component.onItemMouseEnter(entry, makeTarget());
    expect(component.tooltipText()).toBeNull();
    expect(showPopoverSpy).not.toHaveBeenCalled();
  });

  it('does nothing for a disabled item with no tooltip text', () => {
    const entry: ContextMenuEntry = { kind: 'item', id: 'x', label: 'X', disabled: true };
    component.onItemMouseEnter(entry, makeTarget());
    expect(component.tooltipText()).toBeNull();
    expect(showPopoverSpy).not.toHaveBeenCalled();
  });

  it('hides the popover and clears the text on mouse leave', () => {
    const entry: ContextMenuEntry = {
      kind: 'item',
      id: 'x',
      label: 'X',
      disabled: true,
      tooltip: 'Hint',
    };
    component.onItemMouseEnter(entry, makeTarget());
    component.onItemMouseLeave();
    expect(component.tooltipText()).toBeNull();
    expect(hidePopoverSpy).toHaveBeenCalled();
  });
});
```

Add `ContextMenuEntry` to the existing `import type { ContextMenuConfig, ContextMenuEntry } from './context-menu.types';` line at the top of the spec file if it isn't already imported (it currently imports `ContextMenuConfig` and `ContextMenuEntry` — confirm both are present; if only `ContextMenuConfig` is imported, add `ContextMenuEntry`).

- [ ] **Step 3: Run the tests to verify they fail**

Run: `npm run test --workspace=packages/app -- context-menu.spec`
Expected: FAIL — `onItemMouseEnter`/`onItemMouseLeave`/`tooltipText` don't exist on the component.

- [ ] **Step 4: Implement the tooltip signal and handlers**

In `packages/app/src/app/pages/main/grid/context-menu/context-menu.ts`, add `ElementRef` and `ViewChild` to the `@angular/core` import:

```ts
import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  Injector,
  OnDestroy,
  ViewChild,
  inject,
  signal,
} from '@angular/core';
```

Add the view child and signal as class members, near `activeSubmenuId`:

```ts
  @ViewChild('tooltipEl', { static: true })
  private tooltipElRef!: ElementRef<HTMLElement>;

  readonly tooltipText = signal<string | null>(null);
```

Add the two handler methods, near `onSubmenuLeave`:

```ts
  onItemMouseEnter(entry: ContextMenuEntry, target: HTMLElement): void {
    if (entry.kind !== 'item' || !entry.disabled || !entry.tooltip) return;

    this.tooltipText.set(entry.tooltip);

    const tooltipEl = this.tooltipElRef.nativeElement;
    const rect = target.getBoundingClientRect();
    tooltipEl.style.top = `${rect.top}px`;
    tooltipEl.style.left = `${rect.right + 6}px`;
    tooltipEl.showPopover();
  }

  onItemMouseLeave(): void {
    this.tooltipText.set(null);
    this.tooltipElRef.nativeElement.hidePopover();
  }
```

- [ ] **Step 5: Update the template**

In `packages/app/src/app/pages/main/grid/context-menu/context-menu.html`, change the item `<button>` block (the one under `@if (entry.kind === 'item')`) to stop binding the native `disabled` attribute and add hover handlers:

```html
@if (entry.kind === 'item') {
<button
  type="button"
  class="bb-item"
  [class.bb-danger]="entry.variant === 'danger'"
  [class.bb-warning]="entry.variant === 'warning'"
  [class.bb-success]="entry.variant === 'success'"
  [class.bb-info]="entry.variant === 'info'"
  [class.bb-item--disabled]="entry.disabled"
  [attr.aria-disabled]="entry.disabled ? 'true' : null"
  (click)="onEntryClick(entry)"
  (mouseenter)="onItemMouseEnter(entry, asHtmlElement($event.currentTarget))"
  (mouseleave)="onItemMouseLeave()"
  role="menuitem"
>
  <span class="bb-icon" aria-hidden="true">
    @if (entry.icon) {
    <fa-icon [icon]="entry.icon"></fa-icon>
    }
  </span>

  <span class="bb-label">{{ entry.label | translate }}</span>

  @if (entry.hint) {
  <span class="bb-hint">{{ entry.hint }}</span>
  }
</button>
}
```

Add the popover element as the last child of the root `.bb-menu` div (after the `@for` loop's closing `}`):

```html
  <div #tooltipEl popover="manual" class="bb-tooltip-popover">
    {{ tooltipText() | translate }}
  </div>
</div>
```

(the existing root `</div>` that closes `.bb-menu` moves down to after this new element). `tooltip`/`tooltipText` hold translation **keys**, mirroring how `entry.label` is a key resolved by the `translate` pipe in the template — never pre-resolve the text in the service.

- [ ] **Step 6: Update the stylesheet**

In `packages/app/src/app/pages/main/grid/context-menu/context-menu.scss`, replace the `.bb-item:disabled` rule:

```scss
.bb-item:disabled {
  color: inherit;
}
```

with a class-based equivalent (since disabled items no longer use the native `disabled` attribute), and merge it with the existing dimmed styling that lived on `&:disabled` inside `.bb-item`:

```scss
.bb-item.bb-item--disabled {
  opacity: 0.42;
  cursor: not-allowed;
  color: inherit;

  &:hover {
    background: transparent;
  }
}
```

Remove the old `&:disabled { opacity: 0.42; cursor: not-allowed; }` block from inside `.bb-item` (it's superseded by the rule above).

Add the popover element's styling at the end of the file:

```scss
.bb-tooltip-popover {
  position: fixed;
  inset: unset;
  margin: 0;
  padding: 4px 8px;
  border-radius: 6px;
  font-size: 12px;
  max-width: 260px;
  background: var(--bs-tooltip-bg, #000);
  color: var(--bs-tooltip-color, #fff);
  border: 1px solid var(--bs-border-color);
  pointer-events: none;
}
```

- [ ] **Step 7: Run the tests to verify they pass**

Run: `npm run test --workspace=packages/app -- context-menu.spec`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add packages/app/src/app/pages/main/grid/context-menu/context-menu.types.ts \
  packages/app/src/app/pages/main/grid/context-menu/context-menu.ts \
  packages/app/src/app/pages/main/grid/context-menu/context-menu.html \
  packages/app/src/app/pages/main/grid/context-menu/context-menu.scss \
  packages/app/src/app/pages/main/grid/context-menu/context-menu.spec.ts
git commit -m "#177: added popover-based tooltips for disabled context menu items"
```

---

### Task 5: Rework the torrent grid context menu (`grid-context-menu.service.ts`)

**Files:**

- Modify: `packages/app/src/app/pages/main/grid/context-menu/grid-context-menu.service.ts`
- Test: `packages/app/src/app/pages/main/grid/context-menu/grid-context-menu.service.spec.ts`

**Interfaces:**

- Consumes: `entry.tooltip?: string` (Task 4); `ServerRecord.export_available` (Task 1); `window.bitbutler.export.saveTorrentFiles` (Task 2); `ToastService.danger(html: string, title?: string): string` (existing, `packages/app/src/app/services/toast.service.ts`).
- Produces: no new exports — `buildTorrentMenu`'s return shape changes (new `torrent.copyName`/`torrent.copySavePath`/`torrent.exportFile` items, `cell.copyValue` removed, tooltips added to several existing items).

- [ ] **Step 1: Update the spec's `ServerStoreService` mock and add `ToastService`**

In `packages/app/src/app/pages/main/grid/context-menu/grid-context-menu.service.spec.ts`, the `beforeEach` currently provides:

```ts
        {
          provide: ServerStoreService,
          useValue: { currentServerId: signal('server-1') },
        },
```

Change it to also provide `currentServer`, defaulting to an available server so existing tests that don't care about export availability keep working:

```ts
        {
          provide: ServerStoreService,
          useValue: {
            currentServerId: signal('server-1'),
            currentServer: signal({ id: 'server-1', export_available: 1 } as any),
          },
        },
```

Add a `toastService` mock alongside the other `let` declarations and `beforeEach` assignments:

```ts
let toastService: { danger: ReturnType<typeof vi.fn> };
```

```ts
toastService = { danger: vi.fn() };
```

Add it to the providers array:

```ts
        { provide: ToastService, useValue: toastService },
```

Add the necessary imports at the top of the spec file: `import { ToastService } from '../../../../services/toast.service';` and ensure `window` stubbing for `bitbutler.export.saveTorrentFiles` is available — add this inside the outer `beforeEach`, before `TestBed.configureTestingModule`:

```ts
(window as any).bitbutler = {
  export: {
    saveTorrentFiles: vi
      .fn()
      .mockResolvedValue({ cancelled: false, savedPaths: ['/tmp/x.torrent'], failed: [] }),
  },
};
```

- [ ] **Step 2: Write the failing tests for the reworked Copy submenu**

Replace the existing `'should include copy submenu with expected children'` test with:

```ts
it('should include the reworked copy submenu children', async () => {
  const entries = await service.buildTorrentMenu(makeData());
  expect(findItem(entries, 'cell.copyValue')).toBeUndefined();
  expect(findItem(entries, 'torrent.copyName')).toBeDefined();
  expect(findItem(entries, 'torrent.copyMagnet')).toBeDefined();
  expect(findItem(entries, 'torrent.copyInfoHash')).toBeDefined();
  expect(findItem(entries, 'torrent.copySavePath')).toBeDefined();
  expect(findItem(entries, 'torrent.copyJson')).toBeDefined();
});
```

Add new tests in the `describe('actions', ...)` block:

```ts
it('torrent.copyName action copies the torrent name for a single selection', async () => {
  const row = makeRow({ name: 'My Film' });
  const entries = await service.buildTorrentMenu(makeData({ row, selected: [row] }));
  (findItem(entries, 'torrent.copyName')!.action as () => void)();
  expect(clipboard.copy).toHaveBeenCalledWith('My Film');
});

it('torrent.copyName action joins names with a newline for multi-selection', async () => {
  const rowA = makeRow({ hash: 'a', name: 'Film A' });
  const rowB = makeRow({ hash: 'b', name: 'Film B' });
  const entries = await service.buildTorrentMenu(makeData({ row: rowA, selected: [rowA, rowB] }));
  (findItem(entries, 'torrent.copyName')!.action as () => void)();
  expect(clipboard.copy).toHaveBeenCalledWith('Film A\nFilm B');
});

it('torrent.copySavePath action copies the save path for a single selection', async () => {
  const row = makeRow({ save_path: '/downloads/movies' });
  const entries = await service.buildTorrentMenu(makeData({ row, selected: [row] }));
  (findItem(entries, 'torrent.copySavePath')!.action as () => void)();
  expect(clipboard.copy).toHaveBeenCalledWith('/downloads/movies');
});

it('torrent.copySavePath action joins save paths with a newline for multi-selection', async () => {
  const rowA = makeRow({ hash: 'a', save_path: '/downloads/a' });
  const rowB = makeRow({ hash: 'b', save_path: '/downloads/b' });
  const entries = await service.buildTorrentMenu(makeData({ row: rowA, selected: [rowA, rowB] }));
  (findItem(entries, 'torrent.copySavePath')!.action as () => void)();
  expect(clipboard.copy).toHaveBeenCalledWith('/downloads/a\n/downloads/b');
});

it('torrent.copyJson action always copies an array, even for a single torrent', async () => {
  const row = makeRow();
  const entries = await service.buildTorrentMenu(makeData({ row, selected: [row] }));
  (findItem(entries, 'torrent.copyJson')!.action as () => void)();
  expect(clipboard.copy).toHaveBeenCalledWith(JSON.stringify([row], null, 2));
});
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `npm run test --workspace=packages/app -- grid-context-menu.service.spec`
Expected: FAIL — `torrent.copyName`/`torrent.copySavePath` don't exist yet, `cell.copyValue` still does.

- [ ] **Step 4: Rework the Copy submenu in `grid-context-menu.service.ts`**

Add `faFloppyDisk` and `faFont` to the icon import block (alphabetical order — `faFloppyDisk` goes between `faFilterCircleXmark` and `faFolderOpen`; `faFont` goes between `faFolderTree` and `faForwardFast`):

```ts
import {
  faArrowDown,
  faArrowDownUpAcrossLine,
  faArrowLeft,
  faArrowRight,
  faArrowUp,
  faArrowsDownToLine,
  faArrowsLeftRight,
  faArrowsUpToLine,
  faBullhorn,
  faCheck,
  faCode,
  faCopy,
  faEye,
  faEyeSlash,
  faFilePen,
  faFilter,
  faFilterCircleXmark,
  faFloppyDisk,
  faFolderOpen,
  faFolderTree,
  faFont,
  faForwardFast,
  faHashtag,
  faInfoCircle,
  faLink,
  faPause,
  faPenToSquare,
  faPlaneDeparture,
  faPlay,
  faRotate,
  faShare,
  faSort,
  faSortDown,
  faSortUp,
  faTableColumns,
  faTags,
  faThumbTack,
  faThumbTackSlash,
  faTrashCan,
  faXmark,
} from '@fortawesome/free-solid-svg-icons';
```

Add the `ToastService` injection alongside the other services:

```ts
  private readonly serverStoreService = inject(ServerStoreService);
  private readonly toastService = inject(ToastService);
  private readonly torrentListGridSettingsService = inject(TorrentListGridSettingsService);
```

Add the import: `import { ToastService } from '../../../../services/toast.service';`.

Replace the entire `copy` submenu block with:

```ts
      {
        kind: 'submenu',
        id: 'copy',
        label: 'pages.main.grid.context-menu.submenu.copy',
        icon: faCopy,
        children: [
          {
            kind: 'item',
            id: 'torrent.copyName',
            label: isMulti
              ? 'pages.main.grid.context-menu.item.copy-names'
              : 'pages.main.grid.context-menu.item.copy-name',
            icon: faFont,
            action: () =>
              this.clipboard.copy(
                isMulti
                  ? data.selected.map((torrent) => torrent.name).join('\n')
                  : String(data.row.name),
              ),
          },
          {
            kind: 'item',
            id: 'torrent.copyMagnet',
            label: isMulti
              ? 'pages.main.grid.context-menu.item.copy-magnet-links'
              : 'pages.main.grid.context-menu.item.copy-magnet-link',
            icon: faLink,
            action: () =>
              this.clipboard.copy(
                isMulti
                  ? data.selected.map((torrent) => torrent.magnet_uri).join('\n')
                  : String(data.row.magnet_uri),
              ),
          },
          {
            kind: 'item',
            id: 'torrent.copyInfoHash',
            label: isMulti
              ? 'pages.main.grid.context-menu.item.copy-info-hashes'
              : 'pages.main.grid.context-menu.item.copy-info-hash',
            icon: faHashtag,
            action: () => this.clipboard.copy(isMulti ? hashes.join('\n') : String(data.row.hash)),
          },
          {
            kind: 'item',
            id: 'torrent.copySavePath',
            label: isMulti
              ? 'pages.main.grid.context-menu.item.copy-save-paths'
              : 'pages.main.grid.context-menu.item.copy-save-path',
            icon: faFolderOpen,
            action: () =>
              this.clipboard.copy(
                isMulti
                  ? data.selected.map((torrent) => torrent.save_path).join('\n')
                  : String(data.row.save_path),
              ),
          },
          {
            kind: 'item',
            id: 'torrent.copyJson',
            label: 'pages.main.grid.context-menu.item.copy-as-json',
            icon: faCode,
            action: () => this.clipboard.copy(String(JSON.stringify(data.selected, null, 2))),
          },
        ],
      },
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npm run test --workspace=packages/app -- grid-context-menu.service.spec`
Expected: PASS.

- [ ] **Step 6: Write the failing tests for pin/openDestination tooltips and the new Export item**

Replace the `describe('pin disabled state', ...)` block's first test and add tooltip assertions to each existing case, plus add a new `describe('export torrent file', ...)` block. Replace the whole `describe('pin disabled state', ...)` block with:

```ts
describe('pin disabled state', () => {
  it('pinToTop is disabled with a tooltip when row is already pinned to top', async () => {
    const entries = await service.buildTorrentMenu(makeData({ rowPinned: 'top' }));
    expect(findItem(entries, 'row.pinToTop')?.disabled).toBe(true);
    expect(findItem(entries, 'row.pinToTop')?.tooltip).toBe(
      'pages.main.grid.context-menu.tooltip.already-pinned-top',
    );
  });

  it('pinToTop is enabled with no tooltip when row is not pinned to top', async () => {
    const entries = await service.buildTorrentMenu(makeData({ rowPinned: null }));
    expect(findItem(entries, 'row.pinToTop')?.disabled).toBeFalsy();
    expect(findItem(entries, 'row.pinToTop')?.tooltip).toBeUndefined();
  });

  it('pinToBottom is disabled with a tooltip when row is already pinned to bottom', async () => {
    const entries = await service.buildTorrentMenu(makeData({ rowPinned: 'bottom' }));
    expect(findItem(entries, 'row.pinToBottom')?.disabled).toBe(true);
    expect(findItem(entries, 'row.pinToBottom')?.tooltip).toBe(
      'pages.main.grid.context-menu.tooltip.already-pinned-bottom',
    );
  });

  it('unpin is disabled with a tooltip when row is not pinned', async () => {
    const entries = await service.buildTorrentMenu(makeData({ rowPinned: null }));
    expect(findItem(entries, 'row.unpin')?.disabled).toBe(true);
    expect(findItem(entries, 'row.unpin')?.tooltip).toBe(
      'pages.main.grid.context-menu.tooltip.not-pinned',
    );
  });

  it('unpin is enabled with no tooltip when row is pinned', async () => {
    const entries = await service.buildTorrentMenu(makeData({ rowPinned: 'top' }));
    expect(findItem(entries, 'row.unpin')?.disabled).toBeFalsy();
    expect(findItem(entries, 'row.unpin')?.tooltip).toBeUndefined();
  });
});
```

Add a tooltip assertion to the existing `'is disabled when local path cannot be resolved'` test in `describe('files.openDestination', ...)`:

```ts
it('is disabled with a tooltip when local path cannot be resolved', async () => {
  pathService.resolveLocalPath.mockResolvedValue(null);
  const entries = await service.buildTorrentMenu(makeData());
  expect(findItem(entries, 'files.openDestination')?.disabled).toBe(true);
  expect(findItem(entries, 'files.openDestination')?.tooltip).toBe(
    'pages.main.grid.context-menu.tooltip.open-destination-unresolved',
  );
});
```

(replace the old `'is disabled when local path cannot be resolved'` test with this one).

Add a new top-level `describe` block for the export item, after `describe('files.openDestination', ...)`:

```ts
describe('torrent.exportFile', () => {
  it('is enabled when export_available is 1', async () => {
    const entries = await service.buildTorrentMenu(makeData());
    expect(findItem(entries, 'torrent.exportFile')?.disabled).toBeFalsy();
  });

  it('is disabled with a tooltip when export_available is 0', async () => {
    (TestBed.inject(ServerStoreService) as any).currentServer.set({
      id: 'server-1',
      export_available: 0,
    });
    const entries = await service.buildTorrentMenu(makeData());
    expect(findItem(entries, 'torrent.exportFile')?.disabled).toBe(true);
    expect(findItem(entries, 'torrent.exportFile')?.tooltip).toBe(
      'pages.main.grid.context-menu.tooltip.export-unavailable',
    );
  });

  it('is disabled when export_available is null', async () => {
    (TestBed.inject(ServerStoreService) as any).currentServer.set({
      id: 'server-1',
      export_available: null,
    });
    const entries = await service.buildTorrentMenu(makeData());
    expect(findItem(entries, 'torrent.exportFile')?.disabled).toBe(true);
  });

  it('uses the singular label for a single selection', async () => {
    const row = makeRow();
    const entries = await service.buildTorrentMenu(makeData({ row, selected: [row] }));
    expect(findItem(entries, 'torrent.exportFile')?.label).toBe(
      'pages.main.grid.context-menu.item.export-torrent-file',
    );
  });

  it('uses the plural label for a multi-selection', async () => {
    const rowA = makeRow({ hash: 'a' });
    const rowB = makeRow({ hash: 'b' });
    const entries = await service.buildTorrentMenu(makeData({ row: rowA, selected: [rowA, rowB] }));
    expect(findItem(entries, 'torrent.exportFile')?.label).toBe(
      'pages.main.grid.context-menu.item.export-torrent-files',
    );
  });

  it('calls saveTorrentFiles with hash/name pairs for the selection', async () => {
    const rowA = makeRow({ hash: 'a', name: 'Film A' });
    const rowB = makeRow({ hash: 'b', name: 'Film B' });
    const entries = await service.buildTorrentMenu(makeData({ row: rowA, selected: [rowA, rowB] }));
    await (findItem(entries, 'torrent.exportFile')!.action as () => Promise<void>)();
    expect(window.bitbutler.export.saveTorrentFiles).toHaveBeenCalledWith({
      serverId: 'server-1',
      items: [
        { hash: 'a', name: 'Film A' },
        { hash: 'b', name: 'Film B' },
      ],
    });
  });

  it('shows a danger toast summarizing failures', async () => {
    (window.bitbutler.export.saveTorrentFiles as ReturnType<typeof vi.fn>).mockResolvedValue({
      cancelled: false,
      savedPaths: [],
      failed: [{ hash: 'a', name: 'Film A', error: 'boom' }],
    });
    const row = makeRow();
    const entries = await service.buildTorrentMenu(makeData({ row, selected: [row] }));
    await (findItem(entries, 'torrent.exportFile')!.action as () => Promise<void>)();
    expect(toastService.danger).toHaveBeenCalled();
  });

  it('does not toast when nothing failed', async () => {
    const row = makeRow();
    const entries = await service.buildTorrentMenu(makeData({ row, selected: [row] }));
    await (findItem(entries, 'torrent.exportFile')!.action as () => Promise<void>)();
    expect(toastService.danger).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 7: Run the tests to verify they fail**

Run: `npm run test --workspace=packages/app -- grid-context-menu.service.spec`
Expected: FAIL — `torrent.exportFile` doesn't exist, pin/openDestination items have no `tooltip`.

- [ ] **Step 8: Add tooltips to the pin and openDestination items**

Change the `row.pin` submenu's children:

```ts
          {
            kind: 'item',
            id: 'row.pinToTop',
            icon: faArrowUp,
            label: 'pages.main.grid.context-menu.item.pin-to-top',
            disabled: data.rowPinned === 'top',
            tooltip:
              data.rowPinned === 'top'
                ? 'pages.main.grid.context-menu.tooltip.already-pinned-top'
                : undefined,
            action: () => this.commandBusService.emit({ type: 'UI_TORRENT_PIN_TOP' }),
          },
          {
            kind: 'item',
            id: 'row.pinToBottom',
            icon: faArrowDown,
            label: 'pages.main.grid.context-menu.item.pin-to-bottom',
            disabled: data.rowPinned === 'bottom',
            tooltip:
              data.rowPinned === 'bottom'
                ? 'pages.main.grid.context-menu.tooltip.already-pinned-bottom'
                : undefined,
            action: () => this.commandBusService.emit({ type: 'UI_TORRENT_PIN_BOTTOM' }),
          },
          {
            kind: 'item',
            id: 'row.unpin',
            icon: faThumbTackSlash,
            label: 'pages.main.grid.context-menu.item.unpin',
            disabled: !data.rowPinned,
            tooltip: !data.rowPinned ? 'pages.main.grid.context-menu.tooltip.not-pinned' : undefined,
            action: () => this.commandBusService.emit({ type: 'UI_TORRENT_UNPIN' }),
          },
```

Change the `files.openDestination` item (inside the `files` submenu's `isMulti ? [] : [...]` block):

```ts
                {
                  kind: 'item' as const,
                  id: 'files.openDestination',
                  label:
                    (
                      await this.qbService.torrents.files(
                        this.serverStoreService.currentServerId() as string,
                        data.row.hash,
                      )
                    ).length === 1
                      ? 'pages.main.grid.context-menu.item.show-in-folder'
                      : 'pages.main.grid.context-menu.item.open-destination',
                  icon: faFolderOpen,
                  disabled: (await this.pathService.resolveLocalPath(data.row.save_path)) === null,
                  tooltip:
                    (await this.pathService.resolveLocalPath(data.row.save_path)) === null
                      ? 'pages.main.grid.context-menu.tooltip.open-destination-unresolved'
                      : undefined,
                  action: () =>
                    this.commandBusService.emit({
                      type: 'UI_OPEN_DESTINATION',
                      remotePath: data.row.content_path,
                      hash: data.row.hash,
                    }),
                },
```

(this calls `resolveLocalPath` twice — acceptable here since `PathService.resolveLocalPath` is a cheap local lookup, not a network call, and keeps the diff minimal; do not introduce a temporary variable unless a reviewer flags it).

- [ ] **Step 9: Add the `torrent.exportFile` item and its handler method**

Add the new root-level item right after the `files` submenu's closing `},` and before the `queue` submenu:

```ts
      {
        kind: 'item',
        id: 'torrent.exportFile',
        label: isMulti
          ? 'pages.main.grid.context-menu.item.export-torrent-files'
          : 'pages.main.grid.context-menu.item.export-torrent-file',
        icon: faFloppyDisk,
        disabled: this.serverStoreService.currentServer()?.export_available !== 1,
        tooltip:
          this.serverStoreService.currentServer()?.export_available !== 1
            ? 'pages.main.grid.context-menu.tooltip.export-unavailable'
            : undefined,
        action: () => this.exportTorrentFiles(data.selected),
      },
```

Add the private handler method at the end of the class, before the closing `}`:

```ts
  private async exportTorrentFiles(selected: Torrent[]): Promise<void> {
    const serverId = this.serverStoreService.currentServerId();
    if (!serverId) return;

    const items = selected.map((t) => ({ hash: t.hash, name: t.name }));

    try {
      const result = await window.bitbutler.export.saveTorrentFiles({ serverId, items });
      if (result.failed.length > 0) {
        this.toastService.danger(
          `Failed to export ${result.failed.length} of ${items.length} torrent(s).`,
          'Export failed',
        );
      }
    } catch (err: any) {
      this.toastService.danger(err?.message ?? String(err), 'Export failed');
    }
  }
```

Add the import: `import { Torrent } from '../../../../models/torrent.model';`.

- [ ] **Step 10: Run the tests to verify they pass**

Run: `npm run test --workspace=packages/app -- grid-context-menu.service.spec`
Expected: PASS.

- [ ] **Step 11: Run the full app test suite**

Run: `npm run test --workspace=packages/app`
Expected: all tests pass.

- [ ] **Step 12: Commit**

```bash
git add packages/app/src/app/pages/main/grid/context-menu/grid-context-menu.service.ts \
  packages/app/src/app/pages/main/grid/context-menu/grid-context-menu.service.spec.ts
git commit -m "#177: reworked copy submenu and added export .torrent context menu item"
```

---

### Task 6: Header menu tooltips (sort / filter / pin-column)

**Files:**

- Modify: `packages/app/src/app/pages/main/grid/context-menu/grid-context-menu.service.ts`
- Test: `packages/app/src/app/pages/main/grid/context-menu/grid-context-menu.service.spec.ts`

**Interfaces:**

- Consumes: `entry.tooltip?: string` (Task 4).
- Produces: nothing new — `buildHeaderMenu`'s disabled sort/filter/pin-column items gain a `tooltip`.

- [ ] **Step 1: Add tooltip assertions to the existing disabled-state tests**

In `grid-context-menu.service.spec.ts`, the existing header-menu tests (around the `sort.asc.name`/`filter.open.name`/`pinLeft.name` assertions) check `?.disabled` only. Update each to also assert `?.tooltip`:

```ts
it('sort ascending is disabled with a tooltip when already sorted ascending', async () => {
  const column = makeColumn({ getSort: vi.fn().mockReturnValue('asc') });
  const api = makeApi(column);
  const entries = service.buildHeaderMenu({ api, column } as any);
  expect(findItem(entries, 'sort.asc.name')?.disabled).toBe(true);
  expect(findItem(entries, 'sort.asc.name')?.tooltip).toBe(
    'pages.main.grid.context-menu.tooltip.already-sorted-ascending',
  );
});

it('sort descending is disabled with a tooltip when already sorted descending', async () => {
  const column = makeColumn({ getSort: vi.fn().mockReturnValue('desc') });
  const api = makeApi(column);
  const entries = service.buildHeaderMenu({ api, column } as any);
  expect(findItem(entries, 'sort.desc.name')?.disabled).toBe(true);
  expect(findItem(entries, 'sort.desc.name')?.tooltip).toBe(
    'pages.main.grid.context-menu.tooltip.already-sorted-descending',
  );
});

it('clear sort is disabled with a tooltip when no sort is applied', async () => {
  const column = makeColumn({ getSort: vi.fn().mockReturnValue(null) });
  const api = makeApi(column);
  const entries = service.buildHeaderMenu({ api, column } as any);
  expect(findItem(entries, 'sort.clear.name')?.disabled).toBeTruthy();
  expect(findItem(entries, 'sort.clear.name')?.tooltip).toBe(
    'pages.main.grid.context-menu.tooltip.no-sort-applied',
  );
});

it('open filter is disabled with a tooltip when the column has no filter', async () => {
  const column = makeColumn({ getColDef: vi.fn().mockReturnValue({ colId: 'name' }) });
  const api = makeApi(column);
  const entries = service.buildHeaderMenu({ api, column } as any);
  expect(findItem(entries, 'filter.open.name')?.disabled).toBe(true);
  expect(findItem(entries, 'filter.open.name')?.tooltip).toBe(
    'pages.main.grid.context-menu.tooltip.filter-not-supported',
  );
});

it('clear filter is disabled with a tooltip when no filter is active', async () => {
  const column = makeColumn({ isFilterActive: vi.fn().mockReturnValue(false) });
  const api = makeApi(column);
  const entries = service.buildHeaderMenu({ api, column } as any);
  expect(findItem(entries, 'filter.clear.name')?.disabled).toBe(true);
  expect(findItem(entries, 'filter.clear.name')?.tooltip).toBe(
    'pages.main.grid.context-menu.tooltip.no-filter-active',
  );
});

it('pin left is disabled with a tooltip when already pinned left', async () => {
  const column = makeColumn({ isPinnedLeft: vi.fn().mockReturnValue(true) });
  const api = makeApi(column);
  const entries = service.buildHeaderMenu({ api, column } as any);
  expect(findItem(entries, 'pinLeft.name')?.disabled).toBe(true);
  expect(findItem(entries, 'pinLeft.name')?.tooltip).toBe(
    'pages.main.grid.context-menu.tooltip.already-pinned-left',
  );
});

it('pin right is disabled with a tooltip when already pinned right', async () => {
  const column = makeColumn({ isPinnedRight: vi.fn().mockReturnValue(true) });
  const api = makeApi(column);
  const entries = service.buildHeaderMenu({ api, column } as any);
  expect(findItem(entries, 'pinRight.name')?.disabled).toBe(true);
  expect(findItem(entries, 'pinRight.name')?.tooltip).toBe(
    'pages.main.grid.context-menu.tooltip.already-pinned-right',
  );
});

it('unpin column is disabled with a tooltip when not pinned', async () => {
  const column = makeColumn({ getPinned: vi.fn().mockReturnValue(null) });
  const api = makeApi(column);
  const entries = service.buildHeaderMenu({ api, column } as any);
  expect(findItem(entries, 'unpinColumn.name')?.disabled).toBeTruthy();
  expect(findItem(entries, 'unpinColumn.name')?.tooltip).toBe(
    'pages.main.grid.context-menu.tooltip.column-not-pinned',
  );
});
```

Replace whichever existing tests in the file currently cover these same `disabled` assertions (the ones found via the `?.disabled` checks at the lines noted in the spec file) with these — don't leave duplicate near-identical tests behind.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm run test --workspace=packages/app -- grid-context-menu.service.spec`
Expected: FAIL — none of these header items have a `tooltip` field yet.

- [ ] **Step 3: Add tooltips to the sort, filter, and pin-column items**

In `buildHeaderMenu`, update the `sort` submenu's children:

```ts
          {
            kind: 'item',
            id: `sort.asc.${payload.colId}`,
            label: 'pages.main.grid.context-menu.item.sort-ascending',
            icon: faSortUp,
            disabled: column.getSort() === 'asc',
            tooltip:
              column.getSort() === 'asc'
                ? 'pages.main.grid.context-menu.tooltip.already-sorted-ascending'
                : undefined,
            action: () => api.applyColumnState({ state: [{ colId: payload.colId, sort: 'asc' }] }),
          },
          {
            kind: 'item',
            id: `sort.desc.${payload.colId}`,
            label: 'pages.main.grid.context-menu.item.sort-descending',
            icon: faSortDown,
            disabled: column.getSort() === 'desc',
            tooltip:
              column.getSort() === 'desc'
                ? 'pages.main.grid.context-menu.tooltip.already-sorted-descending'
                : undefined,
            action: () => api.applyColumnState({ state: [{ colId: payload.colId, sort: 'desc' }] }),
          },
          {
            kind: 'item',
            id: `sort.clear.${payload.colId}`,
            label: 'pages.main.grid.context-menu.item.clear-sort',
            icon: faXmark,
            disabled: !column.getSort(),
            tooltip: !column.getSort()
              ? 'pages.main.grid.context-menu.tooltip.no-sort-applied'
              : undefined,
            action: () => api.applyColumnState({ state: [{ colId: payload.colId, sort: null }] }),
          },
```

Update the `filter` submenu's first two children (leave the floating-filters toggle item untouched — it's not a disabled-state item):

```ts
          {
            kind: 'item',
            id: `filter.open.${payload.colId}`,
            label: 'pages.main.grid.context-menu.item.open-filter',
            icon: faFilter,
            disabled: !column.getColDef().filter,
            tooltip: !column.getColDef().filter
              ? 'pages.main.grid.context-menu.tooltip.filter-not-supported'
              : undefined,
            action: () => api.showColumnFilter(payload.colId),
          },
          {
            kind: 'item',
            id: `filter.clear.${payload.colId}`,
            label: 'pages.main.grid.context-menu.item.clear-filter',
            icon: faFilterCircleXmark,
            disabled: !column.isFilterActive(),
            tooltip: !column.isFilterActive()
              ? 'pages.main.grid.context-menu.tooltip.no-filter-active'
              : undefined,
            action: () => this.filterService.clearColumnFilter(payload.colId),
          },
```

Update the `pin.${payload.colId}` submenu's children:

```ts
          {
            kind: 'item',
            id: `pinLeft.${payload.colId}`,
            label: 'pages.main.grid.context-menu.item.pin-left',
            icon: faArrowLeft,
            disabled: column.isPinnedLeft(),
            tooltip: column.isPinnedLeft()
              ? 'pages.main.grid.context-menu.tooltip.already-pinned-left'
              : undefined,
            action: () => api.setColumnsPinned([payload.colId], 'left'),
          },
          {
            kind: 'item',
            id: `pinRight.${payload.colId}`,
            label: 'pages.main.grid.context-menu.item.pin-right',
            icon: faArrowRight,
            disabled: column.isPinnedRight(),
            tooltip: column.isPinnedRight()
              ? 'pages.main.grid.context-menu.tooltip.already-pinned-right'
              : undefined,
            action: () => api.setColumnsPinned([payload.colId], 'right'),
          },
          {
            kind: 'item',
            id: `unpinColumn.${payload.colId}`,
            label: 'pages.main.grid.context-menu.item.unpin-column',
            icon: faThumbTackSlash,
            disabled: !column.getPinned(),
            tooltip: !column.getPinned()
              ? 'pages.main.grid.context-menu.tooltip.column-not-pinned'
              : undefined,
            action: () => api.setColumnsPinned([payload.colId], null),
          },
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm run test --workspace=packages/app -- grid-context-menu.service.spec`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/app/src/app/pages/main/grid/context-menu/grid-context-menu.service.ts \
  packages/app/src/app/pages/main/grid/context-menu/grid-context-menu.service.spec.ts
git commit -m "#177: added tooltips to disabled header menu items"
```

---

### Task 7: i18n strings (`us.json` + `hu.json`)

**Files:**

- Modify: `public/i18n/us.json`
- Modify: `public/i18n/hu.json`

**Interfaces:**

- Consumes: every translation key referenced by Tasks 5–6 (`pages.main.grid.context-menu.item.*` and `pages.main.grid.context-menu.tooltip.*`).
- Produces: nothing — terminal task for these strings.

- [ ] **Step 1: Update `public/i18n/us.json`**

In the `pages.main.grid.context-menu.item` object (around line 986), remove `"copy-cell-value": "Copy cell value",` and add the new keys. The block becomes:

```json
          "item": {
            "copy-name": "Copy name",
            "copy-names": "Copy names",
            "copy-info-hash": "Copy info hash",
            "copy-info-hashes": "Copy info hashes",
            "copy-magnet-link": "Copy magnet link",
            "copy-magnet-links": "Copy magnet links",
            "copy-save-path": "Copy save path",
            "copy-save-paths": "Copy save paths",
            "copy-as-json": "Copy as JSON",
            "export-torrent-file": "Export .torrent",
            "export-torrent-files": "Export .torrent Files",
            "torrent-details": "Torrent details",
            "start": "Start",
            "stop": "Stop",
            "force-resume": "Force Resume",
            "set-location": "Set location",
            "show-in-folder": "Show in Folder",
            "open-destination": "Open Destination",
            "rename-torrent": "Rename Torrent",
            "rename-files": "Rename files",
            "set-category": "Set Category",
            "set-tags": "Set Tags",
            "remove": "Remove",
            "transfer-limit": "Transfer Limit",
            "share-limit": "Share Limit",
            "enable-super-seeding": "Enable Super Seeding",
            "disable-super-seeding": "Disable Super Seeding",
            "force-recheck": "Force recheck",
            "force-reannounce": "Force reannounce",
            "enable-auto-tmm": "Enable Auto TMM",
            "disable-auto-tmm": "Disable Auto TMM",
            "move-to-top": "Move to top",
            "move-up": "Move up",
            "move-down": "Move down",
            "move-to-bottom": "Move to bottom",
            "hide-column": "Hide Column",
            "clear-filter": "Clear Filter",
            "show-all": "Show All",
            "hide-all": "Hide All",
            "pin-to-top": "Pin to top",
            "pin-to-bottom": "Pin to bottom",
            "unpin": "Unpin",
            "pin-left": "Pin left",
            "pin-right": "Pin right",
            "unpin-column": "Unpin column",
            "sort-ascending": "Sort Ascending",
            "sort-descending": "Sort Descending",
            "clear-sort": "Clear Sort",
            "open-filter": "Open Filter",
            "show-floating-filters": "Show Floating Filters",
            "hide-floating-filters": "Hide Floating Filters",
            "autosize-column": "Auto-size This Column",
            "autosize-all-columns": "Auto-size All Columns"
          },
          "tooltip": {
            "open-destination-unresolved": "This torrent's save path could not be resolved on this machine.",
            "already-pinned-top": "This row is already pinned to the top.",
            "already-pinned-bottom": "This row is already pinned to the bottom.",
            "not-pinned": "This row is not pinned.",
            "already-sorted-ascending": "This column is already sorted ascending.",
            "already-sorted-descending": "This column is already sorted descending.",
            "no-sort-applied": "No sort is applied to this column.",
            "filter-not-supported": "This column does not support filtering.",
            "no-filter-active": "No filter is active on this column.",
            "already-pinned-left": "This column is already pinned to the left.",
            "already-pinned-right": "This column is already pinned to the right.",
            "column-not-pinned": "This column is not pinned.",
            "export-unavailable": "The /api/v2/torrents/export endpoint is not available on this server."
          }
```

(the `"tooltip"` object is a new sibling of `"item"` inside `pages.main.grid.context-menu`, added right after `"item"`'s closing `},`, before `"overlays"`).

- [ ] **Step 2: Update `public/i18n/hu.json`** with the same structure, mirrored:

```json
          "item": {
            "copy-name": "Név másolása",
            "copy-names": "Nevek másolása",
            "copy-info-hash": "Info hash másolása",
            "copy-info-hashes": "Info hash-ek másolása",
            "copy-magnet-link": "Magnet link másolása",
            "copy-magnet-links": "Magnet linkek másolása",
            "copy-save-path": "Mentési útvonal másolása",
            "copy-save-paths": "Mentési útvonalak másolása",
            "copy-as-json": "Másolás JSON-ként",
            "export-torrent-file": "Exportálás .torrent fájlba",
            "export-torrent-files": "Exportálás .torrent fájlokba",
            "torrent-details": "Torrent részletei",
            "start": "Indítás",
            "stop": "Leállítás",
            "force-resume": "Kényszerített folytatás",
            "set-location": "Hely beállítása",
            "show-in-folder": "Megjelenítés mappában",
            "open-destination": "Célmappa megnyitása",
            "rename-torrent": "Torrent átnevezése",
            "rename-files": "Fájlok átnevezése",
            "set-category": "Kategória beállítása",
            "set-tags": "Címkék beállítása",
            "remove": "Eltávolítás",
            "transfer-limit": "Átviteli korlát",
            "share-limit": "Megosztási korlát",
            "enable-super-seeding": "Super seeding engedélyezése",
            "disable-super-seeding": "Super seeding tiltása",
            "force-recheck": "Kényszerített ellenőrzés",
            "force-reannounce": "Kényszerített újrajelentkezés",
            "enable-auto-tmm": "Auto TMM bekapcsolása",
            "disable-auto-tmm": "Auto TMM kikapcsolása",
            "move-to-top": "Mozgatás legfelülre",
            "move-up": "Mozgatás feljebb",
            "move-down": "Mozgatás lejjebb",
            "move-to-bottom": "Mozgatás legalulra",
            "hide-column": "Oszlop elrejtése",
            "clear-filter": "Szűrő törlése",
            "show-all": "Összes megjelenítése",
            "hide-all": "Összes elrejtése",
            "pin-to-top": "Rögzítés felülre",
            "pin-to-bottom": "Rögzítés alulra",
            "unpin": "Rögzítés feloldása",
            "pin-left": "Rögzítés balra",
            "pin-right": "Rögzítés jobbra",
            "unpin-column": "Oszlop rögzítésének feloldása",
            "sort-ascending": "Növekvő rendezés",
            "sort-descending": "Csökkenő rendezés",
            "clear-sort": "Rendezés törlése",
            "open-filter": "Szűrő megnyitása",
            "show-floating-filters": "Lebegő szűrők megjelenítése",
            "hide-floating-filters": "Lebegő szűrők elrejtése",
            "autosize-column": "Oszlop automatikus méretezése",
            "autosize-all-columns": "Összes oszlop automatikus méretezése"
          },
          "tooltip": {
            "open-destination-unresolved": "A torrent mentési útvonala nem feloldható ezen a gépen.",
            "already-pinned-top": "Ez a sor már a tetejére van rögzítve.",
            "already-pinned-bottom": "Ez a sor már az aljára van rögzítve.",
            "not-pinned": "Ez a sor nincs rögzítve.",
            "already-sorted-ascending": "Ez az oszlop már növekvő sorrendben van rendezve.",
            "already-sorted-descending": "Ez az oszlop már csökkenő sorrendben van rendezve.",
            "no-sort-applied": "Ehhez az oszlophoz nincs rendezés beállítva.",
            "filter-not-supported": "Ez az oszlop nem támogatja a szűrést.",
            "no-filter-active": "Ehhez az oszlophoz nincs aktív szűrő.",
            "already-pinned-left": "Ez az oszlop már balra van rögzítve.",
            "already-pinned-right": "Ez az oszlop már jobbra van rögzítve.",
            "column-not-pinned": "Ez az oszlop nincs rögzítve.",
            "export-unavailable": "A /api/v2/torrents/export végpont nem elérhető ezen a szerveren."
          }
```

- [ ] **Step 3: Validate both files are well-formed JSON**

Run: `node -e "JSON.parse(require('fs').readFileSync('public/i18n/us.json', 'utf8')); JSON.parse(require('fs').readFileSync('public/i18n/hu.json', 'utf8')); console.log('OK')"`
Expected: prints `OK`.

- [ ] **Step 4: Run the app test suite once more**

Run: `npm run test --workspace=packages/app`
Expected: PASS — no spec asserts on the now-removed `copy-cell-value` key's translated text.

- [ ] **Step 5: Commit**

```bash
git add public/i18n/us.json public/i18n/hu.json
git commit -m "#177: added i18n strings for export .torrent and copy menu rework"
```

---

### Task 8: Final verification and PR prep

**Files:** none (verification only).

- [ ] **Step 1: Lint the whole codebase**

Run: `npm run lint`
Expected: zero warnings/errors (the project enforces `--max-warnings=0`).

- [ ] **Step 2: Run every workspace's tests**

Run: `npm test`
Expected: all packages (`app`, `electron`, `shared`) pass.

- [ ] **Step 3: Build everything**

Run: `npm run build && npm run build:electron`
Expected: both builds succeed with no type errors.

- [ ] **Step 4: Manually verify the feature**

Start the app (`npm start`), log in to a real or test qBittorrent instance, and confirm:

- Right-clicking a torrent shows "Export .torrent" at the root level of the menu; exporting one torrent opens a Save As dialog, exporting multiple opens a folder picker and writes one file per torrent.
- The Copy submenu shows Name, Magnet Link, Torrent ID (Hash), Save Path, As JSON in that order, with no "Copy cell value" entry; multi-selecting and copying any of these joins values with newlines; "As JSON" produces an array even for a single torrent.
- Hovering a disabled item (e.g. right-click a column header and hover "Sort Ascending" when already sorted ascending) shows a tooltip explaining why.
- If you have access to an older qBittorrent instance without `/api/v2/torrents/export`, confirm "Export .torrent" appears disabled with a tooltip, and that the bulk Export modal still correctly reports "Legacy export" for that server.

- [ ] **Step 5: Remove the specs/plans docs folder before opening the PR**

Per this repo's `CLAUDE.md` convention, `docs/superpowers/` must not be merged to `main`. Once implementation and manual verification above are complete:

```bash
git rm -r docs/superpowers
git commit -m "#177: removed spec and plan"
```

- [ ] **Step 6: Push and open the PR**

```bash
git push -u origin 177-export-torrent-and-copy-menu
```

Then open a PR using `.github/pull_request_template.md` as the exact body structure (read it first — don't invent a different format), with a title that is a clean description (no `#177` prefix) and a body containing `Fixes #177`.
