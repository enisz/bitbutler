import { NO_ERRORS_SCHEMA, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Subject } from 'rxjs';
import { QbPollingService } from '../../services/qb-polling.service';
import { ServerStoreService } from '../../services/server-store.service';
import { SidebarSettingsService } from '../../services/sidebar-settings.service';
import { ThemeService } from '../../services/theme.service';
import { TorrentStoreService } from '../../services/torrent-store.service';
import { ViewportService } from '../../services/viewport.service';
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

  let viewportMock: {
    isPhone: ReturnType<typeof signal<boolean>>;
    isTablet: ReturnType<typeof signal<boolean>>;
  };

  let qbPollingMock: {
    startMaindataPolling: ReturnType<typeof vi.fn>;
    linkState: ReturnType<typeof signal<'connected' | 'reconnecting'>>;
  };

  async function createComponent(): Promise<void> {
    await TestBed.configureTestingModule({
      imports: [Main],
      providers: [
        { provide: ThemeService, useValue: themeMock },
        { provide: ServerStoreService, useValue: serverStoreMock },
        { provide: QbPollingService, useValue: qbPollingMock },
        { provide: TorrentStoreService, useValue: torrentStoreMock },
        { provide: ViewportService, useValue: viewportMock },
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
    viewportMock = { isPhone: signal(false), isTablet: signal(false) };
    qbPollingMock = {
      startMaindataPolling: vi.fn().mockReturnValue(new Subject()),
      linkState: signal<'connected' | 'reconnecting'>('connected'),
    };
  });

  it('should create', async () => {
    await createComponent();
    expect(component).toBeTruthy();
  });

  describe('layout', () => {
    it('renders the grid and toolbar and not the phone shell on wide screens', async () => {
      await createComponent();
      const el = fixture.nativeElement as HTMLElement;
      expect(el.querySelector('app-grid')).not.toBeNull();
      expect(el.querySelector('app-button-bar')).not.toBeNull();
      expect(el.querySelector('app-phone-main')).toBeNull();
    });

    it('renders only the phone shell on phone screens', async () => {
      viewportMock.isPhone.set(true);
      await createComponent();
      const el = fixture.nativeElement as HTMLElement;
      expect(el.querySelector('app-phone-main')).not.toBeNull();
      expect(el.querySelector('app-grid')).toBeNull();
      expect(el.querySelector('app-button-bar')).toBeNull();
    });

    it('swaps back to the grid when the window grows again', async () => {
      viewportMock.isPhone.set(true);
      await createComponent();
      viewportMock.isPhone.set(false);
      fixture.detectChanges();
      const el = fixture.nativeElement as HTMLElement;
      expect(el.querySelector('app-grid')).not.toBeNull();
      expect(el.querySelector('app-phone-main')).toBeNull();
    });
  });

  describe('sidebar on tablet', () => {
    it('starts collapsed on tablet widths without touching the saved preference', async () => {
      viewportMock.isTablet.set(true);
      await createComponent();
      expect(component.sidebarCollapsed()).toBe(true);
    });

    it('expands temporarily on tablet without saving the preference', async () => {
      viewportMock.isTablet.set(true);
      await createComponent();
      const save = vi.spyOn(TestBed.inject(SidebarSettingsService), 'save');
      component.toggleSidebar();
      expect(component.sidebarCollapsed()).toBe(false);
      expect(save).not.toHaveBeenCalled();
      component.toggleSidebar();
      expect(component.sidebarCollapsed()).toBe(true);
    });

    it('keeps using the saved preference on desktop', async () => {
      await createComponent();
      expect(component.sidebarCollapsed()).toBe(false);
      const save = vi.spyOn(TestBed.inject(SidebarSettingsService), 'save').mockResolvedValue();
      component.toggleSidebar();
      expect(save).toHaveBeenCalledWith(expect.objectContaining({ collapsed: true }));
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

    it('shows the link state in the dot while reconnecting, then qBittorrent status again', async () => {
      const poll$ = new Subject<any>();
      qbPollingMock.startMaindataPolling.mockReturnValue(poll$);
      serverStoreMock.currentServerId.set('server-1');
      await createComponent();
      poll$.next({ server_state: { connection_status: 'connected' } });
      expect(component.statusDotClass()).toBe('connected');

      qbPollingMock.linkState.set('reconnecting');
      expect(component.statusDotClass()).toBe('reconnecting');

      qbPollingMock.linkState.set('connected');
      expect(component.statusDotClass()).toBe('connected');
    });

    it('keeps the connection status when the page is recreated for the same server', async () => {
      const poll$ = new Subject<any>();
      qbPollingMock.startMaindataPolling.mockReturnValue(poll$);
      serverStoreMock.currentServerId.set('server-1');
      await createComponent();
      poll$.next({ server_state: { connection_status: 'connected' } });
      expect(component.connectionStatus()).toBe('connected');

      // Leaving for the settings pages destroys the page; coming back recreates it while
      // polling resumes without resending the unchanged connection status.
      fixture.destroy();
      fixture = TestBed.createComponent(Main);
      component = fixture.componentInstance;
      fixture.detectChanges();

      expect(component.connectionStatus()).toBe('connected');
    });

    it('forgets the connection status when another server is polled', async () => {
      const poll$ = new Subject<any>();
      qbPollingMock.startMaindataPolling.mockReturnValue(poll$);
      serverStoreMock.currentServerId.set('server-1');
      await createComponent();
      poll$.next({ server_state: { connection_status: 'connected' } });

      serverStoreMock.currentServerId.set('server-2');
      fixture.detectChanges();

      expect(component.connectionStatus()).toBe('offline');
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
