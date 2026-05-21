# Design Spec: Manage Tags & Categories - Round 2 Improvements

**Date:** 2026-05-21
**Branch:** 100-manage-labels-and-categories
**Issue:** #100

---

## Overview

Six targeted improvements to the existing `ManageTags` and `ManageCategories` modal components.

---

## 1. Comma-separated tag input (manage-tags only)

The qBittorrent API (`POST /api/v2/torrents/createTags`) uses a comma-separated `tags` form field to create multiple tags in one call. Because the comma is the API-level delimiter, individual tag names cannot contain commas. This makes comma-separated bulk input natural.

**Behavior:**

- The tag name input placeholder changes to hint the format (e.g., `linux, ubuntu, server`).
- On Add, the raw value is split by `,`, each segment is trimmed, and empty segments are discarded.
- All non-empty segments are passed to the existing `QbService.createTags()` which already accepts an array and joins with `,`.
- All new tags are merged into the local `tags` signal and re-sorted alphabetically.
- The input resets after a successful add.

Not applicable to categories - categories do not support batch creation.

---

## 2. Torrent count in delete confirm

Before showing the delete confirmation dialog for a tag or category, compute how many torrents are currently assigned to it using `TorrentStoreService.torrentsArray()`. No extra API call needed.

**Tag count:** count torrents where `t.tags.split(',').map(s => s.trim())` includes the tag name (exact match after trim).

**Category count:** count torrents where `t.category === categoryName`.

The count is passed as an additional `count` interpolation param to the existing confirm `data` object. Updated i18n messages:

| Key                                                          | Value                                                                                                  |
| ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------ |
| `components.modals.manage-tags.delete-confirm.message`       | `Are you sure you want to delete the tag "{{ name }}"? It is used by {{ count }} torrent(s).`          |
| `components.modals.manage-categories.delete-confirm.message` | `Are you sure you want to delete the category "{{ name }}"? It is assigned to {{ count }} torrent(s).` |

Hungarian translations updated accordingly in `hu.json`.

`TorrentStoreService` is injected into both components (it is `providedIn: 'root'`, no module changes needed).

---

## 3. Filter field

Both modals get a filter input on its own full-width row, between the add-form row and the list group. The filter row is hidden while the list is loading.

**Implementation:**

- Add a `filterControl = new FormControl('')` to each component.
- Add a `filteredTags` / `filteredCategories` computed signal that filters the full list case-insensitively by name substring.
- The `@for` loop iterates over the filtered computed signal instead of the raw signal.
- In manage-categories, an item currently in edit mode (`item.editing === true`) is always included in the filtered result to prevent the edit row disappearing mid-edit.
- The filter starts empty and resets naturally on modal close/reopen.

New i18n placeholder keys:

- `components.modals.manage-tags.filter.placeholder` = `Filter tags...`
- `components.modals.manage-categories.filter.placeholder` = `Filter categories...`

---

## 4. Max-height on list groups

Both list groups get a CSS cap so large lists scroll instead of growing the modal off-screen.

```scss
.list-group {
  max-height: 600px;
  overflow-y: auto;
}
```

Added to each component's SCSS file. 600px fits roughly 20 items before scrolling.

---

## 5. Vertically centered Add button

Both add-form rows use `align-items-end` on the flex container, which pins the button to the bottom of the form-floating inputs. Change to `align-items-center`.

Affected: the outer `div.d-flex` in `manage-tags.html` and `manage-categories.html`.

---

## 6. Edit-row button styles in manage-categories

The inline save/cancel row currently uses `btn-primary` for Save and `btn-secondary` for Cancel. Change to:

- **Save:** `btn-secondary btn-sm`
- **Cancel:** `btn-link btn-sm`

Applies only to the inline edit row, not the Add button at the top (which stays `btn-primary`).

---

## Files to change

| File                                                                              | Changes                                                                                                                                   |
| --------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/app/src/app/components/modals/manage-tags/manage-tags.html`             | Add filter row; update input placeholder; `align-items-end` → `align-items-center`                                                        |
| `packages/app/src/app/components/modals/manage-tags/manage-tags.ts`               | Add `filterControl`; add `filteredTags` computed; inject `TorrentStoreService`; update `add()` to split by comma; pass `count` to confirm |
| `packages/app/src/app/components/modals/manage-tags/manage-tags.scss`             | Add `max-height: 600px; overflow-y: auto` on `.list-group`                                                                                |
| `packages/app/src/app/components/modals/manage-categories/manage-categories.html` | Add filter row; `align-items-end` → `align-items-center`; Save → `btn-secondary`, Cancel → `btn-link`                                     |
| `packages/app/src/app/components/modals/manage-categories/manage-categories.ts`   | Add `filterControl`; add `filteredCategories` computed; inject `TorrentStoreService`; pass `count` to confirm                             |
| `packages/app/src/app/components/modals/manage-categories/manage-categories.scss` | Add `max-height: 600px; overflow-y: auto` on `.list-group`                                                                                |
| `public/i18n/us.json`                                                             | Update delete-confirm messages to include `{{ count }}`; add filter placeholder keys                                                      |
| `public/i18n/hu.json`                                                             | Same updates in Hungarian                                                                                                                 |

---

## Out of scope

- No changes to `ConfirmService` or the `Confirm` modal - the existing `data` interpolation param mechanism already supports passing `count`.
- No API changes.
- No changes to the Add button style (stays `btn-primary` in both components).
