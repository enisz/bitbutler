# Folder Submit Error Surfacing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** When adding torrents from a folder, surface per-entry submission failures in the folder-picker grid (red row + tooltip, matching the main torrent grid's error styling) instead of silently swallowing them, and remove successfully-added rows from view so the grid narrows to just what still needs attention.

**Architecture:** `ScannedTorrentState` gains two values, `'added'` and `'failed'`. `AddTorrentFolderPicker` gains `markAdded`/`markFailed` methods (mirroring the existing `renameEntry`) that mutate its `rows` signal; the grid binds to a new `visibleRows` computed that filters out `'added'` rows. `AddTorrentGeneral` exposes two thin passthrough methods to the folder picker. `AddTorrent.handleSubmit`'s per-entry folder submission loop calls these on success/failure instead of only `console.error`-ing.

**Tech Stack:** Angular 20 (signals), ag-grid-angular, Vitest (via `@angular/build:unit-test`).

## Global Constraints

- Toast title = short Title-Case outcome description; toast message = the variable detail only. (Not touched by this plan - the existing `folder-partial`/`folder-added` toasts are unchanged.)
- Use `-` (hyphen), never `—` (em dash), in all written output including code comments and commit messages.
- Commit format: `#235: short description`.
- `npm run lint` must pass with zero warnings before considering a task done.

---

## Task 1: `ScannedTorrentState` model + `AddTorrentFolderPicker` added/failed handling

**Files:**

- Modify: `packages/app/src/app/models/add-torrent-folder.model.ts`
- Modify: `packages/app/src/app/modals/add-torrent/general/folder-picker/folder-picker.ts`
- Modify: `packages/app/src/app/modals/add-torrent/general/folder-picker/folder-picker.html`
- Modify: `public/i18n/us.json`
- Modify: `public/i18n/hu.json`
- Test: `packages/app/src/app/modals/add-torrent/general/folder-picker/folder-picker.spec.ts`

**Interfaces:**

- Produces: `AddTorrentFolderPicker.markAdded(path: string): void`, `AddTorrentFolderPicker.markFailed(path: string, error: string): void`, `AddTorrentFolderPicker.visibleRows: Signal<ScannedTorrentEntry[]>`. Task 2 and Task 3 consume `markAdded`/`markFailed` by name.

- [ ] **Step 1: Add `'added' | 'failed'` to `ScannedTorrentState`**

Edit `packages/app/src/app/models/add-torrent-folder.model.ts` line 1:

```ts
export type ScannedTorrentState = 'new' | 'exists' | 'error' | 'added' | 'failed';
```

- [ ] **Step 2: Write the failing tests for `markAdded` / `markFailed` / `visibleRows`**

Add to `packages/app/src/app/modals/add-torrent/general/folder-picker/folder-picker.spec.ts`, after the existing `renameEntry` test (currently ends around line 259):

```ts
it('markAdded moves the entry out of visibleRows but keeps it cached as added', async () => {
  vi.spyOn(window.bitbutler.torrent, 'scanFolder').mockResolvedValue([
    { path: '/downloads/a.torrent', relativePath: 'a.torrent' },
  ]);
  vi.spyOn(window.bitbutler.torrent, 'parse').mockResolvedValue(draft());

  init('/downloads');
  await fixture.whenStable();

  component.markAdded('/downloads/a.torrent');

  expect(component.visibleRows()).toEqual([]);
  expect(component.rows()).toEqual([
    expect.objectContaining({ path: '/downloads/a.torrent', state: 'added' }),
  ]);
});

it('markFailed sets state failed with the error message and keeps the row visible', async () => {
  vi.spyOn(window.bitbutler.torrent, 'scanFolder').mockResolvedValue([
    { path: '/downloads/a.torrent', relativePath: 'a.torrent' },
  ]);
  vi.spyOn(window.bitbutler.torrent, 'parse').mockResolvedValue(draft());

  init('/downloads');
  await fixture.whenStable();

  component.markFailed('/downloads/a.torrent', 'HTTP 500');

  expect(component.visibleRows()).toEqual([
    expect.objectContaining({
      path: '/downloads/a.torrent',
      state: 'failed',
      errorMessage: 'HTTP 500',
    }),
  ]);
});

it('a second scan reuses the cached added/failed state for an unchanged path', async () => {
  vi.spyOn(window.bitbutler.torrent, 'scanFolder').mockResolvedValue([
    { path: '/downloads/a.torrent', relativePath: 'a.torrent' },
  ]);
  vi.spyOn(window.bitbutler.torrent, 'parse').mockResolvedValue(draft());

  init('/downloads');
  await fixture.whenStable();

  component.markFailed('/downloads/a.torrent', 'HTTP 500');
  await component.refresh();

  expect(component.rows()[0]).toEqual(
    expect.objectContaining({ state: 'failed', errorMessage: 'HTTP 500' }),
  );
});
```

Also update the existing `describe('grid wiring', ...)` tests to match the new selectability/styling rules. Replace the existing `'marks only new-state rows as selectable via rowSelection.isRowSelectable'` test (currently around line 356):

```ts
it('marks new-state and failed-state rows as selectable via rowSelection.isRowSelectable', () => {
  init('/downloads');
  const isRowSelectable = (component.gridOptions.rowSelection as any).isRowSelectable!;

  expect(isRowSelectable({ data: { state: 'new' } } as any)).toBe(true);
  expect(isRowSelectable({ data: { state: 'failed' } } as any)).toBe(true);
  expect(isRowSelectable({ data: { state: 'exists' } } as any)).toBe(false);
  expect(isRowSelectable({ data: { state: 'error' } } as any)).toBe(false);
  expect(isRowSelectable({ data: { state: 'added' } } as any)).toBe(false);
});
```

Replace the existing `'applies the muted row class to non-selectable rows only'` test (currently around line 365):

```ts
it('applies the muted row class to exists-state rows only', () => {
  init('/downloads');
  const isMuted = component.gridOptions.rowClassRules![GRID_ROW_MUTED_CLASS] as (
    params: any,
  ) => boolean;

  expect(isMuted({ data: { state: 'new' } } as any)).toBe(false);
  expect(isMuted({ data: { state: 'exists' } } as any)).toBe(true);
  expect(isMuted({ data: { state: 'error' } } as any)).toBe(false);
  expect(isMuted({ data: { state: 'failed' } } as any)).toBe(false);
});

it('applies the danger row class to error-state and failed-state rows', () => {
  init('/downloads');
  const isDanger = component.gridOptions.rowClassRules!['text-danger bg-danger-subtle'] as (
    params: any,
  ) => boolean;

  expect(isDanger({ data: { state: 'new' } } as any)).toBe(false);
  expect(isDanger({ data: { state: 'exists' } } as any)).toBe(false);
  expect(isDanger({ data: { state: 'error' } } as any)).toBe(true);
  expect(isDanger({ data: { state: 'failed' } } as any)).toBe(true);
});
```

Replace the existing `'onRowDataUpdated selects only new-state rows via the grid API'` test (currently around line 386):

```ts
it('onRowDataUpdated selects new-state and failed-state rows via the grid API', () => {
  init('/downloads');
  const rows = [
    { path: '/downloads/a.torrent', state: 'new' },
    { path: '/downloads/b.torrent', state: 'exists' },
    { path: '/downloads/c.torrent', state: 'failed' },
  ];
  const api = makeApiWithRows(rows);

  component.gridOptions.onRowDataUpdated!({ api } as unknown as RowDataUpdatedEvent<any>);

  expect(api.getSelectedRows()).toEqual([rows[0], rows[2]]);
});
```

Add a test for the state column filter excluding `'added'` rows, inside the same `describe('grid wiring', ...)` block:

```ts
it('excludes added-state rows from the state column filter items', async () => {
  vi.spyOn(window.bitbutler.torrent, 'scanFolder').mockResolvedValue([
    { path: '/downloads/a.torrent', relativePath: 'a.torrent' },
  ]);
  vi.spyOn(window.bitbutler.torrent, 'parse').mockResolvedValue(draft());

  init('/downloads');
  await fixture.whenStable();

  component.markAdded('/downloads/a.torrent');

  const stateColumn = component.colDefs.find((c) => c.colId === 'state')!;
  const items = (stateColumn.filterParams as any).getItems();

  expect(items).toEqual([]);
});
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `npm run test --workspace=@bitbutler/app -- --watch=false`
Expected: FAIL - `component.markAdded is not a function`, `component.markFailed is not a function`, `component.visibleRows is not a function`, and the updated `isRowSelectable`/row-class/`onRowDataUpdated` assertions fail against current behavior.

- [ ] **Step 4: Add `visibleRows`, `markAdded`, `markFailed` to the component**

Edit `packages/app/src/app/modals/add-torrent/general/folder-picker/folder-picker.ts`. Add the computed right after the `rows` signal declaration (currently line 111):

```ts
  public readonly rows = signal<ScannedTorrentEntry[]>([]);
  public readonly visibleRows = computed(() => this.rows().filter((r) => r.state !== 'added'));
```

Add the two methods right after `renameEntry` (currently ends at line 205):

```ts
  public markAdded(path: string): void {
    const cached = this.cache.get(path);
    if (cached) cached.state = 'added';
    this.rows.update((rows) => rows.map((r) => (r.path === path ? { ...r, state: 'added' } : r)));
  }

  public markFailed(path: string, error: string): void {
    const cached = this.cache.get(path);
    if (cached) {
      cached.state = 'failed';
      cached.errorMessage = error;
    }
    this.rows.update((rows) =>
      rows.map((r) => (r.path === path ? { ...r, state: 'failed', errorMessage: error } : r)),
    );
  }
```

- [ ] **Step 5: Update `gridOptions` selectability, row classes, and auto-select**

In the same file, replace the `isRowSelectable` line inside `gridOptions.rowSelection` (currently line 285):

```ts
      isRowSelectable: (node) => node.data?.state === 'new' || node.data?.state === 'failed',
```

Replace the `rowClassRules` block (currently lines 288-291):

```ts
    rowClassRules: {
      [GRID_ROW_MUTED_CLASS]: (params: RowClassParams<ScannedTorrentEntry>): boolean =>
        params.data?.state === 'exists',
      'text-danger bg-danger-subtle': (params: RowClassParams<ScannedTorrentEntry>): boolean =>
        params.data?.state === 'error' || params.data?.state === 'failed',
    },
```

Replace the `onRowDataUpdated` handler (currently lines 307-309):

```ts
    onRowDataUpdated: (e: RowDataUpdatedEvent<ScannedTorrentEntry>) => {
      e.api.forEachNode((node) =>
        node.setSelected(node.data?.state === 'new' || node.data?.state === 'failed'),
      );
    },
```

- [ ] **Step 6: Point the state-column filter at `visibleRows`**

In the same file, in `getColDefs()`, replace the `stateItems` computed (currently lines 348-350):

```ts
const stateItems = computed(() =>
  buildValueCounts(this.visibleRows(), (r) => this.stateLabel(r.state)),
);
```

- [ ] **Step 7: Bind the grid to `visibleRows` instead of `rows`**

Edit `packages/app/src/app/modals/add-torrent/general/folder-picker/folder-picker.html`, the `[rowData]` binding on the `ag-grid-angular` element (currently line 68):

```html
[rowData]="visibleRows()"
```

- [ ] **Step 8: Add the new state labels to both locale files**

Edit `public/i18n/us.json`, inside `components.add-torrent.folder-picker.state` (currently `"new"`, `"exists"`, `"error"`):

```json
        "state": {
          "new": "New",
          "exists": "Exists",
          "error": "Error",
          "added": "Added",
          "failed": "Failed"
        },
```

Edit `public/i18n/hu.json`, same block:

```json
        "state": {
          "new": "Új",
          "exists": "Létezik",
          "error": "Hiba",
          "added": "Hozzáadva",
          "failed": "Sikertelen"
        },
```

- [ ] **Step 9: Run the tests to verify they pass**

Run: `npm run test --workspace=@bitbutler/app -- --watch=false`
Expected: PASS - all `folder-picker.spec.ts` tests green, including the new/updated ones from Step 2.

- [ ] **Step 10: Lint and commit**

Run: `npm run lint`
Expected: no warnings or errors.

```bash
git add packages/app/src/app/models/add-torrent-folder.model.ts packages/app/src/app/modals/add-torrent/general/folder-picker/folder-picker.ts packages/app/src/app/modals/add-torrent/general/folder-picker/folder-picker.html packages/app/src/app/modals/add-torrent/general/folder-picker/folder-picker.spec.ts public/i18n/us.json public/i18n/hu.json
git commit -m "#235: track added/failed state in the folder picker grid"
```

---

## Task 2: `AddTorrentGeneral` passthrough methods

**Files:**

- Modify: `packages/app/src/app/modals/add-torrent/general/general.ts`
- Test: `packages/app/src/app/modals/add-torrent/general/general.spec.ts`

**Interfaces:**

- Consumes: `AddTorrentFolderPicker.markAdded(path: string): void`, `AddTorrentFolderPicker.markFailed(path: string, error: string): void` (Task 1).
- Produces: `AddTorrentGeneral.markFolderEntryAdded(path: string): void`, `AddTorrentGeneral.markFolderEntryFailed(path: string, error: string): void`. Task 3 consumes these by name.

- [ ] **Step 1: Write the failing tests**

Add to `packages/app/src/app/modals/add-torrent/general/general.spec.ts`, inside the existing `describe('getSelectedFolderEntries', ...)` block's parent scope, right after that `describe` closes (currently around line 273):

```ts
describe('markFolderEntryAdded / markFolderEntryFailed', () => {
  it('should do nothing when the folder picker has not rendered yet', () => {
    expect(() => component.markFolderEntryAdded('/downloads/a.torrent')).not.toThrow();
    expect(() => component.markFolderEntryFailed('/downloads/a.torrent', 'oops')).not.toThrow();
  });

  it('should delegate to the folder picker once in folder mode', () => {
    fixture.componentRef.setInput('inputMode', 'folder');
    fixture.detectChanges();

    const markAdded = vi.fn();
    const markFailed = vi.fn();
    (component['folderPicker']() as any).markAdded = markAdded;
    (component['folderPicker']() as any).markFailed = markFailed;

    component.markFolderEntryAdded('/downloads/a.torrent');
    component.markFolderEntryFailed('/downloads/b.torrent', 'network error');

    expect(markAdded).toHaveBeenCalledWith('/downloads/a.torrent');
    expect(markFailed).toHaveBeenCalledWith('/downloads/b.torrent', 'network error');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run test --workspace=@bitbutler/app -- --watch=false`
Expected: FAIL - `component.markFolderEntryAdded is not a function`.

- [ ] **Step 3: Add the passthrough methods**

Edit `packages/app/src/app/modals/add-torrent/general/general.ts`, right after `getSelectedFolderEntries` (currently ends at line 80):

```ts
  public markFolderEntryAdded(path: string): void {
    this.folderPicker()?.markAdded(path);
  }

  public markFolderEntryFailed(path: string, error: string): void {
    this.folderPicker()?.markFailed(path, error);
  }
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm run test --workspace=@bitbutler/app -- --watch=false`
Expected: PASS.

- [ ] **Step 5: Lint and commit**

Run: `npm run lint`
Expected: no warnings or errors.

```bash
git add packages/app/src/app/modals/add-torrent/general/general.ts packages/app/src/app/modals/add-torrent/general/general.spec.ts
git commit -m "#235: expose folder entry added/failed passthrough on AddTorrentGeneral"
```

---

## Task 3: Wire submission results into `AddTorrent.handleSubmit`

**Files:**

- Modify: `packages/app/src/app/modals/add-torrent/add-torrent.ts`
- Test: `packages/app/src/app/modals/add-torrent/add-torrent.spec.ts`

**Interfaces:**

- Consumes: `AddTorrentGeneral.markFolderEntryAdded(path: string): void`, `AddTorrentGeneral.markFolderEntryFailed(path: string, error: string): void` (Task 2).

- [ ] **Step 1: Update the `stubSelectedFolderEntries` test helper to stub the new methods**

Edit `packages/app/src/app/modals/add-torrent/add-torrent.spec.ts`, replace `stubSelectedFolderEntries` (currently lines 973-978):

```ts
function stubSelectedFolderEntries(entries: any[]) {
  const markFolderEntryAdded = vi.fn();
  const markFolderEntryFailed = vi.fn();
  (component as any).generalTab = () => ({
    ensureCategoryExists: () => Promise.resolve(true),
    getSelectedFolderEntries: () => entries,
    markFolderEntryAdded,
    markFolderEntryFailed,
  });
  return { markFolderEntryAdded, markFolderEntryFailed };
}
```

This is a compatible change: existing call sites that ignore the return value keep working unchanged.

- [ ] **Step 2: Write the failing tests**

Add to the `describe('folder mode', ...)` block, right after the existing `'handleSubmit should show a partial-failure toast and keep the modal open when a row fails'` test (currently ends around line 1071):

```ts
it('handleSubmit should mark each selected row as added on success', async () => {
  vi.spyOn(window.bitbutler.qb, 'torrentsAdd').mockClear().mockResolvedValue(undefined);

  component.switchInputMode('folder' as any);
  (component.addForm as any).controls.folderGroup.controls.folder.setValue('/downloads');
  const { markFolderEntryAdded } = stubSelectedFolderEntries([
    { path: '/downloads/a.torrent', name: 'A' },
    { path: '/downloads/b.torrent', name: 'B' },
  ]);

  await component.handleSubmit({ preventDefault: () => {} } as unknown as SubmitEvent);

  expect(markFolderEntryAdded).toHaveBeenCalledWith('/downloads/a.torrent');
  expect(markFolderEntryAdded).toHaveBeenCalledWith('/downloads/b.torrent');
});

it('handleSubmit should mark a failed row with its error message and leave the succeeded row untouched', async () => {
  vi.spyOn(window.bitbutler.qb, 'torrentsAdd')
    .mockClear()
    .mockResolvedValueOnce(undefined)
    .mockRejectedValueOnce(new Error('network error'));
  vi.spyOn(console, 'error').mockImplementation(() => {});

  component.switchInputMode('folder' as any);
  (component.addForm as any).controls.folderGroup.controls.folder.setValue('/downloads');
  const { markFolderEntryAdded, markFolderEntryFailed } = stubSelectedFolderEntries([
    { path: '/downloads/a.torrent', name: 'A' },
    { path: '/downloads/b.torrent', name: 'B' },
  ]);

  await component.handleSubmit({ preventDefault: () => {} } as unknown as SubmitEvent);

  expect(markFolderEntryAdded).toHaveBeenCalledWith('/downloads/a.torrent');
  expect(markFolderEntryAdded).not.toHaveBeenCalledWith('/downloads/b.torrent');
  expect(markFolderEntryFailed).toHaveBeenCalledWith('/downloads/b.torrent', 'network error');
});
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `npm run test --workspace=@bitbutler/app -- --watch=false`
Expected: FAIL - `markFolderEntryAdded`/`markFolderEntryFailed` are never called (current code only `console.error`s on failure and does nothing extra on success).

- [ ] **Step 4: Wire the calls into the submission loop**

Edit `packages/app/src/app/modals/add-torrent/add-torrent.ts`, the folder branch's `for (const entry of entries)` loop (currently lines 358-378):

```ts
for (const entry of entries) {
  try {
    await window.bitbutler.qb.torrentsAdd({
      id: serverId,
      torrents: [{ name: entry.name, path: entry.path }],
      options: { ...sharedOptions, rename: entry.name },
    });
    succeeded++;
    this.generalTab()?.markFolderEntryAdded(entry.path);
    if (generalSettings.behavior.deleteTorrentFile) {
      await window.bitbutler.torrent.deleteFile({ path: entry.path });
    }
  } catch (e) {
    console.error(AddTorrent.name, 'handleSubmit', 'folder torrent add failed', entry.path, e);
    this.generalTab()?.markFolderEntryFailed(entry.path, String((e as Error)?.message ?? e));
  }
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npm run test --workspace=@bitbutler/app -- --watch=false`
Expected: PASS - full `add-torrent.spec.ts` and `folder-picker.spec.ts` suites green.

- [ ] **Step 6: Lint and commit**

Run: `npm run lint`
Expected: no warnings or errors.

```bash
git add packages/app/src/app/modals/add-torrent/add-torrent.ts packages/app/src/app/modals/add-torrent/add-torrent.spec.ts
git commit -m "#235: surface per-entry folder-add failures in the picker grid"
```

---

## Final verification

- [ ] Run the full app test suite once more: `npm run test --workspace=@bitbutler/app -- --watch=false` - expect all green.
- [ ] Run `npm run lint` from the repo root - expect zero warnings.
- [ ] Manually verify in the running app (`npm start`): select a folder with a mix of files, force one `torrentsAdd` call to fail (e.g. temporarily disconnect the server mid-submit, or point at an invalid save path), and confirm: successful rows disappear from the grid, the failed row turns red and its tooltip shows the real error message, and it stays checked so clicking Add again retries only that row.
