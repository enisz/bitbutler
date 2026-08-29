import { DashboardSnapshot } from '../../models/dashboard.model';
import { Torrent } from '../../models/torrent.model';
import { selectStatTileData } from './widget-selectors';

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
