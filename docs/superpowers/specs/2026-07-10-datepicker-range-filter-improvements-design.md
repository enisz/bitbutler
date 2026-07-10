# Datepicker Range Filter Improvements - Design

Continuation of issue #213 (configurable date format). This round targets the
`DatepickerRangeFilter` calendar popup used for the `added_on`, `last_activity`,
`seen_complete`, and `completion_on` grid columns, plus a related general
setting for first day of week.

## 1. Remove the unused `DatepickerFilter` component

`packages/app/src/app/components/datepicker-filter/` (`datepicker-filter.html`,
`.ts`, `.scss`, `.spec.ts`) is dead code - `grid.lib.ts` only ever registers
`DatepickerRangeFilter` as a column filter, which already supports both
single-date and range selection. Delete the whole folder.

## 2. Date chips use the configured date format

Today `DatepickerRangeFilter.fmt()` hardcodes `yyyy-MM-dd`. It should use the
user's configured date format instead, but without a time component (the
`from`/`to` chips represent whole days, not instants).

`resolveDateFormat()` in `general-settings.model.ts` returns an additional
`datePattern` field (date-only) alongside the existing `pattern`/`locale`:

- `follow-language` -> Angular's built-in `'shortDate'` token
- `iso` -> `'yyyy-MM-dd'`
- `us` -> `'MM/dd/yyyy'`
- `eu` -> `'dd.MM.yyyy'`
- `custom` -> the user's custom pattern with time tokens (`HH`, `H`, `hh`, `h`,
  `mm`, `ss`, `a`) and their now-orphaned separator characters stripped out.
  Quoted literal segments (`'...'`) are left untouched. If stripping empties
  the pattern, fall back to `'yyyy-MM-dd'`.

`DateFormatService.resolved` exposes `datePattern` in addition to `pattern`/
`locale`. `DatepickerRangeFilter.fmt(d: NgbDate)` calls
`formatDate(new Date(d.year, d.month - 1, d.day), resolved().datePattern, resolved().locale)`
instead of its current manual string building.

## 3. Popup close behavior

Two related behavior changes to the ag-grid filter popup that hosts this
component:

- **Selecting a date must not close the popup.** Currently the popup closes
  as soon as a date is clicked. The exact trigger wasn't conclusively
  identified via static code reading (ag-grid's `PopupService` closes modal
  popups on document `mousedown`/`touchstart` outside the popup's own DOM, or
  when an anchored popup's anchor element briefly reports a zero bounding
  rect) - implementation will reproduce the issue live in the dev server and
  fix whatever is triggering it, then verify manually.
- **Explicit close control.** Add a `btn-link` "Close" button to the button
  row that calls `this.params.api.hidePopupMenu()` (a real `GridApi` method).
- Outside-click-to-close is ag-grid's default modal popup behavior already;
  confirm it still works once the above fix lands (it should require no
  additional code).

## 4. Selection visuals (pill shape for ranges)

Current CSS (`datepicker-range-filter.scss`) already renders a single
selected date (`fromDate` set, no `toDate`) as a full circle, since
`.bb-day--from` and `.bb-day--to` share `border-radius: 50%`. That part is
already correct and unchanged.

When a real range exists (`toDate` set) or a hover-preview is active
(`fromDate` set and hovering past it, i.e. the same condition already used by
`isHovered()`), change the shape so the two ends visually connect through the
flat `--between` cells into one continuous stadium/pill shape instead of two
separate circles with a rectangle strip between them:

- `fromDate` cell: `border-radius: 50% 0 0 50%` (rounded left, square right)
- `toDate` cell: `border-radius: 0 50% 50% 0` (square left, rounded right)

Implementation adds a component method (e.g. `isRangeStart(date)`) that is
true when `isFrom(date)` and either `toDate` or an active hover-preview exists,
used as a modifier class alongside the existing `bb-day--from`. `toDate` is
only ever set as the second half of an actual 2-date range (see `onSelect()`),
so `.bb-day--to` can unconditionally use the square-left/rounded-right shape.

## 5. Button row changes

- `Today` / `Clear` buttons: add `[position]="'end'"` to their existing
  `<bb-btn-content>` usage so the icon renders after the text (the component
  already supports this - see `bb-btn-content.ts`/`.html` - and it's already
  used this way in 27 other places in the app, so no new component work is
  needed).
- Add the "Close" `btn-link` button described in §3, to the right of
  Today/Clear.

## 6. First day of week

New setting: `GeneralSettings.dateFormat.firstDayOfWeek: 'auto' | 'sunday' |
'monday' | 'saturday'`, default `'auto'`.

- `'auto'` resolves via `Intl.Locale(locale).getWeekInfo().firstDay` at
  runtime. Verified directly in this environment: `en-US` -> `7` (Sunday),
  `hu-HU` -> `1` (Monday) - this numbering (1=Monday...7=Sunday) matches
  `ngb-datepicker`'s `firstDayOfWeek` input directly, so no hardcoded
  language-to-day map is needed. Falls back to `1` (Monday) if
  `Intl.Locale.prototype.getWeekInfo` is unavailable in the runtime.
- Explicit `sunday` / `monday` / `saturday` map directly to `7` / `1` / `6`.
- `DateFormatService.resolved` gains a `firstDayOfWeek: number` field,
  computed the same way `pattern`/`locale`/`datePattern` already are.
- `DatepickerRangeFilter` binds
  `[firstDayOfWeek]="dateFormatService.resolved().firstDayOfWeek"` on its
  `<ngb-datepicker>`.
- New dropdown added to the existing "Date & Time" fieldset in General
  settings (same `dateFormat` form group as the date format preset), below
  the preset selector: `Auto / Sunday / Monday / Saturday`.

## Testing

- Unit tests for `resolveDateFormat()`'s new `datePattern` derivation
  (per-preset and custom-pattern stripping, including the empty-after-strip
  fallback).
- Unit tests for the new first-day-of-week resolver (`auto` via `Intl.Locale`,
  explicit overrides, and the no-`Intl.Locale.getWeekInfo` fallback).
- Unit tests for the new range-start/pill-shape class logic in
  `DatepickerRangeFilter` (single date vs. range vs. hover-preview).
- `DatepickerFilter`'s existing spec file is deleted along with the component.
- Manual verification in the running app (per project convention for UI
  changes): date chip formatting across presets, pill visuals for single vs.
  range selection, popup staying open through both date clicks, the new
  Close button, first-day-of-week auto-detection for both `us`/`hu` languages
  and manual overrides.
