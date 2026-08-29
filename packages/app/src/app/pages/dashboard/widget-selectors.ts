import {
  DashboardSnapshot,
  DashboardWidgetInstance,
  StatTileConfig,
  StatTileData,
  TorrentListConfig,
  TorrentListData,
  TorrentListRow,
} from '../../models/dashboard.model';
import { TorrentState } from '../../models/torrent.model';

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
  const rows: TorrentListRow[] = snapshot.torrents.map((t) => ({
    hash: t.hash,
    name: t.name,
    state: t.state,
    category: t.category,
    ratio: t.ratio,
    dlspeed: t.dlspeed,
    upspeed: t.upspeed,
    size: t.size,
    progress: t.progress,
    added_on: t.added_on,
    eta: t.eta,
  }));

  const direction = config.sortOrder === 'asc' ? 1 : -1;
  rows.sort((a, b) => (a[config.sortField] - b[config.sortField]) * direction);

  return { columns: config.columns, rows: rows.slice(0, config.count) };
}

export function resolveWidgetData(
  instance: DashboardWidgetInstance,
  snapshot: DashboardSnapshot,
): StatTileData | TorrentListData {
  switch (instance.widgetTypeId) {
    case 'stat-tile':
      return selectStatTileData(snapshot, instance.config as StatTileConfig);
    case 'torrent-list':
      return selectTorrentListData(snapshot, instance.config as TorrentListConfig);
  }
}
