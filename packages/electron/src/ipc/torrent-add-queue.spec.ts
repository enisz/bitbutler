import type { TorrentAddJob, TorrentAddJobPayload } from '@bitbutler/shared';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const ipcHandlers = vi.hoisted(() => new Map<string, (...args: unknown[]) => unknown>());
const mockSend = vi.hoisted(() => vi.fn());
const mockQbRequest = vi.hoisted(() => vi.fn());
const mockQbTorrentsAdd = vi.hoisted(() => vi.fn());
const mockQbRelogin = vi.hoisted(() => vi.fn());
const mockUnlink = vi.hoisted(() => vi.fn());

vi.mock('electron', () => ({
  ipcMain: {
    handle: vi.fn((channel: string, handler: (...args: unknown[]) => unknown) => {
      ipcHandlers.set(channel, handler);
    }),
  },
}));
vi.mock('node:fs', () => ({ default: { promises: { unlink: mockUnlink } } }));
vi.mock('../main.js', () => ({ getMainWindow: () => ({ webContents: { send: mockSend } }) }));
vi.mock('./qbittorrent.js', () => ({
  qbRequest: mockQbRequest,
  qbTorrentsAdd: mockQbTorrentsAdd,
  qbRelogin: mockQbRelogin,
}));

const httpError = (status: number, extra: Record<string, unknown> = {}) =>
  JSON.stringify({ name: 'QbHttpError', status, ...extra });

describe('torrent-add-queue', () => {
  // The queue mutates one job object, so snapshot every update as it is pushed.
  let updates: TorrentAddJob[];

  beforeEach(async () => {
    vi.useFakeTimers();
    vi.resetModules();
    ipcHandlers.clear();
    updates = [];
    mockSend.mockImplementation((channel: string, job: TorrentAddJob) => {
      if (channel === 'qb:torrentAddJobUpdate') updates.push({ ...job });
    });
    mockUnlink.mockResolvedValue(undefined);
    mockQbTorrentsAdd.mockResolvedValue(undefined);
    mockQbRequest.mockResolvedValue(undefined);
    mockQbRelogin.mockResolvedValue(undefined);
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const { registerTorrentAddQueueHandlers } = await import('./torrent-add-queue.js');
    registerTorrentAddQueueHandlers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  const payload = (overrides: Partial<TorrentAddJobPayload> = {}): TorrentAddJobPayload => ({
    serverId: 's1',
    add: {
      torrents: [{ name: 'a.torrent', path: '/tmp/a.torrent' }],
      options: { paused: 'false' },
    },
    ...overrides,
  });

  const invoke = <T>(channel: string, ...args: unknown[]) =>
    ipcHandlers.get(channel)!(null, ...args) as T;

  async function run(p: TorrentAddJobPayload) {
    const { jobId } = invoke<{ jobId: string }>('qb:enqueueTorrentAdd', p);
    await vi.runAllTimersAsync();
    return { jobId, last: () => updates.filter((u) => u.id === jobId).at(-1)! };
  }

  const listed = () => invoke<TorrentAddJob[]>('qb:listTorrentAddJobs');

  describe('add', () => {
    it('adds the torrent and finishes without post-add calls when nothing needs post-processing', async () => {
      const { last } = await run(payload({ infoHash: 'abc' }));

      expect(mockQbTorrentsAdd).toHaveBeenCalledWith({ id: 's1', ...payload().add });
      expect(mockQbRequest).not.toHaveBeenCalled();
      expect(last().status).toBe('done');
    });

    it('marks the job duplicate on a 409 and skips deletion and post-add steps', async () => {
      mockQbTorrentsAdd.mockRejectedValueOnce(httpError(409));

      const { last } = await run(
        payload({
          infoHash: 'abc',
          originalPath: '/tmp/a.torrent',
          deleteOriginalOnSuccess: true,
          renames: [{ oldPath: 'a', newPath: 'b' }],
        }),
      );

      expect(last().status).toBe('duplicate');
      expect(mockQbTorrentsAdd).toHaveBeenCalledTimes(1);
      expect(mockUnlink).not.toHaveBeenCalled();
      expect(mockQbRequest).not.toHaveBeenCalled();
    });

    it('pushes status updates in order', async () => {
      await run(payload());

      expect(updates.map((u) => u.status)).toEqual(['pending', 'adding', 'done']);
    });
  });

  describe('source file deletion', () => {
    it('deletes the source file after a successful add when requested', async () => {
      await run(payload({ originalPath: '/tmp/a.torrent', deleteOriginalOnSuccess: true }));
      expect(mockUnlink).toHaveBeenCalledWith('/tmp/a.torrent');
    });

    it('keeps the source file when deletion is not requested', async () => {
      await run(payload({ originalPath: '/tmp/a.torrent' }));
      expect(mockUnlink).not.toHaveBeenCalled();
    });

    it('keeps the source file when the add fails', async () => {
      mockQbTorrentsAdd.mockRejectedValue(httpError(400));

      await run(payload({ originalPath: '/tmp/a.torrent', deleteOriginalOnSuccess: true }));

      expect(mockUnlink).not.toHaveBeenCalled();
    });

    it('still completes the job when deleting the source file fails', async () => {
      mockUnlink.mockRejectedValueOnce(new Error('EPERM'));

      const { last } = await run(
        payload({ originalPath: '/tmp/a.torrent', deleteOriginalOnSuccess: true }),
      );

      expect(last().status).toBe('done');
    });
  });

  describe('post-add steps', () => {
    it('waits for registration, then renames and sets share limits', async () => {
      mockQbRequest.mockImplementation(async (req: { path: string }) =>
        req.path === '/api/v2/torrents/files' ? [{ name: 'a', index: 0 }] : undefined,
      );

      const { last } = await run(
        payload({
          infoHash: 'abc',
          renames: [{ oldPath: 'a', newPath: 'b' }],
          shareLimits: { ratioLimit: 1, seedingTimeLimit: 2, inactiveSeedingTimeLimit: 3 },
        }),
      );

      expect(last().status).toBe('done');
      expect(mockQbRequest.mock.calls.map(([r]) => r.path)).toEqual([
        '/api/v2/torrents/files',
        '/api/v2/torrents/renameFile',
        '/api/v2/torrents/setShareLimits',
      ]);
    });

    it('skips post-add steps when the info hash is unknown', async () => {
      const { last } = await run(payload({ renames: [{ oldPath: 'a', newPath: 'b' }] }));

      expect(last().status).toBe('done');
      expect(mockQbRequest).not.toHaveBeenCalled();
    });
  });

  describe('recovery', () => {
    it('retries a transient 5xx and succeeds without reporting a failure', async () => {
      mockQbTorrentsAdd.mockRejectedValueOnce(httpError(503)).mockResolvedValueOnce(undefined);

      const { last } = await run(payload());

      expect(mockQbTorrentsAdd).toHaveBeenCalledTimes(2);
      expect(mockQbRelogin).not.toHaveBeenCalled();
      expect(last().status).toBe('done');
    });

    it('retries network-level failures (fetch rejects with a TypeError)', async () => {
      mockQbTorrentsAdd
        .mockRejectedValueOnce(new TypeError('fetch failed'))
        .mockResolvedValueOnce(undefined);

      const { last } = await run(payload());

      expect(last().status).toBe('done');
    });

    it('logs back in and retries on a 403', async () => {
      mockQbTorrentsAdd.mockRejectedValueOnce(httpError(403)).mockResolvedValueOnce(undefined);

      const { last } = await run(payload());

      expect(mockQbRelogin).toHaveBeenCalledWith('s1');
      expect(last().status).toBe('done');
    });

    it('logs back in when the session cookie is missing', async () => {
      mockQbTorrentsAdd
        .mockRejectedValueOnce(new Error('Not logged in (missing cookie).'))
        .mockResolvedValueOnce(undefined);

      const { last } = await run(payload());

      expect(mockQbRelogin).toHaveBeenCalledWith('s1');
      expect(last().status).toBe('done');
    });

    it('does not retry unrecoverable errors', async () => {
      mockQbTorrentsAdd.mockRejectedValue(httpError(400));

      const { last } = await run(payload());

      expect(mockQbTorrentsAdd).toHaveBeenCalledTimes(1);
      expect(last().status).toBe('error');
    });

    it('gives up after three retries', async () => {
      mockQbTorrentsAdd.mockRejectedValue(httpError(500));

      const { last } = await run(payload());

      expect(mockQbTorrentsAdd).toHaveBeenCalledTimes(4);
      expect(last().status).toBe('error');
    });

    it('backs off 1s, 2s, 3s between retries', async () => {
      mockQbTorrentsAdd.mockRejectedValue(httpError(500));
      invoke('qb:enqueueTorrentAdd', payload());

      await vi.advanceTimersByTimeAsync(0);
      expect(mockQbTorrentsAdd).toHaveBeenCalledTimes(1);
      await vi.advanceTimersByTimeAsync(999);
      expect(mockQbTorrentsAdd).toHaveBeenCalledTimes(1);
      await vi.advanceTimersByTimeAsync(1);
      expect(mockQbTorrentsAdd).toHaveBeenCalledTimes(2);
      await vi.advanceTimersByTimeAsync(2000);
      expect(mockQbTorrentsAdd).toHaveBeenCalledTimes(3);
      await vi.advanceTimersByTimeAsync(3000);
      expect(mockQbTorrentsAdd).toHaveBeenCalledTimes(4);
    });
  });

  describe('failures', () => {
    it('reports an add failure with the status text and response body', async () => {
      mockQbTorrentsAdd.mockRejectedValue(
        httpError(415, { statusText: 'Unsupported Media Type', body: 'Torrent file is not valid' }),
      );

      const { last } = await run(payload());

      expect(last()).toMatchObject({
        status: 'error',
        failedStage: 'add',
        error: 'HTTP 415 - Unsupported Media Type: Torrent file is not valid',
      });
      expect(last().authExpired).toBeUndefined();
    });

    it('truncates a long response body', async () => {
      mockQbTorrentsAdd.mockRejectedValue(httpError(400, { body: 'x'.repeat(500) }));

      const { last } = await run(payload());

      expect(last().error).toBe(`HTTP 400: ${'x'.repeat(200)}...`);
    });

    it('reports plain errors by message', async () => {
      mockQbTorrentsAdd.mockRejectedValue(new Error('ENOENT: no such file'));

      const { last } = await run(payload());

      expect(last()).toMatchObject({ status: 'error', error: 'ENOENT: no such file' });
    });

    it('flags an auth failure that re-login could not fix', async () => {
      mockQbTorrentsAdd.mockRejectedValue(httpError(403));
      mockQbRelogin.mockRejectedValue(new Error('Login failed.'));

      const { last } = await run(payload());

      expect(last()).toMatchObject({ status: 'error', failedStage: 'add', authExpired: true });
    });

    it('reports a failure after the add was accepted as a setup failure', async () => {
      mockQbRequest.mockImplementation(async (req: { path: string }) => {
        if (req.path === '/api/v2/torrents/files') return [{ name: 'a', index: 0 }];
        throw httpError(400);
      });

      const { last } = await run(
        payload({ infoHash: 'abc', renames: [{ oldPath: 'a', newPath: 'b' }] }),
      );

      expect(last()).toMatchObject({ status: 'error', failedStage: 'setup' });
    });

    it('keeps only failed jobs in the list', async () => {
      await run(payload());
      mockQbTorrentsAdd.mockRejectedValueOnce(httpError(409));
      await run(payload());
      mockQbTorrentsAdd.mockRejectedValueOnce(httpError(400));
      const failed = await run(payload());

      expect(listed().map((j) => j.id)).toEqual([failed.jobId]);
    });
  });

  describe('retry and dismiss', () => {
    it('re-runs a failed add and clears the failure details', async () => {
      mockQbTorrentsAdd.mockRejectedValueOnce(httpError(400));
      const { jobId, last } = await run(payload());
      expect(last().status).toBe('error');

      invoke('qb:retryTorrentAddJob', jobId);
      await vi.runAllTimersAsync();

      expect(mockQbTorrentsAdd).toHaveBeenCalledTimes(2);
      expect(last()).toMatchObject({ status: 'done', error: undefined, failedStage: undefined });
      expect(listed()).toEqual([]);
    });

    it('skips the add and the file deletion when retrying a setup failure', async () => {
      let failRename = true;
      mockQbRequest.mockImplementation(async (req: { path: string }) => {
        if (req.path === '/api/v2/torrents/files') return [{ name: 'a', index: 0 }];
        if (failRename) throw httpError(400);
      });
      const { jobId, last } = await run(
        payload({
          infoHash: 'abc',
          originalPath: '/tmp/a.torrent',
          deleteOriginalOnSuccess: true,
          renames: [{ oldPath: 'a', newPath: 'b' }],
        }),
      );
      expect(last().failedStage).toBe('setup');

      failRename = false;
      invoke('qb:retryTorrentAddJob', jobId);
      await vi.runAllTimersAsync();

      expect(mockQbTorrentsAdd).toHaveBeenCalledTimes(1);
      expect(mockUnlink).toHaveBeenCalledTimes(1);
      expect(last().status).toBe('done');
    });

    it('ignores a retry for a job that is not in the error state', async () => {
      mockQbTorrentsAdd.mockRejectedValueOnce(httpError(409));
      const { jobId } = await run(payload());

      invoke('qb:retryTorrentAddJob', jobId);
      invoke('qb:retryTorrentAddJob', 'missing');
      await vi.runAllTimersAsync();

      expect(mockQbTorrentsAdd).toHaveBeenCalledTimes(1);
    });

    it('forgets a dismissed failed job so it can no longer be retried', async () => {
      mockQbTorrentsAdd.mockRejectedValueOnce(httpError(400));
      const { jobId } = await run(payload());

      invoke('qb:dismissTorrentAddJob', jobId);
      invoke('qb:retryTorrentAddJob', jobId);
      await vi.runAllTimersAsync();

      expect(listed()).toEqual([]);
      expect(mockQbTorrentsAdd).toHaveBeenCalledTimes(1);
    });
  });
});
