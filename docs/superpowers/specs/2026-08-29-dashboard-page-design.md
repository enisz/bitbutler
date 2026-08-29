# Dashboard Page - Design Spec

## Overview

Add a new "Dashboard" page to BitButler: a widget-based overview of the
currently selected server's torrents and transfer activity (inspired by a
generic analytics-dashboard layout - stat tiles, ranked torrent lists).
Widgets are user-configurable and freely arranged via a drag/resize grid
(GridStack.js), with data computed centrally so cost scales with what's
actually placed on the board rather than with the full torrent count.

## Motivation

BitButler currently has a single content page (`Main`, the torrent grid).
The recently-added navigation shell (#319) makes it possible to add peer
pages, reachable via the Electron "View" menu. A dashboard is a natural
first addition: a quick-glance overview that doesn't require scanning a
15,000-row grid to answer "how much am I downloading right now" or "what
are my top seeds."

The core technical question driving this design: with 10,000-15,000
torrents in the store, can per-widget aggregation (top-N by ratio, active
transfers, etc.) be done without serious performance impact? Answer:
yes, provided aggregation is centralized and lazy per placed widget
(see "Widget catalog & data flow" below) - a single filter+sort pass over
15k plain objects is low-single-digit milliseconds, and global tiles
(speed, ratio, free disk space) are already delivered pre-aggregated by
qBittorrent's `server_state` payload, requiring no per-torrent scan at all.

## Goals (v1)

- A new routed page, reachable from the View menu, showing a
  user-configured grid of widgets for the currently selected server.
- Two widget types: a single-value "stat tile" and a "torrent list"
  (top/bottom N by a chosen field).
- A "Live" toggle: on, widgets track live poll data; off, the view freezes
  on the last-received snapshot with no network activity.
- An "Edit mode" toggle gating add/remove/configure/rearrange of widgets;
  outside edit mode the dashboard is a read-only live view.
- Widget layout (which widgets, position, size, per-widget config)
  persisted per the existing settings pattern.

## Non-goals (v1, explicitly deferred)

- **Recent activity feed** (completed/errored/added event log) - requires
  new history-buffer plumbing (a ring buffer fed by `delta$`/`finished$`)
  that doesn't exist today. Fast-follow candidate once the base dashboard
  is proven out.
- **Multi-server aggregation/comparison** - dashboard is scoped to the
  currently selected server only, matching `Main`'s existing single-server
  UX.
- **Rich disk usage (per-mount-point breakdown)** - qBittorrent only
  exposes a single `free_space_on_disk` value for its default save path;
  per-mount/per-path breakdown needs new OS-level disk-stats IPC, out of
  scope here. Covered in v1 only via the generic stat tile's
  `free_disk_space` metric.
- **Widget-level filtering** (by state/category/tag) - the torrent list
  widget is count + sort field + sort order only. No filter concept in v1,
  including for an "active transfers"-style widget (achieved via sorting
  alone, e.g. `sortField: progress, sortOrder: asc`, not a state filter).
- **In-widget interactive sorting** - a placed torrent-list widget has no
  clickable/sortable column headers. Its order is fixed by its config and
  re-derives automatically as poll data changes; it is a pure display of
  whatever ordered array its data selector produces.

## Architecture

### Routing & nav integration

- New route `pages/dashboard` (`packages/app/src/app/pages/dashboard/`),
  lazy-loaded like `Main`.
- New radio item in the Electron "View" submenu (`packages/electron/src/menu.ts`):
  label key `view-dashboard`, `viewId: 'dashboard'`, using the existing
  `view.select` → `UI_VIEW_SELECT` → `router.navigate(['/pages', viewId])`
  pipeline unchanged. New i18n keys in `us.json`/`hu.json`.
- Navigation remains strictly one page at a time (existing router
  behavior, no shared shell/sidebar). Leaving `Main` tears down its
  polling subscription via `ngOnDestroy` as today; entering `Dashboard`
  starts its own subscription the same way. `QbPollingService`'s
  `lastPolledServerId` guard means switching pages for the _same_ server
  resumes from the cached `rid` rather than a full reload.

### Data source: moving `server_state` into the store

`server_state` (global dl/up speed, all-time ratio, free disk space)
currently arrives on every `Maindata` poll response but is merged into
local component state inside `Main` (`mergeServerState`), so it's only
available while `Main` is mounted. This needs to move into
`TorrentStoreService`, populated at the same point `applyMaindata` already
runs, so `Dashboard` can read it independently of `Main` ever having been
opened. `Main`'s footer status bar switches to reading the same signal
from the store instead of local state - a small, mechanical refactor with
no behavior change for `Main`.

### Live / pause toggle

`Dashboard` owns `live = signal(true)`. An `effect()` reacts to `live()`
and `serverStore.currentServer()`:

- `live = true` → `qbPolling.startMaindataPolling(serverId)` (or
  `resume()` if already started this session) and subscribe.
- `live = false` → `qbPolling.pause(token)` - reusing the existing
  pause/resume mechanism (already used elsewhere to avoid clobbering an
  in-flight edit) rather than unsubscribing/resubscribing. This freezes
  `TorrentStoreService` at its last-received snapshot with zero network
  calls, and resuming continues from the same `rid` with no reload.

### Widget catalog & data flow

Two widget types cover the target scope via configuration rather than
bespoke components per widget:

- **Stat tile** - one number + label + unit. Config: which metric
  (`download_speed` / `upload_speed` / `active_count` / `global_ratio` /
  `free_disk_space`), all sourced from `server_state` or
  `torrentsMap().size` - O(1), no scan.
- **Torrent list** - a small ranked, read-only list. Config: `count`,
  `sortField` (curated set: ratio, download speed, upload speed, size,
  progress, added date, ETA), `sortOrder`, and visible columns (a curated
  subset matching the same field vocabulary, plus name/state/category for
  context).

Catalog entry shape:

```ts
interface WidgetCatalogEntry<TConfig, TData> {
  id: string;
  label: string;
  component: Type<DashboardWidgetComponent<TData>>;
  defaultConfig: TConfig;
  defaultSize: { w: number; h: number };
  selector: (snapshot: DashboardSnapshot, config: TConfig) => TData;
}
```

`Dashboard` holds the placed-widget list (from persisted layout) and, per
instance, derives `computed(() => catalog[widgetTypeId].selector(snapshot(), instance.config))`,
memoized per instance id. Cost scales only with what's actually placed on
the board, and only the fields/columns actually configured are touched -
a widget not on the board never runs its selector at all.

### Edit mode & GridStack wiring

`editMode = signal(false)`, off by default. When on: GridStack becomes
draggable/resizable (`grid.setStatic(false)`), each placed widget shows a
gear icon (opens its config popover) and a remove icon, and an
"Add Widget" button (dashboard header) becomes active. When off:
`grid.setStatic(true)`, all editing affordances hidden - a plain,
uninterruptible live view.

**Add-widget flow:** "Add Widget" (edit mode only) → picker listing the
catalog entries → selecting one opens its config panel pre-filled with
`defaultConfig` → confirming adds it to the grid at the next open slot
(GridStack auto-placement) → since edit mode is already active, the user
can immediately drag/resize it. The same config panel is reused later
(via the gear icon) to edit an already-placed widget's config.

**GridStack integration:** `DashboardGrid` owns a single
`GridStack.init()` instance against a `.grid-stack` container (12-column
layout). For each widget instance in the persisted layout, it calls
`grid.addWidget({x, y, w, h, id})` to get a container node, then
`ViewContainerRef.createComponent(catalogEntry.component)` to mount the
widget into it. An `effect()` per widget instance watches that instance's
memoized `computed()` and calls `componentRef.setInput('data', value)`
whenever it changes - GridStack's own drag/resize DOM mutations stay
entirely outside Angular's reactivity, the same pattern already used to
wrap ag-grid directly rather than through a third-party Angular wrapper.

### Persistence

`DashboardSettingsService extends BaseSettingsService<DashboardLayout>`,
`SETTINGS_ID = 'DashboardSettingsService'`, following the same pattern as
`TorrentListGridSettingsService`.

```ts
interface DashboardWidgetInstance {
  instanceId: string;
  widgetTypeId: 'stat-tile' | 'torrent-list';
  x: number;
  y: number;
  w: number;
  h: number;
  config: StatTileConfig | TorrentListConfig;
}

interface DashboardLayout {
  widgets: DashboardWidgetInstance[];
}
```

`DEFAULT_SETTINGS` ships a small starter layout (four stat tiles: download
speed, upload speed, active count, global ratio) so a first-time visit
isn't a blank canvas.

GridStack's `change`/`dragstop`/`resizestop` events (not the noisier
intermediate drag events) trigger a debounced `save()`; add/remove/config
edits save immediately.

## Testing strategy

- **Widget catalog selectors** - pure `(snapshot, config) => data`
  functions, unit-tested with fixture torrent arrays (empty map, ties on
  the sort field, fewer torrents than the configured count).
- **`DashboardSettingsService`** - same test shape as existing
  `BaseSettingsService`-derived specs (defaults, load/merge, save
  round-trip).
- **Widget components** (`StatTile`, `TorrentListWidget`) - dumb
  components, tested by feeding `data` inputs and asserting rendered
  output; no store/service mocking needed.
- **`Dashboard` page** - test the `live`/`editMode` effects in isolation
  by spying on `QbPollingService` (`startMaindataPolling`/`pause`/`resume`
  called correctly) and a mocked GridStack instance (`setStatic` called
  correctly on `editMode` change) - mirrors how the existing grid
  wrapper's spec mocks ag-grid's API rather than exercising real DOM
  behavior.
- **Menu/routing wiring** - extend the existing `menu.spec.ts`,
  `menu-bar-command-handler.service.spec.ts`, and
  `ui-command-handler.service.spec.ts` cases for `'torrent-list'` with a
  mirrored `'dashboard'` case.
- **Not unit-tested:** actual GridStack drag/resize physics (third-party,
  DOM-dependent) - verified manually in the running app per the project's
  usual UI-change workflow.

## Open questions for a future iteration

- Recent activity feed (needs a new history-buffer service).
- Widget-level filtering (state/category/tag) once a concrete need shows
  up.
- Multi-server aggregate view.
- Richer disk usage (per-mount-point), requiring new Electron-side
  disk-stats IPC.
