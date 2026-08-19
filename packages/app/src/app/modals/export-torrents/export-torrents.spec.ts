import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { TranslateModule } from '@ngx-translate/core';
import { ExportService } from '../../services/export.service';
import { FilterService } from '../../services/filter.service';
import { SelectionStoreService } from '../../services/selection-store.service';
import { ServerStoreService } from '../../services/server-store.service';
import { TorrentStoreService } from '../../services/torrent-store.service';
import { ExportTorrents } from './export-torrents';

describe('ExportTorrents', () => {
  let component: ExportTorrents;
  let fixture: ComponentFixture<ExportTorrents>;
  let serverStoreMock: {
    currentServer: ReturnType<typeof signal<any>>;
    refresh: ReturnType<typeof vi.fn>;
  };

  function createFixture(): void {
    fixture = TestBed.createComponent(ExportTorrents);
    component = fixture.componentInstance;
  }

  beforeEach(async () => {
    serverStoreMock = {
      currentServer: signal(null),
      refresh: vi.fn().mockResolvedValue(undefined),
    };

    await TestBed.configureTestingModule({
      imports: [ExportTorrents, TranslateModule.forRoot()],
      providers: [
        { provide: NgbActiveModal, useValue: { dismiss: vi.fn() } },
        {
          provide: ExportService,
          useValue: {
            exportPhase: signal('idle'),
            exportState: signal({ phase: 'idle', current: 0, total: 0, name: '', skipped: 0 }),
            startExport: vi.fn(),
            resetExport: vi.fn(),
          },
        },
        { provide: FilterService, useValue: { filtered: signal([]) } },
        { provide: SelectionStoreService, useValue: { selected: signal([]) } },
        {
          provide: TorrentStoreService,
          useValue: {
            torrents: signal([]),
            categoriesMap: signal(new Map()),
            tagsSet: signal(new Set()),
          },
        },
        { provide: ServerStoreService, useValue: serverStoreMock },
      ],
    }).compileComponents();

    createFixture();
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should default scope to all', () => {
    expect(component.exportForm.get('scope')?.value).toBe('all');
  });

  it('should compute hasSelection as false when selected is empty', () => {
    expect(component.hasSelection()).toBe(false);
  });

  describe('connection info', () => {
    function setCurrentServer(overrides: Record<string, unknown> = {}) {
      serverStoreMock.currentServer.set({
        id: 'srv-1',
        name: 'Local',
        host: 'localhost',
        protocol: 'http',
        port: 8080,
        export_available: null,
        webapi_version: null,
        qb_version: null,
        ...overrides,
      });
    }

    it('reads cached values synchronously, without an async call, when all fields are cached', () => {
      setCurrentServer({ export_available: 1, webapi_version: '2.9.3', qb_version: '4.6.0' });
      const getServerInfo = vi.spyOn(window.bitbutler.export, 'getServerInfo');

      createFixture();
      fixture.detectChanges();

      expect(getServerInfo).not.toHaveBeenCalled();
      expect(component.serverInfoLoading()).toBe(false);
      expect(component.serverInfo()).toEqual({
        webapiVersion: '2.9.3',
        qbVersion: '4.6.0',
        isFullMode: true,
      });
    });

    it('falls back to a live fetch and shows a loading state when a cached field is null', async () => {
      setCurrentServer({ export_available: null, webapi_version: null, qb_version: null });
      let resolveInfo!: (v: {
        webapiVersion: string;
        qbVersion: string;
        isFullMode: boolean;
      }) => void;
      const pending = new Promise<{
        webapiVersion: string;
        qbVersion: string;
        isFullMode: boolean;
      }>((resolve) => {
        resolveInfo = resolve;
      });
      vi.spyOn(window.bitbutler.export, 'getServerInfo').mockReturnValue(pending);

      createFixture();
      fixture.detectChanges();

      expect(component.serverInfoLoading()).toBe(true);

      resolveInfo({ webapiVersion: '2.9.3', qbVersion: '4.6.0', isFullMode: true });
      await pending;
      await Promise.resolve();

      expect(component.serverInfoLoading()).toBe(false);
      expect(component.serverInfo()).toEqual({
        webapiVersion: '2.9.3',
        qbVersion: '4.6.0',
        isFullMode: true,
      });
    });

    it('persists a successful live fallback fetch in the background to self-heal the cache', async () => {
      setCurrentServer({ export_available: null, webapi_version: null, qb_version: null });
      vi.spyOn(window.bitbutler.export, 'getServerInfo').mockResolvedValue({
        webapiVersion: '2.9.3',
        qbVersion: '4.6.0',
        isFullMode: true,
      });
      const setConnectionInfo = vi
        .spyOn(window.bitbutler.server, 'setConnectionInfo')
        .mockResolvedValue({ updated: true });

      createFixture();
      fixture.detectChanges();
      await vi.waitFor(() => expect(serverStoreMock.refresh).toHaveBeenCalled());

      expect(setConnectionInfo).toHaveBeenCalledWith({
        id: 'srv-1',
        exportAvailable: 1,
        webapiVersion: '2.9.3',
        qbVersion: '4.6.0',
      });
    });

    it('shows an error when the live fallback fetch fails', async () => {
      setCurrentServer({ export_available: null, webapi_version: null, qb_version: null });
      vi.spyOn(window.bitbutler.export, 'getServerInfo').mockRejectedValue(
        new Error('connection refused'),
      );

      createFixture();
      fixture.detectChanges();
      await vi.waitFor(() => expect(component.serverInfoLoading()).toBe(false));

      expect(component.serverInfoError()).toBe('connection refused');
    });
  });
});
