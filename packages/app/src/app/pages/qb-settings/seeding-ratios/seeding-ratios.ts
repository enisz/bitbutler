import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { TranslatePipe } from '@ngx-translate/core';
import { BbSectionCard } from '../../../components/bb-section-card/bb-section-card';
import { BbRadio } from '../../../components/form-controls/bb-radio-group/bb-radio';
import { BbRadioGroup } from '../../../components/form-controls/bb-radio-group/bb-radio-group';
import { BbOptionText } from '../../../directives/bb-option-text';
import { RatioLimitPipe } from '../../../pipes/ratio-limit-pipe';
import { TimeLimitPipe } from '../../../pipes/time-limit-pipe';
import { QbService } from '../../../services/qb.service';
import { ServerStoreService } from '../../../services/server-store.service';
import { QbSettingsStateService } from '../qb-settings-state.service';
import { QbSettingsTabComponent } from '../qb-settings.interface';

@Component({
  selector: 'app-qb-settings-seeding-ratios',
  imports: [
    BbRadio,
    BbRadioGroup,
    BbOptionText,
    BbSectionCard,
    CommonModule,
    ReactiveFormsModule,
    TranslatePipe,
    RatioLimitPipe,
    TimeLimitPipe,
  ],
  templateUrl: './seeding-ratios.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SeedingRatios implements QbSettingsTabComponent, OnInit {
  private readonly stateService = inject(QbSettingsStateService);
  private readonly qbService = inject(QbService);
  private readonly serverStoreService = inject(ServerStoreService);
  private readonly destroyRef = inject(DestroyRef);

  public form = new FormGroup({
    max_ratio_enabled: new FormControl<boolean>(false, { nonNullable: true }),
    max_ratio: new FormControl<number>(0, { nonNullable: true }),
    max_ratio_act: new FormControl<number>(0, { nonNullable: true }),
    max_seeding_time_enabled: new FormControl<boolean>(false, { nonNullable: true }),
    max_seeding_time: new FormControl<number>(0, { nonNullable: true }),
  });

  public ngOnInit(): void {
    const prefs = this.stateService.preferences();
    if (prefs) {
      this.form.patchValue(
        {
          max_ratio_enabled: prefs.max_ratio_enabled,
          max_ratio: prefs.max_ratio,
          max_ratio_act: prefs.max_ratio_act,
          max_seeding_time_enabled: prefs.max_seeding_time_enabled,
          max_seeding_time: prefs.max_seeding_time,
        },
        { emitEvent: false },
      );
      this.updateRatioState(prefs.max_ratio_enabled);
      this.updateSeedingTimeState(prefs.max_seeding_time_enabled);
    }

    this.stateService.registerSave('seeding-ratios', () => this.save());

    this.form.controls.max_ratio_enabled.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((enabled) => this.updateRatioState(enabled));

    this.form.controls.max_seeding_time_enabled.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((enabled) => this.updateSeedingTimeState(enabled));

    this.form.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.stateService.markDirty('seeding-ratios', true));
  }

  private updateRatioState(enabled: boolean): void {
    this.setEnabled(this.form.controls.max_ratio, enabled);
    this.updateActionState();
  }

  private updateSeedingTimeState(enabled: boolean): void {
    this.setEnabled(this.form.controls.max_seeding_time, enabled);
    this.updateActionState();
  }

  // As in qBittorrent, one action applies to whichever limit is reached first, so it is
  // available while either limit is on.
  private updateActionState(): void {
    const { max_ratio_enabled, max_seeding_time_enabled } = this.form.getRawValue();
    this.setEnabled(
      this.form.controls.max_ratio_act,
      max_ratio_enabled || max_seeding_time_enabled,
    );
  }

  private setEnabled(control: FormControl, enabled: boolean): void {
    if (enabled) {
      control.enable({ emitEvent: false });
    } else {
      control.disable({ emitEvent: false });
    }
  }

  private async save(): Promise<void> {
    const v = this.form.getRawValue();
    await this.qbService.app.setPreferences(this.serverStoreService.currentServerId()!, {
      max_ratio_enabled: v.max_ratio_enabled,
      max_ratio: v.max_ratio,
      max_ratio_act: v.max_ratio_act,
      max_seeding_time_enabled: v.max_seeding_time_enabled,
      max_seeding_time: v.max_seeding_time,
    });
  }
}
