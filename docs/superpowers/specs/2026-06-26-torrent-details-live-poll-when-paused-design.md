# Design: Torrent Details Live Poll When Background Polling Is Paused

**Date:** 2026-06-26
**Issue:** #190 (pause-polling-on-modal feature)

## Problem

When `pausePollingOnModal` is enabled in the torrent list grid settings, opening any modal causes `QbPollingService.pause()` to be called. This stops the maindata background polling, which means `TorrentStoreService.torrentsMap()` stops receiving updates.

The `TorrentDetailsDataService.torrent` computed signal merges two data sources:

1. `torrentStoreService.torrentsMap().get(hash)` - live torrent state (progress, speed, ETA, state, etc.) - stops updating when polling is paused
2. `properties` signal - from `/api/v2/torrents/properties` - polled every 2s via its own `timer()` - continues updating regardless

This means the General tab of the torrent details modal shows stale torrent data (speed, progress, state, etc.) while the modal is open.

## Goal

Keep the General tab's torrent data live while the modal is open, even when background polling is paused. Other modals and the torrent list grid are unaffected.

## Design

### Approach: Reactive switch in `propertiesPoll$()`

When the general tab is active, `propertiesPoll$()` drives a `timer(0, 2000)`. Each tick calls `fetchProperties()`. The change extends each tick to also check `QbPollingService.isPaused$` and, when paused, call a new `fetchTorrentInfo()` that hits `/api/v2/torrents/info?hashes=<hash>` and stores the result in a new `localTorrentData` signal.

The `torrent` computed is updated to prefer `localTorrentData()` over the store data, falling back to the store when `localTorrentData` is `null`.

### Data flow

```
General tab active
  └── propertiesPoll$() (timer 0, 2000ms)
        ├── fetchProperties() → properties signal  [always]
        └── isPaused$ snapshot → fetchTorrentInfo() [only when paused]
              └── /api/v2/torrents/info?hashes=<hash>
                    └── localTorrentData signal

torrent computed:
  data = localTorrentData() ?? torrentsMap().get(hash)
  properties = properties()
```

### Changes

#### 1. `QbService` - new `torrents.info()` method

Add `info(serverId: string, hash: string): Promise<Torrent | null>` to `QbService.torrents`. Calls `/api/v2/torrents/info?hashes=<hash>`, returns the first element of the array response (which already includes the `hash` field) or `null` if the array is empty.

#### 2. `TorrentDetailsDataService`

- Add `readonly localTorrentData = signal<Torrent | null>(null)` - reset to `null` in `stopAll()`.
- Modify `propertiesPoll$()` to take a snapshot of `isPaused$` on each timer tick and co-fetch torrent info only when paused:

  ```typescript
  private propertiesPoll$(): Observable<void> {
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

- Add `fetchTorrentInfo()` - calls `qbService.torrents.info()`, sets `localTorrentData`. Catches and logs errors without re-throwing (same pattern as `fetchProperties()`).

- Update `torrent` computed:
  ```typescript
  public readonly torrent: Signal<MergedTorrent | null> = computed(() => {
    const data =
      this.localTorrentData() ?? this.torrentStoreService.torrentsMap().get(this.hashSignal());
    const properties = this.properties();
    return !data || !properties ? null : { data, properties };
  });
  ```

#### 3. No changes to

- `General` component
- `UiCommandHandlerService`
- `TorrentDetails` component
- Any other tab's data fetching

### Error handling

`fetchTorrentInfo()` follows the same pattern as `fetchProperties()`: `try/catch`, `console.error`, no re-throw, so the poll timer always continues.

### Cleanup

`localTorrentData` is reset to `null` in `stopAll()` so it does not leak stale data if the modal is re-opened for a different torrent.

## Testing

- New test in `torrent-details-data.service.spec.ts`: when `isPaused$` emits `true`, the next poll tick calls `qbService.torrents.info()` and `localTorrentData` is set to the returned value.
- New test: when `isPaused$` emits `false`, `qbService.torrents.info()` is not called.
- New test: `torrent` computed uses `localTorrentData()` when it is non-null.
- New test: `torrent` computed falls back to `torrentsMap` data when `localTorrentData` is `null`.
- New test in `qb.service.spec.ts`: `torrents.info()` returns the first torrent from the response array, or `null` for empty arrays.
