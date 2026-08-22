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
    if (this.applied.mode === 'noLimit') return cellValue == null || cellValue === -1;
    if (this.applied.mode === 'global') return cellValue === -2;
    if (cellValue == null || cellValue === -1 || cellValue === -2) return false;
    return numberOperatorPasses(
      this.applied.operator,
      cellValue,
      this.applied.from,
      this.applied.to,
    );
  }
}
