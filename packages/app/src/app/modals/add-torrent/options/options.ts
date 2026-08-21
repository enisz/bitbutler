import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { faExclamationTriangle } from '@fortawesome/free-solid-svg-icons';
import { NgSelectModule } from '@ng-select/ng-select';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { BbPopover } from '../../../components/bb-popover/bb-popover';
import { AddTorrentFormGroup } from '../../../models/add-torrent.model';

@Component({
  selector: 'app-add-torrent-options',
  imports: [ReactiveFormsModule, FontAwesomeModule, BbPopover, TranslatePipe, NgSelectModule],
  templateUrl: './options.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AddTorrentOptions {
  private readonly translateService = inject(TranslateService);

  public form = input.required<AddTorrentFormGroup>();

  public faExclamationTriangle = faExclamationTriangle;

  public rootFolderOptions = [
    {
      value: 'unset',
      label: this.translateService.instant(
        'components.add-torrent.add-form.root-folder.option.default',
      ),
    },
    {
      value: 'true',
      label: this.translateService.instant(
        'components.add-torrent.add-form.root-folder.option.create-root-folder',
      ),
    },
    {
      value: 'false',
      label: this.translateService.instant(
        'components.add-torrent.add-form.root-folder.option.do-not-create-root-folder',
      ),
    },
  ];
}
