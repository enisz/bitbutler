# Logs view: row selection, compact rows, and log export

Issue: #329 (Logs view)

## Summary

Extend the logs grid with multi-row selection (feeding a selection-aware
"copy as JSON" context menu action), a compact-rows toolbar toggle (mirroring
the torrent list's compact-rows behavior), and a new Export Logs modal that
lets the user export all/filtered/selected log entries to a `.log` file using
a user-defined, single-line format template with `{{variable}}` placeholders.

## Goals

- Select one or more rows in the logs grid, with the same interaction model
  as the torrent list grid (click, ctrl/cmd+click, shift+click, and
  right-click-preserves-multi-selection).
- When 2+ rows are selected, the existing "Copy Row as JSON" context menu
  action copies the full selection as a JSON array instead of a single row
  object.
- A new "Compact Rows" toolbar button toggles a denser row height/spacing in
  the logs grid, persisted per the existing settings pattern, highlighted
  the same way the Color Coding button is when active.
- A new "Export Logs" modal (opened from the existing Export toolbar button)
  lets the user:
  - choose an export scope: all / filtered / selected (with counts),
  - define a single-line format template (default provided) with a
    variable guide showing available placeholders,
  - click Export, pick a destination/filename via a native OS save dialog,
    and write a plain-text `.log` file.

## Non-goals

- No progress/multi-phase UI for the export (unlike Export Torrents) — the
  operation is synchronous, local, and fast (formatting already-loaded log
  entries and writing one text file).
- No live-updating selection/filter counts while the modal is open — a
  snapshot taken when the Export button is clicked is sufficient, since the
  modal blocks interaction with the grid behind it.
- No new global selection/filter store service for logs — the data is only
  consumed by the Export Logs modal at the moment it's opened.

## Design

### 1. Row selection + selection-aware JSON copy

`packages/app/src/app/pages/logs/logs-grid/logs-grid.ts`:

- Add a `rowSelection` grid option identical to the torrent list grid:
  `{ mode: 'multiRow', checkboxes: false, headerCheckbox: false, enableClickSelection: true }`.
- Track the current selection in a signal, updated via `onSelectionChanged`.
- On `onCellContextMenu`, replicate the torrent grid's
  `handleCellRightClick` behavior: if the right-clicked row is not part of
  the current multi-selection, collapse the grid selection to just that row
  before building the context menu; if it is part of the current
  multi-selection, leave the selection as-is.
- `buildRowMenu`'s existing `copy.json` entry becomes selection-aware:
  - 1 row selected (or right-clicked outside any selection): unchanged
    behavior — copies the single row as a JSON object, label stays
    "Copy Row as JSON".
  - 2+ rows selected: copies `JSON.stringify(selection, null, 2)` (an
    array), and the label switches to a new "Copy Rows as JSON" key,
    mirroring the singular/plural label pattern already used in the
    torrent grid's context menu (`pages.main.grid.context-menu.item.*`).
- Add two public methods for the Export Logs flow (see section 3):
  - `getSelectedRows(): LogEntry[]` — `this.api?.getSelectedRows() ?? []`.
  - `getFilteredRows(): LogEntry[]` — collected via
    `this.api?.forEachNodeAfterFilter(node => ...)`.

### 2. Compact rows toggle

`packages/app/src/app/models/log-grid.model.ts`:

- Add `compactRows: boolean` to `LogGridSettings`, default `false`, in
  `DEFAULT_LOG_GRID_SETTINGS`.

`packages/app/src/app/pages/logs/logs-grid/logs-grid.ts`:

- Add a `compactRows` signal sourced from `LogGridSettingsService`
  (`toSignal`, same pattern as `colorCodingEnabled`).
- Extend the existing `currentTheme` computed to apply
  `.withParams({ spacing: 4, rowHeight: 32 })` when `compactRows()` is true
  — identical to the torrent list grid's `grid.ts` implementation.

`packages/app/src/app/pages/logs/logs.ts` / `logs.html`:

- Add a `compactRowsEnabled` signal (same `toSignal` pattern as
  `colorCodingEnabled`) and a `toggleCompactRows()` method (same shape as
  `toggleColorCoding()`).
- Add a new toolbar button between Color Coding and Refresh: solid
  `faCompress` icon (no icon swap on toggle), `[class.bb-tool--primary]`
  bound to `compactRowsEnabled()` — the same highlight treatment the Color
  Coding button uses.

### 3. Export Logs modal

New standalone modal at `packages/app/src/app/modals/export-logs/`
(`export-logs.ts`, `.html`, `.scss`, `.spec.ts`), modeled on
`export-torrents` but simplified (no server-info/progress/done phases).

**Inputs** (signal inputs, set via `setModalInput` when opened):

- `all: LogEntry[]`
- `filtered: LogEntry[]`
- `selected: LogEntry[]`

**Form**:

- `scope: FormControl<'all' | 'filtered' | 'selected'>`, default `'all'`;
  radio group with counts, disabling `filtered`/`selected` when empty —
  same structure as Export Torrents' scope radios.
- `format: FormControl<string>`, default:
  `[{{date}}] [{{process}}] [{{level}}] ({{filename}}:{{line}}) - {{message}}`
  — single-line text input, required.

**Variable guide**: a collapsible section below the format input (toggle
button + `NgbCollapse`), copying the General Settings date-format token
guide pattern exactly — a table with Token / Description / Example
columns. Available tokens: `date`, `process`, `level`, `message`,
`context`, `filename`, `line`, `id`. The example column renders each token
against the first entry of the currently selected scope (falling back to a
static sample entry if the scope is empty).

**Format rendering**: new pure helper
`packages/app/src/app/modals/export-logs/log-export-format.lib.ts`:

- `renderLogFormatTemplate(template: string, entry: LogEntry, dateFormatService: DateFormatService): string`
  — replaces `{{token}}` (regex `/\{\{\s*(\w+)\s*\}\}/g`) for each of the
  eight tokens above; `{{date}}` uses `dateFormatService.format(entry.timestamp)`
  (the same service `LocalTimestampPipe` uses for the grid's timestamp
  column, so the two stay in sync); null/missing fields render as `''`.
  An unrecognized `{{token}}` is left in the output as-is (the regex
  replacer only substitutes matches against the known token list).
- `LOG_EXPORT_FORMAT_TOKENS` — the ordered token list backing the guide
  table.

**Export flow**: no destination fields in the form. The footer "Export"
button:

1. Builds `content` by mapping the entries in the selected scope through
   `renderLogFormatTemplate` and joining with `\n`.
2. Calls `window.bitbutler.log.export({ content, defaultFilename: 'bitbutler.log' })`.
3. If `cancelled` — do nothing; the modal stays open so the user can adjust
   scope/format and retry.
4. On success — toast (title "Logs Exported", message = the saved path,
   per the toast conventions in CLAUDE.md) and close the modal.
5. On IPC rejection — danger toast (title "Failed to Export Logs", message
   = the caught error) and the modal stays open.

`packages/app/src/app/pages/logs/logs.ts`:

- Add `exportLogs()`: reads `this.logsGrid()?.getSelectedRows()` /
  `getFilteredRows()` and `this.logs()` for "all", opens `ExportLogs` via
  `NgbModal`, and sets the three inputs with `setModalInput`.
- Add a `logsGrid = viewChild(LogsGrid)` signal query to reach the grid
  component's new public methods.

`packages/app/src/app/pages/logs/logs.html`:

- Wire the existing Export toolbar button's `(click)` to `exportLogs()`
  (currently a no-op placeholder).

### 4. New IPC: `log.export`

`packages/shared/src/ipc.types.ts` — extend the `log` namespace:

```ts
log: {
  write(entry: RendererLogEntry): void;
  list(): Promise<LogEntry[]>;
  clear(): Promise<{ ok: true }>;
  export(payload: { content: string; defaultFilename?: string }): Promise<{ cancelled: boolean; path?: string }>;
};
```

`packages/electron/src/ipc/log.ts` — add an `ipcMain.handle('log:export', ...)`
handler:

- `dialog.showSaveDialog({ defaultPath: payload.defaultFilename ?? 'bitbutler.log', filters: [{ name: 'Log files', extensions: ['log'] }] })`.
- If canceled or no `filePath` — return `{ cancelled: true }`.
- Otherwise — `await fs.promises.writeFile(filePath, payload.content, 'utf-8')`
  and return `{ cancelled: false, path: filePath }`.
- Mirrors the existing single-file save flow in
  `packages/electron/src/ipc/export.ts` (`saveTorrentFiles`'s single-item
  branch). No filename sanitization is needed — the OS save dialog only
  ever returns a valid, user-chosen filesystem path.

`packages/electron/src/preload.ts` — wire `log.export` through
`ipcRenderer.invoke('log:export', payload)`.

### i18n

New keys needed (both `us.json` and `hu.json`):

- `pages.logs.compact-rows` — toolbar button label/tooltip.
- `pages.main.grid.context-menu.item.copy-rows-as-json` — plural label for
  the multi-row JSON copy action (reusing the existing
  `pages.main.grid.context-menu` namespace since the logs grid already
  reuses `pages.main.grid.context-menu.item.copy-row-as-json` and
  `pages.main.grid.context-menu.field.row-as-json`).
- `pages.main.grid.context-menu.field.rows-as-json` — plural field name
  used in the "copied to clipboard" toast.
- `components.modals.export-logs.*` — title, scope labels/hints, format
  label/placeholder, variable guide (toggle/hint/columns/token
  descriptions, mirroring
  `pages.settings.tab.general.general-settings-form.date-format.token-guide.*`),
  buttons.

## Testing

- `logs-grid.spec.ts`: row selection wiring, right-click
  preserve/collapse-selection behavior, single vs. multi JSON copy output
  and label, `getSelectedRows`/`getFilteredRows`, compact-rows theme
  params.
- `logs.spec.ts`: `toggleCompactRows`, `exportLogs` opening the modal with
  correct inputs.
- New `export-logs.spec.ts`: scope switching and counts, format rendering
  (via `log-export-format.lib.ts` unit tests), export flow (cancelled vs.
  success vs. error), variable guide example rendering.
- `log-export-format.lib.spec.ts`: template substitution for each token,
  null-field handling, and unknown-token passthrough.
- Electron: `log.spec.ts` — `log:export` handler for canceled dialog,
  successful write, and write failure.
