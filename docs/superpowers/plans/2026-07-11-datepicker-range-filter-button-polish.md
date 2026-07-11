# Datepicker Range Filter Button Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the Apply button visually match Today/Clear, collapse the bottom-left date label to only show what's actually selected, and make the Today button stage today as a fresh start date instead of only recentering the calendar view.

**Architecture:** All changes are confined to the single `DatepickerRangeFilter` component (`packages/app/src/app/components/datepicker-range-filter/`) - a SCSS-only shape fix, a template-only conditional rendering change, and a small TS method + its template wiring.

**Tech Stack:** Angular 20 (standalone components, zoneless, `@if` built-in control flow), `@ng-bootstrap/ng-bootstrap` (`NgbDatepicker`, `NgbDate`), Vitest (via `@angular/build:unit-test` runner) for unit tests.

## Global Constraints

- Design source: `docs/superpowers/specs/2026-07-11-datepicker-range-filter-button-polish-design.md`.
- Apply's color and Bootstrap's default `btn-outline-primary` hover behavior must NOT change - only the border-radius/shape.
- Use the existing translation keys `components.datepicker-range-filter.label.date` / `.from` / `.to` (`public/i18n/us.json:241-247`) - do not add new keys.
- Use Angular's built-in `@if` block syntax for conditional template sections (already the codebase convention - see `packages/app/src/app/components/bb-btn-content/bb-btn-content.html`), not `*ngIf` - no new imports needed for it.
- `selectToday()` must NOT call `apply()` or `this.params.filterChangedCallback()` - it only stages a selection, same as clicking a day cell.
- The button row must stay pinned to the right regardless of whether the label area shows nothing, one line, or two lines.
- Commit format: `#213: <short description>` (per project convention).
- Run tests from `packages/app/`: `npx ng test --watch=false --include=src/app/components/datepicker-range-filter/datepicker-range-filter.spec.ts`.

---

### Task 1: Apply button shape consistency

**Files:**

- Modify: `packages/app/src/app/components/datepicker-range-filter/datepicker-range-filter.scss:201-209`

**Interfaces:** None - pure CSS, no code interface changes.

- [ ] **Step 1: Add a `.btn-outline-primary` shape override next to the existing `.btn-outline-secondary` one**

In `packages/app/src/app/components/datepicker-range-filter/datepicker-range-filter.scss`, the `:host ::ng-deep` block currently ends with:

```scss
  .btn-outline-secondary {
    border: 1px solid var(--bb-dp-border) !important;
    border-radius: 10px !important;
    &:hover {
      background-color: var(--bb-dp-hover) !important;
      border-color: var(--bs-primary) !important;
      color: var(--bs-primary) !important;
    }
  }
}
```

Change it to add a sibling rule (Bootstrap's `.btn-outline-primary` already sets a 1px border via `.btn`, so only the radius needs overriding - color and hover are intentionally left untouched):

```scss
  .btn-outline-secondary {
    border: 1px solid var(--bb-dp-border) !important;
    border-radius: 10px !important;
    &:hover {
      background-color: var(--bb-dp-hover) !important;
      border-color: var(--bs-primary) !important;
      color: var(--bs-primary) !important;
    }
  }
  .btn-outline-primary {
    border-radius: 10px !important;
  }
}
```

- [ ] **Step 2: Manually verify in the running app**

Run `npm start` from the repo root, open the torrent grid, open the column filter popup for a date column (e.g. "Added On"), and visually compare the Apply button's corner rounding to the Today/Clear buttons - they should now look identical in shape (colors will still differ: Apply stays primary blue, Today/Clear stay outline-secondary).

- [ ] **Step 3: Commit**

```bash
git add packages/app/src/app/components/datepicker-range-filter/datepicker-range-filter.scss
git commit -m "#213: match Apply button shape to Today/Clear in datepicker range filter"
```

---

### Task 2: Conditional bottom-left date label

**Files:**

- Modify: `packages/app/src/app/components/datepicker-range-filter/datepicker-range-filter.html:67-123`
- Test: `packages/app/src/app/components/datepicker-range-filter/datepicker-range-filter.spec.ts`

**Interfaces:**

- Consumes: `component.fromDate: NgbDate | null`, `component.toDate: NgbDate | null`, `component.fmt(d: NgbDate): string` (all already exist, unchanged).
- Produces: no new component members - template-only change.

- [ ] **Step 1: Write failing DOM tests for the three label states**

Add to `packages/app/src/app/components/datepicker-range-filter/datepicker-range-filter.spec.ts`, right after the existing `describe('isRangeStart', ...)` block (before the final closing `});` of the outer `describe`):

```ts
describe('date label rendering', () => {
  function getDateChips(): NodeListOf<Element> {
    return fixture.nativeElement.querySelectorAll('.bb-date-chip');
  }

  it('renders no date chips when nothing is selected', () => {
    component.fromDate = null;
    component.toDate = null;
    fixture.detectChanges();
    expect(getDateChips().length).toBe(0);
  });

  it('renders a single date chip when only fromDate is set', () => {
    component.fromDate = new NgbDate(2024, 3, 5);
    component.toDate = null;
    fixture.detectChanges();
    const chips = getDateChips();
    expect(chips.length).toBe(1);
    expect(chips[0].textContent).toBe('2024-03-05');
  });

  it('renders two date chips (from and to) when a range is set', () => {
    component.fromDate = new NgbDate(2024, 3, 5);
    component.toDate = new NgbDate(2024, 3, 20);
    fixture.detectChanges();
    const chips = getDateChips();
    expect(chips.length).toBe(2);
    expect(chips[0].textContent).toBe('2024-03-05');
    expect(chips[1].textContent).toBe('2024-03-20');
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run from `packages/app/`: `npx ng test --watch=false --include=src/app/components/datepicker-range-filter/datepicker-range-filter.spec.ts`
Expected: the three new tests FAIL (the first fails because the placeholder chips currently always render 2 elements; the second and third fail on chip text since today's template still renders placeholder text `---- / -- / --` on the second line when `toDate` is unset).

- [ ] **Step 3: Replace the label block with conditional rendering and pin the button row right**

In `packages/app/src/app/components/datepicker-range-filter/datepicker-range-filter.html`, replace lines 67-123 (the whole `<div class="d-flex justify-content-between ...">` row through its closing `</div>`) with:

```html
<div class="d-flex align-items-center mt-3 gap-2 px-1">
  @if (fromDate) {
  <div class="d-flex flex-column gap-1">
    <div class="small text-body-secondary d-flex align-items-center gap-2">
      <span style="width: 42px; opacity: 0.7">
        {{ (toDate ? 'components.datepicker-range-filter.label.from' :
        'components.datepicker-range-filter.label.date' ) | translate }}:
      </span>
      <span class="bb-date-chip">{{ fmt(fromDate) }}</span>
    </div>
    @if (toDate) {
    <div class="small text-body-secondary d-flex align-items-center gap-2">
      <span style="width: 42px; opacity: 0.7">
        {{ 'components.datepicker-range-filter.label.to' | translate }}:
      </span>
      <span class="bb-date-chip">{{ fmt(toDate) }}</span>
    </div>
    }
  </div>
  }

  <div class="d-flex gap-2 align-items-center ms-auto">
    <button
      class="btn btn-sm btn-outline-secondary btn-split"
      type="button"
      (click)="dp.navigateTo(today)"
    >
      <bb-btn-content
        [icon]="icons.faCalendarDay"
        [text]="'general.button.today' | translate"
        [position]="'end'"
      ></bb-btn-content>
    </button>
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
```

(The Today button's `(click)` still calls `dp.navigateTo(today)` here - Task 3 changes it to `selectToday(dp)`. Keeping it as-is in this step isolates the label/layout change from the behavior change.)

- [ ] **Step 4: Run the tests to verify they pass**

Run from `packages/app/`: `npx ng test --watch=false --include=src/app/components/datepicker-range-filter/datepicker-range-filter.spec.ts`
Expected: PASS - all tests including the three new ones.

- [ ] **Step 5: Manually verify in the running app**

Run `npm start`, open the date filter popup:

- With no date selected, confirm no "From"/"Date" text shows at all, and the Today/Clear/Apply buttons sit flush right (same position as before).
- Click one day: confirm a single line `Date: <formatted date>` appears, buttons stay right-aligned.
- Click a second, later day: confirm it switches to two lines `From: ...` / `To: ...`, buttons stay right-aligned.

- [ ] **Step 6: Commit**

```bash
git add packages/app/src/app/components/datepicker-range-filter/datepicker-range-filter.html packages/app/src/app/components/datepicker-range-filter/datepicker-range-filter.spec.ts
git commit -m "#213: collapse datepicker range filter date label to only show selected dates"
```

---

### Task 3: Today button stages today as a fresh start date

**Files:**

- Modify: `packages/app/src/app/components/datepicker-range-filter/datepicker-range-filter.ts`
- Modify: `packages/app/src/app/components/datepicker-range-filter/datepicker-range-filter.html` (Today button `(click)` handler, set in Task 2)
- Test: `packages/app/src/app/components/datepicker-range-filter/datepicker-range-filter.spec.ts`

**Interfaces:**

- Consumes: `component.today: NgbDate`, `component.fromDate`, `component.toDate`, `component.hoveredDate`, `component.viewDate: { month: number; year: number }` (all already exist).
- Produces: `selectToday(dp: { navigateTo: (date: NgbDate) => void }): void` - new public method. Later template wiring calls it as `selectToday(dp)` where `dp` is the `#dp` template reference to `<ngb-datepicker>`.

- [ ] **Step 1: Write failing unit tests for `selectToday`**

Add to `packages/app/src/app/components/datepicker-range-filter/datepicker-range-filter.spec.ts`, right after the `describe('date label rendering', ...)` block added in Task 2:

```ts
describe('selectToday', () => {
  it('sets fromDate to today and clears toDate and hoveredDate', () => {
    component.fromDate = new NgbDate(2024, 1, 1);
    component.toDate = new NgbDate(2024, 1, 20);
    component.hoveredDate = new NgbDate(2024, 1, 15);
    const dp = { navigateTo: vi.fn() };

    component.selectToday(dp);

    expect(component.fromDate).toEqual(component.today);
    expect(component.toDate).toBeNull();
    expect(component.hoveredDate).toBeNull();
  });

  it('always resets to today even when nothing was previously selected', () => {
    component.fromDate = null;
    component.toDate = null;
    const dp = { navigateTo: vi.fn() };

    component.selectToday(dp);

    expect(component.fromDate).toEqual(component.today);
    expect(component.toDate).toBeNull();
  });

  it('updates viewDate to match today', () => {
    component.viewDate = { month: 1, year: 2020 };
    const dp = { navigateTo: vi.fn() };

    component.selectToday(dp);

    expect(component.viewDate).toEqual({
      month: component.today.month,
      year: component.today.year,
    });
  });

  it('navigates the calendar view to today', () => {
    const dp = { navigateTo: vi.fn() };

    component.selectToday(dp);

    expect(dp.navigateTo).toHaveBeenCalledWith(component.today);
  });

  it('does not call filterChangedCallback - selecting today only stages it', () => {
    const dp = { navigateTo: vi.fn() };

    component.selectToday(dp);

    expect(mockParams.filterChangedCallback).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run from `packages/app/`: `npx ng test --watch=false --include=src/app/components/datepicker-range-filter/datepicker-range-filter.spec.ts`
Expected: FAIL with "component.selectToday is not a function".

- [ ] **Step 3: Implement `selectToday` in the component**

In `packages/app/src/app/components/datepicker-range-filter/datepicker-range-filter.ts`, add the new method right after `moveMonth` (which already takes a `dp: any` parameter following the same pattern used by `updateView`/`moveMonth`):

```ts
  selectToday(dp: any) {
    this.fromDate = this.today;
    this.toDate = null;
    this.hoveredDate = null;
    this.viewDate = { month: this.today.month, year: this.today.year };
    dp.navigateTo(this.today);
  }
```

- [ ] **Step 4: Run the tests to verify they pass**

Run from `packages/app/`: `npx ng test --watch=false --include=src/app/components/datepicker-range-filter/datepicker-range-filter.spec.ts`
Expected: PASS - all tests including the five new ones.

- [ ] **Step 5: Wire the Today button to the new method**

In `packages/app/src/app/components/datepicker-range-filter/datepicker-range-filter.html`, change the Today button's click handler from:

```html
<button
  class="btn btn-sm btn-outline-secondary btn-split"
  type="button"
  (click)="dp.navigateTo(today)"
></button>
```

to:

```html
<button
  class="btn btn-sm btn-outline-secondary btn-split"
  type="button"
  (click)="selectToday(dp)"
></button>
```

- [ ] **Step 6: Run the full component test suite once more**

Run from `packages/app/`: `npx ng test --watch=false --include=src/app/components/datepicker-range-filter/datepicker-range-filter.spec.ts`
Expected: PASS - the template change doesn't affect any test (no test exercises the Today button's click binding directly), confirming nothing broke.

- [ ] **Step 7: Manually verify in the running app**

Run `npm start`, open the date filter popup:

- With a range already selected (from/to), click Today. Confirm the selection collapses to a single `Date: <today>` line, the calendar view jumps to/stays on today's month with today highlighted, and the grid is NOT re-filtered yet (Apply button becomes enabled/highlighted as pending, but the underlying torrent grid rows don't change until you click Apply).
- Click Apply and confirm the grid now filters to only today's date.
- With no selection, click Today, confirm it stages today the same way, then click Clear and confirm it resets fully.

- [ ] **Step 8: Commit**

```bash
git add packages/app/src/app/components/datepicker-range-filter/datepicker-range-filter.ts packages/app/src/app/components/datepicker-range-filter/datepicker-range-filter.html packages/app/src/app/components/datepicker-range-filter/datepicker-range-filter.spec.ts
git commit -m "#213: today button stages today as a new start date instead of only navigating"
```
