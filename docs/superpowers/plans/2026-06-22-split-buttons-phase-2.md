# Split Buttons - Phase 2: Mechanical Save/Cancel Modals Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Retrofit the 12 Bootstrap `.btn`s across 6 mechanical Save/Cancel modals (`rename-torrent`, `set-torrent-category`, `set-torrent-location`, `set-torrent-tags`, `server-editor`, `credential-prompt`) to the `.btn-split`/`bb-btn-content` pattern shipped in Phase 0 and proven out in Phase 1 - the same recipe repeated 6 times with zero new icon decisions beyond the generic `general.button.*` keys the design spec already assigns.

**Architecture:** Each task touches one existing component (`.ts` + `.html`) independently: replace each button's inline text body with `<bb-btn-content>`, add `btn-split` to the host's class list, and add (or extend) the component's local `icons` object following the established convention from Phase 1 (`about.ts`, `update-available.ts`, `login.ts`). No CSS or shared-component changes in this phase - both shipped in Phase 0 (commits `a7baf52`, `9e8ffb3`).

**Tech Stack:** Angular 20 (signals, standalone components, OnPush), `@fortawesome/angular-fontawesome`, `@ngx-translate/core`, Vitest (via `@angular/build:unit-test`).

## Global Constraints

- Consumes only Phase 0's primitives - no CSS or shared-component changes in this phase: `.btn-split`/`.btn-icon`/`.btn-text` classes (`packages/app/src/styles.scss`) and `BbBtnContent` (`packages/app/src/app/components/bb-btn-content/bb-btn-content.ts`, selector `bb-btn-content`, inputs `icon: IconDefinition` required, `text: string` required, `position: 'start' | 'end' = 'start'`).
- Call-site markup pattern: keep the host element's tag and existing Bootstrap classes, add `btn-split`, and replace the button body with `<bb-btn-content [icon]="..." [text]="..."></bb-btn-content>`. None of this phase's 12 buttons have `px-*` utility classes to drop.
- Icon assignments for this phase, all from `@fortawesome/free-solid-svg-icons`:
  - `general.button.save`, `general.button.update` -> `faFloppyDisk` (same icon for both - `server-editor`'s Save/Update button keeps one conditional text binding, the icon does not need to change with `editMode()`)
  - `general.button.cancel` -> `faXmark`
  - `general.button.connect` -> `faPlug` (already used in Phase 1's `login.ts` - `credential-prompt.ts` imports its own copy per this codebase's no-central-registry convention)
- Translation keys are unchanged - `general.button.save`, `.update`, `.cancel`, `.connect` already exist in `public/i18n/us.json`/`hu.json`. No i18n file edits in this phase.
- Each call site exposes icons via a component-local `public icons = { ... }` object (existing app convention, e.g. `about.ts`, `login.ts`). 5 of the 6 files in this phase have no `icons` object yet - create one. `server-editor.ts` already has one (`faThumbsUp, faThumbsDown, faCircleNotch, faCheck, faX`) - extend it with `faFloppyDisk, faXmark`. Those 5 existing icons are pre-existing dead code (no `<fa-icon>` in `server-editor.html` references them) - leave them untouched, do not remove them; that cleanup is not part of this phase's scope.
- Import path for `BbBtnContent` from every file in this phase is `../../bb-btn-content/bb-btn-content` (all 6 files live at `packages/app/src/app/components/modals/<name>/<name>.ts`, two levels up from `components/`).
- Import ordering: follow each file's existing convention of external packages first (alphabetical), then relative imports, with `BbBtnContent` appended as the last relative import - matching the established pattern from Phase 1's `about.ts`/`update-available.ts` (validated by that phase's review as the correct convention to follow, even though it isn't ESLint-enforced in this repo - there is no `import/order` rule configured).
- None of the 6 components' spec files assert on button markup or text (verified by inspection) - no spec file changes in this phase, only regression runs. Each task's Step 3 states the exact current passing-test count to confirm against.
- Class names match filenames without suffix; no `standalone: true` flag added/removed beyond what's already present in a file (`set-torrent-category.ts` already has it - leave as-is; the other 5 don't - don't add it).
- Out of scope - do not touch: the `.btn-close` (header X) button in any of these 6 modals (already icon-only, not part of this rollout per the design spec's scope exclusions); `server-editor.ts`'s unused `canTest`/`tested` signals and its 5 pre-existing unused icons (dead code, unrelated to this task).

---

### Task 1: `rename-torrent` - Save and Cancel buttons

**Files:**

- Modify: `packages/app/src/app/components/modals/rename-torrent/rename-torrent.ts:1-19`
- Modify: `packages/app/src/app/components/modals/rename-torrent/rename-torrent.html:50-57`

**Interfaces:**

- Consumes: `BbBtnContent` and `.btn-split`/`.btn-icon`/`.btn-text` from Phase 0 (see Global Constraints).
- Produces: nothing consumed by later tasks in this phase - each task here is independent.

- [ ] **Step 1: Update `rename-torrent.ts`'s icon imports, `imports` array, and add an `icons` object**

Current (lines 1-19):

```ts
import { ChangeDetectionStrategy, Component, OnInit, inject, input, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { NgbActiveModal, NgbTooltip } from '@ng-bootstrap/ng-bootstrap';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { AutofocusDirective } from '../../../directives/autofocus';
import { TooltipOverflow } from '../../../directives/tooltip-overflow';
import { Torrent } from '../../../models/torrent.model';
import { QbService } from '../../../services/qb.service';
import { ServerStoreService } from '../../../services/server-store.service';
import { ToastService } from '../../../services/toast.service';

@Component({
  selector: 'app-rename-torrent',
  imports: [ReactiveFormsModule, AutofocusDirective, NgbTooltip, TranslatePipe, TooltipOverflow],
  templateUrl: './rename-torrent.html',
  styleUrl: './rename-torrent.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RenameTorrent implements OnInit {
  readonly torrent = input.required<Torrent>();
```

Replace with:

```ts
import { ChangeDetectionStrategy, Component, OnInit, inject, input, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { faFloppyDisk, faXmark } from '@fortawesome/free-solid-svg-icons';
import { NgbActiveModal, NgbTooltip } from '@ng-bootstrap/ng-bootstrap';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { AutofocusDirective } from '../../../directives/autofocus';
import { TooltipOverflow } from '../../../directives/tooltip-overflow';
import { Torrent } from '../../../models/torrent.model';
import { QbService } from '../../../services/qb.service';
import { ServerStoreService } from '../../../services/server-store.service';
import { ToastService } from '../../../services/toast.service';
import { BbBtnContent } from '../../bb-btn-content/bb-btn-content';

@Component({
  selector: 'app-rename-torrent',
  imports: [
    ReactiveFormsModule,
    AutofocusDirective,
    NgbTooltip,
    TranslatePipe,
    TooltipOverflow,
    BbBtnContent,
  ],
  templateUrl: './rename-torrent.html',
  styleUrl: './rename-torrent.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RenameTorrent implements OnInit {
  readonly torrent = input.required<Torrent>();

  public icons = { faFloppyDisk, faXmark };
```

- [ ] **Step 2: Update `rename-torrent.html`'s footer markup**

Current (lines 50-57):

```html
<div class="modal-footer">
  <button type="button" class="btn btn-primary" (click)="handleSubmit()" [disabled]="!canSave()">
    {{ 'general.button.save' | translate }}
  </button>
  <button type="button" class="btn btn-link" (click)="activeModal.dismiss()">
    {{ 'general.button.cancel' | translate }}
  </button>
</div>
```

Replace with:

```html
<div class="modal-footer">
  <button
    type="button"
    class="btn btn-primary btn-split"
    (click)="handleSubmit()"
    [disabled]="!canSave()"
  >
    <bb-btn-content
      [icon]="icons.faFloppyDisk"
      [text]="'general.button.save' | translate"
    ></bb-btn-content>
  </button>
  <button type="button" class="btn btn-link btn-split" (click)="activeModal.dismiss()">
    <bb-btn-content
      [icon]="icons.faXmark"
      [text]="'general.button.cancel' | translate"
    ></bb-btn-content>
  </button>
</div>
```

- [ ] **Step 3: Run the existing spec to confirm no regressions**

Run (from `packages/app`):

```bash
npx ng test --include="**/rename-torrent.spec.ts" --watch=false
```

Expected: `Test Files 1 passed (1)`, `Tests 6 passed (6)`.

- [ ] **Step 4: Commit**

```bash
git add packages/app/src/app/components/modals/rename-torrent/rename-torrent.ts packages/app/src/app/components/modals/rename-torrent/rename-torrent.html
git commit -m "#180: retrofit rename-torrent modal buttons to split-button style"
```

---

### Task 2: `set-torrent-category` - Save and Cancel buttons

**Files:**

- Modify: `packages/app/src/app/components/modals/set-torrent-category/set-torrent-category.ts:1-49`
- Modify: `packages/app/src/app/components/modals/set-torrent-category/set-torrent-category.html:42-49`

**Interfaces:**

- Consumes: same `BbBtnContent`/`.btn-split` primitives as Task 1.
- Produces: nothing consumed by later tasks in this phase.

- [ ] **Step 1: Update `set-torrent-category.ts`'s icon imports, `imports` array, and add an `icons` object**

Current (lines 1-49):

```ts
import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  input,
  viewChild,
} from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { NgbActiveModal, NgbTooltip } from '@ng-bootstrap/ng-bootstrap';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { TooltipOverflow } from '../../../directives/tooltip-overflow';
import { Torrent } from '../../../models/torrent.model';
import { QbService } from '../../../services/qb.service';
import { ServerStoreService } from '../../../services/server-store.service';
import { ToastService } from '../../../services/toast.service';
import { CategorySelect } from '../../category-select/category-select';

@Component({
  selector: 'app-set-torrent-category',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    CommonModule,
    CategorySelect,
    NgbTooltip,
    TranslatePipe,
    TooltipOverflow,
  ],
  templateUrl: './set-torrent-category.html',
  styleUrl: './set-torrent-category.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SetTorrentCategory implements OnInit {
  readonly torrent = input.required<Torrent>();
  readonly hashes = input<string[]>([]);

  private readonly serverStoreService = inject(ServerStoreService);
  public readonly activeModal = inject(NgbActiveModal);
  public readonly qbService = inject(QbService);
  private readonly toastService = inject(ToastService);
  private readonly translateService = inject(TranslateService);

  private readonly categorySelect = viewChild(CategorySelect);

  public readonly selected = computed(() => this.hashes().length);
  public saving = false;
```

Replace with:

```ts
import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  input,
  viewChild,
} from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { faFloppyDisk, faXmark } from '@fortawesome/free-solid-svg-icons';
import { NgbActiveModal, NgbTooltip } from '@ng-bootstrap/ng-bootstrap';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { TooltipOverflow } from '../../../directives/tooltip-overflow';
import { Torrent } from '../../../models/torrent.model';
import { QbService } from '../../../services/qb.service';
import { ServerStoreService } from '../../../services/server-store.service';
import { ToastService } from '../../../services/toast.service';
import { BbBtnContent } from '../../bb-btn-content/bb-btn-content';
import { CategorySelect } from '../../category-select/category-select';

@Component({
  selector: 'app-set-torrent-category',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    CommonModule,
    CategorySelect,
    NgbTooltip,
    TranslatePipe,
    TooltipOverflow,
    BbBtnContent,
  ],
  templateUrl: './set-torrent-category.html',
  styleUrl: './set-torrent-category.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SetTorrentCategory implements OnInit {
  readonly torrent = input.required<Torrent>();
  readonly hashes = input<string[]>([]);

  private readonly serverStoreService = inject(ServerStoreService);
  public readonly activeModal = inject(NgbActiveModal);
  public readonly qbService = inject(QbService);
  private readonly toastService = inject(ToastService);
  private readonly translateService = inject(TranslateService);

  private readonly categorySelect = viewChild(CategorySelect);

  public icons = { faFloppyDisk, faXmark };

  public readonly selected = computed(() => this.hashes().length);
  public saving = false;
```

- [ ] **Step 2: Update `set-torrent-category.html`'s footer markup**

Current (lines 42-49):

```html
<div class="modal-footer">
  <button type="button" class="btn btn-primary" (click)="handleSubmit()" [disabled]="!canSave()">
    {{ 'general.button.save' | translate }}
  </button>
  <button type="button" class="btn btn-link" (click)="activeModal.close()">
    {{ 'general.button.cancel' | translate }}
  </button>
</div>
```

Replace with:

```html
<div class="modal-footer">
  <button
    type="button"
    class="btn btn-primary btn-split"
    (click)="handleSubmit()"
    [disabled]="!canSave()"
  >
    <bb-btn-content
      [icon]="icons.faFloppyDisk"
      [text]="'general.button.save' | translate"
    ></bb-btn-content>
  </button>
  <button type="button" class="btn btn-link btn-split" (click)="activeModal.close()">
    <bb-btn-content
      [icon]="icons.faXmark"
      [text]="'general.button.cancel' | translate"
    ></bb-btn-content>
  </button>
</div>
```

- [ ] **Step 3: Run the existing spec to confirm no regressions**

Run (from `packages/app`):

```bash
npx ng test --include="**/set-torrent-category.spec.ts" --watch=false
```

Expected: `Test Files 1 passed (1)`, `Tests 9 passed (9)`.

- [ ] **Step 4: Commit**

```bash
git add packages/app/src/app/components/modals/set-torrent-category/set-torrent-category.ts packages/app/src/app/components/modals/set-torrent-category/set-torrent-category.html
git commit -m "#180: retrofit set-torrent-category modal buttons to split-button style"
```

---

### Task 3: `set-torrent-location` - Save and Cancel buttons

**Files:**

- Modify: `packages/app/src/app/components/modals/set-torrent-location/set-torrent-location.ts:1-41`
- Modify: `packages/app/src/app/components/modals/set-torrent-location/set-torrent-location.html:46-53`

**Interfaces:**

- Consumes: same `BbBtnContent`/`.btn-split` primitives as Task 1.
- Produces: nothing consumed by later tasks in this phase.

- [ ] **Step 1: Update `set-torrent-location.ts`'s icon imports, `imports` array, and add an `icons` object**

Current (lines 1-41):

```ts
import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  input,
  signal,
} from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { NgbActiveModal, NgbTooltip } from '@ng-bootstrap/ng-bootstrap';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { TooltipOverflow } from '../../../directives/tooltip-overflow';
import { Torrent } from '../../../models/torrent.model';
import { QbService } from '../../../services/qb.service';
import { ServerStoreService } from '../../../services/server-store.service';
import { ToastService } from '../../../services/toast.service';
import { SavePathSelect } from '../../save-path-select/save-path-select';

@Component({
  selector: 'app-set-torrent-location',
  imports: [ReactiveFormsModule, SavePathSelect, NgbTooltip, TranslatePipe, TooltipOverflow],
  templateUrl: './set-torrent-location.html',
  styleUrl: './set-torrent-location.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SetTorrentLocation implements OnInit {
  readonly torrent = input.required<Torrent>();
  readonly hashes = input<string[]>([]);

  private readonly serverStoreService = inject(ServerStoreService);
  private readonly toastService = inject(ToastService);
  private readonly qbService = inject(QbService);
  public readonly activeModal = inject(NgbActiveModal);
  private readonly translateService = inject(TranslateService);
  public setLocationForm = new FormGroup({
    path: new FormControl<string | null>(null),
  });

  public readonly selected = computed(() => this.hashes().length);
  private defaultPath = signal<string>('');
```

Replace with:

```ts
import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  input,
  signal,
} from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { faFloppyDisk, faXmark } from '@fortawesome/free-solid-svg-icons';
import { NgbActiveModal, NgbTooltip } from '@ng-bootstrap/ng-bootstrap';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { TooltipOverflow } from '../../../directives/tooltip-overflow';
import { Torrent } from '../../../models/torrent.model';
import { QbService } from '../../../services/qb.service';
import { ServerStoreService } from '../../../services/server-store.service';
import { ToastService } from '../../../services/toast.service';
import { BbBtnContent } from '../../bb-btn-content/bb-btn-content';
import { SavePathSelect } from '../../save-path-select/save-path-select';

@Component({
  selector: 'app-set-torrent-location',
  imports: [
    ReactiveFormsModule,
    SavePathSelect,
    NgbTooltip,
    TranslatePipe,
    TooltipOverflow,
    BbBtnContent,
  ],
  templateUrl: './set-torrent-location.html',
  styleUrl: './set-torrent-location.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SetTorrentLocation implements OnInit {
  readonly torrent = input.required<Torrent>();
  readonly hashes = input<string[]>([]);

  private readonly serverStoreService = inject(ServerStoreService);
  private readonly toastService = inject(ToastService);
  private readonly qbService = inject(QbService);
  public readonly activeModal = inject(NgbActiveModal);
  private readonly translateService = inject(TranslateService);

  public icons = { faFloppyDisk, faXmark };

  public setLocationForm = new FormGroup({
    path: new FormControl<string | null>(null),
  });

  public readonly selected = computed(() => this.hashes().length);
  private defaultPath = signal<string>('');
```

- [ ] **Step 2: Update `set-torrent-location.html`'s footer markup**

Current (lines 46-53):

```html
<div class="modal-footer">
  <button type="button" class="btn btn-primary" (click)="handleSubmit()" [disabled]="!canSave()">
    {{ 'general.button.save' | translate }}
  </button>
  <button type="button" class="btn btn-link" (click)="activeModal.close()">
    {{ 'general.button.cancel' | translate }}
  </button>
</div>
```

Replace with:

```html
<div class="modal-footer">
  <button
    type="button"
    class="btn btn-primary btn-split"
    (click)="handleSubmit()"
    [disabled]="!canSave()"
  >
    <bb-btn-content
      [icon]="icons.faFloppyDisk"
      [text]="'general.button.save' | translate"
    ></bb-btn-content>
  </button>
  <button type="button" class="btn btn-link btn-split" (click)="activeModal.close()">
    <bb-btn-content
      [icon]="icons.faXmark"
      [text]="'general.button.cancel' | translate"
    ></bb-btn-content>
  </button>
</div>
```

- [ ] **Step 3: Run the existing spec to confirm no regressions**

Run (from `packages/app`):

```bash
npx ng test --include="**/set-torrent-location.spec.ts" --watch=false
```

Expected: `Test Files 1 passed (1)`, `Tests 6 passed (6)`.

- [ ] **Step 4: Commit**

```bash
git add packages/app/src/app/components/modals/set-torrent-location/set-torrent-location.ts packages/app/src/app/components/modals/set-torrent-location/set-torrent-location.html
git commit -m "#180: retrofit set-torrent-location modal buttons to split-button style"
```

---

### Task 4: `set-torrent-tags` - Save and Cancel buttons

**Files:**

- Modify: `packages/app/src/app/components/modals/set-torrent-tags/set-torrent-tags.ts:1-39`
- Modify: `packages/app/src/app/components/modals/set-torrent-tags/set-torrent-tags.html:42-49`

**Interfaces:**

- Consumes: same `BbBtnContent`/`.btn-split` primitives as Task 1.
- Produces: nothing consumed by later tasks in this phase.

- [ ] **Step 1: Update `set-torrent-tags.ts`'s icon imports, `imports` array, and add an `icons` object**

Current (lines 1-39):

```ts
import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  input,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { NgbActiveModal, NgbTooltip } from '@ng-bootstrap/ng-bootstrap';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { TooltipOverflow } from '../../../directives/tooltip-overflow';
import { Torrent } from '../../../models/torrent.model';
import { QbService } from '../../../services/qb.service';
import { ServerStoreService } from '../../../services/server-store.service';
import { ToastService } from '../../../services/toast.service';
import { TagSelect } from '../../tag-select/tag-select';

@Component({
  selector: 'app-set-torrent-tags',
  imports: [ReactiveFormsModule, TagSelect, NgbTooltip, TranslatePipe, TooltipOverflow],
  templateUrl: './set-torrent-tags.html',
  styleUrl: './set-torrent-tags.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SetTorrentTags implements OnInit {
  readonly torrent = input.required<Torrent>();
  readonly hashes = input<string[]>([]);

  private readonly serverStoreService = inject(ServerStoreService);
  private readonly qbService = inject(QbService);
  private readonly toastService = inject(ToastService);
  private readonly translateService = inject(TranslateService);
  public readonly activeModal = inject(NgbActiveModal);

  public readonly selected = computed(() => this.hashes().length);
  public saving = signal(false);
```

Replace with:

```ts
import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  input,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { faFloppyDisk, faXmark } from '@fortawesome/free-solid-svg-icons';
import { NgbActiveModal, NgbTooltip } from '@ng-bootstrap/ng-bootstrap';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { TooltipOverflow } from '../../../directives/tooltip-overflow';
import { Torrent } from '../../../models/torrent.model';
import { QbService } from '../../../services/qb.service';
import { ServerStoreService } from '../../../services/server-store.service';
import { ToastService } from '../../../services/toast.service';
import { BbBtnContent } from '../../bb-btn-content/bb-btn-content';
import { TagSelect } from '../../tag-select/tag-select';

@Component({
  selector: 'app-set-torrent-tags',
  imports: [
    ReactiveFormsModule,
    TagSelect,
    NgbTooltip,
    TranslatePipe,
    TooltipOverflow,
    BbBtnContent,
  ],
  templateUrl: './set-torrent-tags.html',
  styleUrl: './set-torrent-tags.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SetTorrentTags implements OnInit {
  readonly torrent = input.required<Torrent>();
  readonly hashes = input<string[]>([]);

  private readonly serverStoreService = inject(ServerStoreService);
  private readonly qbService = inject(QbService);
  private readonly toastService = inject(ToastService);
  private readonly translateService = inject(TranslateService);
  public readonly activeModal = inject(NgbActiveModal);

  public icons = { faFloppyDisk, faXmark };

  public readonly selected = computed(() => this.hashes().length);
  public saving = signal(false);
```

- [ ] **Step 2: Update `set-torrent-tags.html`'s footer markup**

Current (lines 42-49):

```html
<div class="modal-footer">
  <button type="button" class="btn btn-primary" (click)="handleSubmit()" [disabled]="!canSave()">
    {{ 'general.button.save' | translate }}
  </button>
  <button type="button" class="btn btn-link" (click)="activeModal.close()">
    {{ 'general.button.cancel' | translate }}
  </button>
</div>
```

Replace with:

```html
<div class="modal-footer">
  <button
    type="button"
    class="btn btn-primary btn-split"
    (click)="handleSubmit()"
    [disabled]="!canSave()"
  >
    <bb-btn-content
      [icon]="icons.faFloppyDisk"
      [text]="'general.button.save' | translate"
    ></bb-btn-content>
  </button>
  <button type="button" class="btn btn-link btn-split" (click)="activeModal.close()">
    <bb-btn-content
      [icon]="icons.faXmark"
      [text]="'general.button.cancel' | translate"
    ></bb-btn-content>
  </button>
</div>
```

- [ ] **Step 3: Run the existing spec to confirm no regressions**

Run (from `packages/app`):

```bash
npx ng test --include="**/set-torrent-tags.spec.ts" --watch=false
```

Expected: `Test Files 1 passed (1)`, `Tests 7 passed (7)`.

- [ ] **Step 4: Commit**

```bash
git add packages/app/src/app/components/modals/set-torrent-tags/set-torrent-tags.ts packages/app/src/app/components/modals/set-torrent-tags/set-torrent-tags.html
git commit -m "#180: retrofit set-torrent-tags modal buttons to split-button style"
```

---

### Task 5: `server-editor` - Save/Update and Cancel buttons

**Files:**

- Modify: `packages/app/src/app/components/modals/server-editor/server-editor.ts:1-53`
- Modify: `packages/app/src/app/components/modals/server-editor/server-editor.html:144-156`

**Interfaces:**

- Consumes: same `BbBtnContent`/`.btn-split` primitives as Task 1.
- Produces: nothing consumed by later tasks in this phase.

- [ ] **Step 1: Update `server-editor.ts`'s icon imports, `imports` array, and extend the existing `icons` object**

Current (lines 1-53):

```ts
import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, inject, input, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { NewServer, ServerRecord } from '@bitbutler/shared';
import {
  faCheck,
  faCircleNotch,
  faThumbsDown,
  faThumbsUp,
  faX,
} from '@fortawesome/free-solid-svg-icons';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { NgSelectModule } from '@ng-select/ng-select';
import { TranslatePipe } from '@ngx-translate/core';
import { filter } from 'rxjs';
import { AutofocusDirective } from '../../../directives/autofocus';
import { CommandBusService } from '../../../services/command-bus.service';
import { ServerStoreService } from '../../../services/server-store.service';
import { ServerService } from '../../../services/server.service';
import { BbPopover } from '../../bb-popover/bb-popover';
import { ServerProtocol } from './server-editor.interface';

@Component({
  selector: 'app-server-editor',
  imports: [
    ReactiveFormsModule,
    CommonModule,
    TranslatePipe,
    AutofocusDirective,
    NgSelectModule,
    BbPopover,
    TranslatePipe,
  ],
  templateUrl: './server-editor.html',
  styleUrl: './server-editor.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ServerEditor implements OnInit {
  private readonly activeModal = inject(NgbActiveModal);
  private readonly serverService = inject(ServerService);
  private readonly serverStoreService = inject(ServerStoreService);
  private readonly commandBusService = inject(CommandBusService);

  readonly id = input<string | null>(null);

  public icons = {
    faThumbsUp,
    faThumbsDown,
    faCircleNotch,
    faCheck,
    faX,
  };
```

Replace with:

```ts
import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, inject, input, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { NewServer, ServerRecord } from '@bitbutler/shared';
import {
  faCheck,
  faCircleNotch,
  faFloppyDisk,
  faThumbsDown,
  faThumbsUp,
  faX,
  faXmark,
} from '@fortawesome/free-solid-svg-icons';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { NgSelectModule } from '@ng-select/ng-select';
import { TranslatePipe } from '@ngx-translate/core';
import { filter } from 'rxjs';
import { AutofocusDirective } from '../../../directives/autofocus';
import { CommandBusService } from '../../../services/command-bus.service';
import { ServerStoreService } from '../../../services/server-store.service';
import { ServerService } from '../../../services/server.service';
import { BbBtnContent } from '../../bb-btn-content/bb-btn-content';
import { BbPopover } from '../../bb-popover/bb-popover';
import { ServerProtocol } from './server-editor.interface';

@Component({
  selector: 'app-server-editor',
  imports: [
    ReactiveFormsModule,
    CommonModule,
    TranslatePipe,
    AutofocusDirective,
    NgSelectModule,
    BbPopover,
    TranslatePipe,
    BbBtnContent,
  ],
  templateUrl: './server-editor.html',
  styleUrl: './server-editor.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ServerEditor implements OnInit {
  private readonly activeModal = inject(NgbActiveModal);
  private readonly serverService = inject(ServerService);
  private readonly serverStoreService = inject(ServerStoreService);
  private readonly commandBusService = inject(CommandBusService);

  readonly id = input<string | null>(null);

  public icons = {
    faThumbsUp,
    faThumbsDown,
    faCircleNotch,
    faCheck,
    faX,
    faFloppyDisk,
    faXmark,
  };
```

Note: the pre-existing duplicate `TranslatePipe` entry in the `imports` array and the unused `faThumbsUp`/`faThumbsDown`/`faCircleNotch`/`faCheck`/`faX` icons are left exactly as they were - not part of this task's scope.

- [ ] **Step 2: Update `server-editor.html`'s footer markup**

Current (lines 144-156):

```html
<div class="modal-footer">
  <button
    type="button"
    class="btn btn-primary"
    (click)="handleSave()"
    [disabled]="!canSave() || processing()"
  >
    {{ (editMode() ? 'general.button.update' : 'general.button.save') | translate }}
  </button>
  <button type="button" class="btn btn-link" (click)="close()">
    {{ 'general.button.cancel' | translate }}
  </button>
</div>
```

Replace with:

```html
<div class="modal-footer">
  <button
    type="button"
    class="btn btn-primary btn-split"
    (click)="handleSave()"
    [disabled]="!canSave() || processing()"
  >
    <bb-btn-content
      [icon]="icons.faFloppyDisk"
      [text]="(editMode() ? 'general.button.update' : 'general.button.save') | translate"
    ></bb-btn-content>
  </button>
  <button type="button" class="btn btn-link btn-split" (click)="close()">
    <bb-btn-content
      [icon]="icons.faXmark"
      [text]="'general.button.cancel' | translate"
    ></bb-btn-content>
  </button>
</div>
```

- [ ] **Step 3: Run the existing spec to confirm no regressions**

Run (from `packages/app`):

```bash
npx ng test --include="**/server-editor.spec.ts" --watch=false
```

Expected: `Test Files 1 passed (1)`, `Tests 9 passed (9)`.

- [ ] **Step 4: Commit**

```bash
git add packages/app/src/app/components/modals/server-editor/server-editor.ts packages/app/src/app/components/modals/server-editor/server-editor.html
git commit -m "#180: retrofit server-editor modal buttons to split-button style"
```

---

### Task 6: `credential-prompt` - Connect and Cancel buttons

**Files:**

- Modify: `packages/app/src/app/components/modals/credential-prompt/credential-prompt.ts:1-19`
- Modify: `packages/app/src/app/components/modals/credential-prompt/credential-prompt.html:59-66`

**Interfaces:**

- Consumes: same `BbBtnContent`/`.btn-split` primitives as Task 1.
- Produces: nothing consumed by later tasks in this phase. This is the last task of Phase 2.

- [ ] **Step 1: Update `credential-prompt.ts`'s icon imports, `imports` array, and add an `icons` object**

Current (lines 1-19):

```ts
import { ChangeDetectionStrategy, Component, effect, inject, input } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { TranslatePipe } from '@ngx-translate/core';
import { AutofocusDirective } from '../../../directives/autofocus';

@Component({
  selector: 'app-credential-prompt',
  imports: [ReactiveFormsModule, TranslatePipe, AutofocusDirective],
  templateUrl: './credential-prompt.html',
  styleUrl: './credential-prompt.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CredentialPrompt {
  private readonly activeModal = inject(NgbActiveModal);

  readonly serverName = input.required<string>();
  readonly prefillUsername = input<string>('');
```

Replace with:

```ts
import { ChangeDetectionStrategy, Component, effect, inject, input } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { faPlug, faXmark } from '@fortawesome/free-solid-svg-icons';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { TranslatePipe } from '@ngx-translate/core';
import { AutofocusDirective } from '../../../directives/autofocus';
import { BbBtnContent } from '../../bb-btn-content/bb-btn-content';

@Component({
  selector: 'app-credential-prompt',
  imports: [ReactiveFormsModule, TranslatePipe, AutofocusDirective, BbBtnContent],
  templateUrl: './credential-prompt.html',
  styleUrl: './credential-prompt.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CredentialPrompt {
  private readonly activeModal = inject(NgbActiveModal);

  public icons = { faPlug, faXmark };

  readonly serverName = input.required<string>();
  readonly prefillUsername = input<string>('');
```

- [ ] **Step 2: Update `credential-prompt.html`'s footer markup**

Current (lines 59-66):

```html
<div class="modal-footer">
  <button type="button" class="btn btn-primary" (click)="connect()">
    {{ 'general.button.connect' | translate }}
  </button>
  <button type="button" class="btn btn-link" (click)="cancel()">
    {{ 'general.button.cancel' | translate }}
  </button>
</div>
```

Replace with:

```html
<div class="modal-footer">
  <button type="button" class="btn btn-primary btn-split" (click)="connect()">
    <bb-btn-content
      [icon]="icons.faPlug"
      [text]="'general.button.connect' | translate"
    ></bb-btn-content>
  </button>
  <button type="button" class="btn btn-link btn-split" (click)="cancel()">
    <bb-btn-content
      [icon]="icons.faXmark"
      [text]="'general.button.cancel' | translate"
    ></bb-btn-content>
  </button>
</div>
```

- [ ] **Step 3: Run the existing spec to confirm no regressions**

Run (from `packages/app`):

```bash
npx ng test --include="**/credential-prompt.spec.ts" --watch=false
```

Expected: `Test Files 1 passed (1)`, `Tests 6 passed (6)`.

- [ ] **Step 4: Commit**

```bash
git add packages/app/src/app/components/modals/credential-prompt/credential-prompt.ts packages/app/src/app/components/modals/credential-prompt/credential-prompt.html
git commit -m "#180: retrofit credential-prompt modal buttons to split-button style"
```

---

## Self-Review Notes

- **Spec coverage:** covers the Phase 2 row of the design spec's rollout table in full (`rename-torrent`, `set-torrent-category`, `set-torrent-location`, `set-torrent-tags`, `server-editor`, `credential-prompt` - 12 buttons). Verified the exact button count against current source: each of the 6 files has exactly one Save/Update/Connect button and one Cancel button = 12. Icon assignments match the design spec's generic-key table exactly (`save`/`update` -> `faFloppyDisk`, `cancel` -> `faXmark`, `connect` -> `faPlug`) - no new icon decisions.
- **Placeholder scan:** none - all six tasks contain complete before/after code for both files they touch.
- **Type consistency:** `BbBtnContent`'s `icon`/`text`/`position` inputs are referenced identically to Phase 0's definition and Phase 1's usage (`[icon]`, `[text]`, `position` left unset everywhere since all 12 buttons want the icon first). Every import path (`../../bb-btn-content/bb-btn-content`) was verified against each file's actual location two levels under `components/`.
- **Cross-task consistency:** all 6 tasks use the identical `<bb-btn-content [icon]="..." [text]="..."></bb-btn-content>` multi-line markup shape, the identical `public icons = { ... };` declaration shape, and the identical commit-message shape (`#180: retrofit <name> modal buttons to split-button style`), matching the precedent set by Phase 1 and validated by its plan-scoped review (no cross-task drift).
- **Out-of-scope verification:** confirmed all 6 modals' `.btn-close` header buttons, and `server-editor.ts`'s unused `canTest`/`tested` signals and 5 pre-existing unused icons, are untouched by any task.
- **Test counts:** all 6 expected counts (6, 9, 6, 7, 9, 6 = 43 total) were captured by running each spec file against the current `HEAD` (commit `1795e78`, end of Phase 1) before writing this plan - they reflect actual current state, not estimates.
