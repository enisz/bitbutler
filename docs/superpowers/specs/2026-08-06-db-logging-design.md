# Database-backed logging (backend)

## Context

BitButler currently logs via `electron-log`, writing formatted lines to a
rotating file (`packages/electron/src/logger.ts`). Console calls in the main
process are monkey-patched to also call `log.info(...)`, and renderer
`console-message` events are forwarded the same way. This spec moves the
storage destination from a file to the existing SQLite database (`db.ts`),
so a future UI (an ag-grid view, most likely) can list/sort/filter log
entries. That UI is out of scope here - this covers the backend only.

## Schema

Added to `packages/electron/src/db.ts`, following the existing pattern used
for `servers`/`settings`:

```sql
CREATE TABLE IF NOT EXISTS logs (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  timestamp INTEGER NOT NULL,
  process   TEXT NOT NULL CHECK (process IN ('main','renderer')),
  level     TEXT NOT NULL CHECK (level IN ('debug','info','warn','error')),
  message   TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_logs_timestamp ON logs(timestamp);

CREATE TRIGGER IF NOT EXISTS trg_logs_retention
AFTER INSERT ON logs
BEGIN
  DELETE FROM logs
  WHERE timestamp < (CAST(strftime('%s','now') AS INTEGER) - 30*24*60*60) * 1000;
END;
```

- `timestamp` is milliseconds since epoch (`Date.now()`), so `new
Date(timestamp)` works directly once the Angular side is built.
- The `AFTER INSERT` trigger prunes anything older than a hardcoded 30 days
  on every write, so the table is self-cleaning with no app-level scheduler.
  Retention is not configurable yet - when the UI step adds a
  settings-driven retention window, the trigger will need to be
  dropped/recreated to reflect the new value at that time.

## Logger rewrite (`packages/electron/src/logger.ts`)

Drop the `electron-log` dependency entirely - it only existed for file
transport and rotation, both of which the DB table and trigger now own.
Replace it with a small `insertLog(process, level, message)` helper backed
by a prepared statement on the `logs` table.

- `initLogger()` keeps monkey-patching `console.log/debug/info/warn/error`.
  Each patched method still calls the original console method first (so
  terminal output during `npm start` / packaged app stderr is unaffected),
  then calls `insertLog('main', levelStr, utilFormat(...args))` instead of
  writing a formatted line to a file transport.
- `hookRenderer(window)` keeps subscribing to `webContents.on('console-message', ...)`
  and inserts one row per event with `process: 'renderer'`, message built
  from `${details.message} (${details.sourceId}:${details.lineNumber})` as
  today.
- `process.on('uncaughtException', ...)` and `process.on('unhandledRejection', ...)`
  now insert with `level: 'error'` explicitly. (Previously both were logged
  via `log.info(...)` with `[error]` only appearing in the formatted text -
  the DB schema gives us a real level column, so this is now accurate.)
- Deleted: `formatTimestamp`, `archiveLog`, `MAX_SIZE`, `MAX_ARCHIVES`, and
  their corresponding tests in `logger.spec.ts`. New tests assert the
  correct rows (`timestamp`/`process`/`level`/`message`) are inserted for:
  console monkey-patching, renderer console messages, uncaught exceptions,
  and unhandled rejections.
- Remove `electron-log` from `packages/electron/package.json` dependencies.

## Menu cleanup

`packages/electron/src/menu.ts` has a dev-only (`isDev`) "Debug" submenu
item, "Open Log Path" (`CmdOrCtrl+Alt+L`), which opens `app.getPath('logs')`
in the OS file explorer. This becomes obsolete once logs live in the
database instead of a file, so it is removed along with its accelerator.

## Out of scope

- Any new IPC surface for querying/paginating/filtering logs from the
  renderer.
- Configurable retention (days/months) via settings - the retention window
  stays hardcoded at 30 days until the UI step revisits it.
- The UI itself (ag-grid log viewer, settings screen for retention).

## Testing

- `logger.spec.ts` rewritten to assert DB inserts instead of file
  writes/rotation (mock `../db.js`, assert prepared statement calls/rows).
- `db.spec.ts` (if present) or new coverage confirming `logs` table,
  index, and trigger are created, and that the trigger actually deletes
  rows older than 30 days given a seeded timestamp.
- `menu.spec.ts` updated to assert the "Open Log Path" item no longer
  exists in the dev Debug submenu.
