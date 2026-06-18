# TorrentExists Modal Improvements

## Context

The `TorrentExists` modal appears when a `.torrent` file is added that is already in the qBittorrent list. This happens in two paths:

1. **During file load** (`loadDraft()`) - the duplicate is detected before the form loads; the draft is consumed immediately.
2. **On 409 error** (`handleSubmit()`) - qBittorrent rejects the add; the draft is consumed in the catch block.

Two bugs exist in the current implementation:

- The source `.torrent` file on disk is **never deleted** in either path, even when the user has "Delete torrent file after add" enabled. The delete only happens in the happy path.
- Clicking "Open Details" selects the grid row via `selectionStoreService.setByHashes`, but the grid viewport is **not scrolled** to show the selected row if it is off-screen.

---

## Part 1 - Delete Torrent File Button

### What changes

**`torrent-exists.ts`**

- Add `originalPath = input<string | null>(null)` signal input.
- Inject `GeneralSettingsService`; expose its settings as a signal via `toSignal(this.generalSettingsService.asObservable())`.
- Add `showDeleteButton = computed(() => !!(this.generalSettings()?.behavior.deleteTorrentFile && this.originalPath()))`.
- Add `deleteTorrentFile()` async method: call `window.bitbutler.torrent.deleteFile({ path: this.originalPath()! })` then `this.closeModal()`.

**`torrent-exists.html`**

- Add a `btn btn-danger` button in the modal footer, to the left of "Open Details", shown with `@if (showDeleteButton())`.
- Label: `{{ 'components.modals.torrent-exists.button.delete-file' | translate }}`.

**`add-torrent.ts`** - two call sites that open `TorrentExists`:

- `loadDraft()` (around line 492): pass `setModalInput(modalRef, 'originalPath', draft.originalPath ?? null)`.
- `handleSubmit()` 409 handler (around line 375): pass `setModalInput(modalRef, 'originalPath', this.effectiveDraft()?.originalPath ?? null)`.

**i18n - `public/i18n/us.json`**
Add under `components.modals.torrent-exists`:

```json
"button": {
  "delete-file": "Delete Torrent File"
}
```

**i18n - `public/i18n/hu.json`**

```json
"button": {
  "delete-file": "Torrent fájl törlése"
}
```

### Behavior

- Button is hidden when `originalPath` is null/undefined (magnet links, already-deleted files).
- Button is hidden when `deleteTorrentFile` setting is `false`.
- Clicking it deletes the file silently and closes the modal - no confirmation prompt (matches the existing happy-path behavior).

---

## Part 2 - Scroll Grid Row Into View

### What changes

**`command.model.ts`**
Add to the `UiCommand` union:

```ts
| { type: 'UI_SCROLL_TO_TORRENT'; hash: string }
```

**`grid.ts`**
In the constructor, subscribe to `commandBusService.commands$` (using `takeUntilDestroyed`) filtering for `UI_SCROLL_TO_TORRENT`. On receipt:

```ts
const rowNode = this.api?.getRowNode(hash);
if (rowNode?.rowIndex != null) {
  this.api!.ensureIndexVisible(rowNode.rowIndex, 'middle');
}
```

**`torrent-exists.ts` - `openDetails()`**
Emit `UI_SCROLL_TO_TORRENT` before `UI_OPEN_TORRENT_DETAILS`:

```ts
public openDetails(): void {
  const h = this.hash();
  if (h) {
    this.commandBusService.emit({ type: 'UI_SCROLL_TO_TORRENT', hash: h });
    this.commandBusService.emit({ type: 'UI_OPEN_TORRENT_DETAILS', hash: h });
  }
  this.closeModal();
}
```

---

## Files to Modify

| File                                                                        | Change                                                                                                            |
| --------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `packages/app/src/app/models/command.model.ts`                              | Add `UI_SCROLL_TO_TORRENT` to `UiCommand`                                                                         |
| `packages/app/src/app/components/modals/torrent-exists/torrent-exists.ts`   | `originalPath` input, settings signal, computed button visibility, `deleteTorrentFile()`, updated `openDetails()` |
| `packages/app/src/app/components/modals/torrent-exists/torrent-exists.html` | Delete button in footer                                                                                           |
| `packages/app/src/app/components/add-torrent/add-torrent.ts`                | Pass `originalPath` at both modal open sites                                                                      |
| `packages/app/src/app/pages/main/grid/grid.ts`                              | Subscribe to `UI_SCROLL_TO_TORRENT`, call `ensureIndexVisible`                                                    |
| `public/i18n/us.json`                                                       | Add `button.delete-file` key                                                                                      |
| `public/i18n/hu.json`                                                       | Add `button.delete-file` key                                                                                      |

---

## Verification

1. Open app, add a torrent that is already in the list → `TorrentExists` modal appears.
2. If `deleteTorrentFile` is enabled and the file has an `originalPath`, the "Delete Torrent File" danger button should appear.
3. Clicking it should delete the file from disk and close the modal.
4. Disabling `deleteTorrentFile` in settings → button should not appear.
5. Click "Open Details" on a torrent whose row is off-screen → modal closes, grid scrolls to center the row, TorrentDetails modal opens.
6. Click "Open Details" on a torrent already visible → behavior unchanged.
