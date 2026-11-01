import { Injectable, inject, signal } from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import type { QbPollConfig, QbPollEvent } from '@bitbutler/shared';
import { TranslateService } from '@ngx-translate/core';
import { BehaviorSubject, Observable, Subject, Subscription, combineLatest } from 'rxjs';
import { distinctUntilChanged, map, startWith, takeUntil, tap } from 'rxjs/operators';
import { Maindata, QbTorrentPeersResponse } from '../models/torrent.model';
import { QbService } from './qb.service';
import { ServerSettingsService } from './server-settings.service';
import { ToastService } from './toast.service';
import { TorrentStoreService } from './torrent-store.service';
import { WindowService } from './window.service';

export type LinkState = 'connected' | 'reconnecting';

/**
 * The renderer's side of polling. The loops themselves run in the main process (see
 * packages/electron/src/qb/poller.ts); this service starts and stops them, tells them how fast to
 * run, and turns what they push back into the observables and signals the app consumes - the same
 * way TorrentAddQueueService mirrors the torrent add queue.
 */
@Injectable({ providedIn: 'root' })
export class QbPollingService {
  private qb = inject(QbService);
  private readonly serverSettingsService = inject(ServerSettingsService);
  private readonly windowService = inject(WindowService);
  private readonly torrentStore = inject(TorrentStoreService);
  private readonly toastService = inject(ToastService);
  private readonly translateService = inject(TranslateService);

  private windowState$ = toObservable(this.windowService.state);

  /** Whether the server is reachable; 'reconnecting' while the main process retries. */
  private readonly _linkState = signal<LinkState>('connected');
  public readonly linkState = this._linkState.asReadonly();

  private readonly _isInitialLoading$ = new BehaviorSubject<boolean>(false);
  public readonly isInitialLoading$ = this._isInitialLoading$.asObservable();

  private readonly _pollingInterval$ = new BehaviorSubject<number>(2000);
  public readonly pollingInterval$ = this._pollingInterval$.asObservable();

  private readonly _onPoll$ = new Subject<void>();
  public readonly onPoll$ = this._onPoll$.asObservable();

  private readonly stopPolling$ = new Subject<void>();

  private readonly _pauseTokens$ = new BehaviorSubject<Set<symbol>>(new Set());
  public readonly isPaused$: Observable<boolean> = this._pauseTokens$.pipe(
    map((tokens) => tokens.size > 0),
    distinctUntilChanged(),
  );

  // The last serverId polling was started for. A restart for the SAME server (e.g. coming back
  // from the settings pages) resumes from the main process's last sync cursor instead of paying
  // for a full reload - qBittorrent's sync API is self-healing (a stale rid just yields a fresh
  // full_update). A restart for a DIFFERENT server means the data is genuinely stale and must be
  // reset.
  private lastPolledServerId: string | null = null;

  public pause(): symbol {
    const token = Symbol();
    const next = new Set(this._pauseTokens$.value);
    next.add(token);
    this._pauseTokens$.next(next);
    return token;
  }

  public resume(token: symbol): void {
    const next = new Set(this._pauseTokens$.value);
    next.delete(token);
    this._pauseTokens$.next(next);
  }

  public stopPolling(): void {
    this.stopPolling$.next();
    this._isInitialLoading$.next(false);
    this._pauseTokens$.next(new Set());
    this.lastPolledServerId = null;
    this._linkState.set('connected');
  }

  // The first poll after the loop starts IS the initial load - there is no separate
  // streaming/initial-load protocol.
  startMaindataPolling(serverId: string): Observable<Maindata> {
    const isFreshStart = this.lastPolledServerId !== serverId;
    this.lastPolledServerId = serverId;

    this.stopPolling$.next();
    this._pauseTokens$.next(new Set());
    this._linkState.set('connected');
    if (isFreshStart) this.torrentStore.clear();
    this._isInitialLoading$.next(true);
    void this.serverSettingsService.load();

    return new Observable<Maindata>((subscriber) => {
      let hasLoadedOnce = false;
      const markInitialLoadDone = (): void => {
        if (hasLoadedOnce) return;
        hasLoadedOnce = true;
        this._isInitialLoading$.next(false);
      };

      const sub = new Subscription();
      sub.add(
        this.pollConfig$().subscribe((config) => {
          this.qb.poll.configure(config).catch((err) => this.logCallFailure('configure', err));
        }),
      );
      sub.add(
        this.onEvent((event) => {
          switch (event.type) {
            case 'tick':
              this._onPoll$.next();
              break;
            case 'maindata':
              if (event.serverId !== serverId) break;
              markInitialLoadDone();
              subscriber.next(event.data);
              break;
            case 'failed':
              if (event.serverId === serverId) markInitialLoadDone();
              break;
            case 'link':
              if (event.serverId !== serverId) break;
              markInitialLoadDone();
              this.onLink(serverId, event.state);
              break;
          }
        }),
      );
      this.qb.poll.start(serverId, isFreshStart).catch((err) => {
        markInitialLoadDone();
        this.logCallFailure('start', err);
      });

      return () => {
        sub.unsubscribe();
        this.qb.poll.stop().catch((err) => this.logCallFailure('stop', err));
      };
    }).pipe(takeUntil(this.stopPolling$));
  }

  startPeersPolling(serverId: string, hash: string): Observable<QbTorrentPeersResponse> {
    return new Observable<QbTorrentPeersResponse>((subscriber) => {
      const sub = this.onEvent((event) => {
        if (event.type === 'peers' && event.serverId === serverId && event.hash === hash) {
          subscriber.next(event.data);
        }
      });
      this.qb.poll
        .startPeers(serverId, hash)
        .catch((err) => this.logCallFailure('startPeers', err));

      return () => {
        sub.unsubscribe();
        this.qb.poll
          .stopPeers(serverId, hash)
          .catch((err) => this.logCallFailure('stopPeers', err));
      };
    }).pipe(takeUntil(this.stopPolling$));
  }

  public getPollingInterval(): number {
    return this._pollingInterval$.value;
  }

  // The interval and pause state the main process should run its loops with: the foreground or
  // background rate depending on whether the window is minimized, and paused while any token is held.
  private pollConfig$(): Observable<QbPollConfig> {
    const settings$ = this.serverSettingsService.asObservable().pipe(startWith(null));
    const windowState$ = this.windowState$.pipe(startWith(null));

    return combineLatest([settings$, windowState$, this.isPaused$]).pipe(
      map(([settings, windowState, paused]) => {
        const foreground = settings?.polling?.foreground ?? 2000;
        const background = settings?.polling?.background ?? 5000;
        return { pollMs: windowState?.isMinimized ? background : foreground, paused };
      }),
      distinctUntilChanged((a, b) => a.pollMs === b.pollMs && a.paused === b.paused),
      tap(({ pollMs, paused }) => {
        if (!paused) this._pollingInterval$.next(pollMs);
      }),
    );
  }

  private onEvent(handler: (event: QbPollEvent) => void): Subscription {
    return new Subscription(window.bitbutler.qbPoll.onEvent(handler));
  }

  private onLink(serverId: string, state: 'reconnecting' | 'connected' | 'expired' | 'gave-up') {
    const t = (key: string): string =>
      this.translateService.instant(`services.qb.connection.${key}`);

    switch (state) {
      case 'reconnecting':
        this._linkState.set('reconnecting');
        this.toastService.warning(t('lost-message'), t('lost-title'));
        break;
      case 'connected':
        this._linkState.set('connected');
        this.toastService.success(t('restored-message'), t('restored-title'));
        break;
      case 'expired':
        console.warn('[maindata] poll stopped: session expired.');
        this.stopPolling();
        void this.qb.forceLogout(serverId);
        break;
      case 'gave-up':
        console.warn('[maindata] giving up: server unreachable past the grace period.');
        this.stopPolling();
        this.toastService.danger(t('gave-up-message'), t('gave-up-title'));
        void this.qb.forceLogout(serverId);
        break;
    }
  }

  private logCallFailure(call: string, err: unknown): void {
    console.error(QbPollingService.name, `poll.${call} failed`, err);
  }
}
