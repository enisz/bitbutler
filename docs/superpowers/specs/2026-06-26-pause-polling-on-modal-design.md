# Design: Pause Polling When a Modal Is Open

**Issue:** #190
**Date:** 2026-06-26

## Overview

Add a `pausePollingOnModal` boolean setting to the Torrent List Grid settings. When enabled, opening any modal in the application pauses maindata background polling. Polling resumes automatically when all modals are closed.

## Settings Model

**File:** `packages/app/src/app/models/torrent-list-grid.model.ts`

Add `pausePollingOnModal: boolean` to the `TorrentListGridSettings` interface. Add it to `DEFAULT_TORRENT_LIST_GRID_SETTINGS` with value `false`. No migration is required - missing keys fall back to their defaults at load time.

## Settings UI

**Files:** `packages/app/src/app/pages/settings/torrent-list-grid/torrent-list-grid.ts` and `.html`

Add a `pausePollingOnModal` `FormControl<boolean>` to `torrentListGridForm`. Wire it into `initializeForm()` (patch from saved settings) and `save()` (persist back). Add a toggle switch in the "Grid Options" fieldset alongside the existing switches. The label should be minimal (e.g. "Pause on modal"); a `bb-popover` explains the behaviour. Add translation keys for the label and popover title/description in `public/i18n/us.json` and `hu.json`.

## Modal-Pause Logic

**File:** `packages/app/src/app/services/ui-command-handler.service.ts`

In `start()`, add a `combineLatest` subscription that watches:

- `this.modalService.activeInstances` - emits `NgbModalRef[]` on every open/close
- `TorrentListGridSettingsService.asObservable()` - emits current grid settings

On each emission derive `shouldPause = modals.length > 0 && settings.pausePollingOnModal`.

Manage a single `private pauseToken: symbol | null = null` field:

- If `shouldPause && pauseToken === null` - call `qbPollingService.pause()`, store the returned token.
- If `!shouldPause && pauseToken !== null` - call `qbPollingService.resume(pauseToken)`, set to `null`.

Use `takeUntilDestroyed(this.destroyRef)` on the subscription. On destroy, if a token is still held, call `resume(pauseToken)` in `destroyRef.onDestroy()`.

`UiCommandHandlerService` must inject `TorrentListGridSettingsService` and `QbPollingService`.

## Behaviour Notes

- Peers polling (`startPeersPolling`) is driven by `pollingInterval$`, not `isPaused$`, so it is unaffected by this pause - the torrent details peers tab continues updating while the modal is open.
- Toggling the setting while a modal is already open takes effect immediately (reactive `combineLatest`).
- The existing polling indicator reflects the paused state (unchanged behaviour from the indicator's perspective).
- `stopPolling()` clears all pause tokens, so navigating away from main resets state cleanly.

## Files to Change

| File                                                                           | Change                                      |
| ------------------------------------------------------------------------------ | ------------------------------------------- |
| `packages/app/src/app/models/torrent-list-grid.model.ts`                       | Add `pausePollingOnModal` field and default |
| `packages/app/src/app/pages/settings/torrent-list-grid/torrent-list-grid.ts`   | Add form control, patch, save               |
| `packages/app/src/app/pages/settings/torrent-list-grid/torrent-list-grid.html` | Add toggle switch with label + popover      |
| `packages/app/src/app/services/ui-command-handler.service.ts`                  | Add modal-pause subscription                |
| `public/i18n/us.json`                                                          | Add translation keys                        |
| `public/i18n/hu.json`                                                          | Add translation keys                        |
