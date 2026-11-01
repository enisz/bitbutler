import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { type IpcResult, QB_METHODS } from '@bitbutler/shared';
import { TranslateService } from '@ngx-translate/core';
import { QbError } from '../models/qb-error.model';
import { QbService } from './qb.service';
import { ServerStoreService } from './server-store.service';
import { ToastService } from './toast.service';

type AnyFn = (...args: unknown[]) => Promise<unknown>;
type Group = Record<string, AnyFn>;

const ok = <T>(data: T): IpcResult<T> => ({ ok: true, data });

// QbService method names that differ from the bridge method they delegate to.
const BRIDGE_NAME: Record<string, string> = {
  'torrents.pause': 'stop',
  'torrents.resume': 'start',
};

// Trailing QbService-only parameters (renderer options) that are not forwarded to the bridge.
const SERVICE_ONLY_PARAMS: Record<string, number> = {
  'torrents.files': 1,
};

const GROUPS = ['auth', 'app', 'log', 'sync', 'torrents', 'transfer'] as const;

describe('QbService', () => {
  let service: QbService;
  let toastMock: { danger: ReturnType<typeof vi.fn>; showText: ReturnType<typeof vi.fn> };

  const bridgeGroup = (group: string): Group =>
    (window.bitbutler.qb as unknown as Record<string, Group>)[group];

  beforeEach(() => {
    toastMock = { danger: vi.fn(), showText: vi.fn() };
    TestBed.configureTestingModule({
      providers: [
        QbService,
        { provide: ToastService, useValue: toastMock },
        {
          provide: ServerStoreService,
          useValue: { suppressAutoLoginUntilManualConnect: vi.fn(), clearSelection: vi.fn() },
        },
        { provide: Router, useValue: { navigate: vi.fn().mockResolvedValue(true) } },
        { provide: TranslateService, useValue: { instant: (key: string) => key } },
      ],
    });
    service = TestBed.inject(QbService);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('unwraps the data of a successful result', async () => {
    vi.spyOn(window.bitbutler.qb.torrents, 'tags').mockResolvedValue(ok(['a', 'b']));

    await expect(service.torrents.tags('s1')).resolves.toEqual(['a', 'b']);
    expect(toastMock.danger).not.toHaveBeenCalled();
  });

  it('throws a QbError with the same code and message and shows one danger toast', async () => {
    vi.spyOn(window.bitbutler.qb.torrents, 'createCategory').mockResolvedValue({
      ok: false,
      code: 'CONFLICT',
      message: 'Category already exists',
    });

    const error = await service.torrents.createCategory('s1', 'movies', '/m').catch((e) => e);

    expect(error).toBeInstanceOf(QbError);
    expect(error).toMatchObject({ code: 'CONFLICT', message: 'Category already exists' });
    expect(toastMock.danger).toHaveBeenCalledTimes(1);
    expect(toastMock.danger).toHaveBeenCalledWith(
      'Category already exists',
      'services.qb.error.request-failed-title',
    );
  });

  it('shows no toast with suppressErrors but still throws', async () => {
    vi.spyOn(window.bitbutler.qb.torrents, 'files').mockResolvedValue({
      ok: false,
      code: 'NOT_FOUND',
      message: 'Torrent not found',
    });

    const error = await service.torrents.files('s1', 'h', { suppressErrors: true }).catch((e) => e);

    expect(error).toBeInstanceOf(QbError);
    expect(error.code).toBe('NOT_FOUND');
    expect(toastMock.danger).not.toHaveBeenCalled();
    expect(toastMock.showText).not.toHaveBeenCalled();
  });

  it('retries UNREACHABLE with backoff and resolves after 2 retries', async () => {
    vi.useFakeTimers();
    const unreachable: IpcResult<never> = { ok: false, code: 'UNREACHABLE', message: 'down' };
    const spy = vi
      .spyOn(window.bitbutler.qb.sync, 'maindata')
      .mockResolvedValueOnce(unreachable)
      .mockResolvedValueOnce(unreachable)
      .mockResolvedValueOnce(ok({ rid: 3 } as never));

    const pending = service.sync.maindata('s1', 0);
    await vi.advanceTimersByTimeAsync(1000 + 2000);

    await expect(pending).resolves.toEqual({ rid: 3 });
    expect(spy).toHaveBeenCalledTimes(3);
    expect(toastMock.showText).toHaveBeenCalledTimes(2);
    for (const [message, opts] of toastMock.showText.mock.calls) {
      expect(message).toBe('services.qb.warning.connection-retry-message');
      expect(opts).toEqual({
        type: 'warning',
        title: 'services.qb.warning.connection-retry-title',
        notifyOs: false,
      });
    }
    expect(toastMock.danger).not.toHaveBeenCalled();
  });

  it('throws after 3 retries when UNREACHABLE persists', async () => {
    vi.useFakeTimers();
    const spy = vi
      .spyOn(window.bitbutler.qb.sync, 'maindata')
      .mockResolvedValue({ ok: false, code: 'UNREACHABLE', message: 'down' });

    const pending = service.sync.maindata('s1', 0).catch((e) => e);
    await vi.advanceTimersByTimeAsync(1000 + 2000 + 3000);
    const error = await pending;

    expect(error).toBeInstanceOf(QbError);
    expect(error).toMatchObject({ code: 'UNREACHABLE', message: 'down' });
    expect(spy).toHaveBeenCalledTimes(4);
    expect(toastMock.showText).toHaveBeenCalledTimes(3);
    expect(toastMock.danger).toHaveBeenCalledTimes(1);
  });

  it('logs out once on UNAUTHENTICATED and throws', async () => {
    vi.spyOn(window.bitbutler.qb.app, 'preferences').mockResolvedValue({
      ok: false,
      code: 'UNAUTHENTICATED',
      message: 'Session expired',
    });
    const forceLogout = vi.spyOn(service, 'forceLogout').mockResolvedValue();

    const error = await service.app.preferences('s1').catch((e) => e);

    expect(forceLogout).toHaveBeenCalledTimes(1);
    expect(forceLogout).toHaveBeenCalledWith('s1');
    expect(error).toBeInstanceOf(QbError);
    expect(error.code).toBe('UNAUTHENTICATED');
  });

  it('delegates torrents.pause to bridge stop and torrents.resume to bridge start', async () => {
    const stop = vi.spyOn(window.bitbutler.qb.torrents, 'stop').mockResolvedValue(ok(undefined));
    const start = vi.spyOn(window.bitbutler.qb.torrents, 'start').mockResolvedValue(ok(undefined));

    await service.torrents.pause('s1', ['a']);
    await service.torrents.resume('s1', ['b']);
    await service.torrents.pause('s1', 'all');

    expect(stop).toHaveBeenNthCalledWith(1, 's1', ['a']);
    expect(stop).toHaveBeenNthCalledWith(2, 's1', 'all');
    expect(start).toHaveBeenCalledWith('s1', ['b']);
  });

  it('returns the hasCookie boolean', async () => {
    vi.spyOn(window.bitbutler.qb.auth, 'hasCookie').mockResolvedValue(ok(true));

    await expect(service.auth.hasCookie('s1')).resolves.toBe(true);
  });

  it('returns the login result', async () => {
    const spy = vi
      .spyOn(window.bitbutler.qb.auth, 'login')
      .mockResolvedValue(ok({ loggedIn: true }));

    await expect(service.auth.login('s1', 'user', 'pass')).resolves.toEqual({ loggedIn: true });
    expect(spy).toHaveBeenCalledWith('s1', 'user', 'pass');
  });

  it('throws a QbError from a failed login without any toast, retry or logout', async () => {
    const spy = vi
      .spyOn(window.bitbutler.qb.auth, 'login')
      .mockResolvedValue({ ok: false, code: 'UNREACHABLE', message: 'Connection refused' });
    const forceLogout = vi.spyOn(service, 'forceLogout');

    const error = await service.auth.login('s1').catch((e) => e);

    expect(error).toBeInstanceOf(QbError);
    expect(error).toMatchObject({ code: 'UNREACHABLE', message: 'Connection refused' });
    expect(spy).toHaveBeenCalledTimes(1);
    expect(forceLogout).not.toHaveBeenCalled();
    expect(toastMock.danger).not.toHaveBeenCalled();
    expect(toastMock.showText).not.toHaveBeenCalled();
  });

  it('converts a rejected bridge promise into a FAILED QbError', async () => {
    vi.spyOn(window.bitbutler.qb.transfer, 'downloadLimit').mockRejectedValue(
      new Error('IPC broke'),
    );

    const error = await service.transfer.downloadLimit('s1').catch((e) => e);

    expect(error).toBeInstanceOf(QbError);
    expect(error).toMatchObject({ code: 'FAILED', message: 'IPC broke' });
    expect(toastMock.danger).toHaveBeenCalledTimes(1);
  });

  it('converts a rejected auth bridge promise into a FAILED QbError', async () => {
    vi.spyOn(window.bitbutler.qb.auth, 'logout').mockRejectedValue(new Error('IPC broke'));

    const error = await service.auth.logout('s1').catch((e) => e);

    expect(error).toBeInstanceOf(QbError);
    expect(error).toMatchObject({ code: 'FAILED', message: 'IPC broke' });
  });

  describe('forwards every method to the same-named bridge method', () => {
    it('covers exactly the bridge methods', () => {
      const mapped = GROUPS.flatMap((group) =>
        Object.keys((service as unknown as Record<string, Group>)[group]).map(
          (name) => `${group}.${BRIDGE_NAME[`${group}.${name}`] ?? name}`,
        ),
      );
      expect([...mapped].sort()).toEqual([...QB_METHODS].sort());
    });

    it.each(GROUPS)('%s group', async (group) => {
      const serviceGroup = (service as unknown as Record<string, Group>)[group];
      const names = Object.keys(serviceGroup);
      expect(names.length).toBeGreaterThan(0);

      for (const name of names) {
        const key = `${group}.${name}`;
        const bridgeName = BRIDGE_NAME[key] ?? name;
        const bridgeFn = bridgeGroup(group)[bridgeName];
        expect(bridgeFn, `bridge method for ${key}`).toBeTypeOf('function');

        const spy = vi.spyOn(bridgeGroup(group), bridgeName).mockResolvedValue(ok(`r:${key}`));
        const forwarded = serviceGroup[name].length - (SERVICE_ONLY_PARAMS[key] ?? 0);
        const args = ['s1', ...Array.from({ length: forwarded - 1 }, (_, i) => ({ arg: i }))];

        await serviceGroup[name](...args);

        expect(spy, key).toHaveBeenCalledTimes(1);
        expect(spy, key).toHaveBeenCalledWith(...args);
      }
    });
  });
});
