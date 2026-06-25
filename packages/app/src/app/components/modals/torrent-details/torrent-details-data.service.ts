import { DestroyRef, Injectable, Signal, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  BehaviorSubject,
  EMPTY,
  Observable,
  Subject,
  from,
  switchMap,
  takeUntil,
  tap,
  timer,
} from 'rxjs';
import { QbTorrentProperties, QbTorrentTracker } from '../../../models/qbittorrent.model';
import { QbTorrentPeer, QbTorrentPeersResponse, Torrent } from '../../../models/torrent.model';
import { QbPollingService } from '../../../services/qb-polling.service';
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
  private readonly polling = inject(QbPollingService);
  private readonly destroyRef = inject(DestroyRef);

  private readonly hashSignal = signal('');
  private readonly contextSignal = signal<Record<string, any>>({});

  public readonly activeTabId = signal<TorrentDetailTabId>('general');
  public readonly properties = signal<QbTorrentProperties | null>(null);
  public readonly trackers = signal<QbTorrentTracker[]>([]);
  public readonly trackersLoading = signal(true);
  public readonly peers = signal<QbTorrentPeer[]>([]);
  public readonly peersLoading = signal(true);
  private readonly peerMap = new Map<string, QbTorrentPeer>();

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

    this.activeTabId$
      .pipe(
        switchMap((id) => (id === 'trackers' ? from(this.fetchTrackers()) : EMPTY)),
        takeUntil(this.destroyed$),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe();

    this.activeTabId$
      .pipe(
        switchMap((id) => (id === 'peers' ? this.peersPoll$() : EMPTY)),
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

  private async fetchTrackers(): Promise<void> {
    const serverId = this.serverStoreService.currentServerId();
    const hash = this.hashSignal();
    if (!serverId || !hash) return;

    this.trackersLoading.set(true);
    try {
      this.trackers.set(await this.qbService.torrents.trackers(serverId, hash));
    } catch (e: any) {
      console.error(
        TorrentDetailsDataService.name,
        'fetchTrackers',
        'Failed to fetch torrent trackers!',
        e?.message ?? String(e),
      );
    } finally {
      this.trackersLoading.set(false);
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

  private peersPoll$(): Observable<QbTorrentPeersResponse> {
    const serverId = this.serverStoreService.currentServerId();
    const hash = this.hashSignal();

    this.peerMap.clear();
    this.peers.set([]);
    this.peersLoading.set(true);

    if (!serverId || !hash) {
      this.peersLoading.set(false);
      return EMPTY;
    }

    return this.polling.startPeersPolling(serverId, hash).pipe(
      tap({
        next: (patch: QbTorrentPeersResponse) => {
          this.applyPeersPatch(patch);
          this.peers.set(Array.from(this.peerMap.values()));
          this.peersLoading.set(false);
        },
        error: () => this.peersLoading.set(false),
      }),
    );
  }

  private applyPeersPatch(patch: QbTorrentPeersResponse): void {
    if (patch.full_update) this.peerMap.clear();

    if (patch.peers_removed?.length) {
      for (const id of patch.peers_removed) this.peerMap.delete(id);
    }

    if (!patch.peers) return;

    for (const [id, update] of Object.entries(patch.peers)) {
      const prev = this.peerMap.get(id);

      let ip = (update as any).ip ?? prev?.ip;
      let port = (update as any).port ?? prev?.port;

      if (!ip || port == null) {
        const lastColon = id.lastIndexOf(':');
        if (lastColon > 0) {
          ip ??= id.slice(0, lastColon);
          const p = Number(id.slice(lastColon + 1));
          if (Number.isFinite(p)) port ??= p;
        }
      }

      this.peerMap.set(id, {
        ...(prev ?? {}),
        ...(update as any),
        ...(ip ? { ip } : {}),
        ...(port != null ? { port } : {}),
      } as QbTorrentPeer);
    }
  }
}
