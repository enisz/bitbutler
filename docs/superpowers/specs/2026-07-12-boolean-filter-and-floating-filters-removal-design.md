# Boolean column filter + floating filters removal - design

## Context

Issue #216's column filter overhaul (`6fd3fb9`) migrated the torrent grid's text,
number, size, and set columns to custom popup filter components, and explicitly set
`floatingFilter: false` on every one of them since none of the new components have a
compact floating-row equivalent. That commit did not touch the grid's 5 boolean columns
(`auto_tmm`, `seq_dl`, `force_start`, `super_seeding`, `f_l_piece_prio`), which still use
`filter: 'agBooleanColumnFilter'`. That filter type does not exist in ag-Grid Community -
it's a no-op, so filtering on these columns is currently silently broken.

Because every filterable main-grid column now has `floatingFilter: false` (once boolean
columns get their own popup filter too), the app's floating-filters toggle - a settings
checkbox plus a context-menu action that flip `colDef.floatingFilter` between `true` and
`undefined` - has no effect anywhere on the main grid. It's dead weight and should be
removed for that grid.

The Trackers and Peers torrent-details modal grids are out of scope: they still use
built-in ag-Grid filters (`agTextColumnFilter`/`agNumberColumnFilter`) with no custom
popup equivalent, so floating filters still work there and stay as-is.

## Scope

1. Add a `BooleanColumnFilter` component and wire it onto the 5 boolean columns.
2. Remove the floating-filters feature from the main torrent grid only (settings
   checkbox, persisted setting, context-menu toggle, and the now-dead
   `floatingFilter: false` markers on every main-grid column).

## Part 1: BooleanColumnFilter

New component at
`packages/app/src/app/components/column-filters/boolean-column-filter/`, following the
`NumberColumnFilter` pattern exactly (extends `OperatorFilterBase<BooleanFilterValue>`,
same popup-portal/`appendTo` handling for ng-select inside the ag-grid popup).

- **Value shape:**
  ```ts
  interface BooleanFilterValue {
    value: boolean | null;
  }
  ```
  Empty/inactive is `{ value: null }`, matching `NumberFilterValue`'s "nullable field
  signals inactive" shape.
- **Logic** (the only methods `OperatorFilterBase` requires overriding):
  - `createEmptyValue()` → `{ value: null }`
  - `valuesEqual(a, b)` → `a.value === b.value`
  - `isActive(value)` → `value.value !== null`
  - `isValidModel(model)` → `model` is an object whose `value` is `null` or `boolean`
  - `doesFilterPass(params)` → `!isFilterActive() || this.params.getValue(node) === this.applied.value`
  - `apply()`, `clear()`, `isApplyDisabled()`, `afterGuiAttached()`, `getModel()`,
    `setModel()` are all inherited unchanged from the base class - no overrides needed.
- **Template** (`boolean-column-filter.html`): a single `.form-floating`-wrapped
  `<ng-select>` bound to `draft.value`, `[clearable]="true"`, `[searchable]="false"`,
  `[appendTo]="popupPortalSelector"`, two items (`true`/`false`) labeled per the new
  i18n keys below, floating label reusing the existing
  `components.column-filters.label.value` key ("Value"). Below it, the same
  `Clear`/`Apply` split-button row (`btn-split flex-fill`, `bb-btn-content`,
  `icons.faEraser`/`faCheck`) used by every other filter, in the `d-flex gap-2`
  container (matching the current side-by-side layout from the last two commits, not
  the older stacked layout).
- **New i18n keys** (added to both `public/i18n/us.json` and `public/i18n/hu.json`)
  under `components.column-filters.boolean`:
  - `true`: "True" / Hungarian equivalent
  - `false`: "False" / Hungarian equivalent
- **Wiring** (`grid.lib.ts`): import `BooleanColumnFilter` and replace
  `filter: 'agBooleanColumnFilter'` with `filter: BooleanColumnFilter` on the 5 boolean
  columns. `floatingFilter: false` is dropped from these columns as part of Part 2, not
  re-added.
- **Tests:** `boolean-column-filter.spec.ts` covering `doesFilterPass` for both
  true/false values and unset cells, `isFilterActive`/`getModel`/`setModel` round-trip,
  and `isValidModel` rejecting non-boolean payloads - mirroring the structure of
  `number-column-filter.spec.ts`.

## Part 2: Remove floating filters (main torrent grid only)

- **`grid.lib.ts`**: delete the `floatingFilter: false` line from every one of the
  ~60 main-grid column defs (dead once nothing ever sets a column's `floatingFilter` to
  `true`). Change the `onColumnHeaderContextMenu` handler's
  `gridContextMenuService.buildHeaderMenu(e)` call to
  `buildHeaderMenu(e, { enableFloatingFiltersToggle: false })`, hiding the "Show/hide
  floating filters" context-menu item on the main grid only - the option flag already
  exists in `grid-context-menu.service.ts` for exactly this purpose and Trackers/Peers
  don't pass it, so their toggle keeps working unchanged.
- **`grid.ts`**: delete the `applyGridSettings` block that reads
  `settings.floatingFilters` and maps it onto every `colDef.floatingFilter`.
- **`models/torrent-list-grid.model.ts`**: remove the `floatingFilters: boolean` field
  and its `false` default. `TrackersGridSettings`/`PeersGridSettings` are untouched.
- **`modals/settings/torrent-list-grid/torrent-list-grid.ts`**: remove the
  `floatingFilters` `FormControl`, its `initializeForm` patch, and its `save()` mapping.
- **`modals/settings/torrent-list-grid/torrent-list-grid.html`**: remove the
  floating-filters checkbox + label + popover block.
- **i18n**: remove
  `pages.settings.tab.torrent-list-grid.torrent-list-grid-form.floating-filters` and
  `pages.settings.tab.torrent-list-grid.popover.floating-filters.*` from `us.json` and
  `hu.json`. The shared
  `pages.main.grid.context-menu.item.show-floating-filters`/`hide-floating-filters` keys
  are left in place since Trackers/Peers still use them via the same
  `grid-context-menu.service.ts`.
- **Tests**: update `grid.spec.ts`, `torrent-list-grid.spec.ts`, and
  `grid-context-menu.service.spec.ts` for the removed form control, removed settings
  field, and the main-grid `enableFloatingFiltersToggle: false` call - without touching
  the trackers/peers-focused assertions in the same spec files, which continue to
  exercise the toggle as before.

## Non-goals

- No changes to Trackers or Peers modal grids, their settings models, or their
  floating-filters behavior.
- No changes to any other column filter's matching logic or styling.
- No data migration for existing persisted `floatingFilters` values in
  `TorrentListGridSettings` - the field is simply no longer read; a stale key left over
  in a user's saved JSON blob is harmless.

## Verification

- `npm run lint`
- `npm test`
- Manual check via `npm start`: open the boolean filter popup on each of the 5 boolean
  columns, confirm True/False selection filters rows correctly, confirm Clear/Apply
  behave like the other filters, and confirm the main grid's column header context menu
  no longer shows a "Show/hide floating filters" item while the Trackers and Peers modal
  grids still do.
