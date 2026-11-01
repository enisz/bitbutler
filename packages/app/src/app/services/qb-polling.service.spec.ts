import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { TranslateService } from '@ngx-translate/core';
import { Subject, firstValueFrom } from 'rxjs';
import { QbError } from '../models/qb-error.model';
import { QbPollingService } from './qb-polling.service';
import { QbService } from './qb.service';
import { ServerSettingsService } from './server-settings.service';
import { ToastService } from './toast.service';
import { TorrentStoreService } from './torrent-store.service';
import { WindowService } from './window.service';

describe('QbPollingService', () => {
  let service: QbPollingService;
  let mockQbService: any;
  let mockWindowService: any;
  let mockServerSettings: any;
  let mockTorrentStore: any;
  let mockToast: any;

  beforeEach(() => {
    mockQbService = {
      sync: {
        maindata: vi.fn().mockResolvedValue({ rid: 1 }),
        torrentPeers: vi.fn().mockResolvedValue({ rid: 1, peers: {} }),
      },
      forceLogout: vi.fn().mockResolvedValue(undefined),
    };

    mockToast = { success: vi.fn(), warning: vi.fn(), danger: vi.fn() };

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

    mockTorrentStore = {
      clear: vi.fn(),
    };

    TestBed.configureTestingModule({
      providers: [
        QbPollingService,
        { provide: QbService, useValue: mockQbService },
        { provide: WindowService, useValue: mockWindowService },
        { provide: ServerSettingsService, useValue: mockServerSettings },
        { provide: TorrentStoreService, useValue: mockTorrentStore },
        { provide: ToastService, useValue: mockToast },
        { provide: TranslateService, useValue: { instant: (key: string) => key } },
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

  describe('maindata poll errors', () => {
    async function flush(): Promise<void> {
      for (let i = 0; i < 6; i++) await Promise.resolve();
    }

    it('stops polling when the poll fails with a QbError UNAUTHENTICATED', async () => {
      mockQbService.sync.maindata.mockRejectedValue(new QbError('UNAUTHENTICATED', 'expired'));
      vi.spyOn(console, 'warn').mockImplementation(() => {});
      const stopSpy = vi.spyOn(service, 'stopPolling');

      const sub = service.startMaindataPolling('server-1').subscribe();
      await flush();

      expect(stopSpy).toHaveBeenCalled();
      sub.unsubscribe();
    });

    it('keeps polling when the poll fails with another QbError code', async () => {
      mockQbService.sync.maindata.mockRejectedValue(new QbError('FAILED', 'boom'));
      vi.spyOn(console, 'error').mockImplementation(() => {});
      const stopSpy = vi.spyOn(service, 'stopPolling');

      const sub = service.startMaindataPolling('server-1').subscribe();
      await flush();

      expect(stopSpy).not.toHaveBeenCalled();
      sub.unsubscribe();
    });

    it('does not treat a legacy status 401 error as a lost session', async () => {
      mockQbService.sync.maindata.mockRejectedValue({ status: 401 });
      vi.spyOn(console, 'error').mockImplementation(() => {});
      const stopSpy = vi.spyOn(service, 'stopPolling');

      const sub = service.startMaindataPolling('server-1').subscribe();
      await flush();

      expect(stopSpy).not.toHaveBeenCalled();
      sub.unsubscribe();
    });
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

  describe('clearing the torrent store', () => {
    it('should clear the torrent store on a fresh start for a new server', async () => {
      const sub1 = service.startMaindataPolling('server-1').subscribe();
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
      sub1.unsubscribe();

      expect(mockTorrentStore.clear).toHaveBeenCalledTimes(1);

      const sub2 = service.startMaindataPolling('server-2').subscribe();
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
      sub2.unsubscribe();

      expect(mockTorrentStore.clear).toHaveBeenCalledTimes(2);
    });

    it('should not clear the torrent store when resuming polling for the same server', async () => {
      const sub1 = service.startMaindataPolling('server-1').subscribe();
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
      sub1.unsubscribe();

      expect(mockTorrentStore.clear).toHaveBeenCalledTimes(1);

      const sub2 = service.startMaindataPolling('server-1').subscribe();
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
      sub2.unsubscribe();

      expect(mockTorrentStore.clear).toHaveBeenCalledTimes(1);
    });

    it('should clear the torrent store again after stopPolling() resets fresh-start tracking, even for the same server', async () => {
      const sub1 = service.startMaindataPolling('server-1').subscribe();
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
      sub1.unsubscribe();

      service.stopPolling();

      const sub2 = service.startMaindataPolling('server-1').subscribe();
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
      sub2.unsubscribe();

      expect(mockTorrentStore.clear).toHaveBeenCalledTimes(2);
    });
  });

  describe('data preservation across a same-server restart', () => {
    let realTorrentStore: TorrentStoreService;
    let realService: QbPollingService;

    beforeEach(() => {
      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        providers: [
          QbPollingService,
          TorrentStoreService,
          { provide: QbService, useValue: mockQbService },
          { provide: WindowService, useValue: mockWindowService },
          { provide: ServerSettingsService, useValue: mockServerSettings },
        ],
      });

      realTorrentStore = TestBed.inject(TorrentStoreService);
      realService = TestBed.inject(QbPollingService);
    });

    it('should not lose torrents that did not change when restarting polling for the same server without an intervening stopPolling()', async () => {
      mockQbService.sync.maindata.mockResolvedValueOnce({
        rid: 1,
        full_update: true,
        torrents: {
          'hash-a': { name: 'Torrent A' },
          'hash-b': { name: 'Torrent B' },
        },
      });

      const sub1 = realService.startMaindataPolling('server-1').subscribe((maindata) => {
        realTorrentStore.applyMaindata(maindata);
      });
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
      sub1.unsubscribe();

      expect(realTorrentStore.torrentsMap().size).toBe(2);

      // Simulate a remount (e.g. navigating to another page and back) without an intervening
      // stopPolling() call - lastPolledServerId is still 'server-1', so this is a resume, not
      // a fresh start, and the response below is a delta containing only hash-b.
      mockQbService.sync.maindata.mockResolvedValueOnce({
        rid: 2,
        full_update: false,
        torrents: {
          'hash-b': { name: 'Torrent B (updated)' },
        },
      });

      const sub2 = realService.startMaindataPolling('server-1').subscribe((maindata) => {
        realTorrentStore.applyMaindata(maindata);
      });
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
      sub2.unsubscribe();

      expect(realTorrentStore.torrentsMap().has('hash-a')).toBe(true);
      expect(realTorrentStore.torrentsMap().get('hash-b')?.name).toBe('Torrent B (updated)');
    });
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

    it('should still complete the initial load when paused immediately after starting, before the first fetch resolves', async () => {
      const sub = service.startMaindataPolling('server-1').subscribe();
      const token = service.pause();

      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();

      expect(mockQbService.sync.maindata).toHaveBeenCalledWith('server-1', 0);
      expect(await firstValueFrom(service.isInitialLoading$)).toBe(false);

      service.resume(token);
      sub.unsubscribe();
    });
  });

  describe('link state', () => {
    const unreachable = () => new QbError('UNREACHABLE', 'offline');

    beforeEach(() => {
      vi.useFakeTimers();
      vi.spyOn(console, 'warn').mockImplementation(() => {});
      vi.spyOn(console, 'error').mockImplementation(() => {});
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('starts connected', () => {
      expect(service.linkState()).toBe('connected');
    });

    it('goes reconnecting with a single toast on the first unreachable poll, then stays quiet', async () => {
      mockQbService.sync.maindata.mockRejectedValue(unreachable());

      const sub = service.startMaindataPolling('server-1').subscribe();
      await vi.advanceTimersByTimeAsync(0);
      expect(service.linkState()).toBe('reconnecting');

      await vi.advanceTimersByTimeAsync(10_000);
      expect(mockToast.warning).toHaveBeenCalledTimes(1);
      sub.unsubscribe();
    });

    it('backs off between attempts (2s, then 5s, then 10s)', async () => {
      mockQbService.sync.maindata.mockRejectedValue(unreachable());

      const sub = service.startMaindataPolling('server-1').subscribe();
      await vi.advanceTimersByTimeAsync(0);
      expect(mockQbService.sync.maindata).toHaveBeenCalledTimes(1);

      await vi.advanceTimersByTimeAsync(2000);
      expect(mockQbService.sync.maindata).toHaveBeenCalledTimes(2);

      // The next attempt is due 5s after the second failure (t=7s); ticks at 4s and 6s are skipped.
      await vi.advanceTimersByTimeAsync(4000);
      expect(mockQbService.sync.maindata).toHaveBeenCalledTimes(2);
      await vi.advanceTimersByTimeAsync(2000);
      expect(mockQbService.sync.maindata).toHaveBeenCalledTimes(3);
      sub.unsubscribe();
    });

    it('goes back to connected with one toast when a poll succeeds again', async () => {
      mockQbService.sync.maindata.mockRejectedValueOnce(unreachable());
      mockQbService.sync.maindata.mockResolvedValue({ rid: 5 });

      const sub = service.startMaindataPolling('server-1').subscribe();
      await vi.advanceTimersByTimeAsync(0);
      expect(service.linkState()).toBe('reconnecting');

      await vi.advanceTimersByTimeAsync(2000);
      expect(service.linkState()).toBe('connected');
      expect(mockToast.success).toHaveBeenCalledTimes(1);
      sub.unsubscribe();
    });

    it('does not toast a recovery when the link never went down', async () => {
      const sub = service.startMaindataPolling('server-1').subscribe();
      await vi.advanceTimersByTimeAsync(4000);

      expect(mockToast.success).not.toHaveBeenCalled();
      expect(mockToast.warning).not.toHaveBeenCalled();
      sub.unsubscribe();
    });

    it('logs out with a toast once the server has been unreachable for 2 minutes', async () => {
      mockQbService.sync.maindata.mockRejectedValue(unreachable());
      const stopSpy = vi.spyOn(service, 'stopPolling');

      const sub = service.startMaindataPolling('server-1').subscribe();
      await vi.advanceTimersByTimeAsync(119_000);
      expect(mockQbService.forceLogout).not.toHaveBeenCalled();

      // The give-up check runs on the first failed attempt past 2 minutes; attempts sit on the 2s
      // poll ticks and the last backoff step is 15s, so allow for that.
      await vi.advanceTimersByTimeAsync(15_000);
      expect(stopSpy).toHaveBeenCalled();
      expect(mockToast.danger).toHaveBeenCalledTimes(1);
      expect(mockQbService.forceLogout).toHaveBeenCalledWith('server-1');
      expect(service.linkState()).toBe('connected');
      sub.unsubscribe();
    });

    it('does not treat other errors as a lost link', async () => {
      mockQbService.sync.maindata.mockRejectedValue(new QbError('FAILED', 'boom'));

      const sub = service.startMaindataPolling('server-1').subscribe();
      await vi.advanceTimersByTimeAsync(0);

      expect(service.linkState()).toBe('connected');
      expect(mockToast.warning).not.toHaveBeenCalled();
      sub.unsubscribe();
    });

    it('keeps polling peers after a failed tick', async () => {
      mockQbService.sync.torrentPeers.mockRejectedValueOnce(new QbError('FAILED', 'boom'));

      const sub = service.startPeersPolling('server-1', 'abc').subscribe();
      await vi.advanceTimersByTimeAsync(0);
      expect(mockQbService.sync.torrentPeers).toHaveBeenCalledTimes(1);

      await vi.advanceTimersByTimeAsync(2000);
      expect(mockQbService.sync.torrentPeers).toHaveBeenCalledTimes(2);
      sub.unsubscribe();
    });

    it('skips peers polling while the link is down', async () => {
      mockQbService.sync.maindata.mockRejectedValue(unreachable());

      const main = service.startMaindataPolling('server-1').subscribe();
      await vi.advanceTimersByTimeAsync(0);
      const peers = service.startPeersPolling('server-1', 'abc').subscribe();
      await vi.advanceTimersByTimeAsync(2000);

      expect(mockQbService.sync.torrentPeers).not.toHaveBeenCalled();
      main.unsubscribe();
      peers.unsubscribe();
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
