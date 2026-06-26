import { DestroyRef, Injectable, Signal, computed, effect, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { TorrentFileEntry } from '@bitbutler/shared';
import {
  BehaviorSubject,
  EMPTY,
  Observable,
  Subject,
  from,
  switchMap,
  take,
  takeUntil,
  tap,
  timer,
} from 'rxjs';
import {
  QbLogEntry,
  QbLogMessageType,
  QbTorrentProperties,
  QbTorrentTracker,
} from '../../../models/qbittorrent.model';
import {
  QbTorrentContent,
  QbTorrentPeer,
  QbTorrentPeersResponse,
  Torrent,
} from '../../../models/torrent.model';
import { PathService } from '../../../services/path.service';
import { QbPollingService } from '../../../services/qb-polling.service';
import { QbService } from '../../../services/qb.service';
import { ServerSettingsService } from '../../../services/server-settings.service';
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
  private readonly serverSettingsService = inject(ServerSettingsService);
  private readonly polling = inject(QbPollingService);
  private readonly pathService = inject(PathService);
  private readonly destroyRef = inject(DestroyRef);

  private readonly hashSignal = signal('');
  private readonly contextSignal = signal<Record<string, any>>({});

  public readonly activeTabId = signal<TorrentDetailTabId>('general');
  public readonly properties = signal<QbTorrentProperties | null>(null);
  public readonly trackers = signal<QbTorrentTracker[]>([]);
  public readonly trackersLoading = signal(true);
  public readonly peers = signal<QbTorrentPeer[]>([]);
  public readonly peersLoading = signal(true);
  public readonly content = signal<TorrentFileEntry[]>([]);
  public readonly contentLoading = signal(true);
  public readonly localPath = signal<string | null>(null);
  public readonly singleFile = signal(false);
  public readonly errorLog = signal<QbLogEntry | null>(null);
  public readonly localTorrentData = signal<Torrent | null>(null);
  private readonly peerMap = new Map<string, QbTorrentPeer>();

  private readonly destroyed$ = new Subject<void>();

  public readonly torrent: Signal<MergedTorrent | null> = computed(() => {
    const data =
      this.localTorrentData() ?? this.torrentStoreService.torrentsMap().get(this.hashSignal());
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

    this.activeTabId$
      .pipe(
        switchMap((id) => (id === 'content' ? this.contentPoll$() : EMPTY)),
        takeUntil(this.destroyed$),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe();

    let isResolvingLocalPath = false;
    let isLocalPathResolved = false;
    const localPathEffectRef = effect(async () => {
      const remotePath = this.torrent()?.data?.content_path;

      if (isLocalPathResolved) {
        localPathEffectRef.destroy();
        return;
      }

      if (!remotePath || isResolvingLocalPath) return;

      isResolvingLocalPath = true;
      this.localPath.set(await this.pathService.resolveLocalPath(remotePath));
      isLocalPathResolved = true;
      localPathEffectRef.destroy();
    });

    let hasAttemptedErrorLogFetch = false;
    effect(async () => {
      const entry = this.torrentStoreService.torrentsMap().get(this.hashSignal());
      const state = entry?.state;
      const name = entry?.name;
      const serverId = this.serverStoreService.currentServerId();

      if (state !== 'error') {
        hasAttemptedErrorLogFetch = false;
        this.errorLog.set(null);
        return;
      }

      if (hasAttemptedErrorLogFetch || !serverId || !name) return;
      hasAttemptedErrorLogFetch = true;

      try {
        const entries = await this.qbService.log.main(serverId, {
          normal: false,
          info: false,
          warning: true,
          critical: true,
        });

        const matches = entries.filter(
          (e) =>
            (e.type === QbLogMessageType.Warning || e.type === QbLogMessageType.Critical) &&
            e.message.includes(name),
        );

        if (matches.length > 0) {
          this.errorLog.set(matches.reduce((a, b) => (b.id > a.id ? b : a)));
        }
      } catch (error: any) {
        console.error(
          TorrentDetailsDataService.name,
          'errorLog effect',
          'Failed to fetch log entries',
          error,
        );
      }
    });
  }

  private propertiesPoll$() {
    return timer(0, 2000).pipe(
      switchMap(() =>
        this.polling.isPaused$.pipe(
          take(1),
          switchMap((isPaused) =>
            from(
              Promise.all([
                this.fetchProperties(),
                isPaused ? this.fetchTorrentInfo() : Promise.resolve(),
              ]),
            ),
          ),
        ),
      ),
    );
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

  private async fetchTorrentInfo(): Promise<void> {
    const serverId = this.serverStoreService.currentServerId();
    const hash = this.hashSignal();
    if (!serverId || !hash) return;

    try {
      const torrent = await this.qbService.torrents.info(serverId, hash);
      if (torrent) this.localTorrentData.set(torrent);
    } catch (e: any) {
      console.error(
        TorrentDetailsDataService.name,
        'fetchTorrentInfo',
        'Failed to fetch torrent info!',
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

    const serverId = this.serverStoreService.currentServerId();
    if (!serverId) return;

    this.qbService.torrents
      .files(serverId, hash)
      .then((content) => this.singleFile.set(content.length === 1))
      .catch((e: any) =>
        console.error(
          TorrentDetailsDataService.name,
          'init',
          'Failed to fetch torrent files for singleFile',
          e?.message ?? String(e),
        ),
      );
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
    this.localTorrentData.set(null);
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

  private contentPoll$() {
    return from(this.serverSettingsService.load()).pipe(
      switchMap((settings) => timer(0, settings.polling.foreground)),
      switchMap(() => from(this.fetchContent())),
    );
  }

  private async fetchContent(): Promise<void> {
    const serverId = this.serverStoreService.currentServerId();
    const hash = this.hashSignal();
    if (!serverId || !hash) return;

    try {
      const files = await this.qbService.torrents.files(serverId, hash);
      this.content.set(
        files.map((c: QbTorrentContent) => ({
          length: c.size,
          path: c.name,
          priority: c.priority,
          progress: c.progress,
          index: c.index,
        })),
      );
    } catch (e: any) {
      console.error(
        TorrentDetailsDataService.name,
        'fetchContent',
        'Failed to load torrent contents',
        e?.message ?? String(e),
      );
    } finally {
      this.contentLoading.set(false);
    }
  }

  public setContent(files: TorrentFileEntry[]): void {
    this.content.set(files);
  }
}
