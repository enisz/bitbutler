import {
  DashboardSnapshot,
  DashboardWidgetInstance,
  PieChartConfig,
  PieChartData,
  PieChartSlice,
  StatTileConfig,
  StatTileData,
  TorrentListConfig,
  TorrentListData,
} from '../../models/dashboard.model';
import { Torrent, TorrentState } from '../../models/torrent.model';

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
