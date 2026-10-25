import {
  ChangeDetectionStrategy,
  Component,
  computed,
  forwardRef,
  input,
  model,
  signal,
} from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';

export interface BbSegmentedOption<T = unknown> {
  value: T;
  label: string;
  disabled?: boolean;
}

let nextId = 0;

/**
 * A row of joined buttons that switches which input or view is shown below it (File / Link /
 * Folder). For a choice of value whose effect needs explaining, use option cards
 * (`app-bb-radio-group appearance="cards"`) instead.
 *
 * Native radios underneath, so arrow keys move the choice. Bound to a form or used with
 * `[(value)]`; label it with `aria-label` or `aria-labelledby` on the host.
 */
@Component({
  selector: 'app-bb-segmented',
  templateUrl: './bb-segmented.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [
    { provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => BbSegmented), multi: true },
  ],
  host: {
    role: 'radiogroup',
    class: 'bb-ctl-segments',
    '[class.bb-ctl-segments--sm]': "size() === 'sm'",
  },
})
export class BbSegmented<T = unknown> implements ControlValueAccessor {
  public readonly options = input.required<readonly BbSegmentedOption<T>[]>();
  public readonly value = model<T | null>(null);
  public readonly size = input<'md' | 'sm'>('md');
  public readonly disabled = input(false);

  protected readonly name = `bb-segmented-${nextId++}`;

  private readonly disabledByForm = signal(false);
  private onChange: (value: T) => void = () => undefined;
  private onTouched: () => void = () => undefined;

  protected readonly isDisabled = computed(() => this.disabled() || this.disabledByForm());

  protected select(value: T): void {
    this.value.set(value);
    this.onChange(value);
  }

  protected touch(): void {
    this.onTouched();
  }

  public writeValue(value: T | null): void {
    this.value.set(value);
  }

  public registerOnChange(fn: (value: T) => void): void {
    this.onChange = fn;
  }

  public registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  public setDisabledState(isDisabled: boolean): void {
    this.disabledByForm.set(isDisabled);
  }
}
