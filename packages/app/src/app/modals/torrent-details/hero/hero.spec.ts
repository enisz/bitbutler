import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TimeagoIntl, provideTimeago } from 'ngx-timeago';
import { QbTorrentProperties } from '../../../models/qbittorrent.model';
import { Torrent } from '../../../models/torrent.model';
import { MergedTorrent, TorrentDetailsDataService } from '../torrent-details-data.service';
import { TorrentDetailsHero } from './hero';

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
  dlspeed: 1024,
  download_path: '',
  downloaded: 2048,
  downloaded_session: 0,
  eta: 3600,
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
  num_leechs: 3,
  num_seeds: 5,
  priority: 0,
  progress: 0.46,
  ratio: 1.23,
  ratio_limit: -1,
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
  uploaded: 512,
  uploaded_session: 0,
  upspeed: 256,
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
  nb_connections: 4,
  nb_connections_limit: 100,
  share_ratio: 0,
  addition_date: 0,
  completion_date: 0,
  created_by: '',
  dl_speed: 0,
  dl_speed_avg: 0,
  eta: 0,
  last_seen: 0,
  peers: 0,
  peers_total: 10,
  pieces_have: 46,
  pieces_num: 100,
  reannounce: 0,
  seeds: 0,
  seeds_total: 20,
  total_size: 0,
  up_speed: 0,
  up_speed_avg: 0,
  isPrivate: false,
  infohash_v1: '',
  infohash_v2: '',
  ...overrides,
});

describe('TorrentDetailsHero', () => {
  let component: TorrentDetailsHero;
  let fixture: ComponentFixture<TorrentDetailsHero>;
  let torrentSignal: ReturnType<typeof signal<MergedTorrent | null>>;

  beforeEach(async () => {
    torrentSignal = signal<MergedTorrent | null>({
      data: makeTorrent(),
      properties: makeProperties(),
    });

    await TestBed.configureTestingModule({
      imports: [TorrentDetailsHero],
      providers: [
        { provide: TorrentDetailsDataService, useValue: { torrent: torrentSignal } },
        provideTimeago({ intl: { provide: TimeagoIntl, useClass: TimeagoIntl } }),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(TorrentDetailsHero);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('computes the rounded progress percent', () => {
    expect(component.progressPercent()).toBe(46);
  });

  it('reports isDownloading for a downloading-family state', () => {
    expect(component.isDownloading()).toBe(true);
  });

  it('renders nothing when there is no torrent yet', () => {
    torrentSignal.set(null);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.bb-hero')).toBeNull();
  });

  it('renders the hero card once a torrent is present', () => {
    expect(fixture.nativeElement.querySelector('.bb-hero')).not.toBeNull();
  });

  it('reports the status label key for the current state', () => {
    expect(component.statusLabelKey()).toBe(
      'components.modals.torrent-details.hero.status.downloading',
    );
  });

  it('renders the translated status label as the hero state text', () => {
    const state = fixture.nativeElement.querySelector('.bb-hero__state');
    expect(state).not.toBeNull();
    expect(state.textContent).toContain(
      'components.modals.torrent-details.hero.status.downloading',
    );
  });
});
