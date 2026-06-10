# Tag/Category Select Manage Hint Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the dropdown-footer "Manage tags"/"Manage categories" button in `TagSelect` and `CategorySelect` with a persistent link-style hint below the input that opens the same manage modal.

**Architecture:** Both components currently render an `ng-select` with an `ng-footer-tmp` template containing a "Manage" button only visible while the dropdown is open. Remove that template (and the now-unused `NgFooterTemplateDirective` import) and add a `form-text` hint - a `btn btn-link btn-sm` styled button - as a sibling of the existing two-column `.row`, so the popover icon's vertical alignment in `.col-1` is unaffected. The button reuses the existing `openManageTags()`/`openManageCategories()` methods and the existing `components.tag-select.manage`/`components.category-select.manage` translation keys (no new i18n strings).

**Tech Stack:** Angular 20 (standalone components, signals), `@ng-select/ng-select`, `@ngx-translate/core`, Bootstrap 5, Vitest.

---

## Reference: spec

See `docs/superpowers/specs/2026-06-10-tag-category-manage-hint.md` for the approved design. One refinement made during planning: the hint is placed as a sibling of `.row` (full width of `.container-fluid`) rather than inside `.col-11`, so it doesn't change the row's height and the `bb-popover` icon in `.col-1` stays aligned exactly as before - no alignment verification/adjustment needed.

---

### Task 1: TagSelect - replace footer manage button with hint link

**Files:**

- Modify: `packages/app/src/app/components/tag-select/tag-select.html`
- Modify: `packages/app/src/app/components/tag-select/tag-select.ts`
- Test: `packages/app/src/app/components/tag-select/tag-select.spec.ts`

- [ ] **Step 1: Write the failing test**

In `packages/app/src/app/components/tag-select/tag-select.spec.ts`, add a new `describe` block right after the existing `describe('openManageTags', ...)` block (i.e. just before the final closing `});` of the outer `describe('TagSelect', ...)`):

```typescript
describe('manage hint link', () => {
  it('should open the ManageTags modal when clicked', () => {
    const button = fixture.nativeElement.querySelector(
      '[data-testid="tag-select-manage"]',
    ) as HTMLButtonElement;

    button.click();

    expect(mockModalService.open).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test --workspace=@bitbutler/app -- --include=src/app/components/tag-select/tag-select.spec.ts`

Expected: FAIL - the new "manage hint link > should open the ManageTags modal when clicked" test throws `TypeError: Cannot read properties of null (reading 'click')` because no element matches `[data-testid="tag-select-manage"]` yet.

- [ ] **Step 3: Replace `tag-select.html`**

Replace the entire file contents with:

```html
<div class="container-fluid px-0">
  <div class="row">
    <div class="col-11">
      <div class="form-floating">
        <ng-select
          data-testid="tag-select-input"
          [items]="tags()"
          [multiple]="true"
          [hideSelected]="true"
          [searchable]="true"
          [clearable]="true"
          [clearSearchOnAdd]="true"
          [formControl]="selectControl"
          [keyDownFn]="keyDownFn"
          [openOnEnter]="false"
          #ngselect
        ></ng-select>
        <label>{{ 'components.tag-select.label' | translate }}</label>
      </div>
    </div>

    <div class="col-1 d-flex align-items-center">
      <bb-popover
        [subject]="'components.tag-select.popover.title' | translate"
        [description]="tagPopover"
        placement="left"
      ></bb-popover>
    </div>
  </div>

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
</div>

<ng-template #tagPopover>
  <p>{{ 'components.tag-select.popover.description.line1' | translate }}</p>
  <p>{{ 'components.tag-select.popover.description.line2' | translate }}</p>
</ng-template>
```

This removes the `<ng-template ng-footer-tmp>` block and adds the hint link below the row.

- [ ] **Step 4: Update `tag-select.ts` imports**

In `packages/app/src/app/components/tag-select/tag-select.ts`, change the `@ng-select/ng-select` import (currently):

```typescript
import { NgFooterTemplateDirective, NgSelectComponent } from '@ng-select/ng-select';
```

to:

```typescript
import { NgSelectComponent } from '@ng-select/ng-select';
```

Then in the `@Component` decorator's `imports` array, remove the `NgFooterTemplateDirective` entry:

```typescript
  imports: [
    CommonModule,
    ReactiveFormsModule,
    NgSelectComponent,
    TranslatePipe,
    BbPopover,
  ],
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npm run test --workspace=@bitbutler/app -- --include=src/app/components/tag-select/tag-select.spec.ts`

Expected: PASS - all 10 tests pass (9 existing + the new "manage hint link" test).

- [ ] **Step 6: Commit**

```bash
git add packages/app/src/app/components/tag-select/tag-select.html packages/app/src/app/components/tag-select/tag-select.ts packages/app/src/app/components/tag-select/tag-select.spec.ts
git commit -m "#143: replace tag select footer manage button with hint link"
```

---

### Task 2: CategorySelect - replace footer manage button with hint link

**Files:**

- Modify: `packages/app/src/app/components/category-select/category-select.html`
- Modify: `packages/app/src/app/components/category-select/category-select.ts`
- Test: `packages/app/src/app/components/category-select/category-select.spec.ts`

- [ ] **Step 1: Write the failing test**

In `packages/app/src/app/components/category-select/category-select.spec.ts`, add a new `describe` block right after the existing `describe('openManageCategories', ...)` block (i.e. just before the final closing `});` of the outer `describe('CategorySelect', ...)`):

```typescript
describe('manage hint link', () => {
  it('should open the ManageCategories modal when clicked', () => {
    const modalService = TestBed.inject(NgbModal);
    const button = fixture.nativeElement.querySelector(
      '[data-testid="category-select-manage"]',
    ) as HTMLButtonElement;

    button.click();

    expect(modalService.open).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test --workspace=@bitbutler/app -- --include=src/app/components/category-select/category-select.spec.ts`

Expected: FAIL - the new "manage hint link > should open the ManageCategories modal when clicked" test throws `TypeError: Cannot read properties of null (reading 'click')` because no element matches `[data-testid="category-select-manage"]` yet.

- [ ] **Step 3: Replace `category-select.html`**

Replace the entire file contents with:

```html
<div class="container-fluid px-0">
  <div class="row">
    <div class="col-11">
      <div class="form-floating">
        <ng-select
          data-testid="category-select-input"
          [items]="categories()"
          [searchable]="true"
          [clearable]="true"
          [formControl]="selectControl"
          [keyDownFn]="keyDownFn"
          [openOnEnter]="false"
          #ngselect
        ></ng-select>
        <label>{{ 'components.category-select.label' | translate }}</label>
      </div>
    </div>

    <div class="col-1 d-flex align-items-center">
      <bb-popover
        [subject]="'components.category-select.popover.title' | translate"
        [description]="categoryPopover"
        placement="left"
      ></bb-popover>
    </div>
  </div>

  <div class="form-text">
    <button
      type="button"
      class="btn btn-link btn-sm p-0 align-baseline"
      data-testid="category-select-manage"
      (click)="openManageCategories()"
    >
      {{ 'components.category-select.manage' | translate }}
    </button>
  </div>
</div>

<ng-template #categoryPopover>
  <p>{{ 'components.category-select.popover.description.line1' | translate }}</p>
  <p>{{ 'components.category-select.popover.description.line2' | translate }}</p>
</ng-template>
```

This removes the `<ng-template ng-footer-tmp>` block and adds the hint link below the row.

- [ ] **Step 4: Update `category-select.ts` imports**

In `packages/app/src/app/components/category-select/category-select.ts`, change the `@ng-select/ng-select` import (currently):

```typescript
import { NgFooterTemplateDirective, NgSelectComponent } from '@ng-select/ng-select';
```

to:

```typescript
import { NgSelectComponent } from '@ng-select/ng-select';
```

Then in the `@Component` decorator's `imports` array, remove the `NgFooterTemplateDirective` entry:

```typescript
  imports: [
    CommonModule,
    ReactiveFormsModule,
    NgSelectComponent,
    TranslatePipe,
    BbPopover,
  ],
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npm run test --workspace=@bitbutler/app -- --include=src/app/components/category-select/category-select.spec.ts`

Expected: PASS - all 9 tests pass (8 existing + the new "manage hint link" test).

- [ ] **Step 6: Commit**

```bash
git add packages/app/src/app/components/category-select/category-select.html packages/app/src/app/components/category-select/category-select.ts packages/app/src/app/components/category-select/category-select.spec.ts
git commit -m "#143: replace category select footer manage button with hint link"
```

---

### Task 3: Final verification

**Files:** none (verification only)

- [ ] **Step 1: Run lint across the repo**

Run: `npm run lint`

Expected: PASS with zero warnings/errors (the removed `NgFooterTemplateDirective` import must not leave an unused-import lint error).

- [ ] **Step 2: Run the full app test suite**

Run: `npm run test --workspace=@bitbutler/app`

Expected: PASS - all tests in `packages/app` pass, including the two new "manage hint link" tests.

- [ ] **Step 3: Manual verification in the running app**

Run: `npm start`

In the app:

1. Open the "Add Torrent" dialog (it renders both `app-tag-select` and `app-category-select`).
2. Confirm the dropdown no longer shows a "Manage tags"/"Manage categories" button when opened.
3. Confirm a "Manage tags"/"Manage categories" link is visible below each input at all times.
4. Click each link and confirm the corresponding `ManageTags`/`ManageCategories` modal opens.
5. Confirm the popover (`i`) icon next to each input is still vertically aligned with the input as before.

Close the app when done (no code changes expected from this step; if something looks wrong, fix it in the relevant component file from Task 1/2 and re-run Steps 1-2).
