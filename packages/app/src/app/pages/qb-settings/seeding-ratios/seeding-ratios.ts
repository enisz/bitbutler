import { CommonModule } from '@angular/common';
import { Component, DestroyRef, OnInit, computed, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { NgSelectComponent } from '@ng-select/ng-select';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { QbService } from '../../../services/qb.service';
import { ServerStoreService } from '../../../services/server-store.service';
import { QbSettingsStateService } from '../qb-settings-state.service';
import { QbSettingsTabComponent } from '../qb-settings.interface';

interface RatioActOption {
  value: number;
  label: string;
}

@Component({
  selector: 'app-qb-settings-seeding-ratios',
  imports: [CommonModule, ReactiveFormsModule, NgSelectComponent, TranslatePipe],
  templateUrl: './seeding-ratios.html',
  styleUrl: './seeding-ratios.scss',
})
export class SeedingRatios implements QbSettingsTabComponent, OnInit {
  private readonly stateService = inject(QbSettingsStateService);
  private readonly qbService = inject(QbService);
  private readonly serverStoreService = inject(ServerStoreService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly translateService = inject(TranslateService);

  public readonly ratioActOptions = computed<RatioActOption[]>(() => [
    {
      value: 0,
      label: this.translateService.instant('pages.qb-settings.tab.seeding-ratios.ratio-act.pause'),
    },
    {
      value: 1,
      label: this.translateService.instant('pages.qb-settings.tab.seeding-ratios.ratio-act.remove'),
    },
  ]);

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
    [this.form.controls.max_ratio, this.form.controls.max_ratio_act].forEach((c) =>
      enabled ? c.enable({ emitEvent: false }) : c.disable({ emitEvent: false }),
    );
  }

  private updateSeedingTimeState(enabled: boolean): void {
    enabled
      ? this.form.controls.max_seeding_time.enable({ emitEvent: false })
      : this.form.controls.max_seeding_time.disable({ emitEvent: false });
  }

  private async save(): Promise<void> {
    const v = this.form.getRawValue();
    await this.qbService.setAppPreferences(this.serverStoreService.currentServerId()!, {
      max_ratio_enabled: v.max_ratio_enabled,
      max_ratio: v.max_ratio,
      max_ratio_act: v.max_ratio_act,
      max_seeding_time_enabled: v.max_seeding_time_enabled,
      max_seeding_time: v.max_seeding_time,
    });
  }
}
