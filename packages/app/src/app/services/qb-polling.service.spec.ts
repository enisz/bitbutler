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
        maindata: vi.fn().mockResolvedValue({ rid: 1 }),
        torrentPeers: vi.fn().mockResolvedValue({ rid: 1, peers: {} }),
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

  // qb.sync.maindata is only invoked lazily, from inside the returned Observable's operator
  // chain (exhaustMap), so every test that asserts on it must actually subscribe - calling
  // startMaindataPolling() alone (as the old streamMaindata-based test did) never triggers it.
  it('should call qb.sync.maindata with rid 0 on the first call for a server', async () => {
    const sub = service.startMaindataPolling('server-1').subscribe();
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    expect(mockQbService.sync.maindata).toHaveBeenCalledWith('server-1', 0);
    sub.unsubscribe();
  });

  it('should stop any previous polling when startMaindataPolling() is called again', async () => {
    const sub1 = service.startMaindataPolling('server-1').subscribe();
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    const sub2 = service.startMaindataPolling('server-1').subscribe();
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    expect(mockQbService.sync.maindata).toHaveBeenCalledTimes(2);
    sub1.unsubscribe();
    sub2.unsubscribe();
  });

  it('should flip isInitialLoading$ back to false once the first fetch resolves', async () => {
    mockQbService.sync.maindata.mockResolvedValueOnce({ rid: 1 });
    const sub = service.startMaindataPolling('server-1').subscribe();

    expect(await firstValueFrom(service.isInitialLoading$)).toBe(true);

    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    expect(await firstValueFrom(service.isInitialLoading$)).toBe(false);
    sub.unsubscribe();
  });

  it('should resume from the last known rid when restarting polling for the same server', async () => {
    mockQbService.sync.maindata.mockResolvedValueOnce({ rid: 42 });
    const sub1 = service.startMaindataPolling('server-1').subscribe();
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    sub1.unsubscribe();

    const sub2 = service.startMaindataPolling('server-1').subscribe();
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    expect(mockQbService.sync.maindata).toHaveBeenLastCalledWith('server-1', 42);
    sub2.unsubscribe();
  });

  it('should reset the rid to 0 when restarting polling for a different server', async () => {
    mockQbService.sync.maindata.mockResolvedValueOnce({ rid: 42 });
    const sub1 = service.startMaindataPolling('server-1').subscribe();
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    sub1.unsubscribe();

    const sub2 = service.startMaindataPolling('server-2').subscribe();
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    expect(mockQbService.sync.maindata).toHaveBeenLastCalledWith('server-2', 0);
    sub2.unsubscribe();
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

  describe('startPeersPolling', () => {
    it('creates a per-hash rid subject while a subscription is active', async () => {
      const sub = service.startPeersPolling('server-1', 'hash-1').subscribe();
      await Promise.resolve();
      await Promise.resolve();

      expect((service as any).peersRidByHash.has('hash-1')).toBe(true);
      sub.unsubscribe();
    });

    it('removes the per-hash rid subject once the subscription ends', async () => {
      const sub = service.startPeersPolling('server-1', 'hash-1').subscribe();
      await Promise.resolve();
      await Promise.resolve();

      sub.unsubscribe();

      expect((service as any).peersRidByHash.has('hash-1')).toBe(false);
    });
  });
});
