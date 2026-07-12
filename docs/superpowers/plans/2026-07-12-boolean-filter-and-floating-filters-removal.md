# Boolean Column Filter + Floating Filters Removal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a custom `BooleanColumnFilter` popup filter for the torrent grid's 5 boolean columns (which currently use a nonexistent `'agBooleanColumnFilter'` and silently don't filter at all), then remove the now-fully-dead floating-filters toggle feature from the main torrent grid only.

**Architecture:** `BooleanColumnFilter` is a new standalone Angular component under `packages/app/src/app/components/column-filters/`, extending the existing `OperatorFilterBase<TValue>` abstract class exactly like `NumberColumnFilter`/`TextColumnFilter` do - inheriting `apply()`/`clear()`/`isApplyDisabled()`/`getModel()`/`setModel()`/`afterGuiAttached()` and only implementing the type-specific hooks (`createEmptyValue`, `valuesEqual`, `isActive`, `isValidModel`, `doesFilterPass`). The floating-filters removal deletes the now-dead `colDef.floatingFilter` wiring, persisted setting, settings-modal checkbox, and context-menu toggle - but only for the main grid (`grid.ts`/`grid.lib.ts`/`torrent-list-grid` settings tab). The Trackers and Peers modal grids keep the feature unchanged, since they still use built-in ag-Grid filters where floating filters actually work.

**Tech Stack:** Angular 20 (standalone components, signals), `@ng-select/ng-select`, `@ngx-translate/core`, ag-Grid Community + `ag-grid-angular` custom filter components, Vitest (`@angular/build:unit-test` runner via `npm run test --workspace=@bitbutler/app`).

## Global Constraints

- Floating-filters removal is scoped to the **main torrent grid only** (`packages/app/src/app/pages/main/grid/` and its settings tab). The Trackers (`modals/torrent-details/trackers/`) and Peers (`modals/torrent-details/peers/`) modal grids are untouched and keep their working floating-filters toggle.
- Boolean filter option labels: **"True" / "False"** (translated via new i18n keys).
- The new `<ng-select>` uses the same `.form-floating` wrapper + `<label>` style as every other custom column filter, is `[clearable]="true"`, `[searchable]="false"`, and uses `[appendTo]="popupPortalSelector"` (the `OperatorFilterBase` ag-grid-popup fix for ng-select's appended dropdown panel).
- Clear/Apply buttons: same side-by-side `btn-split flex-fill` pair (`d-flex gap-2`) used by every other filter's current layout - not the older stacked layout.
- All new/removed translation keys are applied to **both** `public/i18n/us.json` and `public/i18n/hu.json`.
- No changes to any other column filter's matching logic, styling, or to the Trackers/Peers grids.

---

### Task 1: Add "True"/"False" translation keys

**Files:**

- Modify: `public/i18n/us.json:1036-1040`
- Modify: `public/i18n/hu.json:1036-1040`

**Interfaces:**

- Produces: translation keys `components.column-filters.boolean.true` and `components.column-filters.boolean.false`, consumed by Task 2's `BooleanColumnFilter` component.

- [ ] **Step 1: Add the new keys to `public/i18n/us.json`**

Find this block (around line 1036):

```json
      "set": {
        "filter-placeholder": "Filter...",
        "no-matches": "No matching values"
      }
    }
  },
```

Replace with:

```json
      "set": {
        "filter-placeholder": "Filter...",
        "no-matches": "No matching values"
      },
      "boolean": {
        "true": "True",
        "false": "False"
      }
    }
  },
```

- [ ] **Step 2: Add the new keys to `public/i18n/hu.json`**

Find this block (around line 1036):

```json
      "set": {
        "filter-placeholder": "Szűrés...",
        "no-matches": "Nincs egyező érték"
      }
    }
  },
```

Replace with:

```json
      "set": {
        "filter-placeholder": "Szűrés...",
        "no-matches": "Nincs egyező érték"
      },
      "boolean": {
        "true": "Igaz",
        "false": "Hamis"
      }
    }
  },
```

- [ ] **Step 3: Commit**

```bash
git add public/i18n/us.json public/i18n/hu.json
git commit -m "#216: add True/False translation keys for boolean column filter"
```

---

### Task 2: Create BooleanColumnFilter component

**Files:**

- Create: `packages/app/src/app/components/column-filters/boolean-column-filter/boolean-column-filter.ts`
- Create: `packages/app/src/app/components/column-filters/boolean-column-filter/boolean-column-filter.html`
- Create: `packages/app/src/app/components/column-filters/boolean-column-filter/boolean-column-filter.scss`
- Test: `packages/app/src/app/components/column-filters/boolean-column-filter/boolean-column-filter.spec.ts`

**Interfaces:**

- Consumes: `OperatorFilterBase<TValue>` from `../operator-filter-base` (abstract `params`, `popupPortalSelector`, `agInit`, `ngOnDestroy`, `isFilterActive`, `getModel`, `setModel`, `afterGuiAttached`, `apply`, `clear`, `isApplyDisabled`); `createFilterInstanceId` from `../filter-instance-id.utils`; `BbBtnContent` from `../../bb-btn-content/bb-btn-content`; i18n keys `components.column-filters.label.value`, `components.column-filters.boolean.true`, `components.column-filters.boolean.false`, `general.button.clear`, `general.button.apply` (added in Task 1 / already existing).
- Produces: `BooleanColumnFilter` class and `BooleanFilterValue { value: boolean | null }` interface, both imported by Task 3's `grid.lib.ts` wiring.

- [ ] **Step 1: Write the failing test**

Create `packages/app/src/app/components/column-filters/boolean-column-filter/boolean-column-filter.spec.ts`:

```typescript
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { BooleanColumnFilter } from './boolean-column-filter';

describe('BooleanColumnFilter', () => {
  let component: BooleanColumnFilter;
  let fixture: ComponentFixture<BooleanColumnFilter>;
  let mockParams: any;

  beforeEach(async () => {
    mockParams = {
      filterChangedCallback: vi.fn(),
      getValue: vi.fn((node: { data: any }) => node.data?.auto_tmm),
    };

    await TestBed.configureTestingModule({
      imports: [BooleanColumnFilter],
    }).compileComponents();

    fixture = TestBed.createComponent(BooleanColumnFilter);
    component = fixture.componentInstance;
    component.agInit(mockParams);
    fixture.detectChanges();
  });

  it('should create with an inactive default filter', () => {
    expect(component).toBeTruthy();
    expect(component.isFilterActive()).toBe(false);
  });

  it('exposes true/false value items, translated', () => {
    expect(component.valueItems()).toEqual([
      { value: true, label: expect.any(String) },
      { value: false, label: expect.any(String) },
    ]);
  });

  describe('doesFilterPass', () => {
    it('passes everything when the filter is inactive', () => {
      expect(component.doesFilterPass({ node: { data: { auto_tmm: true } } } as any)).toBe(true);
    });

    it('matches only rows equal to the applied true value', () => {
      component.applied = { value: true };
      expect(component.doesFilterPass({ node: { data: { auto_tmm: true } } } as any)).toBe(true);
      expect(mockParams.getValue).toHaveBeenCalled();
      expect(component.doesFilterPass({ node: { data: { auto_tmm: false } } } as any)).toBe(false);
    });

    it('matches only rows equal to the applied false value', () => {
      component.applied = { value: false };
      expect(component.doesFilterPass({ node: { data: { auto_tmm: false } } } as any)).toBe(true);
      expect(component.doesFilterPass({ node: { data: { auto_tmm: true } } } as any)).toBe(false);
    });

    it('excludes rows where the field is undefined', () => {
      component.applied = { value: true };
      expect(component.doesFilterPass({ node: { data: {} } } as any)).toBe(false);
    });
  });

  describe('isActive', () => {
    it('is inactive when value is null', () => {
      expect(component.isActive({ value: null })).toBe(false);
    });

    it('is active for both true and false', () => {
      expect(component.isActive({ value: true })).toBe(true);
      expect(component.isActive({ value: false })).toBe(true);
    });
  });

  describe('getModel / setModel', () => {
    it('returns null when the filter is inactive', () => {
      expect(component.getModel()).toBeNull();
    });

    it('restores both draft and applied from a model', () => {
      component.setModel({ value: false });
      expect(component.applied).toEqual({ value: false });
      expect(component.draft).toEqual({ value: false });
    });

    it('resets to an empty value when the model is null', () => {
      component.applied = { value: true };
      component.setModel(null);
      expect(component.applied).toEqual({ value: null });
    });

    it('falls back to an empty value for a shape-invalid (stale) model instead of throwing', () => {
      component.applied = { value: true };
      expect(() => component.setModel({ value: 'yes' } as any)).not.toThrow();
      expect(component.applied).toEqual({ value: null });
      expect(component.draft).toEqual({ value: null });
    });
  });

  describe('apply / clear', () => {
    it('apply copies draft into applied and calls filterChangedCallback', () => {
      component.draft = { value: true };
      component.apply();
      expect(component.applied).toEqual({ value: true });
      expect(mockParams.filterChangedCallback).toHaveBeenCalled();
    });

    it('clear resets both draft and applied and calls filterChangedCallback', () => {
      component.applied = { value: true };
      component.draft = { value: true };
      component.clear();
      expect(component.applied).toEqual({ value: null });
      expect(mockParams.filterChangedCallback).toHaveBeenCalled();
    });
  });

  describe('isApplyDisabled', () => {
    it('is disabled when draft equals applied', () => {
      component.applied = { value: true };
      component.draft = { value: true };
      expect(component.isApplyDisabled()).toBe(true);
    });

    it('is enabled when draft differs from applied', () => {
      component.applied = { value: null };
      component.draft = { value: false };
      expect(component.isApplyDisabled()).toBe(false);
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test --workspace=@bitbutler/app`
Expected: FAIL - `Cannot find module './boolean-column-filter'` (or similar resolution error), because the component doesn't exist yet.

- [ ] **Step 3: Write the component**

Create `packages/app/src/app/components/column-filters/boolean-column-filter/boolean-column-filter.ts`:

```typescript
import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { faCheck, faEraser } from '@fortawesome/free-solid-svg-icons';
import { NgSelectModule } from '@ng-select/ng-select';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { IFilterAngularComp } from 'ag-grid-angular';
import { IDoesFilterPassParams } from 'ag-grid-community';
import { BbBtnContent } from '../../bb-btn-content/bb-btn-content';
import { createFilterInstanceId } from '../filter-instance-id.utils';
import { OperatorFilterBase } from '../operator-filter-base';

export interface BooleanFilterValue {
  value: boolean | null;
}

function createEmptyBooleanValue(): BooleanFilterValue {
  return { value: null };
}

@Component({
  selector: 'app-boolean-column-filter',
  standalone: true,
  imports: [FormsModule, NgSelectModule, FontAwesomeModule, TranslateModule, BbBtnContent],
  templateUrl: './boolean-column-filter.html',
  styleUrl: './boolean-column-filter.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BooleanColumnFilter
  extends OperatorFilterBase<BooleanFilterValue>
  implements IFilterAngularComp
{
  private readonly translateService = inject(TranslateService);
  private readonly languageChanged = toSignal(this.translateService.onLangChange);

  public readonly icons = { faCheck, faEraser };
  public readonly instanceId = createFilterInstanceId('boolean-filter');

  draft: BooleanFilterValue = createEmptyBooleanValue();
  applied: BooleanFilterValue = createEmptyBooleanValue();

  readonly valueItems = computed(() => {
    this.languageChanged();
    return [
      {
        value: true,
        label: this.translateService.instant('components.column-filters.boolean.true'),
      },
      {
        value: false,
        label: this.translateService.instant('components.column-filters.boolean.false'),
      },
    ];
  });

  createEmptyValue(): BooleanFilterValue {
    return createEmptyBooleanValue();
  }

  valuesEqual(a: BooleanFilterValue, b: BooleanFilterValue): boolean {
    return a.value === b.value;
  }

  isActive(value: BooleanFilterValue): boolean {
    return value.value !== null;
  }

  isValidModel(model: unknown): model is BooleanFilterValue {
    if (model == null || typeof model !== 'object') return false;
    const candidate = model as Partial<BooleanFilterValue>;
    return candidate.value === null || typeof candidate.value === 'boolean';
  }

  doesFilterPass(params: IDoesFilterPassParams): boolean {
    if (!this.isFilterActive()) return true;
    const cellValue = this.params.getValue(params.node) as boolean | null | undefined;
    return cellValue === this.applied.value;
  }
}
```

Create `packages/app/src/app/components/column-filters/boolean-column-filter/boolean-column-filter.html`:

```html
<div
  class="bb-column-filter p-2"
  (mousedown)="$event.stopPropagation()"
  (touchstart)="$event.stopPropagation()"
>
  <div class="form-floating mb-2">
    <ng-select
      [id]="instanceId + '-value'"
      [items]="valueItems()"
      bindLabel="label"
      bindValue="value"
      [clearable]="true"
      [searchable]="false"
      [(ngModel)]="draft.value"
      [appendTo]="popupPortalSelector"
    ></ng-select>
    <label [for]="instanceId + '-value'"
      >{{ 'components.column-filters.label.value' | translate }}</label
    >
  </div>

  <div class="d-flex gap-2">
    <button
      class="btn btn-sm btn-outline-secondary btn-split flex-fill"
      type="button"
      (click)="clear()"
    >
      <bb-btn-content
        [icon]="icons.faEraser"
        [text]="'general.button.clear' | translate"
        [position]="'end'"
      ></bb-btn-content>
    </button>
    <button
      class="btn btn-sm btn-outline-primary btn-split flex-fill"
      type="button"
      [disabled]="isApplyDisabled()"
      (click)="apply()"
    >
      <bb-btn-content
        [icon]="icons.faCheck"
        [text]="'general.button.apply' | translate"
        [position]="'end'"
      ></bb-btn-content>
    </button>
  </div>
</div>
```

Create `packages/app/src/app/components/column-filters/boolean-column-filter/boolean-column-filter.scss`:

```scss
:host {
  display: block;
}

.bb-column-filter {
  min-width: 360px;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test --workspace=@bitbutler/app`
Expected: PASS - all `BooleanColumnFilter` tests green.

- [ ] **Step 5: Commit**

```bash
git add packages/app/src/app/components/column-filters/boolean-column-filter
git commit -m "#216: add BooleanColumnFilter"
```

---

### Task 3: Wire BooleanColumnFilter onto the 5 boolean columns

**Files:**

- Modify: `packages/app/src/app/pages/main/grid/grid.lib.ts:22` (imports), `:800,813,826,839,852` (`filter:` values)

**Interfaces:**

- Consumes: `BooleanColumnFilter` from Task 2 (`packages/app/src/app/components/column-filters/boolean-column-filter/boolean-column-filter`).

- [ ] **Step 1: Add the import**

In `packages/app/src/app/pages/main/grid/grid.lib.ts`, find:

```typescript
import { GRID_SHARED_OPTIONS } from '../../../app.const';
import { DatepickerRangeFilter } from '../../../components/column-filters/datepicker-range-filter/datepicker-range-filter';
```

Replace with:

```typescript
import { GRID_SHARED_OPTIONS } from '../../../app.const';
import { BooleanColumnFilter } from '../../../components/column-filters/boolean-column-filter/boolean-column-filter';
import { DatepickerRangeFilter } from '../../../components/column-filters/datepicker-range-filter/datepicker-range-filter';
```

- [ ] **Step 2: Replace the filter on all 5 boolean columns**

In the same file, there are 5 identical occurrences of the line `      filter: 'agBooleanColumnFilter',` (on the `auto_tmm`, `seq_dl`, `force_start`, `super_seeding`, and `f_l_piece_prio` column defs). Using an editor find-and-replace-all (or the `Edit` tool's `replace_all`), replace every occurrence of:

```typescript
      filter: 'agBooleanColumnFilter',
```

with:

```typescript
      filter: BooleanColumnFilter,
```

- [ ] **Step 3: Run lint and existing tests to confirm nothing else broke**

Run: `npm run lint`
Expected: PASS - no unused-import or type errors.

Run: `npm run test --workspace=@bitbutler/app`
Expected: PASS - all existing tests still green (there is no dedicated spec for `grid.lib.ts`'s column defs, so this is a compile/lint-level check).

- [ ] **Step 4: Commit**

```bash
git add packages/app/src/app/pages/main/grid/grid.lib.ts
git commit -m "#216: wire BooleanColumnFilter into the torrent grid's boolean columns"
```

---

### Task 4: Remove the floating-filters toggle and dead `floatingFilter: false` markers from the main grid

**Files:**

- Modify: `packages/app/src/app/pages/main/grid/grid.lib.ts` (58 occurrences of `floatingFilter: false,`, plus the `buildHeaderMenu` call)

**Interfaces:**

- Consumes: `GridContextMenuService.buildHeaderMenu(event, opts?)` - `opts.enableFloatingFiltersToggle` already exists and defaults to enabled; passing `false` hides the toggle menu item (this option is pre-existing, untested-by-this-plan behavior already covered by `grid-context-menu.service.spec.ts`).

- [ ] **Step 1: Remove every dead `floatingFilter: false` column-def line**

In `packages/app/src/app/pages/main/grid/grid.lib.ts`, there are 58 occurrences of the exact line:

```typescript
      floatingFilter: false,
```

Every occurrence is byte-for-byte identical (same indentation, no trailing differences). Using a find-and-replace-all across the file (or the `Edit` tool's `replace_all: true` with this exact string as `old_string` and an empty string as `new_string`), delete all 58 occurrences. Do not touch any other line - column defs like:

```typescript
    {
      colId: 'name',
      ...
      filter: TextColumnFilter,
      floatingFilter: false,
    },
```

become:

```typescript
    {
      colId: 'name',
      ...
      filter: TextColumnFilter,
    },
```

- [ ] **Step 2: Disable the floating-filters toggle in the main grid's context menu**

In the same file, find:

```typescript
    onColumnHeaderContextMenu: (e: ColumnHeaderContextMenuEvent<Torrent, any>) => {
      if (!e.column) {
        return;
      }
      contextMenuService.open({
        items: gridContextMenuService.buildHeaderMenu(e),
```

Replace with:

```typescript
    onColumnHeaderContextMenu: (e: ColumnHeaderContextMenuEvent<Torrent, any>) => {
      if (!e.column) {
        return;
      }
      contextMenuService.open({
        items: gridContextMenuService.buildHeaderMenu(e, { enableFloatingFiltersToggle: false }),
```

- [ ] **Step 3: Run lint and tests**

Run: `npm run lint`
Expected: PASS.

Run: `npm run test --workspace=@bitbutler/app`
Expected: PASS - `grid-context-menu.service.spec.ts` already covers `enableFloatingFiltersToggle: false` generically (it doesn't test `grid.lib.ts`'s call site directly), so no existing test should break.

- [ ] **Step 4: Commit**

```bash
git add packages/app/src/app/pages/main/grid/grid.lib.ts
git commit -m "#216: remove dead floating-filter markers and disable the floating-filters toggle on the main grid"
```

---

### Task 5: Remove floating-filters settings application from grid.ts

**Files:**

- Modify: `packages/app/src/app/pages/main/grid/grid.ts:18` (import), `:253-283` (`applyGridSettings`)

**Interfaces:**

- Produces: `applyGridSettings(settings: TorrentListGridSettings)` no longer touches `colDef.floatingFilter` - consumed implicitly by Task 6 (which removes the `floatingFilters` field this method used to read).

- [ ] **Step 1: Remove the floating-filters block from `applyGridSettings`**

In `packages/app/src/app/pages/main/grid/grid.ts`, find:

```typescript
    this.gridPinService.applyPinnedState(
      settings.pinnedTopHashes ?? [],
      settings.pinnedBottomHashes ?? [],
    );

    const floatingFilters = settings.floatingFilters ?? false;
    const currentDefs = this.api.getColumnDefs() ?? [];
    const newDefs = currentDefs.map((d) => {
      const colDef = { ...(d as ColDef<any>) };
      if (colDef.floatingFilter === false) return colDef;
      colDef.floatingFilter = floatingFilters ? true : undefined;
      return colDef;
    });
    this.api.updateGridOptions({ columnDefs: newDefs as ColDef<any>[] });

    this.gridInlineEditService.applyEditableState(
```

Replace with:

```typescript
    this.gridPinService.applyPinnedState(
      settings.pinnedTopHashes ?? [],
      settings.pinnedBottomHashes ?? [],
    );

    this.gridInlineEditService.applyEditableState(
```

- [ ] **Step 2: Remove the now-unused `ColDef` import**

In the same file's import block, find:

```typescript
import {
  type CellContextMenuEvent,
  type ColDef,
  type ColumnState,
  type GridApi,
  type GridOptions,
  type RowDoubleClickedEvent,
} from 'ag-grid-community';
```

Replace with:

```typescript
import {
  type CellContextMenuEvent,
  type ColumnState,
  type GridApi,
  type GridOptions,
  type RowDoubleClickedEvent,
} from 'ag-grid-community';
```

- [ ] **Step 3: Run lint and tests**

Run: `npm run lint`
Expected: PASS - no unused-import errors.

Run: `npm run test --workspace=@bitbutler/app`
Expected: PASS - `grid.spec.ts`'s `applyGridSettings` describe block only asserts `rowDoubleClickAction` behavior and doesn't reference `floatingFilters`, so it is unaffected.

- [ ] **Step 4: Commit**

```bash
git add packages/app/src/app/pages/main/grid/grid.ts
git commit -m "#216: stop applying the floating-filters setting on the main grid"
```

---

### Task 6: Remove `floatingFilters` from TorrentListGridSettings and the settings tab

This is one atomic task (not split across commits) because `torrent-list-grid.model.ts`'s
`floatingFilters` field and `torrent-list-grid.ts`'s use of it must change together - removing
one without the other leaves the build in a broken, non-compiling state.

**Files:**

- Modify: `packages/app/src/app/models/torrent-list-grid.model.ts:14,39`
- Modify: `packages/app/src/app/modals/settings/torrent-list-grid/torrent-list-grid.ts:68,127,197`
- Modify: `packages/app/src/app/modals/settings/torrent-list-grid/torrent-list-grid.html:93-118`
- Modify: `packages/app/src/app/modals/settings/torrent-list-grid/torrent-list-grid.spec.ts:13`

**Interfaces:**

- Produces: `TorrentListGridSettings` without a `floatingFilters` field.

- [ ] **Step 1: Remove the field and its default from the model**

In `packages/app/src/app/models/torrent-list-grid.model.ts`, find:

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

Replace with:

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
  pausePollingOnModal: boolean;
}
```

Then find:

```typescript
  rowDoubleClickAction: 'DETAILS',
  pinnedTopHashes: [],
  pinnedBottomHashes: [],
  floatingFilters: false,
  pausePollingOnModal: false,
};
```

Replace with:

```typescript
  rowDoubleClickAction: 'DETAILS',
  pinnedTopHashes: [],
  pinnedBottomHashes: [],
  pausePollingOnModal: false,
};
```

- [ ] **Step 2: Remove the form control**

In `packages/app/src/app/modals/settings/torrent-list-grid/torrent-list-grid.ts`, find:

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

Replace with:

```typescript
  public torrentListGridForm = new FormGroup({
    columns: new FormControl<string[]>([]),
    pagination: new FormControl(false),
    animateRows: new FormControl(false),
    compactRows: new FormControl(false),
    pausePollingOnModal: new FormControl(false),
    rowDoubleClickAction: new FormControl<RowDoubleClickAction>('DETAILS'),
  });
```

- [ ] **Step 3: Remove it from `initializeForm`**

In the same file, find:

```typescript
        columns: visibleColIds,
        pagination: settings.pagination,
        animateRows: settings.animateRows,
        compactRows: settings.compactRows ?? false,
        floatingFilters: settings.floatingFilters ?? false,
        pausePollingOnModal: settings.pausePollingOnModal ?? false,
        rowDoubleClickAction: settings.rowDoubleClickAction,
```

Replace with:

```typescript
        columns: visibleColIds,
        pagination: settings.pagination,
        animateRows: settings.animateRows,
        compactRows: settings.compactRows ?? false,
        pausePollingOnModal: settings.pausePollingOnModal ?? false,
        rowDoubleClickAction: settings.rowDoubleClickAction,
```

- [ ] **Step 4: Remove it from `save()`**

In the same file, find:

```typescript
      pagination: formValue.pagination ?? settings.pagination,
      animateRows: formValue.animateRows ?? settings.animateRows,
      compactRows: formValue.compactRows ?? settings.compactRows,
      floatingFilters: formValue.floatingFilters ?? settings.floatingFilters,
      pausePollingOnModal: formValue.pausePollingOnModal ?? settings.pausePollingOnModal,
```

Replace with:

```typescript
      pagination: formValue.pagination ?? settings.pagination,
      animateRows: formValue.animateRows ?? settings.animateRows,
      compactRows: formValue.compactRows ?? settings.compactRows,
      pausePollingOnModal: formValue.pausePollingOnModal ?? settings.pausePollingOnModal,
```

- [ ] **Step 5: Remove the checkbox markup**

In `packages/app/src/app/modals/settings/torrent-list-grid/torrent-list-grid.html`, find:

```html
          <div class="col-lg-6 col-12">
            <div class="form-check form-switch">
              <input
                class="form-check-input"
                type="checkbox"
                id="floatingFilters"
                formControlName="floatingFilters"
              />
              <label class="form-check-label" for="floatingFilters">
                {{
                  'pages.settings.tab.torrent-list-grid.torrent-list-grid-form.floating-filters'
                    | translate
                }}
                <bb-popover
                  [subject]="
                    'pages.settings.tab.torrent-list-grid.popover.floating-filters.title'
                      | translate
                  "
                  [description]="
                    'pages.settings.tab.torrent-list-grid.popover.floating-filters.description'
                      | translate
                  "
                ></bb-popover>
              </label>
            </div>
          </div>
        </div>
```

Replace with:

```html
        </div>
```

(This deletes the entire `col-lg-6` column holding the floating-filters checkbox, leaving the `compact-rows` checkbox as the sole item in its row - matching the layout of other single-item setting rows elsewhere in this template.)

- [ ] **Step 6: Update the settings spec's default fixture**

In `packages/app/src/app/modals/settings/torrent-list-grid/torrent-list-grid.spec.ts`, find:

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

Replace with:

```typescript
const DEFAULT_SETTINGS = {
  columnState: [],
  pagination: true,
  animateRows: true,
  rowDoubleClickAction: 'DETAILS' as const,
  pausePollingOnModal: false,
};
```

- [ ] **Step 7: Run lint and tests**

Run: `npm run lint`
Expected: PASS - no TypeScript or lint errors.

Run: `npm run test --workspace=@bitbutler/app`
Expected: PASS - all `torrent-list-grid.spec.ts` tests green.

- [ ] **Step 8: Commit**

```bash
git add packages/app/src/app/models/torrent-list-grid.model.ts packages/app/src/app/modals/settings/torrent-list-grid/torrent-list-grid.ts packages/app/src/app/modals/settings/torrent-list-grid/torrent-list-grid.html packages/app/src/app/modals/settings/torrent-list-grid/torrent-list-grid.spec.ts
git commit -m "#216: remove floatingFilters setting and its checkbox from torrent list grid settings"
```

---

### Task 7: Remove the settings-modal floating-filters translation keys

**Files:**

- Modify: `public/i18n/us.json:1559-1564,1590-1597`
- Modify: `public/i18n/hu.json:1559-1564,1590-1597`

**Interfaces:**

- None (leaf cleanup task - the shared `pages.main.grid.context-menu.item.show-floating-filters`/`hide-floating-filters` keys used by Trackers/Peers are explicitly left untouched).

- [ ] **Step 1: Remove the form-label key from `public/i18n/us.json`**

Find:

```json
          "torrent-list-grid-form": {
            "animate-rows": "Animate Rows",
            "pagination": "Pagination",
            "compact-rows": "Compact Rows",
            "floating-filters": "Floating Filters",
            "pause-on-modal": "Pause on Modal",
```

Replace with:

```json
          "torrent-list-grid-form": {
            "animate-rows": "Animate Rows",
            "pagination": "Pagination",
            "compact-rows": "Compact Rows",
            "pause-on-modal": "Pause on Modal",
```

- [ ] **Step 2: Remove the popover key from `public/i18n/us.json`**

Find:

```json
            "compact-rows": {
              "title": "Compact Rows",
              "description": "Reduces the row height and cell padding in the torrent list for a denser view."
            },
            "floating-filters": {
              "title": "Floating Filters",
              "description": "Shows an inline filter row beneath the column headers. This can also be toggled per-column from the column header context menu."
            },
            "pause-on-modal": {
```

Replace with:

```json
            "compact-rows": {
              "title": "Compact Rows",
              "description": "Reduces the row height and cell padding in the torrent list for a denser view."
            },
            "pause-on-modal": {
```

- [ ] **Step 3: Remove the form-label key from `public/i18n/hu.json`**

Find:

```json
          "torrent-list-grid-form": {
            "animate-rows": "Sorok animálása",
            "pagination": "Oldalszámozás",
            "compact-rows": "Kompakt sorok",
            "floating-filters": "Lebegő szűrők",
            "pause-on-modal": "Szüneteltetés modál esetén",
```

Replace with:

```json
          "torrent-list-grid-form": {
            "animate-rows": "Sorok animálása",
            "pagination": "Oldalszámozás",
            "compact-rows": "Kompakt sorok",
            "pause-on-modal": "Szüneteltetés modál esetén",
```

- [ ] **Step 4: Remove the popover key from `public/i18n/hu.json`**

Find:

```json
            "compact-rows": {
              "title": "Kompakt sorok",
              "description": "Csökkenti a sorok magasságát és a cellák belső margóját a torrent listában, hogy több adat férjen el egyszerre."
            },
            "floating-filters": {
              "title": "Lebegő szűrők",
              "description": "Egy szűrősor jelenik meg az oszlopfejlécek alatt. Ez az oszlopfejléc helyi menüjéből is kapcsolható oszloponként."
            },
            "pause-on-modal": {
```

Replace with:

```json
            "compact-rows": {
              "title": "Kompakt sorok",
              "description": "Csökkenti a sorok magasságát és a cellák belső margóját a torrent listában, hogy több adat férjen el egyszerre."
            },
            "pause-on-modal": {
```

- [ ] **Step 5: Run lint and tests**

Run: `npm run lint`
Expected: PASS.

Run: `npm run test --workspace=@bitbutler/app`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add public/i18n/us.json public/i18n/hu.json
git commit -m "#216: remove unused floating-filters settings-modal translation keys"
```

---

### Task 8: Manual verification

**Files:** none (verification only)

- [ ] **Step 1: Run the full test suite and lint one more time**

Run: `npm run lint`
Expected: PASS with zero warnings.

Run: `npm test`
Expected: PASS across all workspaces.

- [ ] **Step 2: Start the app**

Run: `npm start`

- [ ] **Step 3: Verify the boolean filter**

In the main torrent list, show a boolean column (e.g. right-click a header → column toggle → enable `Auto TMM`, `Sequential Download`, `Force Start`, `Super Seeding`, or `First/Last Piece Priority`). Open that column's filter popup and confirm:

- It shows a single floating-label "Value" `ng-select` with True/False options and a Clear/Apply button pair, matching the visual style of the other filters.
- Selecting True or Apply filters the grid to only matching rows; selecting False filters to the opposite; Clear removes the filter.

- [ ] **Step 4: Verify floating filters are gone from the main grid**

Right-click any main-grid column header. Confirm the context menu's Filter submenu no longer has a "Show/hide floating filters" item. Open Settings → Torrent List Grid tab and confirm the "Floating Filters" checkbox is gone (the "Compact Rows" checkbox should still be present, just alone in its row).

- [ ] **Step 5: Verify Trackers/Peers modals are unaffected**

Open a torrent's details, go to the Trackers tab, right-click a column header, and confirm "Show/hide floating filters" is still present and still works. Repeat for the Peers tab.
