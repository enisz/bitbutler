import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { QbTorrentProperties } from '../../../models/qbittorrent.model';
import { Torrent } from '../../../models/torrent.model';
import { QbService } from '../../../services/qb.service';
import { ServerStoreService } from '../../../services/server-store.service';
import { TorrentStoreService } from '../../../services/torrent-store.service';
import { TorrentDetailsDataService } from './torrent-details-data.service';

const makeTorrent = (overrides: Partial<Torrent> = {}): Torrent => ({
  added_on: 1700000000,
  amount_left: 0,
  auto_tmm: false,
  availability: 0,
  category: '',
  completed: 0,
  completion_on: 0,
  content_path: '',
  dl_limit: 0,
  dlspeed: 0,
  download_path: '',
  downloaded: 0,
  downloaded_session: 0,
  eta: 0,
  f_l_piece_prio: false,
  force_start: false,
  hash: 'abc123',
  inactive_seeding_time_limit: 0,
  infohash_v1: '',
  infohash_v2: '',
  last_activity: 0,
  magnet_uri: '',
  max_inactive_seeding_time: 0,
  max_ratio: 0,
  max_seeding_time: 0,
  name: 'My Torrent',
  num_complete: 0,
  num_incomplete: 0,
  num_leechs: 0,
  num_seeds: 0,
  priority: 0,
  progress: 0,
  ratio: 0,
  ratio_limit: 0,
  save_path: '',
  seeding_time: 0,
  seeding_time_limit: 0,
  seen_complete: 0,
  seq_dl: false,
  size: 0,
  state: 'downloading',
  super_seeding: false,
  tags: '',
  time_active: 0,
  total_size: 0,
  tracker: '',
  trackers_count: 0,
  up_limit: 0,
  uploaded: 0,
  uploaded_session: 0,
  upspeed: 0,
  ...overrides,
});

const makeProperties = (overrides: Partial<QbTorrentProperties> = {}): QbTorrentProperties => ({
  save_path: '',
  creation_date: 1700000000,
  piece_size: 0,
  comment: '',
  total_wasted: 0,
  total_uploaded: 0,
  total_uploaded_session: 0,
  total_downloaded: 0,
  total_downloaded_session: 0,
  up_limit: 0,
  dl_limit: 0,
  time_elapsed: 0,
  seeding_time: 0,
  nb_connections: 0,
  nb_connections_limit: 0,
  share_ratio: 0,
  addition_date: 0,
  completion_date: 0,
  created_by: '',
  dl_speed_avg: 0,
  dl_speed: 0,
  eta: 0,
  last_seen: 0,
  peers: 0,
  peers_total: 0,
  pieces_have: 0,
  pieces_num: 0,
  reannounce: 0,
  seeds: 0,
  seeds_total: 0,
  total_size: 0,
  up_speed_avg: 0,
  up_speed: 0,
  isPrivate: false,
  infohash_v1: '',
  infohash_v2: '',
  ...overrides,
});

describe('TorrentDetailsDataService', () => {
  let service: TorrentDetailsDataService;
  let torrentsMap: ReturnType<typeof signal<Map<string, Torrent>>>;
  let qbTorrentsProperties: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.useFakeTimers();
    torrentsMap = signal(new Map());
    qbTorrentsProperties = vi.fn().mockResolvedValue(makeProperties());

    TestBed.configureTestingModule({
      providers: [
        TorrentDetailsDataService,
        { provide: TorrentStoreService, useValue: { torrentsMap } },
        { provide: ServerStoreService, useValue: { currentServerId: signal('server-1') } },
        { provide: QbService, useValue: { torrents: { properties: qbTorrentsProperties } } },
      ],
    });

    service = TestBed.inject(TorrentDetailsDataService);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('defaults activeTabId to general', () => {
    expect(service.activeTabId()).toBe('general');
  });

  describe('init / hash / context', () => {
    it('stores the hash and context passed to init', () => {
      service.init('abc123', { editMode: true });
      expect(service.hash()).toBe('abc123');
      expect(service.context()).toEqual({ editMode: true });
    });
  });

  describe('selectTab', () => {
    it('updates activeTabId', () => {
      service.selectTab('trackers');
      expect(service.activeTabId()).toBe('trackers');
    });
  });

  describe('torrent computed', () => {
    it('is null when there is no properties value yet', () => {
      service.init('abc123', {});
      torrentsMap.set(new Map([['abc123', makeTorrent()]]));
      expect(service.torrent()).toBeNull();
    });

    it('is null when the hash is not in the torrent store', () => {
      service.init('missing-hash', {});
      expect(service.torrent()).toBeNull();
    });
  });

  describe('stopAll', () => {
    it('does not throw when called with no active subscriptions', () => {
      expect(() => service.stopAll()).not.toThrow();
    });
  });

  describe('properties polling', () => {
    it('fetches properties immediately once the general tab is active', async () => {
      service.init('abc123', {});
      await vi.advanceTimersByTimeAsync(0);

      expect(qbTorrentsProperties).toHaveBeenCalledWith('server-1', 'abc123');
      expect(service.properties()).toEqual(makeProperties());
    });

    it('polls again after 2 seconds while the general tab stays active', async () => {
      service.init('abc123', {});
      await vi.advanceTimersByTimeAsync(0);
      expect(qbTorrentsProperties).toHaveBeenCalledTimes(1);

      await vi.advanceTimersByTimeAsync(2000);
      expect(qbTorrentsProperties).toHaveBeenCalledTimes(2);
    });

    it('stops polling once the general tab is no longer active', async () => {
      service.init('abc123', {});
      await vi.advanceTimersByTimeAsync(0);
      expect(qbTorrentsProperties).toHaveBeenCalledTimes(1);

      service.selectTab('trackers');
      await vi.advanceTimersByTimeAsync(4000);
      expect(qbTorrentsProperties).toHaveBeenCalledTimes(1);
    });

    it('fetches again immediately when switching back to the general tab', async () => {
      service.init('abc123', {});
      await vi.advanceTimersByTimeAsync(0);
      service.selectTab('trackers');
      service.selectTab('general');
      await vi.advanceTimersByTimeAsync(0);

      expect(qbTorrentsProperties).toHaveBeenCalledTimes(2);
    });

    it('does not throw and stops polling after stopAll is called', async () => {
      service.init('abc123', {});
      await vi.advanceTimersByTimeAsync(0);
      service.stopAll();

      await vi.advanceTimersByTimeAsync(4000);
      expect(qbTorrentsProperties).toHaveBeenCalledTimes(1);
    });

    it('logs and does not throw when the fetch fails', async () => {
      qbTorrentsProperties.mockRejectedValueOnce(new Error('boom'));
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

      service.init('abc123', {});
      await vi.advanceTimersByTimeAsync(0);

      expect(consoleError).toHaveBeenCalled();
      expect(service.properties()).toBeNull();
    });
  });
});
