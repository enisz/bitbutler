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
  public readonly instanceId = createFilterInstanceId('number-filter');

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
