# Manage Tags & Categories - UI Improvements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Apply seven UX and terminology improvements to the Manage Tags and Manage Categories modals and related ng-select components.

**Architecture:** Changes spread across Angular components, services, command bus types, Electron menu, and i18n files. Tasks are ordered: cosmetics first, rename second, then logic improvements layered one at a time. Each task leaves the codebase in a buildable, test-passing state.

**Tech Stack:** Angular 20 (zoneless, signals), Bootstrap 5, ng-select, ngx-translate, Font Awesome (`@fortawesome/free-regular-svg-icons`), `@ng-bootstrap/ng-bootstrap`, Vitest (run via `npm test`).

---

## File Map

| File                                                                                 | Task(s)    |
| ------------------------------------------------------------------------------------ | ---------- |
| `packages/app/src/styles/_ng-select.scss`                                            | 1          |
| `packages/app/src/app/components/tag-select/tag-select.html`                         | 1, 2       |
| `packages/app/src/app/components/tag-select/tag-select.ts`                           | 1, 2       |
| `packages/app/src/app/components/tag-select/tag-select.spec.ts`                      | 1, 2       |
| `packages/app/src/app/components/category-select/category-select.html`               | 1          |
| `packages/app/src/app/components/category-select/category-select.ts`                 | 1          |
| `packages/app/src/app/components/modals/manage-labels/` → `manage-tags/`             | 2          |
| `packages/app/src/app/models/command.model.ts`                                       | 2          |
| `packages/app/src/app/services/ui-command-handler.service.ts`                        | 2          |
| `packages/app/src/app/services/menu-bar-command-handler.service.ts`                  | 2          |
| `packages/electron/src/menu.ts`                                                      | 2          |
| `public/i18n/us.json`                                                                | 2, 5       |
| `public/i18n/hu.json`                                                                | 2, 5       |
| `packages/app/src/app/components/modals/manage-tags/manage-tags.ts`                  | 3, 4, 5, 6 |
| `packages/app/src/app/components/modals/manage-tags/manage-tags.html`                | 4, 6       |
| `packages/app/src/app/components/modals/manage-tags/manage-tags.spec.ts`             | 3, 4, 5    |
| `packages/app/src/app/components/modals/manage-categories/manage-categories.ts`      | 3, 4, 5, 6 |
| `packages/app/src/app/components/modals/manage-categories/manage-categories.html`    | 4, 6       |
| `packages/app/src/app/components/modals/manage-categories/manage-categories.spec.ts` | 3, 4, 5    |

---

### Task 1: CSS fix and ng-select footer button cosmetics

Remove the double-border between the last dropdown item and the footer, and replace `<a>` footer links with `<button class="btn btn-link">`. Also strip `event.preventDefault()` from the footer click handlers since `<button>` has no default navigation behavior.

**Files:**

- Modify: `packages/app/src/styles/_ng-select.scss`
- Modify: `packages/app/src/app/components/tag-select/tag-select.html`
- Modify: `packages/app/src/app/components/tag-select/tag-select.ts`
- Modify: `packages/app/src/app/components/tag-select/tag-select.spec.ts`
- Modify: `packages/app/src/app/components/category-select/category-select.html`
- Modify: `packages/app/src/app/components/category-select/category-select.ts`

No new unit tests for CSS/template-only changes; update one existing spec assertion.

- [ ] **Step 1: Add CSS rule to `_ng-select.scss`**

After the `.ng-dropdown-panel .ng-dropdown-panel-items .ng-option.ng-option-selected` block (around line 93), add:

```scss
.ng-dropdown-panel .ng-dropdown-panel-items {
  border-bottom: none !important;
}
```

- [ ] **Step 2: Update `tag-select.html` footer template**

Replace the entire `<ng-template ng-footer-tmp>` block:

```html
<!-- old -->
<ng-template ng-footer-tmp>
  <div class="px-3 py-2 border-top">
    <a href="#" class="small text-decoration-none" (click)="openManageLabels($event)">
      {{ 'components.tag-select.manage' | translate }}
    </a>
  </div>
</ng-template>
```

With:

```html
<!-- new -->
<ng-template ng-footer-tmp>
  <div class="px-3 py-2 border-top">
    <button type="button" class="btn btn-link btn-sm p-0" (click)="openManageLabels()">
      {{ 'components.tag-select.manage' | translate }}
    </button>
  </div>
</ng-template>
```

Note: the method is still called `openManageLabels` here — it is renamed to `openManageTags` in Task 2.

- [ ] **Step 3: Update `tag-select.ts` — remove event parameter**

Replace:

```typescript
public openManageLabels(event: Event): void {
  event.preventDefault();
  this.ngselect.close();
  this.commandBusService.emit({ type: 'UI_MANAGE_LABELS' });
}
```

With:

```typescript
public openManageLabels(): void {
  this.ngselect.close();
  this.commandBusService.emit({ type: 'UI_MANAGE_LABELS' });
}
```

- [ ] **Step 4: Update `tag-select.spec.ts` — remove preventDefault assertion**

The existing test at line 83 checks `event.preventDefault` was called. Replace the whole describe block:

```typescript
describe('openManageLabels', () => {
  it('should emit UI_MANAGE_LABELS and prevent default', () => {
    const event = new MouseEvent('click');
    vi.spyOn(event, 'preventDefault');
    component.openManageLabels(event);
    expect(event.preventDefault).toHaveBeenCalled();
    expect(mockCommandBusService.emit).toHaveBeenCalledWith({ type: 'UI_MANAGE_LABELS' });
  });
});
```

With:

```typescript
describe('openManageLabels', () => {
  it('should emit UI_MANAGE_LABELS', () => {
    component.openManageLabels();
    expect(mockCommandBusService.emit).toHaveBeenCalledWith({ type: 'UI_MANAGE_LABELS' });
  });
});
```

- [ ] **Step 5: Update `category-select.html` footer template**

Replace the footer `<a>` with a button (method name unchanged here — it has no Task 2 rename):

```html
<!-- old -->
<ng-template ng-footer-tmp>
  <div class="px-3 py-2 border-top">
    <a href="#" class="small text-decoration-none" (click)="openManageCategories($event)">
      {{ 'components.category-select.manage' | translate }}
    </a>
  </div>
</ng-template>
```

With:

```html
<!-- new -->
<ng-template ng-footer-tmp>
  <div class="px-3 py-2 border-top">
    <button type="button" class="btn btn-link btn-sm p-0" (click)="openManageCategories()">
      {{ 'components.category-select.manage' | translate }}
    </button>
  </div>
</ng-template>
```

- [ ] **Step 6: Update `category-select.ts` — remove event parameter**

Replace:

```typescript
public openManageCategories(event: Event): void {
  event.preventDefault();
  this.ngselect.close();
  this.commandBusService.emit({ type: 'UI_MANAGE_CATEGORIES' });
}
```

With:

```typescript
public openManageCategories(): void {
  this.ngselect.close();
  this.commandBusService.emit({ type: 'UI_MANAGE_CATEGORIES' });
}
```

- [ ] **Step 7: Run tests and lint**

```
npm test
npm run lint
```

Expected: all tests pass, 0 lint errors.

- [ ] **Step 8: Commit**

```bash
git add packages/app/src/styles/_ng-select.scss packages/app/src/app/components/tag-select/ packages/app/src/app/components/category-select/
git commit -m "#100: replace ng-select footer anchors with btn-link buttons and remove item border"
```

---

### Task 2: Rename "labels" to "tags" across all layers

qBittorrent's API calls them tags. Rename the folder, files, class, command type, methods, services, Electron menu actions, and i18n keys/values consistently.

**Files:** see File Map for full list.

- [ ] **Step 1: Rename the folder and its four files**

```bash
git mv packages/app/src/app/components/modals/manage-labels packages/app/src/app/components/modals/manage-tags
git mv "packages/app/src/app/components/modals/manage-tags/manage-labels.ts" "packages/app/src/app/components/modals/manage-tags/manage-tags.ts"
git mv "packages/app/src/app/components/modals/manage-tags/manage-labels.html" "packages/app/src/app/components/modals/manage-tags/manage-tags.html"
git mv "packages/app/src/app/components/modals/manage-tags/manage-labels.scss" "packages/app/src/app/components/modals/manage-tags/manage-tags.scss"
git mv "packages/app/src/app/components/modals/manage-tags/manage-labels.spec.ts" "packages/app/src/app/components/modals/manage-tags/manage-tags.spec.ts"
```

- [ ] **Step 2: Rewrite `manage-tags.ts`**

The signal is renamed from `labels` to `tags`. Full file content:

```typescript
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { TranslatePipe } from '@ngx-translate/core';
import { QbService } from '../../../services/qb.service';
import { ServerStoreService } from '../../../services/server-store.service';

@Component({
  selector: 'app-manage-tags',
  standalone: true,
  imports: [ReactiveFormsModule, TranslatePipe],
  templateUrl: './manage-tags.html',
  styleUrl: './manage-tags.scss',
})
export class ManageTags implements OnInit {
  private readonly qbService = inject(QbService);
  private readonly serverStoreService = inject(ServerStoreService);
  public readonly activeModal = inject(NgbActiveModal);

  public tags = signal<string[]>([]);
  public nameControl = new FormControl('', [Validators.required]);
  public adding = signal(false);

  public async ngOnInit(): Promise<void> {
    try {
      const tags = await this.qbService.getAllTags(
        this.serverStoreService.currentServerId() as string,
      );
      this.tags.set(tags);
    } catch (err) {
      console.error(ManageTags.name, 'ngOnInit', 'Failed to load tags', err);
    }
  }

  public async add(): Promise<void> {
    const name = (this.nameControl.value ?? '').trim();
    if (!name) return;
    const serverId = this.serverStoreService.currentServerId() as string;
    try {
      this.adding.set(true);
      await this.qbService.createTags(serverId, [name]);
      this.tags.set([...this.tags(), name]);
      this.nameControl.reset();
    } catch (err) {
      console.error(ManageTags.name, 'add', 'Failed to add tag', err);
    } finally {
      this.adding.set(false);
    }
  }

  public async delete(tag: string): Promise<void> {
    const serverId = this.serverStoreService.currentServerId() as string;
    try {
      await this.qbService.deleteTags(serverId, [tag]);
      this.tags.set(this.tags().filter((t) => t !== tag));
    } catch (err) {
      console.error(ManageTags.name, 'delete', 'Failed to delete tag', err);
    }
  }
}
```

- [ ] **Step 3: Rewrite `manage-tags.html`**

```html
<div class="modal-header">
  <h5 class="modal-title">{{ 'components.modals.manage-tags.title' | translate }}</h5>
  <button
    type="button"
    class="btn-close"
    aria-label="Close"
    (click)="activeModal.dismiss()"
  ></button>
</div>

<div class="modal-body">
  <div class="d-flex gap-2 mb-3 align-items-end">
    <div class="form-floating flex-grow-1">
      <input
        type="text"
        class="form-control"
        id="tag-name"
        placeholder="Tag name"
        [formControl]="nameControl"
        (keydown.enter)="add()"
      />
      <label for="tag-name">{{ 'components.modals.manage-tags.add-form.name' | translate }}</label>
    </div>
    <button
      class="btn btn-primary"
      type="button"
      (click)="add()"
      [disabled]="!(nameControl.value ?? '').trim() || adding()"
    >
      {{ 'general.button.add' | translate }}
    </button>
  </div>

  @if (tags().length > 0) {
  <ul class="list-group">
    @for (tag of tags(); track tag) {
    <li class="list-group-item d-flex align-items-center justify-content-between">
      <span>{{ tag }}</span>
      <button class="btn btn-danger btn-sm" type="button" (click)="delete(tag)">
        {{ 'general.button.delete' | translate }}
      </button>
    </li>
    }
  </ul>
  } @else {
  <p class="text-body-secondary small mb-0">
    {{ 'components.modals.manage-tags.empty' | translate }}
  </p>
  }
</div>

<div class="modal-footer">
  <button type="button" class="btn btn-secondary" (click)="activeModal.dismiss()">
    {{ 'general.button.close' | translate }}
  </button>
</div>
```

- [ ] **Step 4: Rewrite `manage-tags.spec.ts`**

```typescript
import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { QbService } from '../../../services/qb.service';
import { ServerStoreService } from '../../../services/server-store.service';
import { ManageTags } from './manage-tags';

describe('ManageTags', () => {
  let component: ManageTags;
  let fixture: ComponentFixture<ManageTags>;
  let mockQbService: Partial<QbService>;
  let mockActiveModal: Partial<NgbActiveModal>;

  beforeEach(async () => {
    mockActiveModal = { dismiss: vi.fn() };
    mockQbService = {
      getAllTags: vi.fn().mockResolvedValue(['linux', 'movies']),
      createTags: vi.fn().mockResolvedValue(undefined),
      deleteTags: vi.fn().mockResolvedValue(undefined),
    };

    await TestBed.configureTestingModule({
      imports: [ManageTags],
      providers: [
        { provide: NgbActiveModal, useValue: mockActiveModal },
        { provide: ServerStoreService, useValue: { currentServerId: signal('server-1') } },
        { provide: QbService, useValue: mockQbService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ManageTags);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should load tags on init', () => {
    expect(mockQbService.getAllTags).toHaveBeenCalledWith('server-1');
    expect(component.tags()).toEqual(['linux', 'movies']);
  });

  describe('add', () => {
    it('should call createTags and append the new tag', async () => {
      component.nameControl.setValue('software');
      await component.add();
      expect(mockQbService.createTags).toHaveBeenCalledWith('server-1', ['software']);
      expect(component.tags()).toContain('software');
      expect(component.nameControl.value).toBeNull();
    });

    it('should not add when name is empty', async () => {
      component.nameControl.setValue('');
      await component.add();
      expect(mockQbService.createTags).not.toHaveBeenCalled();
    });

    it('should not add when name is whitespace only', async () => {
      component.nameControl.setValue('   ');
      await component.add();
      expect(mockQbService.createTags).not.toHaveBeenCalled();
    });
  });

  describe('delete', () => {
    it('should call deleteTags and remove the tag from the list', async () => {
      await component.delete('linux');
      expect(mockQbService.deleteTags).toHaveBeenCalledWith('server-1', ['linux']);
      expect(component.tags()).not.toContain('linux');
      expect(component.tags()).toContain('movies');
    });
  });
});
```

- [ ] **Step 5: Update `tag-select.ts` — rename method and command type**

Replace:

```typescript
public openManageLabels(): void {
  this.ngselect.close();
  this.commandBusService.emit({ type: 'UI_MANAGE_LABELS' });
}
```

With:

```typescript
public openManageTags(): void {
  this.ngselect.close();
  this.commandBusService.emit({ type: 'UI_MANAGE_TAGS' });
}
```

- [ ] **Step 6: Update `tag-select.html` — update method call**

Replace:

```html
<button type="button" class="btn btn-link btn-sm p-0" (click)="openManageLabels()"></button>
```

With:

```html
<button type="button" class="btn btn-link btn-sm p-0" (click)="openManageTags()"></button>
```

- [ ] **Step 7: Update `tag-select.spec.ts` — rename describe and command type**

Replace:

```typescript
describe('openManageLabels', () => {
  it('should emit UI_MANAGE_LABELS', () => {
    component.openManageLabels();
    expect(mockCommandBusService.emit).toHaveBeenCalledWith({ type: 'UI_MANAGE_LABELS' });
  });
});
```

With:

```typescript
describe('openManageTags', () => {
  it('should emit UI_MANAGE_TAGS', () => {
    component.openManageTags();
    expect(mockCommandBusService.emit).toHaveBeenCalledWith({ type: 'UI_MANAGE_TAGS' });
  });
});
```

- [ ] **Step 8: Update `command.model.ts`**

Replace:

```typescript
| { type: 'UI_MANAGE_LABELS' }
```

With:

```typescript
| { type: 'UI_MANAGE_TAGS' }
```

- [ ] **Step 9: Update `ui-command-handler.service.ts`**

Replace the import line:

```typescript
import { ManageLabels } from '../components/modals/manage-labels/manage-labels';
```

With:

```typescript
import { ManageTags } from '../components/modals/manage-tags/manage-tags';
```

Replace the case block:

```typescript
case 'UI_MANAGE_LABELS':
  if (this.isModalOpen(ManageLabels)) break;
  const manageLabelsModalRef = this.modalService.open(ManageLabels);
  manageLabelsModalRef.result.then(() => {}).catch(() => {});
  break;
```

With:

```typescript
case 'UI_MANAGE_TAGS':
  if (this.isModalOpen(ManageTags)) break;
  const manageTagsModalRef = this.modalService.open(ManageTags);
  manageTagsModalRef.result.then(() => {}).catch(() => {});
  break;
```

- [ ] **Step 10: Update `menu-bar-command-handler.service.ts`**

Replace:

```typescript
case 'settings.manage-labels':
  this.commandBusService.emit({ type: 'UI_MANAGE_LABELS' });
  break;
```

With:

```typescript
case 'settings.manage-tags':
  this.commandBusService.emit({ type: 'UI_MANAGE_TAGS' });
  break;
```

- [ ] **Step 11: Update `packages/electron/src/menu.ts`**

Replace:

```typescript
label: t('electron.menu.manage-labels'),
click: () => sendMenuAction(mainWindow, 'settings.manage-labels'),
```

With:

```typescript
label: t('electron.menu.manage-tags'),
click: () => sendMenuAction(mainWindow, 'settings.manage-tags'),
```

- [ ] **Step 12: Update `public/i18n/us.json`**

Three edits:

**a)** In `components.modals`, rename the key `"manage-labels"` to `"manage-tags"` and update its values:

```json
"manage-tags": {
  "title": "Manage Tags",
  "add-form": {
    "name": "Tag name"
  },
  "empty": "No tags yet."
},
```

**b)** In `components.tag-select`, update the `"manage"` value:

```json
"manage": "Manage tags..."
```

**c)** In `electron.menu`, rename the key `"manage-labels"` to `"manage-tags"` and update its value:

```json
"manage-tags": "Manage Tags"
```

- [ ] **Step 13: Update `public/i18n/hu.json`**

Apply the same three structural changes as Step 12 (rename key `manage-labels` → `manage-tags` in `components.modals` and `electron.menu`; update `components.tag-select.manage`). Provide updated Hungarian translation values — the user should supply them, but use placeholder values matching the English text until they do.

- [ ] **Step 14: Run tests**

```
npm test
```

Expected: all tests pass.

- [ ] **Step 15: Commit**

```bash
git add packages/app/src/app/components/modals/manage-tags/ packages/app/src/app/components/tag-select/ packages/app/src/app/models/command.model.ts packages/app/src/app/services/ui-command-handler.service.ts packages/app/src/app/services/menu-bar-command-handler.service.ts packages/electron/src/menu.ts public/i18n/us.json public/i18n/hu.json
git commit -m "#100: rename labels to tags to match qBittorrent terminology"
```

---

### Task 3: Alphabetical ordering

Sort tags and categories alphabetically after every load and every successful add. Deletion preserves order automatically since it only removes items from an already-sorted list.

**Files:**

- Modify: `packages/app/src/app/components/modals/manage-tags/manage-tags.ts`
- Modify: `packages/app/src/app/components/modals/manage-tags/manage-tags.spec.ts`
- Modify: `packages/app/src/app/components/modals/manage-categories/manage-categories.ts`
- Modify: `packages/app/src/app/components/modals/manage-categories/manage-categories.spec.ts`

- [ ] **Step 1: Write failing tests in `manage-tags.spec.ts`**

Change the mock return value in `beforeEach` to an unsorted list so the sort is actually exercised:

```typescript
mockQbService = {
  getAllTags: vi.fn().mockResolvedValue(['movies', 'linux']),
  createTags: vi.fn().mockResolvedValue(undefined),
  deleteTags: vi.fn().mockResolvedValue(undefined),
};
```

Replace the `'should load tags on init'` test:

```typescript
it('should load tags sorted alphabetically', () => {
  expect(mockQbService.getAllTags).toHaveBeenCalledWith('server-1');
  expect(component.tags()).toEqual(['linux', 'movies']);
});
```

Add a new test inside `describe('add', ...)`:

```typescript
it('should maintain alphabetical order after adding a new tag', async () => {
  component.nameControl.setValue('alpha');
  await component.add();
  expect(component.tags()[0]).toBe('alpha');
});
```

- [ ] **Step 2: Run tests to verify they fail**

```
npm test -- --reporter=verbose packages/app/src/app/components/modals/manage-tags/manage-tags.spec.ts
```

Expected: `should load tags sorted alphabetically` FAIL (gets `['movies', 'linux']`, expects `['linux', 'movies']`). `should maintain alphabetical order after adding a new tag` FAIL.

- [ ] **Step 3: Implement sort in `manage-tags.ts`**

In `ngOnInit`, replace:

```typescript
this.tags.set(tags);
```

With:

```typescript
this.tags.set([...tags].sort((a, b) => a.localeCompare(b)));
```

In `add()`, replace:

```typescript
this.tags.set([...this.tags(), name]);
```

With:

```typescript
this.tags.set([...this.tags(), name].sort((a, b) => a.localeCompare(b)));
```

- [ ] **Step 4: Run tests — verify pass (tags)**

```
npm test -- --reporter=verbose packages/app/src/app/components/modals/manage-tags/manage-tags.spec.ts
```

Expected: all PASS.

- [ ] **Step 5: Write failing tests in `manage-categories.spec.ts`**

Change the mock to return categories in reverse-alpha order to force testing of the sort:

```typescript
mockQbService = {
  getAllCategories: vi.fn().mockResolvedValue({
    movies: { name: 'movies', savePath: '' },
    linux: { name: 'linux', savePath: '/downloads/linux' },
  }),
  addCategory: vi.fn().mockResolvedValue(undefined),
  editCategory: vi.fn().mockResolvedValue(undefined),
  removeCategories: vi.fn().mockResolvedValue(undefined),
};
```

Replace `'should load categories on init'`:

```typescript
it('should load categories sorted alphabetically', () => {
  expect(mockQbService.getAllCategories).toHaveBeenCalledWith('server-1');
  expect(component.categories()).toHaveLength(2);
  expect(component.categories()[0]).toEqual({
    name: 'linux',
    savePath: '/downloads/linux',
    editing: false,
  });
  expect(component.categories()[1]).toEqual({ name: 'movies', savePath: '', editing: false });
});
```

Add inside `describe('add', ...)`:

```typescript
it('should maintain alphabetical order after adding a new category', async () => {
  component.addForm.get('name')?.setValue('alpha');
  await component.add();
  expect(component.categories()[0].name).toBe('alpha');
});
```

- [ ] **Step 6: Run tests to verify they fail**

```
npm test -- --reporter=verbose packages/app/src/app/components/modals/manage-categories/manage-categories.spec.ts
```

Expected: sorted-load and sorted-add tests FAIL.

- [ ] **Step 7: Implement sort in `manage-categories.ts`**

In `ngOnInit`, after `this.categories.set(...)`, add:

```typescript
this.categories.update((cats) => [...cats].sort((a, b) => a.name.localeCompare(b.name)));
```

In `add()`, replace:

```typescript
this.categories.set([...this.categories(), { name, savePath, editing: false }]);
```

With:

```typescript
this.categories.set(
  [...this.categories(), { name, savePath, editing: false }].sort((a, b) =>
    a.name.localeCompare(b.name),
  ),
);
```

- [ ] **Step 8: Run all tests**

```
npm test
```

Expected: all PASS.

- [ ] **Step 9: Commit**

```bash
git add packages/app/src/app/components/modals/manage-tags/manage-tags.ts packages/app/src/app/components/modals/manage-tags/manage-tags.spec.ts packages/app/src/app/components/modals/manage-categories/manage-categories.ts packages/app/src/app/components/modals/manage-categories/manage-categories.spec.ts
git commit -m "#100: sort tags and categories alphabetically in manage modals"
```

---

### Task 4: Loading spinner

Show a Bootstrap spinner while the API call is in flight. Default `loading` to `true` so the spinner appears immediately when the modal opens, before `ngOnInit` completes.

**Files:**

- Modify: `packages/app/src/app/components/modals/manage-tags/manage-tags.ts`
- Modify: `packages/app/src/app/components/modals/manage-tags/manage-tags.html`
- Modify: `packages/app/src/app/components/modals/manage-tags/manage-tags.spec.ts`
- Modify: `packages/app/src/app/components/modals/manage-categories/manage-categories.ts`
- Modify: `packages/app/src/app/components/modals/manage-categories/manage-categories.html`
- Modify: `packages/app/src/app/components/modals/manage-categories/manage-categories.spec.ts`

- [ ] **Step 1: Write failing test for loading signal in `manage-tags.spec.ts`**

Add to the top-level `describe('ManageTags', ...)` block (outside any nested describe):

```typescript
it('should set loading to false after init completes', () => {
  expect(component.loading()).toBe(false);
});
```

- [ ] **Step 2: Run test to verify it fails**

```
npm test -- --reporter=verbose packages/app/src/app/components/modals/manage-tags/manage-tags.spec.ts
```

Expected: FAIL with `component.loading is not a function`.

- [ ] **Step 3: Add `loading` signal to `manage-tags.ts`**

Add the property after `public adding = signal(false);`:

```typescript
public loading = signal(true);
```

Update `ngOnInit` to add a `finally` block:

```typescript
public async ngOnInit(): Promise<void> {
  try {
    const tags = await this.qbService.getAllTags(
      this.serverStoreService.currentServerId() as string,
    );
    this.tags.set([...tags].sort((a, b) => a.localeCompare(b)));
  } catch (err) {
    console.error(ManageTags.name, 'ngOnInit', 'Failed to load tags', err);
  } finally {
    this.loading.set(false);
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

```
npm test -- --reporter=verbose packages/app/src/app/components/modals/manage-tags/manage-tags.spec.ts
```

Expected: all PASS.

- [ ] **Step 5: Update `manage-tags.html` to show spinner**

Replace the `@if (tags().length > 0) ... @else ...` block with:

```html
@if (loading()) {
<div class="d-flex justify-content-center py-3">
  <div class="spinner-border spinner-border-sm" role="status">
    <span class="visually-hidden">Loading...</span>
  </div>
</div>
} @else if (tags().length > 0) {
<ul class="list-group">
  @for (tag of tags(); track tag) {
  <li class="list-group-item d-flex align-items-center justify-content-between">
    <span>{{ tag }}</span>
    <button class="btn btn-danger btn-sm" type="button" (click)="delete(tag)">
      {{ 'general.button.delete' | translate }}
    </button>
  </li>
  }
</ul>
} @else {
<p class="text-body-secondary small mb-0">
  {{ 'components.modals.manage-tags.empty' | translate }}
</p>
}
```

- [ ] **Step 6: Write failing test for loading signal in `manage-categories.spec.ts`**

Add to the top-level `describe('ManageCategories', ...)` block:

```typescript
it('should set loading to false after init completes', () => {
  expect(component.loading()).toBe(false);
});
```

- [ ] **Step 7: Add `loading` signal to `manage-categories.ts`**

Add after `public adding = signal(false);`:

```typescript
public loading = signal(true);
```

Update `ngOnInit` to add a `finally` block. The full updated method:

```typescript
public async ngOnInit(): Promise<void> {
  try {
    const raw = await this.qbService.getAllCategories(
      this.serverStoreService.currentServerId() as string,
    );
    this.categories.set(
      Object.entries(raw).map(([name, cat]) => ({
        name,
        savePath: cat.savePath ?? '',
        editing: false,
      })),
    );
    this.categories.update((cats) => [...cats].sort((a, b) => a.name.localeCompare(b.name)));
  } catch (err) {
    console.error(ManageCategories.name, 'ngOnInit', 'Failed to load categories', err);
  } finally {
    this.loading.set(false);
  }
}
```

- [ ] **Step 8: Update `manage-categories.html` to show spinner**

Replace the `@if (categories().length > 0) ... @else ...` block with the following. The inner list content is unchanged from the current file; only the outer `@if`/`@else` structure gains the spinner branch:

```html
@if (loading()) {
<div class="d-flex justify-content-center py-3">
  <div class="spinner-border spinner-border-sm" role="status">
    <span class="visually-hidden">Loading...</span>
  </div>
</div>
} @else if (categories().length > 0) {
<ul class="list-group">
  @for (item of categories(); track item.name) { @if (item.editing) {
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
      <button class="btn btn-primary btn-sm text-nowrap" type="button" (click)="saveEdit(item)">
        {{ 'general.button.save' | translate }}
      </button>
      <button class="btn btn-secondary btn-sm" type="button" (click)="cancelEdit()">
        {{ 'general.button.cancel' | translate }}
      </button>
    </div>
  </li>
  } @else {
  <li class="list-group-item d-flex align-items-center justify-content-between">
    <div>
      <div class="fw-semibold">{{ item.name }}</div>
      <div class="small text-body-secondary">
        {{ item.savePath || ('components.modals.manage-categories.list.no-save-path' | translate) }}
      </div>
    </div>
    <div class="d-flex gap-1">
      <button class="btn btn-secondary btn-sm" type="button" (click)="startEdit(item)">
        {{ 'general.button.edit' | translate }}
      </button>
      <button class="btn btn-danger btn-sm" type="button" (click)="delete(item)">
        {{ 'general.button.delete' | translate }}
      </button>
    </div>
  </li>
  } }
</ul>
} @else {
<p class="text-body-secondary small mb-0">
  {{ 'components.modals.manage-categories.empty' | translate }}
</p>
}
```

- [ ] **Step 9: Run all tests**

```
npm test
```

Expected: all PASS.

- [ ] **Step 10: Commit**

```bash
git add packages/app/src/app/components/modals/manage-tags/ packages/app/src/app/components/modals/manage-categories/
git commit -m "#100: show loading spinner while fetching tags and categories from API"
```

---

### Task 5: Confirm before delete

Show a confirm dialog before any delete operation so users cannot accidentally remove a tag or category.

**Files:**

- Modify: `public/i18n/us.json`
- Modify: `public/i18n/hu.json`
- Modify: `packages/app/src/app/components/modals/manage-tags/manage-tags.ts`
- Modify: `packages/app/src/app/components/modals/manage-tags/manage-tags.spec.ts`
- Modify: `packages/app/src/app/components/modals/manage-categories/manage-categories.ts`
- Modify: `packages/app/src/app/components/modals/manage-categories/manage-categories.spec.ts`

- [ ] **Step 1: Add i18n keys to `us.json`**

Inside `components.modals.manage-tags`, add alongside the existing keys:

```json
"delete-confirm": {
  "title": "Delete Tag",
  "message": "Are you sure you want to delete the tag \"{{ name }}\"?"
}
```

Inside `components.modals.manage-categories`, add:

```json
"delete-confirm": {
  "title": "Delete Category",
  "message": "Are you sure you want to delete the category \"{{ name }}\"?"
}
```

- [ ] **Step 2: Mirror the structure in `hu.json`**

Add the same keys in `hu.json` with placeholder English values (the user supplies Hungarian text):

```json
"delete-confirm": {
  "title": "Delete Tag",
  "message": "Are you sure you want to delete the tag \"{{ name }}\"?"
}
```

And similarly for `manage-categories`.

- [ ] **Step 3: Write failing tests in `manage-tags.spec.ts`**

Add the `ConfirmService` import at the top:

```typescript
import { ConfirmService } from '../../../services/confirm.service';
```

Add a mock variable declaration alongside the other `let` declarations:

```typescript
let mockConfirmService: Partial<ConfirmService>;
```

In `beforeEach`, add the mock setup:

```typescript
mockConfirmService = { confirm: vi.fn().mockResolvedValue(true) };
```

In `TestBed.configureTestingModule`, add to `providers`:

```typescript
{ provide: ConfirmService, useValue: mockConfirmService }
```

Replace the existing `describe('delete', ...)` block with:

```typescript
describe('delete', () => {
  it('should show a confirm dialog before deleting', async () => {
    await component.delete('linux');
    expect(mockConfirmService.confirm).toHaveBeenCalled();
  });

  it('should delete when the user confirms', async () => {
    (mockConfirmService.confirm as ReturnType<typeof vi.fn>).mockResolvedValue(true);
    await component.delete('linux');
    expect(mockQbService.deleteTags).toHaveBeenCalledWith('server-1', ['linux']);
    expect(component.tags()).not.toContain('linux');
    expect(component.tags()).toContain('movies');
  });

  it('should not delete when the user cancels', async () => {
    (mockConfirmService.confirm as ReturnType<typeof vi.fn>).mockResolvedValue(false);
    await component.delete('linux');
    expect(mockQbService.deleteTags).not.toHaveBeenCalled();
    expect(component.tags()).toContain('linux');
  });
});
```

- [ ] **Step 4: Run tests to verify they fail**

```
npm test -- --reporter=verbose packages/app/src/app/components/modals/manage-tags/manage-tags.spec.ts
```

Expected: the three delete tests FAIL.

- [ ] **Step 5: Implement confirm in `manage-tags.ts`**

Add import:

```typescript
import { ConfirmService } from '../../../services/confirm.service';
```

Add injection (alongside the other `inject` calls):

```typescript
private readonly confirmService = inject(ConfirmService);
```

Replace the `delete` method:

```typescript
public async delete(tag: string): Promise<void> {
  const confirmed = await this.confirmService.confirm(
    'components.modals.manage-tags.delete-confirm.title',
    {
      text: 'components.modals.manage-tags.delete-confirm.message',
      data: { name: tag },
    },
    'general.button.delete',
  );
  if (!confirmed) return;

  const serverId = this.serverStoreService.currentServerId() as string;
  try {
    await this.qbService.deleteTags(serverId, [tag]);
    this.tags.set(this.tags().filter((t) => t !== tag));
  } catch (err) {
    console.error(ManageTags.name, 'delete', 'Failed to delete tag', err);
  }
}
```

- [ ] **Step 6: Run tests — verify pass (tags)**

```
npm test -- --reporter=verbose packages/app/src/app/components/modals/manage-tags/manage-tags.spec.ts
```

Expected: all PASS.

- [ ] **Step 7: Write failing tests in `manage-categories.spec.ts`**

Add at the top:

```typescript
import { ConfirmService } from '../../../services/confirm.service';
```

Add variable declaration:

```typescript
let mockConfirmService: Partial<ConfirmService>;
```

In `beforeEach`, add mock setup and provider:

```typescript
mockConfirmService = { confirm: vi.fn().mockResolvedValue(true) };
// in providers:
{ provide: ConfirmService, useValue: mockConfirmService }
```

Replace `describe('delete', ...)`:

```typescript
describe('delete', () => {
  it('should show a confirm dialog before deleting', async () => {
    await component.delete(component.categories()[0]);
    expect(mockConfirmService.confirm).toHaveBeenCalled();
  });

  it('should delete when the user confirms', async () => {
    (mockConfirmService.confirm as ReturnType<typeof vi.fn>).mockResolvedValue(true);
    const linux = component.categories()[0];
    await component.delete(linux);
    expect(mockQbService.removeCategories).toHaveBeenCalledWith('server-1', ['linux']);
    expect(component.categories().find((c) => c.name === 'linux')).toBeUndefined();
    expect(component.categories()).toHaveLength(1);
  });

  it('should not delete when the user cancels', async () => {
    (mockConfirmService.confirm as ReturnType<typeof vi.fn>).mockResolvedValue(false);
    const linux = component.categories()[0];
    await component.delete(linux);
    expect(mockQbService.removeCategories).not.toHaveBeenCalled();
    expect(component.categories().find((c) => c.name === 'linux')).toBeDefined();
  });
});
```

- [ ] **Step 8: Implement confirm in `manage-categories.ts`**

Add import:

```typescript
import { ConfirmService } from '../../../services/confirm.service';
```

Add injection:

```typescript
private readonly confirmService = inject(ConfirmService);
```

Replace the `delete` method:

```typescript
public async delete(item: CategoryItem): Promise<void> {
  const confirmed = await this.confirmService.confirm(
    'components.modals.manage-categories.delete-confirm.title',
    {
      text: 'components.modals.manage-categories.delete-confirm.message',
      data: { name: item.name },
    },
    'general.button.delete',
  );
  if (!confirmed) return;

  const serverId = this.serverStoreService.currentServerId() as string;
  try {
    await this.qbService.removeCategories(serverId, [item.name]);
    this.categories.set(this.categories().filter((c) => c.name !== item.name));
  } catch (err) {
    console.error(ManageCategories.name, 'delete', 'Failed to delete category', err);
  }
}
```

- [ ] **Step 9: Run all tests**

```
npm test
```

Expected: all PASS.

- [ ] **Step 10: Commit**

```bash
git add public/i18n/us.json public/i18n/hu.json packages/app/src/app/components/modals/manage-tags/ packages/app/src/app/components/modals/manage-categories/
git commit -m "#100: add confirm dialog before deleting tags and categories"
```

---

### Task 6: Icon buttons with tooltips

Replace text-label action buttons with icon-only `btn btn-link` buttons matching the login screen pattern. Uses `faEdit` and `faTrashCan` from `@fortawesome/free-regular-svg-icons` with `ngbTooltip`.

**Files:**

- Modify: `packages/app/src/app/components/modals/manage-tags/manage-tags.ts`
- Modify: `packages/app/src/app/components/modals/manage-tags/manage-tags.html`
- Modify: `packages/app/src/app/components/modals/manage-categories/manage-categories.ts`
- Modify: `packages/app/src/app/components/modals/manage-categories/manage-categories.html`

No new unit tests - the delete logic is already covered in Task 5. Lint verifies no missing imports.

- [ ] **Step 1: Update `manage-tags.ts` — add icon imports**

Add imports:

```typescript
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { faTrashCan } from '@fortawesome/free-regular-svg-icons';
import { NgbActiveModal, NgbTooltipModule } from '@ng-bootstrap/ng-bootstrap';
```

Update `imports` array in `@Component` decorator:

```typescript
imports: [ReactiveFormsModule, TranslatePipe, FontAwesomeModule, NgbTooltipModule],
```

Add icon property (alongside other public properties):

```typescript
public readonly icon = { faTrashCan };
```

- [ ] **Step 2: Update delete button in `manage-tags.html`**

Replace:

```html
<button class="btn btn-danger btn-sm" type="button" (click)="delete(tag)">
  {{ 'general.button.delete' | translate }}
</button>
```

With:

```html
<button
  type="button"
  class="btn btn-link text-danger p-1"
  [ngbTooltip]="'general.button.delete' | translate"
  (click)="delete(tag)"
>
  <fa-icon [icon]="icon.faTrashCan" />
</button>
```

- [ ] **Step 3: Update `manage-categories.ts` — add icon imports**

Add imports (note `faEdit` added):

```typescript
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { faEdit, faTrashCan } from '@fortawesome/free-regular-svg-icons';
import { NgbActiveModal, NgbTooltipModule } from '@ng-bootstrap/ng-bootstrap';
```

Update `imports` array:

```typescript
imports: [ReactiveFormsModule, TranslatePipe, FontAwesomeModule, NgbTooltipModule],
```

Add icon property:

```typescript
public readonly icon = { faEdit, faTrashCan };
```

- [ ] **Step 4: Update action buttons in `manage-categories.html`**

In the `@else` branch (view row), replace the `<div class="d-flex gap-1">` button group:

```html
<div class="d-flex gap-1">
  <button
    type="button"
    class="btn btn-link p-1"
    [ngbTooltip]="'general.button.edit' | translate"
    (click)="startEdit(item)"
  >
    <fa-icon [icon]="icon.faEdit" />
  </button>
  <button
    type="button"
    class="btn btn-link text-danger p-1"
    [ngbTooltip]="'general.button.delete' | translate"
    (click)="delete(item)"
  >
    <fa-icon [icon]="icon.faTrashCan" />
  </button>
</div>
```

- [ ] **Step 5: Run all tests**

```
npm test
```

Expected: all PASS.

- [ ] **Step 6: Run lint**

```
npm run lint
```

Expected: 0 errors, 0 warnings.

- [ ] **Step 7: Commit**

```bash
git add packages/app/src/app/components/modals/manage-tags/ packages/app/src/app/components/modals/manage-categories/
git commit -m "#100: replace text action buttons with icon buttons with tooltips"
```
