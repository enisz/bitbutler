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

  // The expected domain function for every bridge name, written out independently of bridge.ts.
  // `arity` trims the forwarded args for the auth wrappers, which take a fixed parameter list.
  const expectedTarget: Record<string, [keyof typeof mocks, string, number?]> = {
    'auth.login': ['auth', 'loginServer', 3],
    'auth.logout': ['auth', 'logoutServer', 1],
    'auth.hasCookie': ['auth', 'hasCookieFor', 1],
    'app.preferences': ['app', 'preferences'],
    'app.setPreferences': ['app', 'setPreferences'],
    'log.main': ['app', 'logMain'],
    'log.peers': ['app', 'logPeers'],
    'sync.maindata': ['app', 'maindata'],
    'sync.torrentPeers': ['app', 'torrentPeers'],
    'torrents.properties': ['details', 'properties'],
    'torrents.info': ['details', 'info'],
    'torrents.trackers': ['details', 'trackers'],
    'torrents.files': ['details', 'files'],
    'torrents.setLocation': ['details', 'setLocation'],
    'torrents.rename': ['details', 'rename'],
    'torrents.renameFile': ['details', 'renameFile'],
    'torrents.renameFolder': ['details', 'renameFolder'],
    'torrents.filePrio': ['details', 'filePrio'],
    'torrents.setShareLimits': ['details', 'setShareLimits'],
    'torrents.downloadLimit': ['details', 'downloadLimit'],
    'torrents.setDownloadLimit': ['details', 'setDownloadLimit'],
    'torrents.uploadLimit': ['details', 'uploadLimit'],
    'torrents.setUploadLimit': ['details', 'setUploadLimit'],
    'torrents.setDownloadPath': ['details', 'setDownloadPath'],
    'torrents.increasePrio': ['torrents', 'increasePrio'],
    'torrents.decreasePrio': ['torrents', 'decreasePrio'],
    'torrents.topPrio': ['torrents', 'topPrio'],
    'torrents.bottomPrio': ['torrents', 'bottomPrio'],
    'torrents.delete': ['torrents', 'remove'],
    'torrents.recheck': ['torrents', 'recheck'],
    'torrents.reannounce': ['torrents', 'reannounce'],
    'torrents.stop': ['torrents', 'stop'],
    'torrents.start': ['torrents', 'start'],
    'torrents.setForceStart': ['torrents', 'setForceStart'],
    'torrents.setSuperSeeding': ['torrents', 'setSuperSeeding'],
    'torrents.setAutoManagement': ['torrents', 'setAutoManagement'],
    'torrents.toggleSequentialDownload': ['torrents', 'toggleSequentialDownload'],
    'torrents.toggleFirstLastPiecePrio': ['torrents', 'toggleFirstLastPiecePrio'],
    'torrents.addTags': ['labels', 'addTags'],
    'torrents.removeTags': ['labels', 'removeTags'],
    'torrents.removeAllTags': ['labels', 'removeAllTags'],
    'torrents.tags': ['labels', 'tags'],
    'torrents.createTags': ['labels', 'createTags'],
    'torrents.deleteTags': ['labels', 'deleteTags'],
    'torrents.setCategory': ['labels', 'setCategory'],
    'torrents.clearCategory': ['labels', 'clearCategory'],
    'torrents.categories': ['labels', 'categories'],
    'torrents.createCategory': ['labels', 'createCategory'],
    'torrents.editCategory': ['labels', 'editCategory'],
    'torrents.removeCategories': ['labels', 'removeCategories'],
    'transfer.downloadLimit': ['transfer', 'downloadLimit'],
    'transfer.setDownloadLimit': ['transfer', 'setDownloadLimit'],
    'transfer.uploadLimit': ['transfer', 'uploadLimit'],
    'transfer.setUploadLimit': ['transfer', 'setUploadLimit'],
    'transfer.speedLimitsMode': ['transfer', 'speedLimitsMode'],
    'transfer.toggleSpeedLimitsMode': ['transfer', 'toggleSpeedLimitsMode'],
  };

  it('has an expected dispatch target for every bridge method', () => {
    expect(new Set(Object.keys(expectedTarget))).toEqual(new Set(QB_METHODS));
  });

  it.each(QB_METHODS.map((name) => [name]))(
    'dispatches %s to its domain function with the args in order',
    async (name) => {
      const [group, fn, arity] = expectedTarget[name];
      const target = mocks[group][fn];
      target.mockResolvedValue('result');
      const args = [`${name}#0`, [`${name}#1`], { v: `${name}#2` }];
      const handler = await setup();

      expect(await handler(null, name, args)).toEqual({ ok: true, data: 'result' });
      expect(target).toHaveBeenCalledTimes(1);
      expect(target).toHaveBeenCalledWith(...args.slice(0, arity ?? args.length));
      const totalCalls = Object.values(mocks)
        .flatMap((g) => Object.values(g))
        .reduce((n, m) => n + m.mock.calls.length, 0);
      expect(totalCalls).toBe(1);
    },
  );

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
