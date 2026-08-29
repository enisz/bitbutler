import { DashboardSnapshot, DashboardWidgetInstance } from '../../models/dashboard.model';
import { Torrent } from '../../models/torrent.model';
import {
  resolveWidgetData,
  selectPieChartData,
  selectStatTileData,
  selectTorrentListData,
} from './widget-selectors';

const makeTorrent = (overrides: Partial<Torrent>): Torrent =>
  ({
    hash: 'h',
    name: 'name',
    state: 'downloading',
    category: '',
    ratio: 0,
    dlspeed: 0,
    upspeed: 0,
    size: 0,
    progress: 0,
    added_on: 0,
    eta: 0,
    ...overrides,
  }) as Torrent;

describe('selectStatTileData', () => {
  const emptySnapshot: DashboardSnapshot = { torrents: [], serverState: null };

  it('should read download_speed from server_state', () => {
    const snapshot: DashboardSnapshot = {
      torrents: [],
      serverState: { dl_info_speed: 1234 } as any,
    };
    expect(selectStatTileData(snapshot, { metric: 'download_speed' })).toEqual({
      metric: 'download_speed',
      value: 1234,
    });
  });

  it('should read upload_speed from server_state', () => {
    const snapshot: DashboardSnapshot = {
      torrents: [],
      serverState: { up_info_speed: 5678 } as any,
    };
    expect(selectStatTileData(snapshot, { metric: 'upload_speed' })).toEqual({
      metric: 'upload_speed',
      value: 5678,
    });
  });

  it('should read free_disk_space from server_state', () => {
    const snapshot: DashboardSnapshot = {
      torrents: [],
      serverState: { free_space_on_disk: 999 } as any,
    };
    expect(selectStatTileData(snapshot, { metric: 'free_disk_space' })).toEqual({
      metric: 'free_disk_space',
      value: 999,
    });
  });

  it('should parse global_ratio (a string in server_state) into a number', () => {
    const snapshot: DashboardSnapshot = {
      torrents: [],
      serverState: { global_ratio: '2.34' } as any,
    };
    expect(selectStatTileData(snapshot, { metric: 'global_ratio' })).toEqual({
      metric: 'global_ratio',
      value: 2.34,
    });
  });

  it('should default to 0 when server_state is null', () => {
    expect(selectStatTileData(emptySnapshot, { metric: 'download_speed' })).toEqual({
      metric: 'download_speed',
      value: 0,
    });
  });

  it('should count active torrents and report the total for active_count', () => {
    const snapshot: DashboardSnapshot = {
      torrents: [
        makeTorrent({ state: 'downloading' }),
        makeTorrent({ state: 'pausedDL' }),
        makeTorrent({ state: 'uploading' }),
      ],
      serverState: null,
    };
    expect(selectStatTileData(snapshot, { metric: 'active_count' })).toEqual({
      metric: 'active_count',
      value: 2,
      total: 3,
    });
  });
});

describe('selectTorrentListData', () => {
  it('should sort descending by the configured field and truncate to count', () => {
    const snapshot: DashboardSnapshot = {
      torrents: [
        makeTorrent({ hash: 'a', ratio: 1.5 }),
        makeTorrent({ hash: 'b', ratio: 3.0 }),
        makeTorrent({ hash: 'c', ratio: 2.0 }),
      ],
      serverState: null,
    };

    const result = selectTorrentListData(snapshot, {
      count: 2,
      sortField: 'ratio',
      sortOrder: 'desc',
      columns: ['name', 'ratio'],
    });

    expect(result.rows.map((r) => r.hash)).toEqual(['b', 'c']);
    expect(result.columns).toEqual(['name', 'ratio']);
  });

  it('should sort ascending when configured', () => {
    const snapshot: DashboardSnapshot = {
      torrents: [
        makeTorrent({ hash: 'a', progress: 0.9 }),
        makeTorrent({ hash: 'b', progress: 0.1 }),
      ],
      serverState: null,
    };

    const result = selectTorrentListData(snapshot, {
      count: 5,
      sortField: 'progress',
      sortOrder: 'asc',
      columns: ['name'],
    });

    expect(result.rows.map((r) => r.hash)).toEqual(['b', 'a']);
  });

  it('should return fewer rows than count when there are fewer torrents', () => {
    const snapshot: DashboardSnapshot = {
      torrents: [makeTorrent({ hash: 'only' })],
      serverState: null,
    };
    const result = selectTorrentListData(snapshot, {
      count: 5,
      sortField: 'ratio',
      sortOrder: 'desc',
      columns: ['name'],
    });
    expect(result.rows).toHaveLength(1);
  });

  it('should return no rows for an empty torrent map', () => {
    const result = selectTorrentListData(
      { torrents: [], serverState: null },
      { count: 5, sortField: 'ratio', sortOrder: 'desc', columns: ['name'] },
    );
    expect(result.rows).toEqual([]);
  });
});

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

describe('resolveWidgetData', () => {
  it('should dispatch to selectStatTileData for a stat-tile instance', () => {
    const instance: DashboardWidgetInstance = {
      instanceId: 'i1',
      widgetTypeId: 'stat-tile',
      x: 0,
      y: 0,
      w: 3,
      h: 2,
      config: { metric: 'download_speed' },
    };
    const snapshot: DashboardSnapshot = { torrents: [], serverState: { dl_info_speed: 42 } as any };

    expect(resolveWidgetData(instance, snapshot)).toEqual({ metric: 'download_speed', value: 42 });
  });

  it('should dispatch to selectTorrentListData for a torrent-list instance', () => {
    const instance: DashboardWidgetInstance = {
      instanceId: 'i2',
      widgetTypeId: 'torrent-list',
      x: 0,
      y: 0,
      w: 6,
      h: 4,
      config: { count: 1, sortField: 'ratio', sortOrder: 'desc', columns: ['name'] },
    };
    const snapshot: DashboardSnapshot = {
      torrents: [makeTorrent({ hash: 'x' })],
      serverState: null,
    };

    expect(resolveWidgetData(instance, snapshot)).toEqual({
      columns: ['name'],
      rows: [expect.objectContaining({ hash: 'x' })],
    });
  });

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
});
