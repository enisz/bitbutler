import { CommonModule, NgOptimizedImage } from '@angular/common';
import { Component, DestroyRef, OnInit, computed, inject } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import {
  IconDefinition,
  faCircleQuestion,
  faTriangleExclamation,
} from '@fortawesome/free-solid-svg-icons';
import {
  NgLabelTemplateDirective,
  NgOptionTemplateDirective,
  NgSelectComponent,
} from '@ng-select/ng-select';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { filter, firstValueFrom, from, tap } from 'rxjs';
import { BbPopover } from '../../../components/bb-popover/bb-popover';
import { BbSpinner } from '../../../components/bb-spinner/bb-spinner';
import { GeneralSettings, ToastPosition } from '../../../models/general-settings.model';
import { CommandBusService } from '../../../services/command-bus.service';
import { GeneralSettingsService } from '../../../services/general-settings.service';
import { ThemeFamily, ThemeMode, ThemeService } from '../../../services/theme.service';
import { SettingsStateService } from '../settings-state.service';
import { SettingsTabComponent } from '../settings.interface';

interface NgSelectItem {
  value: string;
  label: string;
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
  ],
  templateUrl: './general.html',
  styleUrl: './general.scss',
})
export class General implements SettingsTabComponent, OnInit {
  private readonly themeService = inject(ThemeService);
  private readonly generalSettingsService = inject(GeneralSettingsService);
  private readonly commandBusService = inject(CommandBusService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly translateService = inject(TranslateService);
  private readonly stateService = inject(SettingsStateService);

  private languageChanged = toSignal(this.translateService.onLangChange);

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

  public families: NgSelectItem[] = [
    { value: 'bitbutler', label: 'BitButler' },
    { value: 'aurora', label: 'Aurora' },
    { value: 'mint-green', label: 'Mint Green' },
    { value: 'purple-haze', label: 'Purple Haze' },
    { value: 'ocean-breeze', label: 'Ocean Breeze' },
    { value: 'pumpkin-spice', label: 'Pumpkin Spice' },
    { value: 'deep-sea', label: 'Deep Sea' },
    { value: 'crimson-ember', label: 'Crimson Ember' },
  ];

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

  public icons: Record<string, IconDefinition> = {
    faTriangleExclamation,
    faCircleQuestion,
  };

  public getFamilyLogo(family: string): string {
    return `assets/images/bitbutler-logo-${family}.png`;
  }

  public generalSettingsForm = new FormGroup({
    behavior: new FormGroup({
      deleteTorrentFile: new FormControl(true, { nonNullable: true }),
      automaticUpdate: new FormControl(true, { nonNullable: true }),
      toastPosition: new FormControl<ToastPosition>('bottom-right', { nonNullable: true }),
    }),
    language: new FormGroup({
      language: new FormControl('us', { nonNullable: true }),
    }),
    appearance: new FormGroup({
      family: new FormControl<ThemeFamily>('bitbutler', { nonNullable: true }),
      mode: new FormControl<ThemeMode>('system', { nonNullable: true }),
    }),
  });

  public settings$ = from(this.generalSettingsService.load()).pipe(
    tap((settings: GeneralSettings) =>
      this.generalSettingsForm.patchValue(settings, { emitEvent: false }),
    ),
  );

  public async ngOnInit(): Promise<void> {
    this.stateService.registerSave('general', () => this.save());

    this.generalSettingsForm.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.stateService.markDirty('general', true));
  }

  private async save(): Promise<void> {
    const settings = this.generalSettingsForm.getRawValue();
    const newLang = settings.language.language;
    const currentLang = this.translateService.getCurrentLang();

    await this.generalSettingsService.save(settings);

    if (newLang !== currentLang) {
      await firstValueFrom(
        this.translateService.onLangChange.pipe(filter((event) => event.lang === newLang)),
      );
    }

    this.themeService.applyFromSettings(settings.appearance.family, settings.appearance.mode);
  }

  public checkUpdates(): void {
    this.commandBusService.emit({ type: 'UPDATE_CHECK_FOR_UPDATE' });
  }
}
