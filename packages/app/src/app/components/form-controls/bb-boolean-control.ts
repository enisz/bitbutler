import { DestroyRef, Directive, OnInit, inject, input, model, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ControlValueAccessor, NgControl } from '@angular/forms';

let nextId = 0;

/**
 * Shared state of the on/off form controls (`app-bb-checkbox`, `app-bb-switch`).
 *
 * Works bound to a form (`formControlName`, `[formControl]`, `ngModel`) through
 * `ControlValueAccessor`, or standalone through `[(checked)]` / `[disabled]`.
 */
@Directive()
export abstract class BbBooleanControl implements ControlValueAccessor, OnInit {
  public readonly checked = model(false);
  public readonly disabled = input(false);
  public readonly label = input<string>();
  public readonly sub = input<string>();
  public readonly inputId = input<string>();

  protected readonly generatedId = `bb-control-${nextId++}`;
  protected readonly disabledByForm = signal(false);
  /** The bound form control is invalid and was touched. */
  protected readonly controlInvalid = signal(false);

  private readonly ngControl = inject(NgControl, { self: true, optional: true });
  private readonly destroyRef = inject(DestroyRef);
  private onChange: (value: boolean) => void = () => undefined;
  private onTouched: () => void = () => undefined;

  constructor() {
    if (this.ngControl) this.ngControl.valueAccessor = this;
  }

  public ngOnInit(): void {
    const control = this.ngControl?.control;
    if (!control) return;

    const sync = () => this.controlInvalid.set(control.invalid && control.touched);
    sync();
    control.events.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(sync);
  }

  protected id(): string {
    return this.inputId() ?? this.generatedId;
  }

  protected isDisabled(): boolean {
    return this.disabled() || this.disabledByForm();
  }

  protected onInputChange(event: Event): void {
    const value = (event.target as HTMLInputElement).checked;
    this.checked.set(value);
    this.onChange(value);
  }

  protected onBlur(): void {
    this.onTouched();
  }

  public writeValue(value: boolean | null): void {
    this.checked.set(!!value);
  }

  public registerOnChange(fn: (value: boolean) => void): void {
    this.onChange = fn;
  }

  public registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  public setDisabledState(isDisabled: boolean): void {
    this.disabledByForm.set(isDisabled);
  }
}
