# Design: Surface folder-add submission errors in the picker grid

## Problem

When adding torrents from a folder (`AddTorrent` modal, folder input mode), `handleSubmit` submits each selected `ScannedTorrentEntry` to qBittorrent individually in a loop (`packages/app/src/app/modals/add-torrent/add-torrent.ts`, folder branch). If an individual `torrentsAdd` call fails, the failure is caught and only `console.error`'d - the user gets no feedback beyond the aggregate `folder-partial` toast ("Added X of Y torrent(s)"), with no indication of which entries failed or why.

Scan-time errors (a `.torrent` file that fails to parse during the initial folder scan) are already surfaced well: `ScannedTorrentEntry.state` can be `'error'`, shown via the State column, with `errorMessage` exposed as a tooltip. This design extends the same mechanism to cover submission-time failures, and adds a success state so the grid narrows down to just the entries that still need attention after a partial failure.

## Data model

Extend `ScannedTorrentState` (`packages/app/src/app/models/add-torrent-folder.model.ts`) from `'new' | 'exists' | 'error'` to:

```ts
export type ScannedTorrentState = 'new' | 'exists' | 'error' | 'added' | 'failed';
```

- `'error'` - unchanged. Scan-time parse failure. Unselectable, muted/greyed row.
- `'added'` (new) - this entry was successfully submitted this session. Filtered out of the visible grid immediately (not just muted) so the grid narrows to what still needs attention.
- `'failed'` (new) - a `torrentsAdd` call for this entry failed during submit. Selectable, styled as an error row (same red treatment as `'error'`), so the entry stays checked and a subsequent Submit click retries just the failed entries.

## Submission flow (`add-torrent.ts`)

In the folder branch of `handleSubmit`, for each entry in the submit loop:

- On success: call `this.generalTab()?.markFolderEntryAdded(entry.path)`. Keep existing behavior (increment `succeeded`, optionally delete the source file).
- On failure: extract a message via `String((e as Error)?.message ?? e)` and call `this.generalTab()?.markFolderEntryFailed(entry.path, message)`, in addition to the existing `console.error` (kept for developer-side diagnostics).

The `folder-partial` toast text is unchanged ("Added {{succeeded}} of {{total}} torrent(s)"). It remains the at-a-glance signal that something needs attention; the grid now carries the per-entry detail.

## `AddTorrentGeneral` (`general.ts`)

Add two passthrough methods alongside the existing `getSelectedFolderEntries`, delegating to the folder-picker view child:

```ts
public markFolderEntryAdded(path: string): void {
  this.folderPicker()?.markAdded(path);
}

public markFolderEntryFailed(path: string, error: string): void {
  this.folderPicker()?.markFailed(path, error);
}
```

## `AddTorrentFolderPicker` (`folder-picker.ts`)

- Add `markAdded(path: string)` and `markFailed(path: string, error: string)`, following the existing `renameEntry` pattern: update the cached entry in `cache` and immutably update the `rows` signal.
- Add `visibleRows = computed(() => this.rows().filter((r) => r.state !== 'added'))`. Bind the grid's `[rowData]` to `visibleRows()` instead of `rows()`, so `'added'` rows disappear from view as soon as they're marked, without needing a rescan.
- The State column's `SetColumnFilter` value list (`stateItems`) is computed from `visibleRows()` instead of `rows()`, so `"Added"` never appears as a filterable option (it would never match a displayed row).
- `rowClassRules`:
  - `GRID_ROW_MUTED_CLASS`: narrow from "any state !== 'new'" to `state === 'exists'` only.
  - Add `'text-danger bg-danger-subtle'` (the same class the main torrent grid uses for qBittorrent's own `error` torrent state) for `state === 'error' || state === 'failed'`.
- `isRowSelectable`: extend from `state === 'new'` to `state === 'new' || state === 'failed'`.
- `onRowDataUpdated`'s auto-select logic: extend from `node.data?.state === 'new'` to `node.data?.state === 'new' || node.data?.state === 'failed'`.
- No new column: the existing State-column tooltip (`params.data?.errorMessage ?? this.stateLabel(params.data?.state)`) already surfaces `errorMessage` when present, so it works unmodified once `markFailed` sets `errorMessage` on a `'failed'` entry.

`selectedEntries` / `selectedTotalSize` (computed off `rows()`, filtered by `selectedPaths`) need no changes: `'added'` entries get deselected via the `onRowDataUpdated` auto-select rule above, so they naturally drop out of the selection summary even though they remain in the underlying `rows()`/`cache` (kept there to avoid re-parsing them if the folder is rescanned).

## i18n

Add to `public/i18n/us.json` and `public/i18n/hu.json` under `components.add-torrent.folder-picker.state`:

- `"added": "Added"`
- `"failed": "Failed"`

## Retry flow (end-to-end)

1. User selects 5 entries, clicks Add. 3 succeed, 2 fail.
2. The 3 successful entries are marked `'added'` and disappear from the grid immediately. The 2 failed entries are marked `'failed'`, turn red, and stay checked/selectable.
3. Toast: "Added 3 of 5 torrent(s)." Modal stays open (existing behavior - only closes on full success).
4. User hovers a red row to see the specific error message, optionally fixes the underlying issue (e.g. frees disk space, fixes save path), and clicks Add again. Only the 2 still-selected `'failed'` entries are submitted.

## Testing

- `folder-picker.spec.ts`: `markAdded` removes the entry from `visibleRows`/grid display; `markFailed` sets `state: 'failed'` + `errorMessage`, keeps the row selectable, and applies the danger row class.
- `add-torrent.spec.ts`: on a per-entry `torrentsAdd` rejection, `markFolderEntryFailed` is called with the entry's path and a string message; on success, `markFolderEntryAdded` is called.
