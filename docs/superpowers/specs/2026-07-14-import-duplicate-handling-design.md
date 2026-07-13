# Import Duplicate Handling - Design

Issue: [#229](https://github.com/enisz/bitbutler/issues/229)
Branch: `229-import-duplicate-handling`

## Problem

`ImportTorrents` (`packages/app/src/app/modals/import-torrents/`) imports a `.bbe`
archive by replaying each torrent through qBittorrent's
`/api/v2/torrents/add`, then `applyTorrentSettings` reapplies renames,
priorities, speed/share limits, super-seeding, and resume state
(`packages/electron/src/ipc/export.ts`).

When an archive contains a torrent whose info-hash already exists on the
target server:

- On qBittorrent versions that respond `409 Conflict` for a duplicate add,
  `qbRequest` throws, `runImport`'s catch block increments a generic
  `skipped` counter, and nothing else happens. Safe, but the user has no way
  to know in advance which torrents this affects, and "skipped" isn't
  distinguished from a genuine failure (missing torrent file in the archive,
  network error, etc).
- On qBittorrent versions that respond `200 Ok.` for a duplicate add (no
  error), `addTorrent` doesn't throw, so the hash is treated as newly added.
  The post-import confirmation loop finds it immediately (it already
  existed), and `applyTorrentSettings` runs against it unconditionally -
  silently overwriting the live torrent's file renames/priorities, speed
  limits, share limits, super-seeding, and force-resuming it per the chosen
  start mode, regardless of its current state on the server. This is
  reported as a normal successful import.

There is also no proactive check: unlike the single "Add Torrent" flow
(which cross-references `TorrentStoreService.torrentsMap()` client-side and
shows a `TorrentExists` modal), bulk import never looks at the currently
loaded torrent list before sending requests.

## Goals

- Duplicates (by info-hash, against the torrent list of the server being
  imported into) are never touched unless the user explicitly says so.
- The user sees, before import starts, which torrents in the archive already
  exist on the target server, with enough of the archived metadata to decide
  whether they want to override.
- The user can opt in per-torrent to override a duplicate, in which case it
  is processed exactly like any other entry in the import (no special-cased
  behavior).
- The final import summary distinguishes "already existed, skipped" from
  "genuinely failed" - these are different situations and were being
  conflated under one `skipped` count.

## Non-goals

- Detecting duplicates against servers other than the one currently being
  imported into.
- Any per-file (renames/priorities) preview in the duplicates grid - shown
  metadata is torrent-level only.
- Making the duplicates grid reactive to the Restore Options toggles above
  it (e.g. hiding a column when its toggle is off). The grid always shows
  the full raw archive values; the Restore Options section already explains
  what actually gets applied.

## Approach

Duplicate detection is computed entirely on the frontend, once
`BbeMetadata` is loaded (`ImportTorrents.loadBbe`):
`TorrentStoreService.torrentsMap()` already holds a live, continuously
polled view of the target server's current torrents (same source the
single-add flow already trusts for its own duplicate check), so no extra
IPC round trip is needed. Hash comparison is case-insensitive
(`.toLowerCase()` both sides), matching the convention already used in
`app.ts`'s `UI_TORRENT_EXISTS` check.

The backend does not re-derive duplicates itself. It receives the final
`skipHashes` list (computed as: archive hashes present in `torrentsMap()`,
minus whatever the user checked to override) and skips those hashes
unconditionally - no add call, no settings call, no confirmation-polling
entry. Overridden duplicates are simply left out of `skipHashes` and flow
through the existing pipeline untouched.

## Shared types (`packages/shared/src/ipc.types.ts`)

```ts
export interface ImportStartPayload {
  serverId: string;
  bbePath: string;
  restoreFields: ImportRestoreField[];
  startMode: ImportStartMode;
  pathMappings: BbePathMapping[];
  restoreCategories: boolean;
  restoreTags: boolean;
  categoryPathMappings: BbePathMapping[];
  overwriteCategories: boolean;
  skipHashes: string[]; // new
}
```

`BitButlerAPI['export']['onImportDone']` changes from
`(e: { total: number; skipped: number }) => void` to
`(e: { total: number; failed: number; alreadyExisted: number }) => void`.
This is a distinct inline type from `ExportDoneEvent` (which has `path` and
is unaffected), so this rename doesn't touch export at all.

- `total`: count of entries actually sent through the add/confirm/settings
  pipeline (i.e. archive entries minus `skipHashes`). Skipped duplicates are
  known upfront and don't need to be walked through the progress bar.
- `failed`: entries in that set where `addTorrent` threw (renamed from
  `skipped` now that the name would otherwise be ambiguous with the new
  `alreadyExisted` count).
- `alreadyExisted`: `skipHashes.length` - deterministic, known before import
  starts.

`onImportProgress` is untouched - it continues to reuse `ExportProgressEvent`
(`{ current, total, name, skipped }`) exactly as today, including its
`skipped` field for failures-so-far during the loop. That field is never
actually rendered during the running phase in `import-torrents.html` today
(only the done state shows a count), so there's no mid-import display to
reconcile with the done event's renamed fields - only the final summary
changes.

## Backend (`packages/electron/src/ipc/export.ts`)

`runImport`:

1. Filter `metadata.torrents` (excluding `failed: true` entries, as today)
   into `toProcess` (hash not in `skipHashes`) and the skipped set (hash in
   `skipHashes`).
2. The existing add-loop, confirmation-polling loop, and
   `applyTorrentSettings` loop all operate on `toProcess` only - unchanged
   otherwise. `ExportProgressEvent.total` is `toProcess.length`.
3. `import:done` sends `{ total: toProcess.length, failed, alreadyExisted: skipHashes.length }`.

No changes to `addTorrent` or `applyTorrentSettings` themselves - overridden
duplicates hit the exact same code path as any other entry.

## Frontend (`packages/app/src/app/modals/import-torrents/`)

### New state

- `duplicateEntries = computed(() => (metadata()?.torrents ?? []).filter(t => !t.failed && torrentStore.torrentsMap().has(t.hash.toLowerCase())))`
- `overriddenHashes = signal<Set<string>>(new Set())` - populated from the
  grid's row selection (`onSelectionChanged`), not part of the reactive
  form (this is grid interaction state, not a value being submitted as a
  single field).
- `hasDuplicates = computed(() => duplicateEntries().length > 0)`

`startImport()` computes
`skipHashes = duplicateEntries().map(t => t.hash).filter(h => !overriddenHashes().has(h))`
and includes it in the payload.

### New fieldset

Positioned immediately after the existing "Archive" fieldset, before
"Restore options". Visible only when `isReady() && hasDuplicates()` - same
lifecycle as the Restore Options/Start Mode fieldsets, hidden once the
import is running/done (the done summary already surfaces the count) and
hidden entirely when there are no duplicates.

Contents: a short description sentence explaining the behavior (duplicates
are skipped by default; check a row to override and reapply its archived
settings instead), then the grid.

### Grid

A compact `ag-grid-angular` instance, following the pattern already used in
`torrent-details/trackers/trackers.ts` and `peers.ts` (reusing
`GRID_SHARED_OPTIONS`, `GRID_DARK_THEME`/`GRID_LIGHT_THEME`,
`ThemeService.effectiveMode`), but without column-state persistence,
loading/no-rows overlays, or context menus - this is a small, ephemeral,
always-fully-populated list, not a primary data grid.

- Row selection via checkboxes (header checkbox for select-all/none),
  unchecked by default. Selection feeds `overriddenHashes`.
- Row data: `duplicateEntries()`.
- Fixed height ~300px, horizontal scroll enabled for the column set below.
- All columns visible by default (unlike the main torrent grid, which hides
  most columns behind a toggle) - the point of this grid is to show
  everything that would be touched by an override.

| Column                      | Source field                  | Formatter                           | Filter                                                         |
| --------------------------- | ----------------------------- | ----------------------------------- | -------------------------------------------------------------- |
| Name                        | `name`                        | -                                   | `TextColumnFilter`                                             |
| Save path                   | `save_path`                   | -                                   | `TextColumnFilter`                                             |
| Category                    | `category`                    | -                                   | `TextColumnFilter`                                             |
| Tags                        | `tags` (joined with `, `)     | -                                   | `TextColumnFilter`                                             |
| Down limit                  | `dl_limit`                    | `uiFormatService.fileSizePerSecond` | `SizeColumnFilter`                                             |
| Up limit                    | `up_limit`                    | `uiFormatService.fileSizePerSecond` | `SizeColumnFilter`                                             |
| Ratio limit                 | `ratio_limit`                 | `uiFormatService.ratioLimit`        | `RatioLimitColumnFilter`                                       |
| Seeding time limit          | `seeding_time_limit`          | `uiFormatService.timeLimit`         | `TimeLimitColumnFilter`                                        |
| Inactive seeding time limit | `inactive_seeding_time_limit` | `uiFormatService.timeLimit`         | `TimeLimitColumnFilter`                                        |
| Auto TMM                    | `auto_tmm`                    | `agCheckboxCellRenderer`            | `BooleanColumnFilter`                                          |
| Sequential download         | `sequential_download`         | `agCheckboxCellRenderer`            | `BooleanColumnFilter`                                          |
| Super seeding               | `super_seeding`               | `agCheckboxCellRenderer`            | `BooleanColumnFilter`                                          |
| First/last piece prio       | `first_last_piece_prio`       | `agCheckboxCellRenderer`            | `BooleanColumnFilter`                                          |
| State                       | `state`                       | translate `torrent.state.<value>`   | `SetColumnFilter` (pattern from `trackers.ts`'s status column) |

`files` (per-file renames/priorities) is intentionally omitted - it's
file-level detail that doesn't reduce to a useful scalar cell, and is still
restored on override per whatever Restore Options are checked.

### Done summary (`import-torrents.html`)

Replaces the single "Done - N skipped" line with conditional segments,
each rendered only when > 0: "Import complete" + optionally
"- N already existed" + optionally "- N failed".

### New i18n keys (`public/i18n/us.json`, with real Hungarian translations added to `hu.json` - both files are fully parallel today, not English-fallback)

Under `components.modals.import-torrents`:

- `label.duplicates` - fieldset legend (e.g. "Already on server")
- `duplicates.description` - explanatory sentence
- `duplicates.col-def.*` - one per grid column above
- `progress.already-existed` - replaces reuse of `progress.skipped` for this
  meaning
- `progress.failed` - replaces `progress.skipped` for the failure meaning

`progress.skipped` is removed once nothing references it.

## Testing

- `export.ts` unit tests: `runImport` skips entries in `skipHashes` with no
  qb API calls made for them; overridden duplicates (hash absent from
  `skipHashes`) go through the normal pipeline; `import:done` reports
  `alreadyExisted`/`failed` correctly.
- `import-torrents.spec.ts`: `duplicateEntries` computed correctly against a
  mocked `torrentsMap()`; fieldset hidden when no duplicates; `startImport`
  payload includes the right `skipHashes` after toggling row selection;
  grid renders formatted values for each column type.
- Manual verification: import an archive containing a mix of new and
  already-present torrents, confirm skipped ones are untouched on the
  server (settings/state unchanged) and overridden ones get the archived
  settings reapplied.
