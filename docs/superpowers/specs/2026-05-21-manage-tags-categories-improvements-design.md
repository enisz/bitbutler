# Manage Tags & Categories - UI Improvements Design

**Date:** 2026-05-21
**Branch:** 100-manage-labels-and-categories

## Summary

Seven improvements to the Manage Tags and Manage Categories modals, plus related ng-select footer consistency. The changes improve visual consistency, correctness of qBittorrent terminology, UX safety, and perceived performance.

---

## 1. ng-select Footer: Replace `<a>` with `btn btn-link`

**Affected files:** `tag-select.html`, `category-select.html`

Both footers currently render an `<a href="#">` link. Replace with a `<button type="button" class="btn btn-link btn-sm p-0">` to match Bootstrap button-link aesthetics used elsewhere in the app. The `event.preventDefault()` call in the click handler can be removed since a `<button>` has no default navigation behavior.

---

## 2. Remove Bottom Border Before Footer

**Affected files:** `packages/app/src/styles/_ng-select.scss`

The ng-select dropdown panel items container renders a bottom border from default ng-select styles, which creates a double-border effect against the footer's `border-top`. Add:

```scss
.ng-dropdown-panel .ng-dropdown-panel-items {
  border-bottom: none !important;
}
```

---

## 3. Rename "Labels" to "Tags" Everywhere

qBittorrent's API calls them tags, not labels. Rename consistently across all layers.

### Files to rename (folder + all 4 files)

`packages/app/src/app/components/modals/manage-labels/` → `manage-tags/`

Files inside: `manage-labels.ts` → `manage-tags.ts`, `.html`, `.scss`, `.spec.ts` (same pattern).

### Code changes

| Location                              | Old                                  | New                                |
| ------------------------------------- | ------------------------------------ | ---------------------------------- |
| `manage-tags.ts`                      | `class ManageLabels`                 | `class ManageTags`                 |
| `manage-tags.ts`                      | `selector: 'app-manage-labels'`      | `selector: 'app-manage-tags'`      |
| `command.model.ts`                    | `{ type: 'UI_MANAGE_LABELS' }`       | `{ type: 'UI_MANAGE_TAGS' }`       |
| `tag-select.ts`                       | `openManageLabels()`                 | `openManageTags()`                 |
| `tag-select.ts`                       | `emit({ type: 'UI_MANAGE_LABELS' })` | `emit({ type: 'UI_MANAGE_TAGS' })` |
| `tag-select.html`                     | `(click)="openManageLabels($event)"` | `(click)="openManageTags($event)"` |
| `ui-command-handler.service.ts`       | `import ManageLabels`                | `import ManageTags`                |
| `ui-command-handler.service.ts`       | `case 'UI_MANAGE_LABELS'`            | `case 'UI_MANAGE_TAGS'`            |
| `ui-command-handler.service.ts`       | `isModalOpen(ManageLabels)`          | `isModalOpen(ManageTags)`          |
| `ui-command-handler.service.ts`       | `modalService.open(ManageLabels)`    | `modalService.open(ManageTags)`    |
| `menu-bar-command-handler.service.ts` | `case 'settings.manage-labels'`      | `case 'settings.manage-tags'`      |
| `packages/electron/src/menu.ts`       | `t('electron.menu.manage-labels')`   | `t('electron.menu.manage-tags')`   |
| `packages/electron/src/menu.ts`       | `'settings.manage-labels'`           | `'settings.manage-tags'`           |

Spec files (`tag-select.spec.ts`, `manage-tags.spec.ts`) get the same renames.

### i18n changes (both `us.json` and `hu.json`)

| Key path                                              | Old value          | New value        |
| ----------------------------------------------------- | ------------------ | ---------------- |
| `components.modals.manage-labels` key → `manage-tags` | -                  | -                |
| `components.modals.manage-tags.title`                 | "Manage Labels"    | "Manage Tags"    |
| `components.modals.manage-tags.add-form.name`         | "Label name"       | "Tag name"       |
| `components.modals.manage-tags.empty`                 | "No labels yet."   | "No tags yet."   |
| `electron.menu.manage-labels` key → `manage-tags`     | -                  | -                |
| `electron.menu.manage-tags` value                     | "Manage Labels"    | "Manage Tags"    |
| `components.tag-select.manage`                        | "Manage labels..." | "Manage tags..." |

---

## 4. Alphabetical Ordering

After every load and after every successful add, sort the list alphabetically.

- **Tags** (string[]): `[...tags].sort((a, b) => a.localeCompare(b))`
- **Categories** (CategoryItem[]): `[...cats].sort((a, b) => a.name.localeCompare(b.name))`

Applied in: `ngOnInit` (after `set()`), `add()` (after `set()`). Not needed after delete since removing an item preserves order.

---

## 5. Confirm Before Delete

Inject `ConfirmService` into both `ManageTags` and `ManageCategories`. Wrap the delete logic:

```typescript
const confirmed = await this.confirmService.confirm(
  'components.modals.manage-tags.delete-confirm.title',
  { text: 'components.modals.manage-tags.delete-confirm.message', data: { name } },
  'general.button.delete',
);
if (!confirmed) return;
```

New i18n keys to add in `us.json` (and mirrored structure in `hu.json` with Hungarian translation values left to the user):

```json
"manage-tags": {
  "delete-confirm": {
    "title": "Delete Tag",
    "message": "Are you sure you want to delete the tag \"{{ name }}\"?"
  }
}

"manage-categories": {
  "delete-confirm": {
    "title": "Delete Category",
    "message": "Are you sure you want to delete the category \"{{ name }}\"?"
  }
}
```

---

## 6. Icon Buttons with Tooltips

Replace text action buttons with icon-only `btn btn-link` buttons matching the login screen pattern (`faEdit`, `faTrashCan` from `@fortawesome/free-regular-svg-icons`).

Both components add:

- `FontAwesomeModule` and `NgbTooltipModule` to `imports`
- `public icon = { faEdit, faTrashCan }` property

### Manage Tags (delete only)

```html
<button
  type="button"
  class="btn btn-link text-danger p-0"
  [ngbTooltip]="'general.button.delete' | translate"
  (click)="delete(tag)"
>
  <fa-icon [icon]="icon.faTrashCan" />
</button>
```

### Manage Categories (edit + delete)

```html
<button
  type="button"
  class="btn btn-link p-0"
  [ngbTooltip]="'general.button.edit' | translate"
  (click)="startEdit(item)"
>
  <fa-icon [icon]="icon.faEdit" />
</button>
<button
  type="button"
  class="btn btn-link text-danger p-0"
  [ngbTooltip]="'general.button.delete' | translate"
  (click)="delete(item)"
>
  <fa-icon [icon]="icon.faTrashCan" />
</button>
```

---

## 7. Loading Spinner

Both modals add `loading = signal(true)` (true by default so spinner shows immediately on open). The `ngOnInit` sets it to `false` in the `finally` block.

Template structure:

```html
@if (loading()) {
<div class="d-flex justify-content-center py-3">
  <div class="spinner-border spinner-border-sm" role="status">
    <span class="visually-hidden">Loading...</span>
  </div>
</div>
} @else if (items().length > 0) {
<!-- list -->
} @else {
<!-- empty state -->
}
```

---

## Files Changed

| File                                                                              | Change type                                                             |
| --------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| `packages/app/src/app/components/modals/manage-labels/*`                          | Renamed to `manage-tags/*`                                              |
| `packages/app/src/app/components/modals/manage-tags/manage-tags.ts`               | Rename class, add ConfirmService, loading signal, sort, icons, tooltips |
| `packages/app/src/app/components/modals/manage-tags/manage-tags.html`             | Spinner, icon buttons                                                   |
| `packages/app/src/app/components/modals/manage-categories/manage-categories.ts`   | Add ConfirmService, loading signal, sort, icons, tooltips               |
| `packages/app/src/app/components/modals/manage-categories/manage-categories.html` | Spinner, icon buttons                                                   |
| `packages/app/src/app/components/tag-select/tag-select.html`                      | btn-link footer, method rename                                          |
| `packages/app/src/app/components/tag-select/tag-select.ts`                        | Method rename, command type rename                                      |
| `packages/app/src/app/components/tag-select/tag-select.spec.ts`                   | Rename test descriptions and command type                               |
| `packages/app/src/app/components/category-select/category-select.html`            | btn-link footer                                                         |
| `packages/app/src/styles/_ng-select.scss`                                         | Remove bottom border on items container                                 |
| `packages/app/src/app/models/command.model.ts`                                    | UI_MANAGE_LABELS → UI_MANAGE_TAGS                                       |
| `packages/app/src/app/services/ui-command-handler.service.ts`                     | Import, case, modal open rename                                         |
| `packages/app/src/app/services/menu-bar-command-handler.service.ts`               | Action string rename                                                    |
| `packages/electron/src/menu.ts`                                                   | i18n key + action string rename                                         |
| `public/i18n/us.json`                                                             | Rename keys, update values, add delete-confirm keys                     |
| `public/i18n/hu.json`                                                             | Same as us.json                                                         |
