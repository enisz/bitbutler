import { QbServerState, Torrent, TorrentState } from './torrent.model';

export type WidgetTypeId = 'stat-tile' | 'torrent-list';

export type StatTileMetric =
  | 'download_speed'
  | 'upload_speed'
  | 'active_count'
  | 'global_ratio'
  | 'free_disk_space';

export interface StatTileConfig {
  metric: StatTileMetric;
}

export type TorrentListSortField =
  | 'ratio'
  | 'dlspeed'
  | 'upspeed'
  | 'size'
  | 'progress'
  | 'added_on'
  | 'eta';

export type TorrentListColumn = 'name' | 'state' | 'category' | TorrentListSortField;

export interface TorrentListConfig {
  count: number;
  sortField: TorrentListSortField;
  sortOrder: 'asc' | 'desc';
  columns: TorrentListColumn[];
}

export type WidgetConfig = StatTileConfig | TorrentListConfig;

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

export interface StatTileData {
  metric: StatTileMetric;
  value: number;
  /** Only set for 'active_count' - total torrent count, for an "18 of 42" style display. */
  total?: number;
}

export interface TorrentListRow {
  hash: string;
  name: string;
  state: TorrentState;
  category: string;
  ratio: number;
  dlspeed: number;
  upspeed: number;
  size: number;
  progress: number;
  added_on: number;
  eta: number;
}

export interface TorrentListData {
  columns: TorrentListColumn[];
  rows: TorrentListRow[];
}
