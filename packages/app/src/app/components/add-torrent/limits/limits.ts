import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { TranslatePipe } from '@ngx-translate/core';
import { AddTorrentFormGroup } from '../../../models/add-torrent.model';
import { ShareLimit } from '../../share-limit/share-limit';
import { TransferLimit } from '../../transfer-limit/transfer-limit';

@Component({
  selector: 'app-add-torrent-limits',
  imports: [ReactiveFormsModule, TranslatePipe, TransferLimit, ShareLimit],
  templateUrl: './limits.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AddTorrentLimits {
  public form = input.required<AddTorrentFormGroup>();
}
