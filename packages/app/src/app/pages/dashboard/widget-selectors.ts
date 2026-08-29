import { DashboardSnapshot, StatTileConfig, StatTileData } from '../../models/dashboard.model';
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
