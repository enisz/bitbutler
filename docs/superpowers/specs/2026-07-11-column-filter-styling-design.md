# Column filter styling overhaul - design

## Context

Issue #216 wired the text/number/size/set column filters into the torrent grid. The
components work but look cramped and inconsistent with the rest of the app: plain
`<ng-select>` and `<input>` fields instead of the floating-label style used on the login
page and elsewhere, side-by-side buttons squeezed into a ~220-240px popover, dropdown
panels that get clipped by the ag-grid popup container, and (for the set filter used by
tags/categories/states) badges that render with white text instead of matching the left
sidebar's theme-aware badge color.

This pass is visual/structural only - no filtering logic changes.

## Scope

Applies to all four filter components under
`packages/app/src/app/components/column-filters/`:

- `text-column-filter`
- `number-column-filter`
- `size-column-filter`
- `set-column-filter` (backs the tags/categories/states filters)

`datepicker-range-filter` is out of scope - it already has its own bespoke styling.

## 1. Shared sizing & ng-select behavior

- Bump the popover `min-width` from 220-240px to **360px** in each component's
  `.scss` (`.bb-column-filter` / `.bb-set-filter`).
- Every `<ng-select>` gets a static `appendTo="body"` attribute, matching the existing
  convention in `bb-file-tree`, `manage-categories`, `add-torrent/options`, etc. This
  attaches the dropdown panel to `<body>` so it isn't clipped by the ag-grid filter
  popup's overflow.
- Each `<ng-select>` is wrapped in a `.form-floating` div with a `<label>`, mirroring the
  login page's host selector (`packages/app/src/app/pages/login/login.html`). The global
  `.form-floating ng-select` rules already in `packages/app/src/styles.scss` handle the
  floating animation and layout - no new global CSS is needed.
- New i18n keys (added to both `public/i18n/us.json` and `public/i18n/hu.json`) under
  `components.column-filters.label`:
  - `operator`: "Operator" / Hungarian equivalent
  - `unit`: "Unit" / Hungarian equivalent

## 2. Text / Number / Size filter templates

- The operator `<ng-select>` becomes a floating-label select labeled "Operator".
- The size filter's unit `<ng-select>` becomes a floating-label select labeled "Unit".
- Every plain `<input>` (value / from / to) is wrapped in its own `.form-floating` with a
  unique `id` and `<label for>`, following the pattern used in
  `packages/app/src/app/modals/manage-tags/manage-tags.html`. Inputs use `class="form-control"`
  (not `form-control-sm`) since floating labels need the taller control height. Existing
  placeholder text moves to the `<label>` text.
- Clear/Apply buttons stop being a `d-flex gap-2` row of `flex-fill` buttons and instead
  stack vertically, each full width: Clear first (`btn btn-outline-secondary btn-split
w-100 mb-2`), then Apply (`btn btn-outline-primary btn-split w-100`).

## 3. Set filter (tags / categories / states)

- **Badge color fix**: replace `badge text-bg-secondary` with the same classes the
  sidebar's `filter-group` uses for its neutral badges: `badge bb-status-badge
bb-status-badge--neutral`. The relevant CSS (currently scoped inside
  `filter-group.scss` under `.list-group-item-action .bb-status-badge`) is duplicated
  into `set-column-filter.scss` so the badge renders with the theme's correct
  (non-white) text color independent of the sidebar component.
- **List-group conversion**: each row becomes a
  `<label class="list-group-item list-group-item-action d-flex align-items-center gap-2">`
  that wraps the checkbox `<input>`, a `<span class="text-truncate flex-grow-1">` for the
  label text, and the count badge. Because the checkbox is nested inside its own
  `<label>`, clicking anywhere on the row toggles it natively (standard label-for-input
  behavior) - no extra click handler is needed, and keyboard/tab access is preserved via
  the checkbox itself. The badge sits after the flex-growing label span, so it's pushed
  to the right edge; the checkbox and text stay left-aligned.
- **Checked-row highlight**: rows bind `[class.active]` to
  `draftValues.has(item.key)`, reusing an adapted version of the sidebar's `.active`
  background/border treatment (adapted for multi-select rather than single-active).
- The filter-text input and Clear/Apply buttons get the same floating-input and
  stacked-button treatment as section 2, for visual consistency. The set filter's
  container width also goes to 360px.

## Non-goals

- No changes to filter matching logic, `doesFilterPass`, `getModel`/`setModel`, or any
  other behavioral code in these components.
- No changes to `datepicker-range-filter`.
- No changes to the sidebar `filter-group` component itself (it already renders badges
  correctly - only the set filter's copy needs the class fix).

## Verification

- `npm run lint`
- `npm test` - existing filter spec files assert component logic only (no DOM
  assertions), so they should be unaffected; run them to confirm.
- Manual check via `npm start`: open each of the four filter types on the torrent grid
  and confirm:
  - dropdown panels aren't clipped
  - floating labels animate correctly in light/dark and the user's custom theme
  - buttons are full-width, one per line
  - set filter badges match the sidebar's badge text color
  - set filter rows are clickable anywhere on the line, checked rows are visually
    highlighted, badges align right
