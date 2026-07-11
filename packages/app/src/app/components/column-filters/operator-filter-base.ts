import { IFilterAngularComp } from 'ag-grid-angular';
import { IAfterGuiAttachedParams, IDoesFilterPassParams, IFilterParams } from 'ag-grid-community';

export abstract class OperatorFilterBase<TValue> implements IFilterAngularComp {
  protected params!: IFilterParams;

  abstract draft: TValue;
  abstract applied: TValue;

  abstract createEmptyValue(): TValue;
  abstract valuesEqual(a: TValue, b: TValue): boolean;
  abstract isActive(value: TValue): boolean;
  abstract doesFilterPass(params: IDoesFilterPassParams): boolean;

  agInit(params: IFilterParams): void {
    this.params = params;
  }

  isFilterActive(): boolean {
    return this.isActive(this.applied);
  }

  getModel(): TValue | null {
    return this.isFilterActive() ? this.applied : null;
  }

  setModel(model: TValue | null): void {
    this.applied = model ?? this.createEmptyValue();
    this.draft = { ...this.applied };
  }

  afterGuiAttached(_params?: IAfterGuiAttachedParams): void {
    this.draft = { ...this.applied };
  }

  apply(): void {
    this.applied = { ...this.draft };
    this.params.filterChangedCallback();
  }

  clear(): void {
    this.draft = this.createEmptyValue();
    this.applied = this.createEmptyValue();
    this.params.filterChangedCallback();
  }

  isApplyDisabled(): boolean {
    return this.valuesEqual(this.draft, this.applied);
  }
}
