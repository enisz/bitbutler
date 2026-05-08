# Design: Move Popovers into Select Components

**Date:** 2026-05-08  
**Issue:** #66  
**Branch:** `66-changing-add-torrent-view`

---

## Summary

Move the save-path, category, and tag popovers from `add-torrent` into their respective reusable components (`SavePathSelect`, `CategorySelect`, `TagSelect`). This makes the popovers available automatically in the modals opened from the context menu. The server settings usage of `SavePathSelect` is replaced with an inline `ng-select` that does not include a popover.

Additionally, `SavePathSelect` gains a placeholder that shows the qBittorrent default download path when the field is empty, and the server settings inline ng-select is fixed so its dropdown no longer crawls under the modal footer.

---

## Affected Files

| File                                     | Change                                                                                                                          |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `save-path-select/save-path-select.ts`   | Add `BbPopover`, inject `QbService`, add `defaultPath` signal                                                                   |
| `save-path-select/save-path-select.html` | Wrap in col-11/col-1 grid, add `bb-popover`, bind `[placeholder]`                                                               |
| `category-select/category-select.ts`     | Add `BbPopover` to imports                                                                                                      |
| `category-select/category-select.html`   | Wrap in col-11/col-1 grid, add `bb-popover`                                                                                     |
| `tag-select/tag-select.ts`               | Add `BbPopover` to imports                                                                                                      |
| `tag-select/tag-select.html`             | Wrap in col-11/col-1 grid, add `bb-popover`                                                                                     |
| `add-torrent/add-torrent.html`           | Collapse col-11/col-1 to col-12, add `[autofocus]="true"` to save-path, remove 3 ng-templates                                   |
| `pages/settings/server/server.ts`        | Inject `TorrentStoreService`, add `paths` computed, `addTag`, `keyDownFn`; remove `SavePathSelect` import                       |
| `pages/settings/server/server.html`      | Replace `<app-save-path-select>` with inline `<ng-select appendTo="ngb-modal-window">`                                          |
| `public/i18n/us.json`                    | Move popover keys from `add-torrent` namespace to component namespaces; add `defaultPath` placeholder key to `save-path-select` |
| `public/i18n/hu.json`                    | Same as `us.json`                                                                                                               |

---

## Component Changes

### `SavePathSelect`

**New behaviour:**

- On init, calls `qbService.getAppPreferences(serverId)` and reads `save_path` from the response.
- Stores the result in `defaultPath = signal<string>('')`. The signal holds the **already-translated** placeholder string (e.g. `"Default: /home/user/Downloads"`), produced via `translateService.instant('components.save-path-select.default-path', { path: prefs.save_path })`. The template simply binds `[placeholder]="defaultPath()"`.
- When a value is selected the placeholder disappears (standard ng-select behaviour). If the fetch fails, `defaultPath` stays `''` (silent fallback, no placeholder shown).
- Wraps the existing `form-floating` in a Bootstrap row: `col-11` holds the ng-select, `col-1` holds `bb-popover`.
- Keeps existing `@Input() autofocus` behaviour unchanged.

**Template structure:**

```html
<div class="container-fluid px-0">
  <div class="row">
    <div class="col-11">
      <div class="form-floating">
        <ng-select [placeholder]="defaultPath()" ...></ng-select>
        <label>...</label>
      </div>
    </div>
    <div class="col-1 d-flex align-items-center">
      <bb-popover
        [subject]="'components.save-path-select.popover.title' | translate"
        [description]="'components.save-path-select.popover.description' | translate"
        placement="left"
      ></bb-popover>
    </div>
  </div>
</div>
```

**Translation keys added:**

```json
"save-path-select": {
  "label": "Save Path",
  "default-path": "Default: {{ path }}",
  "popover": {
    "title": "Save Path",
    "description": {
      "line1": "The folder on your disk where the downloaded files will be saved.",
      "line2": "Leave blank to use the default download location set in your qBittorrent preferences."
    }
  }
}
```

The placeholder is a single translated string interpolated with the fetched path (e.g. `"Default: /home/user/Downloads"`).

Each component defines an internal `ng-template` for the popover description (two `<p>` tags) and passes it as a `TemplateRef` to `bb-popover [description]`. This matches the existing `BbPopover` `@Input() description: string | TemplateRef<Element>` signature and preserves the two-paragraph formatting from the current add-torrent popovers.

---

### `CategorySelect`

- Wraps template in col-11/col-1 row, adds `bb-popover`.
- Adds `BbPopover` to imports.

**Translation keys added:**

```json
"category-select": {
  "label": "Category",
  "popover": {
    "title": "Category",
    "description": {
      "line1": "Assigns the torrent to a category.",
      "line2": "If Auto TMM is enabled, changing the category may automatically move the files."
    }
  }
}
```

---

### `TagSelect`

- Wraps template in col-11/col-1 row, adds `bb-popover`.
- Adds `BbPopover` to imports.

**Translation keys added:**

```json
"tag-select": {
  "label": "Tags",
  "popover": {
    "title": "Tags",
    "description": {
      "line1": "Adds one or more tags to this torrent for flexible filtering and grouping.",
      "line2": "Unlike categories, a torrent can have multiple tags, and tags do not affect the save path."
    }
  }
}
```

---

## `add-torrent.html` Changes

The three col-11/col-1 blocks for save-path, category, and tags each collapse to a single `col-12` block. The external `bb-popover` columns and the three `ng-template` definitions (`#savePathPopover`, `#categoryPopover`, `#tagsPopover`) are removed.

`[autofocus]="true"` is added to `<app-save-path-select>`.

The three translation keys under `components.add-torrent.popover.save-path`, `.category`, and `.tags` are removed from both i18n files.

---

## Server Settings Changes

### `server.ts`

- Remove `SavePathSelect` from `imports`.
- Inject `TorrentStoreService`.
- Add `paths` computed signal (same logic as `SavePathSelect`: collect unique `save_path` values from `torrentsArray()`, deduplicate, sort).
- Add `addTag = (term: string): string => term` method.
- Add `keyDownFn(event: KeyboardEvent): boolean` method (returns `false` for Escape, `true` otherwise).

### `server.html`

Replace:

```html
<app-save-path-select formControlName="remote"></app-save-path-select>
```

With:

```html
<div class="form-floating">
  <ng-select
    [items]="paths()"
    [addTag]="addTag"
    [searchable]="true"
    [clearable]="true"
    [clearOnBackspace]="false"
    [editableSearchTerm]="true"
    [keyDownFn]="keyDownFn"
    [openOnEnter]="false"
    appendTo="ngb-modal-window"
    formControlName="remote"
  ></ng-select>
  <label
    >{{ 'pages.settings.tab.server.server-settings-form.path-mapping.remote-path' | translate
    }}</label
  >
</div>
```

The `appendTo="ngb-modal-window"` fixes the dropdown clipping under the modal footer.

---

## What Does Not Change

- `autofocus` input and `ngAfterViewInit` focus logic on all three components — unchanged.
- Modals (`set-torrent-location`, `set-torrent-category`, `set-torrent-tags`) — no template changes needed; they already pass `[autofocus]="true"` and will gain the popover automatically.
- The `local` path input in server settings path mappings — unchanged.
- `bb-popover` component itself — unchanged.
