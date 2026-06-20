# Export .torrent + Copy menu rework - Design

Issue: #177

## Motivation

The grid's right-click context menu currently has no way to grab a single torrent's raw
`.torrent` file without going through the full bulk `.bbe` export flow, and the "Copy"
submenu's contents have grown ad hoc (a single-selection-only "copy cell value" item,
no way to copy a torrent's name or save path). This change adds a quick per-torrent
export action and reworks "Copy" into a fixed, predictable set of fields. Implementing
the export action's enabled/disabled state efficiently also means caching whether the
server's qBittorrent instance exposes the `/api/v2/torrents/export` endpoint, instead of
probing live every time - and that cache can replace the live probe the existing bulk
export feature already does for legacy-vs-full-mode detection.

## Out of scope

- Changing the bulk `.bbe` export/import modal's UI or behavior beyond swapping its
  live `probeFullMode` calls for the cached field.
- Re-checking `export_available` automatically after the first successful check (e.g. if
  the user upgrades qBittorrent mid-session). It only re-probes when the cached value is
  `NULL`. Acceptable tradeoff per discussion - avoids a DB migration/backfill script and
  keeps the check off the hot path.
- A "show in folder" affordance after exporting. Success is silent (the save dialog
  closing is the confirmation); only failures toast, consistent with how other
  context-menu actions in this app behave (e.g. delete).

## 1. `export_available` server field

New nullable column on `servers`:

```sql
export_available INTEGER CHECK (export_available IN (0,1))
```

- `NULL` = not yet checked. `0` = checked, endpoint not available. `1` = checked, available.
- No `DEFAULT` clause needed: SQLite leaves both newly-inserted rows (column omitted from
  the `INSERT`) and existing rows (after `ALTER TABLE ... ADD COLUMN`) as `NULL`
  automatically. This means upgrading installs get the same "unknown" state as freshly
  added servers, with no backfill logic.
- `packages/electron/src/db.ts`: add the column to the `CREATE TABLE IF NOT EXISTS
servers (...)` definition (fresh installs), and add a guarded migration - following the
  existing pattern used for the nullable-password migration - that runs `ALTER TABLE
servers ADD COLUMN export_available INTEGER CHECK (export_available IN (0,1))` only if
  the column doesn't already exist (check via `db.pragma('table_info(servers)')`).
- `packages/shared/src/models/server.model.ts`: add `export_available: 0 | 1 | null` to
  `ServerRecord`. Do **not** add it to `NewServer` - it's not user-editable and must not
  appear in the server editor form.
- `packages/electron/src/ipc/server.ts`:
  - Add `export_available` to the `ServerRow` interface and to the `SELECT` list in
    `stmtList`, `stmtGetById`, `stmtGetByHost`.
  - `rowToRecord` passes the value through unchanged (already nullable in SQLite ->
    `number | null` in JS, no coercion needed - unlike `auto_login`/`has_password` which
    coerce `0/1` to boolean).
  - Add a narrow, dedicated update path - not routed through the generic `server:update`
    / `NewServer`-shaped `serverUpdate` - since this is internal bookkeeping, not a form
    field: a prepared statement `stmtSetExportAvailable` and an exported function
    `setExportAvailable(id: string, value: 0 | 1): void`, plus a small read helper
    `getExportAvailable(id: string): 0 | 1 | null` (used by `export.ts`, see below).
  - Register `ipcMain.handle('server:set-export-available', ...)` calling
    `setExportAvailable`.

## 2. Login-time probe

In `packages/app/src/app/pages/login/login.ts`, inside `connect()`: after
`qbittorrentService.auth.login(...)` resolves with `loggedIn: true`, and before
`this.router.navigate(['/pages/main'])`:

```ts
if (currentServer.export_available === null) {
  try {
    const { available } = await window.bitbutler.export.checkAvailability(currentServer.id);
    await window.bitbutler.server.setExportAvailable({
      id: currentServer.id,
      value: available ? 1 : 0,
    });
    await this.serverStoreService.refresh();
  } catch {
    // Non-critical - leave it null, retried on next login.
  }
}
```

Wrapped so a probe failure never blocks login. `serverStoreService.refresh()` re-reads
the server list (cheap local SQLite read via IPC, not a network call) so
`currentServer().export_available` is resolved before the grid renders and the context
menu reads it.

`packages/electron/src/ipc/export.ts` gets a new thin handler reusing the existing probe:

```ts
ipcMain.handle('export:check-availability', async (_e, { serverId }: { serverId: string }) => ({
  available: await probeFullMode(serverId),
}));
```

`probeFullMode` itself is unchanged - it's the actual HTTP probe primitive, still used
here and as the fallback described below.

## 3. Existing bulk export reuses the cached field

Both call sites that currently call `probeFullMode(serverId)` on every invocation switch
to reading the cached field first, falling back to a live probe only if it's
unexpectedly still `null` (shouldn't happen post-login, but defensive):

```ts
async function resolveFullMode(serverId: string): Promise<boolean> {
  const cached = getExportAvailable(serverId);
  return cached === null ? probeFullMode(serverId) : cached === 1;
}
```

Replace the `probeFullMode(serverId)` calls in `export:get-server-info`'s handler and in
`runExport` with `resolveFullMode(serverId)`. No behavior change for the user, removes a
redundant network round trip from opening the export modal and from every export run.

## 4. "Export .torrent" context menu item

`packages/app/src/app/pages/main/grid/context-menu/grid-context-menu.service.ts`,
`buildTorrentMenu`:

- Root-level item (not nested in a submenu), placed directly after the "Files" submenu
  entry.
- Icon: `faFloppyDisk` (solid).
- `id: 'torrent.exportFile'`. Label `pages.main.grid.context-menu.item.export-torrent-file`
  (singular) / `...-files` (plural for multi-selection), following the existing
  hash/magnet pluralization convention.
- `disabled: serverStoreService.currentServer()?.export_available !== 1`. When disabled,
  set `tooltip` to a new key explaining the endpoint isn't available on this server (see
  tooltip mechanism below).
- Action calls a new private method `exportTorrentFiles(selected: Torrent[])` on the
  service (same self-contained-closure style as the Copy items - no command bus
  indirection needed since there's no modal/cross-cutting state involved):

  ```ts
  private async exportTorrentFiles(selected: Torrent[]): Promise<void> {
    const serverId = this.serverStoreService.currentServerId();
    if (!serverId) return;
    const items = selected.map((t) => ({ hash: t.hash, name: t.name }));
    try {
      const result = await window.bitbutler.export.saveTorrentFiles({ serverId, items });
      if (result.failed.length > 0) {
        this.toastService.danger(
          `Failed to export ${result.failed.length} of ${items.length} torrent(s).`,
          'Export failed',
        );
      }
    } catch (err: any) {
      this.toastService.danger(err?.message ?? String(err), 'Export failed');
    }
  }
  ```

  Requires injecting `ToastService` into `GridContextMenuService` (not currently
  injected there).

### New shared IPC contract (`packages/shared/src/ipc.types.ts`)

```ts
export interface ExportTorrentFileItem {
  hash: string;
  name: string;
}

export interface ExportTorrentFilesResult {
  cancelled: boolean;
  savedPaths: string[];
  failed: { hash: string; name: string; error: string }[];
}
```

Added to `BitButlerAPI.export`:

```ts
checkAvailability(serverId: string): Promise<{ available: boolean }>;
saveTorrentFiles(payload: {
  serverId: string;
  items: ExportTorrentFileItem[];
}): Promise<ExportTorrentFilesResult>;
```

Added to `BitButlerAPI.server`:

```ts
setExportAvailable(payload: { id: string; value: 0 | 1 }): Promise<{ updated: boolean }>;
```

`packages/electron/src/preload.ts` bridges all three via `ipcRenderer.invoke`, matching
the existing bridging pattern for the rest of the `export`/`server` namespaces.

### `export:save-torrent-files` handler (`packages/electron/src/ipc/export.ts`)

Reuses the already-imported `qbRequest`, `dialog`, `fs`, `path`:

- 0 items: returns `{ cancelled: true, savedPaths: [], failed: [] }` immediately.
- 1 item: `dialog.showSaveDialog` defaulting to `<sanitized name>.torrent`, filtered to
  `.torrent`. Cancelled -> `{ cancelled: true, ... }`. Otherwise fetch the buffer via
  `qbRequest({ path: '/api/v2/torrents/export', query: { hash }, responseType: 'buffer' })`
  and write it to the chosen path.
- 2+ items: `dialog.showOpenDialog({ properties: ['openDirectory'] })`. Cancelled ->
  `{ cancelled: true, ... }`. Otherwise loop sequentially (mirrors `runExport`'s existing
  sequential loop - avoids hammering the server with concurrent requests): sanitize each
  name, write `<dir>/<name>.torrent`; on a filename collision within the batch, append
  the first 8 chars of the hash before retrying the write. Per-item failures are caught
  and collected into `failed`, not aborting the rest of the batch (mirrors
  `buildExportEntry`'s existing per-entry try/catch).

```ts
function sanitizeFilename(name: string): string {
  return (name || 'torrent').replace(/[\\/:*?"<>|]/g, '_').trim() || 'torrent';
}
```

## 5. Copy submenu rework

Same file, `buildTorrentMenu`'s `copy` submenu. New fixed order, all available for both
single and multi-selection:

1. **Name** (new) - `data.row.name` / joined `\n` of `selected.map(t => t.name)`.
2. **Magnet Link** (existing `torrent.copyMagnet`, unchanged, reordered).
3. **Torrent ID (Hash)** (existing `torrent.copyInfoHash`, unchanged, reordered).
4. **Save Path** (new) - `data.row.save_path` / joined `\n`.
5. **As JSON** (existing `torrent.copyJson`, unchanged - already always an array).

Drops the existing `cell.copyValue` item (single-selection-only "copy cell value")
entirely. "Comment" is intentionally not included - it's not part of the grid's row data
(only available via a separate per-torrent `/api/v2/torrents/properties` call), and isn't
worth a round trip just for a context-menu copy action.

## 6. Tooltip mechanism for disabled items

Chromium suppresses pointer/hover events on natively-`disabled` buttons, so neither a
native `title` attribute nor `ngbTooltip` would reliably fire on today's disabled menu
items (or the new Export item) without first changing how "disabled" is rendered.

`packages/app/src/app/pages/main/grid/context-menu/`:

- `context-menu.types.ts`: add `tooltip?: string` to the `item` variant of
  `ContextMenuEntry`.
- `context-menu.html`: stop binding `[disabled]="entry.disabled"` on item buttons; bind
  `[class.bb-item--disabled]="entry.disabled"` and
  `[attr.aria-disabled]="entry.disabled ? 'true' : null"` instead. Click handling is
  unaffected - `onEntryClick` already early-returns on `entry.disabled`. Add
  `(mouseenter)`/`(mouseleave)` handlers that show/hide a tooltip when
  `entry.disabled && entry.tooltip` is set.
- `context-menu.ts`: a local signal holding the currently-hovered tooltip text (or
  `null`), plus show/hide handlers that position a popover element via
  `getBoundingClientRect()` on the hovered button and call `showPopover()` /
  `hidePopover()` on it. Each `ContextMenu` component instance (including the ones
  created per-submenu-level via `ComponentPortal`) owns its own popover element - no
  cross-component coordination needed, since Popover API content renders in the
  browser's top layer regardless of DOM nesting.
- `context-menu.scss`: replace the `:disabled` styling rules with `.bb-item--disabled`
  equivalents (same dimmed opacity / `cursor: not-allowed`); add minimal styling for the
  new popover element.
- Electron 39 (already the project's pinned version) ships a Chromium new enough for the
  Popover API with no feature-detection fallback needed.

Apply `tooltip` to every entry in `grid-context-menu.service.ts` that already computes a
`disabled` value, plus the new Export item:

| Entry                   | Disabled when            | Tooltip                                                                |
| ----------------------- | ------------------------ | ---------------------------------------------------------------------- |
| `files.openDestination` | local path unresolved    | path could not be resolved on this machine                             |
| `row.pinToTop`          | already pinned top       | row is already pinned to the top                                       |
| `row.pinToBottom`       | already pinned bottom    | row is already pinned to the bottom                                    |
| `row.unpin`             | not pinned               | row is not pinned                                                      |
| `sort.asc.<col>`        | already sorted asc       | column is already sorted ascending                                     |
| `sort.desc.<col>`       | already sorted desc      | column is already sorted descending                                    |
| `sort.clear.<col>`      | no sort applied          | no sort is applied to this column                                      |
| `filter.open.<col>`     | column has no filter     | this column does not support filtering                                 |
| `filter.clear.<col>`    | filter not active        | no filter is active on this column                                     |
| `pinLeft.<col>`         | already pinned left      | column is already pinned to the left                                   |
| `pinRight.<col>`        | already pinned right     | column is already pinned to the right                                  |
| `unpinColumn.<col>`     | not pinned               | column is not pinned                                                   |
| `torrent.exportFile`    | `export_available !== 1` | the `/api/v2/torrents/export` endpoint is not available on this server |

All tooltip strings are new i18n keys (both `us.json` and `hu.json`).

## i18n additions

Under `pages.main.grid.context-menu.item.*`: `export-torrent-file`, `export-torrent-files`,
`copy-name`, `copy-names`, `copy-save-path`, `copy-save-paths`. Under
`pages.main.grid.context-menu.tooltip.*`: one key per row in the table above. Remove the
now-unused `copy-cell-value` key if nothing else references it.

## Testing

- `grid-context-menu.service.spec.ts`: cover the new Export item's enabled/disabled
  states (mock `serverStoreService.currentServer()`), the reordered/expanded Copy
  submenu (single + multi-selection join-with-`\n` behavior, JSON-always-array), and that
  `cell.copyValue` is gone.
- `context-menu.spec.ts`: cover hover show/hide of the tooltip popover for a
  disabled-with-tooltip entry, and that clicking a disabled item still no-ops.
- `packages/electron/src/ipc/export.spec.ts`: cover `export:save-torrent-files` for the
  0/1/2+ item cases (mocking `dialog` and `qbRequest`), filename collision handling, and
  partial-failure (some hashes fail, batch continues, `failed` populated).
- `packages/electron/src/ipc/server.spec.ts`: cover `setExportAvailable`/
  `getExportAvailable` and the new migration (column added to an existing `servers`
  table without one).
- `login.spec.ts`: cover the login-time probe firing only when `export_available ===
null`, persisting the result, and that a probe failure doesn't block navigation to
  `/pages/main`.
