import { TestBed } from '@angular/core/testing';
import { TranslateService } from '@ngx-translate/core';
import { Subject } from 'rxjs';
import { CommandBusService } from './command-bus.service';
import { ElectronService } from './electron.service';
import { ToastService } from './toast.service';
import { UpdateCommandHandlerService } from './update-command-handler.service';
import { UpdateSettingsService } from './update-settings.service';

const flushPromises = () => new Promise<void>((resolve) => setTimeout(resolve));

describe('UpdateCommandHandlerService', () => {
  let service: UpdateCommandHandlerService;
  let commands$: Subject<any>;
  let checkForUpdate: ReturnType<typeof vi.fn>;
  let toastSuccess: ReturnType<typeof vi.fn>;
  let toastDanger: ReturnType<typeof vi.fn>;
  let commandBusEmit: ReturnType<typeof vi.fn>;
  let translateService: { instant: ReturnType<typeof vi.fn> };
  let updateSettingsLoad: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    commands$ = new Subject();
    checkForUpdate = vi.fn().mockResolvedValue({ updateAvailable: false, error: null });
    toastSuccess = vi.fn();
    toastDanger = vi.fn();
    commandBusEmit = vi.fn();
    translateService = { instant: vi.fn((key: string) => key) };
    updateSettingsLoad = vi.fn().mockResolvedValue({ skippedVersion: null });

    TestBed.configureTestingModule({
      providers: [
        UpdateCommandHandlerService,
        {
          provide: CommandBusService,
          useValue: { commands$: commands$.asObservable(), emit: commandBusEmit },
        },
        { provide: ElectronService, useValue: { checkForUpdate } },
        { provide: ToastService, useValue: { success: toastSuccess, danger: toastDanger } },
        { provide: TranslateService, useValue: translateService },
        { provide: UpdateSettingsService, useValue: { load: updateSettingsLoad } },
      ],
    });

    service = TestBed.inject(UpdateCommandHandlerService);
    service.start();
  });

  it('should show success toast when no update available', async () => {
    commands$.next({ type: 'UPDATE_CHECK_FOR_UPDATE', trigger: 'automatic' });
    await flushPromises();
    expect(toastSuccess).toHaveBeenCalledWith(
      'services.update-command-handler.success.up-to-date',
      'services.update-command-handler.success.up-to-date-title',
    );
  });

  it('should emit UI_UPDATE_AVAILABLE when update is found', async () => {
    const update = {
      updateAvailable: true,
      error: null,
      releases: [{ tag_name: 'v2.0.0' }],
    };
    checkForUpdate.mockResolvedValueOnce(update);
    commands$.next({ type: 'UPDATE_CHECK_FOR_UPDATE', trigger: 'automatic' });
    await flushPromises();
    expect(commandBusEmit).toHaveBeenCalledWith({ type: 'UI_UPDATE_AVAILABLE', update });
  });

  it('should ignore second check while first is in-flight (exhaustMap)', async () => {
    commands$.next({ type: 'UPDATE_CHECK_FOR_UPDATE', trigger: 'automatic' });
    commands$.next({ type: 'UPDATE_CHECK_FOR_UPDATE', trigger: 'automatic' });
    await flushPromises();
    expect(checkForUpdate).toHaveBeenCalledTimes(1);
  });

  it('should show danger toast when response contains an error', async () => {
    checkForUpdate.mockResolvedValueOnce({ updateAvailable: false, error: 'Network unreachable' });
    commands$.next({ type: 'UPDATE_CHECK_FOR_UPDATE', trigger: 'automatic' });
    await flushPromises();
    expect(toastDanger).toHaveBeenCalledWith(
      'Network unreachable',
      'services.update-command-handler.error.check-failed-title',
    );
  });

  describe('skipped version handling', () => {
    it('should suppress UI_UPDATE_AVAILABLE on an automatic check when the latest release was skipped', async () => {
      updateSettingsLoad.mockResolvedValue({ skippedVersion: '2.0.0' });
      checkForUpdate.mockResolvedValueOnce({
        updateAvailable: true,
        error: null,
        releases: [{ tag_name: 'v2.0.0' }],
      });
      commands$.next({ type: 'UPDATE_CHECK_FOR_UPDATE', trigger: 'automatic' });
      await flushPromises();
      expect(commandBusEmit).not.toHaveBeenCalled();
      expect(toastSuccess).not.toHaveBeenCalled();
    });

    it('should still emit UI_UPDATE_AVAILABLE on an automatic check for a newer release than the skipped one', async () => {
      updateSettingsLoad.mockResolvedValue({ skippedVersion: '2.0.0' });
      const update = {
        updateAvailable: true,
        error: null,
        releases: [{ tag_name: 'v2.1.0' }],
      };
      checkForUpdate.mockResolvedValueOnce(update);
      commands$.next({ type: 'UPDATE_CHECK_FOR_UPDATE', trigger: 'automatic' });
      await flushPromises();
      expect(commandBusEmit).toHaveBeenCalledWith({ type: 'UI_UPDATE_AVAILABLE', update });
    });

    it('should bypass the skipped version on a manual check', async () => {
      updateSettingsLoad.mockResolvedValue({ skippedVersion: '2.0.0' });
      const update = {
        updateAvailable: true,
        error: null,
        releases: [{ tag_name: 'v2.0.0' }],
      };
      checkForUpdate.mockResolvedValueOnce(update);
      commands$.next({ type: 'UPDATE_CHECK_FOR_UPDATE', trigger: 'manual' });
      await flushPromises();
      expect(commandBusEmit).toHaveBeenCalledWith({ type: 'UI_UPDATE_AVAILABLE', update });
    });
  });
});
