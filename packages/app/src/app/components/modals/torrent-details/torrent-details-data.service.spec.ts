import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Torrent } from '../../../models/torrent.model';
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

describe('TorrentDetailsDataService', () => {
  let service: TorrentDetailsDataService;
  let torrentsMap: ReturnType<typeof signal<Map<string, Torrent>>>;

  beforeEach(() => {
    torrentsMap = signal(new Map());

    TestBed.configureTestingModule({
      providers: [
        TorrentDetailsDataService,
        { provide: TorrentStoreService, useValue: { torrentsMap } },
      ],
    });

    service = TestBed.inject(TorrentDetailsDataService);
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
});
