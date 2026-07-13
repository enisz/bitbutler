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
  public readonly instanceId = createFilterInstanceId('text-filter');

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

  isValidModel(model: unknown): model is TextFilterValue {
    if (model == null || typeof model !== 'object') return false;
    const candidate = model as Partial<TextFilterValue>;
    return (
      typeof candidate.operator === 'string' &&
      (STRING_FILTER_OPERATORS as string[]).includes(candidate.operator) &&
      typeof candidate.value === 'string'
    );
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
