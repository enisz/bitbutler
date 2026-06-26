import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { QbService } from './qb.service';
import { ServerStoreService } from './server-store.service';
import { ToastService } from './toast.service';

describe('QbService', () => {
  let service: QbService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        QbService,
        { provide: ToastService, useValue: { danger: vi.fn() } },
        { provide: ServerStoreService, useValue: {} },
        { provide: Router, useValue: { navigate: vi.fn() } },
      ],
    });
    service = TestBed.inject(QbService);
  });

  it('should delegate login() to window.bitbutler.qb.login', async () => {
    const spy = vi.spyOn(window.bitbutler.qb, 'login').mockResolvedValue({ loggedIn: true } as any);
    const result = await service.auth.login('server-1');
    expect(spy).toHaveBeenCalledWith({ id: 'server-1' });
    expect(result).toEqual({ loggedIn: true });
  });

  it('should delegate logout() to window.bitbutler.qb.logout', async () => {
    const spy = vi
      .spyOn(window.bitbutler.qb, 'logout')
      .mockResolvedValue({ loggedOut: true } as any);
    const result = await service.auth.logout('server-1');
    expect(spy).toHaveBeenCalledWith({ id: 'server-1' });
    expect(result).toEqual({ loggedOut: true });
  });

  it('should unwrap hasCookie result and return a boolean', async () => {
    const spy = vi
      .spyOn(window.bitbutler.qb, 'hasCookie')
      .mockResolvedValue({ hasCookie: true } as any);
    const result = await service.auth.hasCookie('server-1');
    expect(spy).toHaveBeenCalledWith({ id: 'server-1' });
    expect(result).toBe(true);
  });

  it('should expose streamMaindata() as an observable', () => {
    vi.spyOn(window.bitbutler.qb, 'onSyncChunk').mockReturnValue(() => {});
    vi.spyOn(window.bitbutler.qb, 'startSyncStream').mockReturnValue(undefined as any);
    const obs = service.sync.streamMaindata('server-1', 0);
    expect(typeof obs.subscribe).toBe('function');
  });

  it('should call startSyncStream when streamMaindata is subscribed', () => {
    const startSpy = vi
      .spyOn(window.bitbutler.qb, 'startSyncStream')
      .mockReturnValue(undefined as any);
    vi.spyOn(window.bitbutler.qb, 'onSyncChunk').mockReturnValue(() => {});

    const sub = service.sync.streamMaindata('server-1', 5, 'name', true).subscribe();
    expect(startSpy).toHaveBeenCalledWith({
      id: 'server-1',
      rid: 5,
      sortBy: 'name',
      sortDesc: true,
    });
    sub.unsubscribe();
  });

  it('should call login with server id via maindata()', async () => {
    const spy = vi.spyOn(window.bitbutler.qb, 'request').mockResolvedValue({
      ok: true,
      status: 200,
      statusText: 'OK',
      body: { rid: 1 },
    } as any);
    await service.sync.maindata('server-1', 0);
    expect(spy).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'server-1', path: '/api/v2/sync/maindata' }),
    );
  });

  it('should call log.main with the normal/info/warning/critical query params', async () => {
    const spy = vi.spyOn(window.bitbutler.qb, 'request').mockResolvedValue({
      ok: true,
      status: 200,
      statusText: 'OK',
      body: [],
    } as any);

    await service.log.main('server-1', {
      normal: false,
      info: false,
      warning: true,
      critical: true,
    });

    expect(spy).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'server-1',
        path: '/api/v2/log/main',
        query: { normal: false, info: false, warning: true, critical: true },
      }),
    );
  });

  it('should call log.peers with a last_known_id query param', async () => {
    const spy = vi.spyOn(window.bitbutler.qb, 'request').mockResolvedValue({
      ok: true,
      status: 200,
      statusText: 'OK',
      body: [],
    } as any);

    await service.log.peers('server-1', { last_known_id: 5 });

    expect(spy).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'server-1',
        path: '/api/v2/log/peers',
        query: { last_known_id: 5 },
      }),
    );
  });

  it('should throw HttpError when clearing the category fails', async () => {
    vi.spyOn(service, 'request').mockResolvedValue({
      ok: false,
      status: 409,
      statusText: 'Conflict',
    } as any);

    await expect(service.torrents.clearCategory('server-1', ['hash1'])).rejects.toThrow(
      'Failed to clear category',
    );
  });

  describe('torrents.info()', () => {
    it('calls /api/v2/torrents/info with the correct hash and returns the first torrent', async () => {
      const torrent = { hash: 'abc123', name: 'My Torrent' };
      vi.spyOn(window.bitbutler.qb, 'request').mockResolvedValue([torrent] as any);

      const result = await service.torrents.info('server-1', 'abc123');

      expect(window.bitbutler.qb.request).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'server-1',
          path: '/api/v2/torrents/info',
          method: 'GET',
          query: { hashes: 'abc123' },
        }),
      );
      expect(result).toEqual(torrent);
    });

    it('returns null when the response array is empty', async () => {
      vi.spyOn(window.bitbutler.qb, 'request').mockResolvedValue([] as any);
      const result = await service.torrents.info('server-1', 'abc123');
      expect(result).toBeNull();
    });

    it('rejects when hash is empty', async () => {
      await expect(service.torrents.info('server-1', '')).rejects.toThrow('hash is required');
    });
  });
});
