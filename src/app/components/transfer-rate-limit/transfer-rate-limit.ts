import { Component, forwardRef, OnInit } from '@angular/core';
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

export type TransferRateLimitValue = {
  uploadLimit: number | null; // KiB/s; null = no limit (unlimited)
  downloadLimit: number | null; // KiB/s; null = no limit (unlimited)
};

@Component({
  selector: 'app-transfer-rate-limit',
  imports: [ReactiveFormsModule, TranslatePipe, BbPopover, SpeedLimitPipe],
  templateUrl: './transfer-rate-limit.html',
  styleUrl: './transfer-rate-limit.scss',
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => TransferRateLimit),
      multi: true,
    },
  ],
})
export class TransferRateLimit implements ControlValueAccessor, OnInit {
  public form = new FormGroup({
    uploadLimit: new FormControl<number | null>(null),
    downloadLimit: new FormControl<number | null>(null),
  });

  private onChange: (value: TransferRateLimitValue) => void = () => {};
  private onTouched: () => void = () => {};

  public ngOnInit(): void {
    this.form.valueChanges.subscribe((value) => {
      this.onChange({
        uploadLimit: value.uploadLimit ?? null,
        downloadLimit: value.downloadLimit ?? null,
      });
      this.onTouched();
    });
  }

  public writeValue(value: TransferRateLimitValue | null): void {
    this.form.patchValue(value ?? { uploadLimit: null, downloadLimit: null }, {
      emitEvent: false,
    });
  }

  public registerOnChange(fn: (value: TransferRateLimitValue) => void): void {
    this.onChange = fn;
  }

  public registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  public setDisabledState(isDisabled: boolean): void {
    if (isDisabled) {
      this.form.disable();
    } else {
      this.form.enable();
    }
  }
}
