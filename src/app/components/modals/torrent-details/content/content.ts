import { Component, Input, OnInit, inject, signal } from '@angular/core';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { TorrentFileEntry } from '../../../../models/torrent-draft.model';
import { QbTorrentContent } from '../../../../models/torrent.model';
import { QbService } from '../../../../services/qb.service';
import { ServerStoreService } from '../../../../services/server-store.service';
import { ToastService } from '../../../../services/toast.service';
import { BbFileTree } from '../../../bb-file-tree/bb-file-tree';
import { BbSpinner } from '../../../bb-spinner/bb-spinner';
import { TorrentDetailTabComponent } from '../torrent-details.interface';

@Component({
  selector: 'app-content',
  standalone: true,
  imports: [BbFileTree, BbSpinner, TranslatePipe],
  templateUrl: './content.html',
  styleUrl: './content.scss',
})
export class Content implements TorrentDetailTabComponent, OnInit {
  @Input() public hash: string = '';
  @Input() public context: Record<string, any> = {};

  public editMode = signal<boolean>(false);

  private readonly qbService = inject(QbService);
  private readonly serverStoreService = inject(ServerStoreService);
  private readonly toastService = inject(ToastService);
  private readonly translateService = inject(TranslateService);

  public loading = signal<boolean>(true);
  public content: TorrentFileEntry[] = [];

  public ngOnInit(): void {
    this.load();

    if (this.context['editMode']) {
      this.editMode.set(this.context['editMode']);
    }
  }

  private async load(): Promise<void> {
    const serverId = this.serverStoreService.currentServerId();
    const hash = this.hash;

    if (!serverId) throw new Error('ServerId is missing!');
    if (!hash) throw new Error('Torrent hash is missing!');

    this.loading.set(true);

    try {
      this.content = (await this.qbService.torrentContents(serverId, hash)).map(
        (content: QbTorrentContent) => ({
          length: content.size,
          path: content.name,
          priority: content.priority,
          progress: content.progress,
        }),
      );
    } catch (e) {
      console.error(Content.name, 'load', 'Failed to fetch torrent content!', e);
      this.toastService.danger(
        this.translateService.instant(
          'components.modals.torrent-details.content.error.failed-to-load',
        ),
      );
    } finally {
      this.loading.set(false);
    }
  }
}
