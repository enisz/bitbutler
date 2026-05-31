import { NO_ERRORS_SCHEMA, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Subject } from 'rxjs';
import { QbPollingService } from '../../services/qb-polling.service';
import { ServerStoreService } from '../../services/server-store.service';
import { ThemeService } from '../../services/theme.service';
import { TorrentListGridSettingsService } from '../../services/torrent-list-grid.settings.service';
import { TorrentStoreService } from '../../services/torrent-store.service';
import { WindowService } from '../../services/window.service';
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
  let windowMock: {
    maximize: ReturnType<typeof vi.fn>;
    state: ReturnType<typeof signal<{ isMinimized: boolean }>>;
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

  async function createComponent(): Promise<void> {
    await TestBed.configureTestingModule({
      imports: [Main],
      providers: [
        { provide: ThemeService, useValue: themeMock },
        { provide: ServerStoreService, useValue: serverStoreMock },
        {
          provide: QbPollingService,
          useValue: { startMaindataPolling: vi.fn().mockReturnValue(new Subject()) },
        },
        { provide: TorrentStoreService, useValue: { applyMaindata: vi.fn() } },
        { provide: WindowService, useValue: windowMock },
        {
          provide: TorrentListGridSettingsService,
          useValue: { asObservable: vi.fn().mockReturnValue(new Subject().asObservable()) },
        },
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
    windowMock = {
      maximize: vi.fn(),
      state: signal({ isMinimized: false }),
    };
  });

  it('should create', async () => {
    await createComponent();
    expect(component).toBeTruthy();
  });

  describe('maximize on login', () => {
    it('should call maximize when window is not minimized', async () => {
      windowMock.state.set({ isMinimized: false });
      await createComponent();
      expect(windowMock.maximize).toHaveBeenCalled();
    });

    it('should skip maximize when window is minimized (startMinimized mode)', async () => {
      windowMock.state.set({ isMinimized: true });
      await createComponent();
      expect(windowMock.maximize).not.toHaveBeenCalled();
    });
  });

  describe('logoUrl', () => {
    it('should build the URL from the current theme family', async () => {
      await createComponent();
      themeMock.family.set('aurora');
      expect(component.logoUrl()).toBe('assets/images/bitbutler-logo-aurora.png');
    });
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
});
