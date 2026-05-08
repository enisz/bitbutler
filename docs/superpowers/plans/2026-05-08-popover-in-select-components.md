# Popover in Select Components Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move save-path, category, and tag popovers from `add-torrent` into their reusable select components so modals gain the popovers automatically; add a default-path placeholder to `SavePathSelect`; fix the server settings ng-select dropdown clipping.

**Architecture:** Each of the three select components internalises its popover using the same col-11/col-1 Bootstrap grid pattern as `TransferLimit`. `SavePathSelect` additionally fetches the qBittorrent default download path on init and uses it as the ng-select placeholder. The server settings page replaces `<app-save-path-select>` with an inline `<ng-select appendTo="ngb-modal-window">` to avoid the popover and fix the dropdown z-index bug.

**Tech Stack:** Angular 20 (zoneless, signals), `@ng-select/ng-select`, `@ngx-translate/core`, `@ng-bootstrap/ng-bootstrap` (BbPopover), Bootstrap 5 grid.

---

## File Map

| File                                                                     | What changes                                                                                                                                                                        |
| ------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `public/i18n/us.json`                                                    | Add popover keys under each component namespace; add `default-path` key to `save-path-select`; remove `save-path`, `category`, `tags` entries from `components.add-torrent.popover` |
| `public/i18n/hu.json`                                                    | Same structure, Hungarian values                                                                                                                                                    |
| `packages/app/src/app/components/category-select/category-select.ts`     | Add `BbPopover` to `imports`                                                                                                                                                        |
| `packages/app/src/app/components/category-select/category-select.html`   | Wrap in col-11/col-1 grid + internal `ng-template` popover                                                                                                                          |
| `packages/app/src/app/components/tag-select/tag-select.ts`               | Add `BbPopover` to `imports`                                                                                                                                                        |
| `packages/app/src/app/components/tag-select/tag-select.html`             | Wrap in col-11/col-1 grid + internal `ng-template` popover                                                                                                                          |
| `packages/app/src/app/components/save-path-select/save-path-select.ts`   | Add `BbPopover`, inject `QbService` + `ServerStoreService` + `TranslateService`, add `defaultPath` signal                                                                           |
| `packages/app/src/app/components/save-path-select/save-path-select.html` | Wrap in col-11/col-1 grid, bind `[placeholder]`, add internal `ng-template` popover                                                                                                 |
| `packages/app/src/app/components/add-torrent/add-torrent.html`           | Collapse three col-11/col-1 blocks to col-12; add `[autofocus]="true"` to save-path; remove three `ng-template` popover definitions                                                 |
| `packages/app/src/app/pages/settings/server/server.ts`                   | Remove `SavePathSelect` import; add `NgSelectComponent` + `TorrentStoreService`; add `paths` computed, `addTag`, `keyDownFn`                                                        |
| `packages/app/src/app/pages/settings/server/server.html`                 | Replace `<app-save-path-select>` with inline `<ng-select>`                                                                                                                          |

---

## Task 1: Add translation keys

**Files:**

- Modify: `public/i18n/us.json`
- Modify: `public/i18n/hu.json`

- [ ] **Step 1: Add popover keys and default-path key to `save-path-select` in `us.json`**

Find the `"save-path-select"` object (currently `{ "label": "Save Path" }`) and replace it:

```json
"save-path-select": {
  "label": "Save Path",
  "default-path": "Default: {{ path }}",
  "popover": {
    "title": "Save Path",
    "description": {
      "line1": "The folder on your disk where the downloaded files will be saved.",
      "line2": "Leave blank to use the default download location set in your qBittorrent preferences."
    }
  }
},
```

- [ ] **Step 2: Add popover keys to `category-select` in `us.json`**

Find `"category-select": { "label": "Category" }` and replace it:

```json
"category-select": {
  "label": "Category",
  "popover": {
    "title": "Category",
    "description": {
      "line1": "Assigns the torrent to a category. Categories are useful for organizing your downloads and can also define a default save path.",
      "line2": "If Auto TMM is enabled, changing the category may automatically move the files."
    }
  }
},
```

- [ ] **Step 3: Add popover keys to `tag-select` in `us.json`**

Find `"tag-select": { "label": "Tags" }` and replace it:

```json
"tag-select": {
  "label": "Tags",
  "popover": {
    "title": "Tags",
    "description": {
      "line1": "Adds one or more tags to this torrent for flexible filtering and grouping.",
      "line2": "Unlike categories, a torrent can have multiple tags, and tags do not affect the save path."
    }
  }
},
```

- [ ] **Step 4: Remove `save-path`, `category`, and `tags` from `components.add-torrent.popover` in `us.json`**

Find the `"popover"` object inside `"add-torrent"` and remove the three keys. The remaining keys are `root-folder`, `name`, `file`, `links`, and the settings-fieldset popovers. The result looks like:

```json
"popover": {
  "root-folder": { ... },
  "name": { ... },
  "file": { ... },
  "links": { ... },
  ... (remaining settings popovers)
}
```

- [ ] **Step 5: Mirror the same three changes in `hu.json`**

Replace `"save-path-select"` in `hu.json`:

```json
"save-path-select": {
  "label": "Mentési útvonal",
  "default-path": "Alapértelmezett: {{ path }}",
  "popover": {
    "title": "Mentési útvonal",
    "description": {
      "line1": "Az a mappa a lemezen, ahova a letöltött fájlok kerülnek.",
      "line2": "Hagyja üresen, ha az alapértelmezett letöltési helyet szeretné használni (a qBittorrent beállításaiban megadott)."
    }
  }
},
```

Replace `"category-select"` in `hu.json`:

```json
"category-select": {
  "label": "Kategória",
  "popover": {
    "title": "Kategória",
    "description": {
      "line1": "Kategóriát rendel a torrenthez. A kategóriák hasznosak a letöltések rendszerezéséhez, és alapértelmezett mentési útvonalat is meghatározhatnak.",
      "line2": "Ha az automatikus torrentkezelés (TMM) engedélyezve van, a kategória megváltoztatása automatikusan áthelyezheti a fájlokat."
    }
  }
},
```

Replace `"tag-select"` in `hu.json`:

```json
"tag-select": {
  "label": "Címkék",
  "popover": {
    "title": "Címkék",
    "description": {
      "line1": "Egy vagy több címkét ad ehhez a torrenthez, rugalmas szűrési és csoportosítási lehetőségekért.",
      "line2": "A kategóriákkal ellentétben egy torrenthez több címke is rendelhető, és a címkék nem befolyásolják a mentési útvonalat."
    }
  }
},
```

Remove `save-path`, `category`, and `tags` from `components.add-torrent.popover` in `hu.json` (same structure as step 4).

- [ ] **Step 6: Run lint to verify JSON is valid**

```bash
npm run lint
```

Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add public/i18n/us.json public/i18n/hu.json
git commit -m "#66: move popover i18n keys into select component namespaces"
```

---

## Task 2: Add popover to CategorySelect

**Files:**

- Modify: `packages/app/src/app/components/category-select/category-select.ts`
- Modify: `packages/app/src/app/components/category-select/category-select.html`

- [ ] **Step 1: Add `BbPopover` to imports in `category-select.ts`**

Add the import at the top:

```typescript
import { BbPopover } from '../bb-popover/bb-popover';
```

Add `BbPopover` to the `imports` array in the `@Component` decorator:

```typescript
imports: [CommonModule, ReactiveFormsModule, NgSelectComponent, TranslatePipe, BbPopover],
```

- [ ] **Step 2: Rewrite `category-select.html`**

Replace the entire file content:

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
```

- [ ] **Step 3: Run lint**

```bash
npm run lint
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add packages/app/src/app/components/category-select/
git commit -m "#66: move popover into CategorySelect component"
```

---

## Task 3: Add popover to TagSelect

**Files:**

- Modify: `packages/app/src/app/components/tag-select/tag-select.ts`
- Modify: `packages/app/src/app/components/tag-select/tag-select.html`

- [ ] **Step 1: Add `BbPopover` to imports in `tag-select.ts`**

Add the import at the top:

```typescript
import { BbPopover } from '../bb-popover/bb-popover';
```

Add `BbPopover` to the `imports` array:

```typescript
imports: [CommonModule, ReactiveFormsModule, NgSelectComponent, TranslatePipe, BbPopover],
```

- [ ] **Step 2: Rewrite `tag-select.html`**

Replace the entire file content:

```html
<div class="container-fluid px-0">
  <div class="row">
    <div class="col-11">
      <div class="form-floating">
        <ng-select
          [items]="tags()"
          [multiple]="true"
          [addTag]="addTag"
          [hideSelected]="true"
          [searchable]="true"
          [clearable]="true"
          [clearSearchOnAdd]="true"
          [formControl]="selectControl"
          [keyDownFn]="keyDownFn"
          [openOnEnter]="false"
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
```

- [ ] **Step 3: Run lint**

```bash
npm run lint
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add packages/app/src/app/components/tag-select/
git commit -m "#66: move popover into TagSelect component"
```

---

## Task 4: Add popover and default-path placeholder to SavePathSelect

**Files:**

- Modify: `packages/app/src/app/components/save-path-select/save-path-select.ts`
- Modify: `packages/app/src/app/components/save-path-select/save-path-select.html`

- [ ] **Step 1: Rewrite `save-path-select.ts`**

Replace the entire file:

```typescript
import { CommonModule } from '@angular/common';
import {
  AfterViewInit,
  Component,
  Input,
  OnInit,
  ViewChild,
  computed,
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
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { QbService } from '../../services/qb.service';
import { ServerStoreService } from '../../services/server-store.service';
import { TorrentStoreService } from '../../services/torrent-store.service';
import { BbPopover } from '../bb-popover/bb-popover';

@Component({
  selector: 'app-save-path-select',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, NgSelectComponent, TranslatePipe, BbPopover],
  templateUrl: './save-path-select.html',
  styleUrls: ['./save-path-select.scss'],
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => SavePathSelect),
      multi: true,
    },
  ],
})
export class SavePathSelect implements OnInit, ControlValueAccessor, AfterViewInit {
  @Input() autofocus = false;
  @ViewChild('ngselect') ngselect!: NgSelectComponent;

  private readonly torrentStoreService = inject(TorrentStoreService);
  private readonly qbService = inject(QbService);
  private readonly serverStoreService = inject(ServerStoreService);
  private readonly translateService = inject(TranslateService);

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

  public defaultPath = signal<string>('');
  public selectControl = new FormControl<string | null>(null);

  private onChange: (value: string | null) => void = () => {};
  private onTouched: () => void = () => {};

  public ngOnInit(): void {
    this.selectControl.valueChanges.subscribe((value) => {
      this.onChange(value);
      this.onTouched();
    });

    const serverId = this.serverStoreService.currentServerId();
    if (serverId) {
      this.qbService
        .getAppPreferences(serverId)
        .then((prefs) => {
          this.defaultPath.set(
            this.translateService.instant('components.save-path-select.default-path', {
              path: prefs.save_path,
            }),
          );
        })
        .catch(() => {
          // silent fallback — defaultPath stays ''
        });
    }
  }

  public ngAfterViewInit(): void {
    if (this.autofocus) {
      this.ngselect.focus();
    }
  }

  writeValue(value: string | null): void {
    this.selectControl.setValue(value, { emitEvent: false });
  }

  registerOnChange(fn: (value: string | null) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    if (isDisabled) {
      this.selectControl.disable();
    } else {
      this.selectControl.enable();
    }
  }

  addTag = (term: string): string => term;

  keyDownFn(event: KeyboardEvent): boolean {
    if (event.key === 'Escape') {
      return false;
    }
    return true;
  }
}
```

- [ ] **Step 2: Rewrite `save-path-select.html`**

Replace the entire file:

```html
<div class="container-fluid px-0">
  <div class="row">
    <div class="col-11">
      <div class="form-floating">
        <ng-select
          [items]="paths()"
          [addTag]="addTag"
          [searchable]="true"
          [clearable]="true"
          [clearOnBackspace]="false"
          [editableSearchTerm]="true"
          [formControl]="selectControl"
          [keyDownFn]="keyDownFn"
          [openOnEnter]="false"
          [placeholder]="defaultPath()"
          #ngselect
        >
        </ng-select>
        <label>{{ 'components.save-path-select.label' | translate }}</label>
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

<ng-template #savePathPopover>
  <p>{{ 'components.save-path-select.popover.description.line1' | translate }}</p>
  <p>{{ 'components.save-path-select.popover.description.line2' | translate }}</p>
</ng-template>
```

- [ ] **Step 3: Run lint**

```bash
npm run lint
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add packages/app/src/app/components/save-path-select/
git commit -m "#66: move popover into SavePathSelect and add default-path placeholder"
```

---

## Task 5: Simplify add-torrent.html

**Files:**

- Modify: `packages/app/src/app/components/add-torrent/add-torrent.html`

The current template wraps each of the three fields in a col-11/col-1 pair. Replace each pair with a single col-12. Also add `[autofocus]="true"` to save-path, and remove the three `ng-template` popover definitions at the bottom of the file.

- [ ] **Step 1: Replace the save-path col-11/col-1 block**

Find (lines ~136–148):

```html
<div class="col-11">
  <div class="mb-3">
    <app-save-path-select formControlName="savepath"></app-save-path-select>
  </div>
</div>

<div class="col-1 d-flex align-items-center mb-3">
  <bb-popover
    [subject]="'components.add-torrent.popover.save-path.title' | translate"
    [description]="savePathPopover"
    placement="left"
  ></bb-popover>
</div>
```

Replace with:

```html
<div class="col-12">
  <div class="mb-3">
    <app-save-path-select formControlName="savepath" [autofocus]="true"></app-save-path-select>
  </div>
</div>
```

- [ ] **Step 2: Replace the category col-11/col-1 block**

Find (lines ~150–162):

```html
<div class="col-11">
  <div class="mb-3">
    <app-category-select formControlName="category"></app-category-select>
  </div>
</div>

<div class="col-1 d-flex align-items-center mb-3">
  <bb-popover
    [subject]="'components.add-torrent.popover.category.title' | translate"
    [description]="categoryPopover"
    placement="left"
  ></bb-popover>
</div>
```

Replace with:

```html
<div class="col-12">
  <div class="mb-3">
    <app-category-select formControlName="category"></app-category-select>
  </div>
</div>
```

- [ ] **Step 3: Replace the tags col-11/col-1 block**

Find (lines ~164–176):

```html
<div class="col-11">
  <div class="mb-3">
    <app-tag-select formControlName="tags"></app-tag-select>
  </div>
</div>

<div class="col-1 d-flex align-items-center mb-3">
  <bb-popover
    [subject]="'components.add-torrent.popover.tags.title' | translate"
    [description]="tagsPopover"
    placement="left"
  ></bb-popover>
</div>
```

Replace with:

```html
<div class="col-12">
  <div class="mb-3">
    <app-tag-select formControlName="tags"></app-tag-select>
  </div>
</div>
```

- [ ] **Step 4: Remove the three ng-template popover definitions**

Find and delete these three blocks near the bottom of the file (around lines ~387–400):

```html
<ng-template #savePathPopover>
  <p>{{ 'components.add-torrent.popover.save-path.description.line1' | translate }}</p>
  <p>{{ 'components.add-torrent.popover.save-path.description.line2' | translate }}</p>
</ng-template>

<ng-template #categoryPopover>
  <p>{{ 'components.add-torrent.popover.category.description.line1' | translate }}</p>
  <p>{{ 'components.add-torrent.popover.category.description.line2' | translate }}</p>
</ng-template>

<ng-template #tagsPopover>
  <p>{{ 'components.add-torrent.popover.tags.description.line1' | translate }}</p>
  <p>{{ 'components.add-torrent.popover.tags.description.line2' | translate }}</p>
</ng-template>
```

- [ ] **Step 5: Run lint**

```bash
npm run lint
```

Expected: no errors. If there are unused variable warnings in `add-torrent.ts` related to removed template refs, remove those references from the TypeScript file too.

- [ ] **Step 6: Commit**

```bash
git add packages/app/src/app/components/add-torrent/add-torrent.html
git commit -m "#66: simplify add-torrent general fieldset, autofocus save-path"
```

---

## Task 6: Update server settings

**Files:**

- Modify: `packages/app/src/app/pages/settings/server/server.ts`
- Modify: `packages/app/src/app/pages/settings/server/server.html`

- [ ] **Step 1: Update `server.ts` imports and injections**

Remove the `SavePathSelect` import line:

```typescript
import { SavePathSelect } from '../../../components/save-path-select/save-path-select';
```

Add these two imports:

```typescript
import { NgSelectComponent } from '@ng-select/ng-select';
import { TorrentStoreService } from '../../../services/torrent-store.service';
```

In the `@Component` `imports` array, replace `SavePathSelect` with `NgSelectComponent`:

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
],
```

- [ ] **Step 2: Inject `TorrentStoreService` and add `paths`, `addTag`, `keyDownFn` to `server.ts`**

Add the injection inside the class body (after the existing injections):

```typescript
private readonly torrentStoreService = inject(TorrentStoreService);
```

Add these three members to the class (e.g. after the `icons` declaration):

```typescript
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

addTag = (term: string): string => term;

keyDownFn(event: KeyboardEvent): boolean {
  if (event.key === 'Escape') {
    return false;
  }
  return true;
}
```

Add `computed` to the Angular core import line (it already imports `Component`, `DestroyRef`, etc.):

```typescript
import { Component, DestroyRef, NgZone, OnInit, computed, inject } from '@angular/core';
```

- [ ] **Step 3: Replace `<app-save-path-select>` in `server.html`**

Find (around line 153):

```html
<app-save-path-select formControlName="remote"></app-save-path-select>
```

Replace with:

```html
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
```

- [ ] **Step 4: Run lint**

```bash
npm run lint
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add packages/app/src/app/pages/settings/server/
git commit -m "#66: replace SavePathSelect in server settings with inline ng-select, fix dropdown z-index"
```
