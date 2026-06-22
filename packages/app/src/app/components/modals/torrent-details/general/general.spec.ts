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
  let qbTorrents: {
    properties: ReturnType<typeof vi.fn>;
    files: ReturnType<typeof vi.fn>;
    rename: ReturnType<typeof vi.fn>;
    renameFile: ReturnType<typeof vi.fn>;
    renameFolder: ReturnType<typeof vi.fn>;
    resume: ReturnType<typeof vi.fn>;
    pause: ReturnType<typeof vi.fn>;
    setForceStart: ReturnType<typeof vi.fn>;
    setDownloadLimit: ReturnType<typeof vi.fn>;
    setUploadLimit: ReturnType<typeof vi.fn>;
    setShareLimits: ReturnType<typeof vi.fn>;
    setCategory: ReturnType<typeof vi.fn>;
    clearCategory: ReturnType<typeof vi.fn>;
    addTags: ReturnType<typeof vi.fn>;
    removeTags: ReturnType<typeof vi.fn>;
    reannounce: ReturnType<typeof vi.fn>;
  };
  let toastInfo: ReturnType<typeof vi.fn>;
  let toastDanger: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    torrentsMap = signal(new Map());
    mockLogMain = vi.fn().mockResolvedValue([]);
    toastInfo = vi.fn();
    toastDanger = vi.fn();
    qbTorrents = {
      properties: vi.fn().mockResolvedValue({}),
      files: vi.fn().mockResolvedValue([]),
      rename: vi.fn(),
      renameFile: vi.fn(),
      renameFolder: vi.fn(),
      resume: vi.fn().mockResolvedValue(undefined),
      pause: vi.fn().mockResolvedValue(undefined),
      setForceStart: vi.fn().mockResolvedValue(undefined),
      setDownloadLimit: vi.fn().mockResolvedValue(undefined),
      setUploadLimit: vi.fn().mockResolvedValue(undefined),
      setShareLimits: vi.fn().mockResolvedValue(undefined),
      setCategory: vi.fn(),
      clearCategory: vi.fn().mockResolvedValue(undefined),
      addTags: vi.fn(),
      removeTags: vi.fn().mockResolvedValue(undefined),
      reannounce: vi.fn().mockResolvedValue(undefined),
    };

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
            torrents: qbTorrents,
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
        {
          provide: ToastService,
          useValue: { success: vi.fn(), info: toastInfo, danger: toastDanger },
        },
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

  describe('action handlers', () => {
    beforeEach(() => {
      torrentsMap.set(
        new Map([
          [
            'abc123',
            makeTorrent({
              ratio_limit: 1.5,
              seeding_time_limit: 60,
              inactive_seeding_time_limit: 30,
              tags: 'a, b',
            }),
          ],
        ]),
      );
      component.properties.set(makeProperties());
      fixture.detectChanges();
    });

    describe('resume', () => {
      it('shows an info toast and resumes the torrent', async () => {
        await component.resume();

        expect(toastInfo).toHaveBeenCalledWith(
          'components.modals.torrent-details.general.toast.resuming',
        );
        expect(qbTorrents.resume).toHaveBeenCalledWith('server-1', ['abc123']);
      });

      it('shows a danger toast when resuming fails', async () => {
        qbTorrents.resume.mockRejectedValueOnce(new Error('boom'));

        await component.resume();

        expect(toastDanger).toHaveBeenCalledWith(
          'boom',
          'components.modals.torrent-details.general.toast.resume-failed',
        );
      });
    });

    describe('pause', () => {
      it('shows an info toast and pauses the torrent', async () => {
        await component.pause();

        expect(toastInfo).toHaveBeenCalledWith(
          'components.modals.torrent-details.general.toast.pausing',
        );
        expect(qbTorrents.pause).toHaveBeenCalledWith('server-1', ['abc123']);
      });

      it('shows a danger toast when pausing fails', async () => {
        qbTorrents.pause.mockRejectedValueOnce(new Error('boom'));

        await component.pause();

        expect(toastDanger).toHaveBeenCalledWith(
          'boom',
          'components.modals.torrent-details.general.toast.pause-failed',
        );
      });
    });

    describe('forceResume', () => {
      it('shows an info toast and force-resumes the torrent', async () => {
        await component.forceResume();

        expect(toastInfo).toHaveBeenCalledWith(
          'components.modals.torrent-details.general.toast.force-resuming',
        );
        expect(qbTorrents.setForceStart).toHaveBeenCalledWith('server-1', ['abc123'], true);
      });

      it('shows a danger toast when force-resuming fails', async () => {
        qbTorrents.setForceStart.mockRejectedValueOnce(new Error('boom'));

        await component.forceResume();

        expect(toastDanger).toHaveBeenCalledWith(
          'boom',
          'components.modals.torrent-details.general.toast.force-resume-failed',
        );
      });
    });

    describe('clearDownloadLimit', () => {
      it('shows an info toast and clears the download limit', async () => {
        await component.clearDownloadLimit();

        expect(toastInfo).toHaveBeenCalledWith(
          'components.modals.torrent-details.general.toast.clearing-download-limit',
        );
        expect(qbTorrents.setDownloadLimit).toHaveBeenCalledWith('server-1', 0, ['abc123']);
      });

      it('shows a danger toast when clearing the download limit fails', async () => {
        qbTorrents.setDownloadLimit.mockRejectedValueOnce(new Error('boom'));

        await component.clearDownloadLimit();

        expect(toastDanger).toHaveBeenCalledWith(
          'boom',
          'components.modals.torrent-details.general.toast.clear-download-limit-failed',
        );
      });
    });

    describe('clearUploadLimit', () => {
      it('shows an info toast and clears the upload limit', async () => {
        await component.clearUploadLimit();

        expect(toastInfo).toHaveBeenCalledWith(
          'components.modals.torrent-details.general.toast.clearing-upload-limit',
        );
        expect(qbTorrents.setUploadLimit).toHaveBeenCalledWith('server-1', 0, ['abc123']);
      });

      it('shows a danger toast when clearing the upload limit fails', async () => {
        qbTorrents.setUploadLimit.mockRejectedValueOnce(new Error('boom'));

        await component.clearUploadLimit();

        expect(toastDanger).toHaveBeenCalledWith(
          'boom',
          'components.modals.torrent-details.general.toast.clear-upload-limit-failed',
        );
      });
    });

    describe('clearRatioLimit', () => {
      it('shows an info toast and clears the ratio limit, keeping the other share limits', async () => {
        await component.clearRatioLimit();

        expect(toastInfo).toHaveBeenCalledWith(
          'components.modals.torrent-details.general.toast.clearing-ratio-limit',
        );
        expect(qbTorrents.setShareLimits).toHaveBeenCalledWith('server-1', ['abc123'], -1, 60, 30);
      });

      it('shows a danger toast when clearing the ratio limit fails', async () => {
        qbTorrents.setShareLimits.mockRejectedValueOnce(new Error('boom'));

        await component.clearRatioLimit();

        expect(toastDanger).toHaveBeenCalledWith(
          'boom',
          'components.modals.torrent-details.general.toast.clear-ratio-limit-failed',
        );
      });
    });

    describe('clearSeedingTimeLimit', () => {
      it('shows an info toast and clears the seeding time limit, keeping the other share limits', async () => {
        await component.clearSeedingTimeLimit();

        expect(toastInfo).toHaveBeenCalledWith(
          'components.modals.torrent-details.general.toast.clearing-seeding-time-limit',
        );
        expect(qbTorrents.setShareLimits).toHaveBeenCalledWith('server-1', ['abc123'], 1.5, -1, 30);
      });

      it('shows a danger toast when clearing the seeding time limit fails', async () => {
        qbTorrents.setShareLimits.mockRejectedValueOnce(new Error('boom'));

        await component.clearSeedingTimeLimit();

        expect(toastDanger).toHaveBeenCalledWith(
          'boom',
          'components.modals.torrent-details.general.toast.clear-seeding-time-limit-failed',
        );
      });
    });

    describe('clearInactiveSeedingTimeLimit', () => {
      it('shows an info toast and clears the inactive seeding time limit, keeping the other share limits', async () => {
        await component.clearInactiveSeedingTimeLimit();

        expect(toastInfo).toHaveBeenCalledWith(
          'components.modals.torrent-details.general.toast.clearing-inactive-seeding-time-limit',
        );
        expect(qbTorrents.setShareLimits).toHaveBeenCalledWith('server-1', ['abc123'], 1.5, 60, -1);
      });

      it('shows a danger toast when clearing the inactive seeding time limit fails', async () => {
        qbTorrents.setShareLimits.mockRejectedValueOnce(new Error('boom'));

        await component.clearInactiveSeedingTimeLimit();

        expect(toastDanger).toHaveBeenCalledWith(
          'boom',
          'components.modals.torrent-details.general.toast.clear-inactive-seeding-time-limit-failed',
        );
      });
    });

    describe('removeCategory', () => {
      it('shows an info toast and clears the category', async () => {
        await component.removeCategory();

        expect(toastInfo).toHaveBeenCalledWith(
          'components.modals.torrent-details.general.toast.removing-category',
        );
        expect(qbTorrents.clearCategory).toHaveBeenCalledWith('server-1', ['abc123']);
      });

      it('shows a danger toast when removing the category fails', async () => {
        qbTorrents.clearCategory.mockRejectedValueOnce(new Error('boom'));

        await component.removeCategory();

        expect(toastDanger).toHaveBeenCalledWith(
          'boom',
          'components.modals.torrent-details.general.toast.remove-category-failed',
        );
      });
    });

    describe('removeAllTags', () => {
      it('shows an info toast and removes the parsed tag list', async () => {
        await component.removeAllTags();

        expect(toastInfo).toHaveBeenCalledWith(
          'components.modals.torrent-details.general.toast.removing-all-tags',
        );
        expect(qbTorrents.removeTags).toHaveBeenCalledWith('server-1', ['abc123'], ['a', 'b']);
      });

      it('shows a danger toast when removing all tags fails', async () => {
        qbTorrents.removeTags.mockRejectedValueOnce(new Error('boom'));

        await component.removeAllTags();

        expect(toastDanger).toHaveBeenCalledWith(
          'boom',
          'components.modals.torrent-details.general.toast.remove-all-tags-failed',
        );
      });
    });

    describe('forceReannounce', () => {
      it('shows an info toast and reannounces the torrent', async () => {
        await component.forceReannounce();

        expect(toastInfo).toHaveBeenCalledWith(
          'components.modals.torrent-details.general.toast.reannouncing',
        );
        expect(qbTorrents.reannounce).toHaveBeenCalledWith('server-1', ['abc123']);
      });

      it('shows a danger toast when reannouncing fails', async () => {
        qbTorrents.reannounce.mockRejectedValueOnce(new Error('boom'));

        await component.forceReannounce();

        expect(toastDanger).toHaveBeenCalledWith(
          'boom',
          'components.modals.torrent-details.general.toast.reannounce-failed',
        );
      });
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
