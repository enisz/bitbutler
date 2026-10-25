import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { faExclamationTriangle } from '@fortawesome/free-solid-svg-icons';
import { TranslatePipe } from '@ngx-translate/core';
import { BbPopover } from '../../../components/bb-popover/bb-popover';
import { BbSectionCard } from '../../../components/bb-section-card/bb-section-card';
import { BbRadio } from '../../../components/form-controls/bb-radio-group/bb-radio';
import { BbRadioGroup } from '../../../components/form-controls/bb-radio-group/bb-radio-group';
import { BbSwitch } from '../../../components/form-controls/bb-switch/bb-switch';
import { AddTorrentFormGroup } from '../../../models/add-torrent.model';

@Component({
  selector: 'app-add-torrent-options',
  imports: [
    BbRadio,
    BbRadioGroup,
    BbSwitch,
    BbSectionCard,
    ReactiveFormsModule,
    FontAwesomeModule,
    BbPopover,
    TranslatePipe,
  ],
  templateUrl: './options.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AddTorrentOptions {
  public form = input.required<AddTorrentFormGroup>();

  public faExclamationTriangle = faExclamationTriangle;
}
