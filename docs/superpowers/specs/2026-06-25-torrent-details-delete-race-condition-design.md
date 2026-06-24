# Torrent details modal delete: fix wrong-target risk and race-condition toast

Issue: #184

## Overview

Two bugs in the torrent details modal's delete flow:

1. **Wrong target.** `General.deleteTorrent()` emits a bare
   `UI_TORRENT_DELETE_REQUEST` with no hash. The entire chain
   (`ui-command-handler.service.ts` -> `DeleteTorrent` confirm modal ->
   `TORRENT_DELETE_CONFIRM` -> `TorrentCommandHandlerService.handleDelete()`)
   operates on `SelectionStoreService`'s grid selection, not on the torrent
   the modal is actually showing. Every sibling command
   (`UI_SET_TORRENT_LOCATION`, `UI_LIMIT_TRANSFER`, `UI_LIMIT_SHARE`,
   `UI_SET_TORRENT_TAGS`, `UI_SET_TORRENT_CATEGORY`) already supports an
   optional `hashes?: string[]` override for exactly this kind of
   modal-initiated, selection-independent action - delete is the
   inconsistent one.

2. **Race condition.** All 4 tabs (General/Trackers/Peers/Content) are
   mounted simultaneously inside the modal, each polling independently for
   the torrent's hash. `NgbModalConfig.animation = true` is set globally
   (`app.ts`), so `activeModal.close()` does not destroy the modal's
   components immediately - they stay alive through the fade-out
   transition. If a poll tick fires for the just-deleted hash during that
   window, it 404s; Content's tab explicitly toasts load failures
   (`catchError` -> `toastService.danger` in `content.ts`), which is the
   most likely source of the spurious error toast.

## Fix 1: explicit hash override for delete

Add `hashes?: string[]` to `UI_TORRENT_DELETE_REQUEST` and to
`TORRENT_DELETE_CONFIRM` in `command.model.ts`:

```ts
| { type: 'UI_TORRENT_DELETE_REQUEST'; defaultRemoveFiles?: boolean; hashes?: string[] }
...
| { type: 'TORRENT_DELETE_CONFIRM'; removeFiles: boolean; hashes?: string[] }
```

`ui-command-handler.service.ts`, `UI_TORRENT_DELETE_REQUEST` case:

- Resolve `hashes = command.hashes ?? this.selectionStoreService.selectedHashes()`
  and bail out early if empty (same as today).
- Pass `command.hashes` through as a `hashes` input on the `DeleteTorrent`
  modal (via `setModalInput`) and forward it unchanged into the
  `TORRENT_DELETE_CONFIRM` command emitted on confirm.

`DeleteTorrent` (`delete-torrent.ts`):

- Add `readonly hashes = input<string[] | undefined>(undefined);`.
- Inject `TorrentStoreService`. Compute `selected` as: when `hashes()` is
  set, map it through `torrentStoreService.torrentsMap()` (filtering out
  any miss); otherwise fall back to `selectionStore.selected()` exactly as
  today. `totalSize` stays a `computed` over `selected()`, unchanged.

`TorrentCommandHandlerService.handleDelete()`:

- Accept the optional `hashes` from the `TORRENT_DELETE_CONFIRM` command and
  resolve `hashes = cmd.hashes ?? this.selectionStore.selectedHashes()`.
- Only call `this.selectionStore.clear()` when no override was supplied -
  deleting a single torrent that wasn't part of (or wasn't all of) the
  grid's current selection must not silently wipe that unrelated selection.

`General.deleteTorrent()` (or wherever this method lives by the time this
ships, e.g. if #183 has merged it may be `TorrentDetailsActionsService`):

- Emits `{ type: 'UI_TORRENT_DELETE_REQUEST', hashes: [this.hash()] }`
  instead of the bare command.

This is a pure additive change to the command shape - every other caller of
`UI_TORRENT_DELETE_REQUEST` (toolbar, grid context menu, keyboard shortcuts)
keeps working unchanged since `hashes` is optional and they don't pass it,
falling back to today's selection-based behavior.

## Fix 2: destroy tab components immediately on delete

In `torrent-details.ts`, the existing `TORRENT_DELETED` subscription:

```ts
this.commandBusService.commands$
  .pipe(
    filter(/* TORRENT_DELETED */),
    filter((command) => command.hash === this.hash()),
    takeUntilDestroyed(),
  )
  .subscribe(() => this.activeModal.close());
```

changes to clear `loadedComponents` before closing:

```ts
.subscribe(() => {
  this.loadedComponents.set(new Map());
  this.activeModal.close();
});
```

Clearing `loadedComponents` makes the `@if (loadedComponents().has(tab.id))`
blocks in the template false for every tab, so Angular destroys all 4
`*ngComponentOutlet`-rendered tab components on the next change-detection
pass - well before the CSS fade-out transition completes. Destroying them
unsubscribes each tab's `takeUntilDestroyed`-bound polling (General's
`timer(0, 2000)`, Content's `timer(0, pollingInterval)` pipeline, Peers'
`QbPollingService` subscription) immediately, so no further request for the
deleted hash is made, and any request already in flight has no subscriber
left to act on its result (no toast, no state update).

The template briefly falls back to the `@else` spinner state during the
fade-out instead of showing stale tab content - acceptable since the modal
is already closing at that point.

This is a single, centralized fix in the parent modal rather than patching
each tab's error handling individually, so it also covers any tab added in
the future.

## Out of scope

- General's `timer(0, 2000)` polling for `properties()` runs regardless of
  which tab is active (all 4 tabs are always mounted) and silently produces
  an unhandled promise rejection on any transient fetch failure unrelated to
  deletion (no `toastService` call, just `console.error` + rethrow with no
  catch on the subscribe side). This is a pre-existing rough edge, not
  introduced by or specific to the delete race condition, and is left alone
  here to avoid scope creep.
- No change to the footer/button reorg tracked in #183 - this issue targets
  the current `main` delete flow directly so it can be reviewed and merged
  independently.

## Testing

- `ui-command-handler.service.spec.ts`: `UI_TORRENT_DELETE_REQUEST` with
  `hashes` passes them through as the `DeleteTorrent` modal input and into
  the emitted `TORRENT_DELETE_CONFIRM`; without `hashes`, behavior matches
  today's spec exactly.
- `delete-torrent.spec.ts`: with `hashes` input set, `selected`/`totalSize`
  reflect those torrents from the store, not the selection store; without
  it, behavior matches today.
- `torrent-command-handler.service.spec.ts`: `handleDelete` with a `hashes`
  override deletes exactly those hashes and does not call
  `selectionStore.clear()`; without an override, behavior matches today
  (deletes selection, clears it after success).
- `torrent-details.spec.ts`: on a matching `TORRENT_DELETED`,
  `loadedComponents` is cleared and `activeModal.close()` is called.
- Manual verification: open details for a torrent not currently selected in
  the grid (via right-click "Details"), delete it from the modal, confirm
  the right torrent is removed, the grid selection is untouched, and no
  error toast appears.
