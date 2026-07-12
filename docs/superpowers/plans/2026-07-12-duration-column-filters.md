# Duration Column Filters Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add two new unit-aware column filters - `DurationColumnFilter` (seconds-based columns: `eta`, `seeding_time`, `time_active`) and `TimeLimitColumnFilter` (minutes-based limit columns with `-1`/`-2` sentinels: `seeding_time_limit`, `max_seeding_time`, `max_inactive_seeding_time`, `inactive_seeding_time_limit`) - which currently have no filter at all.

**Architecture:** Both filters extend the existing `OperatorFilterBase<TValue>` abstract class exactly like `SizeColumnFilter` does, reusing `NUMBER_FILTER_OPERATORS`/`numberOperatorPasses` from `operator-filter.utils.ts`. A new shared `time-unit.utils.ts` provides the `TimeUnit` vocabulary (`seconds`/`minutes`/`hours`/`days`/`weeks`/`months`/`years`) and a `TIME_UNIT_SECONDS` multiplier table used by both filters to scale the user's input into the cell's raw unit before comparing. `TimeLimitColumnFilter` additionally has a `mode` selector (`noLimit`/`global`/`custom`) so the qBittorrent sentinel values `-1` ("no limit") and `-2` ("use the global limit") are selectable explicitly instead of typed as raw numbers.

**Tech Stack:** Angular 20 (standalone components, signals), `@ng-select/ng-select`, `@ngx-translate/core`, ag-Grid Community + `ag-grid-angular` custom filter components, Vitest (`@angular/build:unit-test` runner via `npm run test --workspace=@bitbutler/app`).

## Global Constraints

- Time unit vocabulary is shared via `time-unit.utils.ts`: `TimeUnit = 'seconds' | 'minutes' | 'hours' | 'days' | 'weeks' | 'months' | 'years'`, with `TIME_UNIT_SECONDS` always expressed in seconds (`months`/`years` use the same 365.25-day year as `HumanizeDurationPipe`) and `TIME_UNIT_LABEL_KEYS` mapping each unit to a translation key.
- `DurationColumnFilter` covers `eta`, `seeding_time`, `time_active`. All 7 units offered. Default unit `minutes`, default operator `equals`.
- `TimeLimitColumnFilter` covers `seeding_time_limit`, `max_seeding_time`, `max_inactive_seeding_time`, `inactive_seeding_time_limit`. Only 6 units offered (no `seconds`, since the field granularity is minutes). Default mode `custom`, default operator `equals`, default unit `hours`. Modes: `noLimit` (cell value must equal raw `-1`), `global` (cell value must equal raw `-2`), `custom` (numeric comparison via `numberOperatorPasses`, which must never match `-1`/`-2` sentinel rows).
- The `*_raw` variant columns for all of the above fields (`eta_raw`, `seeding_time_raw`, `time_active_raw`, `seeding_time_limit_raw`, `max_seeding_time_raw`, `max_inactive_seeding_time_raw`, `inactive_seeding_time_limit_raw`) are untouched and keep `NumberColumnFilter`.
- Same `.form-floating` + `<label>` `ng-select`/`input` style, same `btn-split flex-fill` Clear/Apply button pair, and the same `[appendTo]="popupPortalSelector"` popup-portal fix as every other column filter (see `size-column-filter.html`).
- All new translation keys are applied to **both** `public/i18n/us.json` and `public/i18n/hu.json`.
- No changes to any other column filter's matching logic, styling, or to the Trackers/Peers modal grids.

---

### Task 1: Add translation keys (time units, mode label, custom limit label)

**Files:**

- Modify: `public/i18n/us.json:1029-1044` (`components.column-filters.label`/`boolean` block), `:1916-1919` (`general.limit` block)
- Modify: `public/i18n/hu.json:1029-1044`, `:1915-1918`

**Interfaces:**

- Produces: `components.column-filters.label.mode`, `components.column-filters.time-unit.{seconds,minutes,hours,days,weeks,months,years}`, `general.limit.custom` - all consumed by Task 3's `time-unit.utils.ts` (`TIME_UNIT_LABEL_KEYS`) and Task 5's `TimeLimitColumnFilter` (`modeItems`).

- [ ] **Step 1: Add the `mode` label key to `public/i18n/us.json`**

Find (around line 1029):

```json
      "label": {
        "value": "Value",
        "from": "From",
        "to": "To",
        "operator": "Operator",
        "unit": "Unit"
      },
```

Replace with:

```json
      "label": {
        "value": "Value",
        "from": "From",
        "to": "To",
        "operator": "Operator",
        "unit": "Unit",
        "mode": "Mode"
      },
```

- [ ] **Step 2: Add the `time-unit` block to `public/i18n/us.json`**

Find (around line 1040):

```json
      "boolean": {
        "true": "True",
        "false": "False"
      }
    }
  },
```

Replace with:

```json
      "boolean": {
        "true": "True",
        "false": "False"
      },
      "time-unit": {
        "seconds": "Seconds",
        "minutes": "Minutes",
        "hours": "Hours",
        "days": "Days",
        "weeks": "Weeks",
        "months": "Months",
        "years": "Years"
      }
    }
  },
```

- [ ] **Step 3: Add the `custom` limit key to `public/i18n/us.json`**

Find (around line 1916):

```json
    "limit": {
      "global": "Global Limit",
      "no-limit": "No Limit"
    },
```

Replace with:

```json
    "limit": {
      "global": "Global Limit",
      "no-limit": "No Limit",
      "custom": "Custom"
    },
```

- [ ] **Step 4: Add the `mode` label key to `public/i18n/hu.json`**

Find (around line 1029):

```json
      "label": {
        "value": "Érték",
        "from": "Ettől",
        "to": "Eddig",
        "operator": "Operátor",
        "unit": "Mértékegység"
      },
```

Replace with:

```json
      "label": {
        "value": "Érték",
        "from": "Ettől",
        "to": "Eddig",
        "operator": "Operátor",
        "unit": "Mértékegység",
        "mode": "Mód"
      },
```

- [ ] **Step 5: Add the `time-unit` block to `public/i18n/hu.json`**

Find (around line 1040):

```json
      "boolean": {
        "true": "Igaz",
        "false": "Hamis"
      }
    }
  },
```

Replace with:

```json
      "boolean": {
        "true": "Igaz",
        "false": "Hamis"
      },
      "time-unit": {
        "seconds": "Másodperc",
        "minutes": "Perc",
        "hours": "Óra",
        "days": "Nap",
        "weeks": "Hét",
        "months": "Hónap",
        "years": "Év"
      }
    }
  },
```

- [ ] **Step 6: Add the `custom` limit key to `public/i18n/hu.json`**

Find (around line 1915):

```json
    "limit": {
      "global": "Globális korlát",
      "no-limit": "Nincs korlát"
    },
```

Replace with:

```json
    "limit": {
      "global": "Globális korlát",
      "no-limit": "Nincs korlát",
      "custom": "Egyéni"
    },
```

- [ ] **Step 7: Commit**

```bash
git add public/i18n/us.json public/i18n/hu.json
git commit -m "#216: add translation keys for duration/time-limit column filters"
```

---

### Task 2: Create the shared `time-unit.utils.ts`

**Files:**

- Create: `packages/app/src/app/components/column-filters/time-unit.utils.ts`
- Test: `packages/app/src/app/components/column-filters/time-unit.utils.spec.ts`

**Interfaces:**

- Produces: `TimeUnit` type, `TIME_UNIT_SECONDS: Record<TimeUnit, number>`, `TIME_UNIT_LABEL_KEYS: Record<TimeUnit, string>` - consumed by Task 3's `DurationColumnFilter` and Task 5's `TimeLimitColumnFilter`.

- [ ] **Step 1: Write the failing test**

Create `packages/app/src/app/components/column-filters/time-unit.utils.spec.ts`:

```typescript
import { TIME_UNIT_LABEL_KEYS, TIME_UNIT_SECONDS, TimeUnit } from './time-unit.utils';

describe('time-unit.utils', () => {
  it('converts every unit to seconds using the expected multiplier', () => {
    expect(TIME_UNIT_SECONDS.seconds).toBe(1);
    expect(TIME_UNIT_SECONDS.minutes).toBe(60);
    expect(TIME_UNIT_SECONDS.hours).toBe(3600);
    expect(TIME_UNIT_SECONDS.days).toBe(86400);
    expect(TIME_UNIT_SECONDS.weeks).toBe(604800);
    expect(TIME_UNIT_SECONDS.months).toBe(2629800);
    expect(TIME_UNIT_SECONDS.years).toBe(31557600);
  });

  it('has a translation key for every unit', () => {
    const units: TimeUnit[] = ['seconds', 'minutes', 'hours', 'days', 'weeks', 'months', 'years'];
    units.forEach((unit) => {
      expect(TIME_UNIT_LABEL_KEYS[unit]).toBe(`components.column-filters.time-unit.${unit}`);
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test --workspace=@bitbutler/app`
Expected: FAIL - `Cannot find module './time-unit.utils'` (or similar resolution error), because the file doesn't exist yet.

- [ ] **Step 3: Write the implementation**

Create `packages/app/src/app/components/column-filters/time-unit.utils.ts`:

```typescript
export type TimeUnit = 'seconds' | 'minutes' | 'hours' | 'days' | 'weeks' | 'months' | 'years';

export const TIME_UNIT_SECONDS: Record<TimeUnit, number> = {
  seconds: 1,
  minutes: 60,
  hours: 3600,
  days: 86400,
  weeks: 604800,
  months: 2629800, // 365.25 days / 12, matching HumanizeDurationPipe's year length
  years: 31557600, // 365.25 days
};

export const TIME_UNIT_LABEL_KEYS: Record<TimeUnit, string> = {
  seconds: 'components.column-filters.time-unit.seconds',
  minutes: 'components.column-filters.time-unit.minutes',
  hours: 'components.column-filters.time-unit.hours',
  days: 'components.column-filters.time-unit.days',
  weeks: 'components.column-filters.time-unit.weeks',
  months: 'components.column-filters.time-unit.months',
  years: 'components.column-filters.time-unit.years',
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test --workspace=@bitbutler/app`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/app/src/app/components/column-filters/time-unit.utils.ts packages/app/src/app/components/column-filters/time-unit.utils.spec.ts
git commit -m "#216: add shared time-unit utility for duration column filters"
```

---

### Task 3: Create `DurationColumnFilter`

**Files:**

- Create: `packages/app/src/app/components/column-filters/duration-column-filter/duration-column-filter.ts`
- Create: `packages/app/src/app/components/column-filters/duration-column-filter/duration-column-filter.html`
- Create: `packages/app/src/app/components/column-filters/duration-column-filter/duration-column-filter.scss`
- Test: `packages/app/src/app/components/column-filters/duration-column-filter/duration-column-filter.spec.ts`

**Interfaces:**

- Consumes: `OperatorFilterBase<TValue>` from `../operator-filter-base`; `createFilterInstanceId` from `../filter-instance-id.utils`; `BbBtnContent` from `../../bb-btn-content/bb-btn-content`; `NUMBER_FILTER_OPERATORS`, `NUMBER_OPERATOR_LABEL_KEYS`, `NumberFilterOperator`, `numberOperatorPasses` from `../operator-filter.utils`; `TIME_UNIT_LABEL_KEYS`, `TIME_UNIT_SECONDS`, `TimeUnit` from `../time-unit.utils` (Task 2); i18n keys `components.column-filters.label.{operator,unit,value,from,to}`, `components.column-filters.time-unit.*`, `general.button.{clear,apply}` (all pre-existing or added in Task 1).
- Produces: `DurationColumnFilter` class and `DurationFilterValue { operator: NumberFilterOperator; from: number | null; to: number | null; unit: TimeUnit }`, consumed by Task 4's `grid.lib.ts` wiring.

- [ ] **Step 1: Write the failing test**

Create `packages/app/src/app/components/column-filters/duration-column-filter/duration-column-filter.spec.ts`:

```typescript
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { DurationColumnFilter } from './duration-column-filter';

describe('DurationColumnFilter', () => {
  let component: DurationColumnFilter;
  let fixture: ComponentFixture<DurationColumnFilter>;
  let mockParams: any;

  beforeEach(async () => {
    mockParams = {
      filterChangedCallback: vi.fn(),
      getValue: vi.fn((node: { data: any }) => node.data?.seeding_time),
    };

    await TestBed.configureTestingModule({
      imports: [DurationColumnFilter],
    }).compileComponents();

    fixture = TestBed.createComponent(DurationColumnFilter);
    component = fixture.componentInstance;
    component.agInit(mockParams);
    fixture.detectChanges();
  });

  it('should create with an inactive default filter using minutes as the default unit', () => {
    expect(component).toBeTruthy();
    expect(component.isFilterActive()).toBe(false);
    expect(component.applied.unit).toBe('minutes');
  });

  it('exposes all 7 units', () => {
    expect(component.unitItems().map((u) => u.value)).toEqual([
      'seconds',
      'minutes',
      'hours',
      'days',
      'weeks',
      'months',
      'years',
    ]);
  });

  describe('doesFilterPass', () => {
    it('passes everything when the filter is inactive', () => {
      expect(component.doesFilterPass({ node: { data: { seeding_time: 123 } } } as any)).toBe(true);
    });

    it('scales the applied "from" by the selected unit before comparing raw seconds', () => {
      component.applied = { operator: 'gte', from: 1, to: null, unit: 'hours' };
      expect(component.doesFilterPass({ node: { data: { seeding_time: 3600 } } } as any)).toBe(
        true,
      );
      expect(mockParams.getValue).toHaveBeenCalled();
      expect(component.doesFilterPass({ node: { data: { seeding_time: 3599 } } } as any)).toBe(
        false,
      );
    });

    it('applies days scaling for between', () => {
      component.applied = { operator: 'between', from: 1, to: 2, unit: 'days' };
      const oneDay = 86400;
      expect(component.doesFilterPass({ node: { data: { seeding_time: oneDay } } } as any)).toBe(
        true,
      );
      expect(
        component.doesFilterPass({ node: { data: { seeding_time: 2 * oneDay } } } as any),
      ).toBe(true);
      expect(
        component.doesFilterPass({ node: { data: { seeding_time: 2 * oneDay + 1 } } } as any),
      ).toBe(false);
    });

    it('seconds unit does not scale the value', () => {
      component.applied = { operator: 'equals', from: 512, to: null, unit: 'seconds' };
      expect(component.doesFilterPass({ node: { data: { seeding_time: 512 } } } as any)).toBe(true);
    });
  });

  describe('getModel / setModel', () => {
    it('round-trips the unit alongside operator/from/to', () => {
      component.setModel({ operator: 'lte', from: 5, to: null, unit: 'years' });
      expect(component.applied).toEqual({ operator: 'lte', from: 5, to: null, unit: 'years' });
      expect(component.getModel()).toEqual({ operator: 'lte', from: 5, to: null, unit: 'years' });
    });

    it('resets to the default (minutes) unit when the model is null', () => {
      component.applied = { operator: 'lte', from: 5, to: null, unit: 'years' };
      component.setModel(null);
      expect(component.applied.unit).toBe('minutes');
    });

    it('falls back to an empty value for a shape-invalid (stale) model instead of throwing', () => {
      component.applied = { operator: 'lte', from: 5, to: null, unit: 'years' };
      expect(() =>
        component.setModel({ filterType: 'number', type: 'equals', filter: 5 } as any),
      ).not.toThrow();
      expect(component.applied).toEqual({
        operator: 'equals',
        from: null,
        to: null,
        unit: 'minutes',
      });
    });

    it('falls back to an empty value when unit is not a known time unit', () => {
      component.setModel({ operator: 'equals', from: 5, to: null, unit: 'decades' } as any);
      expect(component.applied).toEqual({
        operator: 'equals',
        from: null,
        to: null,
        unit: 'minutes',
      });
    });
  });

  describe('apply / clear', () => {
    it('apply copies draft (including unit) into applied and calls filterChangedCallback', () => {
      component.draft = { operator: 'gt', from: 5, to: null, unit: 'days' };
      component.apply();
      expect(component.applied).toEqual({ operator: 'gt', from: 5, to: null, unit: 'days' });
      expect(mockParams.filterChangedCallback).toHaveBeenCalled();
    });
  });

  describe('isApplyDisabled', () => {
    it('is disabled for an incomplete "between" (only "from" filled) with nothing applied', () => {
      component.applied = { operator: 'equals', from: null, to: null, unit: 'minutes' };
      component.draft = { operator: 'between', from: 1, to: null, unit: 'minutes' };
      expect(component.isApplyDisabled()).toBe(true);
    });

    it('is enabled once both "from" and "to" are filled for "between"', () => {
      component.applied = { operator: 'equals', from: null, to: null, unit: 'minutes' };
      component.draft = { operator: 'between', from: 1, to: 2, unit: 'minutes' };
      expect(component.isApplyDisabled()).toBe(false);
    });

    it('is enabled when clearing a real applied filter down to an empty draft', () => {
      component.applied = { operator: 'gt', from: 5, to: null, unit: 'days' };
      component.draft = { operator: 'equals', from: null, to: null, unit: 'minutes' };
      expect(component.isApplyDisabled()).toBe(false);
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test --workspace=@bitbutler/app`
Expected: FAIL - `Cannot find module './duration-column-filter'` (or similar resolution error), because the component doesn't exist yet.

- [ ] **Step 3: Write the component**

Create `packages/app/src/app/components/column-filters/duration-column-filter/duration-column-filter.ts`:

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
import { TIME_UNIT_LABEL_KEYS, TIME_UNIT_SECONDS, TimeUnit } from '../time-unit.utils';

export interface DurationFilterValue {
  operator: NumberFilterOperator;
  from: number | null;
  to: number | null;
  unit: TimeUnit;
}

const DURATION_UNITS: TimeUnit[] = [
  'seconds',
  'minutes',
  'hours',
  'days',
  'weeks',
  'months',
  'years',
];

function createEmptyDurationValue(): DurationFilterValue {
  return { operator: 'equals', from: null, to: null, unit: 'minutes' };
}

@Component({
  selector: 'app-duration-column-filter',
  standalone: true,
  imports: [FormsModule, NgSelectModule, FontAwesomeModule, TranslateModule, BbBtnContent],
  templateUrl: './duration-column-filter.html',
  styleUrl: './duration-column-filter.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DurationColumnFilter
  extends OperatorFilterBase<DurationFilterValue>
  implements IFilterAngularComp
{
  private readonly translateService = inject(TranslateService);
  private readonly languageChanged = toSignal(this.translateService.onLangChange);

  public readonly icons = { faCheck, faEraser };
  public readonly instanceId = createFilterInstanceId('duration-filter');

  draft: DurationFilterValue = createEmptyDurationValue();
  applied: DurationFilterValue = createEmptyDurationValue();

  readonly operatorItems = computed(() => {
    this.languageChanged();
    return NUMBER_FILTER_OPERATORS.map((value) => ({
      value,
      label: this.translateService.instant(NUMBER_OPERATOR_LABEL_KEYS[value]),
    }));
  });

  readonly unitItems = computed(() => {
    this.languageChanged();
    return DURATION_UNITS.map((value) => ({
      value,
      label: this.translateService.instant(TIME_UNIT_LABEL_KEYS[value]),
    }));
  });

  createEmptyValue(): DurationFilterValue {
    return createEmptyDurationValue();
  }

  valuesEqual(a: DurationFilterValue, b: DurationFilterValue): boolean {
    return a.operator === b.operator && a.from === b.from && a.to === b.to && a.unit === b.unit;
  }

  isActive(value: DurationFilterValue): boolean {
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

  isValidModel(model: unknown): model is DurationFilterValue {
    if (model == null || typeof model !== 'object') return false;
    const candidate = model as Partial<DurationFilterValue>;
    return (
      typeof candidate.operator === 'string' &&
      (NUMBER_FILTER_OPERATORS as string[]).includes(candidate.operator) &&
      (candidate.from === null || typeof candidate.from === 'number') &&
      (candidate.to === null || typeof candidate.to === 'number') &&
      typeof candidate.unit === 'string' &&
      (DURATION_UNITS as string[]).includes(candidate.unit)
    );
  }

  doesFilterPass(params: IDoesFilterPassParams): boolean {
    if (!this.isFilterActive()) return true;
    const cellValue = this.params.getValue(params.node) as number | null | undefined;
    const multiplier = TIME_UNIT_SECONDS[this.applied.unit];
    const from = this.applied.from != null ? this.applied.from * multiplier : null;
    const to = this.applied.to != null ? this.applied.to * multiplier : null;
    return numberOperatorPasses(this.applied.operator, cellValue, from, to);
  }
}
```

Create `packages/app/src/app/components/column-filters/duration-column-filter/duration-column-filter.html`:

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
      [appendTo]="popupPortalSelector"
    ></ng-select>
    <label [for]="instanceId + '-operator'"
      >{{ 'components.column-filters.label.operator' | translate }}</label
    >
  </div>

  <div class="form-floating mb-2">
    <ng-select
      [id]="instanceId + '-unit'"
      [items]="unitItems()"
      bindLabel="label"
      bindValue="value"
      [clearable]="false"
      [searchable]="false"
      [(ngModel)]="draft.unit"
      [appendTo]="popupPortalSelector"
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

Create `packages/app/src/app/components/column-filters/duration-column-filter/duration-column-filter.scss`:

```scss
:host {
  display: block;
}

.bb-column-filter {
  min-width: 360px;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test --workspace=@bitbutler/app`
Expected: PASS - all `DurationColumnFilter` tests green.

- [ ] **Step 5: Commit**

```bash
git add packages/app/src/app/components/column-filters/duration-column-filter
git commit -m "#216: add DurationColumnFilter"
```

---

### Task 4: Wire `DurationColumnFilter` onto `eta`, `seeding_time`, `time_active`

**Files:**

- Modify: `packages/app/src/app/pages/main/grid/grid.lib.ts:22` (import), `:373-391,564-574,618-628` (column defs)

**Interfaces:**

- Consumes: `DurationColumnFilter` from Task 3 (`packages/app/src/app/components/column-filters/duration-column-filter/duration-column-filter`).

- [ ] **Step 1: Add the import**

In `packages/app/src/app/pages/main/grid/grid.lib.ts`, find:

```typescript
import { DatepickerRangeFilter } from '../../../components/column-filters/datepicker-range-filter/datepicker-range-filter';
import { NumberColumnFilter } from '../../../components/column-filters/number-column-filter/number-column-filter';
```

Replace with:

```typescript
import { DatepickerRangeFilter } from '../../../components/column-filters/datepicker-range-filter/datepicker-range-filter';
import { DurationColumnFilter } from '../../../components/column-filters/duration-column-filter/duration-column-filter';
import { NumberColumnFilter } from '../../../components/column-filters/number-column-filter/number-column-filter';
```

- [ ] **Step 2: Add the filter to the `eta` column def**

Find:

```typescript
      valueFormatter: (params: ValueFormatterParams<Torrent, any>): string =>
        params.data?.state === 'uploading' ||
        params.data?.state === 'pausedUP' ||
        params.data?.state === 'stoppedUP' ||
        params.data?.state === 'queuedUP' ||
        params.data?.state === 'stalledUP' ||
        params.data?.state === 'checkingUP' ||
        params.data?.state === 'forcedUP'
          ? ''
          : uiFormatService.durationSeconds(params, 2),
    },
```

Replace with:

```typescript
      valueFormatter: (params: ValueFormatterParams<Torrent, any>): string =>
        params.data?.state === 'uploading' ||
        params.data?.state === 'pausedUP' ||
        params.data?.state === 'stoppedUP' ||
        params.data?.state === 'queuedUP' ||
        params.data?.state === 'stalledUP' ||
        params.data?.state === 'checkingUP' ||
        params.data?.state === 'forcedUP'
          ? ''
          : uiFormatService.durationSeconds(params, 2),
      filter: DurationColumnFilter,
    },
```

- [ ] **Step 3: Add the filter to the `seeding_time` column def**

Find:

```typescript
      valueFormatter: (params: ValueFormatterParams<Torrent, number>) =>
        uiFormatService.durationSeconds(params, 2),
      hide: true,
    },
    {
      colId: 'seeding_time_raw',
```

Replace with:

```typescript
      valueFormatter: (params: ValueFormatterParams<Torrent, number>) =>
        uiFormatService.durationSeconds(params, 2),
      filter: DurationColumnFilter,
      hide: true,
    },
    {
      colId: 'seeding_time_raw',
```

- [ ] **Step 4: Add the filter to the `time_active` column def**

Find:

```typescript
      valueFormatter: (params: ValueFormatterParams<Torrent, number>) =>
        uiFormatService.durationSeconds(params, 2),
      hide: true,
    },
    {
      colId: 'time_active_raw',
```

Replace with:

```typescript
      valueFormatter: (params: ValueFormatterParams<Torrent, number>) =>
        uiFormatService.durationSeconds(params, 2),
      filter: DurationColumnFilter,
      hide: true,
    },
    {
      colId: 'time_active_raw',
```

- [ ] **Step 5: Run lint and existing tests to confirm nothing else broke**

Run: `npm run lint`
Expected: PASS - no unused-import or type errors.

Run: `npm run test --workspace=@bitbutler/app`
Expected: PASS - all existing tests still green (there is no dedicated spec for `grid.lib.ts`'s column defs, so this is a compile/lint-level check).

- [ ] **Step 6: Commit**

```bash
git add packages/app/src/app/pages/main/grid/grid.lib.ts
git commit -m "#216: wire DurationColumnFilter into the torrent grid's seconds-based columns"
```

---

### Task 5: Create `TimeLimitColumnFilter`

**Files:**

- Create: `packages/app/src/app/components/column-filters/time-limit-column-filter/time-limit-column-filter.ts`
- Create: `packages/app/src/app/components/column-filters/time-limit-column-filter/time-limit-column-filter.html`
- Create: `packages/app/src/app/components/column-filters/time-limit-column-filter/time-limit-column-filter.scss`
- Test: `packages/app/src/app/components/column-filters/time-limit-column-filter/time-limit-column-filter.spec.ts`

**Interfaces:**

- Consumes: `OperatorFilterBase<TValue>` from `../operator-filter-base`; `createFilterInstanceId` from `../filter-instance-id.utils`; `BbBtnContent` from `../../bb-btn-content/bb-btn-content`; `NUMBER_FILTER_OPERATORS`, `NUMBER_OPERATOR_LABEL_KEYS`, `NumberFilterOperator`, `numberOperatorPasses` from `../operator-filter.utils`; `TIME_UNIT_LABEL_KEYS`, `TIME_UNIT_SECONDS`, `TimeUnit` from `../time-unit.utils` (Task 2); i18n keys `components.column-filters.label.{mode,operator,unit,value,from,to}`, `components.column-filters.time-unit.*`, `general.limit.{no-limit,global,custom}`, `general.button.{clear,apply}` (all pre-existing or added in Task 1).
- Produces: `TimeLimitColumnFilter` class, `TimeLimitFilterMode = 'noLimit' | 'global' | 'custom'`, and `TimeLimitFilterValue { mode: TimeLimitFilterMode; operator: NumberFilterOperator; from: number | null; to: number | null; unit: TimeUnit }`, consumed by Task 6's `grid.lib.ts` wiring.

- [ ] **Step 1: Write the failing test**

Create `packages/app/src/app/components/column-filters/time-limit-column-filter/time-limit-column-filter.spec.ts`:

```typescript
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TimeLimitColumnFilter } from './time-limit-column-filter';

describe('TimeLimitColumnFilter', () => {
  let component: TimeLimitColumnFilter;
  let fixture: ComponentFixture<TimeLimitColumnFilter>;
  let mockParams: any;

  beforeEach(async () => {
    mockParams = {
      filterChangedCallback: vi.fn(),
      getValue: vi.fn((node: { data: any }) => node.data?.seeding_time_limit),
    };

    await TestBed.configureTestingModule({
      imports: [TimeLimitColumnFilter],
    }).compileComponents();

    fixture = TestBed.createComponent(TimeLimitColumnFilter);
    component = fixture.componentInstance;
    component.agInit(mockParams);
    fixture.detectChanges();
  });

  it('should create with an inactive default filter using custom mode and hours as the default unit', () => {
    expect(component).toBeTruthy();
    expect(component.isFilterActive()).toBe(false);
    expect(component.applied.mode).toBe('custom');
    expect(component.applied.unit).toBe('hours');
  });

  it('exposes 6 units, excluding seconds', () => {
    expect(component.unitItems().map((u) => u.value)).toEqual([
      'minutes',
      'hours',
      'days',
      'weeks',
      'months',
      'years',
    ]);
  });

  it('exposes noLimit/global/custom modes', () => {
    expect(component.modeItems().map((m) => m.value)).toEqual(['noLimit', 'global', 'custom']);
  });

  describe('doesFilterPass', () => {
    it('passes everything when the filter is inactive', () => {
      expect(component.doesFilterPass({ node: { data: { seeding_time_limit: 60 } } } as any)).toBe(
        true,
      );
    });

    it('noLimit mode matches only -1', () => {
      component.applied = {
        mode: 'noLimit',
        operator: 'equals',
        from: null,
        to: null,
        unit: 'hours',
      };
      expect(component.doesFilterPass({ node: { data: { seeding_time_limit: -1 } } } as any)).toBe(
        true,
      );
      expect(mockParams.getValue).toHaveBeenCalled();
      expect(component.doesFilterPass({ node: { data: { seeding_time_limit: -2 } } } as any)).toBe(
        false,
      );
      expect(component.doesFilterPass({ node: { data: { seeding_time_limit: 60 } } } as any)).toBe(
        false,
      );
    });

    it('global mode matches only -2', () => {
      component.applied = {
        mode: 'global',
        operator: 'equals',
        from: null,
        to: null,
        unit: 'hours',
      };
      expect(component.doesFilterPass({ node: { data: { seeding_time_limit: -2 } } } as any)).toBe(
        true,
      );
      expect(component.doesFilterPass({ node: { data: { seeding_time_limit: -1 } } } as any)).toBe(
        false,
      );
      expect(component.doesFilterPass({ node: { data: { seeding_time_limit: 60 } } } as any)).toBe(
        false,
      );
    });

    it('custom mode scales the applied "from" by the selected unit before comparing raw minutes', () => {
      component.applied = { mode: 'custom', operator: 'gte', from: 1, to: null, unit: 'hours' };
      expect(component.doesFilterPass({ node: { data: { seeding_time_limit: 60 } } } as any)).toBe(
        true,
      );
      expect(component.doesFilterPass({ node: { data: { seeding_time_limit: 59 } } } as any)).toBe(
        false,
      );
    });

    it('custom mode never matches the -1/-2 sentinel values', () => {
      component.applied = {
        mode: 'custom',
        operator: 'lt',
        from: 1000,
        to: null,
        unit: 'minutes',
      };
      expect(component.doesFilterPass({ node: { data: { seeding_time_limit: -1 } } } as any)).toBe(
        false,
      );
      expect(component.doesFilterPass({ node: { data: { seeding_time_limit: -2 } } } as any)).toBe(
        false,
      );
    });

    it('applies days scaling for between in custom mode', () => {
      component.applied = { mode: 'custom', operator: 'between', from: 1, to: 2, unit: 'days' };
      expect(
        component.doesFilterPass({ node: { data: { seeding_time_limit: 1440 } } } as any),
      ).toBe(true);
      expect(
        component.doesFilterPass({ node: { data: { seeding_time_limit: 2880 } } } as any),
      ).toBe(true);
      expect(
        component.doesFilterPass({ node: { data: { seeding_time_limit: 2881 } } } as any),
      ).toBe(false);
    });
  });

  describe('isActive', () => {
    it('is active for noLimit and global modes regardless of operator/value', () => {
      expect(
        component.isActive({
          mode: 'noLimit',
          operator: 'equals',
          from: null,
          to: null,
          unit: 'hours',
        }),
      ).toBe(true);
      expect(
        component.isActive({
          mode: 'global',
          operator: 'equals',
          from: null,
          to: null,
          unit: 'hours',
        }),
      ).toBe(true);
    });

    it('follows the from/to completeness rule in custom mode', () => {
      expect(
        component.isActive({
          mode: 'custom',
          operator: 'equals',
          from: null,
          to: null,
          unit: 'hours',
        }),
      ).toBe(false);
      expect(
        component.isActive({
          mode: 'custom',
          operator: 'equals',
          from: 5,
          to: null,
          unit: 'hours',
        }),
      ).toBe(true);
    });
  });

  describe('getModel / setModel', () => {
    it('round-trips the mode and unit alongside operator/from/to', () => {
      component.setModel({ mode: 'noLimit', operator: 'lte', from: 5, to: null, unit: 'years' });
      expect(component.applied).toEqual({
        mode: 'noLimit',
        operator: 'lte',
        from: 5,
        to: null,
        unit: 'years',
      });
      expect(component.getModel()).toEqual({
        mode: 'noLimit',
        operator: 'lte',
        from: 5,
        to: null,
        unit: 'years',
      });
    });

    it('resets to the default (custom/hours) when the model is null', () => {
      component.applied = { mode: 'noLimit', operator: 'lte', from: 5, to: null, unit: 'years' };
      component.setModel(null);
      expect(component.applied.mode).toBe('custom');
      expect(component.applied.unit).toBe('hours');
    });

    it('falls back to an empty value for a shape-invalid (stale) model instead of throwing', () => {
      component.applied = { mode: 'noLimit', operator: 'lte', from: 5, to: null, unit: 'years' };
      expect(() =>
        component.setModel({ filterType: 'number', type: 'equals', filter: 5 } as any),
      ).not.toThrow();
      expect(component.applied).toEqual({
        mode: 'custom',
        operator: 'equals',
        from: null,
        to: null,
        unit: 'hours',
      });
    });

    it('falls back to an empty value when unit is seconds (not allowed for this filter)', () => {
      component.setModel({
        mode: 'custom',
        operator: 'equals',
        from: 5,
        to: null,
        unit: 'seconds',
      } as any);
      expect(component.applied).toEqual({
        mode: 'custom',
        operator: 'equals',
        from: null,
        to: null,
        unit: 'hours',
      });
    });
  });

  describe('apply / clear', () => {
    it('apply copies draft (including mode and unit) into applied and calls filterChangedCallback', () => {
      component.draft = { mode: 'global', operator: 'equals', from: null, to: null, unit: 'hours' };
      component.apply();
      expect(component.applied).toEqual({
        mode: 'global',
        operator: 'equals',
        from: null,
        to: null,
        unit: 'hours',
      });
      expect(mockParams.filterChangedCallback).toHaveBeenCalled();
    });
  });

  describe('isApplyDisabled', () => {
    it('is disabled for an incomplete "between" (only "from" filled) with nothing applied', () => {
      component.applied = {
        mode: 'custom',
        operator: 'equals',
        from: null,
        to: null,
        unit: 'hours',
      };
      component.draft = { mode: 'custom', operator: 'between', from: 1, to: null, unit: 'hours' };
      expect(component.isApplyDisabled()).toBe(true);
    });

    it('is enabled once both "from" and "to" are filled for "between"', () => {
      component.applied = {
        mode: 'custom',
        operator: 'equals',
        from: null,
        to: null,
        unit: 'hours',
      };
      component.draft = { mode: 'custom', operator: 'between', from: 1, to: 2, unit: 'hours' };
      expect(component.isApplyDisabled()).toBe(false);
    });

    it('is enabled when switching from custom to noLimit', () => {
      component.applied = {
        mode: 'custom',
        operator: 'equals',
        from: null,
        to: null,
        unit: 'hours',
      };
      component.draft = {
        mode: 'noLimit',
        operator: 'equals',
        from: null,
        to: null,
        unit: 'hours',
      };
      expect(component.isApplyDisabled()).toBe(false);
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test --workspace=@bitbutler/app`
Expected: FAIL - `Cannot find module './time-limit-column-filter'` (or similar resolution error), because the component doesn't exist yet.

- [ ] **Step 3: Write the component**

Create `packages/app/src/app/components/column-filters/time-limit-column-filter/time-limit-column-filter.ts`:

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
import { TIME_UNIT_LABEL_KEYS, TIME_UNIT_SECONDS, TimeUnit } from '../time-unit.utils';

export type TimeLimitFilterMode = 'noLimit' | 'global' | 'custom';

export interface TimeLimitFilterValue {
  mode: TimeLimitFilterMode;
  operator: NumberFilterOperator;
  from: number | null;
  to: number | null;
  unit: TimeUnit;
}

const TIME_LIMIT_UNITS: TimeUnit[] = ['minutes', 'hours', 'days', 'weeks', 'months', 'years'];
const TIME_LIMIT_MODES: TimeLimitFilterMode[] = ['noLimit', 'global', 'custom'];

function createEmptyTimeLimitValue(): TimeLimitFilterValue {
  return { mode: 'custom', operator: 'equals', from: null, to: null, unit: 'hours' };
}

@Component({
  selector: 'app-time-limit-column-filter',
  standalone: true,
  imports: [FormsModule, NgSelectModule, FontAwesomeModule, TranslateModule, BbBtnContent],
  templateUrl: './time-limit-column-filter.html',
  styleUrl: './time-limit-column-filter.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TimeLimitColumnFilter
  extends OperatorFilterBase<TimeLimitFilterValue>
  implements IFilterAngularComp
{
  private readonly translateService = inject(TranslateService);
  private readonly languageChanged = toSignal(this.translateService.onLangChange);

  public readonly icons = { faCheck, faEraser };
  public readonly instanceId = createFilterInstanceId('time-limit-filter');

  draft: TimeLimitFilterValue = createEmptyTimeLimitValue();
  applied: TimeLimitFilterValue = createEmptyTimeLimitValue();

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

  readonly unitItems = computed(() => {
    this.languageChanged();
    return TIME_LIMIT_UNITS.map((value) => ({
      value,
      label: this.translateService.instant(TIME_UNIT_LABEL_KEYS[value]),
    }));
  });

  createEmptyValue(): TimeLimitFilterValue {
    return createEmptyTimeLimitValue();
  }

  valuesEqual(a: TimeLimitFilterValue, b: TimeLimitFilterValue): boolean {
    return (
      a.mode === b.mode &&
      a.operator === b.operator &&
      a.from === b.from &&
      a.to === b.to &&
      a.unit === b.unit
    );
  }

  isActive(value: TimeLimitFilterValue): boolean {
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

  isValidModel(model: unknown): model is TimeLimitFilterValue {
    if (model == null || typeof model !== 'object') return false;
    const candidate = model as Partial<TimeLimitFilterValue>;
    return (
      typeof candidate.mode === 'string' &&
      (TIME_LIMIT_MODES as string[]).includes(candidate.mode) &&
      typeof candidate.operator === 'string' &&
      (NUMBER_FILTER_OPERATORS as string[]).includes(candidate.operator) &&
      (candidate.from === null || typeof candidate.from === 'number') &&
      (candidate.to === null || typeof candidate.to === 'number') &&
      typeof candidate.unit === 'string' &&
      (TIME_LIMIT_UNITS as string[]).includes(candidate.unit)
    );
  }

  doesFilterPass(params: IDoesFilterPassParams): boolean {
    if (!this.isFilterActive()) return true;
    const cellValue = this.params.getValue(params.node) as number | null | undefined;
    if (this.applied.mode === 'noLimit') return cellValue === -1;
    if (this.applied.mode === 'global') return cellValue === -2;
    if (cellValue === -1 || cellValue === -2) return false;
    const multiplier = TIME_UNIT_SECONDS[this.applied.unit] / 60;
    const from = this.applied.from != null ? this.applied.from * multiplier : null;
    const to = this.applied.to != null ? this.applied.to * multiplier : null;
    return numberOperatorPasses(this.applied.operator, cellValue, from, to);
  }
}
```

Create `packages/app/src/app/components/column-filters/time-limit-column-filter/time-limit-column-filter.html`:

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

  <div class="form-floating mb-2">
    <ng-select
      [id]="instanceId + '-unit'"
      [items]="unitItems()"
      bindLabel="label"
      bindValue="value"
      [clearable]="false"
      [searchable]="false"
      [(ngModel)]="draft.unit"
      [appendTo]="popupPortalSelector"
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

Create `packages/app/src/app/components/column-filters/time-limit-column-filter/time-limit-column-filter.scss`:

```scss
:host {
  display: block;
}

.bb-column-filter {
  min-width: 360px;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test --workspace=@bitbutler/app`
Expected: PASS - all `TimeLimitColumnFilter` tests green.

- [ ] **Step 5: Commit**

```bash
git add packages/app/src/app/components/column-filters/time-limit-column-filter
git commit -m "#216: add TimeLimitColumnFilter"
```

---

### Task 6: Wire `TimeLimitColumnFilter` onto the 4 limit columns

**Files:**

- Modify: `packages/app/src/app/pages/main/grid/grid.lib.ts:23` (import), `:588-601,813-823,838-853,870-885` (column defs)

**Interfaces:**

- Consumes: `TimeLimitColumnFilter` from Task 5 (`packages/app/src/app/components/column-filters/time-limit-column-filter/time-limit-column-filter`).

- [ ] **Step 1: Add the import**

In `packages/app/src/app/pages/main/grid/grid.lib.ts`, find:

```typescript
import { TextColumnFilter } from '../../../components/column-filters/text-column-filter/text-column-filter';
import { Torrent, TorrentState } from '../../../models/torrent.model';
```

Replace with:

```typescript
import { TextColumnFilter } from '../../../components/column-filters/text-column-filter/text-column-filter';
import { TimeLimitColumnFilter } from '../../../components/column-filters/time-limit-column-filter/time-limit-column-filter';
import { Torrent, TorrentState } from '../../../models/torrent.model';
```

- [ ] **Step 2: Add the filter to the `seeding_time_limit` column def**

Find:

```typescript
      minWidth: 50,
      width: 155,
      cellClass: 'tabular-nums',
      valueFormatter: uiFormatService.timeLimit,
      hide: true,
    },
    {
      colId: 'seeding_time_limit_raw',
```

Replace with:

```typescript
      minWidth: 50,
      width: 155,
      cellClass: 'tabular-nums',
      valueFormatter: uiFormatService.timeLimit,
      filter: TimeLimitColumnFilter,
      hide: true,
    },
    {
      colId: 'seeding_time_limit_raw',
```

- [ ] **Step 3: Add the filter to the `max_seeding_time` column def**

Find:

```typescript
      minWidth: 50,
      width: 230,
      cellClass: 'tabular-nums',
      valueFormatter: uiFormatService.timeLimit,
      hide: true,
    },
    {
      colId: 'max_seeding_time_raw',
```

Replace with:

```typescript
      minWidth: 50,
      width: 230,
      cellClass: 'tabular-nums',
      valueFormatter: uiFormatService.timeLimit,
      filter: TimeLimitColumnFilter,
      hide: true,
    },
    {
      colId: 'max_seeding_time_raw',
```

- [ ] **Step 4: Add the filter to the `max_inactive_seeding_time` column def**

Find:

```typescript
      minWidth: 50,
      width: 285,
      cellClass: 'tabular-nums',
      valueFormatter: uiFormatService.timeLimit,
      hide: true,
    },
    {
      colId: 'max_inactive_seeding_time_raw',
```

Replace with:

```typescript
      minWidth: 50,
      width: 285,
      cellClass: 'tabular-nums',
      valueFormatter: uiFormatService.timeLimit,
      filter: TimeLimitColumnFilter,
      hide: true,
    },
    {
      colId: 'max_inactive_seeding_time_raw',
```

- [ ] **Step 5: Add the filter to the `inactive_seeding_time_limit` column def**

Find:

```typescript
      minWidth: 50,
      width: 255,
      cellClass: 'tabular-nums',
      valueFormatter: uiFormatService.timeLimit,
      hide: true,
    },
    {
      colId: 'inactive_seeding_time_limit_raw',
```

Replace with:

```typescript
      minWidth: 50,
      width: 255,
      cellClass: 'tabular-nums',
      valueFormatter: uiFormatService.timeLimit,
      filter: TimeLimitColumnFilter,
      hide: true,
    },
    {
      colId: 'inactive_seeding_time_limit_raw',
```

- [ ] **Step 6: Run lint and existing tests to confirm nothing else broke**

Run: `npm run lint`
Expected: PASS - no unused-import or type errors.

Run: `npm run test --workspace=@bitbutler/app`
Expected: PASS - all existing tests still green (there is no dedicated spec for `grid.lib.ts`'s column defs, so this is a compile/lint-level check).

- [ ] **Step 7: Commit**

```bash
git add packages/app/src/app/pages/main/grid/grid.lib.ts
git commit -m "#216: wire TimeLimitColumnFilter into the torrent grid's minutes-based limit columns"
```

---

### Task 7: Manual verification

**Files:** none (verification only)

- [ ] **Step 1: Run the full test suite and lint one more time**

Run: `npm run lint`
Expected: PASS with zero warnings.

Run: `npm test`
Expected: PASS across all workspaces.

- [ ] **Step 2: Start the app**

Run: `npm start`

- [ ] **Step 3: Verify `DurationColumnFilter`**

In the main torrent list, show the `ETA`, `Seeding Time`, and `Time Active` columns (right-click a header → column toggle, if hidden). For each, open the column's filter popup and confirm:

- It shows Operator / Unit dropdowns and a Value (or From/To for "Between") number input, plus Clear/Apply buttons, matching the visual style of `SizeColumnFilter`.
- Selecting e.g. `Greater than` + `1` + `hours` filters the grid to rows whose raw seconds value exceeds 3600.
- Switching the unit (e.g. from `hours` to `days`) changes which rows match without re-entering the value.
- Clear removes the filter (column header filter icon disappears).

- [ ] **Step 4: Verify `TimeLimitColumnFilter`**

Show the `Seeding Time Limit`, `Max Seeding Time`, `Max Inactive Seeding Time`, and `Inactive Seeding Time Limit` columns. For each, open the column's filter popup and confirm:

- Selecting `No limit` immediately filters to torrents whose limit cell shows "No Limit" (raw `-1`), with no further input needed.
- Selecting `Global limit` immediately filters to torrents whose limit cell shows "Global Limit" (raw `-2`).
- Selecting `Custom` reveals the Operator/Unit/Value inputs; e.g. `Greater than` + `1` + `days` filters to rows with a real numeric limit above 1440 minutes, and never includes the "No Limit"/"Global Limit" rows.
- Clear removes the filter.

- [ ] **Step 5: Verify the `*_raw` columns are unaffected**

Show `ETA (raw)`, `Seeding Time (raw)`, `Time Active (raw)`, `Seeding Time Limit (raw)`, `Max Seeding Time (raw)`, `Max Inactive Seeding Time (raw)`, and `Inactive Seeding Time Limit (raw)`. Confirm each still opens the plain Operator/Value/From/To `NumberColumnFilter` popup (no unit dropdown, no mode dropdown).
