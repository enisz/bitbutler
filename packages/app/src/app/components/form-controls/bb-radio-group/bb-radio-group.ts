import {
  ChangeDetectionStrategy,
  Component,
  computed,
  contentChildren,
  forwardRef,
  input,
  model,
  signal,
} from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { BbRadio } from './bb-radio';

export type BbRadioGroupAppearance = 'list' | 'inline' | 'cards' | 'tiles';

let nextId = 0;

/**
 * A single choice among `app-bb-radio` children, bound to a form or used with `[(value)]`.
 *
 * Appearances:
 * - `list` (default): one radio per row, with optional sub-text
 * - `inline`: a compact wrapping row, no sub-text (Low / Normal / High)
 * - `cards`: option cards - boxed radios with a title and a one-line sub-text, side by side;
 *   `columns` sets how many fit in a row (default: all of them), and a narrow group falls back
 *   to one per row
 * - `tiles`: fixed-size square tiles without a radio circle, an icon (`[bbRadioIcon]` content
 *   of each radio) above the label, wrapping as needed (the language picker)
 *
 * The radios share a generated `name`, so arrow keys move the choice natively.
 * Label the group with `aria-label` or `aria-labelledby` on the host.
 */
@Component({
  selector: 'app-bb-radio-group',
  templateUrl: './bb-radio-group.html',
  styleUrl: './bb-radio-group.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [
    { provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => BbRadioGroup), multi: true },
  ],
  host: {
    role: 'radiogroup',
    '[class.bb-radio-group--list]': "appearance() === 'list'",
    '[class.bb-radio-group--inline]': "appearance() === 'inline'",
    '[class.bb-radio-group--cards]': "appearance() === 'cards'",
    '[class.bb-radio-group--tiles]': "appearance() === 'tiles'",
    '[style.--bb-radio-columns]': 'columnCount()',
  },
})
export class BbRadioGroup<T = unknown> implements ControlValueAccessor {
  public readonly value = model<T | null>(null);
  public readonly appearance = input<BbRadioGroupAppearance>('list');
  public readonly columns = input<number>();
  public readonly disabled = input(false);

  public readonly name = `bb-radio-group-${nextId++}`;

  private readonly radios = contentChildren(forwardRef(() => BbRadio));
  private readonly disabledByForm = signal(false);
  private onChange: (value: T) => void = () => undefined;
  private onTouched: () => void = () => undefined;

  protected readonly columnCount = computed(() => this.columns() ?? this.radios().length);
  public readonly isDisabled = computed(() => this.disabled() || this.disabledByForm());

  public select(value: T): void {
    this.value.set(value);
    this.onChange(value);
  }

  public touch(): void {
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
