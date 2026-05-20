# Manage Labels and Categories Modals Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add small modal components for managing qBittorrent labels and categories, wired via the command bus and accessible from ng-select footer templates and the Electron application menu.

**Architecture:** Two new standalone Angular modal components (`ManageLabels`, `ManageCategories`) are opened by `UiCommandHandlerService` when `UI_MANAGE_LABELS` / `UI_MANAGE_CATEGORIES` commands are emitted. The Electron menu sends `settings.manage-labels` / `settings.manage-categories` action strings that `MenuBarCommandHandlerService` translates into those commands. The `tag-select` and `category-select` components gain a footer template link that emits the corresponding command; inline tag creation is removed from `tag-select`.

**Tech Stack:** Angular 20 (signals, standalone components), ng-bootstrap (`NgbActiveModal`, `NgbModal`), ng-select (`NgSelectComponent`), ngx-translate, TypeScript, Vitest

---

## File Map

### Created

- `packages/app/src/app/components/modals/manage-labels/manage-labels.ts`
- `packages/app/src/app/components/modals/manage-labels/manage-labels.html`
- `packages/app/src/app/components/modals/manage-labels/manage-labels.scss`
- `packages/app/src/app/components/modals/manage-labels/manage-labels.spec.ts`
- `packages/app/src/app/components/modals/manage-categories/manage-categories.ts`
- `packages/app/src/app/components/modals/manage-categories/manage-categories.html`
- `packages/app/src/app/components/modals/manage-categories/manage-categories.scss`
- `packages/app/src/app/components/modals/manage-categories/manage-categories.spec.ts`

### Modified

- `packages/app/src/app/models/command.model.ts` — add `UI_MANAGE_LABELS`, `UI_MANAGE_CATEGORIES` to `UiCommand`
- `packages/app/src/app/services/ui-command-handler.service.ts` — handle new commands
- `packages/app/src/app/services/menu-bar-command-handler.service.ts` — handle `settings.manage-labels`, `settings.manage-categories` actions
- `packages/app/src/app/components/tag-select/tag-select.ts` — inject `CommandBusService`, remove `addTag`, add `openManageLabels`
- `packages/app/src/app/components/tag-select/tag-select.html` — remove `[addTag]`, add `[footerTemplate]`
- `packages/app/src/app/components/tag-select/tag-select.spec.ts` — remove `addTag` tests, add `openManageLabels` test
- `packages/app/src/app/components/category-select/category-select.ts` — inject `CommandBusService`, add `openManageCategories`
- `packages/app/src/app/components/category-select/category-select.html` — add `[footerTemplate]`
- `packages/app/src/app/components/category-select/category-select.spec.ts` — add `openManageCategories` test
- `public/i18n/us.json` — add translation keys
- `public/i18n/hu.json` — add translation keys (Hungarian)
- `packages/electron/src/menu.ts` — add two items under the Settings submenu

---

## Task 1: Add command types

**Files:**

- Modify: `packages/app/src/app/models/command.model.ts`

- [ ] **Step 1: Extend `UiCommand` with the two new variants**

In `packages/app/src/app/models/command.model.ts`, the `UiCommand` type currently ends with `| { type: 'UI_TORRENT_UNPIN' };`. Add two more variants before that semicolon:

```typescript
export type UiCommand =
  | { type: 'UI_SERVER_EDITOR_OPEN'; id?: string }
  | { type: 'UI_TORRENT_DELETE_REQUEST'; defaultRemoveFiles?: boolean }
  | { type: 'UI_OPEN_SETTINGS'; tabToOpen?: SettingsTabId }
  | { type: 'UI_OPEN_QB_SETTINGS' }
  | { type: 'UI_OPEN_TORRENT_DETAILS'; hash: string }
  | {
      type: 'UI_ADD_TORRENT';
      draft?: TorrentDraft;
      selected?: SelectedTorrentInput;
      mode?: 'file' | 'link';
    }
  | { type: 'UI_OPEN_ABOUT' }
  | { type: 'UI_SET_TORRENT_LOCATION'; torrent: Torrent }
  | { type: 'UI_RENAME_TORRENT'; torrent: Torrent }
  | { type: 'UI_LIMIT_TRANSFER'; target: LimitTargetType }
  | { type: 'UI_LIMIT_SHARE' }
  | { type: 'UI_SET_TORRENT_TAGS'; torrent: Torrent }
  | { type: 'UI_SET_TORRENT_CATEGORY'; torrent: Torrent }
  | { type: 'UI_OPEN_DESTINATION'; remotePath: string | null; hash: string }
  | { type: 'UI_UPDATE_AVAILABLE'; update: UpdateCheckResponse }
  | { type: 'UI_RENAME_FILES'; hash: string }
  | { type: 'UI_TORRENT_PIN_TOP' }
  | { type: 'UI_TORRENT_PIN_BOTTOM' }
  | { type: 'UI_TORRENT_UNPIN' }
  | { type: 'UI_MANAGE_LABELS' }
  | { type: 'UI_MANAGE_CATEGORIES' };
```

- [ ] **Step 2: Verify no TypeScript errors**

Run: `npm run lint`

Expected: Exit 0 with zero warnings.

- [ ] **Step 3: Commit**

```bash
git add packages/app/src/app/models/command.model.ts
git commit -m "#100: add UI_MANAGE_LABELS and UI_MANAGE_CATEGORIES command types"
```

---

## Task 2: Add i18n translation keys

**Files:**

- Modify: `public/i18n/us.json`
- Modify: `public/i18n/hu.json`

- [ ] **Step 1: Add keys to `us.json`**

Inside `components.modals` (after the last modal block, before the closing `}` of `modals`), add:

```json
"manage-labels": {
  "title": "Manage Labels",
  "add-form": {
    "name": "Label name"
  },
  "empty": "No labels yet."
},
"manage-categories": {
  "title": "Manage Categories",
  "add-form": {
    "name": "Category name",
    "save-path": "Save path (optional)"
  },
  "list": {
    "no-save-path": "No save path"
  },
  "empty": "No categories yet."
}
```

Inside `components.tag-select` (alongside the existing `label`, `popover` keys), add:

```json
"manage": "Manage labels..."
```

Inside `components.category-select` (alongside the existing keys), add:

```json
"manage": "Manage categories..."
```

Inside `electron.menu` (alongside existing keys like `app-settings`, `qb-settings`), add:

```json
"manage-labels": "Manage Labels",
"manage-categories": "Manage Categories"
```

- [ ] **Step 2: Add keys to `hu.json`**

Inside `components.modals`, add:

```json
"manage-labels": {
  "title": "Cimkék kezelése",
  "add-form": {
    "name": "Cimke neve"
  },
  "empty": "Még nincsenek cimkék."
},
"manage-categories": {
  "title": "Kategóriák kezelése",
  "add-form": {
    "name": "Kategória neve",
    "save-path": "Mentési útvonal (opcionális)"
  },
  "list": {
    "no-save-path": "Nincs mentési útvonal"
  },
  "empty": "Még nincsenek kategóriák."
}
```

Inside `components.tag-select`, add:

```json
"manage": "Cimkék kezelése..."
```

Inside `components.category-select`, add:

```json
"manage": "Kategóriák kezelése..."
```

Inside `electron.menu`, add:

```json
"manage-labels": "Cimkék kezelése",
"manage-categories": "Kategóriák kezelése"
```

- [ ] **Step 3: Verify JSON is valid**

Run: `node -e "require('./public/i18n/us.json'); require('./public/i18n/hu.json'); console.log('OK')"`

Expected: `OK`

- [ ] **Step 4: Commit**

```bash
git add public/i18n/us.json public/i18n/hu.json
git commit -m "#100: add i18n keys for manage labels and categories"
```

---

## Task 3: ManageLabels modal

**Files:**

- Create: `packages/app/src/app/components/modals/manage-labels/manage-labels.spec.ts`
- Create: `packages/app/src/app/components/modals/manage-labels/manage-labels.ts`
- Create: `packages/app/src/app/components/modals/manage-labels/manage-labels.html`
- Create: `packages/app/src/app/components/modals/manage-labels/manage-labels.scss`

- [ ] **Step 1: Write the failing tests**

Create `packages/app/src/app/components/modals/manage-labels/manage-labels.spec.ts`:

```typescript
import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { QbService } from '../../../services/qb.service';
import { ServerStoreService } from '../../../services/server-store.service';
import { ManageLabels } from './manage-labels';

describe('ManageLabels', () => {
  let component: ManageLabels;
  let fixture: ComponentFixture<ManageLabels>;
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
      imports: [ManageLabels],
      providers: [
        { provide: NgbActiveModal, useValue: mockActiveModal },
        { provide: ServerStoreService, useValue: { currentServerId: signal('server-1') } },
        { provide: QbService, useValue: mockQbService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ManageLabels);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should load labels on init', () => {
    expect(mockQbService.getAllTags).toHaveBeenCalledWith('server-1');
    expect(component.labels()).toEqual(['linux', 'movies']);
  });

  describe('add', () => {
    it('should call createTags and append the new label', async () => {
      component.nameControl.setValue('software');
      await component.add();
      expect(mockQbService.createTags).toHaveBeenCalledWith('server-1', ['software']);
      expect(component.labels()).toContain('software');
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
    it('should call deleteTags and remove the label from the list', async () => {
      await component.delete('linux');
      expect(mockQbService.deleteTags).toHaveBeenCalledWith('server-1', ['linux']);
      expect(component.labels()).not.toContain('linux');
      expect(component.labels()).toContain('movies');
    });
  });
});
```

- [ ] **Step 2: Run to confirm the test fails**

Run: `npm test`

Expected: Failure with `Cannot find module './manage-labels'` or similar.

- [ ] **Step 3: Create the component class**

Create `packages/app/src/app/components/modals/manage-labels/manage-labels.ts`:

```typescript
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { TranslatePipe } from '@ngx-translate/core';
import { QbService } from '../../../services/qb.service';
import { ServerStoreService } from '../../../services/server-store.service';

@Component({
  selector: 'app-manage-labels',
  standalone: true,
  imports: [ReactiveFormsModule, TranslatePipe],
  templateUrl: './manage-labels.html',
  styleUrl: './manage-labels.scss',
})
export class ManageLabels implements OnInit {
  private readonly qbService = inject(QbService);
  private readonly serverStoreService = inject(ServerStoreService);
  public readonly activeModal = inject(NgbActiveModal);

  public labels = signal<string[]>([]);
  public nameControl = new FormControl('', [Validators.required]);
  public adding = signal(false);

  public async ngOnInit(): Promise<void> {
    try {
      const tags = await this.qbService.getAllTags(
        this.serverStoreService.currentServerId() as string,
      );
      this.labels.set(tags);
    } catch (err) {
      console.error(ManageLabels.name, 'ngOnInit', 'Failed to load labels', err);
    }
  }

  public async add(): Promise<void> {
    const name = (this.nameControl.value ?? '').trim();
    if (!name) return;
    const serverId = this.serverStoreService.currentServerId() as string;
    try {
      this.adding.set(true);
      await this.qbService.createTags(serverId, [name]);
      this.labels.set([...this.labels(), name]);
      this.nameControl.reset();
    } catch (err) {
      console.error(ManageLabels.name, 'add', 'Failed to add label', err);
    } finally {
      this.adding.set(false);
    }
  }

  public async delete(label: string): Promise<void> {
    const serverId = this.serverStoreService.currentServerId() as string;
    try {
      await this.qbService.deleteTags(serverId, [label]);
      this.labels.set(this.labels().filter((l) => l !== label));
    } catch (err) {
      console.error(ManageLabels.name, 'delete', 'Failed to delete label', err);
    }
  }
}
```

- [ ] **Step 4: Create the template**

Create `packages/app/src/app/components/modals/manage-labels/manage-labels.html`:

```html
<div class="modal-header">
  <h5 class="modal-title">{{ 'components.modals.manage-labels.title' | translate }}</h5>
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
        id="label-name"
        placeholder="Label name"
        [formControl]="nameControl"
        (keydown.enter)="add()"
      />
      <label for="label-name"
        >{{ 'components.modals.manage-labels.add-form.name' | translate }}</label
      >
    </div>
    <button
      class="btn btn-primary"
      type="button"
      (click)="add()"
      [disabled]="!nameControl.valid || adding()"
    >
      {{ 'general.button.add' | translate }}
    </button>
  </div>

  @if (labels().length > 0) {
  <ul class="list-group">
    @for (label of labels(); track label) {
    <li class="list-group-item d-flex align-items-center justify-content-between">
      <span>{{ label }}</span>
      <button class="btn btn-danger btn-sm" type="button" (click)="delete(label)">
        {{ 'general.button.delete' | translate }}
      </button>
    </li>
    }
  </ul>
  } @else {
  <p class="text-body-secondary small mb-0">
    {{ 'components.modals.manage-labels.empty' | translate }}
  </p>
  }
</div>

<div class="modal-footer">
  <button type="button" class="btn btn-secondary" (click)="activeModal.dismiss()">
    {{ 'general.button.close' | translate }}
  </button>
</div>
```

- [ ] **Step 5: Create the empty stylesheet**

Create `packages/app/src/app/components/modals/manage-labels/manage-labels.scss` with no content (empty file).

- [ ] **Step 6: Run tests and confirm they pass**

Run: `npm test`

Expected: All `ManageLabels` tests pass.

- [ ] **Step 7: Commit**

```bash
git add packages/app/src/app/components/modals/manage-labels/
git commit -m "#100: add ManageLabels modal component"
```

---

## Task 4: ManageCategories modal

**Files:**

- Create: `packages/app/src/app/components/modals/manage-categories/manage-categories.spec.ts`
- Create: `packages/app/src/app/components/modals/manage-categories/manage-categories.ts`
- Create: `packages/app/src/app/components/modals/manage-categories/manage-categories.html`
- Create: `packages/app/src/app/components/modals/manage-categories/manage-categories.scss`

- [ ] **Step 1: Write the failing tests**

Create `packages/app/src/app/components/modals/manage-categories/manage-categories.spec.ts`:

```typescript
import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { QbService } from '../../../services/qb.service';
import { ServerStoreService } from '../../../services/server-store.service';
import { ManageCategories } from './manage-categories';

describe('ManageCategories', () => {
  let component: ManageCategories;
  let fixture: ComponentFixture<ManageCategories>;
  let mockQbService: Partial<QbService>;
  let mockActiveModal: Partial<NgbActiveModal>;

  beforeEach(async () => {
    mockActiveModal = { dismiss: vi.fn() };
    mockQbService = {
      getAllCategories: vi.fn().mockResolvedValue({
        linux: { name: 'linux', savePath: '/downloads/linux' },
        movies: { name: 'movies', savePath: '' },
      }),
      addCategory: vi.fn().mockResolvedValue(undefined),
      editCategory: vi.fn().mockResolvedValue(undefined),
      removeCategories: vi.fn().mockResolvedValue(undefined),
    };

    await TestBed.configureTestingModule({
      imports: [ManageCategories],
      providers: [
        { provide: NgbActiveModal, useValue: mockActiveModal },
        { provide: ServerStoreService, useValue: { currentServerId: signal('server-1') } },
        { provide: QbService, useValue: mockQbService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ManageCategories);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should load categories on init', () => {
    expect(mockQbService.getAllCategories).toHaveBeenCalledWith('server-1');
    expect(component.categories()).toHaveLength(2);
    expect(component.categories()[0]).toEqual({
      name: 'linux',
      savePath: '/downloads/linux',
      editing: false,
    });
    expect(component.categories()[1]).toEqual({ name: 'movies', savePath: '', editing: false });
  });

  describe('add', () => {
    it('should call addCategory and append to the list', async () => {
      component.addForm.get('name')?.setValue('software');
      component.addForm.get('savePath')?.setValue('/downloads/software');
      await component.add();
      expect(mockQbService.addCategory).toHaveBeenCalledWith(
        'server-1',
        'software',
        '/downloads/software',
      );
      expect(component.categories().find((c) => c.name === 'software')).toEqual({
        name: 'software',
        savePath: '/downloads/software',
        editing: false,
      });
      expect(component.addForm.get('name')?.value).toBeNull();
    });

    it('should not add when name is empty', async () => {
      component.addForm.get('name')?.setValue('');
      await component.add();
      expect(mockQbService.addCategory).not.toHaveBeenCalled();
    });
  });

  describe('startEdit', () => {
    it('should set editing true only for the selected item', () => {
      component.startEdit(component.categories()[0]);
      expect(component.categories()[0].editing).toBe(true);
      expect(component.categories()[1].editing).toBe(false);
    });

    it('should pre-fill editSavePathControl with the item save path', () => {
      component.startEdit(component.categories()[0]);
      expect(component.editSavePathControl.value).toBe('/downloads/linux');
    });
  });

  describe('cancelEdit', () => {
    it('should clear editing state for all items', () => {
      component.startEdit(component.categories()[0]);
      component.cancelEdit();
      expect(component.categories().every((c) => !c.editing)).toBe(true);
    });
  });

  describe('saveEdit', () => {
    it('should call editCategory and update the save path in the list', async () => {
      component.startEdit(component.categories()[0]);
      component.editSavePathControl.setValue('/new/path');
      await component.saveEdit(component.categories()[0]);
      expect(mockQbService.editCategory).toHaveBeenCalledWith('server-1', 'linux', '/new/path');
      expect(component.categories()[0].savePath).toBe('/new/path');
      expect(component.categories()[0].editing).toBe(false);
    });
  });

  describe('delete', () => {
    it('should call removeCategories and remove the item from the list', async () => {
      const linux = component.categories()[0];
      await component.delete(linux);
      expect(mockQbService.removeCategories).toHaveBeenCalledWith('server-1', ['linux']);
      expect(component.categories().find((c) => c.name === 'linux')).toBeUndefined();
      expect(component.categories()).toHaveLength(1);
    });
  });
});
```

- [ ] **Step 2: Run to confirm the test fails**

Run: `npm test`

Expected: Failure with `Cannot find module './manage-categories'`.

- [ ] **Step 3: Create the component class**

Create `packages/app/src/app/components/modals/manage-categories/manage-categories.ts`:

```typescript
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { TranslatePipe } from '@ngx-translate/core';
import { QbService } from '../../../services/qb.service';
import { ServerStoreService } from '../../../services/server-store.service';

interface CategoryItem {
  name: string;
  savePath: string;
  editing: boolean;
}

@Component({
  selector: 'app-manage-categories',
  standalone: true,
  imports: [ReactiveFormsModule, TranslatePipe],
  templateUrl: './manage-categories.html',
  styleUrl: './manage-categories.scss',
})
export class ManageCategories implements OnInit {
  private readonly qbService = inject(QbService);
  private readonly serverStoreService = inject(ServerStoreService);
  public readonly activeModal = inject(NgbActiveModal);

  public categories = signal<CategoryItem[]>([]);
  public addForm = new FormGroup({
    name: new FormControl('', [Validators.required]),
    savePath: new FormControl(''),
  });
  public editSavePathControl = new FormControl('');
  public adding = signal(false);

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
    } catch (err) {
      console.error(ManageCategories.name, 'ngOnInit', 'Failed to load categories', err);
    }
  }

  public async add(): Promise<void> {
    const name = (this.addForm.get('name')?.value ?? '').trim();
    const savePath = (this.addForm.get('savePath')?.value ?? '').trim();
    if (!name) return;
    const serverId = this.serverStoreService.currentServerId() as string;
    try {
      this.adding.set(true);
      await this.qbService.addCategory(serverId, name, savePath);
      this.categories.set([...this.categories(), { name, savePath, editing: false }]);
      this.addForm.reset();
    } catch (err) {
      console.error(ManageCategories.name, 'add', 'Failed to add category', err);
    } finally {
      this.adding.set(false);
    }
  }

  public startEdit(item: CategoryItem): void {
    this.categories.set(this.categories().map((c) => ({ ...c, editing: c.name === item.name })));
    this.editSavePathControl.setValue(item.savePath);
  }

  public cancelEdit(): void {
    this.categories.set(this.categories().map((c) => ({ ...c, editing: false })));
  }

  public async saveEdit(item: CategoryItem): Promise<void> {
    const newPath = (this.editSavePathControl.value ?? '').trim();
    const serverId = this.serverStoreService.currentServerId() as string;
    try {
      await this.qbService.editCategory(serverId, item.name, newPath);
      this.categories.set(
        this.categories().map((c) =>
          c.name === item.name ? { ...c, savePath: newPath, editing: false } : c,
        ),
      );
    } catch (err) {
      console.error(ManageCategories.name, 'saveEdit', 'Failed to edit category', err);
    }
  }

  public async delete(item: CategoryItem): Promise<void> {
    const serverId = this.serverStoreService.currentServerId() as string;
    try {
      await this.qbService.removeCategories(serverId, [item.name]);
      this.categories.set(this.categories().filter((c) => c.name !== item.name));
    } catch (err) {
      console.error(ManageCategories.name, 'delete', 'Failed to delete category', err);
    }
  }
}
```

- [ ] **Step 4: Create the template**

Create `packages/app/src/app/components/modals/manage-categories/manage-categories.html`:

```html
<div class="modal-header">
  <h5 class="modal-title">{{ 'components.modals.manage-categories.title' | translate }}</h5>
  <button
    type="button"
    class="btn-close"
    aria-label="Close"
    (click)="activeModal.dismiss()"
  ></button>
</div>

<div class="modal-body">
  <form [formGroup]="addForm">
    <div class="d-flex gap-2 mb-3 align-items-end">
      <div class="form-floating flex-grow-1">
        <input
          type="text"
          class="form-control"
          id="category-name"
          placeholder="Category name"
          formControlName="name"
          (keydown.enter)="add()"
        />
        <label for="category-name">
          {{ 'components.modals.manage-categories.add-form.name' | translate }}
        </label>
      </div>
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
      <button
        class="btn btn-primary"
        type="button"
        (click)="add()"
        [disabled]="!addForm.valid || adding()"
      >
        {{ 'general.button.add' | translate }}
      </button>
    </div>
  </form>

  @if (categories().length > 0) {
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
          {{ item.savePath || ('components.modals.manage-categories.list.no-save-path' | translate)
          }}
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
</div>

<div class="modal-footer">
  <button type="button" class="btn btn-secondary" (click)="activeModal.dismiss()">
    {{ 'general.button.close' | translate }}
  </button>
</div>
```

- [ ] **Step 5: Create the empty stylesheet**

Create `packages/app/src/app/components/modals/manage-categories/manage-categories.scss` with no content (empty file).

- [ ] **Step 6: Run tests and confirm they pass**

Run: `npm test`

Expected: All `ManageCategories` tests pass.

- [ ] **Step 7: Commit**

```bash
git add packages/app/src/app/components/modals/manage-categories/
git commit -m "#100: add ManageCategories modal component"
```

---

## Task 5: Wire commands in UiCommandHandlerService

**Files:**

- Modify: `packages/app/src/app/services/ui-command-handler.service.ts`

- [ ] **Step 1: Import the new components**

At the top of `packages/app/src/app/services/ui-command-handler.service.ts`, add two imports alongside the existing modal imports:

```typescript
import { ManageCategories } from '../components/modals/manage-categories/manage-categories';
import { ManageLabels } from '../components/modals/manage-labels/manage-labels';
```

- [ ] **Step 2: Add cases to the switch statement**

Inside the `switch (command.type)` block in `UiCommandHandlerService.start()`, add before the `default:` case:

```typescript
case 'UI_MANAGE_LABELS':
  if (this.isModalOpen(ManageLabels)) break;
  const manageLabelsModalRef = this.modalService.open(ManageLabels);
  manageLabelsModalRef.result.then(() => {}).catch(() => {});
  break;

case 'UI_MANAGE_CATEGORIES':
  if (this.isModalOpen(ManageCategories)) break;
  const manageCategoriesModalRef = this.modalService.open(ManageCategories);
  manageCategoriesModalRef.result.then(() => {}).catch(() => {});
  break;
```

- [ ] **Step 3: Verify linting passes**

Run: `npm run lint`

Expected: Zero errors and zero warnings.

- [ ] **Step 4: Commit**

```bash
git add packages/app/src/app/services/ui-command-handler.service.ts
git commit -m "#100: wire UI_MANAGE_LABELS and UI_MANAGE_CATEGORIES in UiCommandHandlerService"
```

---

## Task 6: Wire Electron application menu

**Files:**

- Modify: `packages/electron/src/menu.ts`
- Modify: `packages/app/src/app/services/menu-bar-command-handler.service.ts`

- [ ] **Step 1: Add two menu items to the Settings submenu in `menu.ts`**

In `packages/electron/src/menu.ts`, the Settings submenu currently has `app-settings` and `qb-settings`. Add a separator and two new items after `qb-settings`:

```typescript
{
  label: t('electron.menu.settings-menu'),
  submenu: [
    {
      label: t('electron.menu.app-settings'),
      accelerator: 'Ctrl+,',
      click: () => sendMenuAction(mainWindow, 'settings.app'),
    },
    {
      label: t('electron.menu.qb-settings'),
      click: () => sendMenuAction(mainWindow, 'settings.qb'),
    },
    { type: 'separator' },
    {
      label: t('electron.menu.manage-labels'),
      click: () => sendMenuAction(mainWindow, 'settings.manage-labels'),
    },
    {
      label: t('electron.menu.manage-categories'),
      click: () => sendMenuAction(mainWindow, 'settings.manage-categories'),
    },
  ],
},
```

- [ ] **Step 2: Handle the new actions in `MenuBarCommandHandlerService`**

In `packages/app/src/app/services/menu-bar-command-handler.service.ts`, inside the `switch (action)` block, add before the `default:` case:

```typescript
case 'settings.manage-labels':
  this.commandBusService.emit({ type: 'UI_MANAGE_LABELS' });
  break;

case 'settings.manage-categories':
  this.commandBusService.emit({ type: 'UI_MANAGE_CATEGORIES' });
  break;
```

- [ ] **Step 3: Verify linting passes**

Run: `npm run lint`

Expected: Zero errors and zero warnings.

- [ ] **Step 4: Commit**

```bash
git add packages/electron/src/menu.ts packages/app/src/app/services/menu-bar-command-handler.service.ts
git commit -m "#100: add manage labels and categories to electron application menu"
```

---

## Task 7: ng-select footer templates and remove inline tag creation

**Files:**

- Modify: `packages/app/src/app/components/tag-select/tag-select.ts`
- Modify: `packages/app/src/app/components/tag-select/tag-select.html`
- Modify: `packages/app/src/app/components/tag-select/tag-select.spec.ts`
- Modify: `packages/app/src/app/components/category-select/category-select.ts`
- Modify: `packages/app/src/app/components/category-select/category-select.html`
- Modify: `packages/app/src/app/components/category-select/category-select.spec.ts`

- [ ] **Step 1: Update `tag-select.ts`**

Replace the full content of `packages/app/src/app/components/tag-select/tag-select.ts` with:

```typescript
import { CommonModule } from '@angular/common';
import {
  AfterViewInit,
  Component,
  Input,
  OnInit,
  ViewChild,
  forwardRef,
  inject,
  signal,
} from '@angular/core';
import {
  ControlValueAccessor,
  FormControl,
  NG_VALUE_ACCESSOR,
  ReactiveFormsModule,
} from '@angular/forms';
import { NgSelectComponent } from '@ng-select/ng-select';
import { TranslatePipe } from '@ngx-translate/core';
import { CommandBusService } from '../../services/command-bus.service';
import { QbService } from '../../services/qb.service';
import { ServerStoreService } from '../../services/server-store.service';
import { BbPopover } from '../bb-popover/bb-popover';

@Component({
  selector: 'app-tag-select',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, NgSelectComponent, TranslatePipe, BbPopover],
  templateUrl: './tag-select.html',
  styleUrls: ['./tag-select.scss'],
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => TagSelect),
      multi: true,
    },
  ],
})
export class TagSelect implements OnInit, ControlValueAccessor, AfterViewInit {
  @Input() autofocus = false;
  @ViewChild('ngselect') ngselect!: NgSelectComponent;

  private readonly serverStoreService = inject(ServerStoreService);
  private readonly qbService = inject(QbService);
  private readonly commandBusService = inject(CommandBusService);

  public tags = signal<string[]>([]);
  public selectControl = new FormControl<string[]>([]);

  private onChange: (value: string[] | null) => void = () => {};
  private onTouched: () => void = () => {};

  async ngOnInit(): Promise<void> {
    await this.loadAllTags();

    this.selectControl.valueChanges.subscribe((value) => {
      this.onChange(value);
      this.onTouched();
    });
  }

  public ngAfterViewInit(): void {
    if (this.autofocus) {
      this.ngselect.focus();
    }
  }

  writeValue(value: string[]): void {
    this.selectControl.setValue(value, { emitEvent: false });
  }

  registerOnChange(fn: any): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: any): void {
    this.onTouched = fn;
  }

  setDisabledState?(isDisabled: boolean): void {
    if (isDisabled) {
      this.selectControl.disable();
    } else {
      this.selectControl.enable();
    }
  }

  keyDownFn(event: KeyboardEvent): boolean {
    if (event.key === 'Escape') {
      return false;
    }

    return true;
  }

  public openManageLabels(event: Event): void {
    event.preventDefault();
    this.ngselect.close();
    this.commandBusService.emit({ type: 'UI_MANAGE_LABELS' });
  }

  private async loadAllTags(): Promise<void> {
    try {
      const tags = await this.qbService.getAllTags(
        this.serverStoreService.currentServerId() as string,
      );
      this.tags.set(tags);
    } catch (err) {
      console.error(TagSelect.name, 'loadAllTags', 'Failed to get torrent tags!', err);
    }
  }
}
```

- [ ] **Step 2: Update `tag-select.html`**

Replace the full content of `packages/app/src/app/components/tag-select/tag-select.html` with:

```html
<div class="container-fluid px-0">
  <div class="row">
    <div class="col-11">
      <div class="form-floating">
        <ng-select
          [items]="tags()"
          [multiple]="true"
          [hideSelected]="true"
          [searchable]="true"
          [clearable]="true"
          [clearSearchOnAdd]="true"
          [formControl]="selectControl"
          [keyDownFn]="keyDownFn"
          [openOnEnter]="false"
          [footerTemplate]="manageFooter"
          #ngselect
        >
        </ng-select>
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
</div>

<ng-template #tagPopover>
  <p>{{ 'components.tag-select.popover.description.line1' | translate }}</p>
  <p>{{ 'components.tag-select.popover.description.line2' | translate }}</p>
</ng-template>

<ng-template #manageFooter>
  <div class="px-3 py-2 border-top">
    <a href="#" class="small text-decoration-none" (click)="openManageLabels($event)">
      {{ 'components.tag-select.manage' | translate }}
    </a>
  </div>
</ng-template>
```

- [ ] **Step 3: Update `tag-select.spec.ts`**

Replace the full content of `packages/app/src/app/components/tag-select/tag-select.spec.ts` with:

```typescript
import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CommandBusService } from '../../services/command-bus.service';
import { QbService } from '../../services/qb.service';
import { ServerStoreService } from '../../services/server-store.service';
import { TagSelect } from './tag-select';

describe('TagSelect', () => {
  let component: TagSelect;
  let fixture: ComponentFixture<TagSelect>;
  let mockQbService: any;
  let mockCommandBusService: Partial<CommandBusService>;

  beforeEach(async () => {
    mockQbService = {
      getAllTags: vi.fn().mockResolvedValue(['action', 'comedy']),
    };
    mockCommandBusService = { emit: vi.fn() };

    await TestBed.configureTestingModule({
      imports: [TagSelect],
      providers: [
        { provide: ServerStoreService, useValue: { currentServerId: signal('server-1') } },
        { provide: QbService, useValue: mockQbService },
        { provide: CommandBusService, useValue: mockCommandBusService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(TagSelect);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('writeValue', () => {
    it('should set the select control value', () => {
      component.writeValue(['action', 'comedy']);
      expect(component.selectControl.value).toEqual(['action', 'comedy']);
    });
  });

  describe('setDisabledState', () => {
    it('should disable the control', () => {
      component.setDisabledState!(true);
      expect(component.selectControl.disabled).toBe(true);
    });

    it('should enable the control', () => {
      component.setDisabledState!(true);
      component.setDisabledState!(false);
      expect(component.selectControl.enabled).toBe(true);
    });
  });

  describe('keyDownFn', () => {
    it('should return false for Escape key', () => {
      expect(component.keyDownFn(new KeyboardEvent('keydown', { key: 'Escape' }))).toBe(false);
    });

    it('should return true for other keys', () => {
      expect(component.keyDownFn(new KeyboardEvent('keydown', { key: 'Tab' }))).toBe(true);
    });
  });

  describe('ngOnInit', () => {
    it('should load all tags on init', async () => {
      await component.ngOnInit();
      expect(component.tags()).toEqual(['action', 'comedy']);
    });

    it('should call onChange when select control value changes', () => {
      const onChange = vi.fn();
      component.registerOnChange(onChange);
      component.ngOnInit();
      component.selectControl.setValue(['action']);
      expect(onChange).toHaveBeenCalledWith(['action']);
    });
  });

  describe('openManageLabels', () => {
    it('should emit UI_MANAGE_LABELS and prevent default', () => {
      const event = new MouseEvent('click');
      vi.spyOn(event, 'preventDefault');
      component.openManageLabels(event);
      expect(event.preventDefault).toHaveBeenCalled();
      expect(mockCommandBusService.emit).toHaveBeenCalledWith({ type: 'UI_MANAGE_LABELS' });
    });
  });
});
```

- [ ] **Step 4: Update `category-select.ts`**

Replace the full content of `packages/app/src/app/components/category-select/category-select.ts` with:

```typescript
import { CommonModule } from '@angular/common';
import {
  AfterViewInit,
  Component,
  Input,
  OnInit,
  ViewChild,
  forwardRef,
  inject,
  signal,
} from '@angular/core';
import {
  ControlValueAccessor,
  FormControl,
  NG_VALUE_ACCESSOR,
  ReactiveFormsModule,
} from '@angular/forms';
import { NgSelectComponent } from '@ng-select/ng-select';
import { TranslatePipe } from '@ngx-translate/core';
import { CommandBusService } from '../../services/command-bus.service';
import { QbService } from '../../services/qb.service';
import { ServerStoreService } from '../../services/server-store.service';
import { BbPopover } from '../bb-popover/bb-popover';

@Component({
  selector: 'app-category-select',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, NgSelectComponent, TranslatePipe, BbPopover],
  templateUrl: './category-select.html',
  styleUrls: ['./category-select.scss'],
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => CategorySelect),
      multi: true,
    },
  ],
})
export class CategorySelect implements OnInit, ControlValueAccessor, AfterViewInit {
  @ViewChild('ngselect') ngselect!: NgSelectComponent;
  @Input() autofocus = false;

  private readonly serverStoreService = inject(ServerStoreService);
  private readonly qbService = inject(QbService);
  private readonly commandBusService = inject(CommandBusService);

  public categories = signal<string[]>([]);
  public selectControl = new FormControl('');

  private onChange: (value: string | null) => void = () => {};
  private onTouched: () => void = () => {};

  ngOnInit(): void {
    this.qbService
      .getAllCategories(this.serverStoreService.currentServerId() as string)
      .then((categories) => {
        this.categories.set(Object.keys(categories));
      })
      .catch((err) => console.error('Failed to get torrent categories!', err));

    this.selectControl.valueChanges.subscribe((value) => {
      this.onChange(value);
      this.onTouched();
    });
  }

  public ngAfterViewInit(): void {
    if (this.autofocus) {
      this.ngselect.focus();
    }
  }

  writeValue(value: any): void {
    this.selectControl.setValue(value, { emitEvent: false });
  }

  registerOnChange(fn: any): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: any): void {
    this.onTouched = fn;
  }

  setDisabledState?(isDisabled: boolean): void {
    if (isDisabled) {
      this.selectControl.disable();
    } else {
      this.selectControl.enable();
    }
  }

  keyDownFn(event: KeyboardEvent): boolean {
    if (event.key === 'Escape') {
      return false;
    }

    return true;
  }

  public openManageCategories(event: Event): void {
    event.preventDefault();
    this.ngselect.close();
    this.commandBusService.emit({ type: 'UI_MANAGE_CATEGORIES' });
  }
}
```

- [ ] **Step 5: Update `category-select.html`**

Replace the full content of `packages/app/src/app/components/category-select/category-select.html` with:

```html
<div class="container-fluid px-0">
  <div class="row">
    <div class="col-11">
      <div class="form-floating">
        <ng-select
          [items]="categories()"
          [searchable]="true"
          [clearable]="true"
          [formControl]="selectControl"
          [keyDownFn]="keyDownFn"
          [openOnEnter]="false"
          [footerTemplate]="manageFooter"
          #ngselect
        >
        </ng-select>
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
</div>

<ng-template #categoryPopover>
  <p>{{ 'components.category-select.popover.description.line1' | translate }}</p>
  <p>{{ 'components.category-select.popover.description.line2' | translate }}</p>
</ng-template>

<ng-template #manageFooter>
  <div class="px-3 py-2 border-top">
    <a href="#" class="small text-decoration-none" (click)="openManageCategories($event)">
      {{ 'components.category-select.manage' | translate }}
    </a>
  </div>
</ng-template>
```

- [ ] **Step 6: Update `category-select.spec.ts`**

Read the current `packages/app/src/app/components/category-select/category-select.spec.ts`, then add `CommandBusService` to the providers and add an `openManageCategories` test block alongside the existing tests. The mock provider to add:

```typescript
{ provide: CommandBusService, useValue: { emit: vi.fn() } }
```

The new test block to add inside `describe('CategorySelect', ...)`:

```typescript
describe('openManageCategories', () => {
  it('should emit UI_MANAGE_CATEGORIES and prevent default', () => {
    const commandBus = TestBed.inject(CommandBusService);
    const event = new MouseEvent('click');
    vi.spyOn(event, 'preventDefault');
    component.openManageCategories(event);
    expect(event.preventDefault).toHaveBeenCalled();
    expect(commandBus.emit).toHaveBeenCalledWith({ type: 'UI_MANAGE_CATEGORIES' });
  });
});
```

Also add the import at the top:

```typescript
import { CommandBusService } from '../../services/command-bus.service';
```

- [ ] **Step 7: Run all tests**

Run: `npm test`

Expected: All tests pass with zero failures.

- [ ] **Step 8: Run lint**

Run: `npm run lint`

Expected: Zero errors and zero warnings.

- [ ] **Step 9: Commit**

```bash
git add packages/app/src/app/components/tag-select/ packages/app/src/app/components/category-select/
git commit -m "#100: add manage footer to ng-selects and remove inline tag creation"
```
