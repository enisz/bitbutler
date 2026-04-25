import { TestBed, fakeAsync, tick } from '@angular/core/testing';
import { Subject } from 'rxjs';
import { UpdateCommandHandlerService } from './update-command-handler.service';
import { CommandBusService } from './command-bus.service';
import { ElectronService } from './electron.service';
import { ToastService } from './toast.service';

describe('UpdateCommandHandlerService', () => {
  let service: UpdateCommandHandlerService;
  let commands$: Subject<any>;
  let checkForUpdate: ReturnType<typeof vi.fn>;
  let toastSuccess: ReturnType<typeof vi.fn>;
  let toastDanger: ReturnType<typeof vi.fn>;
  let commandBusEmit: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    commands$ = new Subject();
    checkForUpdate = vi.fn().mockResolvedValue({ updateAvailable: false, error: null });
    toastSuccess = vi.fn();
    toastDanger = vi.fn();
    commandBusEmit = vi.fn();

    TestBed.configureTestingModule({
      providers: [
        UpdateCommandHandlerService,
        {
          provide: CommandBusService,
          useValue: { commands$: commands$.asObservable(), emit: commandBusEmit },
        },
        { provide: ElectronService, useValue: { checkForUpdate } },
        { provide: ToastService, useValue: { success: toastSuccess, danger: toastDanger } },
      ],
    });

    service = TestBed.inject(UpdateCommandHandlerService);
    service.start();
  });

  it('should show success toast when no update available', fakeAsync(() => {
    commands$.next({ type: 'UPDATE_CHECK_FOR_UPDATE' });
    tick();
    expect(toastSuccess).toHaveBeenCalledWith('Your are on the latest version!');
  }));

  it('should emit UI_UPDATE_AVAILABLE when update is found', fakeAsync(() => {
    const update = { updateAvailable: true, error: null, version: '2.0.0' };
    checkForUpdate.mockResolvedValueOnce(update);
    commands$.next({ type: 'UPDATE_CHECK_FOR_UPDATE' });
    tick();
    expect(commandBusEmit).toHaveBeenCalledWith({ type: 'UI_UPDATE_AVAILABLE', update });
  }));

  it('should ignore second check while first is in-flight (exhaustMap)', fakeAsync(() => {
    commands$.next({ type: 'UPDATE_CHECK_FOR_UPDATE' });
    commands$.next({ type: 'UPDATE_CHECK_FOR_UPDATE' });
    tick();
    expect(checkForUpdate).toHaveBeenCalledTimes(1);
  }));
});
