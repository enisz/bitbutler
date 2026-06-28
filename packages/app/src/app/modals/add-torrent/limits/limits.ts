import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { TranslatePipe } from '@ngx-translate/core';
import { ShareLimit } from '../../../components/share-limit/share-limit';
import { TransferLimit } from '../../../components/transfer-limit/transfer-limit';
import { AddTorrentFormGroup } from '../../../models/add-torrent.model';

@Component({
  selector: 'app-add-torrent-limits',
  imports: [ReactiveFormsModule, TranslatePipe, TransferLimit, ShareLimit],
  templateUrl: './limits.html',
  styleUrl: './limits.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AddTorrentLimits {
  public form = input.required<AddTorrentFormGroup>();
}
