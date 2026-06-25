import { DestroyRef, Injectable, Signal, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { BehaviorSubject, EMPTY, Subject, from, switchMap, takeUntil, timer } from 'rxjs';
import { QbTorrentProperties } from '../../../models/qbittorrent.model';
import { Torrent } from '../../../models/torrent.model';
import { QbService } from '../../../services/qb.service';
import { ServerStoreService } from '../../../services/server-store.service';
import { TorrentStoreService } from '../../../services/torrent-store.service';
import { TorrentDetailTabId } from './torrent-details.interface';

export interface MergedTorrent {
  data: Torrent;
  properties: QbTorrentProperties;
}

@Injectable()
export class TorrentDetailsDataService {
  private readonly torrentStoreService = inject(TorrentStoreService);
  private readonly qbService = inject(QbService);
  private readonly serverStoreService = inject(ServerStoreService);
  private readonly destroyRef = inject(DestroyRef);

  private readonly hashSignal = signal('');
  private readonly contextSignal = signal<Record<string, any>>({});

  public readonly activeTabId = signal<TorrentDetailTabId>('general');
  public readonly properties = signal<QbTorrentProperties | null>(null);

  private readonly destroyed$ = new Subject<void>();

  public readonly torrent: Signal<MergedTorrent | null> = computed(() => {
    const data = this.torrentStoreService.torrentsMap().get(this.hashSignal());
    const properties = this.properties();
    return !data || !properties ? null : { data, properties };
  });

  private readonly activeTabId$ = new BehaviorSubject<TorrentDetailTabId>('general');

  constructor() {
    this.activeTabId$
      .pipe(
        switchMap((id) => (id === 'general' ? this.propertiesPoll$() : EMPTY)),
        takeUntil(this.destroyed$),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe();
  }

  private propertiesPoll$() {
    return timer(0, 2000).pipe(switchMap(() => from(this.fetchProperties())));
  }

  private async fetchProperties(): Promise<void> {
    const serverId = this.serverStoreService.currentServerId();
    const hash = this.hashSignal();
    if (!serverId || !hash) return;

    try {
      this.properties.set(await this.qbService.torrents.properties(serverId, hash));
    } catch (e: any) {
      console.error(
        TorrentDetailsDataService.name,
        'fetchProperties',
        'Failed to fetch torrent properties!',
        e?.message ?? String(e),
      );
    }
  }

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
    this.activeTabId$.next(id);
  }

  public stopAll(): void {
    this.destroyed$.next();
  }
}
