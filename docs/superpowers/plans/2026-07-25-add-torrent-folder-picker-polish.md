# Add Torrent folder picker polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix stale/misplaced popover copy in the Add Torrent modal's folder-input mode, give the
folder-picker grid full width with always-visible inline help text, and bring it up to parity
with the other ag-grids in the app (persisted column layout, autosize-until-customized, header
context menu).

**Architecture:** Follow the existing `trackers.ts` / `TrackersGridSettingsService` pattern
exactly: a thin `BaseSettingsService<T>` subclass persists `ColumnState[]` through the generic
`SettingsService` (Electron `settings` table), and the grid component wires
`onGridReady`/column-change handlers/`onColumnHeaderContextMenu` to restore, debounce-save, and
expose a header context menu via the already-shared `GridContextMenuService`.

**Tech Stack:** Angular 20 (signals, zoneless), ag-grid-community/ag-grid-angular, ngx-translate,
Vitest.

## Global Constraints

- Commit format: `#235: short description` (this is issue #235's branch).
- Use `-` not `—` in all copy, commit messages, and this plan.
- `npm run lint` must pass with zero warnings; Prettier formatting is enforced by the pre-commit
  hook (don't fight it - let it reformat and re-stage if needed).
- Every new/changed i18n key needs both `public/i18n/us.json` and `public/i18n/hu.json` entries.
- New services follow the `BaseSettingsService<T>` pattern (`packages/app/src/app/services/base-settings.service.ts`) - do not touch `packages/electron/src/db.ts`.
- TDD: write the failing test before the implementation for every behavioral change.

---

## File Structure

| File                                                                                  | Responsibility                                                                        |
| ------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| `public/i18n/us.json`, `public/i18n/hu.json`                                          | Copy changes (Task 1)                                                                 |
| `packages/app/src/app/modals/add-torrent/general/general.html`                        | Remove folder popover column, widen grid to col-12 (Task 2)                           |
| `packages/app/src/app/modals/add-torrent/general/general.spec.ts`                     | Test the layout change (Task 2)                                                       |
| `packages/app/src/app/modals/add-torrent/general/folder-picker/folder-picker.html`    | Inline description text under recursive switch, `(gridReady)` binding (Task 3)        |
| `packages/app/src/app/models/add-torrent-grid.model.ts`                               | New: `AddTorrentGridSettings` type + defaults (Task 4)                                |
| `packages/app/src/app/services/add-torrent-grid.settings.service.ts`                  | New: settings service (Task 4)                                                        |
| `packages/app/src/app/services/add-torrent-grid.settings.service.spec.ts`             | New: settings service tests (Task 4)                                                  |
| `packages/app/src/app/modals/add-torrent/general/folder-picker/folder-picker.ts`      | Column-state restore/persist, autosize-until-customized, header context menu (Task 5) |
| `packages/app/src/app/modals/add-torrent/general/folder-picker/folder-picker.spec.ts` | Tests for the above (Task 5)                                                          |

---

### Task 1: Copy changes in i18n files

**Files:**

- Modify: `public/i18n/us.json:166-172` (input-mode popover), `public/i18n/us.json:139-145` (folder popover, to be removed), `public/i18n/us.json:199-218` (folder-picker block, to gain a `description` key)
- Modify: `public/i18n/hu.json` (matching keys - same nesting, Hungarian text)

**Interfaces:**

- Produces: translation keys `components.add-torrent.popover.input-mode.description.line1` (changed, `line2` removed), `components.add-torrent.folder-picker.description.line1/line2/line3` (new). Consumed by Task 2 (`general.html`) and Task 3 (`folder-picker.html`).
- `components.add-torrent.popover.folder` key is deleted (was consumed by `general.html`'s `#folderPopover` template, removed in Task 2).

- [ ] **Step 1: Update the Input Mode popover description in `us.json`**

In `public/i18n/us.json`, replace the `"input-mode"` block (currently lines 166-172):

```json
        "input-mode": {
          "title": "Input Mode",
          "description": {
            "line1": "Choose whether you're adding this torrent from a local .torrent file, a magnet link / URL, or by scanning a folder for .torrent files."
          }
        }
```

(This removes the `line2` key entirely - it claimed switching modes resets save
path/category/tags, which `AddTorrent.switchInputMode` does not do.)

- [ ] **Step 2: Remove the `"folder"` popover block from `us.json`**

Delete this entire block (currently lines 139-145):

```json
        "folder": {
          "title": "Folder",
          "description": {
            "line1": "Select a folder containing .torrent files. Each file is parsed locally and listed below - no data is sent anywhere until you click Add.",
            "line2": "Use the Refresh button or toggle Recursive to re-scan the folder after adding or removing files on disk."
          }
        },
```

- [ ] **Step 3: Add a `description` key to the `"folder-picker"` block in `us.json`**

The block currently looks like (around line 199):

```json
      "folder-picker": {
        "col-def": { ... },
        "state": { ... },
        "grid": {
          "no-rows": {
            "message": "No .torrent files found in this folder."
          }
        }
      },
```

Add a `"description"` sibling key to `"col-def"`/`"state"`/`"grid"`:

```json
      "folder-picker": {
        "col-def": { ... },
        "state": { ... },
        "description": {
          "line1": "Select a folder containing .torrent files. Each file is parsed locally and listed below - no data is sent anywhere until you click Add.",
          "line2": "Use the Refresh button or toggle Recursive to re-scan the folder after adding or removing files on disk.",
          "line3": "Double-click a row's Name to rename it before adding - only new, not-yet-added torrents can be selected."
        },
        "grid": {
          "no-rows": {
            "message": "No .torrent files found in this folder."
          }
        }
      },
```

- [ ] **Step 4: Make the matching edits in `public/i18n/hu.json`**

Same three edits, same key paths, Hungarian text:

Input-mode description (replace the existing `"input-mode"` block under `add-torrent.popover`):

```json
        "input-mode": {
          "title": "Bemeneti mód",
          "description": {
            "line1": "Válaszd ki, hogy ezt a torrentet egy helyi .torrent fájlból, egy mágneslinkből/URL-ből, vagy egy mappa .torrent fájlok után történő átvizsgálásával szeretnéd hozzáadni."
          }
        }
```

Remove the `"folder"` block under `add-torrent.popover` (mirrors Step 2, currently around line 139):

```json
        "folder": {
          "title": "Mappa",
          "description": {
            "line1": "Válasszon egy mappát, amely .torrent fájlokat tartalmaz. Minden fájl helyben kerül feldolgozásra, és az alábbi listában jelenik meg - semmilyen adat nem kerül elküldésre a Hozzáadás gombra kattintásig.",
            "line2": "Használja a Frissítés gombot vagy a Rekurzív kapcsolót a mappa újbóli beolvasásához, ha fájlokat adott hozzá vagy távolított el a lemezen."
          }
        },
```

Add `description` to the `"folder-picker"` block (mirrors Step 3, around line 199):

```json
        "description": {
          "line1": "Válasszon egy mappát, amely .torrent fájlokat tartalmaz. Minden fájl helyben kerül feldolgozásra, és az alábbi listában jelenik meg - semmilyen adat nem kerül elküldésre a Hozzáadás gombra kattintásig.",
          "line2": "Használja a Frissítés gombot vagy a Rekurzív kapcsolót a mappa újbóli beolvasásához, ha fájlokat adott hozzá vagy távolított el a lemezen.",
          "line3": "Duplán kattintva egy sor Nevére, átnevezheted azt hozzáadás előtt - csak az új, még hozzá nem adott torrentek választhatók ki."
        },
```

- [ ] **Step 5: Validate both JSON files parse**

Run: `node -e "JSON.parse(require('fs').readFileSync('public/i18n/us.json','utf8')); JSON.parse(require('fs').readFileSync('public/i18n/hu.json','utf8')); console.log('ok')"`
Expected: `ok`

- [ ] **Step 6: Commit**

```bash
git add public/i18n/us.json public/i18n/hu.json
git commit -m "#235: correct add-torrent input-mode popover and move folder popover copy inline"
```

---

### Task 2: Widen the folder-picker to col-12 in `general.html`

**Files:**

- Modify: `packages/app/src/app/modals/add-torrent/general/general.html:59-156`
- Modify: `packages/app/src/app/modals/add-torrent/general/general.spec.ts`

**Interfaces:**

- Consumes: i18n keys from Task 1 (`popover.input-mode.description.line1`, no more `line2`).
- Produces: nothing consumed by later tasks - this is a template-only change.

- [ ] **Step 1: Write the failing tests in `general.spec.ts`**

Add a new test inside the existing `describe('fieldset layout', ...)` block (after the "should
make the input-mode toggle full width..." test, `packages/app/src/app/modals/add-torrent/general/general.spec.ts:160`):

```ts
it('should give the folder picker the full row width with no adjacent popover', () => {
  fixture.componentRef.setInput('inputMode', 'folder');
  fixture.detectChanges();

  const picker: HTMLElement = fixture.nativeElement.querySelector('app-add-torrent-folder-picker');
  expect(picker.parentElement?.classList.contains('col-12')).toBe(true);

  // In folder mode the "Torrent" fieldset's rename/name-popover and size/free-space popovers
  // never render (guarded by `inputMode() !== 'folder'` / `=== 'file'`), so only 2 direct
  // popovers remain (input-mode, save-path) - the removed folder popover is not one of them -
  // plus 1 each from the nested category/tag select components.
  expect(fixture.nativeElement.querySelectorAll('bb-popover').length).toBe(4);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test --workspace=@bitbutler/app -- general.spec.ts -t "full row width"`
Expected: FAIL - `picker.parentElement` has class `col-11`, not `col-12` (or the popover count is 6, not 5).

- [ ] **Step 3: Restructure `general.html`'s Input fieldset grid/popover row**

In `packages/app/src/app/modals/add-torrent/general/general.html`, replace lines 67-156 (the
`<div class="col-11">` containing the file/link/folder switch through the closing `<div
class="col-1">` popover block) with:

```html
@if (inputMode() === 'folder') {
<div class="col-12">
  <app-add-torrent-folder-picker [form]="form()"></app-add-torrent-folder-picker>
</div>
} @else {
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

        <button type="button" class="btn btn-outline-primary btn-split" (click)="fileInput.click()">
          <bb-btn-content
            [icon]="icons.faFolderOpen"
            [text]="'general.button.browse' | translate"
            position="end"
          ></bb-btn-content>
        </button>
      </div>
      <input type="file" #fileInput hidden accept=".torrent" (change)="fileSelected.emit($event)" />
    </div>
  </div>
  } @else {
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
  } @else {
  <bb-popover
    class="mt-2"
    [subject]="'components.add-torrent.popover.links.title' | translate"
    [description]="linksPopover"
    placement="left"
  ></bb-popover>
  }
</div>
}
```

Note this keeps the `col-11` block's `[formGroup]` context (it's inherited from the outer
`<div [formGroup]="form()">` wrapper), and the file/link markup is unchanged from before - only
the folder branch and the popover column moved.

- [ ] **Step 4: Remove the now-unused `#folderPopover` template**

Delete this block near the bottom of `general.html`:

```html
<ng-template #folderPopover>
  <p>{{ 'components.add-torrent.popover.folder.description.line1' | translate }}</p>
  <p>{{ 'components.add-torrent.popover.folder.description.line2' | translate }}</p>
</ng-template>
```

- [ ] **Step 5: Remove the now-invalid `line2` binding from `#inputModePopover`**

Change:

```html
<ng-template #inputModePopover>
  <p>{{ 'components.add-torrent.popover.input-mode.description.line1' | translate }}</p>
  <p>{{ 'components.add-torrent.popover.input-mode.description.line2' | translate }}</p>
</ng-template>
```

to:

```html
<ng-template #inputModePopover>
  <p>{{ 'components.add-torrent.popover.input-mode.description.line1' | translate }}</p>
</ng-template>
```

- [ ] **Step 6: Run the test to verify it passes**

Run: `npm test --workspace=@bitbutler/app -- general.spec.ts`
Expected: PASS (all `general.spec.ts` tests, including the new one and the existing
"should make the input-mode toggle full width and show a popover beside it" test which still
expects 6 popovers in file mode - unaffected since it never rendered the folder popover).

- [ ] **Step 7: Commit**

```bash
git add packages/app/src/app/modals/add-torrent/general/general.html packages/app/src/app/modals/add-torrent/general/general.spec.ts
git commit -m "#235: widen the folder picker to full width and drop its adjacent popover"
```

---

### Task 3: Inline folder description text under the recursive switch

**Files:**

- Modify: `packages/app/src/app/modals/add-torrent/general/folder-picker/folder-picker.html`
- Modify: `packages/app/src/app/modals/add-torrent/general/folder-picker/folder-picker.spec.ts`

**Interfaces:**

- Consumes: i18n keys from Task 1 (`components.add-torrent.folder-picker.description.line1/2/3`).
- Produces: `(gridReady)` binding on the `ag-grid-angular` element, which Task 5's
  `onGridReady(e: GridReadyEvent<ScannedTorrentEntry>)` method will handle.

- [ ] **Step 1: Write the failing test**

Add to `packages/app/src/app/modals/add-torrent/general/folder-picker/folder-picker.spec.ts`, as
a new top-level `it` (after the existing standalone `it` blocks, before the `describe('grid
wiring', ...)` block):

```ts
it('should render the inline folder description text under the recursive switch', () => {
  init('/downloads');

  const description: HTMLElement = fixture.nativeElement.querySelector('.folder-description');

  expect(description).toBeTruthy();
  expect(description.textContent).toContain(
    'components.add-torrent.folder-picker.description.line1',
  );
  expect(description.textContent).toContain(
    'components.add-torrent.folder-picker.description.line3',
  );
});
```

(The translate pipe is not mocked in this spec file, so the raw translation keys appear as text
content - matching the existing convention used by other specs in this repo that assert on
`textContent` for translated strings, e.g. `general.spec.ts`'s legend assertions. `.folder-description`
is a plain CSS class added for this block - the codebase has no `data-testid` convention, so tests
select on existing classes/ids the same way `general.spec.ts` and `folder-picker.spec.ts` already do.)

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test --workspace=@bitbutler/app -- folder-picker.spec.ts -t "inline folder description"`
Expected: FAIL - no element matches `.folder-description`.

- [ ] **Step 3: Add the inline description block to `folder-picker.html`**

In `packages/app/src/app/modals/add-torrent/general/folder-picker/folder-picker.html`, insert
the new block directly after the existing recursive-switch `<div formGroupName="folderGroup"
class="form-check form-switch mb-2">...</div>` (currently lines 34-50) and before the
`@if (scanError())` block:

```html
<div class="form-text folder-description mb-2">
  <p class="mb-1">{{ 'components.add-torrent.folder-picker.description.line1' | translate }}</p>
  <p class="mb-1">{{ 'components.add-torrent.folder-picker.description.line2' | translate }}</p>
  <p class="mb-0">{{ 'components.add-torrent.folder-picker.description.line3' | translate }}</p>
</div>
```

- [ ] **Step 4: Add the `(gridReady)` binding to the ag-grid element**

Change the `<ag-grid-angular ... />` element in the same file to include `(gridReady)`:

```html
<ag-grid-angular
  class="w-100 d-block mb-2"
  style="height: 320px"
  (gridReady)="onGridReady($event)"
  [loading]="loading()"
  [rowData]="rows()"
  [columnDefs]="colDefs"
  [gridOptions]="gridOptions"
  [theme]="theme() === 'dark' ? bbDark : bbLight"
/>
```

(`onGridReady` doesn't exist yet - it's added in Task 5. This step alone will not compile/pass
tests standalone; Task 5 must land in the same PR before merge, but each task's tests are run
independently per the granularity rules. To keep this task's build green on its own, Step 4 is
folded into Task 5's Step 3 instead - see note below.)

**Note:** Skip Step 4 in this task. The `(gridReady)` binding is added in Task 5 Step 3 alongside
the `onGridReady` method it calls, so this task's changes compile standalone.

- [ ] **Step 5: Run the test to verify it passes**

Run: `npm test --workspace=@bitbutler/app -- folder-picker.spec.ts`
Expected: PASS (all folder-picker.spec.ts tests).

- [ ] **Step 6: Commit**

```bash
git add packages/app/src/app/modals/add-torrent/general/folder-picker/folder-picker.html packages/app/src/app/modals/add-torrent/general/folder-picker/folder-picker.spec.ts
git commit -m "#235: show the folder picker description inline under the recursive switch"
```

---

### Task 4: `AddTorrentGridSettingsService`

**Files:**

- Create: `packages/app/src/app/models/add-torrent-grid.model.ts`
- Create: `packages/app/src/app/services/add-torrent-grid.settings.service.ts`
- Create: `packages/app/src/app/services/add-torrent-grid.settings.service.spec.ts`

**Interfaces:**

- Produces: `AddTorrentGridSettings { columnState: ColumnState[] }`,
  `DEFAULT_ADD_TORRENT_GRID_SETTINGS: AddTorrentGridSettings`, and
  `AddTorrentGridSettingsService` (with inherited `load(): Promise<AddTorrentGridSettings>`,
  `save(settings: AddTorrentGridSettings): Promise<void>`, `asObservable(): Observable<AddTorrentGridSettings>`
  from `BaseSettingsService`). Consumed by Task 5's `folder-picker.ts`.

- [ ] **Step 1: Write the failing test file**

Create `packages/app/src/app/services/add-torrent-grid.settings.service.spec.ts`:

```ts
import { TestBed } from '@angular/core/testing';
import { DEFAULT_ADD_TORRENT_GRID_SETTINGS } from '../models/add-torrent-grid.model';
import { AddTorrentGridSettingsService } from './add-torrent-grid.settings.service';
import { SettingsService } from './settings.service';

describe('AddTorrentGridSettingsService', () => {
  let service: AddTorrentGridSettingsService;
  let mockSettingsService: { get: ReturnType<typeof vi.fn>; set: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    mockSettingsService = {
      get: vi.fn().mockResolvedValue(null),
      set: vi.fn().mockResolvedValue(undefined),
    };

    TestBed.configureTestingModule({
      providers: [
        AddTorrentGridSettingsService,
        { provide: SettingsService, useValue: mockSettingsService },
      ],
    });

    service = TestBed.inject(AddTorrentGridSettingsService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should have a non-empty string settings ID', () => {
    expect(typeof (service as any).SETTINGS_ID).toBe('string');
    expect((service as any).SETTINGS_ID.length).toBeGreaterThan(0);
  });

  it('should return default settings when nothing is stored', async () => {
    const settings = await service.load();
    expect(settings).toEqual(DEFAULT_ADD_TORRENT_GRID_SETTINGS);
  });

  it('default column state has 6 entries', async () => {
    const settings = await service.load();
    expect(settings.columnState).toHaveLength(6);
  });

  it('every default column has a colId', async () => {
    const settings = await service.load();
    expect(settings.columnState.every((c) => !!c.colId)).toBe(true);
  });

  it('default column state covers expected colIds', async () => {
    const settings = await service.load();
    const ids = settings.columnState.map((c) => c.colId);
    expect(ids).toEqual(
      expect.arrayContaining(['name', 'state', 'size', 'fileCount', 'folderCount', 'relativePath']),
    );
  });

  it('should merge stored column state over defaults', async () => {
    const stored = [{ colId: 'name', hide: true, width: 200 }];
    mockSettingsService.get.mockResolvedValue({ columnState: stored });
    const settings = await service.load();
    expect(settings.columnState).toEqual(stored);
  });

  it('should save column state under the service settings ID', async () => {
    const columnState = [{ colId: 'name', hide: false }];
    await service.save({ columnState });
    expect(mockSettingsService.set).toHaveBeenCalledWith((service as any).SETTINGS_ID, {
      columnState,
    });
  });

  it('should emit settings via asObservable after load', async () => {
    const emitted: any[] = [];
    service.asObservable().subscribe((s) => emitted.push(s));
    await service.load();
    expect(emitted.length).toBeGreaterThan(0);
    expect(emitted[0]).toEqual(DEFAULT_ADD_TORRENT_GRID_SETTINGS);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test --workspace=@bitbutler/app -- add-torrent-grid.settings.service.spec.ts`
Expected: FAIL - cannot find module `../models/add-torrent-grid.model` / `./add-torrent-grid.settings.service`.

- [ ] **Step 3: Create the model file**

Create `packages/app/src/app/models/add-torrent-grid.model.ts`:

```ts
import type { ColumnState } from 'ag-grid-community';

export interface AddTorrentGridSettings {
  columnState: ColumnState[];
}

export const DEFAULT_ADD_TORRENT_GRID_SETTINGS: AddTorrentGridSettings = {
  columnState: [
    { colId: 'name', hide: false, flex: 2 },
    { colId: 'state', hide: false, width: 120 },
    { colId: 'size', hide: false, width: 130 },
    { colId: 'fileCount', hide: false, width: 100 },
    { colId: 'folderCount', hide: false, width: 100 },
    { colId: 'relativePath', hide: false, flex: 1 },
  ],
};
```

- [ ] **Step 4: Create the service file**

Create `packages/app/src/app/services/add-torrent-grid.settings.service.ts`:

```ts
import { Injectable } from '@angular/core';
import {
  AddTorrentGridSettings,
  DEFAULT_ADD_TORRENT_GRID_SETTINGS,
} from '../models/add-torrent-grid.model';
import { BaseSettingsService } from './base-settings.service';

@Injectable({ providedIn: 'root' })
export class AddTorrentGridSettingsService extends BaseSettingsService<AddTorrentGridSettings> {
  protected readonly SETTINGS_ID = 'AddTorrentGridSettingsService';
  protected readonly DEFAULT_SETTINGS = DEFAULT_ADD_TORRENT_GRID_SETTINGS;
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npm test --workspace=@bitbutler/app -- add-torrent-grid.settings.service.spec.ts`
Expected: PASS (all 9 tests).

- [ ] **Step 6: Commit**

```bash
git add packages/app/src/app/models/add-torrent-grid.model.ts packages/app/src/app/services/add-torrent-grid.settings.service.ts packages/app/src/app/services/add-torrent-grid.settings.service.spec.ts
git commit -m "#235: add AddTorrentGridSettingsService for folder-picker column persistence"
```

---

### Task 5: Wire column-state persistence, autosize-until-customized, and header context menu into `folder-picker.ts`

**Files:**

- Modify: `packages/app/src/app/modals/add-torrent/general/folder-picker/folder-picker.ts`
- Modify: `packages/app/src/app/modals/add-torrent/general/folder-picker/folder-picker.html` (add the `(gridReady)` binding skipped in Task 3)
- Modify: `packages/app/src/app/modals/add-torrent/general/folder-picker/folder-picker.spec.ts`

**Interfaces:**

- Consumes: `AddTorrentGridSettingsService` and `AddTorrentGridSettings`/`DEFAULT_ADD_TORRENT_GRID_SETTINGS` from Task 4; `ContextMenuService` (`packages/app/src/app/services/context-menu.service.ts`, method `open({ items, payload? })`); `GridContextMenuService` (`packages/app/src/app/pages/main/grid/context-menu/grid-context-menu.service.ts`, method `buildHeaderMenu(event: ColumnHeaderContextMenuEvent<any, any>): ContextMenuEntry[]`).
- Produces: `onGridReady(e: GridReadyEvent<ScannedTorrentEntry>): void` (consumed by the
  `(gridReady)` binding in `folder-picker.html`), plus private `gridApi`, `isRestoringState`,
  `isDefaultLayout`, `saveState$`, `restoreColumnState()`, `persistColumnState()`, `queueSave()`.

- [ ] **Step 1: Write the failing tests**

Add the following imports to the top of
`packages/app/src/app/modals/add-torrent/general/folder-picker/folder-picker.spec.ts`, alongside
the existing ones:

```ts
import { DEFAULT_ADD_TORRENT_GRID_SETTINGS } from '../../../../models/add-torrent-grid.model';
import { GridContextMenuService } from '../../../../pages/main/grid/context-menu/grid-context-menu.service';
import { AddTorrentGridSettingsService } from '../../../../services/add-torrent-grid.settings.service';
import { ContextMenuService } from '../../../../services/context-menu.service';
```

Change the `beforeEach` block's `TestBed.configureTestingModule` call to add the three new mocked
providers (keep the existing `TorrentStoreService`/`ThemeService` providers as-is):

```ts
let mockSettingsService: { load: ReturnType<typeof vi.fn>; save: ReturnType<typeof vi.fn> };
let mockContextMenuService: { open: ReturnType<typeof vi.fn> };

beforeEach(async () => {
  torrentsMap = signal(new Map());
  mockSettingsService = {
    load: vi.fn().mockResolvedValue({ columnState: [] }),
    save: vi.fn().mockResolvedValue(undefined),
  };
  mockContextMenuService = { open: vi.fn() };

  await TestBed.configureTestingModule({
    imports: [AddTorrentFolderPicker],
    providers: [
      { provide: TorrentStoreService, useValue: { torrentsMap } },
      { provide: ThemeService, useValue: { effectiveMode: signal('light') } },
      { provide: AddTorrentGridSettingsService, useValue: mockSettingsService },
      { provide: ContextMenuService, useValue: mockContextMenuService },
      {
        provide: GridContextMenuService,
        useValue: { buildHeaderMenu: vi.fn().mockReturnValue([]) },
      },
    ],
  }).compileComponents();

  fixture = TestBed.createComponent(AddTorrentFolderPicker);
  component = fixture.componentInstance;
});
```

(`mockSettingsService.load` defaults to `{ columnState: [] }` - an empty, non-default array
reference - so existing tests that don't care about column state keep working without extra
setup; the `isDefaultLayout` behavior is asserted explicitly below with its own mock return
value.)

Add a new `describe('column state management', ...)` block, mirroring `trackers.spec.ts`, after
the existing `describe('grid wiring', ...)` block:

```ts
describe('column state management', () => {
  it('restoreColumnState loads settings and applies column state', async () => {
    const state = [{ colId: 'name', hide: false, flex: 2 }];
    mockSettingsService.load.mockResolvedValue({ columnState: state });
    const mockApi = { applyColumnState: vi.fn(), getColumnState: vi.fn().mockReturnValue([]) };
    (component as any).gridApi = mockApi;

    await (component as any).restoreColumnState();

    expect(mockSettingsService.load).toHaveBeenCalled();
    expect(mockApi.applyColumnState).toHaveBeenCalledWith({ state, applyOrder: true });
  });

  it('persistColumnState reads column state and saves it', async () => {
    const state = [{ colId: 'name', hide: false, flex: 2 }];
    const mockApi = { applyColumnState: vi.fn(), getColumnState: vi.fn().mockReturnValue(state) };
    (component as any).gridApi = mockApi;

    await (component as any).persistColumnState();

    expect(mockApi.getColumnState).toHaveBeenCalled();
    expect(mockSettingsService.save).toHaveBeenCalledWith({ columnState: state });
  });

  it('restoreColumnState does nothing when gridApi is null', async () => {
    (component as any).gridApi = null;
    await (component as any).restoreColumnState();
    expect(mockSettingsService.load).not.toHaveBeenCalled();
  });

  it('persistColumnState does nothing when gridApi is null', async () => {
    (component as any).gridApi = null;
    await (component as any).persistColumnState();
    expect(mockSettingsService.save).not.toHaveBeenCalled();
  });

  it('queueSave does not emit when isRestoringState is true', () => {
    (component as any).isRestoringState = true;
    const next = vi.spyOn((component as any).saveState$, 'next');
    (component as any).queueSave();
    expect(next).not.toHaveBeenCalled();
  });

  it('queueSave emits when isRestoringState is false', () => {
    (component as any).isRestoringState = false;
    const next = vi.spyOn((component as any).saveState$, 'next');
    (component as any).queueSave();
    expect(next).toHaveBeenCalled();
  });

  it('restoreColumnState marks the layout as default when settings.columnState is the default reference', async () => {
    const mockApi = { applyColumnState: vi.fn(), getColumnState: vi.fn() };
    mockSettingsService.load.mockResolvedValue(DEFAULT_ADD_TORRENT_GRID_SETTINGS);
    (component as any).gridApi = mockApi;

    await (component as any).restoreColumnState();

    expect((component as any).isDefaultLayout).toBe(true);
  });

  it('restoreColumnState marks the layout as customized when settings.columnState came from storage', async () => {
    mockSettingsService.load.mockResolvedValue({ columnState: [{ colId: 'name', width: 500 }] });
    const mockApi = { applyColumnState: vi.fn(), getColumnState: vi.fn() };
    (component as any).gridApi = mockApi;

    await (component as any).restoreColumnState();

    expect((component as any).isDefaultLayout).toBe(false);
  });
});

describe('autosize on first render', () => {
  it('autosizes all columns on first data render when the layout is still default', () => {
    init('/downloads');
    (component as any).isDefaultLayout = true;
    const api = { autoSizeAllColumns: vi.fn() };

    component.gridOptions.onFirstDataRendered!({ api } as any);

    expect(api.autoSizeAllColumns).toHaveBeenCalled();
  });

  it('does not autosize when the layout was customized', () => {
    init('/downloads');
    (component as any).isDefaultLayout = false;
    const api = { autoSizeAllColumns: vi.fn() };

    component.gridOptions.onFirstDataRendered!({ api } as any);

    expect(api.autoSizeAllColumns).not.toHaveBeenCalled();
  });
});

describe('header context menu', () => {
  function makeHeaderEvent() {
    const column = {
      getId: vi.fn().mockReturnValue('name'),
      getColDef: vi.fn().mockReturnValue({ colId: 'name', headerName: 'Name', filter: false }),
      getSort: vi.fn().mockReturnValue(null),
      isFilterActive: vi.fn().mockReturnValue(false),
      isPinnedLeft: vi.fn().mockReturnValue(false),
      isPinnedRight: vi.fn().mockReturnValue(false),
      getPinned: vi.fn().mockReturnValue(null),
      isVisible: vi.fn().mockReturnValue(true),
    };
    const api = {
      getDisplayNameForColumn: vi.fn().mockReturnValue('Name'),
      getColumnDefs: vi.fn().mockReturnValue([]),
      getColumns: vi.fn().mockReturnValue([column]),
      getColumn: vi.fn().mockReturnValue(column),
    };
    return { column, api };
  }

  it('opens context menu when column header is right-clicked', () => {
    init('/downloads');
    const { column, api } = makeHeaderEvent();
    component.gridOptions.onColumnHeaderContextMenu?.({ column, api } as any);
    expect(mockContextMenuService.open).toHaveBeenCalled();
  });

  it('does not open context menu when the event has no column', () => {
    init('/downloads');
    component.gridOptions.onColumnHeaderContextMenu?.({ column: null, api: {} } as any);
    expect(mockContextMenuService.open).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test --workspace=@bitbutler/app -- folder-picker.spec.ts`
Expected: FAIL - `AddTorrentGridSettingsService`/`ContextMenuService`/`GridContextMenuService`
providers are unused by the component (no injection sites yet), `component.gridApi`,
`isRestoringState`, `isDefaultLayout`, `saveState$`, `restoreColumnState`, `persistColumnState`,
`queueSave` don't exist, and `gridOptions.onFirstDataRendered`/`onColumnHeaderContextMenu` are
undefined.

- [ ] **Step 3: Implement the component changes**

In `packages/app/src/app/modals/add-torrent/general/folder-picker/folder-picker.ts`:

Add these imports (alongside the existing `ag-grid-community` import block and other imports):

```ts
import { DestroyRef, ... } from '@angular/core'; // DestroyRef already imported - no change needed
import {
  AllCommunityModule,
  CellValueChangedEvent,
  ColDef,
  Column,
  ColumnHeaderContextMenuEvent,
  FirstDataRenderedEvent,
  GetRowIdParams,
  GridApi,
  GridOptions,
  GridReadyEvent,
  IOverlayParams,
  ModuleRegistry,
  RowDataUpdatedEvent,
  SelectionChangedEvent,
  ValueFormatterParams,
} from 'ag-grid-community';
import { Subject, debounceTime } from 'rxjs';
import {
  AddTorrentGridSettings,
  DEFAULT_ADD_TORRENT_GRID_SETTINGS,
} from '../../../../models/add-torrent-grid.model';
import { GridContextMenuService } from '../../../../pages/main/grid/context-menu/grid-context-menu.service';
import { AddTorrentGridSettingsService } from '../../../../services/add-torrent-grid.settings.service';
import { ContextMenuService } from '../../../../services/context-menu.service';
```

(`ColumnHeaderContextMenuEvent`, `FirstDataRenderedEvent`, `GridApi`, `GridReadyEvent` are new
additions to the existing `ag-grid-community` import; `Subject`/`debounceTime` and the three
service/model imports are entirely new.)

Add three injected services alongside the existing ones:

```ts
  private readonly contextMenuService = inject(ContextMenuService);
  private readonly gridContextMenuService = inject(GridContextMenuService);
  private readonly addTorrentGridSettingsService = inject(AddTorrentGridSettingsService);
```

Add private state fields alongside `cache`/`hasScannedOnce`:

```ts
  private gridApi: GridApi<ScannedTorrentEntry> | null = null;
  private isRestoringState = false;
  private isDefaultLayout = true;
  private readonly saveState$ = new Subject<void>();
```

In `ngOnInit`, add the debounced save subscription (alongside the existing
`recursiveControl.valueChanges` subscription):

```ts
  public async ngOnInit(): Promise<void> {
    this.saveState$.pipe(debounceTime(500), takeUntilDestroyed(this.destroyRef)).subscribe(() => {
      void this.persistColumnState();
    });

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
```

Add the new public/private methods (place after `refresh()` and before `renameEntry()`, or any
sensible spot in the class body):

```ts
  public onGridReady(e: GridReadyEvent<ScannedTorrentEntry>): void {
    this.gridApi = e.api;
    void this.restoreColumnState();
  }

  private async restoreColumnState(): Promise<void> {
    if (!this.gridApi) return;
    this.isRestoringState = true;
    try {
      const settings: AddTorrentGridSettings = await this.addTorrentGridSettingsService.load();
      this.isDefaultLayout = settings.columnState === DEFAULT_ADD_TORRENT_GRID_SETTINGS.columnState;
      this.gridApi.applyColumnState({ state: settings.columnState, applyOrder: true });
    } finally {
      this.isRestoringState = false;
    }
  }

  private async persistColumnState(): Promise<void> {
    if (!this.gridApi) return;
    const columnState = this.gridApi.getColumnState();
    await this.addTorrentGridSettingsService.save({ columnState });
  }

  private queueSave(): void {
    if (this.isRestoringState) return;
    this.saveState$.next();
  }
```

Update the `gridOptions` object literal to add the new handlers (keep every existing property -
`rowSelection`, `isRowSelectable`, `getRowId`, `overlayComponentSelector`,
`onSelectionChanged`, `onRowDataUpdated`, `onCellValueChanged` - unchanged, just add these):

```ts
    onColumnResized: (e) => {
      if (e.finished) this.queueSave();
    },
    onColumnMoved: () => this.queueSave(),
    onColumnPinned: () => this.queueSave(),
    onColumnVisible: () => this.queueSave(),
    onSortChanged: () => this.queueSave(),
    onFirstDataRendered: (e: FirstDataRenderedEvent<ScannedTorrentEntry>) => {
      if (this.isDefaultLayout) e.api.autoSizeAllColumns();
    },
    onColumnHeaderContextMenu: (e: ColumnHeaderContextMenuEvent<ScannedTorrentEntry>) => {
      if (!e.column) return;
      this.contextMenuService.open({
        items: this.gridContextMenuService.buildHeaderMenu(e),
        payload: {
          colId: e.column.getId(),
          displayName: e.api.getDisplayNameForColumn(e.column as Column, 'header'),
        },
      });
    },
```

- [ ] **Step 4: Add the `(gridReady)` binding to `folder-picker.html`**

(This is the binding deferred from Task 3 Step 4.) In
`packages/app/src/app/modals/add-torrent/general/folder-picker/folder-picker.html`, update the
`<ag-grid-angular>` element:

```html
<ag-grid-angular
  class="w-100 d-block mb-2"
  style="height: 320px"
  (gridReady)="onGridReady($event)"
  [loading]="loading()"
  [rowData]="rows()"
  [columnDefs]="colDefs"
  [gridOptions]="gridOptions"
  [theme]="theme() === 'dark' ? bbDark : bbLight"
/>
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npm test --workspace=@bitbutler/app -- folder-picker.spec.ts`
Expected: PASS (all tests, including the new column-state, autosize, and header-context-menu
describe blocks).

- [ ] **Step 6: Run the full app test suite and lint**

Run: `npm test --workspace=@bitbutler/app`
Expected: PASS, no regressions in `general.spec.ts` or elsewhere.

Run: `npm run lint`
Expected: zero warnings/errors.

- [ ] **Step 7: Commit**

```bash
git add packages/app/src/app/modals/add-torrent/general/folder-picker/folder-picker.ts packages/app/src/app/modals/add-torrent/general/folder-picker/folder-picker.html packages/app/src/app/modals/add-torrent/general/folder-picker/folder-picker.spec.ts
git commit -m "#235: persist folder-picker column layout, autosize until customized, add header context menu"
```

---

## Final Verification

- [ ] **Step 1: Run the full workspace test suite**

Run: `npm test`
Expected: PASS across all workspaces.

- [ ] **Step 2: Run the full lint**

Run: `npm run lint`
Expected: zero warnings (per `CLAUDE.md`, `max-warnings=0`).

- [ ] **Step 3: Manually verify in the running app**

Run: `npm start`. Open Add Torrent, switch to Folder mode, pick a folder with a few `.torrent`
files, confirm:

- The Input Mode popover text is accurate and doesn't mention resetting fields.
- No popover sits beside the grid; the grid spans the full modal width.
- The description text appears under the Recursive switch, mentions inline renaming.
- Columns auto-fit the scanned content on first open (fresh profile / no saved settings).
- Resizing a column, closing, and reopening the modal restores the resized width (no autosize
  override).
- Right-clicking a column header opens the sort/pin/resize/columns menu.

- [ ] **Step 4: Remove the docs/superpowers folder before opening the PR**

Per `CLAUDE.md`: specs/plans must not be merged to main.

```bash
git rm -r docs/superpowers
git commit -m "#235: removed spec and plan"
```
