import { TestBed, fakeAsync, tick } from '@angular/core/testing';
import { Subject } from 'rxjs';
import { ServerCommandHandlerService } from './server-command-handler.service';
import { CommandBusService } from './command-bus.service';
import { ServerStoreService } from './server-store.service';
import { ServerService } from './server.service';
import { ToastService } from './toast.service';
import { signal } from '@angular/core';

describe('ServerCommandHandlerService', () => {
  let service: ServerCommandHandlerService;
  let commands$: Subject<any>;
  let serverStoreRefresh: jasmine.Spy;
  let toastSuccess: jasmine.Spy;
  let toastInfo: jasmine.Spy;

  beforeEach(() => {
    commands$ = new Subject();
    serverStoreRefresh = jasmine.createSpy('refresh').and.returnValue(Promise.resolve());
    toastSuccess = jasmine.createSpy('success');
    toastInfo = jasmine.createSpy('info');

    TestBed.configureTestingModule({
      providers: [
        ServerCommandHandlerService,
        { provide: CommandBusService, useValue: { commands$: commands$.asObservable() } },
        {
          provide: ServerStoreService,
          useValue: {
            refresh: serverStoreRefresh,
            servers: signal([{ id: '1', name: 'Test Server' }]),
            select: jasmine.createSpy('select'),
          },
        },
        {
          provide: ServerService,
          useValue: { delete: jasmine.createSpy('delete').and.returnValue(Promise.resolve()) },
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
    serverStoreRefresh.and.returnValue(Promise.reject(new Error('network error')));
    commands$.next({ type: 'SERVER_ADDED', id: '1' });
    tick();
    // subscription must still be alive
    serverStoreRefresh.and.returnValue(Promise.resolve());
    commands$.next({ type: 'SERVER_UPDATED', id: '1' });
    tick();
    expect(toastInfo).toHaveBeenCalled();
  }));
});
