import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { TranslateService } from '@ngx-translate/core';
import { Subject } from 'rxjs';
import { CommandBusService } from './command-bus.service';
import { MenuBarCommandHandlerService } from './menu-bar-command-handler.service';
import { MenuBarService } from './menu-bar.service';
import { NotificationService } from './notification.service';
import { ServerStoreService } from './server-store.service';
import { ToastService } from './toast.service';

describe('MenuBarCommandHandlerService', () => {
  let service: MenuBarCommandHandlerService;
  let clicks$: Subject<any>;
  let commandBusEmit: ReturnType<typeof vi.fn>;
  let toastInfo: ReturnType<typeof vi.fn>;
  let toastPrimary: ReturnType<typeof vi.fn>;
  let toastSuccess: ReturnType<typeof vi.fn>;
  let toastDanger: ReturnType<typeof vi.fn>;
  let toastWarning: ReturnType<typeof vi.fn>;
  let toastShowText: ReturnType<typeof vi.fn>;
  let serverStoreService: any;

  beforeEach(() => {
    clicks$ = new Subject();
    commandBusEmit = vi.fn();
    toastInfo = vi.fn();
    toastPrimary = vi.fn();
    toastSuccess = vi.fn();
    toastDanger = vi.fn();
    toastWarning = vi.fn();
    toastShowText = vi.fn();

    serverStoreService = {
      currentServerId: signal('server-1'),
      servers: signal([{ id: 'server-1', name: 'Test Server' }]),
      suppressAutoLoginUntilManualConnect: vi.fn(),
      clearSelection: vi.fn(),
      select: vi.fn(),
    };

    TestBed.configureTestingModule({
      providers: [
        MenuBarCommandHandlerService,
        { provide: MenuBarService, useValue: { clicks$: clicks$.asObservable() } },
        {
          provide: CommandBusService,
          useValue: { commands$: new Subject().asObservable(), emit: commandBusEmit },
        },
        { provide: NotificationService, useValue: { send: vi.fn() } },
        {
          provide: ToastService,
          useValue: {
            info: toastInfo,
            primary: toastPrimary,
            secondary: vi.fn(),
            success: toastSuccess,
            danger: toastDanger,
            warning: toastWarning,
            light: vi.fn(),
            dark: vi.fn(),
            showText: toastShowText,
            adaptiveType: vi.fn().mockReturnValue('dark'),
            adaptive: vi.fn(),
          },
        },
        { provide: ServerStoreService, useValue: serverStoreService },
        {
          provide: NgbModal,
          useValue: {
            open: vi.fn().mockReturnValue({
              componentInstance: {},
              close: vi.fn(),
              result: Promise.resolve(),
            }),
          },
        },
        { provide: TranslateService, useValue: { instant: (k: string) => k } },
      ],
    });

    service = TestBed.inject(MenuBarCommandHandlerService);
    service.start();
  });

  it('should emit UI_ADD_TORRENT for file.addTorrent', () => {
    clicks$.next({ action: 'file.addTorrent', ts: 1 });
    expect(commandBusEmit).toHaveBeenCalledWith({ type: 'UI_ADD_TORRENT' });
  });

  it('should emit UI_OPEN_SETTINGS for settings.app', () => {
    clicks$.next({ action: 'settings.app', ts: 1 });
    expect(commandBusEmit).toHaveBeenCalledWith({ type: 'UI_OPEN_SETTINGS' });
  });

  it('should emit UI_OPEN_QB_SETTINGS for settings.qb', () => {
    clicks$.next({ action: 'settings.qb', ts: 1 });
    expect(commandBusEmit).toHaveBeenCalledWith({ type: 'UI_OPEN_QB_SETTINGS' });
  });

  it('should emit UI_SERVER_EDITOR_OPEN for server.add', () => {
    clicks$.next({ action: 'server.add', ts: 1 });
    expect(commandBusEmit).toHaveBeenCalledWith({ type: 'UI_SERVER_EDITOR_OPEN' });
  });

  it('should emit UI_VIEW_SELECT with the view id for view.select', () => {
    clicks$.next({ action: 'view.select', ts: 1, viewId: 'torrent-list' });
    expect(commandBusEmit).toHaveBeenCalledWith({
      type: 'UI_VIEW_SELECT',
      viewId: 'torrent-list',
    });
  });

  it('should do nothing for view.select without a view id', () => {
    clicks$.next({ action: 'view.select', ts: 1 });
    expect(commandBusEmit).not.toHaveBeenCalled();
  });

  it('should emit UPDATE_CHECK_FOR_UPDATE for help.checkForUpdates', () => {
    clicks$.next({ action: 'help.checkForUpdates', ts: 1 });
    expect(commandBusEmit).toHaveBeenCalledWith({
      type: 'UPDATE_CHECK_FOR_UPDATE',
      trigger: 'manual',
    });
  });

  it('should emit UI_OPEN_ABOUT for help.about', () => {
    clicks$.next({ action: 'help.about', ts: 1 });
    expect(commandBusEmit).toHaveBeenCalledWith({ type: 'UI_OPEN_ABOUT' });
  });

  it('should emit UI_DISCONNECT for file.disconnect', () => {
    clicks$.next({ action: 'file.disconnect', ts: 1 });
    expect(commandBusEmit).toHaveBeenCalledWith({ type: 'UI_DISCONNECT' });
  });

  it('should emit UI_QUIT for file.quit', () => {
    clicks$.next({ action: 'file.quit', ts: 1 });
    expect(commandBusEmit).toHaveBeenCalledWith({ type: 'UI_QUIT' });
  });

  it('should show primary toast for debug.toast.primary', () => {
    clicks$.next({ action: 'debug.toast.primary', ts: 1 });
    expect(toastPrimary).toHaveBeenCalled();
  });

  it('should show success toast for debug.toast.success', () => {
    clicks$.next({ action: 'debug.toast.success', ts: 1 });
    expect(toastSuccess).toHaveBeenCalled();
  });

  it('should show danger toast for debug.toast.danger', () => {
    clicks$.next({ action: 'debug.toast.danger', ts: 1 });
    expect(toastDanger).toHaveBeenCalled();
  });

  it('should show warning toast for debug.toast.warning', () => {
    clicks$.next({ action: 'debug.toast.warning', ts: 1 });
    expect(toastWarning).toHaveBeenCalled();
  });

  it('should not crash on unknown action', () => {
    expect(() => clicks$.next({ action: 'unknown.action', ts: 1 })).not.toThrow();
  });

  describe('debug toasts with actions', () => {
    const shown = () => toastShowText.mock.calls.map(([, opts]) => opts);

    it('shows a toast of the clicked type with a secondary and a primary action', () => {
      clicks$.next({ action: 'debug.toast.actions.danger', ts: 1 });

      expect(shown()).toEqual([
        expect.objectContaining({
          type: 'danger',
          title: 'Danger with actions',
          actions: [
            expect.objectContaining({ label: 'Details', kind: 'text' }),
            expect.objectContaining({ label: 'Retry', kind: 'primary' }),
          ],
        }),
      ]);
      expect(toastDanger).not.toHaveBeenCalled();
    });

    it('resolves adaptive to the type opposite the current theme', () => {
      clicks$.next({ action: 'debug.toast.actions.adaptive', ts: 1 });

      expect(shown().map((o) => o.type)).toEqual(['dark']);
    });

    it('shows one toast of every type for "all"', () => {
      clicks$.next({ action: 'debug.toast.actions.all', ts: 1 });

      expect(shown().map((o) => o.type)).toEqual([
        'primary',
        'secondary',
        'success',
        'danger',
        'warning',
        'info',
        'light',
        'dark',
      ]);
    });

    it('shows exactly one toast for "random"', () => {
      clicks$.next({ action: 'debug.toast.actions.random', ts: 1 });

      expect(toastShowText).toHaveBeenCalledTimes(1);
    });

    it('ignores an unknown kind', () => {
      clicks$.next({ action: 'debug.toast.actions.bogus', ts: 1 });

      expect(toastShowText).not.toHaveBeenCalled();
    });

    it('gives clicking an action visible feedback', () => {
      clicks$.next({ action: 'debug.toast.actions.info', ts: 1 });

      shown()[0].actions[1].onClick();

      expect(toastInfo).toHaveBeenCalledWith('Action clicked: Retry', 'Debug', 2000);
    });
  });
});
