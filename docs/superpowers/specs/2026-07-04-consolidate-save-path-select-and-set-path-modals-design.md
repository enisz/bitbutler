# Consolidate save-path select and set-path modals

Issue: [#204](https://github.com/enisz/bitbutler/issues/204)

## Context

`SavePathSelect` (`packages/app/src/app/components/save-path-select/`) centralizes the ng-select/typeahead used to pick a save path. It is used in 6 places: the "Set Save Path" modal (currently named `SetTorrentLocation`), the "Set Download Path" modal (`SetDownloadPath`), the Add Torrent modal, the server path-mapping settings, the category manager, and the general settings preview widgets.

The component currently bakes in an optional popover (`showPopover` input, default `true`) and fetches the server's global `save_path` preference itself to use as a placeholder/fallback. This worked while there was only one "pick a save path" use case, but a second modal (`SetDownloadPath`, added recently) reuses the same component for a conceptually different field (qBittorrent's temporary download path) with different defaulting needs - it should allow an empty value, whereas the save-path flow should always fall back to a resolved path. `SetDownloadPath` currently has a bug where clearing the field blocks saving entirely instead of disabling the per-torrent override, and its modal is a different (smaller) size than the save-path modal despite being a near-identical form.

Separately, the context-menu label and torrent-details dropdown were already renamed from "Set Location" to "Set Save Path", but the underlying command type (`UI_SET_TORRENT_LOCATION`), context-menu item id (`files.setLocation`), and action method (`setLocation()`) still use the old wording.

This refactor makes `SavePathSelect` a plain, fully input-configurable widget (no baked-in popover, no internal preference fetching), merges the two near-identical modals into one `SetPath` modal driven by a `pathType` input (mirroring the existing `TransferLimit` modal's `target: 'global' | 'torrent'` pattern), fixes the download-path modal's size and empty-value bug, and renames the remaining "location" identifiers to match the already-renamed user-facing label.

## Goals

- `SavePathSelect` has no knowledge of popovers or qBittorrent preferences; every visual/behavioral property is an input.
- Every call site renders its own popover (or none), in whatever layout fits that screen.
- `SetTorrentLocation` and `SetDownloadPath` become one `SetPath` modal with a `pathType: 'save' | 'download'` input, matching the `TransferLimit` modal's precedent.
- Both flows share one modal size (`lg`, centered).
- Clearing the download path field and saving disables the per-torrent temporary-download override, instead of silently blocking the save.
- "Location" identifiers still in the code (command type, menu item id, action method) are renamed to "save path" wording, matching the already-updated user-facing label.
- No change to: how the save-path suggestion list is populated (still derived from existing torrents' `save_path` values), the global-default-save-path fallback behavior for save-path flows, or the `qbService.torrents.setLocation()` wrapper (its name mirrors qBittorrent's actual `/api/v2/torrents/setLocation` endpoint and is out of scope).

## Non-goals

- Renaming `qbService.torrents.setLocation()` or the `grid-inline-edit.service.ts` inline-edit call into it.
- Any change to `TransferLimit`/`ShareLimit` modals beyond using them as a reference pattern.
- Any change to how `SavePathTypeaheadService` or the `paths()` suggestion list is computed.

## Design

### 1. `SavePathSelect` becomes popover-free and self-contained

`packages/app/src/app/components/save-path-select/save-path-select.ts` / `.html`:

- Remove the `showPopover` input and the `container-fluid`/`row`/`col-11`/`col-1`/`bb-popover` wrapper markup from the template, along with the `savePathPopover` `ng-template` and `BbPopover` import. The template collapses to one unbranched block per `resolvedInputType()` (select vs. typeahead) instead of duplicating each block once for the popover case and once for the no-popover case.
- Remove the `QbService` and `ServerStoreService` injections and the constructor's `preferences(serverId)` fetch into a `defaultPath` signal. `placeholder()` becomes the sole source of default/hint text - callers that want a "global save path" hint now fetch and pass it themselves via `[placeholder]`.
- Remaining inputs: `autofocus`, `clearable`, `label`, `placeholder`, `appendTo`, `inputType`. `paths()` (from `TorrentStoreService`) and the typeahead delegation to `SavePathTypeaheadService` are unchanged.
- Update `save-path-select.spec.ts`: drop the `showPopover`/popover-rendering tests and anything asserting on the removed preference-fetch behavior.

### 2. Merge `SetTorrentLocation` + `SetDownloadPath` into `SetPath`

New directory `packages/app/src/app/modals/set-path/` (`set-path.ts`, `.html`, `.scss`, `.spec.ts`) replacing `packages/app/src/app/modals/set-torrent-location/` and `packages/app/src/app/modals/set-download-path/` (both deleted).

- Selector `app-set-path`, class `SetPath`.
- Inputs: `torrent = input.required<Torrent>()`, `hashes = input<string[]>([])`, `pathType = input.required<'save' | 'download'>()`.
- `ngOnInit`:
  - Prefill the form control from `pathType() === 'save' ? torrent().save_path : torrent().download_path`.
  - Only when `pathType() === 'save'`: fetch `qbService.app.preferences(serverId)` and store `prefs.save_path` in a `defaultSavePath` signal (same call `SetTorrentLocation` makes today) - used both as the fallback-chain value and as the field's `[placeholder]`.
- `handleSubmit`:
  - `pathType() === 'save'`: resolve `form value || defaultSavePath() || torrent().save_path`; if still empty, log/toast and abort (same as today). Call `qbService.torrents.setLocation(serverId, hashes(), newPath)`.
  - `pathType() === 'download'`: take the form value as-is, no fallback chain. `qbService.torrents.setDownloadPath()` itself rejects an empty path (`path is required`), so an empty/null value is treated as "no temporary-download override wanted" - skip the API call and close the modal directly (success), instead of today's behavior where an empty resolved value silently returns without closing the modal or telling the user why. A non-empty value still goes through `qbService.torrents.setDownloadPath(serverId, hashes(), newPath)` as before.
- Template: title, the field's `[placeholder]`, the popover subject/description, and the error-toast title all branch on `pathType()`. The popover uses the same `col-11`/`col-1` + `bb-popover` split that `SavePathSelect` used to render internally - now owned by this modal's template directly. Reuse the existing `components.save-path-select.popover.*` copy for the save-path popover; add new copy for the download-path popover explaining the temporary-download-path concept and that leaving it empty disables the per-torrent override.
- Modal size unified: both invocations open with `{ size: 'lg', centered: true }`.

`packages/app/src/app/services/ui-command-handler.service.ts`: both the `UI_SET_SAVE_PATH` (renamed, see below) and `UI_SET_DOWNLOAD_PATH` cases dynamically import `SetPath` from `../modals/set-path/set-path` and pass `pathType: 'save'` / `'download'` respectively, keeping their existing hash-resolution logic.

### 3. Other `SavePathSelect` consumers own their own defaults/popovers

- `packages/app/src/app/modals/add-torrent/general/general.ts`: inject `QbService`/`ServerStoreService`, fetch the global `save_path` preference into a signal (same pattern as `Server`, below), expose it, and bind it as `[placeholder]` on the savepath field in `general.html`. Add an explicit `col-11`/`col-1` + `bb-popover` around that field (reusing `components.save-path-select.popover.*`), matching the pattern already used for the sibling input-mode field in the same template.
- `packages/app/src/app/modals/settings/server/server.ts`: convert the existing `defaultRemotePath` plain field (already fetched via `qbService.app.preferences`) to a signal so it can be bound reactively; bind it as `[placeholder]` on the path-mapping `SavePathSelect` in `server.html`. No popover change (the fieldset-level popover is unaffected).
- `packages/app/src/app/modals/settings/general/general.html` and `packages/app/src/app/modals/manage-categories/manage-categories.html`: remove the now-nonexistent `[showPopover]="false"` bindings. No behavior change (these never rendered a popover).

### 4. Rename "location" identifiers to "save path"

- `packages/app/src/app/models/command.model.ts`: `UI_SET_TORRENT_LOCATION` → `UI_SET_SAVE_PATH`.
- `packages/app/src/app/pages/main/grid/context-menu/grid-context-menu.service.ts`: item id `files.setLocation` → `files.setSavePath`, i18n key `...item.set-location` → `...item.set-save-path`, emitted command type updated.
- `packages/app/src/app/modals/torrent-details/torrent-details-actions.service.ts`: `setLocation()` → `setSavePath()`, emits `UI_SET_SAVE_PATH`.
- `packages/app/src/app/modals/torrent-details/torrent-details.html`: `(click)="actionsService.setSavePath()"`, i18n key `general.relocate` → `general.set-save-path`.
- `public/i18n/us.json` / `hu.json`: rename the two keys above; replace `components.modals.set-torrent-location.*` and `components.modals.set-download-path.*` with `components.modals.set-path.*` (`title.save`/`title.download`, `error.*`, `popover.download-path.*`); `components.save-path-select.popover.*` and `components.save-path-select.label` are kept as-is (now referenced from multiple call sites instead of only internally).
- Update all associated spec files: `grid-context-menu.service.spec.ts`, `torrent-details-actions.service.spec.ts`, `torrent-details.spec.ts`, `ui-command-handler.service.spec.ts` (import path + both `pathType` cases), and the new `set-path.spec.ts` (replacing `set-torrent-location.spec.ts` + `set-download-path.spec.ts`, covering both `pathType` branches including the empty-download-path save case).
- Explicitly unchanged: `qbService.torrents.setLocation()` in `qb.service.ts` (mirrors qBittorrent's real API endpoint) and its use in `grid-inline-edit.service.ts`'s `save_path` column handler.

## Testing

- Unit tests: updated `save-path-select.spec.ts`, new `set-path.spec.ts` (both `pathType` branches, including the empty-download-path submit path), updated specs listed above.
- Manual verification: open "Set Save Path" and "Set Download Path" from the grid context menu and torrent-details dropdown - confirm same modal size, correct title/popover copy per type, correct default-value/fallback behavior, and that clearing+saving the download path succeeds and disables the override. Verify Add Torrent, path-mapping settings, category manager, and settings preview widgets still show the select with the right placeholder/popover behavior.
