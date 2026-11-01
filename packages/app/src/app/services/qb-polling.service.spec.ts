import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import type { QbPollEvent } from '@bitbutler/shared';
import { TranslateService } from '@ngx-translate/core';
import { Subject, firstValueFrom } from 'rxjs';
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
  let settings$: Subject<unknown>;
  let emit: (event: QbPollEvent) => void;
  let unsubscribeEvents: ReturnType<typeof vi.fn<() => void>>;

  const flush = async (): Promise<void> => {
    for (let i = 0; i < 6; i++) await Promise.resolve();
  };

  beforeEach(() => {
    mockQbService = {
      poll: {
        start: vi.fn().mockResolvedValue(undefined),
        stop: vi.fn().mockResolvedValue(undefined),
        configure: vi.fn().mockResolvedValue(undefined),
        startPeers: vi.fn().mockResolvedValue(undefined),
        stopPeers: vi.fn().mockResolvedValue(undefined),
      },
      forceLogout: vi.fn().mockResolvedValue(undefined),
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

    settings$ = new Subject();
    mockServerSettings = {
      load: vi.fn().mockResolvedValue({ polling: { foreground: 2000, background: 5000 } }),
      asObservable: vi.fn().mockReturnValue(settings$),
    };

    mockTorrentStore = { clear: vi.fn() };
    mockToast = { success: vi.fn(), warning: vi.fn(), danger: vi.fn() };

    unsubscribeEvents = vi.fn<() => void>();
    emit = () => {};
    vi.spyOn(window.bitbutler.qbPoll, 'onEvent').mockImplementation((callback) => {
      emit = callback;
      return () => unsubscribeEvents();
    });
    vi.spyOn(console, 'warn').mockImplementation(() => {});

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

  it('starts with the defaults', async () => {
    expect(await firstValueFrom(service.isInitialLoading$)).toBe(false);
    expect(await firstValueFrom(service.isPaused$)).toBe(false);
    expect(service.getPollingInterval()).toBe(2000);
    expect(service.linkState()).toBe('connected');
  });

  describe('starting and stopping the maindata loop', () => {
    it('configures the loop and starts it fresh for a new server', async () => {
      const sub = service.startMaindataPolling('server-1').subscribe();
      await flush();

      expect(mockQbService.poll.configure).toHaveBeenCalledWith({ pollMs: 2000, paused: false });
      expect(mockQbService.poll.start).toHaveBeenCalledWith('server-1', true);
      sub.unsubscribe();
    });

    it('stops the loop when the subscription ends and stops listening for events', async () => {
      const sub = service.startMaindataPolling('server-1').subscribe();
      await flush();

      sub.unsubscribe();

      expect(mockQbService.poll.stop).toHaveBeenCalledTimes(1);
      expect(unsubscribeEvents).toHaveBeenCalled();
    });

    it('stops a previous subscription when polling is started again', async () => {
      const first = vi.fn();
      service.startMaindataPolling('server-1').subscribe({ complete: first });
      await flush();

      service.startMaindataPolling('server-2').subscribe();
      await flush();

      expect(first).toHaveBeenCalled();
    });

    it('resumes the same server without a fresh start, but starts fresh for another server', async () => {
      service.startMaindataPolling('server-1').subscribe().unsubscribe();
      service.startMaindataPolling('server-1').subscribe().unsubscribe();
      service.startMaindataPolling('server-2').subscribe().unsubscribe();

      expect(mockQbService.poll.start.mock.calls).toEqual([
        ['server-1', true],
        ['server-1', false],
        ['server-2', true],
      ]);
    });

    it('starts fresh again after stopPolling()', async () => {
      service.startMaindataPolling('server-1').subscribe().unsubscribe();
      service.stopPolling();
      service.startMaindataPolling('server-1').subscribe().unsubscribe();

      expect(mockQbService.poll.start).toHaveBeenLastCalledWith('server-1', true);
    });

    it('clears the torrent store on a fresh start only', async () => {
      service.startMaindataPolling('server-1').subscribe().unsubscribe();
      expect(mockTorrentStore.clear).toHaveBeenCalledTimes(1);

      service.startMaindataPolling('server-1').subscribe().unsubscribe();
      expect(mockTorrentStore.clear).toHaveBeenCalledTimes(1);

      service.startMaindataPolling('server-2').subscribe().unsubscribe();
      expect(mockTorrentStore.clear).toHaveBeenCalledTimes(2);
    });

    it('ends the stream and resets state on stopPolling()', async () => {
      const complete = vi.fn();
      service.startMaindataPolling('server-1').subscribe({ complete });
      await flush();

      service.stopPolling();

      expect(complete).toHaveBeenCalled();
      expect(mockQbService.poll.stop).toHaveBeenCalled();
      expect(await firstValueFrom(service.isInitialLoading$)).toBe(false);
    });
  });

  describe('pushed events', () => {
    it('passes maindata chunks for the polled server to the subscriber, and ignores others', async () => {
      const chunks: unknown[] = [];
      const sub = service.startMaindataPolling('server-1').subscribe((c) => chunks.push(c));
      await flush();

      emit({ type: 'maindata', serverId: 'server-1', data: { rid: 3 } as never });
      emit({ type: 'maindata', serverId: 'server-2', data: { rid: 9 } as never });

      expect(chunks).toEqual([{ rid: 3 }]);
      sub.unsubscribe();
    });

    it('is loading until the first chunk arrives', async () => {
      const sub = service.startMaindataPolling('server-1').subscribe();
      await flush();
      expect(await firstValueFrom(service.isInitialLoading$)).toBe(true);

      emit({ type: 'maindata', serverId: 'server-1', data: { rid: 1 } as never });

      expect(await firstValueFrom(service.isInitialLoading$)).toBe(false);
      sub.unsubscribe();
    });

    it('stops being loading when the first poll fails or the link drops', async () => {
      const sub = service.startMaindataPolling('server-1').subscribe();
      await flush();

      emit({ type: 'failed', serverId: 'server-1' });
      expect(await firstValueFrom(service.isInitialLoading$)).toBe(false);
      sub.unsubscribe();

      const sub2 = service.startMaindataPolling('server-2').subscribe();
      await flush();
      expect(await firstValueFrom(service.isInitialLoading$)).toBe(true);
      emit({ type: 'link', serverId: 'server-2', state: 'reconnecting' });
      expect(await firstValueFrom(service.isInitialLoading$)).toBe(false);
      sub2.unsubscribe();
    });

    it('emits onPoll$ for every tick', async () => {
      const ticks = vi.fn();
      service.onPoll$.subscribe(ticks);
      const sub = service.startMaindataPolling('server-1').subscribe();
      await flush();

      emit({ type: 'tick' });
      emit({ type: 'tick' });

      expect(ticks).toHaveBeenCalledTimes(2);
      sub.unsubscribe();
    });
  });

  describe('link events', () => {
    it('shows reconnecting with a warning toast, then connected with a success toast', async () => {
      const sub = service.startMaindataPolling('server-1').subscribe();
      await flush();

      emit({ type: 'link', serverId: 'server-1', state: 'reconnecting' });
      expect(service.linkState()).toBe('reconnecting');
      expect(mockToast.warning).toHaveBeenCalledTimes(1);

      emit({ type: 'link', serverId: 'server-1', state: 'connected' });
      expect(service.linkState()).toBe('connected');
      expect(mockToast.success).toHaveBeenCalledTimes(1);
      sub.unsubscribe();
    });

    it('logs out and stops when the session expired, without a toast', async () => {
      const complete = vi.fn();
      service.startMaindataPolling('server-1').subscribe({ complete });
      await flush();

      emit({ type: 'link', serverId: 'server-1', state: 'expired' });

      expect(complete).toHaveBeenCalled();
      expect(mockQbService.forceLogout).toHaveBeenCalledWith('server-1');
      expect(mockToast.danger).not.toHaveBeenCalled();
    });

    it('logs out with a toast and stops when the grace period ran out', async () => {
      const complete = vi.fn();
      service.startMaindataPolling('server-1').subscribe({ complete });
      await flush();

      emit({ type: 'link', serverId: 'server-1', state: 'reconnecting' });
      emit({ type: 'link', serverId: 'server-1', state: 'gave-up' });

      expect(complete).toHaveBeenCalled();
      expect(mockToast.danger).toHaveBeenCalledTimes(1);
      expect(mockQbService.forceLogout).toHaveBeenCalledWith('server-1');
      expect(service.linkState()).toBe('connected');
    });

    it('ignores link events for another server', async () => {
      const sub = service.startMaindataPolling('server-1').subscribe();
      await flush();

      emit({ type: 'link', serverId: 'server-2', state: 'gave-up' });

      expect(mockQbService.forceLogout).not.toHaveBeenCalled();
      expect(mockToast.danger).not.toHaveBeenCalled();
      sub.unsubscribe();
    });
  });

  describe('loop configuration', () => {
    it('uses the foreground interval from the server settings', async () => {
      const sub = service.startMaindataPolling('server-1').subscribe();
      await flush();

      settings$.next({ polling: { foreground: 3000, background: 8000 } });

      expect(mockQbService.poll.configure).toHaveBeenLastCalledWith({
        pollMs: 3000,
        paused: false,
      });
      expect(service.getPollingInterval()).toBe(3000);
      sub.unsubscribe();
    });

    it('uses the background interval while the window is minimized', async () => {
      const sub = service.startMaindataPolling('server-1').subscribe();
      await flush();

      mockWindowService.state.set({ ...mockWindowService.state(), isMinimized: true });
      TestBed.tick();
      await flush();

      expect(mockQbService.poll.configure).toHaveBeenLastCalledWith({
        pollMs: 5000,
        paused: false,
      });
      sub.unsubscribe();
    });

    it('tells the loop to pause while a pause token is held, and keeps the last interval', async () => {
      const sub = service.startMaindataPolling('server-1').subscribe();
      await flush();

      const token = service.pause();
      expect(mockQbService.poll.configure).toHaveBeenLastCalledWith({ pollMs: 2000, paused: true });
      expect(await firstValueFrom(service.isPaused$)).toBe(true);

      service.resume(token);
      expect(mockQbService.poll.configure).toHaveBeenLastCalledWith({
        pollMs: 2000,
        paused: false,
      });
      sub.unsubscribe();
    });

    it('stays paused until every token is returned', async () => {
      const a = service.pause();
      const b = service.pause();
      service.resume(a);
      expect(await firstValueFrom(service.isPaused$)).toBe(true);
      service.resume(b);
      expect(await firstValueFrom(service.isPaused$)).toBe(false);
    });

    it('clears every pause token on stopPolling()', async () => {
      service.pause();
      service.stopPolling();
      expect(await firstValueFrom(service.isPaused$)).toBe(false);
    });
  });

  describe('startPeersPolling', () => {
    it('starts the peers loop on subscribe and stops it when the subscription ends', async () => {
      const sub = service.startPeersPolling('server-1', 'abc').subscribe();
      await flush();
      expect(mockQbService.poll.startPeers).toHaveBeenCalledWith('server-1', 'abc');

      sub.unsubscribe();

      expect(mockQbService.poll.stopPeers).toHaveBeenCalledWith('server-1', 'abc');
      expect(unsubscribeEvents).toHaveBeenCalled();
    });

    it('passes on only the peers pushed for that torrent', async () => {
      const received: unknown[] = [];
      const sub = service.startPeersPolling('server-1', 'abc').subscribe((p) => received.push(p));
      await flush();

      emit({ type: 'peers', serverId: 'server-1', hash: 'abc', data: { rid: 2 } as never });
      emit({ type: 'peers', serverId: 'server-1', hash: 'other', data: { rid: 7 } as never });
      emit({ type: 'peers', serverId: 'server-2', hash: 'abc', data: { rid: 8 } as never });

      expect(received).toEqual([{ rid: 2 }]);
      sub.unsubscribe();
    });

    it('ends when polling is stopped', async () => {
      const complete = vi.fn();
      service.startPeersPolling('server-1', 'abc').subscribe({ complete });
      await flush();

      service.stopPolling();

      expect(complete).toHaveBeenCalled();
    });
  });
});
