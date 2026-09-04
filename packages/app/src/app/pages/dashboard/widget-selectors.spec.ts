import { DashboardSnapshot, DashboardWidgetInstance } from '../../models/dashboard.model';
import { Torrent } from '../../models/torrent.model';
import {
  countBreakdownValue,
  listBreakdownValues,
  resolveWidgetData,
  selectBarChartData,
  selectBreakdownCounts,
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
    seeding_time: 0,
    availability: 0,
    num_complete: 0,
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

  it('should compute session_ratio from session uploaded/downloaded', () => {
    const snapshot: DashboardSnapshot = {
      torrents: [],
      serverState: { dl_info_data: 100, up_info_data: 50 } as any,
    };
    expect(selectStatTileData(snapshot, { metric: 'session_ratio' })).toEqual({
      metric: 'session_ratio',
      value: 0.5,
    });
  });

  it('should report session_ratio as 0 when session downloaded is 0', () => {
    const snapshot: DashboardSnapshot = {
      torrents: [],
      serverState: { dl_info_data: 0, up_info_data: 50 } as any,
    };
    expect(selectStatTileData(snapshot, { metric: 'session_ratio' })).toEqual({
      metric: 'session_ratio',
      value: 0,
    });
  });

  it('should read global_downloaded from alltime_dl', () => {
    const snapshot: DashboardSnapshot = {
      torrents: [],
      serverState: { alltime_dl: 111 } as any,
    };
    expect(selectStatTileData(snapshot, { metric: 'global_downloaded' })).toEqual({
      metric: 'global_downloaded',
      value: 111,
    });
  });

  it('should read session_downloaded from dl_info_data', () => {
    const snapshot: DashboardSnapshot = {
      torrents: [],
      serverState: { dl_info_data: 222 } as any,
    };
    expect(selectStatTileData(snapshot, { metric: 'session_downloaded' })).toEqual({
      metric: 'session_downloaded',
      value: 222,
    });
  });

  it('should read global_uploaded from alltime_ul', () => {
    const snapshot: DashboardSnapshot = {
      torrents: [],
      serverState: { alltime_ul: 333 } as any,
    };
    expect(selectStatTileData(snapshot, { metric: 'global_uploaded' })).toEqual({
      metric: 'global_uploaded',
      value: 333,
    });
  });

  it('should read session_uploaded from up_info_data', () => {
    const snapshot: DashboardSnapshot = {
      torrents: [],
      serverState: { up_info_data: 444 } as any,
    };
    expect(selectStatTileData(snapshot, { metric: 'session_uploaded' })).toEqual({
      metric: 'session_uploaded',
      value: 444,
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

  it('should pass through the full torrent object for each row, not just a curated subset', () => {
    const snapshot: DashboardSnapshot = {
      torrents: [makeTorrent({ hash: 'a', magnet_uri: 'magnet:?xt=urn:btih:abc' })],
      serverState: null,
    };
    const result = selectTorrentListData(snapshot, {
      count: 5,
      sortField: 'ratio',
      sortOrder: 'desc',
      columns: ['name'],
    });
    expect(result.rows[0].magnet_uri).toBe('magnet:?xt=urn:btih:abc');
  });

  it('should sort by any numeric field, e.g. num_complete', () => {
    const snapshot: DashboardSnapshot = {
      torrents: [
        makeTorrent({ hash: 'a', num_complete: 10 }),
        makeTorrent({ hash: 'b', num_complete: 30 }),
        makeTorrent({ hash: 'c', num_complete: 20 }),
      ],
      serverState: null,
    };
    const result = selectTorrentListData(snapshot, {
      count: 5,
      sortField: 'num_complete',
      sortOrder: 'desc',
      columns: ['name'],
    });
    expect(result.rows.map((r) => r.hash)).toEqual(['b', 'c', 'a']);
  });

  it('should sort by a string field using locale comparison', () => {
    const snapshot: DashboardSnapshot = {
      torrents: [
        makeTorrent({ hash: 'a', category: 'linux' }),
        makeTorrent({ hash: 'b', category: 'apps' }),
        makeTorrent({ hash: 'c', category: 'games' }),
      ],
      serverState: null,
    };
    const result = selectTorrentListData(snapshot, {
      count: 5,
      sortField: 'category',
      sortOrder: 'asc',
      columns: ['name'],
    });
    expect(result.rows.map((r) => r.hash)).toEqual(['b', 'c', 'a']);
  });

  it('should sort by a boolean field, false before true when ascending', () => {
    const snapshot: DashboardSnapshot = {
      torrents: [
        makeTorrent({ hash: 'a', auto_tmm: true }),
        makeTorrent({ hash: 'b', auto_tmm: false }),
      ],
      serverState: null,
    };
    const result = selectTorrentListData(snapshot, {
      count: 5,
      sortField: 'auto_tmm',
      sortOrder: 'asc',
      columns: ['name'],
    });
    expect(result.rows.map((r) => r.hash)).toEqual(['b', 'a']);
  });

  it('should pass the configured title through untouched', () => {
    const result = selectTorrentListData(
      { torrents: [], serverState: null },
      { count: 5, sortField: 'ratio', sortOrder: 'desc', columns: ['name'], title: 'Top Seeders' },
    );
    expect(result.title).toBe('Top Seeders');
  });

  it('should leave title undefined when not configured', () => {
    const result = selectTorrentListData(
      { torrents: [], serverState: null },
      { count: 5, sortField: 'ratio', sortOrder: 'desc', columns: ['name'] },
    );
    expect(result.title).toBeUndefined();
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
        labelKey: 'pages.dashboard.widgets.breakdown.state.bucket.downloading',
        value: 2,
      },
      {
        key: 'completed',
        labelKey: 'pages.dashboard.widgets.breakdown.state.bucket.completed',
        value: 1,
      },
      {
        key: 'errored',
        labelKey: 'pages.dashboard.widgets.breakdown.state.bucket.errored',
        value: 1,
      },
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

describe('selectBreakdownCounts', () => {
  it('should cap a high-cardinality categorical field to the top 7 + "Other"', () => {
    const torrents: Torrent[] = [];
    // 9 distinct categories, counts 9,8,...,1
    for (let i = 0; i < 9; i++) {
      const count = 9 - i;
      for (let j = 0; j < count; j++) {
        torrents.push(makeTorrent({ hash: `${i}-${j}`, category: `cat-${i}` }));
      }
    }

    const result = selectBreakdownCounts(torrents, 'category');

    expect(result).toHaveLength(8); // top 7 + Other
    expect(result[0]).toEqual({ key: 'cat-0', value: 9 });
    expect(result[6]).toEqual({ key: 'cat-6', value: 3 });
    // cat-7 (2) + cat-8 (1) folded into Other
    expect(result[7]).toEqual({
      key: 'other',
      labelKey: 'pages.dashboard.widgets.breakdown.other',
      value: 3,
    });
  });

  it('should not add an "Other" slice when there are 7 or fewer distinct values', () => {
    const torrents = [makeTorrent({ category: 'a' }), makeTorrent({ category: 'b' })];
    const result = selectBreakdownCounts(torrents, 'category');
    expect(result.map((s) => s.key)).toEqual(['a', 'b']);
  });

  it('should count a multi-valued tags field once per tag, with no untagged slice', () => {
    const torrents = [
      makeTorrent({ tags: 'linux,iso' }),
      makeTorrent({ tags: 'linux' }),
      makeTorrent({ tags: '' }),
    ];
    const result = selectBreakdownCounts(torrents, 'tags');
    expect(result).toEqual(
      expect.arrayContaining([
        { key: 'linux', value: 2 },
        { key: 'iso', value: 1 },
      ]),
    );
    expect(result.find((s) => s.key === '')).toBeUndefined();
  });

  it('should render every numeric bucket in order, including zero-count buckets', () => {
    const torrents = [makeTorrent({ ratio: 0.05 }), makeTorrent({ ratio: 3 })];
    const result = selectBreakdownCounts(torrents, 'ratio');
    expect(result).toEqual([
      {
        key: 'lt-0-1',
        labelKey: 'pages.dashboard.widgets.breakdown.ratio.bucket.lt-0-1',
        value: 1,
      },
      {
        key: '0-1-to-0-5',
        labelKey: 'pages.dashboard.widgets.breakdown.ratio.bucket.0-1-to-0-5',
        value: 0,
      },
      {
        key: '0-5-to-1',
        labelKey: 'pages.dashboard.widgets.breakdown.ratio.bucket.0-5-to-1',
        value: 0,
      },
      {
        key: '1-to-2',
        labelKey: 'pages.dashboard.widgets.breakdown.ratio.bucket.1-to-2',
        value: 0,
      },
      { key: 'gte-2', labelKey: 'pages.dashboard.widgets.breakdown.ratio.bucket.gte-2', value: 1 },
    ]);
  });
});

describe('countBreakdownValue', () => {
  it('should count the exact value even when it would be folded into "Other" on a capped display', () => {
    const torrents: Torrent[] = [];
    for (let i = 0; i < 9; i++) {
      torrents.push(makeTorrent({ hash: `${i}`, category: `cat-${i}` }));
    }
    // Every category has count 1, so the 8th and 9th alphabetically-last ones (by insertion,
    // after the desc-count sort keeps original relative order for ties) fold into Other.
    expect(countBreakdownValue(torrents, 'category', 'cat-8')).toBe(1);
  });

  it('should count a numeric bucket key directly', () => {
    const torrents = [makeTorrent({ ratio: 0.05 }), makeTorrent({ ratio: 0.05 })];
    expect(countBreakdownValue(torrents, 'ratio', 'lt-0-1')).toBe(2);
  });

  it('should return 0 for a key with no matching torrents', () => {
    expect(countBreakdownValue([], 'category', 'anything')).toBe(0);
  });
});

describe('listBreakdownValues', () => {
  it('should list every distinct categorical value uncapped, with no "Other" folding', () => {
    const torrents: Torrent[] = [];
    for (let i = 0; i < 9; i++) torrents.push(makeTorrent({ hash: `${i}`, category: `cat-${i}` }));
    const result = listBreakdownValues(torrents, 'category');
    expect(result).toHaveLength(9);
    expect(result.find((s) => s.key === 'other')).toBeUndefined();
  });

  it('should list all numeric buckets, same as selectBreakdownCounts', () => {
    expect(listBreakdownValues([], 'ratio')).toEqual(selectBreakdownCounts([], 'ratio'));
  });
});

describe('selectBarChartData', () => {
  it('should wrap selectBreakdownCounts for the configured field', () => {
    const snapshot: DashboardSnapshot = {
      torrents: [makeTorrent({ category: 'linux' })],
      serverState: null,
    };
    const result = selectBarChartData(snapshot, { field: 'category' });
    expect(result).toEqual({ field: 'category', slices: [{ key: 'linux', value: 1 }] });
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
      sortField: 'ratio',
      sortOrder: 'desc',
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
          labelKey: 'pages.dashboard.widgets.breakdown.state.bucket.downloading',
          value: 1,
        },
      ],
    });
  });

  it('should dispatch to selectBarChartData for a bar-chart instance', () => {
    const instance: DashboardWidgetInstance = {
      instanceId: 'i4',
      widgetTypeId: 'bar-chart',
      x: 0,
      y: 0,
      w: 4,
      h: 4,
      config: { field: 'category' },
    };
    const snapshot: DashboardSnapshot = {
      torrents: [makeTorrent({ category: 'linux' })],
      serverState: null,
    };

    expect(resolveWidgetData(instance, snapshot)).toEqual({
      field: 'category',
      slices: [{ key: 'linux', value: 1 }],
    });
  });
});
