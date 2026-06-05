# BBE Export/Import Design Spec

**Date:** 2026-06-05
**Status:** Approved

## Overview

Implement a cross-platform torrent export/import pipeline in BitButler using a `.bbe` (BitButler Export) file format. The feature allows users to back up torrents from a qBittorrent-nox instance - preserving torrent files, metadata, and file-level modifications - and restore them to any connected server.

---

## Constraints

- Electron main process only - no renderer-side file I/O or Node APIs
- Pure-JS compression only - no `node-gyp` / native C++ modules
- ZIP library: `archiver` (streaming, pure JS)
- All qBittorrent API calls proxied through `ipc/qbittorrent.ts` via axios (existing pattern)
- Export and Import are only available when logged in to an active server

---

## File Format: `.bbe`

A `.bbe` file is a standard ZIP archive. Any tool (`unzip`, 7-Zip, etc.) can open it.

### Archive layout

```
export.bbe
├── metadata.json
└── torrents/
    ├── {hash}.torrent     ← raw binary (full export mode only)
    └── ...
```

`torrents/` is omitted in legacy mode - only `metadata.json` is present.

### `metadata.json` structure

```json
{
  "version": 1,
  "exported_at": "2026-06-05T14:32:00Z",
  "source_server": "threadripper",
  "export_mode": "full",
  "torrents": [
    {
      "hash": "abc123...",
      "name": "Ubuntu 22.04",
      "failed": false,

      "save_path": "/downloads/linux",
      "category": "linux",
      "tags": ["iso", "linux"],
      "up_limit": -1,
      "dl_limit": -1,

      "auto_tmm": false,
      "ratio_limit": -1,
      "seeding_time_limit": -1,
      "inactive_seeding_time_limit": -1,
      "super_seeding": false,
      "sequential_download": false,
      "first_last_piece_prio": false,
      "state": "seeding",

      "files": [{ "index": 0, "name": "ubuntu-22.04-desktop-amd64.iso", "priority": 1 }]
    },
    {
      "hash": "def456...",
      "name": "Some Torrent",
      "failed": true,
      "error": "HTTP 404 fetching .torrent binary"
    }
  ]
}
```

**Legacy mode entry** (Web API < 2.8.3): same structure but with `magnet_link` field instead of a `.torrent` file, and `export_mode: "legacy"` at the top level.

---

## Architecture

### New files

| File                                                      | Purpose                          |
| --------------------------------------------------------- | -------------------------------- |
| `packages/electron/src/ipc/export.ts`                     | All export/import Electron logic |
| `packages/app/src/app/components/modals/export-torrents/` | Export modal component           |
| `packages/app/src/app/components/modals/import-torrents/` | Import modal component           |
| `packages/app/src/app/services/export.service.ts`         | Export/import state as signals   |

### Modified files

| File                                                          | Change                                                     |
| ------------------------------------------------------------- | ---------------------------------------------------------- |
| `packages/shared/src/ipc.types.ts`                            | Add `export` namespace to `BitButlerAPI`, new shared types |
| `packages/electron/src/preload.ts`                            | Wire `export` namespace, add `window.onOpenBbe`            |
| `packages/electron/src/main.ts`                               | Register export IPC handlers                               |
| `packages/electron/src/main-window.ts`                        | Handle `.bbe` paths from OS file association               |
| `packages/electron/src/menu.ts`                               | Add Export/Import items to `loggedInItems` in File menu    |
| `packages/app/src/app/models/command.model.ts`                | Add `UI_EXPORT_TORRENTS`, `UI_IMPORT_TORRENTS`             |
| `packages/app/src/app/services/ui-command-handler.service.ts` | Handle new UI commands                                     |
| `package.json`                                                | Add `archiver` dependency, add `bbe` to `fileAssociations` |

### Data flow

```
Menu "Export Torrents"
  → menu:clicked { action: 'file.export' }
  → UiCommandHandlerService emits UI_EXPORT_TORRENTS
  → ExportTorrents modal opens

User clicks Export
  → window.bitbutler.export.start(payload)   [ipcRenderer.send - fire and forget]
  → ipcMain.on('export:start') runs pipeline
  → event.sender.send('export:progress', { current, total, name, skipped }) per torrent
  → event.sender.send('export:done' | 'export:error')
  → ExportService signal updates → modal reacts

Menu "Import Torrents" (or double-click .bbe in OS)
  → OS file picker opens (*.bbe filter)
  → user selects file → import modal opens in loading/spinner state
  → window.bitbutler.export.readBbe({ path }) [ipcRenderer.invoke]
  → main process unzips + parses metadata.json → returns BbeMetadata
  → modal populates with archive info + restore options

User clicks Import
  → window.bitbutler.export.importStart(payload)  [ipcRenderer.send]
  → ipcMain.on('import:start') runs pipeline
  → event.sender.send('import:progress', ...) per torrent
  → event.sender.send('import:done' | 'import:error')
```

---

## IPC Contract

### New types (`packages/shared/src/ipc.types.ts`)

```typescript
export type ExportScope = 'all' | 'filtered' | 'selected';
export type ExportMode = 'full' | 'legacy';

export interface ExportStartPayload {
  serverId: string;
  scope: ExportScope;
  hashes: string[]; // pre-resolved by renderer from current grid state
  destDir: string;
  filename: string; // without .bbe extension
}

export interface ExportProgressEvent {
  current: number;
  total: number;
  name: string;
  skipped: number;
}

export interface ExportDoneEvent {
  path: string; // absolute path to written .bbe file
  total: number;
  skipped: number;
}

export interface BbeMetadata {
  version: number;
  exported_at: string;
  source_server: string;
  export_mode: ExportMode;
  torrents: BbeTorrentEntry[];
}

export interface BbeTorrentEntry {
  hash: string;
  name: string;
  failed: boolean;
  error?: string;
  save_path?: string;
  category?: string;
  tags?: string[];
  up_limit?: number;
  dl_limit?: number;
  auto_tmm?: boolean;
  ratio_limit?: number;
  seeding_time_limit?: number;
  inactive_seeding_time_limit?: number;
  super_seeding?: boolean;
  sequential_download?: boolean;
  first_last_piece_prio?: boolean;
  magnet_link?: string; // legacy mode only
  state?: string; // raw state string from torrents/info at export time (e.g. 'downloading', 'pausedDL', 'stoppedUP')
  files?: BbeTorrentFile[];
}

export interface BbeTorrentFile {
  index: number;
  name: string;
  priority: number;
}

export type ImportRestoreField =
  | 'save_path'
  | 'category_tags'
  | 'speed_limits'
  | 'share_limits'
  | 'renames'
  | 'priorities'
  | 'auto_tmm'
  | 'sequential_download'
  | 'super_seeding'
  | 'first_last_piece_prio';

export interface ImportStartPayload {
  serverId: string;
  bbePath: string;
  restoreFields: ImportRestoreField[];
  startMode: 'paused' | 'active' | 'all';
  // paused: leave all torrents paused after import
  // active: resume only torrents whose state was active at export time
  // all:    resume all imported torrents regardless of export-time state
}
```

### New `export` namespace in `BitButlerAPI`

```typescript
export: {
  start(payload: ExportStartPayload): void;
  cancel(): void;
  readBbe(payload: { path: string }): Promise<BbeMetadata>;
  importStart(payload: ImportStartPayload): void;
  importCancel(): void;
  openBbePicker(): Promise<string | undefined>;
  onProgress(cb: (e: ExportProgressEvent) => void): () => void;
  onDone(cb: (e: ExportDoneEvent) => void): () => void;
  onError(cb: (e: { message: string }) => void): () => void;
  onImportProgress(cb: (e: ExportProgressEvent) => void): () => void;
  onImportDone(cb: (e: { total: number; skipped: number }) => void): () => void;
  onImportError(cb: (e: { message: string }) => void): () => void;
}
```

### Addition to `window` namespace in `BitButlerAPI`

```typescript
onOpenBbe(callback: (path: string) => void): () => void;
```

Fires when the OS opens a `.bbe` file via file association. The Angular app subscribes and opens the import modal with the received path. If the user is not logged in when a `.bbe` file is opened, the path is queued and the import modal opens automatically after successful login - same pattern as `.torrent` file handling.

---

## Section 3: Export Pipeline

### Menu placement

Export and Import are added to `loggedInItems` in `menu.ts`, appearing only when logged in:

```
File
├── Add Torrent ▶
├── ─────────────
├── Export Torrents
├── Import Torrents
├── ─────────────
├── Disconnect
└── Quit
```

### Export modal

1. **Opens** - reads `export.lastPath` from settings to pre-populate the directory field. Generates default filename as `{serverName}-{YYYYMMDD}`.

2. **Three sections:**
   - **Version banner** - green "Full export mode" or yellow "Legacy mode - only magnet links will be saved (qBittorrent < 4.5.0)"
   - **Scope** - three toggle buttons: All (N) / Filtered (N) / Selected (N). Filtered and Selected disabled if their count is 0.
   - **Save location** - directory field (read-only) + Browse button opens OS directory picker; filename input group with fixed `.bbe` suffix using Bootstrap input group.

3. **On Export click** - button disables, progress area slides in below a divider:
   - "Exporting torrents..." label + `47 / 243` counter
   - Progress bar (fills as each torrent completes)
   - "Fetching: _{torrent name}_" current item label
   - Cancel button

4. **On `export:done`** - progress bar fills to 100%, label becomes "Export complete" (or "Export complete - N skipped"). "Show in folder" link appears. Export button label becomes "Close".

5. **On `export:error`** - banner switches to red with the error message. Close button appears.

### Electron export pipeline (`ipc/export.ts`)

```
ipcMain.on('export:start', async (event, payload) => {
  1. GET /api/v2/app/webapiVersion → determine full vs legacy mode
  2. Fetch torrent list for chosen scope (hashes array from payload)
  3. Create archiver zip instance streaming to a temp file
  4. For each hash (sequentially):
     a. [full] GET /api/v2/torrents/export?hash={hash} → append as torrents/{hash}.torrent
     b. GET /api/v2/torrents/info?hashes={hash} → extract all metadata fields
     c. GET /api/v2/torrents/files?hash={hash} → extract file names + priorities
     d. Push export:progress event
     e. On any error: mark torrent failed, increment skipped, continue
  5. Append metadata.json to zip
  6. Finalize zip → copy temp file to destDir/{filename}.bbe
  7. Persist destDir to settings as export.lastPath
  8. Push export:done or export:error
})
```

**Capability detection:**

- Web API >= 2.8.3 (qBittorrent >= 4.5.0): full export mode
- Web API < 2.8.3: legacy mode - skip `.torrent` fetch, save magnet link from `torrents/info` instead

---

## Section 4: Import Pipeline

### Import entry point

"Import Torrents" menu item → `openBbePicker()` IPC call → Electron shows OS file picker filtered to `*.bbe` → returns selected path to renderer → import modal opens immediately in loading/spinner state → modal calls `readBbe({ path })` → main process unzips and parses `metadata.json` → modal populates with archive contents.

The spinner covers the unzip + parse step, which can take meaningful time for archives with thousands of torrent entries.

### Import modal

1. **Loading state** - spinner shown while `readBbe` is in flight.

2. **Populated state** - shows:
   - **Archive info banner**: source server, export date, torrent count, export mode
   - **Importing to**: active server name
   - **Restore options** (all checked by default):
     - Save path / Category & tags
     - Speed limits / Share limits
     - File renames / File priorities & exclusions
     - Auto-TMM / Sequential download
     - Super seeding / First/last piece priority
   - **After import** button group (default: "Start active ones"), styled identically
     to the export scope selector. An inline hint below the group updates dynamically
     via a computed signal as the user switches between options:
     - **Keep paused:** "All torrents will remain paused - start them manually when ready."
     - **Start active ones:** "Torrents that were active when exported will resume automatically."
     - **Start all:** "All imported torrents will start immediately regardless of their previous state."
   - **Import** + **Cancel** buttons

3. **Progress state** - same inline pattern as export: progress bar + current torrent name + counter. Cancel button available.

4. **Done state** - "Imported N/N" summary (with skipped count if any). Close button.

### Electron import pipeline (`ipc/export.ts`)

```
ipcMain.on('import:start', async (event, payload) => {
  // payload: { serverId, bbePath, restoreFields }
  Unzip .bbe, read metadata.json
  For each torrent entry (sequentially):
    Step 1: POST /api/v2/torrents/add
            - .torrent binary (full) or magnet_link (legacy)
            - save_path, category, tags (if in restoreFields)
            - is_paused=true AND is_stopped=true (both required: older qBittorrent
              uses 'paused', qBittorrent 5+ uses 'stopped')
    Step 2: Poll GET /api/v2/torrents/files?hash={hash} until the torrent appears
            (retry up to ~10x with 500ms delay - the torrent may not be immediately
            queryable after add returns)
            - establishes base file tree with original default names
    Step 3: [if 'renames' in restoreFields]
            - diff base tree against saved file names
            - POST /api/v2/torrents/renameFile for each mismatch
    Step 4: [if 'priorities' in restoreFields]
            - group files by priority value
            - POST /api/v2/torrents/filePrio per group (pipe-separated indices)
    Step 5: Apply remaining metadata fields as applicable:
            - setAutoManagement, setShareLimits, setSuperSeeding, etc.
    Step 6: Resume decision based on startMode:
            - 'paused': skip - leave torrent paused
            - 'active': POST resume only if state is NOT pausedDL / pausedUP / stoppedDL / stoppedUP
                        (covers both old and qBittorrent 5+ naming)
            - 'all':    POST resume unconditionally
            Torrents with no state field (failed entries) are never resumed.
    Push import:progress
  Push import:done or import:error
})
```

**Cancel behaviour:** a `cancelled` flag is set when `import:cancel` is received. The pipeline checks it between torrents (after pushing `import:progress`) and exits cleanly - never leaves a torrent mid-patch. Same pattern applies to export cancellation.

---

## Section 5: `.bbe` File Association

### `package.json` change

Add alongside the existing `torrent` entry in `fileAssociations`:

```json
{
  "ext": "bbe",
  "name": "BitButler Export File",
  "description": "BitButler export archive",
  "mimeType": "application/x-bitbutler-export",
  "role": "Viewer",
  "icon": "packages/app/src/assets/icons/bitbutler.ico"
}
```

### Electron main (`main-window.ts`)

Handle `open-file` (macOS) and `second-instance` (Windows/Linux) events for `.bbe` paths - same pattern as the existing `openFilesQueue` for `.torrent` files. Push path to renderer via `mainWindow.webContents.send('bb:open-bbe', path)`.

### Logged-out behaviour

If a `.bbe` file is opened via file association while the user is not logged in: queue the path, proceed to login page. After successful login, drain the queue and open the import modal with the queued path - same drain-on-login pattern used for `.torrent` files.

---

## Section 6: Error Handling

### Export

| Scenario                   | Behavior                                                              |
| -------------------------- | --------------------------------------------------------------------- |
| Single torrent fetch fails | Mark `failed: true`, increment skipped, continue                      |
| All torrents fail          | Valid `.bbe` produced with all entries as failed, `export:done` fires |
| Destination not writable   | Fatal - `export:error` fires, red banner in modal                     |
| User cancels               | Stop iterating, delete temp file, modal resets to form state          |
| Legacy mode                | Yellow warning banner, magnet links saved instead of `.torrent` files |
| Version check fails        | Treat as legacy mode, show warning                                    |

### Import

| Scenario                             | Behavior                                                           |
| ------------------------------------ | ------------------------------------------------------------------ |
| Invalid or corrupt `.bbe`            | `readBbe` rejects, error banner shown before user can click Import |
| `metadata.json` missing or malformed | Same as above                                                      |
| Torrent already exists on server     | qBittorrent returns `"Fails."` - mark skipped, continue            |
| File rename fails                    | Log failure, continue with remaining steps for that torrent        |
| Resume fails (Step 6)                | Log only - torrent imported correctly, stays paused                |
| User cancels                         | Stop after current torrent's step sequence completes               |
| `.bbe` opened while logged out       | Queue path, open login; drain queue after successful login         |
