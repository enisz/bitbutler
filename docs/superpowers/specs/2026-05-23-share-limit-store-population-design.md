# Share Limit & Transfer Limit - Store-Based Population Design

**Date:** 2026-05-23
**Issue:** #104
**Branch pattern:** `104-share-limit-store-population`

## Problem

Both the share-limit and transfer-limit modals rely on `selectionStoreService.selected()` to determine which torrent(s) to act on. When either modal is opened from the torrent details page, the selection signal may be empty or point to different torrents from the grid - the details page emits the command without setting the selection first. This causes the share-limit modal to fall into its `else` branch and fetch global app preferences via `getAppPreferences()`, showing wrong data instead of the viewed torrent's current limits.

Additionally, there is no way to view or edit the global seeding share limits from the status bar, even though global transfer limits already have a clickable widget there.

## Root Cause

`openShareLimitsModal()`, `changeDownloadLimit()`, and `changeUploadLimit()` in `torrent-details/general/general.ts` emit commands without passing the viewed torrent's hash. The modals have no explicit target - they implicitly depend on `SelectionStoreService` state that may be stale or wrong.

## Design

### Guiding principles

- Mirror the existing transfer-limit modal pattern (`target: 'global' | 'torrent'`) in the share-limit modal
- `torrent` target: fully synchronous, torrent store only, no API calls
- `global` target: API call justified (global seeding limits are not in maindata/server state)
- Commands carry their target explicitly - modals never guess from ambient selection state

---

### 1. `command.model.ts`

Extend `UI_LIMIT_SHARE` and `UI_LIMIT_TRANSFER`:

```typescript
| { type: 'UI_LIMIT_SHARE'; target?: LimitTargetType; hashes?: string[] }
| { type: 'UI_LIMIT_TRANSFER'; target: LimitTargetType; hashes?: string[] }
```

- `target` on `UI_LIMIT_SHARE` defaults to `'torrent'` when absent (backwards compatible with context menu callers that omit it)
- `hashes` is only relevant when `target === 'torrent'`; absent means fall back to selection store

---

### 2. `share-limit.ts` (modal component)

Add two inputs:

```typescript
@Input() target: LimitTargetType = 'torrent';
@Input() hashes: string[] = [];
```

**`torrent` target path (synchronous - no loading spinner)**

- Inject `TorrentStoreService`; look up each hash in `torrentsMap()`
- Single torrent: populate `ratioLimit`, `seedingTimeLimit`, `inactiveSeedingTimeLimit` from the torrent's `ratio_limit`, `seeding_time_limit`, `inactive_seeding_time_limit` fields (value if `>= 0`, else `null`)
- Multiple torrents: leave all fields `null` (user explicitly sets the values for all selected torrents)
- No `loading` signal, no `ChangeDetectorRef`, no `QbService` dependency for this path

**`global` target path (async - keeps loading spinner)**

- Load: `getAppPreferences()` → map `max_ratio_enabled`/`max_ratio`/`max_seeding_time_enabled`/`max_seeding_time`/`max_inactive_seeding_time_enabled`/`max_inactive_seeding_time` to `ShareLimitValue`
- Save (`handleSubmit`): call `setAppPreferences()` with `max_ratio_enabled: value !== null, max_ratio: value ?? 0` pattern for each field
- `loading`, `ChangeDetectorRef`, and `QbService` retained only for this path

**Display signals (`selected`, `selectionName`, `tooltipText`)**: currently read from `selectionStoreService.selected()`. Replace with store+hashes lookups:

- `selected`: derive from `this.hashes.length`
- `selectionName`: if `hashes.length === 1`, look up `torrentsMap().get(hashes[0])?.name`; else use `hashes.length`
- `tooltipText`: same source, keep the `String()` coercion

**`handleSubmit()` hashes**: replace `selectionStoreService.selectedHashes()` with `this.hashes` for the torrent path.

**`selectionStoreService`**: can be fully removed from the share-limit modal (hashes and names now come from `@Input` + `TorrentStoreService`).

**`clearAll()` and `hasClearableValues()`**: no changes needed - they operate on form values, both paths use the same form.

---

### 3. `transfer-limit.ts` (modal component)

Add input:

```typescript
@Input() hashes: string[] = [];
```

**`torrent` target path**: replace `selectionStoreService.selected()[0]` lookup with `TorrentStoreService.torrentsMap()` lookups using `this.hashes`. Read `up_limit` and `dl_limit` from the first hash found in the store. Keep same conversion: `bytes > 0 ? Math.floor(bytes / 1024) : null`.

**`global` target path**: unchanged (API calls remain, `loading` and `ChangeDetectorRef` remain).

**Display signals (`selected`, `selectionName`, `tooltipText`)**: same update as share-limit modal - derive from `this.hashes` and `TorrentStoreService` instead of `selectionStoreService.selected()`.

**`handleSubmit()` hashes**: switch from `selectionStoreService.selected().map(t => t.hash)` to `this.hashes` for the torrent target.

**`selectionStoreService`**: can be removed from transfer-limit modal for the torrent target path. The global target path never used it for hashes, so it can be removed entirely.

---

### 4. `ui-command-handler.service.ts`

**`UI_LIMIT_SHARE` handler:**

```typescript
const target = command.target ?? 'torrent';
const hashes = command.hashes ?? this.selectionStoreService.selectedHashes();
const ref = this.modalService.open(ShareLimit, { size: 'lg' });
ref.componentInstance.target = target;
ref.componentInstance.hashes = hashes;
```

**`UI_LIMIT_TRANSFER` handler:**

```typescript
const hashes = command.hashes ?? this.selectionStoreService.selectedHashes();
const ref = this.modalService.open(TransferLimit, { centered: true, size: 'lg' });
ref.componentInstance.target = command.target;
ref.componentInstance.hashes = hashes;
```

---

### 5. `torrent-details/general/general.ts`

```typescript
openShareLimitsModal(): void {
  this.commandBusService.emit({ type: 'UI_LIMIT_SHARE', target: 'torrent', hashes: [this.hash] });
}

changeDownloadLimit(): void {
  this.commandBusService.emit({ type: 'UI_LIMIT_TRANSFER', target: 'torrent', hashes: [this.hash] });
}

changeUploadLimit(): void {
  this.commandBusService.emit({ type: 'UI_LIMIT_TRANSFER', target: 'torrent', hashes: [this.hash] });
}
```

---

### 6. `server-state.ts`

Add method:

```typescript
setGlobalShareLimit(): void {
  this.commandBusService.emit({ type: 'UI_LIMIT_SHARE', target: 'global' });
}
```

Wire to the ratio widget in `server-state.html` using the same click pattern as `setGlobalTransferLimit()` on the dl/ul widgets (check `@case ('ratio')` in the template).

---

## Data flow summary

```
Details page (single torrent)
  → UI_LIMIT_SHARE { target: 'torrent', hashes: [hash] }
  → modal.target = 'torrent', modal.hashes = [hash]
  → TorrentStoreService.torrentsMap().get(hash) → populate form (sync)

Context menu (1 or many torrents)
  → UI_LIMIT_SHARE { } (no target, no hashes)
  → handler resolves: target = 'torrent', hashes = selectedHashes()
  → TorrentStoreService lookups (sync)

Server-state ratio widget
  → UI_LIMIT_SHARE { target: 'global' }
  → modal.target = 'global'
  → getAppPreferences() → populate form (async, spinner shown)
  → on save: setAppPreferences() with enabled flags
```

---

## What does NOT change

- Context menu emission (`{ type: 'UI_LIMIT_SHARE' }` with no args) - remains valid
- Global transfer limit modal (server-state dl/ul widgets) - unchanged
- The `ShareLimitValue` type and the `share-limit` form component - unchanged
- The `TransferLimitValue` type and the `transfer-limit` form component - unchanged
- Save path for torrent share limits: still calls `qbService.setShareLimits()` with hashes
- All existing tests for the context menu spec that check `UI_LIMIT_SHARE` emission

---

## Files to change

| File                                                                           | Change                                                          |
| ------------------------------------------------------------------------------ | --------------------------------------------------------------- |
| `packages/app/src/app/models/command.model.ts`                                 | Extend `UI_LIMIT_SHARE` and `UI_LIMIT_TRANSFER` types           |
| `packages/app/src/app/components/modals/share-limit/share-limit.ts`            | Add target/hashes inputs, torrent/global paths, store injection |
| `packages/app/src/app/components/modals/share-limit/share-limit.spec.ts`       | Update tests                                                    |
| `packages/app/src/app/components/modals/transfer-limit/transfer-limit.ts`      | Add hashes input, use store for torrent target                  |
| `packages/app/src/app/components/modals/transfer-limit/transfer-limit.spec.ts` | Update tests                                                    |
| `packages/app/src/app/services/ui-command-handler.service.ts`                  | Pass target + hashes to both modals                             |
| `packages/app/src/app/components/modals/torrent-details/general/general.ts`    | Emit with target + hash                                         |
| `packages/app/src/app/pages/main/server-state/server-state.ts`                 | Add `setGlobalShareLimit()`                                     |
| `packages/app/src/app/pages/main/server-state/server-state.html`               | Wire ratio widget click                                         |
