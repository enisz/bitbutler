import { ChangeDetectorRef, Component, OnInit, forwardRef, inject } from '@angular/core';
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
export class TransferLimit implements ControlValueAccessor, OnInit {
  private readonly cdr = inject(ChangeDetectorRef);

  public form = new FormGroup({
    uploadLimit: new FormControl<number | null>(0),
    downloadLimit: new FormControl<number | null>(0),
  });

  private onChange: (value: TransferLimitValue) => void = () => {};
  private onTouched: () => void = () => {};

  public ngOnInit(): void {
    this.form.valueChanges.subscribe((value) => {
      this.onChange({
        uploadLimit: value.uploadLimit ? value.uploadLimit : null,
        downloadLimit: value.downloadLimit ? value.downloadLimit : null,
      });
      this.onTouched();
    });
  }

  public writeValue(value: TransferLimitValue | null): void {
    this.form.patchValue(
      {
        uploadLimit: value?.uploadLimit ?? null,
        downloadLimit: value?.downloadLimit ?? null,
      },
      { emitEvent: false },
    );
    this.cdr.markForCheck();
  }

  public registerOnChange(fn: (value: TransferLimitValue) => void): void {
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
