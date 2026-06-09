import { NO_ERRORS_SCHEMA, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { ManageServers } from '../../components/modals/manage-servers/manage-servers';
import { CommandBusService } from '../../services/command-bus.service';
import { ElectronService } from '../../services/electron.service';
import { QbService } from '../../services/qb.service';
import { ServerStoreService } from '../../services/server-store.service';
import { ServerService } from '../../services/server.service';
import { ThemeService } from '../../services/theme.service';
import { ToastService } from '../../services/toast.service';
import { WindowService } from '../../services/window.service';
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
    effectiveMode: ReturnType<typeof signal<'light' | 'dark'>>;
  };
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
    themeMock = { family: signal('bitbutler'), effectiveMode: signal<'light' | 'dark'>('dark') };
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
        { provide: ToastService, useValue: { danger: vi.fn() } },
        { provide: ElectronService, useValue: electronMock },
        { provide: CommandBusService, useValue: { emit: vi.fn() } },
        { provide: Router, useValue: { navigate: vi.fn() } },
        { provide: NgbModal, useValue: modalMock },
        {
          provide: QbService,
          useValue: { login: vi.fn().mockResolvedValue({ loggedIn: false }) },
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
});
