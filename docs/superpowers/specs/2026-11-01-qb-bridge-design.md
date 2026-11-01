# qBittorrent bridge: intent-level IPC with typed results

## Intent and why

The renderer should not know that qBittorrent is an HTTP API. Today `QbService`
(`packages/app/src/app/services/qb.service.ts`, ~950 lines, ~75 methods, used by 32 files) builds
qBittorrent URLs and form bodies itself and sends them through a generic proxy,
`window.bitbutler.qb.request({ path, method, form, ... })`. The consequences:

- Version quirks end up in the renderer. qBittorrent 5.0 (WebAPI 2.11) renamed
  `torrents/pause|resume` to `torrents/stop|start` and removed the old names. The renderer probes
  and caches which pair works (`runTorrents`/`runApiCache`), while the tray and the post-import
  resume in the main process hard-code the old names and fail on 5.x (fixed narrowly in #379).
  Pause/resume has caused trouble more than once.
- Errors cross IPC as thrown strings (`Error invoking remote method ...: {json}`), so the renderer
  parses status codes back out of message text (`extractJson`, `extractIpcStatus`).
- The same endpoint knowledge exists twice: in the renderer and in the 35 `qbRequest` call sites in
  the main process (`export.ts` 28, `qbittorrent.ts` 4, `torrent-add-queue.ts` 2, `tray.ts` 1).

Goal: the renderer calls intent-level methods (`qb.torrents.stop(serverId, hashes)`), passes plain
parameters, and gets a typed result back. The main process owns URLs, versions, fallbacks,
form encoding, re-login and error mapping, once, for every caller.

## Goals

- `window.bitbutler.qb` becomes a set of typed intent-level methods, grouped like `QbService`
  today: `auth`, `app`, `log`, `sync`, `torrents`, `transfer` (tags and categories stay under
  `torrents`, as now).
- No qBittorrent path, endpoint name, HTTP status or version appears in `packages/app`.
- Every bridge method returns `IpcResult<T>`; expected failures are returned, not thrown.
- The main process fetches and caches the server's WebAPI/qBittorrent version itself.
- The main-process call sites (`export.ts`, `tray.ts`, `torrent-add-queue.ts`) use the same domain
  layer, so each endpoint rule lives in one place.
- Implemented in one change, with the old generic path deleted in the same change.

## Non-goals

- Polling/maindata stays an RxJS loop in `QbPollingService`; it merely calls the `sync.maindata`
  bridge method instead of the generic proxy. Redesigning polling is out of scope.
- No change to the stores (`TorrentStoreService`, `ServerStoreService`), the command bus or its
  handler services, the toast rules, or any visible UI.
- No change to the `.bbe` export format or to import/export behaviour beyond using the shared layer.

## Anti-goals (failure even if it technically works)

- A renderer that can still construct a URL or pass a path to the main process.
- Raw HTTP status codes leaking into the renderer.
- A behaviour change users can see: same toasts, same retry feel, same login flow.
- Two copies of any endpoint rule.

## Decisions (made with the user)

1. **Result envelope**, in `@bitbutler/shared`:

   ```ts
   type IpcResult<T> = { ok: true; data: T } | { ok: false; code: QbErrorCode; message: string };
   ```

   `message` is the raw detail only (fits the repo's toast rules; the renderer supplies the title).

2. **Own named codes, not HTTP numbers.** Starting set (the set is the user's call to refine; the
   exact members below are a first draft):
   `UNAUTHENTICATED`, `FORBIDDEN`, `NOT_FOUND`, `CONFLICT`, `UNREACHABLE`, `UNSUPPORTED`,
   `INVALID`, `FAILED`. `CONFLICT` (HTTP 409) was added when planning: `torrent-add-queue` detects
   duplicate adds by 409, and qBittorrent also uses 409 for rename/category state conflicts.
   `UNREACHABLE` means any transient failure worth retrying (network error, timeout, 408, 429, 5xx).
   The main process maps HTTP statuses and network errors onto them.

3. **`QbService` unwraps and throws.** It becomes a thin wrapper that converts a failed
   `IpcResult` into a typed `QbError(code, message)` and throws it, so its 32 consumers keep their
   `try/catch` and toast code. Consumers that care can branch on `error.code`. `HttpError` and the
   string-parsing helpers are removed.

4. **The main process fetches and caches the version itself** on login. The renderer no longer
   calls `export.getServerInfo` + `server.setConnectionInfo` at login (`login.ts` ~lines 229-247).

5. **Big-bang delivery**, one branch/PR; `qb:request` and the renderer `runTorrents` plumbing are
   deleted in the same change.

## Calls made by the author (not decided with the user; flag if wrong)

- **Version rule for start/stop:** WebAPI >= 2.11.0 tries `start`/`stop` first, otherwise
  `resume`/`pause`; unknown version tries the old pair first. The rename is not documented; the
  exact version is a guess (5.0.0 ships WebAPI 2.11.2, 4.6.x is 2.9.x). The 404 fallback and a
  per-server cache of the pair that worked make a wrong threshold cost one extra request, never a
  failure. Same pattern may be needed for any other renamed endpoint found while migrating.
- **Re-login stays in the main process:** a 401/403 on a non-login call triggers one silent
  re-login (the main process already owns the cookie jar) and one retry. If that fails the result
  is `UNAUTHENTICATED`, which makes the renderer call `forceLogout`. A 403 on the login call itself
  maps to `FORBIDDEN` (qBittorrent uses 403 for IP bans).
- **Transient network retry stays in `QbService`:** on `UNREACHABLE` it keeps today's up-to-3
  attempts with backoff and the "connection retry" warning toast, so the visible behaviour is
  unchanged. The main process does not retry network errors.
- **Input normalisation moves to the main process:** hash-list cleaning, joining with `|`,
  `'all'` handling, empty-list no-op, and the `paused` -> `stopped` option mapping in torrent add.
- **`export_available` moves with the version:** it is probed in the same login-time step and
  stored with `webapi_version`/`qb_version`; `server:set-connection-info` and the renderer's
  login-time probe are removed. `export:get-server-info` can keep serving the export modal from
  stored data.
- **`login`, `logout`, `hasCookie`** also move to `IpcResult` for consistency. `torrentsAdd` is
  dropped from the renderer contract: nothing in the renderer calls it (adds go through
  `torrentQueue`); `qbTorrentsAdd` stays a main-process function.
- **The contract has 56 methods** (`QbService` today: auth 3, app 2, log 2, sync 2, torrents 41,
  transfer 6). `pause`/`resume` are `stop`/`start` on the bridge; `QbService` keeps its own
  `pause`/`resume` names so consumers do not change.
- **`torrent-add-queue.ts` already has a private re-login + retry layer** (`withRecovery`) because
  background work in the main process never went through `QbService.request`. The shared core
  replaces its re-login part; its transient-retry loop stays there (background work has no toast).
- **Delivery housekeeping:** a `maintenance`-labelled issue; update the CLAUDE.md architecture
  lines that describe `qbittorrent.ts` as a generic axios proxy.

## Existing behaviour the wrapper must preserve (found in the code)

- `QbService.request` itself shows a danger toast on every failed call (title
  `services.qb.error.request-failed-title`, message = the response body or error message) unless
  the call passes `suppressErrors`. The new `QbService` wrapper must keep showing that toast when it
  converts a failed result into a `QbError`. The only `suppressErrors` user is the pause/resume
  endpoint probe, which disappears.
- `grid-inline-edit.service.ts:134-136` relies on this: it skips its own toast when the caught
  error is an `HttpError`, because `QbService` already showed one. It must test for `QbError`
  instead.
- `qb-polling.service.ts:131` treats `err.status` 401/403 as "session lost". It must test for
  `QbError` with `code === 'UNAUTHENTICATED'` instead.
- These are the only two consumers outside `qb.service.ts` that inspect the error type or status
  (checked with a grep for `HttpError` and `.status`), so removing `HttpError` is contained.

## Constraints

- Keep the IPC contract in `@bitbutler/shared` (`BitButlerAPI`) as the single source of truth;
  `packages/app` and `packages/electron` must both compile against it.
- Angular 22 zoneless; no `fetch()` or Node APIs in the renderer.
- Lint passes with zero warnings; existing Prettier/Husky hooks apply.
- Passwords and the cookie jar never cross IPC.

## What is left to the builder

- **IPC channel layout.** Recommendation: one channel (`qb:call`) dispatching to a registry of
  handlers keyed by method name, with an allowlist so the renderer cannot invoke arbitrary names,
  and the preload exposing the typed methods. Per-method channels are the alternative if typing the
  registry proves awkward.
- **Main-process module layout** (recommendation: `packages/electron/src/qb/` with one file per
  domain mirroring the `QbService` groups, plus a small shared request/error-mapping core).
- Exact method signatures per domain, kept as close to `QbService`'s current signatures as
  possible so call sites do not change.
- The precise `QbErrorCode` mapping table, including network-error and timeout handling.
- Test plan: per-domain Vitest specs in the main process using the existing `fetch` mock pattern
  (`qbittorrent.spec.ts`); `qb.service.spec.ts` rewritten to mock the bridge returning
  `IpcResult`; update `packages/app/src/test-setup.ts` for the new `window.bitbutler.qb` shape.
- Migration order within the single change, and confirming nothing else references `HttpError`
  or `qb.request` before deleting them.

## Verification

- `npm run lint`, `npm test` (all workspaces), `npm run build` and `npm run build:electron` pass.
- Manual smoke test against a 5.x server and, if available, a 4.x server: login, pause/resume (a
  single torrent and all), tags/categories, set location, rename, delete, add torrent, export and
  import with "start after import", tray start/stop all, session expiry (forced logout), and
  server unreachable (retry toast).
