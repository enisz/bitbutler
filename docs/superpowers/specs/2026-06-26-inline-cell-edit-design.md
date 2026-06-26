# Inline Cell Edit - Design Spec

Date: 2026-06-26

## Overview

Add an "Inline Edit" option to the torrent list grid's row double-click behavior setting. When active, eligible grid cells become editable in-place using AG Grid's native cell editing. Saving a value calls the corresponding qBittorrent API endpoint. Polling is paused while a cell is being edited.

---

## Section 1 - Model, Settings UI, and i18n

### Model

`RowDoubleClickAction` in `packages/app/src/app/models/torrent-list-grid.model.ts` adds a fourth union member:

```typescript
export type RowDoubleClickAction = 'SAVE_PATH' | 'DETAILS' | 'NONE' | 'INLINE_EDIT';
```

### Settings UI

`torrent-list-grid.html` dropdown gains a fourth item:

```html
{ value: 'INLINE_EDIT', label: '...' | translate }
```

The `<ng-template #doubleClickBehavior>` popover gains a fourth `<li>` explaining that Inline Edit makes eligible cells editable directly in the grid - double-click a cell to edit, Enter to confirm, Escape to cancel. Only columns with a direct qBittorrent API endpoint and no value formatter are editable.

### i18n

New keys added to `public/i18n/us.json` and `public/i18n/hu.json`:

- `pages.settings.tab.torrent-list-grid.torrent-list-grid-form.row-double-click.value.inline-edit` - dropdown label
- `pages.settings.tab.torrent-list-grid.popover.double-click-behavior.list-item-4` - popover list item

---

## Section 2 - qb.service additions

Four new methods added to the `torrents` namespace in `packages/app/src/app/services/qb.service.ts`, all following the existing structure (clean hash list, `this.request`, throw `HttpError` on failure):

| Method                                         | Endpoint                                         | Notes                                                           |
| ---------------------------------------------- | ------------------------------------------------ | --------------------------------------------------------------- |
| `setDownloadPath(serverId, hashes[], path)`    | `POST /api/v2/torrents/setDownloadPath`          | form: `hashes` (pipe-separated), `path`                         |
| `toggleSequentialDownload(serverId, hashes[])` | `POST /api/v2/torrents/toggleSequentialDownload` | form: `hashes` (pipe-separated)                                 |
| `toggleFirstLastPiecePrio(serverId, hashes[])` | `POST /api/v2/torrents/toggleFirstLastPiecePrio` | form: `hashes` (pipe-separated)                                 |
| `removeAllTags(serverId, hashes[])`            | `POST /api/v2/torrents/removeTags`               | no `tags` field - qBittorrent removes all tags for those hashes |

Note: the existing `removeTags` method guards against an empty tags array and returns early, so `removeAllTags` is a separate method that omits the `tags` form field entirely.

---

## Section 3 - GridInlineEditService

New service at `packages/app/src/app/pages/main/grid/grid-inline-edit.service.ts`. Scoped to the `Grid` component (listed in `Grid`'s `providers` array, not `providedIn: 'root'`).

### Editable columns

A constant `Set<string>` of colIds eligible for inline editing:

```typescript
const INLINE_EDITABLE_COL_IDS = new Set([
  // text
  'name',
  'save_path',
  'download_path',
  'category',
  'tags',
  // numeric (raw, no formatter)
  'dl_limit_raw',
  'up_limit_raw',
  'seeding_time_limit_raw',
  'inactive_seeding_time_limit_raw',
  // boolean (checkbox renderer)
  'auto_tmm',
  'seq_dl',
  'force_start',
  'super_seeding',
  'f_l_piece_prio',
]);
```

### `applyEditableState(api: GridApi, isInlineEdit: boolean): void`

Called from `Grid.applyGridSettings` whenever settings are applied. Iterates the current column defs and updates the `editable` property:

- If `isInlineEdit` and colId is in `INLINE_EDITABLE_COL_IDS`: set `editable: true`
- Otherwise: remove `editable` for text/numeric columns; restore `editable: false` for boolean columns (which originally have it explicitly set)

Boolean colIds that need `editable: false` restored: `auto_tmm`, `seq_dl`, `force_start`, `super_seeding`, `f_l_piece_prio`.

After updating defs, calls `api.updateGridOptions({ columnDefs: newDefs })`.

### `handleCellValueChanged(event: CellValueChangedEvent<Torrent>, serverId: string): Promise<void>`

Dispatch table mapping colId to API call:

| colId                             | API call                                                                                                                                                         |
| --------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `name`                            | `qb.torrents.rename(serverId, hash, newValue)`                                                                                                                   |
| `save_path`                       | `qb.torrents.setLocation(serverId, [hash], newValue)`                                                                                                            |
| `download_path`                   | `qb.torrents.setDownloadPath(serverId, [hash], newValue)`                                                                                                        |
| `category`                        | `qb.torrents.setCategory(serverId, [hash], newValue ?? '')`                                                                                                      |
| `tags`                            | `qb.torrents.removeAllTags(serverId, [hash])` then if non-empty: `qb.torrents.addTags(serverId, [hash], newValue.split(',').map(t => t.trim()).filter(Boolean))` |
| `dl_limit_raw`                    | `qb.torrents.setDownloadLimit(serverId, Number(newValue), [hash])`                                                                                               |
| `up_limit_raw`                    | `qb.torrents.setUploadLimit(serverId, Number(newValue), [hash])`                                                                                                 |
| `seeding_time_limit_raw`          | `qb.torrents.setShareLimits(serverId, [hash], rowData.ratio_limit, Number(newValue), rowData.inactive_seeding_time_limit)`                                       |
| `inactive_seeding_time_limit_raw` | `qb.torrents.setShareLimits(serverId, [hash], rowData.ratio_limit, rowData.seeding_time_limit, Number(newValue))`                                                |
| `seq_dl`                          | `qb.torrents.toggleSequentialDownload(serverId, [hash])`                                                                                                         |
| `force_start`                     | `qb.torrents.setForceStart(serverId, [hash], Boolean(newValue))`                                                                                                 |
| `super_seeding`                   | `qb.torrents.setSuperSeeding(serverId, [hash], Boolean(newValue))`                                                                                               |
| `auto_tmm`                        | `qb.torrents.setAutoManagement(serverId, [hash], Boolean(newValue))`                                                                                             |
| `f_l_piece_prio`                  | `qb.torrents.toggleFirstLastPiecePrio(serverId, [hash])`                                                                                                         |

**Error handling:** catch block calls `toastService.danger(errorMessage, 'Edit Failed')` (following the existing toast title conventions). On success: no toast - the result becomes visible once polling resumes.

**`hash` and `rowData`** come from `event.data` (the `Torrent` object on the row node).

---

## Section 4 - Grid integration

### Polling pause/resume

`Grid` injects `QbPollingService`. Two new handlers wired in `getGridOptions` via `opts`:

- `onCellEditingStarted` → `pollingService.pause()`
- `onCellEditingStopped` → `pollingService.resume()`

These use the same polling pause/resume mechanism already used by the modal system.

### `handleRowDoubleClick` early return

In `grid.ts`, `handleRowDoubleClick` reads `settings.rowDoubleClickAction`. When it equals `'INLINE_EDIT'`, return immediately - AG Grid's own cell editing handles the double-click interaction.

### `applyGridSettings` extension

After the existing `floatingFilters` block, add:

```typescript
gridInlineEditService.applyEditableState(this.api, settings.rowDoubleClickAction === 'INLINE_EDIT');
```

### `getGridOptions` extension

`grid.lib.ts` adds `onCellValueChanged` to the returned `GridOptions` object, wired to `opts.handleCellValueChanged`. The `opts` type gains:

```typescript
handleCellValueChanged: (e: CellValueChangedEvent<Torrent>) => void;
```

---

## Files to create

- `packages/app/src/app/pages/main/grid/grid-inline-edit.service.ts`

## Files to modify

- `packages/app/src/app/models/torrent-list-grid.model.ts` - add `'INLINE_EDIT'` to union
- `packages/app/src/app/services/qb.service.ts` - add 4 new methods
- `packages/app/src/app/pages/main/grid/grid.lib.ts` - add `onCellValueChanged` to options
- `packages/app/src/app/pages/main/grid/grid.ts` - inject service, wire polling, extend `applyGridSettings` and `handleRowDoubleClick`
- `packages/app/src/app/pages/settings/torrent-list-grid/torrent-list-grid.html` - add dropdown item and popover list item
- `public/i18n/us.json` - add new translation keys
- `public/i18n/hu.json` - add new translation keys
