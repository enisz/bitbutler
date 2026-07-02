# Context menu & torrent details footer: Manage group

Issue: #198

## Problem

The grid's right-click context menu and the Torrent Details modal footer both
group actions inconsistently:

- Per-torrent metadata edits (rename torrent, set category, set tags) live
  inside the "Files" group alongside pure filesystem actions (open
  destination, set location, set download path, rename files) in both
  places.
- "Export torrent file" is a top-level context menu item, disconnected from
  the "Files" group it conceptually belongs to, and doesn't exist in the
  modal footer at all.
- The modal footer's "Rename Files" button is broken: it emits
  `UI_RENAME_FILES`, which tries to reopen the Torrent Details modal via
  `ui-command-handler.service.ts`. Since that modal is already open (the
  button lives inside it), the handler's `isModalOpen(TorrentDetails)` guard
  silently blocks the action.

## Design

### New "Manage" group

A new "Manage" submenu (context menu) / dropdown group (modal footer) holds
per-torrent metadata edits: **Rename Torrent**, **Set/Change Category**,
**Set/Change Tags**. This mirrors the button bar's existing "Manage" group
in name and footer/context-menu position (immediately after "Files"), but
is conceptually distinct - the button bar's Manage group administers global
entities (servers, the tag/category master lists), while this one edits a
specific torrent's properties. To keep that distinction visible, the two
groups use different icons: the button bar keeps `faUserTie` (entity
administration), the new group uses `faSliders` (adjusting an item's
properties). Since `faSliders` is freed up by this split, the button bar's
Settings group moves from `faSliders` to `faGear` (the more universally
recognized settings glyph) to avoid a collision between the two "Manage"
concepts.

Context menu (`grid-context-menu.service.ts`, `buildTorrentMenu`), full
per-torrent menu shape after the change:

```
Start / Stop / Force Resume
---
Details                          (single selection only)
---
▸ Files
    Export Torrent File(s)
    Open Destination              (single selection only)
    Set Location
    Set Download Path
    Rename Files                  (single selection only)
▸ Manage                          (new — faSliders)
    Rename Torrent                (single selection only)
    Set Category
    Set Tags
▸ Queue
▸ Transfer
▸ Maintenance
▸ Copy
▸ Pin Row
---
Remove
```

Export moves from a standalone top-level item into "Files" as the _first_
child, so its position is stable regardless of whether Open Destination is
present (single vs. multi selection). Rename Files stays in the context
menu's Files group unchanged - it isn't affected by the modal-reopen bug
because the modal isn't already open when triggered from the grid.

Modal footer (`torrent-details.html`) dropdown group order becomes:
**Control → Files → Manage → Transfer → Maintenance**.

- **Files**: Export Torrent File (new), Open Destination (if resolvable),
  Set Location, Set Download Path.
- **Manage** (new): Rename Torrent, Change Category, Change Tags.
- Rename Files is removed from the footer entirely (see below) rather than
  fixed and relocated.
- Transfer / Maintenance are unchanged.

### Rename Files: remove from the footer

Rather than working around the modal-reopen guard, the footer drops the
Rename Files entry point entirely. The Content tab's file tree
(`bb-file-tree.ts`) already has its own edit-mode toggle, which remains the
only way to enter rename mode from within the modal. This avoids adding
tab-switching/signal-plumbing solely to route around a guard that only
exists because the action tries to reopen a modal it's already inside of.
The context menu's "Rename Files" entry (grid → opens the modal fresh) is
untouched and continues to work as today.

### Shared export logic

Today `GridContextMenuService` has private `exportTorrentFiles()` /
`describeExportError()` methods used only by the context menu. The footer
needs the identical behavior (call `window.bitbutler.export.saveTorrentFiles`,
toast on partial/total failure, parse `QbHttpError`-shaped errors) for a
single torrent. Rather than duplicate ~30 lines of business logic across
two services, this logic moves into a new `TorrentExportService`
(`packages/app/src/app/services/torrent-export.service.ts`,
`providedIn: 'root'`) with one method:

```ts
exportTorrentFiles(items: { hash: string; name: string }[]): Promise<void>
```

`GridContextMenuService` and `TorrentDetailsActionsService` both inject and
call it - the grid passes the full selection, the footer passes a single-item
array built from the currently open torrent.

## Data flow / error handling

No new state or command types. The Files/Manage split is a pure
reorganization of existing `ContextMenuEntry` trees and footer dropdown
markup; all existing command emissions (`UI_RENAME_TORRENT`,
`UI_SET_TORRENT_CATEGORY`, `UI_SET_TORRENT_TAGS`, `UI_SET_TORRENT_LOCATION`,
`UI_SET_DOWNLOAD_PATH`, `UI_RENAME_FILES` from the grid) keep their current
payloads and handlers. `TorrentExportService.exportTorrentFiles` keeps the
existing error-handling behavior verbatim (toast on partial failure via
`export-failed-count`, toast on thrown error via `describeExportError`),
just relocated.

## Testing

- `torrent-export.service.spec.ts` (new): success path, partial failure
  toast, thrown-error toast, `QbHttpError`-shaped error message parsing -
  migrated from the existing export tests in
  `grid-context-menu.service.spec.ts`.
- `grid-context-menu.service.spec.ts`: update menu-shape assertions for the
  new Files ordering and Manage submenu; replace the existing export-behavior
  tests with a thin assertion that the Files export item delegates to
  `TorrentExportService`.
- `torrent-details-actions.service.spec.ts`: remove the `renameFiles()` test
  (method is deleted), add a test for the new `exportTorrentFile()` method.
- `torrent-details.spec.ts` / footer template: update for the Manage
  dropdown and the removed Rename Files button, if any existing tests assert
  on footer structure.
- `button-bar.spec.ts`: update if it asserts on the Settings group's icon.

## Out of scope

- Fixing `UI_RENAME_FILES`'s modal-reopen guard in
  `ui-command-handler.service.ts` - sidestepped by removing the only broken
  call site (the footer). The grid's context-menu call site already works
  and is unaffected.
- Any change to the underlying `UI_SET_TORRENT_CATEGORY` /
  `UI_SET_TORRENT_TAGS` / `UI_RENAME_TORRENT` command handlers or the modals
  they open.
