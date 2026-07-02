# Context Menu & Torrent Details Footer Manage Group Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Split per-torrent metadata edits (rename, category, tags) into a new "Manage" group in both the grid's right-click context menu and the Torrent Details modal footer, move "Export torrent file" into the "Files" group in both places, and remove the broken "Rename Files" footer button.

**Architecture:** Pure reorganization of existing `ContextMenuEntry` trees (`grid-context-menu.service.ts`) and footer dropdown markup (`torrent-details.html`) — no new command types. The one structural addition is a shared `TorrentExportService` that both the grid context menu and the modal footer call, replacing duplicated export logic.

**Tech Stack:** Angular 20 (standalone components, signals), ng-bootstrap dropdowns, `@ngx-translate/core`, Vitest.

## Global Constraints

- Commit format: `#198: short description` (this branch is `198-reorganize-context-menu-and-modal-footer-groups`).
- Lint: zero warnings (`npm run lint`, `max-warnings=0`) — remove any import that becomes unused.
- Use `-` not `—` in all commit messages / written output.
- `docs/superpowers/` must not be merged to main — removed in its own commit before the PR is opened (not part of this plan; handled at PR time).
- New per-torrent "Manage" group icon: `faSliders`. Button bar Settings group icon changes from `faSliders` to `faGear` to avoid collision with the button bar's own "Manage" group (`faUserTie`, unchanged).
- Files group order (context menu and footer): Export Torrent File first, then Open Destination (single selection only in the context menu; conditional on `localPath()` in the footer), then Set Location, then Set Download Path. Context menu's Files group additionally keeps Rename Files last (single selection only).
- Manage group order (context menu and footer): Rename Torrent (single selection only in the context menu), Set/Change Category, Set/Change Tags.
- "Rename Files" is removed from the modal footer entirely — no replacement entry point. The Content tab's own file-tree edit-mode toggle remains the only way to rename files from inside the modal.

---

### Task 1: Create `TorrentExportService`

**Files:**

- Create: `packages/app/src/app/services/torrent-export.service.ts`
- Test: `packages/app/src/app/services/torrent-export.service.spec.ts`

**Interfaces:**

- Consumes: `ServerStoreService.currentServerId(): Signal<string | null>` (existing), `ToastService.danger(message: string, title?: string): void` (existing), `TranslateService.instant(key: string, params?: object): string` (existing), `window.bitbutler.export.saveTorrentFiles(payload: { serverId: string; items: ExportTorrentFileItem[] }): Promise<ExportTorrentFilesResult>` (existing global, `ExportTorrentFileItem`/`ExportTorrentFilesResult` from `@bitbutler/shared`).
- Produces: `TorrentExportService.exportTorrentFiles(items: ExportTorrentFileItem[]): Promise<void>` — used by Task 2 (`GridContextMenuService`) and Task 3 (`TorrentDetailsActionsService`).

- [ ] **Step 1: Write the failing test**

Create `packages/app/src/app/services/torrent-export.service.spec.ts`:

```ts
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { TranslateService } from '@ngx-translate/core';
import { ServerStoreService } from './server-store.service';
import { ToastService } from './toast.service';
import { TorrentExportService } from './torrent-export.service';

describe('TorrentExportService', () => {
  let service: TorrentExportService;
  let toastService: { danger: ReturnType<typeof vi.fn> };
  let translateService: { instant: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    toastService = { danger: vi.fn() };
    translateService = { instant: vi.fn((key: string) => key) };

    (window as any).bitbutler = {
      export: {
        saveTorrentFiles: vi
          .fn()
          .mockResolvedValue({ cancelled: false, savedPaths: ['/tmp/x.torrent'], failed: [] }),
      },
    };

    TestBed.configureTestingModule({
      providers: [
        TorrentExportService,
        { provide: ServerStoreService, useValue: { currentServerId: signal('server-1') } },
        { provide: ToastService, useValue: toastService },
        { provide: TranslateService, useValue: translateService },
      ],
    });

    service = TestBed.inject(TorrentExportService);
  });

  it('calls saveTorrentFiles with the given hash/name pairs', async () => {
    await service.exportTorrentFiles([
      { hash: 'a', name: 'Film A' },
      { hash: 'b', name: 'Film B' },
    ]);
    expect(window.bitbutler.export.saveTorrentFiles).toHaveBeenCalledWith({
      serverId: 'server-1',
      items: [
        { hash: 'a', name: 'Film A' },
        { hash: 'b', name: 'Film B' },
      ],
    });
  });

  it('does nothing when there is no current server', async () => {
    (TestBed.inject(ServerStoreService).currentServerId as any).set(null);
    await service.exportTorrentFiles([{ hash: 'a', name: 'Film A' }]);
    expect(window.bitbutler.export.saveTorrentFiles).not.toHaveBeenCalled();
  });

  it('shows a danger toast summarizing failures', async () => {
    (window.bitbutler.export.saveTorrentFiles as ReturnType<typeof vi.fn>).mockResolvedValue({
      cancelled: false,
      savedPaths: [],
      failed: [{ hash: 'a', name: 'Film A', error: 'boom' }],
    });
    await service.exportTorrentFiles([{ hash: 'a', name: 'Film A' }]);
    expect(toastService.danger).toHaveBeenCalled();
  });

  it('does not toast when nothing failed', async () => {
    await service.exportTorrentFiles([{ hash: 'a', name: 'Film A' }]);
    expect(toastService.danger).not.toHaveBeenCalled();
  });

  it('translates the failure count and title before toasting', async () => {
    (window.bitbutler.export.saveTorrentFiles as ReturnType<typeof vi.fn>).mockResolvedValue({
      cancelled: false,
      savedPaths: [],
      failed: [{ hash: 'a', name: 'Film A', error: 'boom' }],
    });
    await service.exportTorrentFiles([{ hash: 'a', name: 'Film A' }]);
    expect(translateService.instant).toHaveBeenCalledWith(
      'pages.main.grid.context-menu.toast.export-failed-title',
    );
    expect(translateService.instant).toHaveBeenCalledWith(
      'pages.main.grid.context-menu.toast.export-failed-count',
      { failed: 1, total: 1 },
    );
  });

  it('shows a friendly error message when saveTorrentFiles rejects with a QbHttpError', async () => {
    (window.bitbutler.export.saveTorrentFiles as ReturnType<typeof vi.fn>).mockRejectedValue(
      JSON.stringify({
        name: 'QbHttpError',
        status: 404,
        statusText: 'Not Found',
        body: '...',
        path: '/api/v2/torrents/export',
      }),
    );
    await service.exportTorrentFiles([{ hash: 'a', name: 'Film A' }]);
    expect(toastService.danger).toHaveBeenCalledWith(
      '404 Not Found',
      'pages.main.grid.context-menu.toast.export-failed-title',
    );
  });

  it('shows the raw error string when it is not JSON', async () => {
    (window.bitbutler.export.saveTorrentFiles as ReturnType<typeof vi.fn>).mockRejectedValue(
      'plain string error',
    );
    await service.exportTorrentFiles([{ hash: 'a', name: 'Film A' }]);
    expect(toastService.danger).toHaveBeenCalledWith(
      'plain string error',
      'pages.main.grid.context-menu.toast.export-failed-title',
    );
  });

  it('shows the Error message when saveTorrentFiles throws an Error instance', async () => {
    (window.bitbutler.export.saveTorrentFiles as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error('network down'),
    );
    await service.exportTorrentFiles([{ hash: 'a', name: 'Film A' }]);
    expect(toastService.danger).toHaveBeenCalledWith(
      'network down',
      'pages.main.grid.context-menu.toast.export-failed-title',
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test --workspace=@bitbutler/app -- torrent-export.service.spec.ts`
Expected: FAIL — `Cannot find module './torrent-export.service'`

- [ ] **Step 3: Write the implementation**

Create `packages/app/src/app/services/torrent-export.service.ts`:

```ts
import { Injectable, inject } from '@angular/core';
import type { ExportTorrentFileItem } from '@bitbutler/shared';
import { TranslateService } from '@ngx-translate/core';
import { ServerStoreService } from './server-store.service';
import { ToastService } from './toast.service';

@Injectable({ providedIn: 'root' })
export class TorrentExportService {
  private readonly serverStoreService = inject(ServerStoreService);
  private readonly toastService = inject(ToastService);
  private readonly translateService = inject(TranslateService);

  public async exportTorrentFiles(items: ExportTorrentFileItem[]): Promise<void> {
    const serverId = this.serverStoreService.currentServerId();
    if (!serverId) return;

    const title = this.translateService.instant(
      'pages.main.grid.context-menu.toast.export-failed-title',
    );

    try {
      const result = await window.bitbutler.export.saveTorrentFiles({ serverId, items });
      if (result.failed.length > 0) {
        this.toastService.danger(
          this.translateService.instant('pages.main.grid.context-menu.toast.export-failed-count', {
            failed: result.failed.length,
            total: items.length,
          }),
          title,
        );
      }
    } catch (err: any) {
      this.toastService.danger(this.describeExportError(err), title);
    }
  }

  private describeExportError(err: unknown): string {
    if (err instanceof Error) return err.message;
    if (typeof err === 'string') {
      try {
        const parsed = JSON.parse(err) as { status?: number; statusText?: string };
        if (parsed?.statusText) {
          return parsed.status ? `${parsed.status} ${parsed.statusText}` : parsed.statusText;
        }
      } catch {
        // not JSON — fall through to returning the raw string
      }
      return err;
    }
    return String(err);
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test --workspace=@bitbutler/app -- torrent-export.service.spec.ts`
Expected: PASS (8 tests)

- [ ] **Step 5: Commit**

```bash
git add packages/app/src/app/services/torrent-export.service.ts packages/app/src/app/services/torrent-export.service.spec.ts
git commit -m "#198: add TorrentExportService"
```

---

### Task 2: Reorganize the grid context menu (Files + new Manage submenu)

**Files:**

- Modify: `packages/app/src/app/pages/main/grid/context-menu/grid-context-menu.service.ts`
- Test: `packages/app/src/app/pages/main/grid/context-menu/grid-context-menu.service.spec.ts`

**Interfaces:**

- Consumes: `TorrentExportService.exportTorrentFiles(items: ExportTorrentFileItem[]): Promise<void>` (Task 1).
- Produces: menu item ids used by no other file — `files.exportFile` (was `torrent.exportFile`), `manage.renameTorrent` (was `files.renameTorrent`), `manage.category` (was `files.category`), `manage.tags` (was `files.tags`). Confirmed via repo-wide grep that only this service and its spec reference the old ids.

- [ ] **Step 1: Update the spec first**

In `grid-context-menu.service.spec.ts`:

1. Add the import and a `torrentExportService` mock:

```ts
import { TorrentExportService } from '../../../../services/torrent-export.service';
```

Add alongside the other `let` declarations near the top of the `describe('GridContextMenuService', ...)` block:

```ts
let torrentExportService: { exportTorrentFiles: ReturnType<typeof vi.fn> };
```

2. In `beforeEach`, remove the `(window as any).bitbutler = { export: { saveTorrentFiles: ... } };` block entirely (the service no longer touches `window.bitbutler` directly), and initialize the new mock:

```ts
torrentExportService = { exportTorrentFiles: vi.fn().mockResolvedValue(undefined) };
```

3. Add it to the `TestBed.configureTestingModule` providers array:

```ts
        { provide: TorrentExportService, useValue: torrentExportService },
```

4. Replace the entire `describe('torrent.exportFile', ...)` block (the one starting `describe('torrent.exportFile', () => {` and its 8 `it(...)` cases) with:

```ts
describe('files.exportFile', () => {
  it('is enabled when export_available is 1', async () => {
    const entries = await service.buildTorrentMenu(makeData());
    expect(findItem(entries, 'files.exportFile')?.disabled).toBeFalsy();
  });

  it('is disabled with a tooltip when export_available is 0', async () => {
    (TestBed.inject(ServerStoreService) as any).currentServer.set({
      id: 'server-1',
      export_available: 0,
    });
    const entries = await service.buildTorrentMenu(makeData());
    expect(findItem(entries, 'files.exportFile')?.disabled).toBe(true);
    expect(findItem(entries, 'files.exportFile')?.tooltip).toBe(
      'pages.main.grid.context-menu.tooltip.export-unavailable',
    );
  });

  it('is disabled when export_available is null', async () => {
    (TestBed.inject(ServerStoreService) as any).currentServer.set({
      id: 'server-1',
      export_available: null,
    });
    const entries = await service.buildTorrentMenu(makeData());
    expect(findItem(entries, 'files.exportFile')?.disabled).toBe(true);
  });

  it('uses the singular label for a single selection', async () => {
    const row = makeRow();
    const entries = await service.buildTorrentMenu(makeData({ row, selected: [row] }));
    expect(findItem(entries, 'files.exportFile')?.label).toBe(
      'pages.main.grid.context-menu.item.export-torrent-file',
    );
  });

  it('uses the plural label for a multi-selection', async () => {
    const rowA = makeRow({ hash: 'a' });
    const rowB = makeRow({ hash: 'b' });
    const entries = await service.buildTorrentMenu(makeData({ row: rowA, selected: [rowA, rowB] }));
    expect(findItem(entries, 'files.exportFile')?.label).toBe(
      'pages.main.grid.context-menu.item.export-torrent-files',
    );
  });

  it('delegates to TorrentExportService with hash/name pairs for the selection', async () => {
    const rowA = makeRow({ hash: 'a', name: 'Film A' });
    const rowB = makeRow({ hash: 'b', name: 'Film B' });
    const entries = await service.buildTorrentMenu(makeData({ row: rowA, selected: [rowA, rowB] }));
    await (findItem(entries, 'files.exportFile')!.action as () => Promise<void>)();
    expect(torrentExportService.exportTorrentFiles).toHaveBeenCalledWith([
      { hash: 'a', name: 'Film A' },
      { hash: 'b', name: 'Film B' },
    ]);
  });
});
```

5. In the `actions` describe block, rename the `files.renameTorrent` test to use `manage.renameTorrent`:

```ts
it('manage.renameTorrent action emits UI_RENAME_TORRENT with the torrent', async () => {
  const row = makeRow();
  const entries = await service.buildTorrentMenu(makeData({ row }));
  (findItem(entries, 'manage.renameTorrent')!.action as () => void)();
  expect(commandBusService.emit).toHaveBeenCalledWith({
    type: 'UI_RENAME_TORRENT',
    torrent: row,
  });
});
```

(leave the `files.renameFiles` test immediately below it untouched — that item stays in `files`)

6. Rename the `files.category` and `files.tags` action tests to `manage.category` / `manage.tags`:

```ts
it('manage.category action emits UI_SET_TORRENT_CATEGORY with the torrent and selected hashes', async () => {
  const row = makeRow();
  const entries = await service.buildTorrentMenu(makeData({ row }));
  (findItem(entries, 'manage.category')!.action as () => void)();
  expect(commandBusService.emit).toHaveBeenCalledWith({
    type: 'UI_SET_TORRENT_CATEGORY',
    torrent: row,
    hashes: [row.hash],
  });
});

it('manage.tags action emits UI_SET_TORRENT_TAGS with the torrent and selected hashes', async () => {
  const row = makeRow();
  const entries = await service.buildTorrentMenu(makeData({ row }));
  (findItem(entries, 'manage.tags')!.action as () => void)();
  expect(commandBusService.emit).toHaveBeenCalledWith({
    type: 'UI_SET_TORRENT_TAGS',
    torrent: row,
    hashes: [row.hash],
  });
});
```

7. In the `'UI_SET_TORRENT_LOCATION/CATEGORY/TAGS carry the full selection hashes for a multi-selection'` test, change the two `findItem(entries, 'files.category')` / `findItem(entries, 'files.tags')` lookups to `'manage.category'` / `'manage.tags'` (the `files.setLocation` lookup stays as-is).

8. In `describe('multi-selection behavior', ...)`, in both `'hides single-target-only items...'` and `'keeps single-target-only items...'`, change `findItem(entries, 'files.renameTorrent')` to `findItem(entries, 'manage.renameTorrent')`.

- [ ] **Step 2: Run the spec to verify the expected failures**

Run: `npm test --workspace=@bitbutler/app -- grid-context-menu.service.spec.ts`
Expected: FAIL — items looked up by the new ids (`files.exportFile`, `manage.renameTorrent`, `manage.category`, `manage.tags`) are `undefined` because `buildTorrentMenu` hasn't changed yet; `TorrentExportService` provider error is possible if `GridContextMenuService`'s constructor doesn't yet require it (that's fine — it will once Step 3 lands).

- [ ] **Step 3: Update `grid-context-menu.service.ts`**

Remove the now-unused `Torrent` import (it was only used by the `exportTorrentFiles` method being deleted in this step):

```diff
-import { Torrent } from '../../../../models/torrent.model';
```

Add the `faSliders` import, alphabetically between `faShare` and `faSort`:

```diff
   faShare,
+  faSliders,
   faSort,
```

Add the `TorrentExportService` import, alphabetically with the other service imports:

```diff
 import { ToastService } from '../../../../services/toast.service';
 import { TorrentListGridSettingsService } from '../../../../services/torrent-list-grid.settings.service';
+import { TorrentExportService } from '../../../../services/torrent-export.service';
```

(Note: alphabetically `TorrentExportService` sorts before `TorrentListGridSettingsService` — place it there instead.)

Add the injected field next to the other `private readonly` injections:

```diff
   private readonly toastService = inject(ToastService);
   private readonly torrentListGridSettingsService = inject(TorrentListGridSettingsService);
+  private readonly torrentExportService = inject(TorrentExportService);
   private readonly translateService = inject(TranslateService);
```

Replace the block from `...(isMulti ? [] : [{ kind: 'item' as const, id: 'torrent.details', ...` through the end of the `files` submenu (the closing `},` right before `{ kind: 'submenu', id: 'queue', ...`) with:

```ts
      ...(isMulti
        ? []
        : [
            {
              kind: 'item' as const,
              id: 'torrent.details',
              label: 'pages.main.grid.context-menu.item.torrent-details',
              icon: faInfoCircle,
              variant: 'info' as const,
              action: () =>
                this.commandBusService.emit({
                  type: 'UI_OPEN_TORRENT_DETAILS',
                  hash: data.row.hash,
                }),
            },
          ]),
      { kind: 'divider' },

      {
        kind: 'submenu',
        id: 'files',
        label: 'pages.main.grid.context-menu.submenu.files',
        icon: faFolderOpen,
        children: [
          {
            kind: 'item',
            id: 'files.exportFile',
            label: isMulti
              ? 'pages.main.grid.context-menu.item.export-torrent-files'
              : 'pages.main.grid.context-menu.item.export-torrent-file',
            icon: faArrowDown,
            variant: 'success',
            disabled: this.serverStoreService.currentServer()?.export_available !== 1,
            tooltip:
              this.serverStoreService.currentServer()?.export_available !== 1
                ? 'pages.main.grid.context-menu.tooltip.export-unavailable'
                : undefined,
            action: () =>
              this.torrentExportService.exportTorrentFiles(
                data.selected.map((t) => ({ hash: t.hash, name: t.name })),
              ),
          },
          ...(isMulti
            ? []
            : [
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
              ]),
          {
            kind: 'item',
            id: 'files.setLocation',
            label: 'pages.main.grid.context-menu.item.set-location',
            icon: faFolder,
            action: () =>
              this.commandBusService.emit({
                type: 'UI_SET_TORRENT_LOCATION',
                torrent: data.row,
                hashes,
              }),
          },
          {
            kind: 'item',
            id: 'files.setDownloadPath',
            label: 'pages.main.grid.context-menu.item.set-download-path',
            icon: faFolder,
            action: () =>
              this.commandBusService.emit({
                type: 'UI_SET_DOWNLOAD_PATH',
                torrent: data.row,
                hashes,
              }),
          },
          ...(isMulti
            ? []
            : [
                {
                  kind: 'item' as const,
                  id: 'files.renameFiles',
                  label: 'pages.main.grid.context-menu.item.rename-files',
                  icon: faFilePen,
                  action: () =>
                    this.commandBusService.emit({ type: 'UI_RENAME_FILES', hash: data.row.hash }),
                },
              ]),
        ],
      },

      {
        kind: 'submenu',
        id: 'manage',
        label: 'pages.main.grid.context-menu.submenu.manage',
        icon: faSliders,
        children: [
          ...(isMulti
            ? []
            : [
                {
                  kind: 'item' as const,
                  id: 'manage.renameTorrent',
                  label: 'pages.main.grid.context-menu.item.rename-torrent',
                  icon: faPenToSquare,
                  action: () =>
                    this.commandBusService.emit({ type: 'UI_RENAME_TORRENT', torrent: data.row }),
                },
              ]),
          {
            kind: 'item',
            id: 'manage.category',
            label: 'pages.main.grid.context-menu.item.set-category',
            icon: faFolderTree,
            action: () =>
              this.commandBusService.emit({
                type: 'UI_SET_TORRENT_CATEGORY',
                torrent: data.row,
                hashes,
              }),
          },
          {
            kind: 'item',
            id: 'manage.tags',
            label: 'pages.main.grid.context-menu.item.set-tags',
            icon: faTags,
            action: () =>
              this.commandBusService.emit({
                type: 'UI_SET_TORRENT_TAGS',
                torrent: data.row,
                hashes,
              }),
          },
        ],
      },
```

Finally, delete the now-unused private methods at the bottom of the class (`exportTorrentFiles` and `describeExportError` — everything from `private async exportTorrentFiles(selected: Torrent[]): Promise<void> {` through the closing `}` of `describeExportError`, right before the class's final closing `}`).

- [ ] **Step 4: Run the spec to verify it passes**

Run: `npm test --workspace=@bitbutler/app -- grid-context-menu.service.spec.ts`
Expected: PASS (all tests, including the renamed/new ones)

- [ ] **Step 5: Lint**

Run: `npm run lint --workspace=@bitbutler/app`
Expected: no errors/warnings (confirms the removed `Torrent` import isn't flagged as still-needed and no new unused imports were introduced)

- [ ] **Step 6: Commit**

```bash
git add packages/app/src/app/pages/main/grid/context-menu/grid-context-menu.service.ts packages/app/src/app/pages/main/grid/context-menu/grid-context-menu.service.spec.ts
git commit -m "#198: reorganize grid context menu into Files and Manage groups"
```

---

### Task 3: Add `exportTorrentFile`, remove `renameFiles` on `TorrentDetailsActionsService`

**Files:**

- Modify: `packages/app/src/app/modals/torrent-details/torrent-details-actions.service.ts`
- Test: `packages/app/src/app/modals/torrent-details/torrent-details-actions.service.spec.ts`

**Interfaces:**

- Consumes: `TorrentExportService.exportTorrentFiles(items: ExportTorrentFileItem[]): Promise<void>` (Task 1), `TorrentDetailsDataService.hash(): string` (existing), `TorrentDetailsDataService.torrent(): MergedTorrent | null` (existing, `.data.name` for the export item's `name`).
- Produces: `TorrentDetailsActionsService.exportTorrentFile(): Promise<void>` — used by Task 4's footer template. `renameFiles()` is deleted (no remaining callers after Task 4 removes the footer button).

- [ ] **Step 1: Update the spec first**

In `torrent-details-actions.service.spec.ts`:

1. Add the import:

```ts
import { TorrentExportService } from '../../services/torrent-export.service';
```

2. Add a mock and provider. Near the other `let` declarations:

```ts
let torrentExportService: { exportTorrentFiles: ReturnType<typeof vi.fn> };
```

In `beforeEach`, initialize it and add to providers:

```ts
torrentExportService = { exportTorrentFiles: vi.fn().mockResolvedValue(undefined) };
```

```diff
         { provide: ToastService, useValue: { info: toastInfo, danger: toastDanger } },
+        { provide: TorrentExportService, useValue: torrentExportService },
       ],
```

3. Replace the `describe('renameFiles', ...)` block with:

```ts
describe('exportTorrentFile', () => {
  it('delegates to TorrentExportService with the current torrent hash and name', async () => {
    mockDataService.torrent.set({
      data: makeTorrent({ hash: 'abc123', name: 'My Torrent' }),
      properties: {} as any,
    });
    await service.exportTorrentFile();
    expect(torrentExportService.exportTorrentFiles).toHaveBeenCalledWith([
      { hash: 'abc123', name: 'My Torrent' },
    ]);
  });
});
```

- [ ] **Step 2: Run the spec to verify it fails**

Run: `npm test --workspace=@bitbutler/app -- torrent-details-actions.service.spec.ts`
Expected: FAIL — `service.exportTorrentFile is not a function`

- [ ] **Step 3: Update `torrent-details-actions.service.ts`**

Add the import:

```diff
 import { CommandBusService } from '../../services/command-bus.service';
 import { QbService } from '../../services/qb.service';
 import { ServerStoreService } from '../../services/server-store.service';
 import { ToastService } from '../../services/toast.service';
+import { TorrentExportService } from '../../services/torrent-export.service';
 import { TorrentDetailsDataService } from './torrent-details-data.service';
```

Add the injected field:

```diff
   private readonly toastService = inject(ToastService);
   private readonly translateService = inject(TranslateService);
+  private readonly torrentExportService = inject(TorrentExportService);
```

Replace the `renameFiles()` method:

```diff
-  public renameFiles(): void {
-    this.commandBusService.emit({ type: 'UI_RENAME_FILES', hash: this.dataService.hash() });
-  }
+  public async exportTorrentFile(): Promise<void> {
+    await this.torrentExportService.exportTorrentFiles([
+      { hash: this.dataService.hash(), name: this.dataService.torrent()!.data.name },
+    ]);
+  }
```

- [ ] **Step 4: Run the spec to verify it passes**

Run: `npm test --workspace=@bitbutler/app -- torrent-details-actions.service.spec.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/app/src/app/modals/torrent-details/torrent-details-actions.service.ts packages/app/src/app/modals/torrent-details/torrent-details-actions.service.spec.ts
git commit -m "#198: replace renameFiles with exportTorrentFile on TorrentDetailsActionsService"
```

---

### Task 4: Reorganize the Torrent Details footer (Files + new Manage dropdown)

**Files:**

- Modify: `packages/app/src/app/modals/torrent-details/torrent-details.ts`
- Modify: `packages/app/src/app/modals/torrent-details/torrent-details.html`
- Test: `packages/app/src/app/modals/torrent-details/torrent-details.spec.ts`

**Interfaces:**

- Consumes: `TorrentDetailsActionsService.exportTorrentFile(): Promise<void>` (Task 3), `TorrentDetailsActionsService.rename() / changeCategory() / changeTags()` (existing, unchanged, just re-homed in the template).
- Produces: no new public interface — this is a template/icon-set change only.

- [ ] **Step 1: Update the spec first**

In `torrent-details.spec.ts`, add `exportTorrentFile: vi.fn()` to `mockActionsService` (in the `beforeEach`, alongside the other action mocks):

```diff
     mockActionsService = {
       deleteTorrent: vi.fn(),
       resume: vi.fn(),
       pause: vi.fn(),
       forceResume: vi.fn(),
       openTransferLimitsModal: vi.fn(),
       openShareLimitsModal: vi.fn(),
       rename: vi.fn(),
       setLocation: vi.fn(),
       openPath: vi.fn(),
       changeCategory: vi.fn(),
       removeCategory: vi.fn(),
       changeTags: vi.fn(),
       removeAllTags: vi.fn(),
       forceReannounce: vi.fn(),
+      exportTorrentFile: vi.fn(),
     };
```

Add a new test inside `describe('footer actions', ...)`, after the existing `'reannounce button calls actionsService.forceReannounce'` test:

```ts
it('export torrent file button calls actionsService.exportTorrentFile', () => {
  const items: HTMLButtonElement[] = Array.from(
    fixture.nativeElement.querySelectorAll('[ngbDropdownItem]'),
  );
  const exportButton = items.find((b) => b.textContent?.includes('export-torrent-file'));
  exportButton?.click();
  expect(mockActionsService['exportTorrentFile']).toHaveBeenCalled();
});

it('rename torrent button in the Manage dropdown calls actionsService.rename', () => {
  const items: HTMLButtonElement[] = Array.from(
    fixture.nativeElement.querySelectorAll('[ngbDropdownItem]'),
  );
  const renameButton = items.find(
    (b) => b.textContent?.trim() === 'components.modals.torrent-details.general.rename',
  );
  renameButton?.click();
  expect(mockActionsService['rename']).toHaveBeenCalled();
});
```

- [ ] **Step 2: Run the spec to verify it fails**

Run: `npm test --workspace=@bitbutler/app -- torrent-details.spec.ts`
Expected: FAIL — no element's `textContent` includes `'export-torrent-file'` yet, and the rename button isn't found (or is found under a different flow but the point is the export test fails since the button doesn't exist).

- [ ] **Step 3: Update `torrent-details.ts` icons**

Add `faArrowDown` and `faSliders` to the icon imports, remove `faFilePen` (no longer used once the Rename Files button is removed):

```diff
 import {
   faArrowDownUpAcrossLine,
+  faArrowDown,
   faAsterisk,
   faBullhorn,
   faCheck,
-  faFilePen,
   faFolder,
   faFolderOpen,
   faFolderTree,
   faForwardFast,
   faGauge,
   faPause,
   faPenToSquare,
   faPlay,
   faRotate,
   faShare,
+  faSliders,
   faTags,
   faTrashCan,
   faXmark,
 } from '@fortawesome/free-solid-svg-icons';
```

Update the `icon` object:

```diff
   public readonly icon = {
     faArrowDownUpAcrossLine,
+    faArrowDown,
     faAsterisk,
     faBullhorn,
     faCheck,
-    faFilePen,
     faFolder,
     faFolderOpen,
     faFolderTree,
     faForwardFast,
     faGauge,
     faPause,
     faPenToSquare,
     faPlay,
     faRotate,
     faShare,
+    faSliders,
     faTags,
     faTrashCan,
     faXmark,
   };
```

- [ ] **Step 4: Update `torrent-details.html` footer**

Replace the entire "Files" dropdown block (the `<div ngbDropdown ...>` containing the `icon.faFolderOpen` toggle and the Open Destination / Set Location / Set Download Path / Rename Torrent / Rename Files / Change Category / Change Tags items) with two dropdown blocks — a trimmed Files dropdown followed by a new Manage dropdown:

```html
<div ngbDropdown container="body" placement="top-start">
  <button type="button" class="btn btn-secondary btn-sm btn-split" ngbDropdownToggle>
    <bb-btn-content
      [icon]="icon.faFolderOpen"
      [text]="'components.modals.torrent-details.general.footer.files' | translate"
      position="end"
    ></bb-btn-content>
  </button>
  <div ngbDropdownMenu class="bb-toolbar-dropdown">
    <button ngbDropdownItem type="button" (click)="actionsService.exportTorrentFile()">
      <span class="bb-dropdown-icon" aria-hidden="true"
        ><fa-icon [icon]="icon.faArrowDown"></fa-icon
      ></span>
      {{ 'components.modals.torrent-details.general.footer.export-torrent-file' | translate }}
    </button>
    @if (dataService.localPath()) {
    <button ngbDropdownItem type="button" (click)="actionsService.openPath()">
      <span class="bb-dropdown-icon" aria-hidden="true"
        ><fa-icon [icon]="icon.faFolderOpen"></fa-icon
      ></span>
      {{ (dataService.singleFile() ? 'components.modals.torrent-details.general.show-file' :
      'components.modals.torrent-details.general.open-destination' ) | translate }}
    </button>
    }
    <button ngbDropdownItem type="button" (click)="actionsService.setLocation()">
      <span class="bb-dropdown-icon" aria-hidden="true"
        ><fa-icon [icon]="icon.faFolder"></fa-icon
      ></span>
      {{ 'components.modals.torrent-details.general.relocate' | translate }}
    </button>
    <button ngbDropdownItem type="button" (click)="actionsService.setDownloadPath()">
      <span class="bb-dropdown-icon" aria-hidden="true"
        ><fa-icon [icon]="icon.faFolder"></fa-icon
      ></span>
      {{ 'components.modals.torrent-details.general.set-download-path' | translate }}
    </button>
  </div>
</div>

<div ngbDropdown container="body" placement="top-start">
  <button type="button" class="btn btn-secondary btn-sm btn-split" ngbDropdownToggle>
    <bb-btn-content
      [icon]="icon.faSliders"
      [text]="'components.modals.torrent-details.general.footer.manage' | translate"
      position="end"
    ></bb-btn-content>
  </button>
  <div ngbDropdownMenu class="bb-toolbar-dropdown">
    <button ngbDropdownItem type="button" (click)="actionsService.rename()">
      <span class="bb-dropdown-icon" aria-hidden="true"
        ><fa-icon [icon]="icon.faPenToSquare"></fa-icon
      ></span>
      {{ 'components.modals.torrent-details.general.rename' | translate }}
    </button>
    <button ngbDropdownItem type="button" (click)="actionsService.changeCategory()">
      <span class="bb-dropdown-icon" aria-hidden="true"
        ><fa-icon [icon]="icon.faFolderTree"></fa-icon
      ></span>
      {{ 'components.modals.torrent-details.general.change-category' | translate }}
    </button>
    <button ngbDropdownItem type="button" (click)="actionsService.changeTags()">
      <span class="bb-dropdown-icon" aria-hidden="true"
        ><fa-icon [icon]="icon.faTags"></fa-icon
      ></span>
      {{ 'components.modals.torrent-details.general.change-tags' | translate }}
    </button>
  </div>
</div>
```

This block goes in the same position the old "Files" dropdown occupied (between the Control dropdown and the Transfer dropdown).

- [ ] **Step 5: Run the spec to verify it passes**

Run: `npm test --workspace=@bitbutler/app -- torrent-details.spec.ts`
Expected: PASS

- [ ] **Step 6: Lint**

Run: `npm run lint --workspace=@bitbutler/app`
Expected: no errors/warnings (confirms `faFilePen` removal didn't leave a dangling reference)

- [ ] **Step 7: Commit**

```bash
git add packages/app/src/app/modals/torrent-details/torrent-details.ts packages/app/src/app/modals/torrent-details/torrent-details.html packages/app/src/app/modals/torrent-details/torrent-details.spec.ts
git commit -m "#198: reorganize torrent details footer into Files and Manage groups"
```

---

### Task 5: Button bar Settings icon swap (`faSliders` → `faGear`)

**Files:**

- Modify: `packages/app/src/app/pages/main/button-bar/button-bar.ts`

**Interfaces:**

- Consumes: nothing new.
- Produces: nothing consumed elsewhere — purely a visual icon change on an existing `ToolbarEntry`.

- [ ] **Step 1: Update the icon import and Settings group entry**

```diff
 import {
   faArrowDown,
   faArrowUp,
   faArrowsDownToLine,
   faArrowsUpToLine,
   faAtom,
   faChevronDown,
   faFolderTree,
+  faGear,
   faPause,
   faPlay,
   faPlayCircle,
   faPlus,
   faSearch,
   faServer,
-  faSliders,
   faStopCircle,
   faTags,
   faTrashCan,
   faUserTie,
   faXmark,
 } from '@fortawesome/free-solid-svg-icons';
```

```diff
       {
         kind: 'group',
         id: 'settings',
         label: 'pages.main.button-bar.button.settings-group',
-        icon: faSliders,
+        icon: faGear,
         variant: 'default',
         items: [
```

- [ ] **Step 2: Lint**

Run: `npm run lint --workspace=@bitbutler/app`
Expected: no errors/warnings

- [ ] **Step 3: Run the button bar spec**

Run: `npm test --workspace=@bitbutler/app -- button-bar.spec.ts`
Expected: PASS (no existing test asserts on the Settings group's icon, confirmed by inspection — this is a behavior-preserving visual change)

- [ ] **Step 4: Commit**

```bash
git add packages/app/src/app/pages/main/button-bar/button-bar.ts
git commit -m "#198: swap button bar Settings icon to faGear"
```

---

### Task 6: i18n — add new keys, remove the dead `rename-files` key

**Files:**

- Modify: `public/i18n/us.json`
- Modify: `public/i18n/hu.json`

**Interfaces:** none (translation data only).

- [ ] **Step 1: Update `public/i18n/us.json`**

Add `"manage": "Manage"` to `pages.main.grid.context-menu.submenu` (the object at line 1052, which currently starts `"copy": "Copy",`):

```diff
           "submenu": {
             "copy": "Copy",
             "pin-row": "Pin Row",
             "files": "Files",
+            "manage": "Manage",
             "transfer": "Transfer",
```

In `components.modals.torrent-details.general`, remove the now-dead `"rename-files": "Rename Files",` key (line 379 — the only reference to `general.rename-files` was the footer button removed in Task 4):

```diff
           "set-download-path": "Set Download Path",
-          "rename-files": "Rename Files",
           "sequential-download": "Sequential Download",
```

In `components.modals.torrent-details.general.footer`, add `manage` and `export-torrent-file`:

```diff
           "footer": {
             "manage-header-path": "Path",
             "manage-header-category": "Category",
             "manage-header-tags": "Tags",
             "transfer-limits": "Transfer Limits",
             "control": "Control",
             "files": "Files",
+            "manage": "Manage",
+            "export-torrent-file": "Export .torrent File",
             "transfer": "Transfer",
```

- [ ] **Step 2: Update `public/i18n/hu.json`** (mirroring the same three edits with Hungarian text)

```diff
           "submenu": {
             "copy": "Másolás",
             "pin-row": "Sor rögzítése",
             "files": "Fájlok",
+            "manage": "Kezelés",
             "transfer": "Átvitel",
```

```diff
           "set-download-path": "Letöltési útvonal beállítása",
-          "rename-files": "Fájlok átnevezése",
           "sequential-download": "Szekvenciális letöltés",
```

```diff
           "footer": {
             "manage-header-path": "Útvonal",
             "manage-header-category": "Kategória",
             "manage-header-tags": "Címkék",
             "transfer-limits": "Átviteli korlátok",
             "control": "Vezérlés",
             "files": "Fájlok",
+            "manage": "Kezelés",
+            "export-torrent-file": "Torrent fájl exportálása",
             "transfer": "Átvitel",
```

- [ ] **Step 3: Verify JSON validity**

Run: `node -e "JSON.parse(require('fs').readFileSync('public/i18n/us.json', 'utf8')); JSON.parse(require('fs').readFileSync('public/i18n/hu.json', 'utf8')); console.log('valid')"`
Expected: prints `valid`

- [ ] **Step 4: Commit**

```bash
git add public/i18n/us.json public/i18n/hu.json
git commit -m "#198: add Manage group and export-torrent-file translations"
```

---

### Task 7: Full verification

**Files:** none (verification only).

- [ ] **Step 1: Run the full test suite**

Run: `npm test`
Expected: all workspaces pass

- [ ] **Step 2: Run the full lint**

Run: `npm run lint`
Expected: zero warnings/errors

- [ ] **Step 3: Manual verification in the running app**

Run: `npm start`

In the app:

1. Right-click a torrent row in the grid. Confirm the context menu shows a "Files" submenu (Export Torrent File, Open Destination, Set Location, Set Download Path, Rename Files) followed immediately by a "Manage" submenu (Rename Torrent, Set Category, Set Tags), using the `faSliders` icon.
2. Click "Export Torrent File" on a single torrent and confirm the save dialog appears (or the appropriate toast if export is unavailable on the connected server).
3. Open Torrent Details (double-click a torrent or use the context menu's "Details" item). In the footer, confirm the dropdown order is Control → Files → Manage → Transfer → Maintenance, that "Files" now includes "Export .torrent File" as its first item, and that there is no "Rename Files" button anywhere in the footer.
4. Click "Export .torrent File" in the footer and confirm it behaves the same as the grid's export action.
5. Click "Manage" in the footer and confirm Rename Torrent / Change Category / Change Tags open their respective modals.
6. Open the Content tab and confirm its own edit-mode toggle still lets you rename files.
7. Confirm the top button bar's Settings group now shows a gear icon and its Manage group is unchanged (`faUserTie`, Servers/Tags/Categories).

Expected: all of the above behave as described, with no console errors.

- [ ] **Step 4: Report status to the user**

Summarize the verification results (or any deviations found) before considering this plan complete.
