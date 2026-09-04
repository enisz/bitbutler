import {
  BarChartConfig,
  BarChartData,
  BreakdownField,
  BreakdownSlice,
  DashboardSnapshot,
  DashboardWidgetInstance,
  PieChartConfig,
  PieChartData,
  StatTileConfig,
  StatTileData,
  TorrentListConfig,
  TorrentListData,
} from '../../models/dashboard.model';
import { Torrent, TorrentState } from '../../models/torrent.model';
import {
  BREAKDOWN_FIELD_META_BY_FIELD,
  PIE_STATE_BUCKETS,
  PIE_STATE_BUCKET_ORDER,
} from './breakdown-field-catalog';

function compareTorrentFieldValues(a: unknown, b: unknown): number {
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  if (typeof a === 'boolean' && typeof b === 'boolean') return Number(a) - Number(b);
  return String(a ?? '').localeCompare(String(b ?? ''));
}

// Mirrors the "active" filter group semantics used by the main grid's status sidebar
// (see Status component's `groups.active`) - duplicated here as a small, self-contained
// constant rather than importing a private field from an unrelated component.
const ACTIVE_STATES = new Set<TorrentState>([
  'downloading',
  'uploading',
  'forcedDL',
  'forcedUP',
  'metaDL',
  'moving',
  'allocating',
]);

const CATEGORICAL_CAP = 7;

function rawCategoricalCounts(torrents: Torrent[], field: BreakdownField): Map<string, number> {
  const counts = new Map<string, number>();

  if (field === 'state') {
    for (const t of torrents) {
      const bucket = PIE_STATE_BUCKETS[t.state];
      counts.set(bucket, (counts.get(bucket) ?? 0) + 1);
    }
    return counts;
  }

  if (field === 'tags') {
    for (const t of torrents) {
      for (const tag of t.tags
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)) {
        counts.set(tag, (counts.get(tag) ?? 0) + 1);
      }
    }
    return counts;
  }

  for (const t of torrents) {
    const key = (t[field] as string) || '-';
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return counts;
}

function rawNumericBucketCounts(torrents: Torrent[], field: BreakdownField): Map<string, number> {
  const meta = BREAKDOWN_FIELD_META_BY_FIELD[field];
  const counts = new Map<string, number>();
  for (const t of torrents) {
    const value = t[field] as number;
    const bucket = meta.buckets!.find((b) => b.test(value))!;
    counts.set(bucket.key, (counts.get(bucket.key) ?? 0) + 1);
  }
  return counts;
}

// Chart display for categorical fields: 'state' keeps its curated 7-bucket order (never capped -
// it's already <=7 by construction); other categorical fields are sorted by count desc and capped
// to the top CATEGORICAL_CAP + a synthetic 'other' slice. Numeric fields render every defined
// bucket in its fixed order, including zero-count ones - a histogram's shape is part of the
// point, unlike a pie chart where an empty slice is just noise.
export function selectBreakdownCounts(
  torrents: Torrent[],
  field: BreakdownField,
): BreakdownSlice[] {
  const meta = BREAKDOWN_FIELD_META_BY_FIELD[field];

  if (meta.kind === 'numeric') {
    const counts = rawNumericBucketCounts(torrents, field);
    return meta.buckets!.map((b) => ({
      key: b.key,
      labelKey: b.labelKey,
      value: counts.get(b.key) ?? 0,
    }));
  }

  const counts = rawCategoricalCounts(torrents, field);

  if (field === 'state') {
    return PIE_STATE_BUCKET_ORDER.filter((bucket) => (counts.get(bucket) ?? 0) > 0).map(
      (bucket) => ({
        key: bucket,
        labelKey: `pages.dashboard.widgets.breakdown.state.bucket.${bucket}`,
        value: counts.get(bucket)!,
      }),
    );
  }

  const sorted = Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
  const top = sorted.slice(0, CATEGORICAL_CAP);
  const rest = sorted.slice(CATEGORICAL_CAP);
  const slices: BreakdownSlice[] = top.map(([key, value]) => ({ key, value }));
  const otherTotal = rest.reduce((sum, [, value]) => sum + value, 0);
  if (otherTotal > 0) {
    slices.push({
      key: 'other',
      labelKey: 'pages.dashboard.widgets.breakdown.other',
      value: otherTotal,
    });
  }
  return slices;
}

// Uncapped, exact count for one specific key/bucket - used directly by stat-tile's torrent-count
// mode, so a stat-tile stays correct even when its configured value would've been folded into
// "Other" on a pie/bar widget breaking down the same field.
export function countBreakdownValue(
  torrents: Torrent[],
  field: BreakdownField,
  key: string,
): number {
  const meta = BREAKDOWN_FIELD_META_BY_FIELD[field];
  if (meta.kind === 'numeric') return rawNumericBucketCounts(torrents, field).get(key) ?? 0;
  return rawCategoricalCounts(torrents, field).get(key) ?? 0;
}

// Every selectable value for a field, uncapped, with no "Other" folding - used by the config
// modal's live value picker (§WidgetConfigModal) so a user can never pick the synthetic "Other"
// bucket as a stat-tile's target. 'state' and numeric fields are already uncapped, so they just
// delegate to selectBreakdownCounts.
export function listBreakdownValues(torrents: Torrent[], field: BreakdownField): BreakdownSlice[] {
  const meta = BREAKDOWN_FIELD_META_BY_FIELD[field];
  if (meta.kind === 'numeric' || field === 'state') return selectBreakdownCounts(torrents, field);

  const counts = rawCategoricalCounts(torrents, field);
  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([key, value]) => ({ key, value }));
}

export function selectStatTileData(
  snapshot: DashboardSnapshot,
  config: StatTileConfig,
): StatTileData {
  const { torrents, serverState } = snapshot;

  switch (config.metric) {
    case 'download_speed':
      return { metric: config.metric, value: serverState?.dl_info_speed ?? 0 };
    case 'upload_speed':
      return { metric: config.metric, value: serverState?.up_info_speed ?? 0 };
    case 'free_disk_space':
      return { metric: config.metric, value: serverState?.free_space_on_disk ?? 0 };
    case 'global_ratio':
      return {
        metric: config.metric,
        value: parseFloat(String(serverState?.global_ratio ?? '0')) || 0,
      };
    case 'session_ratio': {
      const dl = serverState?.dl_info_data ?? 0;
      const ul = serverState?.up_info_data ?? 0;
      return { metric: config.metric, value: dl > 0 ? ul / dl : 0 };
    }
    case 'global_downloaded':
      return { metric: config.metric, value: serverState?.alltime_dl ?? 0 };
    case 'session_downloaded':
      return { metric: config.metric, value: serverState?.dl_info_data ?? 0 };
    case 'global_uploaded':
      return { metric: config.metric, value: serverState?.alltime_ul ?? 0 };
    case 'session_uploaded':
      return { metric: config.metric, value: serverState?.up_info_data ?? 0 };
    case 'active_count': {
      let active = 0;
      for (const t of torrents) if (ACTIVE_STATES.has(t.state)) active++;
      return { metric: config.metric, value: active, total: torrents.length };
    }
  }
}

export function selectTorrentListData(
  snapshot: DashboardSnapshot,
  config: TorrentListConfig,
): TorrentListData {
  const direction = config.sortOrder === 'asc' ? 1 : -1;
  const rows: Torrent[] = [...snapshot.torrents].sort(
    (a, b) => compareTorrentFieldValues(a[config.sortField], b[config.sortField]) * direction,
  );

  return {
    columns: config.columns,
    rows: rows.slice(0, config.count),
    title: config.title,
    sortField: config.sortField,
    sortOrder: config.sortOrder,
  };
}

export function selectPieChartData(
  snapshot: DashboardSnapshot,
  config: PieChartConfig,
): PieChartData {
  return {
    groupBy: config.groupBy,
    slices: selectBreakdownCounts(snapshot.torrents, config.groupBy),
  };
}

export function selectBarChartData(
  snapshot: DashboardSnapshot,
  config: BarChartConfig,
): BarChartData {
  return { field: config.field, slices: selectBreakdownCounts(snapshot.torrents, config.field) };
}

export function resolveWidgetData(
  instance: DashboardWidgetInstance,
  snapshot: DashboardSnapshot,
): StatTileData | TorrentListData | PieChartData | BarChartData {
  switch (instance.widgetTypeId) {
    case 'stat-tile':
      return selectStatTileData(snapshot, instance.config as StatTileConfig);
    case 'torrent-list':
      return selectTorrentListData(snapshot, instance.config as TorrentListConfig);
    case 'pie-chart':
      return selectPieChartData(snapshot, instance.config as PieChartConfig);
    case 'bar-chart':
      return selectBarChartData(snapshot, instance.config as BarChartConfig);
  }
}
