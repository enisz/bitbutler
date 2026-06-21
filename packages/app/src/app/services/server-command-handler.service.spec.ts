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
  let toastSuccess: ReturnType<typeof vi.fn>;
  let toastInfo: ReturnType<typeof vi.fn>;
  let translateService: { instant: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    commands$ = new Subject();
    serverStoreRefresh = vi.fn().mockResolvedValue(undefined);
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
            servers: signal([{ id: '1', name: 'Test Server' }]),
            currentServerId: signal(null),
            select: vi.fn(),
          },
        },
        {
          provide: ServerService,
          useValue: { delete: vi.fn().mockResolvedValue(undefined) },
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
    expect(translateService.instant).toHaveBeenCalledWith(
      'services.server-command-handler.success.added',
      { name: 'Test Server' },
    );
    expect(toastSuccess).toHaveBeenCalledWith('services.server-command-handler.success.added');
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
    );
  });

  it('should show info toast after SERVER_UPDATED', async () => {
    commands$.next({ type: 'SERVER_UPDATED', id: '1' });
    await flushPromises();
    expect(translateService.instant).toHaveBeenCalledWith(
      'services.server-command-handler.info.updated',
      { name: 'Test Server' },
    );
    expect(toastInfo).toHaveBeenCalledWith('services.server-command-handler.info.updated');
  });

  it('should show info toast after SERVER_DELETED', async () => {
    commands$.next({ type: 'SERVER_DELETED', id: '1' });
    await flushPromises();
    expect(translateService.instant).toHaveBeenCalledWith(
      'services.server-command-handler.info.deleted',
      { name: 'Test Server' },
    );
    expect(toastInfo).toHaveBeenCalledWith('services.server-command-handler.info.deleted');
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
