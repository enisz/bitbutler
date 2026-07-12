# Ratio Column Filters Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `ratio_raw` column showing the exact (unrounded) ratio value from the qBittorrent API, and replace `max_ratio`/`ratio_limit`'s plain `NumberColumnFilter` with a new `RatioLimitColumnFilter` that exposes the `-1`/`-2` ("No Limit"/"Global Limit") sentinel values as explicit filter modes, plus `max_ratio_raw`/`ratio_limit_raw` raw sibling columns.

**Architecture:** `RatioLimitColumnFilter` extends the existing `OperatorFilterBase<TValue>` abstract class exactly like `TimeLimitColumnFilter` does, reusing `NUMBER_FILTER_OPERATORS`/`numberOperatorPasses` from `operator-filter.utils.ts`. It is `TimeLimitColumnFilter`'s shape minus the `unit` field/dropdown - ratio has no time unit, so `doesFilterPass` compares the raw cell value directly against `from`/`to` with no scaling multiplier. The three new `_raw` columns (`ratio_raw`, `max_ratio_raw`, `ratio_limit_raw`) are plain `NumberColumnFilter` columns with no `valueFormatter`, following the exact shape of every other `_raw` column in the grid (e.g. `eta_raw`, `dl_limit_raw`).

**Tech Stack:** Angular 20 (standalone components, signals), `@ng-select/ng-select`, `@ngx-translate/core`, ag-Grid Community + `ag-grid-angular` custom filter components, Vitest (`@angular/build:unit-test` runner via `npm run test --workspace=@bitbutler/app`).

## Global Constraints

- `RatioLimitColumnFilter` covers `max_ratio` and `ratio_limit`. Modes: `noLimit` (raw cell value must equal `-1`), `global` (must equal `-2`), `custom` (numeric comparison via `numberOperatorPasses`, which must never match `-1`/`-2` sentinel rows). Default mode `custom`, default operator `equals`.
- `RatioLimitColumnFilter` reuses the existing `general.limit.no-limit`, `general.limit.global`, `general.limit.custom` and `components.column-filters.label.{mode,operator,value,from,to}` translation keys as-is - no new keys needed for those.
- New `col-def` translation keys required: `ratio_raw`, `max_ratio_raw`, `ratio_limit_raw` - added to **both** `public/i18n/us.json` and `public/i18n/hu.json`.
- The three new `_raw` columns (`ratio_raw`, `max_ratio_raw`, `ratio_limit_raw`) each: no `valueFormatter`, `tooltipField` set to their base field, `cellClass: 'tabular-nums'`, `filter: NumberColumnFilter`, `hide: true` - same shape as every other `_raw` column.
- `max_ratio` and `ratio_limit`'s existing `filter: NumberColumnFilter` is replaced with `filter: RatioLimitColumnFilter`. No other property on those two col defs changes.
- The plain `ratio` column and its `NumberColumnFilter` are untouched (it already filters against the exact raw value - only the display is rounded).
- `DEFAULT_TORRENT_LIST_GRID_SETTINGS.columnState` is untouched - the new columns start hidden like every other `_raw` column.
- Same `.form-floating` + `<label>` `ng-select`/`input` style, same `btn-split flex-fill` Clear/Apply button pair, and the same `[appendTo]="popupPortalSelector"` popup-portal fix as every other column filter (see `time-limit-column-filter.html`).
- Commit format: `#216: <description>`.

---

### Task 1: Add `col-def` translation keys for the new raw columns

**Files:**

- Modify: `public/i18n/us.json` (`pages.main.grid.grid-lib.col-def` block, the `_raw` key group)
- Modify: `public/i18n/hu.json` (same block)

**Interfaces:**

- Produces: `pages.main.grid.grid-lib.col-def.{ratio_raw,max_ratio_raw,ratio_limit_raw}` - consumed by Task 3's `grid.lib.ts` column defs.

- [ ] **Step 1: Add the 3 new keys to `public/i18n/us.json`**

Find:

```json
            "dl_limit_raw": "Download Limit (raw)",
            "up_limit_raw": "Upload Limit (raw)",
            "eta_raw": "ETA (raw)",
```

Replace with:

```json
            "dl_limit_raw": "Download Limit (raw)",
            "up_limit_raw": "Upload Limit (raw)",
            "ratio_raw": "Ratio (raw)",
            "max_ratio_raw": "Max Ratio (raw)",
            "ratio_limit_raw": "Ratio Limit (raw)",
            "eta_raw": "ETA (raw)",
```

- [ ] **Step 2: Add the 3 new keys to `public/i18n/hu.json`**

Find:

```json
            "dl_limit_raw": "Letöltési korlát (nyers)",
            "up_limit_raw": "Feltöltési korlát (nyers)",
            "eta_raw": "Hátralévő idő (nyers)",
```

Replace with:

```json
            "dl_limit_raw": "Letöltési korlát (nyers)",
            "up_limit_raw": "Feltöltési korlát (nyers)",
            "ratio_raw": "Arány (nyers)",
            "max_ratio_raw": "Maximális arány (nyers)",
            "ratio_limit_raw": "Aránykorlát (nyers)",
            "eta_raw": "Hátralévő idő (nyers)",
```

- [ ] **Step 3: Commit**

```bash
git add public/i18n/us.json public/i18n/hu.json
git commit -m "#216: add translation keys for the raw ratio grid columns"
```

---

### Task 2: Create `RatioLimitColumnFilter`

**Files:**

- Create: `packages/app/src/app/components/column-filters/ratio-limit-column-filter/ratio-limit-column-filter.ts`
- Create: `packages/app/src/app/components/column-filters/ratio-limit-column-filter/ratio-limit-column-filter.html`
- Create: `packages/app/src/app/components/column-filters/ratio-limit-column-filter/ratio-limit-column-filter.scss`
- Test: `packages/app/src/app/components/column-filters/ratio-limit-column-filter/ratio-limit-column-filter.spec.ts`

**Interfaces:**

- Consumes: `OperatorFilterBase<TValue>`, `NUMBER_FILTER_OPERATORS`, `NUMBER_OPERATOR_LABEL_KEYS`, `NumberFilterOperator`, `numberOperatorPasses` from `../operator-filter-base` / `../operator-filter.utils`; `createFilterInstanceId` from `../filter-instance-id.utils`; `BbBtnContent` from `../../bb-btn-content/bb-btn-content`.
- Produces: `RatioLimitColumnFilter` component, `RatioLimitFilterMode` (`'noLimit' | 'global' | 'custom'`), `RatioLimitFilterValue` (`{ mode, operator, from, to }`) - consumed by Task 3's `grid.lib.ts` wiring.

- [ ] **Step 1: Write the failing test**

Create `packages/app/src/app/components/column-filters/ratio-limit-column-filter/ratio-limit-column-filter.spec.ts`:

```typescript
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RatioLimitColumnFilter } from './ratio-limit-column-filter';

describe('RatioLimitColumnFilter', () => {
  let component: RatioLimitColumnFilter;
  let fixture: ComponentFixture<RatioLimitColumnFilter>;
  let mockParams: any;

  beforeEach(async () => {
    mockParams = {
      filterChangedCallback: vi.fn(),
      getValue: vi.fn((node: { data: any }) => node.data?.ratio_limit),
    };

    await TestBed.configureTestingModule({
      imports: [RatioLimitColumnFilter],
    }).compileComponents();

    fixture = TestBed.createComponent(RatioLimitColumnFilter);
    component = fixture.componentInstance;
    component.agInit(mockParams);
    fixture.detectChanges();
  });

  it('should create with an inactive default filter using custom mode', () => {
    expect(component).toBeTruthy();
    expect(component.isFilterActive()).toBe(false);
    expect(component.applied.mode).toBe('custom');
  });

  it('exposes noLimit/global/custom modes', () => {
    expect(component.modeItems().map((m) => m.value)).toEqual(['noLimit', 'global', 'custom']);
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
      expect(component.doesFilterPass({ node: { data: { ratio_limit: 2 } } } as any)).toBe(true);
    });

    it('noLimit mode matches only -1', () => {
      component.applied = { mode: 'noLimit', operator: 'equals', from: null, to: null };
      expect(component.doesFilterPass({ node: { data: { ratio_limit: -1 } } } as any)).toBe(true);
      expect(mockParams.getValue).toHaveBeenCalled();
      expect(component.doesFilterPass({ node: { data: { ratio_limit: -2 } } } as any)).toBe(false);
      expect(component.doesFilterPass({ node: { data: { ratio_limit: 2 } } } as any)).toBe(false);
    });

    it('global mode matches only -2', () => {
      component.applied = { mode: 'global', operator: 'equals', from: null, to: null };
      expect(component.doesFilterPass({ node: { data: { ratio_limit: -2 } } } as any)).toBe(true);
      expect(component.doesFilterPass({ node: { data: { ratio_limit: -1 } } } as any)).toBe(false);
      expect(component.doesFilterPass({ node: { data: { ratio_limit: 2 } } } as any)).toBe(false);
    });

    it('custom mode compares the raw value directly against "from" (no unit scaling)', () => {
      component.applied = { mode: 'custom', operator: 'gte', from: 2, to: null };
      expect(component.doesFilterPass({ node: { data: { ratio_limit: 2 } } } as any)).toBe(true);
      expect(component.doesFilterPass({ node: { data: { ratio_limit: 1.9 } } } as any)).toBe(false);
    });

    it('custom mode never matches the -1/-2 sentinel values', () => {
      component.applied = { mode: 'custom', operator: 'lt', from: 1000, to: null };
      expect(component.doesFilterPass({ node: { data: { ratio_limit: -1 } } } as any)).toBe(false);
      expect(component.doesFilterPass({ node: { data: { ratio_limit: -2 } } } as any)).toBe(false);
    });

    it('applies between in custom mode inclusively', () => {
      component.applied = { mode: 'custom', operator: 'between', from: 1, to: 2 };
      expect(component.doesFilterPass({ node: { data: { ratio_limit: 1 } } } as any)).toBe(true);
      expect(component.doesFilterPass({ node: { data: { ratio_limit: 2 } } } as any)).toBe(true);
      expect(component.doesFilterPass({ node: { data: { ratio_limit: 2.1 } } } as any)).toBe(false);
    });
  });

  describe('isActive', () => {
    it('is active for noLimit and global modes regardless of operator/value', () => {
      expect(
        component.isActive({ mode: 'noLimit', operator: 'equals', from: null, to: null }),
      ).toBe(true);
      expect(component.isActive({ mode: 'global', operator: 'equals', from: null, to: null })).toBe(
        true,
      );
    });

    it('follows the from/to completeness rule in custom mode', () => {
      expect(component.isActive({ mode: 'custom', operator: 'equals', from: null, to: null })).toBe(
        false,
      );
      expect(component.isActive({ mode: 'custom', operator: 'equals', from: 5, to: null })).toBe(
        true,
      );
    });
  });

  describe('getModel / setModel', () => {
    it('round-trips the mode alongside operator/from/to', () => {
      component.setModel({ mode: 'noLimit', operator: 'lte', from: 5, to: null });
      expect(component.applied).toEqual({ mode: 'noLimit', operator: 'lte', from: 5, to: null });
      expect(component.getModel()).toEqual({
        mode: 'noLimit',
        operator: 'lte',
        from: 5,
        to: null,
      });
    });

    it('resets to the default (custom) when the model is null', () => {
      component.applied = { mode: 'noLimit', operator: 'lte', from: 5, to: null };
      component.setModel(null);
      expect(component.applied.mode).toBe('custom');
    });

    it('falls back to an empty value for a shape-invalid (stale) model instead of throwing', () => {
      component.applied = { mode: 'noLimit', operator: 'lte', from: 5, to: null };
      expect(() =>
        component.setModel({ filterType: 'number', type: 'equals', filter: 5 } as any),
      ).not.toThrow();
      expect(component.applied).toEqual({
        mode: 'custom',
        operator: 'equals',
        from: null,
        to: null,
      });
    });

    it('falls back to an empty value when mode is not one of the 3 allowed values', () => {
      component.setModel({ mode: 'unlimited', operator: 'equals', from: 5, to: null } as any);
      expect(component.applied).toEqual({
        mode: 'custom',
        operator: 'equals',
        from: null,
        to: null,
      });
    });
  });

  describe('apply / clear', () => {
    it('apply copies draft (including mode) into applied and calls filterChangedCallback', () => {
      component.draft = { mode: 'global', operator: 'equals', from: null, to: null };
      component.apply();
      expect(component.applied).toEqual({
        mode: 'global',
        operator: 'equals',
        from: null,
        to: null,
      });
      expect(mockParams.filterChangedCallback).toHaveBeenCalled();
    });
  });

  describe('isApplyDisabled', () => {
    it('is disabled for an incomplete "between" (only "from" filled) with nothing applied', () => {
      component.applied = { mode: 'custom', operator: 'equals', from: null, to: null };
      component.draft = { mode: 'custom', operator: 'between', from: 1, to: null };
      expect(component.isApplyDisabled()).toBe(true);
    });

    it('is enabled once both "from" and "to" are filled for "between"', () => {
      component.applied = { mode: 'custom', operator: 'equals', from: null, to: null };
      component.draft = { mode: 'custom', operator: 'between', from: 1, to: 2 };
      expect(component.isApplyDisabled()).toBe(false);
    });

    it('is enabled when switching from custom to noLimit', () => {
      component.applied = { mode: 'custom', operator: 'equals', from: null, to: null };
      component.draft = { mode: 'noLimit', operator: 'equals', from: null, to: null };
      expect(component.isApplyDisabled()).toBe(false);
    });
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run test --workspace=@bitbutler/app -- ratio-limit-column-filter`
Expected: FAIL - `ratio-limit-column-filter.ts` does not exist yet (module not found).

- [ ] **Step 3: Create the component**

Create `packages/app/src/app/components/column-filters/ratio-limit-column-filter/ratio-limit-column-filter.ts`:

```typescript
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
import { createFilterInstanceId } from '../filter-instance-id.utils';
import { OperatorFilterBase } from '../operator-filter-base';
import {
  NUMBER_FILTER_OPERATORS,
  NUMBER_OPERATOR_LABEL_KEYS,
  NumberFilterOperator,
  numberOperatorPasses,
} from '../operator-filter.utils';

export type RatioLimitFilterMode = 'noLimit' | 'global' | 'custom';

export interface RatioLimitFilterValue {
  mode: RatioLimitFilterMode;
  operator: NumberFilterOperator;
  from: number | null;
  to: number | null;
}

const RATIO_LIMIT_MODES: RatioLimitFilterMode[] = ['noLimit', 'global', 'custom'];

function createEmptyRatioLimitValue(): RatioLimitFilterValue {
  return { mode: 'custom', operator: 'equals', from: null, to: null };
}

@Component({
  selector: 'app-ratio-limit-column-filter',
  standalone: true,
  imports: [FormsModule, NgSelectModule, FontAwesomeModule, TranslateModule, BbBtnContent],
  templateUrl: './ratio-limit-column-filter.html',
  styleUrl: './ratio-limit-column-filter.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RatioLimitColumnFilter
  extends OperatorFilterBase<RatioLimitFilterValue>
  implements IFilterAngularComp
{
  private readonly translateService = inject(TranslateService);
  private readonly languageChanged = toSignal(this.translateService.onLangChange);

  public readonly icons = { faCheck, faEraser };
  public readonly instanceId = createFilterInstanceId('ratio-limit-filter');

  draft: RatioLimitFilterValue = createEmptyRatioLimitValue();
  applied: RatioLimitFilterValue = createEmptyRatioLimitValue();

  readonly modeItems = computed(() => {
    this.languageChanged();
    return [
      { value: 'noLimit' as const, label: this.translateService.instant('general.limit.no-limit') },
      { value: 'global' as const, label: this.translateService.instant('general.limit.global') },
      { value: 'custom' as const, label: this.translateService.instant('general.limit.custom') },
    ];
  });

  readonly operatorItems = computed(() => {
    this.languageChanged();
    return NUMBER_FILTER_OPERATORS.map((value) => ({
      value,
      label: this.translateService.instant(NUMBER_OPERATOR_LABEL_KEYS[value]),
    }));
  });

  createEmptyValue(): RatioLimitFilterValue {
    return createEmptyRatioLimitValue();
  }

  valuesEqual(a: RatioLimitFilterValue, b: RatioLimitFilterValue): boolean {
    return a.mode === b.mode && a.operator === b.operator && a.from === b.from && a.to === b.to;
  }

  isActive(value: RatioLimitFilterValue): boolean {
    if (value.mode === 'noLimit' || value.mode === 'global') return true;
    if (value.operator === 'blank' || value.operator === 'notBlank') return true;
    if (value.operator === 'between') return value.from != null && value.to != null;
    return value.from != null;
  }

  isInputDisabled(): boolean {
    return this.draft.operator === 'blank' || this.draft.operator === 'notBlank';
  }

  override isApplyDisabled(): boolean {
    if (this.valuesEqual(this.draft, this.applied)) return true;
    return !this.isActive(this.draft) && !this.isFilterActive();
  }

  isValidModel(model: unknown): model is RatioLimitFilterValue {
    if (model == null || typeof model !== 'object') return false;
    const candidate = model as Partial<RatioLimitFilterValue>;
    return (
      typeof candidate.mode === 'string' &&
      (RATIO_LIMIT_MODES as string[]).includes(candidate.mode) &&
      typeof candidate.operator === 'string' &&
      (NUMBER_FILTER_OPERATORS as string[]).includes(candidate.operator) &&
      (candidate.from === null || typeof candidate.from === 'number') &&
      (candidate.to === null || typeof candidate.to === 'number')
    );
  }

  doesFilterPass(params: IDoesFilterPassParams): boolean {
    if (!this.isFilterActive()) return true;
    const cellValue = this.params.getValue(params.node) as number | null | undefined;
    if (this.applied.mode === 'noLimit') return cellValue === -1;
    if (this.applied.mode === 'global') return cellValue === -2;
    if (cellValue === -1 || cellValue === -2) return false;
    return numberOperatorPasses(
      this.applied.operator,
      cellValue,
      this.applied.from,
      this.applied.to,
    );
  }
}
```

- [ ] **Step 4: Create the template**

Create `packages/app/src/app/components/column-filters/ratio-limit-column-filter/ratio-limit-column-filter.html`:

```html
<div
  class="bb-column-filter p-2"
  (mousedown)="$event.stopPropagation()"
  (touchstart)="$event.stopPropagation()"
>
  <div class="form-floating mb-2">
    <ng-select
      [id]="instanceId + '-mode'"
      [items]="modeItems()"
      bindLabel="label"
      bindValue="value"
      [clearable]="false"
      [searchable]="false"
      [(ngModel)]="draft.mode"
      [appendTo]="popupPortalSelector"
    ></ng-select>
    <label [for]="instanceId + '-mode'"
      >{{ 'components.column-filters.label.mode' | translate }}</label
    >
  </div>

  @if (draft.mode === 'custom') {
  <div class="form-floating mb-2">
    <ng-select
      [id]="instanceId + '-operator'"
      [items]="operatorItems()"
      bindLabel="label"
      bindValue="value"
      [clearable]="false"
      [searchable]="false"
      [(ngModel)]="draft.operator"
      [appendTo]="popupPortalSelector"
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
  }

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

- [ ] **Step 5: Create the styles**

Create `packages/app/src/app/components/column-filters/ratio-limit-column-filter/ratio-limit-column-filter.scss`:

```scss
:host {
  display: block;
}

.bb-column-filter {
  min-width: 360px;
}
```

- [ ] **Step 6: Run the test to verify it passes**

Run: `npm run test --workspace=@bitbutler/app -- ratio-limit-column-filter`
Expected: PASS - all tests in `ratio-limit-column-filter.spec.ts` green.

- [ ] **Step 7: Commit**

```bash
git add packages/app/src/app/components/column-filters/ratio-limit-column-filter
git commit -m "#216: add RatioLimitColumnFilter"
```

---

### Task 3: Wire the new filter and raw columns into `grid.lib.ts`

**Files:**

- Modify: `packages/app/src/app/pages/main/grid/grid.lib.ts` (import block; `ratio`, `max_ratio`, `ratio_limit` column defs)

**Interfaces:**

- Consumes: `RatioLimitColumnFilter` from Task 2 (`packages/app/src/app/components/column-filters/ratio-limit-column-filter/ratio-limit-column-filter`); `pages.main.grid.grid-lib.col-def.{ratio_raw,max_ratio_raw,ratio_limit_raw}` translation keys from Task 1.

- [ ] **Step 1: Add the import**

Find:

```typescript
import { NumberColumnFilter } from '../../../components/column-filters/number-column-filter/number-column-filter';
import {
  SetColumnFilter,
  SetColumnFilterParams,
} from '../../../components/column-filters/set-column-filter/set-column-filter';
```

Replace with:

```typescript
import { NumberColumnFilter } from '../../../components/column-filters/number-column-filter/number-column-filter';
import { RatioLimitColumnFilter } from '../../../components/column-filters/ratio-limit-column-filter/ratio-limit-column-filter';
import {
  SetColumnFilter,
  SetColumnFilterParams,
} from '../../../components/column-filters/set-column-filter/set-column-filter';
```

- [ ] **Step 2: Add the `ratio_raw` column def right after `ratio`**

Find:

```typescript
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
    },
    {
      colId: 'eta',
```

Replace with:

```typescript
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
    },
    {
      colId: 'ratio_raw',
      field: 'ratio',
      tooltipField: 'ratio',
      headerName: translateService.instant('pages.main.grid.grid-lib.col-def.ratio_raw'),
      headerTooltip: translateService.instant('pages.main.grid.grid-lib.col-def.ratio_raw'),
      minWidth: 50,
      width: 105,
      cellClass: 'tabular-nums',
      filter: NumberColumnFilter,
      hide: true,
    },
    {
      colId: 'eta',
```

- [ ] **Step 3: Replace the filter on `max_ratio`/`ratio_limit` and add their raw siblings**

Find:

```typescript
    {
      colId: 'max_ratio',
      field: 'max_ratio',
      tooltipValueGetter: tooltipFormattedValue,
      headerName: translateService.instant('pages.main.grid.grid-lib.col-def.max_ratio'),
      headerTooltip: translateService.instant('pages.main.grid.grid-lib.col-def.max_ratio'),
      minWidth: 50,
      width: 125,
      cellClass: 'tabular-nums',
      valueFormatter: uiFormatService.ratioLimit,
      filter: NumberColumnFilter,
      hide: true,
    },
    {
      colId: 'ratio_limit',
      field: 'ratio_limit',
      tooltipValueGetter: tooltipFormattedValue,
      headerName: translateService.instant('pages.main.grid.grid-lib.col-def.ratio_limit'),
      headerTooltip: translateService.instant('pages.main.grid.grid-lib.col-def.ratio_limit'),
      minWidth: 50,
      width: 135,
      cellClass: 'tabular-nums',
      valueFormatter: uiFormatService.ratioLimit,
      filter: NumberColumnFilter,
      hide: true,
    },
    {
      colId: 'seeding_time',
```

Replace with:

```typescript
    {
      colId: 'max_ratio',
      field: 'max_ratio',
      tooltipValueGetter: tooltipFormattedValue,
      headerName: translateService.instant('pages.main.grid.grid-lib.col-def.max_ratio'),
      headerTooltip: translateService.instant('pages.main.grid.grid-lib.col-def.max_ratio'),
      minWidth: 50,
      width: 125,
      cellClass: 'tabular-nums',
      valueFormatter: uiFormatService.ratioLimit,
      filter: RatioLimitColumnFilter,
      hide: true,
    },
    {
      colId: 'max_ratio_raw',
      field: 'max_ratio',
      tooltipField: 'max_ratio',
      headerName: translateService.instant('pages.main.grid.grid-lib.col-def.max_ratio_raw'),
      headerTooltip: translateService.instant('pages.main.grid.grid-lib.col-def.max_ratio_raw'),
      minWidth: 50,
      width: 125,
      cellClass: 'tabular-nums',
      filter: NumberColumnFilter,
      hide: true,
    },
    {
      colId: 'ratio_limit',
      field: 'ratio_limit',
      tooltipValueGetter: tooltipFormattedValue,
      headerName: translateService.instant('pages.main.grid.grid-lib.col-def.ratio_limit'),
      headerTooltip: translateService.instant('pages.main.grid.grid-lib.col-def.ratio_limit'),
      minWidth: 50,
      width: 135,
      cellClass: 'tabular-nums',
      valueFormatter: uiFormatService.ratioLimit,
      filter: RatioLimitColumnFilter,
      hide: true,
    },
    {
      colId: 'ratio_limit_raw',
      field: 'ratio_limit',
      tooltipField: 'ratio_limit',
      headerName: translateService.instant('pages.main.grid.grid-lib.col-def.ratio_limit_raw'),
      headerTooltip: translateService.instant('pages.main.grid.grid-lib.col-def.ratio_limit_raw'),
      minWidth: 50,
      width: 135,
      cellClass: 'tabular-nums',
      filter: NumberColumnFilter,
      hide: true,
    },
    {
      colId: 'seeding_time',
```

- [ ] **Step 4: Run lint and existing tests to confirm nothing else broke**

Run: `npm run lint`
Expected: PASS - no unused-import or type errors.

Run: `npm run test --workspace=@bitbutler/app`
Expected: PASS - all existing tests still green (there is no dedicated spec for `grid.lib.ts`'s column defs, so this is a compile/lint-level check).

- [ ] **Step 5: Commit**

```bash
git add packages/app/src/app/pages/main/grid/grid.lib.ts
git commit -m "#216: add raw ratio columns and wire RatioLimitColumnFilter into max_ratio/ratio_limit"
```

---

### Task 4: Manual verification

**Files:** none (verification only)

- [ ] **Step 1: Run the full test suite and lint one more time**

Run: `npm run lint`
Expected: PASS with zero warnings.

Run: `npm test`
Expected: PASS across all workspaces.

- [ ] **Step 2: Start the app**

Run: `npm start`

- [ ] **Step 3: Verify `ratio_raw`**

In the main torrent list, show the `Ratio (raw)` column (right-click a header → column toggle, since it's hidden by default). Confirm it displays the unrounded value (e.g. `1.4999999432674409`) next to `Ratio`'s rounded `1.50`, for a torrent with a non-round ratio. Open its filter popup and confirm it's a plain Operator/Value/From-To `NumberColumnFilter` (no mode dropdown) and that filtering by it matches the same rows as filtering the `Ratio` column by the same value.

- [ ] **Step 4: Verify `RatioLimitColumnFilter` on `Max Ratio` and `Ratio Limit`**

Show the `Max Ratio` and `Ratio Limit` columns. For each, open the column's filter popup and confirm:

- Selecting `No limit` immediately filters to torrents whose cell shows "No Limit" (raw `-1`), with no further input needed.
- Selecting `Global limit` immediately filters to torrents whose cell shows "Global Limit" (raw `-2`).
- Selecting `Custom` reveals the Operator/Value (or From/To for "Between") inputs, with no unit dropdown; e.g. `Greater than` + `2` filters to rows with a real numeric limit above `2.0`, and never includes the "No Limit"/"Global Limit" rows.
- Clear removes the filter.

- [ ] **Step 5: Verify `max_ratio_raw`/`ratio_limit_raw` are unaffected**

Show `Max Ratio (raw)` and `Ratio Limit (raw)`. Confirm each still opens the plain Operator/Value/From-To `NumberColumnFilter` popup (no mode dropdown) and displays the raw sentinel/numeric value (e.g. `-1`, `-2`, or `2.5`) directly, with no "No Limit"/"Global Limit" text.
