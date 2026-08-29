### Task 1: Pie-chart data model + selector

**Files:**

- Modify: `packages/app/src/app/models/dashboard.model.ts`
- Modify: `packages/app/src/app/pages/dashboard/widget-selectors.ts`
- Modify: `packages/app/src/app/pages/dashboard/widget-selectors.spec.ts`

**Interfaces:**

- Produces: `WidgetTypeId = 'stat-tile' | 'torrent-list' | 'pie-chart'`, `PieChartGroupBy = 'state' | 'category'`, `PieChartConfig { groupBy: PieChartGroupBy }`, `PieChartSlice { key: string; labelKey?: string; value: number }`, `PieChartData { groupBy: PieChartGroupBy; slices: PieChartSlice[] }`, `selectPieChartData(snapshot, config): PieChartData`. `resolveWidgetData` now returns `StatTileData | TorrentListData | PieChartData`.

- [ ] **Step 1: Write the failing selector tests**

Append to `packages/app/src/app/pages/dashboard/widget-selectors.spec.ts` (add `selectPieChartData` to the existing import line, and this new `describe` block before `describe('resolveWidgetData', ...)`):

```ts
import {
  resolveWidgetData,
  selectPieChartData,
  selectStatTileData,
  selectTorrentListData,
} from './widget-selectors';

describe('selectPieChartData', () => {
  it('should partition torrents into non-overlapping state buckets, omitting empty buckets', () => {
    const snapshot: DashboardSnapshot = {
      torrents: [
        makeTorrent({ state: 'downloading' }),
        makeTorrent({ state: 'forcedDL' }),
        makeTorrent({ state: 'uploading' }),
        makeTorrent({ state: 'error' }),
      ],
      serverState: null,
    };

    const result = selectPieChartData(snapshot, { groupBy: 'state' });

    expect(result.groupBy).toBe('state');
    expect(result.slices).toEqual([
      {
        key: 'downloading',
        labelKey: 'pages.dashboard.widgets.pie-chart.bucket.downloading',
        value: 2,
      },
      {
        key: 'completed',
        labelKey: 'pages.dashboard.widgets.pie-chart.bucket.completed',
        value: 1,
      },
      { key: 'errored', labelKey: 'pages.dashboard.widgets.pie-chart.bucket.errored', value: 1 },
    ]);
  });

  it('should return no slices for an empty torrent list', () => {
    const result = selectPieChartData({ torrents: [], serverState: null }, { groupBy: 'state' });
    expect(result.slices).toEqual([]);
  });

  it('should group by raw category, using "-" for an empty category', () => {
    const snapshot: DashboardSnapshot = {
      torrents: [
        makeTorrent({ category: 'linux' }),
        makeTorrent({ category: 'linux' }),
        makeTorrent({ category: '' }),
      ],
      serverState: null,
    };

    const result = selectPieChartData(snapshot, { groupBy: 'category' });

    expect(result.groupBy).toBe('category');
    expect(result.slices).toEqual([
      { key: 'linux', value: 2 },
      { key: '-', value: 1 },
    ]);
  });
});
```

Also add this case to the existing `describe('resolveWidgetData', ...)` block:

```ts
it('should dispatch to selectPieChartData for a pie-chart instance', () => {
  const instance: DashboardWidgetInstance = {
    instanceId: 'i3',
    widgetTypeId: 'pie-chart',
    x: 0,
    y: 0,
    w: 4,
    h: 4,
    config: { groupBy: 'state' },
  };
  const snapshot: DashboardSnapshot = {
    torrents: [makeTorrent({ state: 'downloading' })],
    serverState: null,
  };

  expect(resolveWidgetData(instance, snapshot)).toEqual({
    groupBy: 'state',
    slices: [
      {
        key: 'downloading',
        labelKey: 'pages.dashboard.widgets.pie-chart.bucket.downloading',
        value: 1,
      },
    ],
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test --workspace=@bitbutler/app -- widget-selectors`
Expected: FAIL - `selectPieChartData` is not exported, `pie-chart` is not assignable to `WidgetTypeId`.

- [ ] **Step 3: Widen the model**

In `packages/app/src/app/models/dashboard.model.ts`, change:

```ts
export type WidgetTypeId = 'stat-tile' | 'torrent-list';
```

to:

```ts
export type WidgetTypeId = 'stat-tile' | 'torrent-list' | 'pie-chart';
```

Add after the `TorrentListConfig` interface:

```ts
export type PieChartGroupBy = 'state' | 'category';

export interface PieChartConfig {
  groupBy: PieChartGroupBy;
}
```

Change:

```ts
export type WidgetConfig = StatTileConfig | TorrentListConfig;
```

to:

```ts
export type WidgetConfig = StatTileConfig | TorrentListConfig | PieChartConfig;
```

Add after the `TorrentListData` interface at the end of the file:

```ts
export interface PieChartSlice {
  key: string;
  /** Translation key for a 'state' bucket slice. Absent for 'category' slices - `key` there is the raw category string, already display-ready. */
  labelKey?: string;
  value: number;
}

export interface PieChartData {
  groupBy: PieChartGroupBy;
  slices: PieChartSlice[];
}
```

- [ ] **Step 4: Implement the state-bucket partition and selector**

In `packages/app/src/app/pages/dashboard/widget-selectors.ts`, add `PieChartConfig` and `PieChartData`/`PieChartSlice` to the existing import from `../../models/dashboard.model`, and add after the `ACTIVE_STATES` constant:

```ts
// Every TorrentState maps to exactly one bucket (unlike ACTIVE_STATES/the sidebar's `groups` map
// in status.ts, whose groups deliberately overlap for independent filter checkboxes) - a pie
// chart's slices must sum to the full torrent count.
type PieStateBucket =
  | 'downloading'
  | 'completed'
  | 'inactive'
  | 'stopped'
  | 'checking'
  | 'errored'
  | 'other';

const PIE_STATE_BUCKETS: Record<TorrentState, PieStateBucket> = {
  downloading: 'downloading',
  forcedDL: 'downloading',
  metaDL: 'downloading',
  allocating: 'downloading',
  uploading: 'completed',
  forcedUP: 'completed',
  queuedDL: 'inactive',
  queuedUP: 'inactive',
  stalledDL: 'inactive',
  stalledUP: 'inactive',
  pausedDL: 'stopped',
  stoppedDL: 'stopped',
  pausedUP: 'stopped',
  stoppedUP: 'stopped',
  checkingDL: 'checking',
  checkingUP: 'checking',
  checkingResumeData: 'checking',
  moving: 'checking',
  error: 'errored',
  missingFiles: 'errored',
  unknown: 'other',
};

const PIE_STATE_BUCKET_ORDER: PieStateBucket[] = [
  'downloading',
  'completed',
  'inactive',
  'stopped',
  'checking',
  'errored',
  'other',
];
```

Then add the selector function, after `selectTorrentListData`:

```ts
export function selectPieChartData(
  snapshot: DashboardSnapshot,
  config: PieChartConfig,
): PieChartData {
  const counts = new Map<string, number>();

  if (config.groupBy === 'state') {
    for (const t of snapshot.torrents) {
      const bucket = PIE_STATE_BUCKETS[t.state];
      counts.set(bucket, (counts.get(bucket) ?? 0) + 1);
    }
    const slices: PieChartSlice[] = PIE_STATE_BUCKET_ORDER.filter(
      (bucket) => (counts.get(bucket) ?? 0) > 0,
    ).map((bucket) => ({
      key: bucket,
      labelKey: `pages.dashboard.widgets.pie-chart.bucket.${bucket}`,
      value: counts.get(bucket)!,
    }));
    return { groupBy: 'state', slices };
  }

  for (const t of snapshot.torrents) {
    const key = t.category || '-';
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const slices: PieChartSlice[] = Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([key, value]) => ({ key, value }));
  return { groupBy: 'category', slices };
}
```

Finally, update `resolveWidgetData`:

```ts
export function resolveWidgetData(
  instance: DashboardWidgetInstance,
  snapshot: DashboardSnapshot,
): StatTileData | TorrentListData | PieChartData {
  switch (instance.widgetTypeId) {
    case 'stat-tile':
      return selectStatTileData(snapshot, instance.config as StatTileConfig);
    case 'torrent-list':
      return selectTorrentListData(snapshot, instance.config as TorrentListConfig);
    case 'pie-chart':
      return selectPieChartData(snapshot, instance.config as PieChartConfig);
  }
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npm test --workspace=@bitbutler/app -- widget-selectors`
Expected: PASS

- [ ] **Step 6: Typecheck and commit**

Run: `npm run build --workspace=@bitbutler/app -- --configuration=development` (or `npx tsc -p packages/app --noEmit` if faster) to confirm no other file broke from the widened unions - nothing should, since no other file switches exhaustively on `WidgetTypeId`/`WidgetConfig` yet.

```bash
git add packages/app/src/app/models/dashboard.model.ts packages/app/src/app/pages/dashboard/widget-selectors.ts packages/app/src/app/pages/dashboard/widget-selectors.spec.ts
git commit -m "#324: add pie-chart data model and selector"
```

---

