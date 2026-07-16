# Import Torrents Unified Preview Grid Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the duplicates-only ag-grid in the Import Torrents modal with a single, always-shown grid listing every torrent in the archive, with live per-row import status, and grow the modal to `xl`.

**Architecture:** The backend (`packages/electron/src/ipc/export.ts`) starts reporting which specific torrent (`hash`) just finished and whether it succeeded on every `import:progress` event, via a new shared `ImportProgressEvent` type (replacing the reused `ExportProgressEvent` for this channel only). `ExportService` folds those per-hash outcomes into a `Map<string, 'imported' | 'failed'>` on its `ImportState`. `ImportTorrents` derives a client-only `importState` (`pending` | `duplicate` | `imported` | `failed`) per archive entry from that map plus the existing duplicate-hash check, drives grid row selection from it (selection = "will be imported"), and reuses the existing `skipHashes` IPC contract - no backend selection logic changes.

**Tech Stack:** Angular 20 (signals, standalone components), ag-grid-angular/ag-grid-community, ngx-translate, Electron main process (TypeScript), Vitest.

## Global Constraints

- Toast title = short Title-Case outcome description; toast message = variable detail or one sentence. (Not directly touched by this plan - no new toasts.)
- Commit format: `#229: short description` (current branch: `229-import-duplicate-handling`).
- Use `-` instead of `—` in all written output (commits, comments, docs).
- `npm run lint` requires zero warnings.
- Both `public/i18n/us.json` and `public/i18n/hu.json` must stay fully parallel with real translations - no English fallback in `hu.json`.
- Column headers in this grid use Title Case in English (`us.json`); Hungarian (`hu.json`) keeps its existing sentence-case convention - do not force Title Case onto Hungarian strings.
- No column variation between `full`/`legacy` export modes; no `magnet_link` column.
- No changes to `applyTorrentSettings`/`addTorrent` logic, to `partitionImportEntries`, or to the running→done footer button behavior (already correct).

---

## File Structure

- `packages/shared/src/ipc.types.ts` - add `ImportProgressEvent`, retype `onImportProgress`.
- `packages/electron/src/preload.ts` - retype `onImportProgress` subscription.
- `packages/electron/src/ipc/export.ts` - `runImport`'s per-entry loop sends `hash` + `success` instead of a cumulative `skipped` counter.
- `packages/electron/src/ipc/export.spec.ts` - update/add per-entry progress assertions.
- `packages/app/src/app/services/export.service.ts` - `ImportState.results: Map<string, 'imported' | 'failed'>`, populated from `onImportProgress`.
- `packages/app/src/app/services/export.service.spec.ts` - cover the new `results` map.
- `packages/app/src/app/modals/import-torrents/import-torrents.ts` - unified row/grid model replacing the duplicates-only one.
- `packages/app/src/app/modals/import-torrents/import-torrents.html` - always-shown grid fieldset, taller grid, `xl`-friendly layout.
- `packages/app/src/app/modals/import-torrents/import-torrents.spec.ts` - rewrite the "duplicate detection"/"duplicates grid column definitions"/"duplicates fieldset visibility" describe blocks for the unified model; update every `importState.set(...)` call to include `results`.
- `packages/app/src/app/services/ui-command-handler.service.ts` - `UI_IMPORT_TORRENTS` opens at `size: 'xl'`, `scrollable: true`.
- `packages/app/src/app/services/ui-command-handler.service.spec.ts` - new test asserting that size/scrollable config.
- `public/i18n/us.json`, `public/i18n/hu.json` - renamed/added keys under `components.modals.import-torrents`.

---

### Task 1: Per-torrent import progress (shared type + Electron)

**Files:**

- Modify: `packages/shared/src/ipc.types.ts`
- Modify: `packages/electron/src/preload.ts:184-185`
- Modify: `packages/electron/src/ipc/export.ts:500-517`
- Test: `packages/electron/src/ipc/export.spec.ts:592-624`

**Interfaces:**

- Produces: `ImportProgressEvent { current: number; total: number; name: string; hash: string; success: boolean }` (shared type), consumed by Task 2's `ExportService.onImportProgress` handler.

- [ ] **Step 1: Write the failing test - update the existing progress assertion and add a failure-case test**

In `packages/electron/src/ipc/export.spec.ts`, replace the `import:progress` expectation inside `'processes non-skipped entries normally while leaving skipped ones untouched'` (currently asserting `{ current: 1, total: 1, name: 'New Torrent', skipped: 0 }`):

```ts
expect(event.sender.send).toHaveBeenCalledWith('import:progress', {
  current: 1,
  total: 1,
  name: 'New Torrent',
  hash: 'bbb',
  success: true,
});
```

Then add a new test right after it, inside the same `describe('runImport', ...)` block:

```ts
it('reports success: false and increments failed when addTorrent throws', async () => {
  const torrents = [{ hash: 'ccc', name: 'Broken', failed: false, magnet_link: 'magnet:?xt=ccc' }];
  mockZipGetEntry.mockImplementation((name: string) =>
    name === 'metadata.json' ? metadataEntry(torrents) : undefined,
  );
  mockQbRequestImport.mockRejectedValue(new Error('qb request failed'));

  const { runImport } = await setup();
  const event = fakeEvent();
  await runImport(event as any, basePayload() as any);

  expect(event.sender.send).toHaveBeenCalledWith('import:progress', {
    current: 1,
    total: 1,
    name: 'Broken',
    hash: 'ccc',
    success: false,
  });
  expect(event.sender.send).toHaveBeenCalledWith('import:done', {
    total: 1,
    failed: 1,
    alreadyExisted: 0,
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm run test --workspace=@bitbutler/electron`
Expected: FAIL - both `import:progress` assertions fail because `runImport` still sends `{ current, total, name, skipped }` (no `hash`/`success` fields).

- [ ] **Step 3: Add `ImportProgressEvent` to the shared package**

In `packages/shared/src/ipc.types.ts`, add the new interface directly after `ExportProgressEvent` (around line 90):

```ts
export interface ImportProgressEvent {
  current: number;
  total: number;
  name: string;
  hash: string;
  success: boolean;
}
```

Then update the `BitButlerAPI['export']` member (around line 267):

```ts
    onImportProgress(cb: (e: ImportProgressEvent) => void): () => void;
```

(was `onImportProgress(cb: (e: ExportProgressEvent) => void): () => void;`)

- [ ] **Step 4: Update the preload typing**

In `packages/electron/src/preload.ts`, update the import list at the top of the file to include `ImportProgressEvent` alongside the existing `ExportProgressEvent` import, then change lines 184-185:

```ts
    onImportProgress: (cb: (e: ImportProgressEvent) => void) =>
      makeIpcSubscription('import:progress', (e) => e as ImportProgressEvent, cb),
```

- [ ] **Step 5: Update `runImport`'s per-entry loop**

In `packages/electron/src/ipc/export.ts`, replace the loop body (currently lines ~500-517):

```ts
const addedHashes: string[] = [];
for (let i = 0; i < toProcess.length; i++) {
  if (importCancelled) break;

  const entry = toProcess[i];
  let success = true;
  try {
    await addTorrent(serverId, entry, metadata.export_mode, zip, restoreFields, pathMappings);
    addedHashes.push(entry.hash);
  } catch {
    failed++;
    success = false;
  }

  send('import:progress', {
    current: i + 1,
    total: toProcess.length,
    name: entry.name,
    hash: entry.hash,
    success,
  } satisfies ImportProgressEvent);
}
```

Add `ImportProgressEvent` to this file's existing `@bitbutler/shared` type import at the top (alongside `ExportProgressEvent`, `BbeMetadata`, etc).

- [ ] **Step 6: Run the tests to verify they pass**

Run: `npm run test --workspace=@bitbutler/electron`
Expected: PASS - all `export.spec.ts` tests green, including the two updated/added `runImport` cases.

- [ ] **Step 7: Type-check the Electron build**

Run: `npm run build:electron`
Expected: succeeds with no TypeScript errors (confirms the shared type change and preload retyping are consistent).

- [ ] **Step 8: Commit**

```bash
git add packages/shared/src/ipc.types.ts packages/electron/src/preload.ts packages/electron/src/ipc/export.ts packages/electron/src/ipc/export.spec.ts
git commit -m "#229: report per-torrent hash and outcome on import progress"
```

---

### Task 2: `ExportService` tracks per-hash import results

**Files:**

- Modify: `packages/app/src/app/services/export.service.ts`
- Test: `packages/app/src/app/services/export.service.spec.ts`

**Interfaces:**

- Consumes: `ImportProgressEvent` from Task 1 (`window.bitbutler.export.onImportProgress`).
- Produces: `ImportState.results: Map<string, 'imported' | 'failed'>` (keyed by lowercased hash), consumed by Task 3's `ImportTorrents.importRows`.

- [ ] **Step 1: Write the failing tests**

In `packages/app/src/app/services/export.service.spec.ts`, update the `onImportProgressCb` type declaration at the top of the file:

```ts
let onImportProgressCb: (e: {
  current: number;
  total: number;
  name: string;
  hash: string;
  success: boolean;
}) => void;
```

Replace the existing `'maps import progress events onto current/total/name without a stray skipped field'` test body:

```ts
it('maps import progress events onto current/total/name and records per-hash results', () => {
  onImportProgressCb({ current: 2, total: 5, name: 'Foo', hash: 'AAA', success: true });
  const state = service.importState();
  expect(state.phase).toBe('running');
  expect(state.current).toBe(2);
  expect(state.total).toBe(5);
  expect(state.name).toBe('Foo');
  expect(state.results.get('aaa')).toBe('imported');
});

it('records a failed result for a failed progress event', () => {
  onImportProgressCb({ current: 1, total: 1, name: 'Bar', hash: 'BBB', success: false });
  expect(service.importState().results.get('bbb')).toBe('failed');
});

it('setImportLoading clears previous results', () => {
  onImportProgressCb({ current: 1, total: 1, name: 'Foo', hash: 'aaa', success: true });
  service.setImportLoading();
  expect(service.importState().results.size).toBe(0);
});

it('resetImport clears previous results', () => {
  onImportProgressCb({ current: 1, total: 1, name: 'Foo', hash: 'aaa', success: true });
  service.resetImport();
  expect(service.importState().results.size).toBe(0);
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm run test --workspace=@bitbutler/app`
Expected: FAIL - `state.results` is `undefined` (property doesn't exist yet), and `onImportProgressCb` calls fail type-checking against the old signature once Task 1's shared type is in place.

- [ ] **Step 3: Add `results` to `ImportState`**

In `packages/app/src/app/services/export.service.ts`, update the import at the top:

```ts
import type {
  BbeMetadata,
  ExportDoneEvent,
  ExportProgressEvent,
  ImportProgressEvent,
} from '@bitbutler/shared';
```

Update the `ImportState` interface and `IMPORT_IDLE` constant:

```ts
export interface ImportState {
  phase: ImportPhase;
  metadata?: BbeMetadata;
  current: number;
  total: number;
  name: string;
  failed: number;
  alreadyExisted: number;
  error?: string;
  results: Map<string, 'imported' | 'failed'>;
}
```

```ts
const IMPORT_IDLE: ImportState = {
  phase: 'idle',
  current: 0,
  total: 0,
  name: '',
  failed: 0,
  alreadyExisted: 0,
  results: new Map(),
};
```

- [ ] **Step 4: Update the `onImportProgress` handler**

Replace the `api.onImportProgress(...)` subscription in the constructor:

```ts
      api.onImportProgress((e: ImportProgressEvent) =>
        this._import.update((s) => {
          const results = new Map(s.results);
          results.set(e.hash.toLowerCase(), e.success ? 'imported' : 'failed');
          return { ...s, phase: 'running', current: e.current, total: e.total, name: e.name, results };
        }),
      ),
```

- [ ] **Step 5: Reset `results` on load/reset**

Update `setImportLoading` and `resetImport`:

```ts
  setImportLoading(): void {
    this._import.set({ ...IMPORT_IDLE, phase: 'loading', results: new Map() });
  }
```

```ts
  resetImport(): void {
    this._import.set({ ...IMPORT_IDLE, results: new Map() });
  }
```

(`IMPORT_IDLE` is a shared constant object - spreading it without overriding `results` would let every reset share the same `Map` instance, so each reset must construct a fresh one.)

- [ ] **Step 6: Run the tests to verify they pass**

Run: `npm run test --workspace=@bitbutler/app`
Expected: PASS - all `export.service.spec.ts` tests green.

- [ ] **Step 7: Commit**

```bash
git add packages/app/src/app/services/export.service.ts packages/app/src/app/services/export.service.spec.ts
git commit -m "#229: track per-hash import results in ExportService"
```

---

### Task 3: `ImportTorrents` unified row/grid model and template

**Files:**

- Modify: `packages/app/src/app/modals/import-torrents/import-torrents.ts`
- Modify: `packages/app/src/app/modals/import-torrents/import-torrents.html:77-93`
- Test: `packages/app/src/app/modals/import-torrents/import-torrents.spec.ts`

**Interfaces:**

- Consumes: `ExportService.importState().results: Map<string, 'imported' | 'failed'>` (Task 2), `TorrentStoreService.torrentsMap()` (existing).
- Produces: `ImportGridRow = BbeTorrentEntry & { importState: 'pending' | 'duplicate' | 'imported' | 'failed' }`; `component.importRows(): ImportGridRow[]`; `component.duplicateHashes(): Set<string>`; `component.defaultSelectedHashes(): Set<string>`; `component.selectedHashes: Signal<Set<string>>`; `component.importColDefs: ColDef<ImportGridRow>[]`; `component.importGridOptions: GridOptions<ImportGridRow>`; `component.onImportSelectionChanged(e)`; `component.onImportFirstDataRendered(e)`. Task 4 only adds i18n string content for keys already referenced here (`components.modals.import-torrents.label.grid`, `grid.description`, `grid.col-def.*`, `grid.import-state.*`) - it touches no code.

- [ ] **Step 1: Write the failing tests**

In `packages/app/src/app/modals/import-torrents/import-torrents.spec.ts`, first update every existing `mockExportService.importState.set({...})` call site (in `'should expose tagsCount...'`, the `setMetadata` helper inside `'duplicate detection'`, and `setDone`) to include `results: new Map()`, and add `results: new Map()` to the `mockExportService.importState` signal's initial value in the top-level `beforeEach` (around line 33-40).

Replace the entire `describe('duplicate detection', ...)` block (lines 140-229) with:

```ts
describe('import row state', () => {
  function setMetadata(
    torrents: BbeTorrentEntry[],
    results: Map<string, 'imported' | 'failed'> = new Map(),
  ) {
    mockExportService.importState.set({
      phase: 'ready',
      current: 0,
      total: 0,
      name: '',
      failed: 0,
      alreadyExisted: 0,
      results,
      metadata: {
        version: 1,
        exported_at: 0,
        source_server: 'srv',
        export_mode: 'full',
        torrents,
      },
    } as any);
  }

  function torrentStoreMock() {
    return TestBed.inject(TorrentStoreService) as unknown as {
      torrentsMap: ReturnType<typeof signal<Map<string, unknown>>>;
    };
  }

  it('duplicateHashes is empty when no archive torrent hashes are on the target server', () => {
    setMetadata([{ hash: 'aaa', name: 'A', failed: false }]);
    expect(component.duplicateHashes()).toEqual(new Set());
  });

  it('duplicateHashes finds hashes that already exist on the target server, case-insensitively', () => {
    torrentStoreMock().torrentsMap.set(new Map([['AAA', {}]]));
    setMetadata([
      { hash: 'aaa', name: 'A', failed: false },
      { hash: 'bbb', name: 'B', failed: false },
    ]);

    expect(component.duplicateHashes()).toEqual(new Set(['aaa']));
  });

  it('excludes export-failed entries from duplicateHashes', () => {
    torrentStoreMock().torrentsMap.set(new Map([['aaa', {}]]));
    setMetadata([{ hash: 'aaa', name: 'A', failed: true } as any]);

    expect(component.duplicateHashes()).toEqual(new Set());
  });

  it('importRows marks export-time failures as failed and non-duplicate/non-result entries as pending', () => {
    setMetadata([
      { hash: 'aaa', name: 'A', failed: false },
      { hash: 'bbb', name: 'B', failed: true, error: 'boom' } as any,
    ]);

    const rows = component.importRows();
    expect(rows.find((r) => r.hash === 'aaa')?.importState).toBe('pending');
    expect(rows.find((r) => r.hash === 'bbb')?.importState).toBe('failed');
  });

  it('importRows marks a hash present in torrentsMap as duplicate', () => {
    torrentStoreMock().torrentsMap.set(new Map([['aaa', {}]]));
    setMetadata([{ hash: 'aaa', name: 'A', failed: false }]);

    expect(component.importRows().find((r) => r.hash === 'aaa')?.importState).toBe('duplicate');
  });

  it('importRows reflects live results over the duplicate/pending default', () => {
    torrentStoreMock().torrentsMap.set(new Map([['aaa', {}]]));
    setMetadata(
      [
        { hash: 'aaa', name: 'A', failed: false },
        { hash: 'bbb', name: 'B', failed: false },
      ],
      new Map([
        ['aaa', 'imported'],
        ['bbb', 'failed'],
      ]),
    );

    const rows = component.importRows();
    expect(rows.find((r) => r.hash === 'aaa')?.importState).toBe('imported');
    expect(rows.find((r) => r.hash === 'bbb')?.importState).toBe('failed');
  });

  it('defaultSelectedHashes includes only pending rows', () => {
    torrentStoreMock().torrentsMap.set(new Map([['aaa', {}]]));
    setMetadata([
      { hash: 'aaa', name: 'A', failed: false },
      { hash: 'bbb', name: 'B', failed: false },
      { hash: 'ccc', name: 'C', failed: true } as any,
    ]);

    expect(component.defaultSelectedHashes()).toEqual(new Set(['bbb']));
  });

  it('seeds selectedHashes from defaultSelectedHashes once the archive becomes ready', () => {
    torrentStoreMock().torrentsMap.set(new Map([['aaa', {}]]));
    setMetadata([
      { hash: 'aaa', name: 'A', failed: false },
      { hash: 'bbb', name: 'B', failed: false },
    ]);
    mockExportService.importPhase.set('ready');
    fixture.detectChanges();

    expect(component.selectedHashes()).toEqual(new Set(['bbb']));
  });

  it('startImport sends skipHashes for every unselected row', () => {
    torrentStoreMock().torrentsMap.set(
      new Map([
        ['aaa', {}],
        ['bbb', {}],
      ]),
    );
    setMetadata([
      { hash: 'aaa', name: 'A', failed: false },
      { hash: 'bbb', name: 'B', failed: false },
      { hash: 'ccc', name: 'C', failed: false },
    ]);
    mockExportService.importPhase.set('ready');
    fixture.detectChanges();

    component.startImport();

    const call = (window.bitbutler.export.importStart as any).mock.calls[0][0];
    expect(call.skipHashes.sort()).toEqual(['aaa', 'bbb']);
  });

  it('startImport excludes a manually-selected duplicate from skipHashes', () => {
    torrentStoreMock().torrentsMap.set(
      new Map([
        ['aaa', {}],
        ['bbb', {}],
      ]),
    );
    setMetadata([
      { hash: 'aaa', name: 'A', failed: false },
      { hash: 'bbb', name: 'B', failed: false },
    ]);
    mockExportService.importPhase.set('ready');
    fixture.detectChanges();

    component.onImportSelectionChanged({
      api: { getSelectedRows: () => [{ hash: 'aaa', name: 'A', failed: false }] },
    } as any);

    component.startImport();

    const call = (window.bitbutler.export.importStart as any).mock.calls[0][0];
    expect(call.skipHashes).toEqual(['bbb']);
  });
});
```

Then replace `describe('duplicates grid column definitions', ...)` (lines 231-286) with:

```ts
describe('import grid column definitions', () => {
  it('every column has a colId', () => {
    expect(component.importColDefs.every((c) => !!c.colId)).toBe(true);
  });

  it('colIds cover all expected fields plus importState', () => {
    const colIds = component.importColDefs.map((c) => c.colId);
    expect(colIds).toEqual(
      expect.arrayContaining([
        'name',
        'save_path',
        'category',
        'tags',
        'dl_limit',
        'up_limit',
        'ratio_limit',
        'seeding_time_limit',
        'inactive_seeding_time_limit',
        'auto_tmm',
        'sequential_download',
        'super_seeding',
        'first_last_piece_prio',
        'state',
        'importState',
      ]),
    );
  });

  it('assigns agCheckboxCellRenderer and BooleanColumnFilter to the boolean columns', () => {
    const boolCols = ['auto_tmm', 'sequential_download', 'super_seeding', 'first_last_piece_prio'];
    for (const colId of boolCols) {
      const col = component.importColDefs.find((c) => c.colId === colId);
      expect(col?.cellRenderer).toBe('agCheckboxCellRenderer');
    }
  });

  it('the dl_limit and up_limit columns use a valueFormatter', () => {
    expect(
      component.importColDefs.find((c) => c.colId === 'dl_limit')?.valueFormatter,
    ).toBeDefined();
    expect(
      component.importColDefs.find((c) => c.colId === 'up_limit')?.valueFormatter,
    ).toBeDefined();
  });

  it('the tags column formats an array as a comma-joined string', () => {
    const col = component.importColDefs.find((c) => c.colId === 'tags')!;
    const fmt = col.valueFormatter as (p: any) => string;
    expect(fmt({ value: ['linux', 'docs'] })).toBe('linux, docs');
    expect(fmt({ value: undefined })).toBe('');
  });

  it('the importState column has a valueFormatter and a set filter', () => {
    const col = component.importColDefs.find((c) => c.colId === 'importState')!;
    expect(col.valueFormatter).toBeDefined();
    expect(col.filter).toBeDefined();
  });
});

describe('import grid row selectability', () => {
  it('marks export-failed rows as non-selectable', () => {
    const isRowSelectable = component.importGridOptions.isRowSelectable!;
    expect(isRowSelectable({ data: { hash: 'aaa', failed: true } } as any)).toBe(false);
    expect(isRowSelectable({ data: { hash: 'bbb', failed: false } } as any)).toBe(true);
  });
});
```

Finally, replace `describe('duplicates fieldset visibility', ...)` with:

```ts
describe('import grid fieldset visibility', () => {
  it('does not render the import grid fieldset when the archive has not loaded', () => {
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('.import-grid-fieldset')).toBeNull();
  });

  it('renders the import grid fieldset once the archive is ready, even with no duplicates', () => {
    mockExportService.importPhase.set('ready');
    mockExportService.importState.set({
      phase: 'ready',
      current: 0,
      total: 0,
      name: '',
      failed: 0,
      alreadyExisted: 0,
      results: new Map(),
      metadata: {
        version: 1,
        exported_at: 0,
        source_server: 'srv',
        export_mode: 'full',
        torrents: [{ hash: 'aaa', name: 'A', failed: false }],
      },
    } as any);

    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('.import-grid-fieldset')).not.toBeNull();
  });

  it('keeps the import grid fieldset visible while running and once done', () => {
    mockExportService.importPhase.set('running');
    mockExportService.importState.set({
      phase: 'running',
      current: 1,
      total: 2,
      name: 'A',
      failed: 0,
      alreadyExisted: 0,
      results: new Map(),
      metadata: {
        version: 1,
        exported_at: 0,
        source_server: 'srv',
        export_mode: 'full',
        torrents: [{ hash: 'aaa', name: 'A', failed: false }],
      },
    } as any);

    fixture.detectChanges();
    expect(
      (fixture.nativeElement as HTMLElement).querySelector('.import-grid-fieldset'),
    ).not.toBeNull();
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm run test --workspace=@bitbutler/app`
Expected: FAIL - `component.duplicateHashes`, `component.importRows`, `component.defaultSelectedHashes`, `component.selectedHashes`, `component.onImportSelectionChanged`, `component.importColDefs`, `component.importGridOptions` don't exist yet (compile/runtime errors against the old `duplicateEntries`/`hasDuplicates`/`overriddenHashes`/`duplicatesColDefs`/`onDuplicatesSelectionChanged` API), and `.import-grid-fieldset` isn't in the template yet.

- [ ] **Step 3: Implement the unified row/grid model**

In `packages/app/src/app/modals/import-torrents/import-torrents.ts`, update the imports:

```ts
import {
  ChangeDetectionStrategy,
  Component,
  Injector,
  OnInit,
  computed,
  effect,
  inject,
  input,
  runInInjectionContext,
  signal,
  untracked,
} from '@angular/core';
```

Add to the `ag-grid-community` import (already present) the additional types needed:

```ts
import {
  ColDef,
  FirstDataRenderedEvent,
  GetRowIdParams,
  GridOptions,
  GridState,
  RowClassParams,
  SelectionChangedEvent,
  ValueFormatterParams,
  ValueGetterParams,
} from 'ag-grid-community';
```

Directly above the `@Component({ ... })` decorator (module scope, alongside the other top-level imports/consts - not inside the class), add:

```ts
export type ImportRowStatus = 'pending' | 'duplicate' | 'imported' | 'failed';
type ImportGridRow = BbeTorrentEntry & { importState: ImportRowStatus };
```

Then, inside the class, replace the block from `private readonly overriddenHashes = signal<Set<string>>(new Set());` through the end of `private getDuplicatesColDefs(): ColDef<BbeTorrentEntry>[] { ... }` (roughly lines 175-445) with:

```ts
  readonly duplicateHashes = computed(() => {
    const current = new Set(
      Array.from(this.torrentStore.torrentsMap().keys()).map((h) => h.toLowerCase()),
    );
    return new Set(
      (this.metadata()?.torrents ?? [])
        .filter((t) => !t.failed && current.has(t.hash.toLowerCase()))
        .map((t) => t.hash.toLowerCase()),
    );
  });

  readonly importRows = computed<ImportGridRow[]>(() => {
    const dupes = this.duplicateHashes();
    const results = this.exportService.importState().results;
    return (this.metadata()?.torrents ?? []).map((entry) => {
      const hashLower = entry.hash.toLowerCase();
      let importState: ImportRowStatus;
      if (entry.failed) {
        importState = 'failed';
      } else if (results.has(hashLower)) {
        importState = results.get(hashLower)!;
      } else if (dupes.has(hashLower)) {
        importState = 'duplicate';
      } else {
        importState = 'pending';
      }
      return { ...entry, importState };
    });
  });

  readonly defaultSelectedHashes = computed(() => {
    return new Set(
      this.importRows()
        .filter((r) => r.importState === 'pending')
        .map((r) => r.hash.toLowerCase()),
    );
  });

  readonly selectedHashes = signal<Set<string>>(new Set());

  private hasSeededSelection = false;

  private readonly seedSelectionEffect = effect(() => {
    if (this.phase() === 'ready' && !this.hasSeededSelection) {
      this.hasSeededSelection = true;
      this.selectedHashes.set(untracked(() => this.defaultSelectedHashes()));
    }
  });

  readonly importGridOptions: GridOptions<ImportGridRow> = {
    ...GRID_SHARED_OPTIONS,
    rowSelection: {
      mode: 'multiRow',
      checkboxes: true,
      headerCheckbox: true,
      enableClickSelection: false,
    },
    isRowSelectable: (node) => !node.data?.failed,
    getRowId: (params: GetRowIdParams<ImportGridRow>) => params.data.hash,
    rowClassRules: {
      'text-danger bg-danger-subtle': (params: RowClassParams<ImportGridRow>): boolean =>
        params.data?.importState === 'failed',
    },
    initialState: this.getImportGridInitialState(),
    onSelectionChanged: (e: SelectionChangedEvent<ImportGridRow>) =>
      this.onImportSelectionChanged(e),
    onFirstDataRendered: (e: FirstDataRenderedEvent<ImportGridRow>) =>
      this.onImportFirstDataRendered(e),
  };

  readonly importColDefs: ColDef<ImportGridRow>[] = this.getImportColDefs();

  onImportSelectionChanged(e: SelectionChangedEvent<ImportGridRow>): void {
    this.selectedHashes.set(new Set(e.api.getSelectedRows().map((r) => r.hash.toLowerCase())));
  }

  onImportFirstDataRendered(e: FirstDataRenderedEvent<ImportGridRow>): void {
    const selected = this.selectedHashes();
    e.api.forEachNode((node) => node.setSelected(selected.has(node.data!.hash.toLowerCase())));
  }

  private stateLabel(state: string | null | undefined): string {
    return state ? this.translateService.instant('torrent.state.' + state) : '';
  }

  private importStateLabel(state: ImportRowStatus | null | undefined): string {
    return state
      ? this.translateService.instant(
          'components.modals.import-torrents.grid.import-state.' + state,
        )
      : '';
  }

  private getImportGridInitialState(): GridState {
    const visibleStates: ImportRowStatus[] = ['pending', 'duplicate', 'failed'];
    return {
      filter: {
        filterModel: {
          importState: { values: visibleStates.map((s) => this.importStateLabel(s)) },
        },
      },
    };
  }

  private getImportColDefs(): ColDef<ImportGridRow>[] {
    const stateItems = computed(() =>
      buildValueCounts(this.importRows(), (t) => this.stateLabel(t.state)),
    );
    const importStateItems = computed(() =>
      buildValueCounts(this.importRows(), (t) => this.importStateLabel(t.importState)),
    );

    return [
      {
        colId: 'name',
        field: 'name',
        tooltipField: 'name',
        width: 220,
        headerName: this.translateService.instant(
          'components.modals.import-torrents.grid.col-def.name',
        ),
        headerTooltip: this.translateService.instant(
          'components.modals.import-torrents.grid.col-def.name',
        ),
        sortable: true,
        resizable: true,
        filter: TextColumnFilter,
      },
      {
        colId: 'save_path',
        field: 'save_path',
        tooltipField: 'save_path',
        width: 260,
        headerName: this.translateService.instant(
          'components.modals.import-torrents.grid.col-def.save_path',
        ),
        headerTooltip: this.translateService.instant(
          'components.modals.import-torrents.grid.col-def.save_path',
        ),
        sortable: true,
        resizable: true,
        filter: TextColumnFilter,
      },
      {
        colId: 'category',
        field: 'category',
        tooltipField: 'category',
        width: 150,
        headerName: this.translateService.instant(
          'components.modals.import-torrents.grid.col-def.category',
        ),
        headerTooltip: this.translateService.instant(
          'components.modals.import-torrents.grid.col-def.category',
        ),
        sortable: true,
        resizable: true,
        filter: TextColumnFilter,
      },
      {
        colId: 'tags',
        field: 'tags',
        width: 180,
        headerName: this.translateService.instant(
          'components.modals.import-torrents.grid.col-def.tags',
        ),
        headerTooltip: this.translateService.instant(
          'components.modals.import-torrents.grid.col-def.tags',
        ),
        valueFormatter: (params: ValueFormatterParams<ImportGridRow, string[]>) =>
          (params.value ?? []).join(', '),
        filterValueGetter: (params: ValueGetterParams<ImportGridRow>) =>
          (params.data?.tags ?? []).join(', '),
        tooltipValueGetter: (params) => (params.data?.tags ?? []).join(', '),
        sortable: true,
        resizable: true,
        filter: TextColumnFilter,
      },
      {
        colId: 'dl_limit',
        field: 'dl_limit',
        width: 130,
        headerName: this.translateService.instant(
          'components.modals.import-torrents.grid.col-def.dl_limit',
        ),
        headerTooltip: this.translateService.instant(
          'components.modals.import-torrents.grid.col-def.dl_limit',
        ),
        valueFormatter: this.uiFormatService.fileSizePerSecond,
        cellClass: 'tabular-nums',
        sortable: true,
        resizable: true,
        filter: SizeColumnFilter,
      },
      {
        colId: 'up_limit',
        field: 'up_limit',
        width: 130,
        headerName: this.translateService.instant(
          'components.modals.import-torrents.grid.col-def.up_limit',
        ),
        headerTooltip: this.translateService.instant(
          'components.modals.import-torrents.grid.col-def.up_limit',
        ),
        valueFormatter: this.uiFormatService.fileSizePerSecond,
        cellClass: 'tabular-nums',
        sortable: true,
        resizable: true,
        filter: SizeColumnFilter,
      },
      {
        colId: 'ratio_limit',
        field: 'ratio_limit',
        width: 135,
        headerName: this.translateService.instant(
          'components.modals.import-torrents.grid.col-def.ratio_limit',
        ),
        headerTooltip: this.translateService.instant(
          'components.modals.import-torrents.grid.col-def.ratio_limit',
        ),
        valueFormatter: this.uiFormatService.ratioLimit,
        cellClass: 'tabular-nums',
        sortable: true,
        resizable: true,
        filter: RatioLimitColumnFilter,
      },
      {
        colId: 'seeding_time_limit',
        field: 'seeding_time_limit',
        width: 165,
        headerName: this.translateService.instant(
          'components.modals.import-torrents.grid.col-def.seeding_time_limit',
        ),
        headerTooltip: this.translateService.instant(
          'components.modals.import-torrents.grid.col-def.seeding_time_limit',
        ),
        valueFormatter: this.uiFormatService.timeLimit,
        cellClass: 'tabular-nums',
        sortable: true,
        resizable: true,
        filter: TimeLimitColumnFilter,
      },
      {
        colId: 'inactive_seeding_time_limit',
        field: 'inactive_seeding_time_limit',
        width: 195,
        headerName: this.translateService.instant(
          'components.modals.import-torrents.grid.col-def.inactive_seeding_time_limit',
        ),
        headerTooltip: this.translateService.instant(
          'components.modals.import-torrents.grid.col-def.inactive_seeding_time_limit',
        ),
        valueFormatter: this.uiFormatService.timeLimit,
        cellClass: 'tabular-nums',
        sortable: true,
        resizable: true,
        filter: TimeLimitColumnFilter,
      },
      {
        colId: 'auto_tmm',
        field: 'auto_tmm',
        width: 130,
        headerName: this.translateService.instant(
          'components.modals.import-torrents.grid.col-def.auto_tmm',
        ),
        headerTooltip: this.translateService.instant(
          'components.modals.import-torrents.grid.col-def.auto_tmm',
        ),
        cellRenderer: 'agCheckboxCellRenderer',
        editable: false,
        sortable: true,
        resizable: true,
        filter: BooleanColumnFilter,
      },
      {
        colId: 'sequential_download',
        field: 'sequential_download',
        width: 170,
        headerName: this.translateService.instant(
          'components.modals.import-torrents.grid.col-def.sequential_download',
        ),
        headerTooltip: this.translateService.instant(
          'components.modals.import-torrents.grid.col-def.sequential_download',
        ),
        cellRenderer: 'agCheckboxCellRenderer',
        editable: false,
        sortable: true,
        resizable: true,
        filter: BooleanColumnFilter,
      },
      {
        colId: 'super_seeding',
        field: 'super_seeding',
        width: 140,
        headerName: this.translateService.instant(
          'components.modals.import-torrents.grid.col-def.super_seeding',
        ),
        headerTooltip: this.translateService.instant(
          'components.modals.import-torrents.grid.col-def.super_seeding',
        ),
        cellRenderer: 'agCheckboxCellRenderer',
        editable: false,
        sortable: true,
        resizable: true,
        filter: BooleanColumnFilter,
      },
      {
        colId: 'first_last_piece_prio',
        field: 'first_last_piece_prio',
        width: 175,
        headerName: this.translateService.instant(
          'components.modals.import-torrents.grid.col-def.first_last_piece_prio',
        ),
        headerTooltip: this.translateService.instant(
          'components.modals.import-torrents.grid.col-def.first_last_piece_prio',
        ),
        cellRenderer: 'agCheckboxCellRenderer',
        editable: false,
        sortable: true,
        resizable: true,
        filter: BooleanColumnFilter,
      },
      {
        colId: 'state',
        field: 'state',
        width: 130,
        headerName: this.translateService.instant(
          'components.modals.import-torrents.grid.col-def.state',
        ),
        headerTooltip: this.translateService.instant(
          'components.modals.import-torrents.grid.col-def.state',
        ),
        valueFormatter: (params: ValueFormatterParams<ImportGridRow, string>) =>
          this.stateLabel(params.value),
        filterValueGetter: (params: ValueGetterParams<ImportGridRow>) =>
          this.stateLabel(params.data?.state),
        sortable: true,
        resizable: true,
        filter: SetColumnFilter,
        filterParams: { getItems: () => stateItems() } satisfies Partial<SetColumnFilterParams>,
      },
      {
        colId: 'importState',
        field: 'importState',
        width: 140,
        headerName: this.translateService.instant(
          'components.modals.import-torrents.grid.col-def.import_state',
        ),
        headerTooltip: this.translateService.instant(
          'components.modals.import-torrents.grid.col-def.import_state',
        ),
        valueFormatter: (params: ValueFormatterParams<ImportGridRow, ImportRowStatus>) =>
          this.importStateLabel(params.value),
        filterValueGetter: (params: ValueGetterParams<ImportGridRow>) =>
          this.importStateLabel(params.data?.importState),
        sortable: true,
        resizable: true,
        filter: SetColumnFilter,
        filterParams: {
          getItems: () => importStateItems(),
        } satisfies Partial<SetColumnFilterParams>,
      },
    ];
  }
```

Finally, update `startImport()`'s `skipHashes` computation (replacing the `overriddenHashes`/`duplicateEntries`-based version):

```ts
const selected = this.selectedHashes();
const skipHashes = this.importRows()
  .filter((r) => !r.failed && !selected.has(r.hash.toLowerCase()))
  .map((r) => r.hash.toLowerCase());
```

- [ ] **Step 4: Update the template**

In `packages/app/src/app/modals/import-torrents/import-torrents.html`, replace the fieldset block (currently lines 77-93):

```html
@if (isReady() || isRunning() || isDone()) {
<fieldset class="bb-fieldset import-grid-fieldset">
  <legend>{{ 'components.modals.import-torrents.label.grid' | translate }}</legend>
  <p class="small mb-3">{{ 'components.modals.import-torrents.grid.description' | translate }}</p>
  <ag-grid-angular
    class="w-100 d-block mb-2"
    style="height: 420px"
    [loading]="false"
    [rowData]="importRows()"
    [columnDefs]="importColDefs"
    [gridOptions]="importGridOptions"
    [theme]="theme() === 'dark' ? bbDark : bbLight"
  />
</fieldset>
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npm run test --workspace=@bitbutler/app`
Expected: PASS - all `import-torrents.spec.ts` tests green (the "import row state", "import grid column definitions", "import grid row selectability", and "import grid fieldset visibility" blocks, plus every previously-passing test still passing now that `results` is present in every mocked `importState`). The i18n keys referenced by the template/colDefs don't exist yet (Task 4 adds them), so headers/legend/description render as their raw translation keys for now - that's expected and doesn't affect any assertion here, since none of these tests check header/legend/description text content.

- [ ] **Step 6: Commit**

```bash
git add packages/app/src/app/modals/import-torrents/import-torrents.ts packages/app/src/app/modals/import-torrents/import-torrents.html packages/app/src/app/modals/import-torrents/import-torrents.spec.ts
git commit -m "#229: unify import duplicate/status tracking into one always-shown grid"
```

---

### Task 4: Copy and i18n content

**Files:**

- Modify: `public/i18n/us.json:872-911`
- Modify: `public/i18n/hu.json:872-911`

**Interfaces:**

- None - fills in string content for i18n keys already referenced by Task 3's component and template (`components.modals.import-torrents.label.grid`, `grid.description`, `grid.col-def.*`, `grid.import-state.*`, `label.category-path-mapping`).

- [ ] **Step 1: Update `us.json`**

In `public/i18n/us.json`, replace the block spanning the current `"label"` and `"duplicates"` keys under `components.modals.import-torrents` (lines 872-911):

```json
        "label": {
          "archive": "Archive",
          "grid": "Torrents to Import",
          "restore-options": "Restore options",
          "path-remap": "Save path remapping",
          "category-path-mapping": "Category path remapping",
          "after-import": "After import",
          "progress": "Progress"
        },
        "archive": {
          "exported-from": "Exported from",
          "importing-to": "Importing to",
          "server-url": "Server URL",
          "export-date": "Export date",
          "torrents": "Torrents",
          "tags": "Tags",
          "categories": "Categories",
          "export-type": "Export type",
          "full-mode": "Full export",
          "legacy-mode": "Legacy export"
        },
        "grid": {
          "description": "This lists every torrent in the archive along with the metadata that will be restored. Uncheck a row to skip importing it - torrents that already exist on the target server are unchecked by default, but you can check them to import anyway and overwrite their settings.",
          "col-def": {
            "name": "Name",
            "save_path": "Save Path",
            "category": "Category",
            "tags": "Tags",
            "dl_limit": "Download Limit",
            "up_limit": "Upload Limit",
            "ratio_limit": "Ratio Limit",
            "seeding_time_limit": "Seeding Time Limit",
            "inactive_seeding_time_limit": "Inactive Seeding Time Limit",
            "auto_tmm": "Auto TMM",
            "sequential_download": "Sequential Download",
            "super_seeding": "Super Seeding",
            "first_last_piece_prio": "First/Last Piece Priority",
            "state": "State",
            "import_state": "Import State"
          },
          "import-state": {
            "pending": "Pending",
            "duplicate": "Duplicate",
            "imported": "Imported",
            "failed": "Failed"
          }
        },
```

- [ ] **Step 2: Update `hu.json`**

In `public/i18n/hu.json`, replace the equivalent block (same line range, 872-911):

```json
        "label": {
          "archive": "Archívum",
          "grid": "Importálandó torrentek",
          "restore-options": "Visszaállítási beállítások",
          "path-remap": "Mentési útvonal hozzárendelés",
          "category-path-mapping": "Kategória útvonal hozzárendelés",
          "after-import": "Importálás után",
          "progress": "Haladás"
        },
        "archive": {
          "exported-from": "Exportálva innen",
          "importing-to": "Importálás ide",
          "server-url": "Szerver URL",
          "export-date": "Exportálás dátuma",
          "torrents": "Torrentek",
          "tags": "Címkék",
          "categories": "Kategóriák",
          "export-type": "Export típusa",
          "full-mode": "Teljes export",
          "legacy-mode": "Örökölt export"
        },
        "grid": {
          "description": "Ez felsorolja az archívumban található összes torrentet a visszaállítandó metaadatokkal együtt. Töröld egy sor jelölését, ha ki szeretnéd hagyni az importálásból - a cél szerveren már meglévő torrentek alapértelmezés szerint nincsenek bejelölve, de bejelölheted őket, hogy mindenképp importáld és felülírd a beállításaikat.",
          "col-def": {
            "name": "Név",
            "save_path": "Mentési útvonal",
            "category": "Kategória",
            "tags": "Címkék",
            "dl_limit": "Letöltési korlát",
            "up_limit": "Feltöltési korlát",
            "ratio_limit": "Arány korlát",
            "seeding_time_limit": "Seedelési idő korlát",
            "inactive_seeding_time_limit": "Inaktív seedelési idő korlát",
            "auto_tmm": "Auto-TMM",
            "sequential_download": "Sorrendi letöltés",
            "super_seeding": "Super seeding",
            "first_last_piece_prio": "Első/utolsó szelet prioritása",
            "state": "Állapot",
            "import_state": "Import állapot"
          },
          "import-state": {
            "pending": "Függőben",
            "duplicate": "Duplikátum",
            "imported": "Importálva",
            "failed": "Sikertelen"
          }
        },
```

Note: `category-path-mapping`'s Hungarian value is unchanged - it already reads "Kategória útvonal hozzárendelés" ("Category path mapping/assignment"), which already matches `path-remap`'s "Mentési útvonal hozzárendelés" ("Save path mapping/assignment") - the English-only inconsistency being fixed here ("mapping" vs "remapping") doesn't exist in the Hungarian copy.

- [ ] **Step 3: Run the tests to confirm nothing broke**

Run: `npm run test --workspace=@bitbutler/app`
Expected: PASS - same green suite as the end of Task 3; this step only guards against a JSON syntax mistake (a malformed `us.json`/`hu.json` would fail Angular's i18n loader at runtime, though vitest unit tests don't load these files directly, so also visually re-check both JSON files parse - e.g. `node -e "JSON.parse(require('fs').readFileSync('public/i18n/us.json','utf8'))"` and the same for `hu.json`).

- [ ] **Step 4: Manual verification**

Run: `npm start`
Import an archive containing at least one torrent whose hash already exists on the currently-selected server, and at least one that doesn't. Confirm:

- The grid is visible as soon as the archive loads (not just when duplicates exist).
- Duplicate rows start unchecked; other rows start checked.
- Column headers read in Title Case (e.g. "Save Path", "Download Limit").
- The "Category Path Remapping" fieldset legend (visible when the categories restore toggle is on) reads "Category Path Remapping".
- Start the import and confirm rows flip to "Imported"/"Failed" in the Import State column as the run progresses, and that after it finishes the grid's default filter leaves only Duplicate/Failed rows visible.

- [ ] **Step 5: Commit**

```bash
git add public/i18n/us.json public/i18n/hu.json
git commit -m "#229: add copy for the unified import grid and fix category path remapping wording"
```

---

### Task 5: Grow the modal to `xl`

**Files:**

- Modify: `packages/app/src/app/services/ui-command-handler.service.ts:431-440`
- Test: `packages/app/src/app/services/ui-command-handler.service.spec.ts`

**Interfaces:**

- None (leaf change - only the `NgbModalOptions` passed to `modalService.open(ImportTorrents, ...)`).

- [ ] **Step 1: Write the failing test**

In `packages/app/src/app/services/ui-command-handler.service.spec.ts`, add a new test near the other modal-open tests (e.g. after the `UI_ADD_TORRENT` test around line 213):

```ts
it('should open ImportTorrents modal at xl size for UI_IMPORT_TORRENTS', async () => {
  commands$.next({ type: 'UI_IMPORT_TORRENTS' });
  await flushPromises();
  expect(mockModalService.open).toHaveBeenCalledWith(
    expect.anything(),
    expect.objectContaining({ size: 'xl', scrollable: true }),
  );
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run test --workspace=@bitbutler/app`
Expected: FAIL - `mockModalService.open` was called with `{ size: 'lg', scrollable: true }`, not `size: 'xl'`.

- [ ] **Step 3: Update the modal options**

In `packages/app/src/app/services/ui-command-handler.service.ts`, change the `UI_IMPORT_TORRENTS` case (currently around lines 431-440):

```ts
          case 'UI_IMPORT_TORRENTS': {
            const { ImportTorrents } = await import('../modals/import-torrents/import-torrents');
            if (this.isModalOpen(ImportTorrents)) break;
            const importRef = this.modalService.open(ImportTorrents, {
              size: 'xl',
              scrollable: true,
            });
            if (command.bbePath) {
              setModalInput(importRef, 'initialBbePath', command.bbePath);
```

(only the `size: 'lg'` → `size: 'xl'` line changes; everything else in the case stays as-is)

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm run test --workspace=@bitbutler/app`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/app/src/app/services/ui-command-handler.service.ts packages/app/src/app/services/ui-command-handler.service.spec.ts
git commit -m "#229: open Import Torrents modal at xl size"
```

---

### Task 6: Full verification

**Files:** none (verification only).

- [ ] **Step 1: Lint**

Run: `npm run lint`
Expected: zero warnings/errors.

- [ ] **Step 2: Full test suites**

Run: `npm test`
Expected: all workspaces (`@bitbutler/app`, `@bitbutler/electron`) pass.

- [ ] **Step 3: Builds**

Run: `npm run build` and `npm run build:electron`
Expected: both succeed with no TypeScript errors.

- [ ] **Step 4: Format check**

Run: `npm run format`
Expected: no unexpected diffs beyond what was already committed (pre-commit hooks already ran Prettier on each commit, so this should be a no-op).
