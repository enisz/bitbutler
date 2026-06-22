# Split Buttons - Phase 3: Confirm/Danger Modals Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Retrofit the 7 Bootstrap `.btn`s across `confirm`, `delete-torrent`, and `torrent-exists` to the `.btn-split`/`bb-btn-content` pattern, and extend `Confirm`'s API with `okIcon`/`cancelIcon` inputs (defaulting `faCheck`/`faXmark`) so the generic confirm dialog can show a danger-appropriate icon - then audit all 9 existing callers of `ConfirmService.confirm()` and pass `faTrashCan` as `okIcon` for the 3 that confirm a destructive delete.

**Architecture:** Unlike Phases 1-2 (markup-only retrofits), this phase changes a shared API (`Confirm`'s inputs, `ConfirmService.confirm()`'s parameters), so it follows TDD for the two API-surface tasks (Tasks 1-2) and a caller-audit task (Task 3) before the two independent markup-only retrofits (Tasks 4-5). `ConfirmService.confirm()` gains one new trailing parameter, `okIcon: IconDefinition = faCheck`, appended _after_ the existing `dialogSize` parameter so no existing positional call site (none of which pass `dialogSize` today except one test) shifts meaning.

**Tech Stack:** Angular 20 (signals, standalone components, OnPush), `@fortawesome/angular-fontawesome`, `@ngx-translate/core`, Vitest (via `@angular/build:unit-test`).

## Global Constraints

- Consumes only Phase 0's primitives - no CSS or shared-component changes in this phase: `.btn-split`/`.btn-icon`/`.btn-text` classes (`packages/app/src/styles.scss`) and `BbBtnContent` (`packages/app/src/app/components/bb-btn-content/bb-btn-content.ts`, selector `bb-btn-content`, inputs `icon: IconDefinition` required, `text: string` required, `position: 'start' | 'end' = 'start'`).
- Call-site markup pattern: keep the host element's tag and existing Bootstrap classes, add `btn-split`, and replace the button body with `<bb-btn-content [icon]="..." [text]="..."></bb-btn-content>`.
- Icon assignments, all from `@fortawesome/free-solid-svg-icons`:
  - `Confirm.okIcon` default -> `faCheck`; `Confirm.cancelIcon` default -> `faXmark` (per the design spec's generic-key table: `ok` -> `faCheck`, `cancel` -> `faXmark`).
  - `general.button.delete` -> `faTrashCan` (`delete-torrent`'s Delete button, and the `okIcon` override for the 3 destructive `ConfirmService.confirm()` callers).
  - `components.modals.torrent-exists.button.delete-file` -> `faTrashCan` (same icon, different translation key).
  - `general.button.open-details` -> `faCircleInfo`.
  - `general.button.close` -> `faXmark` (already assigned in Phase 1).
- Translation keys are unchanged - all keys used in this phase already exist in `public/i18n/us.json`/`hu.json`. No i18n file edits.
- `ConfirmService.confirm()`'s new `okIcon` parameter is appended **after** `dialogSize` (6th positional parameter), not before it - inserting it earlier would shift `dialogSize`'s position and break `confirm.service.spec.ts`'s existing `'should use provided dialog size'` test, which calls `service.confirm('T', 'M', undefined, undefined, 'lg')`. No `cancelIcon` parameter is added to `ConfirmService.confirm()` - none of the 9 audited callers need to override it, so only `Confirm`'s own component-level default (`faXmark`) is exposed there. This is intentionally asymmetric with `Confirm`'s own `okIcon`/`cancelIcon` inputs (which both exist on the component per the design spec) - YAGNI at the service layer where no caller needs it yet.
- **Caller audit (must be fully accounted for, not just the 3 that change):** `ConfirmService.confirm()` has exactly 9 call sites today. 3 confirm a destructive delete and get `okIcon: faTrashCan` in Task 3: `manage-tags.ts:139` (`delete()`), `manage-servers.ts:117` (`delete()`), `manage-categories.ts:184` (`delete()`). The other 6 are **explicitly left unchanged** (default `faCheck` applies) - `torrent-details.ts:125`, `bb-file-tree.ts:298`, `manage-tags.ts:70`, `qb-settings.ts:104`, `manage-categories.ts:83`, `settings.ts:92` - all of these are either unsaved-changes guards ("Leave"/"Stay") or a generic confirm with no custom button text, none of which are themselves a delete action.
- `manage-tags.ts`, `manage-servers.ts`, and `manage-categories.ts` already import `faTrashCan` from `@fortawesome/free-regular-svg-icons` (the outline variant, used for each component's own pre-existing inline per-row delete icon-only button - out of scope, untouched). The new solid `faTrashCan` needed for the `okIcon` argument must be imported with an alias, `faTrashCan as faTrashCanSolid`, to avoid colliding with the existing regular-variant import.
- Each of the 2 new components touched in Tasks 4-5 (`delete-torrent`, `torrent-exists`) exposes icons via a component-local `public icons = { ... };` object (existing convention) - neither file has one yet, so one is created in each.
- Import path for `BbBtnContent` from `confirm.ts`, `delete-torrent.ts`, and `torrent-exists.ts` is `../../bb-btn-content/bb-btn-content` (all three live at `packages/app/src/app/components/modals/<name>/<name>.ts`, two levels up from `components/`).
- Class names match filenames without suffix; no `standalone: true` flag added/removed beyond what's already present in a file.
- Out of scope - do not touch: `confirm.html`'s `.btn-close` header button or `[innerHTML]` message body; `delete-torrent.html`'s checkbox/form-check markup; `torrent-exists.html`'s `.btn-close` header button, its read-only `<dl>` detail rows, or its `app-bb-progress` usage; any of the 6 non-destructive `ConfirmService.confirm()` callers listed above.

---

### Task 1: `Confirm` component - add `okIcon`/`cancelIcon` inputs and retrofit buttons

**Files:**

- Modify: `packages/app/src/app/components/modals/confirm/confirm.ts` (full file, 22 lines)
- Modify: `packages/app/src/app/components/modals/confirm/confirm.html` (full file, 18 lines)
- Modify: `packages/app/src/app/components/modals/confirm/confirm.spec.ts:1-52`

**Interfaces:**

- Consumes: `BbBtnContent` and `.btn-split`/`.btn-icon`/`.btn-text` from Phase 0 (see Global Constraints).
- Produces: `Confirm.okIcon: () => IconDefinition` (default `faCheck`), `Confirm.cancelIcon: () => IconDefinition` (default `faXmark`) - both `input<IconDefinition>(...)`. Task 2's `ConfirmService` sets the `okIcon` input via `setModalInput`; the `cancelIcon` input always keeps its component-level default since no current caller overrides it.

- [ ] **Step 1: Write the failing tests**

In `packages/app/src/app/components/modals/confirm/confirm.spec.ts`, add the import and three new tests. Current top of file:

```ts
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { Confirm } from './confirm';
```

Replace with:

```ts
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { faCheck, faTrashCan, faXmark } from '@fortawesome/free-solid-svg-icons';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { Confirm } from './confirm';
```

Add these tests right after the existing `'should accept custom title params'` test (before the closing `});` of the `describe` block):

```ts
it('should have default ok icon', () => {
  expect(component.okIcon()).toBe(faCheck);
});

it('should have default cancel icon', () => {
  expect(component.cancelIcon()).toBe(faXmark);
});

it('should accept custom okIcon input', () => {
  fixture.componentRef.setInput('okIcon', faTrashCan);
  expect(component.okIcon()).toBe(faTrashCan);
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run (from `packages/app`):

```bash
npx ng test --include="**/confirm.spec.ts" --watch=false
```

Expected: 3 failures - `Property 'okIcon' does not exist on type 'Confirm'` (or equivalent runtime `undefined` mismatch), since `okIcon`/`cancelIcon` don't exist yet.

- [ ] **Step 3: Implement `okIcon`/`cancelIcon` inputs and retrofit the footer markup**

Current `confirm.ts` (full file):

```ts
import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { TranslatePipe } from '@ngx-translate/core';
import { AutofocusDirective } from '../../../directives/autofocus';

@Component({
  selector: 'app-confirm',
  standalone: true,
  imports: [TranslatePipe, AutofocusDirective],
  templateUrl: './confirm.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Confirm {
  public readonly activeModal = inject(NgbActiveModal);

  readonly title = input('components.modals.confirm.title');
  readonly titleParams = input<object>({});
  readonly message = input('components.modals.confirm.message');
  readonly messageParams = input<object>({});
  readonly btnOkText = input('general.button.ok');
  readonly btnCancelText = input('general.button.cancel');
}
```

Replace with:

```ts
import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { IconDefinition } from '@fortawesome/fontawesome-svg-core';
import { faCheck, faXmark } from '@fortawesome/free-solid-svg-icons';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { TranslatePipe } from '@ngx-translate/core';
import { AutofocusDirective } from '../../../directives/autofocus';
import { BbBtnContent } from '../../bb-btn-content/bb-btn-content';

@Component({
  selector: 'app-confirm',
  standalone: true,
  imports: [TranslatePipe, AutofocusDirective, BbBtnContent],
  templateUrl: './confirm.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Confirm {
  public readonly activeModal = inject(NgbActiveModal);

  readonly title = input('components.modals.confirm.title');
  readonly titleParams = input<object>({});
  readonly message = input('components.modals.confirm.message');
  readonly messageParams = input<object>({});
  readonly btnOkText = input('general.button.ok');
  readonly btnCancelText = input('general.button.cancel');
  readonly okIcon = input<IconDefinition>(faCheck);
  readonly cancelIcon = input<IconDefinition>(faXmark);
}
```

Current `confirm.html` (full file):

```html
<div class="modal-header">
  <h4 class="modal-title">{{ title() | translate: titleParams() }}</h4>
  <button
    type="button"
    class="btn-close"
    aria-label="Close"
    (click)="activeModal.dismiss()"
  ></button>
</div>
<div class="modal-body" [innerHTML]="message() | translate: messageParams()"></div>
<div class="modal-footer">
  <button type="button" class="btn btn-danger" (click)="activeModal.close(true)" autofocus>
    {{ btnOkText() | translate }}
  </button>
  <button type="button" class="btn btn-link" (click)="activeModal.close(false)">
    {{ btnCancelText() | translate }}
  </button>
</div>
```

Replace with:

```html
<div class="modal-header">
  <h4 class="modal-title">{{ title() | translate: titleParams() }}</h4>
  <button
    type="button"
    class="btn-close"
    aria-label="Close"
    (click)="activeModal.dismiss()"
  ></button>
</div>
<div class="modal-body" [innerHTML]="message() | translate: messageParams()"></div>
<div class="modal-footer">
  <button
    type="button"
    class="btn btn-danger btn-split"
    (click)="activeModal.close(true)"
    autofocus
  >
    <bb-btn-content [icon]="okIcon()" [text]="btnOkText() | translate"></bb-btn-content>
  </button>
  <button type="button" class="btn btn-link btn-split" (click)="activeModal.close(false)">
    <bb-btn-content [icon]="cancelIcon()" [text]="btnCancelText() | translate"></bb-btn-content>
  </button>
</div>
```

- [ ] **Step 4: Run the tests to verify they pass**

Run (from `packages/app`):

```bash
npx ng test --include="**/confirm.spec.ts" --watch=false
```

Expected: `Test Files 1 passed (1)`, `Tests 10 passed (10)`.

- [ ] **Step 5: Commit**

```bash
git add packages/app/src/app/components/modals/confirm/confirm.ts packages/app/src/app/components/modals/confirm/confirm.html packages/app/src/app/components/modals/confirm/confirm.spec.ts
git commit -m "#180: add okIcon/cancelIcon inputs to Confirm and retrofit its buttons"
```

---

### Task 2: `ConfirmService` - add `okIcon` passthrough parameter

**Files:**

- Modify: `packages/app/src/app/services/confirm.service.ts` (full file, 45 lines)
- Modify: `packages/app/src/app/services/confirm.service.spec.ts:1-88`

**Interfaces:**

- Consumes: `Confirm.okIcon` input from Task 1 (must exist before this task can pass it through meaningfully, though `setModalInput` itself has no compile-time dependency on it).
- Produces: `ConfirmService.confirm(title, message, btnOkText?, btnCancelText?, dialogSize?, okIcon?: IconDefinition = faCheck): Promise<boolean>`. Task 3's 3 destructive-delete callers pass a non-default `okIcon`; the other 6 callers (and this task itself) rely on the default.

- [ ] **Step 1: Write the failing tests**

In `packages/app/src/app/services/confirm.service.spec.ts`, add the import. Current top of file:

```ts
import { TestBed } from '@angular/core/testing';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { TranslateService } from '@ngx-translate/core';
import { ConfirmService } from './confirm.service';
```

Replace with:

```ts
import { TestBed } from '@angular/core/testing';
import { faCheck, faTrashCan } from '@fortawesome/free-solid-svg-icons';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { TranslateService } from '@ngx-translate/core';
import { ConfirmService } from './confirm.service';
```

Add these tests right after the existing `'should use provided dialog size'` test (before the closing `});` of the `describe` block):

```ts
it('should default okIcon to faCheck', async () => {
  await service.confirm('T', 'M').catch(() => {});
  expect(mockModalRef.componentInstance.okIcon).toBe(faCheck);
});

it('should set custom okIcon when provided', async () => {
  await service.confirm('T', 'M', undefined, undefined, undefined, faTrashCan).catch(() => {});
  expect(mockModalRef.componentInstance.okIcon).toBe(faTrashCan);
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run (from `packages/app`):

```bash
npx ng test --include="**/confirm.service.spec.ts" --watch=false
```

Expected: 2 failures - `mockModalRef.componentInstance.okIcon` is `undefined`, since `confirm()` never calls `setModalInput(modalRef, 'okIcon', ...)` yet.

- [ ] **Step 3: Implement the `okIcon` parameter**

Current `confirm.service.ts` (full file):

```ts
import { Injectable, inject } from '@angular/core';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { TranslateService } from '@ngx-translate/core';
import { Confirm } from '../components/modals/confirm/confirm';
import { setModalInput } from '../utils/modal-input';

export interface ParamWithData {
  text: string;
  data: object;
}

@Injectable({ providedIn: 'root' })
export class ConfirmService {
  private readonly modalService = inject(NgbModal);
  private readonly translateService = inject(TranslateService);

  public confirm(
    title: string | ParamWithData,
    message: string | ParamWithData,
    btnOkText: string = 'general.button.ok',
    btnCancelText: string = 'general.button.cancel',
    dialogSize: 'sm' | 'md' | 'lg' | 'xl' = 'md',
  ): Promise<boolean> {
    const modalRef = this.modalService.open(Confirm, { size: dialogSize });

    if (typeof title !== 'string') {
      setModalInput(modalRef, 'title', title.text);
      setModalInput(modalRef, 'titleParams', title.data);
    } else {
      setModalInput(modalRef, 'title', title);
    }

    if (typeof message !== 'string') {
      setModalInput(modalRef, 'message', message.text);
      setModalInput(modalRef, 'messageParams', message.data);
    } else {
      setModalInput(modalRef, 'message', message);
    }

    setModalInput(modalRef, 'btnOkText', btnOkText);
    setModalInput(modalRef, 'btnCancelText', btnCancelText);

    return modalRef.result.catch(() => false);
  }
}
```

Replace with:

```ts
import { Injectable, inject } from '@angular/core';
import { IconDefinition } from '@fortawesome/fontawesome-svg-core';
import { faCheck } from '@fortawesome/free-solid-svg-icons';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { TranslateService } from '@ngx-translate/core';
import { Confirm } from '../components/modals/confirm/confirm';
import { setModalInput } from '../utils/modal-input';

export interface ParamWithData {
  text: string;
  data: object;
}

@Injectable({ providedIn: 'root' })
export class ConfirmService {
  private readonly modalService = inject(NgbModal);
  private readonly translateService = inject(TranslateService);

  public confirm(
    title: string | ParamWithData,
    message: string | ParamWithData,
    btnOkText: string = 'general.button.ok',
    btnCancelText: string = 'general.button.cancel',
    dialogSize: 'sm' | 'md' | 'lg' | 'xl' = 'md',
    okIcon: IconDefinition = faCheck,
  ): Promise<boolean> {
    const modalRef = this.modalService.open(Confirm, { size: dialogSize });

    if (typeof title !== 'string') {
      setModalInput(modalRef, 'title', title.text);
      setModalInput(modalRef, 'titleParams', title.data);
    } else {
      setModalInput(modalRef, 'title', title);
    }

    if (typeof message !== 'string') {
      setModalInput(modalRef, 'message', message.text);
      setModalInput(modalRef, 'messageParams', message.data);
    } else {
      setModalInput(modalRef, 'message', message);
    }

    setModalInput(modalRef, 'btnOkText', btnOkText);
    setModalInput(modalRef, 'btnCancelText', btnCancelText);
    setModalInput(modalRef, 'okIcon', okIcon);

    return modalRef.result.catch(() => false);
  }
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run (from `packages/app`):

```bash
npx ng test --include="**/confirm.service.spec.ts" --watch=false
```

Expected: `Test Files 1 passed (1)`, `Tests 11 passed (11)`.

- [ ] **Step 5: Commit**

```bash
git add packages/app/src/app/services/confirm.service.ts packages/app/src/app/services/confirm.service.spec.ts
git commit -m "#180: add okIcon passthrough parameter to ConfirmService"
```

---

### Task 3: Audit `ConfirmService.confirm()` callers - pass `faTrashCan` for destructive deletes

**Files:**

- Modify: `packages/app/src/app/components/modals/manage-tags/manage-tags.ts:12-13,139-146`
- Modify: `packages/app/src/app/components/modals/manage-tags/manage-tags.spec.ts:141-149`
- Modify: `packages/app/src/app/components/modals/manage-servers/manage-servers.ts:6-7,117-124`
- Modify: `packages/app/src/app/components/modals/manage-categories/manage-categories.ts:12-13,184-191`
- Modify: `packages/app/src/app/components/modals/manage-categories/manage-categories.spec.ts:170-177`

**Interfaces:**

- Consumes: `ConfirmService.confirm()`'s new `okIcon` parameter from Task 2.
- Produces: nothing consumed by later tasks. This task also documents (via the Global Constraints' caller-audit list) that the other 6 callers are intentionally unchanged - no file changes for those.

- [ ] **Step 1: `manage-tags.ts` - import the solid `faTrashCan` under an alias and pass it as `okIcon`**

Current import lines (12-13):

```ts
import { faTrashCan } from '@fortawesome/free-regular-svg-icons';
import { faXmark } from '@fortawesome/free-solid-svg-icons';
```

Replace with:

```ts
import { faTrashCan } from '@fortawesome/free-regular-svg-icons';
import { faTrashCan as faTrashCanSolid, faXmark } from '@fortawesome/free-solid-svg-icons';
```

Current `delete()` method's `confirm()` call (lines 139-146):

```ts
const confirmed = await this.confirmService.confirm(
  'components.modals.manage-tags.delete-confirm.title',
  {
    text: 'components.modals.manage-tags.delete-confirm.message',
    data: { name: tag, count },
  },
  'general.button.delete',
);
```

Replace with:

```ts
const confirmed = await this.confirmService.confirm(
  'components.modals.manage-tags.delete-confirm.title',
  {
    text: 'components.modals.manage-tags.delete-confirm.message',
    data: { name: tag, count },
  },
  'general.button.delete',
  undefined,
  undefined,
  faTrashCanSolid,
);
```

- [ ] **Step 2: Update `manage-tags.spec.ts`'s assertion to match the new call signature**

This existing test currently passes because it doesn't account for the 3 new trailing arguments - running it now (before this step) would fail with an argument-count mismatch. Current test (lines 141-149):

```ts
it('should pass the torrent count to the confirm dialog', async () => {
  await component.delete('linux');

  expect(mockConfirmService.confirm).toHaveBeenCalledWith(
    expect.any(String),
    expect.objectContaining({ data: { name: 'linux', count: 2 } }),
    expect.any(String),
  );
});
```

Replace with:

```ts
it('should pass the torrent count to the confirm dialog', async () => {
  await component.delete('linux');

  expect(mockConfirmService.confirm).toHaveBeenCalledWith(
    expect.any(String),
    expect.objectContaining({ data: { name: 'linux', count: 2 } }),
    expect.any(String),
    undefined,
    undefined,
    faTrashCan,
  );
});
```

Add the import at the top of `manage-tags.spec.ts`. Current (line 1):

```ts
import { signal } from '@angular/core';
```

Replace with:

```ts
import { signal } from '@angular/core';
import { faTrashCan } from '@fortawesome/free-solid-svg-icons';
```

- [ ] **Step 3: Run `manage-tags`'s tests to verify they pass**

Run (from `packages/app`):

```bash
npx ng test --include="**/manage-tags.spec.ts" --watch=false
```

Expected: `Test Files 1 passed (1)`, `Tests 23 passed (23)`.

- [ ] **Step 4: `manage-servers.ts` - import the solid `faTrashCan` under an alias and pass it as `okIcon`**

Current import line (6-7):

```ts
import { faSquare, faSquareCheck, faTrashCan } from '@fortawesome/free-regular-svg-icons';
import { faPenToSquare, faPlug, faXmark } from '@fortawesome/free-solid-svg-icons';
```

Replace with:

```ts
import { faSquare, faSquareCheck, faTrashCan } from '@fortawesome/free-regular-svg-icons';
import {
  faPenToSquare,
  faPlug,
  faTrashCan as faTrashCanSolid,
  faXmark,
} from '@fortawesome/free-solid-svg-icons';
```

Current `delete()` method's `confirm()` call (lines 117-124):

```ts
const confirmed = await this.confirmService.confirm(
  'components.modals.manage-servers.delete-confirm.title',
  {
    text: 'components.modals.manage-servers.delete-confirm.message',
    data: { name: server.name || server.host },
  },
  'general.button.delete',
);
```

Replace with:

```ts
const confirmed = await this.confirmService.confirm(
  'components.modals.manage-servers.delete-confirm.title',
  {
    text: 'components.modals.manage-servers.delete-confirm.message',
    data: { name: server.name || server.host },
  },
  'general.button.delete',
  undefined,
  undefined,
  faTrashCanSolid,
);
```

`manage-servers.spec.ts` mocks `ConfirmService` wholesale (`{ confirm: vi.fn().mockResolvedValue(false) }`) and never asserts on `confirm()`'s exact call arguments - no spec change needed for this file.

- [ ] **Step 5: Run `manage-servers`'s tests to verify they pass**

Run (from `packages/app`):

```bash
npx ng test --include="**/manage-servers.spec.ts" --watch=false
```

Expected: `Test Files 1 passed (1)`, `Tests 5 passed (5)`.

- [ ] **Step 6: `manage-categories.ts` - import the solid `faTrashCan` under an alias and pass it as `okIcon`**

Current import line (12-13):

```ts
import { faEdit, faTrashCan } from '@fortawesome/free-regular-svg-icons';
import { faCheck, faX, faXmark } from '@fortawesome/free-solid-svg-icons';
```

Replace with:

```ts
import { faEdit, faTrashCan } from '@fortawesome/free-regular-svg-icons';
import {
  faCheck,
  faTrashCan as faTrashCanSolid,
  faX,
  faXmark,
} from '@fortawesome/free-solid-svg-icons';
```

Current `delete()` method's `confirm()` call (lines 184-191):

```ts
const confirmed = await this.confirmService.confirm(
  'components.modals.manage-categories.delete-confirm.title',
  {
    text: 'components.modals.manage-categories.delete-confirm.message',
    data: { name: item.name, count },
  },
  'general.button.delete',
);
```

Replace with:

```ts
const confirmed = await this.confirmService.confirm(
  'components.modals.manage-categories.delete-confirm.title',
  {
    text: 'components.modals.manage-categories.delete-confirm.message',
    data: { name: item.name, count },
  },
  'general.button.delete',
  undefined,
  undefined,
  faTrashCanSolid,
);
```

- [ ] **Step 7: Update `manage-categories.spec.ts`'s assertion to match the new call signature**

Current test (lines 170-177):

```ts
it('should pass the torrent count to the confirm dialog', async () => {
  const linux = component.categories()[0];
  await component.delete(linux);
  expect(mockConfirmService.confirm).toHaveBeenCalledWith(
    expect.any(String),
    expect.objectContaining({ data: { name: 'linux', count: 2 } }),
    expect.any(String),
  );
});
```

Replace with:

```ts
it('should pass the torrent count to the confirm dialog', async () => {
  const linux = component.categories()[0];
  await component.delete(linux);
  expect(mockConfirmService.confirm).toHaveBeenCalledWith(
    expect.any(String),
    expect.objectContaining({ data: { name: 'linux', count: 2 } }),
    expect.any(String),
    undefined,
    undefined,
    faTrashCan,
  );
});
```

Add the import at the top of `manage-categories.spec.ts`. Current (line 1):

```ts
import { signal } from '@angular/core';
```

Replace with:

```ts
import { signal } from '@angular/core';
import { faTrashCan } from '@fortawesome/free-solid-svg-icons';
```

- [ ] **Step 8: Run `manage-categories`'s tests to verify they pass**

Run (from `packages/app`):

```bash
npx ng test --include="**/manage-categories.spec.ts" --watch=false
```

Expected: `Test Files 1 passed (1)`, `Tests 26 passed (26)`.

- [ ] **Step 9: Commit**

```bash
git add packages/app/src/app/components/modals/manage-tags/manage-tags.ts packages/app/src/app/components/modals/manage-tags/manage-tags.spec.ts packages/app/src/app/components/modals/manage-servers/manage-servers.ts packages/app/src/app/components/modals/manage-categories/manage-categories.ts packages/app/src/app/components/modals/manage-categories/manage-categories.spec.ts
git commit -m "#180: pass faTrashCan okIcon for destructive Confirm callers"
```

---

### Task 4: `delete-torrent` - Delete and Cancel buttons

**Files:**

- Modify: `packages/app/src/app/components/modals/delete-torrent/delete-torrent.ts:1-21`
- Modify: `packages/app/src/app/components/modals/delete-torrent/delete-torrent.html:39-46`

**Interfaces:**

- Consumes: `BbBtnContent`/`.btn-split` from Phase 0 - independent of Tasks 1-3.
- Produces: nothing consumed by later tasks.

- [ ] **Step 1: Update `delete-torrent.ts`'s icon imports, `imports` array, and add an `icons` object**

Current (lines 1-21):

```ts
import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, computed, inject, input } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { TranslatePipe } from '@ngx-translate/core';
import { AutofocusDirective } from '../../../directives/autofocus';
import { FilesizePipe } from '../../../pipes/filesize-pipe';
import { SelectionStoreService } from '../../../services/selection-store.service';

@Component({
  selector: 'app-delete-torrent',
  standalone: true,
  imports: [ReactiveFormsModule, CommonModule, AutofocusDirective, TranslatePipe, FilesizePipe],
  templateUrl: './delete-torrent.html',
  styleUrl: './delete-torrent.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DeleteTorrent implements OnInit {
  readonly defaultRemoveFiles = input(false);
  private readonly activeModal = inject(NgbActiveModal);

  private readonly selectionStore = inject(SelectionStoreService);
```

Replace with:

```ts
import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, computed, inject, input } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { faTrashCan, faXmark } from '@fortawesome/free-solid-svg-icons';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { TranslatePipe } from '@ngx-translate/core';
import { AutofocusDirective } from '../../../directives/autofocus';
import { FilesizePipe } from '../../../pipes/filesize-pipe';
import { SelectionStoreService } from '../../../services/selection-store.service';
import { BbBtnContent } from '../../bb-btn-content/bb-btn-content';

@Component({
  selector: 'app-delete-torrent',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    CommonModule,
    AutofocusDirective,
    TranslatePipe,
    FilesizePipe,
    BbBtnContent,
  ],
  templateUrl: './delete-torrent.html',
  styleUrl: './delete-torrent.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DeleteTorrent implements OnInit {
  readonly defaultRemoveFiles = input(false);
  private readonly activeModal = inject(NgbActiveModal);

  private readonly selectionStore = inject(SelectionStoreService);

  public icons = { faTrashCan, faXmark };
```

- [ ] **Step 2: Update `delete-torrent.html`'s footer markup**

Current (lines 39-46):

```html
<div class="modal-footer">
  <button type="button" class="btn btn-danger" (click)="closeModal()" autofocus>
    {{ 'general.button.delete' | translate }}
  </button>
  <button type="button" class="btn btn-link" (click)="dismissModal()">
    {{ 'general.button.cancel' | translate }}
  </button>
</div>
```

Replace with:

```html
<div class="modal-footer">
  <button type="button" class="btn btn-danger btn-split" (click)="closeModal()" autofocus>
    <bb-btn-content
      [icon]="icons.faTrashCan"
      [text]="'general.button.delete' | translate"
    ></bb-btn-content>
  </button>
  <button type="button" class="btn btn-link btn-split" (click)="dismissModal()">
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
npx ng test --include="**/delete-torrent.spec.ts" --watch=false
```

Expected: `Test Files 1 passed (1)`, `Tests 5 passed (5)`.

- [ ] **Step 4: Commit**

```bash
git add packages/app/src/app/components/modals/delete-torrent/delete-torrent.ts packages/app/src/app/components/modals/delete-torrent/delete-torrent.html
git commit -m "#180: retrofit delete-torrent modal buttons to split-button style"
```

---

### Task 5: `torrent-exists` - Delete Torrent File, Open Details, and Close buttons

**Files:**

- Modify: `packages/app/src/app/components/modals/torrent-exists/torrent-exists.ts:1-61`
- Modify: `packages/app/src/app/components/modals/torrent-exists/torrent-exists.html:102-119`

**Interfaces:**

- Consumes: `BbBtnContent`/`.btn-split` from Phase 0 - independent of Tasks 1-4. This is the last task of Phase 3.
- Produces: nothing consumed by later tasks.

- [ ] **Step 1: Update `torrent-exists.ts`'s icon imports, `imports` array, and add an `icons` object**

Current (lines 1-61):

```ts
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  signal,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NgbActiveModal, NgbTooltip } from '@ng-bootstrap/ng-bootstrap';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { TimeagoPipe } from 'ngx-timeago';
import { AutofocusDirective } from '../../../directives/autofocus';
import { TooltipOverflow } from '../../../directives/tooltip-overflow';
import { FilesizePipe } from '../../../pipes/filesize-pipe';
import { LocalTimestampPipe } from '../../../pipes/local-timestamp-pipe';
import { RatioPipe } from '../../../pipes/ratio-pipe';
import { CommandBusService } from '../../../services/command-bus.service';
import { FilterService } from '../../../services/filter.service';
import { GeneralSettingsService } from '../../../services/general-settings.service';
import { SelectionStoreService } from '../../../services/selection-store.service';
import { ToastService } from '../../../services/toast.service';
import { TorrentStoreService } from '../../../services/torrent-store.service';
import { BbProgress } from '../../bb-progress/bb-progress';

@Component({
  selector: 'app-torrent-exists',
  standalone: true,
  imports: [
    LocalTimestampPipe,
    FilesizePipe,
    RatioPipe,
    AutofocusDirective,
    TooltipOverflow,
    TimeagoPipe,
    NgbTooltip,
    TranslatePipe,
    BbProgress,
  ],
  styleUrls: ['./torrent-exists.scss'],
  templateUrl: './torrent-exists.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TorrentExists {
  readonly hash = input<string | null>(null);
  readonly originalPath = input<string | null>(null);

  private readonly torrentStoreService = inject(TorrentStoreService);
  private readonly activeModal = inject(NgbActiveModal);
  private readonly selectionStoreService = inject(SelectionStoreService);
  private readonly filterService = inject(FilterService);
  private readonly commandBusService = inject(CommandBusService);
  private readonly generalSettingsService = inject(GeneralSettingsService);
  private readonly toastService = inject(ToastService);
  private readonly translateService = inject(TranslateService);
  private readonly generalSettings = toSignal(this.generalSettingsService.asObservable(), {
    initialValue: null,
  });

  public readonly fileDeleted = signal(false);
```

Replace with:

```ts
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  signal,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { faCircleInfo, faTrashCan, faXmark } from '@fortawesome/free-solid-svg-icons';
import { NgbActiveModal, NgbTooltip } from '@ng-bootstrap/ng-bootstrap';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { TimeagoPipe } from 'ngx-timeago';
import { AutofocusDirective } from '../../../directives/autofocus';
import { TooltipOverflow } from '../../../directives/tooltip-overflow';
import { FilesizePipe } from '../../../pipes/filesize-pipe';
import { LocalTimestampPipe } from '../../../pipes/local-timestamp-pipe';
import { RatioPipe } from '../../../pipes/ratio-pipe';
import { CommandBusService } from '../../../services/command-bus.service';
import { FilterService } from '../../../services/filter.service';
import { GeneralSettingsService } from '../../../services/general-settings.service';
import { SelectionStoreService } from '../../../services/selection-store.service';
import { ToastService } from '../../../services/toast.service';
import { TorrentStoreService } from '../../../services/torrent-store.service';
import { BbBtnContent } from '../../bb-btn-content/bb-btn-content';
import { BbProgress } from '../../bb-progress/bb-progress';

@Component({
  selector: 'app-torrent-exists',
  standalone: true,
  imports: [
    LocalTimestampPipe,
    FilesizePipe,
    RatioPipe,
    AutofocusDirective,
    TooltipOverflow,
    TimeagoPipe,
    NgbTooltip,
    TranslatePipe,
    BbProgress,
    BbBtnContent,
  ],
  styleUrls: ['./torrent-exists.scss'],
  templateUrl: './torrent-exists.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TorrentExists {
  readonly hash = input<string | null>(null);
  readonly originalPath = input<string | null>(null);

  private readonly torrentStoreService = inject(TorrentStoreService);
  private readonly activeModal = inject(NgbActiveModal);
  private readonly selectionStoreService = inject(SelectionStoreService);
  private readonly filterService = inject(FilterService);
  private readonly commandBusService = inject(CommandBusService);
  private readonly generalSettingsService = inject(GeneralSettingsService);
  private readonly toastService = inject(ToastService);
  private readonly translateService = inject(TranslateService);
  private readonly generalSettings = toSignal(this.generalSettingsService.asObservable(), {
    initialValue: null,
  });

  public icons = { faCircleInfo, faTrashCan, faXmark };

  public readonly fileDeleted = signal(false);
```

- [ ] **Step 2: Update `torrent-exists.html`'s footer markup**

Current (lines 102-119):

```html
<div class="modal-footer">
  @if (showDeleteButton()) {
  <button
    type="button"
    class="btn btn-danger"
    [disabled]="fileDeleted()"
    (click)="deleteTorrentFile()"
  >
    {{ 'components.modals.torrent-exists.button.delete-file' | translate }}
  </button>
  }
  <button type="button" class="btn btn-dashed-secondary" (click)="openDetails()" autofocus>
    {{ 'general.button.open-details' | translate }}
  </button>
  <button type="button" class="btn btn-link" (click)="closeModal()">
    {{ 'general.button.close' | translate }}
  </button>
</div>
```

Replace with:

```html
<div class="modal-footer">
  @if (showDeleteButton()) {
  <button
    type="button"
    class="btn btn-danger btn-split"
    [disabled]="fileDeleted()"
    (click)="deleteTorrentFile()"
  >
    <bb-btn-content
      [icon]="icons.faTrashCan"
      [text]="'components.modals.torrent-exists.button.delete-file' | translate"
    ></bb-btn-content>
  </button>
  }
  <button
    type="button"
    class="btn btn-dashed-secondary btn-split"
    (click)="openDetails()"
    autofocus
  >
    <bb-btn-content
      [icon]="icons.faCircleInfo"
      [text]="'general.button.open-details' | translate"
    ></bb-btn-content>
  </button>
  <button type="button" class="btn btn-link btn-split" (click)="closeModal()">
    <bb-btn-content
      [icon]="icons.faXmark"
      [text]="'general.button.close' | translate"
    ></bb-btn-content>
  </button>
</div>
```

- [ ] **Step 3: Run the existing spec to confirm no regressions**

Run (from `packages/app`):

```bash
npx ng test --include="**/torrent-exists.spec.ts" --watch=false
```

Expected: `Test Files 1 passed (1)`, `Tests 15 passed (15)`.

- [ ] **Step 4: Commit**

```bash
git add packages/app/src/app/components/modals/torrent-exists/torrent-exists.ts packages/app/src/app/components/modals/torrent-exists/torrent-exists.html
git commit -m "#180: retrofit torrent-exists modal buttons to split-button style"
```

---

## Self-Review Notes

- **Spec coverage:** covers the Phase 3 row of the design spec's rollout table (`confirm`, `delete-torrent`, `torrent-exists`) and the "Confirm component" section of the Icon & translation conventions in full. Button count: `confirm` (2) + `delete-torrent` (2) + `torrent-exists` (3, including the conditional Delete Torrent File button) = 7, close to the spec's "~6" estimate (an approximate figure in the spec itself). All 9 existing `ConfirmService.confirm()` callers were enumerated and audited (3 changed, 6 explicitly left on defaults) - satisfies "every existing caller... gets audited."
- **Placeholder scan:** none - all five tasks contain complete before/after code for every file touched, including the two spec-assertion updates in Task 3.
- **Type consistency:** `Confirm.okIcon`/`cancelIcon` are `input<IconDefinition>(...)`, matching `BbBtnContent`'s own `icon: input.required<IconDefinition>()` type and the `IconDefinition` import source (`@fortawesome/fontawesome-svg-core`) used consistently in `confirm.ts`, `confirm.service.ts`, and throughout Phases 0-2. `ConfirmService.confirm()`'s new `okIcon` parameter type and default (`faCheck`) match `Confirm`'s own input default exactly.
- **Backward compatibility verified:** `ConfirmService.confirm()`'s existing 5-parameter shape is unchanged in position and meaning - the new `okIcon` is appended as a 6th parameter, so the existing `'should use provided dialog size'` test (`confirm('T', 'M', undefined, undefined, 'lg')`) continues to pass unmodified, and none of the 6 non-destructive callers need any change.
- **Caller audit completeness double-checked:** grepped `confirmService\.confirm(` across `packages/app/src/app` and accounted for all 9 results by file:line in the Global Constraints section above - 3 get the new `okIcon` argument, 6 are named explicitly as intentionally unchanged.
