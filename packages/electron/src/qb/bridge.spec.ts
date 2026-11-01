import { QB_METHODS } from '@bitbutler/shared';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { QbBridgeError } from './errors.js';

const ipcHandlers = vi.hoisted(() => new Map<string, (...args: unknown[]) => unknown>());

const mocks = vi.hoisted(() => {
  const fns = (names: string[]): Record<string, ReturnType<typeof vi.fn>> =>
    Object.fromEntries(names.map((n) => [n, vi.fn()]));
  return {
    auth: fns(['loginServer', 'logoutServer', 'hasCookieFor']),
    torrents: fns([
      'stop',
      'start',
      'remove',
      'recheck',
      'reannounce',
      'increasePrio',
      'decreasePrio',
      'topPrio',
      'bottomPrio',
      'setForceStart',
      'setSuperSeeding',
      'setAutoManagement',
      'toggleSequentialDownload',
      'toggleFirstLastPiecePrio',
    ]),
    details: fns([
      'properties',
      'info',
      'trackers',
      'files',
      'setLocation',
      'rename',
      'renameFile',
      'renameFolder',
      'filePrio',
      'setShareLimits',
      'downloadLimit',
      'uploadLimit',
      'setDownloadLimit',
      'setUploadLimit',
      'setDownloadPath',
    ]),
    labels: fns([
      'tags',
      'createTags',
      'deleteTags',
      'addTags',
      'removeTags',
      'removeAllTags',
      'categories',
      'createCategory',
      'editCategory',
      'removeCategories',
      'setCategory',
      'clearCategory',
    ]),
    transfer: fns([
      'downloadLimit',
      'setDownloadLimit',
      'uploadLimit',
      'setUploadLimit',
      'speedLimitsMode',
      'toggleSpeedLimitsMode',
    ]),
    app: fns(['preferences', 'setPreferences', 'logMain', 'logPeers', 'maindata', 'torrentPeers']),
  };
});

vi.mock('electron', () => ({
  ipcMain: {
    handle: vi.fn((channel: string, handler: (...args: unknown[]) => unknown) => {
      ipcHandlers.set(channel, handler);
    }),
  },
}));

vi.mock('../ipc/qbittorrent.js', () => mocks.auth);
vi.mock('./torrents.js', () => mocks.torrents);
vi.mock('./torrent-details.js', () => mocks.details);
vi.mock('./labels.js', () => mocks.labels);
vi.mock('./transfer.js', () => mocks.transfer);
vi.mock('./app.js', () => mocks.app);

describe('qbHandlers', () => {
  it('has exactly one handler per bridge method', async () => {
    const { qbHandlers } = await import('./bridge.js');
    expect(new Set(Object.keys(qbHandlers))).toEqual(new Set(QB_METHODS));
    expect(Object.keys(qbHandlers)).toHaveLength(QB_METHODS.length);
  });
});

describe('qb:call IPC handler', () => {
  beforeEach(() => {
    ipcHandlers.clear();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  async function setup() {
    const { registerQbBridgeHandlers } = await import('./bridge.js');
    registerQbBridgeHandlers();
    return ipcHandlers.get('qb:call')!;
  }

  it('dispatches a known method and wraps its data', async () => {
    mocks.torrents.stop.mockResolvedValue(undefined);
    mocks.details.properties.mockResolvedValue({ save_path: '/x' });
    const handler = await setup();

    expect(await handler(null, 'torrents.stop', ['srv-1', ['h1']])).toEqual({
      ok: true,
      data: undefined,
    });
    expect(mocks.torrents.stop).toHaveBeenCalledWith('srv-1', ['h1']);

    expect(await handler(null, 'torrents.properties', ['srv-1', 'h1'])).toEqual({
      ok: true,
      data: { save_path: '/x' },
    });
  });

  it('routes renamed and colliding names to the right domain function', async () => {
    mocks.torrents.remove.mockResolvedValue('ok');
    mocks.details.downloadLimit.mockResolvedValue({ h1: 5 });
    mocks.transfer.downloadLimit.mockResolvedValue(10);
    mocks.app.logMain.mockResolvedValue([]);
    mocks.app.maindata.mockResolvedValue({ rid: 1 });
    const handler = await setup();

    expect(await handler(null, 'torrents.delete', ['srv-1', ['h1'], true])).toEqual({
      ok: true,
      data: 'ok',
    });
    expect(mocks.torrents.remove).toHaveBeenCalledWith('srv-1', ['h1'], true);

    expect(await handler(null, 'torrents.downloadLimit', ['srv-1', ['h1']])).toEqual({
      ok: true,
      data: { h1: 5 },
    });
    expect(await handler(null, 'transfer.downloadLimit', ['srv-1'])).toEqual({
      ok: true,
      data: 10,
    });
    expect(await handler(null, 'log.main', ['srv-1', { info: true }])).toEqual({
      ok: true,
      data: [],
    });
    expect(mocks.app.logMain).toHaveBeenCalledWith('srv-1', { info: true });
    expect(await handler(null, 'sync.maindata', ['srv-1', 0])).toEqual({
      ok: true,
      data: { rid: 1 },
    });
  });

  it('routes the auth methods to the session functions', async () => {
    mocks.auth.loginServer.mockResolvedValue({ loggedIn: true });
    mocks.auth.logoutServer.mockReturnValue({ loggedOut: true });
    mocks.auth.hasCookieFor.mockReturnValue(true);
    const handler = await setup();

    expect(await handler(null, 'auth.login', ['srv-1', 'u', 'p'])).toEqual({
      ok: true,
      data: { loggedIn: true },
    });
    expect(mocks.auth.loginServer).toHaveBeenCalledWith('srv-1', 'u', 'p');
    expect(await handler(null, 'auth.logout', ['srv-1'])).toEqual({
      ok: true,
      data: { loggedOut: true },
    });
    expect(await handler(null, 'auth.hasCookie', ['srv-1'])).toEqual({ ok: true, data: true });
  });

  it('maps a 403 on login to FORBIDDEN but elsewhere to UNAUTHENTICATED', async () => {
    const http403 = JSON.stringify({ name: 'QbHttpError', status: 403, body: 'Banned' });
    mocks.auth.loginServer.mockRejectedValue(http403);
    mocks.labels.tags.mockRejectedValue(http403);
    const handler = await setup();

    expect(await handler(null, 'auth.login', ['srv-1'])).toEqual({
      ok: false,
      code: 'FORBIDDEN',
      message: 'Banned',
    });
    expect(await handler(null, 'torrents.tags', ['srv-1'])).toEqual({
      ok: false,
      code: 'UNAUTHENTICATED',
      message: 'Banned',
    });
  });

  it.each([
    ['an unknown name', 'torrents.nope', ['srv-1']],
    ['a non-string method', 42, ['srv-1']],
    ['an object method with a broken toString', { toString: 1 }, ['srv-1']],
    ['non-array args', 'torrents.stop', 'srv-1'],
    ['undefined args', 'torrents.stop', undefined],
    ['__proto__.x', '__proto__.x', []],
    ['__proto__', '__proto__', []],
    ['constructor', 'constructor', []],
    ['toString', 'toString', []],
    ['hasOwnProperty', 'hasOwnProperty', []],
  ])('returns INVALID for %s', async (_label, method, args) => {
    const handler = await setup();
    const result = (await handler(null, method, args)) as { ok: boolean; code?: string };
    expect(result.ok).toBe(false);
    expect(result.code).toBe('INVALID');
    expect(mocks.torrents.stop).not.toHaveBeenCalled();
  });

  it('passes a QbBridgeError code and message through', async () => {
    mocks.torrents.recheck.mockRejectedValue(new QbBridgeError('CONFLICT', 'x'));
    const handler = await setup();
    expect(await handler(null, 'torrents.recheck', ['srv-1', ['h1']])).toEqual({
      ok: false,
      code: 'CONFLICT',
      message: 'x',
    });
  });

  it('maps a thrown plain string to FAILED', async () => {
    mocks.torrents.recheck.mockRejectedValue('boom');
    const handler = await setup();
    expect(await handler(null, 'torrents.recheck', ['srv-1', ['h1']])).toEqual({
      ok: false,
      code: 'FAILED',
      message: 'boom',
    });
  });

  it('never rejects, even when a handler throws synchronously', async () => {
    mocks.auth.hasCookieFor.mockImplementation(() => {
      throw new Error('sync failure');
    });
    const handler = await setup();
    await expect(handler(null, 'auth.hasCookie', ['srv-1'])).resolves.toEqual({
      ok: false,
      code: 'FAILED',
      message: 'sync failure',
    });
    await expect(handler(null, null, null)).resolves.toMatchObject({ ok: false, code: 'INVALID' });
  });
});
