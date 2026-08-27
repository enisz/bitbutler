# Torrent List Initial Load Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the torrent grid's initial load (and any later resume-from-navigation) a single fast request instead of an artificially chunked, multi-second stream, and fix the bug that delays the "add torrent" flow on a cold app start.

**Architecture:** Delete the custom chunked IPC streaming protocol (`qb:sync-maindata-stream` in the main process, `streamMaindata` in the renderer) and replace it with the plain `qb.sync.maindata(serverId, rid)` request the background poll already uses. `QbPollingService.startMaindataPolling` becomes a single unified poll loop: its first tick (via RxJS `startWith(0)`) _is_ the initial load. It resumes from the last known `rid` unless the `serverId` actually changed, relying on qBittorrent's self-healing `rid` semantics (a stale `rid` just yields a fresh `full_update`) instead of any manual caching. `TorrentStoreService.applyMaindata` no longer has a "streaming chunk" concept, so it primes the store on the very first real call instead of waiting on a subsequent unrelated poll.

**Tech Stack:** Angular 22 (zoneless/signals) + RxJS, Electron main process (TypeScript), npm workspaces (`@bitbutler/app`, `@bitbutler/electron`, `@bitbutler/shared`), Vitest.

**Spec:** `docs/superpowers/specs/2026-08-27-torrent-list-initial-load-design.md`

## Global Constraints

- Drop `sortBy`/`sortDesc` end to end for the initial fetch - they only existed to keep progressively-trickled chunk rows in order, which no longer applies once there's a single response.
- Never reset `maindataRid$` to 0 or clear `TorrentStoreService` on a plain stop/restart of polling for the _same_ server - only reset on a genuine server switch (or an explicit `stopPolling()` reset path, e.g. logout / unrecoverable 401/403).
- Use hyphens (`-`), not em dashes, in all comments/commit messages/docs per this repo's writing style.
- Commit format: `#318: <short description>` (this plan implements issue #318 on branch `318-speed-up-torrent-list-loading`).

---

## Task 1: Unify `QbPollingService`'s initial load and background poll

**Files:**

- Modify: `packages/app/src/app/services/qb-polling.service.ts`
- Modify: `packages/app/src/app/pages/main/main.ts`
- Modify: `packages/app/src/app/pages/main/main.spec.ts`
- Test: `packages/app/src/app/services/qb-polling.service.spec.ts`

**Interfaces:**

- Consumes: `QbService.sync.maindata(serverId: string, rid: number): Promise<Maindata>` (already exists, unchanged - see `packages/app/src/app/services/qb.service.ts`).
- Produces: `QbPollingService.startMaindataPolling(serverId: string): Observable<Maindata>` - signature changes (drops the `sortBy?: string, sortDesc?: boolean` params). `main.ts`'s call site is the only other place in the codebase that calls this method (verified via search), so it's updated in this same task to keep the app package type-checking.

- [ ] **Step 1: Update `qb-polling.service.spec.ts` to describe the new behavior**

Replace the `mockQbService` setup and the two `streamMaindata`-based tests with the plain `maindata`-based equivalents, and add coverage for same-server rid retention vs. server-switch reset:

```ts
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Subject, firstValueFrom } from 'rxjs';
import { QbPollingService } from './qb-polling.service';
import { QbService } from './qb.service';
import { ServerSettingsService } from './server-settings.service';
import { WindowService } from './window.service';

describe('QbPollingService', () => {
  let service: QbPollingService;
  let mockQbService: any;
  let mockWindowService: any;
  let mockServerSettings: any;

  beforeEach(() => {
    mockQbService = {
      sync: {
        maindata: vi.fn().mockResolvedValue({ rid: 1 }),
        torrentPeers: vi.fn().mockResolvedValue({ rid: 1, peers: {} }),
      },
    };

    mockWindowService = {
      state: signal({
        height: 0,
        isFullScreen: false,
        isMaximized: false,
        isMinimized: false,
        width: 0,
      }),
    };

    mockServerSettings = {
      load: vi.fn().mockResolvedValue({ polling: { foreground: 2000, background: 5000 } }),
      asObservable: vi.fn().mockReturnValue(new Subject()),
    };

    TestBed.configureTestingModule({
      providers: [
        QbPollingService,
        { provide: QbService, useValue: mockQbService },
        { provide: WindowService, useValue: mockWindowService },
        { provide: ServerSettingsService, useValue: mockServerSettings },
      ],
    });

    service = TestBed.inject(QbPollingService);
  });

  it('should initialise isInitialLoading$ to false', async () => {
    const loading = await firstValueFrom(service.isInitialLoading$);
    expect(loading).toBe(false);
  });

  it('should expose pollingInterval$ observable', async () => {
    const interval = await firstValueFrom(service.pollingInterval$);
    expect(typeof interval).toBe('number');
  });

  it('should return the current polling interval from getPollingInterval()', () => {
    expect(typeof service.getPollingInterval()).toBe('number');
  });

  it('should reset isInitialLoading$ to false on stopPolling()', async () => {
    service.stopPolling();
    const loading = await firstValueFrom(service.isInitialLoading$);
    expect(loading).toBe(false);
  });

  it('should expose onPoll$ observable', () => {
    expect(service.onPoll$).toBeDefined();
  });

  // qb.sync.maindata is only invoked lazily, from inside the returned Observable's operator
  // chain (exhaustMap), so every test that asserts on it must actually subscribe - calling
  // startMaindataPolling() alone (as the old streamMaindata-based test did) never triggers it.
  it('should call qb.sync.maindata with rid 0 on the first call for a server', async () => {
    const sub = service.startMaindataPolling('server-1').subscribe();
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    expect(mockQbService.sync.maindata).toHaveBeenCalledWith('server-1', 0);
    sub.unsubscribe();
  });

  it('should stop any previous polling when startMaindataPolling() is called again', async () => {
    const sub1 = service.startMaindataPolling('server-1').subscribe();
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    const sub2 = service.startMaindataPolling('server-1').subscribe();
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    expect(mockQbService.sync.maindata).toHaveBeenCalledTimes(2);
    sub1.unsubscribe();
    sub2.unsubscribe();
  });

  it('should flip isInitialLoading$ back to false once the first fetch resolves', async () => {
    mockQbService.sync.maindata.mockResolvedValueOnce({ rid: 1 });
    const sub = service.startMaindataPolling('server-1').subscribe();

    expect(await firstValueFrom(service.isInitialLoading$)).toBe(true);

    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    expect(await firstValueFrom(service.isInitialLoading$)).toBe(false);
    sub.unsubscribe();
  });

  it('should resume from the last known rid when restarting polling for the same server', async () => {
    mockQbService.sync.maindata.mockResolvedValueOnce({ rid: 42 });
    const sub1 = service.startMaindataPolling('server-1').subscribe();
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    sub1.unsubscribe();

    const sub2 = service.startMaindataPolling('server-1').subscribe();
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    expect(mockQbService.sync.maindata).toHaveBeenLastCalledWith('server-1', 42);
    sub2.unsubscribe();
  });

  it('should reset the rid to 0 when restarting polling for a different server', async () => {
    mockQbService.sync.maindata.mockResolvedValueOnce({ rid: 42 });
    const sub1 = service.startMaindataPolling('server-1').subscribe();
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    sub1.unsubscribe();

    const sub2 = service.startMaindataPolling('server-2').subscribe();
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    expect(mockQbService.sync.maindata).toHaveBeenLastCalledWith('server-2', 0);
    sub2.unsubscribe();
  });

  describe('pause / resume', () => {
    it('should expose isPaused$ starting as false', async () => {
      const paused = await firstValueFrom(service.isPaused$);
      expect(paused).toBe(false);
    });

    it('pause() should return a symbol', () => {
      const token = service.pause();
      expect(typeof token).toBe('symbol');
      service.resume(token);
    });

    it('isPaused$ should emit true after pause()', async () => {
      const token = service.pause();
      const paused = await firstValueFrom(service.isPaused$);
      expect(paused).toBe(true);
      service.resume(token);
    });

    it('isPaused$ should emit false after resume() of the only token', async () => {
      const token = service.pause();
      service.resume(token);
      const paused = await firstValueFrom(service.isPaused$);
      expect(paused).toBe(false);
    });

    it('isPaused$ should stay true when one of two tokens is returned', async () => {
      const t1 = service.pause();
      const t2 = service.pause();
      service.resume(t1);
      const paused = await firstValueFrom(service.isPaused$);
      expect(paused).toBe(true);
      service.resume(t2);
    });

    it('stopPolling() should clear all tokens and set isPaused$ to false', async () => {
      service.pause();
      service.pause();
      service.stopPolling();
      const paused = await firstValueFrom(service.isPaused$);
      expect(paused).toBe(false);
    });
  });

  describe('startPeersPolling', () => {
    it('creates a per-hash rid subject while a subscription is active', async () => {
      const sub = service.startPeersPolling('server-1', 'hash-1').subscribe();
      await Promise.resolve();
      await Promise.resolve();

      expect((service as any).peersRidByHash.has('hash-1')).toBe(true);
      sub.unsubscribe();
    });

    it('removes the per-hash rid subject once the subscription ends', async () => {
      const sub = service.startPeersPolling('server-1', 'hash-1').subscribe();
      await Promise.resolve();
      await Promise.resolve();

      sub.unsubscribe();

      expect((service as any).peersRidByHash.has('hash-1')).toBe(false);
    });
  });
});
```

- [ ] **Step 2: Run the test file and confirm it fails**

Run: `npm test --workspace=@bitbutler/app -- qb-polling.service.spec.ts`
Expected: FAIL - the service still calls `this.qb.sync.streamMaindata(...)`, which is `undefined` on the new mock (`mockQbService.sync` no longer defines it), so subscribing throws a `TypeError` instead of calling `sync.maindata`.

- [ ] **Step 3: Rewrite `qb-polling.service.ts`**

Replace the entire file with:

```ts
import { Injectable, inject } from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import { BehaviorSubject, EMPTY, Observable, Subject, combineLatest, from, interval } from 'rxjs';
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
import { QbService } from './qb.service';
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

  // The last serverId polling was started for. A restart for the SAME server (e.g. a future
  // "resume after navigating away from the torrent list") should resume from the last known rid
  // instead of paying for a full reload - qBittorrent's sync API is self-healing (a stale rid
  // just yields a fresh full_update), so there's no downside to trying the cached rid first. A
  // restart for a DIFFERENT server means the data is genuinely stale and must be reset.
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
  }

  // The first tick of the returned poll loop (via startWith(0) below) IS the initial load - there
  // is no separate streaming/initial-load protocol. qb.sync.maindata(serverId, rid) is the same
  // plain request used for every later poll tick.
  startMaindataPolling(serverId: string): Observable<Maindata> {
    const isFreshStart = this.lastPolledServerId !== serverId;
    this.lastPolledServerId = serverId;

    this.stopPolling$.next();
    this._pauseTokens$.next(new Set());
    if (isFreshStart) {
      this.maindataRid$.next(0);
    }
    this._isInitialLoading$.next(true);
    void this.serverSettingsService.load();

    let hasLoadedOnce = false;
    const markInitialLoadDone = (): void => {
      if (hasLoadedOnce) return;
      hasLoadedOnce = true;
      this._isInitialLoading$.next(false);
    };

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
              tap((res: Maindata) => {
                if (typeof res?.rid === 'number') this.maindataRid$.next(res.rid);
                markInitialLoadDone();
              }),
              catchError((err) => {
                markInitialLoadDone();
                if (err?.status === 401 || err?.status === 403) {
                  console.warn(`[maindata] poll stopped: session expired (status ${err.status}).`);
                  this.stopPolling();
                } else {
                  console.error('[maindata] poll failed', err);
                }
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
```

- [ ] **Step 4: Run the test file and confirm it passes**

Run: `npm test --workspace=@bitbutler/app -- qb-polling.service.spec.ts`
Expected: PASS - all tests green.

- [ ] **Step 5: Update `main.ts`'s call site**

`packages/app/src/app/pages/main/main.ts` currently derives `sortBy`/`sortDesc` from the persisted grid column state and passes them to `startMaindataPolling`. Remove that entirely.

Change the imports at the top of the file from:

```ts
import { toSignal } from '@angular/core/rxjs-interop';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { faBars, faChevronRight } from '@fortawesome/free-solid-svg-icons';
import type { ColumnState } from 'ag-grid-community';
import { Subscription, first } from 'rxjs';
import { BbLogo } from '../../components/bb-logo/bb-logo';
import { DEFAULT_SIDEBAR_SETTINGS } from '../../models/sidebar-settings.model';
import { Maindata, QbServerState } from '../../models/torrent.model';
import { QbPollingService } from '../../services/qb-polling.service';
import { ServerStoreService } from '../../services/server-store.service';
import { SidebarSettingsService } from '../../services/sidebar-settings.service';
import { ThemeService } from '../../services/theme.service';
import { TorrentListGridSettingsService } from '../../services/torrent-list-grid.settings.service';
import { TorrentStoreService } from '../../services/torrent-store.service';
```

to:

```ts
import { toSignal } from '@angular/core/rxjs-interop';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { faBars, faChevronRight } from '@fortawesome/free-solid-svg-icons';
import { Subscription } from 'rxjs';
import { BbLogo } from '../../components/bb-logo/bb-logo';
import { DEFAULT_SIDEBAR_SETTINGS } from '../../models/sidebar-settings.model';
import { Maindata, QbServerState } from '../../models/torrent.model';
import { QbPollingService } from '../../services/qb-polling.service';
import { ServerStoreService } from '../../services/server-store.service';
import { SidebarSettingsService } from '../../services/sidebar-settings.service';
import { ThemeService } from '../../services/theme.service';
import { TorrentStoreService } from '../../services/torrent-store.service';
```

Remove the `private readonly torrentListGridSettingsService = inject(TorrentListGridSettingsService);` field.

Change `_pollEffect` from:

```ts
  private readonly _pollEffect = effect((onCleanup) => {
    const serverId = this.serverStoreService.currentServerId();

    this.pollSub?.unsubscribe();
    this.pollSub = null;
    this.serverState.set(null);

    if (!serverId) return;

    const sub = new Subscription();
    this.pollSub = sub;

    this.torrentListGridSettingsService
      .asObservable()
      .pipe(first())
      .subscribe((prefs) => {
        const sortCol = prefs?.columnState?.find(
          (c): c is ColumnState => typeof c === 'object' && c !== null && !!c.sort,
        );

        const sortBy = sortCol?.colId;
        const sortDesc = sortCol?.sort === 'desc';

        sub.add(
          this.qbPollingService
            .startMaindataPolling(serverId, sortBy, sortDesc)
            .subscribe((data: Maindata) => {
              this.torrentStore.applyMaindata(data);
              this.serverState.update((prev) => mergeServerState(prev, data.server_state));
            }),
        );
      });

    onCleanup(() => sub.unsubscribe());
  });
```

to:

```ts
  private readonly _pollEffect = effect((onCleanup) => {
    const serverId = this.serverStoreService.currentServerId();

    this.pollSub?.unsubscribe();
    this.pollSub = null;
    this.serverState.set(null);

    if (!serverId) return;

    const sub = new Subscription();
    this.pollSub = sub;

    sub.add(
      this.qbPollingService.startMaindataPolling(serverId).subscribe((data: Maindata) => {
        this.torrentStore.applyMaindata(data);
        this.serverState.update((prev) => mergeServerState(prev, data.server_state));
      }),
    );

    onCleanup(() => sub.unsubscribe());
  });
```

- [ ] **Step 6: Drop the now-unused `TorrentListGridSettingsService` mock from `main.spec.ts`**

In `packages/app/src/app/pages/main/main.spec.ts`, remove the `TorrentListGridSettingsService` import and its provider entry:

```ts
import { TorrentListGridSettingsService } from '../../services/torrent-list-grid.settings.service';
```

and:

```ts
        {
          provide: TorrentListGridSettingsService,
          useValue: { asObservable: vi.fn().mockReturnValue(new Subject().asObservable()) },
        },
```

- [ ] **Step 7: Run the affected app tests and confirm they pass**

Run: `npm test --workspace=@bitbutler/app -- qb-polling.service.spec.ts main.spec.ts`
Expected: PASS

- [ ] **Step 8: Typecheck the app package**

Run: `npm run build --workspace=@bitbutler/app`
Expected: succeeds with no type errors (this exercises `main.ts` and `qb-polling.service.ts` together; `qb.service.ts` still has the old, now-unused `streamMaindata`/`StreamMaindataState` at this point, which is fine - it's removed in Task 3).

- [ ] **Step 9: Commit**

```bash
git add packages/app/src/app/services/qb-polling.service.ts packages/app/src/app/services/qb-polling.service.spec.ts packages/app/src/app/pages/main/main.ts packages/app/src/app/pages/main/main.spec.ts
git commit -m "$(cat <<'EOF'
#318: unify initial maindata load with the background poll

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01XN76vg1Hw2gssXCejVS9Ju
EOF
)"
```

---

## Task 2: Fix `TorrentStoreService` priming timing

**Files:**

- Modify: `packages/app/src/app/services/torrent-store.service.ts`
- Test: `packages/app/src/app/services/torrent-store.service.spec.ts`

**Interfaces:**

- Consumes: nothing new.
- Produces: `TorrentStoreService.applyMaindata(data: Maindata): TorrentTxnDelta` - behavior changes (no longer reads a `_isStreamingChunk` marker; `isPrimed()` flips true on the very first call it processes rather than requiring a later "non-streaming" call). No signature change.

- [ ] **Step 1: Rename the existing priming test to match the new (simpler) behavior**

In `packages/app/src/app/services/torrent-store.service.spec.ts`, change:

```ts
it('should set isPrimed to true after first non-streaming full_update', () => {
  expect(service.isPrimed()).toBe(false);
  service.applyMaindata(makeMaindata({ full_update: true }));
  expect(service.isPrimed()).toBe(true);
});
```

to:

```ts
it('should set isPrimed to true after the first full_update', () => {
  expect(service.isPrimed()).toBe(false);
  service.applyMaindata(makeMaindata({ full_update: true }));
  expect(service.isPrimed()).toBe(true);
});
```

- [ ] **Step 2: Run the test file and confirm the suite currently passes as-is**

Run: `npm test --workspace=@bitbutler/app -- torrent-store.service.spec.ts`
Expected: PASS (the rename alone doesn't change behavior yet - this confirms the baseline before the implementation edit).

- [ ] **Step 3: Remove the `_isStreamingChunk` concept from `torrent-store.service.ts`**

Remove the `StreamableMaindata` type and its explanatory comment:

```ts
// QbService.sync.streamMaindata tags each streamed chunk with this internal marker (see
// qb.service.ts) so downstream consumers can tell a still-streaming initial load apart from a
// fully-primed maindata snapshot. It is not part of the qBittorrent API response itself.
type StreamableMaindata = Maindata & { _isStreamingChunk?: boolean };
```

so the file goes directly from the `TorrentFinishedEvent` type to `export type { ValueCount };`.

In `applyMaindata`, change:

```ts
  applyMaindata(data: Maindata): TorrentTxnDelta {
    const incoming: Record<string, Partial<Torrent>> = data?.torrents ?? {};
    const removed: string[] = data?.torrents_removed ?? [];
    const fullUpdate = !!data?.full_update;

    const isStreamingChunk = !!(data as StreamableMaindata)._isStreamingChunk;

    const add: Torrent[] = [];
```

to:

```ts
  applyMaindata(data: Maindata): TorrentTxnDelta {
    const incoming: Record<string, Partial<Torrent>> = data?.torrents ?? {};
    const removed: string[] = data?.torrents_removed ?? [];
    const fullUpdate = !!data?.full_update;

    const add: Torrent[] = [];
```

Change:

```ts
      this._torrents.set(next);

      this.ingestFinished(add, [], this._isPrimed() && !isStreamingChunk);
      if (!isStreamingChunk) this._isPrimed.set(true);
    } else {
```

to:

```ts
      this._torrents.set(next);

      this.ingestFinished(add, [], this._isPrimed());
      this._isPrimed.set(true);
    } else {
```

Change:

```ts
      this.ingestFinished(
        [...add, ...update],
        remove.map((r) => r.hash),
        this._isPrimed() && !isStreamingChunk,
      );
      if (!isStreamingChunk) this._isPrimed.set(true);
    }
```

to:

```ts
      this.ingestFinished(
        [...add, ...update],
        remove.map((r) => r.hash),
        this._isPrimed(),
      );
      this._isPrimed.set(true);
    }
```

- [ ] **Step 4: Run the test file and confirm it still passes**

Run: `npm test --workspace=@bitbutler/app -- torrent-store.service.spec.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/app/src/app/services/torrent-store.service.ts packages/app/src/app/services/torrent-store.service.spec.ts
git commit -m "$(cat <<'EOF'
#318: prime the torrent store on the first maindata update

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01XN76vg1Hw2gssXCejVS9Ju
EOF
)"
```

---

## Task 3: Remove the chunked streaming protocol

By this point nothing calls `streamMaindata`/`onSyncChunk`/`startSyncStream` or the `qb:sync-maindata-stream` IPC channel except their own definitions and tests, so this task deletes them end to end: shared contract, Electron main handler, preload bridge, and the renderer client method - plus the two leftover re-exports/stubs that mirror the shared types for the app's ambient typings and test setup.

**Files:**

- Modify: `packages/shared/src/ipc.types.ts`
- Modify: `packages/shared/src/index.ts`
- Modify: `packages/electron/src/preload.ts`
- Modify: `packages/electron/src/ipc/qbittorrent.ts`
- Modify: `packages/electron/src/ipc/qbittorrent.spec.ts`
- Modify: `packages/app/src/app/services/qb.service.ts`
- Modify: `packages/app/src/app/services/qb.service.spec.ts`
- Modify: `packages/app/src/bitbutler.d.ts`
- Modify: `packages/app/src/test-setup.ts`

**Interfaces:**

- Consumes: nothing new.
- Produces: `BitButlerAPI['qb']` no longer has `startSyncStream`/`onSyncChunk`; `QbService.sync` no longer has `streamMaindata`. Nothing else in the codebase references these (verified by search before writing this plan) - this task's steps are ordered so `npm run lint` and `npm test` can be run once at the end to confirm nothing was missed.

- [ ] **Step 1: Remove the streaming types from `packages/shared/src/ipc.types.ts`**

Remove:

```ts
export interface BitButlerSyncStreamPayload {
  id: string;
  rid?: number;
  chunkSize?: number;
  delayMs?: number;
  sortBy?: string;
  sortDesc?: boolean;
}

export type BitButlerSyncStreamResponse =
  | { type: 'metadata'; data: Record<string, unknown>; total: number }
  | { type: 'chunk'; data: Record<string, unknown>; progress: number; total: number }
  | { type: 'done' }
  | { type: 'error'; error: string };
```

(the two type declarations, including the blank line that separates them from `MenuClickPayload` below - leave `MenuClickPayload` and everything else untouched).

In the `BitButlerAPI['qb']` interface, remove:

```ts
    startSyncStream(payload: BitButlerSyncStreamPayload): void;
    onSyncChunk(callback: (payload: BitButlerSyncStreamResponse) => void): () => void;
```

so the `qb` interface ends with `torrentsAdd(payload: BitButlerQbTorrentsAddPayload): Promise<unknown>;`.

- [ ] **Step 2: Remove the re-exports from `packages/shared/src/index.ts`**

Remove the two lines:

```ts
  BitButlerSyncStreamPayload,
  BitButlerSyncStreamResponse,
```

from the `export type { ... }` block (keep every other export in that block unchanged).

- [ ] **Step 3: Remove the bridge methods from `packages/electron/src/preload.ts`**

Change the import list from:

```ts
import type {
  BbeMetadata,
  BbeServerInfo,
  BitButlerAPI,
  BitButlerSyncStreamResponse,
  ExportDoneEvent,
```

to:

```ts
import type {
  BbeMetadata,
  BbeServerInfo,
  BitButlerAPI,
  ExportDoneEvent,
```

Change:

```ts
    torrentsAdd: (payload) => ipcRenderer.invoke('qb:torrentsAdd', payload),
    startSyncStream: (payload) => ipcRenderer.send('qb:sync-maindata-stream', payload),
    onSyncChunk: (callback) =>
      makeIpcSubscription(
        'qb:sync-maindata-chunk',
        (p) => p as BitButlerSyncStreamResponse,
        callback,
      ),
  },
```

to:

```ts
    torrentsAdd: (payload) => ipcRenderer.invoke('qb:torrentsAdd', payload),
  },
```

- [ ] **Step 4: Remove the handler from `packages/electron/src/ipc/qbittorrent.ts`**

Change the import at the top of the file from:

```ts
import type { BitButlerQbTorrentsAddPayload, BitButlerSyncStreamPayload } from '@bitbutler/shared';
```

to:

```ts
import type { BitButlerQbTorrentsAddPayload } from '@bitbutler/shared';
```

In `registerQbIpcHandlers`, remove:

```ts
ipcMain.on('qb:sync-maindata-stream', async (event, payload: BitButlerSyncStreamPayload) =>
  qbSyncMaindataStream(event, payload),
);
```

so the function ends with the `qb:torrentsAdd` handler registration.

Remove the `streamGeneration` map and the entire `qbSyncMaindataStream` function - everything from:

```ts
const streamGeneration = new Map<number, number>();

async function qbSyncMaindataStream(
```

through the end of the file (its closing `}` is currently the last line of the file). After this step, `requireString` is the last function in the file.

- [ ] **Step 5: Remove the corresponding tests from `packages/electron/src/ipc/qbittorrent.spec.ts`**

Remove the entire `describe('qb:sync-maindata-stream IPC handler', () => { ... })` block (it's the last block in the file, immediately after the `describe` that ends with the `Content-Type` assertion around form-urlencoded requests).

- [ ] **Step 6: Run the electron package tests and confirm they pass**

Run: `npm test --workspace=@bitbutler/electron`
Expected: PASS

- [ ] **Step 7: Remove `streamMaindata` from `packages/app/src/app/services/qb.service.ts`**

Change the top-level imports from:

```ts
import { Injectable, inject } from '@angular/core';
import { Router } from '@angular/router';
import { TranslateService } from '@ngx-translate/core';
import { Observable, Subscriber } from 'rxjs';
import { HttpError } from '../models/http.model';
```

to:

```ts
import { Injectable, inject } from '@angular/core';
import { Router } from '@angular/router';
import { TranslateService } from '@ngx-translate/core';
import { HttpError } from '../models/http.model';
```

Remove the `StreamMaindataState` type:

```ts
export type StreamMaindataState = {
  maindata: Maindata | null;
  progress: number;
  total: number;
  done: boolean;
};
```

Remove the `streamMaindata` method from the `sync` object, changing:

```ts
  readonly sync = {
    maindata: async (serverId: string, rid: number): Promise<Maindata> => {
      const res = await this.request<Maindata>(serverId, {
        path: '/api/v2/sync/maindata',
        method: 'GET',
        query: { rid },
      });
      if (res.ok) return res.body;
      throw new HttpError(res.status, res.statusText, `Failed to get maindata`);
    },

    streamMaindata: (
      serverId: string,
      rid: number = 0,
      sortBy?: string,
      sortDesc?: boolean,
    ): Observable<StreamMaindataState> => {
      return new Observable((subscriber: Subscriber<StreamMaindataState>) => {
        let totalCount = 0;
        let progressCount = 0;

        const unsubscribe = window.bitbutler.qb.onSyncChunk((payload) => {
          if (payload.type === 'error') {
            subscriber.error(new Error(payload.error));
            return;
          }

          if (payload.type === 'metadata') {
            totalCount = payload.total;
            const metaChunk = { ...payload.data, _isStreamingChunk: true } as unknown as Maindata;
            subscriber.next({ maindata: metaChunk, progress: 0, total: totalCount, done: false });
          }

          if (payload.type === 'chunk') {
            progressCount = payload.progress;
            const deltaChunk = {
              torrents: payload.data,
              _isStreamingChunk: true,
            } as unknown as Maindata;
            subscriber.next({
              maindata: deltaChunk,
              progress: progressCount,
              total: totalCount,
              done: false,
            });
          }

          if (payload.type === 'done') {
            const finalChunk = { _isStreamingChunk: false } as unknown as Maindata;
            subscriber.next({
              maindata: finalChunk,
              progress: totalCount,
              total: totalCount,
              done: true,
            });
          }
        });

        window.bitbutler.qb.startSyncStream({ id: serverId, rid, sortBy, sortDesc });
        return () => unsubscribe();
      });
    },

    torrentPeers: async (
```

to:

```ts
  readonly sync = {
    maindata: async (serverId: string, rid: number): Promise<Maindata> => {
      const res = await this.request<Maindata>(serverId, {
        path: '/api/v2/sync/maindata',
        method: 'GET',
        query: { rid },
      });
      if (res.ok) return res.body;
      throw new HttpError(res.status, res.statusText, `Failed to get maindata`);
    },

    torrentPeers: async (
```

- [ ] **Step 8: Remove the corresponding tests from `packages/app/src/app/services/qb.service.spec.ts`**

Remove:

```ts
it('should expose streamMaindata() as an observable', () => {
  vi.spyOn(window.bitbutler.qb, 'onSyncChunk').mockReturnValue(() => {});
  vi.spyOn(window.bitbutler.qb, 'startSyncStream').mockReturnValue(undefined as any);
  const obs = service.sync.streamMaindata('server-1', 0);
  expect(typeof obs.subscribe).toBe('function');
});

it('should call startSyncStream when streamMaindata is subscribed', () => {
  const startSpy = vi
    .spyOn(window.bitbutler.qb, 'startSyncStream')
    .mockReturnValue(undefined as any);
  vi.spyOn(window.bitbutler.qb, 'onSyncChunk').mockReturnValue(() => {});

  const sub = service.sync.streamMaindata('server-1', 5, 'name', true).subscribe();
  expect(startSpy).toHaveBeenCalledWith({
    id: 'server-1',
    rid: 5,
    sortBy: 'name',
    sortDesc: true,
  });
  sub.unsubscribe();
});
```

- [ ] **Step 9: Update the app's ambient typings and test stub**

In `packages/app/src/bitbutler.d.ts`, remove `BitButlerSyncStreamPayload` and `BitButlerSyncStreamResponse` from both the `import type` block and the `export type` block (they're listed identically in each).

In `packages/app/src/test-setup.ts`, remove the two lines from the `qb` stub:

```ts
    startSyncStream: noop,
    onSyncChunk: noopSubscription,
```

so `qb.torrentsAdd: noopAsync,` is directly followed by the closing `},` of the `qb` block.

- [ ] **Step 10: Run the full app test suite and confirm it passes**

Run: `npm test --workspace=@bitbutler/app`
Expected: PASS

- [ ] **Step 11: Confirm no references remain anywhere in the repo**

Run: `grep -rn "streamMaindata\|onSyncChunk\|startSyncStream\|BitButlerSyncStream\|StreamMaindataState\|sync-maindata-stream\|sync-maindata-chunk" packages --include=*.ts | grep -v /dist/`
Expected: no output.

- [ ] **Step 12: Commit**

```bash
git add packages/shared/src/ipc.types.ts packages/shared/src/index.ts packages/electron/src/preload.ts packages/electron/src/ipc/qbittorrent.ts packages/electron/src/ipc/qbittorrent.spec.ts packages/app/src/app/services/qb.service.ts packages/app/src/app/services/qb.service.spec.ts packages/app/src/bitbutler.d.ts packages/app/src/test-setup.ts
git commit -m "$(cat <<'EOF'
#318: remove the chunked maindata streaming protocol

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01XN76vg1Hw2gssXCejVS9Ju
EOF
)"
```

---

## Task 4: Full workspace verification

**Files:** none (verification only).

**Interfaces:** none.

- [ ] **Step 1: Lint the whole repo**

Run: `npm run lint`
Expected: no errors, no warnings (the repo enforces `max-warnings=0`). If unused-import warnings appear for anything touched in Tasks 1-3, remove the unused import and re-run.

- [ ] **Step 2: Run the full test suite across all workspaces**

Run: `npm test`
Expected: all workspaces PASS.

- [ ] **Step 3: Build the Angular renderer and Electron main process**

Run: `npm run build && npm run build:electron`
Expected: both succeed with no type errors.

- [ ] **Step 4: Manual smoke test - large torrent count**

Run: `npm start`. Point the app at (or seed) a qBittorrent server with several thousand torrents (as close to 10,000 as practical). Confirm:

- The grid populates in effectively one paint - no visible row-by-row/chunk-by-chunk trickle.
- Sorting/filtering/selecting rows works normally afterward.

- [ ] **Step 5: Manual smoke test - cold start "add torrent"**

With the app fully closed and pointed at the same large-torrent-count server, open a `.torrent` file (or use whatever "open with BitButler" entry point exists on the dev machine) so the app has to cold-start. Confirm the Add Torrent dialog appears promptly once login completes, without a multi-second unresponsive period first.

- [ ] **Step 6: Manual smoke test - server switch loading modal**

With two configured servers, switch from one to the other via the server switcher. Confirm the "switching server" loading modal appears, stays up for a reasonable duration, and closes once the new server's torrents are visible (this exercises `UiCommandHandlerService.waitForInitialLoad()`, which depends on the `isInitialLoading$` true/false transition Task 1 changed).

- [ ] **Step 7: Clean up the spec/plan docs before opening the PR**

Per this repo's convention, `docs/superpowers/specs/` and `docs/superpowers/plans/` must not be merged to main. Once the above is verified, remove the `docs` folder in its own commit:

```bash
git rm -r docs/superpowers/specs/2026-08-27-torrent-list-initial-load-design.md docs/superpowers/plans/2026-08-27-torrent-list-initial-load.md
git commit -m "$(cat <<'EOF'
#318: removed spec and plan

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01XN76vg1Hw2gssXCejVS9Ju
EOF
)"
```

(If `docs/superpowers/specs/` or `docs/superpowers/plans/` end up empty after this, that's expected - don't recreate placeholder files in them.)
