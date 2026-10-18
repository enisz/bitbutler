import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ReactiveFormsModule } from '@angular/forms';
import {
  NgLabelTemplateDirective,
  NgOptionTemplateDirective,
  NgSelectComponent,
} from '@ng-select/ng-select';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { BbLogo } from '../../../components/bb-logo/bb-logo';
import { BbSectionCard } from '../../../components/bb-section-card/bb-section-card';
import { BbSpinner } from '../../../components/bb-spinner/bb-spinner';
import { THEME_FAMILIES } from '../../../services/theme.service';
import { GeneralSettingsFormService } from '../general-settings-form.service';
import { NgSelectItem, SettingsTabComponent } from '../settings.interface';

@Component({
  selector: 'app-appearance',
  imports: [
    BbSectionCard,
    CommonModule,
    NgSelectComponent,
    NgOptionTemplateDirective,
    NgLabelTemplateDirective,
    ReactiveFormsModule,
    BbSpinner,
    BbLogo,
    TranslatePipe,
  ],
  templateUrl: './appearance.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Appearance implements SettingsTabComponent {
  private readonly translateService = inject(TranslateService);
  private readonly formService = inject(GeneralSettingsFormService);
  private readonly languageChanged = toSignal(this.translateService.onLangChange);

  public readonly generalSettingsForm = this.formService.form;
  public readonly settingsLoaded = this.formService.loaded;
  public readonly families = THEME_FAMILIES;

  public readonly modes = computed<NgSelectItem[]>(() => {
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
}
