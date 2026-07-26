# Folder-picker error column

## Problem

The add-torrent folder picker grid marks entries with `state: 'error'` (scan-time
parse failure) or `state: 'failed'` (add-time failure) and stores an
`errorMessage` on the row, but there is no way to actually read that message.
The state column has a `tooltipValueGetter` that returns it, but it never
fires: `GRID_SHARED_OPTIONS` sets `tooltipShowMode: 'whenTruncated'`, and the
short state label text never truncates in a 120px column.

## Design

- Add a new column to `folder-picker.ts`'s `getColDefs()`: `colId:
'errorMessage'`, `field: 'errorMessage'`, header "Error"
  (`components.add-torrent.folder-picker.col-def.error`), `hide: true` by
  default, `tooltipField: 'errorMessage'` (for overflow), `filter:
TextColumnFilter`, consistent with the existing `name`/`relativePath`
  columns.
- Add an `effect()` that watches `rows()` and calls
  `gridApi.setColumnsVisible(['errorMessage'], hasError)` where `hasError` is
  true when any row has `state === 'error' || state === 'failed'`. This
  covers both scan-time parse errors and add-time failures - both already
  carry a real `errorMessage`, so there's no reason to treat them
  differently.
- The auto-reveal must not get persisted as a saved column layout. Guard the
  programmatic `setColumnsVisible` call with a suppression flag (mirroring
  `isRestoringState`) so the existing `onColumnVisible: () =>
this.queueSave()` hook skips saving when the visibility change originated
  from this effect. A manual show/hide via the column header context menu
  must continue to persist as it does today.
- Remove the dead `errorMessage` branch from the state column's
  `tooltipValueGetter` (it never fired due to `tooltipShowMode`, and is now
  redundant with the visible column); leave it returning just the state
  label.

## Out of scope

- No changes to how `markFailed`/`parseEntry` compute `errorMessage` - the
  data already exists.
- No changes to the toast shown after a partial-failure submit
  (`components.add-torrent.toast.folder-partial`).
