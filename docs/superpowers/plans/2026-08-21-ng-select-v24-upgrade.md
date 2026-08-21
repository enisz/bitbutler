# ng-select v24 Upgrade Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bump `@ng-select/ng-select` from `20.7.0` to `24.0.2` and remove the now-obsolete `appendTo` clipping workaround, since the dropdown panel renders via Angular CDK Overlay in v24.

**Architecture:** No architectural change - this is a dependency bump plus removal of a workaround pattern that's now redundant. The app already forces `.cdk-overlay-container` to `z-index: 11000` for its own CDK Overlay usages (toasts, context menu), so ng-select's overlay-rendered panel inherits correct stacking without `appendTo`.

**Tech Stack:** Angular 22 (zoneless), `@ng-select/ng-select`, `@angular/cdk`, ag-grid-angular (for the column-filter popup interaction), Vitest.

**Spec:** `docs/superpowers/specs/2026-08-21-ng-select-v24-upgrade-design.md`

## Global Constraints

- Target version: `@ng-select/ng-select@24.0.2` (root `package.json`, this repo hoists all Angular deps to the workspace root - `@bitbutler/app`'s own `package.json` only lists `@bitbutler/shared`).
- Do not touch `ag-grid-angular`, `better-sqlite3`, `electron`, or `bootstrap`/`ng-bootstrap` - tracked separately under #270.
- Do not add a backwards-compat shim for the removed `appendTo` inputs - remove them outright (per CLAUDE.md: no compat shims for internal-only APIs).
- `npm run lint` must stay at zero warnings (`max-warnings=0`) after every task.
- Commit format: `#273: <short description>`.

---

### Task 1: Bump the ng-select dependency and verify baseline

**Files:**

- Modify: `package.json:219`

**Interfaces:**

- Produces: an installed `@ng-select/ng-select@^24.0.2` in `node_modules` and an updated `package-lock.json`, which every later task builds on.

- [ ] **Step 1: Bump the version**

In `package.json`, change:

```json
    "@ng-select/ng-select": "^20.7.0",
```

to:

```json
    "@ng-select/ng-select": "^24.0.2",
```

- [ ] **Step 2: Install and update the lockfile**

Run: `npm install`
Expected: resolves cleanly (peer deps `@angular/cdk`/`@angular/core`/`@angular/common`/`@angular/forms` are already `^22.1.3`, satisfying v24's `^22.0.0` peer requirement). `package-lock.json` updates to reflect the new resolved version tree.

- [ ] **Step 3: Run lint, build, and tests to check for pure version-bump breakage**

Run: `npm run lint && npm run build && npm test`
Expected: all three pass. If `build` or `test` fails on a type error inside `save-path-select.ts` (e.g. `DropdownPosition` type shape) or elsewhere, fix the type-level issue now, before starting the `appendTo` removal in Task 2 - keep this task scoped to "the bump alone builds and passes."

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json
git commit -m "#273: bump @ng-select/ng-select to 24.0.2"
```

---

### Task 2: Remove `appendTo` from the wrapper components

**Files:**

- Modify: `packages/app/src/app/components/category-select/category-select.ts:57`
- Modify: `packages/app/src/app/components/category-select/category-select.html:13`
- Modify: `packages/app/src/app/components/tag-select/tag-select.ts:49`
- Modify: `packages/app/src/app/components/tag-select/tag-select.html:16`
- Modify: `packages/app/src/app/components/save-path-select/save-path-select.ts:59`
- Modify: `packages/app/src/app/components/save-path-select/save-path-select.html:35`
- Modify: `packages/app/src/app/components/save-path-select/save-path-select.spec.ts:107-109`
- Modify: `packages/app/src/app/modals/add-torrent/general/general.html:279,298,304`
- Modify: `packages/app/src/app/modals/settings/general/general.html:165`

**Interfaces:**

- Consumes: the v24 install from Task 1.
- Produces: `category-select`, `tag-select`, `save-path-select` with no `appendTo` input - later tasks (and any other consumer) must not reference it on these three components.

- [ ] **Step 1: Remove the input and its template binding from `category-select`**

In `category-select.ts`, delete:

```typescript
  public readonly appendTo = input('');
```

In `category-select.html`, remove the `[appendTo]="appendTo()"` line from the `<ng-select>` element (currently line 13), leaving:

```html
<ng-select
  [items]="categories()"
  [searchable]="true"
  [clearable]="true"
  [addTag]="addTag"
  [formControl]="selectControl"
  [keyDownFn]="keyDownFn"
  [openOnEnter]="false"
  #ngselect
></ng-select>
```

- [ ] **Step 2: Remove the input and its template binding from `tag-select`**

In `tag-select.ts`, delete:

```typescript
  public readonly appendTo = input('');
```

In `tag-select.html`, remove the `[appendTo]="appendTo()"` line from the `<ng-select>` element (currently line 16), leaving:

```html
<ng-select
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

- [ ] **Step 3: Remove the input and its template binding from `save-path-select`**

In `save-path-select.ts`, delete:

```typescript
  readonly appendTo = input('');
```

In `save-path-select.html`, remove the `[appendTo]="appendTo()"` line from the `<ng-select>` element (currently line 35), leaving the surrounding bindings (`[items]`, `[addTag]`, `[searchable]`, etc.) intact.

- [ ] **Step 4: Remove the obsolete test in `save-path-select.spec.ts`**

Delete this block (currently lines 107-109):

```typescript
it('should have appendTo empty string by default', () => {
  expect(component.appendTo()).toBe('');
});
```

- [ ] **Step 5: Fix the four call sites passing `appendTo="body"` into these components**

In `packages/app/src/app/modals/add-torrent/general/general.html`:

Change (line ~277-283):

```html
<app-save-path-select
  formControlName="savepath"
  appendTo="body"
  [autofocus]="true"
  [clearable]="true"
  [placeholder]="defaultSavePath()"
></app-save-path-select>
```

to:

```html
<app-save-path-select
  formControlName="savepath"
  [autofocus]="true"
  [clearable]="true"
  [placeholder]="defaultSavePath()"
></app-save-path-select>
```

Change (line ~298):

```html
<app-category-select formControlName="category" appendTo="body"></app-category-select>
```

to:

```html
<app-category-select formControlName="category"></app-category-select>
```

Change (line ~304):

```html
<app-tag-select formControlName="tags" appendTo="body"></app-tag-select>
```

to:

```html
<app-tag-select formControlName="tags"></app-tag-select>
```

In `packages/app/src/app/modals/settings/general/general.html`, change (line ~165):

```html
<app-save-path-select [inputType]="'select'" [clearable]="true" appendTo="body" />
```

to:

```html
<app-save-path-select [inputType]="'select'" [clearable]="true" />
```

- [ ] **Step 6: Run the affected unit tests**

Run: `npm test -- --run save-path-select category-select tag-select` (adjust the filter to however this workspace's Vitest config matches test files; if that filter doesn't resolve, run `npm test` for the full `@bitbutler/app` suite instead)
Expected: all pass, with no reference to `appendTo` left in any of the three components' specs.

- [ ] **Step 7: Lint and build**

Run: `npm run lint && npm run build`
Expected: both pass - no unknown-input template errors at the four call sites, no unused-input lint errors on the wrapper components.

- [ ] **Step 8: Commit**

```bash
git add packages/app/src/app/components/category-select packages/app/src/app/components/tag-select packages/app/src/app/components/save-path-select packages/app/src/app/modals/add-torrent/general/general.html packages/app/src/app/modals/settings/general/general.html
git commit -m "#273: remove obsolete appendTo input from category-select, tag-select, and save-path-select"
```

---

### Task 3: Remove the remaining raw `appendTo="body"` attributes

**Files:**

- Modify: `packages/app/src/app/components/bb-file-tree/bb-file-tree.html:180,279`
- Modify: `packages/app/src/app/modals/set-torrent-tags/set-torrent-tags.html:38`
- Modify: `packages/app/src/app/modals/qb-settings/seeding-ratios/seeding-ratios.html:53`
- Modify: `packages/app/src/app/modals/add-torrent/options/options.html:16`
- Modify: `packages/app/src/app/modals/qb-settings/bandwidth/bandwidth.html:133,148,161,181,194`
- Modify: `packages/app/src/app/modals/manage-categories/manage-categories.html:93`
- Modify: `packages/app/src/app/modals/set-torrent-category/set-torrent-category.html:38`
- Modify: `packages/app/src/app/modals/qb-settings/storage/storage.html:88,111,127,143,159`
- Modify: `packages/app/src/app/modals/settings/server/server.html:152`
- Modify: `packages/app/src/app/modals/settings/general/general.html:211,250,287,422,468,519`
- Modify: `packages/app/src/app/modals/set-path/set-path.html:45`
- Modify: `packages/app/src/app/modals/settings/torrent-list-grid/torrent-list-grid.html:149,330`

**Interfaces:**

- Consumes: nothing from Task 2 (these are all direct `<ng-select>` usages, independent of the wrapper components).
- Produces: zero remaining `appendTo="body"` occurrences anywhere in `packages/app/src`, while leaving the `[appendTo]="popupPortalSelector"` bindings in `packages/app/src/app/components/column-filters/*` untouched (those solve the ag-grid popup problem, handled in Task 4).

- [ ] **Step 1: Delete each `appendTo="body"` attribute**

For every file:line pair listed above, open the file and delete the
`appendTo="body"` attribute line from the `<ng-select>` element (it is
always its own line in these templates - remove the whole line, no other
attribute changes).

- [ ] **Step 2: Verify no stray occurrences remain**

Run: `grep -rn 'appendTo="body"' packages/app/src`
Expected: no output.

Run: `grep -rn 'appendTo' packages/app/src/app/components/column-filters`
Expected: only the `[appendTo]="popupPortalSelector"` bindings remain (untouched).

- [ ] **Step 3: Lint and build**

Run: `npm run lint && npm run build`
Expected: both pass.

- [ ] **Step 4: Commit**

```bash
git add packages/app/src/app/components/bb-file-tree packages/app/src/app/modals
git commit -m "#273: remove obsolete appendTo=\"body\" from ng-select templates"
```

---

### Task 4: Theming cleanup and ag-grid popup comment cleanup

**Files:**

- Modify: `packages/app/src/styles/_ng-select.scss`
- Modify: `packages/app/src/app/components/column-filters/operator-filter-base.ts:5-11,40-44`

**Interfaces:**

- Consumes: nothing from Tasks 2-3.
- Produces: no functional change - comment/dead-CSS cleanup only. Later manual QA (Task 5) verifies the result visually.

- [ ] **Step 1: Drop the hardcoded z-index on the dropdown panel**

In `packages/app/src/styles/_ng-select.scss`, in the `.ng-dropdown-panel` rule, delete this line:

```scss
z-index: 9999 !important;
```

- [ ] **Step 2: Update the stale comment in `operator-filter-base.ts`**

Replace the JSDoc comment above `AG_GRID_CUSTOM_POPUP_CLASS` (currently):

```typescript
/**
 * ag-grid closes a filter popup on any mousedown outside its DOM subtree, unless the click
 * target is inside an element carrying this class (see ag-grid's PopupService). ng-select's
 * `appendTo` moves its dropdown panel out of the filter's DOM (to avoid being clipped by the
 * popup's bounds), so the panel must be appended into an element tagged with this class instead
 * of directly into `body`.
 */
```

with:

```typescript
/**
 * ag-grid closes a filter popup on any mousedown outside its DOM subtree, unless the click
 * target is inside an element carrying this class (see ag-grid's PopupService). ng-select's
 * dropdown panel renders into a CDK Overlay outside the filter's DOM, so `appendTo` is used to
 * contain it inside an element tagged with this class instead - otherwise a click inside the
 * dropdown would register as "outside" and ag-grid would close the filter popup.
 */
```

Replace the comment inside `agInit` (currently):

```typescript
// ng-select positions its appended dropdown relative to the appendTo target's own
// getBoundingClientRect(), so the target must be the dropdown's actual CSS containing
// block (position !== static) or the two reference frames diverge and the panel renders
// off-screen.
this.popupPortal.style.position = 'relative';
```

with:

```typescript
// Needs a non-static position so it establishes its own containing block - CDK Overlay
// positions the dropdown panel via viewport coordinates regardless, but this keeps the
// portal a well-formed positioning context for anything else appended into it.
this.popupPortal.style.position = 'relative';
```

- [ ] **Step 3: Lint and build**

Run: `npm run lint && npm run build`
Expected: both pass.

- [ ] **Step 4: Commit**

```bash
git add packages/app/src/styles/_ng-select.scss packages/app/src/app/components/column-filters/operator-filter-base.ts
git commit -m "#273: drop obsolete z-index override and update stale appendTo comments"
```

---

### Task 5: Manual QA pass

**Files:** none (verification only, using the `run` skill / dev server).

**Interfaces:**

- Consumes: the fully migrated app from Tasks 1-4.
- Produces: a pass/fail confirmation that there is no visual or behavioral regression, which gates opening the PR.

- [ ] **Step 1: Start the app**

Run: `npm start` (Angular dev server + Electron) and wait for the Electron window to open.

- [ ] **Step 2: Exercise every affected select**

Open each of the following and confirm the dropdown opens fully visible (not clipped), closes on selection/outside-click, and is styled consistently with the rest of the theme (check both a light and a dark theme via the theme switcher):

- Login page path/server select
- Add Torrent modal: general tab (save path, category, tag selects), options tab (root folder select)
- Set Path modal, Set Torrent Category modal, Set Torrent Tags modal, Manage Categories modal
- qB Settings modal: Bandwidth tab, Storage tab, Seeding Ratios tab
- Settings modal: General tab, Server tab, Torrent List Grid tab
- The file tree's path selects (`bb-file-tree`)

- [ ] **Step 3: Verify the ag-grid column filters**

Open the torrent grid, open a filter popup for a column using one of the affected filters (duration, size, boolean, ratio-limit, time-limit, number, text), interact with its embedded `ng-select`, and confirm the filter popup does NOT close while doing so (this is the ag-grid `PopupService` / `ag-custom-component-popup` interaction from Task 4).

- [ ] **Step 4: Spot-check Escape behavior**

In a modal containing a select (e.g. Add Torrent), open the select's dropdown and press Escape - confirm it closes the dropdown only. Press Escape again with the dropdown closed - confirm it now closes the modal.

- [ ] **Step 5: Record and fix any regressions found**

If any of the above steps surfaces a regression, fix it now (this task does not end until Steps 2-4 all pass), then re-run Steps 2-4 for the affected area only.

---

### Task 6: Final cleanup before PR

**Files:**

- Delete: `docs/superpowers/` (the `specs/2026-08-21-ng-select-v24-upgrade-design.md` and `plans/2026-08-21-ng-select-v24-upgrade.md` files created for this work)

**Interfaces:** none - this is the last task.

- [ ] **Step 1: Remove the spec and plan docs**

Per CLAUDE.md, `docs/superpowers` specs/plans must not be merged to main - remove them in their own commit once implementation is done, before opening the PR.

```bash
git rm -r docs/superpowers
git commit -m "#273: removed spec and plan"
```

- [ ] **Step 2: Final whole-branch review**

Per CLAUDE.md's plan-execution convention, do one review of the full branch diff now (not per-task) before opening the PR - e.g. via the `code-review` skill or `pr-review-toolkit:review-pr`.
