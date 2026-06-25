# Torrent Details Reorg Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Centralize the torrent details modal's data fetching/polling and action-triggering into two modal-scoped services, make each tab's polling pause while its tab isn't active, fix the delete button's wrong-target bug, and move General's hover-reveal actions into footer buttons.

**Architecture:** Two new `@Injectable()` services (not `providedIn: 'root'`) provided in `TorrentDetails`' `providers` array: `TorrentDetailsDataService` (owns `hash`/`context`/`activeTabId`, all polling, `localPath`/`singleFile`/`errorLog`, and `stopAll()` teardown) and `TorrentDetailsActionsService` (owns every action-trigger method, injects the data service for current hash/torrent). `General`/`Trackers`/`Peers`/`Content` drop their `hash`/`context` inputs entirely and `inject()` these services directly, exactly like `Settings`' tabs inject `SettingsStateService` today.

**Tech Stack:** Angular 20 (zoneless, signals), RxJS, Vitest (`vi.fn()`, `vi.useFakeTimers()`), ng-bootstrap modals/dropdowns.

## Global Constraints

- Commit message format: `#183: short description` (this branch closes both #183 and #184; use `#183` since the footer-actions work is the larger remaining piece - #184's own commits already used `#184` and stay as-is).
- Use `-` (hyphen) instead of `—` (em dash) in all written output, including commit messages.
- `npm run lint` must pass with zero warnings (`max-warnings=0`) before this is done.
- Background data fetching (polling) never shows a toast on failure - only `console.error`. Only explicit user-triggered actions (in `TorrentDetailsActionsService`) show toasts. This is a deliberate behavior change from today's `Content` tab (which toasts on poll failure) - it both matches the other 3 tabs' existing pattern and closes the #184 race condition at its root, since a toast tied to an in-flight request can still fire after `stopAll()` if it's not removed entirely.
- Every existing test must keep passing unless this plan explicitly says a test's expectation changes (and says why).

---

### Task 1: `TorrentDetailsDataService` skeleton - hash/context/activeTabId/selectTab/torrent/stopAll

**Files:**

- Create: `packages/app/src/app/components/modals/torrent-details/torrent-details-data.service.ts`
- Test: `packages/app/src/app/components/modals/torrent-details/torrent-details-data.service.spec.ts`

**Interfaces:**

- Consumes: `TorrentStoreService.torrentsMap()` (`Signal<Map<string, Torrent>>`, existing), `TorrentDetailTabId` (existing, from `./torrent-details.interface`).
- Produces: `TorrentDetailsDataService` class with `init(hash: string, context: Record<string, any>): void`, `hash(): string`, `context(): Record<string, any>`, `activeTabId: WritableSignal<TorrentDetailTabId>`, `selectTab(id: TorrentDetailTabId): void`, `torrent: Signal<{ data: Torrent; properties: QbTorrentProperties } | null>`, `stopAll(): void`. Consumed by every later task in this plan (every tab and `TorrentDetailsActionsService` inject this service).

- [ ] **Step 1: Write the failing test**

Create `packages/app/src/app/components/modals/torrent-details/torrent-details-data.service.spec.ts`:

```ts
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Torrent } from '../../../models/torrent.model';
import { TorrentStoreService } from '../../../services/torrent-store.service';
import { TorrentDetailsDataService } from './torrent-details-data.service';

const makeTorrent = (overrides: Partial<Torrent> = {}): Torrent => ({
  added_on: 1700000000,
  amount_left: 0,
  auto_tmm: false,
  availability: 0,
  category: '',
  completed: 0,
  completion_on: 0,
  content_path: '',
  dl_limit: 0,
  dlspeed: 0,
  download_path: '',
  downloaded: 0,
  downloaded_session: 0,
  eta: 0,
  f_l_piece_prio: false,
  force_start: false,
  hash: 'abc123',
  inactive_seeding_time_limit: 0,
  infohash_v1: '',
  infohash_v2: '',
  last_activity: 0,
  magnet_uri: '',
  max_inactive_seeding_time: 0,
  max_ratio: 0,
  max_seeding_time: 0,
  name: 'My Torrent',
  num_complete: 0,
  num_incomplete: 0,
  num_leechs: 0,
  num_seeds: 0,
  priority: 0,
  progress: 0,
  ratio: 0,
  ratio_limit: 0,
  save_path: '',
  seeding_time: 0,
  seeding_time_limit: 0,
  seen_complete: 0,
  seq_dl: false,
  size: 0,
  state: 'downloading',
  super_seeding: false,
  tags: '',
  time_active: 0,
  total_size: 0,
  tracker: '',
  trackers_count: 0,
  up_limit: 0,
  uploaded: 0,
  uploaded_session: 0,
  upspeed: 0,
  ...overrides,
});

describe('TorrentDetailsDataService', () => {
  let service: TorrentDetailsDataService;
  let torrentsMap: ReturnType<typeof signal<Map<string, Torrent>>>;

  beforeEach(() => {
    torrentsMap = signal(new Map());

    TestBed.configureTestingModule({
      providers: [
        TorrentDetailsDataService,
        { provide: TorrentStoreService, useValue: { torrentsMap } },
      ],
    });

    service = TestBed.inject(TorrentDetailsDataService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('defaults activeTabId to general', () => {
    expect(service.activeTabId()).toBe('general');
  });

  describe('init / hash / context', () => {
    it('stores the hash and context passed to init', () => {
      service.init('abc123', { editMode: true });
      expect(service.hash()).toBe('abc123');
      expect(service.context()).toEqual({ editMode: true });
    });
  });

  describe('selectTab', () => {
    it('updates activeTabId', () => {
      service.selectTab('trackers');
      expect(service.activeTabId()).toBe('trackers');
    });
  });

  describe('torrent computed', () => {
    it('is null when there is no properties value yet', () => {
      service.init('abc123', {});
      torrentsMap.set(new Map([['abc123', makeTorrent()]]));
      expect(service.torrent()).toBeNull();
    });

    it('is null when the hash is not in the torrent store', () => {
      service.init('missing-hash', {});
      expect(service.torrent()).toBeNull();
    });
  });

  describe('stopAll', () => {
    it('does not throw when called with no active subscriptions', () => {
      expect(() => service.stopAll()).not.toThrow();
    });
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run test --workspace=@bitbutler/app -- torrent-details-data.service`
Expected: FAIL - `Cannot find module './torrent-details-data.service'`.

- [ ] **Step 3: Write the minimal implementation**

Create `packages/app/src/app/components/modals/torrent-details/torrent-details-data.service.ts`:

```ts
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
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm run test --workspace=@bitbutler/app -- torrent-details-data.service`
Expected: PASS for all tests above.

- [ ] **Step 5: Commit**

```bash
git add packages/app/src/app/components/modals/torrent-details/torrent-details-data.service.ts packages/app/src/app/components/modals/torrent-details/torrent-details-data.service.spec.ts
git commit -m "#183: add TorrentDetailsDataService skeleton (hash, context, activeTabId, torrent)"
```

---

### Task 2: Properties polling, gated to the General tab being active

**Files:**

- Modify: `packages/app/src/app/components/modals/torrent-details/torrent-details-data.service.ts`
- Test: `packages/app/src/app/components/modals/torrent-details/torrent-details-data.service.spec.ts`

**Interfaces:**

- Consumes: `QbService.torrents.properties(serverId: string, hash: string): Promise<QbTorrentProperties>` (existing, `packages/app/src/app/services/qb.service.ts:204`), `ServerStoreService.currentServerId(): Signal<string | null>` (existing).
- Produces: `TorrentDetailsDataService.properties: Signal<QbTorrentProperties | null>` (already declared in Task 1, now populated), polls only while `activeTabId() === 'general'`.

- [ ] **Step 1: Write the failing tests**

In `torrent-details-data.service.spec.ts`, add imports at the top:

```ts
import { QbTorrentProperties } from '../../../models/qbittorrent.model';
import { QbService } from '../../../services/qb.service';
import { ServerStoreService } from '../../../services/server-store.service';
```

Add a `makeProperties` helper next to `makeTorrent`:

```ts
const makeProperties = (overrides: Partial<QbTorrentProperties> = {}): QbTorrentProperties => ({
  save_path: '',
  creation_date: 1700000000,
  piece_size: 0,
  comment: '',
  total_wasted: 0,
  total_uploaded: 0,
  total_uploaded_session: 0,
  total_downloaded: 0,
  total_downloaded_session: 0,
  up_limit: 0,
  dl_limit: 0,
  time_elapsed: 0,
  seeding_time: 0,
  nb_connections: 0,
  nb_connections_limit: 0,
  share_ratio: 0,
  addition_date: 0,
  completion_date: 0,
  created_by: '',
  dl_speed_avg: 0,
  dl_speed: 0,
  eta: 0,
  last_seen: 0,
  peers: 0,
  peers_total: 0,
  pieces_have: 0,
  pieces_num: 0,
  reannounce: 0,
  seeds: 0,
  seeds_total: 0,
  total_size: 0,
  up_speed_avg: 0,
  up_speed: 0,
  isPrivate: false,
  infohash_v1: '',
  infohash_v2: '',
  ...overrides,
});
```

Replace the `beforeEach` block with one that provides `QbService`/`ServerStoreService` and uses fake timers:

```ts
describe('TorrentDetailsDataService', () => {
  let service: TorrentDetailsDataService;
  let torrentsMap: ReturnType<typeof signal<Map<string, Torrent>>>;
  let qbTorrentsProperties: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.useFakeTimers();
    torrentsMap = signal(new Map());
    qbTorrentsProperties = vi.fn().mockResolvedValue(makeProperties());

    TestBed.configureTestingModule({
      providers: [
        TorrentDetailsDataService,
        { provide: TorrentStoreService, useValue: { torrentsMap } },
        { provide: ServerStoreService, useValue: { currentServerId: signal('server-1') } },
        { provide: QbService, useValue: { torrents: { properties: qbTorrentsProperties } } },
      ],
    });

    service = TestBed.inject(TorrentDetailsDataService);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // ... existing tests stay, unchanged ...
```

Add a new `describe('properties polling', ...)` block at the end of the file, before the final closing `});`:

```ts
describe('properties polling', () => {
  it('fetches properties immediately once the general tab is active', async () => {
    service.init('abc123', {});
    await vi.advanceTimersByTimeAsync(0);

    expect(qbTorrentsProperties).toHaveBeenCalledWith('server-1', 'abc123');
    expect(service.properties()).toEqual(makeProperties());
  });

  it('polls again after 2 seconds while the general tab stays active', async () => {
    service.init('abc123', {});
    await vi.advanceTimersByTimeAsync(0);
    expect(qbTorrentsProperties).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(2000);
    expect(qbTorrentsProperties).toHaveBeenCalledTimes(2);
  });

  it('stops polling once the general tab is no longer active', async () => {
    service.init('abc123', {});
    await vi.advanceTimersByTimeAsync(0);
    expect(qbTorrentsProperties).toHaveBeenCalledTimes(1);

    service.selectTab('trackers');
    await vi.advanceTimersByTimeAsync(4000);
    expect(qbTorrentsProperties).toHaveBeenCalledTimes(1);
  });

  it('fetches again immediately when switching back to the general tab', async () => {
    service.init('abc123', {});
    await vi.advanceTimersByTimeAsync(0);
    service.selectTab('trackers');
    service.selectTab('general');
    await vi.advanceTimersByTimeAsync(0);

    expect(qbTorrentsProperties).toHaveBeenCalledTimes(2);
  });

  it('does not throw and stops polling after stopAll is called', async () => {
    service.init('abc123', {});
    await vi.advanceTimersByTimeAsync(0);
    service.stopAll();

    await vi.advanceTimersByTimeAsync(4000);
    expect(qbTorrentsProperties).toHaveBeenCalledTimes(1);
  });

  it('logs and does not throw when the fetch fails', async () => {
    qbTorrentsProperties.mockRejectedValueOnce(new Error('boom'));
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

    service.init('abc123', {});
    await vi.advanceTimersByTimeAsync(0);

    expect(consoleError).toHaveBeenCalled();
    expect(service.properties()).toBeNull();
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm run test --workspace=@bitbutler/app -- torrent-details-data.service`
Expected: FAIL - `properties()` stays `null` and `qbTorrentsProperties` is never called, since nothing polls yet.

- [ ] **Step 3: Implement properties polling**

In `torrent-details-data.service.ts`, change the imports to:

```ts
import { DestroyRef, Injectable, Signal, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { EMPTY, Subject, from, switchMap, takeUntil, timer } from 'rxjs';
import { QbTorrentProperties } from '../../../models/qbittorrent.model';
import { Torrent } from '../../../models/torrent.model';
import { QbService } from '../../../services/qb.service';
import { ServerStoreService } from '../../../services/server-store.service';
import { TorrentStoreService } from '../../../services/torrent-store.service';
import { TorrentDetailTabId } from './torrent-details.interface';
```

Add the new injected services and constructor right after `private readonly torrentStoreService = inject(TorrentStoreService);`:

```ts
  private readonly qbService = inject(QbService);
  private readonly serverStoreService = inject(ServerStoreService);
  private readonly destroyRef = inject(DestroyRef);
```

Add a constructor (after the `torrent` computed, before `init`):

```ts
  constructor() {
    toObservable(this.activeTabId)
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
```

Change `protected readonly destroyed$ = new Subject<void>();` to `private readonly destroyed$ = new Subject<void>();` (no longer needs to be `protected` - nothing outside this class touches it; the prior task only declared it that way as a placeholder).

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm run test --workspace=@bitbutler/app -- torrent-details-data.service`
Expected: PASS for all tests in the file.

- [ ] **Step 5: Commit**

```bash
git add packages/app/src/app/components/modals/torrent-details/torrent-details-data.service.ts packages/app/src/app/components/modals/torrent-details/torrent-details-data.service.spec.ts
git commit -m "#183: poll torrent properties only while the general tab is active"
```

---

### Task 3: Trackers fetch, once per activation

**Files:**

- Modify: `packages/app/src/app/components/modals/torrent-details/torrent-details-data.service.ts`
- Test: `packages/app/src/app/components/modals/torrent-details/torrent-details-data.service.spec.ts`

**Interfaces:**

- Consumes: `QbService.torrents.trackers(serverId: string, hash: string): Promise<QbTorrentTracker[]>` (existing, `qb.service.ts:216`).
- Produces: `TorrentDetailsDataService.trackers: Signal<QbTorrentTracker[]>`, `TorrentDetailsDataService.trackersLoading: Signal<boolean>`.

- [ ] **Step 1: Write the failing tests**

Add to the imports in the spec file:

```ts
import { QbTorrentTracker, QbTrackerStatus } from '../../../models/qbittorrent.model';
```

Add `qbTorrentsTrackers: ReturnType<typeof vi.fn>;` next to the other `let` declarations, initialize it in `beforeEach` (`qbTorrentsTrackers = vi.fn().mockResolvedValue([]);`), and add it to the `QbService` mock's `torrents` object:

```ts
        {
          provide: QbService,
          useValue: {
            torrents: { properties: qbTorrentsProperties, trackers: qbTorrentsTrackers },
          },
        },
```

Add a new `describe('trackers fetching', ...)` block at the end of the file:

```ts
describe('trackers fetching', () => {
  const tracker: QbTorrentTracker = {
    url: 'http://tracker.example.com',
    status: QbTrackerStatus.Working,
    tier: 0,
    num_peers: 1,
    num_seeds: 2,
    num_leeches: 3,
    num_downloaded: 4,
    msg: '',
  };

  it('does nothing while the trackers tab is not active', async () => {
    service.init('abc123', {});
    await vi.advanceTimersByTimeAsync(0);
    expect(qbTorrentsTrackers).not.toHaveBeenCalled();
  });

  it('fetches once when the trackers tab becomes active', async () => {
    qbTorrentsTrackers.mockResolvedValue([tracker]);
    service.init('abc123', {});
    service.selectTab('trackers');
    await vi.advanceTimersByTimeAsync(0);

    expect(qbTorrentsTrackers).toHaveBeenCalledWith('server-1', 'abc123');
    expect(service.trackers()).toEqual([tracker]);
    expect(service.trackersLoading()).toBe(false);
  });

  it('does not refetch while the trackers tab stays active', async () => {
    service.init('abc123', {});
    service.selectTab('trackers');
    await vi.advanceTimersByTimeAsync(0);
    await vi.advanceTimersByTimeAsync(5000);

    expect(qbTorrentsTrackers).toHaveBeenCalledTimes(1);
  });

  it('refetches every time the trackers tab is reactivated', async () => {
    service.init('abc123', {});
    service.selectTab('trackers');
    await vi.advanceTimersByTimeAsync(0);
    service.selectTab('general');
    service.selectTab('trackers');
    await vi.advanceTimersByTimeAsync(0);

    expect(qbTorrentsTrackers).toHaveBeenCalledTimes(2);
  });

  it('logs and does not throw when the fetch fails', async () => {
    qbTorrentsTrackers.mockRejectedValueOnce(new Error('boom'));
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

    service.init('abc123', {});
    service.selectTab('trackers');
    await vi.advanceTimersByTimeAsync(0);

    expect(consoleError).toHaveBeenCalled();
    expect(service.trackersLoading()).toBe(false);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm run test --workspace=@bitbutler/app -- torrent-details-data.service`
Expected: FAIL - `service.trackers` is not a function (doesn't exist yet).

- [ ] **Step 3: Implement trackers fetching**

In `torrent-details-data.service.ts`, this reuses the `EMPTY`/`from`/`switchMap`/`takeUntil`/`timer` imports already added in Task 2 - no new RxJS imports needed. Add `QbTorrentTracker` to the model import:

```ts
import { QbTorrentProperties, QbTorrentTracker } from '../../../models/qbittorrent.model';
```

Add two new signals right after `public readonly properties = signal<QbTorrentProperties | null>(null);`:

```ts
  public readonly trackers = signal<QbTorrentTracker[]>([]);
  public readonly trackersLoading = signal(true);
```

In the constructor, add a second subscription right after the properties one:

```ts
toObservable(this.activeTabId)
  .pipe(
    switchMap((id) => (id === 'trackers' ? from(this.fetchTrackers()) : EMPTY)),
    takeUntil(this.destroyed$),
    takeUntilDestroyed(this.destroyRef),
  )
  .subscribe();
```

Add the fetch method after `fetchProperties`:

```ts
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
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm run test --workspace=@bitbutler/app -- torrent-details-data.service`
Expected: PASS for all tests in the file.

- [ ] **Step 5: Commit**

```bash
git add packages/app/src/app/components/modals/torrent-details/torrent-details-data.service.ts packages/app/src/app/components/modals/torrent-details/torrent-details-data.service.spec.ts
git commit -m "#183: fetch trackers once per trackers-tab activation"
```

---

### Task 4: Peers polling, gated to the Peers tab being active

**Files:**

- Modify: `packages/app/src/app/components/modals/torrent-details/torrent-details-data.service.ts`
- Test: `packages/app/src/app/components/modals/torrent-details/torrent-details-data.service.spec.ts`

**Interfaces:**

- Consumes: `QbPollingService.startPeersPolling(serverId: string, hash: string): Observable<QbTorrentPeersResponse>` (existing, `qb-polling.service.ts:128`).
- Produces: `TorrentDetailsDataService.peers: Signal<QbTorrentPeer[]>`, `TorrentDetailsDataService.peersLoading: Signal<boolean>`.

- [ ] **Step 1: Write the failing tests**

Add to the spec file's imports:

```ts
import { Subject } from 'rxjs';
import { QbTorrentPeer, QbTorrentPeersResponse } from '../../../models/torrent.model';
import { QbPollingService } from '../../../services/qb-polling.service';
```

Add `let peersPolling$: Subject<QbTorrentPeersResponse>;` and `let startPeersPolling: ReturnType<typeof vi.fn>;` to the `let` declarations. In `beforeEach`, initialize and provide them:

```ts
peersPolling$ = new Subject<QbTorrentPeersResponse>();
startPeersPolling = vi.fn().mockReturnValue(peersPolling$);
```

Add `{ provide: QbPollingService, useValue: { startPeersPolling } },` to the `providers` array.

Add a new `describe('peers polling', ...)` block at the end of the file:

```ts
describe('peers polling', () => {
  const peer: QbTorrentPeer = {
    ip: '10.0.0.1',
    port: 51413,
    client: 'qBittorrent',
    dl_speed: 0,
    up_speed: 0,
    progress: 0.5,
    downloaded: 0,
    uploaded: 0,
    relevance: 0,
    flags: '',
    flags_desc: '',
    connection: 'BT',
    files: '',
  };

  it('does not poll while the peers tab is not active', () => {
    service.init('abc123', {});
    expect(startPeersPolling).not.toHaveBeenCalled();
  });

  it('starts polling and applies a full_update patch when the peers tab becomes active', () => {
    service.init('abc123', {});
    service.selectTab('peers');

    expect(startPeersPolling).toHaveBeenCalledWith('server-1', 'abc123');

    peersPolling$.next({ rid: 1, full_update: true, peers: { '10.0.0.1:51413': peer } });

    expect(service.peers()).toEqual([peer]);
    expect(service.peersLoading()).toBe(false);
  });

  it('stops listening once the peers tab is no longer active', () => {
    service.init('abc123', {});
    service.selectTab('peers');
    service.selectTab('general');

    peersPolling$.next({ rid: 1, full_update: true, peers: { '10.0.0.1:51413': peer } });

    expect(service.peers()).toEqual([]);
  });

  it('restarts polling with a fresh peer list when reactivated', () => {
    service.init('abc123', {});
    service.selectTab('peers');
    peersPolling$.next({ rid: 1, full_update: true, peers: { '10.0.0.1:51413': peer } });
    expect(service.peers()).toEqual([peer]);

    service.selectTab('general');
    service.selectTab('peers');

    expect(service.peers()).toEqual([]);
    expect(startPeersPolling).toHaveBeenCalledTimes(2);
  });

  it('removes peers listed in peers_removed', () => {
    service.init('abc123', {});
    service.selectTab('peers');
    peersPolling$.next({ rid: 1, full_update: true, peers: { '10.0.0.1:51413': peer } });
    peersPolling$.next({ rid: 2, full_update: false, peers_removed: ['10.0.0.1:51413'] });

    expect(service.peers()).toEqual([]);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm run test --workspace=@bitbutler/app -- torrent-details-data.service`
Expected: FAIL - `service.peers` is not a function.

- [ ] **Step 3: Implement peers polling**

Add to the imports:

```ts
import { QbTorrentPeer, QbTorrentPeersResponse } from '../../../models/torrent.model';
import { QbPollingService } from '../../../services/qb-polling.service';
```

and change `import { EMPTY, Subject, from, switchMap, takeUntil, timer } from 'rxjs';` to also bring in `tap`:

```ts
import { EMPTY, Observable, Subject, from, switchMap, takeUntil, tap, timer } from 'rxjs';
```

Add the injected service:

```ts
  private readonly polling = inject(QbPollingService);
```

Add the new signals next to `trackersLoading`:

```ts
  public readonly peers = signal<QbTorrentPeer[]>([]);
  public readonly peersLoading = signal(true);
  private readonly peerMap = new Map<string, QbTorrentPeer>();
```

Add a third subscription in the constructor:

```ts
toObservable(this.activeTabId)
  .pipe(
    switchMap((id) => (id === 'peers' ? this.peersPoll$() : EMPTY)),
    takeUntil(this.destroyed$),
    takeUntilDestroyed(this.destroyRef),
  )
  .subscribe();
```

Add the poll/apply methods after `fetchTrackers`:

```ts
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
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm run test --workspace=@bitbutler/app -- torrent-details-data.service`
Expected: PASS for all tests in the file.

- [ ] **Step 5: Commit**

```bash
git add packages/app/src/app/components/modals/torrent-details/torrent-details-data.service.ts packages/app/src/app/components/modals/torrent-details/torrent-details-data.service.spec.ts
git commit -m "#183: poll peers only while the peers tab is active"
```

---

### Task 5: Content polling, gated to the Content tab being active

**Files:**

- Modify: `packages/app/src/app/components/modals/torrent-details/torrent-details-data.service.ts`
- Test: `packages/app/src/app/components/modals/torrent-details/torrent-details-data.service.spec.ts`

**Interfaces:**

- Consumes: `QbService.torrents.files(serverId: string, hash: string): Promise<QbTorrentContent[]>` (existing, `qb.service.ts:228`), `ServerSettingsService.load(): Promise<ServerSettings>` where `ServerSettings.polling.foreground: number` (existing).
- Produces: `TorrentDetailsDataService.content: Signal<TorrentFileEntry[]>`, `TorrentDetailsDataService.contentLoading: Signal<boolean>`, `TorrentDetailsDataService.setContent(files: TorrentFileEntry[]): void` (used by Task 12's `Content.onSaved`).

- [ ] **Step 1: Write the failing tests**

Add to the spec file's imports:

```ts
import { TorrentFileEntry } from '@bitbutler/shared';
import { QbTorrentContent, QbTorrentContentPriority } from '../../../models/torrent.model';
import { ServerSettingsService } from '../../../services/server-settings.service';
```

Add `let qbTorrentsFiles: ReturnType<typeof vi.fn>;` and `let serverSettingsLoad: ReturnType<typeof vi.fn>;` to the `let` declarations, initialize in `beforeEach`:

```ts
qbTorrentsFiles = vi.fn().mockResolvedValue([]);
serverSettingsLoad = vi.fn().mockResolvedValue({ polling: { foreground: 5000 } });
```

Add `files: qbTorrentsFiles` to the `QbService` mock's `torrents` object, and add a new provider entry:

```ts
        { provide: ServerSettingsService, useValue: { load: serverSettingsLoad } },
```

Add a new `describe('content polling', ...)` block at the end of the file:

```ts
describe('content polling', () => {
  const file: QbTorrentContent = {
    index: 0,
    name: 'movie.mkv',
    size: 1000,
    progress: 0.25,
    priority: QbTorrentContentPriority.Normal,
    is_seed: false,
    piece_range: [0, 1],
    availability: 1,
  };

  it('does nothing while the content tab is not active', async () => {
    service.init('abc123', {});
    await vi.advanceTimersByTimeAsync(0);
    expect(qbTorrentsFiles).not.toHaveBeenCalled();
  });

  it('fetches and maps files immediately when the content tab becomes active', async () => {
    qbTorrentsFiles.mockResolvedValue([file]);
    service.init('abc123', {});
    service.selectTab('content');
    await vi.advanceTimersByTimeAsync(0);

    expect(qbTorrentsFiles).toHaveBeenCalledWith('server-1', 'abc123');
    expect(service.content()).toEqual([
      {
        length: 1000,
        path: 'movie.mkv',
        priority: QbTorrentContentPriority.Normal,
        progress: 0.25,
        index: 0,
      },
    ]);
    expect(service.contentLoading()).toBe(false);
  });

  it('polls again after the configured foreground interval while active', async () => {
    service.init('abc123', {});
    service.selectTab('content');
    await vi.advanceTimersByTimeAsync(0);
    expect(qbTorrentsFiles).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(5000);
    expect(qbTorrentsFiles).toHaveBeenCalledTimes(2);
  });

  it('stops polling once the content tab is no longer active', async () => {
    service.init('abc123', {});
    service.selectTab('content');
    await vi.advanceTimersByTimeAsync(0);
    service.selectTab('general');

    await vi.advanceTimersByTimeAsync(5000);
    expect(qbTorrentsFiles).toHaveBeenCalledTimes(1);
  });

  it('logs and does not toast when the fetch fails', async () => {
    qbTorrentsFiles.mockRejectedValueOnce(new Error('boom'));
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

    service.init('abc123', {});
    service.selectTab('content');
    await vi.advanceTimersByTimeAsync(0);

    expect(consoleError).toHaveBeenCalled();
    expect(service.contentLoading()).toBe(false);
  });

  describe('setContent', () => {
    it('overwrites the content signal optimistically', () => {
      service.init('abc123', {});
      const files: TorrentFileEntry[] = [{ path: 'a.txt', length: 1, index: 0 }];
      service.setContent(files);
      expect(service.content()).toEqual(files);
    });
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm run test --workspace=@bitbutler/app -- torrent-details-data.service`
Expected: FAIL - `service.content` is not a function.

- [ ] **Step 3: Implement content polling**

Add to the imports:

```ts
import { TorrentFileEntry } from '@bitbutler/shared';
import { QbTorrentContent } from '../../../models/torrent.model';
import { ServerSettingsService } from '../../../services/server-settings.service';
```

Add the injected service:

```ts
  private readonly serverSettingsService = inject(ServerSettingsService);
```

Add the new signals:

```ts
  public readonly content = signal<TorrentFileEntry[]>([]);
  public readonly contentLoading = signal(true);
```

Add a fourth subscription in the constructor:

```ts
toObservable(this.activeTabId)
  .pipe(
    switchMap((id) => (id === 'content' ? this.contentPoll$() : EMPTY)),
    takeUntil(this.destroyed$),
    takeUntilDestroyed(this.destroyRef),
  )
  .subscribe();
```

Add the poll/fetch methods and `setContent`:

```ts
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
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm run test --workspace=@bitbutler/app -- torrent-details-data.service`
Expected: PASS for all tests in the file.

- [ ] **Step 5: Commit**

```bash
git add packages/app/src/app/components/modals/torrent-details/torrent-details-data.service.ts packages/app/src/app/components/modals/torrent-details/torrent-details-data.service.spec.ts
git commit -m "#183: poll torrent content only while the content tab is active"
```

---

### Task 6: localPath, singleFile, and errorLog

**Files:**

- Modify: `packages/app/src/app/components/modals/torrent-details/torrent-details-data.service.ts`
- Test: `packages/app/src/app/components/modals/torrent-details/torrent-details-data.service.spec.ts`

**Interfaces:**

- Consumes: `PathService.resolveLocalPath(remotePath: string | null | undefined): Promise<string | null>` (existing, `path.service.ts:17`), `QbService.log.main(serverId, opts): Promise<QbLogEntry[]>` (existing), `QbService.torrents.files` (already consumed in Task 5, reused here for `singleFile`).
- Produces: `TorrentDetailsDataService.localPath: Signal<string | null>`, `TorrentDetailsDataService.singleFile: Signal<boolean>`, `TorrentDetailsDataService.errorLog: Signal<QbLogEntry | null>`.

- [ ] **Step 1: Write the failing tests**

Add to the spec file's imports:

```ts
import { QbLogEntry, QbLogMessageType } from '../../../models/qbittorrent.model';
import { PathService } from '../../../services/path.service';
```

Add `let qbLogMain: ReturnType<typeof vi.fn>;` and `let resolveLocalPath: ReturnType<typeof vi.fn>;` to the `let` declarations, initialize in `beforeEach`:

```ts
qbLogMain = vi.fn().mockResolvedValue([]);
resolveLocalPath = vi.fn().mockResolvedValue(null);
```

Add `log: { main: qbLogMain }` to the `QbService` mock (alongside `torrents: {...}`), and add a new provider:

```ts
        { provide: PathService, useValue: { resolveLocalPath } },
```

Add a `makeLogEntry` helper next to `makeProperties`:

```ts
const makeLogEntry = (overrides: Partial<QbLogEntry> = {}): QbLogEntry => ({
  id: 1,
  message:
    'File error alert. Torrent: "My Torrent". File: "/path". Reason: "x error: Permission denied"',
  timestamp: 1700000000,
  type: QbLogMessageType.Warning,
  ...overrides,
});
```

Add a new `describe('singleFile', ...)`, `describe('localPath', ...)`, and `describe('errorLog', ...)` block at the end of the file:

```ts
describe('singleFile', () => {
  it('starts as false', () => {
    expect(service.singleFile()).toBe(false);
  });

  it('becomes true when the torrent has exactly one file', async () => {
    qbTorrentsFiles.mockResolvedValue([
      {
        index: 0,
        name: 'a.iso',
        size: 1,
        progress: 1,
        priority: 1,
        is_seed: true,
        piece_range: [0, 0],
        availability: 1,
      },
    ]);
    service.init('abc123', {});
    await vi.advanceTimersByTimeAsync(0);

    expect(service.singleFile()).toBe(true);
  });

  it('stays false when the torrent has multiple files', async () => {
    qbTorrentsFiles.mockResolvedValue([
      {
        index: 0,
        name: 'a.iso',
        size: 1,
        progress: 1,
        priority: 1,
        is_seed: true,
        piece_range: [0, 0],
        availability: 1,
      },
      {
        index: 1,
        name: 'b.iso',
        size: 1,
        progress: 1,
        priority: 1,
        is_seed: true,
        piece_range: [0, 0],
        availability: 1,
      },
    ]);
    service.init('abc123', {});
    await vi.advanceTimersByTimeAsync(0);

    expect(service.singleFile()).toBe(false);
  });

  it('logs and does not throw when the files fetch fails', async () => {
    qbTorrentsFiles.mockRejectedValueOnce(new Error('boom'));
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

    service.init('abc123', {});
    await vi.advanceTimersByTimeAsync(0);

    expect(consoleError).toHaveBeenCalled();
    expect(service.singleFile()).toBe(false);
  });
});

describe('localPath', () => {
  it('resolves the local path once the torrent has a content_path', async () => {
    resolveLocalPath.mockResolvedValue('/local/path');
    service.init('abc123', {});
    torrentsMap.set(new Map([['abc123', makeTorrent({ content_path: '/remote/path' })]]));
    qbTorrentsProperties.mockResolvedValue(makeProperties());
    await vi.advanceTimersByTimeAsync(0);

    expect(resolveLocalPath).toHaveBeenCalledWith('/remote/path');
    expect(service.localPath()).toBe('/local/path');
  });

  it('stays null when there is no content_path yet', () => {
    service.init('abc123', {});
    expect(service.localPath()).toBeNull();
    expect(resolveLocalPath).not.toHaveBeenCalled();
  });
});

describe('errorLog', () => {
  it('does nothing when the torrent is not in the error state', async () => {
    service.init('abc123', {});
    torrentsMap.set(new Map([['abc123', makeTorrent({ state: 'downloading' })]]));
    await vi.advanceTimersByTimeAsync(0);

    expect(qbLogMain).not.toHaveBeenCalled();
    expect(service.errorLog()).toBeNull();
  });

  it('fetches the main log and stores the matching warning/critical entry when the torrent errors', async () => {
    const matching = makeLogEntry({ id: 5, type: QbLogMessageType.Critical });
    qbLogMain.mockResolvedValue([matching]);

    service.init('abc123', {});
    torrentsMap.set(new Map([['abc123', makeTorrent({ state: 'error', name: 'My Torrent' })]]));
    await vi.advanceTimersByTimeAsync(0);

    expect(qbLogMain).toHaveBeenCalledWith('server-1', {
      normal: false,
      info: false,
      warning: true,
      critical: true,
    });
    expect(service.errorLog()?.id).toBe(5);
  });

  it('does not refetch while the torrent stays in the error state with no match', async () => {
    qbLogMain.mockResolvedValue([
      makeLogEntry({ message: 'Unrelated torrent message', type: QbLogMessageType.Critical }),
    ]);

    service.init('abc123', {});
    torrentsMap.set(new Map([['abc123', makeTorrent({ state: 'error', name: 'My Torrent' })]]));
    await vi.advanceTimersByTimeAsync(0);
    expect(qbLogMain).toHaveBeenCalledTimes(1);

    torrentsMap.set(new Map([['abc123', makeTorrent({ state: 'error', name: 'My Torrent' })]]));
    await vi.advanceTimersByTimeAsync(0);
    expect(qbLogMain).toHaveBeenCalledTimes(1);
  });

  it('clears errorLog and refetches on the next error episode after leaving the error state', async () => {
    qbLogMain.mockResolvedValue([makeLogEntry({ id: 1, type: QbLogMessageType.Critical })]);
    service.init('abc123', {});
    torrentsMap.set(new Map([['abc123', makeTorrent({ state: 'error', name: 'My Torrent' })]]));
    await vi.advanceTimersByTimeAsync(0);
    expect(service.errorLog()?.id).toBe(1);

    torrentsMap.set(new Map([['abc123', makeTorrent({ state: 'downloading' })]]));
    await vi.advanceTimersByTimeAsync(0);
    expect(service.errorLog()).toBeNull();

    qbLogMain.mockResolvedValue([makeLogEntry({ id: 2, type: QbLogMessageType.Critical })]);
    torrentsMap.set(new Map([['abc123', makeTorrent({ state: 'error', name: 'My Torrent' })]]));
    await vi.advanceTimersByTimeAsync(0);

    expect(qbLogMain).toHaveBeenCalledTimes(2);
    expect(service.errorLog()?.id).toBe(2);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm run test --workspace=@bitbutler/app -- torrent-details-data.service`
Expected: FAIL - `service.localPath`/`service.singleFile`/`service.errorLog` are not functions.

- [ ] **Step 3: Implement localPath, singleFile, and errorLog**

Add to the imports:

```ts
import {
  QbLogEntry,
  QbLogMessageType,
  QbTorrentProperties,
  QbTorrentTracker,
} from '../../../models/qbittorrent.model';
import { PathService } from '../../../services/path.service';
```

and add `effect` to the `@angular/core` import:

```ts
import { DestroyRef, Injectable, Signal, computed, effect, inject, signal } from '@angular/core';
```

Add the injected service:

```ts
  private readonly pathService = inject(PathService);
```

Add the new signals next to `contentLoading`:

```ts
  public readonly localPath = signal<string | null>(null);
  public readonly singleFile = signal(false);
  public readonly errorLog = signal<QbLogEntry | null>(null);
```

Add two `effect()` calls at the end of the constructor (after the 4 `toObservable(...).subscribe()` blocks from Tasks 2-5):

```ts
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
```

Change `init` to also kick off the one-off `singleFile` fetch:

```ts
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
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm run test --workspace=@bitbutler/app -- torrent-details-data.service`
Expected: PASS for all tests in the file.

- [ ] **Step 5: Commit**

```bash
git add packages/app/src/app/components/modals/torrent-details/torrent-details-data.service.ts packages/app/src/app/components/modals/torrent-details/torrent-details-data.service.spec.ts
git commit -m "#183: relocate localPath, singleFile, and errorLog onto TorrentDetailsDataService"
```

---

### Task 7: `TorrentDetailsActionsService`

**Files:**

- Create: `packages/app/src/app/components/modals/torrent-details/torrent-details-actions.service.ts`
- Test: `packages/app/src/app/components/modals/torrent-details/torrent-details-actions.service.spec.ts`

**Interfaces:**

- Consumes: `TorrentDetailsDataService.hash()`/`.torrent()`/`.content()`/`.setContent()` (from Tasks 1-6), `CommandBusService.emit(cmd: AppCommand): void` (existing), `QbService.torrents.{resume,pause,setForceStart,clearCategory,removeTags,reannounce,renameFile,filePrio}` (existing).
- Produces: `TorrentDetailsActionsService` with methods `rename()`, `setLocation()`, `openPath()`, `changeCategory()`, `removeCategory(): Promise<void>`, `changeTags()`, `removeAllTags(): Promise<void>`, `resume(): Promise<void>`, `pause(): Promise<void>`, `forceResume(): Promise<void>`, `openTransferLimitsModal()`, `openShareLimitsModal()`, `forceReannounce(): Promise<void>`, `deleteTorrent()`, `saveFileChanges(event: FileTreeSaveEvent, originalContent: TorrentFileEntry[]): Promise<void>`. Consumed by Task 8 (footer), Task 9 (General no longer needs these - confirms removal), and Task 12 (Content's `onSaved`).

- [ ] **Step 1: Write the failing tests**

Create `packages/app/src/app/components/modals/torrent-details/torrent-details-actions.service.spec.ts`:

```ts
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Torrent } from '../../../models/torrent.model';
import { CommandBusService } from '../../../services/command-bus.service';
import { QbService } from '../../../services/qb.service';
import { ServerStoreService } from '../../../services/server-store.service';
import { ToastService } from '../../../services/toast.service';
import { TorrentDetailsActionsService } from './torrent-details-actions.service';
import { MergedTorrent, TorrentDetailsDataService } from './torrent-details-data.service';

const makeTorrent = (overrides: Partial<Torrent> = {}): Torrent => ({
  added_on: 1700000000,
  amount_left: 0,
  auto_tmm: false,
  availability: 0,
  category: '',
  completed: 0,
  completion_on: 0,
  content_path: '',
  dl_limit: 0,
  dlspeed: 0,
  download_path: '',
  downloaded: 0,
  downloaded_session: 0,
  eta: 0,
  f_l_piece_prio: false,
  force_start: false,
  hash: 'abc123',
  inactive_seeding_time_limit: 0,
  infohash_v1: '',
  infohash_v2: '',
  last_activity: 0,
  magnet_uri: '',
  max_inactive_seeding_time: 0,
  max_ratio: 0,
  max_seeding_time: 0,
  name: 'My Torrent',
  num_complete: 0,
  num_incomplete: 0,
  num_leechs: 0,
  num_seeds: 0,
  priority: 0,
  progress: 0,
  ratio: 0,
  ratio_limit: 0,
  save_path: '',
  seeding_time: 0,
  seeding_time_limit: 0,
  seen_complete: 0,
  seq_dl: false,
  size: 0,
  state: 'downloading',
  super_seeding: false,
  tags: 'a, b',
  time_active: 0,
  total_size: 0,
  tracker: '',
  trackers_count: 0,
  up_limit: 0,
  uploaded: 0,
  uploaded_session: 0,
  upspeed: 0,
  ...overrides,
});

describe('TorrentDetailsActionsService', () => {
  let service: TorrentDetailsActionsService;
  let mockDataService: {
    hash: ReturnType<typeof vi.fn>;
    torrent: ReturnType<typeof signal<MergedTorrent | null>>;
  };
  let qbTorrents: Record<string, ReturnType<typeof vi.fn>>;
  let commandBusEmit: ReturnType<typeof vi.fn>;
  let toastInfo: ReturnType<typeof vi.fn>;
  let toastDanger: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    const torrentSignal = signal<MergedTorrent | null>({
      data: makeTorrent(),
      properties: {} as any,
    });

    mockDataService = {
      hash: vi.fn().mockReturnValue('abc123'),
      torrent: torrentSignal,
    };

    qbTorrents = {
      resume: vi.fn().mockResolvedValue(undefined),
      pause: vi.fn().mockResolvedValue(undefined),
      setForceStart: vi.fn().mockResolvedValue(undefined),
      clearCategory: vi.fn().mockResolvedValue(undefined),
      removeTags: vi.fn().mockResolvedValue(undefined),
      reannounce: vi.fn().mockResolvedValue(undefined),
      renameFile: vi.fn().mockResolvedValue(undefined),
      filePrio: vi.fn().mockResolvedValue(undefined),
    };

    commandBusEmit = vi.fn();
    toastInfo = vi.fn();
    toastDanger = vi.fn();

    TestBed.configureTestingModule({
      providers: [
        TorrentDetailsActionsService,
        { provide: TorrentDetailsDataService, useValue: mockDataService },
        { provide: ServerStoreService, useValue: { currentServerId: signal('server-1') } },
        { provide: QbService, useValue: { torrents: qbTorrents } },
        { provide: CommandBusService, useValue: { emit: commandBusEmit } },
        { provide: ToastService, useValue: { info: toastInfo, danger: toastDanger } },
      ],
    });

    service = TestBed.inject(TorrentDetailsActionsService);
  });

  describe('rename', () => {
    it('emits UI_RENAME_TORRENT with the current torrent', () => {
      service.rename();
      expect(commandBusEmit).toHaveBeenCalledWith({
        type: 'UI_RENAME_TORRENT',
        torrent: mockDataService.torrent()!.data,
      });
    });
  });

  describe('setLocation', () => {
    it('emits UI_SET_TORRENT_LOCATION with the current torrent and hash', () => {
      service.setLocation();
      expect(commandBusEmit).toHaveBeenCalledWith({
        type: 'UI_SET_TORRENT_LOCATION',
        torrent: mockDataService.torrent()!.data,
        hashes: ['abc123'],
      });
    });
  });

  describe('openPath', () => {
    it('emits UI_OPEN_DESTINATION when there is a content_path', () => {
      mockDataService.torrent.set({
        data: makeTorrent({ content_path: '/remote/path' }),
        properties: {} as any,
      });
      service.openPath();
      expect(commandBusEmit).toHaveBeenCalledWith({
        type: 'UI_OPEN_DESTINATION',
        remotePath: '/remote/path',
        hash: 'abc123',
      });
    });

    it('shows a danger toast when there is no content_path', () => {
      mockDataService.torrent.set({
        data: makeTorrent({ content_path: '' }),
        properties: {} as any,
      });
      service.openPath();
      expect(toastDanger).toHaveBeenCalledWith(
        'components.modals.torrent-details.general.toast.local-path-failed',
      );
      expect(commandBusEmit).not.toHaveBeenCalled();
    });
  });

  describe('changeCategory', () => {
    it('emits UI_SET_TORRENT_CATEGORY', () => {
      service.changeCategory();
      expect(commandBusEmit).toHaveBeenCalledWith({
        type: 'UI_SET_TORRENT_CATEGORY',
        torrent: mockDataService.torrent()!.data,
        hashes: ['abc123'],
      });
    });
  });

  describe('removeCategory', () => {
    it('shows an info toast and clears the category', async () => {
      await service.removeCategory();
      expect(toastInfo).toHaveBeenCalledWith(
        'components.modals.torrent-details.general.toast.removing-category',
      );
      expect(qbTorrents.clearCategory).toHaveBeenCalledWith('server-1', ['abc123']);
    });

    it('shows a danger toast when clearing the category fails', async () => {
      qbTorrents.clearCategory.mockRejectedValueOnce(new Error('boom'));
      await service.removeCategory();
      expect(toastDanger).toHaveBeenCalledWith(
        'boom',
        'components.modals.torrent-details.general.toast.remove-category-failed',
      );
    });
  });

  describe('changeTags', () => {
    it('emits UI_SET_TORRENT_TAGS', () => {
      service.changeTags();
      expect(commandBusEmit).toHaveBeenCalledWith({
        type: 'UI_SET_TORRENT_TAGS',
        torrent: mockDataService.torrent()!.data,
        hashes: ['abc123'],
      });
    });
  });

  describe('removeAllTags', () => {
    it('removes the parsed tag list', async () => {
      await service.removeAllTags();
      expect(toastInfo).toHaveBeenCalledWith(
        'components.modals.torrent-details.general.toast.removing-all-tags',
      );
      expect(qbTorrents.removeTags).toHaveBeenCalledWith('server-1', ['abc123'], ['a', 'b']);
    });
  });

  describe('resume', () => {
    it('shows an info toast and resumes the torrent', async () => {
      await service.resume();
      expect(toastInfo).toHaveBeenCalledWith(
        'components.modals.torrent-details.general.toast.resuming',
      );
      expect(qbTorrents.resume).toHaveBeenCalledWith('server-1', ['abc123']);
    });

    it('shows a danger toast when resuming fails', async () => {
      qbTorrents.resume.mockRejectedValueOnce(new Error('boom'));
      await service.resume();
      expect(toastDanger).toHaveBeenCalledWith(
        'boom',
        'components.modals.torrent-details.general.toast.resume-failed',
      );
    });
  });

  describe('pause', () => {
    it('shows an info toast and pauses the torrent', async () => {
      await service.pause();
      expect(qbTorrents.pause).toHaveBeenCalledWith('server-1', ['abc123']);
    });
  });

  describe('forceResume', () => {
    it('shows an info toast and force-resumes the torrent', async () => {
      await service.forceResume();
      expect(qbTorrents.setForceStart).toHaveBeenCalledWith('server-1', ['abc123'], true);
    });
  });

  describe('openTransferLimitsModal', () => {
    it('emits UI_LIMIT_TRANSFER targeting the torrent', () => {
      service.openTransferLimitsModal();
      expect(commandBusEmit).toHaveBeenCalledWith({
        type: 'UI_LIMIT_TRANSFER',
        target: 'torrent',
        hashes: ['abc123'],
      });
    });
  });

  describe('openShareLimitsModal', () => {
    it('emits UI_LIMIT_SHARE targeting the torrent', () => {
      service.openShareLimitsModal();
      expect(commandBusEmit).toHaveBeenCalledWith({
        type: 'UI_LIMIT_SHARE',
        target: 'torrent',
        hashes: ['abc123'],
      });
    });
  });

  describe('forceReannounce', () => {
    it('shows an info toast and reannounces the torrent', async () => {
      await service.forceReannounce();
      expect(qbTorrents.reannounce).toHaveBeenCalledWith('server-1', ['abc123']);
    });
  });

  describe('deleteTorrent', () => {
    it('emits UI_TORRENT_DELETE_REQUEST with the hash of the torrent being viewed', () => {
      service.deleteTorrent();
      expect(commandBusEmit).toHaveBeenCalledWith({
        type: 'UI_TORRENT_DELETE_REQUEST',
        hashes: ['abc123'],
      });
    });
  });

  describe('saveFileChanges', () => {
    it('renames files and updates priorities that changed', async () => {
      const originalContent = [
        { path: 'old.txt', length: 1, index: 0, priority: 1 },
        { path: 'b.txt', length: 1, index: 1, priority: 1 },
      ];
      const event = {
        files: [
          { path: 'new.txt', length: 1, index: 0, priority: 1 },
          { path: 'b.txt', length: 1, index: 1, priority: 0 },
        ],
        renames: [{ oldPath: 'old.txt', newPath: 'new.txt' }],
      };

      await service.saveFileChanges(event, originalContent);

      expect(qbTorrents.renameFile).toHaveBeenCalledWith(
        'server-1',
        'abc123',
        'old.txt',
        'new.txt',
      );
      expect(qbTorrents.filePrio).toHaveBeenCalledWith('server-1', 'abc123', [1], 0);
      expect(qbTorrents.filePrio).not.toHaveBeenCalledWith(
        'server-1',
        'abc123',
        [0],
        expect.anything(),
      );
    });

    it('shows a danger toast when a rename fails', async () => {
      qbTorrents.renameFile.mockRejectedValueOnce(new Error('boom'));
      await service.saveFileChanges({ files: [], renames: [{ oldPath: 'a', newPath: 'b' }] }, []);
      expect(toastDanger).toHaveBeenCalledWith(
        'boom',
        'components.modals.torrent-details.content.error.failed-to-save-title',
      );
    });
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run test --workspace=@bitbutler/app -- torrent-details-actions.service`
Expected: FAIL - `Cannot find module './torrent-details-actions.service'`.

- [ ] **Step 3: Write the implementation**

Create `packages/app/src/app/components/modals/torrent-details/torrent-details-actions.service.ts`:

```ts
import { Injectable, inject } from '@angular/core';
import { TorrentFileEntry } from '@bitbutler/shared';
import { TranslateService } from '@ngx-translate/core';
import { CommandBusService } from '../../../services/command-bus.service';
import { QbService } from '../../../services/qb.service';
import { ServerStoreService } from '../../../services/server-store.service';
import { ToastService } from '../../../services/toast.service';
import { FileTreeSaveEvent } from '../../bb-file-tree/bb-file-tree';
import { TorrentDetailsDataService } from './torrent-details-data.service';

@Injectable()
export class TorrentDetailsActionsService {
  private readonly dataService = inject(TorrentDetailsDataService);
  private readonly qbService = inject(QbService);
  private readonly serverStoreService = inject(ServerStoreService);
  private readonly commandBusService = inject(CommandBusService);
  private readonly toastService = inject(ToastService);
  private readonly translateService = inject(TranslateService);

  public rename(): void {
    this.commandBusService.emit({
      type: 'UI_RENAME_TORRENT',
      torrent: this.dataService.torrent()!.data,
    });
  }

  public setLocation(): void {
    this.commandBusService.emit({
      type: 'UI_SET_TORRENT_LOCATION',
      torrent: this.dataService.torrent()!.data,
      hashes: [this.dataService.hash()],
    });
  }

  public openPath(): void {
    const remotePath = this.dataService.torrent()?.data.content_path;
    const hash = this.dataService.hash();

    if (!remotePath) {
      this.toastService.danger(
        this.translateService.instant(
          'components.modals.torrent-details.general.toast.local-path-failed',
        ),
      );
      return;
    }

    this.commandBusService.emit({ type: 'UI_OPEN_DESTINATION', remotePath, hash });
  }

  public changeCategory(): void {
    this.commandBusService.emit({
      type: 'UI_SET_TORRENT_CATEGORY',
      torrent: this.dataService.torrent()!.data,
      hashes: [this.dataService.hash()],
    });
  }

  public async removeCategory(): Promise<void> {
    this.toastService.info(
      this.translateService.instant(
        'components.modals.torrent-details.general.toast.removing-category',
      ),
    );
    try {
      await this.qbService.torrents.clearCategory(
        this.serverStoreService.currentServerId() as string,
        [this.dataService.hash()],
      );
    } catch (error: any) {
      this.toastService.danger(
        error?.message ?? String(error),
        this.translateService.instant(
          'components.modals.torrent-details.general.toast.remove-category-failed',
        ),
      );
    }
  }

  public changeTags(): void {
    this.commandBusService.emit({
      type: 'UI_SET_TORRENT_TAGS',
      torrent: this.dataService.torrent()!.data,
      hashes: [this.dataService.hash()],
    });
  }

  public async removeAllTags(): Promise<void> {
    this.toastService.info(
      this.translateService.instant(
        'components.modals.torrent-details.general.toast.removing-all-tags',
      ),
    );
    try {
      await this.qbService.torrents.removeTags(
        this.serverStoreService.currentServerId() as string,
        [this.dataService.hash()],
        this.dataService
          .torrent()!
          .data.tags.split(',')
          .map((t) => t.trim()),
      );
    } catch (error: any) {
      this.toastService.danger(
        error?.message ?? String(error),
        this.translateService.instant(
          'components.modals.torrent-details.general.toast.remove-all-tags-failed',
        ),
      );
    }
  }

  public async resume(): Promise<void> {
    this.toastService.info(
      this.translateService.instant('components.modals.torrent-details.general.toast.resuming'),
    );
    try {
      await this.qbService.torrents.resume(this.serverStoreService.currentServerId() as string, [
        this.dataService.hash(),
      ]);
    } catch (error: any) {
      this.toastService.danger(
        error?.message ?? String(error),
        this.translateService.instant(
          'components.modals.torrent-details.general.toast.resume-failed',
        ),
      );
    }
  }

  public async pause(): Promise<void> {
    this.toastService.info(
      this.translateService.instant('components.modals.torrent-details.general.toast.pausing'),
    );
    try {
      await this.qbService.torrents.pause(this.serverStoreService.currentServerId() as string, [
        this.dataService.hash(),
      ]);
    } catch (error: any) {
      this.toastService.danger(
        error?.message ?? String(error),
        this.translateService.instant(
          'components.modals.torrent-details.general.toast.pause-failed',
        ),
      );
    }
  }

  public async forceResume(): Promise<void> {
    this.toastService.info(
      this.translateService.instant(
        'components.modals.torrent-details.general.toast.force-resuming',
      ),
    );
    try {
      await this.qbService.torrents.setForceStart(
        this.serverStoreService.currentServerId() as string,
        [this.dataService.hash()],
        true,
      );
    } catch (error: any) {
      this.toastService.danger(
        error?.message ?? String(error),
        this.translateService.instant(
          'components.modals.torrent-details.general.toast.force-resume-failed',
        ),
      );
    }
  }

  public openTransferLimitsModal(): void {
    this.commandBusService.emit({
      type: 'UI_LIMIT_TRANSFER',
      target: 'torrent',
      hashes: [this.dataService.hash()],
    });
  }

  public openShareLimitsModal(): void {
    this.commandBusService.emit({
      type: 'UI_LIMIT_SHARE',
      target: 'torrent',
      hashes: [this.dataService.hash()],
    });
  }

  public async forceReannounce(): Promise<void> {
    this.toastService.info(
      this.translateService.instant('components.modals.torrent-details.general.toast.reannouncing'),
    );
    try {
      await this.qbService.torrents.reannounce(
        this.serverStoreService.currentServerId() as string,
        [this.dataService.hash()],
      );
    } catch (error: any) {
      this.toastService.danger(
        error?.message ?? String(error),
        this.translateService.instant(
          'components.modals.torrent-details.general.toast.reannounce-failed',
        ),
      );
    }
  }

  public deleteTorrent(): void {
    this.commandBusService.emit({
      type: 'UI_TORRENT_DELETE_REQUEST',
      hashes: [this.dataService.hash()],
    });
  }

  public async saveFileChanges(
    event: FileTreeSaveEvent,
    originalContent: TorrentFileEntry[],
  ): Promise<void> {
    const serverId = this.serverStoreService.currentServerId();
    if (!serverId) return;

    const hash = this.dataService.hash();

    try {
      for (const item of event.renames) {
        await this.qbService.torrents.renameFile(serverId, hash, item.oldPath, item.newPath);
      }

      for (const file of event.files) {
        if (file.index === undefined) continue;
        const original = originalContent.find((f) => f.index === file.index);
        if (original && original.priority !== file.priority) {
          await this.qbService.torrents.filePrio(serverId, hash, [file.index], file.priority ?? 0);
        }
      }
    } catch (e: any) {
      console.error(
        TorrentDetailsActionsService.name,
        'saveFileChanges',
        'Failed to save changes',
        e,
      );
      this.toastService.danger(
        e?.message ?? String(e),
        this.translateService.instant(
          'components.modals.torrent-details.content.error.failed-to-save-title',
        ),
      );
    }
  }
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm run test --workspace=@bitbutler/app -- torrent-details-actions.service`
Expected: PASS for all tests in the file.

- [ ] **Step 5: Commit**

```bash
git add packages/app/src/app/components/modals/torrent-details/torrent-details-actions.service.ts packages/app/src/app/components/modals/torrent-details/torrent-details-actions.service.spec.ts
git commit -m "#183: add TorrentDetailsActionsService"
```

---

### Task 8: Wire both services into `TorrentDetails`, drop tab inputs, simplify delete teardown

**Files:**

- Modify: `packages/app/src/app/components/modals/torrent-details/torrent-details.interface.ts`
- Modify: `packages/app/src/app/components/modals/torrent-details/torrent-details.ts`
- Modify: `packages/app/src/app/components/modals/torrent-details/torrent-details.html`
- Modify: `packages/app/src/app/components/modals/torrent-details/torrent-details.spec.ts`

**Interfaces:**

- Consumes: `TorrentDetailsDataService` (Tasks 1-6), `TorrentDetailsActionsService` (Task 7).
- Produces: `TorrentDetailTabComponent` becomes an empty interface (consumed by Tasks 9-12, which drop `hash`/`context` inputs from every tab). `TorrentDetails.dataService`/`.actionsService` become public properties (consumed by Task 13's footer template).

- [ ] **Step 1: Update `torrent-details.interface.ts`**

Replace the whole file:

```ts
import { Type } from '@angular/core';

export type TorrentDetailTabId = 'general' | 'trackers' | 'peers' | 'content';

export interface Tab {
  id: TorrentDetailTabId;
  label: string;
  loadComponent: () => Promise<Type<TorrentDetailTabComponent>>;
}

export interface TorrentDetailTabComponent {}
```

- [ ] **Step 2: Write the failing tests**

Replace `packages/app/src/app/components/modals/torrent-details/torrent-details.spec.ts` entirely:

```ts
import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { Subject } from 'rxjs';
import { CommandBusService } from '../../../services/command-bus.service';
import { ConfirmService } from '../../../services/confirm.service';
import { ModalGuardService } from '../../../services/modal-guard.service';
import { TorrentStoreService } from '../../../services/torrent-store.service';
import { TorrentDetails } from './torrent-details';
import { TorrentDetailsActionsService } from './torrent-details-actions.service';
import { TorrentDetailsDataService } from './torrent-details-data.service';

describe('TorrentDetails', () => {
  let component: TorrentDetails;
  let fixture: ComponentFixture<TorrentDetails>;
  let mockActiveModal: Partial<NgbActiveModal>;
  let commands$: Subject<any>;
  let mockDataService: {
    activeTabId: ReturnType<typeof signal<any>>;
    selectTab: ReturnType<typeof vi.fn>;
    init: ReturnType<typeof vi.fn>;
    stopAll: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    mockActiveModal = { close: vi.fn(), dismiss: vi.fn() };
    commands$ = new Subject();
    const activeTabIdSignal = signal<any>('general');
    mockDataService = {
      activeTabId: activeTabIdSignal,
      selectTab: vi.fn((id: any) => activeTabIdSignal.set(id)),
      init: vi.fn(),
      stopAll: vi.fn(),
    };

    await TestBed.configureTestingModule({
      imports: [TorrentDetails],
      providers: [
        { provide: NgbActiveModal, useValue: mockActiveModal },
        { provide: TorrentStoreService, useValue: { torrentsMap: signal(new Map()) } },
        {
          provide: CommandBusService,
          useValue: { commands$: commands$.asObservable(), emit: vi.fn() },
        },
        { provide: ConfirmService, useValue: { confirm: vi.fn().mockResolvedValue(true) } },
      ],
    })
      .overrideComponent(TorrentDetails, {
        set: {
          providers: [
            ModalGuardService,
            { provide: TorrentDetailsDataService, useValue: mockDataService },
            { provide: TorrentDetailsActionsService, useValue: {} },
          ],
        },
      })
      .compileComponents();

    fixture = TestBed.createComponent(TorrentDetails);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should have 4 tabs defined', () => {
    expect(component.tabs).toHaveLength(4);
  });

  it('should default to the general tab', () => {
    expect(component.activeTabId()).toBe('general');
  });

  describe('selectTab', () => {
    it('delegates to the data service and reflects the change', () => {
      component.selectTab('trackers');
      expect(mockDataService.selectTab).toHaveBeenCalledWith('trackers');
      expect(component.activeTabId()).toBe('trackers');
    });
  });

  describe('torrent computed', () => {
    it('should return null when no hash is set', () => {
      fixture.componentRef.setInput('hash', null);
      expect(component.torrent()).toBeNull();
    });
  });

  describe('ngOnInit', () => {
    it('initializes the data service with the hash and context inputs', async () => {
      fixture.componentRef.setInput('hash', 'abc123');
      fixture.componentRef.setInput('context', { editMode: true });
      await component.ngOnInit();
      expect(mockDataService.init).toHaveBeenCalledWith('abc123', { editMode: true });
    });

    it('selects the tabToOpen input on the data service', async () => {
      fixture.componentRef.setInput('tabToOpen', 'content');
      await component.ngOnInit();
      expect(mockDataService.selectTab).toHaveBeenCalledWith('content');
    });
  });

  describe('canDeactivate', () => {
    it('should return true without confirmation when guard is not dirty', async () => {
      component.guardService.isDirty.set(false);
      const result = await component.canDeactivate();
      expect(result).toBe(true);
    });
  });

  describe('TORRENT_DELETED handling', () => {
    it('stops the data service and closes the modal when this torrent is deleted', async () => {
      fixture.componentRef.setInput('hash', 'abc123');
      await component.ngOnInit();

      commands$.next({ type: 'TORRENT_DELETED', hash: 'abc123' });

      expect(mockDataService.stopAll).toHaveBeenCalled();
      expect(mockActiveModal.close).toHaveBeenCalled();
    });

    it('ignores TORRENT_DELETED events for a different hash', async () => {
      fixture.componentRef.setInput('hash', 'abc123');
      await component.ngOnInit();

      commands$.next({ type: 'TORRENT_DELETED', hash: 'other-hash' });

      expect(mockDataService.stopAll).not.toHaveBeenCalled();
      expect(mockActiveModal.close).not.toHaveBeenCalled();
    });
  });
});
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `npm run test --workspace=@bitbutler/app -- torrent-details.spec`
Expected: FAIL - `component.activeTabId` is still the component's own local signal (not delegating to the data service), `ngOnInit` never calls `dataService.init`/`selectTab`, and the `TORRENT_DELETED` handler still clears `loadedComponents` instead of calling `stopAll()`.

- [ ] **Step 4: Update `torrent-details.ts`**

Replace the whole file:

```ts
import { CommonModule, NgComponentOutlet } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  Type,
  computed,
  inject,
  input,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { faAsterisk, faXmark } from '@fortawesome/free-solid-svg-icons';
import { NgbActiveModal, NgbTooltip } from '@ng-bootstrap/ng-bootstrap';
import { TranslatePipe } from '@ngx-translate/core';
import { filter } from 'rxjs/operators';
import { AutofocusDirective } from '../../../directives/autofocus';
import { AppCommand, TorrentCommand } from '../../../models/command.model';
import { GuardableModal } from '../../../models/guardable-modal.interface';
import { Torrent } from '../../../models/torrent.model';
import { CommandBusService } from '../../../services/command-bus.service';
import { ConfirmService } from '../../../services/confirm.service';
import { ModalGuardService } from '../../../services/modal-guard.service';
import { TorrentStoreService } from '../../../services/torrent-store.service';
import { BbBtnContent } from '../../bb-btn-content/bb-btn-content';
import { BbSpinner } from '../../bb-spinner/bb-spinner';
import { TorrentDetailsActionsService } from './torrent-details-actions.service';
import { TorrentDetailsDataService } from './torrent-details-data.service';
import { Tab, TorrentDetailTabComponent, TorrentDetailTabId } from './torrent-details.interface';

@Component({
  selector: 'app-torrent-details',
  standalone: true,
  imports: [
    CommonModule,
    BbSpinner,
    NgComponentOutlet,
    AutofocusDirective,
    NgbTooltip,
    TranslatePipe,
    FontAwesomeModule,
    BbBtnContent,
  ],
  providers: [ModalGuardService, TorrentDetailsDataService, TorrentDetailsActionsService],
  templateUrl: './torrent-details.html',
  styleUrl: './torrent-details.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TorrentDetails implements OnInit, GuardableModal {
  readonly hash = input<string | null>(null);
  readonly tabToOpen = input<TorrentDetailTabId>('general');
  readonly context = input<Record<string, any>>({});

  public readonly activeModal = inject(NgbActiveModal);
  public readonly guardService = inject(ModalGuardService);
  public readonly dataService = inject(TorrentDetailsDataService);
  public readonly actionsService = inject(TorrentDetailsActionsService);
  private readonly commandBusService = inject(CommandBusService);
  private readonly torrentStoreService = inject(TorrentStoreService);
  private readonly confirmService = inject(ConfirmService);

  public readonly icon = { faAsterisk, faXmark };

  public readonly activeTabId = this.dataService.activeTabId;
  public loadedComponents = signal<Map<TorrentDetailTabId, Type<TorrentDetailTabComponent>>>(
    new Map(),
  );

  public torrent = computed<Torrent | null>(() => {
    if (!this.hash()) return null;
    return this.torrentStoreService.torrentsMap().get(this.hash()!) as Torrent;
  });

  public tabs: Tab[] = [
    {
      id: 'general',
      label: 'General',
      loadComponent: () => import('./general/general').then((m) => m.General),
    },
    {
      id: 'trackers',
      label: 'Trackers',
      loadComponent: () => import('./trackers/trackers').then((m) => m.Trackers),
    },
    {
      id: 'peers',
      label: 'Peers',
      loadComponent: () => import('./peers/peers').then((m) => m.Peers),
    },
    {
      id: 'content',
      label: 'Content',
      loadComponent: () => import('./content/content').then((m) => m.Content),
    },
  ];

  constructor() {
    this.commandBusService.commands$
      .pipe(
        filter(
          (command: AppCommand): command is { type: 'TORRENT_DELETED'; hash: string } =>
            command.type === 'TORRENT_DELETED',
        ),
        filter(
          (command: TorrentCommand) =>
            command.type === 'TORRENT_DELETED' && command.hash === this.hash(),
        ),
        takeUntilDestroyed(),
      )
      .subscribe(() => {
        this.dataService.stopAll();
        this.activeModal.close();
      });
  }

  public async ngOnInit(): Promise<void> {
    this.dataService.init(this.hash() ?? '', this.context());
    this.dataService.selectTab(this.tabToOpen());

    const results = await Promise.all(
      this.tabs.map((t) => t.loadComponent().then((c) => [t.id, c] as const)),
    );
    this.loadedComponents.set(
      new Map(results) as Map<TorrentDetailTabId, Type<TorrentDetailTabComponent>>,
    );
  }

  public selectTab(tabId: TorrentDetailTabId): void {
    this.dataService.selectTab(tabId);
  }

  public async canDeactivate(): Promise<boolean> {
    if (!this.guardService.isDirty()) return true;

    const confirmed = await this.confirmService.confirm(
      'components.modals.guard.unsaved-title',
      'components.modals.guard.unsaved-message',
      'components.modals.guard.btn-leave',
      'components.modals.guard.btn-stay',
    );

    if (confirmed) this.guardService.isDirty.set(false);

    return confirmed;
  }
}
```

- [ ] **Step 5: Update `torrent-details.html`'s `*ngComponentOutlet` binding**

Change:

```html
<ng-container
  *ngComponentOutlet="
                loadedComponents().get(tab.id)!;
                inputs: { hash: torrent()?.hash, context: context() }
              "
></ng-container>
```

to:

```html
<ng-container *ngComponentOutlet="loadedComponents().get(tab.id)!"></ng-container>
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `npm run test --workspace=@bitbutler/app -- torrent-details.spec`
Expected: PASS for all tests in the file. (Tabs will fail to render correctly until Tasks 9-12 update them to stop expecting `hash`/`context` inputs - that's expected and fixed by those tasks; `torrent-details.spec.ts` itself does not render real tab components, so it's unaffected.)

- [ ] **Step 7: Commit**

```bash
git add packages/app/src/app/components/modals/torrent-details/torrent-details.interface.ts packages/app/src/app/components/modals/torrent-details/torrent-details.ts packages/app/src/app/components/modals/torrent-details/torrent-details.html packages/app/src/app/components/modals/torrent-details/torrent-details.spec.ts
git commit -m "#183: wire TorrentDetailsDataService/ActionsService into TorrentDetails, drop tab inputs"
```

---

### Task 9: Rewrite `General` as a pure-display tab

**Files:**

- Modify: `packages/app/src/app/components/modals/torrent-details/general/general.ts`
- Modify: `packages/app/src/app/components/modals/torrent-details/general/general.html`
- Modify: `packages/app/src/app/components/modals/torrent-details/general/general.spec.ts`
- Modify: `public/i18n/us.json`
- Modify: `public/i18n/hu.json`

**Interfaces:**

- Consumes: `TorrentDetailsDataService.torrent`/`.localPath`/`.errorLog` (Tasks 1-6).
- Produces: `General` with no inputs, injecting only `TorrentDetailsDataService`/`Clipboard`/`ToastService`/`TranslateService`. `singleFile` is no longer exposed by `General` (only the footer, via `dataService.singleFile()` directly in Task 13, needs it now).

- [ ] **Step 1: Write the failing test**

Replace `packages/app/src/app/components/modals/torrent-details/general/general.spec.ts` entirely:

```ts
import { Clipboard } from '@angular/cdk/clipboard';
import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TimeagoIntl, provideTimeago } from 'ngx-timeago';
import {
  QbLogEntry,
  QbLogMessageType,
  QbTorrentProperties,
} from '../../../../models/qbittorrent.model';
import { Torrent } from '../../../../models/torrent.model';
import { ToastService } from '../../../../services/toast.service';
import { MergedTorrent, TorrentDetailsDataService } from '../torrent-details-data.service';
import { General } from './general';

const makeTorrent = (overrides: Partial<Torrent> = {}): Torrent => ({
  added_on: 1700000000,
  amount_left: 0,
  auto_tmm: false,
  availability: 0,
  category: '',
  completed: 0,
  completion_on: 0,
  content_path: '',
  dl_limit: 0,
  dlspeed: 0,
  download_path: '',
  downloaded: 0,
  downloaded_session: 0,
  eta: 0,
  f_l_piece_prio: false,
  force_start: false,
  hash: 'abc123',
  inactive_seeding_time_limit: 0,
  infohash_v1: '',
  infohash_v2: '',
  last_activity: 0,
  magnet_uri: '',
  max_inactive_seeding_time: 0,
  max_ratio: 0,
  max_seeding_time: 0,
  name: 'My Torrent',
  num_complete: 0,
  num_incomplete: 0,
  num_leechs: 0,
  num_seeds: 0,
  priority: 0,
  progress: 0,
  ratio: 0,
  ratio_limit: 0,
  save_path: '',
  seeding_time: 0,
  seeding_time_limit: 0,
  seen_complete: 0,
  seq_dl: false,
  size: 0,
  state: 'downloading',
  super_seeding: false,
  tags: '',
  time_active: 0,
  total_size: 0,
  tracker: '',
  trackers_count: 0,
  up_limit: 0,
  uploaded: 0,
  uploaded_session: 0,
  upspeed: 0,
  ...overrides,
});

const makeProperties = (overrides: Partial<QbTorrentProperties> = {}): QbTorrentProperties => ({
  save_path: '',
  creation_date: 1700000000,
  piece_size: 0,
  comment: '',
  total_wasted: 0,
  total_uploaded: 0,
  total_uploaded_session: 0,
  total_downloaded: 0,
  total_downloaded_session: 0,
  up_limit: 0,
  dl_limit: 0,
  time_elapsed: 0,
  seeding_time: 0,
  nb_connections: 0,
  nb_connections_limit: 0,
  share_ratio: 0,
  addition_date: 0,
  completion_date: 0,
  created_by: '',
  dl_speed_avg: 0,
  dl_speed: 0,
  eta: 0,
  last_seen: 0,
  peers: 0,
  peers_total: 0,
  pieces_have: 0,
  pieces_num: 0,
  reannounce: 0,
  seeds: 0,
  seeds_total: 0,
  total_size: 0,
  up_speed_avg: 0,
  up_speed: 0,
  isPrivate: false,
  infohash_v1: '',
  infohash_v2: '',
  ...overrides,
});

const makeLogEntry = (overrides: Partial<QbLogEntry> = {}): QbLogEntry => ({
  id: 1,
  message:
    'File error alert. Torrent: "My Torrent". File: "/path". Reason: "x error: Permission denied"',
  timestamp: 1700000000,
  type: QbLogMessageType.Warning,
  ...overrides,
});

describe('General', () => {
  let component: General;
  let fixture: ComponentFixture<General>;
  let mockDataService: {
    torrent: ReturnType<typeof signal<MergedTorrent | null>>;
    localPath: ReturnType<typeof signal<string | null>>;
    errorLog: ReturnType<typeof signal<QbLogEntry | null>>;
  };

  beforeEach(async () => {
    mockDataService = {
      torrent: signal(null),
      localPath: signal(null),
      errorLog: signal(null),
    };

    await TestBed.configureTestingModule({
      imports: [General],
      providers: [
        { provide: TorrentDetailsDataService, useValue: mockDataService },
        { provide: Clipboard, useValue: { copy: vi.fn() } },
        { provide: ToastService, useValue: { info: vi.fn(), danger: vi.fn() } },
        provideTimeago({ intl: { provide: TimeagoIntl, useClass: TimeagoIntl } }),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(General);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should start with null torrent', () => {
    expect(component.torrent()).toBeNull();
  });

  describe('parseFileErrorReason', () => {
    it('extracts the short error and full reason from a file error alert message', () => {
      const message =
        'File error alert. Torrent: "ubuntu-26.04-desktop-amd64.iso". File: "/mnt/storage/filmek/test/ubuntu-26.04-desktop-amd64.iso.!qB". Reason: "ubuntu-26.04-desktop-amd64.iso file_open (/mnt/storage/filmek/test/ubuntu-26.04-desktop-amd64.iso.!qB) error: Permission denied"';

      const result = component.parseFileErrorReason(message);

      expect(result.short).toBe('Permission denied');
      expect(result.reason).toBe(
        'ubuntu-26.04-desktop-amd64.iso file_open (/mnt/storage/filmek/test/ubuntu-26.04-desktop-amd64.iso.!qB) error: Permission denied',
      );
    });

    it('falls back to the full reason when there is no "error:" segment', () => {
      const message = 'Some alert. Torrent: "My Torrent". Reason: "disk is full"';

      const result = component.parseFileErrorReason(message);

      expect(result.reason).toBe('disk is full');
      expect(result.short).toBe('disk is full');
    });

    it('falls back to the raw message when there is no Reason section', () => {
      const message = 'Added new torrent. Torrent: "My Torrent"';

      const result = component.parseFileErrorReason(message);

      expect(result.reason).toBe(message);
      expect(result.short).toBe(message);
    });
  });

  describe('rawLogJson', () => {
    it('formats the log entry as 4-space-indented JSON', () => {
      const entry: QbLogEntry = {
        id: 10672,
        message: 'File error alert.',
        timestamp: 1781772596,
        type: QbLogMessageType.Warning,
      };

      expect(component.rawLogJson(entry)).toBe(JSON.stringify(entry, null, 4));
    });
  });

  describe('toggleErrorLog', () => {
    it('flips errorLogExpanded', () => {
      expect(component.errorLogExpanded()).toBe(false);
      component.toggleErrorLog();
      expect(component.errorLogExpanded()).toBe(true);
      component.toggleErrorLog();
      expect(component.errorLogExpanded()).toBe(false);
    });
  });

  describe('error row rendering', () => {
    beforeEach(() => {
      mockDataService.torrent.set({
        data: makeTorrent({ state: 'downloading' }),
        properties: makeProperties(),
      });
      fixture.detectChanges();
    });

    it('does not render the error row when there is no errorLog', () => {
      expect(fixture.nativeElement.querySelector('.bb-section--danger')).toBeNull();
    });

    it('renders the error row with the short reason and reflects errorLogExpanded on the icon', () => {
      mockDataService.errorLog.set(makeLogEntry());
      fixture.detectChanges();

      const row = fixture.nativeElement.querySelector('.bb-section--danger');
      expect(row).not.toBeNull();
      expect(row.querySelector('.section-header').textContent).not.toContain('[object Object]');
      expect(row.querySelector('.section-value').textContent).toContain('Permission denied');

      const icon = row.querySelector('.error-toggle__icon');
      expect(icon.classList.contains('error-toggle__icon--expanded')).toBe(false);

      component.toggleErrorLog();
      fixture.detectChanges();

      expect(icon.classList.contains('error-toggle__icon--expanded')).toBe(true);

      const detail = row.querySelector('.error-toggle__detail');
      expect(detail.querySelector('hr')).toBeNull();
      expect(detail.querySelector('.section-header')).toBeNull();
      expect(detail.querySelector('pre').textContent).toContain('Permission denied');
    });
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run test --workspace=@bitbutler/app -- general.spec`
Expected: FAIL - `General` still requires a `hash` input and injects `QbService`/`CommandBusService`/etc. directly; `TorrentDetailsDataService` is not yet a recognized provider token for it.

- [ ] **Step 3: Replace `general.ts`**

Replace the whole file:

```ts
import { Clipboard } from '@angular/cdk/clipboard';
import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FontAwesomeModule, IconDefinition } from '@fortawesome/angular-fontawesome';
import { faClipboard } from '@fortawesome/free-regular-svg-icons';
import { NgbCollapse, NgbTooltip } from '@ng-bootstrap/ng-bootstrap';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { TimeagoPipe } from 'ngx-timeago';
import { TooltipOverflow } from '../../../../directives/tooltip-overflow';
import { QbLogEntry } from '../../../../models/qbittorrent.model';
import { FileSizePerSecPipe } from '../../../../pipes/filesize-per-sec-pipe';
import { FilesizePipe } from '../../../../pipes/filesize-pipe';
import { HumanizeDurationPipe } from '../../../../pipes/humanize-duration-pipe';
import { RatioLimitPipe } from '../../../../pipes/ratio-limit-pipe';
import { RatioPipe } from '../../../../pipes/ratio-pipe';
import { SpeedLimitPipe } from '../../../../pipes/speed-limit-pipe';
import { TimeLimitPipe } from '../../../../pipes/time-limit-pipe';
import { ToastService } from '../../../../services/toast.service';
import { BbPopover } from '../../../bb-popover/bb-popover';
import { BbProgress } from '../../../bb-progress/bb-progress';
import { BbSpinner } from '../../../bb-spinner/bb-spinner';
import { TorrentDetailsDataService } from '../torrent-details-data.service';
import { TorrentDetailTabComponent } from '../torrent-details.interface';

@Component({
  selector: 'app-general',
  imports: [
    BbSpinner,
    DatePipe,
    TimeagoPipe,
    FilesizePipe,
    FileSizePerSecPipe,
    HumanizeDurationPipe,
    SpeedLimitPipe,
    BbProgress,
    FontAwesomeModule,
    NgbCollapse,
    NgbTooltip,
    RatioLimitPipe,
    RatioPipe,
    TimeLimitPipe,
    BbPopover,
    TranslatePipe,
    TooltipOverflow,
  ],
  templateUrl: './general.html',
  styleUrl: './general.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class General implements TorrentDetailTabComponent {
  private readonly dataService = inject(TorrentDetailsDataService);
  private readonly clipboard = inject(Clipboard);
  private readonly toastService = inject(ToastService);
  private readonly translateService = inject(TranslateService);

  public icons: Record<string, IconDefinition> = { faClipboard };

  public readonly torrent = this.dataService.torrent;
  public readonly localPath = this.dataService.localPath;
  public readonly errorLog = this.dataService.errorLog;
  public errorLogExpanded = signal(false);

  public toClipboard(fieldKey: string, value: string): void {
    const field = this.translateService.instant(
      `components.modals.torrent-details.general.${fieldKey}`,
    );
    this.toastService.info(
      this.translateService.instant(
        'components.modals.torrent-details.general.toast.copied-to-clipboard',
        { field },
      ),
    );
    this.clipboard.copy(value);
  }

  public isDownloading(): boolean {
    return (
      this.torrent()?.data.state === 'downloading' ||
      this.torrent()?.data.state === 'pausedDL' ||
      this.torrent()?.data.state === 'stoppedDL' ||
      this.torrent()?.data.state === 'queuedDL' ||
      this.torrent()?.data.state === 'stalledDL' ||
      this.torrent()?.data.state === 'checkingDL' ||
      this.torrent()?.data.state === 'forcedDL'
    );
  }

  public parseFileErrorReason(message: string): { reason: string; short: string } {
    const match = message.match(/Reason:\s*"(.*)"\s*$/);
    const reason = match ? match[1] : message;
    const errorMatch = reason.match(/error:\s*(.+)$/i);
    const short = errorMatch ? errorMatch[1] : reason;
    return { reason, short };
  }

  public rawLogJson(entry: QbLogEntry): string {
    return JSON.stringify(entry, null, 4);
  }

  public toggleErrorLog(): void {
    this.errorLogExpanded.update((v) => !v);
  }
}
```

- [ ] **Step 4: Update `general.html` - Name row keeps only the copy button**

Change:

```html
<div class="button-container">
  <button
    class="btn btn-sm btn-link"
    placement="top"
    [ngbTooltip]="
                'components.modals.torrent-details.general.copy-to-clipboard' | translate
              "
    (click)="toClipboard('name', torrent()!.data.name)"
  >
    <fa-icon [icon]="icons['faClipboard']" />
  </button>

  <button
    class="btn btn-sm btn-link"
    placement="top"
    [ngbTooltip]="'components.modals.torrent-details.general.rename' | translate"
    (click)="rename()"
  >
    <fa-icon [icon]="icons['faPenToSquare']" />
  </button>

  <button
    class="btn btn-sm btn-link text-danger"
    placement="top"
    container="body"
    [ngbTooltip]="'components.modals.torrent-details.general.delete' | translate"
    tooltipClass="danger"
    (click)="deleteTorrent()"
  >
    <fa-icon [icon]="icons['faTrashCan']" />
  </button>
</div>
```

to:

```html
<div class="button-container">
  <button
    class="btn btn-sm btn-link"
    placement="top"
    [ngbTooltip]="
                'components.modals.torrent-details.general.copy-to-clipboard' | translate
              "
    (click)="toClipboard('name', torrent()!.data.name)"
  >
    <fa-icon [icon]="icons['faClipboard']" />
  </button>
</div>
```

- [ ] **Step 5: Update `general.html` - Save path row keeps only the copy button**

Change:

```html
<div class="button-container">
  <button
    class="btn btn-sm btn-link"
    placement="top"
    [ngbTooltip]="
                'components.modals.torrent-details.general.copy-to-clipboard' | translate
              "
    (click)="toClipboard('save-path', torrent()!.data.save_path)"
  >
    <fa-icon [icon]="icons['faClipboard']" />
  </button>

  <button
    class="btn btn-sm btn-link"
    placement="top"
    [ngbTooltip]="'components.modals.torrent-details.general.relocate' | translate"
    (click)="setLocation()"
  >
    <fa-icon [icon]="icons['faPenToSquare']" />
  </button>
</div>
```

to:

```html
<div class="button-container">
  <button
    class="btn btn-sm btn-link"
    placement="top"
    [ngbTooltip]="
                'components.modals.torrent-details.general.copy-to-clipboard' | translate
              "
    (click)="toClipboard('save-path', torrent()!.data.save_path)"
  >
    <fa-icon [icon]="icons['faClipboard']" />
  </button>
</div>
```

- [ ] **Step 6: Update `general.html` - Local path row keeps only the copy button**

Change:

```html
<div class="button-container">
  <button
    class="btn btn-sm btn-link"
    placement="top"
    [ngbTooltip]="
                  'components.modals.torrent-details.general.copy-to-clipboard' | translate
                "
    (click)="toClipboard('local-path', torrent()!.data.save_path)"
  >
    <fa-icon [icon]="icons['faClipboard']" />
  </button>

  <button
    class="btn btn-sm btn-link"
    placement="top"
    [ngbTooltip]="
                  (singleFile()
                    ? 'components.modals.torrent-details.general.show-file'
                    : 'components.modals.torrent-details.general.open-destination'
                  ) | translate
                "
    (click)="openPath()"
    [disabled]="!localPath()"
  >
    <fa-icon [icon]="icons['faFolderOpen']" />
  </button>
</div>
```

to:

```html
<div class="button-container">
  <button
    class="btn btn-sm btn-link"
    placement="top"
    [ngbTooltip]="
                  'components.modals.torrent-details.general.copy-to-clipboard' | translate
                "
    (click)="toClipboard('local-path', torrent()!.data.save_path)"
  >
    <fa-icon [icon]="icons['faClipboard']" />
  </button>
</div>
```

- [ ] **Step 7: Update `general.html` - delete the State row's button-container entirely**

Delete this block (the State row keeps its `<span class="section-value">`, only the buttons go):

```html
<div class="button-container">
  <button
    class="btn btn-sm btn-link"
    placement="top"
    [ngbTooltip]="'components.modals.torrent-details.general.resume' | translate"
    (click)="resume()"
  >
    <fa-icon [icon]="icons['faPlay']" />
  </button>

  <button
    class="btn btn-sm btn-link"
    placement="top"
    [ngbTooltip]="'components.modals.torrent-details.general.pause' | translate"
    (click)="pause()"
  >
    <fa-icon [icon]="icons['faPause']" />
  </button>

  <button
    class="btn btn-sm btn-link"
    placement="top"
    [ngbTooltip]="'components.modals.torrent-details.general.force-resume' | translate"
    (click)="forceResume()"
  >
    <fa-icon [icon]="icons['faForwardFast']" />
  </button>
</div>
```

- [ ] **Step 8: Update `general.html` - delete the Category row's button-container entirely**

Delete:

```html
<div class="button-container">
  <button
    class="btn btn-sm btn-link"
    placement="top"
    [ngbTooltip]="'components.modals.torrent-details.general.change-category' | translate"
    (click)="changeCategory()"
  >
    <fa-icon [icon]="icons['faPenToSquare']" />
  </button>

  <button
    class="btn btn-sm btn-link"
    placement="top"
    [ngbTooltip]="'components.modals.torrent-details.general.remove-category' | translate"
    (click)="removeCategory()"
    [disabled]="!torrent()!.data.category"
  >
    <fa-icon [icon]="icons['faX']" />
  </button>
</div>
```

- [ ] **Step 9: Update `general.html` - delete the Tags row's button-container entirely**

Delete (note the pre-existing typo `placement-="top"` on the second button - match it exactly):

```html
<div class="button-container">
  <button
    class="btn btn-sm btn-link"
    placement="top"
    [ngbTooltip]="'components.modals.torrent-details.general.change-tags' | translate"
    (click)="changeTags()"
  >
    <fa-icon [icon]="icons['faPenToSquare']" />
  </button>

  <button
    class="btn btn-sm btn-link"
    placement-="top"
    [ngbTooltip]="'components.modals.torrent-details.general.remove-all-tags' | translate"
    (click)="removeAllTags()"
    [disabled]="!torrent()!.data.tags"
  >
    <fa-icon [icon]="icons['faX']" />
  </button>
</div>
```

- [ ] **Step 10: Update `general.html` - delete the Download limit row's button-container entirely**

Delete:

```html
<div class="button-container">
  <button
    class="btn btn-sm btn-link"
    placement="top"
    [ngbTooltip]="
                'components.modals.torrent-details.general.change-download-limit' | translate
              "
    (click)="changeDownloadLimit()"
  >
    <fa-icon [icon]="icons['faPenToSquare']" />
  </button>

  <button
    class="btn btn-sm btn-link"
    placement="top"
    [ngbTooltip]="
                'components.modals.torrent-details.general.clear-download-limit' | translate
              "
    (click)="clearDownloadLimit()"
    [disabled]="torrent()!.data.dl_limit === 0"
  >
    <fa-icon [icon]="icons['faX']" />
  </button>
</div>
```

- [ ] **Step 11: Update `general.html` - delete the Upload limit row's button-container entirely**

Delete:

```html
<div class="button-container">
  <button
    class="btn btn-sm btn-link"
    placement="top"
    [ngbTooltip]="
                'components.modals.torrent-details.general.change-upload-limit' | translate
              "
    (click)="changeUploadLimit()"
  >
    <fa-icon [icon]="icons['faPenToSquare']" />
  </button>

  <button
    class="btn btn-sm btn-link"
    placement="top"
    [ngbTooltip]="
                'components.modals.torrent-details.general.clear-upload-limit' | translate
              "
    (click)="clearUploadLimit()"
    [disabled]="torrent()!.data.up_limit === 0"
  >
    <fa-icon [icon]="icons['faX']" />
  </button>
</div>
```

- [ ] **Step 12: Update `general.html` - delete the Reannounce-in row's button-container entirely**

Delete:

```html
<div class="button-container">
  <button
    class="btn btn-sm btn-link"
    placement="top"
    [ngbTooltip]="
                'components.modals.torrent-details.general.force-reannounce' | translate
              "
    (click)="forceReannounce()"
  >
    <fa-icon [icon]="icons['faBullhorn']" />
  </button>
</div>
```

- [ ] **Step 13: Update `general.html` - delete the Ratio limit row's button-container entirely**

Delete:

```html
<div class="button-container">
  <button
    class="btn btn-sm btn-link"
    placement="top"
    [ngbTooltip]="
                'components.modals.torrent-details.general.edit-share-limits' | translate
              "
    (click)="openShareLimitsModal()"
  >
    <fa-icon [icon]="icons['faPenToSquare']" />
  </button>
  <button
    class="btn btn-sm btn-link"
    placement="top"
    [ngbTooltip]="
                'components.modals.torrent-details.general.clear-ratio-limit' | translate
              "
    [disabled]="torrent()!.data.ratio_limit === -1"
    (click)="clearRatioLimit()"
  >
    <fa-icon [icon]="icons['faX']" />
  </button>
</div>
```

- [ ] **Step 14: Update `general.html` - delete the Seeding time limit row's button-container entirely**

Delete:

```html
<div class="button-container">
  <button
    class="btn btn-sm btn-link"
    placement="top"
    [ngbTooltip]="
                'components.modals.torrent-details.general.edit-share-limits' | translate
              "
    (click)="openShareLimitsModal()"
  >
    <fa-icon [icon]="icons['faPenToSquare']" />
  </button>
  <button
    class="btn btn-sm btn-link"
    placement="top"
    [ngbTooltip]="
                'components.modals.torrent-details.general.clear-seeding-time-limit' | translate
              "
    [disabled]="torrent()!.data.seeding_time_limit === -1"
    (click)="clearSeedingTimeLimit()"
  >
    <fa-icon [icon]="icons['faX']" />
  </button>
</div>
```

- [ ] **Step 15: Update `general.html` - delete the Inactive seeding time limit row's button-container entirely**

Delete:

```html
<div class="button-container">
  <button
    class="btn btn-sm btn-link"
    placement="top"
    [ngbTooltip]="
                'components.modals.torrent-details.general.edit-share-limits' | translate
              "
    (click)="openShareLimitsModal()"
  >
    <fa-icon [icon]="icons['faPenToSquare']" />
  </button>
  <button
    class="btn btn-sm btn-link"
    placement="top"
    [ngbTooltip]="
                'components.modals.torrent-details.general.clear-inactive-seeding-time-limit'
                  | translate
              "
    [disabled]="torrent()!.data.inactive_seeding_time_limit === -1"
    (click)="clearInactiveSeedingTimeLimit()"
  >
    <fa-icon [icon]="icons['faX']" />
  </button>
</div>
```

(The Remote path, Info hash v1/v2, and Comment rows already only had a copy button - leave those three untouched.)

- [ ] **Step 16: Remove now-unused i18n keys from `public/i18n/us.json`**

Under `components.modals.torrent-details.general`, delete these keys (the buttons that used them no longer exist, and the footer in Task 13 either reuses a different existing key or doesn't need a per-field action key at all): `change-download-limit`, `clear-download-limit`, `change-upload-limit`, `clear-upload-limit`, `clear-ratio-limit`, `clear-seeding-time-limit`, `clear-inactive-seeding-time-limit`.

Under `components.modals.torrent-details.general.toast`, delete: `clearing-download-limit`, `clear-download-limit-failed`, `clearing-upload-limit`, `clear-upload-limit-failed`, `clearing-ratio-limit`, `clear-ratio-limit-failed`, `clearing-seeding-time-limit`, `clear-seeding-time-limit-failed`, `clearing-inactive-seeding-time-limit`, `clear-inactive-seeding-time-limit-failed`.

Keep everything else as-is, including `rename`, `delete`, `relocate`, `show-file`, `open-destination`, `resume`, `pause`, `force-resume`, `change-category`, `remove-category`, `change-tags`, `remove-all-tags`, `force-reannounce`, `edit-share-limits`, and their toast counterparts - Task 13's footer reuses all of these.

- [ ] **Step 17: Remove the same keys from `public/i18n/hu.json`**

Delete the matching Hungarian keys under the same paths: `change-download-limit`, `clear-download-limit`, `change-upload-limit`, `clear-upload-limit`, `clear-ratio-limit`, `clear-seeding-time-limit`, `clear-inactive-seeding-time-limit`, and under `toast`: `clearing-download-limit`, `clear-download-limit-failed`, `clearing-upload-limit`, `clear-upload-limit-failed`, `clearing-ratio-limit`, `clear-ratio-limit-failed`, `clearing-seeding-time-limit`, `clear-seeding-time-limit-failed`, `clearing-inactive-seeding-time-limit`, `clear-inactive-seeding-time-limit-failed`.

- [ ] **Step 18: Run the tests to verify they pass**

Run: `npm run test --workspace=@bitbutler/app -- general.spec`
Expected: PASS for all tests in the file.

- [ ] **Step 19: Run lint to catch unused-translation or unused-import issues**

Run: `npm run lint`
Expected: PASS with zero warnings. If lint flags any remaining reference to a deleted i18n key or removed method, fix it before continuing.

- [ ] **Step 20: Commit**

```bash
git add packages/app/src/app/components/modals/torrent-details/general/general.ts packages/app/src/app/components/modals/torrent-details/general/general.html packages/app/src/app/components/modals/torrent-details/general/general.spec.ts public/i18n/us.json public/i18n/hu.json
git commit -m "#183: make General a pure-display tab reading from TorrentDetailsDataService"
```

---

### Task 10: `Trackers` reads from `TorrentDetailsDataService`

**Files:**

- Modify: `packages/app/src/app/components/modals/torrent-details/trackers/trackers.ts`
- Modify: `packages/app/src/app/components/modals/torrent-details/trackers/trackers.spec.ts`

**Interfaces:**

- Consumes: `TorrentDetailsDataService.trackers`/`.trackersLoading` (Task 3).

- [ ] **Step 1: Write the failing test**

In `trackers.spec.ts`, replace the imports and `beforeEach` block. Remove the `QbService`/`ServerStoreService` imports and provider entries, and add:

```ts
import { signal } from '@angular/core';
import { QbTorrentTracker } from '../../../../models/qbittorrent.model';
import { TorrentDetailsDataService } from '../torrent-details-data.service';
```

Replace the `beforeEach` block's `providers` array entries for `ServerStoreService`/`QbService` with:

```ts
        {
          provide: TorrentDetailsDataService,
          useValue: { trackers: signal<QbTorrentTracker[]>([]), trackersLoading: signal(true) },
        },
```

(Keep `ThemeService`, `TrackersGridSettingsService`, `ContextMenuService`, `GridContextMenuService`, `Clipboard` providers exactly as they are.)

Add a new `describe('data service sync', ...)` block right after the `'should have grid options defined'` test:

```ts
describe('data service sync', () => {
  it('reflects updates to the data service trackers and loading signals', () => {
    const dataService = TestBed.inject(TorrentDetailsDataService) as unknown as {
      trackers: ReturnType<typeof signal<QbTorrentTracker[]>>;
      trackersLoading: ReturnType<typeof signal<boolean>>;
    };
    const tracker: QbTorrentTracker = {
      url: 'http://tracker.example.com',
      status: 0,
      tier: 0,
      num_peers: 0,
      num_seeds: 0,
      num_leeches: 0,
      num_downloaded: 0,
      msg: '',
    };

    dataService.trackers.set([tracker]);
    dataService.trackersLoading.set(false);
    fixture.detectChanges();

    expect(component.trackers).toEqual([tracker]);
    expect(component.loading).toBe(false);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run test --workspace=@bitbutler/app -- trackers.spec`
Expected: FAIL - `Trackers` still injects `QbService`/`ServerStoreService` directly and has no constructor-level sync with a `TorrentDetailsDataService`.

- [ ] **Step 3: Update `trackers.ts`**

Change the imports from:

```ts
import { Clipboard } from '@angular/cdk/clipboard';
import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  DestroyRef,
  OnInit,
  inject,
  input,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { faCode, faCopy, faLink } from '@fortawesome/free-solid-svg-icons';
import { TranslateService } from '@ngx-translate/core';
import { AgGridAngular } from 'ag-grid-angular';
import {
  CellContextMenuEvent,
  ColDef,
  Column,
  ColumnHeaderContextMenuEvent,
  GridApi,
  GridOptions,
  GridReadyEvent,
  IOverlayParams,
  ValueFormatterParams,
  ValueGetterParams,
} from 'ag-grid-community';
import { Subject, debounceTime } from 'rxjs';
import { GRID_DARK_THEME, GRID_LIGHT_THEME, GRID_SHARED_OPTIONS } from '../../../../app.const';
import { QbTorrentTracker, QbTrackerStatus } from '../../../../models/qbittorrent.model';
import { ContextMenuEntry } from '../../../../pages/main/grid/context-menu/context-menu.types';
import { GridContextMenuService } from '../../../../pages/main/grid/context-menu/grid-context-menu.service';
import { LoadingOverlay } from '../../../../pages/main/grid/overlays/loading-overlay/loading-overlay';
import { NoRowOverlay } from '../../../../pages/main/grid/overlays/no-row-overlay/no-row-overlay';
import { ContextMenuService } from '../../../../services/context-menu.service';
import { QbService } from '../../../../services/qb.service';
import { ServerStoreService } from '../../../../services/server-store.service';
import { ThemeService } from '../../../../services/theme.service';
import { TrackersGridSettingsService } from '../../../../services/trackers-grid.settings.service';
import { TorrentDetailTabComponent } from '../torrent-details.interface';
```

to:

```ts
import { Clipboard } from '@angular/cdk/clipboard';
import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  DestroyRef,
  OnInit,
  effect,
  inject,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { faCode, faCopy, faLink } from '@fortawesome/free-solid-svg-icons';
import { TranslateService } from '@ngx-translate/core';
import { AgGridAngular } from 'ag-grid-angular';
import {
  CellContextMenuEvent,
  ColDef,
  Column,
  ColumnHeaderContextMenuEvent,
  GridApi,
  GridOptions,
  GridReadyEvent,
  IOverlayParams,
  ValueFormatterParams,
  ValueGetterParams,
} from 'ag-grid-community';
import { Subject, debounceTime } from 'rxjs';
import { GRID_DARK_THEME, GRID_LIGHT_THEME, GRID_SHARED_OPTIONS } from '../../../../app.const';
import { QbTorrentTracker, QbTrackerStatus } from '../../../../models/qbittorrent.model';
import { ContextMenuEntry } from '../../../../pages/main/grid/context-menu/context-menu.types';
import { GridContextMenuService } from '../../../../pages/main/grid/context-menu/grid-context-menu.service';
import { LoadingOverlay } from '../../../../pages/main/grid/overlays/loading-overlay/loading-overlay';
import { NoRowOverlay } from '../../../../pages/main/grid/overlays/no-row-overlay/no-row-overlay';
import { ContextMenuService } from '../../../../services/context-menu.service';
import { ThemeService } from '../../../../services/theme.service';
import { TrackersGridSettingsService } from '../../../../services/trackers-grid.settings.service';
import { TorrentDetailsDataService } from '../torrent-details-data.service';
import { TorrentDetailTabComponent } from '../torrent-details.interface';
```

Change the class body's field declarations from:

```ts
export class Trackers implements TorrentDetailTabComponent, OnInit {
  readonly hash = input<string>('');
  readonly context = input<Record<string, any>>({});

  private readonly qbService = inject(QbService);
  private readonly serverStoreService = inject(ServerStoreService);
  private readonly changeDetectorRef = inject(ChangeDetectorRef);
  private readonly themeService = inject(ThemeService);
  private readonly translateService = inject(TranslateService);
  private readonly contextMenuService = inject(ContextMenuService);
  private readonly gridContextMenuService = inject(GridContextMenuService);
  private readonly trackersGridSettingsService = inject(TrackersGridSettingsService);
  private readonly clipboard = inject(Clipboard);
  private readonly destroyRef = inject(DestroyRef);
```

to:

```ts
export class Trackers implements TorrentDetailTabComponent, OnInit {
  private readonly dataService = inject(TorrentDetailsDataService);
  private readonly changeDetectorRef = inject(ChangeDetectorRef);
  private readonly themeService = inject(ThemeService);
  private readonly translateService = inject(TranslateService);
  private readonly contextMenuService = inject(ContextMenuService);
  private readonly gridContextMenuService = inject(GridContextMenuService);
  private readonly trackersGridSettingsService = inject(TrackersGridSettingsService);
  private readonly clipboard = inject(Clipboard);
  private readonly destroyRef = inject(DestroyRef);
```

Add a constructor right after the `colDefs` field declaration:

```ts
  constructor() {
    effect(() => {
      this.trackers = this.dataService.trackers();
      this.loading = this.dataService.trackersLoading();
      this.changeDetectorRef.detectChanges();
    });
  }
```

Change `ngOnInit` from:

```ts
  public ngOnInit(): void {
    this.saveState$.pipe(debounceTime(500), takeUntilDestroyed(this.destroyRef)).subscribe(() => {
      void this.persistColumnState();
    });
    void this.load();
  }
```

to:

```ts
  public ngOnInit(): void {
    this.saveState$.pipe(debounceTime(500), takeUntilDestroyed(this.destroyRef)).subscribe(() => {
      void this.persistColumnState();
    });
  }
```

Delete the `private async load(): Promise<void> { ... }` method entirely (the fetch now lives in `TorrentDetailsDataService.fetchTrackers`).

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm run test --workspace=@bitbutler/app -- trackers.spec`
Expected: PASS for all tests in the file.

- [ ] **Step 5: Commit**

```bash
git add packages/app/src/app/components/modals/torrent-details/trackers/trackers.ts packages/app/src/app/components/modals/torrent-details/trackers/trackers.spec.ts
git commit -m "#183: read trackers data from TorrentDetailsDataService"
```

---

### Task 11: `Peers` reads from `TorrentDetailsDataService`

**Files:**

- Modify: `packages/app/src/app/components/modals/torrent-details/peers/peers.ts`
- Modify: `packages/app/src/app/components/modals/torrent-details/peers/peers.spec.ts`

**Interfaces:**

- Consumes: `TorrentDetailsDataService.peers`/`.peersLoading` (Task 4).

- [ ] **Step 1: Write the failing test**

In `peers.spec.ts`, replace the `QbPollingService`/`ServerStoreService` imports and provider entries with:

```ts
import { signal } from '@angular/core';
import { QbTorrentPeer } from '../../../../models/torrent.model';
import { TorrentDetailsDataService } from '../torrent-details-data.service';
```

Replace the `providers` array's `ServerStoreService`/`QbPollingService` entries with:

```ts
        {
          provide: TorrentDetailsDataService,
          useValue: { peers: signal<QbTorrentPeer[]>([]), peersLoading: signal(true) },
        },
```

(Keep `ThemeService`, `PeersGridSettingsService`, `ContextMenuService`, `GridContextMenuService`, `Clipboard` providers exactly as they are.)

Add a new `describe('data service sync', ...)` block right after `'should have grid options defined'`:

```ts
describe('data service sync', () => {
  it('reflects updates to the data service peers and loading signals', () => {
    const dataService = TestBed.inject(TorrentDetailsDataService) as unknown as {
      peers: ReturnType<typeof signal<QbTorrentPeer[]>>;
      peersLoading: ReturnType<typeof signal<boolean>>;
    };
    const peer: QbTorrentPeer = {
      ip: '10.0.0.1',
      port: 51413,
      client: 'qBittorrent',
      dl_speed: 0,
      up_speed: 0,
      progress: 0,
      downloaded: 0,
      uploaded: 0,
      relevance: 0,
      flags: '',
      flags_desc: '',
      connection: 'BT',
      files: '',
    };

    dataService.peers.set([peer]);
    dataService.peersLoading.set(false);
    fixture.detectChanges();

    expect(component.peers).toEqual([peer]);
    expect(component.loading).toBe(false);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run test --workspace=@bitbutler/app -- peers.spec`
Expected: FAIL - `Peers` still injects `QbPollingService`/`ServerStoreService` directly and runs its own polling/patch logic.

- [ ] **Step 3: Update `peers.ts`**

Change the imports from:

```ts
import { Clipboard } from '@angular/cdk/clipboard';
import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  DestroyRef,
  OnInit,
  inject,
  input,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { faCode, faCopy, faNetworkWired } from '@fortawesome/free-solid-svg-icons';
import { TranslateService } from '@ngx-translate/core';
import { AgGridAngular } from 'ag-grid-angular';
import {
  CellContextMenuEvent,
  ColDef,
  Column,
  ColumnHeaderContextMenuEvent,
  GetRowIdParams,
  GridApi,
  GridOptions,
  GridReadyEvent,
  IOverlayParams,
  ValueFormatterParams,
  ValueGetterParams,
} from 'ag-grid-community';
import { Subject, debounceTime } from 'rxjs';
import { GRID_DARK_THEME, GRID_LIGHT_THEME, GRID_SHARED_OPTIONS } from '../../../../app.const';
import { QbTorrentPeer, QbTorrentPeersResponse } from '../../../../models/torrent.model';
import { ContextMenuEntry } from '../../../../pages/main/grid/context-menu/context-menu.types';
import { GridContextMenuService } from '../../../../pages/main/grid/context-menu/grid-context-menu.service';
import { LoadingOverlay } from '../../../../pages/main/grid/overlays/loading-overlay/loading-overlay';
import { NoRowOverlay } from '../../../../pages/main/grid/overlays/no-row-overlay/no-row-overlay';
import { ProgressCellRenderer } from '../../../../pages/main/grid/renderers/progress-cell-renderer/progress-cell-renderer';
import { FilesizePipe } from '../../../../pipes/filesize-pipe';
import { ContextMenuService } from '../../../../services/context-menu.service';
import { PeersGridSettingsService } from '../../../../services/peers-grid.settings.service';
import { QbPollingService } from '../../../../services/qb-polling.service';
import { ServerStoreService } from '../../../../services/server-store.service';
import { ThemeService } from '../../../../services/theme.service';
import { TorrentDetailTabComponent } from '../torrent-details.interface';
import { FlagCellRenderer } from './flag-cell-renderer/flag-cell-renderer';
import { FlagsTooltipComponent } from './flags-tooltip/flags-tooltip';
```

to:

```ts
import { Clipboard } from '@angular/cdk/clipboard';
import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  DestroyRef,
  OnInit,
  effect,
  inject,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { faCode, faCopy, faNetworkWired } from '@fortawesome/free-solid-svg-icons';
import { TranslateService } from '@ngx-translate/core';
import { AgGridAngular } from 'ag-grid-angular';
import {
  CellContextMenuEvent,
  ColDef,
  Column,
  ColumnHeaderContextMenuEvent,
  GetRowIdParams,
  GridApi,
  GridOptions,
  GridReadyEvent,
  IOverlayParams,
  ValueFormatterParams,
  ValueGetterParams,
} from 'ag-grid-community';
import { Subject, debounceTime } from 'rxjs';
import { GRID_DARK_THEME, GRID_LIGHT_THEME, GRID_SHARED_OPTIONS } from '../../../../app.const';
import { QbTorrentPeer } from '../../../../models/torrent.model';
import { ContextMenuEntry } from '../../../../pages/main/grid/context-menu/context-menu.types';
import { GridContextMenuService } from '../../../../pages/main/grid/context-menu/grid-context-menu.service';
import { LoadingOverlay } from '../../../../pages/main/grid/overlays/loading-overlay/loading-overlay';
import { NoRowOverlay } from '../../../../pages/main/grid/overlays/no-row-overlay/no-row-overlay';
import { ProgressCellRenderer } from '../../../../pages/main/grid/renderers/progress-cell-renderer/progress-cell-renderer';
import { FilesizePipe } from '../../../../pipes/filesize-pipe';
import { ContextMenuService } from '../../../../services/context-menu.service';
import { PeersGridSettingsService } from '../../../../services/peers-grid.settings.service';
import { ThemeService } from '../../../../services/theme.service';
import { TorrentDetailsDataService } from '../torrent-details-data.service';
import { TorrentDetailTabComponent } from '../torrent-details.interface';
import { FlagCellRenderer } from './flag-cell-renderer/flag-cell-renderer';
import { FlagsTooltipComponent } from './flags-tooltip/flags-tooltip';
```

Change the class body's field declarations from:

```ts
export class Peers implements TorrentDetailTabComponent, OnInit {
  private readonly polling = inject(QbPollingService);
  private readonly serverStoreService = inject(ServerStoreService);
  private readonly changeDetectorRef = inject(ChangeDetectorRef);
  private readonly themeService = inject(ThemeService);
  private readonly fileSizePipe = inject(FilesizePipe);
  private readonly translateService = inject(TranslateService);
  private readonly contextMenuService = inject(ContextMenuService);
  private readonly gridContextMenuService = inject(GridContextMenuService);
  private readonly peersGridSettingsService = inject(PeersGridSettingsService);
  private readonly clipboard = inject(Clipboard);
  private readonly destroyRef = inject(DestroyRef);

  private readonly saveState$ = new Subject<void>();
  private peerMap = new Map<string, QbTorrentPeer>();
  private gridApi: GridApi | null = null;
  private isRestoringState = false;

  readonly hash = input<string>('');
  readonly context = input<Record<string, any>>({});

  public theme = this.themeService.effectiveMode;
```

to:

```ts
export class Peers implements TorrentDetailTabComponent, OnInit {
  private readonly dataService = inject(TorrentDetailsDataService);
  private readonly changeDetectorRef = inject(ChangeDetectorRef);
  private readonly themeService = inject(ThemeService);
  private readonly fileSizePipe = inject(FilesizePipe);
  private readonly translateService = inject(TranslateService);
  private readonly contextMenuService = inject(ContextMenuService);
  private readonly gridContextMenuService = inject(GridContextMenuService);
  private readonly peersGridSettingsService = inject(PeersGridSettingsService);
  private readonly clipboard = inject(Clipboard);
  private readonly destroyRef = inject(DestroyRef);

  private readonly saveState$ = new Subject<void>();
  private gridApi: GridApi | null = null;
  private isRestoringState = false;

  public theme = this.themeService.effectiveMode;
```

Add a constructor right after the `colDefs` field declaration:

```ts
  constructor() {
    effect(() => {
      this.peers = this.dataService.peers();
      this.loading = this.dataService.peersLoading();
      this.changeDetectorRef.detectChanges();
    });
  }
```

Change `ngOnInit` from:

```ts
  public ngOnInit(): void {
    this.saveState$.pipe(debounceTime(500), takeUntilDestroyed(this.destroyRef)).subscribe(() => {
      void this.persistColumnState();
    });
    this.startPolling();
  }
```

to:

```ts
  public ngOnInit(): void {
    this.saveState$.pipe(debounceTime(500), takeUntilDestroyed(this.destroyRef)).subscribe(() => {
      void this.persistColumnState();
    });
  }
```

Delete the `private startPolling(): void { ... }` and `private applyPatch(patch: QbTorrentPeersResponse): void { ... }` methods entirely (both now live on `TorrentDetailsDataService`).

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm run test --workspace=@bitbutler/app -- peers.spec`
Expected: PASS for all tests in the file.

- [ ] **Step 5: Commit**

```bash
git add packages/app/src/app/components/modals/torrent-details/peers/peers.ts packages/app/src/app/components/modals/torrent-details/peers/peers.spec.ts
git commit -m "#183: read peers data from TorrentDetailsDataService"
```

---

### Task 12: `Content` reads from `TorrentDetailsDataService` and delegates mutations to `TorrentDetailsActionsService`

**Files:**

- Modify: `packages/app/src/app/components/modals/torrent-details/content/content.ts`
- Modify: `packages/app/src/app/components/modals/torrent-details/content/content.spec.ts`

**Interfaces:**

- Consumes: `TorrentDetailsDataService.content`/`.contentLoading`/`.context`/`.setContent` (Task 5), `TorrentDetailsActionsService.saveFileChanges` (Task 7).

- [ ] **Step 1: Write the failing test**

Replace `content.spec.ts` entirely:

```ts
import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TorrentFileEntry } from '@bitbutler/shared';
import { ModalGuardService } from '../../../../services/modal-guard.service';
import { TorrentDetailsActionsService } from '../torrent-details-actions.service';
import { TorrentDetailsDataService } from '../torrent-details-data.service';
import { Content } from './content';

describe('Content', () => {
  let component: Content;
  let fixture: ComponentFixture<Content>;
  let mockDataService: {
    content: ReturnType<typeof signal<TorrentFileEntry[]>>;
    contentLoading: ReturnType<typeof signal<boolean>>;
    context: ReturnType<typeof signal<Record<string, any>>>;
    setContent: ReturnType<typeof vi.fn>;
  };
  let mockActionsService: { saveFileChanges: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    mockDataService = {
      content: signal([]),
      contentLoading: signal(true),
      context: signal({}),
      setContent: vi.fn(),
    };
    mockActionsService = { saveFileChanges: vi.fn().mockResolvedValue(undefined) };

    await TestBed.configureTestingModule({
      imports: [Content],
      providers: [
        ModalGuardService,
        { provide: TorrentDetailsDataService, useValue: mockDataService },
        { provide: TorrentDetailsActionsService, useValue: mockActionsService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(Content);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should start with an empty content list', () => {
    expect(component.content()).toHaveLength(0);
  });

  it('should start with loading = true', () => {
    expect(component.loading()).toBe(true);
  });

  describe('context effect', () => {
    it('should not set startInEditMode when context has no editMode flag', () => {
      mockDataService.context.set({});
      fixture.detectChanges();
      expect(component.startInEditMode()).toBe(false);
    });

    it('should set startInEditMode and clear the flag when context.editMode is true', () => {
      const ctx: Record<string, any> = { editMode: true };
      mockDataService.context.set(ctx);
      fixture.detectChanges();
      expect(component.startInEditMode()).toBe(true);
      expect(ctx['editMode']).toBe(false);
    });
  });

  describe('onSaved', () => {
    it('optimistically sets content and delegates the mutation to the actions service', async () => {
      const originalContent: TorrentFileEntry[] = [{ path: 'a.txt', length: 1, index: 0 }];
      mockDataService.content.set(originalContent);
      const event = {
        files: [{ path: 'b.txt', length: 1, index: 0 }],
        renames: [{ oldPath: 'a.txt', newPath: 'b.txt' }],
      };

      await component.onSaved(event);

      expect(mockDataService.setContent).toHaveBeenCalledWith(event.files);
      expect(mockActionsService.saveFileChanges).toHaveBeenCalledWith(event, originalContent);
    });
  });

  describe('onEditModeChange', () => {
    it('marks the modal guard dirty when editing starts', () => {
      component.onEditModeChange(true);
      expect(TestBed.inject(ModalGuardService).isDirty()).toBe(true);
    });
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run test --workspace=@bitbutler/app -- content.spec`
Expected: FAIL - `Content` still injects `QbService`/`ServerStoreService`/`ServerSettingsService`/`ToastService` directly and polls on its own.

- [ ] **Step 3: Replace `content.ts`**

Replace the whole file:

```ts
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
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm run test --workspace=@bitbutler/app -- content.spec`
Expected: PASS for all tests in the file.

- [ ] **Step 5: Commit**

```bash
git add packages/app/src/app/components/modals/torrent-details/content/content.ts packages/app/src/app/components/modals/torrent-details/content/content.spec.ts
git commit -m "#183: read content from TorrentDetailsDataService and save via TorrentDetailsActionsService"
```

---

### Task 13: Footer action buttons (per #183)

**Files:**

- Modify: `packages/app/src/app/components/modals/torrent-details/torrent-details.ts`
- Modify: `packages/app/src/app/components/modals/torrent-details/torrent-details.html`
- Modify: `packages/app/src/app/components/modals/torrent-details/torrent-details.spec.ts`
- Modify: `public/i18n/us.json`
- Modify: `public/i18n/hu.json`

**Interfaces:**

- Consumes: `TorrentDetailsActionsService` (Task 7) for every footer click handler, `TorrentDetailsDataService.localPath`/`.singleFile` (Task 6) for the Manage dropdown's conditional "Open destination" item.

- [ ] **Step 1: Add the new footer i18n keys to `public/i18n/us.json`**

Under `components.modals.torrent-details.general`, add a new `footer` object (a sibling of `toast`):

```json
"footer": {
  "playback": "Playback",
  "limits": "Limits",
  "manage": "Manage",
  "manage-header-path": "Path",
  "manage-header-category": "Category",
  "manage-header-tags": "Tags",
  "transfer-limits": "Transfer Limits"
}
```

- [ ] **Step 2: Add the matching Hungarian keys to `public/i18n/hu.json`**

Under the same path:

```json
"footer": {
  "playback": "Vezérlés",
  "limits": "Korlátok",
  "manage": "Kezelés",
  "manage-header-path": "Útvonal",
  "manage-header-category": "Kategória",
  "manage-header-tags": "Címkék",
  "transfer-limits": "Átviteli korlátok"
}
```

- [ ] **Step 3: Write the failing tests**

In `torrent-details.spec.ts`, extend `mockDataService` to also carry `localPath`/`singleFile`, and replace the actions-service override with a fully-spied object. Change:

```ts
let mockDataService: {
  activeTabId: ReturnType<typeof signal<any>>;
  selectTab: ReturnType<typeof vi.fn>;
  init: ReturnType<typeof vi.fn>;
  stopAll: ReturnType<typeof vi.fn>;
};
```

to:

```ts
let mockDataService: {
  activeTabId: ReturnType<typeof signal<any>>;
  localPath: ReturnType<typeof signal<string | null>>;
  singleFile: ReturnType<typeof signal<boolean>>;
  selectTab: ReturnType<typeof vi.fn>;
  init: ReturnType<typeof vi.fn>;
  stopAll: ReturnType<typeof vi.fn>;
};
let mockActionsService: Record<string, ReturnType<typeof vi.fn>>;
```

Change the `beforeEach` block's `mockDataService` literal and the `overrideComponent` call from:

```ts
const activeTabIdSignal = signal<any>('general');
mockDataService = {
  activeTabId: activeTabIdSignal,
  selectTab: vi.fn((id: any) => activeTabIdSignal.set(id)),
  init: vi.fn(),
  stopAll: vi.fn(),
};

await TestBed.configureTestingModule({
  imports: [TorrentDetails],
  providers: [
    { provide: NgbActiveModal, useValue: mockActiveModal },
    { provide: TorrentStoreService, useValue: { torrentsMap: signal(new Map()) } },
    {
      provide: CommandBusService,
      useValue: { commands$: commands$.asObservable(), emit: vi.fn() },
    },
    { provide: ConfirmService, useValue: { confirm: vi.fn().mockResolvedValue(true) } },
  ],
})
  .overrideComponent(TorrentDetails, {
    set: {
      providers: [
        ModalGuardService,
        { provide: TorrentDetailsDataService, useValue: mockDataService },
        { provide: TorrentDetailsActionsService, useValue: {} },
      ],
    },
  })
  .compileComponents();
```

to:

```ts
const activeTabIdSignal = signal<any>('general');
mockDataService = {
  activeTabId: activeTabIdSignal,
  localPath: signal<string | null>(null),
  singleFile: signal(false),
  selectTab: vi.fn((id: any) => activeTabIdSignal.set(id)),
  init: vi.fn(),
  stopAll: vi.fn(),
};
mockActionsService = {
  deleteTorrent: vi.fn(),
  resume: vi.fn(),
  pause: vi.fn(),
  forceResume: vi.fn(),
  openTransferLimitsModal: vi.fn(),
  openShareLimitsModal: vi.fn(),
  rename: vi.fn(),
  setLocation: vi.fn(),
  openPath: vi.fn(),
  changeCategory: vi.fn(),
  removeCategory: vi.fn(),
  changeTags: vi.fn(),
  removeAllTags: vi.fn(),
  forceReannounce: vi.fn(),
};

await TestBed.configureTestingModule({
  imports: [TorrentDetails],
  providers: [
    { provide: NgbActiveModal, useValue: mockActiveModal },
    { provide: TorrentStoreService, useValue: { torrentsMap: signal(new Map()) } },
    {
      provide: CommandBusService,
      useValue: { commands$: commands$.asObservable(), emit: vi.fn() },
    },
    { provide: ConfirmService, useValue: { confirm: vi.fn().mockResolvedValue(true) } },
  ],
})
  .overrideComponent(TorrentDetails, {
    set: {
      providers: [
        ModalGuardService,
        { provide: TorrentDetailsDataService, useValue: mockDataService },
        { provide: TorrentDetailsActionsService, useValue: mockActionsService },
      ],
    },
  })
  .compileComponents();
```

Add a new `describe('footer actions', ...)` block at the end of the file, before the final closing `});`:

```ts
describe('footer actions', () => {
  it('delete button calls actionsService.deleteTorrent', () => {
    const button: HTMLButtonElement = fixture.nativeElement.querySelector(
      '.modal-footer .btn-danger',
    );
    button.click();
    expect(mockActionsService['deleteTorrent']).toHaveBeenCalled();
  });

  it('reannounce button calls actionsService.forceReannounce', () => {
    const buttons: HTMLButtonElement[] = Array.from(
      fixture.nativeElement.querySelectorAll('.modal-footer > button'),
    );
    const reannounceButton = buttons.find((b) => b.textContent?.includes('force-reannounce'));
    reannounceButton?.click();
    expect(mockActionsService['forceReannounce']).toHaveBeenCalled();
  });

  describe('manage dropdown open-destination item', () => {
    it('is absent when there is no localPath', () => {
      mockDataService.localPath.set(null);
      fixture.detectChanges();
      const items: HTMLButtonElement[] = Array.from(
        fixture.nativeElement.querySelectorAll('[ngbDropdownItem]'),
      );
      expect(items.some((i) => i.textContent?.includes('open-destination'))).toBe(false);
    });

    it('is present when there is a localPath', () => {
      mockDataService.localPath.set('/local/path');
      fixture.detectChanges();
      const items: HTMLButtonElement[] = Array.from(
        fixture.nativeElement.querySelectorAll('[ngbDropdownItem]'),
      );
      const openDestinationItem = items.find((i) => i.textContent?.includes('open-destination'));
      expect(openDestinationItem).toBeDefined();
      openDestinationItem?.click();
      expect(mockActionsService['openPath']).toHaveBeenCalled();
    });
  });
});
```

(These assertions rely on the i18n test setup returning translation keys verbatim when no real translations are loaded - the same convention already relied on throughout this codebase's other component specs that check rendered text against `i18n` key fragments.)

- [ ] **Step 4: Run the tests to verify they fail**

Run: `npm run test --workspace=@bitbutler/app -- torrent-details.spec`
Expected: FAIL - the footer only renders a Close button today; there is no `.btn-danger`, no reannounce button, and no `[ngbDropdownItem]` elements.

- [ ] **Step 5: Add the footer icons to `torrent-details.ts`**

Change:

```ts
import { faAsterisk, faXmark } from '@fortawesome/free-solid-svg-icons';
import { NgbActiveModal, NgbTooltip } from '@ng-bootstrap/ng-bootstrap';
```

to:

```ts
import {
  faAsterisk,
  faBullhorn,
  faGauge,
  faPenToSquare,
  faPlay,
  faTrashCan,
  faXmark,
} from '@fortawesome/free-solid-svg-icons';
import { NgbActiveModal, NgbDropdownModule, NgbTooltip } from '@ng-bootstrap/ng-bootstrap';
```

Add `NgbDropdownModule` to the component's `imports` array (alongside the existing `NgbTooltip`):

```ts
  imports: [
    CommonModule,
    BbSpinner,
    NgComponentOutlet,
    AutofocusDirective,
    NgbTooltip,
    NgbDropdownModule,
    TranslatePipe,
    FontAwesomeModule,
    BbBtnContent,
  ],
```

Change:

```ts
  public readonly icon = { faAsterisk, faXmark };
```

to:

```ts
  public readonly icon = { faAsterisk, faBullhorn, faGauge, faPenToSquare, faPlay, faTrashCan, faXmark };
```

- [ ] **Step 6: Replace the footer in `torrent-details.html`**

Change:

```html
<div class="modal-footer">
  <button
    type="button"
    class="btn btn-link btn-sm btn-split"
    (click)="activeModal.dismiss()"
    autofocus
  >
    <bb-btn-content
      [icon]="icon.faXmark"
      [text]="'general.button.close' | translate"
      position="end"
    ></bb-btn-content>
  </button>
</div>
```

to:

```html
<div class="modal-footer">
  <button
    type="button"
    class="btn btn-danger btn-sm me-auto"
    [ngbTooltip]="'components.modals.torrent-details.general.delete' | translate"
    tooltipClass="danger"
    (click)="actionsService.deleteTorrent()"
  >
    <fa-icon [icon]="icon.faTrashCan" aria-hidden="true"></fa-icon>
  </button>

  <div ngbDropdown container="body" placement="top-start">
    <button type="button" class="btn btn-outline-secondary btn-sm btn-split" ngbDropdownToggle>
      <bb-btn-content
        [icon]="icon.faPlay"
        [text]="'components.modals.torrent-details.general.footer.playback' | translate"
        position="end"
      ></bb-btn-content>
    </button>
    <div ngbDropdownMenu class="bb-toolbar-dropdown">
      <button ngbDropdownItem type="button" (click)="actionsService.resume()">
        {{ 'components.modals.torrent-details.general.resume' | translate }}
      </button>
      <button ngbDropdownItem type="button" (click)="actionsService.pause()">
        {{ 'components.modals.torrent-details.general.pause' | translate }}
      </button>
      <button ngbDropdownItem type="button" (click)="actionsService.forceResume()">
        {{ 'components.modals.torrent-details.general.force-resume' | translate }}
      </button>
    </div>
  </div>

  <div ngbDropdown container="body" placement="top-start">
    <button type="button" class="btn btn-outline-secondary btn-sm btn-split" ngbDropdownToggle>
      <bb-btn-content
        [icon]="icon.faGauge"
        [text]="'components.modals.torrent-details.general.footer.limits' | translate"
        position="end"
      ></bb-btn-content>
    </button>
    <div ngbDropdownMenu class="bb-toolbar-dropdown">
      <button ngbDropdownItem type="button" (click)="actionsService.openTransferLimitsModal()">
        {{ 'components.modals.torrent-details.general.footer.transfer-limits' | translate }}
      </button>
      <button ngbDropdownItem type="button" (click)="actionsService.openShareLimitsModal()">
        {{ 'components.modals.torrent-details.general.edit-share-limits' | translate }}
      </button>
    </div>
  </div>

  <div ngbDropdown container="body" placement="top-start">
    <button type="button" class="btn btn-outline-secondary btn-sm btn-split" ngbDropdownToggle>
      <bb-btn-content
        [icon]="icon.faPenToSquare"
        [text]="'components.modals.torrent-details.general.footer.manage' | translate"
        position="end"
      ></bb-btn-content>
    </button>
    <div ngbDropdownMenu class="bb-toolbar-dropdown">
      <button ngbDropdownItem type="button" (click)="actionsService.rename()">
        {{ 'components.modals.torrent-details.general.rename' | translate }}
      </button>
      <div class="dropdown-divider"></div>
      <h6 class="dropdown-header">
        {{ 'components.modals.torrent-details.general.footer.manage-header-path' | translate }}
      </h6>
      <button ngbDropdownItem type="button" (click)="actionsService.setLocation()">
        {{ 'components.modals.torrent-details.general.relocate' | translate }}
      </button>
      @if (dataService.localPath()) {
      <button ngbDropdownItem type="button" (click)="actionsService.openPath()">
        {{ (dataService.singleFile() ? 'components.modals.torrent-details.general.show-file' :
        'components.modals.torrent-details.general.open-destination' ) | translate }}
      </button>
      }
      <div class="dropdown-divider"></div>
      <h6 class="dropdown-header">
        {{ 'components.modals.torrent-details.general.footer.manage-header-category' | translate }}
      </h6>
      <button ngbDropdownItem type="button" (click)="actionsService.changeCategory()">
        {{ 'components.modals.torrent-details.general.change-category' | translate }}
      </button>
      <button
        ngbDropdownItem
        type="button"
        [disabled]="!torrent()?.category"
        (click)="actionsService.removeCategory()"
      >
        {{ 'components.modals.torrent-details.general.remove-category' | translate }}
      </button>
      <div class="dropdown-divider"></div>
      <h6 class="dropdown-header">
        {{ 'components.modals.torrent-details.general.footer.manage-header-tags' | translate }}
      </h6>
      <button ngbDropdownItem type="button" (click)="actionsService.changeTags()">
        {{ 'components.modals.torrent-details.general.change-tags' | translate }}
      </button>
      <button
        ngbDropdownItem
        type="button"
        [disabled]="!torrent()?.tags"
        (click)="actionsService.removeAllTags()"
      >
        {{ 'components.modals.torrent-details.general.remove-all-tags' | translate }}
      </button>
    </div>
  </div>

  <button
    type="button"
    class="btn btn-outline-secondary btn-sm btn-split"
    (click)="actionsService.forceReannounce()"
  >
    <bb-btn-content
      [icon]="icon.faBullhorn"
      [text]="'components.modals.torrent-details.general.force-reannounce' | translate"
      position="end"
    ></bb-btn-content>
  </button>

  <button
    type="button"
    class="btn btn-link btn-sm btn-split"
    (click)="activeModal.dismiss()"
    autofocus
  >
    <bb-btn-content
      [icon]="icon.faXmark"
      [text]="'general.button.close' | translate"
      position="end"
    ></bb-btn-content>
  </button>
</div>
```

- [ ] **Step 7: Run the tests to verify they pass**

Run: `npm run test --workspace=@bitbutler/app -- torrent-details.spec`
Expected: PASS for all tests in the file.

- [ ] **Step 8: Run lint**

Run: `npm run lint`
Expected: PASS with zero warnings.

- [ ] **Step 9: Commit**

```bash
git add packages/app/src/app/components/modals/torrent-details/torrent-details.ts packages/app/src/app/components/modals/torrent-details/torrent-details.html packages/app/src/app/components/modals/torrent-details/torrent-details.spec.ts public/i18n/us.json public/i18n/hu.json
git commit -m "#183: move torrent details actions into footer buttons"
```

---

### Task 14: Remove the `docs/superpowers` folder and do final verification

**Files:** none added - this is a cleanup and verification pass.

- [ ] **Step 1: Run the full test suite**

Run: `npm test`
Expected: PASS for every workspace.

- [ ] **Step 2: Run lint**

Run: `npm run lint`
Expected: PASS with zero warnings.

- [ ] **Step 3: Manual verification in the running app**

Run: `npm start`

In the running app, with a server connected and at least one torrent present:

1. Open a torrent's details modal. Confirm the General tab shows correctly and the footer's Delete/Playback/Limits/Manage/Reannounce/Close buttons are all present and enabled appropriately (Remove category/Remove all tags disabled when the torrent has none set).
2. Switch to the Trackers tab - confirm it loads tracker rows. Switch away and back - confirm it refetches (e.g. observe a brief loading flash, or check dev tools network activity).
3. Switch to the Peers tab - confirm peers populate. Switch away and back - confirm the peer list resets and repopulates (a fresh `full_update`).
4. Switch to the Content tab - confirm the file tree loads and updates periodically. Rename a file and change a file's priority, save, and confirm both persist (re-open the modal or wait for the next poll tick to see the server-confirmed state).
5. From the footer, exercise each action at least once: Resume/Pause/Force resume, Transfer limits, Share limits, Rename, Relocate, Open destination (if a local path mapping resolves), Change/Remove category, Change/Remove tags, Reannounce - confirm each opens the right modal or shows the right toast.
6. Select a torrent in the grid (Torrent A) without selecting Torrent B, right-click Torrent B and choose "Details", delete it from the footer's Delete button, and confirm: Torrent B is deleted (not A), the grid's selection still shows A as selected, the details modal closes, and no error toast appears.
7. Open the details modal for a torrent, switch to a tab other than General (e.g. Content), then delete the torrent from the grid toolbar while that modal is open - confirm the modal closes cleanly with no error toast, regardless of which tab was active.

- [ ] **Step 4: Remove the spec/plan docs before opening a PR**

Per this repo's convention, `docs/superpowers/specs/` and `docs/superpowers/plans/` must not be merged to `main`. Once every step above is verified:

```bash
git rm -r docs/superpowers
git commit -m "#183: removed spec and plan"
```

- [ ] **Step 5: Update this plan's checklist**

Mark every checkbox in this file as complete once verified - though by this point `docs/superpowers` no longer exists in the working tree, so this is really just a sanity confirmation that nothing was skipped before opening the PR.
