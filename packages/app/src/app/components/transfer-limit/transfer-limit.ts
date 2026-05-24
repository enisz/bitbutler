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
import { SpeedLimitPipe } from '../../pipes/speed-limit-pipe';
import { BbPopover } from '../bb-popover/bb-popover';

export type TransferLimitMode = 'custom' | 'no-limit';

export type TransferLimitValue = {
  uploadLimit: number | null;
  downloadLimit: number | null;
};

@Component({
  selector: 'app-transfer-limit',
  imports: [ReactiveFormsModule, TranslatePipe, BbPopover, SpeedLimitPipe],
  templateUrl: './transfer-limit.html',
  styleUrl: './transfer-limit.scss',
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => TransferLimit),
      multi: true,
    },
  ],
})
export class TransferLimit implements ControlValueAccessor {
  private readonly cdr = inject(ChangeDetectorRef);

  public form = new FormGroup({
    uploadLimit: new FormControl<number | null>({ value: null, disabled: true }),
    downloadLimit: new FormControl<number | null>({ value: null, disabled: true }),
  });

  public uploadMode = signal<TransferLimitMode>('no-limit');
  public downloadMode = signal<TransferLimitMode>('no-limit');

  private onChange: (value: TransferLimitValue) => void = () => {};
  private onTouched: () => void = () => {};

  constructor() {
    this.form.valueChanges.pipe(takeUntilDestroyed()).subscribe(() => this.emitChange());
  }

  public setUploadMode(mode: TransferLimitMode): void {
    this.uploadMode.set(mode);
    this.syncControl(this.form.controls.uploadLimit, mode);
    this.emitChange();
  }

  public setDownloadMode(mode: TransferLimitMode): void {
    this.downloadMode.set(mode);
    this.syncControl(this.form.controls.downloadLimit, mode);
    this.emitChange();
  }

  private syncControl(control: FormControl<number | null>, mode: TransferLimitMode): void {
    if (mode === 'custom') {
      control.enable({ emitEvent: false });
    } else {
      control.disable({ emitEvent: false });
    }
  }

  private emitChange(): void {
    this.onChange({
      uploadLimit: this.uploadMode() === 'custom' ? this.form.controls.uploadLimit.value : null,
      downloadLimit:
        this.downloadMode() === 'custom' ? this.form.controls.downloadLimit.value : null,
    });
    this.onTouched();
  }

  public writeValue(value: TransferLimitValue | null): void {
    this.applyValue(this.uploadMode, this.form.controls.uploadLimit, value?.uploadLimit ?? null);
    this.applyValue(
      this.downloadMode,
      this.form.controls.downloadLimit,
      value?.downloadLimit ?? null,
    );
    this.cdr.markForCheck();
  }

  private applyValue(
    modeSignal: WritableSignal<TransferLimitMode>,
    control: FormControl<number | null>,
    apiValue: number | null,
  ): void {
    if (apiValue !== null && apiValue > 0) {
      modeSignal.set('custom');
      control.setValue(apiValue, { emitEvent: false });
      control.enable({ emitEvent: false });
    } else {
      modeSignal.set('no-limit');
      control.setValue(null, { emitEvent: false });
      control.disable({ emitEvent: false });
    }
  }

  public registerOnChange(fn: (value: TransferLimitValue) => void): void {
    this.onChange = fn;
  }

  public registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  public setDisabledState(isDisabled: boolean): void {
    if (isDisabled) {
      this.form.disable({ emitEvent: false });
    } else {
      if (this.uploadMode() === 'custom')
        this.form.controls.uploadLimit.enable({ emitEvent: false });
      if (this.downloadMode() === 'custom')
        this.form.controls.downloadLimit.enable({ emitEvent: false });
    }
  }
}
