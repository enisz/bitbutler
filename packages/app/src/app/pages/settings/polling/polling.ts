import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { IconDefinition, faTriangleExclamation } from '@fortawesome/free-solid-svg-icons';
import { TranslatePipe } from '@ngx-translate/core';
import { BbPopover } from '../../../components/bb-popover/bb-popover';
import { BbSectionCard } from '../../../components/bb-section-card/bb-section-card';
import { BbSpinner } from '../../../components/bb-spinner/bb-spinner';
import { ServerSettingsFormService } from '../server-settings-form.service';
import { SettingsTabComponent } from '../settings.interface';

@Component({
  selector: 'app-polling',
  imports: [
    BbSectionCard,
    CommonModule,
    ReactiveFormsModule,
    FontAwesomeModule,
    BbSpinner,
    BbPopover,
    TranslatePipe,
  ],
  templateUrl: './polling.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Polling implements SettingsTabComponent {
  private readonly formService = inject(ServerSettingsFormService);

  public readonly icons: Record<string, IconDefinition> = { faTriangleExclamation };

  public readonly serverSettingsForm = this.formService.form;
  public readonly settingsLoaded = this.formService.loaded;
}
