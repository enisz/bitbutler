# Column Reorder Controls Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add move-to-top/up/down/to-bottom and remove controls to each row of the visible-columns list in the torrent-list-grid settings tab, so reordering a long column list no longer depends on long drags in a small scrolling container.

**Architecture:** Purely additive changes to the existing `TorrentListGrid` component (`packages/app/src/app/modals/settings/torrent-list-grid/`) - new component methods that manipulate the same `orderedColumns` signal and `columns` FormControl the existing `drop()` handler and picker already use, plus template/style additions to render the new per-row buttons. No new components, services, or files.

**Tech Stack:** Angular 20 (signals, new `@for` control flow), Angular CDK drag-drop (existing), `@ngx-translate`, FontAwesome (`@fortawesome/free-solid-svg-icons`), Vitest (via `ng test`).

## Global Constraints

- Use `-` (hyphen) instead of `—` (em dash) in all commit messages and any written output.
- Commit format: `#257: short description` (this work is tracked under issue #257 on branch `257-column-reorder-controls`).
- `npm run lint` must pass with zero warnings (`max-warnings=0`) before each commit that touches `packages/app`.
- Every user-facing string needs both an English (`public/i18n/us.json`) and Hungarian (`public/i18n/hu.json`) translation - never add a key to one file without the other.
- Follow the existing code style in `torrent-list-grid.ts`/`.html`/`.scss` exactly (signal-based state, `public` component methods called directly from the template, existing class-naming conventions like `.column-drag-item`).

---

### Task 1: Move and remove methods on `TorrentListGrid`

**Files:**

- Modify: `packages/app/src/app/modals/settings/torrent-list-grid/torrent-list-grid.ts` (add methods after the existing `drop()` method, currently at `torrent-list-grid.ts:152-157`)
- Test: `packages/app/src/app/modals/settings/torrent-list-grid/torrent-list-grid.spec.ts`

**Interfaces:**

- Consumes: `component.orderedColumns` (existing `WritableSignal<NgSelectColumnItem[]>`, where `NgSelectColumnItem = { value: string; label: string }`), `component.torrentListGridForm.get('columns')` (existing `FormControl<string[]>`), `stateServiceMock.markDirty` (existing mock, asserts calls with `('torrent-list-grid', true)`).
- Produces (for Task 2's template to call): `moveUp(index: number): void`, `moveDown(index: number): void`, `moveToTop(index: number): void`, `moveToBottom(index: number): void`, `remove(colId: string): void`.

- [ ] **Step 1: Write the failing tests**

Add to `torrent-list-grid.spec.ts`, after the existing `describe('drop', ...)` block (which ends at line 80, just before the final closing `});` of the outer `describe('TorrentListGrid', ...)`):

```typescript
describe('moveUp', () => {
  it('should swap the item with its predecessor', () => {
    component.orderedColumns.set([
      { value: 'name', label: 'Name' },
      { value: 'size', label: 'Size' },
      { value: 'progress', label: 'Progress' },
    ]);
    component.moveUp(1);
    const ids = component.orderedColumns().map((c) => c.value);
    expect(ids).toEqual(['size', 'name', 'progress']);
  });

  it('should be a no-op at the first index', () => {
    component.orderedColumns.set([
      { value: 'name', label: 'Name' },
      { value: 'size', label: 'Size' },
    ]);
    component.moveUp(0);
    const ids = component.orderedColumns().map((c) => c.value);
    expect(ids).toEqual(['name', 'size']);
  });

  it('should mark torrent-list-grid as dirty', () => {
    component.orderedColumns.set([
      { value: 'name', label: 'Name' },
      { value: 'size', label: 'Size' },
    ]);
    component.moveUp(1);
    expect(stateServiceMock.markDirty).toHaveBeenCalledWith('torrent-list-grid', true);
  });
});

describe('moveDown', () => {
  it('should swap the item with its successor', () => {
    component.orderedColumns.set([
      { value: 'name', label: 'Name' },
      { value: 'size', label: 'Size' },
      { value: 'progress', label: 'Progress' },
    ]);
    component.moveDown(0);
    const ids = component.orderedColumns().map((c) => c.value);
    expect(ids).toEqual(['size', 'name', 'progress']);
  });

  it('should be a no-op at the last index', () => {
    component.orderedColumns.set([
      { value: 'name', label: 'Name' },
      { value: 'size', label: 'Size' },
    ]);
    component.moveDown(1);
    const ids = component.orderedColumns().map((c) => c.value);
    expect(ids).toEqual(['name', 'size']);
  });

  it('should mark torrent-list-grid as dirty', () => {
    component.orderedColumns.set([
      { value: 'name', label: 'Name' },
      { value: 'size', label: 'Size' },
    ]);
    component.moveDown(0);
    expect(stateServiceMock.markDirty).toHaveBeenCalledWith('torrent-list-grid', true);
  });
});

describe('moveToTop', () => {
  it('should move the item to the front', () => {
    component.orderedColumns.set([
      { value: 'name', label: 'Name' },
      { value: 'size', label: 'Size' },
      { value: 'progress', label: 'Progress' },
    ]);
    component.moveToTop(2);
    const ids = component.orderedColumns().map((c) => c.value);
    expect(ids).toEqual(['progress', 'name', 'size']);
  });

  it('should be a no-op at the first index', () => {
    component.orderedColumns.set([
      { value: 'name', label: 'Name' },
      { value: 'size', label: 'Size' },
    ]);
    component.moveToTop(0);
    const ids = component.orderedColumns().map((c) => c.value);
    expect(ids).toEqual(['name', 'size']);
  });
});

describe('moveToBottom', () => {
  it('should move the item to the end', () => {
    component.orderedColumns.set([
      { value: 'name', label: 'Name' },
      { value: 'size', label: 'Size' },
      { value: 'progress', label: 'Progress' },
    ]);
    component.moveToBottom(0);
    const ids = component.orderedColumns().map((c) => c.value);
    expect(ids).toEqual(['size', 'progress', 'name']);
  });

  it('should be a no-op at the last index', () => {
    component.orderedColumns.set([
      { value: 'name', label: 'Name' },
      { value: 'size', label: 'Size' },
    ]);
    component.moveToBottom(1);
    const ids = component.orderedColumns().map((c) => c.value);
    expect(ids).toEqual(['name', 'size']);
  });
});

describe('remove', () => {
  it('should drop the column id from the columns form control', () => {
    component.torrentListGridForm.patchValue({ columns: ['name', 'size', 'progress'] });
    component.remove('size');
    expect(component.torrentListGridForm.get('columns')?.value).toEqual(['name', 'progress']);
  });

  it('should remove the column from orderedColumns via the existing picker sync', () => {
    component.torrentListGridForm.patchValue({ columns: ['name', 'size'] });
    component.remove('size');
    const ids = component.orderedColumns().map((c) => c.value);
    expect(ids).toEqual(['name']);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test --workspace=packages/app`
Expected: FAIL to compile - `Property 'moveUp' does not exist on type 'TorrentListGrid'` (and similarly for `moveDown`, `moveToTop`, `moveToBottom`, `remove`).

- [ ] **Step 3: Implement the methods**

In `torrent-list-grid.ts`, add these public methods immediately after the existing `drop()` method:

```typescript
  public moveUp(index: number): void {
    if (index <= 0) return;
    const columns = [...this.orderedColumns()];
    [columns[index - 1], columns[index]] = [columns[index], columns[index - 1]];
    this.orderedColumns.set(columns);
    this.stateService.markDirty('torrent-list-grid', true);
  }

  public moveDown(index: number): void {
    if (index >= this.orderedColumns().length - 1) return;
    const columns = [...this.orderedColumns()];
    [columns[index], columns[index + 1]] = [columns[index + 1], columns[index]];
    this.orderedColumns.set(columns);
    this.stateService.markDirty('torrent-list-grid', true);
  }

  public moveToTop(index: number): void {
    if (index <= 0) return;
    const columns = [...this.orderedColumns()];
    const [moved] = columns.splice(index, 1);
    columns.unshift(moved);
    this.orderedColumns.set(columns);
    this.stateService.markDirty('torrent-list-grid', true);
  }

  public moveToBottom(index: number): void {
    if (index >= this.orderedColumns().length - 1) return;
    const columns = [...this.orderedColumns()];
    const [moved] = columns.splice(index, 1);
    columns.push(moved);
    this.orderedColumns.set(columns);
    this.stateService.markDirty('torrent-list-grid', true);
  }

  public remove(colId: string): void {
    const columnsControl = this.torrentListGridForm.get('columns');
    const currentIds = (columnsControl?.value as string[]) ?? [];
    columnsControl?.setValue(currentIds.filter((id) => id !== colId));
  }
```

`remove()` deliberately does not call `stateService.markDirty` directly - setting the `columns` FormControl's value bubbles a `valueChanges` event up to the parent `torrentListGridForm`, whose existing subscription (constructor, `torrent-list-grid.ts:121-123`) already calls `markDirty`. Adding an explicit call here would just double it.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm run test --workspace=packages/app`
Expected: PASS - all tests in `torrent-list-grid.spec.ts`, including the new `moveUp`/`moveDown`/`moveToTop`/`moveToBottom`/`remove` describe blocks.

- [ ] **Step 5: Lint**

Run: `npm run lint`
Expected: no errors, no warnings.

- [ ] **Step 6: Commit**

```bash
git add packages/app/src/app/modals/settings/torrent-list-grid/torrent-list-grid.ts packages/app/src/app/modals/settings/torrent-list-grid/torrent-list-grid.spec.ts
git commit -m "#257: add move and remove methods to column reorder list"
```

---

### Task 2: Wire up the row action buttons (template, i18n, styles)

**Files:**

- Modify: `packages/app/src/app/modals/settings/torrent-list-grid/torrent-list-grid.ts` (import icons, add public icon fields)
- Modify: `packages/app/src/app/modals/settings/torrent-list-grid/torrent-list-grid.html` (column list `@for` block, currently `torrent-list-grid.html:194-211`)
- Modify: `packages/app/src/app/modals/settings/torrent-list-grid/torrent-list-grid.scss`
- Modify: `public/i18n/us.json` (`torrent-list-grid.torrent-list-grid-form`, currently around line 1682)
- Modify: `public/i18n/hu.json` (same path, currently around line 1682)

**Interfaces:**

- Consumes: `moveUp`, `moveDown`, `moveToTop`, `moveToBottom`, `remove` from Task 1.
- Produces: nothing further downstream - this is the final visible deliverable of the plan.

- [ ] **Step 1: Add i18n keys**

In `public/i18n/us.json`, inside `torrent-list-grid.torrent-list-grid-form` (after the existing `"row-double-click"` block, before its closing `}` at what is currently line 1695), add a new sibling key:

```json
            "column-actions": {
              "move-to-top": "Move to top",
              "move-up": "Move up",
              "move-down": "Move down",
              "move-to-bottom": "Move to bottom",
              "remove": "Remove"
            }
```

Remember to add a trailing comma after the existing `"row-double-click": { ... }` block's closing brace, since `column-actions` becomes a new sibling key after it.

In `public/i18n/hu.json`, at the same path, add:

```json
            "column-actions": {
              "move-to-top": "Ugrás a lista tetejére",
              "move-up": "Mozgatás feljebb",
              "move-down": "Mozgatás lejjebb",
              "move-to-bottom": "Ugrás a lista aljára",
              "remove": "Eltávolítás"
            }
```

Same trailing-comma adjustment applies.

- [ ] **Step 2: Verify the JSON is valid**

Run: `node -e "JSON.parse(require('fs').readFileSync('public/i18n/us.json', 'utf8')); JSON.parse(require('fs').readFileSync('public/i18n/hu.json', 'utf8')); console.log('ok')"`
Expected: prints `ok` with no error.

- [ ] **Step 3: Import the new icons in the component**

In `torrent-list-grid.ts`, change:

```typescript
import { faGripVertical, faTriangleExclamation } from '@fortawesome/free-solid-svg-icons';
```

to:

```typescript
import {
  faAnglesDown,
  faAnglesUp,
  faChevronDown,
  faChevronUp,
  faGripVertical,
  faTriangleExclamation,
  faXmark,
} from '@fortawesome/free-solid-svg-icons';
```

Then, next to the existing `public faGripVertical = faGripVertical;` field, add:

```typescript
  public faAnglesUp = faAnglesUp;
  public faAnglesDown = faAnglesDown;
  public faChevronUp = faChevronUp;
  public faChevronDown = faChevronDown;
  public faXmark = faXmark;
```

- [ ] **Step 4: Update the template**

In `torrent-list-grid.html`, replace the `@for` block inside `.column-drop-list` (currently):

```html
@for (column of orderedColumns(); track column.value) {
<div class="column-drag-item" cdkDrag>
  <div class="drag-handle" cdkDragHandle>
    <fa-icon [icon]="faGripVertical"></fa-icon>
  </div>
  <span class="column-label">{{ column.label }}</span>
</div>
} @empty {
```

with:

```html
@for ( column of orderedColumns(); track column.value; let idx = $index; let last = $last ) {
<div class="column-drag-item" cdkDrag>
  <div class="drag-handle" cdkDragHandle>
    <fa-icon [icon]="faGripVertical"></fa-icon>
  </div>
  <span class="column-label">{{ column.label }}</span>
  <div class="column-actions ms-auto">
    <button
      type="button"
      class="btn btn-sm btn-link"
      [disabled]="idx === 0"
      (click)="moveToTop(idx)"
      [attr.aria-label]="
                          'pages.settings.tab.torrent-list-grid.torrent-list-grid-form.column-actions.move-to-top'
                            | translate
                        "
    >
      <fa-icon [icon]="faAnglesUp"></fa-icon>
    </button>
    <button
      type="button"
      class="btn btn-sm btn-link"
      [disabled]="idx === 0"
      (click)="moveUp(idx)"
      [attr.aria-label]="
                          'pages.settings.tab.torrent-list-grid.torrent-list-grid-form.column-actions.move-up'
                            | translate
                        "
    >
      <fa-icon [icon]="faChevronUp"></fa-icon>
    </button>
    <button
      type="button"
      class="btn btn-sm btn-link"
      [disabled]="last"
      (click)="moveDown(idx)"
      [attr.aria-label]="
                          'pages.settings.tab.torrent-list-grid.torrent-list-grid-form.column-actions.move-down'
                            | translate
                        "
    >
      <fa-icon [icon]="faChevronDown"></fa-icon>
    </button>
    <button
      type="button"
      class="btn btn-sm btn-link"
      [disabled]="last"
      (click)="moveToBottom(idx)"
      [attr.aria-label]="
                          'pages.settings.tab.torrent-list-grid.torrent-list-grid-form.column-actions.move-to-bottom'
                            | translate
                        "
    >
      <fa-icon [icon]="faAnglesDown"></fa-icon>
    </button>
    <button
      type="button"
      class="btn btn-sm btn-link text-danger"
      (click)="remove(column.value)"
      [attr.aria-label]="
                          'pages.settings.tab.torrent-list-grid.torrent-list-grid-form.column-actions.remove'
                            | translate
                        "
    >
      <fa-icon [icon]="faXmark"></fa-icon>
    </button>
  </div>
</div>
} @empty {
```

(The `@empty` block and everything after it is unchanged.)

- [ ] **Step 5: Update the styles**

In `torrent-list-grid.scss`, change the `max-height` in `.column-reorder-container`:

```diff
 .column-reorder-container {
-  max-height: 400px;
+  max-height: min(520px, 55vh);
   overflow-y: auto;
   background-color: var(--bb-control-bg);
   padding: 4px;
 }
```

Then add, after the existing `.column-drag-item { ... }` block (which ends just before `.cdk-drag-preview`):

```scss
.column-actions {
  display: flex;
  align-items: center;
  gap: 2px;
  opacity: 0.6;
  transition: opacity 0.15s ease;

  .btn {
    padding: 0 6px;
    line-height: 1;
  }
}

.column-drag-item:hover .column-actions,
.column-drag-item:focus-within .column-actions {
  opacity: 1;
}
```

- [ ] **Step 6: Run the existing tests**

Run: `npm run test --workspace=packages/app`
Expected: PASS - the template change doesn't alter any tested behavior directly (tests call the component methods, not the DOM), so this should stay green as a regression check.

- [ ] **Step 7: Lint**

Run: `npm run lint`
Expected: no errors, no warnings.

- [ ] **Step 8: Manually verify in the running app**

Run: `npm start`

In the running app: open Settings → Torrent List Grid tab → Columns section.

- Add at least 5 columns via the picker on the right so the ordered list on the left has enough rows to test with.
- Hover a row: confirm the five action buttons fade in (to-top, up, down, to-bottom, remove), and the remove `×` renders in red.
- Click `↓` on the first row: confirm it swaps with the second row.
- Click `⇊` on a middle row: confirm it jumps to the last position.
- Click `⇈` on the last row: confirm it jumps to the first position.
- Confirm the top row's `⇈`/`↑` are disabled, and the bottom row's `↓`/`⇊` are disabled.
- Click `×` on a row: confirm it disappears from the ordered list and reappears as selectable in the picker dropdown on the right.
- Confirm the ordered list area is visibly taller than before (more rows visible without scrolling).
- Save the tab and reopen Settings: confirm the new order and visibility persisted.

- [ ] **Step 9: Commit**

```bash
git add packages/app/src/app/modals/settings/torrent-list-grid/torrent-list-grid.ts packages/app/src/app/modals/settings/torrent-list-grid/torrent-list-grid.html packages/app/src/app/modals/settings/torrent-list-grid/torrent-list-grid.scss public/i18n/us.json public/i18n/hu.json
git commit -m "#257: add column reorder action buttons to the settings tab"
```
