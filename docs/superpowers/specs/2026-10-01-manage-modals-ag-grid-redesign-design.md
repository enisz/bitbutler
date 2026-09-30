# Manage Modals ag-grid Redesign

Issue: #341

## Overview

Replace the Manage Servers, Manage Tags, and Manage Categories modals - currently centered, plain-list UIs (Bootstrap `list-group` / tag pills) with no persisted layout, no sorting, no batch selection, and no context menus - with ag-grid-based grids that match the main torrent grid's capabilities: persisted column state, custom per-column filters, row and column-header context menus, and checkbox-based batch selection. All three modals move to top-aligned positioning with New/Edit/Delete grouped left in the footer, matching the visual convention (not the exact button set) of the Torrent Details modal.

ag-grid in this app is Community edition only (no Enterprise license). The main grid's context menus, column-header menu, and per-column filters are therefore already hand-built Angular/CDK components, not ag-grid Enterprise features - this means they are directly reusable/extractable for the new grids.

## Shared infrastructure

Because all three grids need identical mechanics, the following is built once and reused by all three, rather than duplicated:

- **Header column-context-menu**: `GridContextMenuService.buildHeaderMenu()` (`packages/app/src/app/pages/main/grid/context-menu/grid-context-menu.service.ts`) already operates only on `GridApi`/column state (sort asc/desc/clear, pin left/right/unpin, autosize, hide/show columns) with no torrent-specific logic. Extract it into a new grid-agnostic service (e.g. `packages/app/src/app/components/grid-header-context-menu/grid-header-context-menu.service.ts`) that any grid, including the main torrent grid, can call with a `ColumnApi`/column id. Wire it via the same `ContextMenuService.open()` CDK-overlay mechanism used today, triggered from each new grid's `onColumnHeaderContextMenu`.
- **Row context menu**: each of the three modals builds its own small 2-entry menu (Edit/Delete, or just Delete for Tags) directly against `ContextMenuService.open()` - too small to warrant a shared builder.
- **Selection + footer enable rules**: a shared helper (e.g. `packages/app/src/app/components/management-grid/management-grid-selection.util.ts`) exposing computed enable rules from a `signal<T[]>` of selected rows: New always enabled, Edit enabled iff exactly one selected, Delete enabled iff one or more selected. Each modal uses ag-grid's built-in checkbox selection (`rowSelection: { mode: 'multiRow', checkboxes: true, headerCheckbox: true }`) and syncs `onSelectionChanged` into its own local selection signal, following the pattern already used for `SelectionStoreService` in the main grid (a plain signal, not the store itself - these modals don't need cross-component selection state).
- **Custom filters**: reuse the existing per-column filter components unchanged from `packages/app/src/app/components/column-filters/`: `TextColumnFilter` (name/host/username/save-path), `NumberColumnFilter` (port/usage-count), `SetColumnFilter` (protocol), `BooleanColumnFilter` (auto-login).
- **Persisted grid state**: one `BaseSettingsService<T>` subclass per grid, following the existing `TrackersGridSettingsService`/`PeersGridSettingsService` pattern exactly (`packages/app/src/app/services/`):
  - `ManageServersGridSettingsService` (`SETTINGS_ID = 'ManageServersGridSettingsService'`)
  - `ManageTagsGridSettingsService` (`SETTINGS_ID = 'ManageTagsGridSettingsService'`)
  - `ManageCategoriesGridSettingsService` (`SETTINGS_ID = 'ManageCategoriesGridSettingsService'`)

  Each stores `columnState`/`filterModel` (matching `TorrentListGridSettings`'s shape, minus the pinned-row/pagination fields those modals don't need) as one global row via the existing generic `settings` IPC channel - no new IPC contract needed. All three are global (not per-server): column layout is a personal UI preference, and this explicitly includes Tags/Categories even though their _data_ is server-scoped.

- **Batch delete confirmation**: reuse `ConfirmService.confirm(...)` (`packages/app/src/app/services/confirm.service.ts`) unchanged, with a count-aware message aggregating affected-torrent counts across all selected rows, same pattern as today's single-item confirms in `manage-tags.ts`/`manage-categories.ts`.
- **Command bus additions** (`packages/app/src/app/models/command.model.ts`):
  - `TagCommand`: `TAG_ADDED` (payload: `{ names: string[] }`), `TAG_DELETED` (payload: `{ names: string[] }`)
  - `CategoryCommand`: `CATEGORY_ADDED` (payload: `{ name: string; savePath: string }`), `CATEGORY_UPDATED` (payload: `{ name: string; savePath: string }`), `CATEGORY_DELETED` (payload: `{ names: string[] }`)

  New handler services mirroring `ServerCommandHandlerService` (`packages/app/src/app/services/server-command-handler.service.ts`): `TagCommandHandlerService`, `CategoryCommandHandlerService`, each filtering `commands$` by type prefix, performing the toast + local-state refresh, started via `.start()` in `app.ts` alongside the existing handler services. Per the CLAUDE.md toast rule, `CATEGORY_UPDATED`'s handler shows **no toast on success** (the inline-edited cell already shows the new value) - only on failure.

- **Footer layout**: New / Edit / Delete grouped on the left, Close on the right, via `ms-auto` on the Close button (the same CSS mechanism Torrent Details uses to separate its left action group from its right-aligned Delete/Close, just applied to a different button grouping here).
- **Modal positioning**: no code change needed - omitting `centered: true` on `NgbModal.open()` already top-aligns, as it does today for these three modals and for Torrent Details.

## Manage Servers grid

File: `packages/app/src/app/modals/manage-servers/manage-servers.ts` (+ `.html`, `.scss`) - rewritten in place, same modal identity/invocation (`UI_MANAGE_SERVERS` command, unchanged).

**Columns** (in order): checkbox → active-status orb (custom cell renderer: filled green dot when `server.id === activeServerId`, empty outline otherwise; sortable/pinnable/hideable like any column, but not text-filterable - a small boolean-style filter using the existing `BooleanColumnFilter` is sufficient) → name (`TextColumnFilter`) → host (`TextColumnFilter`) → port (`NumberColumnFilter`) → protocol (`SetColumnFilter`: http/https) → username (`TextColumnFilter`) → auto-login (`BooleanColumnFilter`, checkmark renderer) → id (the server's database row id/uuid from `ServerModel.id`; `TextColumnFilter`; hidden by default, revealable via the header "show column" menu).

**Actions:**

- **New** → dynamic-import + open the existing `ServerEditor` modal unchanged (`packages/app/src/app/modals/server-editor/server-editor.ts`), create mode.
- **Edit** (enabled iff exactly one row selected, including the active server - editing connection details is allowed for the active server, only deletion is blocked) → open `ServerEditor` pre-filled via its existing `id` input.
- **Delete** (enabled iff one or more selected) → the active server's row checkbox is rendered disabled (via ag-grid's per-row `checkboxSelection` predicate checking `server.id === activeServerId`), so it can never be part of the selection → `ConfirmService.confirm` with a count-aware message → on confirm, emit `SERVER_DELETED` once per selected id (existing `ServerCommandHandlerService` already handles one id per command unchanged - no handler changes needed).
- **Row double-click** → same as Edit, on any row including active.
- **Row right-click** → Edit / Delete (Delete entry omitted for the active server's row).
- **Header right-click** → shared header-context-menu service.

## Manage Tags grid

File: `packages/app/src/app/modals/manage-tags/manage-tags.ts` (+ `.html`, `.scss`) - rewritten in place, same invocation (`UI_MANAGE_TAGS`, unchanged).

**Columns**: checkbox → name (`TextColumnFilter`) → usage count, i.e. number of torrents currently tagged with it, computed from `torrentStoreService.torrentsArray()` the same way the current delete-confirm count is computed (`NumberColumnFilter`).

**New Tag modal**: new component `packages/app/src/app/modals/tag-editor/tag-editor.ts` (+ `.html`), create-only (no edit mode - tags are never edited). Single text input; on save, splits on commas exactly like today's `ManageTags.add()` (`raw.split(',').map(s => s.trim()).filter(Boolean)`), calls `qbService.torrents.createTags(serverId, names)`, then emits `TAG_ADDED` with the created names.

**Actions:**

- **New** → opens Tag Editor modal.
- Footer shows **New** and **Delete** only - no Edit button (tags have nothing editable).
- **Delete** (enabled iff one or more selected) → `ConfirmService.confirm` with a count-aware message aggregating affected-torrent counts across all selected tags → one batched call `qbService.torrents.deleteTags(serverId, selectedNames)` (existing API already accepts an array) → emit `TAG_DELETED` with the deleted names.
- **Row double-click** → no-op.
- **Row right-click** → Delete only.
- **Header right-click** → shared header-context-menu service.

## Manage Categories grid

File: `packages/app/src/app/modals/manage-categories/manage-categories.ts` (+ `.html`, `.scss`) - rewritten in place, same invocation (`UI_MANAGE_CATEGORIES`, unchanged).

**Columns**: checkbox → name (`TextColumnFilter`, read-only - never editable, since qBittorrent doesn't support renaming a category) → save path (`TextColumnFilter`, **inline-editable** via a new custom ag-grid cell editor component, see below) → usage count, i.e. number of torrents currently in that category, computed the same way as today's delete-confirm count (`NumberColumnFilter`).

**Inline save-path cell editor**: new component `packages/app/src/app/components/column-editors/save-path-cell-editor/save-path-cell-editor.ts` (+ `.html`), implementing ag-grid-angular's cell editor interface and embedding the existing `SavePathSelect` component (`packages/app/src/app/components/save-path-select/save-path-select.ts`) bound to the row's current save path. On commit (selection/blur), calls `qbService.torrents.editCategory(serverId, name, newPath)`, then emits `CATEGORY_UPDATED`. Per the shared-infrastructure toast rule, a successful edit shows no toast (the cell already reflects the new value); a failed save shows an error toast and reverts the cell.

**New Category modal**: new component `packages/app/src/app/modals/category-editor/category-editor.ts` (+ `.html`), create-only. Name input + `SavePathSelect` dropdown; on save, calls `qbService.torrents.createCategory(serverId, name, savePath)`, then emits `CATEGORY_ADDED`.

**Actions:**

- **New** → opens Category Editor modal.
- **Edit** (enabled iff exactly one row selected) → starts inline cell-edit mode on that row's save-path cell (`api.startEditingCell({ rowIndex, colKey: 'savePath' })`) - no modal opens for editing.
- **Delete** (enabled iff one or more selected) → `ConfirmService.confirm` with a count-aware message aggregating affected-torrent counts across all selected categories → one batched call `qbService.torrents.removeCategories(serverId, selectedNames)` (existing API already accepts an array) → emit `CATEGORY_DELETED` with the deleted names.
- **Row double-click** → same as Edit: starts inline cell-edit on the save-path cell.
- **Row right-click** → Edit (start inline edit) / Delete.
- **Header right-click** → shared header-context-menu service.

## i18n

New UI strings - Tag Editor and Category Editor modal labels, new column headers, new context-menu entries, new toast titles/messages for tag/category add/delete/update - are added to both `packages/app/public/i18n/us.json` and `packages/app/public/i18n/hu.json`.

## Testing

New/changed components and services get colocated `.spec.ts` files following existing conventions in the repo. Coverage focus:

- Comma-separated tag creation splitting (Tag Editor)
- Batch-delete confirm message aggregation across multiple selected rows (all three grids)
- Active-server checkbox-disable logic and Delete-menu-entry omission (Manage Servers)
- Inline save-path cell editor commit and error/revert paths (Manage Categories)
- Footer button enable rules: New always enabled, Edit exactly-one-selected, Delete one-or-more-selected (all three grids, Tags excluded from Edit)
- Command-handler toast/refresh behavior for `TAG_*`/`CATEGORY_*`, including the no-toast-on-success rule for `CATEGORY_UPDATED`

ag-grid interaction itself (persistence across reopen, drag-reorder, live filtering, context menu rendering) is verified manually in the running app rather than unit-tested, consistent with how the main grid's equivalent behavior is verified today.

## Explicitly out of scope

- Row/header context menu entries beyond Edit/Delete (rows) and sort/pin/hide/autosize (header) - e.g. no export, duplicate, or other entries for now.
- Per-server (as opposed to global) grid layout persistence for Tags/Categories.
- A "# of torrents on this server" column for Manage Servers.
- Documentation site updates - per CLAUDE.md, planned separately once this feature stabilizes, around PR time.
