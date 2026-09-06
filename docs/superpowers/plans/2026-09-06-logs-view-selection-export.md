# Logs View: Selection, Compact Rows, and Export Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add multi-row selection with a selection-aware "copy as JSON" action, a compact-rows toolbar toggle, and an Export Logs modal to the logs view, mirroring the equivalent torrent-list-grid and export-torrents patterns already in the codebase.

**Architecture:** Extend `LogsGrid` (ag-grid wrapper) with a `rowSelection` option and two new public query methods (`getSelectedRows`/`getFilteredRows`); extend `LogGridSettings` with a persisted `compactRows` flag consumed the same way `colorCodingEnabled` already is; add one new Electron IPC method (`log.export`) that opens a native save dialog and writes a pre-formatted string; add a pure template-rendering helper and a new standalone `ExportLogs` modal that composes scope selection + the format template + that helper + the new IPC call.

**Tech Stack:** Angular 22 (zoneless, signals), ag-grid, ng-bootstrap (`NgbModal`, `NgbCollapse`), `@ngx-translate/core`, Electron (`dialog`, `fs.promises`), Vitest.

**Spec:** `docs/superpowers/specs/2026-09-06-logs-view-selection-export-design.md`

## Global Constraints

- Commit messages use `#329: short description` (this is issue #329, the Logs view).
- Use `-` (hyphen), never `—` (em dash), in any written output including commit messages.
- `npm run lint` must pass with zero warnings (`max-warnings=0`).
- Toast title = short Title-Case outcome description; toast message = the variable detail only (quoted path, or the raw caught error) or one short sentence-case confirmation. Never restate the title.
- New translation keys are added to both `packages/app/public/i18n/us.json` and `packages/app/public/i18n/hu.json` (English content is authoritative here; Hungarian text should be a reasonable translation, not a placeholder).
- Every new/modified `.ts`/`.html` file must follow existing formatting (Prettier runs via lint-staged on commit).

---

## Task 1: Compact rows setting and toolbar toggle

**Files:**

- Modify: `packages/app/src/app/models/log-grid.model.ts`
- Modify: `packages/app/src/app/pages/logs/logs-grid/logs-grid.ts`
- Modify: `packages/app/src/app/pages/logs/logs-grid/logs-grid.spec.ts`
- Modify: `packages/app/src/app/pages/logs/logs.ts`
- Modify: `packages/app/src/app/pages/logs/logs.html`
- Modify: `packages/app/src/app/pages/logs/logs.spec.ts`
- Modify: `packages/app/public/i18n/us.json`
- Modify: `packages/app/public/i18n/hu.json`

**Interfaces:**

- Produces: `LogGridSettings.compactRows: boolean` (default `false`), `LogsGrid.compactRowsEnabled: Signal<boolean>`, `Logs.compactRowsEnabled: Signal<boolean>`, `Logs.toggleCompactRows(): Promise<void>`.

- [ ] **Step 1: Add `compactRows` to the settings model**

Edit `packages/app/src/app/models/log-grid.model.ts`:

```ts
import type { ColumnState } from 'ag-grid-community';

export interface LogGridSettings {
  columnState: ColumnState[] | null;
  colorCodingEnabled: boolean;
  compactRows: boolean;
}

export const DEFAULT_LOG_GRID_SETTINGS: LogGridSettings = {
  columnState: null,
  colorCodingEnabled: false,
  compactRows: false,
};
```

- [ ] **Step 2: Write the failing `LogsGrid` compact-theme tests**

In `packages/app/src/app/pages/logs/logs-grid/logs-grid.spec.ts`, update every `settings$.next({...})` / initial `BehaviorSubject` payload used in the file to include `compactRows: false` (TypeScript will otherwise fail to compile the spec once the model requires the field). Then add, after the existing `colorCodingEnabled reactivity` describe block:

```ts
describe('compactRowsEnabled reactivity', () => {
  it('reflects the value from LogGridSettingsService', () => {
    settings$.next({ columnState: null, colorCodingEnabled: false, compactRows: true });
    expect(component.compactRowsEnabled()).toBe(true);
  });

  it('applies compact spacing/rowHeight params to the grid theme when enabled', () => {
    settings$.next({ columnState: null, colorCodingEnabled: false, compactRows: true });
    const params = (component.currentTheme() as any)._getModeParams()['$default'];
    expect(params.spacing).toBe(4);
    expect(params.rowHeight).toBe(32);
  });

  it('returns the base theme when compactRows is disabled', () => {
    settings$.next({ columnState: null, colorCodingEnabled: false, compactRows: false });
    expect(component.currentTheme()).toBe(GRID_DARK_THEME);
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `npm run test --workspace=@bitbutler/app -- --watch=false`
Expected: FAIL — `component.compactRowsEnabled is not a function`.

- [ ] **Step 4: Implement `compactRowsEnabled` and extend `currentTheme` in `LogsGrid`**

In `packages/app/src/app/pages/logs/logs-grid/logs-grid.ts`, replace the existing `currentTheme` computed and add the new signal right after `colorCodingEnabled`:

```ts
  public readonly colorCodingEnabled = toSignal(
    this.logGridSettingsService.asObservable().pipe(
      map((s) => s.colorCodingEnabled),
      distinctUntilChanged(),
    ),
    { initialValue: false },
  );

  public readonly compactRowsEnabled = toSignal(
    this.logGridSettingsService.asObservable().pipe(
      map((s) => s.compactRows),
      distinctUntilChanged(),
    ),
    { initialValue: false },
  );
```

And move the `currentTheme` computed below both signals (it must be declared after `compactRowsEnabled` since it reads it):

```ts
  public readonly currentTheme = computed(() => {
    const base = this.theme() === 'dark' ? GRID_DARK_THEME : GRID_LIGHT_THEME;
    return this.compactRowsEnabled() ? base.withParams({ spacing: 4, rowHeight: 32 }) : base;
  });
```

Remove the old `currentTheme` declaration that sat directly under `theme`.

- [ ] **Step 5: Run the test to verify it passes**

Run: `npm run test --workspace=@bitbutler/app -- --watch=false`
Expected: PASS.

- [ ] **Step 6: Write the failing `Logs.toggleCompactRows` test**

In `packages/app/src/app/pages/logs/logs.spec.ts`, update the `settings$` initial value and every `settings$.next(...)` call to include `compactRows: false` (or `true` where relevant), then add a new describe block mirroring `toggleColorCoding`:

```ts
describe('toggleCompactRows', () => {
  it('flips the persisted compactRows while preserving other settings', async () => {
    fixture.detectChanges();
    settings$.next({ columnState: null, colorCodingEnabled: true, compactRows: false });

    await component.toggleCompactRows();

    expect(logGridSettingsServiceMock.save).toHaveBeenCalledWith({
      columnState: null,
      colorCodingEnabled: true,
      compactRows: true,
    });
  });
});

describe('compactRowsEnabled', () => {
  it('reflects the value from LogGridSettingsService', () => {
    fixture.detectChanges();
    settings$.next({ columnState: null, colorCodingEnabled: false, compactRows: true });
    expect(component.compactRowsEnabled()).toBe(true);
  });
});
```

- [ ] **Step 7: Run the test to verify it fails**

Run: `npm run test --workspace=@bitbutler/app -- --watch=false`
Expected: FAIL — `component.toggleCompactRows is not a function`.

- [ ] **Step 8: Implement `compactRowsEnabled` and `toggleCompactRows` in `Logs`, and the toolbar button**

In `packages/app/src/app/pages/logs/logs.ts`:

Add `faCompress` to the solid-icons import:

```ts
import {
  faArrowsRotate,
  faChevronLeft,
  faCompress,
  faFileExport,
  faHighlighter,
  faTrashCan,
} from '@fortawesome/free-solid-svg-icons';
```

Add it to the `icons` map:

```ts
  public readonly icons = {
    faChevronLeft,
    faArrowsRotate,
    faTrashCan,
    faHighlighter,
    faCompress,
    faFileExport,
  };
```

Add the new signal next to `colorCodingEnabled`:

```ts
  public readonly compactRowsEnabled = toSignal(
    this.logGridSettingsService.asObservable().pipe(
      map((s) => s.compactRows),
      distinctUntilChanged(),
    ),
    { initialValue: false },
  );
```

Add the toggle method next to `toggleColorCoding`:

```ts
  async toggleCompactRows(): Promise<void> {
    const settings = await firstValueFrom(this.logGridSettingsService.asObservable());
    await this.logGridSettingsService.save({
      ...settings,
      compactRows: !settings.compactRows,
    });
  }
```

In `packages/app/src/app/pages/logs/logs.html`, add a new button right after the Color Coding button and before Refresh:

```html
<button
  type="button"
  class="bb-tool"
  [class.bb-tool--primary]="compactRowsEnabled()"
  (click)="toggleCompactRows(); compactRowsTooltip.close()"
  [ngbTooltip]="'pages.logs.compact-rows' | translate"
  placement="bottom"
  container="body"
  [disableTooltip]="!compact"
  #compactRowsTooltip="ngbTooltip"
>
  <span class="bb-tool__icon" aria-hidden="true">
    <fa-icon [icon]="icons.faCompress" />
  </span>
  <span class="bb-tool__label">{{ 'pages.logs.compact-rows' | translate }}</span>
</button>
```

- [ ] **Step 9: Run the test to verify it passes**

Run: `npm run test --workspace=@bitbutler/app -- --watch=false`
Expected: PASS.

- [ ] **Step 10: Add the `pages.logs.compact-rows` translation key**

In `packages/app/public/i18n/us.json`, inside the `pages.logs` object, add a new key right after `"color-coding": "Color Coding",`:

```json
      "compact-rows": "Compact Rows",
```

In `packages/app/public/i18n/hu.json`, add the equivalent Hungarian key at the same location in the `pages.logs` object:

```json
      "compact-rows": "Kompakt sorok",
```

- [ ] **Step 11: Run lint**

Run: `npm run lint`
Expected: no errors/warnings.

- [ ] **Step 12: Commit**

```bash
git add packages/app/src/app/models/log-grid.model.ts \
  packages/app/src/app/pages/logs/logs-grid/logs-grid.ts \
  packages/app/src/app/pages/logs/logs-grid/logs-grid.spec.ts \
  packages/app/src/app/pages/logs/logs.ts \
  packages/app/src/app/pages/logs/logs.html \
  packages/app/src/app/pages/logs/logs.spec.ts \
  packages/app/public/i18n/us.json \
  packages/app/public/i18n/hu.json
git commit -m "#329: add compact rows toggle to the logs view"
```

---

## Task 2: Row selection and selection-aware "copy as JSON" context menu action

**Files:**

- Modify: `packages/app/src/app/pages/logs/logs-grid/logs-grid.ts`
- Modify: `packages/app/src/app/pages/logs/logs-grid/logs-grid.spec.ts`
- Modify: `packages/app/public/i18n/us.json`
- Modify: `packages/app/public/i18n/hu.json`

**Interfaces:**

- Produces: `LogsGrid.getSelectedRows(): LogEntry[]`, `LogsGrid.getFilteredRows(): LogEntry[]` (consumed by Task 6).

- [ ] **Step 1: Write the failing selection/context-menu tests**

In `packages/app/src/app/pages/logs/logs-grid/logs-grid.spec.ts`, replace the existing `onCellContextMenu` describe block with:

```ts
describe('onCellContextMenu', () => {
  it('opens a context menu with a copy-row-as-json action that copies the row data when only one row is selected', () => {
    const row = makeLog({ id: 42 });
    const nodeMock = { setSelected: vi.fn() };
    const apiMock = { getSelectedRows: vi.fn().mockReturnValue([row]) };
    const event = { data: row, node: nodeMock, api: apiMock };
    component.gridOptions.onCellContextMenu!(event as any);

    expect(nodeMock.setSelected).not.toHaveBeenCalled();
    expect(contextMenuServiceMock.open).toHaveBeenCalledWith({
      items: [
        expect.objectContaining({
          id: 'copy.json',
          label: 'pages.main.grid.context-menu.item.copy-row-as-json',
        }),
      ],
    });

    const [{ items }] = contextMenuServiceMock.open.mock.calls[0];
    items[0].action();

    expect(gridContextMenuServiceMock.copyToClipboard).toHaveBeenCalledWith(
      JSON.stringify(row, null, 2),
      '',
    );
  });

  it('collapses the grid selection to the right-clicked row when it is outside the current selection', () => {
    const selectedRow = makeLog({ id: 1 });
    const clickedRow = makeLog({ id: 2 });
    const nodeMock = { setSelected: vi.fn() };
    const apiMock = {
      getSelectedRows: vi.fn().mockReturnValueOnce([selectedRow]).mockReturnValueOnce([clickedRow]),
    };
    const event = { data: clickedRow, node: nodeMock, api: apiMock };
    component.gridOptions.onCellContextMenu!(event as any);

    expect(nodeMock.setSelected).toHaveBeenCalledWith(true, true);
  });

  it('copies every selected row as a JSON array, with a plural label, when multiple rows are selected', () => {
    const row1 = makeLog({ id: 1 });
    const row2 = makeLog({ id: 2 });
    const nodeMock = { setSelected: vi.fn() };
    const apiMock = { getSelectedRows: vi.fn().mockReturnValue([row1, row2]) };
    const event = { data: row1, node: nodeMock, api: apiMock };
    component.gridOptions.onCellContextMenu!(event as any);

    expect(nodeMock.setSelected).not.toHaveBeenCalled();
    expect(contextMenuServiceMock.open).toHaveBeenCalledWith({
      items: [
        expect.objectContaining({
          id: 'copy.json',
          label: 'pages.main.grid.context-menu.item.copy-rows-as-json',
        }),
      ],
    });

    const [{ items }] = contextMenuServiceMock.open.mock.calls[0];
    items[0].action();

    expect(gridContextMenuServiceMock.copyToClipboard).toHaveBeenCalledWith(
      JSON.stringify([row1, row2], null, 2),
      '',
    );
  });

  it('opens an empty menu when there is no row data', () => {
    component.gridOptions.onCellContextMenu!({ data: undefined } as any);
    expect(contextMenuServiceMock.open).toHaveBeenCalledWith({ items: [] });
  });
});

describe('getSelectedRows', () => {
  it('returns an empty array before the grid is ready', () => {
    expect(component.getSelectedRows()).toEqual([]);
  });

  it('returns the grid selected rows once the grid is ready', async () => {
    const rows = [makeLog({ id: 5 })];
    mockApi.getSelectedRows.mockReturnValue(rows);
    await component.gridOptions.onGridReady!({ api: mockApi } as any);

    expect(component.getSelectedRows()).toEqual(rows);
  });
});

describe('getFilteredRows', () => {
  it('returns an empty array before the grid is ready', () => {
    expect(component.getFilteredRows()).toEqual([]);
  });

  it('collects every row visible after filtering once the grid is ready', async () => {
    const rows = [makeLog({ id: 1 }), makeLog({ id: 2 })];
    mockApi.forEachNodeAfterFilter.mockImplementation((cb: (node: { data: unknown }) => void) => {
      rows.forEach((data) => cb({ data }));
    });
    await component.gridOptions.onGridReady!({ api: mockApi } as any);

    expect(component.getFilteredRows()).toEqual(rows);
  });
});
```

Also extend the shared `mockApi` object declared in the top-level `beforeEach` with the two methods the new tests/production code rely on:

```ts
mockApi = {
  getColumnState: vi.fn().mockReturnValue([{ colId: 'message' }]),
  applyColumnState: vi.fn(),
  redrawRows: vi.fn(),
  getSelectedRows: vi.fn().mockReturnValue([]),
  forEachNodeAfterFilter: vi.fn(),
};
```

(Update the `mockApi` type declaration above `beforeEach` to include `getSelectedRows: ReturnType<typeof vi.fn>;` and `forEachNodeAfterFilter: ReturnType<typeof vi.fn>;`.)

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm run test --workspace=@bitbutler/app -- --watch=false`
Expected: FAIL — `onCellContextMenu` still copies unconditionally from `event.data`, `getSelectedRows`/`getFilteredRows` do not exist.

- [ ] **Step 3: Implement row selection, the selection-aware context menu, and the two query methods**

In `packages/app/src/app/pages/logs/logs-grid/logs-grid.ts`, add `rowSelection` to `gridOptions` (right after `getRowId`):

```ts
this.gridOptions = {
  columnDefs: getLogGridColDefs(this.uiFormatService, this.translateService, () => this.logs()),
  rowClassRules: getLogRowClassRules(() => this.colorCodingEnabled()),
  getRowId: (params) => String(params.data.id),
  rowSelection: {
    mode: 'multiRow',
    checkboxes: false,
    headerCheckbox: false,
    enableClickSelection: true,
  },
  onCellContextMenu: (event) => {
    const row = event.data;
    if (!row) {
      this.contextMenuService.open({ items: [] });
      return;
    }

    const currentSelection = event.api.getSelectedRows();
    const isRowSelected = currentSelection.some((r) => r.id === row.id);
    if (!isRowSelected) {
      event.node.setSelected(true, true);
    }

    const selection = event.api.getSelectedRows();
    this.contextMenuService.open({ items: this.buildRowMenu(row, selection) });
  },
  onColumnHeaderContextMenu: (event) => {
    this.contextMenuService.open({ items: this.gridContextMenuService.buildHeaderMenu(event) });
  },
  onGridReady: (event) => {
    this.api = event.api;
    void this.restoreColumnState();
  },
  onColumnResized: (e) => {
    if (e.finished) this.queueSave();
  },
  onColumnMoved: () => this.queueSave(),
  onColumnPinned: () => this.queueSave(),
  onColumnVisible: () => this.queueSave(),
  onSortChanged: () => this.queueSave(),
};
```

Replace `buildRowMenu` with a selection-aware version:

```ts
  private buildRowMenu(row: LogEntry, selection: LogEntry[]): ContextMenuEntry[] {
    const isMulti = selection.length > 1;

    return [
      {
        kind: 'item',
        id: 'copy.json',
        label: isMulti
          ? 'pages.main.grid.context-menu.item.copy-rows-as-json'
          : 'pages.main.grid.context-menu.item.copy-row-as-json',
        icon: faCode,
        action: () =>
          this.gridContextMenuService.copyToClipboard(
            JSON.stringify(isMulti ? selection : row, null, 2),
            this.translateService.instant(
              isMulti
                ? 'pages.main.grid.context-menu.field.rows-as-json'
                : 'pages.main.grid.context-menu.field.row-as-json',
            ),
          ),
      },
    ];
  }
```

Add the two public query methods (near `restoreColumnState`):

```ts
  public getSelectedRows(): LogEntry[] {
    return this.api?.getSelectedRows() ?? [];
  }

  public getFilteredRows(): LogEntry[] {
    const rows: LogEntry[] = [];
    this.api?.forEachNodeAfterFilter((node) => {
      if (node.data) rows.push(node.data);
    });
    return rows;
  }
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm run test --workspace=@bitbutler/app -- --watch=false`
Expected: PASS.

- [ ] **Step 5: Add the new context menu translation keys**

In `packages/app/public/i18n/us.json`, in the `pages.main.grid.context-menu.item` object, add a new key right after `"copy-row-as-json": "Copy Row as JSON",`:

```json
            "copy-rows-as-json": "Copy Rows as JSON",
```

In the `pages.main.grid.context-menu.field` object, add a new key right after `"row-as-json": "Row as JSON"` (remember to add a trailing comma to that line):

```json
            "row-as-json": "Row as JSON",
            "rows-as-json": "Rows as JSON"
```

Mirror both additions in `packages/app/public/i18n/hu.json` at the same locations, e.g.:

```json
            "copy-rows-as-json": "Sorok másolása JSON-ként",
```

```json
            "row-as-json": "Sor JSON-ként",
            "rows-as-json": "Sorok JSON-ként"
```

- [ ] **Step 6: Run lint**

Run: `npm run lint`
Expected: no errors/warnings.

- [ ] **Step 7: Commit**

```bash
git add packages/app/src/app/pages/logs/logs-grid/logs-grid.ts \
  packages/app/src/app/pages/logs/logs-grid/logs-grid.spec.ts \
  packages/app/public/i18n/us.json \
  packages/app/public/i18n/hu.json
git commit -m "#329: add row selection and selection-aware JSON copy to the logs grid"
```

---

## Task 3: `log.export` IPC (shared type, Electron handler, preload)

**Files:**

- Modify: `packages/shared/src/ipc.types.ts`
- Modify: `packages/electron/src/ipc/log.ts`
- Modify: `packages/electron/src/ipc/log.spec.ts`
- Modify: `packages/electron/src/preload.ts`
- Modify: `packages/app/src/test-setup.ts`

**Interfaces:**

- Produces: `BitButlerAPI.log.export(payload: { content: string; defaultFilename?: string }): Promise<{ cancelled: boolean; path?: string }>` (consumed by Task 5).

- [ ] **Step 1: Extend the shared `BitButlerAPI.log` type**

In `packages/shared/src/ipc.types.ts`, replace the `log` block:

```ts
  log: {
    write(entry: RendererLogEntry): void;
    list(): Promise<LogEntry[]>;
    clear(): Promise<{ ok: true }>;
    export(payload: {
      content: string;
      defaultFilename?: string;
    }): Promise<{ cancelled: boolean; path?: string }>;
  };
```

- [ ] **Step 2: Write the failing Electron `log:export` handler tests**

Add a new describe block at the end of `packages/electron/src/ipc/log.spec.ts`:

```ts
describe('log:export (via IPC handler)', () => {
  const mockShowSaveDialog = vi.hoisted(() => vi.fn());
  const mockWriteFile = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));

  beforeEach(() => {
    vi.resetModules();
    ipcHandlers.clear();
    vi.doMock('electron', () => ({
      ipcMain: {
        handle: vi.fn((channel: string, handler: (...args: unknown[]) => unknown) => {
          ipcHandlers.set(channel, handler);
        }),
        on: vi.fn(),
      },
      dialog: { showSaveDialog: mockShowSaveDialog },
    }));
    vi.doMock('node:fs', () => ({
      default: { promises: { writeFile: mockWriteFile } },
      promises: { writeFile: mockWriteFile },
    }));
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.doUnmock('node:fs');
  });

  async function getHandler() {
    const { registerLogIpcHandlers } = await import('./log.js');
    registerLogIpcHandlers();
    return ipcHandlers.get('log:export')!;
  }

  it('returns cancelled when the user dismisses the save dialog', async () => {
    mockShowSaveDialog.mockResolvedValue({ canceled: true, filePath: undefined });
    const handler = await getHandler();

    const result = await handler(null, { content: 'hello', defaultFilename: 'bitbutler.log' });

    expect(result).toEqual({ cancelled: true });
    expect(mockWriteFile).not.toHaveBeenCalled();
  });

  it('writes the content to the chosen path and returns it', async () => {
    mockShowSaveDialog.mockResolvedValue({ canceled: false, filePath: '/home/user/bitbutler.log' });
    const handler = await getHandler();

    const result = await handler(null, { content: 'hello', defaultFilename: 'bitbutler.log' });

    expect(mockWriteFile).toHaveBeenCalledWith('/home/user/bitbutler.log', 'hello', 'utf-8');
    expect(result).toEqual({ cancelled: false, path: '/home/user/bitbutler.log' });
  });

  it('defaults the save dialog filename to bitbutler.log when none is given', async () => {
    mockShowSaveDialog.mockResolvedValue({ canceled: false, filePath: '/home/user/custom.log' });
    const handler = await getHandler();

    await handler(null, { content: 'hello' });

    expect(mockShowSaveDialog).toHaveBeenCalledWith(
      expect.objectContaining({ defaultPath: 'bitbutler.log' }),
    );
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `npm run test --workspace=@bitbutler/electron -- --watch=false`
Expected: FAIL — no `log:export` handler is registered.

- [ ] **Step 4: Implement the `log:export` handler**

In `packages/electron/src/ipc/log.ts`, add the two imports at the top:

```ts
import type { LogEntry } from '@bitbutler/shared';
import { dialog, ipcMain } from 'electron';
import fs from 'node:fs';
import db from '../db.js';
import { insertLog } from '../logger.js';
import { resolveOriginalLocation } from '../source-map-resolver.js';
```

Register the new handler in `registerLogIpcHandlers`:

```ts
export function registerLogIpcHandlers(): void {
  ipcMain.handle('log:list', async () => logList());
  ipcMain.handle('log:clear', async () => logClear());
  ipcMain.handle(
    'log:export',
    async (_event, payload: { content: string; defaultFilename?: string }) => logExport(payload),
  );

  ipcMain.on('log:write', (_event, entry: unknown) => {
    // ... unchanged ...
  });
}
```

Add the new function at the bottom of the file:

```ts
async function logExport(payload: {
  content: string;
  defaultFilename?: string;
}): Promise<{ cancelled: boolean; path?: string }> {
  const { canceled, filePath } = await dialog.showSaveDialog({
    defaultPath: payload.defaultFilename ?? 'bitbutler.log',
    filters: [{ name: 'Log files', extensions: ['log'] }],
  });
  if (canceled || !filePath) return { cancelled: true };

  await fs.promises.writeFile(filePath, payload.content, 'utf-8');
  return { cancelled: false, path: filePath };
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npm run test --workspace=@bitbutler/electron -- --watch=false`
Expected: PASS.

- [ ] **Step 6: Wire the preload bridge**

In `packages/electron/src/preload.ts`, replace the `log` block:

```ts
  log: {
    write: (entry: RendererLogEntry) => ipcRenderer.send('log:write', entry),
    list: () => ipcRenderer.invoke('log:list'),
    clear: () => ipcRenderer.invoke('log:clear'),
    export: (payload: { content: string; defaultFilename?: string }) =>
      ipcRenderer.invoke('log:export', payload),
  },
```

- [ ] **Step 7: Update the Angular test-wide `window.bitbutler` stub**

In `packages/app/src/test-setup.ts`, add `export` to the `log` block so every Angular test still compiles against the extended `BitButlerAPI` type:

```ts
  log: {
    write: noop,
    list: () => Promise.resolve([]),
    clear: () => Promise.resolve({ ok: true as const }),
    export: () => Promise.resolve({ cancelled: true }),
  },
```

- [ ] **Step 8: Run the full app test suite to confirm nothing else broke**

Run: `npm run test --workspace=@bitbutler/app -- --watch=false`
Expected: PASS (same pass count as before this task, since no behavior changed for existing code).

- [ ] **Step 9: Run lint**

Run: `npm run lint`
Expected: no errors/warnings.

- [ ] **Step 10: Commit**

```bash
git add packages/shared/src/ipc.types.ts \
  packages/electron/src/ipc/log.ts \
  packages/electron/src/ipc/log.spec.ts \
  packages/electron/src/preload.ts \
  packages/app/src/test-setup.ts
git commit -m "#329: add log.export IPC for writing exported logs to disk"
```

---

## Task 4: Log export format template renderer

**Files:**

- Create: `packages/app/src/app/modals/export-logs/log-export-format.lib.ts`
- Create: `packages/app/src/app/modals/export-logs/log-export-format.lib.spec.ts`

**Interfaces:**

- Consumes: `LogEntry` from `@bitbutler/shared` (`id`, `timestamp`, `process`, `level`, `message`, `context`, `filename`, `line`).
- Produces: `LOG_EXPORT_FORMAT_TOKENS: readonly ['date', 'process', 'level', 'message', 'context', 'filename', 'line', 'id']`, `renderLogFormatTemplate(template: string, entry: LogEntry, dateFormatter: { format(value: number | string | undefined): string }): string` (consumed by Task 5).

- [ ] **Step 1: Write the failing tests**

Create `packages/app/src/app/modals/export-logs/log-export-format.lib.spec.ts`:

```ts
import type { LogEntry } from '@bitbutler/shared';
import { renderLogFormatTemplate } from './log-export-format.lib';

function makeLog(overrides: Partial<LogEntry> = {}): LogEntry {
  return {
    id: 7,
    timestamp: 1700000000,
    process: 'main',
    level: 'error',
    message: 'boom',
    context: 'ctx',
    filename: 'main.ts',
    line: 42,
    ...overrides,
  };
}

describe('renderLogFormatTemplate', () => {
  const dateFormatter = { format: vi.fn().mockReturnValue('2026-09-06 10:00') };

  beforeEach(() => {
    dateFormatter.format.mockClear();
  });

  it('substitutes every known token', () => {
    const result = renderLogFormatTemplate(
      '[{{date}}] [{{process}}] [{{level}}] ({{filename}}:{{line}}) - {{message}}',
      makeLog(),
      dateFormatter,
    );
    expect(result).toBe('[2026-09-06 10:00] [main] [error] (main.ts:42) - boom');
  });

  it('calls the date formatter with the entry timestamp', () => {
    renderLogFormatTemplate('{{date}}', makeLog({ timestamp: 123 }), dateFormatter);
    expect(dateFormatter.format).toHaveBeenCalledWith(123);
  });

  it('renders null filename, line and context as empty strings', () => {
    const result = renderLogFormatTemplate(
      '({{filename}}:{{line}}) {{context}}',
      makeLog({ filename: null, line: null, context: null }),
      dateFormatter,
    );
    expect(result).toBe('(:) ');
  });

  it('substitutes the id token', () => {
    const result = renderLogFormatTemplate('{{id}}', makeLog({ id: 99 }), dateFormatter);
    expect(result).toBe('99');
  });

  it('leaves an unrecognized token as-is', () => {
    const result = renderLogFormatTemplate('{{unknown}}', makeLog(), dateFormatter);
    expect(result).toBe('{{unknown}}');
  });

  it('tolerates extra whitespace inside the braces', () => {
    const result = renderLogFormatTemplate(
      '{{  message  }}',
      makeLog({ message: 'hi' }),
      dateFormatter,
    );
    expect(result).toBe('hi');
  });

  it('leaves a template with no placeholders unchanged', () => {
    const result = renderLogFormatTemplate('plain text', makeLog(), dateFormatter);
    expect(result).toBe('plain text');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run test --workspace=@bitbutler/app -- --watch=false`
Expected: FAIL — `log-export-format.lib` module does not exist.

- [ ] **Step 3: Implement `log-export-format.lib.ts`**

Create `packages/app/src/app/modals/export-logs/log-export-format.lib.ts`:

```ts
import type { LogEntry } from '@bitbutler/shared';

export const LOG_EXPORT_FORMAT_TOKENS = [
  'date',
  'process',
  'level',
  'message',
  'context',
  'filename',
  'line',
  'id',
] as const;

export type LogExportFormatToken = (typeof LOG_EXPORT_FORMAT_TOKENS)[number];

export interface LogExportDateFormatter {
  format(value: number | string | undefined): string;
}

export function renderLogFormatTemplate(
  template: string,
  entry: LogEntry,
  dateFormatter: LogExportDateFormatter,
): string {
  const values: Record<LogExportFormatToken, string> = {
    date: dateFormatter.format(entry.timestamp),
    process: entry.process,
    level: entry.level,
    message: entry.message,
    context: entry.context ?? '',
    filename: entry.filename ?? '',
    line: entry.line == null ? '' : String(entry.line),
    id: String(entry.id),
  };

  return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (match, token: string) =>
    Object.prototype.hasOwnProperty.call(values, token)
      ? values[token as LogExportFormatToken]
      : match,
  );
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm run test --workspace=@bitbutler/app -- --watch=false`
Expected: PASS.

- [ ] **Step 5: Run lint**

Run: `npm run lint`
Expected: no errors/warnings.

- [ ] **Step 6: Commit**

```bash
git add packages/app/src/app/modals/export-logs/log-export-format.lib.ts \
  packages/app/src/app/modals/export-logs/log-export-format.lib.spec.ts
git commit -m "#329: add log export format template renderer"
```

---

## Task 5: Export Logs modal

**Files:**

- Create: `packages/app/src/app/modals/export-logs/export-logs.ts`
- Create: `packages/app/src/app/modals/export-logs/export-logs.html`
- Create: `packages/app/src/app/modals/export-logs/export-logs.scss`
- Create: `packages/app/src/app/modals/export-logs/export-logs.spec.ts`
- Modify: `packages/app/public/i18n/us.json`
- Modify: `packages/app/public/i18n/hu.json`

**Interfaces:**

- Consumes: `renderLogFormatTemplate`, `LOG_EXPORT_FORMAT_TOKENS` from Task 4; `window.bitbutler.log.export` from Task 3; `DateFormatService.format(value): string` (existing); `ToastService.success`/`danger` (existing).
- Produces: `ExportLogs` standalone component with signal inputs `all: LogEntry[]`, `filtered: LogEntry[]`, `selected: LogEntry[]` (consumed by Task 6).

- [ ] **Step 1: Write the failing component tests**

Create `packages/app/src/app/modals/export-logs/export-logs.spec.ts`:

```ts
import { ComponentFixture, TestBed } from '@angular/core/testing';
import type { LogEntry } from '@bitbutler/shared';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { TranslateModule } from '@ngx-translate/core';
import { DateFormatService } from '../../services/date-format.service';
import { ToastService } from '../../services/toast.service';
import { ExportLogs } from './export-logs';

function makeLog(overrides: Partial<LogEntry> = {}): LogEntry {
  return {
    id: 1,
    timestamp: 1700000000,
    process: 'main',
    level: 'info',
    message: 'hello',
    context: null,
    filename: null,
    line: null,
    ...overrides,
  };
}

describe('ExportLogs', () => {
  let component: ExportLogs;
  let fixture: ComponentFixture<ExportLogs>;
  let activeModalMock: { close: ReturnType<typeof vi.fn>; dismiss: ReturnType<typeof vi.fn> };
  let dateFormatServiceMock: { format: ReturnType<typeof vi.fn> };
  let toastServiceMock: { success: ReturnType<typeof vi.fn>; danger: ReturnType<typeof vi.fn> };
  let exportSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(async () => {
    activeModalMock = { close: vi.fn(), dismiss: vi.fn() };
    dateFormatServiceMock = { format: vi.fn().mockReturnValue('2026-09-06 10:00') };
    toastServiceMock = { success: vi.fn(), danger: vi.fn() };
    exportSpy = vi
      .spyOn(window.bitbutler.log, 'export')
      .mockResolvedValue({ cancelled: false, path: '/home/user/bitbutler.log' });

    await TestBed.configureTestingModule({
      imports: [ExportLogs, TranslateModule.forRoot()],
      providers: [
        { provide: NgbActiveModal, useValue: activeModalMock },
        { provide: DateFormatService, useValue: dateFormatServiceMock },
        { provide: ToastService, useValue: toastServiceMock },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ExportLogs);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    fixture.detectChanges();
    expect(component).toBeTruthy();
  });

  it('defaults scope to all and format to the default template', () => {
    fixture.detectChanges();
    expect(component.exportForm.get('scope')?.value).toBe('all');
    expect(component.exportForm.get('format')?.value).toBe(
      '[{{date}}] [{{process}}] [{{level}}] ({{filename}}:{{line}}) - {{message}}',
    );
  });

  describe('exportedLogs', () => {
    it('returns the "all" input by default', () => {
      const all = [makeLog({ id: 1 })];
      fixture.componentRef.setInput('all', all);
      fixture.detectChanges();
      expect(component.exportedLogs()).toEqual(all);
    });

    it('returns the "filtered" input when scope is filtered', () => {
      const filtered = [makeLog({ id: 2 })];
      fixture.componentRef.setInput('all', [makeLog({ id: 1 })]);
      fixture.componentRef.setInput('filtered', filtered);
      fixture.detectChanges();

      component.exportForm.get('scope')?.setValue('filtered');
      expect(component.exportedLogs()).toEqual(filtered);
    });

    it('returns the "selected" input when scope is selected', () => {
      const selected = [makeLog({ id: 3 })];
      fixture.componentRef.setInput('all', [makeLog({ id: 1 })]);
      fixture.componentRef.setInput('selected', selected);
      fixture.detectChanges();

      component.exportForm.get('scope')?.setValue('selected');
      expect(component.exportedLogs()).toEqual(selected);
    });
  });

  describe('startExport', () => {
    it('does nothing when the format control is empty', async () => {
      fixture.detectChanges();
      component.exportForm.get('format')?.setValue('');

      await component.startExport();

      expect(exportSpy).not.toHaveBeenCalled();
    });

    it('formats every log in the current scope and writes it via window.bitbutler.log.export', async () => {
      fixture.componentRef.setInput('all', [
        makeLog({ id: 1, message: 'first' }),
        makeLog({ id: 2, message: 'second' }),
      ]);
      fixture.detectChanges();
      component.exportForm.get('format')?.setValue('{{message}}');

      await component.startExport();

      expect(exportSpy).toHaveBeenCalledWith({
        content: 'first\nsecond',
        defaultFilename: 'bitbutler.log',
      });
    });

    it('shows a success toast and closes the modal when the write succeeds', async () => {
      fixture.componentRef.setInput('all', [makeLog()]);
      fixture.detectChanges();

      await component.startExport();

      expect(toastServiceMock.success).toHaveBeenCalledWith(
        '/home/user/bitbutler.log',
        expect.any(String),
      );
      expect(activeModalMock.close).toHaveBeenCalled();
    });

    it('leaves the modal open without a toast when the save dialog is cancelled', async () => {
      exportSpy.mockResolvedValue({ cancelled: true });
      fixture.componentRef.setInput('all', [makeLog()]);
      fixture.detectChanges();

      await component.startExport();

      expect(toastServiceMock.success).not.toHaveBeenCalled();
      expect(activeModalMock.close).not.toHaveBeenCalled();
    });

    it('shows a danger toast and keeps the modal open when the IPC call rejects', async () => {
      exportSpy.mockRejectedValue(new Error('disk full'));
      fixture.componentRef.setInput('all', [makeLog()]);
      fixture.detectChanges();

      await component.startExport();

      expect(toastServiceMock.danger).toHaveBeenCalledWith('Error: disk full', expect.any(String));
      expect(activeModalMock.close).not.toHaveBeenCalled();
    });
  });

  describe('variableGuide', () => {
    it('renders one row per known format token', () => {
      fixture.componentRef.setInput('all', [makeLog({ message: 'hi' })]);
      fixture.detectChanges();

      const messageRow = component.variableGuide().find((row) => row.token === 'message');
      expect(messageRow?.example).toBe('hi');
    });
  });

  describe('close', () => {
    it('dismisses the modal', () => {
      fixture.detectChanges();
      component.close();
      expect(activeModalMock.dismiss).toHaveBeenCalled();
    });
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run test --workspace=@bitbutler/app -- --watch=false`
Expected: FAIL — `export-logs` module does not exist.

- [ ] **Step 3: Implement `ExportLogs`**

Create `packages/app/src/app/modals/export-logs/export-logs.ts`:

```ts
import {
  ChangeDetectionStrategy,
  Component,
  Injector,
  OnInit,
  computed,
  inject,
  input,
  runInInjectionContext,
  signal,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import type { LogEntry } from '@bitbutler/shared';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import {
  faChevronDown,
  faChevronUp,
  faFileExport,
  faXmark,
} from '@fortawesome/free-solid-svg-icons';
import { NgbActiveModal, NgbCollapse } from '@ng-bootstrap/ng-bootstrap';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { BbBtnContent } from '../../components/bb-btn-content/bb-btn-content';
import { AutofocusDirective } from '../../directives/autofocus';
import { DateFormatService } from '../../services/date-format.service';
import { ToastService } from '../../services/toast.service';
import { LOG_EXPORT_FORMAT_TOKENS, renderLogFormatTemplate } from './log-export-format.lib';

export type ExportLogsScope = 'all' | 'filtered' | 'selected';

const DEFAULT_FORMAT = '[{{date}}] [{{process}}] [{{level}}] ({{filename}}:{{line}}) - {{message}}';

const SAMPLE_LOG: LogEntry = {
  id: 1,
  timestamp: Math.floor(Date.now() / 1000),
  process: 'main',
  level: 'info',
  message: 'Sample log message',
  context: null,
  filename: 'main.ts',
  line: 42,
};

interface FormatTokenGuideRow {
  token: string;
  description: string;
  example: string;
}

@Component({
  selector: 'app-export-logs',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    TranslatePipe,
    FontAwesomeModule,
    NgbCollapse,
    BbBtnContent,
    AutofocusDirective,
  ],
  templateUrl: './export-logs.html',
  styleUrl: './export-logs.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ExportLogs implements OnInit {
  private readonly activeModal = inject(NgbActiveModal);
  private readonly dateFormatService = inject(DateFormatService);
  private readonly toastService = inject(ToastService);
  private readonly translateService = inject(TranslateService);
  private readonly injector = inject(Injector);

  public readonly icons = { faFileExport, faXmark, faChevronDown, faChevronUp };

  public readonly all = input<LogEntry[]>([]);
  public readonly filtered = input<LogEntry[]>([]);
  public readonly selected = input<LogEntry[]>([]);

  public exportForm!: FormGroup;
  public readonly variableGuideExpanded = signal(false);
  public readonly exporting = signal(false);

  private scopeValue!: ReturnType<typeof toSignal<ExportLogsScope>>;

  public readonly allCount = computed(() => this.all().length);
  public readonly filteredCount = computed(() => this.filtered().length);
  public readonly selectedCount = computed(() => this.selected().length);
  public readonly hasFiltered = computed(() => this.filteredCount() > 0);
  public readonly hasSelection = computed(() => this.selectedCount() > 0);

  public readonly exportedLogs = computed<LogEntry[]>(() => {
    switch (this.scopeValue?.()) {
      case 'selected':
        return this.selected();
      case 'filtered':
        return this.filtered();
      default:
        return this.all();
    }
  });

  private readonly sampleEntry = computed<LogEntry>(() => this.exportedLogs()[0] ?? SAMPLE_LOG);

  public readonly variableGuide = computed<FormatTokenGuideRow[]>(() =>
    LOG_EXPORT_FORMAT_TOKENS.map((token) => ({
      token,
      description: this.translateService.instant(
        `components.modals.export-logs.variable-guide.token.${token}`,
      ),
      example: renderLogFormatTemplate(`{{${token}}}`, this.sampleEntry(), this.dateFormatService),
    })),
  );

  ngOnInit(): void {
    this.exportForm = new FormGroup({
      scope: new FormControl<ExportLogsScope>('all', { nonNullable: true }),
      format: new FormControl(DEFAULT_FORMAT, {
        nonNullable: true,
        validators: [Validators.required],
      }),
    });

    const scopeControl = this.exportForm.get('scope')!;
    this.scopeValue = runInInjectionContext(this.injector, () =>
      toSignal(scopeControl.valueChanges, { initialValue: scopeControl.value as ExportLogsScope }),
    );
  }

  toggleVariableGuide(): void {
    this.variableGuideExpanded.update((v) => !v);
  }

  async startExport(): Promise<void> {
    if (this.exportForm.invalid) return;

    const { format } = this.exportForm.getRawValue();
    const content = this.exportedLogs()
      .map((entry) => renderLogFormatTemplate(format, entry, this.dateFormatService))
      .join('\n');

    this.exporting.set(true);
    try {
      const result = await window.bitbutler.log.export({
        content,
        defaultFilename: 'bitbutler.log',
      });
      if (result.cancelled) return;

      this.toastService.success(
        result.path ?? '',
        this.translateService.instant('components.modals.export-logs.toast.success.title'),
      );
      this.activeModal.close();
    } catch (error) {
      this.toastService.danger(
        String(error),
        this.translateService.instant('components.modals.export-logs.toast.error.title'),
      );
    } finally {
      this.exporting.set(false);
    }
  }

  close(): void {
    this.activeModal.dismiss();
  }
}
```

- [ ] **Step 4: Run the test to verify it fails on the missing template**

Run: `npm run test --workspace=@bitbutler/app -- --watch=false`
Expected: FAIL — missing `export-logs.html`/`export-logs.scss`.

- [ ] **Step 5: Create the template**

Create `packages/app/src/app/modals/export-logs/export-logs.html`:

```html
<div class="modal-header">
  <h5 class="modal-title">{{ 'components.modals.export-logs.title' | translate }}</h5>
  <button type="button" class="btn-close" aria-label="Close" (click)="close()"></button>
</div>

<div class="modal-body">
  <form [formGroup]="exportForm" class="d-flex flex-column gap-3">
    <fieldset class="bb-fieldset">
      <legend>{{ 'components.modals.export-logs.label.scope' | translate }}</legend>

      <div class="btn-group w-100 mb-1" role="group">
        <input
          type="radio"
          class="btn-check"
          formControlName="scope"
          id="export-logs-scope-all"
          value="all"
        />
        <label class="btn btn-outline-secondary" for="export-logs-scope-all">
          {{ ('components.modals.export-logs.scope.all' | translate) + ' (' + allCount() + ')' }}
        </label>
        <input
          type="radio"
          class="btn-check"
          formControlName="scope"
          id="export-logs-scope-filtered"
          value="filtered"
          [attr.disabled]="!hasFiltered() || null"
        />
        <label class="btn btn-outline-secondary" for="export-logs-scope-filtered">
          {{ ('components.modals.export-logs.scope.filtered' | translate) + ' (' + filteredCount() +
          ')' }}
        </label>
        <input
          type="radio"
          class="btn-check"
          formControlName="scope"
          id="export-logs-scope-selected"
          value="selected"
          [attr.disabled]="!hasSelection() || null"
        />
        <label class="btn btn-outline-secondary" for="export-logs-scope-selected">
          {{ ('components.modals.export-logs.scope.selected' | translate) + ' (' + selectedCount() +
          ')' }}
        </label>
      </div>
    </fieldset>

    <fieldset class="bb-fieldset">
      <legend>{{ 'components.modals.export-logs.label.format' | translate }}</legend>

      <div class="form-floating mb-2">
        <input
          type="text"
          class="form-control"
          id="export-logs-format"
          formControlName="format"
          [placeholder]="'components.modals.export-logs.placeholder.format' | translate"
        />
        <label for="export-logs-format"
          >{{ 'components.modals.export-logs.label.format' | translate }}</label
        >
      </div>

      <div class="d-flex justify-content-end mb-2">
        <button type="button" class="btn btn-sm btn-link btn-split" (click)="toggleVariableGuide()">
          <bb-btn-content
            [icon]="variableGuideExpanded() ? icons.faChevronUp : icons.faChevronDown"
            [text]="'components.modals.export-logs.variable-guide.toggle' | translate"
          ></bb-btn-content>
        </button>
      </div>

      <div [ngbCollapse]="!variableGuideExpanded()">
        <div class="row mb-2">
          <div class="col-12 text-muted small">
            {{ 'components.modals.export-logs.variable-guide.hint' | translate }}
          </div>
        </div>
        <div class="row mb-2">
          <div class="col-12">
            <table
              id="export-logs-variable-guide"
              class="table table-sm table-striped table-hover mb-0"
            >
              <thead>
                <tr>
                  <th>
                    {{ 'components.modals.export-logs.variable-guide.column-token' | translate }}
                  </th>
                  <th>
                    {{ 'components.modals.export-logs.variable-guide.column-description' | translate
                    }}
                  </th>
                  <th>
                    {{ 'components.modals.export-logs.variable-guide.column-example' | translate }}
                  </th>
                </tr>
              </thead>
              <tbody>
                @for (row of variableGuide(); track row.token) {
                <tr>
                  <td><code>&#123;&#123;{{ row.token }}&#125;&#125;</code></td>
                  <td>{{ row.description }}</td>
                  <td>{{ row.example }}</td>
                </tr>
                }
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </fieldset>
  </form>
</div>

<div class="modal-footer">
  <button
    type="button"
    class="btn btn-primary btn-sm bb-pill-btn"
    (click)="startExport()"
    [disabled]="exportForm.invalid || exporting()"
  >
    <bb-btn-content
      [icon]="icons.faFileExport"
      [text]="'components.modals.export-logs.button.export' | translate"
      position="end"
    ></bb-btn-content>
  </button>
  <button type="button" class="btn btn-sm btn-split" (click)="close()" autofocus>
    <bb-btn-content
      [icon]="icons.faXmark"
      [text]="'general.button.cancel' | translate"
      position="end"
    ></bb-btn-content>
  </button>
</div>
```

- [ ] **Step 6: Create the stylesheet**

Create `packages/app/src/app/modals/export-logs/export-logs.scss` (the segmented scope-toggle and pill-button rules, copied from `export-torrents.scss` since Angular view encapsulation scopes styles per-component):

```scss
.bb-pill-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;

  ::ng-deep {
    .btn-icon,
    .btn-text {
      display: inline-flex;
      align-items: center;
      padding: 0 !important;
      background: none !important;
    }
  }
}

.btn-group.w-100 {
  .btn {
    --bs-btn-border-radius: 0;
    border: 1px solid var(--bb-control-border);
    background-color: var(--bb-control-bg);
    color: var(--bb-control-placeholder);

    &:first-of-type {
      border-top-left-radius: var(--bb-control-radius);
      border-bottom-left-radius: var(--bb-control-radius);
    }

    &:last-of-type {
      border-top-right-radius: var(--bb-control-radius);
      border-bottom-right-radius: var(--bb-control-radius);
    }

    &:not(:first-of-type) {
      border-left: 0;
    }
  }

  .btn-check:checked + .btn {
    background-color: var(--bb-accent);
    border-color: var(--bb-accent);
    color: var(--bb-secondary-ink);
  }

  .btn-check:focus-visible + .btn {
    box-shadow: 0 0 0 0.2rem var(--bb-control-focus-ring);
  }
}

.form-control {
  background-color: var(--bb-control-bg);
  border-color: var(--bb-control-border);
}

.form-control:focus {
  background-color: var(--bb-control-bg);
}

form > fieldset.bb-fieldset {
  margin-top: 0;
  margin-bottom: 0;
}
```

- [ ] **Step 7: Run the test to verify it passes**

Run: `npm run test --workspace=@bitbutler/app -- --watch=false`
Expected: PASS.

- [ ] **Step 8: Add the `components.modals.export-logs` translation block**

In `packages/app/public/i18n/us.json`, inside `components.modals`, add a new sibling object immediately before the `"import-torrents": {` key (i.e. right after the `export-torrents` block's closing `},`):

```json
      "export-logs": {
        "title": "Export Logs",
        "label": {
          "scope": "Export scope",
          "format": "Format"
        },
        "placeholder": {
          "format": "[{{date}}] [{{process}}] [{{level}}] ({{filename}}:{{line}}) - {{message}}"
        },
        "scope": {
          "all": "All",
          "filtered": "Filtered",
          "selected": "Selected"
        },
        "variable-guide": {
          "toggle": "Variable guide",
          "hint": "Wrap a variable name in double curly braces, e.g. {{message}}, to include its value.",
          "column-token": "Variable",
          "column-description": "Description",
          "column-example": "Example",
          "token": {
            "date": "Formatted timestamp, using the app's configured date/time format",
            "process": "The process that produced the entry (main or renderer)",
            "level": "The log level (debug, info, warn, or error)",
            "message": "The log message",
            "context": "Additional context attached to the entry, if any",
            "filename": "The source filename the entry originated from, if known",
            "line": "The source line number the entry originated from, if known",
            "id": "The entry's numeric ID"
          }
        },
        "button": {
          "export": "Export"
        },
        "toast": {
          "success": {
            "title": "Logs Exported"
          },
          "error": {
            "title": "Failed to Export Logs"
          }
        }
      },
```

Mirror the same structure at the same location in `packages/app/public/i18n/hu.json` (also immediately before its `"import-torrents": {` key) with Hungarian text:

```json
      "export-logs": {
        "title": "Naplók exportálása",
        "label": {
          "scope": "Exportálás hatóköre",
          "format": "Formátum"
        },
        "placeholder": {
          "format": "[{{date}}] [{{process}}] [{{level}}] ({{filename}}:{{line}}) - {{message}}"
        },
        "scope": {
          "all": "Összes",
          "filtered": "Szűrt",
          "selected": "Kijelölt"
        },
        "variable-guide": {
          "toggle": "Változók súgója",
          "hint": "Írj egy változónevet dupla kapcsos zárójelbe, pl. {{message}}, hogy beillessze az értékét.",
          "column-token": "Változó",
          "column-description": "Leírás",
          "column-example": "Példa",
          "token": {
            "date": "Formázott időbélyeg, az alkalmazás beállított dátum-/időformátuma szerint",
            "process": "A bejegyzést létrehozó folyamat (main vagy renderer)",
            "level": "A napló szintje (debug, info, warn vagy error)",
            "message": "A napló üzenete",
            "context": "A bejegyzéshez csatolt további kontextus, ha van",
            "filename": "A bejegyzés forrás fájlneve, ha ismert",
            "line": "A bejegyzés forrás sorszáma, ha ismert",
            "id": "A bejegyzés numerikus azonosítója"
          }
        },
        "button": {
          "export": "Exportálás"
        },
        "toast": {
          "success": {
            "title": "Naplók exportálva"
          },
          "error": {
            "title": "Naplók exportálása sikertelen"
          }
        }
      },
```

- [ ] **Step 9: Run lint**

Run: `npm run lint`
Expected: no errors/warnings.

- [ ] **Step 10: Commit**

```bash
git add packages/app/src/app/modals/export-logs/ \
  packages/app/public/i18n/us.json \
  packages/app/public/i18n/hu.json
git commit -m "#329: add the Export Logs modal"
```

---

## Task 6: Wire the Export button in the Logs page

**Files:**

- Modify: `packages/app/src/app/pages/logs/logs.ts`
- Modify: `packages/app/src/app/pages/logs/logs.html`
- Modify: `packages/app/src/app/pages/logs/logs.spec.ts`

**Interfaces:**

- Consumes: `LogsGrid.getSelectedRows()`/`getFilteredRows()` (Task 2), `ExportLogs` component and its `all`/`filtered`/`selected` inputs (Task 5), `setModalInput` from `packages/app/src/app/utils/modal-input.ts` (existing).

- [ ] **Step 1: Write the failing `exportLogs` test**

In `packages/app/src/app/pages/logs/logs.spec.ts`, add an `NgbModal` mock to the providers and a new describe block. First, add the import and provider:

```ts
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
```

```ts
let ngbModalMock: { open: ReturnType<typeof vi.fn> };
```

```ts
ngbModalMock = {
  open: vi.fn().mockReturnValue({
    componentInstance: {},
    result: Promise.resolve(),
  }),
};
```

Add `{ provide: NgbModal, useValue: ngbModalMock }` to the `providers` array in `TestBed.configureTestingModule`.

Then add:

```ts
describe('exportLogs', () => {
  it('opens the Export Logs modal with the current logs, filtered rows, and selected rows', () => {
    fixture.detectChanges();
    component.logs.set([makeLog({ id: 1 })]);

    component.exportLogs();

    expect(ngbModalMock.open).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ size: 'lg', scrollable: true, centered: false }),
    );
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run test --workspace=@bitbutler/app -- --watch=false`
Expected: FAIL — `component.exportLogs is not a function`.

- [ ] **Step 3: Implement `exportLogs`**

In `packages/app/src/app/pages/logs/logs.ts`, update the `@angular/core` import to add `viewChild` (this line already has `ChangeDetectionStrategy, Component, HostListener, OnInit, inject, signal` from Task 1):

```ts
import {
  ChangeDetectionStrategy,
  Component,
  HostListener,
  OnInit,
  inject,
  signal,
  viewChild,
} from '@angular/core';
```

Update the `@ng-bootstrap/ng-bootstrap` import to add `NgbModal`:

```ts
import { NgbModal, NgbTooltipModule } from '@ng-bootstrap/ng-bootstrap';
```

Add two new imports (the `LogsGrid` import already exists at the bottom of the import list - leave it as-is):

```ts
import { ExportLogs } from '../../modals/export-logs/export-logs';
import { setModalInput } from '../../utils/modal-input';
```

Add the injected service and the view child query alongside the other injected members:

```ts
  private readonly modalService = inject(NgbModal);
  private readonly logsGrid = viewChild(LogsGrid);
```

Add the method near `clear`/`refresh`:

```ts
  exportLogs(): void {
    const grid = this.logsGrid();
    const modalRef = this.modalService.open(ExportLogs, {
      size: 'lg',
      scrollable: true,
      centered: false,
    });
    setModalInput(modalRef, 'all', this.logs());
    setModalInput(modalRef, 'filtered', grid?.getFilteredRows() ?? []);
    setModalInput(modalRef, 'selected', grid?.getSelectedRows() ?? []);
    modalRef.result.catch(() => {});
  }
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm run test --workspace=@bitbutler/app -- --watch=false`
Expected: PASS.

- [ ] **Step 5: Wire the Export button's click handler**

In `packages/app/src/app/pages/logs/logs.html`, update the Export button:

```html
<button
  type="button"
  class="bb-tool"
  (click)="exportLogs(); exportTooltip.close()"
  [ngbTooltip]="'general.button.export' | translate"
  placement="bottom"
  container="body"
  [disableTooltip]="!compact"
  #exportTooltip="ngbTooltip"
>
  <span class="bb-tool__icon" aria-hidden="true">
    <fa-icon [icon]="icons.faFileExport" />
  </span>
  <span class="bb-tool__label">{{ 'general.button.export' | translate }}</span>
</button>
```

- [ ] **Step 6: Run the full app test suite**

Run: `npm run test --workspace=@bitbutler/app -- --watch=false`
Expected: PASS, same or higher test count than before this task.

- [ ] **Step 7: Run lint**

Run: `npm run lint`
Expected: no errors/warnings.

- [ ] **Step 8: Manually verify in the running app**

Run: `npm start`

- Open the Logs view, generate a few log entries, select multiple rows (click + ctrl/shift-click), right-click and confirm "Copy Rows as JSON" copies a JSON array.
- Toggle Compact Rows and confirm the button highlights and rows shrink.
- Click Export, confirm the scope counts match the grid, change the format, expand the variable guide, click Export, confirm the native save dialog opens with `bitbutler.log` pre-filled, save it, and confirm the written file's content matches the chosen format and scope.

- [ ] **Step 9: Commit**

```bash
git add packages/app/src/app/pages/logs/logs.ts \
  packages/app/src/app/pages/logs/logs.html \
  packages/app/src/app/pages/logs/logs.spec.ts
git commit -m "#329: wire the Export Logs modal into the logs view toolbar"
```
