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
    const result = await service.login('server-1');
    expect(spy).toHaveBeenCalledWith({ id: 'server-1' });
    expect(result).toEqual({ loggedIn: true });
  });

  it('should delegate logout() to window.bitbutler.qb.logout', async () => {
    const spy = vi
      .spyOn(window.bitbutler.qb, 'logout')
      .mockResolvedValue({ loggedOut: true } as any);
    const result = await service.logout('server-1');
    expect(spy).toHaveBeenCalledWith({ id: 'server-1' });
    expect(result).toEqual({ loggedOut: true });
  });

  it('should unwrap hasCookie result and return a boolean', async () => {
    const spy = vi
      .spyOn(window.bitbutler.qb, 'hasCookie')
      .mockResolvedValue({ hasCookie: true } as any);
    const result = await service.hasCookie('server-1');
    expect(spy).toHaveBeenCalledWith({ id: 'server-1' });
    expect(result).toBe(true);
  });

  it('should expose streamMaindata() as an observable', () => {
    vi.spyOn(window.bitbutler.qb, 'onSyncChunk').mockReturnValue(() => {});
    vi.spyOn(window.bitbutler.qb, 'startSyncStream').mockReturnValue(undefined as any);
    const obs = service.streamMaindata('server-1', 0);
    expect(typeof obs.subscribe).toBe('function');
  });

  it('should call startSyncStream when streamMaindata is subscribed', () => {
    const startSpy = vi
      .spyOn(window.bitbutler.qb, 'startSyncStream')
      .mockReturnValue(undefined as any);
    vi.spyOn(window.bitbutler.qb, 'onSyncChunk').mockReturnValue(() => {});

    const sub = service.streamMaindata('server-1', 5, 'name', true).subscribe();
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
    await service.maindata('server-1', 0);
    expect(spy).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'server-1', path: '/api/v2/sync/maindata' }),
    );
  });
});
