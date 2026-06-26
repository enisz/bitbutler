# Torrent Details Live Poll When Paused Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Keep the General tab of the torrent details modal live when background polling is paused, by polling `/api/v2/torrents/info` for the open torrent on each properties poll tick.

**Architecture:** On each 2-second tick of `propertiesPoll$()`, take a snapshot of `QbPollingService.isPaused$`; when paused, also call a new `fetchTorrentInfo()` method that fetches `/api/v2/torrents/info?hashes=<hash>` and stores the result in a new `localTorrentData` signal. The `torrent` computed prefers `localTorrentData()` over the store, falling back to the store when `localTorrentData` is null.

**Tech Stack:** Angular 20 (zoneless, signals), RxJS, Vitest

## Global Constraints

- Commit format: `#190: short description`
- Zero lint warnings (`npm run lint`)
- All tests must pass (`npm test`)
- No changes to `General` component, `UiCommandHandlerService`, or `TorrentDetails`

---

### Task 1: Add `QbService.torrents.info()`

**Files:**

- Modify: `packages/app/src/app/services/qb.service.ts`
- Test: `packages/app/src/app/services/qb.service.spec.ts`

**Interfaces:**

- Produces: `qbService.torrents.info(serverId: string, hash: string): Promise<Torrent | null>` — calls `/api/v2/torrents/info?hashes=<hash>`, returns first array element or `null` for empty response

- [ ] **Step 1: Write the failing tests**

Add to `packages/app/src/app/services/qb.service.spec.ts`, inside the existing `describe('QbService', ...)` block:

```typescript
describe('torrents.info()', () => {
  it('calls /api/v2/torrents/info with the correct hash and returns the first torrent', async () => {
    const torrent = { hash: 'abc123', name: 'My Torrent' };
    vi.spyOn(window.bitbutler.qb, 'request').mockResolvedValue([torrent] as any);

    const result = await service.torrents.info('server-1', 'abc123');

    expect(window.bitbutler.qb.request).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'server-1',
        path: '/api/v2/torrents/info',
        method: 'GET',
        query: { hashes: 'abc123' },
      }),
    );
    expect(result).toEqual(torrent);
  });

  it('returns null when the response array is empty', async () => {
    vi.spyOn(window.bitbutler.qb, 'request').mockResolvedValue([] as any);
    const result = await service.torrents.info('server-1', 'abc123');
    expect(result).toBeNull();
  });

  it('rejects when hash is empty', async () => {
    await expect(service.torrents.info('server-1', '')).rejects.toThrow('hash is required');
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

```bash
npm test -- --reporter=verbose 2>&1 | grep -A 3 "torrents.info"
```

Expected: 3 failing tests with `torrents.info is not a function` or similar.

- [ ] **Step 3: Add `info()` to `QbService.torrents`**

In `packages/app/src/app/services/qb.service.ts`, the `readonly torrents = { ... }` block needs `Torrent` added to its imports. The file already imports from `'../models/torrent.model'` but only `QbCategory`, `QbTorrentContent`, `QbTorrentPeersResponse`. Add `Torrent` there:

```typescript
import {
  Maindata,
  QbCategory,
  QbTorrentContent,
  QbTorrentPeersResponse,
  Torrent,
} from '../models/torrent.model';
```

Then inside `readonly torrents = { ... }`, add this method after `properties`:

```typescript
info: async (serverId: string, hash: string): Promise<Torrent | null> => {
  const cleanHash = (hash ?? '').trim();
  if (!cleanHash) return Promise.reject(new Error('hash is required'));
  const res = await this.request<Torrent[]>(serverId, {
    path: '/api/v2/torrents/info',
    method: 'GET',
    query: { hashes: cleanHash },
  });
  if (res.ok) return res.body[0] ?? null;
  throw new HttpError(res.status, res.statusText, `Failed to get torrent info`);
},
```

- [ ] **Step 4: Run the tests to verify they pass**

```bash
npm test -- --reporter=verbose 2>&1 | grep -A 3 "torrents.info"
```

Expected: 3 passing tests.

- [ ] **Step 5: Lint**

```bash
npm run lint
```

Expected: 0 errors, 0 warnings.

- [ ] **Step 6: Commit**

```bash
git add packages/app/src/app/services/qb.service.ts packages/app/src/app/services/qb.service.spec.ts
git commit -m "$(cat <<'EOF'
#190: add QbService.torrents.info() for single-torrent fetch

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: Add `localTorrentData`, `fetchTorrentInfo()`, update `propertiesPoll$()` and `torrent` computed

**Files:**

- Modify: `packages/app/src/app/components/modals/torrent-details/torrent-details-data.service.ts`
- Test: `packages/app/src/app/components/modals/torrent-details/torrent-details-data.service.spec.ts`

**Interfaces:**

- Consumes: `qbService.torrents.info(serverId, hash): Promise<Torrent | null>` (from Task 1)
- Consumes: `qbPollingService.isPaused$: Observable<boolean>` (existing)
- Produces: `localTorrentData: Signal<Torrent | null>` on `TorrentDetailsDataService`

- [ ] **Step 1: Write the failing tests**

**Update the mock setup in `beforeEach`** in `torrent-details-data.service.spec.ts`:

Add `BehaviorSubject` to the rxjs import:

```typescript
import { BehaviorSubject, Subject } from 'rxjs';
```

Add two new mock variables at the top of the `describe` block (alongside `startPeersPolling` etc.):

```typescript
let qbTorrentsInfo: ReturnType<typeof vi.fn>;
let isPaused$: BehaviorSubject<boolean>;
```

In `beforeEach`, initialize them:

```typescript
qbTorrentsInfo = vi.fn().mockResolvedValue(null);
isPaused$ = new BehaviorSubject<boolean>(false);
```

Update the `QbService` mock to include `info`:

```typescript
{
  provide: QbService,
  useValue: {
    torrents: {
      properties: qbTorrentsProperties,
      trackers: qbTorrentsTrackers,
      files: qbTorrentsFiles,
      info: qbTorrentsInfo,
    },
    log: { main: qbLogMain },
  },
},
```

Update the `QbPollingService` mock to include `isPaused$`:

```typescript
{ provide: QbPollingService, useValue: { startPeersPolling, isPaused$ } },
```

Then add the new test cases. Add a new `describe` block after the existing `'properties polling'` describe:

```typescript
describe('torrent info polling (when paused)', () => {
  it('does not call torrents.info when polling is not paused', async () => {
    isPaused$.next(false);
    service.init('abc123', {});
    await vi.advanceTimersByTimeAsync(0);

    expect(qbTorrentsInfo).not.toHaveBeenCalled();
  });

  it('calls torrents.info when polling is paused', async () => {
    isPaused$.next(true);
    service.init('abc123', {});
    await vi.advanceTimersByTimeAsync(0);

    expect(qbTorrentsInfo).toHaveBeenCalledWith('server-1', 'abc123');
  });

  it('sets localTorrentData when polling is paused and info returns a torrent', async () => {
    const torrent = makeTorrent({ hash: 'abc123', dlspeed: 9999 });
    qbTorrentsInfo.mockResolvedValue(torrent);
    isPaused$.next(true);
    service.init('abc123', {});
    await vi.advanceTimersByTimeAsync(0);

    expect(service.localTorrentData()).toEqual(torrent);
  });

  it('calls torrents.info again on the next poll tick when still paused', async () => {
    isPaused$.next(true);
    service.init('abc123', {});
    await vi.advanceTimersByTimeAsync(0);
    expect(qbTorrentsInfo).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(2000);
    expect(qbTorrentsInfo).toHaveBeenCalledTimes(2);
  });

  it('does not call torrents.info on subsequent ticks after polling resumes', async () => {
    isPaused$.next(true);
    service.init('abc123', {});
    await vi.advanceTimersByTimeAsync(0);
    expect(qbTorrentsInfo).toHaveBeenCalledTimes(1);

    isPaused$.next(false);
    await vi.advanceTimersByTimeAsync(2000);
    expect(qbTorrentsInfo).toHaveBeenCalledTimes(1);
  });

  it('logs and does not throw when fetchTorrentInfo fails', async () => {
    qbTorrentsInfo.mockRejectedValueOnce(new Error('network error'));
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    isPaused$.next(true);
    service.init('abc123', {});
    await vi.advanceTimersByTimeAsync(0);

    expect(consoleError).toHaveBeenCalled();
    expect(service.localTorrentData()).toBeNull();
  });

  it('resets localTorrentData to null when stopAll is called', async () => {
    const torrent = makeTorrent({ hash: 'abc123' });
    qbTorrentsInfo.mockResolvedValue(torrent);
    isPaused$.next(true);
    service.init('abc123', {});
    await vi.advanceTimersByTimeAsync(0);
    expect(service.localTorrentData()).toEqual(torrent);

    service.stopAll();
    expect(service.localTorrentData()).toBeNull();
  });
});
```

Also add two tests inside the existing `describe('torrent computed', ...)` block:

```typescript
it('uses localTorrentData over the store when localTorrentData is non-null', async () => {
  const storeTorrent = makeTorrent({ hash: 'abc123', dlspeed: 100 });
  const localTorrent = makeTorrent({ hash: 'abc123', dlspeed: 9999 });
  torrentsMap.set(new Map([['abc123', storeTorrent]]));
  qbTorrentsInfo.mockResolvedValue(localTorrent);
  isPaused$.next(true);
  service.init('abc123', {});
  await vi.advanceTimersByTimeAsync(0);

  expect(service.torrent()?.data.dlspeed).toBe(9999);
});

it('falls back to store data when localTorrentData is null', async () => {
  const storeTorrent = makeTorrent({ hash: 'abc123', dlspeed: 100 });
  torrentsMap.set(new Map([['abc123', storeTorrent]]));
  isPaused$.next(false);
  service.init('abc123', {});
  await vi.advanceTimersByTimeAsync(0);

  expect(service.torrent()?.data.dlspeed).toBe(100);
});
```

- [ ] **Step 2: Run the tests to verify they fail**

```bash
npm test -- --reporter=verbose 2>&1 | grep -E "(FAIL|localTorrentData|torrent info polling)"
```

Expected: Multiple failures — `localTorrentData is not a function`, `isPaused$ is not defined`, etc.

- [ ] **Step 3: Implement the changes in `TorrentDetailsDataService`**

Open `packages/app/src/app/components/modals/torrent-details/torrent-details-data.service.ts`.

**3a. Add `take` to the rxjs import:**

```typescript
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
```

**3b. Add `Torrent` to the torrent model import:**

```typescript
import {
  QbTorrentContent,
  QbTorrentPeer,
  QbTorrentPeersResponse,
  Torrent,
} from '../../../models/torrent.model';
```

**3c. Add the `localTorrentData` signal** in the signal declarations block (after `public readonly errorLog = signal<QbLogEntry | null>(null);`):

```typescript
public readonly localTorrentData = signal<Torrent | null>(null);
```

**3d. Update the `torrent` computed** (replace the existing one):

```typescript
public readonly torrent: Signal<MergedTorrent | null> = computed(() => {
  const data =
    this.localTorrentData() ?? this.torrentStoreService.torrentsMap().get(this.hashSignal());
  const properties = this.properties();
  return !data || !properties ? null : { data, properties };
});
```

**3e. Update `propertiesPoll$()`** (replace the existing method):

```typescript
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
```

**3f. Add the `fetchTorrentInfo()` method** (after `fetchProperties()`):

```typescript
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
```

**3g. Update `stopAll()`** (add the reset):

```typescript
public stopAll(): void {
  this.destroyed$.next();
  this.localTorrentData.set(null);
}
```

- [ ] **Step 4: Run the tests to verify they pass**

```bash
npm test -- --reporter=verbose 2>&1 | grep -E "(PASS|FAIL|torrent info polling|torrent computed)"
```

Expected: All tests pass.

- [ ] **Step 5: Run the full test suite**

```bash
npm test
```

Expected: All tests pass, no failures.

- [ ] **Step 6: Lint**

```bash
npm run lint
```

Expected: 0 errors, 0 warnings.

- [ ] **Step 7: Commit**

```bash
git add packages/app/src/app/components/modals/torrent-details/torrent-details-data.service.ts packages/app/src/app/components/modals/torrent-details/torrent-details-data.service.spec.ts
git commit -m "$(cat <<'EOF'
#190: poll torrent info on general tab when background polling is paused

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
```
