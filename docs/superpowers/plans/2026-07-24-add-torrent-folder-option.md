# Add Torrent: Folder Option Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "Folder" input mode to the Add Torrent modal (next to File and Link) that scans a chosen folder for `.torrent` files, parses them, lists them in an ag-grid with per-row rename/selection, and bulk-adds the checked ones.

**Architecture:** A new main-process IPC (`torrent:scan-folder`) recursively lists `.torrent` file paths under a directory; the renderer reuses the existing `torrent:parse` IPC per newly-discovered path, caching parsed results by absolute path in a new `AddTorrentFolderPicker` component (own ag-grid, own cache `Map`). That component is embedded in the existing `AddTorrentGeneral` "File/Link" input-mode switch as a third `folder` option. Submission iterates the checked rows and calls the existing `qb.torrentsAdd` once per row (qBittorrent's `rename` option is a single value per request, so per-row renames require per-row calls).

**Tech Stack:** Angular 20 (zoneless/signals), ag-grid-angular (community, already registered via `AllCommunityModule` in `packages/app/src/main.ts`), ng-bootstrap, ngx-translate, Electron IPC (contextBridge/ipcMain), Vitest (both `packages/app` and `packages/electron`).

## Global Constraints

- Spec source of truth: `docs/superpowers/specs/2026-07-24-add-torrent-folder-option-design.md` (issue #235).
- Commit format: `#235: <short description>` (per `CLAUDE.md`).
- `npm run lint` must stay at zero warnings; Prettier formatting is enforced by the pre-commit hook - do not fight it.
- Use `-` not `—` in all commit messages / any written output.
- English (`public/i18n/us.json`) and Hungarian (`public/i18n/hu.json`) translation files must be updated together for every new key.
- Do not touch `docs/superpowers/**` as part of feature commits other than this plan/spec themselves; remove the `docs` folder in its own commit before opening the PR, per `CLAUDE.md`.
- Toast conventions (from `CLAUDE.md`): title = short Title-Case outcome; message = variable detail or one short sentence; never restate the title.

---

## File Structure

**New files:**

- `packages/app/src/app/models/add-torrent-folder.model.ts` - `ScannedTorrentState`, `ScannedTorrentEntry`.
- `packages/app/src/app/modals/add-torrent/general/folder-picker/folder-picker.ts` - the folder-picker component (scan/cache/selection engine + grid).
- `packages/app/src/app/modals/add-torrent/general/folder-picker/folder-picker.html`
- `packages/app/src/app/modals/add-torrent/general/folder-picker/folder-picker.scss` (empty, matches sibling `general.scss`/`options.scss`)
- `packages/app/src/app/modals/add-torrent/general/folder-picker/folder-picker.spec.ts`
- `packages/electron/src/ipc/torrent.spec.ts` - first tests for `packages/electron/src/ipc/torrent.ts` (scoped to the new `torrent:scan-folder` handler only).

**Modified files:**

- `packages/shared/src/ipc.types.ts` - `electron.showOpenDialog(defaultPath?)`, new `torrent.scanFolder(...)`.
- `packages/electron/src/ipc/electron.ts` - `showOpenDialog` accepts an optional `defaultPath`.
- `packages/electron/src/ipc/electron.spec.ts` - covers the new argument.
- `packages/electron/src/ipc/torrent.ts` - new `torrent:scan-folder` handler.
- `packages/electron/src/preload.ts` - wires both.
- `packages/app/src/test-setup.ts` - global `window.bitbutler` test mock gains `torrent.scanFolder`.
- `packages/app/src/app/models/add-torrent.model.ts` - `folderGroup` on `AddTorrentFormGroup`; `folder`/`recursive` on `AddTorrentSettings` + defaults.
- `packages/app/src/app/modals/add-torrent/general/general.ts` / `.html` / `.spec.ts` - third input-mode option, embeds the folder-picker, hides the rename field in folder mode.
- `packages/app/src/app/modals/add-torrent/add-torrent.ts` / `.html` / `.spec.ts` - `inputMode` type, Files-tab disable reason, `canSubmit`, `handleSubmit` folder branch, settings load/save.
- `public/i18n/us.json`, `public/i18n/hu.json` - new keys (added incrementally, task by task, alongside the templates that use them).

---

### Task 1: Main-process folder scan + `showOpenDialog` default path

**Files:**

- Modify: `packages/shared/src/ipc.types.ts`
- Modify: `packages/electron/src/ipc/electron.ts`
- Modify: `packages/electron/src/ipc/electron.spec.ts`
- Modify: `packages/electron/src/ipc/torrent.ts`
- Create: `packages/electron/src/ipc/torrent.spec.ts`
- Modify: `packages/electron/src/preload.ts`
- Modify: `packages/app/src/test-setup.ts`

**Interfaces:**

- Produces: `BitButlerAPI.electron.showOpenDialog(defaultPath?: string): Promise<string>`
- Produces: `BitButlerAPI.torrent.scanFolder(payload: { path: string; recursive: boolean }): Promise<{ path: string; relativePath: string }[]>`

- [ ] **Step 1: Write the failing test for `torrent:scan-folder`**

Create `packages/electron/src/ipc/torrent.spec.ts`:

```ts
import { afterEach, describe, expect, it, vi } from 'vitest';

const ipcHandlers = vi.hoisted(() => new Map<string, (...args: unknown[]) => unknown>());
const mockReaddir = vi.hoisted(() => vi.fn());

vi.mock('node:fs', () => ({
  default: {
    promises: {
      readdir: mockReaddir,
      readFile: vi.fn(),
    },
  },
}));

vi.mock('electron', () => ({
  ipcMain: {
    handle: vi.fn((channel: string, handler: (...args: unknown[]) => unknown) => {
      ipcHandlers.set(channel, handler);
    }),
  },
}));

function dirent(name: string, isDir: boolean) {
  return { name, isDirectory: () => isDir, isFile: () => !isDir };
}

describe('torrent:scan-folder', () => {
  afterEach(() => {
    vi.clearAllMocks();
    ipcHandlers.clear();
  });

  async function registerAndGetHandlers() {
    const { registerTorrentIpcHandlers } = await import('./torrent.js');
    registerTorrentIpcHandlers();
    return ipcHandlers;
  }

  it('returns .torrent files in the top-level directory only when recursive is false', async () => {
    mockReaddir.mockResolvedValueOnce([
      dirent('a.torrent', false),
      dirent('notes.txt', false),
      dirent('subfolder', true),
    ]);

    const handlers = await registerAndGetHandlers();
    const result = (await handlers.get('torrent:scan-folder')!(null, {
      path: '/downloads',
      recursive: false,
    })) as { path: string; relativePath: string }[];

    expect(result).toEqual([{ path: '/downloads/a.torrent', relativePath: 'a.torrent' }]);
    expect(mockReaddir).toHaveBeenCalledTimes(1);
  });

  it('recurses into subdirectories when recursive is true', async () => {
    mockReaddir
      .mockResolvedValueOnce([dirent('top.torrent', false), dirent('nested', true)])
      .mockResolvedValueOnce([dirent('inner.torrent', false)]);

    const handlers = await registerAndGetHandlers();
    const result = (await handlers.get('torrent:scan-folder')!(null, {
      path: '/downloads',
      recursive: true,
    })) as { path: string; relativePath: string }[];

    expect(result).toEqual([
      { path: '/downloads/top.torrent', relativePath: 'top.torrent' },
      { path: '/downloads/nested/inner.torrent', relativePath: 'nested/inner.torrent' },
    ]);
  });

  it('does not recurse into subdirectories when recursive is false', async () => {
    mockReaddir.mockResolvedValueOnce([dirent('top.torrent', false), dirent('nested', true)]);

    const handlers = await registerAndGetHandlers();
    const result = (await handlers.get('torrent:scan-folder')!(null, {
      path: '/downloads',
      recursive: false,
    })) as { path: string; relativePath: string }[];

    expect(result).toEqual([{ path: '/downloads/top.torrent', relativePath: 'top.torrent' }]);
    expect(mockReaddir).toHaveBeenCalledTimes(1);
  });

  it('returns an empty array when no path is provided', async () => {
    const handlers = await registerAndGetHandlers();
    const result = await handlers.get('torrent:scan-folder')!(null, { path: '', recursive: false });
    expect(result).toEqual([]);
  });

  it('propagates a readdir rejection (e.g. folder does not exist)', async () => {
    mockReaddir.mockRejectedValueOnce(new Error('ENOENT: no such file or directory'));

    const handlers = await registerAndGetHandlers();
    await expect(
      handlers.get('torrent:scan-folder')!(null, { path: '/missing', recursive: false }),
    ).rejects.toThrow('ENOENT');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/electron && npx vitest run src/ipc/torrent.spec.ts`
Expected: FAIL - `registerTorrentIpcHandlers` never registers a `torrent:scan-folder` handler, so `handlers.get('torrent:scan-folder')` is `undefined` and calling it throws.

- [ ] **Step 3: Implement `torrent:scan-folder` in the main process**

In `packages/electron/src/ipc/torrent.ts`, add the `path` import (already imports `path` at the top) and register a new handler inside `registerTorrentIpcHandlers()`:

```ts
export function registerTorrentIpcHandlers(): void {
  ipcMain.handle(
    'torrent:delete-file',
    async (_e, payload: unknown): Promise<{ ok: boolean; error?: string }> => {
      // ...unchanged...
    },
  );

  ipcMain.handle('torrent:parse', async (_e, payload: unknown): Promise<TorrentDraft> => {
    // ...unchanged...
  });

  ipcMain.handle(
    'torrent:scan-folder',
    async (_e, payload: unknown): Promise<{ path: string; relativePath: string }[]> => {
      const p = payload as Record<string, unknown>;
      const rootDir = typeof p?.path === 'string' ? p.path.trim() : '';
      const recursive = p?.recursive === true;
      if (!rootDir) return [];

      const absolutePaths = await walkForTorrentFiles(rootDir, recursive);
      return absolutePaths.map((absPath) => ({
        path: absPath,
        relativePath: path.relative(rootDir, absPath).split(path.sep).join('/'),
      }));
    },
  );
}

async function walkForTorrentFiles(dir: string, recursive: boolean): Promise<string[]> {
  const entries = await fs.promises.readdir(dir, { withFileTypes: true });
  const results: string[] = [];

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (recursive) results.push(...(await walkForTorrentFiles(fullPath, recursive)));
    } else if (entry.isFile() && entry.name.toLowerCase().endsWith('.torrent')) {
      results.push(fullPath);
    }
  }

  return results;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd packages/electron && npx vitest run src/ipc/torrent.spec.ts`
Expected: PASS (5 tests)

- [ ] **Step 5: Write the failing test for `showOpenDialog` with a `defaultPath`**

In `packages/electron/src/ipc/electron.spec.ts`, add inside the existing `describe('electron:show-open-dialog', ...)` block:

```ts
it('passes defaultPath through to dialog.showOpenDialog when provided', async () => {
  mockDialogShowOpenDialog.mockResolvedValue({ filePaths: ['/selected/folder'] });
  const handlers = await registerAndGetHandlers();
  await handlers.get('electron:show-open-dialog')!(null, '/downloads');
  expect(mockDialogShowOpenDialog).toHaveBeenCalledWith({
    properties: ['openDirectory'],
    defaultPath: '/downloads',
  });
});

it('omits defaultPath from the dialog options when not provided', async () => {
  mockDialogShowOpenDialog.mockResolvedValue({ filePaths: [] });
  const handlers = await registerAndGetHandlers();
  await handlers.get('electron:show-open-dialog')!(null);
  expect(mockDialogShowOpenDialog).toHaveBeenCalledWith({ properties: ['openDirectory'] });
});
```

- [ ] **Step 6: Run test to verify it fails**

Run: `cd packages/electron && npx vitest run src/ipc/electron.spec.ts`
Expected: FAIL - current `showOpenDialog()` takes no arguments and never passes `defaultPath` to `dialog.showOpenDialog`.

- [ ] **Step 7: Implement the `defaultPath` argument**

In `packages/electron/src/ipc/electron.ts`, change the handler registration and function:

```ts
ipcMain.handle('electron:show-open-dialog', async (_event, defaultPath?: string) =>
  showOpenDialog(defaultPath),
);
```

```ts
async function showOpenDialog(defaultPath?: string): Promise<string | undefined> {
  const { filePaths } = await dialog.showOpenDialog({
    properties: ['openDirectory'],
    ...(defaultPath ? { defaultPath } : {}),
  });
  return filePaths[0];
}
```

- [ ] **Step 8: Run test to verify it passes**

Run: `cd packages/electron && npx vitest run src/ipc/electron.spec.ts`
Expected: PASS (all tests in the file)

- [ ] **Step 9: Wire the shared IPC contract**

In `packages/shared/src/ipc.types.ts`, update the `electron` and `torrent` namespaces of `BitButlerAPI`:

```ts
  electron: {
    isDev(): Promise<boolean>;
    openExternalUrl(url: string): Promise<void>;
    showOpenDialog(defaultPath?: string): Promise<string>;
    openPath(path: string): Promise<string>;
    showItemInFolder(path: string): Promise<void>;
    getPlatform(): Promise<HostPlatform>;
    checkForUpdate(): Promise<UpdateCheckResponse>;
    setLoginItem(settings: { openAtLogin: boolean }): Promise<void>;
    getDownloadsPath(): Promise<string>;
  };
```

```ts
  torrent: {
    parse(payload: TorrentParsePayload): Promise<TorrentDraft>;
    deleteFile(payload: { path: string }): Promise<{ ok: boolean; error?: string }>;
    scanFolder(payload: {
      path: string;
      recursive: boolean;
    }): Promise<{ path: string; relativePath: string }[]>;
  };
```

- [ ] **Step 10: Wire the preload bridge**

In `packages/electron/src/preload.ts`:

```ts
  electron: {
    isDev: () => ipcRenderer.invoke('electron:is-dev'),
    openExternalUrl: (url) => ipcRenderer.invoke('electron:open-external-url', url),
    showOpenDialog: (defaultPath) => ipcRenderer.invoke('electron:show-open-dialog', defaultPath),
    openPath: (path) => ipcRenderer.invoke('electron:open-path', path),
    showItemInFolder: (path) => ipcRenderer.invoke('electron:show-item-in-folder', path),
    getPlatform: () => ipcRenderer.invoke('electron:get-platform'),
    checkForUpdate: () => ipcRenderer.invoke('electron:check-for-update'),
    setLoginItem: (settings) => ipcRenderer.invoke('electron:set-login-item', settings),
    getDownloadsPath: () => ipcRenderer.invoke('electron:get-downloads-path'),
  },
```

```ts
  torrent: {
    parse: (payload) => ipcRenderer.invoke('torrent:parse', payload),
    deleteFile: (payload) => ipcRenderer.invoke('torrent:delete-file', payload),
    scanFolder: (payload) => ipcRenderer.invoke('torrent:scan-folder', payload),
  },
```

- [ ] **Step 11: Update the renderer test mock**

In `packages/app/src/test-setup.ts`, update `torrent`:

```ts
  torrent: {
    parse: noopAsync,
    deleteFile: noopAsync,
    scanFolder: () => Promise.resolve([]),
  },
```

(`electron.showOpenDialog: () => Promise.resolve(null)` already tolerates the new optional argument - no change needed there.)

- [ ] **Step 12: Run the full electron test suite**

Run: `cd packages/electron && npm test`
Expected: PASS (no regressions)

- [ ] **Step 13: Typecheck the shared and app packages**

Run: `npm run build:electron && cd packages/app && npx tsc --noEmit -p tsconfig.app.json`
Expected: no errors (the `test-setup.ts` change and widened `showOpenDialog` signature must compile cleanly across all existing callers)

- [ ] **Step 14: Commit**

```bash
git add packages/shared/src/ipc.types.ts packages/electron/src/ipc/electron.ts packages/electron/src/ipc/electron.spec.ts packages/electron/src/ipc/torrent.ts packages/electron/src/ipc/torrent.spec.ts packages/electron/src/preload.ts packages/app/src/test-setup.ts
git commit -m "$(cat <<'EOF'
#235: add torrent:scan-folder IPC and showOpenDialog defaultPath support
EOF
)"
```

---

### Task 2: Renderer models - `ScannedTorrentEntry`, `folderGroup`, persisted folder settings

**Files:**

- Create: `packages/app/src/app/models/add-torrent-folder.model.ts`
- Modify: `packages/app/src/app/models/add-torrent.model.ts`

**Interfaces:**

- Produces: `ScannedTorrentState = 'new' | 'exists' | 'error'`
- Produces: `ScannedTorrentEntry { path, relativePath, name, size, fileCount, folderCount, state, errorMessage?, hash }`
- Produces: `AddTorrentFormGroup.folderGroup: FormGroup<{ folder: FormControl<string>; recursive: FormControl<boolean> }>`
- Produces: `AddTorrentSettings.folder: string | null`, `AddTorrentSettings.recursive: boolean`

- [ ] **Step 1: Create the scanned-entry model**

Create `packages/app/src/app/models/add-torrent-folder.model.ts`:

```ts
export type ScannedTorrentState = 'new' | 'exists' | 'error';

export interface ScannedTorrentEntry {
  path: string;
  relativePath: string;
  name: string;
  size: number;
  fileCount: number;
  folderCount: number;
  state: ScannedTorrentState;
  errorMessage?: string;
  hash: string | null;
}
```

- [ ] **Step 2: Extend `AddTorrentFormGroup` and `AddTorrentSettings`**

In `packages/app/src/app/models/add-torrent.model.ts`, add `folder`/`recursive` to `AddTorrentSettings` and its default, and add `folderGroup` to `AddTorrentFormGroup`:

```ts
export type AddTorrentSettings = {
  savepath: string | null;
  paused: boolean;
  category: string | null;
  tags: string | null;
  root_folder: RootFolderMode;
  skip_checking: boolean;
  sequentialDownload: boolean;
  firstLastPiecePrio: boolean;
  autoTMM: boolean;
  transferRateLimits: TransferLimitValue | null;
  shareLimits: ShareLimitValue | null;
  folder: string | null;
  recursive: boolean;
};

export const DEFAULT_ADD_TORRENT_SETTINGS: AddTorrentSettings = {
  savepath: null,
  paused: false,
  category: null,
  tags: null,
  root_folder: 'unset',
  skip_checking: false,
  sequentialDownload: false,
  firstLastPiecePrio: false,
  autoTMM: false,
  transferRateLimits: null,
  shareLimits: { ratioLimit: -2, seedingTimeLimit: -2, inactiveSeedingTimeLimit: -2 },
  folder: null,
  recursive: false,
};

export type AddTorrentFormGroup = FormGroup<{
  fileGroup: FormGroup<{
    file: FormControl<string>;
    rename: FormControl<string | null>;
  }>;
  linkGroup: FormGroup<{
    magnetLinks: FormControl<string>;
    rename: FormControl<string | null>;
  }>;
  folderGroup: FormGroup<{
    folder: FormControl<string>;
    recursive: FormControl<boolean>;
  }>;
  savepath: FormControl<string | null>;
  paused: FormControl<boolean>;
  category: FormControl<string | null>;
  root_folder: FormControl<RootFolderMode>;
  tags: FormControl<string[] | null>;
  skip_checking: FormControl<boolean>;
  sequentialDownload: FormControl<boolean>;
  firstLastPiecePrio: FormControl<boolean>;
  transferRateLimits: FormControl<TransferLimitValue | null>;
  shareLimits: FormControl<ShareLimitValue | null>;
  autoTMM: FormControl<boolean>;
}>;
```

- [ ] **Step 2b: Normalize the persisted folder path**

In `packages/app/src/app/services/add-torrent-settings.service.ts`, add `folder` to the existing `trimOrNull` normalization alongside `savepath`/`category`/`tags`:

```ts
  protected override normalize(s: AddTorrentSettings): AddTorrentSettings {
    const trimOrNull = (v: string | null) => {
      const t = (v ?? '').trim();
      return t ? t : null;
    };

    return {
      ...s,
      savepath: trimOrNull(s.savepath),
      category: trimOrNull(s.category),
      tags: trimOrNull(s.tags),
      folder: trimOrNull(s.folder),
    };
  }
```

This is a pure type/data change with no new branching logic of its own - it is exercised by the tests written in Tasks 3-6 (which construct real `AddTorrentFormGroup`/`AddTorrentSettings` values). Verify it compiles instead of writing a standalone unit test:

- [ ] **Step 3: Typecheck**

Run: `cd packages/app && npx tsc --noEmit -p tsconfig.app.json`
Expected: FAIL initially - `general.spec.ts`'s local `createForm()` helper builds an `AddTorrentFormGroup` literal without `folderGroup`, so it will no longer satisfy the type. This is expected; it gets fixed in Task 5 when `general.ts`/`general.spec.ts` are updated together. Confirm the _only_ new error is in `general.spec.ts` (or `add-torrent.spec.ts`, if it constructs the group manually - it does not, so no error is expected there) before moving on.

- [ ] **Step 4: Commit**

```bash
git add packages/app/src/app/models/add-torrent-folder.model.ts packages/app/src/app/models/add-torrent.model.ts packages/app/src/app/services/add-torrent-settings.service.ts
git commit -m "$(cat <<'EOF'
#235: add folder scan model and persisted folder/recursive settings
EOF
)"
```

(The `general.spec.ts` typecheck failure introduced here is resolved in Task 5's Step 1 - do not attempt to fix it in this task.)

---

### Task 3: `AddTorrentFolderPicker` - scan/cache/selection engine (no grid yet)

**Files:**

- Create: `packages/app/src/app/modals/add-torrent/general/folder-picker/folder-picker.ts`
- Create: `packages/app/src/app/modals/add-torrent/general/folder-picker/folder-picker.html` (minimal placeholder - the real grid template is Task 4)
- Create: `packages/app/src/app/modals/add-torrent/general/folder-picker/folder-picker.scss` (empty file)
- Create: `packages/app/src/app/modals/add-torrent/general/folder-picker/folder-picker.spec.ts`

**Interfaces:**

- Consumes: `AddTorrentFormGroup.folderGroup` (Task 2), `TorrentStoreService.torrentsMap: Signal<Map<string, Torrent>>` (existing), `window.bitbutler.torrent.{scanFolder,parse}` / `window.bitbutler.electron.{showOpenDialog,getDownloadsPath}` (Task 1)
- Produces: `AddTorrentFolderPicker.rows: Signal<ScannedTorrentEntry[]>`, `.loading: Signal<boolean>`, `.scanError: Signal<string | null>`, `.selectedPaths: Signal<Set<string>>`, `.selectedEntries: Signal<ScannedTorrentEntry[]>` (computed), `.browse(): Promise<void>`, `.refresh(): Promise<void>`, `.renameEntry(path: string, newName: string): void`

- [ ] **Step 1: Write the failing tests**

Create `packages/app/src/app/modals/add-torrent/general/folder-picker/folder-picker.spec.ts`:

```ts
import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormControl, FormGroup } from '@angular/forms';
import type { TorrentDraft } from '@bitbutler/shared';
import { AddTorrentFormGroup } from '../../../../models/add-torrent.model';
import { TorrentStoreService } from '../../../../services/torrent-store.service';
import { AddTorrentFolderPicker } from './folder-picker';

function createForm(folder = '', recursive = false): AddTorrentFormGroup {
  return new FormGroup({
    fileGroup: new FormGroup({
      file: new FormControl<string>('', { nonNullable: true }),
      rename: new FormControl<string | null>(null),
    }),
    linkGroup: new FormGroup({
      magnetLinks: new FormControl<string>('', { nonNullable: true }),
      rename: new FormControl<string | null>(null),
    }),
    folderGroup: new FormGroup({
      folder: new FormControl<string>(folder, { nonNullable: true }),
      recursive: new FormControl<boolean>(recursive, { nonNullable: true }),
    }),
    savepath: new FormControl<string | null>(null),
    paused: new FormControl<boolean>(false, { nonNullable: true }),
    category: new FormControl<string | null>(null),
    root_folder: new FormControl<'unset' | 'true' | 'false'>('unset', { nonNullable: true }),
    tags: new FormControl<string[] | null>(null),
    skip_checking: new FormControl<boolean>(false, { nonNullable: true }),
    sequentialDownload: new FormControl<boolean>(false, { nonNullable: true }),
    firstLastPiecePrio: new FormControl<boolean>(false, { nonNullable: true }),
    transferRateLimits: new FormControl(null),
    shareLimits: new FormControl(null),
    autoTMM: new FormControl<boolean>(false, { nonNullable: true }),
  }) as unknown as AddTorrentFormGroup;
}

function draft(overrides: Partial<NonNullable<TorrentDraft['torrent']>> = {}): TorrentDraft {
  return {
    source: 'manual',
    receivedAt: Date.now(),
    torrent: {
      name: 'Movie',
      totalSize: 100,
      files: [{ path: 'movie.mkv', length: 100 }],
      infoHashV1: 'abc123',
      ...overrides,
    },
  };
}

describe('AddTorrentFolderPicker', () => {
  let component: AddTorrentFolderPicker;
  let fixture: ComponentFixture<AddTorrentFolderPicker>;
  let torrentsMap: ReturnType<typeof signal<Map<string, unknown>>>;

  beforeEach(async () => {
    torrentsMap = signal(new Map());

    await TestBed.configureTestingModule({
      imports: [AddTorrentFolderPicker],
      providers: [{ provide: TorrentStoreService, useValue: { torrentsMap } }],
    }).compileComponents();

    fixture = TestBed.createComponent(AddTorrentFolderPicker);
    component = fixture.componentInstance;
  });

  function init(folder = '/downloads', recursive = false) {
    fixture.componentRef.setInput('form', createForm(folder, recursive));
    fixture.detectChanges();
  }

  it('should default the folder control to the Downloads path when empty on init', async () => {
    vi.spyOn(window.bitbutler.electron, 'getDownloadsPath').mockResolvedValue(
      '/home/user/Downloads',
    );
    vi.spyOn(window.bitbutler.torrent, 'scanFolder').mockResolvedValue([]);

    init('');
    await fixture.whenStable();

    expect(component.form().controls.folderGroup.controls.folder.value).toBe(
      '/home/user/Downloads',
    );
  });

  it('should not overwrite a persisted folder value on init', async () => {
    const scanSpy = vi.spyOn(window.bitbutler.torrent, 'scanFolder').mockResolvedValue([]);
    const downloadsSpy = vi.spyOn(window.bitbutler.electron, 'getDownloadsPath');

    init('/saved/folder');
    await fixture.whenStable();

    expect(downloadsSpy).not.toHaveBeenCalled();
    expect(scanSpy).toHaveBeenCalledWith({ path: '/saved/folder', recursive: false });
  });

  it('should populate rows from scanFolder + parse, marking a known hash as exists', async () => {
    vi.spyOn(window.bitbutler.torrent, 'scanFolder').mockResolvedValue([
      { path: '/downloads/a.torrent', relativePath: 'a.torrent' },
      { path: '/downloads/b.torrent', relativePath: 'b.torrent' },
    ]);
    vi.spyOn(window.bitbutler.torrent, 'parse')
      .mockResolvedValueOnce(draft({ infoHashV1: 'known-hash' }))
      .mockResolvedValueOnce(draft({ infoHashV1: 'new-hash' }));
    torrentsMap.set(new Map([['known-hash', {}]]));

    init('/downloads');
    await fixture.whenStable();

    expect(component.rows()).toEqual([
      expect.objectContaining({
        path: '/downloads/a.torrent',
        state: 'exists',
        hash: 'known-hash',
      }),
      expect.objectContaining({ path: '/downloads/b.torrent', state: 'new', hash: 'new-hash' }),
    ]);
  });

  it('should mark a parse failure as state error with the error message', async () => {
    vi.spyOn(window.bitbutler.torrent, 'scanFolder').mockResolvedValue([
      { path: '/downloads/bad.torrent', relativePath: 'bad.torrent' },
    ]);
    vi.spyOn(window.bitbutler.torrent, 'parse').mockResolvedValue({
      source: 'manual',
      receivedAt: Date.now(),
      error: { message: 'Invalid torrent file', code: 'PARSE_FAILED' },
    });

    init('/downloads');
    await fixture.whenStable();

    expect(component.rows()).toEqual([
      expect.objectContaining({
        path: '/downloads/bad.torrent',
        state: 'error',
        errorMessage: 'Invalid torrent file',
        hash: null,
      }),
    ]);
  });

  it('should reuse a cached entry on a second scan without re-parsing the same path', async () => {
    vi.spyOn(window.bitbutler.torrent, 'scanFolder').mockResolvedValue([
      { path: '/downloads/a.torrent', relativePath: 'a.torrent' },
    ]);
    const parseSpy = vi.spyOn(window.bitbutler.torrent, 'parse').mockResolvedValue(draft());

    init('/downloads');
    await fixture.whenStable();
    expect(parseSpy).toHaveBeenCalledTimes(1);

    await component.refresh();
    expect(parseSpy).toHaveBeenCalledTimes(1);
  });

  it('should pre-select only new-state rows after a scan', async () => {
    vi.spyOn(window.bitbutler.torrent, 'scanFolder').mockResolvedValue([
      { path: '/downloads/a.torrent', relativePath: 'a.torrent' },
      { path: '/downloads/b.torrent', relativePath: 'b.torrent' },
    ]);
    vi.spyOn(window.bitbutler.torrent, 'parse')
      .mockResolvedValueOnce(draft({ infoHashV1: 'known-hash' }))
      .mockResolvedValueOnce(draft({ infoHashV1: 'new-hash' }));
    torrentsMap.set(new Map([['known-hash', {}]]));

    init('/downloads');
    await fixture.whenStable();

    expect(component.selectedPaths()).toEqual(new Set(['/downloads/b.torrent']));
    expect(component.selectedEntries()).toEqual([
      expect.objectContaining({ path: '/downloads/b.torrent' }),
    ]);
  });

  it('should rescan when the recursive control changes after the first scan, not before', async () => {
    const scanSpy = vi.spyOn(window.bitbutler.torrent, 'scanFolder').mockResolvedValue([]);

    init('/downloads');
    await fixture.whenStable();
    expect(scanSpy).toHaveBeenCalledTimes(1);

    component.form().controls.folderGroup.controls.recursive.setValue(true);
    await fixture.whenStable();

    expect(scanSpy).toHaveBeenCalledTimes(2);
    expect(scanSpy).toHaveBeenLastCalledWith({ path: '/downloads', recursive: true });
  });

  it('browse() should open the dialog with the current folder as defaultPath and rescan on selection', async () => {
    vi.spyOn(window.bitbutler.torrent, 'scanFolder').mockResolvedValue([]);
    const dialogSpy = vi
      .spyOn(window.bitbutler.electron, 'showOpenDialog')
      .mockResolvedValue('/new/folder');

    init('/downloads');
    await fixture.whenStable();

    await component.browse();

    expect(dialogSpy).toHaveBeenCalledWith('/downloads');
    expect(component.form().controls.folderGroup.controls.folder.value).toBe('/new/folder');
  });

  it('browse() should do nothing when the dialog is dismissed', async () => {
    vi.spyOn(window.bitbutler.torrent, 'scanFolder').mockResolvedValue([]);
    vi.spyOn(window.bitbutler.electron, 'showOpenDialog').mockResolvedValue(undefined as any);

    init('/downloads');
    await fixture.whenStable();

    await component.browse();

    expect(component.form().controls.folderGroup.controls.folder.value).toBe('/downloads');
  });

  it('renameEntry should update the row and keep the change on a cached refresh', async () => {
    vi.spyOn(window.bitbutler.torrent, 'scanFolder').mockResolvedValue([
      { path: '/downloads/a.torrent', relativePath: 'a.torrent' },
    ]);
    vi.spyOn(window.bitbutler.torrent, 'parse').mockResolvedValue(draft());

    init('/downloads');
    await fixture.whenStable();

    component.renameEntry('/downloads/a.torrent', 'Custom Name');
    expect(component.rows()[0].name).toBe('Custom Name');

    await component.refresh();
    expect(component.rows()[0].name).toBe('Custom Name');
  });

  it('should set scanError and clear rows when scanFolder rejects', async () => {
    vi.spyOn(window.bitbutler.torrent, 'scanFolder').mockRejectedValue(new Error('ENOENT'));

    init('/missing');
    await fixture.whenStable();

    expect(component.scanError()).toContain('ENOENT');
    expect(component.rows()).toEqual([]);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd packages/app && npx vitest run src/app/modals/add-torrent/general/folder-picker/folder-picker.spec.ts`
Expected: FAIL - `./folder-picker` does not exist yet.

- [ ] **Step 3: Implement the component**

Create `packages/app/src/app/modals/add-torrent/general/folder-picker/folder-picker.scss` (empty file).

Create `packages/app/src/app/modals/add-torrent/general/folder-picker/folder-picker.html`:

```html
<div [formGroup]="form()">
  <p>Folder picker grid - wired up in the next task.</p>
</div>
```

Create `packages/app/src/app/modals/add-torrent/general/folder-picker/folder-picker.ts`:

```ts
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  computed,
  inject,
  input,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ReactiveFormsModule } from '@angular/forms';
import type { TorrentDraft } from '@bitbutler/shared';
import {
  ScannedTorrentEntry,
  ScannedTorrentState,
} from '../../../../models/add-torrent-folder.model';
import { AddTorrentFormGroup } from '../../../../models/add-torrent.model';
import { TorrentStoreService } from '../../../../services/torrent-store.service';

@Component({
  selector: 'app-add-torrent-folder-picker',
  imports: [ReactiveFormsModule],
  templateUrl: './folder-picker.html',
  styleUrl: './folder-picker.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AddTorrentFolderPicker implements OnInit {
  private readonly torrentStoreService = inject(TorrentStoreService);
  private readonly destroyRef = inject(DestroyRef);

  public form = input.required<AddTorrentFormGroup>();

  public readonly rows = signal<ScannedTorrentEntry[]>([]);
  public readonly loading = signal(false);
  public readonly scanError = signal<string | null>(null);
  public readonly selectedPaths = signal<Set<string>>(new Set());

  public readonly selectedEntries = computed(() =>
    this.rows().filter((r) => this.selectedPaths().has(r.path)),
  );

  private readonly cache = new Map<string, ScannedTorrentEntry>();
  private hasScannedOnce = false;

  private get folderControl() {
    return this.form().controls.folderGroup.controls.folder;
  }

  private get recursiveControl() {
    return this.form().controls.folderGroup.controls.recursive;
  }

  public async ngOnInit(): Promise<void> {
    this.recursiveControl.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => {
      if (this.hasScannedOnce) void this.scan();
    });

    let folder = this.folderControl.value?.trim();
    if (!folder) {
      folder = (await window.bitbutler.electron.getDownloadsPath()) ?? '';
      this.folderControl.setValue(folder, { emitEvent: false });
    }
    if (folder) await this.scan();
  }

  public async browse(): Promise<void> {
    const current = this.folderControl.value?.trim();
    const defaultPath = current || (await window.bitbutler.electron.getDownloadsPath());
    const selected = await window.bitbutler.electron.showOpenDialog(defaultPath);
    if (!selected) return;

    this.folderControl.setValue(selected);
    await this.scan();
  }

  public async refresh(): Promise<void> {
    await this.scan();
  }

  public renameEntry(path: string, newName: string): void {
    const cached = this.cache.get(path);
    if (cached) cached.name = newName;
    this.rows.update((rows) => rows.map((r) => (r.path === path ? { ...r, name: newName } : r)));
  }

  private async scan(): Promise<void> {
    const folder = this.folderControl.value?.trim();
    if (!folder) return;

    this.loading.set(true);
    this.scanError.set(null);
    try {
      const found = await window.bitbutler.torrent.scanFolder({
        path: folder,
        recursive: this.recursiveControl.value,
      });

      const entries: ScannedTorrentEntry[] = [];
      for (const { path, relativePath } of found) {
        const cached = this.cache.get(path);
        if (cached) {
          entries.push(cached);
          continue;
        }
        const entry = await this.parseEntry(path, relativePath);
        this.cache.set(path, entry);
        entries.push(entry);
      }

      this.rows.set(entries);
      this.selectedPaths.set(new Set(entries.filter((e) => e.state === 'new').map((e) => e.path)));
      this.hasScannedOnce = true;
    } catch (e) {
      this.scanError.set(String((e as Error)?.message ?? e));
      this.rows.set([]);
    } finally {
      this.loading.set(false);
    }
  }

  private async parseEntry(path: string, relativePath: string): Promise<ScannedTorrentEntry> {
    const draft: TorrentDraft = await window.bitbutler.torrent.parse({ source: 'manual', path });

    if (draft.error) {
      return {
        path,
        relativePath,
        name: draft.originalName ?? path,
        size: 0,
        fileCount: 0,
        folderCount: 0,
        state: 'error',
        errorMessage: draft.error.message,
        hash: null,
      };
    }

    const files = draft.torrent?.files ?? [];
    const hash = draft.torrent?.infoHashV1?.toLowerCase() ?? null;
    const state: ScannedTorrentState =
      hash && this.torrentStoreService.torrentsMap().has(hash) ? 'exists' : 'new';

    return {
      path,
      relativePath,
      name: draft.torrent?.name ?? draft.originalName ?? path,
      size: draft.torrent?.totalSize ?? 0,
      fileCount: files.length || 1,
      folderCount: countUniqueFolders(files.map((f) => f.path)),
      state,
      hash,
    };
  }
}

function countUniqueFolders(filePaths: string[]): number {
  const folders = new Set<string>();
  for (const p of filePaths) {
    const segments = p.split('/');
    for (let i = 1; i < segments.length; i++) {
      folders.add(segments.slice(0, i).join('/'));
    }
  }
  return folders.size;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd packages/app && npx vitest run src/app/modals/add-torrent/general/folder-picker/folder-picker.spec.ts`
Expected: PASS (11 tests)

- [ ] **Step 5: Commit**

```bash
git add packages/app/src/app/modals/add-torrent/general/folder-picker
git commit -m "$(cat <<'EOF'
#235: add AddTorrentFolderPicker scan/cache/selection engine
EOF
)"
```

---

### Task 4: Folder-picker grid and template

**Files:**

- Modify: `packages/app/src/app/modals/add-torrent/general/folder-picker/folder-picker.ts`
- Modify: `packages/app/src/app/modals/add-torrent/general/folder-picker/folder-picker.html`
- Modify: `packages/app/src/app/modals/add-torrent/general/folder-picker/folder-picker.spec.ts`
- Modify: `public/i18n/us.json`, `public/i18n/hu.json`

**Interfaces:**

- Consumes: `TextColumnFilter`, `SizeColumnFilter`, `NumberColumnFilter`, `SetColumnFilter`/`SetColumnFilterParams`/`buildValueCounts` (all existing, from `packages/app/src/app/components/column-filters/`), `GRID_LIGHT_THEME`/`GRID_DARK_THEME`/`GRID_SHARED_OPTIONS` (existing, `app.const.ts`), `NoRowOverlay` (existing, `pages/main/grid/overlays/no-row-overlay/no-row-overlay`), `UiFormatService.fileSize` (existing), `ThemeService.effectiveMode` (existing).
- Produces: `AddTorrentFolderPicker.colDefs: ColDef<ScannedTorrentEntry>[]`, `.gridOptions: GridOptions<ScannedTorrentEntry>`, `.theme`, `.bbDark`/`.bbLight`.

- [ ] **Step 1: Add the new i18n keys**

In `public/i18n/us.json`, inside `"add-torrent"` add a sibling `folder-picker` object (after `"popover"` and before `"tab"`, matching the existing key order), and extend `"add-form"` and `"popover"` and `"input-mode"`:

```json
        "folder-browser": "Folder",
        "recursive": "Recursive"
```

(added to `add-form`, after `"file-browser"`)

```json
        "folder": {
          "title": "Folder",
          "description": {
            "line1": "Select a folder containing .torrent files. Each file is parsed locally and listed below - no data is sent anywhere until you click Add.",
            "line2": "Use the Refresh button or toggle Recursive to re-scan the folder after adding or removing files on disk."
          }
        },
        "recursive": {
          "title": "Recursive",
          "description": {
            "line1": "When enabled, all subdirectories of the selected folder are scanned for .torrent files as well."
          }
        }
```

(added to `popover`, after `"links"` and after `"free-space"` respectively - two separate top-level entries under `popover`)

```json
      "input-mode": {
        "file": "File",
        "link": "Link",
        "folder": "Folder"
      },
```

```json
      "folder-picker": {
        "col-def": {
          "name": "Name",
          "state": "State",
          "size": "Size",
          "files": "Files",
          "folders": "Folders",
          "path": "Path"
        },
        "state": {
          "new": "New",
          "exists": "Exists",
          "error": "Error"
        },
        "grid": {
          "no-rows": {
            "message": "No .torrent files found in this folder."
          }
        }
      },
```

(added as a new sibling key under `"add-torrent"`, after `"tab"` and before `"input-mode"`)

Apply the equivalent structure with Hungarian text to `public/i18n/hu.json` in the same positions:

```json
        "folder-browser": "Mappa",
        "recursive": "Rekurzív"
```

```json
        "folder": {
          "title": "Mappa",
          "description": {
            "line1": "Válasszon egy mappát, amely .torrent fájlokat tartalmaz. Minden fájl helyben kerül feldolgozásra, és az alábbi listában jelenik meg - semmilyen adat nem kerül elküldésre a Hozzáadás gombra kattintásig.",
            "line2": "Használja a Frissítés gombot vagy a Rekurzív kapcsolót a mappa újbóli beolvasásához, ha fájlokat adott hozzá vagy távolított el a lemezen."
          }
        },
        "recursive": {
          "title": "Rekurzív",
          "description": {
            "line1": "Ha be van kapcsolva, a kiválasztott mappa összes almappája is átvizsgálásra kerül .torrent fájlok után."
          }
        }
```

```json
      "input-mode": {
        "file": "Fájl",
        "link": "Link",
        "folder": "Mappa"
      },
```

```json
      "folder-picker": {
        "col-def": {
          "name": "Név",
          "state": "Állapot",
          "size": "Méret",
          "files": "Fájlok",
          "folders": "Mappák",
          "path": "Útvonal"
        },
        "state": {
          "new": "Új",
          "exists": "Létezik",
          "error": "Hiba"
        },
        "grid": {
          "no-rows": {
            "message": "Nem található .torrent fájl ebben a mappában."
          }
        }
      },
```

Also add the `refresh` button label to `"general"` -> `"button"` in both files (find the existing `"button": { "browse": "Browse", ... }`-style block under the top-level `"general"` key and add `"refresh": "Refresh"` / `"refresh": "Frissítés"` next to it).

- [ ] **Step 2: Write the failing grid-behavior tests**

Add to `packages/app/src/app/modals/add-torrent/general/folder-picker/folder-picker.spec.ts` (new `describe` block, after the existing ones):

```ts
import {
  CellValueChangedEvent,
  RowDataUpdatedEvent,
  SelectionChangedEvent,
} from 'ag-grid-community';

// ...(inside the outer `describe('AddTorrentFolderPicker', ...)` block)...

describe('grid wiring', () => {
  function makeApiWithRows(rows: any[]) {
    const selected = new Set<any>();
    return {
      getSelectedRows: () => rows.filter((r) => selected.has(r)),
      forEachNode: (cb: (node: any) => void) => {
        rows.forEach((data) =>
          cb({
            data,
            setSelected: (v: boolean) => (v ? selected.add(data) : selected.delete(data)),
          }),
        );
      },
    };
  }

  it('onSelectionChanged updates selectedPaths from the grid API', () => {
    init('/downloads');
    const rows = [{ path: '/downloads/a.torrent' }, { path: '/downloads/b.torrent' }];
    const api = { getSelectedRows: () => [rows[0]] } as any;

    component.gridOptions.onSelectionChanged!({ api } as SelectionChangedEvent<any>);

    expect(component.selectedPaths()).toEqual(new Set(['/downloads/a.torrent']));
  });

  it('onRowDataUpdated selects only new-state rows via the grid API', () => {
    init('/downloads');
    const rows = [
      { path: '/downloads/a.torrent', state: 'new' },
      { path: '/downloads/b.torrent', state: 'exists' },
    ];
    const api = makeApiWithRows(rows);

    component.gridOptions.onRowDataUpdated!({ api } as unknown as RowDataUpdatedEvent<any>);

    expect(api.getSelectedRows()).toEqual([rows[0]]);
  });

  it('onCellValueChanged renames the row when the name column changes', () => {
    init('/downloads');
    component.rows.set([
      {
        path: '/downloads/a.torrent',
        relativePath: 'a.torrent',
        name: 'Old Name',
        size: 0,
        fileCount: 1,
        folderCount: 0,
        state: 'new',
        hash: null,
      },
    ]);

    const event = {
      colDef: { colId: 'name' },
      data: component.rows()[0],
      newValue: 'New Name',
    } as unknown as CellValueChangedEvent<any>;

    component.gridOptions.onCellValueChanged!(event);

    expect(component.rows()[0].name).toBe('New Name');
  });

  it('onCellValueChanged ignores changes to columns other than name', () => {
    init('/downloads');
    component.rows.set([
      {
        path: '/downloads/a.torrent',
        relativePath: 'a.torrent',
        name: 'Old Name',
        size: 0,
        fileCount: 1,
        folderCount: 0,
        state: 'new',
        hash: null,
      },
    ]);

    const event = {
      colDef: { colId: 'relativePath' },
      data: component.rows()[0],
      newValue: 'ignored',
    } as unknown as CellValueChangedEvent<any>;

    component.gridOptions.onCellValueChanged!(event);

    expect(component.rows()[0].name).toBe('Old Name');
  });
});
```

Add `TorrentStoreService`'s `torrentsMap` usage is already provided by the outer `beforeEach`; no provider changes needed. Also add `ThemeService` to the providers list in the outer `beforeEach` (needed once the component injects it in Step 3):

```ts
        { provide: TorrentStoreService, useValue: { torrentsMap } },
        { provide: ThemeService, useValue: { effectiveMode: signal('light') } },
```

(add the `ThemeService` import at the top: `import { ThemeService } from '../../../../services/theme.service';`)

- [ ] **Step 3: Run tests to verify they fail**

Run: `cd packages/app && npx vitest run src/app/modals/add-torrent/general/folder-picker/folder-picker.spec.ts`
Expected: FAIL - `component.gridOptions` is `undefined` (not implemented yet).

- [ ] **Step 4: Implement the grid**

Replace the contents of `packages/app/src/app/modals/add-torrent/general/folder-picker/folder-picker.ts`'s imports and class body to add the grid. Full updated imports block:

```ts
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  computed,
  inject,
  input,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ReactiveFormsModule } from '@angular/forms';
import type { TorrentDraft } from '@bitbutler/shared';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { faFolderOpen, faRotate } from '@fortawesome/free-solid-svg-icons';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { AgGridAngular } from 'ag-grid-angular';
import {
  CellValueChangedEvent,
  ColDef,
  GetRowIdParams,
  GridOptions,
  IOverlayParams,
  RowDataUpdatedEvent,
  SelectionChangedEvent,
  ValueFormatterParams,
} from 'ag-grid-community';
import { GRID_DARK_THEME, GRID_LIGHT_THEME, GRID_SHARED_OPTIONS } from '../../../../app.const';
import { BbBtnContent } from '../../../../components/bb-btn-content/bb-btn-content';
import { BbPopover } from '../../../../components/bb-popover/bb-popover';
import { NumberColumnFilter } from '../../../../components/column-filters/number-column-filter/number-column-filter';
import {
  SetColumnFilter,
  SetColumnFilterParams,
  buildValueCounts,
} from '../../../../components/column-filters/set-column-filter/set-column-filter';
import { SizeColumnFilter } from '../../../../components/column-filters/size-column-filter/size-column-filter';
import { TextColumnFilter } from '../../../../components/column-filters/text-column-filter/text-column-filter';
import {
  ScannedTorrentEntry,
  ScannedTorrentState,
} from '../../../../models/add-torrent-folder.model';
import { AddTorrentFormGroup } from '../../../../models/add-torrent.model';
import { NoRowOverlay } from '../../../../pages/main/grid/overlays/no-row-overlay/no-row-overlay';
import { ThemeService } from '../../../../services/theme.service';
import { TorrentStoreService } from '../../../../services/torrent-store.service';
import { UiFormatService } from '../../../../services/ui-format.service';
```

Updated `@Component` decorator:

```ts
@Component({
  selector: 'app-add-torrent-folder-picker',
  imports: [
    ReactiveFormsModule,
    FontAwesomeModule,
    TranslatePipe,
    BbBtnContent,
    BbPopover,
    AgGridAngular,
  ],
  templateUrl: './folder-picker.html',
  styleUrl: './folder-picker.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AddTorrentFolderPicker implements OnInit {
  private readonly torrentStoreService = inject(TorrentStoreService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly translateService = inject(TranslateService);
  private readonly themeService = inject(ThemeService);
  private readonly uiFormatService = inject(UiFormatService);

  public readonly icons = { faFolderOpen, faRotate };
  public readonly theme = this.themeService.effectiveMode;
  public readonly bbDark = GRID_DARK_THEME;
  public readonly bbLight = GRID_LIGHT_THEME;

  // ...existing form input, rows/loading/scanError/selectedPaths/selectedEntries/cache/hasScannedOnce/
  // folderControl/recursiveControl/ngOnInit/browse/refresh/renameEntry/scan/parseEntry unchanged...

  public readonly gridOptions: GridOptions<ScannedTorrentEntry> = {
    ...GRID_SHARED_OPTIONS,
    rowSelection: {
      mode: 'multiRow',
      checkboxes: true,
      headerCheckbox: true,
      enableClickSelection: false,
    },
    isRowSelectable: (node) => node.data?.state === 'new',
    getRowId: (params: GetRowIdParams<ScannedTorrentEntry>) => params.data.path,
    overlayComponentSelector: (params: IOverlayParams<ScannedTorrentEntry>) => {
      if (params.overlayType === 'noRows' || params.overlayType === 'noMatchingRows') {
        return {
          component: NoRowOverlay,
          params: {
            message: this.translateService.instant(
              'components.add-torrent.folder-picker.grid.no-rows.message',
            ),
          },
        };
      }
      return undefined;
    },
    onSelectionChanged: (e: SelectionChangedEvent<ScannedTorrentEntry>) =>
      this.selectedPaths.set(new Set(e.api.getSelectedRows().map((r) => r.path))),
    onRowDataUpdated: (e: RowDataUpdatedEvent<ScannedTorrentEntry>) => {
      e.api.forEachNode((node) => node.setSelected(node.data?.state === 'new'));
    },
    onCellValueChanged: (e: CellValueChangedEvent<ScannedTorrentEntry>) => {
      if (e.colDef.colId === 'name') this.renameEntry(e.data.path, e.newValue ?? e.data.name);
    },
  };

  public readonly colDefs: ColDef<ScannedTorrentEntry>[] = this.getColDefs();

  private stateLabel(state: ScannedTorrentState | null | undefined): string {
    return state
      ? this.translateService.instant('components.add-torrent.folder-picker.state.' + state)
      : '';
  }

  private getColDefs(): ColDef<ScannedTorrentEntry>[] {
    const stateItems = computed(() =>
      buildValueCounts(this.rows(), (r) => this.stateLabel(r.state)),
    );

    return [
      {
        colId: 'name',
        field: 'name',
        headerName: this.translateService.instant(
          'components.add-torrent.folder-picker.col-def.name',
        ),
        headerTooltip: this.translateService.instant(
          'components.add-torrent.folder-picker.col-def.name',
        ),
        tooltipField: 'name',
        flex: 2,
        minWidth: 200,
        editable: true,
        filter: TextColumnFilter,
      },
      {
        colId: 'state',
        field: 'state',
        width: 120,
        headerName: this.translateService.instant(
          'components.add-torrent.folder-picker.col-def.state',
        ),
        headerTooltip: this.translateService.instant(
          'components.add-torrent.folder-picker.col-def.state',
        ),
        valueFormatter: (params: ValueFormatterParams<ScannedTorrentEntry, ScannedTorrentState>) =>
          this.stateLabel(params.value),
        tooltipValueGetter: (params) =>
          params.data?.errorMessage ?? this.stateLabel(params.data?.state),
        filter: SetColumnFilter,
        filterParams: { getItems: () => stateItems() } satisfies Partial<SetColumnFilterParams>,
      },
      {
        colId: 'size',
        field: 'size',
        width: 130,
        headerName: this.translateService.instant(
          'components.add-torrent.folder-picker.col-def.size',
        ),
        headerTooltip: this.translateService.instant(
          'components.add-torrent.folder-picker.col-def.size',
        ),
        valueFormatter: this.uiFormatService.fileSize,
        cellClass: 'tabular-nums',
        filter: SizeColumnFilter,
      },
      {
        colId: 'fileCount',
        field: 'fileCount',
        width: 100,
        headerName: this.translateService.instant(
          'components.add-torrent.folder-picker.col-def.files',
        ),
        headerTooltip: this.translateService.instant(
          'components.add-torrent.folder-picker.col-def.files',
        ),
        cellClass: 'tabular-nums',
        filter: NumberColumnFilter,
      },
      {
        colId: 'folderCount',
        field: 'folderCount',
        width: 100,
        headerName: this.translateService.instant(
          'components.add-torrent.folder-picker.col-def.folders',
        ),
        headerTooltip: this.translateService.instant(
          'components.add-torrent.folder-picker.col-def.folders',
        ),
        cellClass: 'tabular-nums',
        filter: NumberColumnFilter,
      },
      {
        colId: 'relativePath',
        field: 'relativePath',
        flex: 1,
        minWidth: 160,
        headerName: this.translateService.instant(
          'components.add-torrent.folder-picker.col-def.path',
        ),
        headerTooltip: this.translateService.instant(
          'components.add-torrent.folder-picker.col-def.path',
        ),
        tooltipField: 'relativePath',
        filter: TextColumnFilter,
      },
    ];
  }
}
```

Replace `packages/app/src/app/modals/add-torrent/general/folder-picker/folder-picker.html` with:

```html
<div [formGroup]="form()">
  <div formGroupName="folderGroup" class="input-group mb-2">
    <div class="form-floating">
      <input
        type="text"
        class="form-control"
        id="folder_browser"
        [placeholder]="'components.add-torrent.add-form.folder-browser' | translate"
        formControlName="folder"
        readonly
      />
      <label for="folder_browser"
        >{{ 'components.add-torrent.add-form.folder-browser' | translate }}</label
      >
    </div>

    <button type="button" class="btn btn-outline-primary btn-split" (click)="browse()">
      <bb-btn-content
        [icon]="icons.faFolderOpen"
        [text]="'general.button.browse' | translate"
        position="end"
      ></bb-btn-content>
    </button>

    <button type="button" class="btn btn-outline-secondary btn-split" (click)="refresh()">
      <bb-btn-content
        [icon]="icons.faRotate"
        [text]="'general.button.refresh' | translate"
        position="end"
      ></bb-btn-content>
    </button>
  </div>

  <div formGroupName="folderGroup" class="form-check form-switch mb-2">
    <input
      class="form-check-input"
      type="checkbox"
      role="switch"
      id="folder_recursive"
      formControlName="recursive"
    />
    <label class="form-check-label" for="folder_recursive"
      >{{ 'components.add-torrent.add-form.recursive' | translate }}</label
    >
    <bb-popover
      [subject]="'components.add-torrent.popover.recursive.title' | translate"
      [description]="recursivePopover"
      placement="right"
    ></bb-popover>
  </div>

  @if (scanError()) {
  <div class="alert alert-danger py-2">{{ scanError() }}</div>
  }

  <ag-grid-angular
    class="w-100 d-block mb-2"
    style="height: 320px"
    [loading]="loading()"
    [rowData]="rows()"
    [columnDefs]="colDefs"
    [gridOptions]="gridOptions"
    [theme]="theme() === 'dark' ? bbDark : bbLight"
  />
</div>

<ng-template #recursivePopover>
  <p>{{ 'components.add-torrent.popover.recursive.description.line1' | translate }}</p>
</ng-template>
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd packages/app && npx vitest run src/app/modals/add-torrent/general/folder-picker/folder-picker.spec.ts`
Expected: PASS (15 tests)

- [ ] **Step 6: Lint and typecheck**

Run: `npm run lint && cd packages/app && npx tsc --noEmit -p tsconfig.app.json`
Expected: no errors, no warnings

- [ ] **Step 7: Commit**

```bash
git add packages/app/src/app/modals/add-torrent/general/folder-picker public/i18n/us.json public/i18n/hu.json
git commit -m "$(cat <<'EOF'
#235: add ag-grid to the folder picker with row selection and inline rename
EOF
)"
```

---

### Task 5: Wire the Folder option into `AddTorrentGeneral`

**Files:**

- Modify: `packages/app/src/app/modals/add-torrent/general/general.ts`
- Modify: `packages/app/src/app/modals/add-torrent/general/general.html`
- Modify: `packages/app/src/app/modals/add-torrent/general/general.spec.ts`
- Modify: `public/i18n/us.json`, `public/i18n/hu.json`

**Interfaces:**

- Consumes: `AddTorrentFolderPicker` (Tasks 3-4)
- Produces: `AddTorrentGeneral.inputMode: InputSignal<'file' | 'link' | 'folder'>`, `AddTorrentGeneral.getSelectedFolderEntries(): ScannedTorrentEntry[]`

- [ ] **Step 1: Fix the pre-existing typecheck break and write the new failing tests**

In `packages/app/src/app/modals/add-torrent/general/general.spec.ts`, update `createForm()` to include `folderGroup` (fixing the Task 2 typecheck break):

```ts
function createForm(): AddTorrentFormGroup {
  return new FormGroup({
    fileGroup: new FormGroup({
      file: new FormControl<string>('', { nonNullable: true }),
      rename: new FormControl<string | null>(null),
    }),
    linkGroup: new FormGroup({
      magnetLinks: new FormControl<string>('', { nonNullable: true }),
      rename: new FormControl<string | null>(null),
    }),
    folderGroup: new FormGroup({
      folder: new FormControl<string>('', { nonNullable: true }),
      recursive: new FormControl<boolean>(false, { nonNullable: true }),
    }),
    savepath: new FormControl<string | null>(null),
    paused: new FormControl<boolean>(false, { nonNullable: true }),
    category: new FormControl<string | null>(null),
    root_folder: new FormControl<RootFolderMode>('unset', { nonNullable: true }),
    tags: new FormControl<string[] | null>(null),
    skip_checking: new FormControl<boolean>(false, { nonNullable: true }),
    sequentialDownload: new FormControl<boolean>(false, { nonNullable: true }),
    firstLastPiecePrio: new FormControl<boolean>(false, { nonNullable: true }),
    transferRateLimits: new FormControl<TransferLimitValue | null>(null),
    shareLimits: new FormControl<ShareLimitValue | null>(null),
    autoTMM: new FormControl<boolean>(false, { nonNullable: true }),
  });
}
```

Then add new tests (append to the file, inside the outer `describe`):

```ts
it('should show the folder picker in folder mode', () => {
  fixture.componentRef.setInput('inputMode', 'folder');
  fixture.detectChanges();

  expect(fixture.nativeElement.querySelector('app-add-torrent-folder-picker')).toBeTruthy();
  expect(fixture.nativeElement.querySelector('#file_browser')).toBeFalsy();
  expect(fixture.nativeElement.querySelector('#magnet_links')).toBeFalsy();
});

it('should hide the rename input in folder mode', () => {
  fixture.componentRef.setInput('inputMode', 'folder');
  fixture.detectChanges();

  expect(fixture.nativeElement.querySelector('#rename')).toBeFalsy();
});

it('should emit inputModeChange(folder) when the folder toggle is selected', () => {
  const emitSpy = vi.spyOn(component.inputModeChange, 'emit');

  const folderRadio: HTMLInputElement = fixture.nativeElement.querySelector('#inputMode_folder');
  folderRadio.dispatchEvent(new Event('change'));

  expect(emitSpy).toHaveBeenCalledWith('folder');
});

describe('getSelectedFolderEntries', () => {
  it('should return an empty array when the folder picker has not rendered yet', () => {
    expect(component.getSelectedFolderEntries()).toEqual([]);
  });

  it('should delegate to the folder picker once in folder mode', () => {
    fixture.componentRef.setInput('inputMode', 'folder');
    fixture.detectChanges();

    const entry = {
      path: '/downloads/a.torrent',
      relativePath: 'a.torrent',
      name: 'A',
      size: 1,
      fileCount: 1,
      folderCount: 0,
      state: 'new' as const,
      hash: 'abc',
    };
    component['folderPicker']()!.selectedEntries = (() => [entry]) as any;

    expect(component.getSelectedFolderEntries()).toEqual([entry]);
  });
});
```

Also update the existing popover-count assertion, since the folder mode adds one more `bb-popover` beside the 3-way toggle... no change is needed there since that test only runs in the default (`file`) `inputMode` and the folder branch isn't rendered in that state, so the existing count of 6 stays correct. Leave it as-is.

- [ ] **Step 2: Run tests to verify the new ones fail**

Run: `cd packages/app && npx vitest run src/app/modals/add-torrent/general/general.spec.ts`
Expected: FAIL - `inputMode` doesn't accept `'folder'` yet, `app-add-torrent-folder-picker` isn't rendered, `#inputMode_folder` doesn't exist, `getSelectedFolderEntries` doesn't exist.

- [ ] **Step 3: Add the i18n keys this task's template needs**

Already added in Task 4 (`input-mode.folder`, `add-form.folder-browser`/`recursive`, `popover.folder`/`popover.recursive`). No new keys required for this task.

- [ ] **Step 4: Implement the third input mode in `general.ts`**

```ts
import {
  ChangeDetectionStrategy,
  Component,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { faFile, faFolder, faFolderOpen, faLink } from '@fortawesome/free-solid-svg-icons';
import { TranslatePipe } from '@ngx-translate/core';
import { BbBtnContent } from '../../../components/bb-btn-content/bb-btn-content';
import { FileTreeStats } from '../../../components/bb-file-tree/bb-file-tree';
import { BbPopover } from '../../../components/bb-popover/bb-popover';
import { CategorySelect } from '../../../components/category-select/category-select';
import { SavePathSelect } from '../../../components/save-path-select/save-path-select';
import { TagSelect } from '../../../components/tag-select/tag-select';
import { AutofocusDirective } from '../../../directives/autofocus';
import { ScannedTorrentEntry } from '../../../models/add-torrent-folder.model';
import { AddTorrentFormGroup } from '../../../models/add-torrent.model';
import { FilesizePipe } from '../../../pipes/filesize-pipe';
import { QbService } from '../../../services/qb.service';
import { ServerStoreService } from '../../../services/server-store.service';
import { AddTorrentFolderPicker } from './folder-picker/folder-picker';

@Component({
  selector: 'app-add-torrent-general',
  imports: [
    ReactiveFormsModule,
    AutofocusDirective,
    BbPopover,
    TranslatePipe,
    CategorySelect,
    SavePathSelect,
    TagSelect,
    BbBtnContent,
    FilesizePipe,
    AddTorrentFolderPicker,
  ],
  templateUrl: './general.html',
  styleUrl: './general.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AddTorrentGeneral {
  public readonly icons = { faFile, faLink, faFolder, faFolderOpen };

  public form = input.required<AddTorrentFormGroup>();
  public inputMode = input.required<'file' | 'link' | 'folder'>();
  public fileStats = input<FileTreeStats | null>(null);
  public freeSpace = input<number>(0);
  public inputModeChange = output<'file' | 'link' | 'folder'>();
  public fileSelected = output<Event>();

  private readonly qbService = inject(QbService);
  private readonly serverStoreService = inject(ServerStoreService);
  private readonly categorySelect = viewChild(CategorySelect);
  private readonly folderPicker = viewChild(AddTorrentFolderPicker);

  public readonly defaultSavePath = signal<string>('');

  constructor() {
    const serverId = this.serverStoreService.currentServerId();
    if (serverId) {
      this.qbService.app
        .preferences(serverId)
        .then((prefs) => {
          if (prefs.save_path) this.defaultSavePath.set(prefs.save_path);
        })
        .catch(() => {});
    }
  }

  public ensureCategoryExists(): Promise<boolean> | undefined {
    return this.categorySelect()?.ensureCategoryExists();
  }

  public getSelectedFolderEntries(): ScannedTorrentEntry[] {
    return this.folderPicker()?.selectedEntries() ?? [];
  }
}
```

- [ ] **Step 5: Update `general.html`**

Replace the input-mode `btn-group` (currently two `btn-check` radios) with three, and branch the input area / popover / rename block into three cases. Full replacement of `general.html`:

```html
<div [formGroup]="form()">
  <div class="container-fluid px-0">
    <fieldset class="bb-fieldset mt-0">
      <legend>{{ 'components.add-torrent.label.input' | translate }}</legend>

      <div class="row">
        <div class="col-11 mb-3">
          <div class="btn-group w-100" role="group">
            <input
              type="radio"
              class="btn-check"
              name="inputMode"
              id="inputMode_file"
              autocomplete="off"
              [checked]="inputMode() === 'file'"
              (change)="inputModeChange.emit('file')"
            />
            <label class="btn btn-outline-secondary btn-split" for="inputMode_file">
              <bb-btn-content
                [icon]="icons.faFile"
                [text]="'components.add-torrent.input-mode.file' | translate"
              ></bb-btn-content>
            </label>

            <input
              type="radio"
              class="btn-check"
              name="inputMode"
              id="inputMode_link"
              autocomplete="off"
              [checked]="inputMode() === 'link'"
              (change)="inputModeChange.emit('link')"
            />
            <label class="btn btn-outline-secondary btn-split" for="inputMode_link">
              <bb-btn-content
                [icon]="icons.faLink"
                [text]="'components.add-torrent.input-mode.link' | translate"
              ></bb-btn-content>
            </label>

            <input
              type="radio"
              class="btn-check"
              name="inputMode"
              id="inputMode_folder"
              autocomplete="off"
              [checked]="inputMode() === 'folder'"
              (change)="inputModeChange.emit('folder')"
            />
            <label class="btn btn-outline-secondary btn-split" for="inputMode_folder">
              <bb-btn-content
                [icon]="icons.faFolder"
                [text]="'components.add-torrent.input-mode.folder' | translate"
              ></bb-btn-content>
            </label>
          </div>
        </div>

        <div class="col-1 d-flex align-items-center mb-3">
          <bb-popover
            [subject]="'components.add-torrent.popover.input-mode.title' | translate"
            [description]="inputModePopover"
            placement="left"
          ></bb-popover>
        </div>

        <div class="col-11">
          @if (inputMode() === 'file') {
          <div formGroupName="fileGroup">
            <div class="form-floating mb-3">
              <div class="input-group mb-1">
                <div class="form-floating">
                  <input
                    type="text"
                    class="form-control"
                    id="file_browser"
                    [placeholder]="'components.add-torrent.add-form.file-browser' | translate"
                    formControlName="file"
                    [class.is-invalid]="
                        form().controls.fileGroup.controls.file.invalid &&
                        (form().controls.fileGroup.controls.file.touched ||
                          form().controls.fileGroup.controls.file.dirty)
                      "
                    readonly
                    (click)="fileInput.click()"
                  />
                  <label for="file_browser"
                    >{{ 'components.add-torrent.add-form.file-browser' | translate }}</label
                  >
                </div>

                <button
                  type="button"
                  class="btn btn-outline-primary btn-split"
                  (click)="fileInput.click()"
                >
                  <bb-btn-content
                    [icon]="icons.faFolderOpen"
                    [text]="'general.button.browse' | translate"
                    position="end"
                  ></bb-btn-content>
                </button>
              </div>
              <input
                type="file"
                #fileInput
                hidden
                accept=".torrent"
                (change)="fileSelected.emit($event)"
              />
            </div>
          </div>
          } @else if (inputMode() === 'link') {
          <div formGroupName="linkGroup">
            <div class="form-floating mb-3">
              <textarea
                class="form-control"
                id="magnet_links"
                style="height: 120px"
                [placeholder]="'components.add-torrent.add-form.magnet-links' | translate"
                formControlName="magnetLinks"
              ></textarea>
              <label for="magnet_links"
                >{{ 'components.add-torrent.add-form.magnet-links' | translate }}</label
              >
            </div>
          </div>
          } @else {
          <app-add-torrent-folder-picker [form]="form()"></app-add-torrent-folder-picker>
          }
        </div>

        <div class="col-1 d-flex align-items-center mb-3">
          @if (inputMode() === 'file') {
          <bb-popover
            class="mt-2"
            [subject]="'components.add-torrent.popover.file.title' | translate"
            [description]="filePopover"
            placement="left"
          ></bb-popover>
          } @else if (inputMode() === 'link') {
          <bb-popover
            class="mt-2"
            [subject]="'components.add-torrent.popover.links.title' | translate"
            [description]="linksPopover"
            placement="left"
          ></bb-popover>
          } @else {
          <bb-popover
            class="mt-2"
            [subject]="'components.add-torrent.popover.folder.title' | translate"
            [description]="folderPopover"
            placement="left"
          ></bb-popover>
          }
        </div>
      </div>
    </fieldset>

    <fieldset class="bb-fieldset mb-0">
      <legend>{{ 'components.add-torrent.label.torrent' | translate }}</legend>

      <div class="row">
        @if (inputMode() !== 'folder') {
        <div class="col-11">
          @if (inputMode() === 'file') {
          <div formGroupName="fileGroup" class="form-floating mb-3">
            <input
              type="text"
              class="form-control"
              id="rename"
              [placeholder]="'components.add-torrent.add-form.rename' | translate"
              formControlName="rename"
              [class.is-invalid]="
                    form().controls.fileGroup.controls.rename.invalid &&
                    (form().controls.fileGroup.controls.rename.touched ||
                      form().controls.fileGroup.controls.rename.dirty)
                  "
            />
            <label for="rename">{{ 'components.add-torrent.add-form.rename' | translate }}</label>
            @if ( form().controls.fileGroup.controls.rename.invalid &&
            (form().controls.fileGroup.controls.rename.touched ||
            form().controls.fileGroup.controls.rename.dirty) &&
            form().controls.fileGroup.controls.rename.hasError('pattern') ) {
            <div class="invalid-feedback px-2">
              {{ 'general.form.feedback.pattern' | translate }}
            </div>
            }
          </div>
          } @else {
          <div formGroupName="linkGroup" class="form-floating mb-3">
            <input
              type="text"
              class="form-control"
              id="rename"
              [placeholder]="'components.add-torrent.add-form.rename' | translate"
              formControlName="rename"
              [class.is-invalid]="
                    form().controls.linkGroup.controls.rename.invalid &&
                    (form().controls.linkGroup.controls.rename.touched ||
                      form().controls.linkGroup.controls.rename.dirty)
                  "
            />
            <label for="rename">{{ 'components.add-torrent.add-form.rename' | translate }}</label>
            @if ( form().controls.linkGroup.controls.rename.invalid &&
            (form().controls.linkGroup.controls.rename.touched ||
            form().controls.linkGroup.controls.rename.dirty) &&
            form().controls.linkGroup.controls.rename.hasError('pattern') ) {
            <div class="invalid-feedback px-2">
              {{ 'general.form.feedback.pattern' | translate }}
            </div>
            }
          </div>
          }
        </div>

        <div class="col-1 d-flex align-items-center mb-3">
          <bb-popover
            class="mt-2"
            [subject]="'components.add-torrent.popover.name.title' | translate"
            [description]="namePopover"
            placement="left"
          ></bb-popover>
        </div>
        } @if (inputMode() === 'file' && fileStats() !== null) {
        <div class="col-5">
          <div class="form-floating mb-3">
            <input
              type="text"
              class="form-control"
              id="torrent_size"
              [placeholder]="'components.add-torrent.add-form.size' | translate"
              [value]="fileStats()!.selectedSize | fileSize"
              readonly
            />
            <label for="torrent_size"
              >{{ 'components.add-torrent.add-form.size' | translate }}</label
            >
          </div>
        </div>

        <div class="col-1 d-flex align-items-center mb-3">
          <bb-popover
            class="mt-2"
            [subject]="'components.add-torrent.popover.size.title' | translate"
            [description]="sizePopover"
            placement="left"
          ></bb-popover>
        </div>

        <div class="col-5">
          <div class="form-floating mb-3">
            <input
              type="text"
              class="form-control"
              id="free_space"
              [placeholder]="'components.add-torrent.add-form.free-space' | translate"
              [value]="freeSpace() | fileSize"
              readonly
            />
            <label for="free_space"
              >{{ 'components.add-torrent.add-form.free-space' | translate }}</label
            >
          </div>
        </div>

        <div class="col-1 d-flex align-items-center mb-3">
          <bb-popover
            class="mt-2"
            [subject]="'components.add-torrent.popover.free-space.title' | translate"
            [description]="freeSpacePopover"
            placement="left"
          ></bb-popover>
        </div>
        }

        <div class="col-11">
          <div class="mb-3">
            <app-save-path-select
              formControlName="savepath"
              appendTo="body"
              [autofocus]="true"
              [clearable]="true"
              [placeholder]="defaultSavePath()"
            ></app-save-path-select>
          </div>
        </div>

        <div class="col-1 d-flex align-items-center mb-3">
          <bb-popover
            class="mt-2"
            [subject]="'components.save-path-select.popover.title' | translate"
            [description]="savePathPopover"
            placement="left"
          ></bb-popover>
        </div>

        <div class="col-12">
          <div class="mb-3">
            <app-category-select formControlName="category" appendTo="body"></app-category-select>
          </div>
        </div>

        <div class="col-12">
          <div class="mb-3">
            <app-tag-select formControlName="tags" appendTo="body"></app-tag-select>
          </div>
        </div>
      </div>
    </fieldset>
  </div>
</div>

<ng-template #filePopover>
  <p>{{ 'components.add-torrent.popover.file.description.line1' | translate }}</p>
  <p>{{ 'components.add-torrent.popover.file.description.line2' | translate }}</p>
</ng-template>

<ng-template #linksPopover>
  <p>{{ 'components.add-torrent.popover.links.description.line1' | translate }}</p>
  <p>{{ 'components.add-torrent.popover.links.description.line2' | translate }}</p>
</ng-template>

<ng-template #folderPopover>
  <p>{{ 'components.add-torrent.popover.folder.description.line1' | translate }}</p>
  <p>{{ 'components.add-torrent.popover.folder.description.line2' | translate }}</p>
</ng-template>

<ng-template #namePopover>
  <p>{{ 'components.add-torrent.popover.name.description.line1' | translate }}</p>
  <p>{{ 'components.add-torrent.popover.name.description.line2' | translate }}</p>
</ng-template>

<ng-template #inputModePopover>
  <p>{{ 'components.add-torrent.popover.input-mode.description.line1' | translate }}</p>
  <p>{{ 'components.add-torrent.popover.input-mode.description.line2' | translate }}</p>
</ng-template>

<ng-template #savePathPopover>
  <p>{{ 'components.save-path-select.popover.description.line1' | translate }}</p>
  <p>{{ 'components.save-path-select.popover.description.line2' | translate }}</p>
</ng-template>

<ng-template #sizePopover>
  <p>{{ 'components.add-torrent.popover.size.description.line1' | translate }}</p>
  <p>{{ 'components.add-torrent.popover.size.description.line2' | translate }}</p>
</ng-template>

<ng-template #freeSpacePopover>
  <p>{{ 'components.add-torrent.popover.free-space.description.line1' | translate }}</p>
  <p>{{ 'components.add-torrent.popover.free-space.description.line2' | translate }}</p>
</ng-template>
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `cd packages/app && npx vitest run src/app/modals/add-torrent/general/general.spec.ts`
Expected: PASS (all tests, including the new ones)

- [ ] **Step 7: Lint and typecheck**

Run: `npm run lint && cd packages/app && npx tsc --noEmit -p tsconfig.app.json`
Expected: no errors, no warnings

- [ ] **Step 8: Commit**

```bash
git add packages/app/src/app/modals/add-torrent/general
git commit -m "$(cat <<'EOF'
#235: wire the folder picker into AddTorrentGeneral's input-mode switch
EOF
)"
```

---

### Task 6: Wire folder mode into `AddTorrent` (tabs, canSubmit, handleSubmit, settings)

**Files:**

- Modify: `packages/app/src/app/modals/add-torrent/add-torrent.ts`
- Modify: `packages/app/src/app/modals/add-torrent/add-torrent.html`
- Modify: `packages/app/src/app/modals/add-torrent/add-torrent.spec.ts`
- Modify: `public/i18n/us.json`, `public/i18n/hu.json`

**Interfaces:**

- Consumes: `AddTorrentGeneral.getSelectedFolderEntries()` (Task 5), `ScannedTorrentEntry` (Task 2), `GeneralSettingsService.load()` (existing), `ToastService.success/danger` (existing)

- [ ] **Step 1: Add the i18n keys this task's UI needs**

In `public/i18n/us.json`, under `"add-torrent"` -> `"tab"` -> `"files"` -> `"disabled"`, add a `folder-mode` key next to the existing `link-mode`/`no-files`:

```json
          "disabled": {
            "link-mode": "Not available when adding by link.",
            "folder-mode": "Not available when adding multiple torrents from a folder.",
            "no-files": "No file list available yet."
          },
```

Under `"add-torrent"`, add a new `"toast"` sibling key (after `"feedback"`):

```json
      "toast": {
        "folder-added": {
          "title": "Torrents Added",
          "message": "Added {{count}} torrent(s)."
        },
        "folder-partial": {
          "title": "Some Torrents Failed",
          "message": "Added {{succeeded}} of {{total}} torrent(s)."
        }
      }
```

Mirror both additions in `public/i18n/hu.json`:

```json
          "disabled": {
            "link-mode": "Linkkel történő hozzáadáskor nem elérhető.",
            "folder-mode": "Nem elérhető, ha egyszerre több torrentet ad hozzá egy mappából.",
            "no-files": "Még nincs elérhető fájllista."
          },
```

```json
      "toast": {
        "folder-added": {
          "title": "Torrentek hozzáadva",
          "message": "{{count}} torrent hozzáadva."
        },
        "folder-partial": {
          "title": "Néhány torrent sikertelen",
          "message": "{{succeeded}} / {{total}} torrent hozzáadva."
        }
      }
```

- [ ] **Step 2: Write the failing tests**

Append to `packages/app/src/app/modals/add-torrent/add-torrent.spec.ts` (add the `ToastService` import and provider, plus new `describe` blocks):

```ts
import { ToastService } from '../../services/toast.service';
```

In the `providers` array of the outer `beforeEach`, add:

```ts
        {
          provide: ToastService,
          useValue: { success: vi.fn(), danger: vi.fn() },
        },
```

New tests (appended at the end of the file, inside the outer `describe('AddTorrent', ...)`):

```ts
describe('folder mode', () => {
  function stubSelectedFolderEntries(entries: any[]) {
    (component as any).generalTab = () => ({
      ensureCategoryExists: () => Promise.resolve(true),
      getSelectedFolderEntries: () => entries,
    });
  }

  it('canSubmit should be false in folder mode with no folder path and no selected rows', () => {
    component.switchInputMode('folder' as any);
    expect(component.canSubmit()).toBe(false);
  });

  it('canSubmit should be true once the folder path is set and at least one row is selected', () => {
    component.switchInputMode('folder' as any);
    (component.addForm as any).controls.folderGroup.controls.folder.setValue('/downloads');
    stubSelectedFolderEntries([{ path: '/downloads/a.torrent', name: 'a' }]);

    expect(component.canSubmit()).toBe(true);
  });

  it('filesTabDisabledReason should report the folder-mode reason', () => {
    component.switchInputMode('folder' as any);
    expect(component.filesTabDisabledReason()).toBe(
      'components.add-torrent.tab.files.disabled.folder-mode',
    );
  });

  it('handleSubmit should add every selected row, show a success toast, and close the modal', async () => {
    const torrentsAddSpy = vi.spyOn(window.bitbutler.qb, 'torrentsAdd').mockClear();
    const toastService = TestBed.inject(ToastService) as any;
    const addTorrentSettingsService = TestBed.inject(AddTorrentSettingsService) as any;

    component.switchInputMode('folder' as any);
    (component.addForm as any).controls.folderGroup.controls.folder.setValue('/downloads');
    stubSelectedFolderEntries([
      { path: '/downloads/a.torrent', name: 'A' },
      { path: '/downloads/b.torrent', name: 'B' },
    ]);

    await component.handleSubmit({ preventDefault: () => {} } as unknown as SubmitEvent);

    expect(torrentsAddSpy).toHaveBeenCalledTimes(2);
    expect(torrentsAddSpy).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        torrents: [{ path: '/downloads/a.torrent', name: 'A' }],
        options: expect.objectContaining({ rename: 'A' }),
      }),
    );
    expect(torrentsAddSpy).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        torrents: [{ path: '/downloads/b.torrent', name: 'B' }],
        options: expect.objectContaining({ rename: 'B' }),
      }),
    );
    expect(toastService.success).toHaveBeenCalled();
    expect(addTorrentSettingsService.save).toHaveBeenCalledWith(
      expect.objectContaining({ folder: '/downloads' }),
    );
    expect(mockActiveModal.close).toHaveBeenCalledWith(true);
  });

  it('handleSubmit should delete each successfully added file when deleteTorrentFile is enabled', async () => {
    vi.spyOn(window.bitbutler.qb, 'torrentsAdd').mockClear();
    const deleteFileSpy = vi.spyOn(window.bitbutler.torrent, 'deleteFile').mockClear();
    const generalSettingsService = TestBed.inject(GeneralSettingsService) as any;
    generalSettingsService.load.mockResolvedValue({ behavior: { deleteTorrentFile: true } });

    component.switchInputMode('folder' as any);
    (component.addForm as any).controls.folderGroup.controls.folder.setValue('/downloads');
    stubSelectedFolderEntries([{ path: '/downloads/a.torrent', name: 'A' }]);

    await component.handleSubmit({ preventDefault: () => {} } as unknown as SubmitEvent);

    expect(deleteFileSpy).toHaveBeenCalledWith({ path: '/downloads/a.torrent' });
  });

  it('handleSubmit should show a partial-failure toast and keep the modal open when a row fails', async () => {
    vi.spyOn(window.bitbutler.qb, 'torrentsAdd')
      .mockClear()
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error('network error'));
    const toastService = TestBed.inject(ToastService) as any;
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    component.switchInputMode('folder' as any);
    (component.addForm as any).controls.folderGroup.controls.folder.setValue('/downloads');
    stubSelectedFolderEntries([
      { path: '/downloads/a.torrent', name: 'A' },
      { path: '/downloads/b.torrent', name: 'B' },
    ]);

    await component.handleSubmit({ preventDefault: () => {} } as unknown as SubmitEvent);

    expect(toastService.danger).toHaveBeenCalled();
    expect(mockActiveModal.close).not.toHaveBeenCalled();
    expect(consoleErrorSpy).toHaveBeenCalled();
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `cd packages/app && npx vitest run src/app/modals/add-torrent/add-torrent.spec.ts`
Expected: FAIL - `folderGroup` isn't in `addForm` yet, `filesTabDisabledReason` has no folder branch, `canSubmit`/`handleSubmit` have no folder branch, `ToastService` isn't injected.

- [ ] **Step 4: Implement in `add-torrent.ts`**

Add the `ToastService` import and injection:

```ts
import { ToastService } from '../../services/toast.service';
```

```ts
  private readonly toastService = inject(ToastService);
```

Update the `AddTorrentTabId`-adjacent type and signal:

```ts
  public inputMode = signal<'file' | 'link' | 'folder'>('file');
```

Add `folderGroup` to `addForm`:

```ts
    folderGroup: new FormGroup({
      folder: new FormControl<string>('', { nonNullable: true, validators: [Validators.required] }),
      recursive: new FormControl<boolean>(false, { nonNullable: true }),
    }),
```

(inserted right after the existing `linkGroup: new FormGroup({...}),` entry)

Update `filesTabDisabledReason`:

```ts
  public readonly filesTabDisabledReason = computed<string | null>(() => {
    if (this.inputMode() === 'link') {
      return this.translateService.instant('components.add-torrent.tab.files.disabled.link-mode');
    }
    if (this.inputMode() === 'folder') {
      return this.translateService.instant(
        'components.add-torrent.tab.files.disabled.folder-mode',
      );
    }
    const draft = this.effectiveDraft();
    if (!this.showTree() || !draft?.torrent?.files?.length) {
      return this.translateService.instant('components.add-torrent.tab.files.disabled.no-files');
    }
    return null;
  });
```

Update `canSubmit()`:

```ts
  public canSubmit(): boolean {
    // Intentionally not `this.addForm.valid` - fileGroup/linkGroup are never disabled, so that
    // would require both groups valid and let an invalid inactive-mode rename block submission.
    if (this.hasActiveWarnings() || this.isSubmitting() || this.addForm.errors) return false;

    if (this.inputMode() === 'link') {
      return this.addForm.controls.linkGroup.valid && this.getMagnetLinks().length > 0;
    }
    if (this.inputMode() === 'folder') {
      return (
        this.addForm.controls.folderGroup.valid &&
        this.getSelectedFolderEntries().length > 0
      );
    }
    return this.addForm.controls.fileGroup.valid && this.selectedTorrentFile() !== null;
  }

  private getSelectedFolderEntries() {
    return this.generalTab()?.getSelectedFolderEntries() ?? [];
  }
```

Update `switchInputMode`/`handleInputModeChange` signatures:

```ts
  public switchInputMode(mode: 'file' | 'link' | 'folder'): void {
    this.inputMode.set(mode);
    if (this.treeInEditMode()) {
      this.treeInEditMode.set(false);
    }
  }

  public handleInputModeChange(mode: 'file' | 'link' | 'folder'): void {
    if (mode === this.inputMode()) return;
    this.switchInputMode(mode);
  }
```

Update the `rename` computation in `handleSubmit()` to be explicit about the folder case (it is overridden per-row regardless, but this keeps intent clear):

```ts
const raw = this.addForm.getRawValue();
const rename =
  this.inputMode() === 'file'
    ? raw.fileGroup.rename
    : this.inputMode() === 'link'
      ? raw.linkGroup.rename
      : undefined;
```

Add the folder branch inside the `try` block, as a new `else if` before the existing file-mode `else`. This branch is self-contained: it loops over the selected rows, persists its own settings, shows its own toast, and closes the modal only on full success, then `return`s - so the pre-existing post-loop `await this.addTorrentSettings.save({...})` call and the trailing `if (this.inputMode() === 'link') { this.activeModal.close(true); } else { ...file mode... }` block stay completely unchanged below it and are simply never reached when `inputMode() === 'folder'`:

```ts
if (this.inputMode() === 'link') {
  await window.bitbutler.qb.torrentsAdd({
    id: serverId,
    urls: this.getMagnetLinks(),
    torrents: [],
    options: sharedOptions,
  });
} else if (this.inputMode() === 'folder') {
  const entries = this.getSelectedFolderEntries();
  const generalSettings = await this.generalSettingsService.load();
  let succeeded = 0;

  for (const entry of entries) {
    try {
      await window.bitbutler.qb.torrentsAdd({
        id: serverId,
        torrents: [{ name: entry.name, path: entry.path }],
        options: { ...sharedOptions, rename: entry.name },
      });
      succeeded++;
      if (generalSettings.behavior.deleteTorrentFile) {
        await window.bitbutler.torrent.deleteFile({ path: entry.path });
      }
    } catch (e) {
      console.error(AddTorrent.name, 'handleSubmit', 'folder torrent add failed', entry.path, e);
    }
  }

  await this.addTorrentSettings.save({
    savepath: raw.savepath,
    paused: raw.paused,
    category: raw.category,
    tags: raw.tags?.join(',') || null,
    root_folder: raw.root_folder,
    skip_checking: raw.skip_checking,
    sequentialDownload: raw.sequentialDownload,
    firstLastPiecePrio: raw.firstLastPiecePrio,
    autoTMM: raw.autoTMM,
    transferRateLimits: raw.transferRateLimits,
    shareLimits: raw.shareLimits,
    folder: raw.folderGroup.folder,
    recursive: raw.folderGroup.recursive,
  });

  if (succeeded === entries.length) {
    this.toastService.success(
      this.translateService.instant('components.add-torrent.toast.folder-added.message', {
        count: succeeded,
      }),
      this.translateService.instant('components.add-torrent.toast.folder-added.title'),
    );
    this.activeModal.close(true);
  } else {
    this.toastService.danger(
      this.translateService.instant('components.add-torrent.toast.folder-partial.message', {
        succeeded,
        total: entries.length,
      }),
      this.translateService.instant('components.add-torrent.toast.folder-partial.title'),
    );
  }

  return;
} else {
  const selectedFile = this.selectedTorrentFile()!;
  // ...unchanged file-mode branch, and everything below it in handleSubmit...
}
```

Separately, update the generic settings-_load_ loop in `ngOnInit` so a persisted folder/recursive value is restored on open (the existing loop only handles flat `AddTorrentSettings` keys via `this.addForm.get(k)`, which cannot reach the nested `folderGroup.folder`/`folderGroup.recursive` controls). Add this right after the existing `for (const [k, v] of Object.entries(settings))` loop in `ngOnInit`:

```ts
if (typeof settings.folder === 'string') {
  this.addForm.controls.folderGroup.controls.folder.setValue(settings.folder ?? '', {
    emitEvent: false,
  });
}
if (typeof settings.recursive === 'boolean') {
  this.addForm.controls.folderGroup.controls.recursive.setValue(settings.recursive, {
    emitEvent: false,
  });
}
```

- [ ] **Step 5: Update `add-torrent.html`**

Add the `[inputMode]` binding already passes `inputMode()` (unchanged - the type widened, no template change needed there). No other change required in `add-torrent.html` for this task (the tabs/`filesTabDisabled` bindings already reference the computed signals that were just extended).

- [ ] **Step 6: Run tests to verify they pass**

Run: `cd packages/app && npx vitest run src/app/modals/add-torrent/add-torrent.spec.ts`
Expected: PASS (all tests, including the new `folder mode` describe block)

- [ ] **Step 7: Lint and typecheck**

Run: `npm run lint && cd packages/app && npx tsc --noEmit -p tsconfig.app.json`
Expected: no errors, no warnings

- [ ] **Step 8: Commit**

```bash
git add packages/app/src/app/modals/add-torrent/add-torrent.ts packages/app/src/app/modals/add-torrent/add-torrent.html packages/app/src/app/modals/add-torrent/add-torrent.spec.ts public/i18n/us.json public/i18n/hu.json
git commit -m "$(cat <<'EOF'
#235: submit selected folder entries as individual torrentsAdd calls
EOF
)"
```

---

### Task 7: Full verification pass

**Files:** none (verification only)

- [ ] **Step 1: Run the full workspace test suite**

Run: `npm test`
Expected: PASS across `@bitbutler/shared`, `@bitbutler/electron`, `@bitbutler/app`

- [ ] **Step 2: Run lint across the whole repo**

Run: `npm run lint`
Expected: zero warnings, zero errors

- [ ] **Step 3: Run a production Angular build**

Run: `npm run build`
Expected: build succeeds (catches any template/type errors not covered by `tsc --noEmit -p tsconfig.app.json`, e.g. template type-checking in strict mode)

- [ ] **Step 4: Run the Electron build**

Run: `npm run build:electron`
Expected: build succeeds

- [ ] **Step 5: Manually verify in the running app**

Run: `npm start`, open the Add Torrent modal, and check by hand:

1. A third "Folder" option appears next to File/Link.
2. Selecting Folder shows the folder input (defaulting to the OS Downloads folder), Browse/Refresh buttons, the Recursive switch with its popover, and the grid.
3. Picking a folder with `.torrent` files populates the grid; new torrents are pre-checked, already-added ones show `Exists` and are unselectable.
4. Editing a row's Name and clicking Add creates torrents under the edited names.
5. The Files tab is disabled with an explanatory tooltip while Folder mode is active.
6. With General > Behavior > "delete torrent files after added" enabled, the source `.torrent` files disappear from disk after a successful add.
7. Reopening the modal remembers the last folder and Recursive state.

Report the result of this manual check before considering the feature done - do not claim success without having actually exercised it.

- [ ] **Step 6: Commit (only if Step 5 required follow-up fixes)**

If manual verification uncovered issues, fix them, re-run Steps 1-4, and commit:

```bash
git add -A
git commit -m "$(cat <<'EOF'
#235: fix issues found during manual verification of the folder option
EOF
)"
```

If no fixes were needed, skip this step - there is nothing to commit.
