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

export interface BooleanFilterValue {
  value: boolean | null;
}

function createEmptyBooleanValue(): BooleanFilterValue {
  return { value: null };
}

@Component({
  selector: 'app-boolean-column-filter',
  standalone: true,
  imports: [FormsModule, NgSelectModule, FontAwesomeModule, TranslateModule, BbBtnContent],
  templateUrl: './boolean-column-filter.html',
  styleUrl: './boolean-column-filter.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BooleanColumnFilter
  extends OperatorFilterBase<BooleanFilterValue>
  implements IFilterAngularComp
{
  private readonly translateService = inject(TranslateService);
  private readonly languageChanged = toSignal(this.translateService.onLangChange);

  public readonly icons = { faCheck, faEraser };
  public readonly instanceId = createFilterInstanceId('boolean-filter');

  draft: BooleanFilterValue = createEmptyBooleanValue();
  applied: BooleanFilterValue = createEmptyBooleanValue();

  readonly valueItems = computed(() => {
    this.languageChanged();
    return [
      {
        value: true,
        label: this.translateService.instant('components.column-filters.boolean.true'),
      },
      {
        value: false,
        label: this.translateService.instant('components.column-filters.boolean.false'),
      },
    ];
  });

  createEmptyValue(): BooleanFilterValue {
    return createEmptyBooleanValue();
  }

  valuesEqual(a: BooleanFilterValue, b: BooleanFilterValue): boolean {
    return a.value === b.value;
  }

  isActive(value: BooleanFilterValue): boolean {
    return value.value !== null;
  }

  isValidModel(model: unknown): model is BooleanFilterValue {
    if (model == null || typeof model !== 'object') return false;
    const candidate = model as Partial<BooleanFilterValue>;
    return candidate.value === null || typeof candidate.value === 'boolean';
  }

  doesFilterPass(params: IDoesFilterPassParams): boolean {
    if (!this.isFilterActive()) return true;
    const cellValue = this.params.getValue(params.node) as boolean | null | undefined;
    return cellValue === this.applied.value;
  }
}
