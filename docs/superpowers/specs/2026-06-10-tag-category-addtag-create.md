# Tag/Category Select - Create Non-Existing Items via addTag

**Date:** 2026-06-10

## Summary

Let users type a tag or category name that doesn't exist yet directly into `TagSelect` / `CategorySelect` (via ng-select's `addTag`), and create it on submit rather than immediately on typing.

- Tags: no extra work needed beyond enabling `addTag` - qBittorrent's `addTags` endpoint auto-creates tags that don't exist yet.
- Categories: qBittorrent's `setCategory` fails for categories that don't exist, so `CategorySelect` gains an `ensureCategoryExists()` method that consumers call right before the actual save/add API call. If the typed category isn't in the known list, it's created (with an empty save path) at that point.

---

## Goals

- `TagSelect` and `CategorySelect` accept freeform typed values via ng-select's `addTag`, mirroring the existing `SavePathSelect` pattern (`addTag = (term: string): string => term;`).
- Typing a new category and cancelling the modal/dialog must NOT create the category - creation only happens when the user actually submits.
- `SetTorrentCategory` and `AddTorrent` both ensure a typed-but-not-yet-existing category is created before the underlying `setCategory` / `addTorrent` call.
- Extend the category-select popover with a warning about the empty save path of categories created this way, using the same color and icon treatment (`text-warning` + triangle-exclamation icon) as the warning in `import-torrents`, scaled down for the popover context.

## Out of scope

- Changes to `ManageTags` / `ManageCategories` modals.
- Centralizing category creation in the command bus / `TorrentCommandHandlerService`.
- Any UI for editing the save path of a category created via `addTag` - users can do this afterwards via "Manage categories".
- Adding an interactive "open settings" link/button inside `bb-popover` (it's hover-triggered via `mouseenter:mouseleave`, which makes interactive elements inside it unreliable).

---

## Changes

### `packages/app/src/app/components/tag-select/`

**`tag-select.html`**

Add `[addTag]="addTag"` to the `<ng-select>`:

```html
<ng-select
  data-testid="tag-select-input"
  [items]="tags()"
  [multiple]="true"
  [hideSelected]="true"
  [searchable]="true"
  [clearable]="true"
  [clearSearchOnAdd]="true"
  [addTag]="addTag"
  [formControl]="selectControl"
  [keyDownFn]="keyDownFn"
  [openOnEnter]="false"
  #ngselect
></ng-select>
```

**`tag-select.ts`**

Add an identity `addTag` function (mirrors `SavePathSelect`):

```ts
addTag = (term: string): string => term.trim();
```

No other changes. `QbService.addTorrentTags` (used by `SetTorrentTags`) already creates tags server-side that don't exist yet, so newly-typed tags work without further wiring.

---

### `packages/app/src/app/components/category-select/`

**`category-select.ts`**

1. Add the same identity `addTag` function:

```ts
addTag = (term: string): string => term.trim();
```

2. Add `ensureCategoryExists()`. Called by consumers right before they use the category value. Returns `true` if the category already existed or was created successfully, `false` if creation failed (in which case the consumer aborts the submit). `QbService.request()` already shows a danger toast on failure, so this method does not need to surface its own error UI.

```ts
public async ensureCategoryExists(): Promise<boolean> {
  const value = (this.selectControl.value ?? '').trim();
  if (!value || this.categories().includes(value)) {
    return true;
  }

  try {
    await this.qbService.addCategory(
      this.serverStoreService.currentServerId() as string,
      value,
      '',
    );
    this.categories.update((cats) => [...cats, value]);
    return true;
  } catch {
    return false;
  }
}
```

3. Add the warning icon. Import `FaIconComponent` from `@fortawesome/angular-fontawesome` and add it to the component's `imports` array. Import `faTriangleExclamation` from `@fortawesome/free-solid-svg-icons` and expose it to the template:

```ts
protected readonly icons = { faTriangleExclamation };
```

**`category-select.html`**

1. Add `[addTag]="addTag"` to the `<ng-select>` (same placement as `TagSelect`).

2. Add a third paragraph to the `#categoryPopover` template, styled with Bootstrap's `text-warning` color and a leading triangle-exclamation icon:

```html
<ng-template #categoryPopover>
  <p>{{ 'components.category-select.popover.description.line1' | translate }}</p>
  <p>{{ 'components.category-select.popover.description.line2' | translate }}</p>
  <p class="text-warning mb-0">
    <fa-icon [icon]="icons.faTriangleExclamation" class="me-1"></fa-icon>
    {{ 'components.category-select.popover.description.line3' | translate }}
  </p>
</ng-template>
```

This is a lighter treatment than the `alert alert-warning` box used in `import-torrents` - a full alert box would nest a second bordered/background block inside the `bb-popover`'s own bordered box, which is too heavy for a small hover popover. `text-warning` + icon gives the same "pay attention" signal while staying compact.

---

### `packages/app/src/app/components/modals/set-torrent-category/set-torrent-category.ts`

Add a `viewChild` reference to the `CategorySelect` and call `ensureCategoryExists()` at the start of `handleSubmit()`, aborting if it fails:

```ts
private readonly categorySelect = viewChild(CategorySelect);
```

```ts
public async handleSubmit(): Promise<void> {
  this.saving = true;

  if (!(await this.categorySelect()?.ensureCategoryExists())) {
    this.saving = false;
    return;
  }

  const category = this.setTorrentCategoryForm.get('category')?.value || '';
  const serverId = this.serverStoreService.currentServerId() ?? '';
  try {
    await this.qbService.setTorrentCategory(serverId, this.hashes(), category);
    this.activeModal.close();
  } catch (error) {
    console.error(SetTorrentCategory.name, 'handleSubmit', 'Failed to set torrent category!', error);
  } finally {
    this.saving = false;
  }
}
```

### `packages/app/src/app/components/modals/set-torrent-tags/set-torrent-tags.ts`

No changes - `TagSelect`'s new `[addTag]` is enough, since `addTorrentTags` auto-creates tags.

### `packages/app/src/app/components/add-torrent/add-torrent.ts`

`<app-category-select formControlName="category">` is always rendered (not behind an `@if`), so a `viewChild(CategorySelect)` reference resolves reliably.

Add the same `viewChild` reference and call `ensureCategoryExists()` at the start of `handleSubmit()`, aborting (resetting `isSubmitting` and returning) if it fails - same pattern as `SetTorrentCategory`.

---

### i18n (`public/i18n/us.json`, `public/i18n/hu.json`)

Add `components.category-select.popover.description.line3`:

- `us.json`:

  ```json
  "line3": "Adding a new category here creates it with an empty save path. Whether this affects where your torrents are stored depends on the qBittorrent 'Default torrent management mode' and 'When category save path changes' settings."
  ```

- `hu.json`:

  ```json
  "line3": "Az itt hozzáadott új kategória üres mentési útvonallal jön létre. Hogy ez hogyan befolyásolja a torrentek tárolási helyét, az a qBittorrent 'Alapértelmezett torrent kezelési mód' és 'Amikor a kategória mentési útvonala megváltozik' beállításaitól függ."
  ```

These reuse the exact setting names from `pages.qb-settings.tab.storage.field.auto-tmm-enabled` / `category-changed-tmm-enabled`, kept as plain quoted text (matching line1/line2's plain interpolation - no `[innerHTML]` needed).

---

## Testing

- `tag-select.spec.ts`: test that `addTag` trims and returns the typed term.
- `category-select.spec.ts`:
  - test that `addTag` trims and returns the typed term.
  - `ensureCategoryExists()`:
    - returns `true` immediately for an empty value, without calling `addCategory`.
    - returns `true` immediately for a value already in `categories()`, without calling `addCategory`.
    - for a new value, calls `qbService.addCategory(serverId, value, '')`, adds the value to `categories()`, and returns `true`.
    - when `addCategory` rejects, returns `false` and leaves `categories()` unchanged.
- `set-torrent-category.spec.ts`: `handleSubmit()` calls `ensureCategoryExists()` before `setTorrentCategory()`; if it returns `false`, `setTorrentCategory()` is not called and `saving` is reset to `false`.
- `add-torrent.spec.ts`: same pattern - `handleSubmit()` calls `ensureCategoryExists()` first and aborts the submit if it returns `false`.

---

## File change summary

| File                                                                                       | Change                                                     |
| ------------------------------------------------------------------------------------------ | ---------------------------------------------------------- |
| `packages/app/src/app/components/tag-select/tag-select.html`                               | Add `[addTag]="addTag"`                                    |
| `packages/app/src/app/components/tag-select/tag-select.ts`                                 | Add `addTag` identity fn                                   |
| `packages/app/src/app/components/tag-select/tag-select.spec.ts`                            | Test `addTag`                                              |
| `packages/app/src/app/components/category-select/category-select.html`                     | Add `[addTag]="addTag"`, popover line3 with warning icon   |
| `packages/app/src/app/components/category-select/category-select.ts`                       | Add `addTag`, `ensureCategoryExists()`, FA icon imports    |
| `packages/app/src/app/components/category-select/category-select.spec.ts`                  | Test `addTag` and `ensureCategoryExists()`                 |
| `packages/app/src/app/components/modals/set-torrent-category/set-torrent-category.ts`      | Call `ensureCategoryExists()` in `handleSubmit()`          |
| `packages/app/src/app/components/modals/set-torrent-category/set-torrent-category.spec.ts` | Test abort-on-failure                                      |
| `packages/app/src/app/components/add-torrent/add-torrent.ts`                               | Call `ensureCategoryExists()` in `handleSubmit()`          |
| `packages/app/src/app/components/add-torrent/add-torrent.spec.ts`                          | Test abort-on-failure                                      |
| `public/i18n/us.json`                                                                      | Add `components.category-select.popover.description.line3` |
| `public/i18n/hu.json`                                                                      | Add `components.category-select.popover.description.line3` |

---

## GitHub workflow

- Open an issue using the **Enhancement** template (`02_enhancement.yml`).
- Create feature branch `<issue-id>-tag-category-addtag-create`.
- Do not push or open a PR yet.
