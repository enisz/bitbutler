import { CommonModule } from '@angular/common';
import { Component, DestroyRef, OnInit, computed, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { NgSelectComponent } from '@ng-select/ng-select';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { BbPopover } from '../../../components/bb-popover/bb-popover';
import { SpeedLimitPipe } from '../../../pipes/speed-limit-pipe';
import { QbService } from '../../../services/qb.service';
import { ServerStoreService } from '../../../services/server-store.service';
import { QbSettingsStateService } from '../qb-settings-state.service';
import { QbSettingsTabComponent } from '../qb-settings.interface';

interface SchedulerDayOption {
  value: number;
  label: string;
}

@Component({
  selector: 'app-qb-settings-bandwidth',
  imports: [
    CommonModule,
    ReactiveFormsModule,
    NgSelectComponent,
    TranslatePipe,
    SpeedLimitPipe,
    BbPopover,
  ],
  templateUrl: './bandwidth.html',
  styleUrl: './bandwidth.scss',
})
export class Bandwidth implements QbSettingsTabComponent, OnInit {
  private readonly stateService = inject(QbSettingsStateService);
  private readonly qbService = inject(QbService);
  private readonly serverStoreService = inject(ServerStoreService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly translateService = inject(TranslateService);

  public readonly hasScheduler = computed(
    () => 'scheduler_enabled' in (this.stateService.preferences() ?? {}),
  );

  public readonly schedulerDays: SchedulerDayOption[] = [
    {
      value: 0,
      label: this.translateService.instant(
        'pages.qb-settings.tab.bandwidth.scheduler-days.every-day',
      ),
    },
    {
      value: 1,
      label: this.translateService.instant(
        'pages.qb-settings.tab.bandwidth.scheduler-days.every-weekday',
      ),
    },
    {
      value: 2,
      label: this.translateService.instant(
        'pages.qb-settings.tab.bandwidth.scheduler-days.every-weekend',
      ),
    },
    {
      value: 3,
      label: this.translateService.instant('pages.qb-settings.tab.bandwidth.scheduler-days.monday'),
    },
    {
      value: 4,
      label: this.translateService.instant(
        'pages.qb-settings.tab.bandwidth.scheduler-days.tuesday',
      ),
    },
    {
      value: 5,
      label: this.translateService.instant(
        'pages.qb-settings.tab.bandwidth.scheduler-days.wednesday',
      ),
    },
    {
      value: 6,
      label: this.translateService.instant(
        'pages.qb-settings.tab.bandwidth.scheduler-days.thursday',
      ),
    },
    {
      value: 7,
      label: this.translateService.instant('pages.qb-settings.tab.bandwidth.scheduler-days.friday'),
    },
    {
      value: 8,
      label: this.translateService.instant(
        'pages.qb-settings.tab.bandwidth.scheduler-days.saturday',
      ),
    },
    {
      value: 9,
      label: this.translateService.instant('pages.qb-settings.tab.bandwidth.scheduler-days.sunday'),
    },
  ];

  public readonly hours = Array.from({ length: 24 }, (_, i) => i);
  public readonly minutes = Array.from({ length: 60 }, (_, i) => i);

  public form = new FormGroup({
    dl_limit: new FormControl<number>(0, { nonNullable: true }),
    up_limit: new FormControl<number>(0, { nonNullable: true }),
    alt_dl_limit: new FormControl<number>(0, { nonNullable: true }),
    alt_up_limit: new FormControl<number>(0, { nonNullable: true }),
    scheduler_enabled: new FormControl<boolean>(false, { nonNullable: true }),
    schedule_from_hour: new FormControl<number>(0, { nonNullable: true }),
    schedule_from_min: new FormControl<number>(0, { nonNullable: true }),
    schedule_to_hour: new FormControl<number>(0, { nonNullable: true }),
    schedule_to_min: new FormControl<number>(0, { nonNullable: true }),
    scheduler_days: new FormControl<number>(0, { nonNullable: true }),
  });

  public ngOnInit(): void {
    const prefs = this.stateService.preferences();
    if (prefs) {
      this.form.patchValue(
        {
          dl_limit: Math.round(prefs.dl_limit / 1024),
          up_limit: Math.round(prefs.up_limit / 1024),
          alt_dl_limit: Math.round(prefs.alt_dl_limit / 1024),
          alt_up_limit: Math.round(prefs.alt_up_limit / 1024),
          scheduler_enabled: prefs.scheduler_enabled,
          schedule_from_hour: prefs.schedule_from_hour,
          schedule_from_min: prefs.schedule_from_min,
          schedule_to_hour: prefs.schedule_to_hour,
          schedule_to_min: prefs.schedule_to_min,
          scheduler_days: prefs.scheduler_days,
        },
        { emitEvent: false },
      );
      this.updateSchedulerState(prefs.scheduler_enabled);
    }

    this.stateService.registerSave('bandwidth', () => this.save());

    this.form.controls.scheduler_enabled.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((enabled) => this.updateSchedulerState(enabled));

    this.form.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.stateService.markDirty('bandwidth', true));
  }

  private updateSchedulerState(enabled: boolean): void {
    const subControls = [
      this.form.controls.schedule_from_hour,
      this.form.controls.schedule_from_min,
      this.form.controls.schedule_to_hour,
      this.form.controls.schedule_to_min,
      this.form.controls.scheduler_days,
    ];
    subControls.forEach((c) =>
      enabled ? c.enable({ emitEvent: false }) : c.disable({ emitEvent: false }),
    );
  }

  private async save(): Promise<void> {
    const v = this.form.getRawValue();
    await this.qbService.setAppPreferences(this.serverStoreService.currentServerId()!, {
      dl_limit: v.dl_limit * 1024,
      up_limit: v.up_limit * 1024,
      alt_dl_limit: v.alt_dl_limit * 1024,
      alt_up_limit: v.alt_up_limit * 1024,
      scheduler_enabled: v.scheduler_enabled,
      schedule_from_hour: v.schedule_from_hour,
      schedule_from_min: v.schedule_from_min,
      schedule_to_hour: v.schedule_to_hour,
      schedule_to_min: v.schedule_to_min,
      scheduler_days: v.scheduler_days,
    });
  }
}
