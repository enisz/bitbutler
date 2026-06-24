# Torrent-Exists Modal Footer Redesign

## Problem

The `TorrentExists` modal footer (`packages/app/src/app/components/modals/torrent-exists/torrent-exists.html`) renders up to three split-style buttons (icon + text via `bb-btn-content`): a conditional "Delete Torrent File" (danger), "Open Details", and "Close". At the default ng-bootstrap modal width, longer translations (e.g. Hungarian: "Torrent fájl törlése", "Részletek megnyitása") overflow the available footer width and wrap onto a second row.

The current workaround, applied directly in `packages/app/src/app/components/add-torrent/add-torrent.ts` (both call sites that open `TorrentExists`), bumps the modal to `size: 'lg'`. This sidesteps the layout problem instead of fixing it, and permanently widens a modal whose content doesn't otherwise need the extra width.

## Goal

Redesign the footer so all three buttons fit on a single row at the **default** modal size, regardless of translation length, then remove the `size: 'lg'` workaround.

## Design

### Footer markup (`torrent-exists.html`)

The "Delete Torrent File" button is the longest label and the only conditional one. It becomes icon-only:

- Remove the `bb-btn-content` (icon+text) usage; render `<fa-icon [icon]="icons.faTrashCan">` directly inside the `<button>`.
- Add `[ngbTooltip]` and `[attr.aria-label]`, both bound to the existing `components.modals.torrent-exists.button.delete-file` translation key (reused as-is, not duplicated), so the label remains available on hover and to screen readers.
- Replace the `btn-split` class with `me-auto` (Bootstrap utility). The modal footer is `display:flex; justify-content:flex-end` (confirmed in `node_modules/bootstrap/scss/_modal.scss`); `me-auto` on the first child consumes the remaining space, pinning the Delete button to the left while "Open Details" and "Close" stay grouped on the right. When the Delete button isn't rendered (setting disabled or no `originalPath`), the other two buttons fall back to the existing right-aligned (`flex-end`) layout - no regression.
- Keep `btn btn-danger btn-sm`, `[disabled]="fileDeleted()"`, and `(click)="deleteTorrentFile()"` unchanged.

"Open Details" and "Close" are unchanged - they keep their full icon+text `btn-split` styling.

No new CSS is introduced; this relies on the existing `.btn-split` styles (still used by "Open Details" and "Close"; no longer applied to Delete), the existing `ngbTooltip` directive already used elsewhere in this same template (the hash and save-path tooltips), and Bootstrap's built-in `me-auto` utility.

### Modal size revert (`add-torrent.ts`)

Both call sites that open `TorrentExists` (line 380 and line 499) currently pass `{ centered: true, size: 'lg' }`. Revert to `{ centered: true }` now that the footer fits at the default width.

## Testing

- `torrent-exists.spec.ts` currently only exercises component logic (`deleteTorrentFile()`, `showDeleteButton`), never rendering the footer DOM. New tests are added to render the footer (via a `torrentsMap` entry and `hash`/`originalPath` inputs) and assert the delete button is icon-only, has an `aria-label`, and carries `me-auto` instead of `btn-split`.
- `add-torrent.spec.ts` (lines ~651 and ~851) already asserts `modalService.open` was called with `{ centered: true }` (no `size`). Reverting the size bump brings the source back in line with these existing expectations - no spec changes needed there.
- Manual verification: open the modal with the Hungarian locale active, with and without the delete-file setting enabled, and confirm the footer renders on a single row at the default modal width.

## Out of scope

- No change to `deleteTorrentFile()` behavior (it still deletes immediately on click; no added confirmation step).
- No new reusable "icon-only button" component/class - this is the only place in the codebase using this pattern today, so no abstraction is introduced.
