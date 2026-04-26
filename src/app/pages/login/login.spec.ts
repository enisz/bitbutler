// src/app/pages/login/login.spec.ts
import { NO_ERRORS_SCHEMA, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { CommandBusService } from '../../services/command-bus.service';
import { ConfirmService } from '../../services/confirm.service';
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

  let commandBusMock: { emit: ReturnType<typeof vi.fn> };
  let confirmMock: { confirm: ReturnType<typeof vi.fn> };
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
  let serverServiceMock: { update: ReturnType<typeof vi.fn> };
  let themeMock: {
    family: ReturnType<typeof signal<string>>;
    effectiveMode: ReturnType<typeof signal<'light' | 'dark'>>;
  };
  let toastMock: { danger: ReturnType<typeof vi.fn>; success: ReturnType<typeof vi.fn> };
  let electronMock: {
    getBitButlerVersion: ReturnType<typeof vi.fn>;
    goToRelease: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    commandBusMock = { emit: vi.fn() };
    confirmMock = { confirm: vi.fn().mockResolvedValue(false) };
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
    serverServiceMock = { update: vi.fn().mockResolvedValue(undefined) };
    themeMock = { family: signal('bitbutler'), effectiveMode: signal<'light' | 'dark'>('dark') };
    toastMock = { danger: vi.fn(), success: vi.fn() };
    electronMock = {
      getBitButlerVersion: vi.fn().mockReturnValue('1.0.0'),
      goToRelease: vi.fn(),
    };

    await TestBed.configureTestingModule({
      imports: [Login],
      providers: [
        { provide: CommandBusService, useValue: commandBusMock },
        { provide: ConfirmService, useValue: confirmMock },
        { provide: ServerStoreService, useValue: serverStoreMock },
        { provide: ServerService, useValue: serverServiceMock },
        { provide: ThemeService, useValue: themeMock },
        { provide: ToastService, useValue: toastMock },
        { provide: ElectronService, useValue: electronMock },
        { provide: Router, useValue: { navigate: vi.fn() } },
        {
          provide: NgbModal,
          useValue: {
            open: vi.fn().mockReturnValue({ componentInstance: {}, close: vi.fn() }),
          },
        },
        {
          provide: QbService,
          useValue: { login: vi.fn().mockResolvedValue({ loggedIn: false }) },
        },
        {
          provide: WindowService,
          useValue: {
            setSize: vi.fn(),
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

  describe('addServer', () => {
    it('should emit UI_SERVER_EDITOR_OPEN', () => {
      component.addServer();
      expect(commandBusMock.emit).toHaveBeenCalledWith({ type: 'UI_SERVER_EDITOR_OPEN' });
    });
  });

  describe('editServer', () => {
    it('should emit UI_SERVER_EDITOR_OPEN with the server id', () => {
      component.editServer({ id: 'srv-1' } as any);
      expect(commandBusMock.emit).toHaveBeenCalledWith({
        type: 'UI_SERVER_EDITOR_OPEN',
        id: 'srv-1',
      });
    });
  });

  describe('deleteServer', () => {
    it('should emit SERVER_DELETED when the user confirms', async () => {
      confirmMock.confirm.mockResolvedValue(true);
      await component.deleteServer({ id: 'srv-1', name: 'My Server' } as any);
      expect(commandBusMock.emit).toHaveBeenCalledWith({ type: 'SERVER_DELETED', id: 'srv-1' });
    });

    it('should not emit when the user cancels', async () => {
      confirmMock.confirm.mockResolvedValue(false);
      await component.deleteServer({ id: 'srv-1', name: 'My Server' } as any);
      expect(commandBusMock.emit).not.toHaveBeenCalled();
    });
  });

  describe('goToRelease', () => {
    it('should delegate to electronService.goToRelease', () => {
      component.goToRelease();
      expect(electronMock.goToRelease).toHaveBeenCalled();
    });
  });

  describe('toggleAutoLogin', () => {
    it('should update auto_login to its inverse and emit SERVER_UPDATED', async () => {
      const event = { preventDefault: vi.fn(), stopPropagation: vi.fn() } as any;
      await component.toggleAutoLogin(event, {
        id: 'srv-1',
        name: 'S',
        auto_login: false,
      } as any);
      expect(serverServiceMock.update).toHaveBeenCalledWith('srv-1', { auto_login: true });
      expect(commandBusMock.emit).toHaveBeenCalledWith({ type: 'SERVER_UPDATED', id: 'srv-1' });
    });

    it('should suppress the event default and propagation', async () => {
      const event = { preventDefault: vi.fn(), stopPropagation: vi.fn() } as any;
      await component.toggleAutoLogin(event, {
        id: 'srv-1',
        name: 'S',
        auto_login: true,
      } as any);
      expect(event.preventDefault).toHaveBeenCalled();
      expect(event.stopPropagation).toHaveBeenCalled();
    });
  });
});
