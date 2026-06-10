# Tag/Category Select - addTag Create Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let users type a tag or category that doesn't exist yet directly into `TagSelect` / `CategorySelect`, creating it on submit (not on type) for categories.

**Architecture:** Enable ng-select's `addTag` (identity function, mirroring `SavePathSelect`) on both selects. `CategorySelect` gains a public `ensureCategoryExists()` method that lazily creates a missing category via `QbService.addCategory(serverId, value, '')` when called. `SetTorrentCategory` and `AddTorrent` call it at the start of their submit handlers, aborting the submit if it returns `false`. Tags need no extra wiring - `addTorrentTags` auto-creates them server-side. The category-select popover gets a third, warning-styled paragraph explaining the empty-save-path implication.

**Tech Stack:** Angular 20 (standalone components, signals), `@ng-select/ng-select`, `@ngx-translate/core`, `@fortawesome/angular-fontawesome`, Vitest.

**Spec:** `docs/superpowers/specs/2026-06-10-tag-category-addtag-create.md`

---

### Task 1: TagSelect - enable `addTag`

**Files:**

- Modify: `packages/app/src/app/components/tag-select/tag-select.ts`
- Modify: `packages/app/src/app/components/tag-select/tag-select.html`
- Test: `packages/app/src/app/components/tag-select/tag-select.spec.ts`

- [ ] **Step 1: Write the failing test**

In `packages/app/src/app/components/tag-select/tag-select.spec.ts`, add a new `describe` block after the `keyDownFn` block (after line 68):

```ts
describe('addTag', () => {
  it('should return the trimmed term', () => {
    expect(component.addTag('  new-tag  ')).toBe('new-tag');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test --workspace=packages/app -- --watch=false --include=src/app/components/tag-select/tag-select.spec.ts`
Expected: FAIL with `component.addTag is not a function`

- [ ] **Step 3: Implement `addTag`**

In `packages/app/src/app/components/tag-select/tag-select.ts`, insert a new method between the closing brace of `setDisabledState` (line 89) and `keyDownFn` (line 91):

```ts
  setDisabledState?(isDisabled: boolean): void {
    if (isDisabled) {
      this.selectControl.disable();
    } else {
      this.selectControl.enable();
    }
  }

  addTag = (term: string): string => term.trim();

  keyDownFn(event: KeyboardEvent): boolean {
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test --workspace=packages/app -- --watch=false --include=src/app/components/tag-select/tag-select.spec.ts`
Expected: PASS (11 tests)

- [ ] **Step 5: Wire `addTag` into the template**

In `packages/app/src/app/components/tag-select/tag-select.html`, add `[addTag]="addTag"` to the `<ng-select>` right after `[clearSearchOnAdd]="true"`:

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

- [ ] **Step 6: Commit**

```bash
git add packages/app/src/app/components/tag-select/tag-select.ts packages/app/src/app/components/tag-select/tag-select.html packages/app/src/app/components/tag-select/tag-select.spec.ts
git commit -m "#143: enable addTag on TagSelect"
```

---

### Task 2: CategorySelect - `addTag` + `ensureCategoryExists()`

**Files:**

- Modify: `packages/app/src/app/components/category-select/category-select.ts`
- Modify: `packages/app/src/app/components/category-select/category-select.html`
- Test: `packages/app/src/app/components/category-select/category-select.spec.ts`

- [ ] **Step 1: Write the failing tests**

In `packages/app/src/app/components/category-select/category-select.spec.ts`:

1. Add `addCategory` to the `mockQbService` object (lines 14-16):

```ts
mockQbService = {
  getAllCategories: vi.fn().mockResolvedValue({ movies: {}, tv: {} }),
  addCategory: vi.fn().mockResolvedValue(undefined),
};
```

2. Add new `describe` blocks after the `keyDownFn` block (after line 76):

```ts
describe('addTag', () => {
  it('should return the trimmed term', () => {
    expect(component.addTag('  New Category  ')).toBe('New Category');
  });
});

describe('ensureCategoryExists', () => {
  beforeEach(async () => {
    await vi.waitUntil(() => component.categories().length > 0);
  });

  it('should return true and not call addCategory for an empty value', async () => {
    component.selectControl.setValue('');
    expect(await component.ensureCategoryExists()).toBe(true);
    expect(mockQbService.addCategory).not.toHaveBeenCalled();
  });

  it('should return true and not call addCategory for an existing category', async () => {
    component.selectControl.setValue('movies');
    expect(await component.ensureCategoryExists()).toBe(true);
    expect(mockQbService.addCategory).not.toHaveBeenCalled();
  });

  it('should create a new category and add it to the known list', async () => {
    component.selectControl.setValue('new-category');
    expect(await component.ensureCategoryExists()).toBe(true);
    expect(mockQbService.addCategory).toHaveBeenCalledWith('server-1', 'new-category', '');
    expect(component.categories()).toContain('new-category');
  });

  it('should return false when addCategory fails', async () => {
    mockQbService.addCategory.mockRejectedValueOnce(new Error('failed'));
    component.selectControl.setValue('bad-category');
    expect(await component.ensureCategoryExists()).toBe(false);
    expect(component.categories()).not.toContain('bad-category');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test --workspace=packages/app -- --watch=false --include=src/app/components/category-select/category-select.spec.ts`
Expected: FAIL - `component.addTag is not a function` and `component.ensureCategoryExists is not a function`

- [ ] **Step 3: Implement `addTag` and `ensureCategoryExists`**

In `packages/app/src/app/components/category-select/category-select.ts`, insert `addTag` between the closing brace of `setDisabledState` (line 98) and `keyDownFn` (line 100):

```ts
  setDisabledState?(isDisabled: boolean): void {
    if (isDisabled) {
      this.selectControl.disable();
    } else {
      this.selectControl.enable();
    }
  }

  addTag = (term: string): string => term.trim();

  keyDownFn(event: KeyboardEvent): boolean {
    if (event.key === 'Escape') {
      return false;
    }

    return true;
  }

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

  public openManageCategories(): void {
```

(`ensureCategoryExists` replaces the line break between the existing `keyDownFn` and `openManageCategories` methods - `keyDownFn`'s body is unchanged, only the new method is inserted before `openManageCategories`.)

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm run test --workspace=packages/app -- --watch=false --include=src/app/components/category-select/category-select.spec.ts`
Expected: PASS (15 tests)

- [ ] **Step 5: Wire `addTag` into the template**

In `packages/app/src/app/components/category-select/category-select.html`, add `[addTag]="addTag"` to the `<ng-select>` right after `[clearable]="true"`:

```html
<ng-select
  data-testid="category-select-input"
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

- [ ] **Step 6: Commit**

```bash
git add packages/app/src/app/components/category-select/category-select.ts packages/app/src/app/components/category-select/category-select.html packages/app/src/app/components/category-select/category-select.spec.ts
git commit -m "#143: add addTag and ensureCategoryExists to CategorySelect"
```

---

### Task 3: CategorySelect - popover warning (empty save path)

**Files:**

- Modify: `packages/app/src/app/components/category-select/category-select.ts`
- Modify: `packages/app/src/app/components/category-select/category-select.html`
- Modify: `public/i18n/us.json`
- Modify: `public/i18n/hu.json`

- [ ] **Step 1: Add the i18n strings**

In `public/i18n/us.json`, update the `category-select.popover.description` block (around line 171-174):

```json
        "description": {
          "line1": "Assigns the torrent to a category. Categories are useful for organizing your downloads and can also define a default save path.",
          "line2": "If Auto TMM is enabled, changing the category may automatically move the files.",
          "line3": "Adding a new category here creates it with an empty save path. Whether this affects where your torrents are stored depends on the qBittorrent 'Default torrent management mode' and 'When category save path changes' settings."
        }
```

In `public/i18n/hu.json`, update the same block (around line 171-174):

```json
        "description": {
          "line1": "Kategóriát rendel a torrenthez. A kategóriák hasznosak a letöltések rendszerezéséhez, és alapértelmezett mentési útvonalat is meghatározhatnak.",
          "line2": "Ha az automatikus torrentkezelés (TMM) engedélyezve van, a kategória megváltoztatása automatikusan áthelyezheti a fájlokat.",
          "line3": "Az itt hozzáadott új kategória üres mentési útvonallal jön létre. Hogy ez hogyan befolyásolja a torrentek tárolási helyét, az a qBittorrent 'Alapértelmezett torrent kezelési mód' és 'Amikor a kategória mentési útvonala megváltozik' beállításaitól függ."
        }
```

- [ ] **Step 2: Add the icon import and `icons` property**

In `packages/app/src/app/components/category-select/category-select.ts`:

1. Add two new imports between the `@angular/forms` import (line 18) and the `@ng-bootstrap/ng-bootstrap` import (line 19):

```ts
import {
  ControlValueAccessor,
  FormControl,
  NG_VALUE_ACCESSOR,
  ReactiveFormsModule,
} from '@angular/forms';
import { FaIconComponent } from '@fortawesome/angular-fontawesome';
import { faTriangleExclamation } from '@fortawesome/free-solid-svg-icons';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
```

2. Add `FaIconComponent` to the component's `imports` array (line 30):

```ts
  imports: [CommonModule, ReactiveFormsModule, NgSelectComponent, FaIconComponent, TranslatePipe, BbPopover],
```

3. Add an `icons` property right after the injected services (after line 48, before `public categories = signal<string[]>([]);`):

```ts
  private readonly modalService = inject(NgbModal);

  public readonly icons = { faTriangleExclamation };

  public categories = signal<string[]>([]);
```

- [ ] **Step 3: Add the warning paragraph to the popover template**

In `packages/app/src/app/components/category-select/category-select.html`, update the `#categoryPopover` template (lines 40-43):

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

- [ ] **Step 4: Run lint and the existing component tests**

Run: `npm run lint --workspace=packages/app`
Expected: PASS, zero warnings

Run: `npm run test --workspace=packages/app -- --watch=false --include=src/app/components/category-select/category-select.spec.ts`
Expected: PASS (15 tests, unchanged from Task 2)

- [ ] **Step 5: Manual verification**

Run `npm start` from the repo root, open the Add Torrent modal (or Set Category modal), hover the info icon next to the Category field, and confirm the popover shows three lines, with the third line in a yellow/warning color and a leading triangle-exclamation icon.

- [ ] **Step 6: Commit**

```bash
git add packages/app/src/app/components/category-select/category-select.ts packages/app/src/app/components/category-select/category-select.html public/i18n/us.json public/i18n/hu.json
git commit -m "#143: add empty-save-path warning to category-select popover"
```

---

### Task 4: SetTorrentCategory - create category on submit

**Files:**

- Modify: `packages/app/src/app/components/modals/set-torrent-category/set-torrent-category.ts`
- Test: `packages/app/src/app/components/modals/set-torrent-category/set-torrent-category.spec.ts`

- [ ] **Step 1: Write the failing tests**

In `packages/app/src/app/components/modals/set-torrent-category/set-torrent-category.spec.ts`:

1. Add `addCategory` to the `QbService` mock (lines 22-28):

```ts
        {
          provide: QbService,
          useValue: {
            getAllCategories: vi.fn().mockResolvedValue({}),
            addCategory: vi.fn().mockResolvedValue(undefined),
            setTorrentCategory: vi.fn().mockResolvedValue(undefined),
          },
        },
```

2. Add two new tests inside the `describe('handleSubmit', ...)` block (after line 74):

```ts
it('should create the category via ensureCategoryExists before setting it', async () => {
  const mockQbService = TestBed.inject(QbService) as unknown as {
    addCategory: ReturnType<typeof vi.fn>;
    setTorrentCategory: ReturnType<typeof vi.fn>;
  };
  component.setTorrentCategoryForm.get('category')?.setValue('new-category');
  await component.handleSubmit();
  expect(mockQbService.addCategory).toHaveBeenCalledWith('server-1', 'new-category', '');
  expect(mockQbService.setTorrentCategory).toHaveBeenCalledWith(
    'server-1',
    ['hash-1'],
    'new-category',
  );
});

it('should not set the category and reset saving when ensureCategoryExists fails', async () => {
  const mockQbService = TestBed.inject(QbService) as unknown as {
    addCategory: ReturnType<typeof vi.fn>;
    setTorrentCategory: ReturnType<typeof vi.fn>;
  };
  mockQbService.addCategory.mockRejectedValueOnce(new Error('failed'));
  component.setTorrentCategoryForm.get('category')?.setValue('bad-category');
  await component.handleSubmit();
  expect(mockQbService.setTorrentCategory).not.toHaveBeenCalled();
  expect(component.saving).toBe(false);
});
```

- [ ] **Step 2: Run tests to verify the new ones fail**

Run: `npm run test --workspace=packages/app -- --watch=false --include=src/app/components/modals/set-torrent-category/set-torrent-category.spec.ts`
Expected: The new "create the category" and "ensureCategoryExists fails" tests FAIL because `setTorrentCategory` is currently called unconditionally with no prior `addCategory` call, and `categorySelect` doesn't exist yet.

- [ ] **Step 3: Implement the wiring**

In `packages/app/src/app/components/modals/set-torrent-category/set-torrent-category.ts`:

1. Add `viewChild` to the `@angular/core` import (line 2):

```ts
import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  input,
  viewChild,
} from '@angular/core';
```

2. Add a `viewChild` reference to `CategorySelect` after `public readonly qbService = inject(QbService);` (line 33):

```ts
  public readonly qbService = inject(QbService);

  private readonly categorySelect = viewChild(CategorySelect);

  public readonly selected = computed(() => this.hashes().length);
```

3. Update `handleSubmit` (lines 45-64) to call `ensureCategoryExists()` first:

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
      console.error(
        SetTorrentCategory.name,
        'handleSubmit',
        'Failed to set torrent category!',
        error,
      );
    } finally {
      this.saving = false;
    }
  }
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm run test --workspace=packages/app -- --watch=false --include=src/app/components/modals/set-torrent-category/set-torrent-category.spec.ts`
Expected: PASS (8 tests)

- [ ] **Step 5: Commit**

```bash
git add packages/app/src/app/components/modals/set-torrent-category/set-torrent-category.ts packages/app/src/app/components/modals/set-torrent-category/set-torrent-category.spec.ts
git commit -m "#143: create category on submit in SetTorrentCategory"
```

---

### Task 5: AddTorrent - create category on submit

**Files:**

- Modify: `packages/app/src/app/components/add-torrent/add-torrent.ts`
- Test: `packages/app/src/app/components/add-torrent/add-torrent.spec.ts`

- [ ] **Step 1: Write the failing tests**

In `packages/app/src/app/components/add-torrent/add-torrent.spec.ts`:

1. Add `addCategory` to the `QbService` mock (after `getAllCategories`, around line 60):

```ts
            getAllCategories: vi.fn().mockResolvedValue({}),
            addCategory: vi.fn().mockResolvedValue(undefined),
            getAllTags: vi.fn().mockResolvedValue([]),
```

2. Add a new `describe` block at the end of the file, before the final closing `});` (after line 180):

```ts
describe('handleSubmit category creation', () => {
  let mockQbService: any;
  let torrentsAddSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    mockQbService = TestBed.inject(QbService) as any;
    torrentsAddSpy = vi.spyOn(window.bitbutler.qb, 'torrentsAdd').mockClear();
    (component as any).selectedTorrentFile.set({ name: 'test.torrent', path: '/tmp/test.torrent' });
    component.addForm.controls.rename.setValue('test-torrent');
  });

  it('should create a typed category before adding the torrent', async () => {
    component.addForm.controls.category.setValue('new-category');

    await component.handleSubmit({ preventDefault: () => {} } as unknown as SubmitEvent);

    expect(mockQbService.addCategory).toHaveBeenCalledWith('server-1', 'new-category', '');
    expect(torrentsAddSpy).toHaveBeenCalled();
  });

  it('should abort without adding the torrent when category creation fails', async () => {
    mockQbService.addCategory.mockRejectedValueOnce(new Error('failed'));
    component.addForm.controls.category.setValue('bad-category');

    await component.handleSubmit({ preventDefault: () => {} } as unknown as SubmitEvent);

    expect(mockQbService.addCategory).toHaveBeenCalledWith('server-1', 'bad-category', '');
    expect(torrentsAddSpy).not.toHaveBeenCalled();
    expect(component.isSubmitting()).toBe(false);
  });
});
```

- [ ] **Step 2: Run tests to verify the new ones fail**

Run: `npm run test --workspace=packages/app -- --watch=false --include=src/app/components/add-torrent/add-torrent.spec.ts`
Expected: The new tests FAIL - `torrentsAdd` is called regardless of `addCategory`, since `handleSubmit` doesn't yet call `ensureCategoryExists()`.

- [ ] **Step 3: Implement the wiring**

In `packages/app/src/app/components/add-torrent/add-torrent.ts`:

1. Add `viewChild` to the `@angular/core` import (lines 2-10):

```ts
import {
  ChangeDetectionStrategy,
  Component,
  HostListener,
  OnInit,
  computed,
  effect,
  inject,
  signal,
  viewChild,
} from '@angular/core';
```

2. Add a `viewChild` reference to `CategorySelect` after the injected services block, right after `private readonly translateService = inject(TranslateService);` (line 97):

```ts
  private readonly translateService = inject(TranslateService);

  private readonly categorySelect = viewChild(CategorySelect);

  public pending = this.openFilesService.pendingDrafts;
```

3. In `handleSubmit`, insert the `ensureCategoryExists()` check right after the `serverId` guard (lines 218-221), before `const raw = this.addForm.getRawValue() as AddTorrentFormValue;`:

```ts
if (!serverId) {
  this.addForm.setErrors({ noServerSelected: true });
  return;
}

if (!(await this.categorySelect()?.ensureCategoryExists())) {
  return;
}

const raw = this.addForm.getRawValue() as AddTorrentFormValue;
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm run test --workspace=packages/app -- --watch=false --include=src/app/components/add-torrent/add-torrent.spec.ts`
Expected: PASS (all tests, including the 2 new ones)

- [ ] **Step 5: Commit**

```bash
git add packages/app/src/app/components/add-torrent/add-torrent.ts packages/app/src/app/components/add-torrent/add-torrent.spec.ts
git commit -m "#143: create category on submit in AddTorrent"
```

---

### Task 6: Full verification

**Files:** none (verification only)

- [ ] **Step 1: Run the full app test suite**

Run: `npm run test --workspace=packages/app -- --watch=false`
Expected: All test files pass (119+ files, 1234+ tests)

- [ ] **Step 2: Run lint across the workspace**

Run: `npm run lint`
Expected: PASS, zero warnings

- [ ] **Step 3: Manual end-to-end check**

Run `npm start`. In the running app:

- Open "Add Torrent", type a brand-new category name into the category field and press Enter, fill in the rest of the form, and submit. Confirm the torrent is added and the new category now appears in "Manage categories" with an empty save path.
- Open "Set Category" on an existing torrent, type a different brand-new category name, then click Cancel. Confirm via "Manage categories" that the category was NOT created.
- Repeat the "Set Category" flow but click Save. Confirm the category is created and applied to the torrent.
- Type a brand-new tag into the tag field on either modal, submit, and confirm the tag is created and applied (via "Manage tags").

- [ ] **Step 4: Push the branch (only if requested by the user)**

Do not push or open a PR unless the user asks.
