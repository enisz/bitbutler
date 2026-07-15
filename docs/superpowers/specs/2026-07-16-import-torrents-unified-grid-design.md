# Import Torrents - Unified Preview Grid - Design

Issue: [#229](https://github.com/enisz/bitbutler/issues/229)
Branch: `229-import-duplicate-handling`

Supersedes the "New fieldset" / "Grid" / "Done summary" / i18n sections of
`2026-07-14-import-duplicate-handling-design.md`. That design's backend
work (`skipHashes`, `partitionImportEntries`, the `failed`/`alreadyExisted`
split on `import:done`) is implemented and unchanged by this spec - only how
duplicates are surfaced and selected in the UI changes.

## Problem

The duplicates grid added per the previous spec only appears when
`hasDuplicates()` is true, and only lists duplicates - the user has no way
to preview the rest of what an archive contains (metadata, file limits,
etc.) before committing to an import. There's also no feedback once the
import starts: the grid disappears from relevance and the user just watches
a name + progress bar scroll by, with no per-torrent success/failure
visibility until the final summary line.

Separately, two small pre-existing rough edges in this modal are being
fixed alongside this work since they sit in the same templates being
touched:

- Grid column headers in this modal are sentence case ("Save path",
  "Download limit"), inconsistent with the Title Case convention used
  everywhere else in the app (`pages.main.grid.col-def.*`,
  `torrent-details` sub-grids).
- The "Category Path Mapping" fieldset label doesn't match the sibling
  "Save Path Remapping" fieldset's wording.

## Goals

- Modal grows to `size: 'xl'` (`scrollable: true`) to fit a wider, more
  information-dense grid, matching the pattern already used by
  `Settings`/`QbSettings`/`TorrentDetails`.
- One grid, always shown once metadata is loaded (`isReady() || isRunning()
|| isDone()`), listing every torrent in the archive - not just
  duplicates.
- The grid _is_ the selection mechanism: a checked row will be imported, an
  unchecked row will be skipped. This replaces the old override-only
  selection model.
  - Default: every row checked, **except** rows that are already
    duplicates (unchecked by default) and export-time failures
    (non-selectable - there's no usable data to import).
  - The user can uncheck any row to skip it, or check a duplicate to
    import/overwrite it anyway - a strict superset of the previous
    "override a duplicate" behavior.
- The grid reflects live import progress: a row flips to Imported or
  Failed as the backend finishes processing that torrent.
- Once a row is marked Imported, it's uninteresting - the grid's Import
  State column defaults to filtering "Imported" out, so once a run
  finishes the grid naturally settles to showing only remaining
  duplicates/failures for review, with no manual filtering required.
- Same column set regardless of export mode (`full` vs `legacy`) - see
  Non-goals.
- Column headers in this grid use Title Case, matching the rest of the app.
- "Category Path Mapping" fieldset label copy becomes "Category Path
  Remapping".

## Non-goals

- No column variation between `full` and `legacy` export modes. Both modes
  populate the same restorable fields; `magnet_link` (only present in
  `legacy`) isn't shown - it's exported metadata, not something the user
  can act on from this grid.
- No change to `applyTorrentSettings`/`addTorrent` or which torrents get
  processed - only how progress is surfaced back to the UI per-row.
- No change to the running/done footer button behavior (Cancel -> Close) -
  already correct today (`import-torrents.html:404-419`).
- No column-state persistence, loading/no-rows overlays, or context menus
  for this grid - still a small, ephemeral, always-fully-populated list,
  per the previous spec's reasoning.
- `applyTorrentSettings` failures (post-add settings calls) remain silently
  swallowed (`.catch(() => {})`) and don't affect a row's live state - this
  mirrors the existing `failed` aggregate counter, which today only counts
  `addTorrent` failures. Not something this spec changes.

## Approach

### Row import state

Each row gets a derived, client-only status, computed fresh from three
inputs (archive entry, current duplicate-hash set, live per-hash import
results) - never stored on the entry itself:

| State       | Condition                                                   | Selectable | Row style                                                                                    |
| ----------- | ----------------------------------------------------------- | ---------- | -------------------------------------------------------------------------------------------- |
| `failed`    | `entry.failed === true` (export-time failure)               | No         | red (`text-danger bg-danger-subtle`), matching the main grid's `state === 'error'` treatment |
| `duplicate` | hash present in `torrentStore.torrentsMap()`                | Yes        | normal                                                                                       |
| `imported`  | `results.get(hash) === 'imported'` (set during/after a run) | Yes        | normal                                                                                       |
| `failed`    | `results.get(hash) === 'failed'` (import-time failure)      | Yes        | red                                                                                          |
| `pending`   | none of the above                                           | Yes        | normal                                                                                       |

`failed` covers both the static export-time case and the dynamic
import-time case - they render identically (red row), but only the
export-time one is forced non-selectable, since import-time failures were
necessarily selected already (that's why they were attempted).

### Backend/IPC: per-torrent progress

Today's `import:progress` event carries `{ current, total, name, skipped }`
(reusing `ExportProgressEvent`) - no indication of _which_ torrent just
finished or whether it succeeded, so the frontend can't update a specific
row. A new, distinct shared type replaces it for the import channel only
(export's `ExportProgressEvent` usage is untouched):

```ts
// packages/shared/src/ipc.types.ts
export interface ImportProgressEvent {
  current: number;
  total: number;
  name: string;
  hash: string;
  success: boolean;
}
```

```ts
// BitButlerAPI['export']
onImportProgress(cb: (e: ImportProgressEvent) => void): () => void;
```

`preload.ts`'s `onImportProgress` subscription updates its cast type to
match.

`runImport` in `packages/electron/src/ipc/export.ts` (the per-entry loop,
today around line 500-517) sends the per-item outcome instead of a
cumulative counter:

```ts
for (let i = 0; i < toProcess.length; i++) {
  if (importCancelled) break;
  const entry = toProcess[i];
  let success = true;
  try {
    await addTorrent(serverId, entry, metadata.export_mode, zip, restoreFields, pathMappings);
    addedHashes.push(entry.hash);
  } catch {
    failed++;
    success = false;
  }
  send('import:progress', {
    current: i + 1,
    total: toProcess.length,
    name: entry.name,
    hash: entry.hash,
    success,
  } satisfies ImportProgressEvent);
}
```

`import:done`'s payload (`{ total, failed, alreadyExisted }`) is unchanged.

### `ExportService` (`packages/app/src/app/services/export.service.ts`)

`ImportState` gains a `results` map, keyed by lowercased hash:

```ts
export interface ImportState {
  // ...existing fields unchanged
  results: Map<string, 'imported' | 'failed'>;
}
```

`IMPORT_IDLE.results = new Map()`. `setImportLoading()` and `resetImport()`
reset it to a fresh empty map (a new run's results shouldn't leak into the
next). `onImportProgress` merges one entry per event:

```ts
api.onImportProgress((e: ImportProgressEvent) =>
  this._import.update((s) => {
    const results = new Map(s.results);
    results.set(e.hash.toLowerCase(), e.success ? 'imported' : 'failed');
    return { ...s, phase: 'running', current: e.current, total: e.total, name: e.name, results };
  }),
),
```

### Frontend (`packages/app/src/app/modals/import-torrents/`)

Replaces `duplicateEntries` / `overriddenHashes` / `hasDuplicates` with:

- `duplicateHashes = computed(() => Set<string>)` - same criteria as
  before (archive hash present in `torrentStore.torrentsMap()`,
  case-insensitive), just exposed as a hash set instead of a filtered
  entry list.
- `importRows = computed(() => ImportGridRow[])` where
  `ImportGridRow = BbeTorrentEntry & { importState: 'pending' | 'duplicate' | 'imported' | 'failed' }`,
  built by mapping every `metadata()!.torrents` entry through the state
  table above, reading `exportService.importState().results` for the live
  per-hash outcome.
- `selectedHashes = signal<Set<string>>(new Set())`, updated from the
  grid's `onSelectionChanged`, seeded once (via `onFirstDataRendered`) to
  every row where `importState === 'pending'` - i.e. everything except
  duplicates and export-time failures. This mirrors how `getRowId` +
  reactive `[rowData]` rebinding already preserves ag-grid's own selection
  state across data updates today (used by the existing duplicates grid),
  so seeding once on first render is sufficient - later `importRows()`
  recomputations (e.g. a row flipping to `imported`) don't re-trigger
  `onFirstDataRendered` and won't reset the user's choices.

`startImport()`'s `skipHashes` becomes:
`importRows().filter(r => !r.failed && !selectedHashes().has(r.hash.toLowerCase())).map(r => r.hash.toLowerCase())`
(export-time failures are already excluded server-side by the existing
`metadata.torrents.filter(t => !t.failed)` in `runImport`, so they don't
need to appear in `skipHashes` at all).

### Grid & fieldset (`import-torrents.html`)

- Fieldset visibility changes from `isReady() && hasDuplicates()` to
  `isReady() || isRunning() || isDone()` - same lifecycle as the rest of
  the form, always present once an archive is loaded.
- Legend/description rewritten for the general case, e.g.:
  - Legend: "Torrents to Import" (was "Already on server").
  - Description: "This lists every torrent in the archive along with the
    metadata that will be restored. Uncheck a row to skip importing it -
    torrents that already exist on the target server are unchecked by
    default, but you can check them to import anyway and overwrite their
    settings."
- Grid height increases (e.g. ~400px) to make better use of the `xl`
  modal's width/height.
- Row selection checkboxes stay (header checkbox for select/deselect-all),
  but `isRowSelectable` returns `false` for `!!data.failed` (export-time
  failures only, per the state table above).
- `rowClassRules` adds `'text-danger bg-danger-subtle': (p) => p.data?.importState === 'failed'`.

Columns (all headers Title Case, matching `pages.main.grid.col-def.*`):

| Column                      | Source field                  | Formatter                             | Filter                                                      |
| --------------------------- | ----------------------------- | ------------------------------------- | ----------------------------------------------------------- |
| Name                        | `name`                        | -                                     | `TextColumnFilter`                                          |
| Save Path                   | `save_path`                   | -                                     | `TextColumnFilter`                                          |
| Category                    | `category`                    | -                                     | `TextColumnFilter`                                          |
| Tags                        | `tags` (joined with `, `)     | -                                     | `TextColumnFilter`                                          |
| Download Limit              | `dl_limit`                    | `uiFormatService.fileSizePerSecond`   | `SizeColumnFilter`                                          |
| Upload Limit                | `up_limit`                    | `uiFormatService.fileSizePerSecond`   | `SizeColumnFilter`                                          |
| Ratio Limit                 | `ratio_limit`                 | `uiFormatService.ratioLimit`          | `RatioLimitColumnFilter`                                    |
| Seeding Time Limit          | `seeding_time_limit`          | `uiFormatService.timeLimit`           | `TimeLimitColumnFilter`                                     |
| Inactive Seeding Time Limit | `inactive_seeding_time_limit` | `uiFormatService.timeLimit`           | `TimeLimitColumnFilter`                                     |
| Auto TMM                    | `auto_tmm`                    | `agCheckboxCellRenderer`              | `BooleanColumnFilter`                                       |
| Sequential Download         | `sequential_download`         | `agCheckboxCellRenderer`              | `BooleanColumnFilter`                                       |
| Super Seeding               | `super_seeding`               | `agCheckboxCellRenderer`              | `BooleanColumnFilter`                                       |
| First/Last Piece Priority   | `first_last_piece_prio`       | `agCheckboxCellRenderer`              | `BooleanColumnFilter`                                       |
| State                       | `state`                       | translate `torrent.state.<value>`     | `SetColumnFilter`                                           |
| Import State (new)          | `importState`                 | translate `grid.import-state.<value>` | `SetColumnFilter`, default filter model excludes "Imported" |

`files` remains intentionally omitted, same reasoning as the previous spec.

### i18n (`public/i18n/us.json` and `hu.json`, both fully parallel - real

Hungarian translations required, not English fallback)

Under `components.modals.import-torrents`:

- `label.duplicates` -> renamed to `label.grid`, value "Torrents to
  Import" (was "Already on server").
- `duplicates.description` -> `grid.description` (new copy above).
- `duplicates.col-def.*` -> `grid.col-def.*`, all values changed to Title
  Case, plus a new `grid.col-def.import_state: "Import State"`.
- New `grid.import-state.{pending,duplicate,imported,failed}` labels
  ("Pending", "Duplicate", "Imported", "Failed") for the cell formatter and
  set-filter items.
- `label.category-path-mapping` value changes from "Category path
  mapping" to "Category path remapping" (key name unchanged - it's
  referenced structurally elsewhere). No other `category-path-mapping.*`
  keys change.

## Testing

- `export.ts` unit tests: `import:progress` payload includes `hash` and
  `success` per processed entry (both success and thrown-add cases);
  `import:done` behavior unchanged (already covered).
- `export.service.spec.ts`: `onImportProgress` merges into `results`
  keyed by lowercased hash; `setImportLoading`/`resetImport` clear
  `results`.
- `import-torrents.spec.ts`:
  - `importRows` computes the right `importState` for a mix of
    export-failed, duplicate, and plain entries, and updates entries to
    `imported`/`failed` as `exportService.importState().results` changes.
  - Default selection seeds every non-duplicate, non-failed row on first
    render; duplicates and export-failures are excluded.
  - `startImport`'s `skipHashes` reflects unchecked rows, including a
    manually-unchecked non-duplicate row and a manually-checked duplicate
    row.
  - Grid renders Title Case headers and formats each column type
    correctly (carried over from the previous spec's column tests).
- Manual verification: import an archive with a mix of new, duplicate, and
  deliberately-broken (export-failed) entries; confirm rows update live
  during the run, the grid still shows after completion, and the default
  filter leaves only duplicates/failures visible without manual filter
  interaction.
