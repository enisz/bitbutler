# Torrent Details Delete Race Condition Fix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the torrent details modal's delete button always target the torrent the modal is showing (not whatever happens to be selected in the main grid), and stop the spurious error toast that fires when the modal's still-mounted tabs poll for the just-deleted torrent during the close animation.

**Architecture:** Add an optional `hashes?: string[]` override to the existing `UI_TORRENT_DELETE_REQUEST` / `TORRENT_DELETE_CONFIRM` commands (mirroring the override pattern already used by `UI_SET_TORRENT_LOCATION`, `UI_LIMIT_TRANSFER`, etc.), thread it through the `DeleteTorrent` confirm modal and `TorrentCommandHandlerService.handleDelete()`, and have `General.deleteTorrent()` pass its own hash. Separately, when `TorrentDetails` observes `TORRENT_DELETED` for its hash, clear `loadedComponents` before closing the modal so all 4 tab components (and their polling subscriptions) are destroyed immediately instead of waiting for the modal's fade-out animation.

**Tech Stack:** Angular 20 (zoneless, signals), RxJS, Vitest (`vi.fn()`), ng-bootstrap modals.

## Global Constraints

- Commit message format: `#184: short description` (this branch is for issue #184).
- Use `-` (hyphen) instead of `—` (em dash) in all written output, including commit messages.
- `npm run lint` must pass with zero warnings (`max-warnings=0`) before this is done.
- Every existing test must keep passing - this is an additive, backward-compatible change (the `hashes` override is optional everywhere; callers that don't pass it get exactly today's behavior).

---

### Task 1: Add `hashes` override to the delete request/confirm commands and wire it through `ui-command-handler.service.ts`

**Files:**

- Modify: `packages/app/src/app/models/command.model.ts:11` and `:42`
- Modify: `packages/app/src/app/services/ui-command-handler.service.ts:73-85`
- Test: `packages/app/src/app/services/ui-command-handler.service.spec.ts`

**Interfaces:**

- Produces: `UiCommand` variant `{ type: 'UI_TORRENT_DELETE_REQUEST'; defaultRemoveFiles?: boolean; hashes?: string[] }` and `TorrentCommand` variant `{ type: 'TORRENT_DELETE_CONFIRM'; removeFiles: boolean; hashes?: string[] }`, both consumed by Task 2 (`DeleteTorrent`) and Task 3 (`TorrentCommandHandlerService`).

- [ ] **Step 1: Update the command types**

In `packages/app/src/app/models/command.model.ts`, change line 11 from:

```ts
  | { type: 'UI_TORRENT_DELETE_REQUEST'; defaultRemoveFiles?: boolean }
```

to:

```ts
  | { type: 'UI_TORRENT_DELETE_REQUEST'; defaultRemoveFiles?: boolean; hashes?: string[] }
```

And change line 42 from:

```ts
  | { type: 'TORRENT_DELETE_CONFIRM'; removeFiles: boolean }
```

to:

```ts
  | { type: 'TORRENT_DELETE_CONFIRM'; removeFiles: boolean; hashes?: string[] }
```

- [ ] **Step 2: Write the failing tests**

Open `packages/app/src/app/services/ui-command-handler.service.spec.ts`. Add a `flushPromises` helper right after the imports (before the `describe` block):

```ts
const flushPromises = () => new Promise<void>((resolve) => setTimeout(resolve));
```

Change the `selectionStore` mock in `beforeEach` from:

```ts
selectionStore = {
  selected: signal([{ hash: 'abc' }]),
};
```

to:

```ts
selectionStore = {
  selected: signal([{ hash: 'abc' }]),
  selectedHashes: signal(['abc']),
};
```

Replace the existing test:

```ts
it('should not open DeleteTorrent modal when selection is empty', () => {
  selectionStore.selected.set([]);
  commands$.next({ type: 'UI_TORRENT_DELETE_REQUEST', defaultRemoveFiles: false });
  expect(mockModalService.open).not.toHaveBeenCalled();
});
```

with:

```ts
it('should not open DeleteTorrent modal when selection is empty and no hashes override is given', () => {
  selectionStore.selectedHashes.set([]);
  commands$.next({ type: 'UI_TORRENT_DELETE_REQUEST', defaultRemoveFiles: false });
  expect(mockModalService.open).not.toHaveBeenCalled();
});

it('should open DeleteTorrent modal when hashes are provided even if selection is empty', () => {
  selectionStore.selectedHashes.set([]);
  commands$.next({ type: 'UI_TORRENT_DELETE_REQUEST', hashes: ['xyz'] });
  expect(mockModalService.open).toHaveBeenCalled();
});

it('should forward the hashes override into the emitted TORRENT_DELETE_CONFIRM command', async () => {
  mockModalService.open.mockReturnValueOnce({
    componentInstance: {},
    result: Promise.resolve({ removeFiles: true }),
  });

  commands$.next({ type: 'UI_TORRENT_DELETE_REQUEST', hashes: ['xyz'] });
  await flushPromises();

  expect(commandBusEmit).toHaveBeenCalledWith({
    type: 'TORRENT_DELETE_CONFIRM',
    removeFiles: true,
    hashes: ['xyz'],
  });
});

it('should forward undefined hashes into TORRENT_DELETE_CONFIRM when no override is given', async () => {
  mockModalService.open.mockReturnValueOnce({
    componentInstance: {},
    result: Promise.resolve({ removeFiles: false }),
  });

  commands$.next({ type: 'UI_TORRENT_DELETE_REQUEST' });
  await flushPromises();

  expect(commandBusEmit).toHaveBeenCalledWith({
    type: 'TORRENT_DELETE_CONFIRM',
    removeFiles: false,
    hashes: undefined,
  });
});
```

- [ ] **Step 3: Run the tests to verify the new/changed ones fail**

Run: `npm run test --workspace=@bitbutler/app`

Expected: FAIL - `selectionStore.selectedHashes` is not a function (the production code still reads `this.selectionStoreService.selected().length`, and the mock now lacks a usable `selectedHashes` for the new assertions; the new "forward...hashes" tests fail because the production case doesn't emit `hashes` yet).

- [ ] **Step 4: Update the `UI_TORRENT_DELETE_REQUEST` case**

In `packages/app/src/app/services/ui-command-handler.service.ts`, replace lines 73-85:

```ts
          case 'UI_TORRENT_DELETE_REQUEST':
            if (this.selectionStoreService.selected().length === 0) return;
            if (this.isModalOpen(DeleteTorrent)) break;

            const deleteModalRef = this.modalService.open(DeleteTorrent);
            setModalInput(deleteModalRef, 'defaultRemoveFiles', command.defaultRemoveFiles);

            deleteModalRef.result
              .then(({ removeFiles }) =>
                this.commandBusService.emit({ type: 'TORRENT_DELETE_CONFIRM', removeFiles }),
              )
              .catch(() => {});
            break;
```

with:

```ts
          case 'UI_TORRENT_DELETE_REQUEST': {
            const deleteHashes = command.hashes ?? this.selectionStoreService.selectedHashes();
            if (deleteHashes.length === 0) return;
            if (this.isModalOpen(DeleteTorrent)) break;

            const deleteModalRef = this.modalService.open(DeleteTorrent);
            setModalInput(deleteModalRef, 'defaultRemoveFiles', command.defaultRemoveFiles);
            setModalInput(deleteModalRef, 'hashes', command.hashes);

            deleteModalRef.result
              .then(({ removeFiles }) =>
                this.commandBusService.emit({
                  type: 'TORRENT_DELETE_CONFIRM',
                  removeFiles,
                  hashes: command.hashes,
                }),
              )
              .catch(() => {});
            break;
          }
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npm run test --workspace=@bitbutler/app`

Expected: PASS for all tests in `ui-command-handler.service.spec.ts`.

- [ ] **Step 6: Commit**

```bash
git add packages/app/src/app/models/command.model.ts packages/app/src/app/services/ui-command-handler.service.ts packages/app/src/app/services/ui-command-handler.service.spec.ts
git commit -m "#184: add hashes override to UI_TORRENT_DELETE_REQUEST"
```

---

### Task 2: Make `DeleteTorrent` respect an explicit `hashes` override

**Files:**

- Modify: `packages/app/src/app/components/modals/delete-torrent/delete-torrent.ts`
- Test: `packages/app/src/app/components/modals/delete-torrent/delete-torrent.spec.ts`

**Interfaces:**

- Consumes: `TorrentStoreService.torrentsMap()` returning `ReadonlySignal<Map<string, Torrent>>` (already defined in `packages/app/src/app/services/torrent-store.service.ts:24`).
- Produces: `DeleteTorrent.hashes` input (`string[] | undefined`), read by Task 1's `setModalInput(deleteModalRef, 'hashes', command.hashes)`.

- [ ] **Step 1: Write the failing tests**

Open `packages/app/src/app/components/modals/delete-torrent/delete-torrent.spec.ts`. Add an import:

```ts
import { TorrentStoreService } from '../../../services/torrent-store.service';
```

Declare a `mockTorrentStore` variable alongside the existing `mockSelectionStore` declaration:

```ts
let mockTorrentStore: { torrentsMap: ReturnType<typeof signal<Map<string, any>>> };
```

In `beforeEach`, after `mockSelectionStore` is assigned, add:

```ts
mockTorrentStore = { torrentsMap: signal(new Map()) };
```

Add `{ provide: TorrentStoreService, useValue: mockTorrentStore }` to the `providers` array (alongside the existing `SelectionStoreService` provider).

Add a new `describe` block at the end of the file, before the closing `});` of the outer `describe('DeleteTorrent', ...)`:

```ts
describe('selected', () => {
  it('falls back to the selection store when no hashes override is set', () => {
    const torrent = { hash: 'abc', size: 100 } as any;
    (mockSelectionStore.selected as any).set([torrent]);

    expect(component.selected()).toEqual([torrent]);
  });

  it('resolves torrents from the store when a hashes override is set', () => {
    const torrent = { hash: 'xyz', size: 500 } as any;
    mockTorrentStore.torrentsMap.set(new Map([['xyz', torrent]]));
    fixture.componentRef.setInput('hashes', ['xyz']);

    expect(component.selected()).toEqual([torrent]);
  });

  it('ignores hashes that are missing from the torrent store', () => {
    mockTorrentStore.torrentsMap.set(new Map());
    fixture.componentRef.setInput('hashes', ['missing']);

    expect(component.selected()).toEqual([]);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm run test --workspace=@bitbutler/app`

Expected: FAIL - `fixture.componentRef.setInput('hashes', ...)` fails because `DeleteTorrent` has no `hashes` input yet (Angular throws `NG0303` or similar "no input named hashes").

- [ ] **Step 3: Implement the `hashes` override**

In `packages/app/src/app/components/modals/delete-torrent/delete-torrent.ts`, change the imports from:

```ts
import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, computed, inject, input } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { faTrashCan, faXmark } from '@fortawesome/free-solid-svg-icons';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { TranslatePipe } from '@ngx-translate/core';
import { AutofocusDirective } from '../../../directives/autofocus';
import { FilesizePipe } from '../../../pipes/filesize-pipe';
import { SelectionStoreService } from '../../../services/selection-store.service';
import { BbBtnContent } from '../../bb-btn-content/bb-btn-content';
```

to:

```ts
import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, computed, inject, input } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { faTrashCan, faXmark } from '@fortawesome/free-solid-svg-icons';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { TranslatePipe } from '@ngx-translate/core';
import { AutofocusDirective } from '../../../directives/autofocus';
import { Torrent } from '../../../models/torrent.model';
import { FilesizePipe } from '../../../pipes/filesize-pipe';
import { SelectionStoreService } from '../../../services/selection-store.service';
import { TorrentStoreService } from '../../../services/torrent-store.service';
import { BbBtnContent } from '../../bb-btn-content/bb-btn-content';
```

Then change the class body from:

```ts
export class DeleteTorrent implements OnInit {
  readonly defaultRemoveFiles = input(false);
  private readonly activeModal = inject(NgbActiveModal);

  private readonly selectionStore = inject(SelectionStoreService);

  public icons = { faTrashCan, faXmark };

  readonly selected = this.selectionStore.selected;
  readonly totalSize = computed(() => this.selected().reduce((sum, t) => sum + t.size, 0));
```

to:

```ts
export class DeleteTorrent implements OnInit {
  readonly defaultRemoveFiles = input(false);
  readonly hashes = input<string[] | undefined>(undefined);
  private readonly activeModal = inject(NgbActiveModal);

  private readonly selectionStore = inject(SelectionStoreService);
  private readonly torrentStore = inject(TorrentStoreService);

  public icons = { faTrashCan, faXmark };

  readonly selected = computed<Torrent[]>(() => {
    const override = this.hashes();
    if (!override) return this.selectionStore.selected();

    const torrentsMap = this.torrentStore.torrentsMap();
    return override.map((hash) => torrentsMap.get(hash)).filter((t): t is Torrent => !!t);
  });
  readonly totalSize = computed(() => this.selected().reduce((sum, t) => sum + t.size, 0));
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm run test --workspace=@bitbutler/app`

Expected: PASS for all tests in `delete-torrent.spec.ts`.

- [ ] **Step 5: Commit**

```bash
git add packages/app/src/app/components/modals/delete-torrent/delete-torrent.ts packages/app/src/app/components/modals/delete-torrent/delete-torrent.spec.ts
git commit -m "#184: resolve DeleteTorrent's selected list from a hashes override when provided"
```

---

### Task 3: Make `TorrentCommandHandlerService.handleDelete` respect the `hashes` override

**Files:**

- Modify: `packages/app/src/app/services/torrent-command-handler.service.ts:29-31` and `:207-227`
- Test: `packages/app/src/app/services/torrent-command-handler.service.spec.ts`

**Interfaces:**

- Consumes: `TorrentCommand` variant `{ type: 'TORRENT_DELETE_CONFIRM'; removeFiles: boolean; hashes?: string[] }` from Task 1.

- [ ] **Step 1: Write the failing tests**

Open `packages/app/src/app/services/torrent-command-handler.service.spec.ts`. Add these tests right after the existing `'should not delete when no torrents are selected'` test:

```ts
it('should delete exactly the overridden hashes when TORRENT_DELETE_CONFIRM includes hashes', async () => {
  commands$.next({ type: 'TORRENT_DELETE_CONFIRM', removeFiles: true, hashes: ['only-this'] });
  await flushPromises();
  expect(qbService.torrents.delete).toHaveBeenCalledWith('server-1', ['only-this'], true);
});

it('should not clear the grid selection when deleting an overridden hash set', async () => {
  commands$.next({ type: 'TORRENT_DELETE_CONFIRM', removeFiles: true, hashes: ['only-this'] });
  await flushPromises();
  expect(selectionStore.clear).not.toHaveBeenCalled();
});

it('should emit TORRENT_DELETED for each overridden hash', async () => {
  commands$.next({ type: 'TORRENT_DELETE_CONFIRM', removeFiles: true, hashes: ['only-this'] });
  await flushPromises();
  expect(commandBusEmit).toHaveBeenCalledWith({ type: 'TORRENT_DELETED', hash: 'only-this' });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm run test --workspace=@bitbutler/app`

Expected: FAIL - `qbService.torrents.delete` is called with `['hash1', 'hash2']` (the current selection) instead of `['only-this']`, because `handleDelete` ignores `cmd.hashes`.

- [ ] **Step 3: Implement the override**

In `packages/app/src/app/services/torrent-command-handler.service.ts`, change line 29-31 from:

```ts
          case 'TORRENT_DELETE_CONFIRM':
            void this.handleDelete(cmd.removeFiles);
            break;
```

to:

```ts
          case 'TORRENT_DELETE_CONFIRM':
            void this.handleDelete(cmd.removeFiles, cmd.hashes);
            break;
```

Then change the `handleDelete` method (lines 207-227) from:

```ts
  private async handleDelete(removeFiles: boolean): Promise<void> {
    const serverId = this.serverStore.currentServerId();
    const hashes = this.selectionStore.selectedHashes();

    if (!serverId) return;
    if (hashes.length === 0) return;

    try {
      await this.qbService.torrents.delete(serverId, hashes, removeFiles);
      for (const hash of hashes) {
        this.commandBusService.emit({ type: 'TORRENT_DELETED', hash });
      }
      this.selectionStore.clear();
    } catch (error: any) {
      console.error('Delete failed', error);
      this.toastService.danger(
        error.message,
        this.translateService.instant('services.torrent-command-handler.error.delete-failed-title'),
      );
    }
  }
```

to:

```ts
  private async handleDelete(removeFiles: boolean, hashesOverride?: string[]): Promise<void> {
    const serverId = this.serverStore.currentServerId();
    const hashes = hashesOverride ?? this.selectionStore.selectedHashes();

    if (!serverId) return;
    if (hashes.length === 0) return;

    try {
      await this.qbService.torrents.delete(serverId, hashes, removeFiles);
      for (const hash of hashes) {
        this.commandBusService.emit({ type: 'TORRENT_DELETED', hash });
      }
      if (!hashesOverride) this.selectionStore.clear();
    } catch (error: any) {
      console.error('Delete failed', error);
      this.toastService.danger(
        error.message,
        this.translateService.instant('services.torrent-command-handler.error.delete-failed-title'),
      );
    }
  }
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm run test --workspace=@bitbutler/app`

Expected: PASS for all tests in `torrent-command-handler.service.spec.ts`, including the 3 new ones and all pre-existing ones (which pass no `hashes`, so `hashesOverride` is `undefined` and behavior is unchanged).

- [ ] **Step 5: Commit**

```bash
git add packages/app/src/app/services/torrent-command-handler.service.ts packages/app/src/app/services/torrent-command-handler.service.spec.ts
git commit -m "#184: respect hashes override in TorrentCommandHandlerService.handleDelete"
```

---

### Task 4: Make the torrent details modal's delete button target its own torrent

**Files:**

- Modify: `packages/app/src/app/components/modals/torrent-details/general/general.ts:543-545`
- Test: `packages/app/src/app/components/modals/torrent-details/general/general.spec.ts`

**Interfaces:**

- Consumes: `UI_TORRENT_DELETE_REQUEST` with `hashes?: string[]` from Task 1.

- [ ] **Step 1: Write the failing test**

Open `packages/app/src/app/components/modals/torrent-details/general/general.spec.ts`. The `CommandBusService` provider is currently inline:

```ts
        {
          provide: CommandBusService,
          useValue: { commands$: new Subject<any>().asObservable(), emit: vi.fn() },
        },
```

Change it so the `emit` mock is captured in a variable. First, declare the variable with the other `let` declarations near the top of the `describe` block (after `let toastDanger: ReturnType<typeof vi.fn>;`):

```ts
let commandBusEmit: ReturnType<typeof vi.fn>;
```

In `beforeEach`, initialize it alongside the other mocks (after `toastDanger = vi.fn();`):

```ts
commandBusEmit = vi.fn();
```

Then update the provider to use it:

```ts
        {
          provide: CommandBusService,
          useValue: { commands$: new Subject<any>().asObservable(), emit: commandBusEmit },
        },
```

Add a new test inside the `describe('action handlers', ...)` block (it already sets up a torrent with hash `'abc123'` in its own `beforeEach`), right after the `describe('forceReannounce', ...)` block:

```ts
describe('deleteTorrent', () => {
  it('emits UI_TORRENT_DELETE_REQUEST with the hash of the torrent being viewed', () => {
    component.deleteTorrent();

    expect(commandBusEmit).toHaveBeenCalledWith({
      type: 'UI_TORRENT_DELETE_REQUEST',
      hashes: ['abc123'],
    });
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run test --workspace=@bitbutler/app`

Expected: FAIL - `commandBusEmit` was called with `{ type: 'UI_TORRENT_DELETE_REQUEST' }` (no `hashes`), not matching the expected payload.

- [ ] **Step 3: Implement the fix**

In `packages/app/src/app/components/modals/torrent-details/general/general.ts`, change:

```ts
  public deleteTorrent(): void {
    this.commandBusService.emit({ type: 'UI_TORRENT_DELETE_REQUEST' });
  }
```

to:

```ts
  public deleteTorrent(): void {
    this.commandBusService.emit({ type: 'UI_TORRENT_DELETE_REQUEST', hashes: [this.hash()] });
  }
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm run test --workspace=@bitbutler/app`

Expected: PASS for all tests in `general.spec.ts`.

- [ ] **Step 5: Commit**

```bash
git add packages/app/src/app/components/modals/torrent-details/general/general.ts packages/app/src/app/components/modals/torrent-details/general/general.spec.ts
git commit -m "#184: target the modal's own torrent when deleting from the details modal"
```

---

### Task 5: Destroy the torrent details modal's tabs immediately on delete (race condition fix)

**Files:**

- Modify: `packages/app/src/app/components/modals/torrent-details/torrent-details.ts:94-108`
- Test: `packages/app/src/app/components/modals/torrent-details/torrent-details.spec.ts`

**Interfaces:**

- Produces: on a matching `TORRENT_DELETED` command, `TorrentDetails.loadedComponents` is set to an empty `Map` before `activeModal.close()` is invoked.

- [ ] **Step 1: Write the failing tests**

Open `packages/app/src/app/components/modals/torrent-details/torrent-details.spec.ts`. Add a `Subject` import is already present. Change the test setup to keep a reference to the commands subject. Replace:

```ts
describe('TorrentDetails', () => {
  let component: TorrentDetails;
  let fixture: ComponentFixture<TorrentDetails>;
  let mockActiveModal: Partial<NgbActiveModal>;

  beforeEach(async () => {
    mockActiveModal = { close: vi.fn(), dismiss: vi.fn() };

    await TestBed.configureTestingModule({
      imports: [TorrentDetails],
      providers: [
        { provide: NgbActiveModal, useValue: mockActiveModal },
        {
          provide: TorrentStoreService,
          useValue: { torrentsMap: signal(new Map()) },
        },
        {
          provide: CommandBusService,
          useValue: { commands$: new Subject<any>().asObservable(), emit: vi.fn() },
        },
        { provide: ConfirmService, useValue: { confirm: vi.fn().mockResolvedValue(true) } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(TorrentDetails);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });
```

with:

```ts
describe('TorrentDetails', () => {
  let component: TorrentDetails;
  let fixture: ComponentFixture<TorrentDetails>;
  let mockActiveModal: Partial<NgbActiveModal>;
  let commands$: Subject<any>;

  beforeEach(async () => {
    mockActiveModal = { close: vi.fn(), dismiss: vi.fn() };
    commands$ = new Subject();

    await TestBed.configureTestingModule({
      imports: [TorrentDetails],
      providers: [
        { provide: NgbActiveModal, useValue: mockActiveModal },
        {
          provide: TorrentStoreService,
          useValue: { torrentsMap: signal(new Map()) },
        },
        {
          provide: CommandBusService,
          useValue: { commands$: commands$.asObservable(), emit: vi.fn() },
        },
        { provide: ConfirmService, useValue: { confirm: vi.fn().mockResolvedValue(true) } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(TorrentDetails);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });
```

Add a new `describe` block at the end of the file, just before the final closing `});`:

```ts
describe('TORRENT_DELETED handling', () => {
  it('clears loadedComponents and closes the modal when this torrent is deleted', async () => {
    fixture.componentRef.setInput('hash', 'abc123');
    await fixture.whenStable();
    expect(component.loadedComponents().size).toBeGreaterThan(0);

    commands$.next({ type: 'TORRENT_DELETED', hash: 'abc123' });

    expect(component.loadedComponents().size).toBe(0);
    expect(mockActiveModal.close).toHaveBeenCalled();
  });

  it('ignores TORRENT_DELETED events for a different hash', async () => {
    fixture.componentRef.setInput('hash', 'abc123');
    await fixture.whenStable();
    const sizeBefore = component.loadedComponents().size;
    expect(sizeBefore).toBeGreaterThan(0);

    commands$.next({ type: 'TORRENT_DELETED', hash: 'other-hash' });

    expect(component.loadedComponents().size).toBe(sizeBefore);
    expect(mockActiveModal.close).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run the tests to verify the first one fails**

Run: `npm run test --workspace=@bitbutler/app`

Expected: FAIL on `expect(component.loadedComponents().size).toBe(0)` - today's subscription only calls `activeModal.close()` and never clears `loadedComponents`, so it stays populated.

- [ ] **Step 3: Implement the fix**

In `packages/app/src/app/components/modals/torrent-details/torrent-details.ts`, change the constructor's subscription (lines 94-108) from:

```ts
  constructor() {
    this.commandBusService.commands$
      .pipe(
        filter(
          (command: AppCommand): command is { type: 'TORRENT_DELETED'; hash: string } =>
            command.type === 'TORRENT_DELETED',
        ),
        filter(
          (command: TorrentCommand) =>
            command.type === 'TORRENT_DELETED' && command.hash === this.hash(),
        ),
        takeUntilDestroyed(),
      )
      .subscribe(() => this.activeModal.close());
  }
```

to:

```ts
  constructor() {
    this.commandBusService.commands$
      .pipe(
        filter(
          (command: AppCommand): command is { type: 'TORRENT_DELETED'; hash: string } =>
            command.type === 'TORRENT_DELETED',
        ),
        filter(
          (command: TorrentCommand) =>
            command.type === 'TORRENT_DELETED' && command.hash === this.hash(),
        ),
        takeUntilDestroyed(),
      )
      .subscribe(() => {
        this.loadedComponents.set(new Map());
        this.activeModal.close();
      });
  }
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm run test --workspace=@bitbutler/app`

Expected: PASS for all tests in `torrent-details.spec.ts`.

- [ ] **Step 5: Commit**

```bash
git add packages/app/src/app/components/modals/torrent-details/torrent-details.ts packages/app/src/app/components/modals/torrent-details/torrent-details.spec.ts
git commit -m "#184: destroy torrent details tabs immediately on delete to stop stray polling"
```

---

### Task 6: Final verification

**Files:** none (verification only).

- [ ] **Step 1: Run the full test suite**

Run: `npm test`

Expected: PASS for every workspace.

- [ ] **Step 2: Run lint**

Run: `npm run lint`

Expected: PASS with zero warnings.

- [ ] **Step 3: Manual verification in the running app**

Run: `npm start`

In the running app:

1. Select one torrent in the grid (Torrent A), but do not select another (Torrent B).
2. Right-click Torrent B and choose "Details" - this opens the details modal for B without changing the grid's selection (still A).
3. In the modal's General tab, click the delete button (the hover button in the Name field, until issue #183's footer reorg lands) and confirm deletion without removing files.
4. Confirm: Torrent B is deleted (not A), the grid's selection still shows A as selected, the details modal closes, and no error toast appears.
5. Repeat using the toolbar/grid's normal multi-select delete (no torrent details modal open) and confirm it still deletes the full selection and clears it afterward, exactly as before.

- [ ] **Step 4: Update the plan checklist**

Mark all checkboxes in this file as complete once every step above has been verified.
