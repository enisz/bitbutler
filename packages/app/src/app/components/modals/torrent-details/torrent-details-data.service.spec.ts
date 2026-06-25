import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { TorrentFileEntry } from '@bitbutler/shared';
import { Subject } from 'rxjs';
import { vi } from 'vitest';
import {
  QbTorrentProperties,
  QbTorrentTracker,
  QbTrackerStatus,
} from '../../../models/qbittorrent.model';
import {
  QbTorrentContent,
  QbTorrentContentPriority,
  QbTorrentPeer,
  QbTorrentPeersResponse,
  Torrent,
} from '../../../models/torrent.model';
import { QbPollingService } from '../../../services/qb-polling.service';
import { QbService } from '../../../services/qb.service';
import { ServerSettingsService } from '../../../services/server-settings.service';
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
  let qbTorrentsTrackers: ReturnType<typeof vi.fn>;
  let qbTorrentsFiles: ReturnType<typeof vi.fn>;
  let peersPolling$: Subject<QbTorrentPeersResponse>;
  let startPeersPolling: ReturnType<typeof vi.fn>;
  let serverSettingsLoad: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.useFakeTimers();
    torrentsMap = signal(new Map());
    qbTorrentsProperties = vi.fn().mockResolvedValue(makeProperties());
    qbTorrentsTrackers = vi.fn().mockResolvedValue([]);
    qbTorrentsFiles = vi.fn().mockResolvedValue([]);
    peersPolling$ = new Subject<QbTorrentPeersResponse>();
    startPeersPolling = vi.fn().mockReturnValue(peersPolling$);
    serverSettingsLoad = vi.fn().mockResolvedValue({ polling: { foreground: 5000 } });

    TestBed.configureTestingModule({
      providers: [
        TorrentDetailsDataService,
        { provide: TorrentStoreService, useValue: { torrentsMap } },
        { provide: ServerStoreService, useValue: { currentServerId: signal('server-1') } },
        {
          provide: QbService,
          useValue: {
            torrents: {
              properties: qbTorrentsProperties,
              trackers: qbTorrentsTrackers,
              files: qbTorrentsFiles,
            },
          },
        },
        { provide: QbPollingService, useValue: { startPeersPolling } },
        { provide: ServerSettingsService, useValue: { load: serverSettingsLoad } },
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

  describe('trackers fetching', () => {
    const tracker: QbTorrentTracker = {
      url: 'http://tracker.example.com',
      status: QbTrackerStatus.Working,
      tier: 0,
      num_peers: 1,
      num_seeds: 2,
      num_leeches: 3,
      num_downloaded: 4,
      msg: '',
    };

    it('does nothing while the trackers tab is not active', async () => {
      service.init('abc123', {});
      await vi.advanceTimersByTimeAsync(0);
      expect(qbTorrentsTrackers).not.toHaveBeenCalled();
    });

    it('fetches once when the trackers tab becomes active', async () => {
      qbTorrentsTrackers.mockResolvedValue([tracker]);
      service.init('abc123', {});
      service.selectTab('trackers');
      await vi.advanceTimersByTimeAsync(0);

      expect(qbTorrentsTrackers).toHaveBeenCalledWith('server-1', 'abc123');
      expect(service.trackers()).toEqual([tracker]);
      expect(service.trackersLoading()).toBe(false);
    });

    it('does not refetch while the trackers tab stays active', async () => {
      service.init('abc123', {});
      service.selectTab('trackers');
      await vi.advanceTimersByTimeAsync(0);
      await vi.advanceTimersByTimeAsync(5000);

      expect(qbTorrentsTrackers).toHaveBeenCalledTimes(1);
    });

    it('refetches every time the trackers tab is reactivated', async () => {
      service.init('abc123', {});
      service.selectTab('trackers');
      await vi.advanceTimersByTimeAsync(0);
      service.selectTab('general');
      service.selectTab('trackers');
      await vi.advanceTimersByTimeAsync(0);

      expect(qbTorrentsTrackers).toHaveBeenCalledTimes(2);
    });

    it('logs and does not throw when the fetch fails', async () => {
      qbTorrentsTrackers.mockRejectedValueOnce(new Error('boom'));
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

      service.init('abc123', {});
      service.selectTab('trackers');
      await vi.advanceTimersByTimeAsync(0);

      expect(consoleError).toHaveBeenCalled();
      expect(service.trackersLoading()).toBe(false);
    });
  });

  describe('peers polling', () => {
    const peer: QbTorrentPeer = {
      ip: '10.0.0.1',
      port: 51413,
      client: 'qBittorrent',
      dl_speed: 0,
      up_speed: 0,
      progress: 0.5,
      downloaded: 0,
      uploaded: 0,
      relevance: 0,
      flags: '',
      flags_desc: '',
      connection: 'BT',
      files: '',
    };

    it('does not poll while the peers tab is not active', () => {
      service.init('abc123', {});
      expect(startPeersPolling).not.toHaveBeenCalled();
    });

    it('starts polling and applies a full_update patch when the peers tab becomes active', () => {
      service.init('abc123', {});
      service.selectTab('peers');

      expect(startPeersPolling).toHaveBeenCalledWith('server-1', 'abc123');

      peersPolling$.next({ rid: 1, full_update: true, peers: { '10.0.0.1:51413': peer } });

      expect(service.peers()).toEqual([peer]);
      expect(service.peersLoading()).toBe(false);
    });

    it('stops listening once the peers tab is no longer active', () => {
      service.init('abc123', {});
      service.selectTab('peers');
      service.selectTab('general');

      peersPolling$.next({ rid: 1, full_update: true, peers: { '10.0.0.1:51413': peer } });

      expect(service.peers()).toEqual([]);
    });

    it('restarts polling with a fresh peer list when reactivated', () => {
      service.init('abc123', {});
      service.selectTab('peers');
      peersPolling$.next({ rid: 1, full_update: true, peers: { '10.0.0.1:51413': peer } });
      expect(service.peers()).toEqual([peer]);

      service.selectTab('general');
      service.selectTab('peers');

      expect(service.peers()).toEqual([]);
      expect(startPeersPolling).toHaveBeenCalledTimes(2);
    });

    it('removes peers listed in peers_removed', () => {
      service.init('abc123', {});
      service.selectTab('peers');
      peersPolling$.next({ rid: 1, full_update: true, peers: { '10.0.0.1:51413': peer } });
      peersPolling$.next({ rid: 2, full_update: false, peers_removed: ['10.0.0.1:51413'] });

      expect(service.peers()).toEqual([]);
    });
  });

  describe('content polling', () => {
    const file: QbTorrentContent = {
      index: 0,
      name: 'movie.mkv',
      size: 1000,
      progress: 0.25,
      priority: QbTorrentContentPriority.NORMAL_PRIORTY,
      is_seed: false,
      piece_range: [0, 1],
      availability: 1,
    };

    it('does nothing while the content tab is not active', async () => {
      service.init('abc123', {});
      await vi.advanceTimersByTimeAsync(0);
      expect(qbTorrentsFiles).not.toHaveBeenCalled();
    });

    it('fetches and maps files immediately when the content tab becomes active', async () => {
      qbTorrentsFiles.mockResolvedValue([file]);
      service.init('abc123', {});
      service.selectTab('content');
      await vi.advanceTimersByTimeAsync(0);

      expect(qbTorrentsFiles).toHaveBeenCalledWith('server-1', 'abc123');
      expect(service.content()).toEqual([
        {
          length: 1000,
          path: 'movie.mkv',
          priority: QbTorrentContentPriority.NORMAL_PRIORTY,
          progress: 0.25,
          index: 0,
        },
      ]);
      expect(service.contentLoading()).toBe(false);
    });

    it('polls again after the configured foreground interval while active', async () => {
      service.init('abc123', {});
      service.selectTab('content');
      await vi.advanceTimersByTimeAsync(0);
      expect(qbTorrentsFiles).toHaveBeenCalledTimes(1);

      await vi.advanceTimersByTimeAsync(5000);
      expect(qbTorrentsFiles).toHaveBeenCalledTimes(2);
    });

    it('stops polling once the content tab is no longer active', async () => {
      service.init('abc123', {});
      service.selectTab('content');
      await vi.advanceTimersByTimeAsync(0);
      service.selectTab('general');

      await vi.advanceTimersByTimeAsync(5000);
      expect(qbTorrentsFiles).toHaveBeenCalledTimes(1);
    });

    it('logs and does not toast when the fetch fails', async () => {
      qbTorrentsFiles.mockRejectedValueOnce(new Error('boom'));
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

      service.init('abc123', {});
      service.selectTab('content');
      await vi.advanceTimersByTimeAsync(0);

      expect(consoleError).toHaveBeenCalled();
      expect(service.contentLoading()).toBe(false);
    });

    describe('setContent', () => {
      it('overwrites the content signal optimistically', () => {
        service.init('abc123', {});
        const files: TorrentFileEntry[] = [{ path: 'a.txt', length: 1, index: 0 }];
        service.setContent(files);
        expect(service.content()).toEqual(files);
      });
    });
  });
});
