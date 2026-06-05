# BBE Export/Import Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement cross-platform torrent export/import using a `.bbe` ZIP archive format, with full Electron IPC pipeline and Angular modals styled after the add-torrent component.

**Architecture:** New `ipc/export.ts` module handles all export/import logic in the Electron main process, communicating with Angular via fire-and-forget IPC sends and push-event progress updates (same pattern as `qb:sync-maindata-stream`). Angular `ExportService` holds signal-based state that two new modals (`ExportTorrents`, `ImportTorrents`) read reactively.

**Tech Stack:** archiver (ZIP write), adm-zip (ZIP read), semver (version comparison), Angular 20 signals + reactive forms, NgBootstrap modals, Bootstrap `bb-fieldset` / `form-switch` patterns.

**Spec:** `docs/superpowers/specs/2026-06-05-bbe-export-import-design.md`

---

## File Map

### New files

| File                                                                             | Responsibility                                    |
| -------------------------------------------------------------------------------- | ------------------------------------------------- |
| `packages/electron/src/ipc/export.ts`                                            | All export/import IPC handlers + helper functions |
| `packages/electron/src/ipc/export.spec.ts`                                       | Unit tests for helper functions                   |
| `packages/app/src/app/services/export.service.ts`                                | Signal-based export/import state                  |
| `packages/app/src/app/services/export.service.spec.ts`                           | Service unit tests                                |
| `packages/app/src/app/components/modals/export-torrents/export-torrents.ts`      | Export modal component                            |
| `packages/app/src/app/components/modals/export-torrents/export-torrents.html`    | Export modal template                             |
| `packages/app/src/app/components/modals/export-torrents/export-torrents.spec.ts` | Export modal tests                                |
| `packages/app/src/app/components/modals/import-torrents/import-torrents.ts`      | Import modal component                            |
| `packages/app/src/app/components/modals/import-torrents/import-torrents.html`    | Import modal template                             |
| `packages/app/src/app/components/modals/import-torrents/import-torrents.spec.ts` | Import modal tests                                |

### Modified files

| File                                                          | Change                                                                  |
| ------------------------------------------------------------- | ----------------------------------------------------------------------- |
| `package.json`                                                | Add `archiver`, `adm-zip` deps; add `bbe` to `fileAssociations`         |
| `packages/shared/src/ipc.types.ts`                            | Add export namespace types + `BitButlerAPI.export` + `window.onOpenBbe` |
| `packages/electron/src/ipc/qbittorrent.ts`                    | Add `responseType?: 'buffer'` to `QbRequestPayload`                     |
| `packages/electron/src/ipc/window.ts`                         | Add `.bbe` file association queue + handlers                            |
| `packages/electron/src/preload.ts`                            | Wire `export` namespace + `window.onOpenBbe`                            |
| `packages/electron/src/main.ts`                               | Register export IPC handlers                                            |
| `packages/electron/src/menu.ts`                               | Add Export/Import items to `loggedInItems`                              |
| `packages/app/src/app/models/command.model.ts`                | Add `UI_EXPORT_TORRENTS`, `UI_IMPORT_TORRENTS`                          |
| `packages/app/src/app/services/ui-command-handler.service.ts` | Handle new UI commands                                                  |
| `public/i18n/us.json`                                         | Add all new translation keys                                            |
| `public/i18n/hu.json`                                         | Add all new translation keys (same text as en, translated later)        |

---

## Task 1: Install dependencies and update package.json

**Files:**

- Modify: `package.json`

- [ ] **Step 1: Install archiver and adm-zip**

```bash
npm install archiver adm-zip
npm install --save-dev @types/archiver @types/adm-zip
```

Expected: packages added to `node_modules`, `package.json` dependencies updated.

- [ ] **Step 2: Add `bbe` file association to `package.json`**

In the `build.fileAssociations` array (around line 141, after the existing `torrent` entry), add:

```json
{
  "ext": "bbe",
  "name": "BitButler Export File",
  "description": "BitButler export archive",
  "mimeType": "application/x-bitbutler-export",
  "role": "Viewer",
  "icon": "packages/app/src/assets/icons/bitbutler.ico"
}
```

- [ ] **Step 3: Verify imports work**

```bash
node -e "import('archiver').then(m => console.log('archiver ok', typeof m.default))"
node -e "import('adm-zip').then(m => console.log('adm-zip ok', typeof m.default))"
```

Expected: `archiver ok function` and `adm-zip ok function`

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json
git commit -m "#127: add archiver and adm-zip deps, add bbe file association"
```

---

## Task 2: Add shared IPC types

**Files:**

- Modify: `packages/shared/src/ipc.types.ts`

- [ ] **Step 1: Add new types before the `BitButlerAPI` interface**

Add after the existing type declarations (before `export interface BitButlerAPI`):

```typescript
export type ExportScope = 'all' | 'filtered' | 'selected';
export type ExportMode = 'full' | 'legacy';
export type ImportStartMode = 'paused' | 'active' | 'all';

export type ImportRestoreField =
  | 'save_path'
  | 'category_tags'
  | 'speed_limits'
  | 'share_limits'
  | 'renames'
  | 'priorities'
  | 'auto_tmm'
  | 'sequential_download'
  | 'super_seeding'
  | 'first_last_piece_prio';

export interface ExportStartPayload {
  serverId: string;
  scope: ExportScope;
  hashes: string[];
  destDir: string;
  filename: string;
}

export interface ExportProgressEvent {
  current: number;
  total: number;
  name: string;
  skipped: number;
}

export interface ExportDoneEvent {
  path: string;
  total: number;
  skipped: number;
}

export interface BbeTorrentFile {
  index: number;
  name: string;
  priority: number;
}

export interface BbeTorrentEntry {
  hash: string;
  name: string;
  failed: boolean;
  error?: string;
  save_path?: string;
  category?: string;
  tags?: string[];
  up_limit?: number;
  dl_limit?: number;
  auto_tmm?: boolean;
  ratio_limit?: number;
  seeding_time_limit?: number;
  inactive_seeding_time_limit?: number;
  super_seeding?: boolean;
  sequential_download?: boolean;
  first_last_piece_prio?: boolean;
  magnet_link?: string;
  state?: string;
  files?: BbeTorrentFile[];
}

export interface BbeMetadata {
  version: number;
  exported_at: string;
  source_server: string;
  export_mode: ExportMode;
  torrents: BbeTorrentEntry[];
}

export interface BbePathMapping {
  from: string;
  to: string;
}

export interface ImportStartPayload {
  serverId: string;
  bbePath: string;
  restoreFields: ImportRestoreField[];
  startMode: ImportStartMode;
  pathMappings: BbePathMapping[];
}
```

- [ ] **Step 2: Add `export` namespace to `BitButlerAPI`**

Inside `BitButlerAPI`, add after the `i18n` block:

```typescript
  export: {
    start(payload: ExportStartPayload): void;
    cancel(): void;
    openBbePicker(): Promise<string | undefined>;
    readBbe(payload: { path: string }): Promise<BbeMetadata>;
    importStart(payload: ImportStartPayload): void;
    importCancel(): void;
    onProgress(cb: (e: ExportProgressEvent) => void): () => void;
    onDone(cb: (e: ExportDoneEvent) => void): () => void;
    onError(cb: (e: { message: string }) => void): () => void;
    onImportProgress(cb: (e: ExportProgressEvent) => void): () => void;
    onImportDone(cb: (e: { total: number; skipped: number }) => void): () => void;
    onImportError(cb: (e: { message: string }) => void): () => void;
  };
```

- [ ] **Step 3: Add `onOpenBbe` to the `window` namespace in `BitButlerAPI`**

Inside the `window` block, add after `drainOpenTorrents`:

```typescript
    onOpenBbe(callback: (path: string) => void): () => void;
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
npm run build:electron
```

Expected: no type errors in `packages/shared`.

- [ ] **Step 5: Commit**

```bash
git add packages/shared/src/ipc.types.ts
git commit -m "#127: add export/import shared IPC types"
```

---

## Task 3: Extend qbRequest with buffer support

**Files:**

- Modify: `packages/electron/src/ipc/qbittorrent.ts`

The existing `qbRequest` always calls `res.text()`, which corrupts binary torrent data. Add `responseType: 'buffer'` support.

- [ ] **Step 1: Add `responseType` to `QbRequestPayload`**

In `qbittorrent.ts`, find the `QbRequestPayload` interface (around line 27) and add:

```typescript
interface QbRequestPayload {
  id: string;
  path: string;
  method?: string;
  query?: Record<string, string | number | boolean>;
  body?: unknown;
  form?: Record<string, string>;
  headers?: Record<string, string>;
  responseType?: 'buffer';
}
```

- [ ] **Step 2: Handle buffer response type in `qbRequest`**

In `qbRequest`, replace the response handling block (currently `const text = await res.text();` through the end of the function) with:

```typescript
if (!res.ok) {
  const errText = await res.text();
  throw JSON.stringify({
    name: 'QbHttpError',
    status: res.status,
    statusText: res.statusText,
    body: errText,
    path,
  });
}

const rotated = extractSidCookie(res);
if (rotated) cookieJar.set(id, rotated);

if (payload.responseType === 'buffer') {
  const ab = await res.arrayBuffer();
  return Buffer.from(ab);
}

const text = await res.text();
const contentType = res.headers.get('content-type') ?? '';
if (contentType.includes('application/json')) {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

return text;
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npm run build:electron
```

Expected: clean build.

- [ ] **Step 4: Commit**

```bash
git add packages/electron/src/ipc/qbittorrent.ts
git commit -m "#127: add responseType buffer support to qbRequest"
```

---

## Task 4: Export helper functions with TDD

**Files:**

- Create: `packages/electron/src/ipc/export.ts`
- Create: `packages/electron/src/ipc/export.spec.ts`

Pure helper functions with no side effects. Write tests first.

- [ ] **Step 1: Write failing tests**

Create `packages/electron/src/ipc/export.spec.ts`:

```typescript
import { describe, expect, it } from 'vitest';
import { applyPathMappings, isActiveState } from './export.js';

describe('isActiveState', () => {
  it('returns false for pausedDL', () => {
    expect(isActiveState('pausedDL')).toBe(false);
  });

  it('returns false for pausedUP', () => {
    expect(isActiveState('pausedUP')).toBe(false);
  });

  it('returns false for stoppedDL (qBittorrent 5+)', () => {
    expect(isActiveState('stoppedDL')).toBe(false);
  });

  it('returns false for stoppedUP (qBittorrent 5+)', () => {
    expect(isActiveState('stoppedUP')).toBe(false);
  });

  it('returns true for downloading', () => {
    expect(isActiveState('downloading')).toBe(true);
  });

  it('returns true for seeding', () => {
    expect(isActiveState('seeding')).toBe(true);
  });

  it('returns true for stalledDL', () => {
    expect(isActiveState('stalledDL')).toBe(true);
  });

  it('returns false for undefined', () => {
    expect(isActiveState(undefined)).toBe(false);
  });
});

describe('applyPathMappings', () => {
  it('replaces matching prefix', () => {
    const result = applyPathMappings('/media/downloads/linux', [
      { from: '/media/downloads', to: '/mnt/nas' },
    ]);
    expect(result).toBe('/mnt/nas/linux');
  });

  it('returns original path when no rule matches', () => {
    const result = applyPathMappings('/home/user/torrents', [
      { from: '/media/downloads', to: '/mnt/nas' },
    ]);
    expect(result).toBe('/home/user/torrents');
  });

  it('applies first matching rule only', () => {
    const result = applyPathMappings('/media/downloads/movies', [
      { from: '/media/downloads', to: '/mnt/nas' },
      { from: '/media', to: '/storage' },
    ]);
    expect(result).toBe('/mnt/nas/movies');
  });

  it('ignores rules with empty from', () => {
    const result = applyPathMappings('/media/downloads', [
      { from: '', to: '/mnt/nas' },
      { from: '/media/downloads', to: '/mnt/data' },
    ]);
    expect(result).toBe('/mnt/data');
  });

  it('returns original path with empty mappings array', () => {
    expect(applyPathMappings('/media/downloads', [])).toBe('/media/downloads');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm test --workspace=packages/electron
```

Expected: FAIL — `export.js` not found.

- [ ] **Step 3: Create `export.ts` with the helper implementations**

Create `packages/electron/src/ipc/export.ts`:

```typescript
import type {
  BbeMetadata,
  BbeTorrentEntry,
  BbeTorrentFile,
  ExportDoneEvent,
  ExportProgressEvent,
  ExportStartPayload,
  ImportStartPayload,
} from '@bitbutler/shared';
import AdmZip from 'adm-zip';
import archiver from 'archiver';
import { dialog, ipcMain } from 'electron';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import semver from 'semver';
import { qbRequest } from './qbittorrent.js';

const INACTIVE_STATES = new Set(['pausedDL', 'pausedUP', 'stoppedDL', 'stoppedUP']);

export function isActiveState(state: string | undefined): boolean {
  if (!state) return false;
  return !INACTIVE_STATES.has(state);
}

export function applyPathMappings(
  savePath: string,
  mappings: Array<{ from: string; to: string }>,
): string {
  for (const { from, to } of mappings) {
    if (!from) continue;
    if (savePath.startsWith(from)) {
      return to + savePath.slice(from.length);
    }
  }
  return savePath;
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm test --workspace=packages/electron
```

Expected: all `isActiveState` and `applyPathMappings` tests PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/electron/src/ipc/export.ts packages/electron/src/ipc/export.spec.ts
git commit -m "#127: add export helper functions with unit tests"
```

---

## Task 5: Implement the export pipeline

**Files:**

- Modify: `packages/electron/src/ipc/export.ts`

- [ ] **Step 1: Add internal types and state at the top of `export.ts`**

After the imports, add:

```typescript
interface QbTorrentInfo {
  hash: string;
  name: string;
  save_path: string;
  category: string;
  tags: string;
  upLimit: number;
  dlLimit: number;
  auto_tmm: boolean;
  ratio_limit: number;
  seeding_time_limit: number;
  inactive_seeding_time_limit: number;
  super_seeding: boolean;
  seq_dl: boolean;
  f_l_piece_prio: boolean;
  state: string;
  magnet_uri: string;
}

interface QbTorrentFile {
  index: number;
  name: string;
  priority: number;
}

let exportCancelled = false;
let importCancelled = false;
```

- [ ] **Step 2: Add the `registerExportIpcHandlers` function stub and cancel handlers**

```typescript
export function registerExportIpcHandlers(): void {
  ipcMain.on('export:cancel', () => {
    exportCancelled = true;
  });

  ipcMain.on('import:cancel', () => {
    importCancelled = true;
  });

  ipcMain.handle('export:open-bbe-picker', async () => {
    const { filePaths } = await dialog.showOpenDialog({
      properties: ['openFile'],
      filters: [{ name: 'BitButler Export', extensions: ['bbe'] }],
    });
    return filePaths[0];
  });

  ipcMain.handle('export:read-bbe', async (_event, { path: bbePath }: { path: string }) => {
    const zip = new AdmZip(bbePath);
    const entry = zip.getEntry('metadata.json');
    if (!entry) throw new Error('Invalid .bbe file: metadata.json not found');
    const metadata = JSON.parse(entry.getData().toString('utf8')) as BbeMetadata;
    if (!Array.isArray(metadata?.torrents)) {
      throw new Error('Invalid .bbe file: metadata.json is malformed');
    }
    return metadata;
  });

  ipcMain.on('export:start', (event, payload: ExportStartPayload) => {
    void runExport(event, payload);
  });

  ipcMain.on('import:start', (event, payload: ImportStartPayload) => {
    void runImport(event, payload);
  });
}
```

- [ ] **Step 3: Implement `runExport`**

Add after `registerExportIpcHandlers`:

```typescript
async function runExport(event: Electron.IpcMainEvent, payload: ExportStartPayload): Promise<void> {
  exportCancelled = false;
  const { serverId, hashes, destDir, filename } = payload;

  const send = (channel: string, data: unknown): void => {
    if (!event.sender.isDestroyed()) event.sender.send(channel, data);
  };

  try {
    const apiVersion = (await qbRequest({
      id: serverId,
      path: '/api/v2/app/webapiVersion',
    })) as string;
    const isFullMode = semver.gte(apiVersion.trim(), '2.8.3');

    const tmpPath = path.join(os.tmpdir(), `bbe-${Date.now()}.zip`);
    const output = fs.createWriteStream(tmpPath);
    const archive = archiver('zip', { zlib: { level: 6 } });
    archive.pipe(output);

    const outputClosed = new Promise<void>((resolve, reject) => {
      output.on('close', resolve);
      output.on('error', reject);
    });

    const entries: BbeTorrentEntry[] = [];
    let skipped = 0;

    for (let i = 0; i < hashes.length; i++) {
      if (exportCancelled) break;

      const hash = hashes[i];
      const entry = await buildExportEntry(serverId, hash, isFullMode, archive);
      entries.push(entry);
      if (entry.failed) skipped++;

      const progress: ExportProgressEvent = {
        current: i + 1,
        total: hashes.length,
        name: entry.name,
        skipped,
      };
      send('export:progress', progress);
    }

    const metadata: BbeMetadata = {
      version: 1,
      exported_at: new Date().toISOString(),
      source_server: serverId,
      export_mode: isFullMode ? 'full' : 'legacy',
      torrents: entries,
    };

    archive.append(JSON.stringify(metadata, null, 2), { name: 'metadata.json' });
    await archive.finalize();
    await outputClosed;

    if (exportCancelled) {
      await fs.promises.unlink(tmpPath).catch(() => {});
      return;
    }

    const destPath = path.join(destDir, `${filename}.bbe`);
    await fs.promises.copyFile(tmpPath, destPath);
    await fs.promises.unlink(tmpPath).catch(() => {});

    const done: ExportDoneEvent = { path: destPath, total: hashes.length, skipped };
    send('export:done', done);
  } catch (err) {
    send('export:error', { message: (err as Error)?.message ?? String(err) });
  }
}

async function buildExportEntry(
  serverId: string,
  hash: string,
  isFullMode: boolean,
  archive: archiver.Archiver,
): Promise<BbeTorrentEntry> {
  try {
    const [infoRes, filesRes] = await Promise.all([
      qbRequest({
        id: serverId,
        path: '/api/v2/torrents/info',
        query: { hashes: hash },
      }) as Promise<QbTorrentInfo[]>,
      qbRequest({ id: serverId, path: '/api/v2/torrents/files', query: { hash } }) as Promise<
        QbTorrentFile[]
      >,
    ]);

    const info = infoRes[0];
    const files: BbeTorrentFile[] = filesRes.map((f) => ({
      index: f.index,
      name: f.name,
      priority: f.priority,
    }));

    if (isFullMode) {
      const torrentBuffer = (await qbRequest({
        id: serverId,
        path: '/api/v2/torrents/export',
        query: { hash },
        responseType: 'buffer',
      })) as Buffer;
      archive.append(torrentBuffer, { name: `torrents/${hash}.torrent` });
    }

    const entry: BbeTorrentEntry = {
      hash,
      name: info.name,
      failed: false,
      save_path: info.save_path,
      category: info.category || undefined,
      tags: info.tags ? info.tags.split(', ').filter(Boolean) : [],
      up_limit: info.upLimit,
      dl_limit: info.dlLimit,
      auto_tmm: info.auto_tmm,
      ratio_limit: info.ratio_limit,
      seeding_time_limit: info.seeding_time_limit,
      inactive_seeding_time_limit: info.inactive_seeding_time_limit,
      super_seeding: info.super_seeding,
      sequential_download: info.seq_dl,
      first_last_piece_prio: info.f_l_piece_prio,
      state: info.state,
      ...(isFullMode ? {} : { magnet_link: info.magnet_uri }),
      files,
    };

    return entry;
  } catch (err) {
    return {
      hash,
      name: hash,
      failed: true,
      error: (err as Error)?.message ?? String(err),
    };
  }
}
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
npm run build:electron
```

Expected: clean build.

- [ ] **Step 5: Commit**

```bash
git add packages/electron/src/ipc/export.ts
git commit -m "#127: implement export pipeline with archiver"
```

---

## Task 6: Implement the import pipeline

**Files:**

- Modify: `packages/electron/src/ipc/export.ts`

- [ ] **Step 1: Implement `runImport`**

Add after `buildExportEntry` in `export.ts`:

```typescript
async function runImport(event: Electron.IpcMainEvent, payload: ImportStartPayload): Promise<void> {
  importCancelled = false;
  const { serverId, bbePath, restoreFields, startMode, pathMappings } = payload;

  const send = (channel: string, data: unknown): void => {
    if (!event.sender.isDestroyed()) event.sender.send(channel, data);
  };

  try {
    const zip = new AdmZip(bbePath);
    const metaEntry = zip.getEntry('metadata.json');
    if (!metaEntry) throw new Error('Invalid .bbe: metadata.json not found');
    const metadata = JSON.parse(metaEntry.getData().toString('utf8')) as BbeMetadata;

    const torrents = metadata.torrents.filter((t) => !t.failed);
    let skipped = 0;

    for (let i = 0; i < torrents.length; i++) {
      if (importCancelled) break;

      const entry = torrents[i];

      try {
        await importTorrent(
          serverId,
          entry,
          metadata.export_mode,
          zip,
          restoreFields,
          startMode,
          pathMappings,
        );
      } catch {
        skipped++;
      }

      send('import:progress', {
        current: i + 1,
        total: torrents.length,
        name: entry.name,
        skipped,
      } satisfies ExportProgressEvent);
    }

    send('import:done', { total: torrents.length, skipped });
  } catch (err) {
    send('import:error', { message: (err as Error)?.message ?? String(err) });
  }
}

async function importTorrent(
  serverId: string,
  entry: BbeTorrentEntry,
  exportMode: 'full' | 'legacy',
  zip: AdmZip,
  restoreFields: ImportStartPayload['restoreFields'],
  startMode: ImportStartPayload['startMode'],
  pathMappings: ImportStartPayload['pathMappings'],
): Promise<void> {
  const has = (field: ImportStartPayload['restoreFields'][number]): boolean =>
    restoreFields.includes(field);

  const resolvedSavePath =
    has('save_path') && entry.save_path
      ? applyPathMappings(entry.save_path, pathMappings)
      : undefined;

  // Step 1: Add torrent (always paused)
  const addOptions: Record<string, unknown> = {
    stopped: 'true',
    paused: 'true',
  };

  if (resolvedSavePath) addOptions['savepath'] = resolvedSavePath;
  if (has('category_tags') && entry.category) addOptions['category'] = entry.category;
  if (has('category_tags') && entry.tags?.length) addOptions['tags'] = entry.tags.join(',');
  if (has('auto_tmm')) addOptions['autoTMM'] = String(entry.auto_tmm ?? false);
  if (has('sequential_download'))
    addOptions['sequentialDownload'] = String(entry.sequential_download ?? false);
  if (has('first_last_piece_prio'))
    addOptions['firstLastPiecePrio'] = String(entry.first_last_piece_prio ?? false);

  if (exportMode === 'full') {
    const torrentEntry = zip.getEntry(`torrents/${entry.hash}.torrent`);
    if (!torrentEntry) throw new Error(`Missing torrent file for hash ${entry.hash}`);
    const torrentBuffer = torrentEntry.getData();

    await qbRequest({
      id: serverId,
      method: 'POST',
      path: '/api/v2/torrents/add',
      body: buildAddFormData(torrentBuffer, entry.hash, addOptions),
    });
  } else {
    if (!entry.magnet_link) throw new Error(`No magnet link for hash ${entry.hash}`);
    await qbRequest({
      id: serverId,
      method: 'POST',
      path: '/api/v2/torrents/add',
      form: { urls: entry.magnet_link, ...flattenStringRecord(addOptions) },
    });
  }

  // Step 2: Poll for file tree
  let baseFiles: QbTorrentFile[] = [];
  for (let attempt = 0; attempt < 10; attempt++) {
    await sleep(500);
    const res = (await qbRequest({
      id: serverId,
      path: '/api/v2/torrents/files',
      query: { hash: entry.hash },
    })) as QbTorrentFile[];
    if (res?.length) {
      baseFiles = res;
      break;
    }
  }

  // Step 3: Apply renames
  if (has('renames') && entry.files?.length && baseFiles.length) {
    for (const saved of entry.files) {
      const base = baseFiles.find((f) => f.index === saved.index);
      if (base && base.name !== saved.name) {
        await qbRequest({
          id: serverId,
          method: 'POST',
          path: '/api/v2/torrents/renameFile',
          form: { hash: entry.hash, oldPath: base.name, newPath: saved.name },
        }).catch(() => {});
      }
    }
  }

  // Step 4: Apply file priorities
  if (has('priorities') && entry.files?.length) {
    const byPriority = new Map<number, number[]>();
    for (const f of entry.files) {
      const list = byPriority.get(f.priority) ?? [];
      list.push(f.index);
      byPriority.set(f.priority, list);
    }
    for (const [priority, indices] of byPriority) {
      await qbRequest({
        id: serverId,
        method: 'POST',
        path: '/api/v2/torrents/filePrio',
        form: { hash: entry.hash, id: indices.join('|'), priority: String(priority) },
      }).catch(() => {});
    }
  }

  // Step 5: Apply remaining metadata
  if (has('speed_limits')) {
    if (entry.up_limit !== undefined) {
      await qbRequest({
        id: serverId,
        method: 'POST',
        path: '/api/v2/torrents/setUploadLimit',
        form: { hashes: entry.hash, limit: String(entry.up_limit) },
      }).catch(() => {});
    }
    if (entry.dl_limit !== undefined) {
      await qbRequest({
        id: serverId,
        method: 'POST',
        path: '/api/v2/torrents/setDownloadLimit',
        form: { hashes: entry.hash, limit: String(entry.dl_limit) },
      }).catch(() => {});
    }
  }

  if (has('share_limits')) {
    await qbRequest({
      id: serverId,
      method: 'POST',
      path: '/api/v2/torrents/setShareLimits',
      form: {
        hashes: entry.hash,
        ratioLimit: String(entry.ratio_limit ?? -1),
        seedingTimeLimit: String(entry.seeding_time_limit ?? -1),
        inactiveSeedingTimeLimit: String(entry.inactive_seeding_time_limit ?? -1),
      },
    }).catch(() => {});
  }

  if (has('super_seeding') && entry.super_seeding !== undefined) {
    await qbRequest({
      id: serverId,
      method: 'POST',
      path: '/api/v2/torrents/setSuperSeeding',
      form: { hashes: entry.hash, value: String(entry.super_seeding) },
    }).catch(() => {});
  }

  // Step 6: Resume if applicable
  const shouldResume =
    startMode === 'all' || (startMode === 'active' && isActiveState(entry.state));

  if (shouldResume) {
    await qbRequest({
      id: serverId,
      method: 'POST',
      path: '/api/v2/torrents/resume',
      form: { hashes: entry.hash },
    }).catch(() => {});
  }
}
```

- [ ] **Step 2: Add utility helpers at the bottom of `export.ts`**

```typescript
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function flattenStringRecord(obj: Record<string, unknown>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined && v !== null) out[k] = String(v);
  }
  return out;
}

function buildAddFormData(
  torrentBuffer: Buffer,
  hash: string,
  options: Record<string, unknown>,
): FormData {
  const fd = new FormData();
  const blob = new Blob([torrentBuffer], { type: 'application/x-bittorrent' });
  fd.append('torrents', blob, `${hash}.torrent`);
  for (const [k, v] of Object.entries(options)) {
    if (v !== undefined && v !== null) fd.append(k, String(v));
  }
  return fd;
}
```

Note: `buildAddFormData` uses the native `FormData` / `Blob` (available in Node 18+). The `body` field in `qbRequest` handles `FormData` instances via its `isFormDataLike` branch which checks for `.getHeaders()` - but native `FormData` doesn't have that. Instead, pass the form as a `form` record for text fields and handle the file separately.

**Correction** - for torrent files with binary, use the existing `qbTorrentsAdd` pattern (axios + form-data). Update `buildAddFormData` to return a `form-data` instance:

```typescript
import FormData from 'form-data';

function buildAddFormData(
  torrentBuffer: Buffer,
  hash: string,
  options: Record<string, unknown>,
): { formData: FormData; headers: Record<string, string>; body: Buffer } {
  const fd = new FormData();
  fd.append('torrents', torrentBuffer, { filename: `${hash}.torrent` });
  for (const [k, v] of Object.entries(options)) {
    if (v !== undefined && v !== null) fd.append(k, String(v));
  }
  const body = fd.getBuffer();
  return {
    formData: fd,
    headers: { ...fd.getHeaders(), 'Content-Length': String(body.length) },
    body,
  };
}
```

And update the add call in `importTorrent`:

```typescript
if (exportMode === 'full') {
  const torrentEntry = zip.getEntry(`torrents/${entry.hash}.torrent`);
  if (!torrentEntry) throw new Error(`Missing torrent file for hash ${entry.hash}`);
  const { headers, body } = buildAddFormData(torrentEntry.getData(), entry.hash, addOptions);
  await qbRequest({ id: serverId, method: 'POST', path: '/api/v2/torrents/add', headers, body });
}
```

Add `import FormData from 'form-data';` at the top of `export.ts`.

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npm run build:electron
```

Expected: clean build.

- [ ] **Step 4: Commit**

```bash
git add packages/electron/src/ipc/export.ts
git commit -m "#127: implement import pipeline"
```

---

## Task 7: Add `.bbe` file association to window.ts

**Files:**

- Modify: `packages/electron/src/ipc/window.ts`

The existing `.torrent` open-file handling lives here. Follow the same pattern for `.bbe` files.

- [ ] **Step 1: Add `.bbe` queue and push function**

In `window.ts`, after the existing `pendingOpenFiles` declaration, add:

```typescript
const CHANNEL_OPEN_BBE = 'bb:open-bbe';
let pendingOpenBbe: string[] = [];
```

After `pushOpenFilesToRenderer`, add:

```typescript
function pushBbeToRenderer(bbePath: string): void {
  if (!mainWindowRef) return;
  try {
    mainWindowRef.webContents.send(CHANNEL_OPEN_BBE, bbePath);
  } catch (e) {
    console.error('[BitButler][open-bbe] Failed to send bbe path to renderer.', e);
  }
}
```

- [ ] **Step 2: Add `extractExistingBbeFiles` helper**

After `extractExistingTorrentFiles`, add:

```typescript
function extractExistingBbeFiles(argv: string[], startIndex = 0): string[] {
  return extractFilesWithExtension(argv, startIndex, '.bbe');
}
```

And refactor `extractExistingTorrentFiles` to share logic (or just duplicate — DRY matters less here since the functions are small):

```typescript
function extractExistingBbeFiles(argv: string[], startIndex = 0): string[] {
  const out: string[] = [];
  for (const arg of argv.slice(startIndex)) {
    if (!arg || typeof arg !== 'string') continue;
    if (arg.startsWith('-')) continue;
    const cleaned = arg.replace(/^"(.*)"$/, '$1').replace(/^'(.*)'$/, '$1');
    const resolved = path.isAbsolute(cleaned) ? cleaned : path.resolve(process.cwd(), cleaned);
    try {
      if (!fs.existsSync(resolved)) continue;
      const stat = fs.statSync(resolved);
      if (!stat.isFile()) continue;
      if (path.extname(resolved).toLowerCase() !== '.bbe') continue;
      out.push(resolved);
    } catch {}
  }
  return out;
}
```

- [ ] **Step 3: Add `handleIncomingOpenBbe` and flush logic**

After `flushQueueIfPossible`, add:

```typescript
function handleIncomingOpenBbe(bbePaths: string[]): void {
  const unique = Array.from(new Set(bbePaths.filter(Boolean)));
  if (!unique.length) return;
  if (!canSendToRendererNow()) {
    pendingOpenBbe.push(...unique);
    return;
  }
  for (const p of unique) pushBbeToRenderer(p);
}

function flushBbeQueueIfPossible(): void {
  if (!pendingOpenBbe.length || !canSendToRendererNow()) return;
  const toSend = Array.from(new Set(pendingOpenBbe));
  pendingOpenBbe = [];
  for (const p of toSend) pushBbeToRenderer(p);
}
```

- [ ] **Step 4: Update `handleSecondInstanceArgv` to also handle `.bbe` files**

In `handleSecondInstanceArgv`:

```typescript
export function handleSecondInstanceArgv(argv: string[]): void {
  const startIndex = getArgStartIndex();
  const torrentPaths = extractExistingTorrentFiles(argv, startIndex);
  void handleIncomingOpenFiles(torrentPaths, 'second-instance');
  const bbePaths = extractExistingBbeFiles(argv, startIndex);
  handleIncomingOpenBbe(bbePaths);
  focusMainWindow();
}
```

- [ ] **Step 5: Register `.bbe` IPC handlers in `registerWindowIpcHandlers`**

Inside `registerWindowIpcHandlers`, after the existing handlers, add:

```typescript
ipcMain.handle('window:open-bbe:drain', async () => {
  const toSend = Array.from(new Set(pendingOpenBbe));
  pendingOpenBbe = [];
  return toSend;
});
```

And in the `mainWindow.webContents.on('did-finish-load', ...)` callback, also flush the bbe queue:

```typescript
mainWindow.webContents.on('did-finish-load', () => {
  void flushQueueIfPossible();
  flushBbeQueueIfPossible();
});
```

Also add bbe handling to the initial startup argv:

```typescript
const initialBbe = extractExistingBbeFiles(process.argv, getArgStartIndex());
handleIncomingOpenBbe(initialBbe);
```

- [ ] **Step 6: Verify TypeScript compiles**

```bash
npm run build:electron
```

Expected: clean build.

- [ ] **Step 7: Commit**

```bash
git add packages/electron/src/ipc/window.ts
git commit -m "#127: add .bbe file association queue to window IPC handler"
```

---

## Task 8: Wire Electron — preload, main.ts, menu.ts

**Files:**

- Modify: `packages/electron/src/preload.ts`
- Modify: `packages/electron/src/main.ts`
- Modify: `packages/electron/src/menu.ts`

- [ ] **Step 1: Add `export` namespace to preload**

In `preload.ts`, add the import at the top (it comes from the shared types, no new import needed since `BitButlerAPI` already covers it).

Inside the `api` object, after the `i18n` block, add:

```typescript
  export: {
    start: (payload) => ipcRenderer.send('export:start', payload),
    cancel: () => ipcRenderer.send('export:cancel'),
    openBbePicker: () => ipcRenderer.invoke('export:open-bbe-picker'),
    readBbe: (payload) => ipcRenderer.invoke('export:read-bbe', payload),
    importStart: (payload) => ipcRenderer.send('import:start', payload),
    importCancel: () => ipcRenderer.send('import:cancel'),
    onProgress: (cb) =>
      makeIpcSubscription('export:progress', (p) => p as ExportProgressEvent, cb),
    onDone: (cb) =>
      makeIpcSubscription('export:done', (p) => p as ExportDoneEvent, cb),
    onError: (cb) =>
      makeIpcSubscription('export:error', (p) => p as { message: string }, cb),
    onImportProgress: (cb) =>
      makeIpcSubscription('import:progress', (p) => p as ExportProgressEvent, cb),
    onImportDone: (cb) =>
      makeIpcSubscription('import:done', (p) => p as { total: number; skipped: number }, cb),
    onImportError: (cb) =>
      makeIpcSubscription('import:error', (p) => p as { message: string }, cb),
  },
```

Add the missing shared type imports at the top of preload.ts:

```typescript
import type {
  BitButlerAPI,
  BitButlerSyncStreamResponse,
  ExportDoneEvent,
  ExportProgressEvent,
  MenuClickPayload,
  TorrentDraft,
  WindowState,
} from '@bitbutler/shared';
```

- [ ] **Step 2: Add `onOpenBbe` to the `window` namespace in preload**

Inside `window: { ... }`, add after `onTorrentDrafts`:

```typescript
    onOpenBbe: (callback) =>
      makeIpcSubscription(
        'bb:open-bbe',
        (p) => (typeof p === 'string' ? p : ''),
        callback,
      ),
```

Also add a drain handler:

```typescript
    drainOpenBbe: () => ipcRenderer.invoke('window:open-bbe:drain'),
```

And add these to the `BitButlerAPI.window` interface in `ipc.types.ts` (add to Task 2's shared types):

```typescript
    drainOpenBbe(): Promise<string[]>;
```

- [ ] **Step 3: Register export handlers in `main.ts`**

In `main.ts`, add the import:

```typescript
import { registerExportIpcHandlers } from './ipc/export.js';
```

Inside `createOrRestoreMainWindow`, after `registerElectronIpcHandlers();`, add:

```typescript
registerExportIpcHandlers();
```

- [ ] **Step 4: Add Export/Import to the File menu in `menu.ts`**

In `menu.ts`, inside the `File` submenu array, after the `add-torrent` submenu and its separator, add (before the disconnect item):

```typescript
        {
          label: t('electron.menu.export-torrents'),
          enabled: loggedIn,
          click: () => sendMenuAction(mainWindow, 'file.exportTorrents'),
        },
        {
          label: t('electron.menu.import-torrents'),
          enabled: loggedIn,
          click: () => sendMenuAction(mainWindow, 'file.importTorrents'),
        },
        { type: 'separator' },
```

- [ ] **Step 5: Verify TypeScript compiles**

```bash
npm run build:electron
```

Expected: clean build.

- [ ] **Step 6: Commit**

```bash
git add packages/electron/src/preload.ts packages/electron/src/main.ts packages/electron/src/menu.ts packages/shared/src/ipc.types.ts
git commit -m "#127: wire export IPC in preload, main, and menu"
```

---

## Task 9: Create Angular ExportService

**Files:**

- Create: `packages/app/src/app/services/export.service.ts`
- Create: `packages/app/src/app/services/export.service.spec.ts`

- [ ] **Step 1: Write failing tests**

Create `packages/app/src/app/services/export.service.spec.ts`:

```typescript
import { TestBed } from '@angular/core/testing';
import { ExportService } from './export.service';

describe('ExportService', () => {
  let service: ExportService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(ExportService);
  });

  it('should create', () => {
    expect(service).toBeTruthy();
  });

  it('should start with idle export phase', () => {
    expect(service.exportPhase()).toBe('idle');
  });

  it('should start with idle import phase', () => {
    expect(service.importPhase()).toBe('idle');
  });

  it('resetExport sets phase back to idle', () => {
    service.resetExport();
    expect(service.exportPhase()).toBe('idle');
  });

  it('resetImport sets phase back to idle', () => {
    service.resetImport();
    expect(service.importPhase()).toBe('idle');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm test --workspace=packages/app -- --reporter=verbose 2>&1 | grep ExportService
```

Expected: FAIL — `ExportService` not found.

- [ ] **Step 3: Implement ExportService**

Create `packages/app/src/app/services/export.service.ts`:

```typescript
import { Injectable, OnDestroy, computed, signal } from '@angular/core';
import type { BbeMetadata, ExportDoneEvent, ExportProgressEvent } from '@bitbutler/shared';

export type ExportPhase = 'idle' | 'running' | 'done' | 'error';
export type ImportPhase = 'idle' | 'loading' | 'ready' | 'running' | 'done' | 'error';

export interface ExportState {
  phase: ExportPhase;
  current: number;
  total: number;
  name: string;
  skipped: number;
  doneEvent?: ExportDoneEvent;
  error?: string;
}

export interface ImportState {
  phase: ImportPhase;
  metadata?: BbeMetadata;
  current: number;
  total: number;
  name: string;
  skipped: number;
  error?: string;
}

const EXPORT_IDLE: ExportState = { phase: 'idle', current: 0, total: 0, name: '', skipped: 0 };
const IMPORT_IDLE: ImportState = { phase: 'idle', current: 0, total: 0, name: '', skipped: 0 };

@Injectable({ providedIn: 'root' })
export class ExportService implements OnDestroy {
  private readonly _export = signal<ExportState>(EXPORT_IDLE);
  private readonly _import = signal<ImportState>(IMPORT_IDLE);

  readonly exportPhase = computed(() => this._export().phase);
  readonly exportState = this._export.asReadonly();

  readonly importPhase = computed(() => this._import().phase);
  readonly importState = this._import.asReadonly();

  private readonly unsubscribers: Array<() => void> = [];

  constructor() {
    const api = window.bitbutler.export;

    this.unsubscribers.push(
      api.onProgress((e) => this._export.update((s) => ({ ...s, phase: 'running', ...e }))),
      api.onDone((e) =>
        this._export.update((s) => ({ ...s, phase: 'done', doneEvent: e, current: s.total })),
      ),
      api.onError((e) => this._export.update((s) => ({ ...s, phase: 'error', error: e.message }))),
      api.onImportProgress((e) => this._import.update((s) => ({ ...s, phase: 'running', ...e }))),
      api.onImportDone((e) =>
        this._import.update((s) => ({ ...s, phase: 'done', skipped: e.skipped, current: s.total })),
      ),
      api.onImportError((e) =>
        this._import.update((s) => ({ ...s, phase: 'error', error: e.message })),
      ),
    );
  }

  startExport(): void {
    this._export.set({ ...EXPORT_IDLE, phase: 'running' });
  }

  setImportLoading(): void {
    this._import.set({ ...IMPORT_IDLE, phase: 'loading' });
  }

  setImportReady(metadata: BbeMetadata): void {
    this._import.update((s) => ({
      ...s,
      phase: 'ready',
      metadata,
      total: metadata.torrents.filter((t) => !t.failed).length,
    }));
  }

  startImport(): void {
    this._import.update((s) => ({ ...s, phase: 'running' }));
  }

  resetExport(): void {
    this._export.set(EXPORT_IDLE);
  }

  resetImport(): void {
    this._import.set(IMPORT_IDLE);
  }

  ngOnDestroy(): void {
    this.unsubscribers.forEach((fn) => fn());
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm test --workspace=packages/app -- --reporter=verbose 2>&1 | grep -A5 ExportService
```

Expected: all ExportService tests PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/app/src/app/services/export.service.ts packages/app/src/app/services/export.service.spec.ts
git commit -m "#127: add ExportService with signal-based export/import state"
```

---

## Task 10: Update command model and UiCommandHandlerService

**Files:**

- Modify: `packages/app/src/app/models/command.model.ts`
- Modify: `packages/app/src/app/services/ui-command-handler.service.ts`

- [ ] **Step 1: Add new UI commands to `command.model.ts`**

In `command.model.ts`, inside the `UiCommand` union type, add:

```typescript
  | { type: 'UI_EXPORT_TORRENTS' }
  | { type: 'UI_IMPORT_TORRENTS'; bbePath?: string }
```

- [ ] **Step 2: Wire commands in `UiCommandHandlerService`**

In `ui-command-handler.service.ts`, add imports for the new modals:

```typescript
import { ExportTorrents } from '../components/modals/export-torrents/export-torrents';
import { ImportTorrents } from '../components/modals/import-torrents/import-torrents';
```

In the `start()` method's `switch` statement, add:

```typescript
          case 'UI_EXPORT_TORRENTS':
            if (this.isModalOpen(ExportTorrents)) break;
            this.modalService.open(ExportTorrents, { size: 'lg' });
            break;

          case 'UI_IMPORT_TORRENTS': {
            if (this.isModalOpen(ImportTorrents)) break;
            const importRef = this.modalService.open(ImportTorrents, { size: 'lg' });
            if (command.bbePath) {
              setModalInput(importRef, 'initialBbePath', command.bbePath);
            }
            break;
          }
```

- [ ] **Step 3: Handle menu clicks and `onOpenBbe` in `start()`**

In the existing `menu:onClick` subscription (look for `case 'file.addTorrent.file'` in `UiCommandHandlerService`), add cases for the new menu actions:

```typescript
          case 'file.exportTorrents':
            this.commandBusService.emit({ type: 'UI_EXPORT_TORRENTS' });
            break;
          case 'file.importTorrents':
            void window.bitbutler.export.openBbePicker().then((bbePath) => {
              if (bbePath) this.commandBusService.emit({ type: 'UI_IMPORT_TORRENTS', bbePath });
            });
            break;
```

Also in `start()`, subscribe to `onOpenBbe` for file-association opens:

```typescript
const unsubBbe = window.bitbutler.window.onOpenBbe((bbePath) => {
  this.commandBusService.emit({ type: 'UI_IMPORT_TORRENTS', bbePath });
});
this.destroyRef.onDestroy(unsubBbe);

void window.bitbutler.window.drainOpenBbe().then((paths) => {
  if (paths[0]) this.commandBusService.emit({ type: 'UI_IMPORT_TORRENTS', bbePath: paths[0] });
});
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
npm run build
```

Expected: clean build.

- [ ] **Step 5: Commit**

```bash
git add packages/app/src/app/models/command.model.ts packages/app/src/app/services/ui-command-handler.service.ts
git commit -m "#127: add UI_EXPORT_TORRENTS and UI_IMPORT_TORRENTS commands"
```

---

## Task 11: Create ExportTorrents modal

**Files:**

- Create: `packages/app/src/app/components/modals/export-torrents/export-torrents.ts`
- Create: `packages/app/src/app/components/modals/export-torrents/export-torrents.html`
- Create: `packages/app/src/app/components/modals/export-torrents/export-torrents.spec.ts`

- [ ] **Step 1: Write failing tests**

Create `packages/app/src/app/components/modals/export-torrents/export-torrents.spec.ts`:

```typescript
import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { TranslateModule } from '@ngx-translate/core';
import { ExportService } from '../../../services/export.service';
import { FilterService } from '../../../services/filter.service';
import { SelectionStoreService } from '../../../services/selection-store.service';
import { ServerStoreService } from '../../../services/server-store.service';
import { TorrentStoreService } from '../../../services/torrent-store.service';
import { ExportTorrents } from './export-torrents';

describe('ExportTorrents', () => {
  let component: ExportTorrents;
  let fixture: ComponentFixture<ExportTorrents>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ExportTorrents, TranslateModule.forRoot()],
      providers: [
        { provide: NgbActiveModal, useValue: { dismiss: vi.fn() } },
        {
          provide: ExportService,
          useValue: {
            exportPhase: signal('idle'),
            exportState: signal({ phase: 'idle', current: 0, total: 0, name: '', skipped: 0 }),
            startExport: vi.fn(),
            resetExport: vi.fn(),
          },
        },
        { provide: FilterService, useValue: { filtered: signal([]) } },
        { provide: SelectionStoreService, useValue: { selected: signal([]) } },
        { provide: TorrentStoreService, useValue: { torrents: signal([]) } },
        { provide: ServerStoreService, useValue: { currentServer: signal(null) } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ExportTorrents);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should default scope to all', () => {
    expect(component.exportForm.get('scope')?.value).toBe('all');
  });

  it('should compute hasSelection as false when selected is empty', () => {
    expect(component.hasSelection()).toBe(false);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm test --workspace=packages/app -- --reporter=verbose 2>&1 | grep ExportTorrents
```

Expected: FAIL — `ExportTorrents` not found.

- [ ] **Step 3: Create component TypeScript**

Create `packages/app/src/app/components/modals/export-torrents/export-torrents.ts`:

```typescript
import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import type { ExportScope, ExportStartPayload } from '@bitbutler/shared';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { TranslatePipe } from '@ngx-translate/core';
import { ExportService } from '../../../services/export.service';
import { FilterService } from '../../../services/filter.service';
import { SelectionStoreService } from '../../../services/selection-store.service';
import { ServerStoreService } from '../../../services/server-store.service';
import { TorrentStoreService } from '../../../services/torrent-store.service';

@Component({
  selector: 'app-export-torrents',
  standalone: true,
  imports: [ReactiveFormsModule, TranslatePipe],
  templateUrl: './export-torrents.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ExportTorrents implements OnInit {
  private readonly activeModal = inject(NgbActiveModal);
  readonly exportService = inject(ExportService);
  private readonly filterService = inject(FilterService);
  private readonly selectionStore = inject(SelectionStoreService);
  private readonly torrentStore = inject(TorrentStoreService);
  private readonly serverStore = inject(ServerStoreService);

  exportForm!: FormGroup;

  readonly allCount = computed(() => this.torrentStore.torrents().length);
  readonly filteredCount = computed(() => this.filterService.filtered().length);
  readonly selectedCount = computed(() => this.selectionStore.selected().length);
  readonly hasSelection = computed(() => this.selectedCount() > 0);
  readonly hasFiltered = computed(() => this.filteredCount() > 0);

  readonly phase = this.exportService.exportPhase;
  readonly state = this.exportService.exportState;

  readonly isRunning = computed(() => this.phase() === 'running');
  readonly isDone = computed(() => this.phase() === 'done');
  readonly isError = computed(() => this.phase() === 'error');

  readonly progressPct = computed(() => {
    const s = this.state();
    return s.total > 0 ? Math.round((s.current / s.total) * 100) : 0;
  });

  ngOnInit(): void {
    const today = new Date();
    const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '');
    const serverName = (this.serverStore.currentServer()?.name ?? 'export')
      .toLowerCase()
      .replace(/\s+/g, '-');

    this.exportForm = new FormGroup({
      scope: new FormControl<ExportScope>('all', { nonNullable: true }),
      destDir: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
      filename: new FormControl(`${serverName}-${dateStr}`, {
        nonNullable: true,
        validators: [Validators.required],
      }),
    });
  }

  async browseDestDir(): Promise<void> {
    const dir = await window.bitbutler.electron.showOpenDialog();
    if (dir) this.exportForm.get('destDir')?.setValue(dir);
  }

  startExport(): void {
    if (this.exportForm.invalid) return;
    const { scope, destDir, filename } = this.exportForm.getRawValue();

    let hashes: string[];
    if (scope === 'selected') {
      hashes = this.selectionStore.selected().map((t) => t.hash);
    } else if (scope === 'filtered') {
      hashes = this.filterService.filtered().map((t) => t.hash);
    } else {
      hashes = this.torrentStore.torrents().map((t) => t.hash);
    }

    const serverId = this.serverStore.currentServer()?.id ?? '';
    const payload: ExportStartPayload = { serverId, scope, hashes, destDir, filename };

    this.exportService.startExport();
    window.bitbutler.export.start(payload);
  }

  cancelExport(): void {
    window.bitbutler.export.cancel();
  }

  showInFolder(): void {
    const p = this.state().doneEvent?.path;
    if (p) void window.bitbutler.electron.showItemInFolder(p);
  }

  close(): void {
    this.exportService.resetExport();
    this.activeModal.dismiss();
  }
}
```

- [ ] **Step 4: Create component template**

Create `packages/app/src/app/components/modals/export-torrents/export-torrents.html`:

```html
<div class="modal-header">
  <h5 class="modal-title">{{ 'components.modals.export-torrents.title' | translate }}</h5>
  <button type="button" class="btn-close" aria-label="Close" (click)="close()"></button>
</div>

<div class="modal-body">
  <form [formGroup]="exportForm">
    <fieldset class="bb-fieldset mt-0">
      <legend>{{ 'components.modals.export-torrents.label.connection' | translate }}</legend>
      <div id="version-banner" class="alert alert-success mb-0 py-2">
        {{ 'components.modals.export-torrents.banner.full-mode' | translate }}
      </div>
    </fieldset>

    @if (phase() === 'idle') {

    <fieldset class="bb-fieldset">
      <legend>{{ 'components.modals.export-torrents.label.scope' | translate }}</legend>
      <div class="btn-group w-100" role="group">
        <input type="radio" class="btn-check" formControlName="scope" id="scope-all" value="all" />
        <label class="btn btn-outline-primary" for="scope-all">
          {{ 'components.modals.export-torrents.scope.all' | translate }} ({{ allCount() }})
        </label>
        <input
          type="radio"
          class="btn-check"
          formControlName="scope"
          id="scope-filtered"
          value="filtered"
          [attr.disabled]="!hasFiltered() || null"
        />
        <label class="btn btn-outline-primary" for="scope-filtered">
          {{ 'components.modals.export-torrents.scope.filtered' | translate }} ({{ filteredCount()
          }})
        </label>
        <input
          type="radio"
          class="btn-check"
          formControlName="scope"
          id="scope-selected"
          value="selected"
          [attr.disabled]="!hasSelection() || null"
        />
        <label class="btn btn-outline-primary" for="scope-selected">
          {{ 'components.modals.export-torrents.scope.selected' | translate }} ({{ selectedCount()
          }})
        </label>
      </div>
    </fieldset>

    <fieldset class="bb-fieldset">
      <legend>{{ 'components.modals.export-torrents.label.save-location' | translate }}</legend>
      <div class="input-group mb-3">
        <div class="form-floating flex-grow-1">
          <input
            type="text"
            class="form-control"
            id="destDir"
            formControlName="destDir"
            [placeholder]="'components.modals.export-torrents.placeholder.dest-dir' | translate"
            readonly
            (click)="browseDestDir()"
          />
          <label for="destDir"
            >{{ 'components.modals.export-torrents.label.dest-dir' | translate }}</label
          >
        </div>
        <button type="button" class="btn btn-outline-primary" (click)="browseDestDir()">
          {{ 'general.button.browse' | translate }}
        </button>
      </div>
      <div class="input-group">
        <div class="form-floating flex-grow-1">
          <input
            type="text"
            class="form-control"
            id="filename"
            formControlName="filename"
            [placeholder]="'components.modals.export-torrents.placeholder.filename' | translate"
          />
          <label for="filename"
            >{{ 'components.modals.export-torrents.label.filename' | translate }}</label
          >
        </div>
        <span class="input-group-text">.bbe</span>
      </div>
    </fieldset>

    } @if (phase() !== 'idle') {

    <fieldset class="bb-fieldset">
      <legend>{{ 'components.modals.export-torrents.label.progress' | translate }}</legend>

      @if (isRunning()) {
      <div class="d-flex justify-content-between mb-1">
        <span>{{ 'components.modals.export-torrents.progress.exporting' | translate }}</span>
        <span class="text-body-secondary">{{ state().current }} / {{ state().total }}</span>
      </div>
      <div class="progress mb-2">
        <div class="progress-bar" role="progressbar" [style.width.%]="progressPct()"></div>
      </div>
      <div class="text-body-secondary small">
        {{ 'components.modals.export-torrents.progress.fetching' | translate }}:
        <em>{{ state().name }}</em>
      </div>
      } @if (isDone()) {
      <div class="alert alert-success mb-0 py-2 d-flex justify-content-between align-items-center">
        <span>
          {{ 'components.modals.export-torrents.progress.done' | translate }} @if (state().skipped >
          0) { — {{ state().skipped }} {{ 'components.modals.export-torrents.progress.skipped' |
          translate }} }
        </span>
        <button type="button" class="btn btn-sm btn-outline-success" (click)="showInFolder()">
          {{ 'components.modals.export-torrents.button.show-in-folder' | translate }}
        </button>
      </div>
      } @if (isError()) {
      <div class="alert alert-danger mb-0 py-2">{{ state().error }}</div>
      }
    </fieldset>

    }
  </form>
</div>

<div class="modal-footer">
  @if (isRunning()) {
  <button type="button" class="btn btn-secondary" (click)="cancelExport()">
    {{ 'general.button.cancel' | translate }}
  </button>
  } @else if (isDone() || isError()) {
  <button type="button" class="btn btn-secondary" (click)="close()">
    {{ 'general.button.close' | translate }}
  </button>
  } @else {
  <button
    type="button"
    class="btn btn-primary"
    (click)="startExport()"
    [disabled]="exportForm.invalid"
  >
    {{ 'components.modals.export-torrents.button.export' | translate }}
  </button>
  <button type="button" class="btn btn-link" (click)="close()">
    {{ 'general.button.cancel' | translate }}
  </button>
  }
</div>
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
npm test --workspace=packages/app -- --reporter=verbose 2>&1 | grep ExportTorrents
```

Expected: ExportTorrents tests PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/app/src/app/components/modals/export-torrents/
git commit -m "#127: add ExportTorrents modal component"
```

---

## Task 12: Create ImportTorrents modal

**Files:**

- Create: `packages/app/src/app/components/modals/import-torrents/import-torrents.ts`
- Create: `packages/app/src/app/components/modals/import-torrents/import-torrents.html`
- Create: `packages/app/src/app/components/modals/import-torrents/import-torrents.spec.ts`

- [ ] **Step 1: Write failing tests**

Create `packages/app/src/app/components/modals/import-torrents/import-torrents.spec.ts`:

```typescript
import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { TranslateModule } from '@ngx-translate/core';
import { ExportService } from '../../../services/export.service';
import { ServerStoreService } from '../../../services/server-store.service';
import { ImportTorrents } from './import-torrents';

describe('ImportTorrents', () => {
  let component: ImportTorrents;
  let fixture: ComponentFixture<ImportTorrents>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ImportTorrents, TranslateModule.forRoot()],
      providers: [
        { provide: NgbActiveModal, useValue: { dismiss: vi.fn() } },
        {
          provide: ExportService,
          useValue: {
            importPhase: signal('idle'),
            importState: signal({ phase: 'idle', current: 0, total: 0, name: '', skipped: 0 }),
            setImportLoading: vi.fn(),
            setImportReady: vi.fn(),
            startImport: vi.fn(),
            resetImport: vi.fn(),
          },
        },
        { provide: ServerStoreService, useValue: { currentServer: signal(null) } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ImportTorrents);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should default startMode to active', () => {
    expect(component.importForm.get('startMode')?.value).toBe('active');
  });

  it('should default all restore fields to true', () => {
    const fields = component.importForm.get('restoreFields')?.value as Record<string, boolean>;
    expect(Object.values(fields).every(Boolean)).toBe(true);
  });

  it('should compute startModeHint for active', () => {
    expect(component.startModeHint()).toContain('active');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm test --workspace=packages/app -- --reporter=verbose 2>&1 | grep ImportTorrents
```

Expected: FAIL — `ImportTorrents` not found.

- [ ] **Step 3: Create component TypeScript**

Create `packages/app/src/app/components/modals/import-torrents/import-torrents.ts`:

```typescript
import { ChangeDetectionStrategy, Component, OnInit, computed, inject, input } from '@angular/core';
import { FormArray, FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import type {
  BbePathMapping,
  ImportRestoreField,
  ImportStartMode,
  ImportStartPayload,
} from '@bitbutler/shared';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { TranslatePipe } from '@ngx-translate/core';
import { ExportService } from '../../../services/export.service';
import { ServerStoreService } from '../../../services/server-store.service';

@Component({
  selector: 'app-import-torrents',
  standalone: true,
  imports: [ReactiveFormsModule, TranslatePipe],
  templateUrl: './import-torrents.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ImportTorrents implements OnInit {
  readonly initialBbePath = input<string>();

  private readonly activeModal = inject(NgbActiveModal);
  readonly exportService = inject(ExportService);
  private readonly serverStore = inject(ServerStoreService);

  importForm!: FormGroup;

  readonly phase = this.exportService.importPhase;
  readonly state = this.exportService.importState;
  readonly isLoading = computed(() => this.phase() === 'loading');
  readonly isReady = computed(() => this.phase() === 'ready');
  readonly isRunning = computed(() => this.phase() === 'running');
  readonly isDone = computed(() => this.phase() === 'done');
  readonly isError = computed(() => this.phase() === 'error');

  readonly progressPct = computed(() => {
    const s = this.state();
    return s.total > 0 ? Math.round((s.current / s.total) * 100) : 0;
  });

  readonly startModeHint = computed(() => {
    const mode = this.importForm?.get('startMode')?.value as ImportStartMode;
    const hints: Record<ImportStartMode, string> = {
      paused: 'components.modals.import-torrents.start-mode.hint.paused',
      active: 'components.modals.import-torrents.start-mode.hint.active',
      all: 'components.modals.import-torrents.start-mode.hint.all',
    };
    return hints[mode] ?? hints['active'];
  });

  readonly showPathRemap = computed(
    () => this.importForm?.get('restoreFields.save_path')?.value === true,
  );

  readonly metadata = computed(() => this.state().metadata);

  get pathMappings(): FormArray {
    return this.importForm.get('pathMappings') as FormArray;
  }

  ngOnInit(): void {
    this.importForm = new FormGroup({
      startMode: new FormControl<ImportStartMode>('active', { nonNullable: true }),
      restoreFields: new FormGroup({
        save_path: new FormControl(true, { nonNullable: true }),
        category_tags: new FormControl(true, { nonNullable: true }),
        speed_limits: new FormControl(true, { nonNullable: true }),
        share_limits: new FormControl(true, { nonNullable: true }),
        renames: new FormControl(true, { nonNullable: true }),
        priorities: new FormControl(true, { nonNullable: true }),
        auto_tmm: new FormControl(true, { nonNullable: true }),
        sequential_download: new FormControl(true, { nonNullable: true }),
        super_seeding: new FormControl(true, { nonNullable: true }),
        first_last_piece_prio: new FormControl(true, { nonNullable: true }),
      }),
      pathMappings: new FormArray([this.createMappingRow()]),
    });

    const bbePath = this.initialBbePath();
    if (bbePath) void this.loadBbe(bbePath);
  }

  createMappingRow(from = '', to = ''): FormGroup {
    return new FormGroup({
      from: new FormControl(from, { nonNullable: true }),
      to: new FormControl(to, { nonNullable: true }),
    });
  }

  addMapping(): void {
    this.pathMappings.push(this.createMappingRow());
  }

  removeMapping(i: number): void {
    if (this.pathMappings.length === 1) {
      this.pathMappings.at(0).reset({ from: '', to: '' });
    } else {
      this.pathMappings.removeAt(i);
    }
  }

  async browseToPath(i: number): Promise<void> {
    const dir = await window.bitbutler.electron.showOpenDialog();
    if (dir) this.pathMappings.at(i).get('to')?.setValue(dir);
  }

  async loadBbe(bbePath: string): Promise<void> {
    this.exportService.setImportLoading();
    try {
      const metadata = await window.bitbutler.export.readBbe({ path: bbePath });
      this.exportService.setImportReady(metadata);
    } catch (err) {
      this.exportService['_import'].update((s) => ({
        ...s,
        phase: 'error',
        error: (err as Error)?.message ?? String(err),
      }));
    }
  }

  startImport(): void {
    const raw = this.importForm.getRawValue();
    const restoreFields = (Object.entries(raw.restoreFields) as [ImportRestoreField, boolean][])
      .filter(([, v]) => v)
      .map(([k]) => k);

    const pathMappings: BbePathMapping[] = (
      raw.pathMappings as Array<{ from: string; to: string }>
    ).filter((r) => r.from.trim());

    const payload: ImportStartPayload = {
      serverId: this.serverStore.currentServer()?.id ?? '',
      bbePath: this.initialBbePath() ?? '',
      restoreFields,
      startMode: raw.startMode,
      pathMappings,
    };

    this.exportService.startImport();
    window.bitbutler.export.importStart(payload);
  }

  cancelImport(): void {
    window.bitbutler.export.importCancel();
  }

  close(): void {
    this.exportService.resetImport();
    this.activeModal.dismiss();
  }
}
```

- [ ] **Step 4: Create component template**

Create `packages/app/src/app/components/modals/import-torrents/import-torrents.html`:

```html
<div class="modal-header">
  <h5 class="modal-title">{{ 'components.modals.import-torrents.title' | translate }}</h5>
  <button type="button" class="btn-close" aria-label="Close" (click)="close()"></button>
</div>

<div class="modal-body">
  @if (isLoading()) {
  <div class="d-flex justify-content-center py-4">
    <app-bb-spinner></app-bb-spinner>
  </div>
  } @if (isError() && !isRunning() && !isDone()) {
  <div class="alert alert-danger">{{ state().error }}</div>
  } @if (isReady() || isRunning() || isDone()) {
  <form [formGroup]="importForm">
    <fieldset class="bb-fieldset mt-0">
      <legend>{{ 'components.modals.import-torrents.label.archive' | translate }}</legend>
      @if (metadata()) {
      <div class="small">
        <span class="fw-bold">{{ metadata()!.source_server }}</span>
        &nbsp;·&nbsp;{{ metadata()!.exported_at | date:'yyyy-MM-dd' }} &nbsp;·&nbsp;{{
        metadata()!.torrents.length }} {{ 'components.modals.import-torrents.archive.torrents' |
        translate }} &nbsp;·&nbsp;{{ metadata()!.export_mode === 'full' ?
        ('components.modals.import-torrents.archive.full-mode' | translate) :
        ('components.modals.import-torrents.archive.legacy-mode' | translate) }}
      </div>
      <div class="small text-body-secondary mt-1">
        {{ 'components.modals.import-torrents.archive.importing-to' | translate }}:
        <strong>{{ (serverStore.currentServer()?.name ?? '') }}</strong>
      </div>
      }
    </fieldset>

    @if (isReady()) {

    <fieldset class="bb-fieldset" formGroupName="restoreFields">
      <legend>{{ 'components.modals.import-torrents.label.restore-options' | translate }}</legend>
      <div class="container-fluid px-0">
        <div class="row">
          @for (field of restoreFieldKeys; track field) {
          <div class="col-6">
            <div class="form-check form-switch mb-2">
              <input
                class="form-check-input"
                type="checkbox"
                role="switch"
                [id]="'rf-' + field"
                [formControlName]="field"
              />
              <label class="form-check-label" [for]="'rf-' + field">
                {{ 'components.modals.import-torrents.restore.' + field | translate }}
              </label>
            </div>
          </div>
          }
        </div>
      </div>
    </fieldset>

    @if (showPathRemap()) {
    <fieldset class="bb-fieldset" formArrayName="pathMappings">
      <legend>
        {{ 'components.modals.import-torrents.label.path-remap' | translate }}
        <span class="fw-normal text-body-secondary ms-1"
          >({{ 'components.modals.import-torrents.path-remap.optional' | translate }})</span
        >
      </legend>
      @for (group of pathMappings.controls; track $index; let i = $index) {
      <div class="row mb-2" [formGroupName]="i">
        <div class="col-5">
          <div class="form-floating">
            <input
              type="text"
              class="form-control"
              [id]="'from-' + i"
              placeholder="from"
              formControlName="from"
            />
            <label [for]="'from-' + i"
              >{{ 'components.modals.import-torrents.path-remap.from' | translate }}</label
            >
          </div>
        </div>
        <div class="col-5">
          <div class="form-floating">
            <div class="input-group">
              <div class="form-floating flex-grow-1">
                <input
                  type="text"
                  class="form-control"
                  [id]="'to-' + i"
                  placeholder="to"
                  formControlName="to"
                />
                <label [for]="'to-' + i"
                  >{{ 'components.modals.import-torrents.path-remap.to' | translate }}</label
                >
              </div>
              <button type="button" class="btn btn-outline-primary" (click)="browseToPath(i)">
                {{ 'general.button.browse' | translate }}
              </button>
            </div>
          </div>
        </div>
        <div class="col-2 d-flex align-items-center justify-content-center gap-1">
          @if (!(pathMappings.length === 1 && !group.get('from')?.value && !group.get('to')?.value))
          {
          <button
            type="button"
            class="btn btn-lg btn-link text-danger p-0"
            (click)="removeMapping(i)"
          >
            <fa-icon [icon]="icons.faMinus"></fa-icon>
          </button>
          } @if ($last) {
          <button type="button" class="btn btn-lg btn-link text-success p-0" (click)="addMapping()">
            <fa-icon [icon]="icons.faPlus"></fa-icon>
          </button>
          }
        </div>
      </div>
      }
    </fieldset>
    }

    <fieldset class="bb-fieldset">
      <legend>{{ 'components.modals.import-torrents.label.after-import' | translate }}</legend>
      <div class="btn-group w-100 mb-2" role="group">
        <input
          type="radio"
          class="btn-check"
          formControlName="startMode"
          id="sm-paused"
          value="paused"
        />
        <label class="btn btn-outline-primary" for="sm-paused">
          {{ 'components.modals.import-torrents.start-mode.paused' | translate }}
        </label>
        <input
          type="radio"
          class="btn-check"
          formControlName="startMode"
          id="sm-active"
          value="active"
        />
        <label class="btn btn-outline-primary" for="sm-active">
          {{ 'components.modals.import-torrents.start-mode.active' | translate }}
        </label>
        <input type="radio" class="btn-check" formControlName="startMode" id="sm-all" value="all" />
        <label class="btn btn-outline-primary" for="sm-all">
          {{ 'components.modals.import-torrents.start-mode.all' | translate }}
        </label>
      </div>
      <div class="small text-body-secondary">{{ startModeHint() | translate }}</div>
    </fieldset>

    } @if (isRunning() || isDone() || isError()) {

    <fieldset class="bb-fieldset">
      <legend>{{ 'components.modals.import-torrents.label.progress' | translate }}</legend>

      @if (isRunning()) {
      <div class="d-flex justify-content-between mb-1">
        <span>{{ 'components.modals.import-torrents.progress.importing' | translate }}</span>
        <span class="text-body-secondary">{{ state().current }} / {{ state().total }}</span>
      </div>
      <div class="progress mb-2">
        <div class="progress-bar" role="progressbar" [style.width.%]="progressPct()"></div>
      </div>
      <div class="text-body-secondary small"><em>{{ state().name }}</em></div>
      } @if (isDone()) {
      <div class="alert alert-success mb-0 py-2">
        {{ 'components.modals.import-torrents.progress.done' | translate }} @if (state().skipped >
        0) { — {{ state().skipped }} {{ 'components.modals.import-torrents.progress.skipped' |
        translate }} }
      </div>
      } @if (isError()) {
      <div class="alert alert-danger mb-0 py-2">{{ state().error }}</div>
      }
    </fieldset>

    }
  </form>
  }
</div>

<div class="modal-footer">
  @if (isRunning()) {
  <button type="button" class="btn btn-secondary" (click)="cancelImport()">
    {{ 'general.button.cancel' | translate }}
  </button>
  } @else if (isDone() || isError()) {
  <button type="button" class="btn btn-secondary" (click)="close()">
    {{ 'general.button.close' | translate }}
  </button>
  } @else if (isReady()) {
  <button type="button" class="btn btn-primary" (click)="startImport()">
    {{ 'components.modals.import-torrents.button.import' | translate }}
  </button>
  <button type="button" class="btn btn-link" (click)="close()">
    {{ 'general.button.cancel' | translate }}
  </button>
  }
</div>
```

Add `restoreFieldKeys` and `icons` to the component class (insert before `ngOnInit`):

```typescript
  readonly restoreFieldKeys: ImportRestoreField[] = [
    'save_path', 'category_tags', 'speed_limits', 'share_limits',
    'renames', 'priorities', 'auto_tmm', 'sequential_download',
    'super_seeding', 'first_last_piece_prio',
  ];

  readonly icons = {
    faMinus: faMinus,
    faPlus: faPlus,
  };
```

Add FontAwesome imports at the top of the component file:

```typescript
import { FaIconComponent } from '@fortawesome/angular-fontawesome';
import { faMinus, faPlus } from '@fortawesome/free-solid-svg-icons';
```

Add `FaIconComponent` to the `imports` array in `@Component`.

- [ ] **Step 5: Run tests to verify they pass**

```bash
npm test --workspace=packages/app -- --reporter=verbose 2>&1 | grep ImportTorrents
```

Expected: ImportTorrents tests PASS.

- [ ] **Step 6: Run lint**

```bash
npm run lint
```

Expected: 0 warnings, 0 errors.

- [ ] **Step 7: Commit**

```bash
git add packages/app/src/app/components/modals/import-torrents/
git commit -m "#127: add ImportTorrents modal component"
```

---

## Task 13: Add i18n keys

**Files:**

- Modify: `public/i18n/us.json`
- Modify: `public/i18n/hu.json`

- [ ] **Step 1: Add keys to `us.json`**

In `public/i18n/us.json`, in the `electron.menu` object, add:

```json
"export-torrents": "Export Torrents",
"import-torrents": "Import Torrents"
```

In the `components` object, add:

```json
"export-torrents": {
  "title": "Export Torrents",
  "label": {
    "connection": "Connection",
    "scope": "Export scope",
    "save-location": "Save location",
    "dest-dir": "Directory",
    "filename": "Filename",
    "progress": "Progress"
  },
  "placeholder": {
    "dest-dir": "Select export directory",
    "filename": "Filename"
  },
  "banner": {
    "full-mode": "✓ Full export mode",
    "legacy-mode": "⚠ Legacy mode — only magnet links will be saved (qBittorrent < 4.5.0)"
  },
  "scope": {
    "all": "All",
    "filtered": "Filtered",
    "selected": "Selected"
  },
  "progress": {
    "exporting": "Exporting torrents...",
    "fetching": "Fetching",
    "done": "Export complete",
    "skipped": "skipped"
  },
  "button": {
    "export": "Export",
    "show-in-folder": "Show in folder"
  }
},
"import-torrents": {
  "title": "Import Torrents",
  "label": {
    "archive": "Archive",
    "restore-options": "Restore options",
    "path-remap": "Save path remapping",
    "after-import": "After import",
    "progress": "Progress"
  },
  "archive": {
    "torrents": "torrents",
    "full-mode": "Full export",
    "legacy-mode": "Legacy export",
    "importing-to": "Importing to"
  },
  "restore": {
    "save_path": "Save path",
    "category_tags": "Category & tags",
    "speed_limits": "Speed limits",
    "share_limits": "Share limits",
    "renames": "File renames",
    "priorities": "File priorities",
    "auto_tmm": "Auto-TMM",
    "sequential_download": "Sequential download",
    "super_seeding": "Super seeding",
    "first_last_piece_prio": "First/last piece prio"
  },
  "path-remap": {
    "optional": "optional",
    "from": "From prefix",
    "to": "To prefix"
  },
  "start-mode": {
    "paused": "Keep paused",
    "active": "Start active ones",
    "all": "Start all",
    "hint": {
      "paused": "All torrents will remain paused - start them manually when ready.",
      "active": "Torrents that were active when exported will resume automatically.",
      "all": "All imported torrents will start immediately regardless of their previous state."
    }
  },
  "progress": {
    "importing": "Importing torrents...",
    "done": "Import complete",
    "skipped": "skipped"
  },
  "button": {
    "import": "Import"
  }
}
```

- [ ] **Step 2: Mirror keys to `hu.json`**

Copy the same structure into `hu.json` (English text for now — translated separately):

Add the same JSON blocks as Step 1 into `hu.json`, identical text.

- [ ] **Step 3: Verify app builds**

```bash
npm run build
```

Expected: clean build, no missing translation key warnings.

- [ ] **Step 4: Run full test suite**

```bash
npm test
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add public/i18n/us.json public/i18n/hu.json
git commit -m "#127: add i18n keys for export/import modals and menu items"
```

---

## Self-Review Notes

**Spec gaps found and addressed in this plan:**

1. `pathMappings` missing from `ImportStartPayload` in spec — added in Task 2 as `BbePathMapping[]`
2. `drainOpenBbe` missing from `window` namespace in spec — added in Tasks 7 and 8
3. `formData` import needed in `export.ts` — `form-data` already in root `package.json` dependencies
4. `ExportService._import` is private — `importTorrents.ts` accessing it directly for the error case is a smell; add a `setImportError(message: string)` method to `ExportService` and use that instead (update both Task 9 and Task 12)
5. `serverStore` is used in `ImportTorrents` template but not declared as `readonly` — fix: add `readonly serverStore = inject(ServerStoreService)` explicitly

**Type consistency check:** `ExportProgressEvent` is reused for import progress events (same shape). `ImportStartMode` matches `startMode: 'paused' | 'active' | 'all'` in `ImportStartPayload`. `ImportRestoreField` union matches the `restoreFields` FormGroup keys. All consistent.
