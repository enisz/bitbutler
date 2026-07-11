# Custom Column Filters Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the built-in AG Grid text/number column filters on the torrent grid with custom components matching the app's UI conventions (operator dropdown + value input + Apply/Clear buttons), add a filter to formatted byte-size columns that have none today, and add a checkbox multi-select filter for `state`/`category`/`tags`.

**Architecture:** Four new `IFilterAngularComp` components under a new `packages/app/src/app/components/column-filters/` folder. Text/Number/Size filters share pure comparison logic (`operator-filter.utils.ts`) and a lifecycle base class (`operator-filter-base.ts`); the Set (checkbox) filter is independent. `DatepickerRangeFilter` moves into the same folder unchanged. Distinct-value counts for the Set filter are hoisted from `Status`'s sidebar component into `TorrentStoreService` as shared computed signals.

**Tech Stack:** Angular 20 (standalone, zoneless, signals), `ag-grid-community`/`ag-grid-angular` v35 custom filters, `@ng-select/ng-select`, `@ngx-translate/core`, Vitest (via `@angular/build:unit-test`).

## Global Constraints

- Spec: `docs/superpowers/specs/2026-07-11-custom-column-filters-design.md` - read it before starting.
- `npm run lint` must pass with zero warnings (`max-warnings=0`).
- Use `-` not `—` in all commit messages and any written output.
- Commit format: `#216: short description`.
- String comparisons in filters are case-insensitive.
- `blank` means `null`/`undefined`/(for strings) empty-or-whitespace.
- `between` is inclusive on both ends.
- All four new filter types set `floatingFilter: false` on their columns (no floating-row mini filter).
- AG Grid v35's `IFilterParams` exposes `getValue(node)` to read a row's cell value for the filter's own column - **not** `valueGetter` (that property does not exist on this version's `IFilterParams`). Every new filter's `doesFilterPass` must call `this.params.getValue(params.node)`.
- Do not touch `FilterService`, `trackersWithCounts`, or `savePathsWithCounts` in `status.ts` - out of scope.

---

## Task 1: Pure operator comparison utilities

**Files:**

- Create: `packages/app/src/app/components/column-filters/operator-filter.utils.ts`
- Test: `packages/app/src/app/components/column-filters/operator-filter.utils.spec.ts`

**Interfaces:**

- Produces: `StringFilterOperator`, `NumberFilterOperator` types; `STRING_FILTER_OPERATORS: StringFilterOperator[]`, `NUMBER_FILTER_OPERATORS: NumberFilterOperator[]`; `STRING_OPERATOR_LABEL_KEYS: Record<StringFilterOperator, string>`, `NUMBER_OPERATOR_LABEL_KEYS: Record<NumberFilterOperator, string>`; `stringOperatorPasses(operator, cellValue, filterValue): boolean`; `numberOperatorPasses(operator, cellValue, from, to): boolean`. Tasks 3-6 consume all of these.

- [ ] **Step 1: Write the failing test**

Create `packages/app/src/app/components/column-filters/operator-filter.utils.spec.ts`:

```ts
import {
  NUMBER_FILTER_OPERATORS,
  STRING_FILTER_OPERATORS,
  numberOperatorPasses,
  stringOperatorPasses,
} from './operator-filter.utils';

describe('stringOperatorPasses', () => {
  it('contains matches case-insensitively', () => {
    expect(stringOperatorPasses('contains', 'Ubuntu 24.04 ISO', 'ubuntu')).toBe(true);
    expect(stringOperatorPasses('contains', 'Ubuntu 24.04 ISO', 'fedora')).toBe(false);
  });

  it('notContains is the inverse of contains', () => {
    expect(stringOperatorPasses('notContains', 'Ubuntu 24.04 ISO', 'fedora')).toBe(true);
    expect(stringOperatorPasses('notContains', 'Ubuntu 24.04 ISO', 'ubuntu')).toBe(false);
  });

  it('equals requires an exact case-insensitive match', () => {
    expect(stringOperatorPasses('equals', 'Movies', 'movies')).toBe(true);
    expect(stringOperatorPasses('equals', 'Movies', 'movie')).toBe(false);
  });

  it('notEqual is the inverse of equals', () => {
    expect(stringOperatorPasses('notEqual', 'Movies', 'tv')).toBe(true);
    expect(stringOperatorPasses('notEqual', 'Movies', 'movies')).toBe(false);
  });

  it('startsWith and endsWith match prefixes and suffixes', () => {
    expect(stringOperatorPasses('startsWith', 'Ubuntu 24.04 ISO', 'ubuntu')).toBe(true);
    expect(stringOperatorPasses('startsWith', 'Ubuntu 24.04 ISO', 'iso')).toBe(false);
    expect(stringOperatorPasses('endsWith', 'Ubuntu 24.04 ISO', 'iso')).toBe(true);
    expect(stringOperatorPasses('endsWith', 'Ubuntu 24.04 ISO', 'ubuntu')).toBe(false);
  });

  it('blank matches null, undefined, and whitespace-only values, ignoring filterValue', () => {
    expect(stringOperatorPasses('blank', null, 'anything')).toBe(true);
    expect(stringOperatorPasses('blank', undefined, 'anything')).toBe(true);
    expect(stringOperatorPasses('blank', '   ', 'anything')).toBe(true);
    expect(stringOperatorPasses('blank', 'x', 'anything')).toBe(false);
  });

  it('notBlank is the inverse of blank, ignoring filterValue', () => {
    expect(stringOperatorPasses('notBlank', 'x', 'anything')).toBe(true);
    expect(stringOperatorPasses('notBlank', null, 'anything')).toBe(false);
  });

  it('exposes all 8 string operators in a stable order', () => {
    expect(STRING_FILTER_OPERATORS).toEqual([
      'contains',
      'notContains',
      'equals',
      'notEqual',
      'startsWith',
      'endsWith',
      'blank',
      'notBlank',
    ]);
  });
});

describe('numberOperatorPasses', () => {
  it('equals/notEqual compare against from', () => {
    expect(numberOperatorPasses('equals', 5, 5, null)).toBe(true);
    expect(numberOperatorPasses('equals', 5, 6, null)).toBe(false);
    expect(numberOperatorPasses('notEqual', 5, 6, null)).toBe(true);
    expect(numberOperatorPasses('notEqual', 5, 5, null)).toBe(false);
  });

  it('gt/gte/lt/lte compare against from', () => {
    expect(numberOperatorPasses('gt', 10, 5, null)).toBe(true);
    expect(numberOperatorPasses('gt', 5, 5, null)).toBe(false);
    expect(numberOperatorPasses('gte', 5, 5, null)).toBe(true);
    expect(numberOperatorPasses('lt', 3, 5, null)).toBe(true);
    expect(numberOperatorPasses('lt', 5, 5, null)).toBe(false);
    expect(numberOperatorPasses('lte', 5, 5, null)).toBe(true);
  });

  it('between is inclusive on both ends', () => {
    expect(numberOperatorPasses('between', 5, 5, 10)).toBe(true);
    expect(numberOperatorPasses('between', 10, 5, 10)).toBe(true);
    expect(numberOperatorPasses('between', 4, 5, 10)).toBe(false);
    expect(numberOperatorPasses('between', 11, 5, 10)).toBe(false);
  });

  it('blank/notBlank check cellValue only, ignoring from/to', () => {
    expect(numberOperatorPasses('blank', null, 5, 10)).toBe(true);
    expect(numberOperatorPasses('blank', 0, 5, 10)).toBe(false);
    expect(numberOperatorPasses('notBlank', 0, 5, 10)).toBe(true);
    expect(numberOperatorPasses('notBlank', null, 5, 10)).toBe(false);
  });

  it('a null cellValue fails every operator except blank', () => {
    for (const operator of NUMBER_FILTER_OPERATORS.filter((o) => o !== 'blank')) {
      expect(numberOperatorPasses(operator, null, 5, 10)).toBe(false);
    }
  });

  it('exposes all 9 number operators in a stable order', () => {
    expect(NUMBER_FILTER_OPERATORS).toEqual([
      'equals',
      'notEqual',
      'gt',
      'gte',
      'lt',
      'lte',
      'between',
      'blank',
      'notBlank',
    ]);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run test --workspace=@bitbutler/app`
Expected: FAIL - `operator-filter.utils.ts` does not exist, import error.

- [ ] **Step 3: Implement the utilities**

Create `packages/app/src/app/components/column-filters/operator-filter.utils.ts`:

```ts
export type StringFilterOperator =
  | 'contains'
  | 'notContains'
  | 'equals'
  | 'notEqual'
  | 'startsWith'
  | 'endsWith'
  | 'blank'
  | 'notBlank';

export type NumberFilterOperator =
  | 'equals'
  | 'notEqual'
  | 'gt'
  | 'gte'
  | 'lt'
  | 'lte'
  | 'between'
  | 'blank'
  | 'notBlank';

export const STRING_FILTER_OPERATORS: StringFilterOperator[] = [
  'contains',
  'notContains',
  'equals',
  'notEqual',
  'startsWith',
  'endsWith',
  'blank',
  'notBlank',
];

export const NUMBER_FILTER_OPERATORS: NumberFilterOperator[] = [
  'equals',
  'notEqual',
  'gt',
  'gte',
  'lt',
  'lte',
  'between',
  'blank',
  'notBlank',
];

export const STRING_OPERATOR_LABEL_KEYS: Record<StringFilterOperator, string> = {
  contains: 'components.column-filters.operator.contains',
  notContains: 'components.column-filters.operator.not-contains',
  equals: 'components.column-filters.operator.equals',
  notEqual: 'components.column-filters.operator.not-equal',
  startsWith: 'components.column-filters.operator.starts-with',
  endsWith: 'components.column-filters.operator.ends-with',
  blank: 'components.column-filters.operator.blank',
  notBlank: 'components.column-filters.operator.not-blank',
};

export const NUMBER_OPERATOR_LABEL_KEYS: Record<NumberFilterOperator, string> = {
  equals: 'components.column-filters.operator.equals',
  notEqual: 'components.column-filters.operator.not-equal',
  gt: 'components.column-filters.operator.gt',
  gte: 'components.column-filters.operator.gte',
  lt: 'components.column-filters.operator.lt',
  lte: 'components.column-filters.operator.lte',
  between: 'components.column-filters.operator.between',
  blank: 'components.column-filters.operator.blank',
  notBlank: 'components.column-filters.operator.not-blank',
};

function isBlankStringValue(value: string | null | undefined): boolean {
  return value == null || value.trim() === '';
}

export function stringOperatorPasses(
  operator: StringFilterOperator,
  cellValue: string | null | undefined,
  filterValue: string,
): boolean {
  if (operator === 'blank') return isBlankStringValue(cellValue);
  if (operator === 'notBlank') return !isBlankStringValue(cellValue);

  const cell = (cellValue ?? '').toLowerCase();
  const value = (filterValue ?? '').toLowerCase();

  switch (operator) {
    case 'contains':
      return cell.includes(value);
    case 'notContains':
      return !cell.includes(value);
    case 'equals':
      return cell === value;
    case 'notEqual':
      return cell !== value;
    case 'startsWith':
      return cell.startsWith(value);
    case 'endsWith':
      return cell.endsWith(value);
    default:
      return false;
  }
}

export function numberOperatorPasses(
  operator: NumberFilterOperator,
  cellValue: number | null | undefined,
  from: number | null,
  to: number | null,
): boolean {
  if (operator === 'blank') return cellValue == null;
  if (operator === 'notBlank') return cellValue != null;
  if (cellValue == null) return false;

  switch (operator) {
    case 'equals':
      return from != null && cellValue === from;
    case 'notEqual':
      return from == null || cellValue !== from;
    case 'gt':
      return from != null && cellValue > from;
    case 'gte':
      return from != null && cellValue >= from;
    case 'lt':
      return from != null && cellValue < from;
    case 'lte':
      return from != null && cellValue <= from;
    case 'between':
      return from != null && to != null && cellValue >= from && cellValue <= to;
    default:
      return false;
  }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm run test --workspace=@bitbutler/app`
Expected: PASS - all `stringOperatorPasses`/`numberOperatorPasses` cases green.

- [ ] **Step 5: Lint**

Run: `npm run lint`
Expected: zero warnings/errors.

- [ ] **Step 6: Commit**

```bash
git add packages/app/src/app/components/column-filters/operator-filter.utils.ts packages/app/src/app/components/column-filters/operator-filter.utils.spec.ts
git commit -m "$(cat <<'EOF'
#216: add pure operator comparison utilities for column filters

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Add i18n keys for the new filters

**Files:**

- Modify: `public/i18n/us.json`
- Modify: `public/i18n/hu.json`

**Interfaces:**

- Produces: translation keys `components.column-filters.operator.{contains,not-contains,equals,not-equal,starts-with,ends-with,gt,gte,lt,lte,between,blank,not-blank}`, `components.column-filters.label.{value,from,to}`, `components.column-filters.set.{filter-placeholder,no-matches}`. Tasks 4-8 consume these via `TranslateService`/`| translate`.
- Unit labels (B/KB/MB/GB/TB) are **not** translated - they're language-invariant technical abbreviations, hardcoded directly in `size-column-filter.ts` (Task 6).

- [ ] **Step 1: Add the English keys**

In `public/i18n/us.json`, insert a new `"column-filters"` key as a sibling of `"datepicker-range-filter"` inside `"components"` (right after the `datepicker-range-filter` block, before `"modals"`):

```json
    "datepicker-range-filter": {
      "label": {
        "from": "From",
        "to": "To",
        "date": "Date"
      }
    },
    "column-filters": {
      "operator": {
        "contains": "Contains",
        "not-contains": "Does not contain",
        "equals": "Equals",
        "not-equal": "Does not equal",
        "starts-with": "Begins with",
        "ends-with": "Ends with",
        "gt": "Greater than",
        "gte": "Greater than or equal to",
        "lt": "Less than",
        "lte": "Less than or equal to",
        "between": "Between",
        "blank": "Blank",
        "not-blank": "Not blank"
      },
      "label": {
        "value": "Value",
        "from": "From",
        "to": "To"
      },
      "set": {
        "filter-placeholder": "Filter...",
        "no-matches": "No matching values"
      }
    },
```

- [ ] **Step 2: Add the Hungarian keys**

In `public/i18n/hu.json`, insert the matching block in the same position:

```json
    "datepicker-range-filter": {
      "label": {
        "from": "Ettől",
        "to": "Eddig",
        "date": "Dátum"
      }
    },
    "column-filters": {
      "operator": {
        "contains": "Tartalmazza",
        "not-contains": "Nem tartalmazza",
        "equals": "Egyenlő",
        "not-equal": "Nem egyenlő",
        "starts-with": "Ezzel kezdődik",
        "ends-with": "Ezzel végződik",
        "gt": "Nagyobb, mint",
        "gte": "Nagyobb vagy egyenlő, mint",
        "lt": "Kisebb, mint",
        "lte": "Kisebb vagy egyenlő, mint",
        "between": "Között",
        "blank": "Üres",
        "not-blank": "Nem üres"
      },
      "label": {
        "value": "Érték",
        "from": "Ettől",
        "to": "Eddig"
      },
      "set": {
        "filter-placeholder": "Szűrés...",
        "no-matches": "Nincs egyező érték"
      }
    },
```

- [ ] **Step 3: Verify both files are still valid JSON**

Run: `node -e "require('./public/i18n/us.json'); require('./public/i18n/hu.json'); console.log('valid')"`
Expected: prints `valid` with no errors.

- [ ] **Step 4: Commit**

```bash
git add public/i18n/us.json public/i18n/hu.json
git commit -m "$(cat <<'EOF'
#216: add i18n keys for column filter operators and labels

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Move DatepickerRangeFilter into column-filters/

Pure relocation - no code or behavior changes, only import paths.

**Files:**

- Move: `packages/app/src/app/components/datepicker-range-filter/datepicker-range-filter.ts` → `packages/app/src/app/components/column-filters/datepicker-range-filter/datepicker-range-filter.ts`
- Move: `packages/app/src/app/components/datepicker-range-filter/datepicker-range-filter.html` → `packages/app/src/app/components/column-filters/datepicker-range-filter/datepicker-range-filter.html`
- Move: `packages/app/src/app/components/datepicker-range-filter/datepicker-range-filter.scss` → `packages/app/src/app/components/column-filters/datepicker-range-filter/datepicker-range-filter.scss`
- Move: `packages/app/src/app/components/datepicker-range-filter/datepicker-range-filter.spec.ts` → `packages/app/src/app/components/column-filters/datepicker-range-filter/datepicker-range-filter.spec.ts`
- Modify: `packages/app/src/app/pages/main/grid/grid.lib.ts` (import path only)

**Interfaces:**

- No change to `DatepickerRangeFilter`'s public shape - `getModel`/`setModel`/`doesFilterPass` etc. are untouched.

- [ ] **Step 1: Move the four files**

```bash
git mv packages/app/src/app/components/datepicker-range-filter/datepicker-range-filter.ts packages/app/src/app/components/column-filters/datepicker-range-filter/datepicker-range-filter.ts
git mv packages/app/src/app/components/datepicker-range-filter/datepicker-range-filter.html packages/app/src/app/components/column-filters/datepicker-range-filter/datepicker-range-filter.html
git mv packages/app/src/app/components/datepicker-range-filter/datepicker-range-filter.scss packages/app/src/app/components/column-filters/datepicker-range-filter/datepicker-range-filter.scss
git mv packages/app/src/app/components/datepicker-range-filter/datepicker-range-filter.spec.ts packages/app/src/app/components/column-filters/datepicker-range-filter/datepicker-range-filter.spec.ts
```

- [ ] **Step 2: Fix relative imports in the moved `.ts` file**

In `packages/app/src/app/components/column-filters/datepicker-range-filter/datepicker-range-filter.ts`, the file is now one directory deeper, so every relative import needs one more `../`:

```ts
import { CustomDatepickerI18n } from '../../../services/custom-datepicker-i18n.service';
import { DateFormatService } from '../../../services/date-format.service';
import { BbBtnContent } from '../../bb-btn-content/bb-btn-content';
```

(was `'../../services/custom-datepicker-i18n.service'`, `'../../services/date-format.service'`, `'../bb-btn-content/bb-btn-content'`)

- [ ] **Step 3: Fix relative imports in the moved `.spec.ts` file**

In `packages/app/src/app/components/column-filters/datepicker-range-filter/datepicker-range-filter.spec.ts`:

```ts
import { DEFAULT_GENERAL_SETTINGS } from '../../../models/general-settings.model';
import { DateFormatService } from '../../../services/date-format.service';
import { DatepickerRangeFilter } from './datepicker-range-filter';
```

(was `'../../models/general-settings.model'`, `'../../services/date-format.service'` - the same-folder `'./datepicker-range-filter'` import is unaffected by the move)

- [ ] **Step 4: Update the import in `grid.lib.ts`**

In `packages/app/src/app/pages/main/grid/grid.lib.ts`, find:

```ts
import { DatepickerRangeFilter } from '../../../components/datepicker-range-filter/datepicker-range-filter';
```

Replace with:

```ts
import { DatepickerRangeFilter } from '../../../components/column-filters/datepicker-range-filter/datepicker-range-filter';
```

- [ ] **Step 5: Run the moved spec and the grid tests to confirm nothing broke**

Run: `npm run test --workspace=@bitbutler/app`
Expected: PASS - `DatepickerRangeFilter` spec (39 existing tests) and `grid.spec.ts` both green, no import-resolution errors anywhere in the suite.

- [ ] **Step 6: Lint**

Run: `npm run lint`
Expected: zero warnings/errors.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "$(cat <<'EOF'
#216: move DatepickerRangeFilter into column-filters/

File move only - groups it with the other AG Grid custom filter
components being added. No behavior change.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: Shared operator-filter lifecycle base class

**Files:**

- Create: `packages/app/src/app/components/column-filters/operator-filter-base.ts`

**Interfaces:**

- Consumes: nothing project-specific (only `ag-grid-angular`/`ag-grid-community` types).
- Produces: `abstract class OperatorFilterBase<TValue> implements IFilterAngularComp` with abstract members `draft: TValue`, `applied: TValue`, `createEmptyValue(): TValue`, `valuesEqual(a: TValue, b: TValue): boolean`, `isActive(value: TValue): boolean`, `doesFilterPass(params: IDoesFilterPassParams): boolean`, and concrete `agInit`, `isFilterActive`, `getModel`, `setModel`, `afterGuiAttached`, `apply`, `clear`, `isApplyDisabled`. Tasks 5-7 (Text/Number/Size filters) extend this.

This class has no standalone test file - it's not independently instantiable (abstract), so its behavior is proven through Task 5's `TextColumnFilter` spec, the first concrete subclass.

- [ ] **Step 1: Write the base class**

```ts
import { IFilterAngularComp } from 'ag-grid-angular';
import { IAfterGuiAttachedParams, IDoesFilterPassParams, IFilterParams } from 'ag-grid-community';

export abstract class OperatorFilterBase<TValue> implements IFilterAngularComp {
  protected params!: IFilterParams;

  abstract draft: TValue;
  abstract applied: TValue;

  abstract createEmptyValue(): TValue;
  abstract valuesEqual(a: TValue, b: TValue): boolean;
  abstract isActive(value: TValue): boolean;
  abstract doesFilterPass(params: IDoesFilterPassParams): boolean;

  agInit(params: IFilterParams): void {
    this.params = params;
  }

  isFilterActive(): boolean {
    return this.isActive(this.applied);
  }

  getModel(): TValue | null {
    return this.isFilterActive() ? this.applied : null;
  }

  setModel(model: TValue | null): void {
    this.applied = model ?? this.createEmptyValue();
    this.draft = { ...this.applied };
  }

  afterGuiAttached(_params?: IAfterGuiAttachedParams): void {
    this.draft = { ...this.applied };
  }

  apply(): void {
    this.applied = { ...this.draft };
    this.params.filterChangedCallback();
  }

  clear(): void {
    this.draft = this.createEmptyValue();
    this.applied = this.createEmptyValue();
    this.params.filterChangedCallback();
  }

  isApplyDisabled(): boolean {
    return this.valuesEqual(this.draft, this.applied);
  }
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc -p packages/app/tsconfig.app.json --noEmit`
Expected: no errors referencing `operator-filter-base.ts` (an unused-abstract-class warning, if any, resolves once Task 5 extends it - if the compiler errors here because nothing extends it yet, that's expected and will be resolved in the next task; proceed to Task 5 before treating this as a blocker).

- [ ] **Step 3: Commit**

```bash
git add packages/app/src/app/components/column-filters/operator-filter-base.ts
git commit -m "$(cat <<'EOF'
#216: add shared lifecycle base class for operator column filters

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: Text column filter

**Files:**

- Create: `packages/app/src/app/components/column-filters/text-column-filter/text-column-filter.ts`
- Create: `packages/app/src/app/components/column-filters/text-column-filter/text-column-filter.html`
- Create: `packages/app/src/app/components/column-filters/text-column-filter/text-column-filter.scss`
- Test: `packages/app/src/app/components/column-filters/text-column-filter/text-column-filter.spec.ts`

**Interfaces:**

- Consumes: `OperatorFilterBase<TValue>` (Task 4); `StringFilterOperator`, `STRING_FILTER_OPERATORS`, `STRING_OPERATOR_LABEL_KEYS`, `stringOperatorPasses` (Task 1); `BbBtnContent` (existing, `packages/app/src/app/components/bb-btn-content/bb-btn-content.ts`); i18n keys from Task 2.
- Produces: `export interface TextFilterValue { operator: StringFilterOperator; value: string }`; `export class TextColumnFilter extends OperatorFilterBase<TextFilterValue> implements IFilterAngularComp`. Task 9 wires this onto text columns in `grid.lib.ts`.

- [ ] **Step 1: Write the failing test**

Create `packages/app/src/app/components/column-filters/text-column-filter/text-column-filter.spec.ts`:

```ts
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TextColumnFilter } from './text-column-filter';

describe('TextColumnFilter', () => {
  let component: TextColumnFilter;
  let fixture: ComponentFixture<TextColumnFilter>;
  let mockParams: any;

  beforeEach(async () => {
    mockParams = {
      filterChangedCallback: vi.fn(),
      getValue: vi.fn((node: { data: any }) => node.data?.name),
    };

    await TestBed.configureTestingModule({
      imports: [TextColumnFilter],
    }).compileComponents();

    fixture = TestBed.createComponent(TextColumnFilter);
    component = fixture.componentInstance;
    component.agInit(mockParams);
    fixture.detectChanges();
  });

  it('should create with an inactive default filter', () => {
    expect(component).toBeTruthy();
    expect(component.isFilterActive()).toBe(false);
  });

  it('exposes all 8 string operators, translated', () => {
    expect(component.operatorItems()).toHaveLength(8);
    expect(component.operatorItems().map((o) => o.value)).toEqual([
      'contains',
      'notContains',
      'equals',
      'notEqual',
      'startsWith',
      'endsWith',
      'blank',
      'notBlank',
    ]);
  });

  describe('doesFilterPass', () => {
    it('passes everything when the filter is inactive', () => {
      expect(component.doesFilterPass({ node: { data: { name: 'anything' } } } as any)).toBe(true);
    });

    it('applies the contains operator against the applied value using getValue', () => {
      component.applied = { operator: 'contains', value: 'ubuntu' };
      expect(component.doesFilterPass({ node: { data: { name: 'Ubuntu 24.04' } } } as any)).toBe(
        true,
      );
      expect(mockParams.getValue).toHaveBeenCalled();
      expect(component.doesFilterPass({ node: { data: { name: 'Fedora' } } } as any)).toBe(false);
    });

    it('blank ignores the applied value and only checks the cell', () => {
      component.applied = { operator: 'blank', value: 'ignored' };
      expect(component.doesFilterPass({ node: { data: { name: '' } } } as any)).toBe(true);
      expect(component.doesFilterPass({ node: { data: { name: 'x' } } } as any)).toBe(false);
    });
  });

  describe('isValueDisabled', () => {
    it('disables the value input for blank and not-blank operators', () => {
      component.draft = { operator: 'blank', value: '' };
      expect(component.isValueDisabled()).toBe(true);
      component.draft = { operator: 'notBlank', value: '' };
      expect(component.isValueDisabled()).toBe(true);
      component.draft = { operator: 'contains', value: '' };
      expect(component.isValueDisabled()).toBe(false);
    });
  });

  describe('getModel / setModel', () => {
    it('returns null when the filter is inactive', () => {
      expect(component.getModel()).toBeNull();
    });

    it('returns the applied model once a value is set', () => {
      component.applied = { operator: 'equals', value: 'x' };
      expect(component.getModel()).toEqual({ operator: 'equals', value: 'x' });
    });

    it('restores both draft and applied from a model', () => {
      component.setModel({ operator: 'startsWith', value: 'ubu' });
      expect(component.applied).toEqual({ operator: 'startsWith', value: 'ubu' });
      expect(component.draft).toEqual({ operator: 'startsWith', value: 'ubu' });
    });

    it('resets to an empty value when the model is null', () => {
      component.applied = { operator: 'equals', value: 'x' };
      component.setModel(null);
      expect(component.applied).toEqual({ operator: 'contains', value: '' });
      expect(component.draft).toEqual({ operator: 'contains', value: '' });
    });
  });

  describe('apply / clear', () => {
    it('apply copies draft into applied and calls filterChangedCallback', () => {
      component.draft = { operator: 'equals', value: 'x' };
      component.apply();
      expect(component.applied).toEqual({ operator: 'equals', value: 'x' });
      expect(mockParams.filterChangedCallback).toHaveBeenCalled();
    });

    it('clear resets both draft and applied and calls filterChangedCallback', () => {
      component.applied = { operator: 'equals', value: 'x' };
      component.draft = { operator: 'equals', value: 'x' };
      component.clear();
      expect(component.applied).toEqual({ operator: 'contains', value: '' });
      expect(component.draft).toEqual({ operator: 'contains', value: '' });
      expect(mockParams.filterChangedCallback).toHaveBeenCalled();
    });
  });

  describe('isApplyDisabled', () => {
    it('is true when draft matches applied', () => {
      component.draft = { operator: 'contains', value: '' };
      component.applied = { operator: 'contains', value: '' };
      expect(component.isApplyDisabled()).toBe(true);
    });

    it('is false when draft differs from applied', () => {
      component.draft = { operator: 'contains', value: 'x' };
      component.applied = { operator: 'contains', value: '' };
      expect(component.isApplyDisabled()).toBe(false);
    });
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run test --workspace=@bitbutler/app`
Expected: FAIL - `TextColumnFilter` does not exist.

- [ ] **Step 3: Implement the component**

Create `packages/app/src/app/components/column-filters/text-column-filter/text-column-filter.ts`:

```ts
import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { faCheck, faEraser } from '@fortawesome/free-solid-svg-icons';
import { NgSelectModule } from '@ng-select/ng-select';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { IFilterAngularComp } from 'ag-grid-angular';
import { IDoesFilterPassParams } from 'ag-grid-community';
import { BbBtnContent } from '../../bb-btn-content/bb-btn-content';
import { OperatorFilterBase } from '../operator-filter-base';
import {
  STRING_FILTER_OPERATORS,
  STRING_OPERATOR_LABEL_KEYS,
  StringFilterOperator,
  stringOperatorPasses,
} from '../operator-filter.utils';

export interface TextFilterValue {
  operator: StringFilterOperator;
  value: string;
}

function createEmptyTextValue(): TextFilterValue {
  return { operator: 'contains', value: '' };
}

@Component({
  selector: 'app-text-column-filter',
  standalone: true,
  imports: [FormsModule, NgSelectModule, FontAwesomeModule, TranslateModule, BbBtnContent],
  templateUrl: './text-column-filter.html',
  styleUrl: './text-column-filter.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TextColumnFilter
  extends OperatorFilterBase<TextFilterValue>
  implements IFilterAngularComp
{
  private readonly translateService = inject(TranslateService);
  private readonly languageChanged = toSignal(this.translateService.onLangChange);

  public readonly icons = { faCheck, faEraser };

  draft: TextFilterValue = createEmptyTextValue();
  applied: TextFilterValue = createEmptyTextValue();

  readonly operatorItems = computed(() => {
    this.languageChanged();
    return STRING_FILTER_OPERATORS.map((value) => ({
      value,
      label: this.translateService.instant(STRING_OPERATOR_LABEL_KEYS[value]),
    }));
  });

  createEmptyValue(): TextFilterValue {
    return createEmptyTextValue();
  }

  valuesEqual(a: TextFilterValue, b: TextFilterValue): boolean {
    return a.operator === b.operator && a.value === b.value;
  }

  isActive(value: TextFilterValue): boolean {
    return value.operator === 'blank' || value.operator === 'notBlank' || value.value.trim() !== '';
  }

  isValueDisabled(): boolean {
    return this.draft.operator === 'blank' || this.draft.operator === 'notBlank';
  }

  doesFilterPass(params: IDoesFilterPassParams): boolean {
    if (!this.isFilterActive()) return true;
    const cellValue = this.params.getValue(params.node) as string | null | undefined;
    return stringOperatorPasses(this.applied.operator, cellValue, this.applied.value);
  }
}
```

Create `packages/app/src/app/components/column-filters/text-column-filter/text-column-filter.html`:

```html
<div
  class="bb-column-filter p-2"
  (mousedown)="$event.stopPropagation()"
  (touchstart)="$event.stopPropagation()"
>
  <ng-select
    [items]="operatorItems()"
    bindLabel="label"
    bindValue="value"
    [clearable]="false"
    [searchable]="false"
    [(ngModel)]="draft.operator"
    class="mb-2"
  ></ng-select>

  <input
    type="text"
    class="form-control form-control-sm mb-2"
    [(ngModel)]="draft.value"
    [disabled]="isValueDisabled()"
    [placeholder]="'components.column-filters.label.value' | translate"
  />

  <div class="d-flex gap-2">
    <button
      class="btn btn-sm btn-outline-secondary btn-split flex-fill"
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
      class="btn btn-sm btn-outline-primary btn-split flex-fill"
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
</div>
```

Create `packages/app/src/app/components/column-filters/text-column-filter/text-column-filter.scss`:

```scss
:host {
  display: block;
}

.bb-column-filter {
  min-width: 220px;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm run test --workspace=@bitbutler/app`
Expected: PASS - all `TextColumnFilter` tests green.

- [ ] **Step 5: Lint**

Run: `npm run lint`
Expected: zero warnings/errors.

- [ ] **Step 6: Commit**

```bash
git add packages/app/src/app/components/column-filters/text-column-filter
git commit -m "$(cat <<'EOF'
#216: add TextColumnFilter

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: Number column filter

**Files:**

- Create: `packages/app/src/app/components/column-filters/number-column-filter/number-column-filter.ts`
- Create: `packages/app/src/app/components/column-filters/number-column-filter/number-column-filter.html`
- Create: `packages/app/src/app/components/column-filters/number-column-filter/number-column-filter.scss`
- Test: `packages/app/src/app/components/column-filters/number-column-filter/number-column-filter.spec.ts`

**Interfaces:**

- Consumes: `OperatorFilterBase<TValue>` (Task 4); `NumberFilterOperator`, `NUMBER_FILTER_OPERATORS`, `NUMBER_OPERATOR_LABEL_KEYS`, `numberOperatorPasses` (Task 1); `BbBtnContent`; i18n keys from Task 2.
- Produces: `export interface NumberFilterValue { operator: NumberFilterOperator; from: number | null; to: number | null }`; `export class NumberColumnFilter extends OperatorFilterBase<NumberFilterValue> implements IFilterAngularComp`. Task 9 wires this onto plain/`_raw` numeric columns. Task 7 (Size filter) follows the same shape with a `unit` field added.

- [ ] **Step 1: Write the failing test**

Create `packages/app/src/app/components/column-filters/number-column-filter/number-column-filter.spec.ts`:

```ts
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NumberColumnFilter } from './number-column-filter';

describe('NumberColumnFilter', () => {
  let component: NumberColumnFilter;
  let fixture: ComponentFixture<NumberColumnFilter>;
  let mockParams: any;

  beforeEach(async () => {
    mockParams = {
      filterChangedCallback: vi.fn(),
      getValue: vi.fn((node: { data: any }) => node.data?.ratio),
    };

    await TestBed.configureTestingModule({
      imports: [NumberColumnFilter],
    }).compileComponents();

    fixture = TestBed.createComponent(NumberColumnFilter);
    component = fixture.componentInstance;
    component.agInit(mockParams);
    fixture.detectChanges();
  });

  it('should create with an inactive default filter', () => {
    expect(component).toBeTruthy();
    expect(component.isFilterActive()).toBe(false);
  });

  it('exposes all 9 number operators, translated', () => {
    expect(component.operatorItems()).toHaveLength(9);
    expect(component.operatorItems().map((o) => o.value)).toEqual([
      'equals',
      'notEqual',
      'gt',
      'gte',
      'lt',
      'lte',
      'between',
      'blank',
      'notBlank',
    ]);
  });

  describe('doesFilterPass', () => {
    it('passes everything when the filter is inactive', () => {
      expect(component.doesFilterPass({ node: { data: { ratio: 1.5 } } } as any)).toBe(true);
    });

    it('applies gte against the applied "from" using getValue', () => {
      component.applied = { operator: 'gte', from: 1, to: null };
      expect(component.doesFilterPass({ node: { data: { ratio: 1 } } } as any)).toBe(true);
      expect(mockParams.getValue).toHaveBeenCalled();
      expect(component.doesFilterPass({ node: { data: { ratio: 0.5 } } } as any)).toBe(false);
    });

    it('between is inclusive on both ends', () => {
      component.applied = { operator: 'between', from: 1, to: 2 };
      expect(component.doesFilterPass({ node: { data: { ratio: 1 } } } as any)).toBe(true);
      expect(component.doesFilterPass({ node: { data: { ratio: 2 } } } as any)).toBe(true);
      expect(component.doesFilterPass({ node: { data: { ratio: 2.1 } } } as any)).toBe(false);
    });
  });

  describe('isActive', () => {
    it('is active for blank/notBlank regardless of from/to', () => {
      expect(component.isActive({ operator: 'blank', from: null, to: null })).toBe(true);
      expect(component.isActive({ operator: 'notBlank', from: null, to: null })).toBe(true);
    });

    it('requires "from" for single-value operators', () => {
      expect(component.isActive({ operator: 'gt', from: null, to: null })).toBe(false);
      expect(component.isActive({ operator: 'gt', from: 1, to: null })).toBe(true);
    });

    it('requires both "from" and "to" for between', () => {
      expect(component.isActive({ operator: 'between', from: 1, to: null })).toBe(false);
      expect(component.isActive({ operator: 'between', from: 1, to: 2 })).toBe(true);
    });
  });

  describe('isInputDisabled', () => {
    it('disables the value inputs for blank and not-blank operators', () => {
      component.draft = { operator: 'blank', from: null, to: null };
      expect(component.isInputDisabled()).toBe(true);
      component.draft = { operator: 'equals', from: null, to: null };
      expect(component.isInputDisabled()).toBe(false);
    });
  });

  describe('getModel / setModel', () => {
    it('returns null when the filter is inactive', () => {
      expect(component.getModel()).toBeNull();
    });

    it('restores both draft and applied from a model', () => {
      component.setModel({ operator: 'between', from: 1, to: 2 });
      expect(component.applied).toEqual({ operator: 'between', from: 1, to: 2 });
      expect(component.draft).toEqual({ operator: 'between', from: 1, to: 2 });
    });

    it('resets to an empty value when the model is null', () => {
      component.applied = { operator: 'gt', from: 1, to: null };
      component.setModel(null);
      expect(component.applied).toEqual({ operator: 'equals', from: null, to: null });
    });
  });

  describe('apply / clear', () => {
    it('apply copies draft into applied and calls filterChangedCallback', () => {
      component.draft = { operator: 'gt', from: 5, to: null };
      component.apply();
      expect(component.applied).toEqual({ operator: 'gt', from: 5, to: null });
      expect(mockParams.filterChangedCallback).toHaveBeenCalled();
    });

    it('clear resets both draft and applied and calls filterChangedCallback', () => {
      component.applied = { operator: 'gt', from: 5, to: null };
      component.draft = { operator: 'gt', from: 5, to: null };
      component.clear();
      expect(component.applied).toEqual({ operator: 'equals', from: null, to: null });
      expect(mockParams.filterChangedCallback).toHaveBeenCalled();
    });
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run test --workspace=@bitbutler/app`
Expected: FAIL - `NumberColumnFilter` does not exist.

- [ ] **Step 3: Implement the component**

Create `packages/app/src/app/components/column-filters/number-column-filter/number-column-filter.ts`:

```ts
import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { faCheck, faEraser } from '@fortawesome/free-solid-svg-icons';
import { NgSelectModule } from '@ng-select/ng-select';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { IFilterAngularComp } from 'ag-grid-angular';
import { IDoesFilterPassParams } from 'ag-grid-community';
import { BbBtnContent } from '../../bb-btn-content/bb-btn-content';
import { OperatorFilterBase } from '../operator-filter-base';
import {
  NUMBER_FILTER_OPERATORS,
  NUMBER_OPERATOR_LABEL_KEYS,
  NumberFilterOperator,
  numberOperatorPasses,
} from '../operator-filter.utils';

export interface NumberFilterValue {
  operator: NumberFilterOperator;
  from: number | null;
  to: number | null;
}

function createEmptyNumberValue(): NumberFilterValue {
  return { operator: 'equals', from: null, to: null };
}

@Component({
  selector: 'app-number-column-filter',
  standalone: true,
  imports: [FormsModule, NgSelectModule, FontAwesomeModule, TranslateModule, BbBtnContent],
  templateUrl: './number-column-filter.html',
  styleUrl: './number-column-filter.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NumberColumnFilter
  extends OperatorFilterBase<NumberFilterValue>
  implements IFilterAngularComp
{
  private readonly translateService = inject(TranslateService);
  private readonly languageChanged = toSignal(this.translateService.onLangChange);

  public readonly icons = { faCheck, faEraser };

  draft: NumberFilterValue = createEmptyNumberValue();
  applied: NumberFilterValue = createEmptyNumberValue();

  readonly operatorItems = computed(() => {
    this.languageChanged();
    return NUMBER_FILTER_OPERATORS.map((value) => ({
      value,
      label: this.translateService.instant(NUMBER_OPERATOR_LABEL_KEYS[value]),
    }));
  });

  createEmptyValue(): NumberFilterValue {
    return createEmptyNumberValue();
  }

  valuesEqual(a: NumberFilterValue, b: NumberFilterValue): boolean {
    return a.operator === b.operator && a.from === b.from && a.to === b.to;
  }

  isActive(value: NumberFilterValue): boolean {
    if (value.operator === 'blank' || value.operator === 'notBlank') return true;
    if (value.operator === 'between') return value.from != null && value.to != null;
    return value.from != null;
  }

  isInputDisabled(): boolean {
    return this.draft.operator === 'blank' || this.draft.operator === 'notBlank';
  }

  doesFilterPass(params: IDoesFilterPassParams): boolean {
    if (!this.isFilterActive()) return true;
    const cellValue = this.params.getValue(params.node) as number | null | undefined;
    return numberOperatorPasses(
      this.applied.operator,
      cellValue,
      this.applied.from,
      this.applied.to,
    );
  }
}
```

Create `packages/app/src/app/components/column-filters/number-column-filter/number-column-filter.html`:

```html
<div
  class="bb-column-filter p-2"
  (mousedown)="$event.stopPropagation()"
  (touchstart)="$event.stopPropagation()"
>
  <ng-select
    [items]="operatorItems()"
    bindLabel="label"
    bindValue="value"
    [clearable]="false"
    [searchable]="false"
    [(ngModel)]="draft.operator"
    class="mb-2"
  ></ng-select>

  <div class="d-flex gap-2 mb-2">
    <input
      type="number"
      class="form-control form-control-sm"
      [(ngModel)]="draft.from"
      [disabled]="isInputDisabled()"
      [placeholder]="
        draft.operator === 'between'
          ? ('components.column-filters.label.from' | translate)
          : ('components.column-filters.label.value' | translate)
      "
    />
    @if (draft.operator === 'between') {
    <input
      type="number"
      class="form-control form-control-sm"
      [(ngModel)]="draft.to"
      [disabled]="isInputDisabled()"
      [placeholder]="'components.column-filters.label.to' | translate"
    />
    }
  </div>

  <div class="d-flex gap-2">
    <button
      class="btn btn-sm btn-outline-secondary btn-split flex-fill"
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
      class="btn btn-sm btn-outline-primary btn-split flex-fill"
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
</div>
```

Create `packages/app/src/app/components/column-filters/number-column-filter/number-column-filter.scss`:

```scss
:host {
  display: block;
}

.bb-column-filter {
  min-width: 220px;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm run test --workspace=@bitbutler/app`
Expected: PASS - all `NumberColumnFilter` tests green.

- [ ] **Step 5: Lint**

Run: `npm run lint`
Expected: zero warnings/errors.

- [ ] **Step 6: Commit**

```bash
git add packages/app/src/app/components/column-filters/number-column-filter
git commit -m "$(cat <<'EOF'
#216: add NumberColumnFilter

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: Size column filter

**Files:**

- Create: `packages/app/src/app/components/column-filters/size-column-filter/size-column-filter.ts`
- Create: `packages/app/src/app/components/column-filters/size-column-filter/size-column-filter.html`
- Create: `packages/app/src/app/components/column-filters/size-column-filter/size-column-filter.scss`
- Test: `packages/app/src/app/components/column-filters/size-column-filter/size-column-filter.spec.ts`

**Interfaces:**

- Consumes: `OperatorFilterBase<TValue>` (Task 4); `NumberFilterOperator`, `NUMBER_FILTER_OPERATORS`, `NUMBER_OPERATOR_LABEL_KEYS`, `numberOperatorPasses` (Task 1); `BbBtnContent`.
- Produces: `export type SizeUnit = 'B' | 'KB' | 'MB' | 'GB' | 'TB'`; `export interface SizeFilterValue { operator: NumberFilterOperator; from: number | null; to: number | null; unit: SizeUnit }`; `export class SizeColumnFilter extends OperatorFilterBase<SizeFilterValue> implements IFilterAngularComp`. Task 9 wires this onto the byte-valued formatted columns (`size`, `downloaded`, `uploaded`, speeds, limits, etc.).

- [ ] **Step 1: Write the failing test**

Create `packages/app/src/app/components/column-filters/size-column-filter/size-column-filter.spec.ts`:

```ts
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { SizeColumnFilter } from './size-column-filter';

describe('SizeColumnFilter', () => {
  let component: SizeColumnFilter;
  let fixture: ComponentFixture<SizeColumnFilter>;
  let mockParams: any;

  beforeEach(async () => {
    mockParams = {
      filterChangedCallback: vi.fn(),
      getValue: vi.fn((node: { data: any }) => node.data?.size),
    };

    await TestBed.configureTestingModule({
      imports: [SizeColumnFilter],
    }).compileComponents();

    fixture = TestBed.createComponent(SizeColumnFilter);
    component = fixture.componentInstance;
    component.agInit(mockParams);
    fixture.detectChanges();
  });

  it('should create with an inactive default filter using MB as the default unit', () => {
    expect(component).toBeTruthy();
    expect(component.isFilterActive()).toBe(false);
    expect(component.applied.unit).toBe('MB');
  });

  it('exposes all 5 units', () => {
    expect(component.unitItems.map((u) => u.value)).toEqual(['B', 'KB', 'MB', 'GB', 'TB']);
  });

  describe('doesFilterPass', () => {
    it('passes everything when the filter is inactive', () => {
      expect(component.doesFilterPass({ node: { data: { size: 123 } } } as any)).toBe(true);
    });

    it('scales the applied "from" by the selected unit before comparing raw bytes', () => {
      component.applied = { operator: 'gte', from: 1, to: null, unit: 'MB' };
      expect(component.doesFilterPass({ node: { data: { size: 1024 * 1024 } } } as any)).toBe(true);
      expect(mockParams.getValue).toHaveBeenCalled();
      expect(component.doesFilterPass({ node: { data: { size: 1024 * 1024 - 1 } } } as any)).toBe(
        false,
      );
    });

    it('applies GB scaling for between', () => {
      component.applied = { operator: 'between', from: 1, to: 2, unit: 'GB' };
      const oneGb = 1024 ** 3;
      expect(component.doesFilterPass({ node: { data: { size: oneGb } } } as any)).toBe(true);
      expect(component.doesFilterPass({ node: { data: { size: 2 * oneGb } } } as any)).toBe(true);
      expect(component.doesFilterPass({ node: { data: { size: 2 * oneGb + 1 } } } as any)).toBe(
        false,
      );
    });

    it('B unit does not scale the value', () => {
      component.applied = { operator: 'equals', from: 512, to: null, unit: 'B' };
      expect(component.doesFilterPass({ node: { data: { size: 512 } } } as any)).toBe(true);
    });
  });

  describe('getModel / setModel', () => {
    it('round-trips the unit alongside operator/from/to', () => {
      component.setModel({ operator: 'lte', from: 5, to: null, unit: 'TB' });
      expect(component.applied).toEqual({ operator: 'lte', from: 5, to: null, unit: 'TB' });
      expect(component.getModel()).toEqual({ operator: 'lte', from: 5, to: null, unit: 'TB' });
    });

    it('resets to the default (MB) unit when the model is null', () => {
      component.applied = { operator: 'lte', from: 5, to: null, unit: 'TB' };
      component.setModel(null);
      expect(component.applied.unit).toBe('MB');
    });
  });

  describe('apply / clear', () => {
    it('apply copies draft (including unit) into applied and calls filterChangedCallback', () => {
      component.draft = { operator: 'gt', from: 5, to: null, unit: 'GB' };
      component.apply();
      expect(component.applied).toEqual({ operator: 'gt', from: 5, to: null, unit: 'GB' });
      expect(mockParams.filterChangedCallback).toHaveBeenCalled();
    });
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run test --workspace=@bitbutler/app`
Expected: FAIL - `SizeColumnFilter` does not exist.

- [ ] **Step 3: Implement the component**

Create `packages/app/src/app/components/column-filters/size-column-filter/size-column-filter.ts`:

```ts
import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { faCheck, faEraser } from '@fortawesome/free-solid-svg-icons';
import { NgSelectModule } from '@ng-select/ng-select';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { IFilterAngularComp } from 'ag-grid-angular';
import { IDoesFilterPassParams } from 'ag-grid-community';
import { BbBtnContent } from '../../bb-btn-content/bb-btn-content';
import { OperatorFilterBase } from '../operator-filter-base';
import {
  NUMBER_FILTER_OPERATORS,
  NUMBER_OPERATOR_LABEL_KEYS,
  NumberFilterOperator,
  numberOperatorPasses,
} from '../operator-filter.utils';

export type SizeUnit = 'B' | 'KB' | 'MB' | 'GB' | 'TB';

export interface SizeFilterValue {
  operator: NumberFilterOperator;
  from: number | null;
  to: number | null;
  unit: SizeUnit;
}

const UNIT_MULTIPLIERS: Record<SizeUnit, number> = {
  B: 1,
  KB: 1024,
  MB: 1024 ** 2,
  GB: 1024 ** 3,
  TB: 1024 ** 4,
};

function createEmptySizeValue(): SizeFilterValue {
  return { operator: 'equals', from: null, to: null, unit: 'MB' };
}

@Component({
  selector: 'app-size-column-filter',
  standalone: true,
  imports: [FormsModule, NgSelectModule, FontAwesomeModule, TranslateModule, BbBtnContent],
  templateUrl: './size-column-filter.html',
  styleUrl: './size-column-filter.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SizeColumnFilter
  extends OperatorFilterBase<SizeFilterValue>
  implements IFilterAngularComp
{
  private readonly translateService = inject(TranslateService);
  private readonly languageChanged = toSignal(this.translateService.onLangChange);

  public readonly icons = { faCheck, faEraser };
  public readonly unitItems: { value: SizeUnit; label: string }[] = [
    { value: 'B', label: 'B' },
    { value: 'KB', label: 'KB' },
    { value: 'MB', label: 'MB' },
    { value: 'GB', label: 'GB' },
    { value: 'TB', label: 'TB' },
  ];

  draft: SizeFilterValue = createEmptySizeValue();
  applied: SizeFilterValue = createEmptySizeValue();

  readonly operatorItems = computed(() => {
    this.languageChanged();
    return NUMBER_FILTER_OPERATORS.map((value) => ({
      value,
      label: this.translateService.instant(NUMBER_OPERATOR_LABEL_KEYS[value]),
    }));
  });

  createEmptyValue(): SizeFilterValue {
    return createEmptySizeValue();
  }

  valuesEqual(a: SizeFilterValue, b: SizeFilterValue): boolean {
    return a.operator === b.operator && a.from === b.from && a.to === b.to && a.unit === b.unit;
  }

  isActive(value: SizeFilterValue): boolean {
    if (value.operator === 'blank' || value.operator === 'notBlank') return true;
    if (value.operator === 'between') return value.from != null && value.to != null;
    return value.from != null;
  }

  isInputDisabled(): boolean {
    return this.draft.operator === 'blank' || this.draft.operator === 'notBlank';
  }

  doesFilterPass(params: IDoesFilterPassParams): boolean {
    if (!this.isFilterActive()) return true;
    const cellValue = this.params.getValue(params.node) as number | null | undefined;
    const multiplier = UNIT_MULTIPLIERS[this.applied.unit];
    const from = this.applied.from != null ? this.applied.from * multiplier : null;
    const to = this.applied.to != null ? this.applied.to * multiplier : null;
    return numberOperatorPasses(this.applied.operator, cellValue, from, to);
  }
}
```

Create `packages/app/src/app/components/column-filters/size-column-filter/size-column-filter.html`:

```html
<div
  class="bb-column-filter p-2"
  (mousedown)="$event.stopPropagation()"
  (touchstart)="$event.stopPropagation()"
>
  <ng-select
    [items]="operatorItems()"
    bindLabel="label"
    bindValue="value"
    [clearable]="false"
    [searchable]="false"
    [(ngModel)]="draft.operator"
    class="mb-2"
  ></ng-select>

  <ng-select
    [items]="unitItems"
    bindLabel="label"
    bindValue="value"
    [clearable]="false"
    [searchable]="false"
    [(ngModel)]="draft.unit"
    class="mb-2"
  ></ng-select>

  <div class="d-flex gap-2 mb-2">
    <input
      type="number"
      class="form-control form-control-sm"
      [(ngModel)]="draft.from"
      [disabled]="isInputDisabled()"
      [placeholder]="
        draft.operator === 'between'
          ? ('components.column-filters.label.from' | translate)
          : ('components.column-filters.label.value' | translate)
      "
    />
    @if (draft.operator === 'between') {
    <input
      type="number"
      class="form-control form-control-sm"
      [(ngModel)]="draft.to"
      [disabled]="isInputDisabled()"
      [placeholder]="'components.column-filters.label.to' | translate"
    />
    }
  </div>

  <div class="d-flex gap-2">
    <button
      class="btn btn-sm btn-outline-secondary btn-split flex-fill"
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
      class="btn btn-sm btn-outline-primary btn-split flex-fill"
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
</div>
```

Create `packages/app/src/app/components/column-filters/size-column-filter/size-column-filter.scss`:

```scss
:host {
  display: block;
}

.bb-column-filter {
  min-width: 220px;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm run test --workspace=@bitbutler/app`
Expected: PASS - all `SizeColumnFilter` tests green.

- [ ] **Step 5: Lint**

Run: `npm run lint`
Expected: zero warnings/errors.

- [ ] **Step 6: Commit**

```bash
git add packages/app/src/app/components/column-filters/size-column-filter
git commit -m "$(cat <<'EOF'
#216: add SizeColumnFilter

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 8: Hoist distinct-value counts into TorrentStoreService

**Files:**

- Modify: `packages/app/src/app/services/torrent-store.service.ts`
- Modify: `packages/app/src/app/services/torrent-store.service.spec.ts`
- Modify: `packages/app/src/app/pages/main/status/status.ts`
- Modify: `packages/app/src/app/pages/main/status/status.spec.ts`

**Interfaces:**

- Produces: `export interface ValueCount { key: string; label: string; count: number }`; `TorrentStoreService.categoriesWithCounts: Signal<ValueCount[]>`, `.tagsWithCounts: Signal<ValueCount[]>`, `.statesWithCounts: Signal<ValueCount[]>`. Task 10 (Set filter) consumes these directly; `Status` (this task) wraps them with icons for its own `FilterItem[]` display.

- [ ] **Step 1: Write the failing tests**

In `packages/app/src/app/services/torrent-store.service.spec.ts`, add these `describe` blocks before the final closing `});` of the file (after the existing `'should return delta from applyMaindata'` test):

```ts
describe('categoriesWithCounts', () => {
  it('includes known categories with zero torrents', () => {
    service.applyMaindata(
      makeMaindata({
        full_update: true,
        categories: { Movies: { name: 'Movies', savePath: '/movies' } },
      }),
    );

    const result = service.categoriesWithCounts();
    expect(result).toEqual([{ key: 'Movies', label: 'Movies', count: 0 }]);
  });

  it('counts torrents per category and sorts by label', () => {
    service.applyMaindata(
      makeMaindata({
        full_update: true,
        torrents: {
          a: { category: 'Movies' } as TorrentDelta,
          b: { category: 'Movies' } as TorrentDelta,
          c: { category: 'Books' } as TorrentDelta,
        },
      }),
    );

    expect(service.categoriesWithCounts()).toEqual([
      { key: 'Books', label: 'Books', count: 1 },
      { key: 'Movies', label: 'Movies', count: 2 },
    ]);
  });
});

describe('tagsWithCounts', () => {
  it('includes known tags with zero torrents', () => {
    service.applyMaindata(makeMaindata({ full_update: true, tags: ['hd'] }));

    expect(service.tagsWithCounts()).toEqual([{ key: 'hd', label: 'hd', count: 0 }]);
  });

  it('counts torrents per comma-separated tag and sorts by label', () => {
    service.applyMaindata(
      makeMaindata({
        full_update: true,
        torrents: {
          a: { tags: 'hd, 4k' } as TorrentDelta,
          b: { tags: 'hd' } as TorrentDelta,
        },
      }),
    );

    expect(service.tagsWithCounts()).toEqual([
      { key: '4k', label: '4k', count: 1 },
      { key: 'hd', label: 'hd', count: 2 },
    ]);
  });
});

describe('statesWithCounts', () => {
  it('is empty with no torrents', () => {
    expect(service.statesWithCounts()).toEqual([]);
  });

  it('counts torrents per raw state and sorts alphabetically', () => {
    service.applyMaindata(
      makeMaindata({
        full_update: true,
        torrents: {
          a: { state: 'downloading' } as TorrentDelta,
          b: { state: 'downloading' } as TorrentDelta,
          c: { state: 'uploading' } as TorrentDelta,
        },
      }),
    );

    expect(service.statesWithCounts()).toEqual([
      { key: 'downloading', label: 'downloading', count: 2 },
      { key: 'uploading', label: 'uploading', count: 1 },
    ]);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run test --workspace=@bitbutler/app`
Expected: FAIL - `categoriesWithCounts`/`tagsWithCounts`/`statesWithCounts` do not exist on `TorrentStoreService`.

- [ ] **Step 3: Add the computed signals to `TorrentStoreService`**

In `packages/app/src/app/services/torrent-store.service.ts`, add the `ValueCount` interface near the top (after the existing `TorrentTxnDelta`/`TorrentFinishedEvent` types) and the three computed signals after `countsByState`:

```ts
export interface ValueCount {
  key: string;
  label: string;
  count: number;
}
```

```ts
  readonly categoriesWithCounts = computed<ValueCount[]>(() => {
    const counts = new Map<string, number>();
    for (const t of this._torrents().values()) {
      if (t.category) {
        counts.set(t.category, (counts.get(t.category) ?? 0) + 1);
      }
    }

    const names = new Set([...this._categories().keys(), ...counts.keys()]);
    return [...names]
      .map((name) => ({ key: name, label: name, count: counts.get(name) ?? 0 }))
      .sort((a, b) => a.label.localeCompare(b.label));
  });

  readonly tagsWithCounts = computed<ValueCount[]>(() => {
    const counts = new Map<string, number>();
    for (const t of this._torrents().values()) {
      if (t.tags) {
        for (const tag of t.tags.split(',').map((s) => s.trim()).filter(Boolean)) {
          counts.set(tag, (counts.get(tag) ?? 0) + 1);
        }
      }
    }

    const names = new Set([...this._tags(), ...counts.keys()]);
    return [...names]
      .map((name) => ({ key: name, label: name, count: counts.get(name) ?? 0 }))
      .sort((a, b) => a.label.localeCompare(b.label));
  });

  readonly statesWithCounts = computed<ValueCount[]>(() => {
    const counts = this.countsByState();
    return Object.entries(counts)
      .map(([key, count]) => ({ key, label: key, count: count ?? 0 }))
      .sort((a, b) => a.label.localeCompare(b.label));
  });
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm run test --workspace=@bitbutler/app`
Expected: PASS - the new `TorrentStoreService` describe blocks are green.

- [ ] **Step 5: Update `Status` to consume the hoisted signals**

In `packages/app/src/app/pages/main/status/status.ts`, find this type declaration near the top of the file (just above the `@Component` decorator):

```ts
type CountItem = { key: string; label: string; count: number };
```

Delete it - it's no longer used once the computation below moves out of this file.

Then find these two existing computed signals:

```ts
  readonly categoriesWithCounts = computed<FilterItem[]>(() => {
    const torrents = this.store.torrentsArray();
    const categories = this.store.categoriesMap();
    const counts = new Map<string, number>();

    for (const t of torrents) {
      if (t.category) {
        counts.set(t.category, (counts.get(t.category) ?? 0) + 1);
      }
    }

    const allCategoryNames = new Set([...categories.keys(), ...counts.keys()]);
    const result: FilterItem[] = [];

    allCategoryNames.forEach((name) => {
      result.push({
        key: name,
        label: name,
        count: counts.get(name) ?? 0,
        icon: this.icon.faFolderTree,
      });
    });

    return result.sort((a, b) => a.label.localeCompare(b.label));
  });
```

```ts
  readonly tagsWithCounts = computed<FilterItem[]>(() => {
    const torrents = this.store.torrentsArray();
    const allTags = this.store.tagsSet();
    const counts = new Map<string, number>();

    for (const t of torrents) {
      if (t.tags) {
        const tags = t.tags
          .split(',')
          .map((tag) => tag.trim())
          .filter(Boolean);
        for (const tag of tags) {
          counts.set(tag, (counts.get(tag) ?? 0) + 1);
        }
      }
    }

    const allTagNames = new Set([...allTags, ...counts.keys()]);
    const result: FilterItem[] = [];

    allTagNames.forEach((name) => {
      result.push({
        key: name,
        label: name,
        count: counts.get(name) ?? 0,
        icon: this.icon.faTags,
      });
    });

    return result.sort((a, b) => a.label.localeCompare(b.label));
  });
```

Replace both of them with these thin wrappers around the store's new signals:

```ts
  readonly categoriesWithCounts = computed<FilterItem[]>(() =>
    this.store
      .categoriesWithCounts()
      .map((item) => ({ ...item, icon: this.icon.faFolderTree })),
  );

  readonly tagsWithCounts = computed<FilterItem[]>(() =>
    this.store.tagsWithCounts().map((item) => ({ ...item, icon: this.icon.faTags })),
  );
```

Everything else in the file (`trackersWithCounts`, `savePathsWithCounts`, the rest of the class) is unchanged.

- [ ] **Step 6: Update the `Status` mock in its spec**

In `packages/app/src/app/pages/main/status/status.spec.ts`, update the `torrentStoreMock` type and value:

```ts
let torrentStoreMock: {
  totalCount: ReturnType<typeof signal<number>>;
  countsByState: ReturnType<typeof signal<Record<string, number>>>;
  torrentsArray: ReturnType<typeof signal<any[]>>;
  categoriesWithCounts: ReturnType<typeof signal<{ key: string; label: string; count: number }[]>>;
  tagsWithCounts: ReturnType<typeof signal<{ key: string; label: string; count: number }[]>>;
};
```

```ts
torrentStoreMock = {
  totalCount: signal(0),
  countsByState: signal({}),
  torrentsArray: signal([]),
  categoriesWithCounts: signal([]),
  tagsWithCounts: signal([]),
};
```

(This removes `categoriesMap`/`tagsSet` from the mock - `Status` no longer reads them directly.)

- [ ] **Step 7: Run the full app test suite**

Run: `npm run test --workspace=@bitbutler/app`
Expected: PASS - `TorrentStoreService` and `Status` specs both green, no regressions elsewhere.

- [ ] **Step 8: Lint**

Run: `npm run lint`
Expected: zero warnings/errors.

- [ ] **Step 9: Commit**

```bash
git add packages/app/src/app/services/torrent-store.service.ts packages/app/src/app/services/torrent-store.service.spec.ts packages/app/src/app/pages/main/status/status.ts packages/app/src/app/pages/main/status/status.spec.ts
git commit -m "$(cat <<'EOF'
#216: hoist category/tag/state count computation into TorrentStoreService

Moves the distinct-value + count logic that used to live only in the
Status sidebar component into shared computed signals, so the new
SetColumnFilter can reuse it instead of duplicating it.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 9: Set (checkbox) column filter

**Files:**

- Create: `packages/app/src/app/components/column-filters/set-column-filter/set-column-filter.ts`
- Create: `packages/app/src/app/components/column-filters/set-column-filter/set-column-filter.html`
- Create: `packages/app/src/app/components/column-filters/set-column-filter/set-column-filter.scss`
- Test: `packages/app/src/app/components/column-filters/set-column-filter/set-column-filter.spec.ts`

**Interfaces:**

- Consumes: `TorrentStoreService.categoriesWithCounts/tagsWithCounts/statesWithCounts` and `ValueCount` (Task 8); `BbBtnContent`; i18n keys from Task 2.
- Produces: `export type SetColumnFilterSource = 'state' | 'category' | 'tags'`; `export interface SetColumnFilterParams extends IFilterParams { source: SetColumnFilterSource }`; `export interface SetFilterValue { values: string[] }`; `export class SetColumnFilter implements IFilterAngularComp`. Task 10 wires this onto `state`, `state_hr`, `category`, `tags` columns with the matching `filterParams.source`.

- [ ] **Step 1: Write the failing test**

Create `packages/app/src/app/components/column-filters/set-column-filter/set-column-filter.spec.ts`:

```ts
import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TorrentStoreService } from '../../../services/torrent-store.service';
import { SetColumnFilter } from './set-column-filter';

describe('SetColumnFilter', () => {
  let component: SetColumnFilter;
  let fixture: ComponentFixture<SetColumnFilter>;
  let mockParams: any;
  let storeMock: {
    categoriesWithCounts: ReturnType<
      typeof signal<{ key: string; label: string; count: number }[]>
    >;
    tagsWithCounts: ReturnType<typeof signal<{ key: string; label: string; count: number }[]>>;
    statesWithCounts: ReturnType<typeof signal<{ key: string; label: string; count: number }[]>>;
  };

  beforeEach(async () => {
    storeMock = {
      categoriesWithCounts: signal([
        { key: 'Movies', label: 'Movies', count: 3 },
        { key: 'Books', label: 'Books', count: 1 },
      ]),
      tagsWithCounts: signal([{ key: 'hd', label: 'hd', count: 2 }]),
      statesWithCounts: signal([{ key: 'downloading', label: 'downloading', count: 5 }]),
    };

    mockParams = {
      source: 'category',
      filterChangedCallback: vi.fn(),
      getValue: vi.fn((node: { data: any }) => node.data?.category),
    };

    await TestBed.configureTestingModule({
      imports: [SetColumnFilter],
      providers: [{ provide: TorrentStoreService, useValue: storeMock }],
    }).compileComponents();

    fixture = TestBed.createComponent(SetColumnFilter);
    component = fixture.componentInstance;
    component.agInit(mockParams);
    fixture.detectChanges();
  });

  it('should create with an inactive default filter', () => {
    expect(component).toBeTruthy();
    expect(component.isFilterActive()).toBe(false);
  });

  it('reads its item list from the source given in filterParams', () => {
    expect(component.items()).toEqual([
      { key: 'Movies', label: 'Movies', count: 3 },
      { key: 'Books', label: 'Books', count: 1 },
    ]);
  });

  describe('toggle', () => {
    it('adds and removes keys from draftValues', () => {
      component.toggle('Movies');
      expect(component.draftValues.has('Movies')).toBe(true);
      component.toggle('Movies');
      expect(component.draftValues.has('Movies')).toBe(false);
    });
  });

  describe('doesFilterPass', () => {
    it('passes everything when no values are applied', () => {
      expect(component.doesFilterPass({ node: { data: { category: 'Movies' } } } as any)).toBe(
        true,
      );
    });

    it('matches an exact selected category using getValue', () => {
      component.appliedValues = new Set(['Movies']);
      expect(component.doesFilterPass({ node: { data: { category: 'Movies' } } } as any)).toBe(
        true,
      );
      expect(mockParams.getValue).toHaveBeenCalled();
      expect(component.doesFilterPass({ node: { data: { category: 'Books' } } } as any)).toBe(
        false,
      );
    });

    it('matches tags by overlap when source is tags', () => {
      mockParams.source = 'tags';
      mockParams.getValue = vi.fn((node: { data: any }) => node.data?.tags);
      component.agInit(mockParams);
      component.appliedValues = new Set(['hd']);
      expect(component.doesFilterPass({ node: { data: { tags: 'hd, 4k' } } } as any)).toBe(true);
      expect(component.doesFilterPass({ node: { data: { tags: '4k' } } } as any)).toBe(false);
    });
  });

  describe('getModel / setModel', () => {
    it('returns null when nothing is applied', () => {
      expect(component.getModel()).toBeNull();
    });

    it('round-trips applied values through get/setModel', () => {
      component.setModel({ values: ['Movies', 'Books'] });
      expect(component.appliedValues).toEqual(new Set(['Movies', 'Books']));
      expect(component.draftValues).toEqual(new Set(['Movies', 'Books']));
      expect(component.getModel()).toEqual({ values: ['Movies', 'Books'] });
    });
  });

  describe('apply / clear', () => {
    it('apply copies draftValues into appliedValues and calls filterChangedCallback', () => {
      component.toggle('Movies');
      component.apply();
      expect(component.appliedValues).toEqual(new Set(['Movies']));
      expect(mockParams.filterChangedCallback).toHaveBeenCalled();
    });

    it('clear resets both draftValues and appliedValues and calls filterChangedCallback', () => {
      component.appliedValues = new Set(['Movies']);
      component.draftValues = new Set(['Movies']);
      component.clear();
      expect(component.appliedValues.size).toBe(0);
      expect(component.draftValues.size).toBe(0);
      expect(mockParams.filterChangedCallback).toHaveBeenCalled();
    });
  });

  describe('isApplyDisabled', () => {
    it('is true when draftValues matches appliedValues', () => {
      component.draftValues = new Set(['Movies']);
      component.appliedValues = new Set(['Movies']);
      expect(component.isApplyDisabled()).toBe(true);
    });

    it('is false when draftValues differs from appliedValues', () => {
      component.draftValues = new Set(['Movies', 'Books']);
      component.appliedValues = new Set(['Movies']);
      expect(component.isApplyDisabled()).toBe(false);
    });
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run test --workspace=@bitbutler/app`
Expected: FAIL - `SetColumnFilter` does not exist.

- [ ] **Step 3: Implement the component**

Create `packages/app/src/app/components/column-filters/set-column-filter/set-column-filter.ts`:

```ts
import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormControl, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { faCheck, faEraser, faXmark } from '@fortawesome/free-solid-svg-icons';
import { TranslateModule } from '@ngx-translate/core';
import { IFilterAngularComp } from 'ag-grid-angular';
import { IAfterGuiAttachedParams, IDoesFilterPassParams, IFilterParams } from 'ag-grid-community';
import { debounceTime, startWith } from 'rxjs/operators';
import { TorrentStoreService, ValueCount } from '../../../services/torrent-store.service';
import { BbBtnContent } from '../../bb-btn-content/bb-btn-content';

const FILTER_DEBOUNCE_MS = 150;

export type SetColumnFilterSource = 'state' | 'category' | 'tags';

export interface SetColumnFilterParams extends IFilterParams {
  source: SetColumnFilterSource;
}

export interface SetFilterValue {
  values: string[];
}

@Component({
  selector: 'app-set-column-filter',
  standalone: true,
  imports: [FormsModule, ReactiveFormsModule, FontAwesomeModule, TranslateModule, BbBtnContent],
  templateUrl: './set-column-filter.html',
  styleUrl: './set-column-filter.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SetColumnFilter implements IFilterAngularComp {
  private readonly store = inject(TorrentStoreService);
  private params!: SetColumnFilterParams;

  public readonly icons = { faCheck, faEraser, faXmark };
  public filterCtrl = new FormControl('', { nonNullable: true });

  draftValues = new Set<string>();
  appliedValues = new Set<string>();

  private readonly searchText = toSignal(
    this.filterCtrl.valueChanges.pipe(startWith(''), debounceTime(FILTER_DEBOUNCE_MS)),
    { initialValue: '' },
  );

  readonly items = computed<ValueCount[]>(() => {
    switch (this.params?.source) {
      case 'category':
        return this.store.categoriesWithCounts();
      case 'tags':
        return this.store.tagsWithCounts();
      default:
        return this.store.statesWithCounts();
    }
  });

  readonly filteredItems = computed<ValueCount[]>(() => {
    const text = this.searchText().toLowerCase();
    return this.items().filter((item) => item.label.toLowerCase().includes(text));
  });

  agInit(params: SetColumnFilterParams): void {
    this.params = params;
  }

  isFilterActive(): boolean {
    return this.appliedValues.size > 0;
  }

  doesFilterPass(params: IDoesFilterPassParams): boolean {
    if (this.appliedValues.size === 0) return true;
    const cellValue = this.params.getValue(params.node) as string | null | undefined;
    if (this.params.source === 'tags') {
      const tags = (cellValue ?? '')
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean);
      return tags.some((t) => this.appliedValues.has(t));
    }
    return cellValue != null && this.appliedValues.has(cellValue);
  }

  getModel(): SetFilterValue | null {
    return this.isFilterActive() ? { values: [...this.appliedValues] } : null;
  }

  setModel(model: SetFilterValue | null): void {
    this.appliedValues = new Set(model?.values ?? []);
    this.draftValues = new Set(this.appliedValues);
  }

  afterGuiAttached(_params?: IAfterGuiAttachedParams): void {
    this.draftValues = new Set(this.appliedValues);
    this.filterCtrl.reset('');
  }

  toggle(key: string): void {
    const next = new Set(this.draftValues);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    this.draftValues = next;
  }

  apply(): void {
    this.appliedValues = new Set(this.draftValues);
    this.params.filterChangedCallback();
  }

  clear(): void {
    this.draftValues = new Set();
    this.appliedValues = new Set();
    this.params.filterChangedCallback();
  }

  isApplyDisabled(): boolean {
    if (this.draftValues.size !== this.appliedValues.size) return false;
    for (const value of this.draftValues) {
      if (!this.appliedValues.has(value)) return false;
    }
    return true;
  }
}
```

Create `packages/app/src/app/components/column-filters/set-column-filter/set-column-filter.html`:

```html
<div
  class="bb-set-filter p-2"
  (mousedown)="$event.stopPropagation()"
  (touchstart)="$event.stopPropagation()"
>
  <div class="bb-filter-input mb-2">
    <input
      type="text"
      class="form-control form-control-sm"
      [placeholder]="'components.column-filters.set.filter-placeholder' | translate"
      [formControl]="filterCtrl"
    />
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

  <div class="bb-set-filter-list mb-2">
    @for (item of filteredItems(); track item.key) {
    <div class="form-check">
      <input
        class="form-check-input"
        type="checkbox"
        [id]="'bb-set-filter-' + item.key"
        [checked]="draftValues.has(item.key)"
        (change)="toggle(item.key)"
      />
      <label
        class="form-check-label d-flex justify-content-between align-items-center gap-2"
        [for]="'bb-set-filter-' + item.key"
      >
        <span class="text-truncate">{{ item.label }}</span>
        <span class="badge text-bg-secondary">{{ item.count }}</span>
      </label>
    </div>
    } @empty {
    <div class="text-body-secondary small px-1 py-2">
      {{ 'components.column-filters.set.no-matches' | translate }}
    </div>
    }
  </div>

  <div class="d-flex gap-2">
    <button
      class="btn btn-sm btn-outline-secondary btn-split flex-fill"
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
      class="btn btn-sm btn-outline-primary btn-split flex-fill"
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
</div>
```

Create `packages/app/src/app/components/column-filters/set-column-filter/set-column-filter.scss`:

```scss
:host {
  display: block;
}

.bb-set-filter {
  min-width: 240px;
}

.bb-set-filter-list {
  max-height: 240px;
  overflow-y: auto;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm run test --workspace=@bitbutler/app`
Expected: PASS - all `SetColumnFilter` tests green.

- [ ] **Step 5: Lint**

Run: `npm run lint`
Expected: zero warnings/errors.

- [ ] **Step 6: Commit**

```bash
git add packages/app/src/app/components/column-filters/set-column-filter
git commit -m "$(cat <<'EOF'
#216: add SetColumnFilter

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 10: Wire the new filters into the grid

**Files:**

- Modify: `packages/app/src/app/pages/main/grid/grid.lib.ts`

**Interfaces:**

- Consumes: `TextColumnFilter` (Task 5), `NumberColumnFilter` (Task 6), `SizeColumnFilter` (Task 7), `SetColumnFilter`/`SetColumnFilterParams` (Task 9).

- [ ] **Step 1: Add the imports**

In `packages/app/src/app/pages/main/grid/grid.lib.ts`, add alongside the existing `DatepickerRangeFilter` import:

```ts
import { NumberColumnFilter } from '../../../components/column-filters/number-column-filter/number-column-filter';
import {
  SetColumnFilter,
  SetColumnFilterParams,
} from '../../../components/column-filters/set-column-filter/set-column-filter';
import { SizeColumnFilter } from '../../../components/column-filters/size-column-filter/size-column-filter';
import { TextColumnFilter } from '../../../components/column-filters/text-column-filter/text-column-filter';
```

- [ ] **Step 2: Replace the text filter columns**

In `getGridColDefs`, for each of the colDefs with `colId` in this list, change `filter: 'agTextColumnFilter'` to `filter: TextColumnFilter` and add `floatingFilter: false`:

`name`, `hash`, `tracker`, `save_path`, `download_path`, `content_path`, `magnet_uri`, `infohash_v1`, `infohash_v2`.

Worked example (the `name` colDef):

```ts
    {
      colId: 'name',
      field: 'name',
      headerName: translateService.instant('pages.main.grid.grid-lib.col-def.name'),
      headerTooltip: translateService.instant('pages.main.grid.grid-lib.col-def.name'),
      minWidth: 50,
      width: 590,
      tooltipField: 'name',
      filter: TextColumnFilter,
      floatingFilter: false,
    },
```

Apply the identical two-line change (`filter:` value and the added `floatingFilter: false` line) to the other 8 colDefs in the list above - each of them already has `filter: 'agTextColumnFilter'` as a single existing line; nothing else in those colDefs changes.

- [ ] **Step 3: Replace the number filter columns**

For each of the colDefs with `colId` in this list, change `filter: 'agNumberColumnFilter'` to `filter: NumberColumnFilter` and add `floatingFilter: false`:

`progress_percentage`, `progress_raw`, `size_raw`, `total_size_raw`, `completed_raw`, `amount_left_raw`, `downloaded_raw`, `downloaded_session_raw`, `uploaded_raw`, `uploaded_session_raw`, `dlspeed_raw`, `upspeed_raw`, `ratio`, `eta_raw`, `trackers_count`, `dl_limit_raw`, `up_limit_raw`, `max_ratio`, `ratio_limit`, `seeding_time_raw`, `time_active_raw`, `num_seeds`, `num_leechs`, `num_complete`, `num_incomplete`, `priority`, `max_seeding_time_raw`, `max_inactive_seeding_time_raw`, `inactive_seeding_time_limit_raw`.

Worked example (the `ratio` colDef):

```ts
    {
      colId: 'ratio',
      field: 'ratio',
      tooltipValueGetter: tooltipFormattedValue,
      headerName: translateService.instant('pages.main.grid.grid-lib.col-def.ratio'),
      headerTooltip: translateService.instant('pages.main.grid.grid-lib.col-def.ratio'),
      minWidth: 50,
      width: 105,
      valueFormatter: uiFormatService.ratio,
      cellClass: 'tabular-nums',
      filter: NumberColumnFilter,
      floatingFilter: false,
    },
```

Apply the identical change to the other 28 colDefs in the list above.

- [ ] **Step 4: Add the size filter to the byte-valued formatted columns**

For each of the colDefs with `colId` in this list, add `filter: SizeColumnFilter,` and `floatingFilter: false,` (these colDefs currently have no `filter` key at all):

`size`, `total_size`, `completed`, `amount_left`, `downloaded`, `downloaded_session`, `uploaded`, `uploaded_session`, `dlspeed`, `upspeed`, `dl_limit`, `up_limit`.

Worked example (the `size` colDef):

```ts
    {
      colId: 'size',
      field: 'size',
      tooltipValueGetter: tooltipFormattedValue,
      headerName: translateService.instant('pages.main.grid.grid-lib.col-def.size'),
      headerTooltip: translateService.instant('pages.main.grid.grid-lib.col-def.size'),
      minWidth: 50,
      width: 135,
      valueFormatter: uiFormatService.fileSize,
      cellClass: 'tabular-nums',
      filter: SizeColumnFilter,
      floatingFilter: false,
    },
```

Apply the identical two-line addition (inserted after the existing `cellClass: 'tabular-nums',` line) to the other 11 colDefs in the list above.

- [ ] **Step 5: Replace the set filter columns**

Change `filter: 'agTextColumnFilter'` to `filter: SetColumnFilter,` plus a `filterParams` entry, and add `floatingFilter: false`, on these 4 colDefs:

```ts
    {
      colId: 'state',
      field: 'state',
      headerName: translateService.instant('pages.main.grid.grid-lib.col-def.state'),
      headerTooltip: translateService.instant('pages.main.grid.grid-lib.col-def.state'),
      minWidth: 50,
      width: 140,
      tooltipField: 'state',
      filter: SetColumnFilter,
      filterParams: { source: 'state' } satisfies Partial<SetColumnFilterParams>,
      floatingFilter: false,
      hide: true,
    },
    {
      colId: 'state_hr',
      field: 'state',
      headerName: translateService.instant('pages.main.grid.grid-lib.col-def.state_hr'),
      headerTooltip: translateService.instant('pages.main.grid.grid-lib.col-def.state_hr'),
      minWidth: 50,
      width: 220,
      filter: SetColumnFilter,
      filterParams: { source: 'state' } satisfies Partial<SetColumnFilterParams>,
      floatingFilter: false,
      hide: true,
      valueFormatter: (params: ValueFormatterParams<Torrent, TorrentState>): string =>
        params.value ? translateService.instant('torrent.state.' + params.value) : '',
      tooltipValueGetter: tooltipFormattedValue,
    },
    {
      colId: 'category',
      field: 'category',
      tooltipField: 'category',
      headerName: translateService.instant('pages.main.grid.grid-lib.col-def.category'),
      headerTooltip: translateService.instant('pages.main.grid.grid-lib.col-def.category'),
      minWidth: 50,
      width: 180,
      filter: SetColumnFilter,
      filterParams: { source: 'category' } satisfies Partial<SetColumnFilterParams>,
      floatingFilter: false,
      hide: true,
    },
    {
      colId: 'tags',
      field: 'tags',
      tooltipField: 'tags',
      headerName: translateService.instant('pages.main.grid.grid-lib.col-def.tags'),
      headerTooltip: translateService.instant('pages.main.grid.grid-lib.col-def.tags'),
      minWidth: 50,
      width: 180,
      filter: SetColumnFilter,
      filterParams: { source: 'tags' } satisfies Partial<SetColumnFilterParams>,
      floatingFilter: false,
      hide: true,
    },
```

(These replace the corresponding existing 4 colDefs verbatim - every other field on them is unchanged.)

- [ ] **Step 6: Type-check and run the full test suite**

Run: `npx tsc -p packages/app/tsconfig.app.json --noEmit`
Expected: no errors.

Run: `npm run test --workspace=@bitbutler/app`
Expected: PASS - full suite green, including `grid.spec.ts`.

- [ ] **Step 7: Lint**

Run: `npm run lint`
Expected: zero warnings/errors.

- [ ] **Step 8: Commit**

```bash
git add packages/app/src/app/pages/main/grid/grid.lib.ts
git commit -m "$(cat <<'EOF'
#216: wire text/number/size/set column filters into the torrent grid

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 11: Full workspace verification and manual smoke test

**Files:** none (verification only).

- [ ] **Step 1: Full lint across the monorepo**

Run: `npm run lint`
Expected: zero warnings/errors.

- [ ] **Step 2: Full test suite across all workspaces**

Run: `npm test`
Expected: all workspaces (`@bitbutler/shared`, `@bitbutler/electron`, `@bitbutler/app`) pass.

- [ ] **Step 3: Production Angular build**

Run: `npm run build`
Expected: builds successfully with no errors.

- [ ] **Step 4: Manual smoke test**

Run: `npm start` and, against a connected qBittorrent server (or with the app's existing dev/mock data path), in the running app:

1. Open the column chooser and enable `category`, `tags`, `state`, `state_hr`, `save_path` if not already visible.
2. On the `name` column, open the filter popup, pick "Contains", type part of a torrent name, click Apply - confirm the grid filters down, and the filter icon shows active. Click Clear - confirm it resets.
3. On the `size` column, open the filter popup, pick "Greater than or equal to", set the unit to "GB", type `1`, click Apply - confirm only torrents ≥ 1 GB remain.
4. On the `category` column, open the filter popup, check two categories, click Apply - confirm rows from either category show. Type in the search box - confirm the checkbox list narrows.
5. Resize the app window narrow enough that the grid's columns panel is cramped - confirm the Apply/Clear buttons still render side by side without overflowing.
6. Switch the app language (Settings) between English and Hungarian - reopen a filter popup and confirm the operator dropdown labels are translated.
7. Reload the app (or restart it) - confirm previously applied column filters are restored (persisted via `GridStateService`).

Expected: all of the above behave as described, with no console errors.

- [ ] **Step 5: Report results**

Summarize pass/fail for each smoke-test item. If anything fails, fix it in a follow-up commit on this branch before proceeding to PR.

---

## Notes for the follow-up (not part of this plan)

While researching this plan, `DatepickerRangeFilter.doesFilterPass()` was found to hardcode `params.data?.added_on` regardless of which column it's filtering - so the `last_activity`, `seen_complete`, and `completion_on` columns (which also use `DatepickerRangeFilter`) likely filter against the wrong field today. This is a pre-existing bug, unrelated to this plan's scope (the spec explicitly keeps `DatepickerRangeFilter`'s behavior untouched). Flag it to the user as a separate issue after this plan ships.
