# Torrent list initial load performance - design

Issue: #318

## Problem

Two symptoms, one root cause area (the initial maindata load pipeline):

1. **Grid stutter/delay for large torrent counts.** `packages/electron/src/ipc/qbittorrent.ts`'s `qbSyncMaindataStream` fetches the full maindata snapshot from qBittorrent in one HTTP call, then artificially drip-feeds it to the renderer in fixed 500-row chunks with a 15ms `setTimeout` between each chunk. For ~10,000 torrents that's ~20 chunks, ~300ms of pure artificial delay, 20 separate IPC round-trips, and 20 separate `TorrentStoreService` signal writes (each invalidating `torrentsArray` and every computed derived from it). This chunking was added to avoid UI stutter before ag-Grid's `applyTransaction` incremental API and the store's delta-based updates existed; both now exist (`grid-pin.service.ts`), and ag-Grid already virtualizes rendering regardless of row count, so the chunking no longer buys anything and is now the primary source of visible latency.

2. **Cold-start "add torrent" delay.** `App`'s `_openDraftsEffect` (`app.ts`) only routes a queued "open .torrent file" draft to the Add Torrent modal once `TorrentStoreService.isPrimed()` is true. `isPrimed` is only set inside `applyMaindata()` on a non-streaming update. Every payload during the initial chunked load is tagged `_isStreamingChunk: true`, so priming never happens from the stream itself - the stream's `done` event is in fact swallowed inside `QbPollingService` and never reaches `applyMaindata` at all. Priming only happens once the _first background poll_ fires after the stream completes, which is a whole extra HTTP round-trip to qBittorrent tacked on after the chunked load. On a server with many torrents, opening a `.torrent` file while the app is closed can take several seconds with no visible feedback before the Add Torrent dialog appears.

## Approach

Keep the existing full-in-memory-load architecture (client-side row model, everything in `TorrentStoreService`, filtering/sorting done client-side) - qBittorrent's `sync/maindata` API returns whole-state snapshots with no server-side paging, and 10k small JS objects is not "big data" for V8 or for ag-Grid's virtualized rendering. The delay is self-inflicted, not fundamental.

qBittorrent's `rid`-based sync is self-healing: passing a stale/unknown `rid` simply yields a fresh `full_update` instead of an error. This means "initial load" does not need to be architecturally distinct from "a poll tick" - the first poll tick _is_ the initial load. The design leans on this to collapse the custom streaming protocol into the same plain request the background poll already uses, and to make "stop polling, resume later" free of any manual cache/diff bookkeeping.

## Changes

### 1. Remove the chunked streaming protocol

- **`packages/electron/src/ipc/qbittorrent.ts`**: delete `qbSyncMaindataStream` and the `qb:sync-maindata-stream` listener. No replacement handler is needed - the existing generic `qb:request` handler (already used by `qb.sync.maindata`) covers it.
- **`packages/electron/src/preload.ts`**: remove `onSyncChunk` / `startSyncStream` from `window.bitbutler.qb`.
- **`packages/app/src/app/services/qb.service.ts`**: remove `sync.streamMaindata` and `StreamMaindataState`. `sync.maindata(serverId, rid)` (already exists, used by the background poll) becomes the only maindata-fetching method.
- **`packages/app/src/app/services/torrent-store.service.ts`**: remove `_isStreamingChunk` / `StreamableMaindata`. Every `applyMaindata()` call is now a complete, real update; priming happens exactly when data lands, with no separate "streaming" state to track.
- **`packages/shared`**: remove `BitButlerSyncStreamPayload` and the corresponding IPC contract entries from `ipc.types.ts`.
- Drop `sortBy`/`sortDesc` end to end (IPC payload, `qbRequest` query, `QbPollingService.startMaindataPolling` signature, and the call site in `main.ts`). These existed only to make progressively-trickled chunk rows appear in roughly final order; with a single-shot load ag-Grid applies its own column sort instantly on `rowData` regardless of arrival order, so server-side pre-sorting is moot.

### 2. Unify initial load and background poll in `QbPollingService`

- `createBackgroundPoll`'s existing `interval(pollMs).pipe(startWith(0), ...)` already performs an immediate first fetch using whatever `rid` is currently cached in `maindataRid$`. `startMaindataPolling` no longer needs a separate "fetch everything, then start polling" phase - starting the poll loop _is_ the initial load.
- `QbPollingService` tracks the last-polled `serverId`. `maindataRid$` is reset to 0 (a genuine fresh start, `TorrentStoreService` rebuilding from scratch via `full_update`) only when:
  - the `serverId` passed to `startMaindataPolling` differs from the last one polled (server switch), or
  - polling is stopped via an explicit reset path (e.g. logout, unrecoverable 401/403 loop) as today.
- Plain subscription teardown (e.g. a future route navigating away from the torrent list) does **not** go through a reset path and does **not** clear `TorrentStoreService`. Resuming later starts the poll loop again with whatever `rid` was last known:
  - if still valid server-side, qBittorrent returns a cheap delta;
  - if stale, qBittorrent returns a `full_update`, handled by the existing `applyMaindata` full-update branch exactly as a fresh load would be.
  - Either way, this is never worse than forcing `rid` back to 0, and is often much cheaper. No manual array/rid caching is needed - `TorrentStoreService`'s map already stays warm as long as nothing calls `clear()`.
- `_isInitialLoading$` continues to flip true - just before the first fetch of a genuine reset - and false - once that first fetch resolves, whether it lands as a delta or a full update. `UiCommandHandlerService.waitForInitialLoad()` (used by the server-switch loading modal) keeps working unchanged, since it only cares about that true - false transition.

### 3. `isPrimed` fix falls out of the above

With no more `_isStreamingChunk` concept, `TorrentStoreService.applyMaindata()` sets `_isPrimed` true on the very first call it ever processes for a (re)primed session - immediately after the single initial fetch resolves, not after an extra background-poll round-trip. `App`'s `_openDraftsEffect` requires no changes; the thing it waits on now flips at the right time.

## Out of scope (noted for the future, not implemented now)

A future "logs" route (or similar) that doesn't need torrent data was discussed: when the user is not looking at the torrent list, polling should stop entirely rather than continuing at a throttled rate (unlike window-minimize, which keeps polling at a slower interval - that behavior is unchanged). The `rid`-preserving, no-clear-on-stop design above is exactly what makes that cheap to add later: whatever component/service ends up owning "should we be polling right now" only needs to start/stop the subscription; it never needs to reset `maindataRid$` or clear the store itself. No route exists yet, so no navigation-lifecycle code changes are part of this change.

## Testing

- `qb-polling.service.spec.ts`: replace streaming-state assertions (chunk/metadata/done handling) with assertions against the unified poll pipeline; add cases for same-server resume (no rid reset) vs. server-switch reset (rid reset to 0).
- `torrent-store.service.spec.ts`: remove `_isStreamingChunk` cases; add/adjust a case confirming `isPrimed()` flips true on the very first `applyMaindata()` call after a reset.
- `qbittorrent.spec.ts` (electron): remove `qbSyncMaindataStream` chunk-timing tests (handler deleted).
- Manual verification:
  - Point at (or simulate) a server with ~10k torrents; confirm the grid populates in one paint with no visible chunk-by-chunk trickle.
  - Confirm opening a `.torrent` file while the app is closed shows the Add Torrent modal promptly once login completes, on a server with many torrents.
  - Confirm switching servers still shows the "switching server" loading modal for the correct duration and always ends up with the new server's data.
