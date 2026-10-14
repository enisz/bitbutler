import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, NgZone, inject } from '@angular/core';
import { FormArray, FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import {
  IconDefinition,
  faFolderOpen,
  faMinus,
  faPlus,
  faTriangleExclamation,
} from '@fortawesome/free-solid-svg-icons';
import { TranslatePipe } from '@ngx-translate/core';
import { BbBtnContent } from '../../../components/bb-btn-content/bb-btn-content';
import { BbPopover } from '../../../components/bb-popover/bb-popover';
import { BbSpinner } from '../../../components/bb-spinner/bb-spinner';
import { SavePathSelect } from '../../../components/save-path-select/save-path-select';
import { BbTooltip } from '../../../directives/bb-tooltip';
import { ElectronService } from '../../../services/electron.service';
import { ServerSettingsFormService } from '../server-settings-form.service';
import { SettingsTabComponent } from '../settings.interface';

@Component({
  selector: 'app-path-mappings',
  imports: [
    CommonModule,
    ReactiveFormsModule,
    FontAwesomeModule,
    BbTooltip,
    BbSpinner,
    BbPopover,
    TranslatePipe,
    SavePathSelect,
    BbBtnContent,
  ],
  templateUrl: './path-mappings.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PathMappings implements SettingsTabComponent {
  private readonly electronService = inject(ElectronService);
  private readonly zone = inject(NgZone);
  private readonly formService = inject(ServerSettingsFormService);

  public readonly serverSettingsForm = this.formService.form;
  public readonly settingsLoaded = this.formService.loaded;
  public readonly defaultRemotePath = this.formService.defaultRemotePath;

  public icons: Record<string, IconDefinition> = {
    faPlus,
    faMinus,
    faTriangleExclamation,
    faFolderOpen,
  };

  get pathMappings(): FormArray {
    return this.serverSettingsForm.controls.pathMappings;
  }

  public addPathMapping(): void {
    this.pathMappings.push(
      new FormGroup({
        remote: new FormControl<string | null>(null),
        local: new FormControl('', { nonNullable: true }),
      }),
      { emitEvent: false },
    );
  }

  public testMapping(path: string): void {
    this.electronService.openPath(path);
  }

  public removePathMapping(index: number): void {
    if (this.pathMappings.length === 1) {
      this.pathMappings.at(index).reset({ remote: null, local: '' });
    } else {
      this.pathMappings.removeAt(index);
    }
  }

  public async onBrowse(index: number): Promise<void> {
    const path = await this.electronService.showOpenDialog();
    if (path) {
      this.zone.run(() => {
        const localControl = this.pathMappings.at(index).get('local');
        if (localControl) {
          localControl.setValue(path);
          localControl.markAsDirty();
        }
      });
    }
  }
}
