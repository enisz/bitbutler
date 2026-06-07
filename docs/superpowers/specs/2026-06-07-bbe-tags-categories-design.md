# BBE Tags, Categories & TMM Settings Design Spec

**Date:** 2026-06-07
**Status:** Approved

## Overview

Extend the BBE export/import pipeline ([2026-06-05-bbe-export-import-design.md](2026-06-05-bbe-export-import-design.md)) to back up and restore qBittorrent **tags** and **categories**, and add the related "Save Management" preferences to BitButler's qBittorrent settings UI.

### Problem being solved

When a torrent is imported with a category that does not yet exist on the target server, qBittorrent auto-creates that category with an **empty save path**. If the user later edits the category to set a real path, and qBittorrent's "When Category Save Path changed" preference (`category_changed_tmm_enabled`) is set to "Switch to Manual mode", every torrent in that category has Auto TMM silently disabled.

This feature lets users restore categories with their original save paths directly at import time (with path remapping support, mirroring save path mapping), and surfaces the relevant TMM preferences in the app so users understand the consequences.

---

## Part 1: Export changes

### `BbeMetadata` additions

Two new **optional** fields are added to `BbeMetadata` (`packages/shared/src/ipc.types.ts`):

```typescript
interface BbeMetadata {
  // ...existing fields...
  categories?: Record<string, { name: string; savePath: string }>;
  tags?: string[];
}
```

They are optional so that archives created before this feature (where the keys are absent from `metadata.json`) remain valid and importable. New exports always populate both fields - even with empty values (`[]` / `{}`) - because the export pipeline always calls `getAllCategories()` / `getAllTags()` on the source server.

**Distinguishing old vs. new archives:** check `metadata.tags !== undefined` / `metadata.categories !== undefined`. An old archive has no such key in its parsed JSON (so the value is `undefined`); a new archive always has the key, even if the collection is empty. This is the same optional-field convention already used for `source_server_name?`.

### Export pipeline change

In `packages/electron/src/ipc/export.ts`, after building torrent entries, the export step additionally calls `getAllCategories(serverId)` and `getAllTags(serverId)` and attaches the results to `metadata`. No export UI changes are required - this data is collected automatically on every export.

---

## Part 2: qBittorrent Settings - Storage tab

A new **"Save Management"** fieldset is added to `packages/app/src/app/pages/qb-settings/storage/` (below the existing "Default Paths", "Temp Files", "File Management" fieldsets), containing four `ng-select` dropdowns - matching the existing dropdown pattern used for `torrent_content_layout`. Each offers two options, "Relocate torrents" and "Switch to Manual mode" (the `auto_tmm_enabled` field instead offers "Automatic" / "Manual"):

| Form control                    | Preference key                  | Label (UI)                      |
| ------------------------------- | ------------------------------- | ------------------------------- |
| `auto_tmm_enabled`              | `auto_tmm_enabled`              | Default torrent management mode |
| `torrent_changed_tmm_enabled`   | `torrent_changed_tmm_enabled`   | When torrent category changed   |
| `category_changed_tmm_enabled`  | `category_changed_tmm_enabled`  | When category save path changed |
| `save_path_changed_tmm_enabled` | `save_path_changed_tmm_enabled` | When default save path changed  |

These are read via the existing `getAppPreferences()` call (already fetches the full `QbAppPreferences` object) and written via the existing `setAppPreferences()` flow - the Storage tab's `save()` method is extended to include these four keys alongside the fields it already manages. The `QbSettingsStateService` dirty-tracking pattern requires no changes; the new controls participate in the existing Storage form group.

---

## Part 3: IPC contract changes

`ImportStartPayload` (`packages/shared/src/ipc.types.ts`) gets four new fields:

```typescript
interface ImportStartPayload {
  // ...existing fields...
  restoreCategories: boolean;
  restoreTags: boolean;
  categoryPathMappings: BbePathMapping[];
  overwriteCategories: boolean;
}
```

`ImportRestoreField` drops the combined `'category_tags'` key and gains two separate keys: `'categories'` and `'tags'` (both default to `true`, matching the current default for `category_tags`).

The existing `applyPathMappings()` utility (`packages/electron/src/ipc/export.ts`) is reused as-is for `categoryPathMappings` - no new mapping function is needed; it operates on plain `{ from, to }` pairs regardless of whether the path is a save path or a category path.

---

## Part 4: Import pipeline changes

The current pipeline (add torrents → wait for confirmation → post-process) gains a **Step 0** that runs before torrents are added:

### Step 0 - Restore tags and categories

1. **Tags** (only if `restoreTags` is true): call `createTags()` once with the full list of tags from `metadata.tags`. qBittorrent silently ignores tags that already exist, so no existence check is needed.

2. **Categories** (only if `restoreCategories` is true): for each `{ name, savePath }` entry in `metadata.categories`:
   - Apply `applyPathMappings(savePath, categoryPathMappings)` to compute the target path.
   - If the category does **not** exist on the target server: `addCategory(name, mappedPath)`.
   - If it **exists** and `overwriteCategories` is true: `editCategory(name, mappedPath)` - this updates the save path via qBittorrent's edit endpoint **without** removing the category from torrents currently assigned to it (unlike a delete+recreate, which would silently orphan every non-imported torrent in that category).
   - If it **exists** and `overwriteCategories` is false: skip - existing category is left untouched.

Running this step before torrents are added guarantees qBittorrent never auto-creates a category with an empty path during this import - the category already exists with the correct (possibly remapped) path by the time any torrent references it.

When `restoreCategories` is false, category data is ignored completely for this import: no categories are created/edited, and no per-torrent `category` assignment happens (so qBittorrent does not auto-create categories with empty paths as a side effect). The same "all or nothing" logic applies to `restoreTags` and per-torrent `tags` assignment.

**Note on `editCategory` and TMM:** even with `editCategory`, changing a category's save path can still trigger qBittorrent's `category_changed_tmm_enabled` behavior on every torrent currently assigned to that category (not just imported ones) if it is set to "Switch to Manual mode". This is surfaced to the user via the informational note described in Part 5 - it cannot be avoided by BitButler, only explained.

---

## Part 5: Import component UI changes

### Archive fieldset

Two new read-only count rows are added below the existing "Torrents" row:

- **Tags**: `metadata.tags?.length`
- **Categories**: `Object.keys(metadata.categories ?? {}).length`

Each row is hidden when its corresponding metadata field is `undefined` (archive predates this feature). When the field is present - even as an empty collection - the row is shown with its count, including `0`.

### Restore fieldset

The single `'category_tags'` toggle is replaced by two independent toggles:

- **Categories** → controls `restoreCategories`
- **Tags** → controls `restoreTags`

Both default to `true`, mirroring the current default. Disabling "Categories" hides the new category path mapping fieldset (see below); disabling either toggle suppresses both the corresponding restore step (Part 4, Step 0) and the per-torrent assignment during `addTorrent()`.

### Category path mapping fieldset (new)

Placed directly below the existing "Save path mapping" fieldset. Visible only when the Categories restore toggle is on. Layout, top to bottom:

1. **Informational note** (styled like a callout, not an input): explains that if qBittorrent's "When Category Save Path changed" preference is set to "Switch to Manual mode", changing a category's path disables Auto TMM on torrents assigned to it. Includes an inline link, "qBittorrent Settings → Storage", which opens the qBittorrent settings modal stacked on top of the import modal (existing modal-stacking behavior is reused, no new mechanism).
2. **"Overwrite existing categories" toggle**, with an `(i)` popover reading: _"Updates the save path of existing categories using qBittorrent's edit endpoint. This preserves existing torrent assignments but may trigger Auto TMM behavior depending on your 'When Category Save Path changed' setting."_ Defaults to `false` (off) - the safer, non-mutating choice.
3. **Path mapping rows**: identical FormArray-based "From → To" UI as the save path mapping fieldset, bound to `categoryPathMappings`.

### Start mode fieldset

Unchanged.

---

## Summary of file changes

| File                                                                  | Change                                                                                              |
| --------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| `packages/shared/src/ipc.types.ts`                                    | Add `categories?`/`tags?` to `BbeMetadata`; extend `ImportStartPayload`; split `ImportRestoreField` |
| `packages/electron/src/ipc/export.ts`                                 | Collect categories/tags during export; add Step 0 to import pipeline                                |
| `packages/app/src/app/pages/qb-settings/storage/storage.ts` + `.html` | Add "Save Management" fieldset with four `ng-select` dropdowns                                      |
| `packages/app/src/app/components/modals/import-torrents/`             | Archive count rows, split restore toggles, category path mapping fieldset                           |
| `packages/app/src/app/components/modals/export-torrents/`             | No changes - collection is automatic                                                                |

---

## Out of scope

- Remapping or renaming individual tags/categories by name (only save-path remapping for categories, matching existing save-path-mapping UX)
- Exposing TMM preferences anywhere other than the Storage settings tab
- Any change to how the export modal looks or behaves
