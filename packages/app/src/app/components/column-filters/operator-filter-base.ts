import { Injectable, OnDestroy } from '@angular/core';
import { IFilterAngularComp } from 'ag-grid-angular';
import { IAfterGuiAttachedParams, IDoesFilterPassParams, IFilterParams } from 'ag-grid-community';

/**
 * ag-grid closes a filter popup on any mousedown outside its DOM subtree, unless the click
 * target is inside an element carrying this class (see ag-grid's PopupService). ng-select's
 * dropdown panel renders into a CDK Overlay outside the filter's DOM, so `appendTo` is used to
 * contain it inside an element tagged with this class instead - otherwise a click inside the
 * dropdown would register as "outside" and ag-grid would close the filter popup.
 */
export const AG_GRID_CUSTOM_POPUP_CLASS = 'ag-custom-component-popup';

@Injectable()
export abstract class OperatorFilterBase<TValue> implements IFilterAngularComp, OnDestroy {
  protected params!: IFilterParams;

  protected abstract readonly instanceId: string;

  private popupPortal?: HTMLElement;

  get popupPortalSelector(): string {
    return `#${this.instanceId}-popup-portal`;
  }

  abstract draft: TValue;
  abstract applied: TValue;

  abstract createEmptyValue(): TValue;
  abstract valuesEqual(a: TValue, b: TValue): boolean;
  abstract isActive(value: TValue): boolean;
  abstract doesFilterPass(params: IDoesFilterPassParams): boolean;
  abstract isValidModel(model: unknown): model is TValue;

  agInit(params: IFilterParams): void {
    this.params = params;
    this.popupPortal = document.createElement('div');
    this.popupPortal.id = `${this.instanceId}-popup-portal`;
    this.popupPortal.className = AG_GRID_CUSTOM_POPUP_CLASS;
    // Needs a non-static position so it establishes its own containing block - CDK Overlay
    // positions the dropdown panel via viewport coordinates regardless, but this keeps the
    // portal a well-formed positioning context for anything else appended into it.
    this.popupPortal.style.position = 'relative';
    document.body.appendChild(this.popupPortal);
  }

  ngOnDestroy(): void {
    this.popupPortal?.remove();
  }

  isFilterActive(): boolean {
    return this.isActive(this.applied);
  }

  getModel(): TValue | null {
    return this.isFilterActive() ? this.applied : null;
  }

  setModel(model: TValue | null): void {
    this.applied = model != null && this.isValidModel(model) ? model : this.createEmptyValue();
    this.draft = { ...this.applied };
  }

  afterGuiAttached(_params?: IAfterGuiAttachedParams): void {
    this.draft = { ...this.applied };
  }

  apply(): void {
    this.applied = { ...this.draft };
    this.params.filterChangedCallback();
    this.params.api.hidePopupMenu();
  }

  clear(): void {
    this.draft = this.createEmptyValue();
    this.applied = this.createEmptyValue();
    this.params.filterChangedCallback();
    this.params.api.hidePopupMenu();
  }

  isApplyDisabled(): boolean {
    return this.valuesEqual(this.draft, this.applied);
  }
}
