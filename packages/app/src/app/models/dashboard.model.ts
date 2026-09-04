import { QbServerState, Torrent } from './torrent.model';

export type WidgetTypeId = 'stat-tile' | 'torrent-list' | 'pie-chart' | 'bar-chart';

export type WidgetChartType = 'number' | 'pie' | 'line' | 'column' | 'table';

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
  | 'dht_nodes'
  | 'total_peer_connections'
  | 'download_limit'
  | 'upload_limit';

export type StatTileConfig =
  | { metric: ServerMetricId }
  | { source: 'torrent-count'; field: BreakdownField; value: string };

export type TorrentField = keyof Torrent;

export interface TorrentListConfig {
  count: number;
  sortField: TorrentField;
  sortOrder: 'asc' | 'desc';
  columns: TorrentField[];
  /** Custom widget header text. Falls back to the catalog's translated default label when unset. */
  title?: string;
}

// 9 curated Torrent fields meaningful to break down by - see breakdown-field-catalog.ts for
// which are categorical (grouped by distinct value) vs numeric (grouped into fixed buckets).
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

export interface BreakdownSlice {
  key: string;
  /** Translation key for a bucket/curated slice (e.g. a 'state' bucket, a numeric-field bucket, or the capped 'other' slice). Absent when `key` is already display-ready raw data (a raw category/tracker/save_path/tag value). */
  labelKey?: string;
  value: number;
}

// The single-valued subset of BreakdownField - a torrent has exactly one value for each, so a
// pie chart's "slices sum to the whole" reading holds. 'tags' (multi-valued) and the numeric
// fields (a histogram, not a proportion-of-whole) are pie-ineligible - see BarChartConfig for
// those.
export type PieChartField = 'state' | 'category' | 'tracker' | 'save_path';

export interface PieChartConfig {
  groupBy: PieChartField;
}

export interface PieChartData {
  groupBy: PieChartField;
  slices: BreakdownSlice[];
}

export interface BarChartConfig {
  field: BreakdownField;
}

export interface BarChartData {
  field: BreakdownField;
  slices: BreakdownSlice[];
}

export type WidgetConfig = StatTileConfig | TorrentListConfig | PieChartConfig | BarChartConfig;

export interface DashboardWidgetInstance {
  instanceId: string;
  widgetTypeId: WidgetTypeId;
  x: number;
  y: number;
  w: number;
  h: number;
  config: WidgetConfig;
}

export interface DashboardLayout {
  widgets: DashboardWidgetInstance[];
}

export const DEFAULT_DASHBOARD_LAYOUT: DashboardLayout = {
  widgets: [
    {
      instanceId: 'default-download-speed',
      widgetTypeId: 'stat-tile',
      x: 0,
      y: 0,
      w: 3,
      h: 2,
      config: { metric: 'download_speed' },
    },
    {
      instanceId: 'default-upload-speed',
      widgetTypeId: 'stat-tile',
      x: 3,
      y: 0,
      w: 3,
      h: 2,
      config: { metric: 'upload_speed' },
    },
    {
      instanceId: 'default-active-count',
      widgetTypeId: 'stat-tile',
      x: 6,
      y: 0,
      w: 3,
      h: 2,
      config: { metric: 'active_count' },
    },
    {
      instanceId: 'default-global-ratio',
      widgetTypeId: 'stat-tile',
      x: 9,
      y: 0,
      w: 3,
      h: 2,
      config: { metric: 'global_ratio' },
    },
  ],
};

export interface DashboardSnapshot {
  torrents: Torrent[];
  serverState: QbServerState | null;
}

export type StatTileData =
  | { metric: ServerMetricId; value: number; total?: number }
  | (BreakdownSlice & { source: 'torrent-count'; field: BreakdownField });

export interface TorrentListData {
  columns: TorrentField[];
  rows: Torrent[];
  title?: string;
  sortField: TorrentField;
  sortOrder: 'asc' | 'desc';
}
