import { TestBed } from '@angular/core/testing';
import type { UpdateCapability, UpdaterEvent } from '@bitbutler/shared';
import { UpdaterService } from './updater.service';

describe('UpdaterService', () => {
  let service: UpdaterService;
  let emit: (event: UpdaterEvent) => void;
  let updateNowSpy: ReturnType<typeof vi.fn>;
  let getCapabilitySpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    updateNowSpy = vi.fn().mockResolvedValue(undefined);
    getCapabilitySpy = vi.fn().mockResolvedValue({ supported: false } as UpdateCapability);

    vi.spyOn(window.bitbutler.updater, 'onEvent').mockImplementation((callback) => {
      emit = callback;
      return () => {};
    });
    vi.spyOn(window.bitbutler.updater, 'getCapability').mockImplementation(getCapabilitySpy);
    vi.spyOn(window.bitbutler.updater, 'updateNow').mockImplementation(updateNowSpy);

    TestBed.configureTestingModule({ providers: [UpdaterService] });
    service = TestBed.inject(UpdaterService);
  });

  it('starts idle with no capability, zero progress, and no error', () => {
    expect(service.status()).toBe('idle');
    expect(service.progress()).toBe(0);
    expect(service.errorMessage()).toBeNull();
  });

  it('loads capability from window.bitbutler.updater.getCapability() on construction', async () => {
    await Promise.resolve();
    expect(getCapabilitySpy).toHaveBeenCalled();
  });

  it('sets capability once getCapability() resolves', async () => {
    getCapabilitySpy.mockResolvedValue({ supported: true });
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ providers: [UpdaterService] });
    vi.spyOn(window.bitbutler.updater, 'getCapability').mockResolvedValue({ supported: true });
    const freshService = TestBed.inject(UpdaterService);
    await Promise.resolve();
    expect(freshService.capability()).toEqual({ supported: true });
  });

  it('sets status to checking on a checking event', () => {
    emit({ status: 'checking' });
    expect(service.status()).toBe('checking');
  });

  it('sets status to downloading and tracks percent on a downloading event', () => {
    emit({ status: 'downloading', percent: 37, transferred: 370, total: 1000 });
    expect(service.status()).toBe('downloading');
    expect(service.progress()).toBe(37);
  });

  it('sets status to downloaded on a downloaded event', () => {
    emit({ status: 'downloaded' });
    expect(service.status()).toBe('downloaded');
  });

  it('sets status to error and records the message on an error event', () => {
    emit({ status: 'error', message: 'offline' });
    expect(service.status()).toBe('error');
    expect(service.errorMessage()).toBe('offline');
  });

  it('updateNow() resets status/progress/error and calls the preload API', () => {
    emit({ status: 'error', message: 'offline' });
    service.updateNow();
    expect(service.status()).toBe('checking');
    expect(service.progress()).toBe(0);
    expect(service.errorMessage()).toBeNull();
    expect(updateNowSpy).toHaveBeenCalled();
  });

  it('reset() returns to idle with no progress or error', () => {
    emit({ status: 'error', message: 'offline' });
    service.reset();
    expect(service.status()).toBe('idle');
    expect(service.progress()).toBe(0);
    expect(service.errorMessage()).toBeNull();
  });
});
