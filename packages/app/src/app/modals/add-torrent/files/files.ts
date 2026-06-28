import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { TorrentDraft } from '@bitbutler/shared';
import { BbFileTree, FileTreeSaveEvent } from '../../../components/bb-file-tree/bb-file-tree';

@Component({
  selector: 'app-add-torrent-files',
  imports: [BbFileTree],
  templateUrl: './files.html',
  styleUrl: './files.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AddTorrentFiles {
  public draft = input<TorrentDraft | null>(null);
  public saved = output<FileTreeSaveEvent>();
  public editModeChange = output<boolean>();
}
