import { NO_ERRORS_SCHEMA, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Subject } from 'rxjs';
import { QbPollingService } from '../../services/qb-polling.service';
import { ServerStoreService } from '../../services/server-store.service';
import { ThemeService } from '../../services/theme.service';
import { TorrentStoreService } from '../../services/torrent-store.service';
import { Main } from './main';

describe('Main', () => {
  let component: Main;
  let fixture: ComponentFixture<Main>;

  let themeMock: {
    family: ReturnType<typeof signal<string>>;
    effectiveMode: ReturnType<typeof signal<'dark' | 'light'>>;
  };
  let serverStoreMock: {
    currentServer: ReturnType<typeof signal<any>>;
    currentServerId: ReturnType<typeof signal<string | null>>;
    refresh: ReturnType<typeof vi.fn>;
  };

  beforeAll(() => {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });
  });

  let torrentStoreMock: {
    applyMaindata: ReturnType<typeof vi.fn>;
    clear: ReturnType<typeof vi.fn>;
  };

  let qbPollingMock: {
    startMaindataPolling: ReturnType<typeof vi.fn>;
  };

  async function createComponent(): Promise<void> {
    await TestBed.configureTestingModule({
      imports: [Main],
      providers: [
        { provide: ThemeService, useValue: themeMock },
        { provide: ServerStoreService, useValue: serverStoreMock },
        { provide: QbPollingService, useValue: qbPollingMock },
        { provide: TorrentStoreService, useValue: torrentStoreMock },
      ],
      schemas: [NO_ERRORS_SCHEMA],
    })
      .overrideComponent(Main, { set: { imports: [], schemas: [NO_ERRORS_SCHEMA] } })
      .compileComponents();

    fixture = TestBed.createComponent(Main);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }

  beforeEach(() => {
    themeMock = {
      family: signal('bitbutler'),
      effectiveMode: signal<'dark' | 'light'>('dark'),
    };
    serverStoreMock = {
      currentServer: signal(null),
      currentServerId: signal(null),
      refresh: vi.fn().mockResolvedValue(undefined),
    };
    torrentStoreMock = {
      applyMaindata: vi.fn(),
      clear: vi.fn(),
    };
    qbPollingMock = {
      startMaindataPolling: vi.fn().mockReturnValue(new Subject()),
    };
  });

  it('should create', async () => {
    await createComponent();
    expect(component).toBeTruthy();
  });

  describe('theme', () => {
    it('should be the effectiveMode signal from ThemeService', async () => {
      await createComponent();
      expect(component.theme).toBe(themeMock.effectiveMode);
    });
  });

  describe('currentServer', () => {
    it('should be the currentServer signal from ServerStoreService', async () => {
      await createComponent();
      expect(component.currentServer).toBe(serverStoreMock.currentServer);
    });
  });

  describe('serverState', () => {
    it('should be null initially', async () => {
      await createComponent();
      expect(component.serverState()).toBeNull();
    });
  });

  describe('polling', () => {
    it('should start polling the new server on switch', async () => {
      await createComponent();
      expect(qbPollingMock.startMaindataPolling).not.toHaveBeenCalled();

      serverStoreMock.currentServerId.set('server-1');
      fixture.detectChanges();

      expect(qbPollingMock.startMaindataPolling).toHaveBeenCalledWith('server-1');
    });

    it('should start polling again on a subsequent switch to another server', async () => {
      await createComponent();

      serverStoreMock.currentServerId.set('server-1');
      fixture.detectChanges();

      serverStoreMock.currentServerId.set('server-2');
      fixture.detectChanges();

      expect(qbPollingMock.startMaindataPolling).toHaveBeenCalledTimes(2);
      expect(qbPollingMock.startMaindataPolling).toHaveBeenLastCalledWith('server-2');
    });

    // Clearing the store on a fresh start (vs. resuming the same server) is QbPollingService's
    // call, not Main's - it is the only thing that knows whether a restart is a genuine reset
    // or a same-server resume. See QbPollingService's own spec for that coverage.
    it('should never clear the torrent store itself', async () => {
      await createComponent();

      serverStoreMock.currentServerId.set('server-1');
      fixture.detectChanges();

      serverStoreMock.currentServerId.set('server-2');
      fixture.detectChanges();

      expect(torrentStoreMock.clear).not.toHaveBeenCalled();
    });
  });
});
