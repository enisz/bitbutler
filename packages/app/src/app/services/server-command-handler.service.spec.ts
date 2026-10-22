import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { TranslateService } from '@ngx-translate/core';
import { Subject } from 'rxjs';
import { CommandBusService } from './command-bus.service';
import { ServerCommandHandlerService } from './server-command-handler.service';
import { ServerStoreService } from './server-store.service';
import { ServerService } from './server.service';
import { ToastService } from './toast.service';

const flushPromises = () => new Promise<void>((resolve) => setTimeout(resolve));

describe('ServerCommandHandlerService', () => {
  let service: ServerCommandHandlerService;
  let commands$: Subject<any>;
  let serverStoreRefresh: ReturnType<typeof vi.fn>;
  let serverDelete: ReturnType<typeof vi.fn>;
  let toastSuccess: ReturnType<typeof vi.fn>;
  let toastInfo: ReturnType<typeof vi.fn>;
  let translateService: { instant: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    commands$ = new Subject();
    serverStoreRefresh = vi.fn().mockResolvedValue(undefined);
    serverDelete = vi.fn().mockResolvedValue(undefined);
    toastSuccess = vi.fn();
    toastInfo = vi.fn();
    translateService = { instant: vi.fn((key: string) => key) };

    TestBed.configureTestingModule({
      providers: [
        ServerCommandHandlerService,
        { provide: CommandBusService, useValue: { commands$: commands$.asObservable() } },
        {
          provide: ServerStoreService,
          useValue: {
            refresh: serverStoreRefresh,
            servers: signal([
              { id: '1', name: 'Test Server' },
              { id: '2', name: 'Second Server' },
              { id: '3', name: 'Third Server' },
            ]),
            currentServerId: signal(null),
            select: vi.fn(),
          },
        },
        {
          provide: ServerService,
          useValue: { delete: serverDelete },
        },
        { provide: ToastService, useValue: { success: toastSuccess, info: toastInfo } },
        { provide: TranslateService, useValue: translateService },
      ],
    });

    service = TestBed.inject(ServerCommandHandlerService);
    service.start();
  });

  it('should show success toast after SERVER_ADDED', async () => {
    commands$.next({ type: 'SERVER_ADDED', id: '1' });
    await flushPromises();
    expect(toastSuccess).toHaveBeenCalledWith(
      '"Test Server"',
      'services.server-command-handler.success.added-title',
    );
  });

  it('should call select after SERVER_ADDED', async () => {
    const select = TestBed.inject(ServerStoreService).select as ReturnType<typeof vi.fn>;
    commands$.next({ type: 'SERVER_ADDED', id: '1' });
    await flushPromises();
    expect(select).toHaveBeenCalledWith('1');
  });

  it('should fall back to the generic "added" toast when added server is not found', async () => {
    commands$.next({ type: 'SERVER_ADDED', id: 'unknown' });
    await flushPromises();
    expect(toastSuccess).toHaveBeenCalledWith(
      'services.server-command-handler.success.added-fallback',
      'services.server-command-handler.success.added-title',
    );
  });

  it('should show info toast after SERVER_UPDATED', async () => {
    commands$.next({ type: 'SERVER_UPDATED', id: '1' });
    await flushPromises();
    expect(toastInfo).toHaveBeenCalledWith(
      '"Test Server"',
      'services.server-command-handler.info.updated-title',
    );
  });

  it('should show info toast with the name after SERVER_DELETED for one server', async () => {
    commands$.next({ type: 'SERVER_DELETED', ids: ['1'] });
    await flushPromises();
    expect(serverDelete).toHaveBeenCalledWith('1');
    expect(toastInfo).toHaveBeenCalledTimes(1);
    expect(toastInfo).toHaveBeenCalledWith(
      '"Test Server"',
      'services.server-command-handler.info.deleted-title',
    );
  });

  it('should delete every server but show a single toast with the count', async () => {
    commands$.next({ type: 'SERVER_DELETED', ids: ['1', '2', '3'] });
    await flushPromises();
    expect(serverDelete).toHaveBeenCalledTimes(3);
    expect(serverStoreRefresh).toHaveBeenCalledTimes(1);
    expect(toastInfo).toHaveBeenCalledTimes(1);
    expect(toastInfo).toHaveBeenCalledWith(
      'services.server-command-handler.info.deleted-count',
      'services.server-command-handler.info.deleted-title-plural',
    );
    expect(translateService.instant).toHaveBeenCalledWith(
      'services.server-command-handler.info.deleted-count',
      { count: 3 },
    );
  });

  it('should only report the servers that were actually deleted', async () => {
    serverDelete.mockRejectedValueOnce(new Error('locked'));
    commands$.next({ type: 'SERVER_DELETED', ids: ['1', '2'] });
    await flushPromises();
    expect(serverDelete).toHaveBeenCalledTimes(2);
    expect(serverStoreRefresh).toHaveBeenCalledTimes(1);
    expect(toastInfo).toHaveBeenCalledTimes(1);
    expect(toastInfo).toHaveBeenCalledWith(
      '"Second Server"',
      'services.server-command-handler.info.deleted-title',
    );
  });

  it('should not show a toast when no server could be deleted', async () => {
    serverDelete.mockRejectedValue(new Error('locked'));
    commands$.next({ type: 'SERVER_DELETED', ids: ['1'] });
    await flushPromises();
    expect(toastInfo).not.toHaveBeenCalled();
  });

  it('should not crash the subscription if a command throws', async () => {
    serverStoreRefresh.mockRejectedValueOnce(new Error('network error'));
    commands$.next({ type: 'SERVER_ADDED', id: '1' });
    await flushPromises();

    serverStoreRefresh.mockResolvedValueOnce(undefined);
    commands$.next({ type: 'SERVER_UPDATED', id: '1' });
    await flushPromises();
    expect(toastInfo).toHaveBeenCalled();
  });
});
