# Dashboard restyle + chart widgets - design

Issue: #324 follow-up. Branch: `324-dashboard-page`.

## Goal

Bring the dashboard's visual language in line with the reference design
(Figma file linked in the issue conversation), remove the separate
"manage widgets" list in favor of a per-widget menu, fix widget rows
snapping to whatever height gridstack gives them, and introduce a
chart-widget category backed by Highcharts, starting with one
configurable pie chart.

## Non-goals

The reference design also shows a bandwidth-over-time chart,
peers-by-client, per-mount-point disk usage, and a recent-activity
feed. None of these are built on data BitButler currently has:

- **Bandwidth, 24h** needs a client-side time-series sampler (nothing
  persists historical dl/up speed today).
- **Peers by client** needs a new aggregation across
  `sync/torrentPeers` per torrent (no existing IPC call for this).
- **Disk usage** per mount path isn't exposed by qBittorrent's API at
  all - it only reports free space for the save path, which is already
  a `stat-tile` metric.
- **Recent activity** needs an event/audit log BitButler doesn't
  track.

Each is its own feature. Out of scope here.

## 1. Visual restyle

Restyle `dashboard.html`/`.scss` and the two widget components
(`stat-tile`, `torrent-list-widget`) to match the reference design's
card treatment - small-caps label, bold value, card surface/border -
using the existing `--bs-card-bg` / `--bs-border-color` / `--bs-*`
tokens rather than hardcoding the reference's dark palette, so it
renders correctly across all 8 theme families and both light/dark
modes without any new theme work.

## 2. Remove the manage panel; add a per-widget menu

Delete `dashboard__manage-panel` (the `<ul>` listing every widget with
Edit/Delete buttons) from `dashboard.html` and `dashboard.ts` entirely.

Each widget card gets a `⋮` (vertical ellipsis) button in its top-right
corner, rendered only while `editMode()` is true. Note: drag/resize is
already correctly gated to edit mode via `staticGrid: !editMode()` in
`gridOptions()` (dashboard.ts:100) - no change needed there.

The button opens an `NgbDropdown` with two actions:

- **Configure** - opens `WidgetConfigModal`, same modal `editWidget()`
  already opens today. Renamed from "Edit" since it's a settings form,
  not inline editing.
- **Remove** - calls `removeWidget()`, same as today's delete.

Since gridstack renders each widget's `component`/`props` as a bare
custom element (see the comment on `items` in dashboard.ts explaining
why `<gridstack-item>` templating doesn't work here), the ellipsis
button can't live in `dashboard.html` next to each grid item - it has
to be part of the widget host, or a floating overlay positioned via
CSS against each `.grid-stack-item` from the dashboard level. Simplest
path: add the ellipsis+dropdown markup directly inside each widget
component's own template (`stat-tile.html`, `torrent-list-widget.html`,
the new `pie-chart-widget.html`), each emitting `(configure)` /
`(remove)` outputs that `dashboard.ts` wires to `editWidget(instanceId)`
/ `removeWidget(instanceId)` via the existing `items()` → `props`
mapping (add `instanceId`, `editMode` to `props` alongside `data`).

## 3. Add-widget flow moves to an offcanvas

`addWidget()` currently opens `WidgetPicker` as a centered `NgbModal`.
Switch it to `NgbOffcanvas` sliding in from the right (`position:
'end'`), matching the reference design's side panel. `WidgetPicker`
changes from `NgbActiveModal` to `NgbActiveOffcanvas` (same
open/close/dismiss shape ng-bootstrap already uses for both).

Content stays a simple list of the 3 catalog entries (icon, name,
short type subtitle, a `+` to select) - no search box, no category
grouping, no "Elements"/"Themes" tabs. Those exist in the reference
because it's a Figma component-library panel; with 3 widget types a
filterable/categorized catalog would be speculative. Selecting an
entry closes the offcanvas and opens `WidgetConfigModal` exactly as
today.

`WidgetCatalogMeta` gains an `icon: IconDefinition` and
`descriptionKey: string` (e.g. "Number", "Table", "Pie") for this list.
`WidgetConfigModal` is unchanged (stays a centered modal) - only the
picker step moves.

## 4. Fixed-height widget rows

`torrent-list-widget.scss` puts `height: 100%` directly on the
`<table>` element, which lets the browser distribute extra space
across rows when the widget is taller than its content - rows grow or
shrink with the grid cell instead of staying a fixed size.

Fix: introduce a wrapper that owns sizing, and let the table size
itself naturally:

```html
<div class="torrent-list-widget__scroll">
  <table class="torrent-list-widget__table">
    ...
  </table>
</div>
```

```scss
.torrent-list-widget__scroll {
  height: 100%;
  width: 100%;
  overflow-y: auto;
  // card surface/border move here from the old .torrent-list-widget rule
}

.torrent-list-widget__table {
  width: 100%;
  border-collapse: collapse;
  // no height rule - rows keep their intrinsic padding/font-size height
}
```

Below the available height, the wrapper scrolls; above it, the table
just leaves blank space beneath it instead of stretching rows. This is
the pattern any future row-based widget (including the pie chart's
legend, §5) should follow.

## 5. Highcharts + the `pie-chart` widget type

### Dependency

Add `highcharts` and `highcharts-angular` (`highcharts-angular@5.4.1`
declares `"@angular/core": ">=19.0.0"`, no upper bound - compatible
with this project's Angular 22). Use the official wrapper rather than
a hand-rolled chart host, consistent with how gridstack is already
integrated via its own official Angular wrapper
(`gridstack/dist/angular`). `HighchartsChartModule` is a standalone
import like any other; it doesn't depend on zone.js, so it's fine
under zoneless change detection.

### Model (`dashboard.model.ts`)

```ts
export type WidgetTypeId = 'stat-tile' | 'torrent-list' | 'pie-chart';

export type PieChartGroupBy = 'state' | 'category';

export interface PieChartConfig {
  groupBy: PieChartGroupBy;
}

export type WidgetConfig = StatTileConfig | TorrentListConfig | PieChartConfig;

export interface PieChartSlice {
  key: string;
  labelKey?: string; // present for groupBy: 'state' buckets; absent (raw category string) for groupBy: 'category'
  value: number;
}

export interface PieChartData {
  groupBy: PieChartGroupBy;
  slices: PieChartSlice[];
}
```

`WidgetConfig` / widget-data unions used elsewhere (`dataFor` in
dashboard.ts, `resolveWidgetData` in widget-selectors.ts) extend with
the new members.

### Grouping (`widget-selectors.ts`)

For `groupBy: 'category'`, group directly on `torrent.category` (empty
string → `'-'`, matching how `torrent-list` already displays it).

For `groupBy: 'state'`, partition every `TorrentState` into exactly one
of 7 mutually-exclusive buckets - unlike the sidebar's `groups` map in
`status.ts`, whose groups deliberately overlap for independent filter
checkboxes, these must sum to the full torrent count for a pie to make
sense:

| Bucket        | States                                                     |
| ------------- | ---------------------------------------------------------- |
| `downloading` | `downloading`, `forcedDL`, `metaDL`, `allocating`          |
| `completed`   | `uploading`, `forcedUP`                                    |
| `inactive`    | `queuedDL`, `queuedUP`, `stalledDL`, `stalledUP`           |
| `stopped`     | `pausedDL`, `stoppedDL`, `pausedUP`, `stoppedUP`           |
| `checking`    | `checkingDL`, `checkingUP`, `checkingResumeData`, `moving` |
| `errored`     | `error`, `missingFiles`                                    |
| `other`       | `unknown`                                                  |

Defined as a new self-contained constant in `widget-selectors.ts`
(same precedent as the existing `ACTIVE_STATES` set there - a small
duplication rather than reaching into `status.ts`'s private `groups`
field). Labels reuse a new i18n block,
`pages.dashboard.widgets.pie-chart.bucket.*` (own namespace, matching
the existing per-widget convention seen in
`pages.dashboard.widgets.stat-tile.metric.*` and
`...torrent-list.column.*`, rather than reaching across features into
`pages.main.status.*`).

### Component (`widgets/pie-chart-widget/`)

`PieChartWidget extends BaseWidget` (same gridstack pattern as the
other two widgets), `@Input() data!: PieChartData`. Builds a computed
`Highcharts.Options` from `data()` plus live theme colors:

- Read `getComputedStyle(document.documentElement)` for
  `--bs-primary`/`--bs-secondary`/`--bs-success`/`--bs-danger`/`--bs-warning`/`--bs-info`
  and assign one per bucket/category slice, cycling if there are more
  categories than tokens.
- Re-derive colors in an `effect()` keyed off `ThemeService.family()` /
  `effectiveMode()` so the chart recolors immediately on theme switch
  (Highcharts is SVG - it won't pick up CSS variable changes on its
  own).
- `chart.backgroundColor: 'transparent'`, text color from
  `--bs-body-color`, so the chart sits on the card surface without its
  own background.

Legend/labels use the bucket i18n keys (or raw category strings)
resolved at options-build time - Highcharts doesn't participate in
Angular's change detection or the translate pipe, so translated text
must be baked into the options object, not bound in the template.

### Catalog + config entry

`WIDGET_CATALOG['pie-chart']`: `componentSelector: 'app-pie-chart-widget'`,
`defaultConfig: { groupBy: 'state' }`, `defaultSize: { w: 4, h: 4 }`
(square-ish, matching the reference's "Torrents by status" tile).
Registered in `GridstackComponent.registerComponents([...])` in
`dashboard.ts` alongside `StatTile`/`TorrentListWidget`.

`WidgetConfigModal` gains a third branch (alongside `isStatTile()` /
else) for `groupBy` - a single `ng-select` with `['state', 'category']`,
same pattern as the existing `sortField`/`sortOrder` selects.

## Files touched

- `dashboard.html/.scss/.ts` - restyle, remove manage panel, offcanvas wiring, ellipsis→config/remove outputs
- `widget-catalog.ts` - `icon`/`descriptionKey`, new `pie-chart` entry
- `widget-selectors.ts` - `selectPieChartData`, state-bucket partition
- `dashboard.model.ts` - `PieChartConfig`/`PieChartData`/`PieChartGroupBy`, widened unions
- `widgets/stat-tile/*`, `widgets/torrent-list-widget/*` - restyle, ellipsis menu, fixed-row-height fix
- `widgets/pie-chart-widget/*` (new) - component, template, styles, spec
- `modals/widget-picker/*` - modal → offcanvas
- `modals/widget-config/*` - restyle, third `groupBy` branch
- `packages/app/public/i18n/us.json`, `hu.json` - new keys (widget-picker descriptions, pie-chart bucket/groupBy labels, "Configure" action)
- `packages/app/package.json` - `highcharts`, `highcharts-angular`

## Testing

- Unit specs: `widget-selectors.spec.ts` (state-bucket partition
  correctness, category grouping), `widget-catalog.spec.ts` (new
  entry), `pie-chart-widget.spec.ts` (options built correctly per
  `groupBy`), `widget-picker.spec.ts` (offcanvas open/close),
  `dashboard.spec.ts` (manage panel gone, ellipsis actions wire to
  `editWidget`/`removeWidget`).
- Manual: run the app, verify chart recolors on theme family/mode
  switch, verify fixed row height (shrink a torrent-list widget below
  its row count → scrollbar; grow it → blank space, no row stretch),
  verify drag/resize still edit-mode-gated.
