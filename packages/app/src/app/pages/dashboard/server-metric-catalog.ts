import { ServerMetricId } from '../../models/dashboard.model';

export interface ServerMetricMeta {
  id: ServerMetricId;
  labelKey: string;
  displayKind: 'speed' | 'bytes' | 'ratio' | 'count';
}

function metric(
  id: ServerMetricId,
  displayKind: ServerMetricMeta['displayKind'],
): ServerMetricMeta {
  return { id, labelKey: `pages.dashboard.widgets.stat-tile.metric.${id}`, displayKind };
}

export const SERVER_METRIC_CATALOG: ServerMetricMeta[] = [
  metric('download_speed', 'speed'),
  metric('upload_speed', 'speed'),
  metric('active_count', 'count'),
  metric('global_ratio', 'ratio'),
  metric('session_ratio', 'ratio'),
  metric('global_downloaded', 'bytes'),
  metric('session_downloaded', 'bytes'),
  metric('global_uploaded', 'bytes'),
  metric('session_uploaded', 'bytes'),
  metric('free_disk_space', 'bytes'),
  metric('dht_nodes', 'count'),
  metric('total_peer_connections', 'count'),
  metric('download_limit', 'speed'),
  metric('upload_limit', 'speed'),
];

export const SERVER_METRIC_META_BY_ID: Record<ServerMetricId, ServerMetricMeta> =
  Object.fromEntries(SERVER_METRIC_CATALOG.map((m) => [m.id, m])) as Record<
    ServerMetricId,
    ServerMetricMeta
  >;
