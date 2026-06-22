import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { TranslateService } from '@ngx-translate/core';
import { Subject } from 'rxjs';
import { CommandBusService } from './command-bus.service';
import { QbService } from './qb.service';
import { ServerStoreService } from './server-store.service';
import { ToastService } from './toast.service';
import { TransferLimitCommandHandlerService } from './transfer-limit-command-handler.service';

const flushPromises = () => new Promise<void>((resolve) => setTimeout(resolve));

describe('TransferLimitCommandHandlerService', () => {
  let service: TransferLimitCommandHandlerService;
  let commands$: Subject<any>;
  let getAltState: ReturnType<typeof vi.fn>;
  let toggleAlt: ReturnType<typeof vi.fn>;
  let toastInfo: ReturnType<typeof vi.fn>;
  let translateService: { instant: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    commands$ = new Subject();
    getAltState = vi.fn().mockResolvedValue(false);
    toggleAlt = vi.fn().mockResolvedValue(undefined);
    toastInfo = vi.fn();
    translateService = { instant: vi.fn((key: string) => key) };

    TestBed.configureTestingModule({
      providers: [
        TransferLimitCommandHandlerService,
        { provide: CommandBusService, useValue: { commands$: commands$.asObservable() } },
        {
          provide: QbService,
          useValue: {
            transfer: {
              speedLimitsMode: getAltState,
              toggleSpeedLimitsMode: toggleAlt,
            },
          },
        },
        { provide: ServerStoreService, useValue: { currentServerId: signal('server-1') } },
        { provide: ToastService, useValue: { info: toastInfo } },
        { provide: TranslateService, useValue: translateService },
      ],
    });

    service = TestBed.inject(TransferLimitCommandHandlerService);
    service.start();
  });

  it('should show info toast on toggle', async () => {
    commands$.next({ type: 'TRANSFER_LIMIT_ALTERNATIVE_TOGGLE' });
    await flushPromises();
    expect(toastInfo).toHaveBeenCalledWith(
      'services.transfer-limit-command-handler.info.alternative-limit-on',
      'services.transfer-limit-command-handler.info.alternative-limit-on-title',
    );
  });

  it('should show "OFF" toast when alt speed is currently enabled', async () => {
    getAltState.mockResolvedValueOnce(true);
    commands$.next({ type: 'TRANSFER_LIMIT_ALTERNATIVE_TOGGLE' });
    await flushPromises();
    expect(toastInfo).toHaveBeenCalledWith(
      'services.transfer-limit-command-handler.info.alternative-limit-off',
      'services.transfer-limit-command-handler.info.alternative-limit-off-title',
    );
  });

  it('should call toggleAlternativeSpeedLimit with the current server id', async () => {
    commands$.next({ type: 'TRANSFER_LIMIT_ALTERNATIVE_TOGGLE' });
    await flushPromises();
    expect(toggleAlt).toHaveBeenCalledWith('server-1');
  });

  it('should ignore a second toggle while first is in-flight (exhaustMap)', async () => {
    commands$.next({ type: 'TRANSFER_LIMIT_ALTERNATIVE_TOGGLE' });
    commands$.next({ type: 'TRANSFER_LIMIT_ALTERNATIVE_TOGGLE' });
    await flushPromises();
    expect(getAltState).toHaveBeenCalledTimes(1);
  });
});
