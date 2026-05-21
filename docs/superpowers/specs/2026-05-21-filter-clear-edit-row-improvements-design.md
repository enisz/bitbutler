# Design: Filter Clear Button & Category Edit Row Improvements

**Date:** 2026-05-21
**Branch:** 100-manage-labels-and-categories

## Overview

Improve `manage-categories` and `manage-tags` modals with two UX enhancements:

1. Filter inputs gain an X clear button (shown only when the input has a value)
2. Category edit rows switch to a floating-label input with icon-only save/cancel buttons

## Scope

| Component           | Filter clear button                  | Edit row changes       |
| ------------------- | ------------------------------------ | ---------------------- |
| `manage-categories` | Yes                                  | Yes                    |
| `manage-tags`       | Yes                                  | No (tags have no edit) |
| `filter-group`      | Already has it - CSS moves to global | No change              |

---

## Section 1: Global CSS (`styles.scss`)

Move `.bb-filter-input` and `.bb-filter-clear` from `filter-group.scss` into `packages/app/src/styles.scss`. Add a `.bb-filter-input .form-control` rule with `padding-right: 1.75rem` so input text does not overlap the X button. Remove the duplicate rules from `filter-group.scss`.

```scss
// In styles.scss
.bb-filter-input {
  position: relative;

  .form-control {
    padding-right: 1.75rem;
  }
}

.bb-filter-clear {
  position: absolute;
  right: 0.4rem;
  top: 50%;
  transform: translateY(-50%);
  border: none;
  background: transparent;
  color: var(--bs-secondary-color);
  padding: 0.15rem 0.35rem;
  line-height: 1;
  cursor: pointer;

  &:hover {
    color: var(--bs-body-color);
  }
}
```

---

## Section 2: Filter clear button - both components

**Template change** (`manage-categories.html` and `manage-tags.html`):

Wrap the existing filter `<input>` in `<div class="bb-filter-input">`. Add a conditionally rendered clear button inside:

```html
<div class="bb-filter-input">
  <input
    type="text"
    class="form-control"
    [placeholder]="'...' | translate"
    [formControl]="filterControl"
  />
  @if (filterControl.value) {
  <button type="button" class="bb-filter-clear" (click)="clearFilter()" aria-label="Clear filter">
    <fa-icon [icon]="icon.faXmark"></fa-icon>
  </button>
  }
</div>
```

**TypeScript change** (both components):

- Add `faXmark` (from `@fortawesome/free-solid-svg-icons`) to the `icon` object
- Add `clearFilter()` method: `this.filterControl.reset()`

---

## Section 3: Category edit row

**Template change** (`manage-categories.html`):

Replace the current edit row layout:

```html
<!-- Before -->
<span class="fw-semibold text-nowrap">{{ item.name }}</span>
<input
  type="text"
  class="form-control form-control-sm flex-grow-1"
  [formControl]="editSavePathControl"
  ...
/>
<button class="btn btn-secondary btn-sm ...">Save</button>
<button class="btn btn-link btn-sm ...">Cancel</button>
```

With floating-label input and icon buttons:

```html
<!-- After -->
<div class="form-floating flex-grow-1">
  <input
    type="text"
    class="form-control"
    id="category-edit-path"
    placeholder="Save path"
    [formControl]="editSavePathControl"
    (keydown.enter)="saveEdit(item)"
    (keydown.escape)="cancelEdit()"
  />
  <label for="category-edit-path">{{ item.name }}</label>
</div>
<button
  type="button"
  class="btn btn-link text-success"
  [ngbTooltip]="'general.button.save' | translate"
  tooltipClass="single-line-tooltip"
  (click)="saveEdit(item)"
>
  <fa-icon [icon]="icon.faCheck"></fa-icon>
</button>
<button
  type="button"
  class="btn btn-link text-danger"
  [ngbTooltip]="'general.button.cancel' | translate"
  tooltipClass="single-line-tooltip"
  (click)="cancelEdit()"
>
  <fa-icon [icon]="icon.faX"></fa-icon>
</button>
```

**TypeScript change** (`manage-categories.ts`):

- Add `faCheck` and `faX` (from `@fortawesome/free-solid-svg-icons`) to the `icon` object

---

## Files Changed

| File                                                                              | Change                                                      |
| --------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| `packages/app/src/styles.scss`                                                    | Add `.bb-filter-input` / `.bb-filter-clear` global rules    |
| `packages/app/src/app/pages/main/status/filter-group/filter-group.scss`           | Remove `.bb-filter-input` / `.bb-filter-clear` (now global) |
| `packages/app/src/app/components/modals/manage-categories/manage-categories.html` | Filter clear button + floating-label edit row               |
| `packages/app/src/app/components/modals/manage-categories/manage-categories.ts`   | Add `faXmark`, `faCheck`, `faX` icons; add `clearFilter()`  |
| `packages/app/src/app/components/modals/manage-tags/manage-tags.html`             | Filter clear button                                         |
| `packages/app/src/app/components/modals/manage-tags/manage-tags.ts`               | Add `faXmark` icon; add `clearFilter()`                     |
