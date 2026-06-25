# Torrent details modal: centralized data/actions, footer buttons, and delete fix

Issues: #183, #184

## Overview

This design merges two in-flight efforts on the torrent details modal into one
piece of work, since both touch the same area and the second motivates a
shared piece of infrastructure the first needs anyway:

- **#183**: move the General tab's hover-reveal action buttons into
  discoverable footer buttons, behind a new `TorrentDetailsActionsService`.
- **#184**: the modal's delete button can target the wrong torrent (it relies
  on grid selection, not the torrent the modal is showing), and a race
  condition during the modal's close animation can surface a spurious error
  toast from a tab still polling the just-deleted hash.

Rather than fix #184's race condition by forcing all 4 tabs to be destroyed
the instant deletion is confirmed (the approach already implemented - but not
yet merged - on the `184-torrent-details-delete-race-condition` branch), this
design centralizes all of the modal's qBittorrent API calls and polling into
one service that every tab reads from instead of fetching independently. That
makes "stop everything" on delete a single method call regardless of which
tabs happen to be mounted, and as a side effect gives every tab's polling a
pause/resume gate tied to whether its tab is currently visible.

## Current state

Today, each of the 4 tabs (`General`, `Trackers`, `Peers`, `Content`)
independently injects `QbService`/`ServerStoreService`/etc. and fetches its
own data:

- **General**: polls `properties()` every 2s (`timer(0, 2000)`); a one-off
  `qbService.torrents.files()` call to derive `singleFile`; a reactive effect
  that fetches an error-log entry when the torrent's state is `error`; an
  effect that resolves `localPath` once. Also owns ~15 action-trigger methods
  (resume/pause/rename/delete/clear-limits/etc.), most reachable only via
  hover-reveal buttons next to each field.
- **Trackers**: fetches the tracker list once on init - no repeat polling.
- **Peers**: continuously polls via `QbPollingService.startPeersPolling()`
  (an incremental patch stream).
- **Content**: continuously polls `qbService.torrents.files()` at
  `serverSettings.polling.foreground` interval.

All 4 tabs are mounted simultaneously (`TorrentDetails` lazy-loads all 4
`Type`s up front via `NgComponentOutlet`), regardless of which tab is active,
so all of this polling runs all the time. `NgbModalConfig.animation = true`
means `activeModal.close()` doesn't destroy these components immediately -
they live through the fade-out, and a poll tick for the just-deleted hash
during that window 404s (Content's tab explicitly toasts on load failure).
Separately, `General.deleteTorrent()` emits a bare `UI_TORRENT_DELETE_REQUEST`
that the whole delete chain resolves against `SelectionStoreService`'s grid
selection rather than the torrent the modal is actually showing.

## Goals

- One place owns every API call/poll the modal needs, so "stop everything" on
  delete is trivial regardless of which tabs are mounted.
- Each tab's polling pauses while that tab isn't active, and resumes (with an
  immediate refresh) when it becomes active again.
- The delete button always targets the torrent the modal is showing.
- General's actions move into discoverable footer buttons.

## Architecture

### Two modal-scoped services

Both provided in `TorrentDetails`' `providers` array, alongside the existing
`ModalGuardService` - same pattern, same lifetime as the modal.

#### `TorrentDetailsDataService` (new)

Owns everything the modal needs to _read_:

- `hash`, `context` - set once via an `init(hash, context)` call from
  `TorrentDetails`' constructor (the modal's `hash` input never changes after
  open).
- `activeTabId` signal + `selectTab(id)` - moves out of `TorrentDetails`,
  since polling needs to gate on it.
- `properties`, `trackers`, `peers`, `content` signals - one poll chain per
  tab (detailed below), each built as
  `toObservable(activeTabId).pipe(switchMap(id => id === 'general' ? this.pollProperties() : EMPTY))`,
  so switching tabs unsubscribes the inactive one and switching back
  re-triggers an immediate fetch plus resumes the interval. The signal keeps
  its last value while paused, so re-opening a tab shows the previous result
  instantly instead of a spinner.
- `torrent` computed - the existing `{ data, properties }` merge from
  `General`, available to both tabs and the actions service.
- `localPath`, `singleFile`, `errorLog` - the existing one-off/reactive-effect
  logic from `General`, relocated unchanged. Not gated by active tab, since
  the footer needs `localPath`/`singleFile` regardless of which tab is open.
- `stopAll()` - fires an internal `destroyed$` Subject used as
  `takeUntil(this.destroyed$)` on every poll chain above. Called once, from
  `TorrentDetails`, when `TORRENT_DELETED` matches this modal's hash.

The unused `GeneralSettings` signal/effect currently in `General` (fetched via
`GeneralSettingsService.asObservable()`, never read anywhere) is dropped, not
carried over.

#### `TorrentDetailsActionsService` (per #183, scope unchanged)

Owns every action-trigger method: `rename`, `setLocation`, `openPath`,
`changeCategory`, `removeCategory`, `changeTags`, `removeAllTags`, `resume`,
`pause`, `forceResume`, `openTransferLimitsModal` (merging today's duplicate
`changeDownloadLimit`/`changeUploadLimit` into one method),
`openShareLimitsModal`, `forceReannounce`, and `deleteTorrent`. Injects
`TorrentDetailsDataService` to read the current `hash()`/`torrent()` when
building command payloads (e.g. `removeAllTags` needs `torrent().data.tags`).

The 5 per-field `clear*` methods (`clearDownloadLimit`, `clearUploadLimit`,
`clearRatioLimit`, `clearSeedingTimeLimit`, `clearInactiveSeedingTimeLimit`)
are deleted outright - fully covered by each limits modal's own "Clear All"
button - rather than moved.

`deleteTorrent()` emits
`{ type: 'UI_TORRENT_DELETE_REQUEST', hashes: [this.dataService.hash()] }`
(the #184 fix, just relocated from `General.deleteTorrent()`).

### Tabs become parameterless

`TorrentDetailTabComponent` (in `torrent-details.interface.ts`) shrinks to an
empty interface, mirroring `SettingsTabComponent`. `General`, `Trackers`,
`Peers`, and `Content` drop their `hash`/`context` inputs entirely and
`inject()` `TorrentDetailsDataService` (and `TorrentDetailsActionsService`
where they still need to trigger something - currently only the footer in
`TorrentDetails.html`, not any tab body) directly, exactly like
`Settings`/`General` (settings)/`Server` inject `SettingsStateService` today.
`torrent-details.html`'s `*ngComponentOutlet` drops its `inputs` map, matching
`settings.html`'s simpler `*ngComponentOutlet="loadedComponents().get(tab.id)!"`.

After this, `General` only injects `TorrentDetailsDataService` plus
`Clipboard`/`ToastService`/`TranslateService` for its own copy-to-clipboard
buttons - no more direct `QbService`/`CommandBusService`/`PathService`/
`ServerStoreService` usage.

### Polling per tab

| Tab      | Fetch                                  | Cadence while active                           | While inactive                                                                                                                                            |
| -------- | -------------------------------------- | ---------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| General  | `qbService.torrents.properties()`      | every 2s                                       | paused, last value retained                                                                                                                               |
| Trackers | `qbService.torrents.trackers()`        | once per activation, no repeat interval        | nothing in flight                                                                                                                                         |
| Peers    | `QbPollingService.startPeersPolling()` | continuous per that service's polling interval | paused; reactivating calls it fresh, which resets `rid` to 0 and triggers a `full_update` resync - same reset behavior `applyPatch` already handles today |
| Content  | `qbService.torrents.files()`           | every `serverSettings.polling.foreground` ms   | paused, last value retained                                                                                                                               |

Trackers staying one-shot-per-activation (rather than gaining a recurring
interval) is intentional: tracker status/seed counts don't need
sub-2-second freshness, so re-fetching once each time the tab opens is
enough.

Deduping `General`'s one-off `singleFile` fetch and `Content`'s recurring
file-list poll (both currently call `qbService.torrents.files()`
independently) is an orthogonal optimization and explicitly out of scope here

- they remain two separate calls, just relocated into
  `TorrentDetailsDataService` unchanged in count/cadence.

### Delete handling (supersedes the already-implemented race-condition fix)

`TorrentDetails`' existing `TORRENT_DELETED` subscription changes from
closing the modal outright to:

```ts
.subscribe(() => {
  this.dataService.stopAll();
  this.activeModal.close();
});
```

No `loadedComponents` clearing, no forced tab destruction. Tabs can stay
mounted through the fade-out animation; they simply stop receiving new data
because every poll chain is torn down via `destroyed$`, so no stray request
can land and no spurious toast can fire.

The branch `184-torrent-details-delete-race-condition` already has 6 commits
implementing the old approach. The first 4 (adding an optional `hashes`
override to `UI_TORRENT_DELETE_REQUEST`/`TORRENT_DELETE_CONFIRM`, threading it
through `ui-command-handler.service.ts`, `DeleteTorrent`, and
`TorrentCommandHandlerService.handleDelete`) are orthogonal to this reorg and
carry over unchanged. The 5th/6th (moving `deleteTorrent()` to emit the
`hashes` override, and clearing `loadedComponents` on `TORRENT_DELETED`) get
superseded: the former is re-landed as part of `TorrentDetailsActionsService`
above, the latter is replaced by `stopAll()`.

### General tab footer reorg (per #183, carried over unchanged)

Footer layout, left to right: **Delete** (icon-only, danger, far left) /
**Playback ▾** (Resume, Pause, Force resume) / **Limits ▾** (Transfer limits,
Share limits) / **Manage ▾** (Rename; Path: Relocate, Open destination;
Category: Change/Remove; Tags: Change/Remove all) / **Reannounce** /
**Close** (far right). All using the existing `btn-split` + `bb-btn-content`
pattern with `ngbDropdown` `placement="top-start"`. These are always visible
regardless of active tab, since they're torrent-level actions.

General tab body: every section's `.button-container` (rename, relocate,
open-destination, resume/pause/force-resume, category, tags, all 5
limit-clear buttons, force-reannounce) is removed in favor of the footer;
only copy-to-clipboard buttons stay inline. See #183's original spec for the
full per-section before/after table and i18n key list - unchanged by this
merge.

## Out of scope

- No changes to the Transfer limits / Share limits / Set category / Set tags
  / Rename modals themselves.
- No changes to Trackers/Peers/Content grid behavior (column state
  persistence, context menus, cell renderers) beyond relocating where their
  data comes from.
- Deduping General's `singleFile` fetch with Content's file-list poll (see
  above).

## Testing

- Unit specs for `TorrentDetailsDataService`: each poll only emits while its
  tab is active; pausing preserves the last value; reactivating triggers an
  immediate refresh; `stopAll()` halts every chain; `localPath`/`singleFile`/
  `errorLog` behavior matches today's `General` specs.
- Unit specs for `TorrentDetailsActionsService`: each method emits/calls the
  expected command or `QbService` method with the expected payload,
  including `deleteTorrent` passing `hashes: [hash]`.
- Updated `ui-command-handler.service.spec.ts`/`delete-torrent.spec.ts`/
  `torrent-command-handler.service.spec.ts`: unchanged from the existing
  184-branch commits (the `hashes` override plumbing).
- Updated `General`/`Trackers`/`Peers`/`Content` specs: now source data from
  an injected `TorrentDetailsDataService` mock instead of mocking
  `QbService`/timers directly; cover display/grid logic only.
- Updated `TorrentDetails` specs: on a matching `TORRENT_DELETED`,
  `dataService.stopAll()` is called before `activeModal.close()`; no more
  `loadedComponents` assertions.
- Manual verification pass per the project's verification-before-completion
  practice: switching tabs pauses/resumes their polling; deleting a torrent
  from a non-selected row's details modal targets the right torrent, leaves
  grid selection untouched, and produces no stray error toast; footer actions
  work correctly from any active tab.

## Branch & sequencing

Continue on the existing `184-torrent-details-delete-race-condition` branch/
worktree. Its first 4 commits stay as-is; new commits implement
`TorrentDetailsDataService`, `TorrentDetailsActionsService`, the tab
input/output removal, the footer reorg, and the new delete-teardown
mechanism (superseding that branch's 5th/6th commits, which get rewritten
rather than left as dead code). The resulting single PR closes both issues
(`Fixes #183`, `Fixes #184`). Per project convention, the `docs/superpowers`
folder is removed in its own commit before the PR is opened.
