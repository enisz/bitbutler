import { signal } from '@angular/core';
import { TestBed, fakeAsync, tick } from '@angular/core/testing';
import { Subject } from 'rxjs';
import { CommandBusService } from './command-bus.service';
import { ServerCommandHandlerService } from './server-command-handler.service';
import { ServerStoreService } from './server-store.service';
import { ServerService } from './server.service';
import { ToastService } from './toast.service';

describe('ServerCommandHandlerService', () => {
  let service: ServerCommandHandlerService;
  let commands$: Subject<any>;
  let serverStoreRefresh: ReturnType<typeof vi.fn>;
  let toastSuccess: ReturnType<typeof vi.fn>;
  let toastInfo: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    commands$ = new Subject();
    serverStoreRefresh = vi.fn().mockResolvedValue(undefined);
    toastSuccess = vi.fn();
    toastInfo = vi.fn();

    TestBed.configureTestingModule({
      providers: [
        ServerCommandHandlerService,
        { provide: CommandBusService, useValue: { commands$: commands$.asObservable() } },
        {
          provide: ServerStoreService,
          useValue: {
            refresh: serverStoreRefresh,
            servers: signal([{ id: '1', name: 'Test Server' }]),
            select: vi.fn(),
          },
        },
        {
          provide: ServerService,
          useValue: { delete: vi.fn().mockResolvedValue(undefined) },
        },
        { provide: ToastService, useValue: { success: toastSuccess, info: toastInfo } },
      ],
    });

    service = TestBed.inject(ServerCommandHandlerService);
    service.start();
  });

  it('should show success toast after SERVER_ADDED', fakeAsync(() => {
    commands$.next({ type: 'SERVER_ADDED', id: '1' });
    tick();
    expect(toastSuccess).toHaveBeenCalledWith('Server Test Server added!');
  }));

  it('should not crash the subscription if a command throws', fakeAsync(() => {
    serverStoreRefresh.mockRejectedValueOnce(new Error('network error'));
    commands$.next({ type: 'SERVER_ADDED', id: '1' });
    tick();

    serverStoreRefresh.mockResolvedValueOnce(undefined);
    commands$.next({ type: 'SERVER_UPDATED', id: '1' });
    tick();
    expect(toastInfo).toHaveBeenCalled();
  }));
});
