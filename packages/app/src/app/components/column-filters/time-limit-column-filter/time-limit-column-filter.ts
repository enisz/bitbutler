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
