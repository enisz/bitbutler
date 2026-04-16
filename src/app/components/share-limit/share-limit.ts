import { Component, forwardRef, Input, OnInit } from '@angular/core';
import {
  ControlValueAccessor,
  FormControl,
  FormGroup,
  NG_VALUE_ACCESSOR,
  ReactiveFormsModule,
} from '@angular/forms';
import { TranslatePipe } from '@ngx-translate/core';

export type ShareLimitValue = {
  ratioLimit: number | null;
  seedingTimeLimit: number | null;
  inactiveSeedingTimeLimit: number | null;
};

@Component({
  selector: 'app-share-limit',
  imports: [ReactiveFormsModule, TranslatePipe],
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
export class ShareLimit implements ControlValueAccessor, OnInit {
  @Input() public hideInactive = false;

  public form = new FormGroup({
    ratioLimit: new FormControl<number | null>(null),
    seedingTimeLimit: new FormControl<number | null>(null),
    inactiveSeedingTimeLimit: new FormControl<number | null>(null),
  });

  private onChange: (value: ShareLimitValue) => void = () => {};
  private onTouched: () => void = () => {};

  public ngOnInit(): void {
    this.form.valueChanges.subscribe((value) => {
      this.onChange({
        ratioLimit: value.ratioLimit ?? null,
        seedingTimeLimit: value.seedingTimeLimit ?? null,
        inactiveSeedingTimeLimit: value.inactiveSeedingTimeLimit ?? null,
      });
      this.onTouched();
    });
  }

  public writeValue(value: ShareLimitValue | null): void {
    this.form.patchValue(
      value ?? { ratioLimit: null, seedingTimeLimit: null, inactiveSeedingTimeLimit: null },
      { emitEvent: false },
    );
  }

  public registerOnChange(fn: (value: ShareLimitValue) => void): void {
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
