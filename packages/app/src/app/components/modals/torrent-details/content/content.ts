import { ChangeDetectionStrategy, Component, effect, inject, signal } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { ModalGuardService } from '../../../../services/modal-guard.service';
import { BbFileTree, FileTreeSaveEvent } from '../../../bb-file-tree/bb-file-tree';
import { BbSpinner } from '../../../bb-spinner/bb-spinner';
import { TorrentDetailsActionsService } from '../torrent-details-actions.service';
import { TorrentDetailsDataService } from '../torrent-details-data.service';
import { TorrentDetailTabComponent } from '../torrent-details.interface';

@Component({
  selector: 'app-content',
  standalone: true,
  imports: [BbFileTree, BbSpinner, TranslatePipe],
  templateUrl: './content.html',
  styleUrl: './content.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Content implements TorrentDetailTabComponent {
  private readonly dataService = inject(TorrentDetailsDataService);
  private readonly actionsService = inject(TorrentDetailsActionsService);
  private readonly guardService = inject(ModalGuardService);

  public readonly content = this.dataService.content;
  public readonly loading = this.dataService.contentLoading;
  public readonly startInEditMode = signal(false);

  constructor() {
    effect(() => {
      const ctx = this.dataService.context();
      if (ctx?.['editMode']) {
        this.startInEditMode.set(true);
        ctx['editMode'] = false;
      }
    });
  }

  public async onSaved(event: FileTreeSaveEvent): Promise<void> {
    const originalContent = this.dataService.content();
    this.dataService.setContent(event.files);
    await this.actionsService.saveFileChanges(event, originalContent);
  }

  public onEditModeChange(isEditing: boolean): void {
    this.guardService.isDirty.set(isEditing);
  }
}
