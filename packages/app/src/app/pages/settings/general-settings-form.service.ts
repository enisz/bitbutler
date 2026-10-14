import { DestroyRef, Injectable, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AbstractControl, FormControl, FormGroup } from '@angular/forms';
import { TranslateService } from '@ngx-translate/core';
import { firstValueFrom } from 'rxjs';
import {
  DateFormatPreset,
  FirstDayOfWeek,
  GeneralSettings,
  SavePathInputType,
  ToastPosition,
} from '../../models/general-settings.model';
import { DateFormatService } from '../../services/date-format.service';
import { GeneralSettingsService } from '../../services/general-settings.service';
import { ThemeFamily, ThemeMode, ThemeService } from '../../services/theme.service';
import { hasChangedSections } from '../settings-shell/section-changed';
import { SettingsStateService } from './settings-state.service';

/**
 * Owns the single General settings form. Several panes (General, Appearance, Startup,
 * Notifications) bind to slices of it, so it lives at page level and outlives pane switches.
 */
@Injectable()
export class GeneralSettingsFormService {
  private readonly generalSettingsService = inject(GeneralSettingsService);
  private readonly themeService = inject(ThemeService);
  private readonly translateService = inject(TranslateService);
  private readonly dateFormatService = inject(DateFormatService);
  private readonly stateService = inject(SettingsStateService);
  private readonly destroyRef = inject(DestroyRef);

  public readonly form = new FormGroup({
    behavior: new FormGroup({
      deleteTorrentFile: new FormControl(true, { nonNullable: true }),
      deleteTorrentFileOnDuplicate: new FormControl(
        { value: true, disabled: true },
        { nonNullable: true },
      ),
      automaticUpdate: new FormControl(true, { nonNullable: true }),
    }),
    language: new FormGroup({
      language: new FormControl('us', { nonNullable: true }),
    }),
    dateFormat: new FormGroup({
      preset: new FormControl<DateFormatPreset>('iso', { nonNullable: true }),
      customPattern: new FormControl('yyyy-MM-dd HH:mm', { nonNullable: true }),
      firstDayOfWeek: new FormControl<FirstDayOfWeek>('auto', { nonNullable: true }),
    }),
    appearance: new FormGroup({
      family: new FormControl<ThemeFamily>('bitbutler', { nonNullable: true }),
      mode: new FormControl<ThemeMode>('system', { nonNullable: true }),
    }),
    startup: new FormGroup({
      openAtLogin: new FormControl(false, { nonNullable: true }),
      startMinimized: new FormControl({ value: false, disabled: true }, { nonNullable: true }),
    }),
    savePath: new FormGroup({
      inputType: new FormControl<SavePathInputType>('select', { nonNullable: true }),
    }),
    notifications: new FormGroup({
      os: new FormGroup({
        enabled: new FormControl(true, { nonNullable: true }),
        onlyWhenMinimized: new FormControl(false, { nonNullable: true }),
        finished: new FormControl(true, { nonNullable: true }),
        errors: new FormControl(true, { nonNullable: true }),
        updates: new FormControl(true, { nonNullable: true }),
      }),
      app: new FormGroup({
        enabled: new FormControl(true, { nonNullable: true }),
        position: new FormControl<ToastPosition>('bottom-right', { nonNullable: true }),
        finished: new FormControl(true, { nonNullable: true }),
        errors: new FormControl(true, { nonNullable: true }),
        updates: new FormControl(true, { nonNullable: true }),
        confirmations: new FormControl(true, { nonNullable: true }),
      }),
    }),
  });

  public readonly formSnapshot = signal(this.form.getRawValue());
  public readonly openAtLoginValue = signal(false);
  public readonly loaded = signal(false);

  /** The last loaded or saved values; panes count as changed when their sections differ. */
  private readonly baseline = signal(this.form.getRawValue());

  public readonly paneDirty = computed(() => {
    const current = this.formSnapshot();
    const baseline = this.baseline();
    return {
      general: hasChangedSections(current, baseline, [
        'behavior',
        'savePath',
        'language',
        'dateFormat',
      ]),
      appearance: hasChangedSections(current, baseline, ['appearance']),
      startup: hasChangedSections(current, baseline, ['startup']),
      notifications: hasChangedSections(current, baseline, ['notifications']),
    };
  });

  constructor() {
    const startupGroup = this.form.controls.startup;

    startupGroup.controls.openAtLogin.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((value) => {
        this.openAtLoginValue.set(value);
        const ctrl = startupGroup.controls.startMinimized;
        if (value) {
          ctrl.enable({ emitEvent: false });
        } else {
          ctrl.setValue(false, { emitEvent: false });
          ctrl.disable({ emitEvent: false });
        }
      });

    const behaviorGroup = this.form.controls.behavior;

    behaviorGroup.controls.deleteTorrentFile.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((value) => {
        const ctrl = behaviorGroup.controls.deleteTorrentFileOnDuplicate;
        if (value) {
          ctrl.enable({ emitEvent: false });
        } else {
          ctrl.setValue(false, { emitEvent: false });
          ctrl.disable({ emitEvent: false });
        }
      });

    const { os, app } = this.form.controls.notifications.controls;

    for (const group of [os, app]) {
      group.controls.enabled.valueChanges
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe(() => this.applyMasterSwitch(group));
    }

    this.stateService.registerSave('general', () => this.save());

    this.form.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => {
      this.formSnapshot.set(this.form.getRawValue());
      this.stateService.markDirty('general', Object.values(this.paneDirty()).some(Boolean));
    });

    void this.load();
  }

  public async load(): Promise<void> {
    const settings = await this.generalSettingsService.load();
    this.form.patchValue(settings, { emitEvent: false });
    this.applyDependentControlStates(settings);
    this.formSnapshot.set(this.form.getRawValue());
    this.baseline.set(this.formSnapshot());
    this.loaded.set(true);
  }

  public async save(): Promise<void> {
    const settings = this.form.getRawValue();

    if (!settings.startup.openAtLogin) settings.startup.startMinimized = false;
    if (!settings.behavior.deleteTorrentFile)
      settings.behavior.deleteTorrentFileOnDuplicate = false;

    const newLang = settings.language.language;
    const currentLang = this.translateService.getCurrentLang();

    await this.generalSettingsService.save(settings);
    await window.bitbutler.electron.setLoginItem({ openAtLogin: settings.startup.openAtLogin });

    if (newLang !== currentLang) {
      await firstValueFrom(this.translateService.use(newLang));
    }

    this.themeService.applyFromSettings(settings.appearance.family, settings.appearance.mode);
    this.dateFormatService.applyFromSettings(settings);
    this.baseline.set(this.form.getRawValue());
  }

  // A master switch disables its children without resetting them, so turning it back on
  // restores the choices the user had made.
  private applyMasterSwitch(group: FormGroup): void {
    const enabled = group.controls['enabled'].value;
    for (const [name, control] of Object.entries(group.controls) as [string, AbstractControl][]) {
      if (name === 'enabled') continue;
      if (enabled) {
        control.enable({ emitEvent: false });
      } else {
        control.disable({ emitEvent: false });
      }
    }
  }

  private applyDependentControlStates(settings: GeneralSettings): void {
    const { startup, behavior, notifications } = this.form.controls;

    const openAtLogin = settings.startup?.openAtLogin ?? false;
    this.openAtLoginValue.set(openAtLogin);
    if (openAtLogin) {
      startup.controls.startMinimized.enable({ emitEvent: false });
    } else {
      startup.controls.startMinimized.setValue(false, { emitEvent: false });
      startup.controls.startMinimized.disable({ emitEvent: false });
    }

    const deleteTorrentFile = settings.behavior?.deleteTorrentFile ?? false;
    if (deleteTorrentFile) {
      behavior.controls.deleteTorrentFileOnDuplicate.enable({ emitEvent: false });
    } else {
      behavior.controls.deleteTorrentFileOnDuplicate.disable({ emitEvent: false });
    }

    this.applyMasterSwitch(notifications.controls.os);
    this.applyMasterSwitch(notifications.controls.app);
  }
}
