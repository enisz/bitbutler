# Save-Path Select Reusable Component Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add three inputs to `SavePathSelect` (`clearable`, `showPopover`, `label`) and wire the component into `manage-categories` and `server` settings, eliminating duplicated path-list logic from `server.ts`.

**Architecture:** A single `ControlValueAccessor` component gains three inputs with backwards-compatible defaults. When `showPopover = true` (default), the existing `container-fluid > col-11 + col-1` layout is preserved. When `showPopover = false`, only a bare `form-floating` div is rendered. All existing callers (`add-torrent`, `set-torrent-location`) require zero changes.

**Tech Stack:** Angular 20 (standalone, signals, zoneless), ng-select `@ng-select/ng-select`, `@ngx-translate`, Vitest via `@angular/build:unit-test`

---

## Notes for Implementers

**Test runner:** Tests use Vitest (`vi.fn()`, `vi.spyOn()`), not Jasmine. Run with `npm test` from the repo root (runs all workspaces).

**Global test providers:** `packages/app/src/test-providers.ts` registers `provideTranslateService()`, `provideZonelessChangeDetection()`, and several pipes for every test. This is why `TranslatePipe` works in `SavePathSelect` tests without any per-test setup.

**Why `save-path-select.spec.ts` only mocks `TorrentStoreService`:** `SavePathSelect` also injects `QbService` and `ServerStoreService`, but `ServerStoreService.currentServerId()` returns `null` in the test environment (no server configured). The `ngOnInit` guard `if (serverId)` prevents `getAppPreferences` from ever being called, so neither service needs to be mocked.

**`class="flex-grow-1"` on `<app-save-path-select>`:** Applying a CSS class directly to a component element targets its host element. In a `d-flex` parent, `flex-grow-1` on the host makes the component expand to fill available space — the inner `form-floating` div fills the host width naturally as a block element.

**`@let` + `@if` on the same line (Task 2):** The prettier Angular plugin collapses `@let resolvedLabel = ...; @if (showPopover) {` onto a single line. This is valid Angular 17+ template syntax — `@let` ends at `;` and `@if` starts immediately after. Prettier will produce the same formatting when you run lint-staged on commit, so copy the code block as-is.

---

## File Map

| File                                                                                 | Change                                                                      |
| ------------------------------------------------------------------------------------ | --------------------------------------------------------------------------- |
| `packages/app/src/app/components/save-path-select/save-path-select.ts`               | Add 3 inputs                                                                |
| `packages/app/src/app/components/save-path-select/save-path-select.html`             | Conditional layout; `[clearable]` binding; `@let` label resolution          |
| `packages/app/src/app/components/save-path-select/save-path-select.spec.ts`          | Tests for new inputs and layout branching                                   |
| `packages/app/src/app/components/modals/manage-categories/manage-categories.ts`      | Import `SavePathSelect`; change two `FormControl` types; update `startEdit` |
| `packages/app/src/app/components/modals/manage-categories/manage-categories.spec.ts` | Add test for null savePath in `startEdit`                                   |
| `packages/app/src/app/components/modals/manage-categories/manage-categories.html`    | Replace two plain `<input>` blocks with `<app-save-path-select>`            |
| `packages/app/src/app/pages/settings/server/server.ts`                               | Remove 3 duplicated members; import `SavePathSelect`                        |
| `packages/app/src/app/pages/settings/server/server.html`                             | Replace inline `<ng-select>` block with `<app-save-path-select>`            |

**Not changed:** `add-torrent.ts/html`, `set-torrent-location.ts/html` — new input defaults match their current behaviour exactly.

---

### Task 1: Add inputs to SavePathSelect TypeScript

**Files:**

- Modify: `packages/app/src/app/components/save-path-select/save-path-select.ts`
- Modify: `packages/app/src/app/components/save-path-select/save-path-select.spec.ts`

- [ ] **Step 1: Write failing tests for the three new inputs**

In `save-path-select.spec.ts`, add a new `describe` block after the existing ones:

```typescript
describe('inputs', () => {
  it('should have clearable false by default', () => {
    expect(component.clearable).toBeFalse();
  });

  it('should have showPopover true by default', () => {
    expect(component.showPopover).toBeTrue();
  });

  it('should have label null by default', () => {
    expect(component.label).toBeNull();
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npm test
```

Expected: 3 failures — `component.clearable`, `component.showPopover`, `component.label` are undefined.

- [ ] **Step 3: Add the three inputs to `save-path-select.ts`**

After the existing `@Input() autofocus = false;` line (line 41), insert:

```typescript
@Input() clearable = false;
@Input() showPopover = true;
@Input() label: string | null = null;
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
npm test
```

Expected: all tests pass including the 3 new ones.

- [ ] **Step 5: Commit**

```bash
git add packages/app/src/app/components/save-path-select/save-path-select.ts packages/app/src/app/components/save-path-select/save-path-select.spec.ts
git commit -m "#100: add clearable, showPopover, label inputs to SavePathSelect"
```

---

### Task 2: Update SavePathSelect template

**Files:**

- Modify: `packages/app/src/app/components/save-path-select/save-path-select.html`
- Modify: `packages/app/src/app/components/save-path-select/save-path-select.spec.ts`

- [ ] **Step 1: Write failing DOM tests**

Add to `save-path-select.spec.ts`, inside the `describe('inputs')` block from Task 1:

```typescript
it('should render bb-popover when showPopover is true (default)', () => {
  fixture.detectChanges();
  expect(fixture.nativeElement.querySelector('bb-popover')).not.toBeNull();
});

it('should not render bb-popover when showPopover is false', () => {
  component.showPopover = false;
  fixture.detectChanges();
  expect(fixture.nativeElement.querySelector('bb-popover')).toBeNull();
});

it('should render container-fluid wrapper when showPopover is true (default)', () => {
  fixture.detectChanges();
  expect(fixture.nativeElement.querySelector('.container-fluid')).not.toBeNull();
});

it('should not render container-fluid wrapper when showPopover is false', () => {
  component.showPopover = false;
  fixture.detectChanges();
  expect(fixture.nativeElement.querySelector('.container-fluid')).toBeNull();
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npm test
```

Expected: 2 failures — `showPopover = false` tests fail because the template does not yet branch.

- [ ] **Step 3: Replace `save-path-select.html` entirely**

```html
@let resolvedLabel = label ?? ('components.save-path-select.label' | translate); @if (showPopover) {
<div class="container-fluid px-0">
  <div class="row">
    <div class="col-11">
      <div class="form-floating">
        <ng-select
          [items]="paths()"
          [addTag]="addTag"
          [searchable]="true"
          [clearable]="clearable"
          [clearOnBackspace]="false"
          [editableSearchTerm]="true"
          [formControl]="selectControl"
          [keyDownFn]="keyDownFn"
          [markFirst]="true"
          [openOnEnter]="false"
          [placeholder]="defaultPath()"
          [fixedPlaceholder]="false"
          (search)="resetHighlight()"
          (open)="resetHighlight()"
          #ngselect
        >
        </ng-select>
        <label>{{ resolvedLabel }}</label>
      </div>
    </div>

    <div class="col-1 d-flex align-items-center">
      <bb-popover
        [subject]="'components.save-path-select.popover.title' | translate"
        [description]="savePathPopover"
        placement="left"
      ></bb-popover>
    </div>
  </div>
</div>
} @else {
<div class="form-floating">
  <ng-select
    [items]="paths()"
    [addTag]="addTag"
    [searchable]="true"
    [clearable]="clearable"
    [clearOnBackspace]="false"
    [editableSearchTerm]="true"
    [formControl]="selectControl"
    [keyDownFn]="keyDownFn"
    [markFirst]="true"
    [openOnEnter]="false"
    [placeholder]="defaultPath()"
    [fixedPlaceholder]="false"
    (search)="resetHighlight()"
    (open)="resetHighlight()"
    #ngselect
  >
  </ng-select>
  <label>{{ resolvedLabel }}</label>
</div>
}

<ng-template #savePathPopover>
  <p>{{ 'components.save-path-select.popover.description.line1' | translate }}</p>
  <p>{{ 'components.save-path-select.popover.description.line2' | translate }}</p>
</ng-template>
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
npm test
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add packages/app/src/app/components/save-path-select/save-path-select.html packages/app/src/app/components/save-path-select/save-path-select.spec.ts
git commit -m "#100: conditional layout and clearable binding in SavePathSelect template"
```

---

### Task 3: Update manage-categories TypeScript

**Files:**

- Modify: `packages/app/src/app/components/modals/manage-categories/manage-categories.ts`
- Modify: `packages/app/src/app/components/modals/manage-categories/manage-categories.spec.ts`

The `savePath` form control changes type to `FormControl<string | null>`. `editSavePathControl` changes type to `FormControl<string | null>`. `startEdit` sets the control to `item.savePath || null` so an empty save path shows as a blank clearable field (not an empty-string non-null value that would hide the placeholder).

- [ ] **Step 1: Write a failing test for the null-savePath case in `startEdit`**

In `manage-categories.spec.ts`, add inside `describe('startEdit')` after the existing two tests:

```typescript
it('should set editSavePathControl to null when item savePath is empty', () => {
  const movies = component.categories().find((c) => c.name === 'movies')!;
  component.startEdit(movies);
  expect(component.editSavePathControl.value).toBeNull();
});
```

- [ ] **Step 2: Run tests to confirm the new test fails**

```bash
npm test
```

Expected: 1 failure — `editSavePathControl.value` is `''` not `null` because `startEdit` still calls `setValue(item.savePath)` directly.

- [ ] **Step 3: Update `manage-categories.ts`**

Make four changes:

**1. Add import** at the top (after the existing imports):

```typescript
import { SavePathSelect } from '../../save-path-select/save-path-select';
```

**2. Add `SavePathSelect` to the component `imports` array:**

```typescript
imports: [
  ReactiveFormsModule,
  TranslatePipe,
  FontAwesomeModule,
  NgbTooltipModule,
  BbSpinner,
  AutofocusDirective,
  SavePathSelect,
],
```

**3. Change `addForm.savePath` control** (inside `addForm = new FormGroup({...})`):

```typescript
savePath: new FormControl<string | null>(null),
```

**4. Change `editSavePathControl` declaration and update `startEdit`:**

```typescript
public editSavePathControl = new FormControl<string | null>(null);
```

```typescript
public startEdit(item: CategoryItem): void {
  this.categories.set(this.categories().map((c) => ({ ...c, editing: c.name === item.name })));
  this.editSavePathControl.setValue(item.savePath || null);
}
```

- [ ] **Step 4: Run tests to confirm all pass**

```bash
npm test
```

Expected: all tests pass including the new one. The existing `startEdit` test for `/downloads/linux` still passes because `/downloads/linux` is truthy and is preserved.

- [ ] **Step 5: Commit**

```bash
git add packages/app/src/app/components/modals/manage-categories/manage-categories.ts packages/app/src/app/components/modals/manage-categories/manage-categories.spec.ts
git commit -m "#100: import SavePathSelect and update FormControl types in ManageCategories"
```

---

### Task 4: Update manage-categories template

**Files:**

- Modify: `packages/app/src/app/components/modals/manage-categories/manage-categories.html`

- [ ] **Step 1: Replace the add-form save-path input**

Find and replace this block in the add form (the second `form-floating flex-grow-1` div, around lines 28-38):

```html
<div class="form-floating flex-grow-1">
  <input
    type="text"
    class="form-control"
    id="category-save-path"
    placeholder="Save path"
    formControlName="savePath"
    (keydown.enter)="add()"
  />
  <label for="category-save-path">
    {{ 'components.modals.manage-categories.add-form.save-path' | translate }}
  </label>
</div>
```

Replace with:

```html
<app-save-path-select
  class="flex-grow-1"
  [showPopover]="false"
  [clearable]="true"
  formControlName="savePath"
></app-save-path-select>
```

Note: `(keydown.enter)="add()"` is intentionally dropped — pressing Enter inside ng-select selects/confirms a dropdown item. The user adds via the Add button.

- [ ] **Step 2: Replace the edit-row save-path input**

Find the `@if (item.editing)` branch. Replace the entire `<li>` content with the following (keyboard handlers move from the `<input>` up to the `<li>`):

```html
<li class="list-group-item" (keydown.enter)="saveEdit(item)" (keydown.escape)="cancelEdit()">
  <div class="d-flex gap-2 align-items-center">
    <app-save-path-select
      class="flex-grow-1"
      [showPopover]="false"
      [clearable]="true"
      [label]="item.name"
      [formControl]="editSavePathControl"
    ></app-save-path-select>
    <div class="d-flex gap-1">
      <button
        type="button"
        class="btn btn-link text-success p-1"
        [ngbTooltip]="'general.button.save' | translate"
        tooltipClass="single-line-tooltip"
        (click)="saveEdit(item)"
      >
        <fa-icon [icon]="icon.faCheck"></fa-icon>
      </button>
      <button
        type="button"
        class="btn btn-link text-danger p-1"
        [ngbTooltip]="'general.button.cancel' | translate"
        tooltipClass="single-line-tooltip"
        (click)="cancelEdit()"
      >
        <fa-icon [icon]="icon.faX"></fa-icon>
      </button>
    </div>
  </div>
</li>
```

Keyboard behaviour rationale:

- `(keydown.enter)` on `<li>`: when the ng-select dropdown is open, Enter selects the highlighted path and the event bubbles to `<li>` triggering `saveEdit` — one keystroke to select and confirm.
- `(keydown.escape)` on `<li>`: `SavePathSelect.keyDownFn` returns `false` for Escape, so ng-select skips its own handling; the native event bubbles to `<li>` and fires `cancelEdit`.

- [ ] **Step 3: Build to check for template errors**

```bash
npm run build 2>&1 | tail -20
```

Expected: build completes with 0 errors.

- [ ] **Step 4: Run tests**

```bash
npm test
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add packages/app/src/app/components/modals/manage-categories/manage-categories.html
git commit -m "#100: replace plain save-path inputs with SavePathSelect in manage-categories"
```

---

### Task 5: Update server TypeScript

**Files:**

- Modify: `packages/app/src/app/pages/settings/server/server.ts`

Remove the three members in `server.ts` that duplicate logic already inside `SavePathSelect`, then import the component.

- [ ] **Step 1: Delete the `paths` computed signal, `addTag`, and `keyDownFn`**

Remove these three blocks from `server.ts`:

```typescript
// DELETE this block (paths computed signal):
public paths = computed(
  () => {
    const uniquePaths = new Set<string>();
    for (const t of this.torrentStoreService.torrentsArray()) {
      const path = t.save_path?.trim();
      if (path) uniquePaths.add(path);
    }
    return Array.from(uniquePaths).sort();
  },
  { equal: (a, b) => a.length === b.length && a.every((v, i) => v === b[i]) },
);

// DELETE this block (addTag + keyDownFn):
addTag = (term: string): string => term;

keyDownFn(event: KeyboardEvent): boolean {
  if (event.key === 'Escape') {
    return false;
  }
  return true;
}
```

- [ ] **Step 2: Remove `torrentStoreService` injection (now unused)**

Remove this line from the class body (the only consumer was `paths`):

```typescript
private readonly torrentStoreService = inject(TorrentStoreService);
```

- [ ] **Step 3: Clean up unused imports in `server.ts`**

Three imports become unused after the removals above:

1. Remove `TorrentStoreService` from the service import:

   ```typescript
   // BEFORE:
   import { TorrentStoreService } from '../../../services/torrent-store.service';

   // AFTER: delete this entire line
   ```

2. Remove `computed` from the `@angular/core` import (it was only used by `paths`):

   ```typescript
   // BEFORE:
   import { CommonModule, DestroyRef, NgZone, OnInit, computed, inject } from '@angular/core';
   // AFTER:
   import { CommonModule, DestroyRef, NgZone, OnInit, inject } from '@angular/core';
   ```

3. `NgSelectComponent` is still in the template at this point — do **not** remove it yet; that happens in Task 6.

- [ ] **Step 4: Add `SavePathSelect` import and to `imports` array**

Add at the top of the file (after the existing imports):

```typescript
import { SavePathSelect } from '../../../components/save-path-select/save-path-select';
```

Add `SavePathSelect` to the component `imports` array (keep `NgSelectComponent` for now — it is still in the template):

```typescript
imports: [
  CommonModule,
  ReactiveFormsModule,
  NgSelectComponent,
  FontAwesomeModule,
  NgbTooltip,
  BbSpinner,
  BbPopover,
  TranslatePipe,
  SavePathSelect,
],
```

- [ ] **Step 5: Remove unused `TorrentStoreService` provider from `server.spec.ts`**

In `server.spec.ts`, remove the provider that was only needed because of the now-deleted `paths` computed:

```typescript
// DELETE this line from the providers array:
{ provide: TorrentStoreService, useValue: { torrentsArray: signal([]) } },
```

Also remove the unused import at the top of `server.spec.ts`:

```typescript
// DELETE:
import { TorrentStoreService } from '../../../services/torrent-store.service';
```

And remove the unused `signal` import if `signal` is no longer used anywhere in the file:

```typescript
// BEFORE (if signal is no longer used elsewhere):
import { NO_ERRORS_SCHEMA, signal } from '@angular/core';
// AFTER:
import { NO_ERRORS_SCHEMA } from '@angular/core';
```

- [ ] **Step 6: Run server tests**

```bash
npm test
```

Expected: all tests pass.

- [ ] **Step 7: Commit**

```bash
git add packages/app/src/app/pages/settings/server/server.ts packages/app/src/app/pages/settings/server/server.spec.ts
git commit -m "#100: remove duplicated paths/addTag/keyDownFn from Server, import SavePathSelect"
```

---

### Task 6: Update server template

**Files:**

- Modify: `packages/app/src/app/pages/settings/server/server.html`

- [ ] **Step 1: Replace the inline ng-select block for the remote path**

Find this block inside the `@for` loop, inside `[formGroupName]="i"`, in the first `col-5`:

```html
<div class="col-5">
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
</div>
```

Replace with:

```html
<div class="col-5">
  <app-save-path-select
    [showPopover]="false"
    [clearable]="true"
    [label]="'pages.settings.tab.server.server-settings-form.path-mapping.remote-path' | translate"
    formControlName="remote"
  ></app-save-path-select>
</div>
```

Notes:

- The `<div class="form-floating">` and `<label>` wrappers are removed — `SavePathSelect` renders its own `form-floating` when `showPopover = false`.
- `appendTo="ngb-modal-window"` is dropped — the settings page is not inside a modal, so this attribute was inert.

- [ ] **Step 2: Remove `NgSelectComponent` from `server.ts` (now unused in the template)**

In `server.ts`, remove `NgSelectComponent` from the `imports` array:

```typescript
imports: [
  CommonModule,
  ReactiveFormsModule,
  // NgSelectComponent,  ← remove this line
  FontAwesomeModule,
  NgbTooltip,
  BbSpinner,
  BbPopover,
  TranslatePipe,
  SavePathSelect,
],
```

Also remove its import statement:

```typescript
// DELETE:
import { NgSelectComponent } from '@ng-select/ng-select';
```

- [ ] **Step 3: Verify no stale references remain**

```bash
grep -n "paths()\|addTag\|keyDownFn" packages/app/src/app/pages/settings/server/server.html
```

Expected: no matches.

- [ ] **Step 4: Build to check for errors**

```bash
npm run build 2>&1 | tail -20
```

Expected: build completes with 0 errors.

- [ ] **Step 5: Run the full test suite and lint**

```bash
npm test && npm run lint
```

Expected: all tests pass across all workspaces, lint reports 0 warnings.

- [ ] **Step 6: Commit**

```bash
git add packages/app/src/app/pages/settings/server/server.ts packages/app/src/app/pages/settings/server/server.html
git commit -m "#100: replace inline ng-select with SavePathSelect in server path mappings"
```
