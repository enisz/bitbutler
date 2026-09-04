import { SERVER_METRIC_CATALOG, SERVER_METRIC_META_BY_ID } from './server-metric-catalog';

describe('SERVER_METRIC_CATALOG', () => {
  it('should have exactly these 14 metrics', () => {
    expect(SERVER_METRIC_CATALOG.map((m) => m.id).sort()).toEqual(
      [
        'download_speed',
        'upload_speed',
        'active_count',
        'global_ratio',
        'session_ratio',
        'global_downloaded',
        'session_downloaded',
        'global_uploaded',
        'session_uploaded',
        'free_disk_space',
        'dht_nodes',
        'total_peer_connections',
        'download_limit',
        'upload_limit',
      ].sort(),
    );
  });

  it('should classify each metric with the correct display kind', () => {
    expect(SERVER_METRIC_META_BY_ID['download_speed'].displayKind).toBe('speed');
    expect(SERVER_METRIC_META_BY_ID['upload_limit'].displayKind).toBe('speed');
    expect(SERVER_METRIC_META_BY_ID['free_disk_space'].displayKind).toBe('bytes');
    expect(SERVER_METRIC_META_BY_ID['global_ratio'].displayKind).toBe('ratio');
    expect(SERVER_METRIC_META_BY_ID['active_count'].displayKind).toBe('count');
    expect(SERVER_METRIC_META_BY_ID['dht_nodes'].displayKind).toBe('count');
    expect(SERVER_METRIC_META_BY_ID['total_peer_connections'].displayKind).toBe('count');
  });

  it('should give every metric a labelKey under pages.dashboard.widgets.stat-tile.metric', () => {
    for (const meta of SERVER_METRIC_CATALOG) {
      expect(meta.labelKey).toBe(`pages.dashboard.widgets.stat-tile.metric.${meta.id}`);
    }
  });
});
