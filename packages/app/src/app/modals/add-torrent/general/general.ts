import {
  ChangeDetectionStrategy,
  Component,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { faFile, faFolderOpen, faLink } from '@fortawesome/free-solid-svg-icons';
import { TranslatePipe } from '@ngx-translate/core';
import { BbBtnContent } from '../../../components/bb-btn-content/bb-btn-content';
import { FileTreeStats } from '../../../components/bb-file-tree/bb-file-tree';
import { BbPopover } from '../../../components/bb-popover/bb-popover';
import { CategorySelect } from '../../../components/category-select/category-select';
import { SavePathSelect } from '../../../components/save-path-select/save-path-select';
import { TagSelect } from '../../../components/tag-select/tag-select';
import { AutofocusDirective } from '../../../directives/autofocus';
import { AddTorrentFormGroup } from '../../../models/add-torrent.model';
import { FilesizePipe } from '../../../pipes/filesize-pipe';
import { QbService } from '../../../services/qb.service';
import { ServerStoreService } from '../../../services/server-store.service';

@Component({
  selector: 'app-add-torrent-general',
  imports: [
    ReactiveFormsModule,
    AutofocusDirective,
    BbPopover,
    TranslatePipe,
    CategorySelect,
    SavePathSelect,
    TagSelect,
    BbBtnContent,
    FilesizePipe,
  ],
  templateUrl: './general.html',
  styleUrl: './general.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AddTorrentGeneral {
  public readonly icons = { faFile, faLink, faFolderOpen };

  public form = input.required<AddTorrentFormGroup>();
  public inputMode = input.required<'file' | 'link'>();
  public fileStats = input<FileTreeStats | null>(null);
  public freeSpace = input<number>(0);
  public inputModeChange = output<'file' | 'link'>();
  public fileSelected = output<Event>();

  private readonly qbService = inject(QbService);
  private readonly serverStoreService = inject(ServerStoreService);
  private readonly categorySelect = viewChild(CategorySelect);

  public readonly defaultSavePath = signal<string>('');

  constructor() {
    const serverId = this.serverStoreService.currentServerId();
    if (serverId) {
      this.qbService.app
        .preferences(serverId)
        .then((prefs) => {
          if (prefs.save_path) this.defaultSavePath.set(prefs.save_path);
        })
        .catch(() => {});
    }
  }

  public ensureCategoryExists(): Promise<boolean> | undefined {
    return this.categorySelect()?.ensureCategoryExists();
  }
}
