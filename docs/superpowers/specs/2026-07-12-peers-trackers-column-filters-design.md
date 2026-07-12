# Peers/trackers column filters + header filter-menu removal - design

## Context

Issue #216's column filter overhaul migrated the main torrent grid's text, number, size,
set, boolean, duration, time-limit, and ratio-limit columns to custom popup filter
components (`TextColumnFilter`, `NumberColumnFilter`, `SizeColumnFilter`,
`SetColumnFilter`, `BooleanColumnFilter`, `DurationColumnFilter`, `TimeLimitColumnFilter`,
`RatioLimitColumnFilter`). The Trackers and Peers torrent-details modal grids were
explicitly left out of that work and still use the built-in
`agTextColumnFilter`/`agNumberColumnFilter` types.

Now that every column type the app needs has a custom filter component, this change
brings Peers and Trackers up to the same standard, and removes the header right-click
"Filter" submenu (Open Filter / Clear Filter / Toggle Floating Filters) everywhere,
since every custom filter can already be opened by clicking the column header and has
its own dedicated Clear button - the menu items are redundant. Clear Filter is also
currently a dead no-op on Peers/Trackers: it calls `FilterService.clearColumnFilter`,
whose signal is only ever consumed by the main grid.

## Scope

1. Generalize `SetColumnFilter` to take its item list from `filterParams` instead of
   being hardcoded to `TorrentStoreService`.
2. Wire custom filter components onto every Peers/Trackers column where a filter makes
   sense, adding a few new hidden `_raw`/`_percentage` sibling columns matching the main
   grid's existing pattern.
3. Remove the header context menu's "Filter" submenu from all three grids, and remove
   the floating-filters feature (now fully dead) from Peers/Trackers, mirroring the
   earlier main-grid cleanup.
4. i18n updates for the above.

## Part 1: Generalize `SetColumnFilter`

**Problem:** `SetColumnFilterParams` is `{ source: 'state' | 'category' | 'tags' }` and
the component injects `TorrentStoreService` directly to resolve `items()`. Peers/Trackers
have no such store - their "set" columns (`country`/`connection`/`client` on Peers,
`status` on Trackers) need their value lists computed from the grid's own current rows.

**New shape** (`set-column-filter.ts`):

```ts
export interface ValueCount {
  key: string;
  label: string;
  count: number;
}

export interface SetColumnFilterParams extends IFilterParams {
  getItems: () => ValueCount[];
  getValues?: (cellValue: unknown) => string[];
}
```

- `ValueCount` moves here from `torrent-store.service.ts` (torrent-store.service.ts
  imports it back from `set-column-filter.ts` - it's a filter concept, not a store one).
- `SetColumnFilter` drops the `TorrentStoreService` injection. `items` becomes
  `computed(() => this.params.getItems())`.
- `doesFilterPass` drops the `this.params.source === 'tags'` branch in favor of:
  ```ts
  const cellValue = this.params.getValue(params.node);
  const values = this.params.getValues
    ? this.params.getValues(cellValue)
    : cellValue != null
      ? [String(cellValue)]
      : [];
  return values.some((v) => this.appliedValues.has(v));
  ```
- New shared helper, colocated in `set-column-filter.ts` and exported:
  ```ts
  export function buildValueCounts<T>(
    rows: readonly T[],
    getValue: (row: T) => string | null | undefined,
  ): ValueCount[] {
    const counts = new Map<string, number>();
    for (const row of rows) {
      const v = getValue(row);
      if (v) counts.set(v, (counts.get(v) ?? 0) + 1);
    }
    return [...counts.entries()]
      .map(([key, count]) => ({ key, label: key, count }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }
  ```

**Call-site changes:**

- `grid.ts`: inject `TorrentStoreService`, pass it into `getGridColDefs(uiFormatService,
translateService, torrentStoreService)`.
- `grid.lib.ts`: `getGridColDefs` gains a third parameter `torrentStoreService:
TorrentStoreService`.
  - `state` column: `filterParams: { getItems: () => torrentStoreService.statesWithCounts() }`
  - `category` column: `filterParams: { getItems: () => torrentStoreService.categoriesWithCounts() }`
  - `tags` column: `filterParams: { getItems: () => torrentStoreService.tagsWithCounts(), getValues: (v) => String(v ?? '').split(',').map((s) => s.trim()).filter(Boolean) }`
- `torrent-store.service.ts`: `categoriesWithCounts`/`tagsWithCounts`/`statesWithCounts`
  keep their exact current logic and behavior (all-known-categories-even-zero-count,
  etc.) - only the `ValueCount` import changes.

**Tests:** update `set-column-filter.spec.ts` to pass `getItems`/`getValues` via
`mockParams` instead of `source` + a mocked `TorrentStoreService`; add a case for
`buildValueCounts`. Update `grid.lib.ts`/`grid.ts` specs for the new
`torrentStoreService` parameter/injection.

## Part 2: Peers grid (`peers.ts`)

Column filter assignments:

| Column                                  | Filter               | Notes                                                                                                                            |
| --------------------------------------- | -------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `country_code`                          | none                 | unchanged (flag icon only)                                                                                                       |
| `country`                               | `SetColumnFilter`    | `getItems: () => countryItems()`                                                                                                 |
| `ip`                                    | `TextColumnFilter`   | was `agTextColumnFilter`                                                                                                         |
| `port`                                  | `NumberColumnFilter` | was `agNumberColumnFilter`                                                                                                       |
| `connection`                            | `SetColumnFilter`    | `getItems: () => connectionItems()`                                                                                              |
| `flags`                                 | `TextColumnFilter`   | was `agTextColumnFilter`                                                                                                         |
| `client`                                | `SetColumnFilter`    | `getItems: () => clientItems()`                                                                                                  |
| `progress`                              | none                 | unchanged (bar renderer)                                                                                                         |
| `progress_percentage` (**new**, hidden) | `NumberColumnFilter` | field `progress`, formatted `(v*100).toFixed(1) + '%'`, filters raw fraction - mirrors main grid's `progress_percentage` exactly |
| `progress_raw` (**new**, hidden)        | `NumberColumnFilter` | field `progress`, no formatter                                                                                                   |
| `dl_speed`                              | `SizeColumnFilter`   | was unfiltered; keeps existing `fileSizePipe.transform` formatter                                                                |
| `dl_speed_raw` (**new**, hidden)        | `NumberColumnFilter` | field `dl_speed`, no formatter                                                                                                   |
| `up_speed`                              | `SizeColumnFilter`   | was unfiltered                                                                                                                   |
| `up_speed_raw` (**new**, hidden)        | `NumberColumnFilter` | field `up_speed`, no formatter                                                                                                   |
| `downloaded`                            | `SizeColumnFilter`   | was unfiltered                                                                                                                   |
| `downloaded_raw` (**new**, hidden)      | `NumberColumnFilter` | field `downloaded`, no formatter                                                                                                 |
| `uploaded`                              | `SizeColumnFilter`   | was unfiltered                                                                                                                   |
| `uploaded_raw` (**new**, hidden)        | `NumberColumnFilter` | field `uploaded`, no formatter                                                                                                   |
| `relevance`                             | `NumberColumnFilter` | was `agNumberColumnFilter`                                                                                                       |
| `files`                                 | none                 | unchanged                                                                                                                        |

New `computed` signals in `Peers` (reading `this.dataService.peers()` directly, using
`buildValueCounts` from `set-column-filter.ts`):

```ts
private readonly countryItems = computed(() =>
  buildValueCounts(this.dataService.peers(), (p) => p.country),
);
private readonly connectionItems = computed(() =>
  buildValueCounts(this.dataService.peers(), (p) => p.connection),
);
private readonly clientItems = computed(() =>
  buildValueCounts(this.dataService.peers(), (p) => p.client),
);
```

New `_raw`/`progress_percentage` columns follow the exact shape of the main grid's
equivalents (`downloaded_raw`, `progress_percentage`, `progress_raw` in `grid.lib.ts`):
`tooltipField` pointing at the base field, `cellClass: 'tabular-nums'`, `hide: true`,
inserted immediately after their base column.

`DEFAULT_PEERS_GRID_SETTINGS.columnState` (`peers-grid.model.ts`) gets entries for the 6
new columns, each `{ colId: '<id>', hide: true }`.

## Part 3: Trackers grid (`trackers.ts`)

| Column           | Filter               | Notes                                                                                                                            |
| ---------------- | -------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `tier`           | `NumberColumnFilter` | was `agNumberColumnFilter`                                                                                                       |
| `url`            | `TextColumnFilter`   | was `agTextColumnFilter`                                                                                                         |
| `status`         | `SetColumnFilter`    | `getItems: () => statusItems()`; `filterValueGetter` (translated label) is unchanged, so `getValue`/matching keeps working as-is |
| `num_peers`      | `NumberColumnFilter` | was `agNumberColumnFilter`                                                                                                       |
| `num_seeds`      | `NumberColumnFilter` | was `agNumberColumnFilter`                                                                                                       |
| `num_leeches`    | `NumberColumnFilter` | was `agNumberColumnFilter`                                                                                                       |
| `num_downloaded` | `NumberColumnFilter` | was `agNumberColumnFilter`                                                                                                       |
| `msg`            | none                 | filter removed (was `agTextColumnFilter`)                                                                                        |

New computed signal in `Trackers`:

```ts
private readonly statusItems = computed(() =>
  buildValueCounts(this.dataService.trackers(), (t) => this.trackerStatusLabel(t.status)),
);
```

No new hidden/raw columns needed - nothing on this grid is byte- or percentage-formatted.
`DEFAULT_TRACKERS_GRID_SETTINGS.columnState` is unchanged.

## Part 4: Remove header "Filter" submenu + floating filters (all 3 grids)

- **`grid-context-menu.service.ts`**: delete the `filter.${payload.colId}` submenu entry
  (Open Filter, Clear Filter, and the conditional Toggle Floating Filters item) from
  `buildHeaderMenu`. Delete the `enableFloatingFiltersToggle`/`onFloatingFiltersToggle`
  options from the `opts` parameter type and the `floatingFilterActive` local. Delete the
  `filterService.clearColumnFilter` call site and the `FilterService` injection (this was
  its only caller in the codebase). Delete `faFilter`/`faFilterCircleXmark` imports (now
  unused); `faEye`/`faEyeSlash` stay - they're also used by the show/hide-column items in
  the Columns submenu.
- **`filter.service.ts`**: remove the now-unreferenced `clearColumnFilter` method (its
  only caller was the deleted context-menu action); `setColumnFilter`/
  `clearAllColumnFilters`/`resetAll` are unaffected and stay.
- **`grid.lib.ts`**: change `gridContextMenuService.buildHeaderMenu(e, {
enableFloatingFiltersToggle: false })` to `gridContextMenuService.buildHeaderMenu(e)`.
- **`peers.ts`** / **`trackers.ts`**:
  - Remove the `onFloatingFiltersToggle` callback passed into `buildHeaderMenu` in
    `onColumnHeaderContextMenu` (now just `buildHeaderMenu(e)`).
  - Remove the floating-filter block from `restoreColumnState` (the
    `floatingFilters`/`newDefs`/`updateGridOptions` dance).
- **`peers-grid.model.ts`** / **`trackers-grid.model.ts`**: remove the `floatingFilters:
boolean` field and its default from `PeersGridSettings`/`TrackersGridSettings`.
- **`peers-grid.settings.service.ts`** / **`trackers-grid.settings.service.ts`**: check
  for any `floatingFilters`-specific handling beyond the generic load/save (expected: none
  beyond the default object).
- **Tests**: update `grid-context-menu.service.spec.ts` (remove filter-submenu
  assertions, the `enableFloatingFiltersToggle` describe block, and the
  `filterService.clearColumnFilter` expectation), `peers.spec.ts`/`trackers.spec.ts`
  (remove floating-filter restore/toggle assertions), and the settings-service specs.

## Part 5: i18n

Remove (both `public/i18n/us.json` and `public/i18n/hu.json`, confirmed unused elsewhere):

- `pages.main.grid.context-menu.submenu.filter`
- `pages.main.grid.context-menu.item.open-filter`
- `pages.main.grid.context-menu.item.clear-filter`
- `pages.main.grid.context-menu.item.show-floating-filters`
- `pages.main.grid.context-menu.item.hide-floating-filters`
- `pages.main.grid.context-menu.tooltip.filter-not-supported`
- `pages.main.grid.context-menu.tooltip.no-filter-active`

Add under `components.modals.torrent-details.peers.col-def` (matching the main grid's
`grid-lib.col-def.*_raw`/`*_percentage` wording exactly):

- `progress_percentage`: "Progress (%)" / "Haladás (%)"
- `progress_raw`: "Progress (raw)" / "Haladás (nyers)"
- `dl_speed_raw`: "Download Speed (raw)" / "Letöltés sebesség (nyers)"
- `up_speed_raw`: "Upload Speed (raw)" / "Feltöltés sebesség (nyers)"
- `downloaded_raw`: "Downloaded (raw)" / "Letöltve (nyers)"
- `uploaded_raw`: "Uploaded (raw)" / "Feltöltve (nyers)"

No new keys needed for Trackers (no new columns) or for the `SetColumnFilter` UI
(reuses existing `components.column-filters.set.*` keys).

## Non-goals

- No changes to the main grid's existing column filter assignments (only the
  `SetColumnFilter`/`TorrentStoreService` plumbing changes, behavior is identical).
- No changes to `files` (Peers) or `msg` (Trackers) beyond removing/not adding a filter.
- No new settings-modal UI for Peers/Trackers floating filters - there wasn't one before
  (the context-menu toggle was the only entry point, and it's being removed).
- No data migration for stale persisted `floatingFilters` values - the field is simply no
  longer read.

## Testing

- `npm run lint`
- `npm test`
- Manual check via `npm start`: open a torrent's details, on the Peers tab filter by
  each new filter type (text/number/size/set) including the new hidden raw/percentage
  columns (via the Columns submenu to unhide them), confirm Set filter checkboxes show
  correct counts and clear via their own Clear button; repeat on the Trackers tab
  including the Status set filter; confirm the header right-click menu no longer shows a
  "Filter" submenu on any of the three grids (main, peers, trackers); confirm the main
  grid's `category`/`tags`/`state` set filters still work identically to before.
