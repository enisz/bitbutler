# Pause Polling on Modal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `pausePollingOnModal` setting (default `false`) that, when enabled, pauses maindata background polling while any modal is open and resumes it when all modals close.

**Architecture:** `TorrentListGridSettings` gains a `pausePollingOnModal` boolean. `UiCommandHandlerService` watches `NgbModal.activeInstances` combined with the grid settings and calls `QbPollingService.pause()`/`resume()` accordingly, holding exactly one pause token at a time. The UI exposes the toggle in the Torrent List Grid settings tab with a minimal label and a popover explaining the behaviour.

**Tech Stack:** Angular 20 (zoneless, signals), RxJS `combineLatest`/`startWith`, NgBootstrap NgbModal, ngx-translate, Vitest via Angular test runner.

## Global Constraints

- Zero lint warnings (`npm run lint` must pass with `--max-warnings=0`)
- All tests must pass (`npm test` from repo root)
- Commit message format: `#190: short description`
- Working directory for `ng test` commands: `packages/app/`
- Run individual spec: `npx ng test --include src/app/path/file.spec.ts --watch=false`
- No new `BehaviorSubject` for new state - use existing `QbPollingService.pause()`/`resume()` token API
- Label text must be minimal; popover carries the explanation

---

## File Map

| File                                                                              | Change                                                                                         |
| --------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| `packages/app/src/app/models/torrent-list-grid.model.ts`                          | Add `pausePollingOnModal: boolean` field and default `false`                                   |
| `packages/app/src/app/services/torrent-list-grid.settings.service.spec.ts`        | Add test asserting default is `false`                                                          |
| `packages/app/src/app/pages/settings/torrent-list-grid/torrent-list-grid.ts`      | Add form control, patch in `initializeForm`, persist in `save`                                 |
| `packages/app/src/app/pages/settings/torrent-list-grid/torrent-list-grid.html`    | Add toggle switch row with label + `bb-popover`                                                |
| `packages/app/src/app/pages/settings/torrent-list-grid/torrent-list-grid.spec.ts` | Update `DEFAULT_SETTINGS`; add form control test                                               |
| `packages/app/src/app/services/ui-command-handler.service.ts`                     | Inject `TorrentListGridSettingsService` + `QbPollingService`; add `combineLatest` subscription |
| `packages/app/src/app/services/ui-command-handler.service.spec.ts`                | Add providers and pause-on-modal tests                                                         |
| `public/i18n/us.json`                                                             | Add `pause-on-modal` label and popover keys                                                    |
| `public/i18n/hu.json`                                                             | Add `pause-on-modal` label and popover keys                                                    |

---

### Task 1: Add `pausePollingOnModal` to the settings model

**Files:**

- Modify: `packages/app/src/app/models/torrent-list-grid.model.ts`
- Modify: `packages/app/src/app/services/torrent-list-grid.settings.service.spec.ts`

**Interfaces:**

- Produces: `TorrentListGridSettings.pausePollingOnModal: boolean` (default `false`)

- [ ] **Step 1: Write a failing test**

Add this test at the end of the `describe('TorrentListGridSettingsService', ...)` block in
`packages/app/src/app/services/torrent-list-grid.settings.service.spec.ts`:

```typescript
it('should default pausePollingOnModal to false when nothing is stored', async () => {
  const settings = await service.load();
  expect(settings.pausePollingOnModal).toBe(false);
});
```

- [ ] **Step 2: Run test to confirm it fails**

```bash
cd packages/app && npx ng test --include src/app/services/torrent-list-grid.settings.service.spec.ts --watch=false
```

Expected: the new test fails with `expected undefined to be false` (property doesn't exist yet).

- [ ] **Step 3: Add the field to the model**

In `packages/app/src/app/models/torrent-list-grid.model.ts`, add `pausePollingOnModal` to the interface and default:

Old interface:

```typescript
export interface TorrentListGridSettings {
  columnState: (ColumnState[] | string[]) | null;
  filterModel: any;
  pagination: boolean;
  animateRows: boolean;
  compactRows: boolean;
  rowDoubleClickAction: RowDoubleClickAction;
  pinnedTopHashes: string[];
  pinnedBottomHashes: string[];
  floatingFilters: boolean;
}
```

New interface:

```typescript
export interface TorrentListGridSettings {
  columnState: (ColumnState[] | string[]) | null;
  filterModel: any;
  pagination: boolean;
  animateRows: boolean;
  compactRows: boolean;
  rowDoubleClickAction: RowDoubleClickAction;
  pinnedTopHashes: string[];
  pinnedBottomHashes: string[];
  floatingFilters: boolean;
  pausePollingOnModal: boolean;
}
```

Old default (last two lines):

```typescript
  floatingFilters: false,
};
```

New default:

```typescript
  floatingFilters: false,
  pausePollingOnModal: false,
};
```

- [ ] **Step 4: Run test to confirm it passes**

```bash
cd packages/app && npx ng test --include src/app/services/torrent-list-grid.settings.service.spec.ts --watch=false
```

Expected: all tests pass including the new one.

- [ ] **Step 5: Commit**

```bash
git add packages/app/src/app/models/torrent-list-grid.model.ts \
        packages/app/src/app/services/torrent-list-grid.settings.service.spec.ts
git commit -m "$(cat <<'EOF'
#190: add pausePollingOnModal field to TorrentListGridSettings

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: Wire the setting into the Torrent List Grid settings UI

**Files:**

- Modify: `packages/app/src/app/pages/settings/torrent-list-grid/torrent-list-grid.ts`
- Modify: `packages/app/src/app/pages/settings/torrent-list-grid/torrent-list-grid.html`
- Modify: `packages/app/src/app/pages/settings/torrent-list-grid/torrent-list-grid.spec.ts`
- Modify: `public/i18n/us.json`
- Modify: `public/i18n/hu.json`

**Interfaces:**

- Consumes: `TorrentListGridSettings.pausePollingOnModal: boolean` (from Task 1)

- [ ] **Step 1: Write a failing test**

In `packages/app/src/app/pages/settings/torrent-list-grid/torrent-list-grid.spec.ts`:

1. Add `pausePollingOnModal: false` to the `DEFAULT_SETTINGS` constant:

Old:

```typescript
const DEFAULT_SETTINGS = {
  columnState: [],
  pagination: true,
  animateRows: true,
  rowDoubleClickAction: 'DETAILS' as const,
  floatingFilters: false,
};
```

New:

```typescript
const DEFAULT_SETTINGS = {
  columnState: [],
  pagination: true,
  animateRows: true,
  rowDoubleClickAction: 'DETAILS' as const,
  floatingFilters: false,
  pausePollingOnModal: false,
};
```

2. Add this test inside `describe('TorrentListGrid', ...)`, after the `it('should create', ...)` test:

```typescript
it('should initialise pausePollingOnModal form control to false from settings', () => {
  expect(component.torrentListGridForm.get('pausePollingOnModal')?.value).toBe(false);
});
```

- [ ] **Step 2: Run test to confirm it fails**

```bash
cd packages/app && npx ng test --include src/app/pages/settings/torrent-list-grid/torrent-list-grid.spec.ts --watch=false
```

Expected: the new test fails with `expected undefined to be false` (control not defined yet).

- [ ] **Step 3: Update the component TypeScript**

In `packages/app/src/app/pages/settings/torrent-list-grid/torrent-list-grid.ts`:

3a. Add `pausePollingOnModal` to `torrentListGridForm`. Old form group:

```typescript
public torrentListGridForm = new FormGroup({
  columns: new FormControl<string[]>([]),
  pagination: new FormControl(false),
  animateRows: new FormControl(false),
  compactRows: new FormControl(false),
  floatingFilters: new FormControl(false),
  rowDoubleClickAction: new FormControl<RowDoubleClickAction>('DETAILS'),
});
```

New form group:

```typescript
public torrentListGridForm = new FormGroup({
  columns: new FormControl<string[]>([]),
  pagination: new FormControl(false),
  animateRows: new FormControl(false),
  compactRows: new FormControl(false),
  floatingFilters: new FormControl(false),
  pausePollingOnModal: new FormControl(false),
  rowDoubleClickAction: new FormControl<RowDoubleClickAction>('DETAILS'),
});
```

3b. Patch the value in `initializeForm`. Old patch:

```typescript
this.torrentListGridForm.patchValue(
  {
    columns: visibleColIds,
    pagination: settings.pagination,
    animateRows: settings.animateRows,
    compactRows: settings.compactRows ?? false,
    floatingFilters: settings.floatingFilters ?? false,
    rowDoubleClickAction: settings.rowDoubleClickAction,
  },
  { emitEvent: false },
);
```

New patch:

```typescript
this.torrentListGridForm.patchValue(
  {
    columns: visibleColIds,
    pagination: settings.pagination,
    animateRows: settings.animateRows,
    compactRows: settings.compactRows ?? false,
    floatingFilters: settings.floatingFilters ?? false,
    pausePollingOnModal: settings.pausePollingOnModal ?? false,
    rowDoubleClickAction: settings.rowDoubleClickAction,
  },
  { emitEvent: false },
);
```

3c. Persist the value in `save`. Old save call:

```typescript
await this.torrentListGridSettingsService.save({
  ...settings,
  pagination: formValue.pagination ?? settings.pagination,
  animateRows: formValue.animateRows ?? settings.animateRows,
  compactRows: formValue.compactRows ?? settings.compactRows,
  floatingFilters: formValue.floatingFilters ?? settings.floatingFilters,
  rowDoubleClickAction: formValue.rowDoubleClickAction ?? settings.rowDoubleClickAction,
  columnState: newColumnState,
});
```

New save call:

```typescript
await this.torrentListGridSettingsService.save({
  ...settings,
  pagination: formValue.pagination ?? settings.pagination,
  animateRows: formValue.animateRows ?? settings.animateRows,
  compactRows: formValue.compactRows ?? settings.compactRows,
  floatingFilters: formValue.floatingFilters ?? settings.floatingFilters,
  pausePollingOnModal: formValue.pausePollingOnModal ?? settings.pausePollingOnModal,
  rowDoubleClickAction: formValue.rowDoubleClickAction ?? settings.rowDoubleClickAction,
  columnState: newColumnState,
});
```

- [ ] **Step 4: Add the toggle to the HTML template**

In `packages/app/src/app/pages/settings/torrent-list-grid/torrent-list-grid.html`, add a new row after the `floatingFilters` row and before the `rowDoubleClickAction` row. The `floatingFilters` row ends with `</div>` closing `class="row mb-3"`. Insert this new row immediately after:

```html
<div class="row mb-3">
  <div class="col-lg-6 col-12">
    <div class="form-check form-switch">
      <input
        class="form-check-input"
        type="checkbox"
        id="pausePollingOnModal"
        formControlName="pausePollingOnModal"
      />
      <label class="form-check-label" for="pausePollingOnModal">
        {{ 'pages.settings.tab.torrent-list-grid.torrent-list-grid-form.pause-on-modal' | translate
        }}
        <bb-popover
          [subject]="
                    'pages.settings.tab.torrent-list-grid.popover.pause-on-modal.title' | translate
                  "
          [description]="
                    'pages.settings.tab.torrent-list-grid.popover.pause-on-modal.description'
                      | translate
                  "
        ></bb-popover>
      </label>
    </div>
  </div>
</div>
```

- [ ] **Step 5: Add translation keys to `us.json`**

In `public/i18n/us.json`, inside the `torrent-list-grid` → `torrent-list-grid-form` object, add after `"floating-filters": "Floating Filters",`:

```json
"pause-on-modal": "Pause on Modal",
```

In the same file, inside `torrent-list-grid` → `popover`, add after the `"floating-filters"` popover object:

```json
"pause-on-modal": {
  "title": "Pause Polling on Modal",
  "description": "When enabled, background polling is paused whenever any modal is open. Polling resumes automatically when the modal is closed."
},
```

- [ ] **Step 6: Add translation keys to `hu.json`**

In `public/i18n/hu.json`, inside the `torrent-list-grid` → `torrent-list-grid-form` object, add after `"floating-filters": "Lebegő szűrők",`:

```json
"pause-on-modal": "Szüneteltetés modál esetén",
```

In the same file, inside `torrent-list-grid` → `popover`, add after the `"floating-filters"` popover object:

```json
"pause-on-modal": {
  "title": "Lekérdezés szüneteltetése modál esetén",
  "description": "Ha engedélyezve van, a háttérlekérdezés szünetel, amikor bármely modál ablak meg van nyitva. A lekérdezés automatikusan folytatódik, amikor a modál bezáródik."
},
```

- [ ] **Step 7: Run component tests**

```bash
cd packages/app && npx ng test --include src/app/pages/settings/torrent-list-grid/torrent-list-grid.spec.ts --watch=false
```

Expected: all tests pass including the new one.

- [ ] **Step 8: Commit**

```bash
git add packages/app/src/app/pages/settings/torrent-list-grid/torrent-list-grid.ts \
        packages/app/src/app/pages/settings/torrent-list-grid/torrent-list-grid.html \
        packages/app/src/app/pages/settings/torrent-list-grid/torrent-list-grid.spec.ts \
        public/i18n/us.json \
        public/i18n/hu.json
git commit -m "$(cat <<'EOF'
#190: add pause-on-modal toggle to torrent list grid settings

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: Add modal-pause logic to `UiCommandHandlerService`

**Files:**

- Modify: `packages/app/src/app/services/ui-command-handler.service.ts`
- Modify: `packages/app/src/app/services/ui-command-handler.service.spec.ts`

**Interfaces:**

- Consumes: `TorrentListGridSettings.pausePollingOnModal: boolean` (Task 1)
- Consumes: `QbPollingService.pause(): symbol`, `QbPollingService.resume(token: symbol): void`

- [ ] **Step 1: Write failing tests**

In `packages/app/src/app/services/ui-command-handler.service.spec.ts`:

1a. Add these imports at the top of the file alongside the existing imports:

```typescript
import { BehaviorSubject } from 'rxjs';
import { QbPollingService } from './qb-polling.service';
import { TorrentListGridSettingsService } from './torrent-list-grid.settings.service';
```

1b. Add these variables inside the `describe('UiCommandHandlerService', ...)` block, alongside the existing `let service`, `let commands$`, etc.:

```typescript
let mockPollingService: { pause: ReturnType<typeof vi.fn>; resume: ReturnType<typeof vi.fn> };
let gridSettings$: BehaviorSubject<{ pausePollingOnModal: boolean }>;
```

1c. Inside `beforeEach`, before `TestBed.configureTestingModule(...)`, add:

```typescript
mockPollingService = {
  pause: vi.fn().mockReturnValue(Symbol('pause-token')),
  resume: vi.fn(),
};
gridSettings$ = new BehaviorSubject<{ pausePollingOnModal: boolean }>({
  pausePollingOnModal: false,
});
```

1d. Inside `TestBed.configureTestingModule({ providers: [...] })`, add these two providers alongside the existing ones:

```typescript
{
  provide: TorrentListGridSettingsService,
  useValue: { asObservable: vi.fn().mockReturnValue(gridSettings$.asObservable()) },
},
{
  provide: QbPollingService,
  useValue: mockPollingService,
},
```

1e. Add this `describe` block at the end of the file, before the final closing `}`:

```typescript
describe('pausePollingOnModal', () => {
  it('should not pause polling when setting is disabled and a modal opens', () => {
    gridSettings$.next({ pausePollingOnModal: false });
    mockModalService.activeInstances.next([{} as any]);
    expect(mockPollingService.pause).not.toHaveBeenCalled();
  });

  it('should pause polling when setting is enabled and a modal opens', () => {
    gridSettings$.next({ pausePollingOnModal: true });
    mockModalService.activeInstances.next([{} as any]);
    expect(mockPollingService.pause).toHaveBeenCalledTimes(1);
  });

  it('should resume polling with the correct token when the last modal closes', () => {
    const token = Symbol('test-token');
    mockPollingService.pause.mockReturnValueOnce(token);
    gridSettings$.next({ pausePollingOnModal: true });
    mockModalService.activeInstances.next([{} as any]);
    mockModalService.activeInstances.next([]);
    expect(mockPollingService.resume).toHaveBeenCalledWith(token);
  });

  it('should not call pause a second time when an additional modal opens while already paused', () => {
    gridSettings$.next({ pausePollingOnModal: true });
    mockModalService.activeInstances.next([{} as any]);
    mockModalService.activeInstances.next([{} as any, {} as any]);
    expect(mockPollingService.pause).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Run tests to confirm the new ones fail**

```bash
cd packages/app && npx ng test --include src/app/services/ui-command-handler.service.spec.ts --watch=false
```

Expected: the 4 new `pausePollingOnModal` tests fail (methods not yet injected or wired). All existing tests still pass — the new mock providers default to `pausePollingOnModal: false` so the existing modal-open tests are unaffected.

- [ ] **Step 3: Update `UiCommandHandlerService`**

In `packages/app/src/app/services/ui-command-handler.service.ts`:

3a. Update the RxJS import to add `combineLatest` and `startWith`. Old:

```typescript
import { filter } from 'rxjs';
```

New:

```typescript
import { NgbModalRef } from '@ng-bootstrap/ng-bootstrap';
import { combineLatest, filter, startWith } from 'rxjs';
```

Note: `NgbModal` is already imported; `NgbModalRef` is the type needed for the `startWith` cast.

3b. Add the two new service imports after the existing service imports:

```typescript
import { QbPollingService } from './qb-polling.service';
import { TorrentListGridSettingsService } from './torrent-list-grid.settings.service';
```

3c. Add the two new injections and the pause token field. Inside the class body, after the existing `private readonly destroyRef = inject(DestroyRef);` line, add:

```typescript
private readonly torrentListGridSettingsService = inject(TorrentListGridSettingsService);
private readonly qbPollingService = inject(QbPollingService);
private pauseToken: symbol | null = null;
```

3d. In `start()`, after the existing `activeInstances` subscription (the one that sets `this.activeModals`), add the new `combineLatest` subscription:

After this existing block:

```typescript
this.modalService.activeInstances
  .pipe(takeUntilDestroyed(this.destroyRef))
  .subscribe((modals) => (this.activeModals = modals));
```

Add:

```typescript
combineLatest([
  this.modalService.activeInstances.pipe(startWith([] as NgbModalRef[])),
  this.torrentListGridSettingsService.asObservable(),
])
  .pipe(takeUntilDestroyed(this.destroyRef))
  .subscribe(([modals, settings]) => {
    const shouldPause = modals.length > 0 && settings.pausePollingOnModal;
    if (shouldPause && this.pauseToken === null) {
      this.pauseToken = this.qbPollingService.pause();
    } else if (!shouldPause && this.pauseToken !== null) {
      this.qbPollingService.resume(this.pauseToken);
      this.pauseToken = null;
    }
  });

this.destroyRef.onDestroy(() => {
  if (this.pauseToken !== null) {
    this.qbPollingService.resume(this.pauseToken);
    this.pauseToken = null;
  }
});
```

- [ ] **Step 4: Run all tests**

```bash
npm test
```

Expected: all tests across all workspaces pass.

- [ ] **Step 5: Run lint**

```bash
npm run lint
```

Expected: no errors or warnings.

- [ ] **Step 6: Commit**

```bash
git add packages/app/src/app/services/ui-command-handler.service.ts \
        packages/app/src/app/services/ui-command-handler.service.spec.ts
git commit -m "$(cat <<'EOF'
#190: pause polling when a modal is open via UiCommandHandlerService

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```
