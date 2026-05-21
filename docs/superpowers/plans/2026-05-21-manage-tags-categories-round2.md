# Manage Tags & Categories Round 2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add comma-separated tag input, torrent-count-aware delete confirmation, a filter field, a max-height cap on lists, a vertically centred Add button, and corrected edit-row button styles in manage-categories.

**Architecture:** All changes are self-contained in the two modal components and their i18n files. Torrent counts come from `TorrentStoreService.torrentsArray()` (already in memory — no API calls). Filtering uses `toSignal` from `@angular/core/rxjs-interop` to bridge the `FormControl` observable into a `computed()` signal.

**Tech Stack:** Angular 20 (signals, zoneless), `@angular/core/rxjs-interop`, Bootstrap 5, ngx-translate, Vitest

---

### Task 1: Update i18n files

**Files:**

- Modify: `public/i18n/us.json` (lines ~591-616)
- Modify: `public/i18n/hu.json` (lines ~591-616)

- [ ] **Step 1: Update manage-tags keys in us.json**

Find the `"manage-tags"` block inside `components.modals` and replace it:

```json
"manage-tags": {
  "title": "Manage Tags",
  "add-form": {
    "name": "Tag name"
  },
  "filter": {
    "placeholder": "Filter tags..."
  },
  "empty": "No tags yet.",
  "delete-confirm": {
    "title": "Delete Tag",
    "message": "Are you sure you want to delete the tag \"{{ name }}\"? It is used by {{ count }} torrent(s)."
  }
}
```

- [ ] **Step 2: Update manage-categories keys in us.json**

Find the `"manage-categories"` block inside `components.modals` and replace it:

```json
"manage-categories": {
  "title": "Manage Categories",
  "add-form": {
    "name": "Category name",
    "save-path": "Save path (optional)"
  },
  "filter": {
    "placeholder": "Filter categories..."
  },
  "list": {
    "no-save-path": "No save path"
  },
  "empty": "No categories yet.",
  "delete-confirm": {
    "title": "Delete Category",
    "message": "Are you sure you want to delete the category \"{{ name }}\"? It is assigned to {{ count }} torrent(s)."
  }
}
```

- [ ] **Step 3: Update manage-tags keys in hu.json**

Find and replace the `"manage-tags"` block:

```json
"manage-tags": {
  "title": "Cimkék kezelése",
  "add-form": {
    "name": "Cimke neve"
  },
  "filter": {
    "placeholder": "Cimkék szűrése..."
  },
  "empty": "Még nincsenek cimkék.",
  "delete-confirm": {
    "title": "Cimke törlése",
    "message": "Biztosan törölni szeretnéd a \"{{ name }}\" cimkét? {{ count }} torrent használja."
  }
}
```

- [ ] **Step 4: Update manage-categories keys in hu.json**

Find and replace the `"manage-categories"` block:

```json
"manage-categories": {
  "title": "Kategóriák kezelése",
  "add-form": {
    "name": "Kategória neve",
    "save-path": "Mentési útvonal (opcionális)"
  },
  "filter": {
    "placeholder": "Kategóriák szűrése..."
  },
  "list": {
    "no-save-path": "Nincs mentési útvonal"
  },
  "empty": "Még nincsenek kategóriák.",
  "delete-confirm": {
    "title": "Kategória törlése",
    "message": "Biztosan törölni szeretnéd a \"{{ name }}\" kategóriát? {{ count }} torrenthez van hozzárendelve."
  }
}
```

- [ ] **Step 5: Commit i18n changes**

```bash
git add public/i18n/us.json public/i18n/hu.json
git commit -m "#100: update i18n for manage-tags and manage-categories round 2"
```

---

### Task 2: manage-tags — TypeScript, template, and SCSS

**Files:**

- Modify: `packages/app/src/app/components/modals/manage-tags/manage-tags.ts`
- Modify: `packages/app/src/app/components/modals/manage-tags/manage-tags.html`
- Modify: `packages/app/src/app/components/modals/manage-tags/manage-tags.scss`
- Test: `packages/app/src/app/components/modals/manage-tags/manage-tags.spec.ts`

- [ ] **Step 1: Replace manage-tags.ts**

```typescript
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { faTrashCan } from '@fortawesome/free-regular-svg-icons';
import { NgbActiveModal, NgbTooltipModule } from '@ng-bootstrap/ng-bootstrap';
import { TranslatePipe } from '@ngx-translate/core';
import { ConfirmService } from '../../../services/confirm.service';
import { QbService } from '../../../services/qb.service';
import { ServerStoreService } from '../../../services/server-store.service';
import { TorrentStoreService } from '../../../services/torrent-store.service';

@Component({
  selector: 'app-manage-tags',
  standalone: true,
  imports: [ReactiveFormsModule, TranslatePipe, FontAwesomeModule, NgbTooltipModule],
  templateUrl: './manage-tags.html',
  styleUrl: './manage-tags.scss',
})
export class ManageTags implements OnInit {
  private readonly qbService = inject(QbService);
  private readonly serverStoreService = inject(ServerStoreService);
  private readonly confirmService = inject(ConfirmService);
  private readonly torrentStoreService = inject(TorrentStoreService);
  public readonly activeModal = inject(NgbActiveModal);

  public readonly icon = { faTrashCan };

  public tags = signal<string[]>([]);
  public nameControl = new FormControl('', [Validators.required]);
  public filterControl = new FormControl('');
  public adding = signal(false);
  public loading = signal(true);

  private readonly filterValue = toSignal(this.filterControl.valueChanges, { initialValue: '' });

  public readonly filteredTags = computed(() => {
    const filter = (this.filterValue() ?? '').toLowerCase();
    if (!filter) return this.tags();
    return this.tags().filter((tag) => tag.toLowerCase().includes(filter));
  });

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

  public async add(): Promise<void> {
    const raw = (this.nameControl.value ?? '').trim();
    if (!raw) return;
    const names = raw
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    if (names.length === 0) return;
    const serverId = this.serverStoreService.currentServerId() as string;
    try {
      this.adding.set(true);
      await this.qbService.createTags(serverId, names);
      this.tags.set([...this.tags(), ...names].sort((a, b) => a.localeCompare(b)));
      this.nameControl.reset();
    } catch (err) {
      console.error(ManageTags.name, 'add', 'Failed to add tag', err);
    } finally {
      this.adding.set(false);
    }
  }

  public async delete(tag: string): Promise<void> {
    const count = this.torrentStoreService.torrentsArray().filter((t) =>
      (t.tags ?? '')
        .split(',')
        .map((s) => s.trim())
        .includes(tag),
    ).length;

    const confirmed = await this.confirmService.confirm(
      'components.modals.manage-tags.delete-confirm.title',
      {
        text: 'components.modals.manage-tags.delete-confirm.message',
        data: { name: tag, count },
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
}
```

- [ ] **Step 2: Replace manage-tags.html**

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
  <div class="d-flex gap-2 mb-3 align-items-center">
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

  @if (!loading()) {
  <div class="mb-3">
    <input
      type="text"
      class="form-control"
      [placeholder]="'components.modals.manage-tags.filter.placeholder' | translate"
      [formControl]="filterControl"
    />
  </div>
  } @if (loading()) {
  <div class="d-flex justify-content-center py-3">
    <div class="spinner-border spinner-border-sm" role="status">
      <span class="visually-hidden">Loading...</span>
    </div>
  </div>
  } @else if (filteredTags().length > 0) {
  <ul class="list-group">
    @for (tag of filteredTags(); track tag) {
    <li class="list-group-item d-flex align-items-center justify-content-between">
      <span>{{ tag }}</span>
      <button
        type="button"
        class="btn btn-link text-danger p-1"
        [ngbTooltip]="'general.button.delete' | translate"
        (click)="delete(tag)"
      >
        <fa-icon [icon]="icon.faTrashCan" />
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

- [ ] **Step 3: Add max-height rule to manage-tags.scss**

Append to `packages/app/src/app/components/modals/manage-tags/manage-tags.scss`:

```scss
.list-group {
  max-height: 600px;
  overflow-y: auto;
}
```

- [ ] **Step 4: Update manage-tags.spec.ts**

Replace the full file with the updated tests that cover the new behaviour. The key changes are:

- Add `TorrentStoreService` mock to `beforeEach` providers
- Add comma-split tests to the `add` describe block
- Add a torrent-count test to the `delete` describe block
- Add a `filteredTags` describe block

```typescript
import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { ConfirmService } from '../../../services/confirm.service';
import { QbService } from '../../../services/qb.service';
import { ServerStoreService } from '../../../services/server-store.service';
import { TorrentStoreService } from '../../../services/torrent-store.service';
import { ManageTags } from './manage-tags';

describe('ManageTags', () => {
  let component: ManageTags;
  let fixture: ComponentFixture<ManageTags>;
  let mockQbService: Partial<QbService>;
  let mockActiveModal: Partial<NgbActiveModal>;
  let mockConfirmService: Partial<ConfirmService>;

  beforeEach(async () => {
    mockActiveModal = { dismiss: vi.fn() };
    mockQbService = {
      getAllTags: vi.fn().mockResolvedValue(['movies', 'linux']),
      createTags: vi.fn().mockResolvedValue(undefined),
      deleteTags: vi.fn().mockResolvedValue(undefined),
    };
    mockConfirmService = { confirm: vi.fn().mockResolvedValue(true) };

    await TestBed.configureTestingModule({
      imports: [ManageTags],
      providers: [
        { provide: NgbActiveModal, useValue: mockActiveModal },
        { provide: ServerStoreService, useValue: { currentServerId: signal('server-1') } },
        { provide: QbService, useValue: mockQbService },
        { provide: ConfirmService, useValue: mockConfirmService },
        {
          provide: TorrentStoreService,
          useValue: {
            torrentsArray: signal([
              { tags: 'linux,movies', category: '' },
              { tags: 'linux', category: 'software' },
              { tags: 'movies', category: '' },
            ] as any),
          },
        },
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

  it('should set loading to false after init completes', () => {
    expect(component.loading()).toBe(false);
  });

  it('should load tags sorted alphabetically', () => {
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

    it('should maintain alphabetical order after adding a new tag', async () => {
      component.nameControl.setValue('alpha');
      await component.add();
      expect(component.tags()[0]).toBe('alpha');
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

    it('should split comma-separated input and add each tag', async () => {
      component.nameControl.setValue('alpha, beta, gamma');
      await component.add();
      expect(mockQbService.createTags).toHaveBeenCalledWith('server-1', ['alpha', 'beta', 'gamma']);
      expect(component.tags()).toContain('alpha');
      expect(component.tags()).toContain('beta');
      expect(component.tags()).toContain('gamma');
    });

    it('should trim whitespace from each comma-separated segment', async () => {
      component.nameControl.setValue('  alpha  ,  beta  ');
      await component.add();
      expect(mockQbService.createTags).toHaveBeenCalledWith('server-1', ['alpha', 'beta']);
    });

    it('should skip empty segments in comma-separated input', async () => {
      component.nameControl.setValue('tag1,,tag2,  ,tag3');
      await component.add();
      expect(mockQbService.createTags).toHaveBeenCalledWith('server-1', ['tag1', 'tag2', 'tag3']);
    });
  });

  describe('delete', () => {
    it('should show a confirm dialog before deleting', async () => {
      await component.delete('linux');
      expect(mockConfirmService.confirm).toHaveBeenCalled();
    });

    it('should pass the torrent count to the confirm dialog', async () => {
      await component.delete('linux');
      // The mock has 2 torrents with 'linux' tag
      expect(mockConfirmService.confirm).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ data: { name: 'linux', count: 2 } }),
        expect.any(String),
      );
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

  describe('filteredTags', () => {
    it('should return all tags when filter is empty', () => {
      expect(component.filteredTags()).toEqual(['linux', 'movies']);
    });

    it('should filter tags case-insensitively by substring', () => {
      component.filterControl.setValue('lin');
      expect(component.filteredTags()).toEqual(['linux']);
      expect(component.filteredTags()).not.toContain('movies');
    });

    it('should match case-insensitively', () => {
      component.filterControl.setValue('LIN');
      expect(component.filteredTags()).toContain('linux');
    });

    it('should return all tags when filter is cleared', () => {
      component.filterControl.setValue('lin');
      component.filterControl.setValue('');
      expect(component.filteredTags()).toEqual(['linux', 'movies']);
    });
  });
});
```

- [ ] **Step 5: Run tests and verify they pass**

```bash
npm test -- --project=app --reporter=verbose 2>&1 | grep -E "(PASS|FAIL|manage-tags)"
```

Expected: all manage-tags tests pass.

- [ ] **Step 6: Commit manage-tags changes**

```bash
git add packages/app/src/app/components/modals/manage-tags/
git commit -m "#100: add comma-split input, filter, torrent count in confirm, and max-height to manage-tags"
```

---

### Task 3: manage-categories — TypeScript, template, and SCSS

**Files:**

- Modify: `packages/app/src/app/components/modals/manage-categories/manage-categories.ts`
- Modify: `packages/app/src/app/components/modals/manage-categories/manage-categories.html`
- Modify: `packages/app/src/app/components/modals/manage-categories/manage-categories.scss`
- Test: `packages/app/src/app/components/modals/manage-categories/manage-categories.spec.ts`

- [ ] **Step 1: Replace manage-categories.ts**

```typescript
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { faEdit, faTrashCan } from '@fortawesome/free-regular-svg-icons';
import { NgbActiveModal, NgbTooltipModule } from '@ng-bootstrap/ng-bootstrap';
import { TranslatePipe } from '@ngx-translate/core';
import { ConfirmService } from '../../../services/confirm.service';
import { QbService } from '../../../services/qb.service';
import { ServerStoreService } from '../../../services/server-store.service';
import { TorrentStoreService } from '../../../services/torrent-store.service';

interface CategoryItem {
  name: string;
  savePath: string;
  editing: boolean;
}

@Component({
  selector: 'app-manage-categories',
  standalone: true,
  imports: [ReactiveFormsModule, TranslatePipe, FontAwesomeModule, NgbTooltipModule],
  templateUrl: './manage-categories.html',
  styleUrl: './manage-categories.scss',
})
export class ManageCategories implements OnInit {
  private readonly qbService = inject(QbService);
  private readonly serverStoreService = inject(ServerStoreService);
  private readonly confirmService = inject(ConfirmService);
  private readonly torrentStoreService = inject(TorrentStoreService);
  public readonly activeModal = inject(NgbActiveModal);

  public readonly icon = { faEdit, faTrashCan };

  public categories = signal<CategoryItem[]>([]);
  public addForm = new FormGroup({
    name: new FormControl('', [Validators.required]),
    savePath: new FormControl(''),
  });
  public editSavePathControl = new FormControl('');
  public filterControl = new FormControl('');
  public adding = signal(false);
  public loading = signal(true);

  private readonly filterValue = toSignal(this.filterControl.valueChanges, { initialValue: '' });

  public readonly filteredCategories = computed(() => {
    const filter = (this.filterValue() ?? '').toLowerCase();
    if (!filter) return this.categories();
    return this.categories().filter((c) => c.editing || c.name.toLowerCase().includes(filter));
  });

  public async ngOnInit(): Promise<void> {
    try {
      const raw = await this.qbService.getAllCategories(
        this.serverStoreService.currentServerId() as string,
      );
      this.categories.set(
        Object.entries(raw)
          .map(([name, cat]) => ({
            name,
            savePath: cat.savePath ?? '',
            editing: false,
          }))
          .sort((a, b) => a.name.localeCompare(b.name)),
      );
    } catch (err) {
      console.error(ManageCategories.name, 'ngOnInit', 'Failed to load categories', err);
    } finally {
      this.loading.set(false);
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
      this.categories.set(
        [...this.categories(), { name, savePath, editing: false }].sort((a, b) =>
          a.name.localeCompare(b.name),
        ),
      );
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
    const count = this.torrentStoreService
      .torrentsArray()
      .filter((t) => t.category === item.name).length;

    const confirmed = await this.confirmService.confirm(
      'components.modals.manage-categories.delete-confirm.title',
      {
        text: 'components.modals.manage-categories.delete-confirm.message',
        data: { name: item.name, count },
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
}
```

- [ ] **Step 2: Replace manage-categories.html**

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
    <div class="d-flex gap-2 mb-3 align-items-center">
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
        [disabled]="!(addForm.get('name')?.value ?? '').trim() || adding()"
      >
        {{ 'general.button.add' | translate }}
      </button>
    </div>
  </form>

  @if (!loading()) {
  <div class="mb-3">
    <input
      type="text"
      class="form-control"
      [placeholder]="'components.modals.manage-categories.filter.placeholder' | translate"
      [formControl]="filterControl"
    />
  </div>
  } @if (loading()) {
  <div class="d-flex justify-content-center py-3">
    <div class="spinner-border spinner-border-sm" role="status">
      <span class="visually-hidden">Loading...</span>
    </div>
  </div>
  } @else if (filteredCategories().length > 0) {
  <ul class="list-group">
    @for (item of filteredCategories(); track item.name) { @if (item.editing) {
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

- [ ] **Step 3: Add max-height rule to manage-categories.scss**

Append to `packages/app/src/app/components/modals/manage-categories/manage-categories.scss`:

```scss
.list-group {
  max-height: 600px;
  overflow-y: auto;
}
```

- [ ] **Step 4: Replace manage-categories.spec.ts**

```typescript
import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { ConfirmService } from '../../../services/confirm.service';
import { QbService } from '../../../services/qb.service';
import { ServerStoreService } from '../../../services/server-store.service';
import { TorrentStoreService } from '../../../services/torrent-store.service';
import { ManageCategories } from './manage-categories';

describe('ManageCategories', () => {
  let component: ManageCategories;
  let fixture: ComponentFixture<ManageCategories>;
  let mockQbService: Partial<QbService>;
  let mockActiveModal: Partial<NgbActiveModal>;
  let mockConfirmService: Partial<ConfirmService>;

  beforeEach(async () => {
    mockActiveModal = { dismiss: vi.fn() };
    mockQbService = {
      getAllCategories: vi.fn().mockResolvedValue({
        movies: { name: 'movies', savePath: '' },
        linux: { name: 'linux', savePath: '/downloads/linux' },
      }),
      addCategory: vi.fn().mockResolvedValue(undefined),
      editCategory: vi.fn().mockResolvedValue(undefined),
      removeCategories: vi.fn().mockResolvedValue(undefined),
    };
    mockConfirmService = { confirm: vi.fn().mockResolvedValue(true) };

    await TestBed.configureTestingModule({
      imports: [ManageCategories],
      providers: [
        { provide: NgbActiveModal, useValue: mockActiveModal },
        { provide: ServerStoreService, useValue: { currentServerId: signal('server-1') } },
        { provide: QbService, useValue: mockQbService },
        { provide: ConfirmService, useValue: mockConfirmService },
        {
          provide: TorrentStoreService,
          useValue: {
            torrentsArray: signal([
              { tags: '', category: 'linux' },
              { tags: '', category: 'linux' },
              { tags: '', category: 'movies' },
            ] as any),
          },
        },
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

  it('should set loading to false after init completes', () => {
    expect(component.loading()).toBe(false);
  });

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

    it('should maintain alphabetical order after adding a new category', async () => {
      component.addForm.get('name')?.setValue('alpha');
      await component.add();
      expect(component.categories()[0].name).toBe('alpha');
    });

    it('should not add when name is empty', async () => {
      component.addForm.get('name')?.setValue('');
      await component.add();
      expect(mockQbService.addCategory).not.toHaveBeenCalled();
    });

    it('should not add when name is whitespace only', async () => {
      component.addForm.get('name')?.setValue('   ');
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
    it('should show a confirm dialog before deleting', async () => {
      await component.delete(component.categories()[0]);
      expect(mockConfirmService.confirm).toHaveBeenCalled();
    });

    it('should pass the torrent count to the confirm dialog', async () => {
      const linux = component.categories()[0]; // 'linux' — 2 torrents in mock
      await component.delete(linux);
      expect(mockConfirmService.confirm).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ data: { name: 'linux', count: 2 } }),
        expect.any(String),
      );
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

  describe('filteredCategories', () => {
    it('should return all categories when filter is empty', () => {
      expect(component.filteredCategories()).toHaveLength(2);
    });

    it('should filter by category name case-insensitively', () => {
      component.filterControl.setValue('lin');
      expect(component.filteredCategories()).toHaveLength(1);
      expect(component.filteredCategories()[0].name).toBe('linux');
    });

    it('should match case-insensitively', () => {
      component.filterControl.setValue('LIN');
      expect(component.filteredCategories()).toHaveLength(1);
      expect(component.filteredCategories()[0].name).toBe('linux');
    });

    it('should always show items currently being edited regardless of filter', () => {
      component.startEdit(component.categories()[0]); // linux
      component.filterControl.setValue('movies');
      const names = component.filteredCategories().map((c) => c.name);
      expect(names).toContain('linux'); // editing — always shown
      expect(names).toContain('movies');
    });

    it('should return all categories when filter is cleared', () => {
      component.filterControl.setValue('lin');
      component.filterControl.setValue('');
      expect(component.filteredCategories()).toHaveLength(2);
    });
  });
});
```

- [ ] **Step 5: Run all tests and verify they pass**

```bash
npm test
```

Expected: zero failures across all workspaces.

- [ ] **Step 6: Commit manage-categories changes**

```bash
git add packages/app/src/app/components/modals/manage-categories/
git commit -m "#100: add filter, torrent count in confirm, max-height, and edit-row button styles to manage-categories"
```
