# Multi-page navigation shell - design spec

Issue: #319

## Overview

BitButler has one real page today (the torrent list, `Main`) plus `Login`. Every
other screen (Settings, Add Torrent, etc.) is an `NgbModal` stacked on top of
`Main`. This spec introduces the minimum navigation shell needed to host future
peer pages (Statistics, Log Viewer, Settings-as-a-page) - a persistent nav rail
and a routing skeleton - and fixes the polling-lifecycle bug that any new sibling
route would otherwise expose.

## Goals

- Add a persistent, non-collapsible navigation rail as the entry point for
  switching between top-level pages.
- Restructure routing so a page component can be unmounted and remounted by
  navigation (not just by session loss) without losing torrent data.
- Give `QbPollingService` sole ownership of the fresh-load-vs-resume decision,
  including clearing `TorrentStoreService`, so no page component has to get
  this right on its own.

## Non-goals

- Statistics page content.
- Log Viewer page content.
- Settings as a routed page (it keeps opening as an `NgbModal` via the existing
  `UI_OPEN_SETTINGS` command, unchanged).
- Any rail icon other than Torrents. No disabled/"coming soon" placeholders.
- Registering `/pages/settings` or `/pages/logs` routes. Their eventual shape is
  documented below for context only.

## Current architecture (before this change)

- `app.routes.ts` defines `pages/login` and `pages/main` as lazy-loaded
  siblings under one `pages` parent, rendered through the single
  `<router-outlet>` in `app.html`.
- `Main` (`pages/main/main.ts` + `.html`) owns its entire layout: brand block,
  connection-status dot, the collapsible filter sidebar (`app-status`), the
  button bar, the grid, and the footer server-state bar.
- `Main`'s constructor effect (`_pollEffect`) is the only thing that starts
  `QbPollingService.startMaindataPolling()`. It reruns when
  `ServerStoreService.currentServerId()` changes, and unconditionally calls
  `this.torrentStore.clear()` on every rerun.
- `QbPollingService` tracks `lastPolledServerId` and only resets its cached
  `rid` to 0 when the server actually changes (`isFreshStart`). Restarting for
  the _same_ server resumes from the last known `rid`, which returns a delta
  (not a `full_update`) from qBittorrent's sync API.
- `Main.ngOnDestroy()` only unsubscribes the local polling subscription - it
  never calls `QbPollingService.stopPolling()`. `lastPolledServerId` therefore
  stays set across a `Main` teardown/remount for the same server.

### Existing bug this design fixes

`Main.ngOnDestroy()` not resetting `lastPolledServerId` means the store-clearing
bug already reproduces today, independent of any new route: a session
expiry (401/403 mid-poll is handled via `stopPolling()`, which resets
`lastPolledServerId` and is safe) is not the only path to a remount - manual
logout followed by re-login to the _same_ server, before the app has otherwise
called `stopPolling()`, remounts `Main` while `lastPolledServerId` is still set.
The new `_pollEffect` instance clears the store, `QbPollingService` resumes from
the cached `rid`, and the first response is a delta - so every torrent that
didn't change while logged out silently disappears from the grid. This is the
same failure mode the issue anticipates for future sibling routes; fixing
ownership now (see below) fixes both.

## Design

### 1. Routing

```
/login                    -> Login (moved out of the `pages` group to the root)
/pages                     -> Shell (NEW) - persistent chrome, hosts a nested <router-outlet>
  children:
    torrent-list           -> Main (existing component and content, unchanged)
**                          -> redirect to /login
```

- `Login` moves from `pages/login` to a top-level `/login` route. Today,
  `MenuBarCommandHandlerService` and `QbService` already call
  `router.navigate(['/login'])`, which only resolves via the `**` wildcard's
  redirect to `/pages/login` (there is no route literally registered at
  `/login`). Registering `/login` directly removes that indirection.
- `Shell` is a new lazy-loaded component that owns only the nav rail and a
  nested `<router-outlet>`. It does not host the brand block, connection
  status, or filter sidebar - those stay inside `Main`, unchanged, per the
  "shell owns the rail only" decision below.
- `Main`'s content (brand block, filter sidebar, button bar, grid, footer) is
  unchanged. Only its route location moves, from `pages/main` to
  `pages/torrent-list`, as a child of `Shell`.
- Call sites that need updating for the new URLs: `Login.ts` (currently
  navigates to `/pages/main` on successful login), and the corresponding
  assertion in `login.spec.ts`. `MenuBarCommandHandlerService` and
  `QbService`'s existing `/login` navigation calls do not need to change.
- `/pages/settings` and `/pages/logs` are the anticipated future children of
  `Shell` once their own specs land. This spec does not register them or
  create placeholder components for them.

### 2. Shell scope: rail only, `Main` unchanged

The shell wraps `Main`'s existing markup as-is and adds only the new rail
around it. Brand/server-status hoisting into the shell is explicitly deferred:
it only pays off once a second page actually needs to show it, and Statistics/
Log Viewer's real needs aren't specified yet. Revisit this when those specs are
written - if they need the brand/status block too, hoist it then.

### 3. Nav rail

- A new component, rendered by `Shell`, positioned to the right of the routed
  page content (right-aligned, per user preference - eyes land on the grid
  first, the rail is visually secondary).
- Fixed width. Not collapsible - no toggle button, no collapsed/expanded
  states, unlike the existing filter sidebar inside `Main`. This keeps it a
  single predictable visual element regardless of the filter sidebar's own
  collapse state, rather than risking two adjacent icon-only columns.
- No logo/brand mark of its own - `Main` already shows the brand block in its
  sidebar; duplicating it in the rail would be redundant given the "shell =
  rail only" decision above.
- Content for this spec: one icon, Torrents, always shown in its active state
  (there is nowhere else to navigate to yet). Icon buttons need an
  accessible label and a tooltip, consistent with `Main`'s existing
  `bb-sidebar-toggle` pattern, and their label text needs entries in
  `packages/app/public/i18n/us.json` and `hu.json`.
- Should use the app's existing theme CSS custom properties (as `Main`'s
  sidebar does) so it tracks `ThemeService.effectiveMode` automatically rather
  than hardcoding colors.

### 4. Polling lifecycle ownership

`QbPollingService` becomes the sole owner of the fresh-start-vs-resume
decision, including when `TorrentStoreService` gets cleared:

- `QbPollingService` takes a new `TorrentStoreService` injection (no circular
  dependency: `TorrentStoreService` has no injected dependencies of its own).
- Inside `startMaindataPolling()`, when `isFreshStart` is true (server
  actually changed, or `stopPolling()` was called since the last start -
  e.g. after a 401/403), `QbPollingService` calls `torrentStore.clear()`
  itself, in the same place it already resets `maindataRid$` to 0. When
  `isFreshStart` is false, it does neither, and the resumed delta merges
  into the existing store contents exactly the way `TorrentStoreService.
applyMaindata()` already handles non-`full_update` payloads.
- `Main._pollEffect` drops its own `this.torrentStore.clear()` call entirely.
  It keeps deciding _when_ to start/stop its own polling subscription (on
  mount, on `currentServerId()` changes, on unmount) - that responsibility
  does not move, and no new "which routes need polling" orchestration
  service is introduced. Only one page consumes live torrent data today;
  building generic orchestration for hypothetical future consumers before
  their specs exist would be speculative.
- `Main.ngOnDestroy()` keeps only unsubscribing the local subscription - it
  still does not call `QbPollingService.stopPolling()`. That is what makes a
  remount for the same server resume instead of reset, which is the
  behavior this fix makes safe.

### Data flow after the fix

1. `Shell` mounts, its child route (`torrent-list`) mounts `Main`.
2. `Main`'s `_pollEffect` reads `currentServerId()` and calls
   `qbPollingService.startMaindataPolling(serverId)`.
3. `QbPollingService` computes `isFreshStart` from `lastPolledServerId`. If
   fresh, it clears `TorrentStoreService` and resets `maindataRid$` to 0. If
   not, it leaves both alone.
4. The first response applies through `TorrentStoreService.applyMaindata()`
   as today - `full_update` on a fresh start, a delta on a resume - now always
   consistent with whether the store was actually cleared.
5. Navigating away from `torrent-list` and back (once a sibling route exists
   in a future spec) exercises the same resume path, without needing any
   change to `Main` or `QbPollingService` beyond what's described here.

## Testing

- `Main`'s existing spec coverage for `_pollEffect` needs updating to assert
  it no longer calls `torrentStore.clear()` directly.
- `QbPollingService`'s existing spec coverage for `isFreshStart` needs a new
  case asserting `TorrentStoreService.clear()` is called exactly when
  `isFreshStart` is true, and never otherwise.
- A regression test for the fixed bug: start polling for server A, receive a
  `full_update`, call `startMaindataPolling` again for the same server
  (simulating a remount without an intervening `stopPolling()`), assert the
  store still contains the torrents from the first response after a
  delta-only second response.
- `login.spec.ts`'s assertion of the post-login navigation target needs
  updating to the new `/pages/torrent-list` URL.
- New rail component: renders its one icon, exposes an accessible label,
  reflects the active route.

## Out of scope (explicit)

- Statistics page.
- Log Viewer page.
- Settings as a routed page (stays a modal via `UI_OPEN_SETTINGS`).
- Any rail icon besides Torrents, including disabled placeholders.
- Registering `/pages/settings` or `/pages/logs`.
- Hoisting the brand/server-status block out of `Main`.
- Any change to native Electron menu items (`packages/electron/src/menu.ts`)
  or `MenuBarCommandHandlerService`.
