import { Injectable, inject } from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import {
  BehaviorSubject,
  EMPTY,
  Observable,
  Subject,
  combineLatest,
  from,
  interval,
  of,
} from 'rxjs';
import {
  catchError,
  distinctUntilChanged,
  exhaustMap,
  finalize,
  map,
  startWith,
  switchMap,
  takeUntil,
  tap,
} from 'rxjs/operators';
import { Maindata, QbTorrentPeersResponse } from '../models/torrent.model';
import { QbService, StreamMaindataState } from './qb.service';
import { ServerSettingsService } from './server-settings.service';
import { WindowService } from './window.service';

@Injectable({ providedIn: 'root' })
export class QbPollingService {
  private qb = inject(QbService);
  private readonly serverSettingsService = inject(ServerSettingsService);
  private readonly windowService = inject(WindowService);

  private maindataRid$ = new BehaviorSubject<number>(0);
  private peersRidByHash = new Map<string, BehaviorSubject<number>>();
  private windowState$ = toObservable(this.windowService.state);

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
  }

  startMaindataPolling(
    serverId: string,
    sortBy?: string,
    sortDesc?: boolean,
  ): Observable<Maindata> {
    this.stopPolling();
    this.maindataRid$.next(0);
    this._isInitialLoading$.next(true);
    void this.serverSettingsService.load();

    return this.qb.sync.streamMaindata(serverId, 0, sortBy, sortDesc).pipe(
      takeUntil(this.stopPolling$),
      switchMap((state: StreamMaindataState) => {
        if (state.maindata && !state.done) {
          return of(state.maindata);
        }

        if (state.done) {
          if (typeof state.maindata?.rid === 'number') {
            this.maindataRid$.next(state.maindata.rid);
          }
          this._isInitialLoading$.next(false);

          return this.createBackgroundPoll(serverId);
        }

        return EMPTY;
      }),
      catchError((err) => {
        this._isInitialLoading$.next(false);
        console.error('Polling failed:', err);
        return EMPTY;
      }),
    );
  }

  private createBackgroundPoll(serverId: string): Observable<Maindata> {
    const settings$ = this.serverSettingsService.asObservable().pipe(startWith(null));
    const windowState$ = this.windowState$.pipe(startWith(null));

    return combineLatest([settings$, windowState$, this.isPaused$]).pipe(
      takeUntil(this.stopPolling$),
      map(([settings, windowState, isPaused]) => {
        const isMinimized = windowState?.isMinimized ?? false;
        const foreground = settings?.polling?.foreground ?? 2000;
        const background = settings?.polling?.background ?? 5000;

        return { pollMs: isMinimized ? background : foreground, isPaused };
      }),
      distinctUntilChanged((a, b) => a.pollMs === b.pollMs && a.isPaused === b.isPaused),
      tap(({ pollMs, isPaused }) => {
        if (!isPaused) this._pollingInterval$.next(pollMs);
      }),
      switchMap(({ pollMs, isPaused }) => {
        if (isPaused) return EMPTY;
        return interval(pollMs).pipe(
          startWith(0),
          tap(() => this._onPoll$.next()),
          exhaustMap(() =>
            from(this.qb.sync.maindata(serverId, this.maindataRid$.value)).pipe(
              tap((res: any) => {
                if (typeof res?.rid === 'number') this.maindataRid$.next(res.rid);
              }),
              catchError((err) => {
                if (err?.status === 401 || err?.status === 403) {
                  this.stopPolling();
                }
                console.error('[maindata] background poll failed', err);
                return EMPTY;
              }),
            ),
          ),
        );
      }),
    );
  }

  startPeersPolling(serverId: string, hash: string): Observable<QbTorrentPeersResponse> {
    const rid$ = this.getPeersRid$(hash);
    rid$.next(0);

    return this.pollingInterval$.pipe(
      takeUntil(this.stopPolling$),
      switchMap((ms) => interval(ms)),
      startWith(0),
      exhaustMap(() => from(this.qb.sync.torrentPeers(serverId, hash, rid$.value))),
      tap((res) => {
        if (typeof res?.rid === 'number') rid$.next(res.rid);
      }),
      catchError((err) => {
        console.error(
          QbPollingService.name,
          'startPeersPolling',
          `[peers] poll failed hash=${hash}`,
          err,
        );
        return EMPTY;
      }),
      finalize(() => this.peersRidByHash.delete(hash)),
    );
  }

  private getPeersRid$(hash: string): BehaviorSubject<number> {
    let rid$ = this.peersRidByHash.get(hash);
    if (!rid$) {
      rid$ = new BehaviorSubject<number>(0);
      this.peersRidByHash.set(hash, rid$);
    }
    return rid$;
  }

  public getPollingInterval(): number {
    return this._pollingInterval$.value;
  }
}
