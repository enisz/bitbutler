# Datepicker Range Filter Apply Button Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stop `DatepickerRangeFilter` from pushing every date pick straight into the ag-grid filter model (which triggers a re-render that can close the popup mid-selection) by splitting the component's date state into a staged (calendar/chip) copy and an applied (actual grid filter) copy, and adding an Apply button that commits staged into applied.

**Architecture:** `fromDate`/`toDate` keep driving the calendar UI (selection, hover-preview, chips) exactly as today. Two new fields, `appliedFrom`/`appliedTo`, become the source of truth for `doesFilterPass`/`getModel`/`setModel`/`isFilterActive`. `onSelect()` no longer calls `filterChangedCallback()`. A new `apply()` copies staged into applied and calls `filterChangedCallback()`; `clear()` resets both and still calls it immediately; a new `afterGuiAttached()` (ag-grid's popup-open lifecycle hook) resets staged from applied every time the popup opens, which is what discards an unapplied pick left over from a prior outside-click close. The now-unnecessary `grid.ts` echo-dedupe workaround (added while diagnosing this bug) is reverted.

**Tech Stack:** Angular 20 (zoneless, signals), `@ng-bootstrap/ng-bootstrap` (`NgbDatepicker`), `ag-grid-community`/`ag-grid-angular` 35, `@ngx-translate/core`, `@fortawesome/free-solid-svg-icons`, Vitest (via `ng test`).

## Global Constraints

- Commit format: `#213: <short description>` (this branch, `213-configurable-date-format`, continues issue #213).
- `npm run lint` must pass with zero warnings (`max-warnings=0`); Prettier formatting is auto-applied by the pre-commit hook - if it reformats staged files during a commit, that's expected, not a failure.
- Run app-package tests with: `npm test --workspace=@bitbutler/app` (from the repo root `C:\dev\bitbutler`). Baseline before this plan: 131 test files / 1740 tests, all passing (this count includes the uncommitted `grid.spec.ts` dedupe tests reverted in Task 1).
- Toast copy rules from `CLAUDE.md` don't apply here - this change adds no toasts.
- Every step below shows the exact code to write - no placeholder steps.

---

### Task 1: Revert the `grid.ts` filter-echo dedupe workaround

**Files:**

- Revert: `packages/app/src/app/pages/main/grid/grid.ts`
- Revert: `packages/app/src/app/pages/main/grid/grid.spec.ts`

**Interfaces:**

- Consumes: nothing.
- Produces: nothing - `onColumnFilterChange` in `grid.ts` returns to its last-committed form; no later task depends on the reverted code.

- [ ] **Step 1: Confirm both files are the only uncommitted changes touching this workaround**

Run: `git status --short`
Expected: `packages/app/src/app/pages/main/grid/grid.ts` and `packages/app/src/app/pages/main/grid/grid.spec.ts` listed as modified, nothing else.

- [ ] **Step 2: Revert both files to their last-committed state**

```bash
git checkout -- packages/app/src/app/pages/main/grid/grid.ts packages/app/src/app/pages/main/grid/grid.spec.ts
```

- [ ] **Step 3: Run the app test suite to confirm no regressions**

Run: `npm test --workspace=@bitbutler/app`
Expected: 131 test files / 1738 tests, all passing (two fewer tests than the 1740-test baseline - the reverted dedupe-check `describe` block).

- [ ] **Step 4: Commit**

Since this is a pure revert of uncommitted changes there is nothing new to stage; skip straight to Task 2 (no commit needed for a revert-to-clean-state).

---

### Task 2: Split staged vs. applied date state in `DatepickerRangeFilter`

**Files:**

- Modify: `packages/app/src/app/components/datepicker-range-filter/datepicker-range-filter.ts`
- Modify: `packages/app/src/app/components/datepicker-range-filter/datepicker-range-filter.spec.ts`

**Interfaces:**

- Consumes: nothing new.
- Produces:
  - `DatepickerRangeFilter.appliedFrom: NgbDate | null`, `appliedTo: NgbDate | null` (new public fields - `doesFilterPass`, `getModel`, `setModel`, `isFilterActive` now read/write these instead of `fromDate`/`toDate`).
  - `DatepickerRangeFilter.apply(): void` (new method - copies `fromDate`/`toDate` into `appliedFrom`/`appliedTo` and calls `filterChangedCallback()`).
  - `DatepickerRangeFilter.isApplyDisabled(): boolean` (new method - `true` when staged matches applied).
  - `DatepickerRangeFilter.afterGuiAttached(params?: IAfterGuiAttachedParams): void` (new `IFilterAngularComp` lifecycle method - resets staged from applied).
  - `onSelect()` no longer calls `filterChangedCallback()`.
  - `clear()` now also resets `appliedFrom`/`appliedTo` (still calls `filterChangedCallback()`).

  Task 3 (template) consumes `apply()` and `isApplyDisabled()` by name.

- [ ] **Step 1: Write the failing tests**

Replace the entire contents of `packages/app/src/app/components/datepicker-range-filter/datepicker-range-filter.spec.ts` with:

```typescript
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NgbDate } from '@ng-bootstrap/ng-bootstrap';
import { DEFAULT_GENERAL_SETTINGS } from '../../models/general-settings.model';
import { DateFormatService } from '../../services/date-format.service';
import { DatepickerRangeFilter } from './datepicker-range-filter';

describe('DatepickerRangeFilter', () => {
  let component: DatepickerRangeFilter;
  let fixture: ComponentFixture<DatepickerRangeFilter>;
  let mockParams: any;

  beforeEach(async () => {
    mockParams = { filterChangedCallback: vi.fn() };

    await TestBed.configureTestingModule({
      imports: [DatepickerRangeFilter],
    }).compileComponents();

    fixture = TestBed.createComponent(DatepickerRangeFilter);
    component = fixture.componentInstance;
    component.agInit(mockParams);
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('isFilterActive', () => {
    it('should return false when no applied from-date is set', () => {
      component.appliedFrom = null;
      expect(component.isFilterActive()).toBe(false);
    });

    it('should return true when an applied from-date is set', () => {
      component.appliedFrom = new NgbDate(2024, 1, 1);
      expect(component.isFilterActive()).toBe(true);
    });

    it('should ignore a staged (unapplied) from-date', () => {
      component.fromDate = new NgbDate(2024, 1, 1);
      component.appliedFrom = null;
      expect(component.isFilterActive()).toBe(false);
    });
  });

  describe('doesFilterPass', () => {
    it('should pass all rows when no filter is applied', () => {
      component.appliedFrom = null;
      expect(component.doesFilterPass({ data: { added_on: 1700000000 } } as any)).toBe(true);
    });

    it('should reject rows with no added_on when filter is applied', () => {
      component.appliedFrom = new NgbDate(2024, 1, 1);
      expect(component.doesFilterPass({ data: {} } as any)).toBe(false);
    });

    it('should match exact date when only appliedFrom is set', () => {
      const localMidnight = new Date(2024, 0, 15).getTime() / 1000;
      component.appliedFrom = new NgbDate(2024, 1, 15);
      component.appliedTo = null;
      expect(component.doesFilterPass({ data: { added_on: localMidnight } } as any)).toBe(true);
    });

    it('should accept dates within the appliedFrom-appliedTo range', () => {
      component.appliedFrom = new NgbDate(2024, 1, 1);
      component.appliedTo = new NgbDate(2024, 1, 31);
      const midJan = new Date(2024, 0, 15).getTime() / 1000;
      expect(component.doesFilterPass({ data: { added_on: midJan } } as any)).toBe(true);
    });

    it('should reject dates outside the applied range', () => {
      component.appliedFrom = new NgbDate(2024, 1, 1);
      component.appliedTo = new NgbDate(2024, 1, 31);
      const beforeRange = new Date(2023, 11, 31).getTime() / 1000;
      expect(component.doesFilterPass({ data: { added_on: beforeRange } } as any)).toBe(false);
    });

    it('should ignore a staged (unapplied) range', () => {
      component.fromDate = new NgbDate(2024, 1, 1);
      component.toDate = new NgbDate(2024, 1, 31);
      component.appliedFrom = null;
      component.appliedTo = null;
      const midJan = new Date(2024, 0, 15).getTime() / 1000;
      expect(component.doesFilterPass({ data: { added_on: midJan } } as any)).toBe(true);
    });
  });

  describe('getModel / setModel', () => {
    it('should return null when filter is inactive', () => {
      component.appliedFrom = null;
      expect(component.getModel()).toBeNull();
    });

    it('should return model when appliedFrom is set', () => {
      component.appliedFrom = new NgbDate(2024, 1, 1);
      component.appliedTo = new NgbDate(2024, 1, 31);
      expect(component.getModel()).toEqual({
        from: new NgbDate(2024, 1, 1),
        to: new NgbDate(2024, 1, 31),
      });
    });

    it('should restore both staged and applied dates from model', () => {
      component.setModel({ from: new NgbDate(2024, 3, 1), to: new NgbDate(2024, 3, 15) });
      expect(component.appliedFrom).toEqual(new NgbDate(2024, 3, 1));
      expect(component.appliedTo).toEqual(new NgbDate(2024, 3, 15));
      expect(component.fromDate).toEqual(new NgbDate(2024, 3, 1));
      expect(component.toDate).toEqual(new NgbDate(2024, 3, 15));
    });

    it('should clear both staged and applied dates when model is null', () => {
      component.appliedFrom = new NgbDate(2024, 1, 1);
      component.appliedTo = new NgbDate(2024, 1, 31);
      component.fromDate = new NgbDate(2024, 1, 1);
      component.toDate = new NgbDate(2024, 1, 31);
      component.setModel(null);
      expect(component.appliedFrom).toBeNull();
      expect(component.appliedTo).toBeNull();
      expect(component.fromDate).toBeNull();
      expect(component.toDate).toBeNull();
    });
  });

  describe('apply', () => {
    it('should copy staged dates into applied and call filterChangedCallback', () => {
      component.fromDate = new NgbDate(2024, 2, 1);
      component.toDate = new NgbDate(2024, 2, 10);
      component.appliedFrom = null;
      component.appliedTo = null;
      component.apply();
      expect(component.appliedFrom).toEqual(new NgbDate(2024, 2, 1));
      expect(component.appliedTo).toEqual(new NgbDate(2024, 2, 10));
      expect(mockParams.filterChangedCallback).toHaveBeenCalled();
    });
  });

  describe('isApplyDisabled', () => {
    it('is true when staged and applied are both empty', () => {
      component.fromDate = null;
      component.toDate = null;
      component.appliedFrom = null;
      component.appliedTo = null;
      expect(component.isApplyDisabled()).toBe(true);
    });

    it('is true when staged matches applied exactly', () => {
      component.fromDate = new NgbDate(2024, 1, 1);
      component.toDate = new NgbDate(2024, 1, 31);
      component.appliedFrom = new NgbDate(2024, 1, 1);
      component.appliedTo = new NgbDate(2024, 1, 31);
      expect(component.isApplyDisabled()).toBe(true);
    });

    it('is false when a staged fromDate has no applied counterpart yet', () => {
      component.fromDate = new NgbDate(2024, 1, 1);
      component.toDate = null;
      component.appliedFrom = null;
      component.appliedTo = null;
      expect(component.isApplyDisabled()).toBe(false);
    });

    it('is false when staged range differs from applied range', () => {
      component.fromDate = new NgbDate(2024, 1, 1);
      component.toDate = new NgbDate(2024, 1, 20);
      component.appliedFrom = new NgbDate(2024, 1, 1);
      component.appliedTo = new NgbDate(2024, 1, 31);
      expect(component.isApplyDisabled()).toBe(false);
    });
  });

  describe('afterGuiAttached', () => {
    it('resets staged dates from applied dates', () => {
      component.appliedFrom = new NgbDate(2024, 1, 1);
      component.appliedTo = new NgbDate(2024, 1, 31);
      component.fromDate = new NgbDate(2024, 5, 5);
      component.toDate = null;
      component.hoveredDate = new NgbDate(2024, 5, 6);

      component.afterGuiAttached();

      expect(component.fromDate).toEqual(new NgbDate(2024, 1, 1));
      expect(component.toDate).toEqual(new NgbDate(2024, 1, 31));
      expect(component.hoveredDate).toBeNull();
    });

    it('resets staged dates to null when nothing is applied', () => {
      component.appliedFrom = null;
      component.appliedTo = null;
      component.fromDate = new NgbDate(2024, 5, 5);
      component.toDate = new NgbDate(2024, 5, 10);

      component.afterGuiAttached();

      expect(component.fromDate).toBeNull();
      expect(component.toDate).toBeNull();
    });
  });

  describe('clear', () => {
    it('should reset all staged and applied date selections and call filterChangedCallback', () => {
      component.fromDate = new NgbDate(2024, 1, 1);
      component.toDate = new NgbDate(2024, 1, 31);
      component.hoveredDate = new NgbDate(2024, 1, 10);
      component.appliedFrom = new NgbDate(2024, 1, 1);
      component.appliedTo = new NgbDate(2024, 1, 31);
      component.clear();
      expect(component.fromDate).toBeNull();
      expect(component.toDate).toBeNull();
      expect(component.hoveredDate).toBeNull();
      expect(component.appliedFrom).toBeNull();
      expect(component.appliedTo).toBeNull();
      expect(mockParams.filterChangedCallback).toHaveBeenCalled();
    });
  });

  describe('fmt', () => {
    it('should format a date as YYYY-MM-DD', () => {
      const result = component.fmt(new NgbDate(2024, 3, 5));
      expect(result).toBe('2024-03-05');
    });

    it('should pad single-digit month and day', () => {
      expect(component.fmt(new NgbDate(2024, 1, 7))).toBe('2024-01-07');
    });
  });

  describe('onSelect', () => {
    it('should set fromDate on first selection', () => {
      component.fromDate = null;
      component.toDate = null;
      component.onSelect(new NgbDate(2024, 1, 10));
      expect(component.fromDate).toEqual(new NgbDate(2024, 1, 10));
      expect(component.toDate).toBeNull();
    });

    it('should set toDate when second date is after fromDate', () => {
      component.fromDate = new NgbDate(2024, 1, 5);
      component.toDate = null;
      component.onSelect(new NgbDate(2024, 1, 20));
      expect(component.toDate).toEqual(new NgbDate(2024, 1, 20));
    });

    it('should reset and start new range when second date is not after fromDate', () => {
      component.fromDate = new NgbDate(2024, 1, 20);
      component.toDate = null;
      component.onSelect(new NgbDate(2024, 1, 5));
      expect(component.fromDate).toEqual(new NgbDate(2024, 1, 5));
      expect(component.toDate).toBeNull();
    });

    it('should not call filterChangedCallback - picking dates only stages them', () => {
      component.fromDate = null;
      component.toDate = null;
      component.onSelect(new NgbDate(2024, 1, 10));
      component.onSelect(new NgbDate(2024, 1, 20));
      expect(mockParams.filterChangedCallback).not.toHaveBeenCalled();
    });
  });

  describe('fmt with a non-default date format', () => {
    it('formats using the eu preset date-only pattern from DateFormatService', () => {
      const dateFormatService = TestBed.inject(DateFormatService);
      dateFormatService.applyFromSettings({
        ...DEFAULT_GENERAL_SETTINGS,
        dateFormat: { preset: 'eu', customPattern: 'yyyy-MM-dd HH:mm', firstDayOfWeek: 'auto' },
      });

      expect(component.fmt(new NgbDate(2024, 3, 5))).toBe('05.03.2024');
    });
  });

  describe('isRangeStart', () => {
    it('is false when no date is selected', () => {
      component.fromDate = null;
      component.toDate = null;
      expect(component.isRangeStart(new NgbDate(2024, 1, 10))).toBe(false);
    });

    it('is false for a single selected date with no hover and no toDate', () => {
      component.fromDate = new NgbDate(2024, 1, 10);
      component.toDate = null;
      component.hoveredDate = null;
      expect(component.isRangeStart(new NgbDate(2024, 1, 10))).toBe(false);
    });

    it('is true for the fromDate once a toDate is set', () => {
      component.fromDate = new NgbDate(2024, 1, 10);
      component.toDate = new NgbDate(2024, 1, 20);
      expect(component.isRangeStart(new NgbDate(2024, 1, 10))).toBe(true);
    });

    it('is true for the fromDate while hovering past it with no toDate yet', () => {
      component.fromDate = new NgbDate(2024, 1, 10);
      component.toDate = null;
      component.hoveredDate = new NgbDate(2024, 1, 15);
      expect(component.isRangeStart(new NgbDate(2024, 1, 10))).toBe(true);
    });

    it('is false for a date other than fromDate', () => {
      component.fromDate = new NgbDate(2024, 1, 10);
      component.toDate = new NgbDate(2024, 1, 20);
      expect(component.isRangeStart(new NgbDate(2024, 1, 15))).toBe(false);
    });
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test --workspace=@bitbutler/app`
Expected: FAIL - `component.appliedFrom`/`appliedTo` are `undefined`, `component.apply`/`isApplyDisabled`/`afterGuiAttached` are not functions. Confirm the failures are specifically about these missing members, not a syntax/import error.

- [ ] **Step 3: Update the component imports**

In `packages/app/src/app/components/datepicker-range-filter/datepicker-range-filter.ts`, replace:

```typescript
import { IDoesFilterPassParams, IFilterParams } from 'ag-grid-community';
```

with:

```typescript
import { IAfterGuiAttachedParams, IDoesFilterPassParams, IFilterParams } from 'ag-grid-community';
```

- [ ] **Step 4: Add the applied-state fields**

Replace:

```typescript
  fromDate: NgbDate | null = null;
  toDate: NgbDate | null = null;
  hoveredDate: NgbDate | null = null;
```

with:

```typescript
  fromDate: NgbDate | null = null;
  toDate: NgbDate | null = null;
  appliedFrom: NgbDate | null = null;
  appliedTo: NgbDate | null = null;
  hoveredDate: NgbDate | null = null;
```

- [ ] **Step 5: Rewire `isFilterActive`, `doesFilterPass`, `getModel`, `setModel` to the applied fields, and add `afterGuiAttached`**

Replace:

```typescript
  isFilterActive(): boolean {
    return this.fromDate !== null;
  }
  doesFilterPass(params: IDoesFilterPassParams): boolean {
    if (!this.fromDate) return true;
    const rawValue = params.data?.added_on;
    if (rawValue == null) return false;
    const cellDate = new Date(Number(rawValue) * 1000);
    const cellLocalMidnight = new Date(
      cellDate.getFullYear(),
      cellDate.getMonth(),
      cellDate.getDate(),
    ).getTime();
    const from = this.ngbToLocalMidnight(this.fromDate);
    if (this.toDate) {
      const to = this.ngbToLocalMidnight(this.toDate);
      return cellLocalMidnight >= from && cellLocalMidnight <= to;
    }
    return cellLocalMidnight === from;
  }
  getModel(): any {
    return this.isFilterActive() ? { from: this.fromDate, to: this.toDate } : null;
  }
  setModel(model: any): void {
    this.fromDate = model?.from ?? null;
    this.toDate = model?.to ?? null;
  }
```

with:

```typescript
  isFilterActive(): boolean {
    return this.appliedFrom !== null;
  }
  doesFilterPass(params: IDoesFilterPassParams): boolean {
    if (!this.appliedFrom) return true;
    const rawValue = params.data?.added_on;
    if (rawValue == null) return false;
    const cellDate = new Date(Number(rawValue) * 1000);
    const cellLocalMidnight = new Date(
      cellDate.getFullYear(),
      cellDate.getMonth(),
      cellDate.getDate(),
    ).getTime();
    const from = this.ngbToLocalMidnight(this.appliedFrom);
    if (this.appliedTo) {
      const to = this.ngbToLocalMidnight(this.appliedTo);
      return cellLocalMidnight >= from && cellLocalMidnight <= to;
    }
    return cellLocalMidnight === from;
  }
  getModel(): any {
    return this.isFilterActive() ? { from: this.appliedFrom, to: this.appliedTo } : null;
  }
  setModel(model: any): void {
    this.appliedFrom = model?.from ?? null;
    this.appliedTo = model?.to ?? null;
    this.fromDate = this.appliedFrom;
    this.toDate = this.appliedTo;
  }
  afterGuiAttached(_params?: IAfterGuiAttachedParams): void {
    this.fromDate = this.appliedFrom;
    this.toDate = this.appliedTo;
    this.hoveredDate = null;
  }
```

- [ ] **Step 6: Remove the `filterChangedCallback()` call from `onSelect`, and add `apply`/`isApplyDisabled`/`datesEqual`**

Replace:

```typescript
  onSelect(ev: any) {
    const date = ev as NgbDate;
    if (!this.fromDate && !this.toDate) {
      this.fromDate = date;
    } else if (this.fromDate && !this.toDate && date.after(this.fromDate)) {
      this.toDate = date;
    } else {
      this.toDate = null;
      this.fromDate = date;
    }
    this.params.filterChangedCallback();
  }
  clear() {
    this.fromDate = null;
    this.toDate = null;
    this.hoveredDate = null;
    this.params.filterChangedCallback();
  }
```

with:

```typescript
  onSelect(ev: any) {
    const date = ev as NgbDate;
    if (!this.fromDate && !this.toDate) {
      this.fromDate = date;
    } else if (this.fromDate && !this.toDate && date.after(this.fromDate)) {
      this.toDate = date;
    } else {
      this.toDate = null;
      this.fromDate = date;
    }
  }
  apply() {
    this.appliedFrom = this.fromDate;
    this.appliedTo = this.toDate;
    this.params.filterChangedCallback();
  }
  isApplyDisabled(): boolean {
    return (
      this.datesEqual(this.fromDate, this.appliedFrom) &&
      this.datesEqual(this.toDate, this.appliedTo)
    );
  }
  clear() {
    this.fromDate = null;
    this.toDate = null;
    this.hoveredDate = null;
    this.appliedFrom = null;
    this.appliedTo = null;
    this.params.filterChangedCallback();
  }
```

- [ ] **Step 7: Add the `datesEqual` helper**

Replace:

```typescript
  private ngbToLocalMidnight(d: NgbDate): number {
    return new Date(d.year, d.month - 1, d.day).getTime();
  }
```

with:

```typescript
  private datesEqual(a: NgbDate | null, b: NgbDate | null): boolean {
    if (!a && !b) return true;
    if (!a || !b) return false;
    return a.equals(b);
  }
  private ngbToLocalMidnight(d: NgbDate): number {
    return new Date(d.year, d.month - 1, d.day).getTime();
  }
```

- [ ] **Step 8: Run the tests to verify they pass**

Run: `npm test --workspace=@bitbutler/app`
Expected: all tests pass (1738 baseline + the new tests added in Step 1).

- [ ] **Step 9: Commit**

```bash
git add packages/app/src/app/components/datepicker-range-filter/datepicker-range-filter.ts packages/app/src/app/components/datepicker-range-filter/datepicker-range-filter.spec.ts
git commit -m "$(cat <<'EOF'
#213: split staged and applied date state in DatepickerRangeFilter

EOF
)"
```

---

### Task 3: Add the Apply button to the template

**Files:**

- Modify: `packages/app/src/app/components/datepicker-range-filter/datepicker-range-filter.ts`
- Modify: `packages/app/src/app/components/datepicker-range-filter/datepicker-range-filter.html`
- Modify: `public/i18n/us.json`
- Modify: `public/i18n/hu.json`

**Interfaces:**

- Consumes: `apply()`, `isApplyDisabled()` from Task 2.
- Produces: nothing consumed by later tasks - this is the leaf UI task.

- [ ] **Step 1: Add the `faCheck` icon import and register it**

In `packages/app/src/app/components/datepicker-range-filter/datepicker-range-filter.ts`, replace:

```typescript
import {
  faCalendarDay,
  faChevronLeft,
  faChevronRight,
  faEraser,
} from '@fortawesome/free-solid-svg-icons';
```

with:

```typescript
import {
  faCalendarDay,
  faCheck,
  faChevronLeft,
  faChevronRight,
  faEraser,
} from '@fortawesome/free-solid-svg-icons';
```

Replace:

```typescript
  public icons = { faChevronLeft, faChevronRight, faCalendarDay, faEraser };
```

with:

```typescript
  public icons = { faChevronLeft, faChevronRight, faCalendarDay, faEraser, faCheck };
```

- [ ] **Step 2: Add the `general.button.apply` translation key**

In `public/i18n/us.json` (around line 1815, inside `"general"` > `"button"`), replace:

```json
      "clear": "Clear",
      "clear-all": "Clear",
```

with:

```json
      "clear": "Clear",
      "clear-all": "Clear",
      "apply": "Apply",
```

In `public/i18n/hu.json` (around line 1814, inside `"general"` > `"button"`), replace:

```json
      "clear": "Törlés",
      "clear-all": "Összes törlése",
```

with:

```json
      "clear": "Törlés",
      "clear-all": "Összes törlése",
      "apply": "Alkalmaz",
```

- [ ] **Step 3: Add the Apply button to the template**

In `packages/app/src/app/components/datepicker-range-filter/datepicker-range-filter.html`, replace:

```html
      <button class="btn btn-sm btn-outline-secondary btn-split" type="button" (click)="clear()">
        <bb-btn-content
          [icon]="icons.faEraser"
          [text]="'general.button.clear' | translate"
          [position]="'end'"
        ></bb-btn-content>
      </button>
    </div>
  </div>
</div>
```

with:

```html
      <button class="btn btn-sm btn-outline-secondary btn-split" type="button" (click)="clear()">
        <bb-btn-content
          [icon]="icons.faEraser"
          [text]="'general.button.clear' | translate"
          [position]="'end'"
        ></bb-btn-content>
      </button>
      <button
        class="btn btn-sm btn-outline-primary btn-split"
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
</div>
```

- [ ] **Step 4: Run the full app test suite**

Run: `npm test --workspace=@bitbutler/app`
Expected: all tests pass, no failures (no new tests added in this task - it's template/i18n only, already covered by Task 2's `apply`/`isApplyDisabled` unit tests).

- [ ] **Step 5: Run lint**

Run: `npm run lint`
Expected: zero errors, zero warnings.

- [ ] **Step 6: Commit**

```bash
git add packages/app/src/app/components/datepicker-range-filter public/i18n/us.json public/i18n/hu.json
git commit -m "$(cat <<'EOF'
#213: add an Apply button to the datepicker range filter

EOF
)"
```

---

### Task 4: Manual verification in the running app

**Files:** none (verification only).

**Interfaces:** none.

- [ ] **Step 1: Start the app**

Run: `npm start`
Expected: Angular dev server, `tsc --watch`, and Electron all start; the Electron window opens to the login page (or main grid if a default server is configured).

- [ ] **Step 2: Verify picking dates no longer closes the popup or filters the grid**

Open the filter popup on the "Added On" column (or another date column). Click a first date - confirm the popup stays open and the grid rows are unaffected. Click a second, later date - confirm the popup still stays open, the calendar shows the pill-shaped range, the chips show both dates, and the grid rows are still unaffected.

- [ ] **Step 3: Verify Apply commits the filter**

With a pending two-date range from Step 2, confirm the Apply button is enabled. Click it - confirm the grid now filters to that range, the popup stays open, and the Apply button becomes disabled (nothing left pending).

- [ ] **Step 4: Verify Clear applies immediately**

With an applied filter from Step 3, click Clear - confirm the grid filter clears immediately (all rows return), the chips reset to placeholders, and Apply becomes disabled.

- [ ] **Step 5: Verify a pending selection is discarded on outside-click close**

Open the popup, pick a first and second date (leave Apply unclicked), then click outside the popup (e.g. a grid row) to close it. Reopen the popup - confirm it shows the last-applied state (empty, if nothing was ever applied in this session) rather than the discarded pending pick.

- [ ] **Step 6: Verify existing behavior is unaffected**

Confirm date chip formatting still matches the configured date format preset, the pill-shaped range visuals still render correctly, first-day-of-week still reflects the configured setting, and Today/Clear/Apply all show their icon after the label text.

- [ ] **Step 7: Report results**

If any check in Steps 2-6 fails, note exactly which one and the observed vs. expected behavior before proceeding further.
