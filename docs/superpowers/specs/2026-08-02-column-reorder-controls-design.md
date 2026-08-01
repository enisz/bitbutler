# Column reorder controls for the torrent list grid settings tab

## Problem

The "Columns" section of the torrent-list-grid settings tab (`packages/app/src/app/modals/settings/torrent-list-grid/`) lets a user pick which of the ~76 available columns are visible (via a searchable multi-select `ng-select`) and reorder the visible ones (via a CDK drag list). Reordering is drag-only. With enough visible columns, moving an item a long distance (e.g. position 20 to position 2) inside the small, independently-scrolling `.column-reorder-container` is tedious - drag auto-scroll is imprecise and it can take several small drags to cover the distance.

Removing a column from view also requires leaving the ordered list and going back to the `ng-select` picker to deselect it there - there's no way to remove an item directly from the ordered list.

This is distinct from the recently redone status-bar settings tab (`packages/app/src/app/modals/settings/status-bar/`), which solved a similar-looking problem (arrange a set of items into an order) with a pool-to-placement drag model. That model fits status-bar's scale (~13 widgets) but doesn't fit here (~76 columns) and, more importantly, doesn't solve the actual complaint: it's still plain drag-and-drop for ordering, so the long-distance-reorder pain would remain.

## Goals

- Make reordering many visible columns inside the modal fast, without relying on long drags across a scrolling container.
- Let a column be removed directly from the ordered list, without needing to reopen the picker.
- Keep the existing searchable `ng-select` picker as-is - it already handles browsing/selecting from ~76 columns well via type-ahead search, and wasn't the reported pain point.
- Minimal structural change: augment the existing ordered list and its backing signal/form, rather than rearchitecting the tab.

## Non-goals

- Reworking the column picker (`ng-select`) side.
- Adopting the status-bar's pool/drag-in-drag-out visual model - rejected because it doesn't address the reorder-distance problem and a 76-item pill pool is unwieldy even with search.
- Keyboard support for the CDK drag gesture itself - the new move buttons serve as the accessible alternative to dragging (drag was never keyboard-operable here, before or after this change).

## Design

### Row layout

Each row in the ordered/visible-columns list (`.column-drag-item`) keeps its existing drag handle and label, and gains a right-aligned row of plain icon buttons (`btn btn-sm btn-link`, not the split icon+text style used elsewhere in this app):

```
[≡] Name                              [⇈] [↑] [↓] [⇊] [×]
```

- `↑` / `↓` - move one step up/down.
- `⇈` / `⇊` - jump straight to top/bottom (the fix for the long-distance drag pain).
- `×` - remove from the visible list directly; styled in red (`text-danger`) to signal a destructive/removal action, distinct from the other neutral move buttons.
- Each move button is `disabled` (not hidden) at the relevant boundary: `↑`/`⇈` disabled on the first row, `↓`/`⇊` disabled on the last row.
- The action group fades in on row hover/focus, matching the existing `.drag-handle` opacity treatment in this file (`opacity: 0.6` idle, `1` on hover, `0.15s ease` transition) - this keeps a long list visually calm while scanning names. The buttons remain real, always-focusable `<button>` elements; only their visual prominence changes, so keyboard/screen-reader users are unaffected by the fade.
- Icons: FontAwesome `faAnglesUp` / `faAnglesDown` (to-top/to-bottom), `faChevronUp` / `faChevronDown` (single step), `faXmark` (remove) - all already used elsewhere in the app's icon set.
- Each button gets a translated `aria-label` (new i18n keys under `pages.settings.tab.torrent-list-grid.torrent-list-grid-form.column-actions.*` for `move-to-top`, `move-up`, `move-down`, `move-to-bottom`, `remove`).

### Sizing

`.column-reorder-container`'s `max-height` increases from the current `400px` to `min(520px, 55vh)`, so more rows are visible at once without needing the container to auto-scroll during a drag. The `55vh` cap keeps it well-behaved on shorter viewports.

### Component changes (`torrent-list-grid.ts`)

All changes are additive to the existing `TorrentListGrid` component; no new components.

- `moveUp(index: number)`, `moveDown(index: number)`, `moveToTop(index: number)`, `moveToBottom(index: number)`: each copies the current `orderedColumns()` array, repositions the item at `index`, calls `orderedColumns.set(...)`, and calls `stateService.markDirty('torrent-list-grid', true)` - the same pattern the existing `drop()` handler already follows. These only ever reorder; they never change which columns are selected, so the `columns` FormControl is untouched.
  - `moveUp`/`moveToTop` are no-ops when `index === 0`.
  - `moveDown`/`moveToBottom` are no-ops when `index === orderedColumns().length - 1`.
- `remove(colId: string)`: patches the `columns` FormControl's value to the current id array with `colId` filtered out (`{ emitEvent: true }`, the default). This reuses the existing `columns.valueChanges` subscription (already in the constructor) that recomputes `orderedColumns` from the new id list - so `remove` does not duplicate that filtering/sync logic, and the `ng-select` pool on the right automatically re-offers the removed column as available (it's driven by the same FormControl), with no risk of `orderedColumns` and the form drifting apart.

### Template changes (`torrent-list-grid.html`)

Inside the `@for (column of orderedColumns(); ...)` loop, after the existing drag handle and label, add the five-button action group described above, each bound to `(click)` on the corresponding component method and `[disabled]` on the boundary condition, using `$index` for the row position.

### Testing

Add to `torrent-list-grid.spec.ts`:

- `moveUp` / `moveDown` / `moveToTop` / `moveToBottom` reorder `orderedColumns` correctly for a middle item, and are no-ops (array unchanged) at the respective boundary.
- `remove` shrinks `orderedColumns` by the removed item and updates the `columns` FormControl's value to no longer include that id (verifying the picker-side sync).

### Edge cases

- Removing down to zero visible columns is allowed - matches today's behavior when deselecting the last column via the picker. The existing `@empty` placeholder in the template already covers this state.
- A single visible column: all four move buttons disabled, only remove enabled.
