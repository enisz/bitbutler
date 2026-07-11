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
  public readonly instanceId = createFilterInstanceId('size-filter');

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
