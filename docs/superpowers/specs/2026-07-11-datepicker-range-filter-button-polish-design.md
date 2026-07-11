# Datepicker Range Filter - Button Polish - Design

Follow-up to the Apply button work on `DatepickerRangeFilter` (issue #213). Three
related fixes to the button row and date labels in
`packages/app/src/app/components/datepicker-range-filter/`.

## 1. Button shape consistency

`datepicker-range-filter.scss` overrides Bootstrap's default button shape for
Today/Clear via a `.btn-outline-secondary` rule inside the `:host ::ng-deep`
block (`border-radius: 10px !important`, custom border color, custom hover).
Apply uses `btn-outline-primary`, which has no matching override, so it falls
back to Bootstrap's smaller default radius - this is the visual mismatch the
user is seeing.

Fix: add a parallel `.btn-outline-primary` rule with the same
`border-radius: 10px !important` and `border: 1px solid` treatment. Apply's
existing primary color and Bootstrap's default hover behavior are left
unchanged (colors stay as-is).

## 2. Conditional bottom-left date label

Today the label area always renders both the "From"/"Date" line and the "To"
line, using `---- / -- / --` placeholders and reduced opacity when a date
isn't set yet. Replace this with conditional rendering based on `fromDate` /
`toDate`:

- Neither set: render nothing - the label `<div>` is entirely absent (e.g.
  `*ngIf="fromDate"` on the wrapper), taking up zero width.
- Only `fromDate` set: single line, using the existing
  `components.datepicker-range-filter.label.date` translation key -
  `Date: {{ fmt(fromDate) }}`.
- Both set (a real range): two lines, unchanged from today - `From:
{{ fmt(fromDate) }}` / `To: {{ fmt(toDate) }}`, using the existing `label.from`
  / `label.to` keys.

To keep the button row pinned to the right regardless of which of the three
label states is showing, drop `justify-content-between` from the row
container (`packages/app/src/app/components/datepicker-range-filter/datepicker-range-filter.html`,
the `d-flex ... mt-3 gap-2 px-1` row) and add `ms-auto` to the button group
instead, so the buttons' horizontal position no longer depends on the label
area's width.

## 3. Today button selects instead of only navigating

Today the Today button only calls `dp.navigateTo(this.today)` - it recenters
the calendar view without changing the selection.

New component method `selectToday(dp: any)` replaces the `(click)` handler,
following the existing pattern where `moveMonth(dp, step)` and
`updateView(dp)` already receive the `#dp` template reference as a parameter
from the template (`datepicker-range-filter.html`):

```ts
selectToday(dp: any) {
  this.fromDate = this.today;
  this.toDate = null;
  this.hoveredDate = null;
  this.viewDate = { month: this.today.month, year: this.today.year };
  dp.navigateTo(this.today);
}
```

The template call becomes `(click)="selectToday(dp)"`. `viewDate` is also
reset so the month/year `ng-select` dropdowns in the header stay in sync with
the calendar view (the same thing `onNavigate()` does when the view changes
by other means).

- Always resets the selection to make today the new `fromDate` (`toDate` and
  `hoveredDate` cleared), regardless of what was previously selected - this is
  a dedicated "start a fresh selection at today" action, not a feed into the
  existing three-state `onSelect()` cascade.
- Still navigates the calendar view to today so the newly-selected day is
  visible/highlighted, matching current behavior.
- Does **not** call `apply()` / `filterChangedCallback()`. It only stages the
  selection, same as clicking a day cell directly. The user must still click
  Apply to push it to the grid. `isApplyDisabled()` already compares staged
  vs. applied dates, so the Apply button's enabled state updates correctly
  with no extra work.

## Testing

- Unit tests for the new `selectToday()` method: resets `toDate`/`hoveredDate`,
  sets `fromDate` to today, does not call `filterChangedCallback`.
- Unit tests for the conditional label logic (no dates / one date / range).
- Manual verification in the running app (per project convention for UI
  changes): Apply button shape matches Today/Clear, label area collapses
  correctly across all three states without the button row shifting, and
  clicking Today stages (but doesn't apply) today as the start date.
