# Split Buttons - Phase 4: List-Management & Settings Modals Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Retrofit the 11 Bootstrap `.btn`s across 6 list-management/settings modals (`manage-categories`, `manage-tags`, `manage-servers`, `torrent-details`, `qb-settings`, `settings`) to the `.btn-split`/`bb-btn-content` pattern shipped in Phase 0 and proven out in Phases 1-3 - the same recipe repeated 6 times, reusing icons the design spec already assigns (`faPlus` for Add, `faServer` for Add Server, `faFloppyDisk` for Save, `faXmark` for Close), with zero new icon decisions and zero shared-component API changes.

**Architecture:** Each task touches one existing component (`.ts` + `.html`) independently: replace each in-scope button's inline text body with `<bb-btn-content>`, add `btn-split` to the host's class list, and extend each component's existing icon object with the new icon(s) it needs. No CSS or shared-component changes in this phase - both shipped in Phase 0 (commits `a7baf52`, `9e8ffb3`). All 6 files already import `FontAwesomeModule` directly (for inline icon-only buttons that stay out of scope) and already declare a local icon-object convention - 4 of the 6 (`manage-categories.ts`, `manage-tags.ts`, `manage-servers.ts`, `torrent-details.ts`) name it `icon` (singular) and 2 (`qb-settings.ts`, `settings.ts`) also name it `icon` (singular) - this phase's files all use the singular `icon` name, unlike Phases 1-3's `icons` (plural). Each task's import edits were verified against this repo's actual Prettier output (the project's `@trivago/prettier-plugin-sort-imports` config groups imports as `@angular/*` -> third-party (alphabetical) -> `electron/*` -> `src/*` -> everything matching `^[./]` sorted alphabetically by path string) - every before/after snippet below is the literal Prettier-formatted result, not a manual guess.

**Tech Stack:** Angular 20 (signals, standalone components, OnPush), `@fortawesome/angular-fontawesome`, `@ngx-translate/core`, Vitest (via `@angular/build:unit-test`).

## Global Constraints

- Consumes only Phase 0's primitives - no CSS or shared-component changes in this phase: `.btn-split`/`.btn-icon`/`.btn-text` classes (`packages/app/src/styles.scss`) and `BbBtnContent` (`packages/app/src/app/components/bb-btn-content/bb-btn-content.ts`, selector `bb-btn-content`, inputs `icon: IconDefinition` required, `text: string` required, `position: 'start' | 'end' = 'start'`).
- Call-site markup pattern: keep the host element's tag and existing Bootstrap classes, add `btn-split`, and replace the button body with `<bb-btn-content [icon]="..." [text]="..."></bb-btn-content>`. None of this phase's 11 buttons have `px-*` utility classes to drop.
- Icon assignments for this phase, all from `@fortawesome/free-solid-svg-icons` (all already used elsewhere in the app per the design spec's "reuses existing app icon" column - `faPlus`/`faServer` from `button-bar.ts`, `faFloppyDisk`/`faXmark` from Phase 2):
  - `general.button.add` -> `faPlus` (manage-categories, manage-tags Add buttons)
  - `general.button.add-server` -> `faServer` (manage-servers Add Server button)
  - `general.button.save` -> `faFloppyDisk` (qb-settings, settings Save buttons)
  - `general.button.close` -> `faXmark` (all 6 files' Close buttons)
- Translation keys are unchanged - `general.button.add`, `.add-server`, `.save`, `.close` already exist in `public/i18n/us.json`/`hu.json`. No i18n file edits in this phase.
- **Icon-object naming:** every file in this phase already declares its local icon object as `public readonly icon = { ... };` or `public icon = { ... };` (singular `icon`, not the `icons` convention used in Phases 1-3's files) - extend the existing object under its existing name and existing `readonly`/non-`readonly` modifier exactly as each file already has it. Do not rename it to `icons` and do not add or remove `readonly`.
- Import path for `BbBtnContent`:
  - `manage-categories.ts`, `manage-tags.ts`, `manage-servers.ts`, `torrent-details.ts` live at `packages/app/src/app/components/modals/<name>/<name>.ts` (two levels up from `components/`) -> `'../../bb-btn-content/bb-btn-content'`.
  - `qb-settings.ts`, `settings.ts` live at `packages/app/src/app/pages/<name>/<name>.ts` (two levels up from `app/`) -> `'../../components/bb-btn-content/bb-btn-content'`.
- `FontAwesomeModule` stays imported and stays in every file's `imports` array in this phase - each of the 6 templates uses `<fa-icon>` directly elsewhere for icon-only inline buttons/indicators that are out of scope (see below). Only `BbBtnContent` is newly added to each `imports` array.
- Each file's solid-icon import statement and relative-import block must be re-sorted exactly as `@trivago/prettier-plugin-sort-imports` would (alphabetical within each group) - every Step 1 snippet below already shows the correct post-format order and line-wrap; do not deviate even if it looks reorderable.
- Out of scope - do not touch, in any of the 6 files:
  - Any `.btn-close` (header X) button.
  - Any icon-only `.btn-link`/`btn btn-link p-1`-style inline action button with no visible text (manage-categories' inline edit/save/cancel/delete-row buttons; manage-tags' inline delete-row button; manage-servers' inline connect/auto-login-toggle/edit/delete-row buttons and its `.connect-btn` class, which `manage-servers.spec.ts` asserts on) - these have no text segment to split, per the design spec's scope exclusions.
  - The `bb-filter-clear` buttons in manage-categories/manage-tags/manage-servers (not Bootstrap `.btn`-classed).
  - The `nav-link`-classed tab buttons in torrent-details/qb-settings/settings (not Bootstrap `.btn`-classed) and their inline `faAsterisk` unsaved-indicator `<fa-icon>`.
  - `manage-servers.ts`'s `faPenToSquare`/`faSquare`/`faSquareCheck` and the regular-variant `faTrashCan`, all used only by inline icon-only row buttons - untouched.
  - `manage-categories.ts`/`manage-tags.ts`'s `faCheck`/`faX`/`faEdit`/regular `faTrashCan`, used only by inline icon-only row buttons - untouched.
  - Any `ConfirmService.confirm()` caller, `Confirm`, `delete-torrent`, or `torrent-exists` (Phase 3, already shipped).
- No spec file in this phase asserts on the in-scope button markup or text (verified by inspection - `manage-servers.spec.ts` only asserts on the out-of-scope `.connect-btn`) - no spec file changes in this phase, only regression runs. Each task's Step 3 states the exact current passing-test count to confirm against.
- Class names match filenames without suffix; no `standalone: true` flag added/removed beyond what's already present in a file (`manage-categories.ts`/`manage-tags.ts`/`manage-servers.ts`/`torrent-details.ts` already have it - leave as-is; `qb-settings.ts`/`settings.ts` don't - don't add it).

---

### Task 1: `manage-categories` - Add and Close buttons

**Files:**

- Modify: `packages/app/src/app/components/modals/manage-categories/manage-categories.ts:13-18,41-50,64`
- Modify: `packages/app/src/app/components/modals/manage-categories/manage-categories.html:28-35,165-169`

**Interfaces:**

- Consumes: `BbBtnContent` and `.btn-split`/`.btn-icon`/`.btn-text` from Phase 0 (see Global Constraints).
- Produces: nothing consumed by later tasks in this phase - each task here is independent.

- [ ] **Step 1: Update `manage-categories.ts`'s icon import, `imports` array, and `icon` object**

Current solid-icon import (lines 13-18):

```ts
import {
  faCheck,
  faTrashCan as faTrashCanSolid,
  faX,
  faXmark,
} from '@fortawesome/free-solid-svg-icons';
```

Replace with:

```ts
import {
  faCheck,
  faPlus,
  faTrashCan as faTrashCanSolid,
  faX,
  faXmark,
} from '@fortawesome/free-solid-svg-icons';
```

Current relative imports and `imports` array (lines 21-30, 41-50):

```ts
import { AutofocusDirective } from '../../../directives/autofocus';
import { TooltipOverflow } from '../../../directives/tooltip-overflow';
import { GuardableModal } from '../../../models/guardable-modal.interface';
import { ConfirmService } from '../../../services/confirm.service';
import { QbService } from '../../../services/qb.service';
import { ServerStoreService } from '../../../services/server-store.service';
import { ToastService } from '../../../services/toast.service';
import { TorrentStoreService } from '../../../services/torrent-store.service';
import { BbSpinner } from '../../bb-spinner/bb-spinner';
import { SavePathSelect } from '../../save-path-select/save-path-select';
```

```ts
  imports: [
    ReactiveFormsModule,
    TranslatePipe,
    FontAwesomeModule,
    NgbTooltipModule,
    BbSpinner,
    AutofocusDirective,
    TooltipOverflow,
    SavePathSelect,
  ],
```

Replace with:

```ts
import { AutofocusDirective } from '../../../directives/autofocus';
import { TooltipOverflow } from '../../../directives/tooltip-overflow';
import { GuardableModal } from '../../../models/guardable-modal.interface';
import { ConfirmService } from '../../../services/confirm.service';
import { QbService } from '../../../services/qb.service';
import { ServerStoreService } from '../../../services/server-store.service';
import { ToastService } from '../../../services/toast.service';
import { TorrentStoreService } from '../../../services/torrent-store.service';
import { BbBtnContent } from '../../bb-btn-content/bb-btn-content';
import { BbSpinner } from '../../bb-spinner/bb-spinner';
import { SavePathSelect } from '../../save-path-select/save-path-select';
```

```ts
  imports: [
    ReactiveFormsModule,
    TranslatePipe,
    FontAwesomeModule,
    NgbTooltipModule,
    BbSpinner,
    AutofocusDirective,
    TooltipOverflow,
    SavePathSelect,
    BbBtnContent,
  ],
```

Current `icon` object (line 64):

```ts
  public readonly icon = { faEdit, faTrashCan, faCheck, faX, faXmark };
```

Replace with:

```ts
  public readonly icon = { faEdit, faTrashCan, faCheck, faX, faXmark, faPlus };
```

- [ ] **Step 2: Update `manage-categories.html`'s Add and Close buttons**

Current Add button (lines 28-35):

```html
<button
  class="btn btn-outline-primary"
  type="button"
  (click)="add()"
  [disabled]="!(addForm.get('name')?.value ?? '').trim() || adding()"
>
  {{ 'general.button.add' | translate }}
</button>
```

Replace with:

```html
<button
  class="btn btn-outline-primary btn-split"
  type="button"
  (click)="add()"
  [disabled]="!(addForm.get('name')?.value ?? '').trim() || adding()"
>
  <bb-btn-content [icon]="icon.faPlus" [text]="'general.button.add' | translate"></bb-btn-content>
</button>
```

Current footer (lines 165-169):

```html
<div class="modal-footer">
  <button type="button" class="btn btn-link" (click)="activeModal.dismiss()">
    {{ 'general.button.close' | translate }}
  </button>
</div>
```

Replace with:

```html
<div class="modal-footer">
  <button type="button" class="btn btn-link btn-split" (click)="activeModal.dismiss()">
    <bb-btn-content
      [icon]="icon.faXmark"
      [text]="'general.button.close' | translate"
    ></bb-btn-content>
  </button>
</div>
```

- [ ] **Step 3: Run the existing spec to confirm no regressions**

Run (from `packages/app`):

```bash
npx ng test --include="**/manage-categories.spec.ts" --watch=false
```

Expected: `Test Files 1 passed (1)`, `Tests 26 passed (26)`.

- [ ] **Step 4: Commit**

```bash
git add packages/app/src/app/components/modals/manage-categories/manage-categories.ts packages/app/src/app/components/modals/manage-categories/manage-categories.html
git commit -m "#180: retrofit manage-categories modal buttons to split-button style"
```

---

### Task 2: `manage-tags` - Add and Close buttons

**Files:**

- Modify: `packages/app/src/app/components/modals/manage-tags/manage-tags.ts:13,24,29-37,51`
- Modify: `packages/app/src/app/components/modals/manage-tags/manage-tags.html:25-32,92-96`

**Interfaces:**

- Consumes: same `BbBtnContent`/`.btn-split` primitives as Task 1.
- Produces: nothing consumed by later tasks in this phase.

- [ ] **Step 1: Update `manage-tags.ts`'s icon import, `imports` array, and `icon` object**

Current solid-icon import (line 13):

```ts
import { faTrashCan as faTrashCanSolid, faXmark } from '@fortawesome/free-solid-svg-icons';
```

Replace with:

```ts
import { faPlus, faTrashCan as faTrashCanSolid, faXmark } from '@fortawesome/free-solid-svg-icons';
```

Current relative imports and `imports` array (lines 16-24, 29-37):

```ts
import { AutofocusDirective } from '../../../directives/autofocus';
import { TooltipOverflow } from '../../../directives/tooltip-overflow';
import { GuardableModal } from '../../../models/guardable-modal.interface';
import { ConfirmService } from '../../../services/confirm.service';
import { QbService } from '../../../services/qb.service';
import { ServerStoreService } from '../../../services/server-store.service';
import { ToastService } from '../../../services/toast.service';
import { TorrentStoreService } from '../../../services/torrent-store.service';
import { BbSpinner } from '../../bb-spinner/bb-spinner';
```

```ts
  imports: [
    ReactiveFormsModule,
    TranslatePipe,
    FontAwesomeModule,
    NgbTooltipModule,
    BbSpinner,
    AutofocusDirective,
    TooltipOverflow,
  ],
```

Replace with:

```ts
import { AutofocusDirective } from '../../../directives/autofocus';
import { TooltipOverflow } from '../../../directives/tooltip-overflow';
import { GuardableModal } from '../../../models/guardable-modal.interface';
import { ConfirmService } from '../../../services/confirm.service';
import { QbService } from '../../../services/qb.service';
import { ServerStoreService } from '../../../services/server-store.service';
import { ToastService } from '../../../services/toast.service';
import { TorrentStoreService } from '../../../services/torrent-store.service';
import { BbBtnContent } from '../../bb-btn-content/bb-btn-content';
import { BbSpinner } from '../../bb-spinner/bb-spinner';
```

```ts
  imports: [
    ReactiveFormsModule,
    TranslatePipe,
    FontAwesomeModule,
    NgbTooltipModule,
    BbSpinner,
    AutofocusDirective,
    TooltipOverflow,
    BbBtnContent,
  ],
```

Current `icon` object (line 51):

```ts
  public readonly icon = { faTrashCan, faXmark };
```

Replace with:

```ts
  public readonly icon = { faTrashCan, faXmark, faPlus };
```

- [ ] **Step 2: Update `manage-tags.html`'s Add and Close buttons**

Current Add button (lines 25-32):

```html
<button
  class="btn btn-outline-primary"
  type="button"
  (click)="add()"
  [disabled]="!(nameControl.value ?? '').trim() || adding()"
>
  {{ 'general.button.add' | translate }}
</button>
```

Replace with:

```html
<button
  class="btn btn-outline-primary btn-split"
  type="button"
  (click)="add()"
  [disabled]="!(nameControl.value ?? '').trim() || adding()"
>
  <bb-btn-content [icon]="icon.faPlus" [text]="'general.button.add' | translate"></bb-btn-content>
</button>
```

Current footer (lines 92-96):

```html
<div class="modal-footer">
  <button type="button" class="btn btn-link" (click)="activeModal.dismiss()">
    {{ 'general.button.close' | translate }}
  </button>
</div>
```

Replace with:

```html
<div class="modal-footer">
  <button type="button" class="btn btn-link btn-split" (click)="activeModal.dismiss()">
    <bb-btn-content
      [icon]="icon.faXmark"
      [text]="'general.button.close' | translate"
    ></bb-btn-content>
  </button>
</div>
```

- [ ] **Step 3: Run the existing spec to confirm no regressions**

Run (from `packages/app`):

```bash
npx ng test --include="**/manage-tags.spec.ts" --watch=false
```

Expected: `Test Files 1 passed (1)`, `Tests 23 passed (23)`.

- [ ] **Step 4: Commit**

```bash
git add packages/app/src/app/components/modals/manage-tags/manage-tags.ts packages/app/src/app/components/modals/manage-tags/manage-tags.html
git commit -m "#180: retrofit manage-tags modal buttons to split-button style"
```

---

### Task 3: `manage-servers` - Add Server and Close buttons

**Files:**

- Modify: `packages/app/src/app/components/modals/manage-servers/manage-servers.ts:7-12,22-23,28-34,50`
- Modify: `packages/app/src/app/components/modals/manage-servers/manage-servers.html:133-140`

**Interfaces:**

- Consumes: same `BbBtnContent`/`.btn-split` primitives as Task 1.
- Produces: nothing consumed by later tasks in this phase.

- [ ] **Step 1: Update `manage-servers.ts`'s icon import, `imports` array, and `icon` object**

Current solid-icon import (lines 7-12):

```ts
import {
  faPenToSquare,
  faPlug,
  faTrashCan as faTrashCanSolid,
  faXmark,
} from '@fortawesome/free-solid-svg-icons';
```

Replace with:

```ts
import {
  faPenToSquare,
  faPlug,
  faServer,
  faTrashCan as faTrashCanSolid,
  faXmark,
} from '@fortawesome/free-solid-svg-icons';
```

Current relative imports and `imports` array (lines 15-23, 28-34):

```ts
import { TooltipOverflow } from '../../../directives/tooltip-overflow';
import { CommandBusService } from '../../../services/command-bus.service';
import { ConfirmService } from '../../../services/confirm.service';
import { QbService } from '../../../services/qb.service';
import { ServerStoreService } from '../../../services/server-store.service';
import { ServerService } from '../../../services/server.service';
import { ToastService } from '../../../services/toast.service';
import { setModalInput } from '../../../utils/modal-input';
import { ServerEditor } from '../server-editor/server-editor';
```

```ts
  imports: [
    ReactiveFormsModule,
    TranslatePipe,
    FontAwesomeModule,
    NgbTooltipModule,
    TooltipOverflow,
  ],
```

Replace with:

```ts
import { TooltipOverflow } from '../../../directives/tooltip-overflow';
import { CommandBusService } from '../../../services/command-bus.service';
import { ConfirmService } from '../../../services/confirm.service';
import { QbService } from '../../../services/qb.service';
import { ServerStoreService } from '../../../services/server-store.service';
import { ServerService } from '../../../services/server.service';
import { ToastService } from '../../../services/toast.service';
import { setModalInput } from '../../../utils/modal-input';
import { BbBtnContent } from '../../bb-btn-content/bb-btn-content';
import { ServerEditor } from '../server-editor/server-editor';
```

```ts
  imports: [
    ReactiveFormsModule,
    TranslatePipe,
    FontAwesomeModule,
    NgbTooltipModule,
    TooltipOverflow,
    BbBtnContent,
  ],
```

Current `icon` object (line 50):

```ts
  public readonly icon = { faPenToSquare, faTrashCan, faXmark, faPlug, faSquare, faSquareCheck };
```

Replace with:

```ts
  public readonly icon = {
    faPenToSquare,
    faTrashCan,
    faXmark,
    faPlug,
    faSquare,
    faSquareCheck,
    faServer,
  };
```

- [ ] **Step 2: Update `manage-servers.html`'s footer markup**

Current footer (lines 133-140):

```html
<div class="modal-footer justify-content-end">
  <button type="button" class="btn btn-primary" (click)="openEditor()" [disabled]="busy()">
    {{ 'general.button.add-server' | translate }}
  </button>
  <button type="button" class="btn btn-link" (click)="activeModal.dismiss()">
    {{ 'general.button.close' | translate }}
  </button>
</div>
```

Replace with:

```html
<div class="modal-footer justify-content-end">
  <button
    type="button"
    class="btn btn-primary btn-split"
    (click)="openEditor()"
    [disabled]="busy()"
  >
    <bb-btn-content
      [icon]="icon.faServer"
      [text]="'general.button.add-server' | translate"
    ></bb-btn-content>
  </button>
  <button type="button" class="btn btn-link btn-split" (click)="activeModal.dismiss()">
    <bb-btn-content
      [icon]="icon.faXmark"
      [text]="'general.button.close' | translate"
    ></bb-btn-content>
  </button>
</div>
```

- [ ] **Step 3: Run the existing spec to confirm no regressions**

Run (from `packages/app`):

```bash
npx ng test --include="**/manage-servers.spec.ts" --watch=false
```

Expected: `Test Files 1 passed (1)`, `Tests 5 passed (5)`.

- [ ] **Step 4: Commit**

```bash
git add packages/app/src/app/components/modals/manage-servers/manage-servers.ts packages/app/src/app/components/modals/manage-servers/manage-servers.html
git commit -m "#180: retrofit manage-servers modal buttons to split-button style"
```

---

### Task 4: `torrent-details` - Close button

**Files:**

- Modify: `packages/app/src/app/components/modals/torrent-details/torrent-details.ts:14,26-27,32-40,57`
- Modify: `packages/app/src/app/components/modals/torrent-details/torrent-details.html:69-73`

**Interfaces:**

- Consumes: same `BbBtnContent`/`.btn-split` primitives as Task 1.
- Produces: nothing consumed by later tasks in this phase.

- [ ] **Step 1: Update `torrent-details.ts`'s icon import, `imports` array, and `icon` object**

Current solid-icon import (line 14):

```ts
import { faAsterisk } from '@fortawesome/free-solid-svg-icons';
```

Replace with:

```ts
import { faAsterisk, faXmark } from '@fortawesome/free-solid-svg-icons';
```

Current relative imports and `imports` array (lines 18-27, 32-40):

```ts
import { AutofocusDirective } from '../../../directives/autofocus';
import { AppCommand, TorrentCommand } from '../../../models/command.model';
import { GuardableModal } from '../../../models/guardable-modal.interface';
import { Torrent } from '../../../models/torrent.model';
import { CommandBusService } from '../../../services/command-bus.service';
import { ConfirmService } from '../../../services/confirm.service';
import { ModalGuardService } from '../../../services/modal-guard.service';
import { TorrentStoreService } from '../../../services/torrent-store.service';
import { BbSpinner } from '../../bb-spinner/bb-spinner';
import { Tab, TorrentDetailTabComponent, TorrentDetailTabId } from './torrent-details.interface';
```

```ts
  imports: [
    CommonModule,
    BbSpinner,
    NgComponentOutlet,
    AutofocusDirective,
    NgbTooltip,
    TranslatePipe,
    FontAwesomeModule,
  ],
```

Replace with:

```ts
import { AutofocusDirective } from '../../../directives/autofocus';
import { AppCommand, TorrentCommand } from '../../../models/command.model';
import { GuardableModal } from '../../../models/guardable-modal.interface';
import { Torrent } from '../../../models/torrent.model';
import { CommandBusService } from '../../../services/command-bus.service';
import { ConfirmService } from '../../../services/confirm.service';
import { ModalGuardService } from '../../../services/modal-guard.service';
import { TorrentStoreService } from '../../../services/torrent-store.service';
import { BbBtnContent } from '../../bb-btn-content/bb-btn-content';
import { BbSpinner } from '../../bb-spinner/bb-spinner';
import { Tab, TorrentDetailTabComponent, TorrentDetailTabId } from './torrent-details.interface';
```

```ts
  imports: [
    CommonModule,
    BbSpinner,
    NgComponentOutlet,
    AutofocusDirective,
    NgbTooltip,
    TranslatePipe,
    FontAwesomeModule,
    BbBtnContent,
  ],
```

Current `icon` object (line 57):

```ts
  public readonly icon = { faAsterisk };
```

Replace with:

```ts
  public readonly icon = { faAsterisk, faXmark };
```

- [ ] **Step 2: Update `torrent-details.html`'s footer markup**

Current footer (lines 69-73):

```html
<div class="modal-footer">
  <button type="button" class="btn btn-link" (click)="activeModal.dismiss()" autofocus>
    {{ 'general.button.close' | translate }}
  </button>
</div>
```

Replace with:

```html
<div class="modal-footer">
  <button type="button" class="btn btn-link btn-split" (click)="activeModal.dismiss()" autofocus>
    <bb-btn-content
      [icon]="icon.faXmark"
      [text]="'general.button.close' | translate"
    ></bb-btn-content>
  </button>
</div>
```

- [ ] **Step 3: Run the existing spec to confirm no regressions**

Run (from `packages/app`):

```bash
npx ng test --include="**/torrent-details.spec.ts" --watch=false
```

Expected: `Test Files 1 passed (1)`, `Tests 7 passed (7)`.

- [ ] **Step 4: Commit**

```bash
git add packages/app/src/app/components/modals/torrent-details/torrent-details.ts packages/app/src/app/components/modals/torrent-details/torrent-details.html
git commit -m "#180: retrofit torrent-details modal buttons to split-button style"
```

---

### Task 5: `qb-settings` - Save and Close buttons

**Files:**

- Modify: `packages/app/src/app/pages/qb-settings/qb-settings.ts:12,16-24,28-35,55`
- Modify: `packages/app/src/app/pages/qb-settings/qb-settings.html:50-62`

**Interfaces:**

- Consumes: same `BbBtnContent`/`.btn-split` primitives as Task 1.
- Produces: nothing consumed by later tasks in this phase.

- [ ] **Step 1: Update `qb-settings.ts`'s icon import, `imports` array, and `icon` object**

Current solid-icon import (line 12):

```ts
import { faAsterisk } from '@fortawesome/free-solid-svg-icons';
```

Replace with:

```ts
import { faAsterisk, faFloppyDisk, faXmark } from '@fortawesome/free-solid-svg-icons';
```

Current relative imports and `imports` array (lines 16-24, 28-35):

```ts
import { BbSpinner } from '../../components/bb-spinner/bb-spinner';
import { AutofocusDirective } from '../../directives/autofocus';
import { GuardableModal } from '../../models/guardable-modal.interface';
import { ConfirmService } from '../../services/confirm.service';
import { QbService } from '../../services/qb.service';
import { ServerStoreService } from '../../services/server-store.service';
import { ToastService } from '../../services/toast.service';
import { QbSettingsStateService } from './qb-settings-state.service';
import { QbSettingsTab, QbSettingsTabComponent, QbSettingsTabId } from './qb-settings.interface';
```

```ts
  imports: [
    CommonModule,
    AutofocusDirective,
    TranslatePipe,
    BbSpinner,
    FontAwesomeModule,
    NgbTooltipModule,
  ],
```

Replace with:

```ts
import { BbBtnContent } from '../../components/bb-btn-content/bb-btn-content';
import { BbSpinner } from '../../components/bb-spinner/bb-spinner';
import { AutofocusDirective } from '../../directives/autofocus';
import { GuardableModal } from '../../models/guardable-modal.interface';
import { ConfirmService } from '../../services/confirm.service';
import { QbService } from '../../services/qb.service';
import { ServerStoreService } from '../../services/server-store.service';
import { ToastService } from '../../services/toast.service';
import { QbSettingsStateService } from './qb-settings-state.service';
import { QbSettingsTab, QbSettingsTabComponent, QbSettingsTabId } from './qb-settings.interface';
```

```ts
  imports: [
    CommonModule,
    AutofocusDirective,
    TranslatePipe,
    BbSpinner,
    FontAwesomeModule,
    NgbTooltipModule,
    BbBtnContent,
  ],
```

Current `icon` object (line 55):

```ts
  public icon = { faAsterisk };
```

Replace with:

```ts
  public icon = { faAsterisk, faFloppyDisk, faXmark };
```

- [ ] **Step 2: Update `qb-settings.html`'s footer markup**

Current footer (lines 50-62):

```html
<div class="modal-footer">
  <button
    type="button"
    class="btn btn-primary"
    [disabled]="!stateService.isDirty()"
    (click)="onSave()"
  >
    {{ 'general.button.save' | translate }}
  </button>
  <button type="button" class="btn btn-link" (click)="activeModal.dismiss()" autofocus>
    {{ 'general.button.close' | translate }}
  </button>
</div>
```

Replace with:

```html
<div class="modal-footer">
  <button
    type="button"
    class="btn btn-primary btn-split"
    [disabled]="!stateService.isDirty()"
    (click)="onSave()"
  >
    <bb-btn-content
      [icon]="icon.faFloppyDisk"
      [text]="'general.button.save' | translate"
    ></bb-btn-content>
  </button>
  <button type="button" class="btn btn-link btn-split" (click)="activeModal.dismiss()" autofocus>
    <bb-btn-content
      [icon]="icon.faXmark"
      [text]="'general.button.close' | translate"
    ></bb-btn-content>
  </button>
</div>
```

- [ ] **Step 3: Run the existing spec to confirm no regressions**

Run (from `packages/app`):

```bash
npx ng test --include="**/qb-settings.spec.ts" --watch=false
```

Expected: `Test Files 1 passed (1)`, `Tests 14 passed (14)`.

- [ ] **Step 4: Commit**

```bash
git add packages/app/src/app/pages/qb-settings/qb-settings.ts packages/app/src/app/pages/qb-settings/qb-settings.html
git commit -m "#180: retrofit qb-settings modal buttons to split-button style"
```

---

### Task 6: `settings` - Save and Close buttons

**Files:**

- Modify: `packages/app/src/app/pages/settings/settings.ts:12,16-22,26-33,51`
- Modify: `packages/app/src/app/pages/settings/settings.html:50-62`

**Interfaces:**

- Consumes: same `BbBtnContent`/`.btn-split` primitives as Task 1. This is the last task of Phase 4.
- Produces: nothing consumed by later tasks in this phase.

- [ ] **Step 1: Update `settings.ts`'s icon import, `imports` array, and `icon` object**

Current solid-icon import (line 12):

```ts
import { faAsterisk } from '@fortawesome/free-solid-svg-icons';
```

Replace with:

```ts
import { faAsterisk, faFloppyDisk, faXmark } from '@fortawesome/free-solid-svg-icons';
```

Current relative imports and `imports` array (lines 16-22, 26-33):

```ts
import { BbSpinner } from '../../components/bb-spinner/bb-spinner';
import { AutofocusDirective } from '../../directives/autofocus';
import { GuardableModal } from '../../models/guardable-modal.interface';
import { ConfirmService } from '../../services/confirm.service';
import { ToastService } from '../../services/toast.service';
import { SettingsStateService } from './settings-state.service';
import { SettingsTabComponent, SettingsTabId, Tab } from './settings.interface';
```

```ts
  imports: [
    CommonModule,
    AutofocusDirective,
    TranslatePipe,
    BbSpinner,
    FontAwesomeModule,
    NgbTooltipModule,
  ],
```

Replace with:

```ts
import { BbBtnContent } from '../../components/bb-btn-content/bb-btn-content';
import { BbSpinner } from '../../components/bb-spinner/bb-spinner';
import { AutofocusDirective } from '../../directives/autofocus';
import { GuardableModal } from '../../models/guardable-modal.interface';
import { ConfirmService } from '../../services/confirm.service';
import { ToastService } from '../../services/toast.service';
import { SettingsStateService } from './settings-state.service';
import { SettingsTabComponent, SettingsTabId, Tab } from './settings.interface';
```

```ts
  imports: [
    CommonModule,
    AutofocusDirective,
    TranslatePipe,
    BbSpinner,
    FontAwesomeModule,
    NgbTooltipModule,
    BbBtnContent,
  ],
```

Current `icon` object (line 51):

```ts
  public icon = { faAsterisk };
```

Replace with:

```ts
  public icon = { faAsterisk, faFloppyDisk, faXmark };
```

- [ ] **Step 2: Update `settings.html`'s footer markup**

Current footer (lines 50-62):

```html
<div class="modal-footer">
  <button
    type="button"
    class="btn btn-primary"
    [disabled]="!stateService.isDirty()"
    (click)="onSave()"
  >
    {{ 'general.button.save' | translate }}
  </button>
  <button type="button" class="btn btn-link" (click)="activeModal.dismiss()" autofocus>
    {{ 'general.button.close' | translate }}
  </button>
</div>
```

Replace with:

```html
<div class="modal-footer">
  <button
    type="button"
    class="btn btn-primary btn-split"
    [disabled]="!stateService.isDirty()"
    (click)="onSave()"
  >
    <bb-btn-content
      [icon]="icon.faFloppyDisk"
      [text]="'general.button.save' | translate"
    ></bb-btn-content>
  </button>
  <button type="button" class="btn btn-link btn-split" (click)="activeModal.dismiss()" autofocus>
    <bb-btn-content
      [icon]="icon.faXmark"
      [text]="'general.button.close' | translate"
    ></bb-btn-content>
  </button>
</div>
```

- [ ] **Step 3: Run the existing spec to confirm no regressions**

Run (from `packages/app`):

```bash
npx ng test --include="**/settings.spec.ts" --watch=false
```

Expected: `Test Files 1 passed (1)`, `Tests 13 passed (13)`.

- [ ] **Step 4: Commit**

```bash
git add packages/app/src/app/pages/settings/settings.ts packages/app/src/app/pages/settings/settings.html
git commit -m "#180: retrofit settings modal buttons to split-button style"
```

---

## Self-Review Notes

- **Spec coverage:** covers the Phase 4 row of the design spec's rollout table in full (`manage-categories`, `manage-tags`, `manage-servers`, `torrent-details`, `qb-settings`, `settings` - 11 buttons: 2+2+2+1+2+2, close to the spec's "~10" estimate, an approximate figure in the spec itself). Verified the exact button count against current source via `grep -n 'class="[^"]*\bbtn\b'` across all 6 HTML files and cross-checked each result against the design spec's scope exclusions (icon-only inline row actions, `.btn-close`, `nav-link`, `bb-filter-clear`) - every in-scope button is covered by exactly one task, every excluded button is named explicitly in Global Constraints. Icon assignments match the design spec's generic-key table exactly (`add` -> `faPlus`, `add-server` -> `faServer`, `save` -> `faFloppyDisk`, `close` -> `faXmark`) - no new icon decisions.
- **Placeholder scan:** none - all six tasks contain complete before/after code for every file/section they touch.
- **Formatting verified, not guessed:** every `.ts` and `.html` snippet in this plan was produced by actually applying the edit to a copy of the real file inside the project tree and running this repo's own `npx prettier --write` (picking up `package.json`'s `@trivago/prettier-plugin-sort-imports` config and the `*.html` -> Angular parser override) - the import re-ordering, line-wrapping (e.g. `manage-tags.ts`'s solid-icon import collapsing to one line at 99 chars, `manage-servers.html`'s Add Server button wrapping its attributes), and `<bb-btn-content>` multi-line wrapping in every snippet are the tool's actual output, not a manual estimate.
- **Type consistency:** `BbBtnContent`'s `icon`/`text` inputs are referenced identically to Phase 0's definition and Phases 1-3's usage (`[icon]`, `[text]`, `position` left unset everywhere since all 11 buttons want the icon first). Every import path was verified against each file's actual location (`components/modals/<name>/` two levels from `components/`; `pages/<name>/` two levels from `app/`).
- **Naming-convention deviation flagged, not silently fixed:** this phase's 6 files all use `icon` (singular) for their local icon object, breaking from Phases 1-3's `icons` (plural) convention - called out explicitly in Global Constraints and the Architecture section so neither the implementer nor reviewer "corrects" it mid-phase; renaming it is out of scope (would touch every existing `<fa-icon>` reference in each file's template, none of which are part of this rollout).
- **Out-of-scope verification:** confirmed all 6 modals' `.btn-close` header buttons, every icon-only inline row action (manage-categories' edit/save/cancel/delete, manage-tags' delete, manage-servers' connect/auto-login/edit/delete and its `.connect-btn` class asserted by `manage-servers.spec.ts`), the `bb-filter-clear` buttons, and the `nav-link` tab buttons (plus their inline `faAsterisk` indicators) are untouched by any task.
- **Test counts:** all 6 expected counts (26, 23, 5, 7, 14, 13 = 88 total) were captured by running each spec file against the current `HEAD` (commit `b6f8b1d`, end of Phase 3) before writing this plan - they reflect actual current state, not estimates.
