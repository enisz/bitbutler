# Filter Clear Button & Category Edit Row Improvements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a filter-clear X button to manage-categories and manage-tags modals, and replace the category edit row with a floating-label input and icon-only save/cancel buttons.

**Architecture:** The `.bb-filter-input` / `.bb-filter-clear` CSS moves from `filter-group.scss` into the global `styles.scss` so all modal filter inputs can share it without duplication. Each component gains a `clearFilter()` method and conditionally renders the X button via `@if (filterControl.value)`. The category edit row replaces its plain `<span>+<input sm>` layout with Bootstrap's `form-floating`, and swaps text Save/Cancel buttons for icon-only `faCheck` / `faX` buttons with tooltips, matching the pattern already used in `bb-file-tree`.

**Tech Stack:** Angular 20 (zoneless signals), Bootstrap 5 `form-floating`, `@fortawesome/free-solid-svg-icons` (`faCheck`, `faX`, `faXmark`), `@ng-bootstrap/ng-bootstrap` tooltips, Vitest.

---

## File Map

| File                                                                                 | Change                                                                                                   |
| ------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------- |
| `packages/app/src/styles.scss`                                                       | Add `.bb-filter-input` / `.bb-filter-clear` global rules                                                 |
| `packages/app/src/app/pages/main/status/filter-group/filter-group.scss`              | Remove `.bb-filter-input` / `.bb-filter-clear` (now global)                                              |
| `packages/app/src/app/components/modals/manage-categories/manage-categories.ts`      | Add `faXmark`, `faCheck`, `faX` to icon object; add `clearFilter()`                                      |
| `packages/app/src/app/components/modals/manage-categories/manage-categories.html`    | Wrap filter in `.bb-filter-input`; add clear button; replace edit row with floating label + icon buttons |
| `packages/app/src/app/components/modals/manage-categories/manage-categories.spec.ts` | Add `clearFilter` test                                                                                   |
| `packages/app/src/app/components/modals/manage-tags/manage-tags.ts`                  | Add `faXmark` to icon object; add `clearFilter()`                                                        |
| `packages/app/src/app/components/modals/manage-tags/manage-tags.html`                | Wrap filter in `.bb-filter-input`; add clear button                                                      |
| `packages/app/src/app/components/modals/manage-tags/manage-tags.spec.ts`             | Add `clearFilter` test                                                                                   |

---

## Task 1: Move filter CSS to global styles

**Files:**

- Modify: `packages/app/src/styles.scss`
- Modify: `packages/app/src/app/pages/main/status/filter-group/filter-group.scss`

- [ ] **Step 1: Add `.bb-filter-input` and `.bb-filter-clear` to `styles.scss`**

Append after the last rule in `packages/app/src/styles.scss`:

```scss
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

- [ ] **Step 2: Remove the same rules from `filter-group.scss`**

In `packages/app/src/app/pages/main/status/filter-group/filter-group.scss`, delete the entire `.bb-filter-input` block and the entire `.bb-filter-clear` block. Also delete the `padding-right: 1.75rem` line from the `.form-control` block (keep the rest of `.form-control`). The file should look like:

```scss
@use 'sass:color';

:host {
  display: block;
}

.list-group-item-action {
  border-color: var(--bs-border-color);

  &.active {
    background-color: var(--bb-active-list-item-bg);
    color: var(--bs-body-color);
    font-weight: 600;
    box-shadow: inset 3px 0 0 var(--bb-accent);
    border-color: var(--bb-active-list-item-bg) !important;

    .bb-status-badge {
      background-color: var(--bb-accent);
      color: var(--bb-primary-ink);
    }
  }

  &:not(.active) {
    .bb-status-badge {
      background-color: var(--bs-tertiary-bg);
      color: var(--bs-emphasis-color);
    }
  }

  .bb-status-badge {
    --bs-badge-font-weight: 600;
    padding: 0.35rem 0.5rem;
  }
}

.list-group {
  --bs-list-group-action-hover-bg: var(--bb-hover-list-item-bg);
}

.form-control {
  background-color: transparent;
  border: none;
  border-bottom: 1px solid var(--bs-border-color);
  border-radius: 0;
  padding-left: 15px;

  &:focus {
    background-color: transparent;
    box-shadow: none;
    border-bottom-color: var(--bb-accent);
  }
}
```

- [ ] **Step 3: Run lint to verify no regressions**

```bash
npm run lint
```

Expected: `No files with errors` (zero warnings, zero errors).

- [ ] **Step 4: Commit**

```bash
git add packages/app/src/styles.scss packages/app/src/app/pages/main/status/filter-group/filter-group.scss
git commit -m "#100: move bb-filter-input and bb-filter-clear CSS to global styles"
```

---

## Task 2: Add filter clear button to manage-categories

**Files:**

- Modify: `packages/app/src/app/components/modals/manage-categories/manage-categories.ts`
- Modify: `packages/app/src/app/components/modals/manage-categories/manage-categories.html`
- Modify: `packages/app/src/app/components/modals/manage-categories/manage-categories.spec.ts`

- [ ] **Step 1: Write a failing test for `clearFilter()`**

Add a new `it` block inside the existing `describe('filteredCategories')` block in `manage-categories.spec.ts`:

```typescript
it('should clear the filter control when clearFilter is called', () => {
  component.filterControl.setValue('linux');
  expect(component.filterControl.value).toBe('linux');
  component.clearFilter();
  expect(component.filterControl.value).toBeNull();
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
npm --workspace=packages/app test
```

Expected: one failure — `component.clearFilter is not a function`.

- [ ] **Step 3: Add `faXmark` import and `clearFilter()` to `manage-categories.ts`**

Change the import line at the top of `manage-categories.ts` from:

```typescript
import { faEdit, faTrashCan } from '@fortawesome/free-regular-svg-icons';
```

Add a new import for the solid icons (keep the regular one):

```typescript
import { faEdit, faTrashCan } from '@fortawesome/free-regular-svg-icons';
import { faCheck, faX, faXmark } from '@fortawesome/free-solid-svg-icons';
```

Update the `icon` property:

```typescript
public readonly icon = { faEdit, faTrashCan, faCheck, faX, faXmark };
```

Add the `clearFilter()` method after the `filteredCategories` computed property:

```typescript
public clearFilter(): void {
  this.filterControl.reset();
}
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
npm --workspace=packages/app test
```

Expected: all tests pass.

- [ ] **Step 5: Update the filter input in `manage-categories.html`**

Replace the filter section:

```html
@if (!loading()) {
<div class="mb-3">
  <input
    type="text"
    class="form-control"
    [placeholder]="'components.modals.manage-categories.filter.placeholder' | translate"
    [formControl]="filterControl"
  />
</div>
}
```

With:

```html
@if (!loading()) {
<div class="mb-3">
  <div class="bb-filter-input">
    <input
      type="text"
      class="form-control"
      [placeholder]="'components.modals.manage-categories.filter.placeholder' | translate"
      [formControl]="filterControl"
    />
    @if (filterControl.value) {
    <button type="button" class="bb-filter-clear" (click)="clearFilter()" aria-label="Clear filter">
      <fa-icon [icon]="icon.faXmark"></fa-icon>
    </button>
    }
  </div>
</div>
}
```

- [ ] **Step 6: Run lint and tests**

```bash
npm run lint && npm --workspace=packages/app test
```

Expected: zero lint warnings, all tests pass.

- [ ] **Step 7: Commit**

```bash
git add packages/app/src/app/components/modals/manage-categories/
git commit -m "#100: add filter clear button to manage-categories"
```

---

## Task 3: Add filter clear button to manage-tags

**Files:**

- Modify: `packages/app/src/app/components/modals/manage-tags/manage-tags.ts`
- Modify: `packages/app/src/app/components/modals/manage-tags/manage-tags.html`
- Modify: `packages/app/src/app/components/modals/manage-tags/manage-tags.spec.ts`

- [ ] **Step 1: Write a failing test for `clearFilter()`**

Add a new `it` block inside the existing `describe('filteredTags')` block in `manage-tags.spec.ts`:

```typescript
it('should clear the filter control when clearFilter is called', () => {
  component.filterControl.setValue('linux');
  expect(component.filterControl.value).toBe('linux');
  component.clearFilter();
  expect(component.filterControl.value).toBeNull();
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
npm --workspace=packages/app test
```

Expected: one failure — `component.clearFilter is not a function`.

- [ ] **Step 3: Add `faXmark` import and `clearFilter()` to `manage-tags.ts`**

Change the import lines at the top of `manage-tags.ts`. Add the solid icons import (keep the regular one):

```typescript
import { faTrashCan } from '@fortawesome/free-regular-svg-icons';
import { faXmark } from '@fortawesome/free-solid-svg-icons';
```

Update the `icon` property:

```typescript
public readonly icon = { faTrashCan, faXmark };
```

Add the `clearFilter()` method after the `filteredTags` computed property:

```typescript
public clearFilter(): void {
  this.filterControl.reset();
}
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
npm --workspace=packages/app test
```

Expected: all tests pass.

- [ ] **Step 5: Update the filter input in `manage-tags.html`**

Replace the filter section:

```html
@if (!loading()) {
<div class="mb-3">
  <input
    type="text"
    class="form-control"
    [placeholder]="'components.modals.manage-tags.filter.placeholder' | translate"
    [formControl]="filterControl"
  />
</div>
}
```

With:

```html
@if (!loading()) {
<div class="mb-3">
  <div class="bb-filter-input">
    <input
      type="text"
      class="form-control"
      [placeholder]="'components.modals.manage-tags.filter.placeholder' | translate"
      [formControl]="filterControl"
    />
    @if (filterControl.value) {
    <button type="button" class="bb-filter-clear" (click)="clearFilter()" aria-label="Clear filter">
      <fa-icon [icon]="icon.faXmark"></fa-icon>
    </button>
    }
  </div>
</div>
}
```

- [ ] **Step 6: Run lint and tests**

```bash
npm run lint && npm --workspace=packages/app test
```

Expected: zero lint warnings, all tests pass.

- [ ] **Step 7: Commit**

```bash
git add packages/app/src/app/components/modals/manage-tags/
git commit -m "#100: add filter clear button to manage-tags"
```

---

## Task 4: Update category edit row to floating label with icon buttons

This task is a template-only change - no new logic, so the existing `saveEdit` and `cancelEdit` tests continue to cover correctness. The `faCheck` and `faX` icons are already imported in Task 2 Step 3.

**Files:**

- Modify: `packages/app/src/app/components/modals/manage-categories/manage-categories.html`

- [ ] **Step 1: Replace the edit row in `manage-categories.html`**

Find the editing branch inside `@for (item of filteredCategories(); ...)`:

```html
@if (item.editing) {
<li class="list-group-item">
  <div class="d-flex gap-2 align-items-center">
    <span class="fw-semibold text-nowrap">{{ item.name }}</span>
    <input
      type="text"
      class="form-control form-control-sm flex-grow-1"
      [formControl]="editSavePathControl"
      (keydown.enter)="saveEdit(item)"
      (keydown.escape)="cancelEdit()"
    />
    <button class="btn btn-secondary btn-sm text-nowrap" type="button" (click)="saveEdit(item)">
      {{ 'general.button.save' | translate }}
    </button>
    <button class="btn btn-link btn-sm" type="button" (click)="cancelEdit()">
      {{ 'general.button.cancel' | translate }}
    </button>
  </div>
</li>
}
```

Replace with:

```html
@if (item.editing) {
<li class="list-group-item">
  <div class="d-flex gap-2 align-items-center">
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
  </div>
</li>
}
```

- [ ] **Step 2: Run lint and tests**

```bash
npm run lint && npm --workspace=packages/app test
```

Expected: zero lint warnings, all tests pass (no logic changed — existing `saveEdit`/`cancelEdit` tests remain green).

- [ ] **Step 3: Commit**

```bash
git add packages/app/src/app/components/modals/manage-categories/manage-categories.html
git commit -m "#100: replace category edit row with floating label and icon save/cancel buttons"
```
