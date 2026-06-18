# TorrentExists Modal Improvements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "Delete Torrent File" button to the TorrentExists modal and scroll the grid to the selected row when "Open Details" is clicked.

**Architecture:** A new `UI_SCROLL_TO_TORRENT` command is added to the command bus; the Grid component subscribes and calls `ensureIndexVisible`. The `TorrentExists` modal gains an `originalPath` input, reads `GeneralSettingsService` via `toSignal`, and conditionally shows a danger delete button. Both `add-torrent.ts` call sites forward `originalPath` to the modal.

**Tech Stack:** Angular 20 (signals, `toSignal`, `computed`), RxJS, AG Grid (`ensureIndexVisible`), ngx-bootstrap modals, `window.bitbutler.torrent.deleteFile` IPC

---

### Task 1: Add UI_SCROLL_TO_TORRENT command and handle it in the Grid

**Files:**

- Modify: `packages/app/src/app/models/command.model.ts`
- Modify: `packages/app/src/app/pages/main/grid/grid.ts`
- Modify: `packages/app/src/app/pages/main/grid/grid.spec.ts`

- [ ] **Step 1: Add the new command type**

In `packages/app/src/app/models/command.model.ts`, add to the `UiCommand` union (after `UI_IMPORT_TORRENTS`):

```ts
| { type: 'UI_SCROLL_TO_TORRENT'; hash: string }
```

- [ ] **Step 2: Expose the commands subject in the grid spec**

In `packages/app/src/app/pages/main/grid/grid.spec.ts`, add a module-level `Subject` variable and wire it in `beforeEach` so tests can push commands:

```ts
// Add at the top of the describe block (after the let declarations):
let commandsSubject: Subject<any>;
```

In `beforeEach`, replace the inline `CommandBusService` mock:

```ts
// Replace:
{
  provide: CommandBusService,
  useValue: { emit: vi.fn(), commands$: new Subject().asObservable() },
},
// With:
commandsSubject = new Subject<any>();
// ... then in providers:
{
  provide: CommandBusService,
  useValue: { emit: vi.fn(), commands$: commandsSubject.asObservable() },
},
```

- [ ] **Step 3: Write failing tests for grid scroll behaviour**

Add to `grid.spec.ts` (inside the `describe('Grid', ...)` block):

```ts
describe('UI_SCROLL_TO_TORRENT command', () => {
  it('should call ensureIndexVisible with middle alignment when a known hash is emitted', () => {
    const mockApi = {
      getRowNode: vi.fn().mockReturnValue({ rowIndex: 5 }),
      ensureIndexVisible: vi.fn(),
    };
    (component as any).api = mockApi;

    commandsSubject.next({ type: 'UI_SCROLL_TO_TORRENT', hash: 'abc123' });

    expect(mockApi.getRowNode).toHaveBeenCalledWith('abc123');
    expect(mockApi.ensureIndexVisible).toHaveBeenCalledWith(5, 'middle');
  });

  it('should not call ensureIndexVisible when the row node is not found', () => {
    const mockApi = {
      getRowNode: vi.fn().mockReturnValue(null),
      ensureIndexVisible: vi.fn(),
    };
    (component as any).api = mockApi;

    commandsSubject.next({ type: 'UI_SCROLL_TO_TORRENT', hash: 'unknown' });

    expect(mockApi.ensureIndexVisible).not.toHaveBeenCalled();
  });

  it('should not react to unrelated commands', () => {
    const mockApi = {
      getRowNode: vi.fn(),
      ensureIndexVisible: vi.fn(),
    };
    (component as any).api = mockApi;

    commandsSubject.next({ type: 'UI_OPEN_TORRENT_DETAILS', hash: 'abc123' });

    expect(mockApi.getRowNode).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 4: Run the new tests to confirm they fail**

```bash
npm test -- --project=app --reporter=verbose 2>&1 | grep -A3 "UI_SCROLL_TO_TORRENT"
```

Expected: 3 failures — `ensureIndexVisible` is not wired yet.

- [ ] **Step 5: Implement the scroll subscription in grid.ts**

In `packages/app/src/app/pages/main/grid/grid.ts`:

Add `filter` to the existing rxjs import:

```ts
import { Subject, filter, firstValueFrom, skip, throttleTime } from 'rxjs';
```

In the constructor, after the two `toObservable(...)` subscription blocks, add:

```ts
this.commandBusService.commands$
  .pipe(
    filter(
      (cmd): cmd is { type: 'UI_SCROLL_TO_TORRENT'; hash: string } =>
        cmd.type === 'UI_SCROLL_TO_TORRENT',
    ),
    takeUntilDestroyed(this.destroyRef),
  )
  .subscribe(({ hash }) => {
    const rowNode = this.api?.getRowNode(hash);
    if (rowNode?.rowIndex != null) {
      this.api!.ensureIndexVisible(rowNode.rowIndex, 'middle');
    }
  });
```

- [ ] **Step 6: Run tests and confirm all pass**

```bash
npm test -- --project=app --reporter=verbose 2>&1 | grep -E "(PASS|FAIL|UI_SCROLL)"
```

Expected: 3 new tests pass, all existing grid tests still pass.

- [ ] **Step 7: Commit**

```bash
git add packages/app/src/app/models/command.model.ts packages/app/src/app/pages/main/grid/grid.ts packages/app/src/app/pages/main/grid/grid.spec.ts
git commit -m "#169: Add UI_SCROLL_TO_TORRENT command and wire grid scroll"
```

---

### Task 2: Add originalPath input, settings, and delete behavior to TorrentExists

**Files:**

- Modify: `packages/app/src/app/components/modals/torrent-exists/torrent-exists.ts`
- Modify: `packages/app/src/app/components/modals/torrent-exists/torrent-exists.spec.ts`

- [ ] **Step 1: Write failing tests**

In `packages/app/src/app/components/modals/torrent-exists/torrent-exists.spec.ts`:

Add imports at the top:

```ts
import { of } from 'rxjs';
import { DEFAULT_GENERAL_SETTINGS } from '../../../models/general-settings.model';
import { GeneralSettingsService } from '../../../services/general-settings.service';
```

Add `GeneralSettingsService` to the `beforeEach` providers (with `deleteTorrentFile: true` so the delete button is on by default in tests):

```ts
{
  provide: GeneralSettingsService,
  useValue: {
    asObservable: vi.fn().mockReturnValue(
      of({
        ...DEFAULT_GENERAL_SETTINGS,
        behavior: { ...DEFAULT_GENERAL_SETTINGS.behavior, deleteTorrentFile: true },
      }),
    ),
  },
},
```

Add these test groups inside the main `describe` block:

```ts
it('should expose originalPath as a signal input defaulting to null', () => {
  expect(component.originalPath()).toBeNull();
});

describe('showDeleteButton', () => {
  it('should be false when originalPath is null', () => {
    expect(component.showDeleteButton()).toBe(false);
  });

  it('should be true when originalPath is set and deleteTorrentFile setting is enabled', () => {
    fixture.componentRef.setInput('originalPath', '/tmp/test.torrent');
    fixture.detectChanges();
    expect(component.showDeleteButton()).toBe(true);
  });
});

describe('deleteTorrentFile', () => {
  it('should call deleteFile IPC with the originalPath and close the modal', async () => {
    const deleteFileSpy = vi
      .spyOn(window.bitbutler.torrent, 'deleteFile')
      .mockResolvedValue({ ok: true });
    fixture.componentRef.setInput('originalPath', '/tmp/test.torrent');
    fixture.detectChanges();

    await component.deleteTorrentFile();

    expect(deleteFileSpy).toHaveBeenCalledWith({ path: '/tmp/test.torrent' });
    expect(mockActiveModal.close).toHaveBeenCalled();
  });

  it('should not call deleteFile when originalPath is null', async () => {
    const deleteFileSpy = vi.spyOn(window.bitbutler.torrent, 'deleteFile');
    await component.deleteTorrentFile();
    expect(deleteFileSpy).not.toHaveBeenCalled();
  });
});

describe('openDetails', () => {
  it('should emit UI_SCROLL_TO_TORRENT before UI_OPEN_TORRENT_DETAILS', () => {
    const mockCommandBus = TestBed.inject(CommandBusService) as any;
    fixture.componentRef.setInput('hash', 'abc123');
    fixture.detectChanges();

    component.openDetails();

    expect(mockCommandBus.emit.mock.calls[0][0]).toEqual({
      type: 'UI_SCROLL_TO_TORRENT',
      hash: 'abc123',
    });
    expect(mockCommandBus.emit.mock.calls[1][0]).toEqual({
      type: 'UI_OPEN_TORRENT_DETAILS',
      hash: 'abc123',
    });
  });
});
```

- [ ] **Step 2: Run the new tests to confirm they fail**

```bash
npm test -- --project=app --reporter=verbose 2>&1 | grep -A3 "showDeleteButton\|deleteTorrentFile\|SCROLL_TO_TORRENT"
```

Expected: failures — `originalPath`, `showDeleteButton`, `deleteTorrentFile` not yet defined.

- [ ] **Step 3: Implement in torrent-exists.ts**

Replace the full import block and class body in `packages/app/src/app/components/modals/torrent-exists/torrent-exists.ts`:

Add to the Angular core import:

```ts
import { ChangeDetectionStrategy, Component, computed, effect, inject, input } from '@angular/core';
```

Add new import:

```ts
import { toSignal } from '@angular/core/rxjs-interop';
```

Add import for `GeneralSettingsService`:

```ts
import { GeneralSettingsService } from '../../../services/general-settings.service';
```

Add these members to the class (after the existing `hash` input and before `torrent`):

```ts
readonly originalPath = input<string | null>(null);

private readonly generalSettingsService = inject(GeneralSettingsService);
private readonly generalSettings = toSignal(this.generalSettingsService.asObservable(), {
  initialValue: null,
});

public readonly showDeleteButton = computed(
  () => !!(this.generalSettings()?.behavior.deleteTorrentFile && this.originalPath()),
);
```

Add the `deleteTorrentFile()` method:

```ts
public async deleteTorrentFile(): Promise<void> {
  const path = this.originalPath();
  if (!path) return;
  await window.bitbutler.torrent.deleteFile({ path });
  this.closeModal();
}
```

Update `openDetails()` to emit the scroll command first:

```ts
public openDetails(): void {
  const h = this.hash();
  if (h) {
    this.commandBusService.emit({ type: 'UI_SCROLL_TO_TORRENT', hash: h });
    this.commandBusService.emit({ type: 'UI_OPEN_TORRENT_DETAILS', hash: h });
  }
  this.closeModal();
}
```

- [ ] **Step 4: Run tests and confirm all pass**

```bash
npm test -- --project=app --reporter=verbose 2>&1 | grep -E "(PASS|FAIL|torrent-exists)"
```

Expected: all new tests pass, existing tests pass.

- [ ] **Step 5: Commit**

```bash
git add packages/app/src/app/components/modals/torrent-exists/torrent-exists.ts packages/app/src/app/components/modals/torrent-exists/torrent-exists.spec.ts
git commit -m "#169: Add originalPath input, delete behavior, and scroll emission to TorrentExists"
```

---

### Task 3: Add delete button to TorrentExists template and i18n keys

**Files:**

- Modify: `packages/app/src/app/components/modals/torrent-exists/torrent-exists.html`
- Modify: `public/i18n/us.json`
- Modify: `public/i18n/hu.json`

- [ ] **Step 1: Add the i18n key to us.json**

In `public/i18n/us.json`, inside the `components.modals.torrent-exists` object (after the `"label"` block, before the closing `}`):

```json
"button": {
  "delete-file": "Delete Torrent File"
}
```

The section should look like:

```json
"torrent-exists": {
  "title": "Torrent Exists",
  "already-in-list": "Torrent is already in the list!",
  "label": {
    ...
  },
  "button": {
    "delete-file": "Delete Torrent File"
  }
},
```

- [ ] **Step 2: Add the i18n key to hu.json**

In `public/i18n/hu.json`, same location in the `torrent-exists` block:

```json
"button": {
  "delete-file": "Torrent fájl törlése"
}
```

- [ ] **Step 3: Add delete button to the modal footer**

In `packages/app/src/app/components/modals/torrent-exists/torrent-exists.html`, replace the `<div class="modal-footer">` block:

```html
<div class="modal-footer">
  @if (showDeleteButton()) {
  <button type="button" class="btn btn-danger" (click)="deleteTorrentFile()">
    {{ 'components.modals.torrent-exists.button.delete-file' | translate }}
  </button>
  }
  <button type="button" class="btn btn-dashed-secondary" (click)="openDetails()" autofocus>
    {{ 'general.button.open-details' | translate }}
  </button>
  <button type="button" class="btn btn-link" (click)="closeModal()">
    {{ 'general.button.close' | translate }}
  </button>
</div>
```

- [ ] **Step 4: Run tests**

```bash
npm test -- --project=app --reporter=verbose 2>&1 | grep -E "(PASS|FAIL)"
```

Expected: all tests pass (template changes are not unit-tested but the component tests still compile).

- [ ] **Step 5: Commit**

```bash
git add packages/app/src/app/components/modals/torrent-exists/torrent-exists.html public/i18n/us.json public/i18n/hu.json
git commit -m "#169: Add delete torrent file button to TorrentExists modal"
```

---

### Task 4: Pass originalPath from add-torrent.ts to TorrentExists

**Files:**

- Modify: `packages/app/src/app/components/add-torrent/add-torrent.ts`
- Modify: `packages/app/src/app/components/add-torrent/add-torrent.spec.ts`

- [ ] **Step 1: Write failing tests**

In `packages/app/src/app/components/add-torrent/add-torrent.spec.ts`, find the describe block that tests the 409 conflict case (around line 630) and add:

```ts
it('should pass the draft originalPath to TorrentExists on a 409 conflict', async () => {
  vi.spyOn(window.bitbutler.qb, 'torrentsAdd')
    .mockClear()
    .mockRejectedValue(new Error('Request failed: 409 {"name":"QbHttpError","status":409}'));

  const setInputMock = vi.fn();
  const modalService = TestBed.inject(NgbModal) as any;
  modalService.open.mockReturnValue({
    _contentRef: { componentRef: { setInput: setInputMock } },
  });

  (component as any).selectedTorrentFile.set({
    name: 'test.torrent',
    path: '/tmp/test.torrent',
  });
  component.manualDraft.set({
    source: 'manual',
    receivedAt: Date.now(),
    originalPath: '/tmp/test.torrent',
    torrent: { name: 'test-torrent', totalSize: 100, infoHashV1: 'ABC123', files: [] },
  });
  component.addForm.controls.fileGroup.controls.rename.setValue('test-torrent');
  fixture.detectChanges();

  await component.handleSubmit({ preventDefault: () => {} } as unknown as SubmitEvent);

  expect(setInputMock).toHaveBeenCalledWith('originalPath', '/tmp/test.torrent');
});
```

Find the describe block that tests duplicate detection via `loadDraft` (around line 803) and add:

```ts
it('should pass the draft originalPath to TorrentExists when the torrent is already in the list', () => {
  const torrentStoreService = TestBed.inject(TorrentStoreService) as any;
  torrentStoreService.torrentsArray.set([{ hash: 'abc123' }]);

  const setInputMock = vi.fn();
  const modalService = TestBed.inject(NgbModal) as any;
  modalService.open.mockReturnValue({
    _contentRef: { componentRef: { setInput: setInputMock } },
  });

  const draft: TorrentDraft = {
    source: 'manual',
    receivedAt: Date.now(),
    originalPath: '/tmp/movie.torrent',
    torrent: { name: 'Movie', totalSize: 100, infoHashV1: 'abc123', files: [] },
  };

  mockOpenFilesService.pendingDrafts.set([
    { draft, selected: { name: 'movie.torrent', path: '/tmp/movie.torrent' } },
  ]);
  fixture.detectChanges();

  expect(setInputMock).toHaveBeenCalledWith('originalPath', '/tmp/movie.torrent');
});
```

- [ ] **Step 2: Run the new tests to confirm they fail**

```bash
npm test -- --project=app --reporter=verbose 2>&1 | grep -A3 "originalPath to TorrentExists"
```

Expected: 2 failures.

- [ ] **Step 3: Pass originalPath at both call sites in add-torrent.ts**

In `packages/app/src/app/components/add-torrent/add-torrent.ts`:

**Call site 1** — inside `loadDraft()`, the block that opens TorrentExists on duplicate detection (around line 492). After `setModalInput(modalRef, 'hash', draft.torrent?.infoHashV1?.toLowerCase() ?? null)`, add one line:

```ts
setModalInput(modalRef, 'originalPath', draft.originalPath ?? null);
```

**Call site 2** — inside `handleSubmit()` 409 error handler (around line 374). After `setModalInput(modalRef, 'hash', hash)`, add one line:

```ts
setModalInput(modalRef, 'originalPath', this.effectiveDraft()?.originalPath ?? null);
```

- [ ] **Step 4: Run tests and confirm all pass**

```bash
npm test -- --project=app --reporter=verbose 2>&1 | grep -E "(PASS|FAIL)"
```

Expected: all tests pass.

- [ ] **Step 5: Run lint**

```bash
npm run lint
```

Expected: no errors or warnings.

- [ ] **Step 6: Commit**

```bash
git add packages/app/src/app/components/add-torrent/add-torrent.ts packages/app/src/app/components/add-torrent/add-torrent.spec.ts
git commit -m "#169: Pass originalPath to TorrentExists from both add-torrent call sites"
```
