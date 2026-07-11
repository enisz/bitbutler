# Datepicker Range Filter Apply Button - Design

Continuation of issue #213 (configurable date format). Follow-up to the
`2026-07-10-datepicker-range-filter-improvements-design.md` popup-close fix,
which stopped `mousedown`/`touchstart` from reaching `document` so ag-grid's
`PopupService` outside-click detector can no longer misfire on an in-popup
click.

That fix addressed one cause of the popup closing itself, but not the whole
problem: `DatepickerRangeFilter.onSelect()` calls
`this.params.filterChangedCallback()` on every date click, which updates the
ag-grid filter model and triggers a filter re-render on each pick - two
clicks in, a range selection is still not achievable without the popup's
containing grid re-rendering out from under the interaction. This round
gates the actual grid filter update behind an explicit "Apply" button so
picking dates never triggers a grid update by itself.

## 1. Split staged vs. applied state in `DatepickerRangeFilter`

`fromDate`/`toDate` keep their current meaning and stay wired to everything
the calendar UI already reads/writes: `onSelect()`, `isFrom`/`isTo`/
`isInside`/`isHovered`/`isRangeStart`, the date chips (`fmt`), and the Today
button (`dp.navigateTo`). These represent the **staged** selection - what's
currently shown in the calendar and chips while the popup is open.

Two new fields, `appliedFrom: NgbDate | null` and `appliedTo: NgbDate |
null`, become the **applied** filter state - the source of truth for what
the grid is actually filtering on:

- `doesFilterPass()` reads `appliedFrom`/`appliedTo` instead of
  `fromDate`/`toDate`.
- `getModel()` returns `{ from: this.appliedFrom, to: this.appliedTo }` (or
  `null`) based on `appliedFrom`/`appliedTo`.
- `isFilterActive()` returns `this.appliedFrom !== null` - this drives
  ag-grid's column-header "filter active" icon, so it must reflect what's
  actually applied, not what's staged mid-pick.

`onSelect()` no longer calls `this.params.filterChangedCallback()` - it only
mutates the staged `fromDate`/`toDate`, exactly as before minus that one
call. Picking dates in the calendar therefore never touches the grid filter
model or triggers a re-render.

## 2. Apply, Clear, and popup-reopen semantics

**`apply()`** (new method): copies staged into applied
(`appliedFrom = fromDate`, `appliedTo = toDate`) and calls
`this.params.filterChangedCallback()`. This is the only path (besides
`clear()`) through which a pending selection reaches the grid.

**`clear()`** (existing method, extended): resets both staged and applied
fields to `null` (`fromDate`, `toDate`, `hoveredDate`, `appliedFrom`,
`appliedTo`) and calls `filterChangedCallback()` immediately - Clear keeps
its current immediate-effect behavior; only date picks are gated behind
Apply.

**`afterGuiAttached()`** (new `IFilterAngularComp` lifecycle method,
`IAfterGuiAttachedParams` from `ag-grid-community`): resets
`fromDate = appliedFrom`, `toDate = appliedTo`, `hoveredDate = null`.
ag-grid calls this every time the filter popup is shown (including
reopening after a prior outside-click close, since ag-grid keeps one filter
component instance alive per column rather than recreating it). This is
what implements "discard on close without Apply": a pending, un-applied
pick made before the user clicks outside the popup is simply overwritten by
the last-applied state the next time the popup opens. No dedicated
close/dismiss hook is needed - `doesFilterPass`/`getModel`/
`isFilterActive` already only ever look at `appliedFrom`/`appliedTo`, so a
stale staged value sitting unused between closes has no effect on the grid
either way.

**`setModel()`** (existing method, extended): sets both staged and applied
fields from the incoming model (`appliedFrom = model?.from ?? null`, mirrored
into `fromDate`; likewise for `to`/`toDate`). This covers external model
changes (e.g. a saved filter set being restored) while the popup happens to
be open, and is a no-op-equivalent to today's behavior when the popup is
closed, since `afterGuiAttached()` re-syncs on next open regardless.

## 3. Apply button UI

New `isApplyDisabled(): boolean` compares staged against applied
(null-safe; uses `NgbDate.prototype.equals`, matching the pattern already
used by `isFrom`/`isTo`) and returns `true` when they match, i.e. nothing is
pending to commit.

The button row (`datepicker-range-filter.html`) gains a third button after
Today and Clear:

```html
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
```

`btn-outline-primary` (vs. the existing two buttons' `btn-outline-secondary`)
gives it the accent-colored, visually-distinct treatment appropriate for the
commit action, while keeping the same `btn-split`/`bb-btn-content`/icon-after
shape as Today and Clear. `faCheck` (`@fortawesome/free-solid-svg-icons`,
already used elsewhere in the app, e.g. `confirm.ts`) is added to the
component's `icons` object.

A new `general.button.apply` translation key is added to both `us.json` and
`hu.json`, alongside the existing `general.button.today`/`general.button.clear`
keys.

## 4. Remove the now-unnecessary grid.ts workaround

Uncommitted changes on this branch (`grid.ts`'s `onColumnFilterChange`, plus
its `grid.spec.ts` tests) added a dedupe check comparing the incoming filter
model against `api.getFilterModel()` before re-applying it, to avoid a
needless `setFilterModel()`/`onFilterChanged()` round trip on every
filter-service echo. That workaround was compensating for the per-click
`filterChangedCallback()` storm this design removes at the source (Section

1. - once picking dates no longer touches the grid filter model at all, the
     echo loop it was guarding against can't happen for this filter, so the
     workaround is reverted (`git checkout --` on both files) rather than kept.

## Testing

- `DatepickerRangeFilter` spec: existing `isFilterActive`/`doesFilterPass`/
  `getModel`/`setModel` tests are rewritten to set/assert `appliedFrom`/
  `appliedTo` instead of `fromDate`/`toDate` (since those methods now read
  the applied fields). `onSelect` tests are unchanged in what they assert
  about `fromDate`/`toDate`, plus a new assertion that
  `filterChangedCallback` is **not** called by `onSelect`.
- New tests: `apply()` copies staged into applied and calls
  `filterChangedCallback`; `clear()` resets both staged and applied and
  calls `filterChangedCallback`; `afterGuiAttached()` resets staged from
  applied (including when they already match, and when a stale staged pick
  exists); `isApplyDisabled()` across matching staged/applied, a staged-only
  `fromDate`, and a full staged range differing from applied.
- `grid.spec.ts`: the dedupe-check describe block added on this branch is
  removed along with its `grid.ts` implementation (Section 4).
- Manual verification in the running app (per project convention for UI
  changes): open the filter popup on a date column, click a first date,
  confirm the popup stays open and the grid is unfiltered; click a second
  date, confirm the popup still stays open and the grid is still
  unfiltered; click Apply, confirm the grid filters by the range and the
  popup stays open; click Clear, confirm the grid filter clears
  immediately; close the popup via an outside click after picking dates but
  before Apply, reopen it, confirm the pending pick is gone and it shows the
  last-applied state instead.
