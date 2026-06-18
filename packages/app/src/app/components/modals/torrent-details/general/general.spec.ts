import { Clipboard } from '@angular/cdk/clipboard';
import { WritableSignal, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Subject, of } from 'rxjs';
import { QbLogEntry, QbLogMessageType } from '../../../../models/qbittorrent.model';
import { Torrent } from '../../../../models/torrent.model';
import { CommandBusService } from '../../../../services/command-bus.service';
import { GeneralSettingsService } from '../../../../services/general-settings.service';
import { PathService } from '../../../../services/path.service';
import { QbService } from '../../../../services/qb.service';
import { ServerStoreService } from '../../../../services/server-store.service';
import { ToastService } from '../../../../services/toast.service';
import { TorrentStoreService } from '../../../../services/torrent-store.service';
import { General } from './general';

const makeTorrent = (overrides: Partial<Torrent> = {}): Torrent =>
  ({
    name: 'My Torrent',
    hash: 'abc123',
    state: 'downloading',
    ...overrides,
  }) as Torrent;

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
});
