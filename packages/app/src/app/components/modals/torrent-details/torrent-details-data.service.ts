import { Injectable, Signal, computed, inject, signal } from '@angular/core';
import { Subject } from 'rxjs';
import { QbTorrentProperties } from '../../../models/qbittorrent.model';
import { Torrent } from '../../../models/torrent.model';
import { TorrentStoreService } from '../../../services/torrent-store.service';
import { TorrentDetailTabId } from './torrent-details.interface';

export interface MergedTorrent {
  data: Torrent;
  properties: QbTorrentProperties;
}

@Injectable()
export class TorrentDetailsDataService {
  private readonly torrentStoreService = inject(TorrentStoreService);

  private readonly hashSignal = signal('');
  private readonly contextSignal = signal<Record<string, any>>({});

  public readonly activeTabId = signal<TorrentDetailTabId>('general');
  public readonly properties = signal<QbTorrentProperties | null>(null);

  protected readonly destroyed$ = new Subject<void>();

  public readonly torrent: Signal<MergedTorrent | null> = computed(() => {
    const data = this.torrentStoreService.torrentsMap().get(this.hashSignal());
    const properties = this.properties();
    return !data || !properties ? null : { data, properties };
  });

  public init(hash: string, context: Record<string, any>): void {
    this.hashSignal.set(hash);
    this.contextSignal.set(context);
  }

  public hash(): string {
    return this.hashSignal();
  }

  public context(): Record<string, any> {
    return this.contextSignal();
  }

  public selectTab(id: TorrentDetailTabId): void {
    this.activeTabId.set(id);
  }

  public stopAll(): void {
    this.destroyed$.next();
  }
}
