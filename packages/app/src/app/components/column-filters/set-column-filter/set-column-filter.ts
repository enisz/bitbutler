import { ChangeDetectionStrategy, Component, computed } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormControl, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { faCheck, faEraser, faXmark } from '@fortawesome/free-solid-svg-icons';
import { TranslateModule } from '@ngx-translate/core';
import { IFilterAngularComp } from 'ag-grid-angular';
import { IAfterGuiAttachedParams, IDoesFilterPassParams, IFilterParams } from 'ag-grid-community';
import { debounceTime, startWith } from 'rxjs/operators';
import { BbBtnContent } from '../../bb-btn-content/bb-btn-content';
import { createFilterInstanceId } from '../filter-instance-id.utils';

const FILTER_DEBOUNCE_MS = 150;

export interface ValueCount {
  key: string;
  label: string;
  count: number;
}

export interface SetColumnFilterParams extends IFilterParams {
  getItems: () => ValueCount[];
  getValues?: (cellValue: unknown) => string[];
}

export interface SetFilterValue {
  values: string[];
}

export function buildValueCounts<T>(
  rows: readonly T[],
  getValue: (row: T) => string | null | undefined,
): ValueCount[] {
  const counts = new Map<string, number>();
  for (const row of rows) {
    const v = getValue(row);
    if (v) counts.set(v, (counts.get(v) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([key, count]) => ({ key, label: key, count }))
    .sort((a, b) => a.label.localeCompare(b.label));
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
  private params!: SetColumnFilterParams;

  public readonly icons = { faCheck, faEraser, faXmark };
  public filterCtrl = new FormControl('', { nonNullable: true });
  public readonly instanceId = createFilterInstanceId('set-filter');

  draftValues = new Set<string>();
  appliedValues = new Set<string>();

  private readonly searchText = toSignal(
    this.filterCtrl.valueChanges.pipe(startWith(''), debounceTime(FILTER_DEBOUNCE_MS)),
    { initialValue: '' },
  );

  readonly items = computed<ValueCount[]>(() => this.params?.getItems() ?? []);

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
    const cellValue = this.params.getValue(params.node);
    const values = this.params.getValues
      ? this.params.getValues(cellValue)
      : cellValue != null
        ? [String(cellValue)]
        : [];
    return values.some((v) => this.appliedValues.has(v));
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
    this.params.api.hidePopupMenu();
  }

  clear(): void {
    this.draftValues = new Set();
    this.appliedValues = new Set();
    this.params.filterChangedCallback();
    this.params.api.hidePopupMenu();
  }

  isApplyDisabled(): boolean {
    if (this.draftValues.size !== this.appliedValues.size) return false;
    for (const value of this.draftValues) {
      if (!this.appliedValues.has(value)) return false;
    }
    return true;
  }
}
