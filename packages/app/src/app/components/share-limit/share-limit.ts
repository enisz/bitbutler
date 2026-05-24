import {
  ChangeDetectorRef,
  Component,
  WritableSignal,
  forwardRef,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  ControlValueAccessor,
  FormControl,
  FormGroup,
  NG_VALUE_ACCESSOR,
  ReactiveFormsModule,
} from '@angular/forms';
import { TranslatePipe } from '@ngx-translate/core';
import { RatioLimitPipe } from '../../pipes/ratio-limit-pipe';
import { TimeLimitPipe } from '../../pipes/time-limit-pipe';
import { BbPopover } from '../bb-popover/bb-popover';

export type LimitMode = 'custom' | 'global' | 'no-limit';

export type ShareLimitValue = {
  ratioLimit: number | null;
  seedingTimeLimit: number | null;
  inactiveSeedingTimeLimit: number | null;
};

@Component({
  selector: 'app-share-limit',
  imports: [ReactiveFormsModule, TranslatePipe, BbPopover, TimeLimitPipe, RatioLimitPipe],
  templateUrl: './share-limit.html',
  styleUrl: './share-limit.scss',
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => ShareLimit),
      multi: true,
    },
  ],
})
export class ShareLimit implements ControlValueAccessor {
  private readonly cdr = inject(ChangeDetectorRef);

  public form = new FormGroup({
    ratioLimit: new FormControl<number | null>({ value: null, disabled: true }),
    seedingTimeLimit: new FormControl<number | null>({ value: null, disabled: true }),
    inactiveSeedingTimeLimit: new FormControl<number | null>({ value: null, disabled: true }),
  });

  public ratioMode = signal<LimitMode>('no-limit');
  public seedingMode = signal<LimitMode>('no-limit');
  public inactiveMode = signal<LimitMode>('no-limit');

  private onChange: (value: ShareLimitValue) => void = () => {};
  private onTouched: () => void = () => {};

  constructor() {
    this.form.valueChanges.pipe(takeUntilDestroyed()).subscribe(() => this.emitChange());
  }

  public setRatioMode(mode: LimitMode): void {
    this.ratioMode.set(mode);
    this.syncControl(this.form.controls.ratioLimit, mode);
    this.emitChange();
  }

  public setSeedingMode(mode: LimitMode): void {
    this.seedingMode.set(mode);
    this.syncControl(this.form.controls.seedingTimeLimit, mode);
    this.emitChange();
  }

  public setInactiveMode(mode: LimitMode): void {
    this.inactiveMode.set(mode);
    this.syncControl(this.form.controls.inactiveSeedingTimeLimit, mode);
    this.emitChange();
  }

  private syncControl(control: FormControl<number | null>, mode: LimitMode): void {
    if (mode === 'custom') {
      control.enable({ emitEvent: false });
    } else {
      control.disable({ emitEvent: false });
    }
  }

  private emitChange(): void {
    this.onChange({
      ratioLimit: this.resolveValue(this.ratioMode(), this.form.controls.ratioLimit.value),
      seedingTimeLimit: this.resolveValue(
        this.seedingMode(),
        this.form.controls.seedingTimeLimit.value,
      ),
      inactiveSeedingTimeLimit: this.resolveValue(
        this.inactiveMode(),
        this.form.controls.inactiveSeedingTimeLimit.value,
      ),
    });
    this.onTouched();
  }

  private resolveValue(mode: LimitMode, customValue: number | null): number | null {
    if (mode === 'global') return -2;
    if (mode === 'no-limit') return null;
    return customValue;
  }

  public writeValue(value: ShareLimitValue | null): void {
    this.applyValue(this.ratioMode, this.form.controls.ratioLimit, value?.ratioLimit ?? null);
    this.applyValue(
      this.seedingMode,
      this.form.controls.seedingTimeLimit,
      value?.seedingTimeLimit ?? null,
    );
    this.applyValue(
      this.inactiveMode,
      this.form.controls.inactiveSeedingTimeLimit,
      value?.inactiveSeedingTimeLimit ?? null,
    );
    this.cdr.markForCheck();
  }

  private applyValue(
    modeSignal: WritableSignal<LimitMode>,
    control: FormControl<number | null>,
    apiValue: number | null,
  ): void {
    if (apiValue === -2) {
      modeSignal.set('global');
      control.setValue(null, { emitEvent: false });
      control.disable({ emitEvent: false });
    } else if (apiValue === null || apiValue === -1) {
      modeSignal.set('no-limit');
      control.setValue(null, { emitEvent: false });
      control.disable({ emitEvent: false });
    } else {
      modeSignal.set('custom');
      control.setValue(apiValue, { emitEvent: false });
      control.enable({ emitEvent: false });
    }
  }

  public registerOnChange(fn: (value: ShareLimitValue) => void): void {
    this.onChange = fn;
  }

  public registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  public setDisabledState(isDisabled: boolean): void {
    if (isDisabled) {
      this.form.disable({ emitEvent: false });
    } else {
      if (this.ratioMode() === 'custom') this.form.controls.ratioLimit.enable({ emitEvent: false });
      if (this.seedingMode() === 'custom')
        this.form.controls.seedingTimeLimit.enable({ emitEvent: false });
      if (this.inactiveMode() === 'custom')
        this.form.controls.inactiveSeedingTimeLimit.enable({ emitEvent: false });
    }
  }
}
