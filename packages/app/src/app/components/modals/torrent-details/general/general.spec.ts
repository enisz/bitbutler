import { Clipboard } from '@angular/cdk/clipboard';
import { WritableSignal, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TimeagoIntl, provideTimeago } from 'ngx-timeago';
import { Subject, of } from 'rxjs';
import {
  QbLogEntry,
  QbLogMessageType,
  QbTorrentProperties,
} from '../../../../models/qbittorrent.model';
import { Torrent } from '../../../../models/torrent.model';
import { CommandBusService } from '../../../../services/command-bus.service';
import { GeneralSettingsService } from '../../../../services/general-settings.service';
import { PathService } from '../../../../services/path.service';
import { QbService } from '../../../../services/qb.service';
import { ServerStoreService } from '../../../../services/server-store.service';
import { ToastService } from '../../../../services/toast.service';
import { TorrentStoreService } from '../../../../services/torrent-store.service';
import { General } from './general';

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

describe('General', () => {
  let component: General;
  let fixture: ComponentFixture<General>;
  let torrentsMap: WritableSignal<Map<string, Torrent>>;
  let mockLogMain: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    torrentsMap = signal(new Map());
    mockLogMain = vi.fn().mockResolvedValue([]);

    await TestBed.configureTestingModule({
      imports: [General],
      providers: [
        { provide: ServerStoreService, useValue: { currentServerId: signal('server-1') } },
        {
          provide: TorrentStoreService,
          useValue: { torrentsMap },
        },
        {
          provide: QbService,
          useValue: {
            torrents: {
              properties: vi.fn().mockResolvedValue({}),
              files: vi.fn().mockResolvedValue([]),
              rename: vi.fn(),
              renameFile: vi.fn(),
              renameFolder: vi.fn(),
              setDownloadLimit: vi.fn(),
              setUploadLimit: vi.fn(),
              setShareLimits: vi.fn(),
              setCategory: vi.fn(),
              addTags: vi.fn(),
              removeTags: vi.fn(),
              reannounce: vi.fn(),
            },
            log: {
              main: mockLogMain,
            },
          },
        },
        {
          provide: CommandBusService,
          useValue: { commands$: new Subject<any>().asObservable(), emit: vi.fn() },
        },
        {
          provide: GeneralSettingsService,
          useValue: {
            load: vi.fn().mockResolvedValue({ behavior: {} }),
            asObservable: vi.fn().mockReturnValue(of({ behavior: {} })),
          },
        },
        { provide: PathService, useValue: { resolveLocalPath: vi.fn().mockResolvedValue(null) } },
        { provide: Clipboard, useValue: { copy: vi.fn() } },
        { provide: ToastService, useValue: { success: vi.fn(), danger: vi.fn() } },
        provideTimeago({ intl: { provide: TimeagoIntl, useClass: TimeagoIntl } }),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(General);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('hash', 'abc123');
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should start with null torrent', () => {
    expect(component.torrent()).toBeNull();
  });

  it('should start with null properties', () => {
    expect(component.properties()).toBeNull();
  });

  it('should start with singleFile = false', () => {
    expect(component.singleFile()).toBe(false);
  });

  describe('parseFileErrorReason', () => {
    it('extracts the short error and full reason from a file error alert message', () => {
      const message =
        'File error alert. Torrent: "ubuntu-26.04-desktop-amd64.iso". File: "/mnt/storage/filmek/test/ubuntu-26.04-desktop-amd64.iso.!qB". Reason: "ubuntu-26.04-desktop-amd64.iso file_open (/mnt/storage/filmek/test/ubuntu-26.04-desktop-amd64.iso.!qB) error: Permission denied"';

      const result = component.parseFileErrorReason(message);

      expect(result.short).toBe('Permission denied');
      expect(result.reason).toBe(
        'ubuntu-26.04-desktop-amd64.iso file_open (/mnt/storage/filmek/test/ubuntu-26.04-desktop-amd64.iso.!qB) error: Permission denied',
      );
    });

    it('falls back to the full reason when there is no "error:" segment', () => {
      const message = 'Some alert. Torrent: "My Torrent". Reason: "disk is full"';

      const result = component.parseFileErrorReason(message);

      expect(result.reason).toBe('disk is full');
      expect(result.short).toBe('disk is full');
    });

    it('falls back to the raw message when there is no Reason section', () => {
      const message = 'Added new torrent. Torrent: "My Torrent"';

      const result = component.parseFileErrorReason(message);

      expect(result.reason).toBe(message);
      expect(result.short).toBe(message);
    });
  });

  describe('rawLogJson', () => {
    it('formats the log entry as 4-space-indented JSON', () => {
      const entry: QbLogEntry = {
        id: 10672,
        message: 'File error alert.',
        timestamp: 1781772596,
        type: QbLogMessageType.Warning,
      };

      expect(component.rawLogJson(entry)).toBe(JSON.stringify(entry, null, 4));
    });
  });

  describe('errorLog effect', () => {
    it('does nothing when the torrent is not in the error state', async () => {
      torrentsMap.set(new Map([['abc123', makeTorrent({ state: 'downloading' })]]));
      fixture.detectChanges();
      await fixture.whenStable();

      expect(mockLogMain).not.toHaveBeenCalled();
      expect(component.errorLog()).toBeNull();
    });

    it('fetches the main log and stores the matching warning/critical entry when the torrent errors', async () => {
      const matching = makeLogEntry({ id: 5, type: QbLogMessageType.Critical });
      const unrelated = makeLogEntry({
        id: 6,
        type: QbLogMessageType.Normal,
        message: 'Added new torrent. Torrent: "My Torrent"',
      });
      mockLogMain.mockResolvedValue([unrelated, matching]);

      torrentsMap.set(new Map([['abc123', makeTorrent({ state: 'error' })]]));
      fixture.detectChanges();
      await fixture.whenStable();

      expect(mockLogMain).toHaveBeenCalledWith('server-1', {
        normal: false,
        info: false,
        warning: true,
        critical: true,
      });
      expect(component.errorLog()?.id).toBe(5);
    });

    it('picks the entry with the highest id when multiple entries match', async () => {
      mockLogMain.mockResolvedValue([
        makeLogEntry({ id: 5, type: QbLogMessageType.Warning }),
        makeLogEntry({ id: 9, type: QbLogMessageType.Critical }),
        makeLogEntry({ id: 7, type: QbLogMessageType.Warning }),
      ]);

      torrentsMap.set(new Map([['abc123', makeTorrent({ state: 'error' })]]));
      fixture.detectChanges();
      await fixture.whenStable();

      expect(component.errorLog()?.id).toBe(9);
    });

    it('does not refetch while the torrent stays in the error state with no match', async () => {
      mockLogMain.mockResolvedValue([
        makeLogEntry({ message: 'Unrelated torrent message', type: QbLogMessageType.Critical }),
      ]);

      torrentsMap.set(new Map([['abc123', makeTorrent({ state: 'error' })]]));
      fixture.detectChanges();
      await fixture.whenStable();

      expect(mockLogMain).toHaveBeenCalledTimes(1);
      expect(component.errorLog()).toBeNull();

      torrentsMap.set(new Map([['abc123', makeTorrent({ state: 'error' })]]));
      fixture.detectChanges();
      await fixture.whenStable();

      expect(mockLogMain).toHaveBeenCalledTimes(1);
    });

    it('clears errorLog and refetches on the next error episode after leaving the error state', async () => {
      mockLogMain.mockResolvedValue([makeLogEntry({ id: 1, type: QbLogMessageType.Critical })]);
      torrentsMap.set(new Map([['abc123', makeTorrent({ state: 'error' })]]));
      fixture.detectChanges();
      await fixture.whenStable();
      expect(component.errorLog()?.id).toBe(1);

      torrentsMap.set(new Map([['abc123', makeTorrent({ state: 'downloading' })]]));
      fixture.detectChanges();
      await fixture.whenStable();
      expect(component.errorLog()).toBeNull();

      mockLogMain.mockResolvedValue([makeLogEntry({ id: 2, type: QbLogMessageType.Critical })]);
      torrentsMap.set(new Map([['abc123', makeTorrent({ state: 'error' })]]));
      fixture.detectChanges();
      await fixture.whenStable();

      expect(mockLogMain).toHaveBeenCalledTimes(2);
      expect(component.errorLog()?.id).toBe(2);
    });
  });

  describe('toggleErrorLog', () => {
    it('flips errorLogExpanded', () => {
      expect(component.errorLogExpanded()).toBe(false);
      component.toggleErrorLog();
      expect(component.errorLogExpanded()).toBe(true);
      component.toggleErrorLog();
      expect(component.errorLogExpanded()).toBe(false);
    });
  });

  describe('error row rendering', () => {
    beforeEach(() => {
      torrentsMap.set(new Map([['abc123', makeTorrent({ state: 'downloading' })]]));
      component.properties.set(makeProperties());
      fixture.detectChanges();
    });

    it('does not render the error row when there is no errorLog', () => {
      expect(fixture.nativeElement.querySelector('.bb-section--danger')).toBeNull();
    });

    it('renders the error row with the short reason and reflects errorLogExpanded on the icon', () => {
      component.errorLog.set(makeLogEntry());
      fixture.detectChanges();

      const row = fixture.nativeElement.querySelector('.bb-section--danger');
      expect(row).not.toBeNull();
      expect(row.querySelector('.section-header').textContent).not.toContain('[object Object]');
      expect(row.querySelector('.section-value').textContent).toContain('Permission denied');

      const icon = row.querySelector('.error-toggle__icon');
      expect(icon.classList.contains('error-toggle__icon--expanded')).toBe(false);

      component.toggleErrorLog();
      fixture.detectChanges();

      expect(icon.classList.contains('error-toggle__icon--expanded')).toBe(true);

      const detail = row.querySelector('.error-toggle__detail');
      expect(detail.querySelector('hr')).toBeNull();
      expect(detail.querySelector('.section-header')).toBeNull();
      expect(detail.querySelector('pre').textContent).toContain('Permission denied');
    });
  });
});
