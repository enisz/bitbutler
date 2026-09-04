# Generalized breakdown & stat-tile widgets - design

Issue: #324 follow-up. Branch: `324-dashboard-page`.

## Goal

Replace the pie chart's hardcoded 2-value `groupBy: 'state' | 'category'`
with a generic, field-driven breakdown, add a new `bar-chart` widget
that shares the same breakdown logic (filling the `column` chart type
already reserved but unused in `WidgetChartType`), and generalize
`stat-tile` so it isn't limited to a fixed list of 10 metrics.

## Non-goals

- **Sum/average aggregates.** Every breakdown slice/bucket is a torrent
  _count_ only, not a sum of another field (e.g. total size per
  category). A real feature, but a separate aggregate concept - out of
  scope here.
- **Time-series / line chart widget.** Needs a client-side rolling
  sample buffer (nothing persists historical speed today) - its own
  feature, unrelated to the breakdown/count work here.
- **Configurable top-N cap.** The categorical high-cardinality cap
  (below) is a fixed constant, not a per-widget config option.

## 1. Breakdown field catalog

New file `packages/app/src/app/pages/dashboard/breakdown-field-catalog.ts`,
the same shape/spirit as the existing `torrent-field-catalog.ts`. Not
every `Torrent` field is meaningful to group by (grouping by `hash` or
`name` gives one slice per torrent), so this is a curated 9-field list
rather than "any field":

| Field       | Kind                             | Notes                                                     |
| ----------- | -------------------------------- | --------------------------------------------------------- |
| `state`     | categorical                      | Reuses the existing 7-bucket map (moved here, see below)  |
| `category`  | categorical                      | Single-valued. Empty -> `'-'`, matching today's behavior  |
| `tracker`   | categorical                      | Single-valued                                             |
| `save_path` | categorical                      | Single-valued                                             |
| `tags`      | categorical, `multiValued: true` | Comma-separated - a torrent can land in multiple slices   |
| `ratio`     | numeric, bucketed                | `<0.1` / `0.1-0.5` / `0.5-1` / `1-2` / `>=2`              |
| `progress`  | numeric, bucketed                | `0-25%` / `25-50%` / `50-75%` / `75-99%` / `100%`         |
| `size`      | numeric, bucketed                | `<1GiB` / `1-5GiB` / `5-20GiB` / `20-100GiB` / `>=100GiB` |
| `eta`       | numeric, bucketed                | `Unknown` / `<1h` / `1-6h` / `6-24h` / `1-7d` / `>=7d`    |

```ts
export type BreakdownField =
  | 'state'
  | 'category'
  | 'tracker'
  | 'save_path'
  | 'tags'
  | 'ratio'
  | 'progress'
  | 'size'
  | 'eta';

export interface BreakdownBucket {
  key: string; // stable id, e.g. 'lt-0.1'
  labelKey: string;
  test: (value: number) => boolean; // first match wins - order matters
}

export interface BreakdownFieldMeta {
  field: BreakdownField;
  labelKey: string; // reuses torrent-field-catalog's col-def keys where they exist
  kind: 'categorical' | 'numeric';
  multiValued?: boolean; // only 'tags' - excluded from pie-chart's field list
  buckets?: BreakdownBucket[]; // only for kind: 'numeric'
}
```

`state`'s existing `PIE_STATE_BUCKETS`/`PIE_STATE_BUCKET_ORDER` move
here unchanged from `widget-selectors.ts` and back the `state` catalog
entry's categorical grouping (see below - `state` keeps its curated
display order, it does not go through top-N capping or count-sort).

**`eta`'s bucket order matters**: qBittorrent returns a sentinel
(`8640000`, i.e. 100 days) for "no estimate" (stalled/no peers), not a
real duration. The `Unknown` bucket's test (`value >= 8640000`) must be
checked before the `>=7d` bucket's test, or every unknown-ETA torrent
would misleadingly count as ">=7d". Buckets are evaluated in array
order, first match wins - `Unknown` is listed first.

## 2. Config model changes (`dashboard.model.ts`)

`PieChartConfig` keeps its existing `groupBy` property name (not
renamed to `field`) specifically so already-saved dashboards
(`{ groupBy: 'state' }` / `{ groupBy: 'category' }`) keep working with
**no migration code** - its type just widens to the single-valued
categorical subset:

```ts
export type PieChartField = 'state' | 'category' | 'tracker' | 'save_path';

export interface PieChartConfig {
  groupBy: PieChartField;
}
```

(`tags` is excluded from pie - a multi-valued field breaks a pie
chart's "slices sum to the whole" meaning. Numeric fields are excluded
too - a histogram doesn't read as a proportion-of-whole.)

New, brand-new type for the new widget - no legacy data, so it uses the
catalog's natural name:

```ts
export interface BarChartConfig {
  field: BreakdownField; // all 9 fields valid here
}
```

`StatTileConfig` becomes a union. The existing shape (`{ metric }`)
stays valid as-is - the new variant is additive, distinguished by an
explicit `source` tag that's simply absent on old data:

```ts
export type StatTileConfig =
  | { metric: ServerMetricId } // ServerMetricId: see §5 - superset of today's StatTileMetric
  | { source: 'torrent-count'; field: BreakdownField; value: string };
```

`value` stores a slice/bucket **key** (a `BreakdownSlice.key`/
`BreakdownBucket.key`, e.g. `'lt-0.1'` for a ratio bucket or a raw
category string), never a translated label - the same convention
`torrent-list`'s `columns`/`sortField` already use for storing
`TorrentField` names rather than display text.

`WidgetTypeId` gains `'bar-chart'`. `WidgetConfig` widens to include
`BarChartConfig`.

## 3. Selector layer (`widget-selectors.ts`)

One shared counting function backs both categorical and numeric
breakdown fields, used by pie, bar, and stat-tile's torrent-count mode:

```ts
export interface BreakdownSlice {
  key: string;
  labelKey?: string;
  value: number;
}

// Uncapped, exact count for one specific key/bucket - used directly by
// stat-tile's torrent-count mode, and internally before capping below.
function countBreakdownValue(torrents: Torrent[], field: BreakdownField, key: string): number;

// Full breakdown for chart display: categorical fields are sorted by
// count desc and capped to the top 7 + a synthetic 'other' slice
// (`pages.dashboard.widgets.breakdown.other`); numeric fields render
// every defined bucket in its fixed order, including zero-count ones
// (a histogram's shape is part of the point - unlike a pie chart, an
// empty bar isn't noise); 'state' keeps its own curated 7-bucket order
// and never hits the cap (it's already <=7 by construction).
export function selectBreakdownCounts(torrents: Torrent[], field: BreakdownField): BreakdownSlice[];
```

`tags` counting splits `t.tags` on `,`, trims, and skips empty
segments - a torrent contributes once per tag, and a tagless torrent
contributes to nothing (no synthetic "untagged" slice, unlike
`category`'s `'-'`).

`selectPieChartData`/new `selectBarChartData` both become one-line
wrappers around `selectBreakdownCounts`. `resolveWidgetData`'s switch
gains the `bar-chart` case.

`selectStatTileData` gains a check before its existing `metric`-keyed
switch, discriminating on the presence of `source` rather than a
literal tag value (so old data, which never has `source`, keeps
falling through to the existing switch untouched):

```ts
if ('source' in config) {
  return {
    source: 'torrent-count',
    value: countBreakdownValue(torrents, config.field, config.value),
  };
}
// ...existing metric switch, now including the new ServerMetricId cases (§5)
```

## 4. `bar-chart` widget

New `packages/app/src/app/pages/dashboard/widgets/bar-chart-widget/`,
same `BaseWidget` + Chart.js pattern as `pie-chart-widget.ts` (register
`BarController`/`CategoryScale`/`LinearScale`/`BarElement` at module
scope, same lazy-bundle rationale). Renders `slices` as a single-dataset
bar chart: x-axis = slice labels, y-axis = count.

`PieChartWidget` and the new `BarChartWidget` currently would each
duplicate ~50 lines of theme-color reading + language-aware memoization
(`themeColors()`/`bodyColor()`/`cachedSignature`/`cachedConfig` in
`pie-chart-widget.ts`). Pull that into a small shared helper, e.g.
`widgets/chart-widget-utils.ts` (`themeColors(styles)`, `bodyColor(styles)`,
and a generic `memoizeBySignature(compute, signatureInputs)`), and have
both widgets use it - a targeted cleanup enabled by, not separate from,
this work.

`WIDGET_CATALOG['bar-chart']`: `chartType: 'column'`, icon `faChartBar`,
`defaultConfig: { field: 'state' }` , `defaultSize: { w: 4, h: 4 }`
(same footprint as pie-chart).

## 5. `WidgetConfigModal` changes

- Pie-chart's field select: options limited to the 4 `PieChartField`
  values (was the hardcoded `groupByOptions`).
- Bar-chart's field select: all 9 `BreakdownField` values, grouped via
  `ng-select`'s `groupBy` into "By category" / "By value range"
  sections.
- Stat-tile gets a two-step config: a `source` toggle ("Server metric" /
  "Torrent count"), then either the existing metric select (options now
  read from `SERVER_METRIC_CATALOG`, §5below - was a separately
  hand-maintained array duplicating the model's union) or, for
  torrent-count, a field select (`BreakdownField`) followed by a
  dependent value select.
- The torrent-count value select needs to show values _actually
  present_ right now (e.g. real category names, or a numeric field's
  bucket labels) - the same live-enumeration idea as an AG Grid Set
  Filter. This means `WidgetConfigModal` needs a new dependency on
  `TorrentStoreService` it doesn't have today, to compute
  `selectBreakdownCounts(torrentStore.torrentsArray(), field)` reactively
  as the field selection changes and list its `{key, labelKey?}`s as
  options.

## 6. Stat-tile generalization (`server-metric-catalog.ts`)

New file, same pattern as `torrent-field-catalog.ts`, replacing both
the model's `StatTileMetric` union and the config modal's separately
hand-maintained `statTileMetrics` array (today's actual duplication)
with one source of truth:

```ts
export type ServerMetricId =
  | 'download_speed'
  | 'upload_speed'
  | 'active_count'
  | 'global_ratio'
  | 'session_ratio'
  | 'global_downloaded'
  | 'session_downloaded'
  | 'global_uploaded'
  | 'session_uploaded'
  | 'free_disk_space'
  // new:
  | 'dht_nodes'
  | 'total_peer_connections'
  | 'download_limit'
  | 'upload_limit';

export interface ServerMetricMeta {
  id: ServerMetricId;
  labelKey: string; // pages.dashboard.widgets.stat-tile.metric.<id>
  displayKind: 'speed' | 'bytes' | 'ratio' | 'count';
}

export const SERVER_METRIC_CATALOG: ServerMetricMeta[] = [
  /* 14 entries */
];
```

`stat-tile.ts`'s `displayKind` getter (currently a hand-maintained
switch that has to be kept in sync with the metric union) becomes a
catalog lookup: `SERVER_METRIC_META_BY_ID[this.data.metric].displayKind`.
`selectStatTileData` gains the 4 new `serverState?.<field> ?? 0`
lookups (`dht_nodes`, `total_peer_connections`, `dl_rate_limit`,
`up_rate_limit`).

`active_count` is unaffected - it stays a `ServerMetricId` computed from
torrents (not `server_state`), exactly as today; it is not replaced by
the new torrent-count mechanism, since existing saved dashboards
already reference it by that name.

## Known limitation (accepted, not solved here)

A torrent-count stat-tile always counts against the exact key/bucket
the user picked via `countBreakdownValue` (uncapped), so it stays
correct even if that value would've been folded into "Other" on a
pie/bar widget showing the same field. The limitation that _is_
accepted: if the value a stat-tile points at (e.g. a specific tracker
string) later disappears from the data entirely (torrent removed,
tracker changed), the tile silently shows 0 rather than surfacing that
its configured value no longer exists. Same class of staleness as an
existing torrent-list widget configured to sort by a field that later
gets removed from `Torrent` - not new to this design, not solved here.

## Files touched

- `breakdown-field-catalog.ts` (new) - field/bucket definitions, moved
  `PIE_STATE_BUCKETS`/`PIE_STATE_BUCKET_ORDER`
- `server-metric-catalog.ts` (new) - unified stat-tile metric catalog
- `dashboard.model.ts` - `PieChartField`, `BarChartConfig`,
  `BarChartData`, generalized `StatTileConfig` union, `ServerMetricId`
  replacing `StatTileMetric`, `'bar-chart'` added to `WidgetTypeId`
- `widget-selectors.ts` - `selectBreakdownCounts`,
  `countBreakdownValue`, `selectBarChartData`, updated
  `selectPieChartData`/`selectStatTileData`/`resolveWidgetData`
- `widget-catalog.ts` - new `bar-chart` entry
- `widgets/bar-chart-widget/` (new) - component, template, styles, spec
- `widgets/chart-widget-utils.ts` (new) - shared theme-color +
  memoization helper, adopted by both `pie-chart-widget.ts` and the new
  bar-chart widget
- `widgets/stat-tile/stat-tile.ts` - `displayKind` becomes a catalog
  lookup
- `modals/widget-config/widget-config.ts/.html` - narrowed pie field
  list, new bar-chart field select, two-step stat-tile config, new
  `TorrentStoreService` dependency for live value enumeration
- `packages/app/public/i18n/us.json`, `hu.json` - new keys: bar-chart
  catalog label, breakdown bucket labels (ratio/progress/size/eta),
  `breakdown.other`, 4 new stat-tile metric labels

## Testing

- Unit specs: `breakdown-field-catalog.spec.ts` (bucket boundary
  correctness per field, especially eta's unknown-sentinel ordering),
  `widget-selectors.spec.ts` (categorical capping/sort, tags
  multi-counting, numeric bucketing including zero-count buckets,
  `countBreakdownValue` uncapped correctness), `server-metric-catalog`
  additions covered via existing `widget-selectors.spec.ts` metric
  cases, `bar-chart-widget.spec.ts` (chart options built correctly),
  `widget-config.spec.ts` (pie field list narrowed, bar field grouping,
  stat-tile two-step source switch, value options reflect live store
  data).
- Manual: add a bar-chart widget for each of the 9 breakdown fields and
  confirm bucket boundaries/labels look right; add a stat-tile in
  torrent-count mode pointed at a category, confirm it tracks the live
  count; confirm old saved dashboards (existing `pie-chart`/`stat-tile`
  configs) still load and render unchanged.
