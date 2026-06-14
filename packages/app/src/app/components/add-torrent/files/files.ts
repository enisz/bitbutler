import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { TorrentDraft } from '@bitbutler/shared';
import { BbFileTree, FileTreeSaveEvent } from '../../bb-file-tree/bb-file-tree';

@Component({
  selector: 'app-add-torrent-files',
  imports: [BbFileTree],
  templateUrl: './files.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AddTorrentFiles {
  public draft = input<TorrentDraft | null>(null);
  public saved = output<FileTreeSaveEvent>();
  public editModeChange = output<boolean>();
}
