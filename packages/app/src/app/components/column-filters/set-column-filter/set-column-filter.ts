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
