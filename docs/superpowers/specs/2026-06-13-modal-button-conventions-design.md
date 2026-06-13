# Modal button conventions

## Goal

Standardize action button styling across all modals using a consistent three-tier
convention, leveraging the new `btn-dashed-<color>` variant (already defined in
`_theme-utils.scss` via `bb-install-button-variants` for all installed colors:
primary, secondary, success, danger, warning, info, light, dark).

## Convention

- **Primary submit action** (Save / Add / Update / Connect / Import / Export) ->
  `btn-primary`
- **Close / Cancel** -> `btn-link` (already correct in most modals)
- **Extra / secondary actions** (not the main submit, not close/cancel) ->
  `btn-dashed-<color>`. Default to `btn-dashed-secondary` for neutral extras
  (e.g. "Open Details", "View on GitHub"); use a semantic color where the action
  already carries one (e.g. `btn-dashed-danger` for "Clear All").
- **Single-purpose destructive confirmations** (confirm.html OK, delete-torrent
  Delete) -> unchanged `btn-danger`. These are the sole primary action of the
  modal, not an "extra" action, and the red signal is intentional.

## Scope

Applies to each modal's footer action row (or footer-equivalent bottom action row,
as in about.html). Inline body buttons (quick-add tag/category, file Browse,
icon-only row actions in lists/tabs) are out of scope and stay unchanged.

## File-by-file changes

| Modal                     | Button                   | Current -> New                                                            |
| ------------------------- | ------------------------ | ------------------------------------------------------------------------- |
| manage-tags.html          | Close                    | `btn-secondary` -> `btn-link`                                             |
| manage-categories.html    | Close                    | `btn-secondary` -> `btn-link`                                             |
| torrent-exists.html       | Open Details             | `btn-secondary` -> `btn-dashed-secondary`                                 |
| server-editor.html        | Save/Update              | `btn-secondary` -> `btn-primary`                                          |
| set-torrent-category.html | Save                     | `btn-secondary` -> `btn-primary`                                          |
| set-torrent-location.html | Save                     | `btn-secondary` -> `btn-primary`                                          |
| set-torrent-tags.html     | Save                     | `btn-secondary` -> `btn-primary`                                          |
| manage-servers.html       | Add Server               | `btn-outline-primary` -> `btn-primary`                                    |
| manage-servers.html       | Close                    | `btn-secondary` -> `btn-link`                                             |
| update-available.html     | View on GitHub           | `btn-secondary` -> `btn-dashed-secondary`                                 |
| transfer-limit.html       | Save                     | `btn-secondary` -> `btn-primary`                                          |
| transfer-limit.html       | Clear All                | `btn-link text-danger` -> `btn-dashed-danger`                             |
| share-limit.html          | Save                     | `btn-secondary` -> `btn-primary`                                          |
| share-limit.html          | Clear All                | `btn-link text-danger` -> `btn-dashed-danger`                             |
| import-torrents.html      | Import (ready state)     | `btn-secondary` -> `btn-primary`                                          |
| import-torrents.html      | Cancel (running state)   | `btn-secondary` -> `btn-link`                                             |
| import-torrents.html      | Close (done/error state) | `btn-secondary` -> `btn-link`                                             |
| export-torrents.html      | Export (idle state)      | `btn-secondary` -> `btn-primary`                                          |
| export-torrents.html      | Cancel (running state)   | `btn-secondary` -> `btn-link`                                             |
| export-torrents.html      | Close (done/error state) | `btn-secondary` -> `btn-link`                                             |
| credential-prompt.html    | Connect                  | `btn-secondary` -> `btn-primary`                                          |
| about.html                | Close                    | `btn-secondary px-4` -> `btn-link px-4`                                   |
| about.html                | GitHub links (x2)        | `btn-sm btn-outline-secondary px-3` -> `btn-sm btn-dashed-secondary px-3` |
| add-torrent.html          | Add                      | `btn-secondary` -> `btn-primary`                                          |

**No change**: confirm.html, delete-torrent.html (destructive `btn-danger` primary
action, per decision above), rename-torrent.html (Save already `btn-primary`),
torrent-details.html (Close already `btn-link`).

## Out of scope

- Inline body buttons: quick-add tag/category inputs (`btn-outline-primary`),
  file/dest "Browse" buttons, icon-only row actions in lists and torrent-details
  tabs (e.g. copy/edit/delete icons), "Show in folder" in export-torrents progress
  view.
- New SCSS/theme work - `btn-dashed-*` variants already exist for all installed
  colors.

## Testing

No unit test changes expected (these are template class attribute changes only).
Manually verify each modal visually in the running app across at least one light
and one dark theme.
