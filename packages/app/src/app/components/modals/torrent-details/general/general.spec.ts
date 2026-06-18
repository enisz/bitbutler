import { Clipboard } from '@angular/cdk/clipboard';
import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Subject, of } from 'rxjs';
import { QbLogEntry, QbLogMessageType } from '../../../../models/qbittorrent.model';
import { CommandBusService } from '../../../../services/command-bus.service';
import { GeneralSettingsService } from '../../../../services/general-settings.service';
import { PathService } from '../../../../services/path.service';
import { QbService } from '../../../../services/qb.service';
import { ServerStoreService } from '../../../../services/server-store.service';
import { ToastService } from '../../../../services/toast.service';
import { TorrentStoreService } from '../../../../services/torrent-store.service';
import { General } from './general';

describe('General', () => {
  let component: General;
  let fixture: ComponentFixture<General>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [General],
      providers: [
        { provide: ServerStoreService, useValue: { currentServerId: signal('server-1') } },
        {
          provide: TorrentStoreService,
          useValue: { torrentsMap: signal(new Map()) },
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
});
