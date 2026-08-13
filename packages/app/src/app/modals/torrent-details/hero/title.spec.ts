import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TimeagoIntl, provideTimeago } from 'ngx-timeago';
import { QbTorrentProperties } from '../../../models/qbittorrent.model';
import { Torrent } from '../../../models/torrent.model';
import { MergedTorrent, TorrentDetailsDataService } from '../torrent-details-data.service';
import { TorrentDetailsTitle } from './title';

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
  total_size: 4096,
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

describe('TorrentDetailsTitle', () => {
  let component: TorrentDetailsTitle;
  let fixture: ComponentFixture<TorrentDetailsTitle>;
  let torrentSignal: ReturnType<typeof signal<MergedTorrent | null>>;

  beforeEach(async () => {
    torrentSignal = signal<MergedTorrent | null>({
      data: makeTorrent(),
      properties: makeProperties(),
    });

    await TestBed.configureTestingModule({
      imports: [TorrentDetailsTitle],
      providers: [
        { provide: TorrentDetailsDataService, useValue: { torrent: torrentSignal } },
        provideTimeago({ intl: { provide: TimeagoIntl, useClass: TimeagoIntl } }),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(TorrentDetailsTitle);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('reports the status label key for the current state', () => {
    expect(component.statusLabelKey()).toBe(
      'components.modals.torrent-details.hero.status.downloading',
    );
  });

  it('renders nothing when there is no torrent yet', () => {
    torrentSignal.set(null);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.bb-title-row')).toBeNull();
  });

  it('renders the torrent name once a torrent is present', () => {
    const name = fixture.nativeElement.querySelector('.bb-title-row__name');
    expect(name).not.toBeNull();
    expect(name.textContent).toContain('My Torrent');
  });
});
