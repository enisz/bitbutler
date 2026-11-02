import type { TorrentAddJob, TorrentAddJobPayload } from '@bitbutler/shared';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { QbBridgeError as QbBridgeErrorType } from '../qb/errors.js';

const ipcHandlers = vi.hoisted(() => new Map<string, (...args: unknown[]) => unknown>());
const mockSend = vi.hoisted(() => vi.fn());
const mockAddTorrent = vi.hoisted(() => vi.fn());
const mockRenameFile = vi.hoisted(() => vi.fn());
const mockFiles = vi.hoisted(() => vi.fn());
const mockFilePrio = vi.hoisted(() => vi.fn());
const mockSetShareLimits = vi.hoisted(() => vi.fn());
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
vi.mock('../qb/torrent-details.js', () => ({
  addTorrent: mockAddTorrent,
  renameFile: mockRenameFile,
  files: mockFiles,
  filePrio: mockFilePrio,
  setShareLimits: mockSetShareLimits,
}));

// resetModules() gives the queue a fresh errors module, so the class is imported after each reset
// to keep the queue's instanceof checks working.
let QbBridgeError: typeof QbBridgeErrorType;

const conflict = () => new QbBridgeError('CONFLICT', 'Conflict', 409);
const unreachable = () => new QbBridgeError('UNREACHABLE', 'Service Unavailable', 503);
const unauthenticated = () => new QbBridgeError('UNAUTHENTICATED', 'Forbidden', 403);
const notFound = () => new QbBridgeError('NOT_FOUND', 'Not Found', 404);
const invalid = () => new QbBridgeError('INVALID', 'Bad Request', 400);

describe('torrent-add-queue', () => {
  // The queue mutates one job object, so snapshot every update as it is pushed.
  let updates: TorrentAddJob[];

  beforeEach(async () => {
    vi.useFakeTimers();
    vi.resetModules();
    ({ QbBridgeError } = await import('../qb/errors.js'));
    ipcHandlers.clear();
    updates = [];
    mockSend.mockImplementation((channel: string, job: TorrentAddJob) => {
      if (channel === 'qb:torrentAddJobUpdate') updates.push({ ...job });
    });
    mockUnlink.mockResolvedValue(undefined);
    mockAddTorrent.mockResolvedValue(undefined);
    mockRenameFile.mockResolvedValue(undefined);
    mockFiles.mockResolvedValue([{ name: 'a', index: 0 }]);
    mockFilePrio.mockResolvedValue(undefined);
    mockSetShareLimits.mockResolvedValue(undefined);
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

      expect(mockAddTorrent).toHaveBeenCalledWith('s1', payload().add);
      expect(mockFiles).not.toHaveBeenCalled();
      expect(last().status).toBe('done');
    });

    it('marks the job duplicate on a CONFLICT and skips deletion and post-add steps', async () => {
      mockAddTorrent.mockRejectedValueOnce(conflict());

      const { last } = await run(
        payload({
          infoHash: 'abc',
          originalPath: '/tmp/a.torrent',
          deleteOriginalOnSuccess: true,
          renames: [{ oldPath: 'a', newPath: 'b' }],
        }),
      );

      expect(last().status).toBe('duplicate');
      expect(mockAddTorrent).toHaveBeenCalledTimes(1);
      expect(mockUnlink).not.toHaveBeenCalled();
      expect(mockFiles).not.toHaveBeenCalled();
      expect(mockRenameFile).not.toHaveBeenCalled();
    });

    it('pushes status updates in order', async () => {
      await run(payload());

      expect(updates.map((u) => u.status)).toEqual(['pending', 'adding', 'done']);
    });
  });

  describe('duplicate submissions', () => {
    const enoent = () => Object.assign(new Error('ENOENT: no such file'), { code: 'ENOENT' });

    it('returns the existing job instead of queueing the same info hash twice', async () => {
      const first = invoke<{ jobId: string }>('qb:enqueueTorrentAdd', payload({ infoHash: 'abc' }));
      const second = invoke<{ jobId: string }>(
        'qb:enqueueTorrentAdd',
        payload({ infoHash: 'abc', originalPath: '/tmp/other.torrent' }),
      );
      await vi.runAllTimersAsync();

      expect(second.jobId).toBe(first.jobId);
      expect(mockAddTorrent).toHaveBeenCalledTimes(1);
    });

    it('returns the existing job instead of queueing the same source file twice', async () => {
      const first = invoke<{ jobId: string }>(
        'qb:enqueueTorrentAdd',
        payload({ originalPath: '/tmp/a.torrent' }),
      );
      const second = invoke<{ jobId: string }>(
        'qb:enqueueTorrentAdd',
        payload({ originalPath: '/tmp/a.torrent' }),
      );
      await vi.runAllTimersAsync();

      expect(second.jobId).toBe(first.jobId);
      expect(mockAddTorrent).toHaveBeenCalledTimes(1);
    });

    it('still queues the same torrent for a different server', async () => {
      invoke('qb:enqueueTorrentAdd', payload({ infoHash: 'abc' }));
      invoke('qb:enqueueTorrentAdd', payload({ infoHash: 'abc', serverId: 's2' }));
      await vi.runAllTimersAsync();

      expect(mockAddTorrent).toHaveBeenCalledTimes(2);
    });

    it('queues the torrent again after a failed attempt so it can be re-submitted', async () => {
      mockAddTorrent.mockRejectedValueOnce(invalid());
      const failed = await run(payload({ infoHash: 'abc' }));
      expect(failed.last().status).toBe('error');

      const again = await run(payload({ infoHash: 'abc' }));

      expect(again.jobId).not.toBe(failed.jobId);
      expect(again.last().status).toBe('done');
    });

    it('treats a vanished source file as a duplicate when this queue already added and deleted it', async () => {
      await run(payload({ originalPath: '/tmp/a.torrent', deleteOriginalOnSuccess: true }));
      mockAddTorrent.mockRejectedValueOnce(enoent());

      const { last } = await run(
        payload({ originalPath: '/tmp/a.torrent', deleteOriginalOnSuccess: true }),
      );

      expect(last().status).toBe('duplicate');
      expect(listed()).toEqual([]);
    });

    it('still reports a missing source file as an error when this queue did not delete it', async () => {
      mockAddTorrent.mockRejectedValueOnce(enoent());

      const { last } = await run(
        payload({ originalPath: '/tmp/gone.torrent', deleteOriginalOnSuccess: true }),
      );

      expect(last()).toMatchObject({ status: 'error', failedStage: 'add' });
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
      mockAddTorrent.mockRejectedValue(invalid());

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
      const { last } = await run(
        payload({
          infoHash: 'abc',
          renames: [{ oldPath: 'a', newPath: 'b' }],
          shareLimits: { ratioLimit: 1, seedingTimeLimit: 2, inactiveSeedingTimeLimit: 3 },
        }),
      );

      expect(last().status).toBe('done');
      expect(mockFiles).toHaveBeenCalledWith('s1', 'abc');
      expect(mockRenameFile).toHaveBeenCalledWith('s1', 'abc', 'a', 'b');
      expect(mockSetShareLimits).toHaveBeenCalledWith('s1', ['abc'], 1, 2, 3);
    });

    it('applies priorities by mapping each path to its file index', async () => {
      mockFiles.mockResolvedValue([
        { name: 'a', index: 0 },
        { name: 'dir/b', index: 5 },
      ]);

      const { last } = await run(
        payload({
          infoHash: 'abc',
          priorities: [
            { path: 'dir/b', priority: 0 },
            { path: 'missing', priority: 7 },
            { path: 'a', priority: 6 },
          ],
        }),
      );

      expect(last().status).toBe('done');
      expect(mockFilePrio).toHaveBeenCalledTimes(2);
      expect(mockFilePrio).toHaveBeenCalledWith('s1', 'abc', [5], 0);
      expect(mockFilePrio).toHaveBeenCalledWith('s1', 'abc', [0], 6);
    });

    it('skips post-add steps when the info hash is unknown', async () => {
      const { last } = await run(payload({ renames: [{ oldPath: 'a', newPath: 'b' }] }));

      expect(last().status).toBe('done');
      expect(mockFiles).not.toHaveBeenCalled();
      expect(mockRenameFile).not.toHaveBeenCalled();
    });

    it('keeps waiting while the torrent is not registered yet (NOT_FOUND)', async () => {
      mockFiles
        .mockRejectedValueOnce(notFound())
        .mockRejectedValueOnce(notFound())
        .mockResolvedValue([{ name: 'a', index: 0 }]);

      const { last } = await run(
        payload({ infoHash: 'abc', renames: [{ oldPath: 'a', newPath: 'b' }] }),
      );

      expect(mockFiles).toHaveBeenCalledTimes(3);
      expect(mockRenameFile).toHaveBeenCalledTimes(1);
      expect(last().status).toBe('done');
    });

    it('fails the wait on any error other than NOT_FOUND', async () => {
      mockFiles.mockRejectedValue(invalid());

      const { last } = await run(
        payload({ infoHash: 'abc', renames: [{ oldPath: 'a', newPath: 'b' }] }),
      );

      expect(mockFiles).toHaveBeenCalledTimes(1);
      expect(last()).toMatchObject({ status: 'error', failedStage: 'setup' });
    });
  });

  describe('recovery', () => {
    it('retries UNREACHABLE twice and then succeeds without reporting a failure', async () => {
      mockAddTorrent
        .mockRejectedValueOnce(unreachable())
        .mockRejectedValueOnce(unreachable())
        .mockResolvedValueOnce(undefined);

      const { last } = await run(payload());

      expect(mockAddTorrent).toHaveBeenCalledTimes(3);
      expect(last().status).toBe('done');
      expect(last().error).toBeUndefined();
    });

    it('retries post-add calls on UNREACHABLE too', async () => {
      mockRenameFile.mockRejectedValueOnce(unreachable()).mockResolvedValueOnce(undefined);

      const { last } = await run(
        payload({ infoHash: 'abc', renames: [{ oldPath: 'a', newPath: 'b' }] }),
      );

      expect(mockRenameFile).toHaveBeenCalledTimes(2);
      expect(last().status).toBe('done');
    });

    it('does not retry other errors', async () => {
      mockAddTorrent.mockRejectedValue(invalid());

      const { last } = await run(payload());

      expect(mockAddTorrent).toHaveBeenCalledTimes(1);
      expect(last().status).toBe('error');
    });

    it('does not retry UNAUTHENTICATED (the shared core already re-logged in)', async () => {
      mockAddTorrent.mockRejectedValue(unauthenticated());

      const { last } = await run(payload());

      expect(mockAddTorrent).toHaveBeenCalledTimes(1);
      expect(last()).toMatchObject({ status: 'error', failedStage: 'add', authExpired: true });
    });

    it('gives up after three retries', async () => {
      mockAddTorrent.mockRejectedValue(unreachable());

      const { last } = await run(payload());

      expect(mockAddTorrent).toHaveBeenCalledTimes(4);
      expect(last()).toMatchObject({ status: 'error', failedStage: 'add' });
    });

    it('backs off 1s, 2s, 3s between retries', async () => {
      mockAddTorrent.mockRejectedValue(unreachable());
      invoke('qb:enqueueTorrentAdd', payload());

      await vi.advanceTimersByTimeAsync(0);
      expect(mockAddTorrent).toHaveBeenCalledTimes(1);
      await vi.advanceTimersByTimeAsync(999);
      expect(mockAddTorrent).toHaveBeenCalledTimes(1);
      await vi.advanceTimersByTimeAsync(1);
      expect(mockAddTorrent).toHaveBeenCalledTimes(2);
      await vi.advanceTimersByTimeAsync(2000);
      expect(mockAddTorrent).toHaveBeenCalledTimes(3);
      await vi.advanceTimersByTimeAsync(3000);
      expect(mockAddTorrent).toHaveBeenCalledTimes(4);
    });
  });

  describe('failures', () => {
    it('reports an add failure with the error message', async () => {
      mockAddTorrent.mockRejectedValue(
        new QbBridgeError('INVALID', 'Torrent file is not valid', 415),
      );

      const { last } = await run(payload());

      expect(last()).toMatchObject({
        status: 'error',
        failedStage: 'add',
        error: 'Torrent file is not valid',
      });
      expect(last().authExpired).toBeUndefined();
    });

    it('truncates a long error message', async () => {
      mockAddTorrent.mockRejectedValue(new QbBridgeError('INVALID', 'x'.repeat(500), 400));

      const { last } = await run(payload());

      expect(last().error).toBe(`${'x'.repeat(200)}...`);
    });

    it('reports plain errors by message', async () => {
      mockAddTorrent.mockRejectedValue(new Error('ENOENT: no such file'));

      const { last } = await run(payload());

      expect(last()).toMatchObject({ status: 'error', error: 'ENOENT: no such file' });
    });

    it('reports a failure after the add was accepted as a setup failure', async () => {
      mockRenameFile.mockRejectedValue(invalid());

      const { last } = await run(
        payload({ infoHash: 'abc', renames: [{ oldPath: 'a', newPath: 'b' }] }),
      );

      expect(last()).toMatchObject({ status: 'error', failedStage: 'setup' });
    });

    it('keeps only failed jobs in the list', async () => {
      await run(payload());
      mockAddTorrent.mockRejectedValueOnce(conflict());
      await run(payload());
      mockAddTorrent.mockRejectedValueOnce(invalid());
      const failed = await run(payload());

      expect(listed().map((j) => j.id)).toEqual([failed.jobId]);
    });
  });

  describe('retry and dismiss', () => {
    it('re-runs a failed add and clears the failure details', async () => {
      mockAddTorrent.mockRejectedValueOnce(invalid());
      const { jobId, last } = await run(payload());
      expect(last().status).toBe('error');

      invoke('qb:retryTorrentAddJob', jobId);
      await vi.runAllTimersAsync();

      expect(mockAddTorrent).toHaveBeenCalledTimes(2);
      expect(last()).toMatchObject({ status: 'done', error: undefined, failedStage: undefined });
      expect(listed()).toEqual([]);
    });

    it('skips the add and the file deletion when retrying a setup failure', async () => {
      mockRenameFile.mockRejectedValueOnce(invalid());
      const { jobId, last } = await run(
        payload({
          infoHash: 'abc',
          originalPath: '/tmp/a.torrent',
          deleteOriginalOnSuccess: true,
          renames: [{ oldPath: 'a', newPath: 'b' }],
        }),
      );
      expect(last().failedStage).toBe('setup');

      invoke('qb:retryTorrentAddJob', jobId);
      await vi.runAllTimersAsync();

      expect(mockAddTorrent).toHaveBeenCalledTimes(1);
      expect(mockUnlink).toHaveBeenCalledTimes(1);
      expect(last().status).toBe('done');
    });

    it('ignores a retry for a job that is not in the error state', async () => {
      mockAddTorrent.mockRejectedValueOnce(conflict());
      const { jobId } = await run(payload());

      invoke('qb:retryTorrentAddJob', jobId);
      invoke('qb:retryTorrentAddJob', 'missing');
      await vi.runAllTimersAsync();

      expect(mockAddTorrent).toHaveBeenCalledTimes(1);
    });

    it('forgets a dismissed failed job so it can no longer be retried', async () => {
      mockAddTorrent.mockRejectedValueOnce(invalid());
      const { jobId } = await run(payload());

      invoke('qb:dismissTorrentAddJob', jobId);
      invoke('qb:retryTorrentAddJob', jobId);
      await vi.runAllTimersAsync();

      expect(listed()).toEqual([]);
      expect(mockAddTorrent).toHaveBeenCalledTimes(1);
    });
  });
});
