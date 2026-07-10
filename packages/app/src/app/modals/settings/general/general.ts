import { CommonModule, NgOptimizedImage, formatDate } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import {
  IconDefinition,
  faArrowsRotate,
  faCircleQuestion,
  faRotateLeft,
  faTriangleExclamation,
} from '@fortawesome/free-solid-svg-icons';
import {
  NgLabelTemplateDirective,
  NgOptionTemplateDirective,
  NgSelectComponent,
} from '@ng-select/ng-select';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { firstValueFrom, from, tap } from 'rxjs';
import { BbBtnContent } from '../../../components/bb-btn-content/bb-btn-content';
import { BbPopover } from '../../../components/bb-popover/bb-popover';
import { BbSpinner } from '../../../components/bb-spinner/bb-spinner';
import { SavePathSelect } from '../../../components/save-path-select/save-path-select';
import {
  DATE_FORMAT_PRESETS,
  DEFAULT_GENERAL_SETTINGS,
  DateFormatPreset,
  GeneralSettings,
  SavePathInputType,
  ToastPosition,
  resolveDateFormat,
} from '../../../models/general-settings.model';
import { CommandBusService } from '../../../services/command-bus.service';
import { DateFormatService } from '../../../services/date-format.service';
import { GeneralSettingsService } from '../../../services/general-settings.service';
import { ServerStoreService } from '../../../services/server-store.service';
import {
  THEME_FAMILIES,
  ThemeFamily,
  ThemeMode,
  ThemeService,
  getFamilyLogoUrl,
} from '../../../services/theme.service';
import { SettingsStateService } from '../settings-state.service';
import { SettingsTabComponent } from '../settings.interface';

interface NgSelectItem {
  value: string;
  label: string;
}

interface DateFormatPresetItem {
  value: DateFormatPreset;
  label: string;
  example: string;
}

@Component({
  selector: 'app-general',
  imports: [
    CommonModule,
    NgSelectComponent,
    NgOptionTemplateDirective,
    NgLabelTemplateDirective,
    NgOptimizedImage,
    ReactiveFormsModule,
    FontAwesomeModule,
    BbSpinner,
    BbPopover,
    TranslatePipe,
    SavePathSelect,
    BbBtnContent,
  ],
  templateUrl: './general.html',
  styleUrl: './general.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class General implements SettingsTabComponent {
  private readonly themeService = inject(ThemeService);
  private readonly generalSettingsService = inject(GeneralSettingsService);
  private readonly commandBusService = inject(CommandBusService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly translateService = inject(TranslateService);
  private readonly stateService = inject(SettingsStateService);
  private readonly serverStoreService = inject(ServerStoreService);
  private readonly dateFormatService = inject(DateFormatService);

  private languageChanged = toSignal(this.translateService.onLangChange);

  public readonly hasDefaultServer = computed(() =>
    this.serverStoreService.servers().some((s) => s.auto_login),
  );

  private readonly openAtLoginValue = signal(false);
  public readonly showNoDefaultHostHint = computed(
    () => this.openAtLoginValue() && !this.hasDefaultServer(),
  );

  public languages = computed<NgSelectItem[]>(() => {
    this.languageChanged();

    return [
      {
        value: 'us',
        label: this.translateService.instant('language.us'),
      },
      {
        value: 'hu',
        label: this.translateService.instant('language.hu'),
      },
    ].sort((a, b) => a.label.localeCompare(b.label));
  });

  public toastPositions = computed<NgSelectItem[]>(() => {
    this.languageChanged();

    return [
      {
        value: 'top-left',
        label: this.translateService.instant('pages.settings.tab.general.position.top-left'),
      },
      {
        value: 'top-right',
        label: this.translateService.instant('pages.settings.tab.general.position.top-right'),
      },
      {
        value: 'bottom-right',
        label: this.translateService.instant('pages.settings.tab.general.position.bottom-right'),
      },
      {
        value: 'bottom-left',
        label: this.translateService.instant('pages.settings.tab.general.position.bottom-left'),
      },
    ];
  });

  public families = THEME_FAMILIES;

  public modes = computed<NgSelectItem[]>(() => {
    this.languageChanged();

    return [
      {
        value: 'light',
        label: this.translateService.instant('pages.settings.tab.general.mode.light'),
      },
      {
        value: 'dark',
        label: this.translateService.instant('pages.settings.tab.general.mode.dark'),
      },
      {
        value: 'system',
        label: this.translateService.instant('pages.settings.tab.general.mode.system'),
      },
    ];
  });

  private previewDateFormat(
    preset: DateFormatPreset,
    language: string,
    customPattern: string,
  ): string {
    const { pattern, locale } = resolveDateFormat({
      language: { language },
      dateFormat: { preset, customPattern },
    });

    try {
      return formatDate(new Date(), pattern, locale);
    } catch {
      return formatDate(new Date(), 'yyyy-MM-dd HH:mm', 'en-US');
    }
  }

  public dateFormatPresets = computed<DateFormatPresetItem[]>(() => {
    this.languageChanged();
    const snapshot = this.formSnapshot();
    const language = snapshot.language.language;
    const customPattern = snapshot.dateFormat.customPattern;

    return DATE_FORMAT_PRESETS.map((preset) => ({
      value: preset,
      label: this.translateService.instant(
        `pages.settings.tab.general.general-settings-form.date-format.preset.${preset}`,
      ),
      example: this.previewDateFormat(preset, language, customPattern),
    }));
  });

  public isCustomDateFormat = computed<boolean>(
    () => this.formSnapshot().dateFormat.preset === 'custom',
  );

  public customPatternPreview = computed<string>(() => {
    const snapshot = this.formSnapshot();
    return this.previewDateFormat(
      'custom',
      snapshot.language.language,
      snapshot.dateFormat.customPattern,
    );
  });

  public resetCustomPattern(): void {
    this.generalSettingsForm.controls.dateFormat.controls.customPattern.setValue(
      DEFAULT_GENERAL_SETTINGS.dateFormat.customPattern,
    );
  }

  public icons: Record<string, IconDefinition> = {
    faTriangleExclamation,
    faCircleQuestion,
    faArrowsRotate,
    faRotateLeft,
  };

  public getFamilyLogo = getFamilyLogoUrl;

  public generalSettingsForm = new FormGroup({
    behavior: new FormGroup({
      deleteTorrentFile: new FormControl(true, { nonNullable: true }),
      automaticUpdate: new FormControl(true, { nonNullable: true }),
      toastPosition: new FormControl<ToastPosition>('bottom-right', { nonNullable: true }),
    }),
    language: new FormGroup({
      language: new FormControl('us', { nonNullable: true }),
    }),
    dateFormat: new FormGroup({
      preset: new FormControl<DateFormatPreset>('iso', { nonNullable: true }),
      customPattern: new FormControl('yyyy-MM-dd HH:mm', { nonNullable: true }),
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
  });

  private readonly formSnapshot = signal(this.generalSettingsForm.getRawValue());

  constructor() {
    const startupGroup = this.generalSettingsForm.controls.startup;

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

    this.stateService.registerSave('general', () => this.save());

    this.generalSettingsForm.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        this.stateService.markDirty('general', true);
        this.formSnapshot.set(this.generalSettingsForm.getRawValue());
      });
  }

  public readonly settingsLoaded = toSignal(
    from(this.generalSettingsService.load()).pipe(
      tap((settings: GeneralSettings) => {
        this.generalSettingsForm.patchValue(settings, { emitEvent: false });
        this.formSnapshot.set(this.generalSettingsForm.getRawValue());
        const openAtLogin = settings.startup?.openAtLogin ?? false;
        this.openAtLoginValue.set(openAtLogin);
        const startupGroup = this.generalSettingsForm.controls.startup;
        if (openAtLogin) {
          startupGroup.controls.startMinimized.enable({ emitEvent: false });
        }
      }),
    ),
    { initialValue: null },
  );

  private async save(): Promise<void> {
    const settings = this.generalSettingsForm.getRawValue();

    if (!settings.startup.openAtLogin) settings.startup.startMinimized = false;

    const newLang = settings.language.language;
    const currentLang = this.translateService.getCurrentLang();

    await this.generalSettingsService.save(settings);
    await window.bitbutler.electron.setLoginItem({ openAtLogin: settings.startup.openAtLogin });

    if (newLang !== currentLang) {
      await firstValueFrom(this.translateService.use(newLang));
    }

    this.themeService.applyFromSettings(settings.appearance.family, settings.appearance.mode);
    this.dateFormatService.applyFromSettings(settings);
  }

  public checkUpdates(): void {
    this.commandBusService.emit({ type: 'UPDATE_CHECK_FOR_UPDATE' });
  }
}
