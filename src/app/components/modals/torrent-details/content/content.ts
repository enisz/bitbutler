import { ChangeDetectorRef, Component, Input, OnInit, inject } from '@angular/core';

import { TorrentFileEntry } from '../../../../models/torrent-draft.model';
import { QbTorrentContent } from '../../../../models/torrent.model';
import { QbService } from '../../../../services/qb.service';
import { ServerStoreService } from '../../../../services/server-store.service';
import { BbFileTree } from '../../../bb-file-tree/bb-file-tree';
import { TorrentDetailTabComponent } from '../torrent-details.interface';

@Component({
  selector: 'app-content',
  standalone: true,
  imports: [BbFileTree],
  templateUrl: './content.html',
  styleUrl: './content.scss',
})
export class Content implements TorrentDetailTabComponent, OnInit {
  @Input() public hash: string = '';

  private readonly qbService = inject(QbService);
  private readonly serverStoreService = inject(ServerStoreService);
  private readonly changeDetectorRef = inject(ChangeDetectorRef);

  public loading = true;
  public content: TorrentFileEntry[] = [];

  public ngOnInit(): void {
    this.load();
  }

  private async load(): Promise<void> {
    const serverId = this.serverStoreService.currentServerId();
    const hash = this.hash;

    if (!serverId) throw new Error('ServerId is missing!');
    if (!hash) throw new Error('Torrent hash is missing!');

    this.loading = true;

    try {
      this.content = (await this.qbService.torrentContents(serverId, hash)).map(
        (content: QbTorrentContent) => ({
          length: content.size,
          path: content.name,
          priority: content.priority,
          progress: content.progress,
        }),
      );
    } finally {
      this.loading = false;
      this.changeDetectorRef.detectChanges();
    }
  }
}
