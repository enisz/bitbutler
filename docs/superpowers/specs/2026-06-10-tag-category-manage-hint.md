# Tag/Category Select - Replace Footer Manage Button with Hint Link

**Date:** 2026-06-10

## Summary

Replace the dropdown-footer "Manage tags"/"Manage categories" button in `TagSelect` and `CategorySelect` with a persistent link-style hint below the input. Clicking the hint opens the same manage modal as before.

---

## Goals

- Remove the `ng-footer-tmp` button that currently only appears while the dropdown is open.
- Add a small link-styled hint below each input, always visible, reading "Manage tags" / "Manage categories".
- Clicking the hint opens the existing `ManageTags` / `ManageCategories` modal (same behavior as today's button).

## Out of scope

- Changes to `ManageTags` / `ManageCategories` modal contents or behavior.
- New i18n strings - the existing `components.tag-select.manage` / `components.category-select.manage` keys are reused verbatim.
- Changes to the `bb-popover` content.

---

## Changes

Parallel changes to both `packages/app/src/app/components/tag-select/` and `packages/app/src/app/components/category-select/`.

### `*.html`

- Remove the `<ng-template ng-footer-tmp>` block entirely.
- Below the closing `</div>` of `.form-floating` (still inside `col-11`), add:

```html
<div class="form-text">
  <button
    type="button"
    class="btn btn-link btn-sm p-0 align-baseline"
    data-testid="tag-select-manage"
    (click)="openManageTags()"
  >
    {{ 'components.tag-select.manage' | translate }}
  </button>
</div>
```

(Use `category-select-manage` / `openManageCategories()` / `components.category-select.manage` for the category variant.)

### `*.ts`

- Remove `NgFooterTemplateDirective` from imports (both the import statement and the component `imports` array) - no longer used.
- `openManageTags()` / `openManageCategories()` are unchanged.

### `*.scss`

- Both files are currently empty. Add styles only if visual verification shows the `bb-popover` icon (`col-1`, `align-items-center`) is misaligned now that the row is taller; otherwise leave empty.

---

## Testing

- `tag-select.spec.ts` / `category-select.spec.ts`: add a test that finds the new `data-testid` button in the rendered DOM, dispatches a click, and asserts `openManageTags`/`openManageCategories` was invoked (in addition to the existing direct method-call tests).

---

## File change summary

| File                                                                      | Change                                          |
| ------------------------------------------------------------------------- | ----------------------------------------------- |
| `packages/app/src/app/components/tag-select/tag-select.html`              | Remove footer template, add hint link           |
| `packages/app/src/app/components/tag-select/tag-select.ts`                | Remove `NgFooterTemplateDirective` import/usage |
| `packages/app/src/app/components/tag-select/tag-select.spec.ts`           | Add DOM click test for hint link                |
| `packages/app/src/app/components/category-select/category-select.html`    | Remove footer template, add hint link           |
| `packages/app/src/app/components/category-select/category-select.ts`      | Remove `NgFooterTemplateDirective` import/usage |
| `packages/app/src/app/components/category-select/category-select.spec.ts` | Add DOM click test for hint link                |

---

## GitHub workflow

- Open an issue using the **Enhancement** template (`02_enhancement.yml`).
- Create feature branch `<issue-id>-tag-category-manage-hint`.
- Do not push or open a PR yet.
