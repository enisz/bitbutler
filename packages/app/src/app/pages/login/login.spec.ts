import { NO_ERRORS_SCHEMA, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { Router } from '@angular/router';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { TranslateService } from '@ngx-translate/core';
import { of } from 'rxjs';
import { ManageServers } from '../../components/modals/manage-servers/manage-servers';
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

  describe('logoUrl', () => {
    it('should build a URL from the current theme family', () => {
      themeMock.family.set('aurora');
      expect(component.logoUrl()).toBe('assets/images/bitbutler-logo-aurora.png');
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

  describe('getFamilyLogoUrl', () => {
    it('should build a logo URL for a given family', () => {
      expect(component.getFamilyLogoUrl('aurora')).toBe('assets/images/bitbutler-logo-aurora.png');
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

  describe('goToRelease', () => {
    it('should delegate to electronService.goToRelease', () => {
      component.goToRelease();
      expect(electronMock.goToRelease).toHaveBeenCalled();
    });
  });

  describe('openManageServers', () => {
    it('should open the ManageServers modal', () => {
      component.openManageServers();
      expect(modalMock.open).toHaveBeenCalledWith(ManageServers);
    });

    it('should set hideConnect to true on the opened modal', () => {
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
      component.openManageServers();
      expect(componentInstance['hideConnect']).toBe(true);
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
        ...overrides,
      });
    }

    it('probes availability and persists the result when export_available is null', async () => {
      setCurrentServer({ export_available: null });
      qbServiceMock.login.mockResolvedValue({ loggedIn: true });
      const checkAvailability = vi
        .spyOn(window.bitbutler.export, 'checkAvailability')
        .mockResolvedValue({ available: true });
      const setExportAvailable = vi
        .spyOn(window.bitbutler.server, 'setExportAvailable')
        .mockResolvedValue({ updated: true });

      await component.connect();

      expect(checkAvailability).toHaveBeenCalledWith('srv-1');
      expect(setExportAvailable).toHaveBeenCalledWith({ id: 'srv-1', value: 1 });
    });

    it('persists 0 when the probe reports unavailable', async () => {
      setCurrentServer({ export_available: null });
      qbServiceMock.login.mockResolvedValue({ loggedIn: true });
      vi.spyOn(window.bitbutler.export, 'checkAvailability').mockResolvedValue({
        available: false,
      });
      const setExportAvailable = vi
        .spyOn(window.bitbutler.server, 'setExportAvailable')
        .mockResolvedValue({ updated: true });

      await component.connect();

      expect(setExportAvailable).toHaveBeenCalledWith({ id: 'srv-1', value: 0 });
    });

    it('does not probe when export_available is already resolved', async () => {
      setCurrentServer({ export_available: 1 });
      qbServiceMock.login.mockResolvedValue({ loggedIn: true });
      const checkAvailability = vi.spyOn(window.bitbutler.export, 'checkAvailability');

      await component.connect();

      expect(checkAvailability).not.toHaveBeenCalled();
    });

    it('does not block login when the probe throws', async () => {
      setCurrentServer({ export_available: null });
      qbServiceMock.login.mockResolvedValue({ loggedIn: true });
      vi.spyOn(window.bitbutler.export, 'checkAvailability').mockRejectedValue(
        new Error('network error'),
      );
      const router = TestBed.inject(Router) as any;

      await component.connect();

      expect(router.navigate).toHaveBeenCalledWith(['/pages/main']);
    });

    it('does not probe when login did not succeed', async () => {
      setCurrentServer({ export_available: null });
      qbServiceMock.login.mockResolvedValue({ loggedIn: false });
      const checkAvailability = vi.spyOn(window.bitbutler.export, 'checkAvailability');

      await component.connect();

      expect(checkAvailability).not.toHaveBeenCalled();
    });
  });
});
