# File-based logging (replaces DB logs and the logs view)

Issue/branch: #329 (`329-add-logs-view`), rescoped from "Add logs view" to "File-based logging".

## Goal

Store application logs in rotating files instead of the SQLite database, and drop the in-app logs
view. Users reach the logs through an "Open Logs Folder" action.

## Background

- `main` already logs to the DB: `packages/electron/src/logger.ts` wraps `console.*`, resolves the
  caller via stack + source maps and inserts rows into the `logs` table (`db.ts`, with a retention
  trigger). `packages/app/src/app/renderer-logger.ts` does the same in the renderer and forwards
  entries over `log:write`.
- This branch added a logs page/grid, an export-logs modal, list/clear/export IPC and a dev-only
  Debug > Logs menu item on top of that.
- Why change: logs in the DB are unavailable exactly when they matter most (DB init failure,
  native module load failure, corruption), they cannot be attached to bug reports directly, and
  they add write load and pruning concerns to the same file that holds servers and settings.

## Decisions

- Transport/rotation: `electron-log` (v5), size-based rotation. No hourly rotation.
- Separate files: `main.log` and `renderer.log`, routed with `transports.file.resolvePathFn`
  using `message.variables.processType` (`'renderer'` -> `renderer.log`, otherwise `main.log`).
- Rotation: `maxSize` 5 MB per file, keeping 5 files per process (1 active + 4 rolled), i.e. at
  most about 25 MB per process. `electron-log` only keeps a single `.old.log` by default, so a
  small `archiveLogFn` shifts the rolled files: `main.log` -> `main.1.log` -> ... -> `main.4.log`
  (oldest deleted), same for `renderer`.
- Keep the existing extended logging: console wrappers, caller `file:line` from the stack frame
  resolved through `source-map-resolver.ts`, `uncaughtException` / `unhandledRejection` handlers.
  `electron-log` has no caller-location support, so it is used only as the file transport.
- No log viewer. "Open Logs Folder" is the only UI.
- Keep all non-logs-specific UI work already on the branch (datepicker-range-filter bounds and
  dropdown fixes, `_toolbar-button.scss`, `grid.lib` changes, button-bar scss).

## Design

### 1. Main-process logger (`packages/electron/src/logger.ts`, rewritten)

- Configure `electron-log/main`:
  - `transports.file.resolvePathFn`: `renderer.log` when `message?.variables?.processType ===
'renderer'`, else `main.log`, both in the default log directory.
  - `transports.file.maxSize = 5 * 1024 * 1024` and `transports.file.archiveLogFn` that shifts
    rolled files (`<name>.1.log` ... `<name>.4.log`), dropping the oldest.
  - File line format: `YYYY-MM-DD HH:mm:ss.SSS LEVEL [file:line] message`. The `file:line`
    segment is omitted when no location is available.
  - Console transport disabled (the original `console.*` is still called by our wrapper).
- `initLogger()` keeps wrapping `console.log/debug/info/warn/error`:
  - Call the original console method.
  - Compute the caller location (`callerLocation`) and resolve it with
    `resolveOriginalLocation(..., 'electron')`.
  - Format arguments with `util.format` (so objects are inspected, not `[object Object]`) and
    write through a single internal `writeLog(processName, level, message, filename, line)`.
  - Level mapping: `log`/`debug` -> `debug`, `info` -> `info`, `warn` -> `warn`, `error` -> `error`.
- `uncaughtException` / `unhandledRejection` handlers stay, writing at `error` level with the stack.
- `writeLog` is the one function both main console wrappers and the renderer IPC handler use. It
  must never throw (failures go to `process.stderr`, as today).
- Exports `getLogDirectory(): string` (dirname of the active main log file) for the
  open-folder action.
- Import order: `main.ts` imports `./logger.js` before any module that imports `./db.js`, so DB
  initialization errors are captured. `initLogger()` is called at the top of startup, before
  `registerLogIpcHandlers()`.

### 2. Renderer -> main

- `log:write` stays as `ipcMain.on('log:write')`. Validation (level whitelist, message length
  cap, int checks for line/column) stays. The handler resolves the location with
  `resolveOriginalLocation(..., 'app')` and calls `writeLog('renderer', ...)`.
- `RendererLogEntry` loses `context`. Shape becomes
  `{ level, message, filename, line, column }`.
- `renderer-logger.ts` builds a single `message` string: strings/numbers/booleans as is,
  `null`/`undefined` as text, Errors as `name: message` plus stack, other objects as
  circular-safe JSON. The 2000 char cap on the IPC side is raised to 20000 since the context no
  longer travels separately.

### 3. Open logs folder

- New `ipcMain.handle('log:open-folder')` calling `shell.openPath(getLogDirectory())`; resolves
  `{ ok: boolean; error?: string }` (`shell.openPath` returns an error string, empty on success).
- `BitButlerAPI.log.openFolder(): Promise<{ ok: boolean; error?: string }>`; preload exposes it.
- Help menu: "Open Logs Folder" (`electron.menu.open-logs-folder`), handled directly in the main
  process (`shell.openPath`), so it also works while logged out. Placed after "Check for Updates",
  before the separator preceding "About".
- General settings modal: a button "Open Logs Folder" (new i18n keys in `us.json` / `hu.json`)
  that calls `window.bitbutler.log.openFolder()`. On `ok: false` it shows an error toast
  (title "Failed to Open Logs Folder", message = the error string). No toast on success.

### 4. Removals and migration

Remove everything logs-view specific:

- App: `pages/logs/**`, `modals/export-logs/**`, `services/log.service*`,
  `services/log-grid.settings.service*`, `models/log-grid.model.ts`, the `logs` route in
  `app.routes.ts`, the logs-related `test-setup.ts` stubs, `TORRENT_*`/command entries added for
  logs, unused i18n keys (`us.json`, `hu.json`).
- Electron: `log:list`, `log:clear`, `log:export` handlers and their tests, the dev-only
  Debug > Logs menu item and its menu test, the `list`/`clear`/`export` preload entries.
- Shared: `LogEntry`, `LogProcess` and the `list`/`clear`/`export` members of
  `BitButlerAPI.log`.
- DB: `db.ts` no longer creates the `logs` table, index or trigger. On startup it runs
  `DROP TRIGGER IF EXISTS trg_logs_retention`, `DROP INDEX IF EXISTS idx_logs_timestamp`,
  `DROP TABLE IF EXISTS logs`, and a one-off `VACUUM` when the table existed (to reclaim the up
  to 100k rows). The `ALTER TABLE logs` column migrations are removed.
- Kept as is: `source-map-resolver.ts`, the `TORRENT_DELETED` unhandled-command fix, and all
  non-logs UI work on the branch.

### 5. Documentation

Not part of this spec's implementation. Per CLAUDE.md, the user guide update (Help menu entry,
General settings button, log file locations) is planned only once the feature is stable, around
PR creation.

## Testing

- `logger.spec.ts`: path routing by process type, line format with and without location,
  `util.format` object rendering, level mapping, `writeLog` never throws.
- `logger.integration.spec.ts`: rewritten to write real files in a temp dir and assert rotation
  at `maxSize`.
- `ipc/log.spec.ts`: `log:write` validation and renderer routing, `log:open-folder` success and
  `shell.openPath` error case. List/clear/export tests removed.
- `db.spec.ts`: legacy `logs` table/trigger are dropped on startup; fresh DB has no `logs` table.
- `renderer-logger.spec.ts`: message building for primitives, Errors, objects, circular objects.
- `menu.spec.ts`: Help menu contains the open-logs-folder item, Debug > Logs item is gone.
- `general.spec.ts`: button calls `log.openFolder()`, error toast on failure.
- Manual: run the app, log from main and renderer, confirm the two files, the line format and
  `file:line` for a TS source, and rotation by temporarily lowering `maxSize`.

## Out of scope

- Hourly/daily rotation or a configurable archive count.
- Log level setting, log export/zip, in-app viewing.
- Changes to what is logged.
