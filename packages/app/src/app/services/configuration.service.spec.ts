import { TestBed } from '@angular/core/testing';
import { TranslateService } from '@ngx-translate/core';
import { of } from 'rxjs';
import { CommandBusService } from './command-bus.service';
import { ConfigurationService } from './configuration.service';
import { ToastService } from './toast.service';

describe('ConfigurationService', () => {
  let service: ConfigurationService;
  let commandBusEmit: ReturnType<typeof vi.fn>;
  let toastSuccess: ReturnType<typeof vi.fn>;
  let reloadSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    sessionStorage.clear();
    commandBusEmit = vi.fn();
    toastSuccess = vi.fn();
    reloadSpy = vi.fn();

    TestBed.configureTestingModule({
      providers: [
        { provide: CommandBusService, useValue: { emit: commandBusEmit } },
        { provide: ToastService, useValue: { success: toastSuccess } },
        {
          provide: TranslateService,
          useValue: {
            // get() waits for the language to load, instant() would return the bare key after a reload
            get: (keys: string[], params?: object) =>
              of(Object.fromEntries(keys.map((key) => [key, key + JSON.stringify(params ?? {})]))),
          },
        },
      ],
    });
    service = TestBed.inject(ConfigurationService);
    vi.spyOn(service as any, 'reloadWindow').mockImplementation(reloadSpy);
  });

  it('pickAndImport emits UI_IMPORT_CONFIGURATION with the picked path', async () => {
    vi.spyOn((window as any).bitbutler.config, 'openPicker').mockResolvedValue('/tmp/a.bbc');

    await service.pickAndImport();

    expect(commandBusEmit).toHaveBeenCalledWith({
      type: 'UI_IMPORT_CONFIGURATION',
      bbcPath: '/tmp/a.bbc',
    });
  });

  it('pickAndImport flags a servers-only import', async () => {
    vi.spyOn((window as any).bitbutler.config, 'openPicker').mockResolvedValue('/tmp/a.bbc');

    await service.pickAndImport(true);

    expect(commandBusEmit).toHaveBeenCalledWith({
      type: 'UI_IMPORT_CONFIGURATION',
      bbcPath: '/tmp/a.bbc',
      serversOnly: true,
    });
  });

  it('pickAndImport does nothing when the picker is cancelled', async () => {
    vi.spyOn((window as any).bitbutler.config, 'openPicker').mockResolvedValue(undefined);

    await service.pickAndImport();

    expect(commandBusEmit).not.toHaveBeenCalled();
  });

  it('finishImport stores the counts and reloads the window', () => {
    service.finishImport({ settings: true, servers: 2 });

    expect(JSON.parse(sessionStorage.getItem('bb.configImported')!)).toEqual({
      settings: true,
      servers: 2,
    });
    expect(reloadSpy).toHaveBeenCalledTimes(1);
  });

  it('consumeImportToast returns the stored counts once, then null', () => {
    service.finishImport({ settings: false, servers: 1 });

    expect(service.consumeImportToast()).toEqual({ settings: false, servers: 1 });
    expect(service.consumeImportToast()).toBeNull();
  });

  it('consumeImportToast returns null for malformed stored data', () => {
    sessionStorage.setItem('bb.configImported', '{nope');

    expect(service.consumeImportToast()).toBeNull();
  });

  it('showImportedToastIfPending shows a success toast once when an import just finished', () => {
    service.finishImport({ settings: true, servers: 3 });

    service.showImportedToastIfPending();
    service.showImportedToastIfPending();

    expect(toastSuccess).toHaveBeenCalledTimes(1);
    expect(toastSuccess.mock.calls[0][1]).toContain(
      'services.configuration.success.imported-title',
    );
  });

  it('showImportedToastIfPending shows nothing when no import is pending', () => {
    service.showImportedToastIfPending();

    expect(toastSuccess).not.toHaveBeenCalled();
  });
});
