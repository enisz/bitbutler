# Configuration Export / Import Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the user export the whole BitButler configuration (app settings, servers, per-server settings) to a `.bbc` file and import it selectively, without ever exporting credentials.

**Architecture:** Format, validation and the transactional apply live in the Electron main process (`packages/electron/src/configuration.ts`, `configuration-apply.ts`) behind a new `config` IPC namespace declared in `@bitbutler/shared`. The Angular side adds a `ConfigurationService`, two modals opened through the existing command bus (`UI_EXPORT_CONFIGURATION`, `UI_IMPORT_CONFIGURATION`), Settings-menu items, and Import buttons on the login page. A successful import reloads the renderer.

**Tech Stack:** Electron main (TypeScript, better-sqlite3, vitest), Angular 22 zoneless/signals (ng-bootstrap modals, ngx-translate), `@bitbutler/shared` IPC contract.

**Spec:** `docs/superpowers/specs/2026-10-22-configuration-export-import-design.md`

## Global Constraints

- File extension `.bbc`, JSON, `version: 1`, `exported_at` in epoch milliseconds.
- Never export or import `username`, `password`, `has_password`, `webapi_version`, `qb_version`, `export_available`.
- Overwriting an existing server touches only `name`, `host`, `protocol`, `port`, `auto_login` and its settings rows; saved username/password stay.
- New servers: empty username, NULL password, `created_at` from the file; never call `safeStorage` on import.
- Import is one `db.transaction`; any failure rolls back and nothing is applied. Import never deletes.
- Switches (not checkboxes) in the import modal; all on by default, including new servers.
- Angular talks only to `window.bitbutler.*`; add every new method to `BitButlerAPI` in `packages/shared/src/ipc.types.ts`.
- Toasts follow CLAUDE.md (Title-Case outcome title, message = only the variable detail). Strings go in `packages/app/public/i18n/us.json` and `hu.json`; menu labels also under `electron.menu` in both files.
- Use `-` not an em dash in all text. Lint is `--max-warnings=0`. Commits: `#<IssueID>: short description` on a feature branch `<issue-id>-<summary>`.
- Test commands: electron `npm test -w @bitbutler/electron -- <spec path>`; app `npm test -w @bitbutler/app -- --include=<spec path>`.

## Review Focus

- Selected server's `host` equals a different local server's host (unique column): whole import rolls back with "A server with the same host already exists.", settings not applied either. (Task 3)
- Hostile or hand-edited file: not JSON, `servers` an array, port 0 or 70000, server id containing `.`, top-level `settings` key containing `.`, `__proto__` keys, non-object settings blob: rejected, DB untouched. (Task 2)
- `version` newer than 1, or 0, negative, fractional, missing: rejected. (Task 2)
- File with two `auto_login` servers both selected: import succeeds, only the first keeps the flag; an existing local auto-login server loses it. (Task 3)
- Export with zero servers and an export when the DB holds username/password: valid file, empty `servers`, no credential fields anywhere in the output. (Task 2)

---

### Task 1: Shared model and IPC contract

**Files:**

- Create: `packages/shared/src/models/configuration.model.ts`
- Modify: `packages/shared/src/index.ts`, `packages/shared/src/ipc.types.ts` (add `config` namespace to `BitButlerAPI`)

**Interfaces:**

- Produces (all exported from `@bitbutler/shared`):
  - `BBC_VERSION = 1` (const)
  - `BbcServer = { id: string; name: string; host: string; protocol: ServerProtocol; port: number; auto_login: boolean; created_at: string; settings: Record<string, unknown> }`
  - `BbcFile = { version: number; exported_at: number; settings: Record<string, unknown>; servers: Record<string, BbcServer> }`
  - `BbcServerSummary = { id: string; name: string; host: string; port: number; exists: boolean }`
  - `BbcMetadata = { version: number; exportedAt: number; hasSettings: boolean; servers: BbcServerSummary[] }`
  - `BbcImportPayload = { path: string; applySettings: boolean; serverIds: string[] }`
  - `BbcImportResult = { settings: boolean; servers: number }`
  - `BitButlerAPI.config`: `exportToFile(): Promise<{ canceled: boolean; path?: string }>`, `openPicker(): Promise<string | undefined>`, `read(payload: { path: string }): Promise<BbcMetadata>`, `importFile(payload: BbcImportPayload): Promise<BbcImportResult>`

- [ ] **Step 1: Add the model file and export the new types and `BBC_VERSION` from `packages/shared/src/index.ts`** (`BBC_VERSION` is a value export, the rest `export type`).
- [ ] **Step 2: Add the `config` block to `BitButlerAPI`** with the four signatures above.
- [ ] **Step 3: Run `npm run build -w @bitbutler/shared` (or the package's build script) and confirm it compiles.** Expected: no errors (preload and app will not compile yet; that is fixed in later tasks).
- [ ] **Step 4: Commit** `#<ID>: add configuration export/import IPC contract`

### Task 2: Build, parse and describe a configuration (main process)

**Files:**

- Create: `packages/electron/src/configuration.ts`, `packages/electron/src/configuration.spec.ts`

**Interfaces:**

- Consumes: Task 1 types; `db` default export from `./db.js`; the `servers` and `settings` tables.
- Produces:
  - `buildConfiguration(): BbcFile`
  - `parseConfiguration(raw: string): BbcFile` (throws `Error` with a user-readable message on any invalid input)
  - `describeConfiguration(file: BbcFile): BbcMetadata` (`exists` is computed against the local `servers` table by id)

- [ ] **Step 1: Write failing tests** in `configuration.spec.ts`, mocking `./db.js` like `ipc/settings.spec.ts` does. Test names and assertions:
  - `buildConfiguration puts non-server rows under settings` - rows `GeneralSettingsService` and `StatusBarSettingsService` appear as parsed JSON under `settings`.
  - `buildConfiguration nests <Service>.<serverId> rows under that server` - `ServerSettingsService.s1` and `AddTorrentSettingsService.s1` end up in `servers.s1.settings.ServerSettingsService` / `.AddTorrentSettingsService`, and not in top-level `settings`.
  - `buildConfiguration skips settings rows of deleted servers` - a `ServerSettingsService.ghost` row appears nowhere.
  - `buildConfiguration never emits credentials` - DB rows carrying `username`, `password`, `has_password`, `webapi_version`, `qb_version`, `export_available`; `JSON.stringify(result)` contains none of those keys' values and `Object.keys(server)` equals `['id','name','host','protocol','port','auto_login','created_at','settings']`.
  - `buildConfiguration with no servers returns servers: {}` and `version === 1`, `typeof exported_at === 'number'`.
  - `parseConfiguration` rejects (each its own `it`, `toThrow()`): non-JSON; JSON array; `version` missing / `0` / `-1` / `1.5` / `2` (message mentions a newer version for `2`); `servers` an array; server `port` `0` and `70000`; server key different from its `id`; server id containing `.`; top-level settings key `"A.b"`; a settings blob that is `null` or a string; a server with empty `name` or a `host` containing `/`; `protocol` not `http`/`https`.
  - `parseConfiguration ignores __proto__ keys` - input with `"__proto__"` as a settings key is rejected (same rule as a bad key) and `Object.prototype` is not polluted.
  - `parseConfiguration returns the file for a valid document` (round-trips `buildConfiguration` output).
  - `describeConfiguration marks existing servers` - `exists` true for an id present in the mocked `servers` table, false otherwise; `hasSettings` is `Object.keys(settings).length > 0`.
- [ ] **Step 2: Run** `npm test -w @bitbutler/electron -- src/configuration.spec.ts`. Expected: FAIL (module missing).
- [ ] **Step 3: Implement the three functions in `configuration.ts`.** Partition `settings` rows with the rule: id matches `^(.+)\.([^.]+)$` and group 2 is an id in `servers` means server-scoped; everything else is app settings. Reuse the host/port/string validation helpers from `ipc/server.ts` by exporting `requireString`, `requireNonEmptyHost`, `requirePort` from it (do not duplicate them). Parse blobs with `JSON.parse`, skipping rows that fail to parse.
- [ ] **Step 4: Run the spec.** Expected: PASS.
- [ ] **Step 5: Commit** `#<ID>: build and validate configuration files`

### Task 3: Apply a configuration transactionally

**Files:**

- Create: `packages/electron/src/configuration-apply.ts`, `packages/electron/src/configuration-apply.spec.ts`
- Modify: `packages/electron/src/ipc/server.ts` (export `toUserDbError`)

**Interfaces:**

- Consumes: `BbcFile`, `BbcImportResult` (Task 1); `toUserDbError` from `ipc/server.ts`; `getCookieJar` from `ipc/qbittorrent.js`; `rebuildMenu` from `menu.js`.
- Produces: `applyConfiguration(file: BbcFile, selection: { applySettings: boolean; serverIds: string[] }): BbcImportResult` (throws `Error` with the `toUserDbError` message on DB failure; ids in `serverIds` that are not in the file throw `Error('Server <id> is not in the file.')` before any write)

- [ ] **Step 1: Write failing tests** against a real in-memory better-sqlite3 database (use the schema statements from `db.ts`; mock `./db.js` default export to that handle, mock `rebuildMenu` and `getCookieJar`). Assertions:
  - `overwrites settings rows by id and leaves other rows` - a local `StatusBarSettingsService` row not in the file is unchanged; `GeneralSettingsService` replaced.
  - `applySettings false writes no settings rows`.
  - `new server is inserted with empty username and NULL password and the file created_at`.
  - `existing server keeps username and password but takes name/host/protocol/port/auto_login from the file`.
  - `server settings rows are written as <Service>.<id>` for selected servers only; an unselected server's rows are untouched.
  - `overwriting a server whose host/port/protocol changed resets webapi_version, qb_version, export_available to NULL and drops its cookie`; unchanged connection fields keep them.
  - `imported auto_login server clears the flag on every other local server`.
  - `two selected auto_login servers: only the first in file order keeps auto_login`.
  - `host collision with a different local server throws 'A server with the same host already exists.' and nothing is applied` (assert settings row and other selected server unchanged).
  - `unknown serverId throws before any write`.
  - `calls rebuildMenu once after success, not on failure`.
- [ ] **Step 2: Run** `npm test -w @bitbutler/electron -- src/configuration-apply.spec.ts`. Expected: FAIL.
- [ ] **Step 3: Implement `applyConfiguration`.** Single `db.transaction`. Order: clear `auto_login` on all rows if any selected server will keep the flag; then settings rows (`INSERT ... ON CONFLICT(id) DO UPDATE`); then per selected server in file order UPSERT keyed by id, preserving the existing `username`/`password` columns for updates (use an `UPDATE` for existing ids and an `INSERT` for new ones). Translate thrown DB errors with `toUserDbError`.
- [ ] **Step 4: Run the spec.** Expected: PASS.
- [ ] **Step 5: Commit** `#<ID>: apply imported configuration in one transaction`

### Task 4: IPC handlers and preload

**Files:**

- Create: `packages/electron/src/ipc/configuration.ts`, `packages/electron/src/ipc/configuration.spec.ts`
- Modify: `packages/electron/src/main.ts` (register next to `registerExportIpcHandlers()`), `packages/electron/src/preload.ts` (add `config` block)

**Interfaces:**

- Consumes: Tasks 2 and 3 functions; Electron `dialog`.
- Produces: `registerConfigurationIpcHandlers(): void` handling channels `config:export`, `config:open-picker`, `config:read`, `config:import`; preload `config.exportToFile/openPicker/read/importFile` matching Task 1.

- [ ] **Step 1: Write failing tests** (mock `electron` `dialog`/`ipcMain`, mock `fs/promises` and the Task 2/3 modules, same style as `ipc/export.spec.ts`):
  - `config:export writes buildConfiguration() JSON to the chosen path` - save dialog default name matches `/^bitbutler-\d{4}-\d{2}-\d{2}\.bbc$/`, filter extension `bbc`; returns `{ canceled: false, path }`.
  - `config:export returns { canceled: true } when the dialog is cancelled` and writes nothing.
  - `config:open-picker returns the picked path or undefined`.
  - `config:read returns describeConfiguration(parseConfiguration(fileText))`; a parse error rejects with its message.
  - `config:import re-reads the file, parses it, and calls applyConfiguration with { applySettings, serverIds }`; rejects (without calling apply) when `serverIds` is not a string array or `applySettings` not a boolean.
- [ ] **Step 2: Run** `npm test -w @bitbutler/electron -- src/ipc/configuration.spec.ts`. Expected: FAIL.
- [ ] **Step 3: Implement the handlers and register them in `main.ts`; add the `config` block to `preload.ts`** via `ipcRenderer.invoke`.
- [ ] **Step 4: Run** the new spec and `npm run build:electron`. Expected: PASS and clean compile.
- [ ] **Step 5: Commit** `#<ID>: expose configuration export/import over IPC`

### Task 5: Electron menu items

**Files:**

- Modify: `packages/electron/src/menu.ts` (Settings submenu), `packages/electron/src/menu.spec.ts`, `packages/app/public/i18n/us.json`, `packages/app/public/i18n/hu.json` (under `electron.menu`: `export-configuration`, `import-configuration`)

**Interfaces:**

- Produces: menu actions `settings.export-configuration` and `settings.import-configuration` sent through `sendMenuAction`. The Settings submenu is only built when logged in (existing behavior); the login-page buttons (Task 9) cover the logged-out case.

- [ ] **Step 1: Write failing tests** in `menu.spec.ts`: in the Settings submenu (logged-in), items labelled `electron.menu.export-configuration` and `electron.menu.import-configuration` exist after a separator following Manage Categories; clicking each calls `webContents.send('menu:clicked', expect.objectContaining({ action: 'settings.export-configuration' }))` and `'settings.import-configuration'`.
- [ ] **Step 2: Run** `npm test -w @bitbutler/electron -- src/menu.spec.ts`. Expected: FAIL.
- [ ] **Step 3: Add the two items to `menu.ts` and the translation keys to both i18n files** (hu: "Konfiguráció exportálása", "Konfiguráció importálása"; us: "Export Configuration", "Import Configuration").
- [ ] **Step 4: Run** the spec. Expected: PASS.
- [ ] **Step 5: Commit** `#<ID>: add export/import configuration menu items`

### Task 6: Angular service and commands

**Files:**

- Create: `packages/app/src/app/services/configuration.service.ts`, `configuration.service.spec.ts`
- Modify: `packages/app/src/app/models/command.model.ts` (add to `UiCommand`: `{ type: 'UI_EXPORT_CONFIGURATION' }`, `{ type: 'UI_IMPORT_CONFIGURATION'; bbcPath: string }`), `packages/app/src/app/services/menu-bar-command-handler.service.ts` (+spec), `packages/app/src/app/services/ui-command-handler.service.ts` (+spec), `packages/app/src/app/app.ts` (+spec if it asserts startup)

**Interfaces:**

- Produces `ConfigurationService` (providedIn root):
  - `pickAndImport(): Promise<void>` - calls `window.bitbutler.config.openPicker()`, then emits `UI_IMPORT_CONFIGURATION` with `bbcPath` if a path was chosen.
  - `finishImport(counts: BbcImportResult): void` - stores counts in `sessionStorage` key `bb.configImported` (try/catch) and calls `window.location.reload()`.
  - `consumeImportToast(): BbcImportResult | null` - reads and removes that key.
  - `showImportedToastIfPending(): void` - if `consumeImportToast()` returns counts, shows a success toast titled `Configuration Imported` with a short detail message (counts); called once at app start from `app.ts`.
- Consumes: Task 1 `window.bitbutler.config`.

- [ ] **Step 1: Write failing tests:** `pickAndImport emits UI_IMPORT_CONFIGURATION with the picked path` and `does nothing when the picker is cancelled`; `finishImport stores counts then reloads` (spy on a `reload` wrapper injected or `window.location.reload` replaced); `consumeImportToast returns counts once, then null`; menu handler maps `settings.export-configuration` to `UI_EXPORT_CONFIGURATION` and `settings.import-configuration` to `ConfigurationService.pickAndImport`; ui handler opens the matching modal component for each command once, not twice when the modal is already open (mirror the `UI_EXPORT_TORRENTS`/`UI_IMPORT_TORRENTS` specs; the import modal gets `bbcPath` via `setModalInput(ref, 'bbcPath', ...)`).
- [ ] **Step 2: Run** the three spec files with `--include`. Expected: FAIL.
- [ ] **Step 3: Implement.** In `ui-command-handler.service.ts` lazy-import `modals/export-configuration/export-configuration` (`size: 'md'`) and `modals/import-configuration/import-configuration` (`size: 'lg'`, `scrollable: true`) the same way `UI_EXPORT_TORRENTS` does. (Modal classes are created in Tasks 7 and 8; until then stub them with an empty standalone component so this task compiles, then replace.)
- [ ] **Step 4: Run** the specs. Expected: PASS.
- [ ] **Step 5: Commit** `#<ID>: wire configuration commands and menu actions`

### Task 7: Export configuration modal

**Files:**

- Create: `packages/app/src/app/modals/export-configuration/export-configuration.{ts,html,scss,spec.ts}`
- Modify: `us.json`, `hu.json` (new `modals.export-configuration` block: title, `contents`, `servers-count`, `credentials-note`, `export`, `cancel`, toast titles/messages)

**Interfaces:**

- Consumes: `ServerStoreService.servers()`, `window.bitbutler.config.exportToFile()`, `ToastService`.
- Produces: standalone component `ExportConfiguration`.

- [ ] **Step 1: Write failing tests:** shows the number of servers from the store; Export button calls `exportToFile`; on `{ canceled: false, path }` closes the modal and shows a success toast titled `Configuration Exported` with the path as message; on `{ canceled: true }` the modal stays open and no toast is shown; a rejected call shows a danger toast titled `Failed to Export Configuration` with the error message and keeps the modal open; the Export button is disabled while the call is pending.
- [ ] **Step 2: Run** `npm test -w @bitbutler/app -- --include=src/app/modals/export-configuration/export-configuration.spec.ts`. Expected: FAIL.
- [ ] **Step 3: Implement the component** following `export-torrents` structure (`BbSectionCard`, `BbBtnContent`, OnPush, `NgbActiveModal`, `TranslatePipe`), content as in the approved mockup: list of what is exported, credentials note, Cancel + Export.
- [ ] **Step 4: Run** the spec. Expected: PASS.
- [ ] **Step 5: Commit** `#<ID>: add export configuration modal`

### Task 8: Import configuration modal

**Files:**

- Create: `packages/app/src/app/modals/import-configuration/import-configuration.{ts,html,scss,spec.ts}`
- Modify: `us.json`, `hu.json` (new `modals.import-configuration` block: title, `app-settings`, `servers`, `badge-exists`, `badge-new`, `import`, `cancel`, toast texts)

**Interfaces:**

- Consumes: `window.bitbutler.config.read/importFile`, `ConfigurationService.finishImport`, `ToastService`.
- Produces: `ImportConfiguration` with `@Input() bbcPath: string`. State signals: `metadata`, `applySettings`, `selectedServerIds: Set<string>` (signal), `loading`, `error`, `importing`. `canImport` computed is `(applySettings() || selectedServerIds().size > 0) && !importing()`.

- [ ] **Step 1: Write failing tests:** on init calls `read({ path: bbcPath })` and renders one switch for application settings (only when `hasSettings`) and one per server; all switches are on by default including `exists: false` servers; each server row shows the "already exists - will overwrite" badge iff `exists`, otherwise "new"; turning every switch off disables Import; Import calls `importFile({ path, applySettings, serverIds })` with exactly the on servers and then `ConfigurationService.finishImport(result)`; a read error shows the message in the modal and keeps Import disabled; an import error shows a danger toast titled `Failed to Import Configuration` with the raw error message and does not call `finishImport`; a file with zero servers hides the Servers section.
- [ ] **Step 2: Run** `npm test -w @bitbutler/app -- --include=src/app/modals/import-configuration/import-configuration.spec.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** using Bootstrap `form-switch` inputs (check how other modals/forms in `packages/app` render switches and reuse that component or class pattern).
- [ ] **Step 4: Run** the spec. Expected: PASS.
- [ ] **Step 5: Commit** `#<ID>: add import configuration modal`

### Task 9: Login page entry points

**Files:**

- Modify: `packages/app/src/app/pages/login/login.html`, `login.ts`, `login.spec.ts`, `us.json`, `hu.json` (`pages.login.import-configuration`, `pages.login.import-configuration-hint` = "Or import a configuration", `general.button.import-configuration` if a shared key fits)

**Interfaces:**

- Consumes: `ConfigurationService.pickAndImport()`.

- [ ] **Step 1: Write failing tests:** with no servers, the empty state renders the hint text and an Import configuration button below the add-server button; with servers, a third button follows Manage servers (`btn-outline-secondary`, dashed style from the mockup); clicking either calls `pickAndImport()`; the button is not shown while `loading()`.
- [ ] **Step 2: Run** `npm test -w @bitbutler/app -- --include=src/app/pages/login/login.spec.ts`. Expected: FAIL.
- [ ] **Step 3: Implement the template and a `public importConfiguration(): Promise<void>` method** delegating to the service; use `icons.faFileImport` in `bb-btn-content` (add to the `icons` object).
- [ ] **Step 4: Run** the spec. Expected: PASS.
- [ ] **Step 5: Commit** `#<ID>: add import configuration to the login page`

### Task 10: Finish and verify

**Files:**

- Modify: `app.ts` call site if not done in Task 6; CLAUDE.md "Architecture" IPC namespaces list (add `config`) if the list is enumerated there.

- [ ] **Step 1: Run** `npm run lint` and `npm test`. Expected: zero warnings, all workspaces green.
- [ ] **Step 2: Manual check with `npm start`:** export from Settings menu; delete a server and change a setting; import with settings off and one server on; confirm the server returns without credentials, the credentials modal appears on connect, and `auto_login` behaves as in the spec; confirm the empty login state shows the new text and button.
- [ ] **Step 3: Remove `docs/superpowers` in its own commit** `#<ID>: removed spec and plan` before opening the PR.
