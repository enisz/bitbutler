# Inline Cell Edit - Plan 2: GridInlineEditService + Grid Wiring

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create `GridInlineEditService` which manages conditional column editability and dispatches cell value changes to the qBittorrent API, then wire it into the grid component and its options factory.

**Architecture:** `GridInlineEditService` is component-scoped (not `providedIn: 'root'`), owns the `INLINE_EDITABLE_COL_IDS` constant and the colId → API dispatch table. `grid.lib.ts` receives two new opts (`handleCellValueChanged`, `onCellEditingStarted`/`onCellEditingStopped`) wired to AG Grid events. `grid.ts` injects the service and `QbPollingService`, stores a pause token for the edit session.

**Tech Stack:** Angular 20 signals, AG Grid (free tier), Vitest

## Global Constraints

- Commit format: `#192: short description`
- Zero ESLint warnings: `npm run lint` must pass with exit 0
- Tests run via `npm test`
- **Prerequisite:** Plan 1 must be completed first (`RowDoubleClickAction` includes `'INLINE_EDIT'`; `QbService.torrents` has `setDownloadPath`, `toggleSequentialDownload`, `toggleFirstLastPiecePrio`, `removeAllTags`)
- Issue: #192

---

### Task 1: Create GridInlineEditService

**Files:**

- Create: `packages/app/src/app/pages/main/grid/grid-inline-edit.service.ts`
- Create: `packages/app/src/app/pages/main/grid/grid-inline-edit.service.spec.ts`

**Interfaces:**

- Consumes:
  - `QbService.torrents.*` — all methods referenced in the dispatch table
  - `ServerStoreService.currentServer(): Signal<ServerModel | null>` — to get the active server ID
- Produces:
  - `GridInlineEditService.applyEditableState(api: GridApi<Torrent>, isInlineEdit: boolean): void`
  - `GridInlineEditService.handleCellValueChanged(event: CellValueChangedEvent<Torrent>): Promise<void>`

- [ ] **Step 1: Write the failing test file**

Create `packages/app/src/app/pages/main/grid/grid-inline-edit.service.spec.ts`:

```typescript
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { CellValueChangedEvent } from 'ag-grid-community';
import { Torrent } from '../../../models/torrent.model';
import { QbService } from '../../../services/qb.service';
import { ServerStoreService } from '../../../services/server-store.service';
import { GridInlineEditService } from './grid-inline-edit.service';

function makeMockApi(colDefs: any[] = []) {
  return {
    getColumnDefs: vi.fn().mockReturnValue(colDefs),
    updateGridOptions: vi.fn(),
  };
}

function makeEvent(
  colId: string,
  data: Partial<Torrent>,
  newValue: any,
): CellValueChangedEvent<Torrent> {
  return { colDef: { colId }, data: { hash: 'abc123', ...data } as Torrent, newValue } as any;
}

describe('GridInlineEditService', () => {
  let service: GridInlineEditService;
  let qb: any;

  beforeEach(() => {
    qb = {
      torrents: {
        rename: vi.fn().mockResolvedValue(undefined),
        setLocation: vi.fn().mockResolvedValue(undefined),
        setDownloadPath: vi.fn().mockResolvedValue(undefined),
        setCategory: vi.fn().mockResolvedValue(undefined),
        removeAllTags: vi.fn().mockResolvedValue(undefined),
        addTags: vi.fn().mockResolvedValue(undefined),
        setDownloadLimit: vi.fn().mockResolvedValue(undefined),
        setUploadLimit: vi.fn().mockResolvedValue(undefined),
        setShareLimits: vi.fn().mockResolvedValue(undefined),
        toggleSequentialDownload: vi.fn().mockResolvedValue(undefined),
        setForceStart: vi.fn().mockResolvedValue(undefined),
        setSuperSeeding: vi.fn().mockResolvedValue(undefined),
        setAutoManagement: vi.fn().mockResolvedValue(undefined),
        toggleFirstLastPiecePrio: vi.fn().mockResolvedValue(undefined),
      },
    };

    TestBed.configureTestingModule({
      providers: [
        GridInlineEditService,
        { provide: QbService, useValue: qb },
        {
          provide: ServerStoreService,
          useValue: { currentServer: signal({ id: 'server-1' }) },
        },
      ],
    });

    service = TestBed.inject(GridInlineEditService);
  });

  describe('applyEditableState', () => {
    it('sets editable: true on eligible text/numeric columns when isInlineEdit is true', () => {
      const api = makeMockApi([
        { colId: 'name', field: 'name' },
        { colId: 'size', field: 'size' },
        { colId: 'dl_limit_raw', field: 'dl_limit' },
      ]);
      service.applyEditableState(api as any, true);
      const { columnDefs } = api.updateGridOptions.mock.calls[0][0];
      expect(columnDefs.find((d: any) => d.colId === 'name').editable).toBe(true);
      expect(columnDefs.find((d: any) => d.colId === 'size').editable).toBeUndefined();
      expect(columnDefs.find((d: any) => d.colId === 'dl_limit_raw').editable).toBe(true);
    });

    it('sets editable: true on eligible boolean columns when isInlineEdit is true', () => {
      const api = makeMockApi([{ colId: 'seq_dl', field: 'seq_dl', editable: false }]);
      service.applyEditableState(api as any, true);
      const { columnDefs } = api.updateGridOptions.mock.calls[0][0];
      expect(columnDefs.find((d: any) => d.colId === 'seq_dl').editable).toBe(true);
    });

    it('removes editable from text/numeric columns when isInlineEdit is false', () => {
      const api = makeMockApi([{ colId: 'name', field: 'name', editable: true }]);
      service.applyEditableState(api as any, false);
      const { columnDefs } = api.updateGridOptions.mock.calls[0][0];
      expect(columnDefs.find((d: any) => d.colId === 'name').editable).toBeUndefined();
    });

    it('restores editable: false for boolean columns when isInlineEdit is false', () => {
      const api = makeMockApi([{ colId: 'force_start', field: 'force_start', editable: true }]);
      service.applyEditableState(api as any, false);
      const { columnDefs } = api.updateGridOptions.mock.calls[0][0];
      expect(columnDefs.find((d: any) => d.colId === 'force_start').editable).toBe(false);
    });

    it('does not touch columns that are not in INLINE_EDITABLE_COL_IDS', () => {
      const api = makeMockApi([{ colId: 'size', field: 'size' }]);
      service.applyEditableState(api as any, true);
      const { columnDefs } = api.updateGridOptions.mock.calls[0][0];
      expect(columnDefs.find((d: any) => d.colId === 'size').editable).toBeUndefined();
    });
  });

  describe('handleCellValueChanged — text columns', () => {
    it('calls torrents.rename for name column', async () => {
      await service.handleCellValueChanged(makeEvent('name', {}, 'New Name'));
      expect(qb.torrents.rename).toHaveBeenCalledWith('server-1', 'abc123', 'New Name');
    });

    it('calls torrents.setLocation for save_path column', async () => {
      await service.handleCellValueChanged(makeEvent('save_path', {}, '/mnt/new'));
      expect(qb.torrents.setLocation).toHaveBeenCalledWith('server-1', ['abc123'], '/mnt/new');
    });

    it('calls torrents.setDownloadPath for download_path column', async () => {
      await service.handleCellValueChanged(makeEvent('download_path', {}, '/mnt/dl'));
      expect(qb.torrents.setDownloadPath).toHaveBeenCalledWith('server-1', ['abc123'], '/mnt/dl');
    });

    it('calls torrents.setCategory for category column', async () => {
      await service.handleCellValueChanged(makeEvent('category', {}, 'Movies'));
      expect(qb.torrents.setCategory).toHaveBeenCalledWith('server-1', ['abc123'], 'Movies');
    });

    it('calls setCategory with empty string when category is null', async () => {
      await service.handleCellValueChanged(makeEvent('category', {}, null));
      expect(qb.torrents.setCategory).toHaveBeenCalledWith('server-1', ['abc123'], '');
    });
  });

  describe('handleCellValueChanged — tags column', () => {
    it('calls removeAllTags then addTags with trimmed non-empty tags', async () => {
      await service.handleCellValueChanged(makeEvent('tags', {}, 'action, comedy , drama'));
      expect(qb.torrents.removeAllTags).toHaveBeenCalledWith('server-1', ['abc123']);
      expect(qb.torrents.addTags).toHaveBeenCalledWith(
        'server-1',
        ['abc123'],
        ['action', 'comedy', 'drama'],
      );
    });

    it('calls only removeAllTags when new value is empty string', async () => {
      await service.handleCellValueChanged(makeEvent('tags', {}, ''));
      expect(qb.torrents.removeAllTags).toHaveBeenCalledWith('server-1', ['abc123']);
      expect(qb.torrents.addTags).not.toHaveBeenCalled();
    });

    it('calls only removeAllTags when new value is null', async () => {
      await service.handleCellValueChanged(makeEvent('tags', {}, null));
      expect(qb.torrents.removeAllTags).toHaveBeenCalledWith('server-1', ['abc123']);
      expect(qb.torrents.addTags).not.toHaveBeenCalled();
    });
  });

  describe('handleCellValueChanged — numeric columns', () => {
    it('calls setDownloadLimit for dl_limit_raw', async () => {
      await service.handleCellValueChanged(makeEvent('dl_limit_raw', {}, 1024));
      expect(qb.torrents.setDownloadLimit).toHaveBeenCalledWith('server-1', 1024, ['abc123']);
    });

    it('calls setUploadLimit for up_limit_raw', async () => {
      await service.handleCellValueChanged(makeEvent('up_limit_raw', {}, 2048));
      expect(qb.torrents.setUploadLimit).toHaveBeenCalledWith('server-1', 2048, ['abc123']);
    });

    it('calls setShareLimits with correct params for seeding_time_limit_raw', async () => {
      const data: Partial<Torrent> = { ratio_limit: 2.0, inactive_seeding_time_limit: -1 };
      await service.handleCellValueChanged(makeEvent('seeding_time_limit_raw', data, 1440));
      expect(qb.torrents.setShareLimits).toHaveBeenCalledWith(
        'server-1',
        ['abc123'],
        2.0,
        1440,
        -1,
      );
    });

    it('calls setShareLimits with correct params for inactive_seeding_time_limit_raw', async () => {
      const data: Partial<Torrent> = { ratio_limit: -1, seeding_time_limit: 720 };
      await service.handleCellValueChanged(makeEvent('inactive_seeding_time_limit_raw', data, 360));
      expect(qb.torrents.setShareLimits).toHaveBeenCalledWith('server-1', ['abc123'], -1, 720, 360);
    });
  });

  describe('handleCellValueChanged — boolean columns', () => {
    it('calls toggleSequentialDownload for seq_dl', async () => {
      await service.handleCellValueChanged(makeEvent('seq_dl', {}, true));
      expect(qb.torrents.toggleSequentialDownload).toHaveBeenCalledWith('server-1', ['abc123']);
    });

    it('calls setForceStart with boolean newValue for force_start', async () => {
      await service.handleCellValueChanged(makeEvent('force_start', {}, true));
      expect(qb.torrents.setForceStart).toHaveBeenCalledWith('server-1', ['abc123'], true);
    });

    it('calls setSuperSeeding with boolean newValue for super_seeding', async () => {
      await service.handleCellValueChanged(makeEvent('super_seeding', {}, false));
      expect(qb.torrents.setSuperSeeding).toHaveBeenCalledWith('server-1', ['abc123'], false);
    });

    it('calls setAutoManagement with boolean newValue for auto_tmm', async () => {
      await service.handleCellValueChanged(makeEvent('auto_tmm', {}, true));
      expect(qb.torrents.setAutoManagement).toHaveBeenCalledWith('server-1', ['abc123'], true);
    });

    it('calls toggleFirstLastPiecePrio for f_l_piece_prio', async () => {
      await service.handleCellValueChanged(makeEvent('f_l_piece_prio', {}, true));
      expect(qb.torrents.toggleFirstLastPiecePrio).toHaveBeenCalledWith('server-1', ['abc123']);
    });
  });

  describe('handleCellValueChanged — guard conditions', () => {
    it('does nothing when event.data is null', async () => {
      const event = { colDef: { colId: 'name' }, data: null, newValue: 'x' } as any;
      await service.handleCellValueChanged(event);
      expect(qb.torrents.rename).not.toHaveBeenCalled();
    });

    it('does nothing when no server is selected', async () => {
      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        providers: [
          GridInlineEditService,
          { provide: QbService, useValue: qb },
          { provide: ServerStoreService, useValue: { currentServer: signal(null) } },
        ],
      });
      const svc = TestBed.inject(GridInlineEditService);
      await svc.handleCellValueChanged(makeEvent('name', {}, 'x'));
      expect(qb.torrents.rename).not.toHaveBeenCalled();
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm test -- --reporter=verbose 2>&1 | grep "GridInlineEditService"
```

Expected: all `GridInlineEditService` tests fail with "Cannot find module './grid-inline-edit.service'".

- [ ] **Step 3: Create the service implementation**

Create `packages/app/src/app/pages/main/grid/grid-inline-edit.service.ts`:

```typescript
import { Injectable, inject } from '@angular/core';
import { CellValueChangedEvent, ColDef, GridApi } from 'ag-grid-community';
import { Torrent } from '../../../models/torrent.model';
import { QbService } from '../../../services/qb.service';
import { ServerStoreService } from '../../../services/server-store.service';

const INLINE_EDITABLE_COL_IDS = new Set([
  'name',
  'save_path',
  'download_path',
  'category',
  'tags',
  'dl_limit_raw',
  'up_limit_raw',
  'seeding_time_limit_raw',
  'inactive_seeding_time_limit_raw',
  'auto_tmm',
  'seq_dl',
  'force_start',
  'super_seeding',
  'f_l_piece_prio',
]);

const BOOLEAN_COL_IDS = new Set([
  'auto_tmm',
  'seq_dl',
  'force_start',
  'super_seeding',
  'f_l_piece_prio',
]);

@Injectable()
export class GridInlineEditService {
  private readonly qb = inject(QbService);
  private readonly serverStore = inject(ServerStoreService);

  applyEditableState(api: GridApi<Torrent>, isInlineEdit: boolean): void {
    const currentDefs = api.getColumnDefs() ?? [];
    const newDefs = currentDefs.map((d) => {
      const colDef = { ...(d as ColDef<Torrent>) };
      const colId = colDef.colId;
      if (!colId || !INLINE_EDITABLE_COL_IDS.has(colId)) return colDef;

      if (isInlineEdit) {
        colDef.editable = true;
      } else if (BOOLEAN_COL_IDS.has(colId)) {
        colDef.editable = false;
      } else {
        delete colDef.editable;
      }
      return colDef;
    });
    api.updateGridOptions({ columnDefs: newDefs as ColDef<any>[] });
  }

  async handleCellValueChanged(event: CellValueChangedEvent<Torrent>): Promise<void> {
    const serverId = this.serverStore.currentServer()?.id;
    if (!serverId || !event.data) return;

    const colId = event.colDef.colId;
    const hash = event.data.hash;
    const newValue = event.newValue;
    const data = event.data;

    try {
      switch (colId) {
        case 'name':
          await this.qb.torrents.rename(serverId, hash, String(newValue ?? ''));
          break;
        case 'save_path':
          await this.qb.torrents.setLocation(serverId, [hash], String(newValue ?? ''));
          break;
        case 'download_path':
          await this.qb.torrents.setDownloadPath(serverId, [hash], String(newValue ?? ''));
          break;
        case 'category':
          await this.qb.torrents.setCategory(serverId, [hash], String(newValue ?? ''));
          break;
        case 'tags': {
          await this.qb.torrents.removeAllTags(serverId, [hash]);
          const tags = String(newValue ?? '')
            .split(',')
            .map((t) => t.trim())
            .filter(Boolean);
          if (tags.length > 0) {
            await this.qb.torrents.addTags(serverId, [hash], tags);
          }
          break;
        }
        case 'dl_limit_raw':
          await this.qb.torrents.setDownloadLimit(serverId, Number(newValue), [hash]);
          break;
        case 'up_limit_raw':
          await this.qb.torrents.setUploadLimit(serverId, Number(newValue), [hash]);
          break;
        case 'seeding_time_limit_raw':
          await this.qb.torrents.setShareLimits(
            serverId,
            [hash],
            data.ratio_limit,
            Number(newValue),
            data.inactive_seeding_time_limit,
          );
          break;
        case 'inactive_seeding_time_limit_raw':
          await this.qb.torrents.setShareLimits(
            serverId,
            [hash],
            data.ratio_limit,
            data.seeding_time_limit,
            Number(newValue),
          );
          break;
        case 'seq_dl':
          await this.qb.torrents.toggleSequentialDownload(serverId, [hash]);
          break;
        case 'force_start':
          await this.qb.torrents.setForceStart(serverId, [hash], Boolean(newValue));
          break;
        case 'super_seeding':
          await this.qb.torrents.setSuperSeeding(serverId, [hash], Boolean(newValue));
          break;
        case 'auto_tmm':
          await this.qb.torrents.setAutoManagement(serverId, [hash], Boolean(newValue));
          break;
        case 'f_l_piece_prio':
          await this.qb.torrents.toggleFirstLastPiecePrio(serverId, [hash]);
          break;
      }
    } catch {
      // QbService.request already shows the error toast before re-throwing
    }
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm test
```

Expected: all tests pass.

- [ ] **Step 5: Verify lint passes**

```bash
npm run lint
```

Expected: exits 0, no warnings.

- [ ] **Step 6: Commit**

```bash
git add packages/app/src/app/pages/main/grid/grid-inline-edit.service.ts \
        packages/app/src/app/pages/main/grid/grid-inline-edit.service.spec.ts
git commit -m "#192: add GridInlineEditService with applyEditableState and handleCellValueChanged"
```

---

### Task 2: Wire GridInlineEditService into grid.lib.ts and grid.ts

**Files:**

- Modify: `packages/app/src/app/pages/main/grid/grid.lib.ts`
- Modify: `packages/app/src/app/pages/main/grid/grid.ts`

**Interfaces:**

- Consumes:
  - `GridInlineEditService.applyEditableState` and `handleCellValueChanged` from Task 1
  - `QbPollingService.pause(): symbol` and `QbPollingService.resume(token: symbol): void`
  - `RowDoubleClickAction` union including `'INLINE_EDIT'` from Plan 1 Task 1
- Produces: no new public API — this is purely internal wiring

- [ ] **Step 1: Extend the opts type and grid options in grid.lib.ts**

In `packages/app/src/app/pages/main/grid/grid.lib.ts`:

**a) Add `CellValueChangedEvent` to the AG Grid import** (around line 8):

```typescript
import {
  CellContextMenuEvent,
  CellValueChangedEvent,
  ColDef,
  Column,
  ColumnHeaderContextMenuEvent,
  GetRowIdParams,
  GridApi,
  GridOptions,
  GridReadyEvent,
  IOverlayParams,
  ITooltipParams,
  RowClassParams,
  RowDoubleClickedEvent,
  SelectionChangedEvent,
  TooltipValueGetterFunc,
  ValueFormatterParams,
} from 'ag-grid-community';
```

**b) Add three new properties to the `opts` parameter type** in `getGridOptions` (around line 982, after `applyDbSettings`):

```typescript
    handleCellValueChanged: (e: CellValueChangedEvent<Torrent>) => void;
    onCellEditingStarted: () => void;
    onCellEditingStopped: () => void;
```

**c) Add the three corresponding event handlers** to the returned `GridOptions` object (after the existing `onRowDoubleClicked` line at line 1175):

```typescript
    onCellValueChanged: (e: CellValueChangedEvent<Torrent, any>) => opts.handleCellValueChanged(e),
    onCellEditingStarted: () => opts.onCellEditingStarted(),
    onCellEditingStopped: () => opts.onCellEditingStopped(),
```

- [ ] **Step 2: Update grid.ts to inject services, store pause token, and wire opts**

In `packages/app/src/app/pages/main/grid/grid.ts`:

**a) Add new imports** — update the import block at the top to include the new service and polling service:

```typescript
import { GridInlineEditService } from './grid-inline-edit.service';
```

`QbPollingService` is already available at `packages/app/src/app/services/qb-polling.service.ts`, add its import:

```typescript
import { QbPollingService } from '../../../services/qb-polling.service';
```

**b) Add new injections** in the `Grid` class body (alongside existing `inject()` calls):

```typescript
  private readonly qbPollingService = inject(QbPollingService);
  private readonly gridInlineEditService = inject(GridInlineEditService);
```

**c) Add a field to store the polling pause token**:

```typescript
  private editPauseToken: symbol | null = null;
```

**d) Add `GridInlineEditService` to the component's `providers` array** (line 48):

```typescript
  providers: [GridStateService, GridContextMenuService, GridKeyboardNavService, GridPinService, GridInlineEditService],
```

**e) Add three new entries to the `opts` object** passed to `getGridOptions` in the constructor (after the existing `applyDbSettings` entry):

```typescript
        handleCellValueChanged: (e) => void this.gridInlineEditService.handleCellValueChanged(e),
        onCellEditingStarted: () => {
          this.editPauseToken = this.qbPollingService.pause();
        },
        onCellEditingStopped: () => {
          if (this.editPauseToken !== null) {
            this.qbPollingService.resume(this.editPauseToken);
            this.editPauseToken = null;
          }
        },
```

**f) Update `handleRowDoubleClick`** — add an early return for `INLINE_EDIT` at the top of the if/else chain (around line 322):

```typescript
  private handleRowDoubleClick = async (event: RowDoubleClickedEvent<Torrent, any>) => {
    if (!event.data) return;
    const settings = await firstValueFrom(this.torrentListGridSettingsService.asObservable());
    const action = settings?.rowDoubleClickAction ?? 'DETAILS';
    if (action === 'INLINE_EDIT') return;
    if (action === 'DETAILS')
      this.commandBusService.emit({ type: 'UI_OPEN_TORRENT_DETAILS', hash: event.data.hash });
    else if (action === 'SAVE_PATH' && event.data.save_path)
      this.electronService.openPath(event.data.save_path);
  };
```

**g) Extend `applyGridSettings`** — after the existing floating-filters block (around line 252), add:

```typescript
this.gridInlineEditService.applyEditableState(
  this.api,
  settings.rowDoubleClickAction === 'INLINE_EDIT',
);
```

- [ ] **Step 3: Run all tests to verify they pass**

```bash
npm test
```

Expected: all tests pass.

- [ ] **Step 4: Verify lint passes**

```bash
npm run lint
```

Expected: exits 0, no warnings.

- [ ] **Step 5: Commit**

```bash
git add packages/app/src/app/pages/main/grid/grid.lib.ts \
        packages/app/src/app/pages/main/grid/grid.ts
git commit -m "#192: wire GridInlineEditService and polling pause into grid"
```
