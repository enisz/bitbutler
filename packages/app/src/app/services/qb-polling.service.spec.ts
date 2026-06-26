import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Subject, firstValueFrom } from 'rxjs';
import { QbPollingService } from './qb-polling.service';
import { QbService } from './qb.service';
import { ServerSettingsService } from './server-settings.service';
import { WindowService } from './window.service';

describe('QbPollingService', () => {
  let service: QbPollingService;
  let mockQbService: any;
  let mockWindowService: any;
  let mockServerSettings: any;

  beforeEach(() => {
    mockQbService = {
      sync: {
        streamMaindata: vi.fn().mockReturnValue(new Subject()),
        maindata: vi.fn().mockResolvedValue({ rid: 1 }),
      },
    };

    mockWindowService = {
      state: signal({
        height: 0,
        isFullScreen: false,
        isMaximized: false,
        isMinimized: false,
        width: 0,
      }),
    };

    mockServerSettings = {
      load: vi.fn().mockResolvedValue({ polling: { foreground: 2000, background: 5000 } }),
      asObservable: vi.fn().mockReturnValue(new Subject()),
    };

    TestBed.configureTestingModule({
      providers: [
        QbPollingService,
        { provide: QbService, useValue: mockQbService },
        { provide: WindowService, useValue: mockWindowService },
        { provide: ServerSettingsService, useValue: mockServerSettings },
      ],
    });

    service = TestBed.inject(QbPollingService);
  });

  it('should initialise isInitialLoading$ to false', async () => {
    const loading = await firstValueFrom(service.isInitialLoading$);
    expect(loading).toBe(false);
  });

  it('should expose pollingInterval$ observable', async () => {
    const interval = await firstValueFrom(service.pollingInterval$);
    expect(typeof interval).toBe('number');
  });

  it('should return the current polling interval from getPollingInterval()', () => {
    expect(typeof service.getPollingInterval()).toBe('number');
  });

  it('should reset isInitialLoading$ to false on stopPolling()', async () => {
    service.stopPolling();
    const loading = await firstValueFrom(service.isInitialLoading$);
    expect(loading).toBe(false);
  });

  it('should expose onPoll$ observable', () => {
    expect(service.onPoll$).toBeDefined();
  });

  it('should call streamMaindata when startMaindataPolling() is called', () => {
    service.startMaindataPolling('server-1');
    expect(mockQbService.sync.streamMaindata).toHaveBeenCalledWith(
      'server-1',
      0,
      undefined,
      undefined,
    );
  });

  it('should stop any previous polling when startMaindataPolling() is called again', () => {
    service.startMaindataPolling('server-1');
    service.startMaindataPolling('server-1');
    expect(mockQbService.sync.streamMaindata).toHaveBeenCalledTimes(2);
  });

  describe('pause / resume', () => {
    it('should expose isPaused$ starting as false', async () => {
      const paused = await firstValueFrom(service.isPaused$);
      expect(paused).toBe(false);
    });

    it('pause() should return a symbol', () => {
      const token = service.pause();
      expect(typeof token).toBe('symbol');
      service.resume(token);
    });

    it('isPaused$ should emit true after pause()', async () => {
      const token = service.pause();
      const paused = await firstValueFrom(service.isPaused$);
      expect(paused).toBe(true);
      service.resume(token);
    });

    it('isPaused$ should emit false after resume() of the only token', async () => {
      const token = service.pause();
      service.resume(token);
      const paused = await firstValueFrom(service.isPaused$);
      expect(paused).toBe(false);
    });

    it('isPaused$ should stay true when one of two tokens is returned', async () => {
      const t1 = service.pause();
      const t2 = service.pause();
      service.resume(t1);
      const paused = await firstValueFrom(service.isPaused$);
      expect(paused).toBe(true);
      service.resume(t2);
    });

    it('stopPolling() should clear all tokens and set isPaused$ to false', async () => {
      service.pause();
      service.pause();
      service.stopPolling();
      const paused = await firstValueFrom(service.isPaused$);
      expect(paused).toBe(false);
    });
  });
});
