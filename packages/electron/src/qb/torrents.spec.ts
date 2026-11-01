import { beforeEach, describe, expect, it, vi } from 'vitest';
import { QbBridgeError } from './errors.js';
import * as torrents from './torrents.js';

const mockQbCall = vi.fn();
const mockGetWebapiVersion = vi.fn();

vi.mock('./client.js', () => ({ qbCall: (...args: unknown[]) => mockQbCall(...args) }));
vi.mock('./server-info.js', () => ({
  getWebapiVersion: (...args: unknown[]) => mockGetWebapiVersion(...args),
}));

const paths = (): string[] =>
  mockQbCall.mock.calls.map(([, input]) => (input as { path: string }).path);

describe('torrent lifecycle domain', () => {
  beforeEach(() => {
    mockQbCall.mockReset();
    mockQbCall.mockResolvedValue('');
    mockGetWebapiVersion.mockReset();
    mockGetWebapiVersion.mockReturnValue('2.11.2');
    torrents.resetTorrentRunCache();
  });

  describe('request shape', () => {
    const hashes = [' a ', '', 'b'];
    const joined = 'a|b';

    it.each([
      ['increasePrio', 'increasePrio'],
      ['decreasePrio', 'decreasePrio'],
      ['topPrio', 'topPrio'],
      ['bottomPrio', 'bottomPrio'],
      ['recheck', 'recheck'],
      ['reannounce', 'reannounce'],
      ['toggleSequentialDownload', 'toggleSequentialDownload'],
      ['toggleFirstLastPiecePrio', 'toggleFirstLastPiecePrio'],
    ] as const)('%s posts the cleaned hashes', async (fn, endpoint) => {
      await torrents[fn]('srv-1', hashes);
      expect(mockQbCall).toHaveBeenCalledWith('srv-1', {
        method: 'POST',
        path: `/api/v2/torrents/${endpoint}`,
        form: { hashes: joined },
      });
    });

    it.each([
      ['increasePrio'],
      ['decreasePrio'],
      ['topPrio'],
      ['bottomPrio'],
      ['recheck'],
      ['reannounce'],
      ['toggleSequentialDownload'],
      ['toggleFirstLastPiecePrio'],
    ] as const)('%s resolves without calling qb on an empty list', async (fn) => {
      await expect(torrents[fn]('srv-1', [' ', ''])).resolves.toBeUndefined();
      expect(mockQbCall).not.toHaveBeenCalled();
    });

    it('remove posts hashes and deleteFiles', async () => {
      mockQbCall.mockResolvedValue('done');
      await expect(torrents.remove('srv-1', ['a', 'b'], true)).resolves.toBe('done');
      expect(mockQbCall).toHaveBeenCalledWith('srv-1', {
        method: 'POST',
        path: '/api/v2/torrents/delete',
        form: { hashes: 'a|b', deleteFiles: 'true' },
      });
      await torrents.remove('srv-1', ['a'], false);
      expect(mockQbCall).toHaveBeenLastCalledWith('srv-1', {
        method: 'POST',
        path: '/api/v2/torrents/delete',
        form: { hashes: 'a', deleteFiles: 'false' },
      });
    });

    it('remove rejects INVALID on an empty list', async () => {
      await expect(torrents.remove('srv-1', [' '], false)).rejects.toMatchObject({
        code: 'INVALID',
        message: 'No hashes to delete',
      });
      expect(mockQbCall).not.toHaveBeenCalled();
    });

    it.each([
      ['setForceStart', 'setForceStart', 'value'],
      ['setSuperSeeding', 'setSuperSeeding', 'value'],
      ['setAutoManagement', 'setAutoManagement', 'enable'],
    ] as const)('%s sends the boolean flag', async (fn, endpoint, field) => {
      await torrents[fn]('srv-1', hashes, true);
      expect(mockQbCall).toHaveBeenCalledWith('srv-1', {
        method: 'POST',
        path: `/api/v2/torrents/${endpoint}`,
        form: { hashes: joined, [field]: 'true' },
      });
      await torrents[fn]('srv-1', hashes, false);
      expect(mockQbCall).toHaveBeenLastCalledWith('srv-1', {
        method: 'POST',
        path: `/api/v2/torrents/${endpoint}`,
        form: { hashes: joined, [field]: 'false' },
      });
    });

    it('flag setters are a no-op on an empty list', async () => {
      await torrents.setForceStart('srv-1', [], true);
      await torrents.setSuperSeeding('srv-1', [], true);
      await torrents.setAutoManagement('srv-1', [], true);
      expect(mockQbCall).not.toHaveBeenCalled();
    });
  });

  describe('stop / start', () => {
    it.each([
      ['2.11.2', '/api/v2/torrents/start', '/api/v2/torrents/stop'],
      ['2.11.0', '/api/v2/torrents/start', '/api/v2/torrents/stop'],
      ['2.9.3', '/api/v2/torrents/resume', '/api/v2/torrents/pause'],
      ['2.10.4', '/api/v2/torrents/resume', '/api/v2/torrents/pause'],
      [null, '/api/v2/torrents/resume', '/api/v2/torrents/pause'],
    ])('with WebAPI %s uses %s and %s', async (version, startPath, stopPath) => {
      mockGetWebapiVersion.mockReturnValue(version);
      await torrents.start('srv-1', ['a']);
      await torrents.stop('srv-1', ['a']);
      expect(paths()).toEqual([startPath, stopPath]);
      expect(mockQbCall).toHaveBeenCalledWith('srv-1', {
        method: 'POST',
        path: startPath,
        form: { hashes: 'a' },
      });
    });

    it("passes 'all' through", async () => {
      await torrents.stop('srv-1', 'all');
      expect(mockQbCall).toHaveBeenCalledWith('srv-1', {
        method: 'POST',
        path: '/api/v2/torrents/stop',
        form: { hashes: 'all' },
      });
    });

    it('is a no-op on an empty list', async () => {
      await torrents.start('srv-1', []);
      expect(mockQbCall).not.toHaveBeenCalled();
    });

    it('falls back on NOT_FOUND and remembers the working pair per server', async () => {
      mockGetWebapiVersion.mockReturnValue('2.9.3');
      mockQbCall
        .mockRejectedValueOnce(new QbBridgeError('NOT_FOUND', 'nf', 404))
        .mockResolvedValue('');
      await torrents.start('srv-1', 'all');
      await torrents.stop('srv-1', 'all');
      await torrents.stop('srv-2', 'all');
      expect(paths()).toEqual([
        '/api/v2/torrents/resume',
        '/api/v2/torrents/start',
        '/api/v2/torrents/stop',
        '/api/v2/torrents/pause',
      ]);
    });

    it('throws UNSUPPORTED when both pairs are NOT_FOUND', async () => {
      mockQbCall.mockRejectedValue(new QbBridgeError('NOT_FOUND', 'nf', 404));
      await expect(torrents.start('srv-1', 'all')).rejects.toMatchObject({ code: 'UNSUPPORTED' });
      expect(paths()).toEqual(['/api/v2/torrents/start', '/api/v2/torrents/resume']);
    });

    it('rethrows other errors from the first pair without fallback', async () => {
      const err = new QbBridgeError('FAILED', 'boom');
      mockQbCall.mockRejectedValue(err);
      await expect(torrents.start('srv-1', 'all')).rejects.toBe(err);
      expect(paths()).toEqual(['/api/v2/torrents/start']);
    });
  });
});
