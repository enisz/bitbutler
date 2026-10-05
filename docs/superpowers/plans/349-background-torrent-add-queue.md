# #349 - Background torrent-add queue + add-torrent modal keyboard fixes

Branch: `349-background-torrent-add-queue`
Issue: https://github.com/enisz/bitbutler/issues/349

## Context

Adding a torrent in the add-torrent modal can block the UI: the modal awaits the `torrentsAdd`
IPC call, and for single-file adds with renames/priorities it then also awaits a poll-for-
registration (up to 5s) plus sequential rename/priority/share-limit calls before it can advance to
the next queued draft or close. Original ask (paraphrased): adding sometimes takes longer than a
few ms and blocks the UI; queuing multiple torrents means waiting for the current one before the
next starts; renaming has to wait for the add to finish first.

Separately, two keyboard-ergonomics (not screen-reader) fixes were requested for the same modal.

## Status: IMPLEMENTED (uncommitted at time of writing) - only manual verification remains

`torrentsAdd` now runs inside the main-process queue for link, single-file and folder modes.
Decisions taken: folder mode enqueues every entry and closes immediately (no per-entry markers or
summary toast; `markFolderEntry*` in general.ts are now unused); the source .torrent is deleted in
main only after a successful add (`deleteOriginalOnSuccess`); a 409 sets job status `duplicate`
(named/folder jobs toast, unnamed jobs raise `UI_TORRENT_EXISTS`). Lint, builds, and all tests pass.
The sections below describe the earlier partial state and are kept for history.

### Done and verified (lint clean, `npm run build`/`build:electron` clean, full `npm test` passing - 2543 app tests + 351 electron tests)

**Keyboard fixes** (`packages/app/src/app/modals/add-torrent/add-torrent.ts` / `.html`):

- Escape no longer closes the whole modal when it only closed an open ng-select dropdown. Fix:
  `onEscapeKey` now checks `event.defaultPrevented` (ng-select already calls `preventDefault()`
  when Escape closes its own dropdown, and since this is a `document:keydown.escape` listener it
  only runs after that has already happened in the bubble phase - no event-ordering race). No new
  directive needed, no changes to the ng-select usages themselves.
- Saving a file rename with Enter now moves focus to the modal's Add button (`viewChild('addButton')`
  - `.nativeElement.focus()` in `onTreeSaved`).

**Background post-add queue** (new files):

- `packages/shared/src/models/torrent-add-job.model.ts` - `TorrentAddJob`/`TorrentAddJobPayload`/etc.
- `packages/electron/src/ipc/torrent-add-queue.ts` - main-process FIFO queue, one per `serverId`.
  Currently only does the **post-add** sequence: poll `/torrents/files` until the torrent is
  registered, then sequential `renameFile`/`filePrio`/`setShareLimits` calls via the existing
  exported `qbRequest()` helper in `ipc/qbittorrent.ts`.
- `packages/app/src/app/services/torrent-add-queue.service.ts` - thin renderer-side mirror
  (same role as `TorrentStoreService` for maindata), started in `app.ts`. Shows an error-only toast
  on job failure (no success toast - a successful add/rename is already visible in the grid).
- Wiring: `preload.ts` (`torrentQueue` namespace: `enqueue`/`list`/`onUpdate`), `ipc.types.ts`
  (`BitButlerAPI.torrentQueue`), `main.ts` (`registerTorrentAddQueueHandlers()`), i18n keys under
  `services.torrent-add-queue.toast.job-failed.title` in `us.json`/`hu.json`.
- `add-torrent.ts`: single-file mode's old `tryRenameContentAfterAdd` (awaited, blocking) is now
  `enqueuePostAddJob` (fire-and-forget into the queue) - this part is genuinely non-blocking now.

### The deviation - and why it matters

**The actual `torrentsAdd` call was deliberately left synchronous/blocking, exactly as it was
before this work started.** This means:

- The core complaint ("adding sometimes takes longer than a few ms and blocks the UI") is **not
  fixed**. `handleSubmit` still does `await window.bitbutler.qb.torrentsAdd(...)` before doing
  anything else, for every input mode.
- Folder mode's `for` loop (`add-torrent.ts`, inside `handleSubmit`'s `else if (this.inputMode() ===
'folder')` branch) is **completely untouched** - it only ever calls `torrentsAdd` per entry
  (folder mode has no per-file rename/priority customization to background in the first place), so
  none of this work applies to it.
- The "multiple queued torrents wait for the current one" complaint is only partially addressed:
  the rename tail no longer blocks, but the add call's own round-trip is still a hard gate before
  `isSubmitting` is cleared and the next draft becomes interactive.

**Why I stopped there:** moving `torrentsAdd` into the background queue breaks the existing
synchronous 409-duplicate-torrent detection. Today, `handleSubmit`'s `catch` block parses a 409 out
of the thrown error and emits `commandBusService.emit({ type: 'UI_TORRENT_EXISTS', hash,
originalPath })` synchronously (see `add-torrent.ts` around the `catch (e)` block, and
`add-torrent.spec.ts` tests around "should emit UI_TORRENT_EXISTS... on a 409 conflict"). If the add
call is queued and processed in main asynchronously, that catch never fires - the error would only
surface later via the queue's `onUpdate` push, with no renderer code left waiting to catch it
synchronously. I didn't want to either silently break that UX/test coverage or redesign it
mid-implementation without a checkpoint, so I left the add call as-is and only backgrounded what
came after it. **This should have been flagged and decided before implementing, not discovered and
explained afterward** - noted as a process mistake for next time.

## What's actually left to do

To properly fix the core problem, `torrentsAdd` itself needs to move into the main-process queue,
for both single-file mode and folder mode. Concretely:

1. **Extend `TorrentAddJobPayload`** (`packages/shared/src/models/torrent-add-job.model.ts`) to
   include the add step again (it was in an earlier draft of this file and was deliberately
   stripped down to just post-add fields - see git history on this file if useful context):

   ```ts
   add: {
     torrents: SelectedTorrentInput[];
     urls?: string[];
     options?: Record<string, unknown>;
   };
   ```

   plus an `originalPath?: string` field (needed for `UI_TORRENT_EXISTS`'s `originalPath`, since the
   renderer won't be the one parsing the 409 anymore).

2. **`torrent-add-queue.ts`**: `processJob` should call `qbTorrentsAdd` (currently private/unexported
   in `ipc/qbittorrent.ts` - re-export it, it's already a standalone top-level function, no other
   refactor needed) as its first step, before the existing poll/rename/priority/share-limit
   sequence. Add an `'adding'` status back to `TorrentAddJobStatus`. On a 409 specifically (reuse
   the existing `parseQbError`/`isNotFoundError`-style helpers already in this file, generalize to
   check `status === 409`), set a distinguishable job state (e.g. `status: 'duplicate'` or reuse
   `'error'` with a structured `error` shape the renderer can detect) so the renderer doesn't show
   a misleading "Failed to Add Torrent" toast for what's actually an expected duplicate.

3. **`TorrentAddQueueService`**: inject `CommandBusService`. In the `onUpdate` handler, when a job's
   status indicates the 409/duplicate case, emit `{ type: 'UI_TORRENT_EXISTS', hash: job.payload.infoHash,
originalPath: job.payload.originalPath ?? null }` instead of (or in addition to suppressing) the
   generic error toast.

4. **`add-torrent.ts`**: both the single-file branch and the folder-mode `for` loop change from
   `await window.bitbutler.qb.torrentsAdd(...)` to `this.torrentAddQueueService.enqueue(...)`
   (fire-and-forget, just awaiting the fast ack if at all). `consumeCurrentDraft()` / `activeModal.close(true)`
   should happen right after enqueueing, not after the add resolves. Folder mode's per-entry success/
   failure tracking (`markFolderEntryAdded`/`markFolderEntryFailed`, the "succeeded/total" toast) will
   need to become async - driven by job status updates per entry rather than the current synchronous
   loop counter. This is the trickiest part of the remaining work and deserves its own design pass
   (maybe worth an `AskUserQuestion`/plan-mode checkpoint before implementing, given this exact kind
   of mid-implementation surprise is what caused the deviation last time).

5. **Tests to update**:
   - `packages/app/src/app/modals/add-torrent/add-torrent.spec.ts` - the synchronous 409 tests
     ("should emit UI_TORRENT_EXISTS and consume the draft on a 409 conflict", "should pass the
     draft originalPath...") need to move to asserting the queue-driven path instead (likely a new
     describe block, mocking `torrentAddQueueService` and driving its `onUpdate`-equivalent, or
     testing `TorrentAddQueueService` directly with a `CommandBusService` spy).
   - Folder-mode tests that currently assert synchronous per-entry `torrentsAdd` awaiting/toasting
     will need similar rework once that loop becomes async.
   - `packages/electron/src/ipc/torrent-add-queue.spec.ts` doesn't exist yet - the current queue
     module (post-add only) has no dedicated unit tests either; consider adding them alongside this
     work rather than after.

## Key files reference

| File                                                          | Role                                                                                        |
| ------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| `packages/shared/src/models/torrent-add-job.model.ts`         | Job/payload types                                                                           |
| `packages/shared/src/ipc.types.ts`                            | `BitButlerAPI.torrentQueue` contract                                                        |
| `packages/electron/src/ipc/torrent-add-queue.ts`              | Main-process queue + drain loop                                                             |
| `packages/electron/src/ipc/qbittorrent.ts`                    | `qbRequest` (exported), `qbTorrentsAdd` (currently private - needs export for step 2 above) |
| `packages/electron/src/preload.ts`                            | `torrentQueue` namespace bridge                                                             |
| `packages/electron/src/main.ts`                               | `registerTorrentAddQueueHandlers()` registration                                            |
| `packages/app/src/app/services/torrent-add-queue.service.ts`  | Renderer-side mirror/toast                                                                  |
| `packages/app/src/app/modals/add-torrent/add-torrent.ts`      | `handleSubmit`, `enqueuePostAddJob`, the 409 catch block that needs to move                 |
| `packages/app/src/app/modals/add-torrent/add-torrent.spec.ts` | Tests to update per step 5                                                                  |
| `packages/app/src/app/models/command.model.ts`                | `UI_TORRENT_EXISTS` command shape                                                           |
| `packages/app/src/app/services/ui-command-handler.service.ts` | Consumes `UI_TORRENT_EXISTS` (unaffected by this work, just for reference)                  |

## Verification once the remaining work lands

- `npm run lint`, `npm run build`, `npm run build:electron`, `npm test` all clean (as they are now).
- Manual: queue 3+ single-file torrents with renames - modal should advance between drafts without
  waiting on the add call OR the rename tail. Queue a folder with several torrents - same.
- Manual: re-add an already-added torrent (409 case) in both single-file and folder mode - should
  still show the existing "torrent already exists" UX (`UI_TORRENT_EXISTS` → whatever modal/toast
  that currently triggers), not a generic "Failed to Add Torrent" error toast.
- Re-run the keyboard fixes manually too (Esc with an open ng-select, Enter-to-rename refocus) -
  these are done and shouldn't need touching, but worth a sanity check after further changes to the
  same file.

## Reminder

Per `CLAUDE.md`: this `docs/superpowers/` folder must be removed in its own commit before opening
or merging the PR, and must not be referenced from the PR/issue description.
