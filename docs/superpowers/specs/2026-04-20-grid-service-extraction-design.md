# BitButler Refactoring Design

**Date:** 2026-04-20
**Branch:** 35-refactoring

---

## Already Shipped

### Bug fix: AddTorrent opens before torrent list is populated

`TorrentStoreService.primed` converted to a `_isPrimed` signal, exposed as `readonly isPrimed`. The `_openDraftsEffect` in `app.ts` now guards on `isPrimed()` before emitting `UI_ADD_TORRENT`, ensuring the modal only opens after the first maindata batch is applied.

**Files changed:** `torrent-store.service.ts`, `app.ts`

---

## Planned Work

### 1. Fix `async` inside `subscribe()` in command handlers

**Files:** `server-command-handler.service.ts`, `transfer-limit-command-handler.service.ts`, `update-command-handler.service.ts`

**Problem:** All three use `.subscribe(async (cmd) => { ... })`. RxJS does not track the returned Promise — if the async callback throws, the error is silently swallowed and the subscription continues unaware. Concurrent emissions can also run handlers in parallel without backpressure.

**Fix:** Replace with the appropriate RxJS flattening operator + `catchError`:

- `ServerCommandHandlerService` → `concatMap` — server CRUD commands must process in order (add then refresh, etc.)
- `TransferLimitCommandHandlerService` → `exhaustMap` — ignore a second toggle while the first API call is in-flight
- `UpdateCommandHandlerService` → `exhaustMap` — ignore duplicate update checks while one is running

Pattern for each:

```typescript
.pipe(
  filter(...),
  concatMap((cmd) => from(this.handleCommand(cmd)).pipe(
    catchError((err) => {
      this.toastService.danger('...');
      return EMPTY;
    }),
  )),
  takeUntilDestroyed(this.destroyRef),
)
.subscribe();
```

The private `handleXxx` methods stay as-is (async functions returning Promises), wrapped in `from()` at the pipe level.

---

### 2. Extract duplicated tracker utility functions

**Files:** `grid.ts:415-428`, `status.ts` (identical copies of `getTrackers` and `normalizeTracker`)

**Fix:** Create `src/app/utils/tracker.utils.ts` with two exported functions:

```typescript
export function getTrackers(t: Torrent): string[] {
  return (t.tracker ?? '').split('\n').filter(Boolean);
}

export function normalizeTracker(raw?: string | null): string {
  const s = (raw ?? '').trim();
  if (!s) return '(none)';
  try {
    const u = new URL(s);
    return u.host || u.hostname || s;
  } catch {
    return s;
  }
}
```

Both `grid.ts` and `status.ts` import from the utility file. The private methods are deleted.

---

### 3. Migrate `FilterService` from `BehaviorSubject` to signals

**File:** `filter.service.ts` and its consumers

**Problem:** The rest of the store layer (`TorrentStoreService`, `SelectionStoreService`, etc.) uses signals. `FilterService` uses `BehaviorSubject` + derived observables, forcing consumers to bridge with `toSignal()` (e.g. `status.ts:52`).

**Fix:** Replace `_state$: BehaviorSubject` with two separate writable signals, each with a custom equality function:

```typescript
private readonly _external = signal<GridExternalFilterParams>(
  GRID_FILTER_INITIAL.external,
  { equal: shallowEqualExternal }
);
private readonly _columns = signal<FilterModel>(
  GRID_FILTER_INITIAL.columns,
  { equal: shallowEqualFilterModel }
);

readonly external = this._external.asReadonly();
readonly columns = this._columns.asReadonly();
```

All setters (`setSearch`, `setStates`, etc.) call `this._external.update(...)` instead of `this._state$.next(...)`. The existing equality guards inside each setter can be removed since the signal's `equal` function handles deduplication.

**Keep `snapshot` and `activeStates`** as getters reading directly from the signal value.

**Consumer updates:**

- `grid.ts`: `filterService.external$` → `toObservable(filterService.external)`, `filterService.columnModel$` → `toObservable(filterService.columns)`; `filterService.snapshot.external` → `filterService.external()`
- `status.ts`: `toSignal(filterService.external$)` → `filterService.external` directly
- Any other consumer of `external$`, `columnModel$`, `state$`, `search$` needs the same treatment

Remove the now-unused observable properties (`state$`, `external$`, `columnModel$`, `search$`) and the `shallowEqual*` functions become internal-only (used only by the signal equality option).

---

### 4. Normalise modal dismiss handling

**File:** `ui-command-handler.service.ts`

**Problem:** `DeleteTorrent` emits `TORRENT_DELETE_CANCEL` on dismiss, but the handler in `TorrentCommandHandlerService` is a no-op `break`. All other modals silently `.catch(() => {})`. The cancel command serves no purpose and the inconsistency is confusing.

**Fix:** Remove `TORRENT_DELETE_CANCEL` from the command model and its no-op handler. Normalise all modal result chains to the same pattern:

```typescript
modalRef.result.then(() => {}).catch(() => {});
```

For modals that do need to react on success (e.g. `ServerEditor` emitting `SERVER_ADDED`), keep the `.then()` handler; only the empty `.catch(() => {})` is the universal dismiss handler.

**Files changed:** `ui-command-handler.service.ts`, `torrent-command-handler.service.ts`, `command.model.ts` (remove `TORRENT_DELETE_CANCEL` type)

---

### 5. Grid component: extract `GridKeyboardNavService` and `GridPinService`

**Files:** `grid.ts` + 2 new files

Both services are added to `Grid`'s `providers: []` array (same pattern as `GridStateService` and `GridContextMenuService`).

#### `GridKeyboardNavService`

**Owns:** `selectionAnchorIndex`, `selectionLeadIndex`, all keyboard logic (`handleGridSelectAll`, `handleGridKeyboardSelection`, `computeNextDisplayedIndex`, `getApproxPageSize`, `isTypingTarget`).

**Injects:** `CommandBusService`, `NgbModal`

**Public API:**

```typescript
init(api: GridApi<Torrent>): void
onKeyDown(event: KeyboardEvent): void
onKeyUp(event: KeyboardEvent): void
get anchorIndex(): number | null
get leadIndex(): number | null
set anchorIndex(v: number | null)
set leadIndex(v: number | null)
```

`@HostListener` methods on `Grid` become one-line delegates. Getter/setter callbacks passed to `getGridOptions` switch from component field references to service property references. `NgbModal` removed from `Grid`'s injection list.

#### `GridPinService`

**Owns:** `pinnedTopHashes`, `pinnedBottomHashes` signals, the effect that partitions torrent rows, and the command bus subscription for `UI_TORRENT_PIN_TOP` / `UI_TORRENT_PIN_BOTTOM` / `UI_TORRENT_UNPIN`.

**Injects:** `TorrentStoreService`, `SelectionStoreService`, `GridStateService`, `CommandBusService`, `DestroyRef`

**Public API:**

```typescript
init(api: GridApi<Torrent>): void
applyPinnedState(top: string[], bottom: string[]): void
```

`TorrentStoreService` removed from `Grid`'s injection list. `applyGridSettings` in `Grid` delegates pin-state restoration to `GridPinService.applyPinnedState`.

#### What stays in `Grid`

Grid wiring, `onApiReady` (calls `init` on all local services), selection-sync effect, filter subscriptions, language-change refresh, `handleCellRightClick`, `handleRowDoubleClick`, `applyGridSettings` (columns/pagination/floating-filters slice), `deselectRows`, `isProgrammaticSelection` flag.

---

## Execution Order

| #   | Work item                   | Files touched                                                                             |
| --- | --------------------------- | ----------------------------------------------------------------------------------------- |
| 1   | `async` in `subscribe()`    | 3 command handler services                                                                |
| 2   | Tracker utility             | new `tracker.utils.ts`, `grid.ts`, `status.ts`                                            |
| 3   | `FilterService` → signals   | `filter.service.ts` + consumers                                                           |
| 4   | Modal dismiss normalisation | `ui-command-handler.service.ts`, `torrent-command-handler.service.ts`, `command.model.ts` |
| 5   | Grid extraction             | `grid.ts` + 2 new service files                                                           |

Items 1, 2, and 4 are independent and can be done in any order. Item 3 (`FilterService`) should come before item 5 (grid extraction) since `grid.ts` is a consumer of `FilterService` — doing them in order means grid.ts is only touched once.
