import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { TorrentFileEntry } from '@bitbutler/shared';
import { BehaviorSubject, Subject } from 'rxjs';
import { vi } from 'vitest';
import {
  QbLogEntry,
  QbLogMessageType,
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
import { PathService } from '../../../services/path.service';
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

const makeLogEntry = (overrides: Partial<QbLogEntry> = {}): QbLogEntry => ({
  id: 1,
  message:
    'File error alert. Torrent: "My Torrent". File: "/path". Reason: "x error: Permission denied"',
  timestamp: 1700000000,
  type: QbLogMessageType.Warning,
  ...overrides,
});

describe('TorrentDetailsDataService', () => {
  let service: TorrentDetailsDataService;
  let torrentsMap: ReturnType<typeof signal<Map<string, Torrent>>>;
  let qbTorrentsProperties: ReturnType<typeof vi.fn>;
  let qbTorrentsTrackers: ReturnType<typeof vi.fn>;
  let qbTorrentsFiles: ReturnType<typeof vi.fn>;
  let qbTorrentsInfo: ReturnType<typeof vi.fn>;
  let qbLogMain: ReturnType<typeof vi.fn>;
  let resolveLocalPath: ReturnType<typeof vi.fn>;
  let peersPolling$: Subject<QbTorrentPeersResponse>;
  let startPeersPolling: ReturnType<typeof vi.fn>;
  let serverSettingsLoad: ReturnType<typeof vi.fn>;
  let isPaused$: BehaviorSubject<boolean>;

  beforeEach(() => {
    vi.useFakeTimers();
    torrentsMap = signal(new Map());
    qbTorrentsProperties = vi.fn().mockResolvedValue(makeProperties());
    qbTorrentsTrackers = vi.fn().mockResolvedValue([]);
    qbTorrentsFiles = vi.fn().mockResolvedValue([]);
    qbTorrentsInfo = vi.fn().mockResolvedValue(null);
    isPaused$ = new BehaviorSubject<boolean>(false);
    qbLogMain = vi.fn().mockResolvedValue([]);
    resolveLocalPath = vi.fn().mockResolvedValue(null);
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
              info: qbTorrentsInfo,
            },
            log: { main: qbLogMain },
          },
        },
        { provide: QbPollingService, useValue: { startPeersPolling, isPaused$ } },
        { provide: ServerSettingsService, useValue: { load: serverSettingsLoad } },
        { provide: PathService, useValue: { resolveLocalPath } },
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

    it('uses localTorrentData over the store when localTorrentData is non-null', async () => {
      const storeTorrent = makeTorrent({ hash: 'abc123', dlspeed: 100 });
      const localTorrent = makeTorrent({ hash: 'abc123', dlspeed: 9999 });
      torrentsMap.set(new Map([['abc123', storeTorrent]]));
      qbTorrentsInfo.mockResolvedValue(localTorrent);
      isPaused$.next(true);
      service.init('abc123', {});
      await vi.advanceTimersByTimeAsync(0);

      expect(service.torrent()?.data.dlspeed).toBe(9999);
    });

    it('falls back to store data when localTorrentData is null', async () => {
      const storeTorrent = makeTorrent({ hash: 'abc123', dlspeed: 100 });
      torrentsMap.set(new Map([['abc123', storeTorrent]]));
      isPaused$.next(false);
      service.init('abc123', {});
      await vi.advanceTimersByTimeAsync(0);

      expect(service.torrent()?.data.dlspeed).toBe(100);
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

  describe('torrent info polling (when paused)', () => {
    it('does not call torrents.info when polling is not paused', async () => {
      isPaused$.next(false);
      service.init('abc123', {});
      await vi.advanceTimersByTimeAsync(0);

      expect(qbTorrentsInfo).not.toHaveBeenCalled();
    });

    it('calls torrents.info when polling is paused', async () => {
      isPaused$.next(true);
      service.init('abc123', {});
      await vi.advanceTimersByTimeAsync(0);

      expect(qbTorrentsInfo).toHaveBeenCalledWith('server-1', 'abc123');
    });

    it('sets localTorrentData when polling is paused and info returns a torrent', async () => {
      const torrent = makeTorrent({ hash: 'abc123', dlspeed: 9999 });
      qbTorrentsInfo.mockResolvedValue(torrent);
      isPaused$.next(true);
      service.init('abc123', {});
      await vi.advanceTimersByTimeAsync(0);

      expect(service.localTorrentData()).toEqual(torrent);
    });

    it('calls torrents.info again on the next poll tick when still paused', async () => {
      isPaused$.next(true);
      service.init('abc123', {});
      await vi.advanceTimersByTimeAsync(0);
      expect(qbTorrentsInfo).toHaveBeenCalledTimes(1);

      await vi.advanceTimersByTimeAsync(2000);
      expect(qbTorrentsInfo).toHaveBeenCalledTimes(2);
    });

    it('does not call torrents.info on subsequent ticks after polling resumes', async () => {
      isPaused$.next(true);
      service.init('abc123', {});
      await vi.advanceTimersByTimeAsync(0);
      expect(qbTorrentsInfo).toHaveBeenCalledTimes(1);

      isPaused$.next(false);
      await vi.advanceTimersByTimeAsync(2000);
      expect(qbTorrentsInfo).toHaveBeenCalledTimes(1);
    });

    it('logs and does not throw when fetchTorrentInfo fails', async () => {
      qbTorrentsInfo.mockRejectedValueOnce(new Error('network error'));
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
      isPaused$.next(true);
      service.init('abc123', {});
      await vi.advanceTimersByTimeAsync(0);

      expect(consoleError).toHaveBeenCalled();
      expect(service.localTorrentData()).toBeNull();
    });

    it('resets localTorrentData to null when stopAll is called', async () => {
      const torrent = makeTorrent({ hash: 'abc123' });
      qbTorrentsInfo.mockResolvedValue(torrent);
      isPaused$.next(true);
      service.init('abc123', {});
      await vi.advanceTimersByTimeAsync(0);
      expect(service.localTorrentData()).toEqual(torrent);

      service.stopAll();
      expect(service.localTorrentData()).toBeNull();
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

    it('does not poll while the content tab is not active', async () => {
      service.init('abc123', {});
      await vi.advanceTimersByTimeAsync(0);
      // init() triggers its own one-off files() fetch for singleFile, separate from content polling.
      expect(qbTorrentsFiles).toHaveBeenCalledTimes(1);

      await vi.advanceTimersByTimeAsync(5000);
      expect(qbTorrentsFiles).toHaveBeenCalledTimes(1);
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
      // 1 call from init()'s singleFile fetch + 1 from the first content-tab poll.
      expect(qbTorrentsFiles).toHaveBeenCalledTimes(2);

      await vi.advanceTimersByTimeAsync(5000);
      expect(qbTorrentsFiles).toHaveBeenCalledTimes(3);
    });

    it('stops polling once the content tab is no longer active', async () => {
      service.init('abc123', {});
      service.selectTab('content');
      await vi.advanceTimersByTimeAsync(0);
      service.selectTab('general');

      await vi.advanceTimersByTimeAsync(5000);
      // 1 call from init()'s singleFile fetch + 1 from the single content-tab poll before switching away.
      expect(qbTorrentsFiles).toHaveBeenCalledTimes(2);
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

  describe('singleFile', () => {
    it('starts as false', () => {
      expect(service.singleFile()).toBe(false);
    });

    it('becomes true when the torrent has exactly one file', async () => {
      qbTorrentsFiles.mockResolvedValue([
        {
          index: 0,
          name: 'a.iso',
          size: 1,
          progress: 1,
          priority: 1,
          is_seed: true,
          piece_range: [0, 0],
          availability: 1,
        },
      ]);
      service.init('abc123', {});
      await vi.advanceTimersByTimeAsync(0);

      expect(service.singleFile()).toBe(true);
    });

    it('stays false when the torrent has multiple files', async () => {
      qbTorrentsFiles.mockResolvedValue([
        {
          index: 0,
          name: 'a.iso',
          size: 1,
          progress: 1,
          priority: 1,
          is_seed: true,
          piece_range: [0, 0],
          availability: 1,
        },
        {
          index: 1,
          name: 'b.iso',
          size: 1,
          progress: 1,
          priority: 1,
          is_seed: true,
          piece_range: [0, 0],
          availability: 1,
        },
      ]);
      service.init('abc123', {});
      await vi.advanceTimersByTimeAsync(0);

      expect(service.singleFile()).toBe(false);
    });

    it('logs and does not throw when the files fetch fails', async () => {
      qbTorrentsFiles.mockRejectedValueOnce(new Error('boom'));
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

      service.init('abc123', {});
      await vi.advanceTimersByTimeAsync(0);

      expect(consoleError).toHaveBeenCalled();
      expect(service.singleFile()).toBe(false);
    });
  });

  describe('localPath', () => {
    it('resolves the local path once the torrent has a content_path', async () => {
      resolveLocalPath.mockResolvedValue('/local/path');
      service.init('abc123', {});
      torrentsMap.set(new Map([['abc123', makeTorrent({ content_path: '/remote/path' })]]));
      qbTorrentsProperties.mockResolvedValue(makeProperties());
      await vi.advanceTimersByTimeAsync(0);

      expect(resolveLocalPath).toHaveBeenCalledWith('/remote/path');
      expect(service.localPath()).toBe('/local/path');
    });

    it('stays null when there is no content_path yet', () => {
      service.init('abc123', {});
      expect(service.localPath()).toBeNull();
      expect(resolveLocalPath).not.toHaveBeenCalled();
    });
  });

  describe('errorLog', () => {
    it('does nothing when the torrent is not in the error state', async () => {
      service.init('abc123', {});
      torrentsMap.set(new Map([['abc123', makeTorrent({ state: 'downloading' })]]));
      await vi.advanceTimersByTimeAsync(0);

      expect(qbLogMain).not.toHaveBeenCalled();
      expect(service.errorLog()).toBeNull();
    });

    it('fetches the main log and stores the matching warning/critical entry when the torrent errors', async () => {
      const matching = makeLogEntry({ id: 5, type: QbLogMessageType.Critical });
      qbLogMain.mockResolvedValue([matching]);

      service.init('abc123', {});
      torrentsMap.set(new Map([['abc123', makeTorrent({ state: 'error', name: 'My Torrent' })]]));
      await vi.advanceTimersByTimeAsync(0);

      expect(qbLogMain).toHaveBeenCalledWith('server-1', {
        normal: false,
        info: false,
        warning: true,
        critical: true,
      });
      expect(service.errorLog()?.id).toBe(5);
    });

    it('does not refetch while the torrent stays in the error state with no match', async () => {
      qbLogMain.mockResolvedValue([
        makeLogEntry({ message: 'Unrelated torrent message', type: QbLogMessageType.Critical }),
      ]);

      service.init('abc123', {});
      torrentsMap.set(new Map([['abc123', makeTorrent({ state: 'error', name: 'My Torrent' })]]));
      await vi.advanceTimersByTimeAsync(0);
      expect(qbLogMain).toHaveBeenCalledTimes(1);

      torrentsMap.set(new Map([['abc123', makeTorrent({ state: 'error', name: 'My Torrent' })]]));
      await vi.advanceTimersByTimeAsync(0);
      expect(qbLogMain).toHaveBeenCalledTimes(1);
    });

    it('clears errorLog and refetches on the next error episode after leaving the error state', async () => {
      qbLogMain.mockResolvedValue([makeLogEntry({ id: 1, type: QbLogMessageType.Critical })]);
      service.init('abc123', {});
      torrentsMap.set(new Map([['abc123', makeTorrent({ state: 'error', name: 'My Torrent' })]]));
      await vi.advanceTimersByTimeAsync(0);
      expect(service.errorLog()?.id).toBe(1);

      torrentsMap.set(new Map([['abc123', makeTorrent({ state: 'downloading' })]]));
      await vi.advanceTimersByTimeAsync(0);
      expect(service.errorLog()).toBeNull();

      qbLogMain.mockResolvedValue([makeLogEntry({ id: 2, type: QbLogMessageType.Critical })]);
      torrentsMap.set(new Map([['abc123', makeTorrent({ state: 'error', name: 'My Torrent' })]]));
      await vi.advanceTimersByTimeAsync(0);

      expect(qbLogMain).toHaveBeenCalledTimes(2);
      expect(service.errorLog()?.id).toBe(2);
    });
  });
});
