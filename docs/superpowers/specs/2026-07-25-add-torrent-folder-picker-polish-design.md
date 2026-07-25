# Add Torrent folder picker polish - design

## Context

The folder-input mode of the Add Torrent modal (`AddTorrentFolderPicker`, wired into
`AddTorrentGeneral`) scans a folder for `.torrent` files and lists them in an ag-grid with
inline row selection and inline Name editing. Several UX gaps remain from the initial
implementation (#235):

1. The "Input Mode" popover text next to the file/link/folder button group is stale - it only
   describes file vs. link, and claims switching modes resets save path/category/tags, which is
   not true (`AddTorrent.switchInputMode` only updates the mode signal).
2. The folder-picker grid sits in a `col-11` next to a popover column, wasting width, and its
   explanatory text is locked inside a popover instead of being visible by default.
3. The grid always renders with fixed pixel/flex widths from the colDefs - it never auto-fits to
   the actual scanned content, and has no way to remember a user's manual column customizations
   across modal opens (unlike the trackers/peers/torrent-list grids).
4. Right-clicking a column header does nothing, unlike every other grid in the app.

## Goals

- Correct and extend the Input Mode popover copy.
- Remove the col-1 "Folder" popover; give the grid the full row width; surface its explanation as
  always-visible inline text under the recursive switch, extended to mention inline Name editing.
- Auto-size columns to fit content the first time the grid has no saved layout; once the user
  customizes column state (resize/move/pin/hide/sort), persist and restore it on future opens
  instead of re-autosizing.
- Add the same header-context-menu (sort / pin / resize / show-hide columns) already used by the
  torrent list, trackers, and peers grids.

## Non-goals

- No row/cell context menu for the folder-picker grid (not requested).
- No change to scan/selection/rename logic already implemented.

## Copy changes (`public/i18n/us.json`, `public/i18n/hu.json`)

`components.add-torrent.popover.input-mode.description`:

- `line1` -> "Choose whether you're adding this torrent from a local .torrent file, a magnet
  link / URL, or by scanning a folder for .torrent files."
- `line2` removed (the reset claim was inaccurate; nothing else needed replaces it).

`components.add-torrent.popover.folder` key removed entirely (title + description.line1/line2) -
its content moves into the new inline description below.

New key `components.add-torrent.folder-picker.description`:

- `line1`: "Select a folder containing .torrent files. Each file is parsed locally and listed
  below - no data is sent anywhere until you click Add." (verbatim from the removed folder
  popover)
- `line2`: "Use the Refresh button or toggle Recursive to re-scan the folder after adding or
  removing files on disk." (verbatim from the removed folder popover)
- `line3`: "Double-click a row's Name to rename it before adding - only new, not-yet-added
  torrents can be selected." (new)

hu.json gets the matching Hungarian translations for all of the above.

## Template changes

### `general.html`

Restructure the "Input" fieldset's grid/popover row so folder mode has no adjacent popover
column and spans the full width:

```html
@if (inputMode() === 'folder') {
<div class="col-12">
  <app-add-torrent-folder-picker [form]="form()"></app-add-torrent-folder-picker>
</div>
} @else {
<div class="col-11">
  @if (inputMode() === 'file') { ... existing file input group ... } @else { ... existing link
  textarea ... }
</div>
<div class="col-1 d-flex align-items-center mb-3">
  @if (inputMode() === 'file') { filePopover } @else { linksPopover }
</div>
}
```

Remove the `#folderPopover` `ng-template` and update `#inputModePopover`'s bound translation
keys per the copy changes above (`line2` binding removed from the template).

### `folder-picker.html`

Add a `form-text` block under the existing recursive-switch row (which keeps its small
`recursivePopover` unchanged):

```html
<div class="form-text mb-2">
  <p class="mb-1">{{ 'components.add-torrent.folder-picker.description.line1' | translate }}</p>
  <p class="mb-1">{{ 'components.add-torrent.folder-picker.description.line2' | translate }}</p>
  <p class="mb-0">{{ 'components.add-torrent.folder-picker.description.line3' | translate }}</p>
</div>
```

Wire `(gridReady)="onGridReady($event)"` on the `ag-grid-angular` element (currently missing).

## Column persistence: `AddTorrentGridSettingsService`

New files, mirroring the existing `TrackersGridSettingsService` pattern exactly:

- `packages/app/src/app/models/add-torrent-grid.model.ts`

  ```ts
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

- `packages/app/src/app/services/add-torrent-grid.settings.service.ts` - extends
  `BaseSettingsService<AddTorrentGridSettings>`, `SETTINGS_ID = 'AddTorrentGridSettingsService'`.
  Persisted via the existing generic `SettingsService` (settings table in the electron db) - no
  db.ts changes needed, same as trackers/peers.

## `folder-picker.ts` changes

Add the same column-state lifecycle as `trackers.ts`:

- Inject `ContextMenuService`, `GridContextMenuService`, `AddTorrentGridSettingsService`.
- `gridApi: GridApi | null`, `isRestoringState: boolean`, `saveState$ = new Subject<void>()`
  debounced 500ms in `ngOnInit`, calling `persistColumnState()`.
- `onGridReady(e)`: store `gridApi`, call `restoreColumnState()`.
- `restoreColumnState()`: `isRestoringState = true`; `load()` settings; `applyColumnState({
state: settings.columnState, applyOrder: true })`; record `isDefaultLayout = settings.columnState
=== DEFAULT_ADD_TORRENT_GRID_SETTINGS.columnState` (reference equality holds because
  `BaseSettingsService` only replaces the `columnState` array reference when something was
  actually stored); `isRestoringState = false`.
- `persistColumnState()`: read `gridApi.getColumnState()`, save via the settings service.
- `queueSave()`: no-ops while `isRestoringState`, otherwise `saveState$.next()`.
- `gridOptions` gains `onColumnResized` (only when `e.finished`), `onColumnMoved`,
  `onColumnPinned`, `onColumnVisible`, `onSortChanged` -> all call `queueSave()`.
- `gridOptions.onColumnHeaderContextMenu`: if `e.column`, `contextMenuService.open({ items:
gridContextMenuService.buildHeaderMenu(e), payload: { colId: e.column.getId(), displayName:
e.api.getDisplayNameForColumn(e.column, 'header') } })` - identical to `trackers.ts`.
- New `onFirstDataRendered(e)` handler on `gridOptions`: if `this.isDefaultLayout`, call
  `e.api.autoSizeAllColumns()`. Because this ag-grid event fires exactly once per grid instance
  (and a new `AddTorrentFolderPicker` instance is created every time the Add Torrent modal
  opens), this gives every session with no saved customization an auto-fit grid, while any
  session that already has a saved layout restores and keeps it untouched.

No changes to existing scan/selection/rename logic.

## Testing

- `add-torrent-grid.settings.service.spec.ts` - mirror
  `trackers-grid.settings.service.spec.ts` (default settings shape, merge-over-defaults, save
  behavior, `asObservable`).
- `folder-picker.spec.ts` additions mirroring `trackers.spec.ts`'s "column state management" and
  "header context menu" describe blocks: `restoreColumnState`/`persistColumnState`/`queueSave`
  behavior with a mocked `AddTorrentGridSettingsService`, and `onColumnHeaderContextMenu`
  open/no-op cases with a mocked `ContextMenuService` + `GridContextMenuService`. Add a case for
  `onFirstDataRendered` calling `autoSizeAllColumns` only when `isDefaultLayout` is true.
- `general.spec.ts` - update/add assertions for the col-12/col-11 split if it currently asserts
  on popover presence per mode.

## Risks / open questions

None outstanding - scope and copy confirmed with the user.
