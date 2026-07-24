# Add Torrent: Folder option - design

Issue: #235

## Summary

Add a third input mode to the Add Torrent modal, next to File and Link: **Folder**.
Selecting a folder scans it (optionally recursively) for `.torrent` files, parses each
one, and lists them in a grid so the user can review, rename, and bulk-add multiple
torrents in one go - skipping ones already added to the connected server.

## Current state (context for implementers)

- `packages/app/src/app/modals/add-torrent/` holds the modal: `add-torrent.ts`/`.html`
  (shell, tabs, submit), `general/` (File/Link radio group + torrent fieldset),
  `options/`, `limits/`, `files/` (file-priority tree, only relevant for a single
  parsed torrent with a file list).
- Input mode today is a Bootstrap `btn-check` radio group (`general.html:8-40`) bound to
  `inputMode: signal<'file' | 'link'>` (`add-torrent.ts:92`), not a tab.
- `AddTorrentFormGroup` (`add-torrent.model.ts:35-55`) has `fileGroup`/`linkGroup`
  sub-`FormGroup`s, each with a `rename` control - this is the actual "name" field:
  there is no separate literal `name` control.
- `AddTorrentSettings` (`add-torrent.model.ts:7-19`) is the persisted-across-opens
  settings bag (savepath, category, tags, paused, root_folder, skip_checking,
  sequentialDownload, firstLastPiecePrio, autoTMM, transferRateLimits, shareLimits),
  loaded in `ngOnInit` and saved after a successful add in `handleSubmit()`.
- The Files tab is disabled/tooltipped via `filesTabDisabledReason()` /
  `filesTabDisabled()` computeds (`add-torrent.ts:185-196`) and rendered with an
  `ngbTooltip` info icon next to the disabled tab (`add-torrent.html:14-42`).
- `window.bitbutler.electron.showOpenDialog()` already opens a native **directory**
  picker (`dialog.showOpenDialog({ properties: ['openDirectory'] })`,
  `packages/electron/src/ipc/electron.ts`) - used today for save-path and export-dir
  browsing. `window.bitbutler.electron.getDownloadsPath()` already exists.
- `.torrent` parsing uses `parse-torrent` in the main process only
  (`packages/electron/src/torrents/parse-torrent.ts`), invoked via the
  `torrent:parse` IPC handler (`packages/electron/src/ipc/torrent.ts`), returning a
  `TorrentDraft` with `torrent.name`, `torrent.totalSize`, `torrent.files: { path,
length, index }[]`, `torrent.infoHashV1`, etc., or `{ error: { message, code } }` on
  failure.
- `qb.torrentsAdd` (`packages/electron/src/ipc/qbittorrent.ts:59-104`) builds one
  multipart `FormData` per call: all `torrents` entries share the same `options`
  object, including a single `rename` field - **there is no way to give two torrents
  in the same call different renamed names**.
- Duplicate detection today is server-side: qBittorrent returns HTTP 409 for a
  torrent whose hash already exists, caught in `handleSubmit()`'s catch block. There
  is no dedicated `getByHash` helper - callers read `torrentStoreService
.torrentsMap().get(hash)` / `.has(hash)` directly.
- `GeneralSettings.behavior.deleteTorrentFile` (default `true`) is read in
  `handleSubmit()` after a successful file-mode add: if the draft has an
  `originalPath`, `window.bitbutler.torrent.deleteFile({ path })` is called.
- ag-grid custom filter components live in
  `packages/app/src/app/components/column-filters/` (`TextColumnFilter`,
  `NumberColumnFilter`, `SizeColumnFilter`, `BooleanColumnFilter`, `SetColumnFilter`,
  etc.), wired per-column via `filter: <Component>` in a `ColDef`. `SetColumnFilter`
  takes a `getItems(): ValueCount[]` param for multi-select-with-counts columns (used
  today for `state`, `category`, `tags` on the main grid).
- Switches use plain Bootstrap `form-check form-switch` + `formControlName` (not
  Material/PrimeNG); popovers use `bb-popover` (thin wrapper over ng-bootstrap's
  `NgbPopover`, `[subject]` + `[description]` template ref inputs). Both patterns are
  established in `options.html`.

## Architecture & data flow

### Input mode

`general.html`'s `File`/`Link` `btn-group` gains a third **Folder** option.
`inputMode` becomes `signal<'file' | 'link' | 'folder'>`.

### Form model

`AddTorrentFormGroup` gains:

```ts
folderGroup: FormGroup<{
  folder: FormControl<string>;
  recursive: FormControl<boolean>;
}>;
```

Per-row names and selection state are **not** modeled as Reactive Forms controls (a
`FormArray` mirroring a grid that gets rebuilt on every scan is awkward) - they live
as component-local signal state in a new child component (below).

`AddTorrentSettings` gains two persisted fields, following the exact same
load/save pattern as `savepath` etc.:

```ts
folder: string | null; // default null -> falls back to getDownloadsPath() on first use
recursive: boolean; // default false
```

`ngOnInit` loads them into `folderGroup` like every other setting; `handleSubmit()`'s
existing `addTorrentSettings.save({...})` call is extended to persist the current
`folder`/`recursive` values after a successful add - same lifecycle as `savepath`.

### New child component

`AddTorrentFolderPicker`
(`packages/app/src/app/modals/add-torrent/general/folder-picker/`), rendered inside
`general.html`'s input fieldset when `inputMode() === 'folder'`, mirroring how the
file/link blocks swap today. It owns:

- The browse input-group (text input + Browse + Refresh buttons)
- The Recursive switch + `bb-popover`
- The ag-grid of scanned torrents, its per-path parse cache, and inline-edited names
- An output/signal of the currently checked & valid rows, consumed by
  `AddTorrentGeneral` → `AddTorrent` for `canSubmit()` gating and for building the
  batch of add calls.

### New shared type

`ScannedTorrentEntry` (renderer-only concept, lives in `packages/app/src/app/models/`,
not part of the IPC contract):

```ts
interface ScannedTorrentEntry {
  path: string;
  relativePath: string;
  name: string; // editable, seeded from the parsed torrent name
  size: number;
  fileCount: number;
  folderCount: number;
  state: 'new' | 'exists' | 'error';
  errorMessage?: string;
  hash: string | null;
  selected: boolean;
}
```

### New IPC

`torrent.scanFolder(payload: { path: string; recursive: boolean }): Promise<{ path:
string; relativePath: string }[]>` - new handler in
`packages/electron/src/ipc/torrent.ts`. Recursively (or not, per `recursive`) walks
the given directory for `*.torrent` files using Node's `fs.readdir(path, {
recursive, withFileTypes: true })`, returns each match's absolute path and its path
relative to the scanned root. Does **not** parse - parsing stays on the existing
`torrent:parse` endpoint, called once per path from the renderer.

`showOpenDialog()` gains an optional `defaultPath?: string` argument
(backward-compatible) so the Browse button can open starting at the folder currently
in the input (or the Downloads path if empty), instead of always at the OS default.

### Parsing & caching

The picker component holds a `Map<path, ScannedTorrentEntry>`, scoped to the modal's
lifetime (a plain component field, discarded when the modal closes - no persisted
service). On scan (initial load, Refresh click, or Recursive toggle):

1. Call `torrent.scanFolder` for the current path/recursive value.
2. For each returned path already in the cache, reuse the cached entry as-is - **no
   re-parse**, and no re-check against `torrentsMap()` (state is only ever
   (re-)computed on the parse that first cached the entry).
3. For each new path, call `torrent.parse({ path })`, build a `ScannedTorrentEntry`
   (state: `'error'` if `.error` present; else `'exists'` if
   `torrentStoreService.torrentsMap().has(hash)`, else `'new'`), and store it in the
   cache.
4. Rebuild the grid's row data from the current scan's path list (in cache-hit or
   freshly-parsed form) - paths no longer present in the current scan (e.g.
   Recursive turned back off) simply drop out of the grid; their cache entries are
   left in the `Map` (harmless, avoids re-parsing if the user toggles back).

Cache key is the absolute path, chosen deliberately over hashing: a file's hash is
only known _after_ parsing it, so a hash-keyed cache cannot answer "should I skip
parsing this path" - it could only help merge duplicate content found at two paths,
which is out of scope here. Known limitation: if a file on disk changes between two
scans within the same modal session, the path-keyed cache will not detect it and will
keep serving the stale parsed entry until the modal is closed and reopened.

State (`new`/`exists`/`error`) is computed once, at parse time - it does not
live-update if `torrentsMap()` changes while the grid sits idle; only an explicit
Refresh/Recursive-toggle/initial scan recomputes it.

## UI/UX & grid

**Folder input row** (inside `formGroupName="folderGroup"`, replacing the file/link
input area when folder mode is active):

- Bootstrap `input-group`: text input bound to the `folder` control (readonly, shows
  the current path), **Browse** button (`showOpenDialog({ defaultPath:
folderControl.value || downloadsPath })`), **Refresh** button (re-runs the scan for
  the current path/recursive value without opening the dialog).
- Below it: a `form-check form-switch` **Recursive** toggle (same markup family as
  `options.html`'s switches) + `bb-popover` explaining that turning it on scans all
  subdirectories too.
- Below that: the ag-grid.

**Grid columns**, each wired to the project's existing custom filter components:

| Column            | Filter               | Notes                                                                                                                                               |
| ----------------- | -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| Checkbox (select) | -                    | `agCheckboxCellRenderer`; checked+enabled for `new` rows (default: pre-checked), unchecked+disabled for `exists`/`error` rows.                      |
| Name              | `TextColumnFilter`   | `editable: true` (default text cell editor); the edited value is sent as that row's `rename` on submit.                                             |
| State             | `SetColumnFilter`    | values New / Exists / Error, with counts (mirrors the main grid's `state` column pattern). Error rows carry a tooltip with the parse error message. |
| Size              | `SizeColumnFilter`   | the torrent's total content size (sum of file lengths from the parsed draft) - not the `.torrent` file's own on-disk byte size.                     |
| Files             | `NumberColumnFilter` | `files?.length ?? 1` from the parsed draft.                                                                                                         |
| Folders           | `NumberColumnFilter` | count of unique directories across the torrent's internal file paths (0 for single-file torrents with no subpath).                                  |
| Path              | `TextColumnFilter`   | the `.torrent` file's path relative to the scanned root folder.                                                                                     |

**Torrent fieldset** (in folder mode):

- The Rename input is hidden entirely - the grid's Name column is the only place a
  name is edited.
- The read-only Size and Free-space fields are also hidden (they represent a single
  torrent's stats and don't generalize to a batch).
- Savepath/category/tags stay visible and apply to the whole batch.

**Files tab**: `filesTabDisabledReason()` gets a new branch - disabled whenever
`inputMode() === 'folder'`, with a tooltip explaining it can't be changed when
adding multiple torrents at once.

## Submission, error handling & settings integration

**`canSubmit()`**: in folder mode, valid when `folderGroup` is valid (a folder path is
set) **and** at least one grid row is checked and not disabled.

**Submit flow** (`handleSubmit()`, new folder branch):

1. Build `sharedOptions` exactly as today (savepath, category, tags, paused,
   skip_checking, sequentialDownload, firstLastPiecePrio, autoTMM, root_folder,
   transfer/share limits) - **without** a top-level `rename`, since that's per-row.
2. For each checked, non-disabled grid row, **sequentially** (to avoid flooding
   qBittorrent with a burst of concurrent multipart uploads): call
   `window.bitbutler.qb.torrentsAdd({ id: serverId, torrents: [{ path: row.path,
name: row.name }], options: { ...sharedOptions, rename: row.name } })` in a
   try/catch, recording success or failure per row.
3. After a successful add for a row, if `generalSettings.behavior.deleteTorrentFile`
   is true, call `window.bitbutler.torrent.deleteFile({ path: row.path })` for that
   row (same as file-mode today).
4. After all rows are processed, show **one** summary toast - title "Torrents Added"
   (or an equivalent failure title if any row failed), message along the lines of "8
   of 10 added", per this project's toast conventions. Rows that failed stay checked
   and visible in the grid and the modal stays open, so the user can fix/retry;
   a fully successful batch closes the modal like the existing link-mode success
   path.
5. Extend the existing `addTorrentSettings.save({...})` call with `folder:
raw.folderGroup.folder, recursive: raw.folderGroup.recursive`.

**Error/edge cases:**

- A 409 (already exists) on an individual row during submit is counted as a failure
  for the summary toast - no per-row `TorrentExists` modal popup (that flow is
  single-torrent-oriented and would be disruptive mid-batch). This can still happen
  even though the checkbox was disabled for already-known hashes, if the torrent was
  added elsewhere between the last scan and submit.
- A folder path that doesn't exist or isn't readable: `torrent.scanFolder` rejects;
  the picker component shows an inline error under the input (not a toast, since it's
  tied directly to the input like other form field errors in this modal).
- An empty folder (no `.torrent` files found, recursive or not): the grid shows an
  empty-state message rather than a blank grid with no explanation.

## Out of scope

- Live re-evaluation of a row's `new`/`exists` state while the grid is idle (only
  recomputed on scan/refresh/recursive-toggle).
- Deduplicating multiple paths in the same scan that happen to share the same info
  hash (each is parsed and listed independently; adding both would surface the
  second as a 409 failure).
- Any change to the existing File/Link modes' behavior, the main torrent grid, or the
  command bus (this flow continues to call `qb.torrentsAdd` directly, matching how
  File/Link already work today).
