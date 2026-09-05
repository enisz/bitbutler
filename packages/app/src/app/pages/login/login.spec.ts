import { NO_ERRORS_SCHEMA, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { Router } from '@angular/router';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { TranslateService } from '@ngx-translate/core';
import { of } from 'rxjs';
import { CommandBusService } from '../../services/command-bus.service';
import { ElectronService } from '../../services/electron.service';
import { GeneralSettingsService } from '../../services/general-settings.service';
import { QbService } from '../../services/qb.service';
import { ServerStoreService } from '../../services/server-store.service';
import { ServerService } from '../../services/server.service';
import { ThemeService } from '../../services/theme.service';
import { ToastService } from '../../services/toast.service';
import { WindowService } from '../../services/window.service';
import { mockTranslateService } from '../../test-utils/translate.mock';
import { Login } from './login';

describe('Login', () => {
  let component: Login;
  let fixture: ComponentFixture<Login>;

  let serverStoreMock: {
    servers: ReturnType<typeof signal<any[]>>;
    loading: ReturnType<typeof signal<boolean>>;
    currentServerId: ReturnType<typeof signal<string | null>>;
    currentServer: ReturnType<typeof signal<any>>;
    refresh: ReturnType<typeof vi.fn>;
    select: ReturnType<typeof vi.fn>;
    isAutoLoginSuppressed: ReturnType<typeof vi.fn>;
    clearAutoLoginSuppression: ReturnType<typeof vi.fn>;
  };
  let themeMock: {
    family: ReturnType<typeof signal<string>>;
    mode: ReturnType<typeof signal<string>>;
    effectiveMode: ReturnType<typeof signal<'light' | 'dark'>>;
    setFamily: ReturnType<typeof vi.fn>;
    setMode: ReturnType<typeof vi.fn>;
  };
  let translateMock: ReturnType<typeof mockTranslateService>;
  let generalSettingsMock: { load: ReturnType<typeof vi.fn>; save: ReturnType<typeof vi.fn> };
  let electronMock: {
    getBitButlerVersion: ReturnType<typeof vi.fn>;
    goToRelease: ReturnType<typeof vi.fn>;
  };
  let modalMock: { open: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    serverStoreMock = {
      servers: signal([]),
      loading: signal(false),
      currentServerId: signal(null),
      currentServer: signal(null),
      refresh: vi.fn().mockResolvedValue(undefined),
      select: vi.fn(),
      isAutoLoginSuppressed: vi.fn().mockReturnValue(false),
      clearAutoLoginSuppression: vi.fn(),
    };
    themeMock = {
      family: signal('bitbutler'),
      mode: signal('system'),
      effectiveMode: signal<'light' | 'dark'>('dark'),
      setFamily: vi.fn(),
      setMode: vi.fn(),
    };
    translateMock = mockTranslateService();
    translateMock.get.mockImplementation((key: string) => of(key));
    generalSettingsMock = {
      load: vi.fn().mockResolvedValue({ language: { language: 'us' } }),
      save: vi.fn().mockResolvedValue(undefined),
    };
    electronMock = {
      getBitButlerVersion: vi.fn().mockReturnValue('1.0.0'),
      goToRelease: vi.fn(),
    };
    const rejectedResult = Promise.reject<void>(undefined);
    rejectedResult.catch(() => {});
    modalMock = {
      open: vi
        .fn()
        .mockReturnValue({ componentInstance: {}, close: vi.fn(), result: rejectedResult }),
    };

    await TestBed.configureTestingModule({
      imports: [Login],
      providers: [
        { provide: ServerStoreService, useValue: serverStoreMock },
        { provide: ServerService, useValue: { update: vi.fn().mockResolvedValue(undefined) } },
        { provide: ThemeService, useValue: themeMock },
        { provide: TranslateService, useValue: translateMock },
        { provide: GeneralSettingsService, useValue: generalSettingsMock },
        { provide: ToastService, useValue: { danger: vi.fn() } },
        { provide: ElectronService, useValue: electronMock },
        { provide: CommandBusService, useValue: { emit: vi.fn() } },
        { provide: Router, useValue: { navigate: vi.fn() } },
        { provide: NgbModal, useValue: modalMock },
        {
          provide: QbService,
          useValue: { auth: { login: vi.fn().mockResolvedValue({ loggedIn: false }) } },
        },
        {
          provide: WindowService,
          useValue: {
            setOpenFilesEnabled: vi.fn().mockResolvedValue(undefined),
            maximize: vi.fn(),
          },
        },
      ],
      schemas: [NO_ERRORS_SCHEMA],
    }).compileComponents();

    fixture = TestBed.createComponent(Login);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('trackByFn', () => {
    it('should return item id when present', () => {
      expect(component.trackByFn(0, { id: 'abc' } as any)).toBe('abc');
    });

    it('should return the index when item id is absent', () => {
      expect(component.trackByFn(5, {} as any)).toBe(5);
    });

    it('should return the index when item is null', () => {
      expect(component.trackByFn(3, null as any)).toBe(3);
    });
  });

  describe('canConnect', () => {
    it('should return false when loading', () => {
      serverStoreMock.loading.set(true);
      serverStoreMock.servers.set([{ id: '1' }] as any);
      expect(component.canConnect()).toBe(false);
    });

    it('should return false when the server list is empty', () => {
      serverStoreMock.loading.set(false);
      serverStoreMock.servers.set([]);
      expect(component.canConnect()).toBe(false);
    });

    it('should return true when not loading and servers exist', () => {
      serverStoreMock.loading.set(false);
      serverStoreMock.servers.set([{ id: '1' }] as any);
      expect(component.canConnect()).toBe(true);
    });
  });

  describe('families', () => {
    it('should expose the shared THEME_FAMILIES list', () => {
      expect(component.families).toHaveLength(8);
      expect(component.families[0]).toEqual({ value: 'bitbutler', label: 'BitButler' });
    });
  });

  describe('languages', () => {
    it('should list the available languages', () => {
      expect(component.languages().map((l) => l.value)).toEqual(['us', 'hu']);
    });
  });

  describe('modes', () => {
    it('should list the available theme modes', () => {
      expect(component.modes().map((m) => m.value)).toEqual(['light', 'dark', 'system']);
    });
  });

  describe('currentFamily', () => {
    it('should reflect the active theme family', () => {
      themeMock.family.set('aurora');
      expect(component.currentFamily()).toBe('aurora');
    });
  });

  describe('currentMode', () => {
    it('should reflect the active theme mode', () => {
      themeMock.mode.set('dark');
      expect(component.currentMode()).toBe('dark');
    });
  });

  describe('currentLang', () => {
    it('should reflect the active language', () => {
      translateMock.getCurrentLang.mockReturnValue('hu');
      translateMock.onLangChange.next({ lang: 'hu', translations: {} });
      expect(component.currentLang()).toBe('hu');
    });
  });

  describe('setFamily', () => {
    it('should delegate to themeService.setFamily', () => {
      component.setFamily('aurora');
      expect(themeMock.setFamily).toHaveBeenCalledWith('aurora');
    });
  });

  describe('setMode', () => {
    it('should delegate to themeService.setMode', () => {
      component.setMode('dark');
      expect(themeMock.setMode).toHaveBeenCalledWith('dark');
    });
  });

  describe('setLanguage', () => {
    it('should do nothing when the language is already active', async () => {
      translateMock.getCurrentLang.mockReturnValue('us');
      await component.setLanguage('us');
      expect(generalSettingsMock.load).not.toHaveBeenCalled();
      expect(translateMock.use).not.toHaveBeenCalled();
    });

    it('should persist and switch the language when it changes', async () => {
      translateMock.getCurrentLang.mockReturnValue('us');
      await component.setLanguage('hu');
      expect(generalSettingsMock.save).toHaveBeenCalledWith({ language: { language: 'hu' } });
      expect(translateMock.use).toHaveBeenCalledWith('hu');
    });
  });

  describe('quick settings toolbar', () => {
    it('should render three icon-only quick-setting buttons', () => {
      const buttons = fixture.debugElement.queryAll(By.css('.bb-quick-setting'));
      expect(buttons.length).toBe(3);
    });

    it('should label each quick-setting button for accessibility', () => {
      const buttons = fixture.debugElement.queryAll(By.css('.bb-quick-setting'));
      for (const button of buttons) {
        expect(button.attributes['aria-label']).toBeTruthy();
      }
    });
  });

  describe('empty state', () => {
    it('should hide the host form and show the add-server CTA when there are no servers', () => {
      serverStoreMock.servers.set([]);
      fixture.detectChanges();

      expect(fixture.debugElement.query(By.css('#server'))).toBeNull();
      expect(fixture.debugElement.query(By.css('.add-server-cta'))).not.toBeNull();
    });

    it('should show the host form and hide the add-server CTA when a server exists', () => {
      serverStoreMock.servers.set([{ id: '1', name: 'Local' }] as any);
      fixture.detectChanges();

      expect(fixture.debugElement.query(By.css('#server'))).not.toBeNull();
      expect(fixture.debugElement.query(By.css('.add-server-cta'))).toBeNull();
    });

    it('should call addNewServer when the add-server CTA is clicked', () => {
      serverStoreMock.servers.set([]);
      fixture.detectChanges();
      const addSpy = vi.spyOn(component, 'addNewServer').mockResolvedValue(undefined);

      fixture.debugElement.query(By.css('.add-server-cta')).nativeElement.click();

      expect(addSpy).toHaveBeenCalled();
    });

    it('should show the get-started subtitle when there are no servers', () => {
      serverStoreMock.servers.set([]);
      fixture.detectChanges();

      expect(fixture.nativeElement.textContent).toContain('pages.login.form-subtitle-empty');
    });

    it('should show the default subtitle when a server exists', () => {
      serverStoreMock.servers.set([{ id: '1', name: 'Local' }] as any);
      fixture.detectChanges();

      expect(fixture.nativeElement.textContent).toContain('pages.login.form-subtitle');
      expect(fixture.nativeElement.textContent).not.toContain('pages.login.form-subtitle-empty');
    });
  });

  describe('goToRelease', () => {
    it('should delegate to electronService.goToRelease', () => {
      component.goToRelease();
      expect(electronMock.goToRelease).toHaveBeenCalled();
    });
  });

  describe('openManageServers', () => {
    it('should open the ManageServers modal', async () => {
      await component.openManageServers();
      expect(modalMock.open).toHaveBeenCalledWith(expect.anything());
    });

    it('should set hideConnect to true on the opened modal', async () => {
      const componentInstance: Record<string, unknown> = {};
      const mockRef = {
        componentInstance,
        _contentRef: {
          componentRef: {
            setInput: vi.fn((name: string, value: unknown) => {
              componentInstance[name] = value;
            }),
          },
        },
      };
      modalMock.open.mockReturnValue(mockRef);
      await component.openManageServers();
      expect(componentInstance['hideConnect']).toBe(true);
    });
  });

  describe('hasServers', () => {
    it('should be false when there are no servers', () => {
      serverStoreMock.servers.set([]);
      expect(component.hasServers()).toBe(false);
    });

    it('should be true when at least one server exists', () => {
      serverStoreMock.servers.set([{ id: '1' }] as any);
      expect(component.hasServers()).toBe(true);
    });
  });

  describe('addNewServer', () => {
    it('should open the ServerEditor modal in add mode', async () => {
      await component.addNewServer();
      expect(modalMock.open).toHaveBeenCalledWith(expect.anything(), { size: 'lg' });
    });

    it('should emit SERVER_ADDED with the new id when the editor resolves', async () => {
      const commandBus = TestBed.inject(CommandBusService) as any;
      modalMock.open.mockReturnValue({ componentInstance: {}, result: Promise.resolve('new-id') });

      await component.addNewServer();

      expect(commandBus.emit).toHaveBeenCalledWith({ type: 'SERVER_ADDED', id: 'new-id' });
    });

    it('should not emit anything when the editor is dismissed', async () => {
      const commandBus = TestBed.inject(CommandBusService) as any;
      const dismissed = Promise.reject<string>(undefined);
      dismissed.catch(() => {});
      modalMock.open.mockReturnValue({ componentInstance: {}, result: dismissed });

      await component.addNewServer();

      expect(commandBus.emit).not.toHaveBeenCalled();
    });

    it('should ignore a second call while a modal is already open', async () => {
      let resolveResult!: (id: string) => void;
      const pending = new Promise<string>((resolve) => {
        resolveResult = resolve;
      });
      modalMock.open.mockReturnValue({ componentInstance: {}, result: pending });

      const first = component.addNewServer();
      const second = component.addNewServer();

      resolveResult('new-id');
      await Promise.all([first, second]);

      expect(modalMock.open).toHaveBeenCalledTimes(1);
    });
  });

  describe('connect', () => {
    let qbServiceMock: { login: ReturnType<typeof vi.fn> };

    beforeEach(() => {
      qbServiceMock = (TestBed.inject(QbService) as any).auth;
    });

    function setCurrentServer(overrides: Record<string, unknown> = {}) {
      serverStoreMock.currentServer.set({
        id: 'srv-1',
        name: 'Local',
        host: 'localhost',
        protocol: 'http',
        port: 8080,
        username: 'admin',
        has_password: true,
        export_available: null,
        webapi_version: null,
        qb_version: null,
        ...overrides,
      });
    }

    it('probes connection info and persists the result when cached fields are null', async () => {
      setCurrentServer({ export_available: null, webapi_version: null, qb_version: null });
      qbServiceMock.login.mockResolvedValue({ loggedIn: true });
      const getServerInfo = vi
        .spyOn(window.bitbutler.export, 'getServerInfo')
        .mockResolvedValue({ webapiVersion: '2.9.3', qbVersion: '4.6.0', isFullMode: true });
      const setConnectionInfo = vi
        .spyOn(window.bitbutler.server, 'setConnectionInfo')
        .mockResolvedValue({ updated: true });

      await component.connect();

      expect(getServerInfo).toHaveBeenCalledWith('srv-1');
      expect(setConnectionInfo).toHaveBeenCalledWith({
        id: 'srv-1',
        exportAvailable: 1,
        webapiVersion: '2.9.3',
        qbVersion: '4.6.0',
      });
    });

    it('persists exportAvailable 0 when isFullMode is false', async () => {
      setCurrentServer({ export_available: null, webapi_version: null, qb_version: null });
      qbServiceMock.login.mockResolvedValue({ loggedIn: true });
      vi.spyOn(window.bitbutler.export, 'getServerInfo').mockResolvedValue({
        webapiVersion: '2.8.3',
        qbVersion: '4.5.0',
        isFullMode: false,
      });
      const setConnectionInfo = vi
        .spyOn(window.bitbutler.server, 'setConnectionInfo')
        .mockResolvedValue({ updated: true });

      await component.connect();

      expect(setConnectionInfo).toHaveBeenCalledWith({
        id: 'srv-1',
        exportAvailable: 0,
        webapiVersion: '2.8.3',
        qbVersion: '4.5.0',
      });
    });

    it('does not probe when all cached fields are already resolved', async () => {
      setCurrentServer({ export_available: 1, webapi_version: '2.9.3', qb_version: '4.6.0' });
      qbServiceMock.login.mockResolvedValue({ loggedIn: true });
      const getServerInfo = vi.spyOn(window.bitbutler.export, 'getServerInfo');

      await component.connect();

      expect(getServerInfo).not.toHaveBeenCalled();
    });

    it('probes when export_available is resolved but a version field is still null', async () => {
      setCurrentServer({ export_available: 1, webapi_version: null, qb_version: '4.6.0' });
      qbServiceMock.login.mockResolvedValue({ loggedIn: true });
      const getServerInfo = vi
        .spyOn(window.bitbutler.export, 'getServerInfo')
        .mockResolvedValue({ webapiVersion: '2.9.3', qbVersion: '4.6.0', isFullMode: true });

      await component.connect();

      expect(getServerInfo).toHaveBeenCalledWith('srv-1');
    });

    it('does not block login when the probe throws', async () => {
      setCurrentServer({ export_available: null, webapi_version: null, qb_version: null });
      qbServiceMock.login.mockResolvedValue({ loggedIn: true });
      vi.spyOn(window.bitbutler.export, 'getServerInfo').mockRejectedValue(
        new Error('network error'),
      );
      const router = TestBed.inject(Router) as any;

      await component.connect();

      expect(router.navigate).toHaveBeenCalledWith(['/pages/torrent-list']);
    });

    it('navigates to the torrent list when no landing page setting is stored', async () => {
      setCurrentServer({ export_available: 1, webapi_version: '2.9.3', qb_version: '4.6.0' });
      qbServiceMock.login.mockResolvedValue({ loggedIn: true });
      const router = TestBed.inject(Router) as any;

      await component.connect();

      expect(router.navigate).toHaveBeenCalledWith(['/pages/torrent-list']);
    });

    it('navigates to the dashboard when the landing page setting is dashboard', async () => {
      setCurrentServer({ export_available: 1, webapi_version: '2.9.3', qb_version: '4.6.0' });
      qbServiceMock.login.mockResolvedValue({ loggedIn: true });
      generalSettingsMock.load.mockResolvedValue({ startup: { landingPage: 'dashboard' } });
      const router = TestBed.inject(Router) as any;

      await component.connect();

      expect(router.navigate).toHaveBeenCalledWith(['/pages/dashboard']);
    });

    it('does not probe when login did not succeed', async () => {
      setCurrentServer({ export_available: null, webapi_version: null, qb_version: null });
      qbServiceMock.login.mockResolvedValue({ loggedIn: false });
      const getServerInfo = vi.spyOn(window.bitbutler.export, 'getServerInfo');

      await component.connect();

      expect(getServerInfo).not.toHaveBeenCalled();
    });

    it('logs the error and shows the connection-failed toast when login rejects', async () => {
      setCurrentServer({ export_available: null });
      qbServiceMock.login.mockRejectedValue(new Error('ECONNREFUSED'));
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const toastServiceMock = TestBed.inject(ToastService) as any;

      await component.connect();

      expect(errorSpy).toHaveBeenCalledWith(Login.name, 'connect', expect.any(Error));
      expect(toastServiceMock.danger).toHaveBeenCalledWith('ECONNREFUSED', '');
      expect(translateMock.instant).toHaveBeenCalledWith('pages.login.error.connection-failed');
    });

    describe('missing credentials', () => {
      function credentialModalRef(result: Promise<unknown>) {
        const componentInstance: Record<string, unknown> = {};
        return {
          componentInstance,
          result,
          _contentRef: {
            componentRef: {
              setInput: vi.fn((name: string, value: unknown) => {
                componentInstance[name] = value;
              }),
            },
          },
        };
      }

      it('opens the credential prompt when username or password is missing', async () => {
        setCurrentServer({ username: '', has_password: false });
        const cancelled = Promise.reject(undefined);
        cancelled.catch(() => {});
        const modalRef = credentialModalRef(cancelled);
        modalMock.open.mockReturnValue(modalRef);

        await component.connect();

        expect(modalMock.open).toHaveBeenCalled();
        expect(modalRef.componentInstance['serverName']).toBe('Local');
        expect(qbServiceMock.login).not.toHaveBeenCalled();
      });

      it('persists credentials and logs in with no runtime args when the prompt saves', async () => {
        setCurrentServer({ username: '', has_password: false });
        qbServiceMock.login.mockResolvedValue({ loggedIn: true });
        modalMock.open.mockReturnValueOnce(
          credentialModalRef(
            Promise.resolve({ username: 'admin', password: 'secret', save: true }),
          ),
        );
        const serverServiceMock = TestBed.inject(ServerService) as any;

        await component.connect();

        expect(serverServiceMock.update).toHaveBeenCalledWith('srv-1', {
          username: 'admin',
          password: 'secret',
        });
        expect(qbServiceMock.login).toHaveBeenCalledWith('srv-1', undefined, undefined);
      });

      it('logs in with the entered credentials without persisting when the prompt does not save', async () => {
        setCurrentServer({ username: '', has_password: false });
        qbServiceMock.login.mockResolvedValue({ loggedIn: true });
        modalMock.open.mockReturnValueOnce(
          credentialModalRef(
            Promise.resolve({ username: 'admin', password: 'secret', save: false }),
          ),
        );
        const serverServiceMock = TestBed.inject(ServerService) as any;

        await component.connect();

        expect(serverServiceMock.update).not.toHaveBeenCalled();
        expect(qbServiceMock.login).toHaveBeenCalledWith('srv-1', 'admin', 'secret');
      });

      it('shows the connection-failed toast and does not proceed when persisting credentials fails', async () => {
        setCurrentServer({ username: '', has_password: false });
        modalMock.open.mockReturnValueOnce(
          credentialModalRef(
            Promise.resolve({ username: 'admin', password: 'secret', save: true }),
          ),
        );
        const serverServiceMock = TestBed.inject(ServerService) as any;
        serverServiceMock.update.mockRejectedValueOnce(new Error('IPC failure'));
        const toastServiceMock = TestBed.inject(ToastService) as any;

        await expect(component.connect()).resolves.toBeUndefined();

        expect(toastServiceMock.danger).toHaveBeenCalledWith('IPC failure', '');
        expect(translateMock.instant).toHaveBeenCalledWith('pages.login.error.connection-failed');
        expect(qbServiceMock.login).not.toHaveBeenCalled();
      });
    });
  });
});
