import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { faFile, faFolder, faFolderOpen, faLink } from '@fortawesome/free-solid-svg-icons';
import { TranslatePipe } from '@ngx-translate/core';
import { BbBtnContent } from '../../../components/bb-btn-content/bb-btn-content';
import { FileTreeStats } from '../../../components/bb-file-tree/bb-file-tree';
import { BbPopover } from '../../../components/bb-popover/bb-popover';
import { CategorySelect } from '../../../components/category-select/category-select';
import { SavePathSelect } from '../../../components/save-path-select/save-path-select';
import { TagSelect } from '../../../components/tag-select/tag-select';
import { AutofocusDirective } from '../../../directives/autofocus';
import { ScannedTorrentEntry } from '../../../models/add-torrent-folder.model';
import { AddTorrentFormGroup } from '../../../models/add-torrent.model';
import { FilesizePipe } from '../../../pipes/filesize-pipe';
import { QbService } from '../../../services/qb.service';
import { ServerStoreService } from '../../../services/server-store.service';
import { AddTorrentFolderPicker } from './folder-picker/folder-picker';

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
    AddTorrentFolderPicker,
  ],
  templateUrl: './general.html',
  styleUrl: './general.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AddTorrentGeneral {
  public readonly icons = { faFile, faLink, faFolder, faFolderOpen };

  public form = input.required<AddTorrentFormGroup>();
  public inputMode = input.required<'file' | 'link' | 'folder'>();
  public fileStats = input<FileTreeStats | null>(null);
  public freeSpace = input<number>(0);
  public inputModeChange = output<'file' | 'link' | 'folder'>();
  public fileSelected = output<Event>();

  private readonly qbService = inject(QbService);
  private readonly serverStoreService = inject(ServerStoreService);
  private readonly categorySelect = viewChild(CategorySelect);
  private readonly folderPicker = viewChild(AddTorrentFolderPicker);

  public readonly defaultSavePath = signal<string>('');

  public readonly sizeValue = computed<number | null>(() => {
    switch (this.inputMode()) {
      case 'file':
        return this.fileStats()?.selectedSize ?? null;
      case 'folder':
        return this.folderPicker()?.selectedTotalSize() ?? null;
      case 'link':
      default:
        return null;
    }
  });

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

  public getSelectedFolderEntries(): ScannedTorrentEntry[] {
    return this.folderPicker()?.selectedEntries() ?? [];
  }

  public markFolderEntryAdded(path: string): void {
    this.folderPicker()?.markAdded(path);
  }

  public markFolderEntryFailed(path: string, error: string): void {
    this.folderPicker()?.markFailed(path, error);
  }
}
