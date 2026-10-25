import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { IconDefinition, faTriangleExclamation } from '@fortawesome/free-solid-svg-icons';
import { TranslatePipe } from '@ngx-translate/core';
import { BbSectionCard } from '../../../components/bb-section-card/bb-section-card';
import { BbSpinner } from '../../../components/bb-spinner/bb-spinner';
import { BbOptionText } from '../../../directives/bb-option-text';
import { ServerStoreService } from '../../../services/server-store.service';
import { GeneralSettingsFormService } from '../general-settings-form.service';
import { SettingsTabComponent } from '../settings.interface';

@Component({
  selector: 'app-startup',
  imports: [
    BbOptionText,
    BbSectionCard,
    CommonModule,
    ReactiveFormsModule,
    FontAwesomeModule,
    BbSpinner,
    TranslatePipe,
  ],
  templateUrl: './startup.html',
  styleUrl: './startup.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Startup implements SettingsTabComponent {
  private readonly formService = inject(GeneralSettingsFormService);
  private readonly serverStoreService = inject(ServerStoreService);

  public readonly icons: Record<string, IconDefinition> = { faTriangleExclamation };

  public readonly generalSettingsForm = this.formService.form;
  public readonly settingsLoaded = this.formService.loaded;

  public readonly hasDefaultServer = computed(() =>
    this.serverStoreService.servers().some((s) => s.auto_login),
  );

  public readonly showNoDefaultHostHint = computed(
    () => this.formService.openAtLoginValue() && !this.hasDefaultServer(),
  );
}
