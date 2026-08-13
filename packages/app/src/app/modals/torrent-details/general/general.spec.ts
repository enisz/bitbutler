import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TimeagoIntl, provideTimeago } from 'ngx-timeago';
import {
  QbLogEntry,
  QbLogMessageType,
  QbTorrentProperties,
} from '../../../models/qbittorrent.model';
import { Torrent } from '../../../models/torrent.model';
import { CommandBusService } from '../../../services/command-bus.service';
import { QbService } from '../../../services/qb.service';
import { ServerStoreService } from '../../../services/server-store.service';
import { ToastService } from '../../../services/toast.service';
import { TorrentExportService } from '../../../services/torrent-export.service';
import { TorrentDetailsActionsService } from '../torrent-details-actions.service';
import { MergedTorrent, TorrentDetailsDataService } from '../torrent-details-data.service';
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
  let mockDataService: {
    torrent: ReturnType<typeof signal<MergedTorrent | null>>;
    localPath: ReturnType<typeof signal<string | null>>;
    errorLog: ReturnType<typeof signal<QbLogEntry | null>>;
  };
  let mockActionsService: {
    toggleAutoTmm: ReturnType<typeof vi.fn>;
    toggleForceStart: ReturnType<typeof vi.fn>;
    toggleSequentialDownload: ReturnType<typeof vi.fn>;
    toggleFirstLastPiecePrio: ReturnType<typeof vi.fn>;
    toggleSuperSeeding: ReturnType<typeof vi.fn>;
    isOptionPending: (key: string) => boolean;
  };
  // Backs mockActionsService.isOptionPending with a real signal so that
  // template bindings which read it (via a plain function call) correctly
  // participate in this app's zoneless/signal-based reactivity - a plain
  // vi.fn() mutated mid-test does not, since Angular never registers it as
  // a reactive dependency and OnPush skips re-checking the binding.
  let pendingOptionKey: ReturnType<typeof signal<string | null>>;

  beforeEach(async () => {
    mockDataService = {
      torrent: signal(null),
      localPath: signal(null),
      errorLog: signal(null),
    };
    pendingOptionKey = signal<string | null>(null);
    mockActionsService = {
      toggleAutoTmm: vi.fn(),
      toggleForceStart: vi.fn(),
      toggleSequentialDownload: vi.fn(),
      toggleFirstLastPiecePrio: vi.fn(),
      toggleSuperSeeding: vi.fn(),
      isOptionPending: (key: string) => pendingOptionKey() === key,
    };

    await TestBed.configureTestingModule({
      imports: [General],
      providers: [
        { provide: TorrentDetailsDataService, useValue: mockDataService },
        { provide: TorrentDetailsActionsService, useValue: mockActionsService },
        provideTimeago({ intl: { provide: TimeagoIntl, useClass: TimeagoIntl } }),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(General);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should start with null torrent', () => {
    expect(component.torrent()).toBeNull();
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
      mockDataService.torrent.set({
        data: makeTorrent({ state: 'downloading' }),
        properties: makeProperties(),
      });
      fixture.detectChanges();
    });

    it('does not render the error row when there is no errorLog', () => {
      expect(fixture.nativeElement.querySelector('.bb-section--danger')).toBeNull();
    });

    it('renders the error row with the short reason and reflects errorLogExpanded on the icon', () => {
      mockDataService.errorLog.set(makeLogEntry());
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

  describe('General tab restructure', () => {
    beforeEach(() => {
      mockDataService.torrent.set({
        data: makeTorrent({
          state: 'downloading',
          auto_tmm: true,
          force_start: false,
          seq_dl: true,
          f_l_piece_prio: false,
          super_seeding: false,
        }),
        properties: makeProperties(),
      });
      fixture.detectChanges();
    });

    it('does not render a State row in the body', () => {
      const sections = Array.from(
        fixture.nativeElement.querySelectorAll('.section-header'),
      ) as HTMLElement[];
      expect(sections.some((el) => el.textContent?.includes('.general.state'))).toBe(false);
    });

    it('does not render the legacy labeled progress bar', () => {
      expect(fixture.nativeElement.querySelector('app-bb-progress')).toBeNull();
    });

    it('renders 18 stat rows inside the Transfer stat grid', () => {
      const grid = fixture.nativeElement.querySelector('.bb-stat-grid');
      expect(grid).not.toBeNull();
      expect(grid.querySelectorAll('.bb-section').length).toBe(18);
    });

    it('does not render any copy-to-clipboard buttons', () => {
      expect(fixture.nativeElement.querySelector('.button-container')).toBeNull();
    });

    it('caps the Information card grid at 2 columns', () => {
      const infoHeader = Array.from(
        fixture.nativeElement.querySelectorAll('.bb-fieldset-title'),
      ).find((el: any) => el.textContent?.includes('.labels.information')) as HTMLElement;
      const infoCard = infoHeader.closest('.bb-fieldset') as HTMLElement;
      expect(infoCard.querySelector('.col-xl-4')).toBeNull();
      expect(infoCard.querySelector('.col-lg-6')).not.toBeNull();
    });

    it('renders 5 clickable Options buttons reflecting on/off state', () => {
      const buttons = Array.from(
        fixture.nativeElement.querySelectorAll('.bb-options-grid button'),
      ) as HTMLButtonElement[];
      expect(buttons.length).toBe(5);

      const on = buttons.filter((b) => b.classList.contains('btn-success'));
      const off = buttons.filter((b) => b.classList.contains('btn-link'));
      expect(on.length).toBe(2); // auto_tmm, seq_dl
      expect(off.length).toBe(3); // force_start, f_l_piece_prio, super_seeding
      expect(buttons.every((b) => !b.disabled)).toBe(true);
    });

    it('sets aria-pressed on each Options button to match its on/off state', () => {
      const findButton = (fragment: string): HTMLButtonElement => {
        const button = (
          Array.from(
            fixture.nativeElement.querySelectorAll('.bb-options-grid button'),
          ) as HTMLButtonElement[]
        ).find((b) => b.textContent?.includes(fragment));
        expect(button).toBeDefined();
        return button as HTMLButtonElement;
      };

      expect(findButton('auto-tmm').getAttribute('aria-pressed')).toBe('true');
      expect(findButton('force-start').getAttribute('aria-pressed')).toBe('false');
      expect(findButton('sequential-download').getAttribute('aria-pressed')).toBe('true');
      expect(findButton('first-last-piece-prio').getAttribute('aria-pressed')).toBe('false');
      expect(findButton('super-seeding').getAttribute('aria-pressed')).toBe('false');
    });

    it('disables only the Options button whose own action is pending', () => {
      const findButton = (fragment: string): HTMLButtonElement => {
        const button = (
          Array.from(
            fixture.nativeElement.querySelectorAll('.bb-options-grid button'),
          ) as HTMLButtonElement[]
        ).find((b) => b.textContent?.includes(fragment));
        expect(button).toBeDefined();
        return button as HTMLButtonElement;
      };

      pendingOptionKey.set('auto-tmm');
      fixture.detectChanges();

      expect(findButton('auto-tmm').disabled).toBe(true);
      expect(findButton('force-start').disabled).toBe(false);
      expect(findButton('sequential-download').disabled).toBe(false);
      expect(findButton('first-last-piece-prio').disabled).toBe(false);
      expect(findButton('super-seeding').disabled).toBe(false);
    });

    it('clicking an Options button calls the matching action-service toggle method', () => {
      const findButton = (fragment: string): HTMLButtonElement => {
        const button = (
          Array.from(
            fixture.nativeElement.querySelectorAll('.bb-options-grid button'),
          ) as HTMLButtonElement[]
        ).find((b) => b.textContent?.includes(fragment));
        expect(button).toBeDefined();
        return button as HTMLButtonElement;
      };

      findButton('auto-tmm').click();
      expect(mockActionsService.toggleAutoTmm).toHaveBeenCalled();

      findButton('force-start').click();
      expect(mockActionsService.toggleForceStart).toHaveBeenCalled();

      findButton('sequential-download').click();
      expect(mockActionsService.toggleSequentialDownload).toHaveBeenCalled();

      findButton('first-last-piece-prio').click();
      expect(mockActionsService.toggleFirstLastPiecePrio).toHaveBeenCalled();

      findButton('super-seeding').click();
      expect(mockActionsService.toggleSuperSeeding).toHaveBeenCalled();
    });
  });

  describe('Options button pending state, wired to the real TorrentDetailsActionsService', () => {
    let realFixture: ComponentFixture<General>;
    let realDataService: {
      hash: ReturnType<typeof vi.fn>;
      torrent: ReturnType<typeof signal<MergedTorrent | null>>;
      localPath: ReturnType<typeof signal<string | null>>;
      errorLog: ReturnType<typeof signal<QbLogEntry | null>>;
    };
    let setAutoManagement: ReturnType<typeof vi.fn>;

    beforeEach(async () => {
      TestBed.resetTestingModule();
      realDataService = {
        hash: vi.fn().mockReturnValue('abc123'),
        torrent: signal<MergedTorrent | null>({
          data: makeTorrent({ auto_tmm: false }),
          properties: makeProperties(),
        }),
        localPath: signal(null),
        errorLog: signal(null),
      };
      setAutoManagement = vi.fn().mockReturnValue(new Promise(() => {})); // never resolves

      await TestBed.configureTestingModule({
        imports: [General],
        providers: [
          TorrentDetailsActionsService,
          { provide: TorrentDetailsDataService, useValue: realDataService },
          { provide: ServerStoreService, useValue: { currentServerId: signal('server-1') } },
          { provide: QbService, useValue: { torrents: { setAutoManagement } } },
          { provide: CommandBusService, useValue: { emit: vi.fn() } },
          { provide: ToastService, useValue: { info: vi.fn(), danger: vi.fn() } },
          { provide: TorrentExportService, useValue: { exportTorrentFiles: vi.fn() } },
          provideTimeago({ intl: { provide: TimeagoIntl, useClass: TimeagoIntl } }),
        ],
      }).compileComponents();

      realFixture = TestBed.createComponent(General);
      realFixture.detectChanges();
    });

    it('disables the auto-tmm button while the real service call is pending', () => {
      const button = Array.from(
        realFixture.nativeElement.querySelectorAll('.bb-options-grid button'),
      ).find((b: any) => b.textContent?.includes('auto-tmm')) as HTMLButtonElement;

      expect(button.disabled).toBe(false);
      button.click();
      realFixture.detectChanges();
      expect(setAutoManagement).toHaveBeenCalled();
      expect(button.disabled).toBe(true);
    });
  });

  describe('date fields use the configured date format', () => {
    function sectionValueFor(headerFragment: string): string {
      const sections = Array.from(
        fixture.nativeElement.querySelectorAll('.bb-section'),
      ) as HTMLElement[];
      const section = sections.find((el) =>
        el.querySelector('.section-header')?.textContent?.includes(headerFragment),
      );
      return section?.querySelector('.section-value')?.textContent?.trim() ?? '';
    }

    beforeEach(() => {
      mockDataService.torrent.set({
        data: makeTorrent({ last_activity: 0, added_on: 1700000000, completion_on: 1700000000 }),
        properties: makeProperties({ creation_date: 1700000000 }),
      });
      fixture.detectChanges();
    });

    it('renders blank for last-seen-complete when last_activity is 0', () => {
      expect(sectionValueFor('last-seen-complete')).toBe('');
    });

    it('renders a configured-format date for added-on', () => {
      expect(sectionValueFor('added-on')).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/);
    });

    it('renders a configured-format date for completed-on', () => {
      expect(sectionValueFor('completed-on')).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/);
    });

    it('renders a configured-format date for created-on', () => {
      expect(sectionValueFor('created-on')).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/);
    });
  });
});
