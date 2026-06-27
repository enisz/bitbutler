# Torrent Actions Redesign - Design Spec

**Date:** 2026-06-27
**Branch:** 192-inline-cell-edit

---

## Overview

This spec covers eight related changes:

1. Fix: `clearAll()` in transfer-limit and share-limit modals auto-saves and closes - it should only reset the form
2. Reorder: "Inline Edit" must appear before "Do Nothing" in the row double-click dropdown
3. Rename: "Set Location" → "Set Save Path" to distinguish from the new "Set Download Path"
4. Add: `setDownloadPath` action (new modal, command, context menu item, modal footer item)
5. Add: `toggleSequentialDownload` and `toggleFirstLastPiecePrio` actions (context menu + modal footer)
6. Redesign: torrent details modal footer - mirror context menu submenu grouping
7. Add: "Clear" button to the set-torrent-tags modal
8. Add: five read-only boolean fields to the general tab of torrent details

---

## 1. Fix: Clear button in transfer-limit and share-limit modals

**Problem:** `clearAll()` in both modals calls `this.handleSubmit()` after resetting form values, which saves and dismisses the modal immediately. The intended behavior is: reset the form, keep the modal open, let the user click Save.

**Files:**

- `packages/app/src/app/components/modals/transfer-limit/transfer-limit.ts`
- `packages/app/src/app/components/modals/share-limit/share-limit.ts`

**Change:** Remove the `this.handleSubmit()` call from `clearAll()` in both components. No template or i18n changes.

```typescript
// transfer-limit.ts - before
public clearAll(): void {
  this.form.controls.transferRateLimits.setValue({ uploadLimit: null, downloadLimit: null });
  this.handleSubmit(); // ← remove this line
}

// share-limit.ts - before
public clearAll(): void {
  this.form.controls.shareLimits.setValue({ ... });
  this.handleSubmit(); // ← remove this line
}
```

---

## 2. Reorder: row double-click dropdown

**File:** `packages/app/src/app/pages/settings/torrent-list-grid/torrent-list-grid.html`

**Current order:** Show in Folder (`SAVE_PATH`), Open Details (`DETAILS`), Do Nothing (`NONE`), Inline Edit (`INLINE_EDIT`)

**New order:** Show in Folder, Open Details, **Inline Edit**, **Do Nothing**

Two changes in the same file:

**a) `ng-select` items array** - swap the `NONE` and `INLINE_EDIT` entries so `INLINE_EDIT` appears third and `NONE` last.

**b) `#doubleClickBehavior` ng-template** - the `<ul>` renders `list-item-1` through `list-item-4` in order. Swap `list-item-3` and `list-item-4` so the list reflects the new dropdown order:

- list-item-1: Show in Folder / Open Destination
- list-item-2: Open Torrent Details
- list-item-3 (was list-item-4): Inline Edit
- list-item-4 (was list-item-3): Do Nothing

No i18n value changes - only the order of the i18n key references in the template.

---

## 3. Rename: "Set Location" → "Set Save Path"

**Why:** The existing action sets `save_path`. The new "Set Download Path" action sets `download_path`. Using "Set Location" alongside "Set Download Path" would be ambiguous.

**i18n changes (both `us.json` and `hu.json`):**

| Key                                                  | Old value (en)     | New value (en)  |
| ---------------------------------------------------- | ------------------ | --------------- |
| `pages.main.grid.context-menu.item.set-location`     | "Set location"     | "Set Save Path" |
| `components.modals.torrent-details.general.relocate` | "Relocate Torrent" | "Set Save Path" |

No code changes - only translation values.

---

## 4. Add: Set Download Path

`qbService.torrents.setDownloadPath(serverId, hashes, path)` sets `download_path` on selected torrents. This requires a path-input modal, a new command, and surface points in the context menu and modal footer.

### 4a. New command type

**File:** `packages/app/src/app/models/command.model.ts`

Add to `UiCommand`:

```typescript
| { type: 'UI_SET_DOWNLOAD_PATH'; torrent: Torrent; hashes?: string[] }
```

### 4b. New modal: SetDownloadPath

**New files:**

- `packages/app/src/app/components/modals/set-download-path/set-download-path.ts`
- `packages/app/src/app/components/modals/set-download-path/set-download-path.html`
- `packages/app/src/app/components/modals/set-download-path/set-download-path.scss`

Structurally identical to `SetTorrentLocation` with these differences:

|                  | SetTorrentLocation                              | SetDownloadPath                           |
| ---------------- | ----------------------------------------------- | ----------------------------------------- |
| Initial path     | `torrent().save_path`                           | `torrent().download_path`                 |
| API call         | `qbService.torrents.setLocation(...)`           | `qbService.torrents.setDownloadPath(...)` |
| Modal title i18n | `set-torrent-location.title`                    | `set-download-path.title`                 |
| Error i18n       | `set-torrent-location.error.failed-to-relocate` | `set-download-path.error.failed-to-set`   |

No need to load a default path from preferences (unlike `SetTorrentLocation` which reads `prefs.save_path`).

**New i18n keys (us.json + hu.json):**

```
components.modals.set-download-path.title = "Set Download Path"
components.modals.set-download-path.error.failed-to-set = "Failed to Set Download Path"
```

### 4c. Command handler

**File:** `packages/app/src/app/services/ui-command-handler.service.ts`

Add a `case 'UI_SET_DOWNLOAD_PATH':` block mirroring the `UI_SET_TORRENT_LOCATION` block, opening `SetDownloadPath` modal instead.

### 4d. Context menu

**File:** `packages/app/src/app/pages/main/grid/context-menu/grid-context-menu.service.ts`

Add to the `files` submenu immediately after the `files.setLocation` item:

```typescript
{
  kind: 'item',
  id: 'files.setDownloadPath',
  label: 'pages.main.grid.context-menu.item.set-download-path',
  icon: faFolder,
  action: () =>
    this.commandBusService.emit({
      type: 'UI_SET_DOWNLOAD_PATH',
      torrent: data.row,
      hashes,
    }),
},
```

**New i18n key:**

```
pages.main.grid.context-menu.item.set-download-path = "Set Download Path"
```

### 4e. TorrentDetailsActionsService

**File:** `packages/app/src/app/components/modals/torrent-details/torrent-details-actions.service.ts`

Add method:

```typescript
public setDownloadPath(): void {
  this.commandBusService.emit({
    type: 'UI_SET_DOWNLOAD_PATH',
    torrent: this.dataService.torrent()!.data,
    hashes: [this.dataService.hash()],
  });
}
```

---

## 5. Add: Toggle Sequential Download and First/Last Piece Priority

### 5a. New command types

**File:** `packages/app/src/app/models/command.model.ts`

Add to `TorrentCommand`:

```typescript
| { type: 'TORRENT_TOGGLE_SEQUENTIAL_DOWNLOAD' }
| { type: 'TORRENT_TOGGLE_FIRST_LAST_PIECE_PRIO' }
```

No payload needed - these are pure toggles; the API always flips the current state.

### 5b. Torrent command handler

**File:** `packages/app/src/app/services/torrent-command-handler.service.ts`

Add two `case` blocks and two private handlers following the `handleSuperSeeding`/`handleAutoTmm` pattern:

```typescript
case 'TORRENT_TOGGLE_SEQUENTIAL_DOWNLOAD':
  void this.handleToggleSequentialDownload();
  break;
case 'TORRENT_TOGGLE_FIRST_LAST_PIECE_PRIO':
  void this.handleToggleFirstLastPiecePrio();
  break;
```

```typescript
private async handleToggleSequentialDownload(): Promise<void> {
  const ctx = this.getContext();
  if (!ctx) return;
  try {
    await this.qbService.torrents.toggleSequentialDownload(ctx.serverId, ctx.hashes);
  } catch (e: any) {
    this.toastService.danger(
      e?.message ?? String(e),
      this.translateService.instant('services.torrent-command-handler.toast.toggle-sequential-download-failed-title'),
    );
  }
}

private async handleToggleFirstLastPiecePrio(): Promise<void> {
  const ctx = this.getContext();
  if (!ctx) return;
  try {
    await this.qbService.torrents.toggleFirstLastPiecePrio(ctx.serverId, ctx.hashes);
  } catch (e: any) {
    this.toastService.danger(
      e?.message ?? String(e),
      this.translateService.instant('services.torrent-command-handler.toast.toggle-first-last-piece-prio-failed-title'),
    );
  }
}
```

**New i18n keys:**

```
services.torrent-command-handler.toast.toggle-sequential-download-failed-title = "Failed to Toggle Sequential Download"
services.torrent-command-handler.toast.toggle-first-last-piece-prio-failed-title = "Failed to Toggle First/Last Piece Priority"
```

### 5c. Context menu

**File:** `packages/app/src/app/pages/main/grid/context-menu/grid-context-menu.service.ts`

Add two new computed values at the top of `buildTorrentMenu` alongside `allSuperSeeding`/`allAutoTmm`:

```typescript
const allSeqDl = data.selected.every((t) => t.seq_dl);
const allFirstLastPiecePrio = data.selected.every((t) => t.f_l_piece_prio);
```

Add two items to the `transfer` submenu after `speed.superSeeding`:

```typescript
{
  kind: 'item',
  id: 'transfer.sequentialDownload',
  label: allSeqDl
    ? 'pages.main.grid.context-menu.item.disable-sequential-download'
    : 'pages.main.grid.context-menu.item.enable-sequential-download',
  icon: allSeqDl ? faCheck : undefined,
  action: () =>
    this.commandBusService.emit({ type: 'TORRENT_TOGGLE_SEQUENTIAL_DOWNLOAD' }),
},
{
  kind: 'item',
  id: 'transfer.firstLastPiecePrio',
  label: allFirstLastPiecePrio
    ? 'pages.main.grid.context-menu.item.disable-first-last-piece-prio'
    : 'pages.main.grid.context-menu.item.enable-first-last-piece-prio',
  icon: allFirstLastPiecePrio ? faCheck : undefined,
  action: () =>
    this.commandBusService.emit({ type: 'TORRENT_TOGGLE_FIRST_LAST_PIECE_PRIO' }),
},
```

Import `faCheck` in the service (not currently imported).

**New i18n keys:**

```
pages.main.grid.context-menu.item.enable-sequential-download = "Enable Sequential Download"
pages.main.grid.context-menu.item.disable-sequential-download = "Disable Sequential Download"
pages.main.grid.context-menu.item.enable-first-last-piece-prio = "Enable First/Last Piece Priority"
pages.main.grid.context-menu.item.disable-first-last-piece-prio = "Disable First/Last Piece Priority"
```

---

## 6. Redesign: torrent details modal footer

The footer is restructured to mirror the context menu's submenu groupings. Queue and Copy/Pin submenus are omitted (no actionable feedback in the modal context for queue; clipboard/pin are grid-specific).

### 6a. New footer layout

**Old:** Delete | Playback (Resume/Pause/Force Resume) | Limits (Transfer/Share) | Manage (Rename/Set Location/Open Dest/Category/Tags) | Force Reannounce | Close

**New:** Delete | Control | Files | Transfer | Maintenance | Close

| Dropdown        | Items                                                                                                                   |
| --------------- | ----------------------------------------------------------------------------------------------------------------------- |
| **Control**     | Resume, Pause, Force Resume                                                                                             |
| **Files**       | Open Destination (conditional), Set Save Path, Set Download Path, Rename, Rename Files, Set Category, Set Tags          |
| **Transfer**    | Transfer Limits, Share Limits, Super Seeding (toggle), Sequential Download (toggle), First/Last Piece Priority (toggle) |
| **Maintenance** | Force Recheck, Force Reannounce, Auto TMM (toggle)                                                                      |

Toggle items (Super Seeding, Sequential Download, First/Last Piece Priority, Auto TMM) show a `faCheck` icon when currently enabled, reading from `dataService.torrent()?.data`. Fixed label (not flipped like context menu) - the check icon conveys state.

### 6b. i18n changes

**Rename existing keys:**

| Old key              | Old value  | New key              | New value  |
| -------------------- | ---------- | -------------------- | ---------- |
| `...footer.playback` | "Transfer" | `...footer.control`  | "Control"  |
| `...footer.limits`   | "Limits"   | `...footer.transfer` | "Transfer" |
| `...footer.manage`   | "Manage"   | `...footer.files`    | "Files"    |

**New keys:**

```
components.modals.torrent-details.general.footer.maintenance = "Maintenance"
components.modals.torrent-details.general.set-download-path = "Set Download Path"
components.modals.torrent-details.general.footer.sequential-download = "Sequential Download"
components.modals.torrent-details.general.footer.first-last-piece-prio = "First/Last Piece Priority"
components.modals.torrent-details.general.footer.force-recheck = "Force Recheck"
components.modals.torrent-details.general.footer.auto-tmm = "Auto TMM"
components.modals.torrent-details.general.footer.super-seeding = "Super Seeding"
components.modals.torrent-details.general.footer.rename-files = "Rename Files"
```

Existing keys reused: `general.rename` ("Rename Torrent"), `general.relocate` ("Set Save Path" after rename from §3), `general.show-file` / `general.open-destination`, `general.change-category`, `general.change-tags`, `general.footer.transfer-limits`, `general.edit-share-limits`, `general.force-reannounce`.

### 6c. torrent-details.ts: icon map updates

**File:** `packages/app/src/app/components/modals/torrent-details/torrent-details.ts`

Add imports and entries to the `icon` map:

- `faCheck` - toggle state indicator in Transfer and Maintenance dropdowns
- `faRotate` - Maintenance dropdown label icon
- `faFilePen` - Rename Files item

Remove from icon map: `faGauge` is kept (Transfer dropdown label). `faPenToSquare` kept (Rename Torrent item). `faShare` kept (Share Limits).

### 6d. TorrentDetailsActionsService: new methods

**File:** `packages/app/src/app/components/modals/torrent-details/torrent-details-actions.service.ts`

Add the following methods (all operating on `this.dataService.hash()`):

**`setDownloadPath()`** - emits `UI_SET_DOWNLOAD_PATH` (defined in §4e).

**`toggleSequentialDownload()`:**

```typescript
public async toggleSequentialDownload(): Promise<void> {
  try {
    await this.qbService.torrents.toggleSequentialDownload(
      this.serverStoreService.currentServerId() as string,
      [this.dataService.hash()],
    );
  } catch (error: any) {
    this.toastService.danger(
      error?.message ?? String(error),
      this.translateService.instant('...toast.toggle-sequential-download-failed'),
    );
  }
}
```

**`toggleFirstLastPiecePrio()`** - same pattern, calls `qbService.torrents.toggleFirstLastPiecePrio`.

**`forceRecheck()`** - same pattern, calls `qbService.torrents.recheck`. Includes a progress toast (matches `forceReannounce` style).

**`toggleAutoTmm()`:**

```typescript
public async toggleAutoTmm(): Promise<void> {
  const current = this.dataService.torrent()!.data.auto_tmm;
  try {
    await this.qbService.torrents.setAutoManagement(
      this.serverStoreService.currentServerId() as string,
      [this.dataService.hash()],
      !current,
    );
  } catch (error: any) {
    this.toastService.danger(error?.message ?? String(error), ...);
  }
}
```

**`toggleSuperSeeding()`** - same pattern, reads `data.super_seeding`, calls `qbService.torrents.setSuperSeeding`.

**New toast i18n keys for actions service:**

```
components.modals.torrent-details.general.toast.toggle-sequential-download-failed = "Failed to Toggle Sequential Download"
components.modals.torrent-details.general.toast.toggle-first-last-piece-prio-failed = "Failed to Toggle First/Last Piece Priority"
components.modals.torrent-details.general.toast.rechecking = "Rechecking torrent…"
components.modals.torrent-details.general.toast.recheck-failed = "Failed to Recheck Torrent"
components.modals.torrent-details.general.toast.toggle-auto-tmm-failed = "Failed to Toggle Auto TMM"
components.modals.torrent-details.general.toast.toggle-super-seeding-failed = "Failed to Toggle Super Seeding"
```

### 6e. torrent-details.html: footer template

Complete replacement of the `<div class="modal-footer">` block.

**Control dropdown** - same items as current Playback dropdown, key renamed to `footer.control`.

**Files dropdown** - icon `faFolderOpen`, label `footer.files`:

- Open Destination (same conditional logic as current Manage dropdown: `@if (dataService.localPath())`)
- Set Save Path (`actionsService.setLocation()`)
- Set Download Path (`actionsService.setDownloadPath()`)
- Rename (`actionsService.rename()`)
- Rename Files (`actionsService.renameFiles()` - new method emitting `UI_RENAME_FILES`)
- Change Category (`actionsService.changeCategory()`)
- Change Tags (`actionsService.changeTags()`)

**Transfer dropdown** - icon `faGauge`, label `footer.transfer`:

- Transfer Limits (`actionsService.openTransferLimitsModal()`)
- Share Limits (`actionsService.openShareLimitsModal()`)
- Divider
- Super Seeding (check icon when `dataService.torrent()?.data.super_seeding`, calls `actionsService.toggleSuperSeeding()`)
- Sequential Download (check icon when `dataService.torrent()?.data.seq_dl`, calls `actionsService.toggleSequentialDownload()`)
- First/Last Piece Priority (check icon when `dataService.torrent()?.data.f_l_piece_prio`, calls `actionsService.toggleFirstLastPiecePrio()`)

**Maintenance dropdown** - icon `faRotate`, label `footer.maintenance`:

- Force Recheck (`actionsService.forceRecheck()`)
- Force Reannounce (`actionsService.forceReannounce()`)
- Divider
- Auto TMM (check icon when `dataService.torrent()?.data.auto_tmm`, calls `actionsService.toggleAutoTmm()`)

Note: `dataService` is already exposed as a public property on `TorrentDetails`, so it's accessible in the template.

### 6f. TorrentDetailsActionsService: renameFiles method

Add:

```typescript
public renameFiles(): void {
  this.commandBusService.emit({ type: 'UI_RENAME_FILES', hash: this.dataService.hash() });
}
```

---

## 7. Add: "Clear" button to set-torrent-tags modal

### 7a. set-torrent-tags.ts

**File:** `packages/app/src/app/components/modals/set-torrent-tags/set-torrent-tags.ts`

- Add `faEraser` to imports and to the `icons` object.
- Add `hasClearableValue()`: returns `true` when the tags form control has at least one tag selected.
- Add `clear()`: marks the control dirty **before** calling `setValue([])` so that when `valueChanges` fires, `formStatus` captures `dirty = true` and the Save button becomes enabled.

```typescript
public hasClearableValue(): boolean {
  return (this.setTorrentTagsForm.controls.tags.value ?? []).length > 0;
}

public clear(): void {
  const control = this.setTorrentTagsForm.controls.tags;
  control.markAsDirty(); // must precede setValue so valueChanges fires with dirty=true
  control.setValue([]);
}
```

### 7b. set-torrent-tags.html

Add before the Cancel button, following the transfer-limit pattern:

```html
@if (hasClearableValue()) {
<button
  type="button"
  class="btn btn-dashed-danger btn-sm btn-split"
  (click)="clear()"
  [disabled]="saving()"
>
  <bb-btn-content
    [icon]="icons.faEraser"
    [text]="'general.button.clear' | translate"
    position="end"
  ></bb-btn-content>
</button>
}
```

Uses existing `general.button.clear` key ("Clear"). No new i18n key needed.

---

## 8. Add: boolean fields to general tab

**File:** `packages/app/src/app/components/modals/torrent-details/general/general.html`

Add five new `bb-section` entries at the end of the **Transfer** fieldset (after `inactive-seeding-time-limit`), each using a disabled checkbox as the section value:

```html
<div class="col-12 col-lg-6 col-xl-4 bb-section">
  <span class="section-header">
    {{ 'components.modals.torrent-details.general.sequential-download' | translate }}
  </span>
  <span class="section-value">
    <input type="checkbox" class="form-check-input" disabled [checked]="torrent()!.data.seq_dl" />
  </span>
</div>
```

Same pattern for the remaining four fields:

| Field                     | Model property   |
| ------------------------- | ---------------- |
| Sequential Download       | `seq_dl`         |
| First/Last Piece Priority | `f_l_piece_prio` |
| Auto TMM                  | `auto_tmm`       |
| Super Seeding             | `super_seeding`  |
| Force Start               | `force_start`    |

No changes to `general.ts` - all data is already available via `torrent()!.data`.

**New i18n keys:**

```
components.modals.torrent-details.general.sequential-download = "Sequential Download"
components.modals.torrent-details.general.first-last-piece-prio = "First/Last Piece Priority"
components.modals.torrent-details.general.auto-tmm = "Auto TMM"
components.modals.torrent-details.general.super-seeding = "Super Seeding"
components.modals.torrent-details.general.force-start = "Force Start"
```

---

## Files changed summary

| File                                                                   | Change                                                                                                                                                             |
| ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `components/modals/transfer-limit/transfer-limit.ts`                   | Remove `handleSubmit()` from `clearAll()`                                                                                                                          |
| `components/modals/share-limit/share-limit.ts`                         | Remove `handleSubmit()` from `clearAll()`                                                                                                                          |
| `pages/settings/torrent-list-grid/torrent-list-grid.html`              | Swap INLINE_EDIT / NONE order; swap list-item-3/4 in popover                                                                                                       |
| `public/i18n/us.json` + `hu.json`                                      | Multiple key renames and additions (see each section)                                                                                                              |
| `models/command.model.ts`                                              | Add `UI_SET_DOWNLOAD_PATH`, `TORRENT_TOGGLE_SEQUENTIAL_DOWNLOAD`, `TORRENT_TOGGLE_FIRST_LAST_PIECE_PRIO`                                                           |
| `components/modals/set-download-path/*` (3 new files)                  | New modal mirroring SetTorrentLocation                                                                                                                             |
| `services/ui-command-handler.service.ts`                               | Handle `UI_SET_DOWNLOAD_PATH`                                                                                                                                      |
| `services/torrent-command-handler.service.ts`                          | Handle 2 new toggle commands                                                                                                                                       |
| `pages/main/grid/context-menu/grid-context-menu.service.ts`            | Add `setDownloadPath`, `sequentialDownload`, `firstLastPiecePrio` items; import `faCheck`                                                                          |
| `components/modals/torrent-details/torrent-details.ts`                 | Add `faCheck`, `faRotate`, `faFilePen` to icon map                                                                                                                 |
| `components/modals/torrent-details/torrent-details.html`               | Redesign footer (Control/Files/Transfer/Maintenance)                                                                                                               |
| `components/modals/torrent-details/torrent-details-actions.service.ts` | Add 6 new methods: `setDownloadPath`, `toggleSequentialDownload`, `toggleFirstLastPiecePrio`, `forceRecheck`, `toggleAutoTmm`, `toggleSuperSeeding`, `renameFiles` |
| `components/modals/set-torrent-tags/set-torrent-tags.ts`               | Add `faEraser`, `hasClearableValue()`, `clear()`                                                                                                                   |
| `components/modals/set-torrent-tags/set-torrent-tags.html`             | Add conditional Clear button                                                                                                                                       |
| `components/modals/torrent-details/general/general.html`               | Add 5 checkbox fields at end of Transfer fieldset                                                                                                                  |
