import { CommonModule, formatDate } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ReactiveFormsModule } from '@angular/forms';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import {
  IconDefinition,
  faChevronDown,
  faChevronUp,
  faCircleQuestion,
  faRotateLeft,
  faTriangleExclamation,
} from '@fortawesome/free-solid-svg-icons';
import { NgbCollapse } from '@ng-bootstrap/ng-bootstrap';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { BbBtnContent } from '../../../components/bb-btn-content/bb-btn-content';
import { BbSectionCard } from '../../../components/bb-section-card/bb-section-card';
import { BbSpinner } from '../../../components/bb-spinner/bb-spinner';
import { BbRadio } from '../../../components/form-controls/bb-radio-group/bb-radio';
import { BbRadioGroup } from '../../../components/form-controls/bb-radio-group/bb-radio-group';
import { BbSwitch } from '../../../components/form-controls/bb-switch/bb-switch';
import { SavePathSelect } from '../../../components/save-path-select/save-path-select';
import { BbOptionText } from '../../../directives/bb-option-text';
import {
  DATE_FORMAT_PRESETS,
  DEFAULT_GENERAL_SETTINGS,
  DEFAULT_LOCALE,
  DateFormatPreset,
  FIRST_DAY_OF_WEEK_OPTIONS,
  LANGUAGE_LOCALE_MAP,
  LANGUAGE_NATIVE_NAMES,
  resolveDateFormat,
} from '../../../models/general-settings.model';
import { GeneralSettingsFormService } from '../general-settings-form.service';
import { NgSelectItem, SettingsTabComponent } from '../settings.interface';

interface DateFormatPresetItem {
  value: DateFormatPreset;
  label: string;
  example: string;
}

interface DateFormatTokenGuideRow {
  token: string;
  description: string;
  example: string;
}

const DATE_FORMAT_TOKENS = [
  'yyyy',
  'yy',
  'MMMM',
  'MMM',
  'MM',
  'M',
  'EEEE',
  'EEE',
  'dd',
  'd',
  'HH',
  'H',
  'hh',
  'h',
  'mm',
  'ss',
  'a',
] as const;

@Component({
  selector: 'app-general',
  imports: [
    BbOptionText,
    BbSectionCard,
    BbSwitch,
    BbRadioGroup,
    BbRadio,
    CommonModule,
    ReactiveFormsModule,
    FontAwesomeModule,
    BbSpinner,
    TranslatePipe,
    SavePathSelect,
    BbBtnContent,
    NgbCollapse,
  ],
  templateUrl: './general.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class General implements SettingsTabComponent {
  private readonly translateService = inject(TranslateService);
  private readonly formService = inject(GeneralSettingsFormService);

  private languageChanged = toSignal(this.translateService.onLangChange);

  public readonly generalSettingsForm = this.formService.form;
  public readonly settingsLoaded = this.formService.loaded;
  private readonly formSnapshot = this.formService.formSnapshot;

  public readonly languages = Object.entries(LANGUAGE_NATIVE_NAMES)
    .map(([value, label]) => ({ value, label, lang: LANGUAGE_LOCALE_MAP[value] }))
    .sort((a, b) => a.label.localeCompare(b.label));

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

  public firstDayOfWeekOptions = computed<NgSelectItem[]>(() => {
    this.languageChanged();

    return FIRST_DAY_OF_WEEK_OPTIONS.map((value) => ({
      value,
      label: this.translateService.instant(
        `pages.settings.tab.general.general-settings-form.date-format.first-day-of-week.${value}`,
      ),
    }));
  });

  public savePathInputType = computed(() => this.formSnapshot().savePath.inputType);

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

  public dateFormatTokenGuide = computed<DateFormatTokenGuideRow[]>(() => {
    this.languageChanged();
    const snapshot = this.formSnapshot();
    const language = snapshot.language.language;

    return DATE_FORMAT_TOKENS.map((token) => ({
      token,
      description: this.translateService.instant(
        `pages.settings.tab.general.general-settings-form.date-format.token-guide.token.${token}`,
      ),
      example: this.formatToken(token, language),
    }));
  });

  private formatToken(token: string, language: string): string {
    const locale = LANGUAGE_LOCALE_MAP[language] ?? DEFAULT_LOCALE;
    try {
      return formatDate(new Date(), token, locale);
    } catch {
      return '';
    }
  }

  public icons: Record<string, IconDefinition> = {
    faTriangleExclamation,
    faCircleQuestion,
    faRotateLeft,
    faChevronDown,
    faChevronUp,
  };

  public tokenGuideExpanded = signal(false);

  public toggleTokenGuide(): void {
    this.tokenGuideExpanded.update((v) => !v);
  }
}
