import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ReactiveFormsModule } from '@angular/forms';
import { NgSelectComponent } from '@ng-select/ng-select';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { BbSectionCard } from '../../../components/bb-section-card/bb-section-card';
import { BbSpinner } from '../../../components/bb-spinner/bb-spinner';
import { BbOptionText } from '../../../directives/bb-option-text';
import { GeneralSettingsFormService } from '../general-settings-form.service';
import { NgSelectItem, SettingsTabComponent } from '../settings.interface';

@Component({
  selector: 'app-notifications',
  imports: [
    BbOptionText,
    BbSectionCard,
    CommonModule,
    NgSelectComponent,
    ReactiveFormsModule,
    BbSpinner,
    TranslatePipe,
  ],
  templateUrl: './notifications.html',
  styleUrl: './notifications.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Notifications implements SettingsTabComponent {
  private readonly translateService = inject(TranslateService);
  private readonly formService = inject(GeneralSettingsFormService);
  private readonly languageChanged = toSignal(this.translateService.onLangChange);

  public readonly generalSettingsForm = this.formService.form;
  public readonly settingsLoaded = this.formService.loaded;

  public readonly toastPositions = computed<NgSelectItem[]>(() => {
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
}
