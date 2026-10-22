# Configuration export / import - design

## Intent

Let the user back up the whole BitButler configuration into one file and restore it later, mainly after an operating system reinstall. Today everything lives in the local SQLite database (`servers` and `settings` tables) and is lost with the machine.

## Goals

- Export the entire configuration (all app settings, all servers, all per-server settings) to a single `.bbc` file (BitButler Configuration), a JSON document.
- Import a `.bbc` file with selective control: app settings as one unit, and each server (with its settings) separately.
- Entry points: the Electron menu (Settings submenu), and the login screen.
- Credentials never leave the machine.

## Non-goals / anti-goals

- No usernames or passwords in the file. A leaked `.bbc` must not give access to any server.
- Not a sync or cloud feature, no merge logic, no per-field diffing.
- No partial or half-applied imports: a failed import must leave the current configuration untouched.
- Window size/position is not part of this: it is not persisted anywhere today (`main-window.ts` only forwards runtime state to the renderer).

## File format

JSON, extension `.bbc`.

```json
{
  "version": 1,
  "exported_at": 1792672684000,
  "settings": {
    "<settings row id>": {
      /* parsed json blob */
    }
  },
  "servers": {
    "<server uuid>": {
      "id": "...",
      "name": "...",
      "host": "...",
      "protocol": "http",
      "port": 8080,
      "auto_login": true,
      "created_at": "...",
      "settings": {
        "server": {
          /* ServerSettingsService.<uuid> blob */
        }
      }
    }
  }
}
```

- `settings`: every row of the `settings` table except the `ServerSettingsService.<uuid>` rows, keyed by the row id (e.g. `GeneralSettingsService`, `StatusBarSettingsService`, `TorrentListGridSettingsService`), value is the parsed JSON blob. Using the raw row ids (not hand-picked short names) means new settings services are exported automatically. (Builder's call to confirm: any other server-scoped row families in the settings table should go under that server's `settings` too.)
- `servers`: object keyed by server uuid. Each value contains the connection fields and `auto_login`, plus a `settings` object holding that server's settings blob(s), keyed by service name. The settings table has two server-scoped families, `ServerSettingsService.<uuid>` and `AddTorrentSettingsService.<uuid>`, so a server's `settings` looks like `{ "ServerSettingsService": {...}, "AddTorrentSettingsService": {...} }`. (This replaces the earlier `settings.server` idea; any settings row whose id is `<name>.<uuid-of-an-existing-server>` is treated this way, orphaned rows for deleted servers are not exported.)
- Keys in the top-level `settings` object must not contain a `.`; the importer rejects such a file so it cannot write server-scoped rows for servers the user did not select.
- **Excluded from servers:** `username`, `password`, `has_password`, `webapi_version`, `qb_version`, `export_available`. The last three are re-detected on first login.
- `version` is an integer schema version, starting at 1. `exported_at` is epoch milliseconds.

## Behavior

### Export

- Menu item `Settings > Export configuration` opens a small confirmation modal: it lists what will be exported (application settings, N servers), notes that credentials are not included, and has an Export button.
- Export button opens a native save dialog (default name like `bitbutler-YYYY-MM-DD.bbc`) and writes the file. Nothing is selectable: export is always everything.
- Model the modal on the existing torrent export/import modals and IPC pattern.

### Import

- Entry points:
  - Menu item `Settings > Import configuration`.
  - Login screen, no servers yet: below the existing "Add a server to get started" text and add button, a second text "Or import a configuration" and an Import configuration button.
  - Login screen, servers exist: a third button, below Manage servers, labelled Import configuration (outline/dashed style, see mockup).
- Flow: native open dialog (`.bbc` filter) → file is read and validated in the main process → import modal opens listing the content.
- Import modal: one switch for "Application settings", then a "Servers" section with one switch per server in the file. All switches default to on, including new servers. Each server row is tagged "already exists - will overwrite" (same uuid already on this machine) or "new". The Import button is disabled when every switch is off.
- Apply rules:
  - Application settings on: every `settings` row in the file overwrites the matching row; rows not in the file are left alone.
  - Server on, uuid exists locally: overwrite connection fields (`name`, `host`, `protocol`, `port`, `auto_login`) and that server's settings. Saved username and password stay as they are.
  - Server on, new uuid: insert with the file's uuid, with empty username and no password. On first connect the existing credentials modal prompts; the user can save credentials there.
  - Servers on the machine that are not in the file (or not selected) are untouched. Import never deletes.
  - **Single auto-login server:** the database enforces at most one server with `auto_login = 1` (`uq_servers_auto_login`). If an imported server has `auto_login` true, every other server's flag is cleared first. The imported one wins.
  - If the file marks more than one selected server as `auto_login`, only the first one (file order) keeps the flag.
  - `auto_login` is kept in the file. At startup `login.ts` auto-connects the auto-login server and `connect()` opens the credentials modal when the server lacks credentials, so an imported auto-login server leads straight to the credentials prompt.
- The whole apply runs in one database transaction. Any failure rolls back and shows an error toast.
- After a successful import the renderer reloads so all settings services and the server store re-read the database (language and theme take effect immediately).
- Validation (main process): must be valid JSON of the expected shape; `version` must be a number the app understands. A file with a newer version than supported, or any malformed content, is rejected with an error toast and nothing is applied. Server records are validated like the existing server IPC input normalization (`server.ts`).

### i18n, toasts

- All new UI strings go in `packages/app/public/i18n/us.json` and `hu.json`; menu labels also used by `packages/electron/src/i18n.ts`.
- Toasts follow the CLAUDE.md rules (Title-Case outcome title, message is only the variable detail). Success toast e.g. "Configuration Imported"; errors e.g. "Failed to Import Configuration" with the raw error. No toast on export beyond what is not otherwise visible (builder's call, the saved file is not visible in the UI so a success toast is reasonable).

## Architecture notes

- Follow the IPC contract rule: add the new methods to `BitButlerAPI` in `packages/shared/src/ipc.types.ts`, a shared model for the file format in `packages/shared/src/models/`, preload exposure, `ipcMain.handle` handlers in `packages/electron/src/ipc/`, and the Angular side calling only `window.bitbutler.*`.
- File I/O, validation and the transactional apply live in the Electron main process (it owns `db.ts`, `safeStorage`, and the dialogs).
- The Angular side owns the modals and a command-bus command or a service for the menu/login triggers, consistent with the existing handler services.
- Menu entries are built in `packages/electron/src/menu.ts` (Settings submenu) and must be covered by `menu.spec.ts`.
- New servers need no password handling at all (column left null); do not touch `safeStorage` on import.

## Decisions made by the design (not by the user)

- Exported `settings` keyed by raw row ids instead of short hand-picked names.
- Imported servers keep their file uuid; "exists" is decided by uuid only.
- Reload the renderer after import.
- Reject newer-version files rather than best-effort import.
- Imported auto-login server wins the single-auto-login constraint.
- Single transaction, all-or-nothing.

## Out of scope / later

- Password-protected or encrypted export that could include credentials.
- Persisting window bounds.
- Deleting local items that are missing from the file ("replace" mode).
