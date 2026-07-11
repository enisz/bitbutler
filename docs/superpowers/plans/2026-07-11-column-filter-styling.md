# Column Filter Styling Overhaul Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restyle the four ag-grid column filter popovers (text, number, size, set) to use floating-label `ng-select`/`input` controls, full-width stacked buttons, a wider popover, dropdown panels that escape the grid's clipping container, and — for the set filter that backs tags/categories/states — a clickable list-group with sidebar-matching badge colors.

**Architecture:** Pure template/style rework of four existing standalone Angular components under `packages/app/src/app/components/column-filters/`. No filter-matching logic, `getModel`/`setModel`, or `doesFilterPass` behavior changes. A tiny new shared utility generates unique per-instance DOM id prefixes so floating-label `<label for>` / checkbox `id` pairs don't collide when ag-grid keeps multiple filter component instances mounted (e.g. the `state` source is used by two different grid columns).

**Tech Stack:** Angular 20 (standalone components, signals), Bootstrap 5 floating-label CSS (already themed in `packages/app/src/styles.scss`), `@ng-select/ng-select`, `@ngx-translate/core`, Vitest (`@angular/build:unit-test` runner).

## Global Constraints

- Popover `min-width`: **360px** on `.bb-column-filter` (text/number/size) and `.bb-set-filter` (set).
- Every `<ng-select>` gets a static `appendTo="body"` attribute.
- Every `<ng-select>` and every plain `<input>` is wrapped in `.form-floating` with a matching `<label for>` — reuse the global `.form-floating` CSS already in `packages/app/src/styles.scss`; do not add new global CSS.
- Floating inputs use `class="form-control"` (never `form-control-sm`) — floating labels don't support the `-sm` size variant.
- Clear/Apply buttons stack vertically, each full width (`w-100`), Clear first with `mb-2`, then Apply. Keep the existing `btn-sm` sizing — only the layout changes, not the button size.
- No changes to `doesFilterPass`, `getModel`, `setModel`, `agInit`, or any other behavioral/logic code.
- No changes to `datepicker-range-filter` or to `packages/app/src/app/pages/main/status/filter-group/*` (the sidebar component) — only the set filter's own copy of the badge styling changes.
- Translation keys are added to **both** `public/i18n/us.json` and `public/i18n/hu.json`.

---

### Task 1: Shared filter-instance-id utility

**Files:**

- Create: `packages/app/src/app/components/column-filters/filter-instance-id.utils.ts`
- Test: `packages/app/src/app/components/column-filters/filter-instance-id.utils.spec.ts`

**Interfaces:**

- Produces: `createFilterInstanceId(prefix: string): string` — returns `` `${prefix}-${n}` `` where `n` is a module-level counter that increments on every call (shared across all callers, regardless of prefix). Tasks 3-6 import and call this once per component instance to build unique `id`/`for` attribute values.

- [ ] **Step 1: Write the failing test**

Create `packages/app/src/app/components/column-filters/filter-instance-id.utils.spec.ts`:

```typescript
import { createFilterInstanceId } from './filter-instance-id.utils';

describe('createFilterInstanceId', () => {
  it('prefixes the returned id with the given prefix', () => {
    expect(createFilterInstanceId('text-filter')).toMatch(/^text-filter-\d+$/);
  });

  it('returns a different id on every call, even with the same prefix', () => {
    const first = createFilterInstanceId('set-filter');
    const second = createFilterInstanceId('set-filter');
    expect(first).not.toBe(second);
  });

  it('shares one counter across different prefixes so ids never collide', () => {
    const a = createFilterInstanceId('text-filter');
    const b = createFilterInstanceId('number-filter');
    expect(a).not.toBe(b);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test --workspace=@bitbutler/app`
Expected: FAIL — `Cannot find module './filter-instance-id.utils'` (or similar resolution error), because the module doesn't exist yet.

- [ ] **Step 3: Write minimal implementation**

Create `packages/app/src/app/components/column-filters/filter-instance-id.utils.ts`:

```typescript
let nextInstanceId = 0;

export function createFilterInstanceId(prefix: string): string {
  return `${prefix}-${nextInstanceId++}`;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test --workspace=@bitbutler/app`
Expected: PASS — all three `createFilterInstanceId` tests green.

- [ ] **Step 5: Commit**

```bash
git add packages/app/src/app/components/column-filters/filter-instance-id.utils.ts packages/app/src/app/components/column-filters/filter-instance-id.utils.spec.ts
git commit -m "#216: add createFilterInstanceId utility for unique filter DOM ids"
```

---

### Task 2: Add "Operator" and "Unit" translation keys

**Files:**

- Modify: `public/i18n/us.json:1029-1033`
- Modify: `public/i18n/hu.json:1029-1033`

**Interfaces:**

- Produces: translation keys `components.column-filters.label.operator` and `components.column-filters.label.unit`, consumed by Tasks 3, 4, and 5.

- [ ] **Step 1: Add the new keys to `public/i18n/us.json`**

Find this block (around line 1029):

```json
      "label": {
        "value": "Value",
        "from": "From",
        "to": "To"
      },
```

Replace with:

```json
      "label": {
        "value": "Value",
        "from": "From",
        "to": "To",
        "operator": "Operator",
        "unit": "Unit"
      },
```

- [ ] **Step 2: Add the new keys to `public/i18n/hu.json`**

Find this block (around line 1029):

```json
      "label": {
        "value": "Érték",
        "from": "Ettől",
        "to": "Eddig"
      },
```

Replace with:

```json
      "label": {
        "value": "Érték",
        "from": "Ettől",
        "to": "Eddig",
        "operator": "Operátor",
        "unit": "Mértékegység"
      },
```

- [ ] **Step 3: Verify both files are still valid JSON**

Run: `node -e "JSON.parse(require('fs').readFileSync('public/i18n/us.json')); JSON.parse(require('fs').readFileSync('public/i18n/hu.json')); console.log('valid')"`
Expected: prints `valid` with no errors.

- [ ] **Step 4: Commit**

```bash
git add public/i18n/us.json public/i18n/hu.json
git commit -m "#216: add operator and unit translation labels for column filters"
```

---

### Task 3: Restyle `text-column-filter`

**Files:**

- Modify: `packages/app/src/app/components/column-filters/text-column-filter/text-column-filter.ts`
- Modify: `packages/app/src/app/components/column-filters/text-column-filter/text-column-filter.html`
- Modify: `packages/app/src/app/components/column-filters/text-column-filter/text-column-filter.scss`

**Interfaces:**

- Consumes: `createFilterInstanceId(prefix: string): string` from `../filter-instance-id.utils` (Task 1).

- [ ] **Step 1: Add the instance id field to `text-column-filter.ts`**

In `packages/app/src/app/components/column-filters/text-column-filter/text-column-filter.ts`, add the import next to the other relative imports:

```typescript
import { BbBtnContent } from '../../bb-btn-content/bb-btn-content';
import { createFilterInstanceId } from '../filter-instance-id.utils';
import { OperatorFilterBase } from '../operator-filter-base';
```

Add the field right after the `icons` field:

```typescript
  public readonly icons = { faCheck, faEraser };
  public readonly instanceId = createFilterInstanceId('text-filter');
```

- [ ] **Step 2: Rewrite `text-column-filter.html`**

Replace the full contents of `packages/app/src/app/components/column-filters/text-column-filter/text-column-filter.html` with:

```html
<div
  class="bb-column-filter p-2"
  (mousedown)="$event.stopPropagation()"
  (touchstart)="$event.stopPropagation()"
>
  <div class="form-floating mb-2">
    <ng-select
      [id]="instanceId + '-operator'"
      [items]="operatorItems()"
      bindLabel="label"
      bindValue="value"
      [clearable]="false"
      [searchable]="false"
      [(ngModel)]="draft.operator"
      appendTo="body"
    ></ng-select>
    <label [for]="instanceId + '-operator'"
      >{{ 'components.column-filters.label.operator' | translate }}</label
    >
  </div>

  <div class="form-floating mb-2">
    <input
      type="text"
      class="form-control"
      [id]="instanceId + '-value'"
      [(ngModel)]="draft.value"
      [disabled]="isValueDisabled()"
      [placeholder]="'components.column-filters.label.value' | translate"
    />
    <label [for]="instanceId + '-value'"
      >{{ 'components.column-filters.label.value' | translate }}</label
    >
  </div>

  <button
    class="btn btn-sm btn-outline-secondary btn-split w-100 mb-2"
    type="button"
    (click)="clear()"
  >
    <bb-btn-content
      [icon]="icons.faEraser"
      [text]="'general.button.clear' | translate"
      [position]="'end'"
    ></bb-btn-content>
  </button>
  <button
    class="btn btn-sm btn-outline-primary btn-split w-100"
    type="button"
    [disabled]="isApplyDisabled()"
    (click)="apply()"
  >
    <bb-btn-content
      [icon]="icons.faCheck"
      [text]="'general.button.apply' | translate"
      [position]="'end'"
    ></bb-btn-content>
  </button>
</div>
```

- [ ] **Step 3: Widen the popover in `text-column-filter.scss`**

Replace the full contents of `packages/app/src/app/components/column-filters/text-column-filter/text-column-filter.scss` with:

```scss
:host {
  display: block;
}

.bb-column-filter {
  min-width: 360px;
}
```

- [ ] **Step 4: Run the existing spec to confirm no regression**

Run: `npm run test --workspace=@bitbutler/app`
Expected: PASS — `text-column-filter.spec.ts` tests are logic-only and remain green; they don't assert on DOM structure.

- [ ] **Step 5: Run lint**

Run: `npm run lint`
Expected: PASS — 0 warnings/errors.

- [ ] **Step 6: Manually verify in the running app**

Run: `npm start`, open the torrent grid, click the filter icon on a text column (e.g. "Name"). Confirm: the popover is ~360px wide, the operator select shows a floating "Operator" label, the value input shows a floating "Value" label (or "From"/"To" wording doesn't apply here), the dropdown panel isn't clipped by the grid, and Clear/Apply are stacked full-width buttons.

- [ ] **Step 7: Commit**

```bash
git add packages/app/src/app/components/column-filters/text-column-filter/text-column-filter.ts packages/app/src/app/components/column-filters/text-column-filter/text-column-filter.html packages/app/src/app/components/column-filters/text-column-filter/text-column-filter.scss
git commit -m "#216: restyle text-column-filter with floating labels and stacked buttons"
```

---

### Task 4: Restyle `number-column-filter`

**Files:**

- Modify: `packages/app/src/app/components/column-filters/number-column-filter/number-column-filter.ts`
- Modify: `packages/app/src/app/components/column-filters/number-column-filter/number-column-filter.html`
- Modify: `packages/app/src/app/components/column-filters/number-column-filter/number-column-filter.scss`

**Interfaces:**

- Consumes: `createFilterInstanceId(prefix: string): string` from `../filter-instance-id.utils` (Task 1).

- [ ] **Step 1: Add the instance id field to `number-column-filter.ts`**

In `packages/app/src/app/components/column-filters/number-column-filter/number-column-filter.ts`, add the import:

```typescript
import { BbBtnContent } from '../../bb-btn-content/bb-btn-content';
import { createFilterInstanceId } from '../filter-instance-id.utils';
import { OperatorFilterBase } from '../operator-filter-base';
```

Add the field right after the `icons` field:

```typescript
  public readonly icons = { faCheck, faEraser };
  public readonly instanceId = createFilterInstanceId('number-filter');
```

- [ ] **Step 2: Rewrite `number-column-filter.html`**

Replace the full contents of `packages/app/src/app/components/column-filters/number-column-filter/number-column-filter.html` with:

```html
<div
  class="bb-column-filter p-2"
  (mousedown)="$event.stopPropagation()"
  (touchstart)="$event.stopPropagation()"
>
  <div class="form-floating mb-2">
    <ng-select
      [id]="instanceId + '-operator'"
      [items]="operatorItems()"
      bindLabel="label"
      bindValue="value"
      [clearable]="false"
      [searchable]="false"
      [(ngModel)]="draft.operator"
      appendTo="body"
    ></ng-select>
    <label [for]="instanceId + '-operator'"
      >{{ 'components.column-filters.label.operator' | translate }}</label
    >
  </div>

  <div class="d-flex gap-2 mb-2">
    <div class="form-floating flex-fill">
      <input
        type="number"
        class="form-control"
        [id]="instanceId + '-from'"
        [(ngModel)]="draft.from"
        [disabled]="isInputDisabled()"
        [placeholder]="
          draft.operator === 'between'
            ? ('components.column-filters.label.from' | translate)
            : ('components.column-filters.label.value' | translate)
        "
      />
      <label [for]="instanceId + '-from'"
        >{{ (draft.operator === 'between' ? 'components.column-filters.label.from' :
        'components.column-filters.label.value' ) | translate }}</label
      >
    </div>
    @if (draft.operator === 'between') {
    <div class="form-floating flex-fill">
      <input
        type="number"
        class="form-control"
        [id]="instanceId + '-to'"
        [(ngModel)]="draft.to"
        [disabled]="isInputDisabled()"
        [placeholder]="'components.column-filters.label.to' | translate"
      />
      <label [for]="instanceId + '-to'"
        >{{ 'components.column-filters.label.to' | translate }}</label
      >
    </div>
    }
  </div>

  <button
    class="btn btn-sm btn-outline-secondary btn-split w-100 mb-2"
    type="button"
    (click)="clear()"
  >
    <bb-btn-content
      [icon]="icons.faEraser"
      [text]="'general.button.clear' | translate"
      [position]="'end'"
    ></bb-btn-content>
  </button>
  <button
    class="btn btn-sm btn-outline-primary btn-split w-100"
    type="button"
    [disabled]="isApplyDisabled()"
    (click)="apply()"
  >
    <bb-btn-content
      [icon]="icons.faCheck"
      [text]="'general.button.apply' | translate"
      [position]="'end'"
    ></bb-btn-content>
  </button>
</div>
```

- [ ] **Step 3: Widen the popover in `number-column-filter.scss`**

Replace the full contents of `packages/app/src/app/components/column-filters/number-column-filter/number-column-filter.scss` with:

```scss
:host {
  display: block;
}

.bb-column-filter {
  min-width: 360px;
}
```

- [ ] **Step 4: Run the existing spec to confirm no regression**

Run: `npm run test --workspace=@bitbutler/app`
Expected: PASS — `number-column-filter.spec.ts` tests are logic-only and remain green.

- [ ] **Step 5: Run lint**

Run: `npm run lint`
Expected: PASS — 0 warnings/errors.

- [ ] **Step 6: Manually verify in the running app**

Run: `npm start`, open the filter on a numeric column (e.g. "Seeds"). Confirm the operator select floats correctly, the From input floats "Value" when operator isn't "between" and "From" when it is, switching to "Between" reveals a second floating "To" input beside it, and Clear/Apply are stacked full-width.

- [ ] **Step 7: Commit**

```bash
git add packages/app/src/app/components/column-filters/number-column-filter/number-column-filter.ts packages/app/src/app/components/column-filters/number-column-filter/number-column-filter.html packages/app/src/app/components/column-filters/number-column-filter/number-column-filter.scss
git commit -m "#216: restyle number-column-filter with floating labels and stacked buttons"
```

---

### Task 5: Restyle `size-column-filter`

**Files:**

- Modify: `packages/app/src/app/components/column-filters/size-column-filter/size-column-filter.ts`
- Modify: `packages/app/src/app/components/column-filters/size-column-filter/size-column-filter.html`
- Modify: `packages/app/src/app/components/column-filters/size-column-filter/size-column-filter.scss`

**Interfaces:**

- Consumes: `createFilterInstanceId(prefix: string): string` from `../filter-instance-id.utils` (Task 1).

- [ ] **Step 1: Add the instance id field to `size-column-filter.ts`**

In `packages/app/src/app/components/column-filters/size-column-filter/size-column-filter.ts`, add the import:

```typescript
import { BbBtnContent } from '../../bb-btn-content/bb-btn-content';
import { createFilterInstanceId } from '../filter-instance-id.utils';
import { OperatorFilterBase } from '../operator-filter-base';
```

Add the field right after the `unitItems` field:

```typescript
  public readonly unitItems: { value: SizeUnit; label: string }[] = [
    { value: 'B', label: 'B' },
    { value: 'KB', label: 'KB' },
    { value: 'MB', label: 'MB' },
    { value: 'GB', label: 'GB' },
    { value: 'TB', label: 'TB' },
  ];
  public readonly instanceId = createFilterInstanceId('size-filter');
```

- [ ] **Step 2: Rewrite `size-column-filter.html`**

Replace the full contents of `packages/app/src/app/components/column-filters/size-column-filter/size-column-filter.html` with:

```html
<div
  class="bb-column-filter p-2"
  (mousedown)="$event.stopPropagation()"
  (touchstart)="$event.stopPropagation()"
>
  <div class="form-floating mb-2">
    <ng-select
      [id]="instanceId + '-operator'"
      [items]="operatorItems()"
      bindLabel="label"
      bindValue="value"
      [clearable]="false"
      [searchable]="false"
      [(ngModel)]="draft.operator"
      appendTo="body"
    ></ng-select>
    <label [for]="instanceId + '-operator'"
      >{{ 'components.column-filters.label.operator' | translate }}</label
    >
  </div>

  <div class="form-floating mb-2">
    <ng-select
      [id]="instanceId + '-unit'"
      [items]="unitItems"
      bindLabel="label"
      bindValue="value"
      [clearable]="false"
      [searchable]="false"
      [(ngModel)]="draft.unit"
      appendTo="body"
    ></ng-select>
    <label [for]="instanceId + '-unit'"
      >{{ 'components.column-filters.label.unit' | translate }}</label
    >
  </div>

  <div class="d-flex gap-2 mb-2">
    <div class="form-floating flex-fill">
      <input
        type="number"
        class="form-control"
        [id]="instanceId + '-from'"
        [(ngModel)]="draft.from"
        [disabled]="isInputDisabled()"
        [placeholder]="
          draft.operator === 'between'
            ? ('components.column-filters.label.from' | translate)
            : ('components.column-filters.label.value' | translate)
        "
      />
      <label [for]="instanceId + '-from'"
        >{{ (draft.operator === 'between' ? 'components.column-filters.label.from' :
        'components.column-filters.label.value' ) | translate }}</label
      >
    </div>
    @if (draft.operator === 'between') {
    <div class="form-floating flex-fill">
      <input
        type="number"
        class="form-control"
        [id]="instanceId + '-to'"
        [(ngModel)]="draft.to"
        [disabled]="isInputDisabled()"
        [placeholder]="'components.column-filters.label.to' | translate"
      />
      <label [for]="instanceId + '-to'"
        >{{ 'components.column-filters.label.to' | translate }}</label
      >
    </div>
    }
  </div>

  <button
    class="btn btn-sm btn-outline-secondary btn-split w-100 mb-2"
    type="button"
    (click)="clear()"
  >
    <bb-btn-content
      [icon]="icons.faEraser"
      [text]="'general.button.clear' | translate"
      [position]="'end'"
    ></bb-btn-content>
  </button>
  <button
    class="btn btn-sm btn-outline-primary btn-split w-100"
    type="button"
    [disabled]="isApplyDisabled()"
    (click)="apply()"
  >
    <bb-btn-content
      [icon]="icons.faCheck"
      [text]="'general.button.apply' | translate"
      [position]="'end'"
    ></bb-btn-content>
  </button>
</div>
```

- [ ] **Step 3: Widen the popover in `size-column-filter.scss`**

Replace the full contents of `packages/app/src/app/components/column-filters/size-column-filter/size-column-filter.scss` with:

```scss
:host {
  display: block;
}

.bb-column-filter {
  min-width: 360px;
}
```

- [ ] **Step 4: Run the existing spec to confirm no regression**

Run: `npm run test --workspace=@bitbutler/app`
Expected: PASS — `size-column-filter.spec.ts` tests are logic-only and remain green.

- [ ] **Step 5: Run lint**

Run: `npm run lint`
Expected: PASS — 0 warnings/errors.

- [ ] **Step 6: Manually verify in the running app**

Run: `npm start`, open the filter on a size column (e.g. "Size"). Confirm both the operator and unit selects float their labels correctly, dropdowns aren't clipped, from/to inputs behave as in Task 4, and buttons are stacked full-width.

- [ ] **Step 7: Commit**

```bash
git add packages/app/src/app/components/column-filters/size-column-filter/size-column-filter.ts packages/app/src/app/components/column-filters/size-column-filter/size-column-filter.html packages/app/src/app/components/column-filters/size-column-filter/size-column-filter.scss
git commit -m "#216: restyle size-column-filter with floating labels and stacked buttons"
```

---

### Task 6: Restyle `set-column-filter` (tags/categories/states)

**Files:**

- Modify: `packages/app/src/app/components/column-filters/set-column-filter/set-column-filter.ts`
- Modify: `packages/app/src/app/components/column-filters/set-column-filter/set-column-filter.html`
- Modify: `packages/app/src/app/components/column-filters/set-column-filter/set-column-filter.scss`

**Interfaces:**

- Consumes: `createFilterInstanceId(prefix: string): string` from `../filter-instance-id.utils` (Task 1).

- [ ] **Step 1: Add the instance id field to `set-column-filter.ts`**

In `packages/app/src/app/components/column-filters/set-column-filter/set-column-filter.ts`, add the import:

```typescript
import { TorrentStoreService, ValueCount } from '../../../services/torrent-store.service';
import { BbBtnContent } from '../../bb-btn-content/bb-btn-content';
import { createFilterInstanceId } from '../filter-instance-id.utils';
```

Add the field right after the `filterCtrl` field:

```typescript
  public readonly icons = { faCheck, faEraser, faXmark };
  public filterCtrl = new FormControl('', { nonNullable: true });
  public readonly instanceId = createFilterInstanceId('set-filter');
```

- [ ] **Step 2: Rewrite `set-column-filter.html`**

Replace the full contents of `packages/app/src/app/components/column-filters/set-column-filter/set-column-filter.html` with:

```html
<div
  class="bb-set-filter p-2"
  (mousedown)="$event.stopPropagation()"
  (touchstart)="$event.stopPropagation()"
>
  <div class="form-floating bb-filter-input mb-2">
    <input
      type="text"
      class="form-control"
      [id]="instanceId + '-search'"
      [placeholder]="'components.column-filters.set.filter-placeholder' | translate"
      [formControl]="filterCtrl"
    />
    <label [for]="instanceId + '-search'"
      >{{ 'components.column-filters.set.filter-placeholder' | translate }}</label
    >
    @if (filterCtrl.value) {
    <button
      type="button"
      class="bb-filter-clear"
      (click)="filterCtrl.reset('')"
      [attr.aria-label]="'general.button.clear' | translate"
    >
      <fa-icon [icon]="icons.faXmark"></fa-icon>
    </button>
    }
  </div>

  <div class="bb-set-filter-list list-group list-group-flush mb-2">
    @for (item of filteredItems(); track item.key) {
    <label
      class="list-group-item list-group-item-action d-flex align-items-center gap-2"
      [class.active]="draftValues.has(item.key)"
      [for]="instanceId + '-' + item.key"
    >
      <input
        class="form-check-input mt-0 flex-shrink-0"
        type="checkbox"
        [id]="instanceId + '-' + item.key"
        [checked]="draftValues.has(item.key)"
        (change)="toggle(item.key)"
      />
      <span class="text-truncate flex-grow-1">{{ item.label }}</span>
      <span class="badge bb-status-badge bb-status-badge--neutral">{{ item.count }}</span>
    </label>
    } @empty {
    <div class="text-body-secondary small px-1 py-2">
      {{ 'components.column-filters.set.no-matches' | translate }}
    </div>
    }
  </div>

  <button
    class="btn btn-sm btn-outline-secondary btn-split w-100 mb-2"
    type="button"
    (click)="clear()"
  >
    <bb-btn-content
      [icon]="icons.faEraser"
      [text]="'general.button.clear' | translate"
      [position]="'end'"
    ></bb-btn-content>
  </button>
  <button
    class="btn btn-sm btn-outline-primary btn-split w-100"
    type="button"
    [disabled]="isApplyDisabled()"
    (click)="apply()"
  >
    <bb-btn-content
      [icon]="icons.faCheck"
      [text]="'general.button.apply' | translate"
      [position]="'end'"
    ></bb-btn-content>
  </button>
</div>
```

- [ ] **Step 3: Widen the popover and add list-group/badge styling in `set-column-filter.scss`**

Replace the full contents of `packages/app/src/app/components/column-filters/set-column-filter/set-column-filter.scss` with:

```scss
:host {
  display: block;
}

.bb-set-filter {
  min-width: 360px;
}

.bb-set-filter-list {
  max-height: 240px;
  overflow-y: auto;
}

.list-group-item-action {
  border-color: var(--bs-border-color);
  cursor: pointer;

  &.active {
    background-color: var(--bb-active-list-item-bg);
    color: var(--bs-body-color);
    border-color: var(--bb-active-list-item-bg) !important;

    .bb-status-badge.bb-status-badge--neutral {
      background-color: var(--bb-accent);
      color: var(--bb-primary-ink);
    }
  }

  &:not(.active) {
    .bb-status-badge.bb-status-badge--neutral {
      background-color: var(--bs-tertiary-bg);
      color: var(--bs-emphasis-color);
    }
  }

  .bb-status-badge {
    --bs-badge-font-weight: 600;
    padding: 0.35rem 0.5rem;
  }
}

.list-group {
  --bs-list-group-action-hover-bg: var(--bb-hover-list-item-bg);
}
```

- [ ] **Step 4: Run the existing spec to confirm no regression**

Run: `npm run test --workspace=@bitbutler/app`
Expected: PASS — `set-column-filter.spec.ts` tests are logic-only (they call `component.toggle()`, `component.apply()`, etc. directly) and remain green.

- [ ] **Step 5: Run lint**

Run: `npm run lint`
Expected: PASS — 0 warnings/errors.

- [ ] **Step 6: Manually verify in the running app**

Run: `npm start`, open the filter on the "Category" column, then separately on "Tags" and "State". For each, confirm: the search input floats its label, rows are full-width `list-group-item`s where clicking anywhere on the row (not just the checkbox) toggles it, checked rows get a highlighted background, the count badge sits at the right edge of the row, and the badge text color matches the left sidebar's category/tag/state badges (not white-on-grey). Also open two different columns that share the same `source` (e.g. both columns using `source: 'state'` in `grid.lib.ts`) and confirm checking an item in one doesn't visually affect the other (unique ids didn't collide).

- [ ] **Step 7: Commit**

```bash
git add packages/app/src/app/components/column-filters/set-column-filter/set-column-filter.ts packages/app/src/app/components/column-filters/set-column-filter/set-column-filter.html packages/app/src/app/components/column-filters/set-column-filter/set-column-filter.scss
git commit -m "#216: restyle set-column-filter with list-group rows and sidebar-matching badges"
```

---

### Task 7: Full verification pass

**Files:** none (verification only)

- [ ] **Step 1: Run the full lint suite**

Run: `npm run lint`
Expected: PASS — 0 warnings (project enforces `max-warnings=0`).

- [ ] **Step 2: Run the full test suite**

Run: `npm test`
Expected: PASS — all workspaces, including the four column-filter specs and the new `filter-instance-id.utils.spec.ts`.

- [ ] **Step 3: Run a production Angular build to catch template-compile errors**

Run: `npm run build`
Expected: PASS — no AOT template errors (e.g. mismatched `[for]`/`id` bindings would surface here).

- [ ] **Step 4: Manual QA against the design spec checklist**

Run: `npm start`. Walk through `docs/superpowers/specs/2026-07-11-column-filter-styling-design.md`'s Verification section end to end: open each of the four filter types (text, number, size, set) on the torrent grid and confirm dropdown clipping, floating-label animation in both light/dark and the user's custom theme, full-width stacked buttons, correct set-filter badge color, and clickable set-filter rows with right-aligned badges.

- [ ] **Step 5: Remove the spec/plan docs (per project convention) before opening a PR**

Per `CLAUDE.md`, `docs/superpowers` specs/plans must not be merged to main. Once implementation is confirmed complete and all steps above pass:

```bash
git rm -r docs/superpowers
git commit -m "#216: removed spec and plan"
```
