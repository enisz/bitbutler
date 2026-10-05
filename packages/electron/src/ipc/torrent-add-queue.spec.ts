import type { TorrentAddJob, TorrentAddJobPayload } from '@bitbutler/shared';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const ipcHandlers = vi.hoisted(() => new Map<string, (...args: unknown[]) => unknown>());
const mockSend = vi.hoisted(() => vi.fn());
const mockQbRequest = vi.hoisted(() => vi.fn());
const mockQbTorrentsAdd = vi.hoisted(() => vi.fn());
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
}));

const conflict = JSON.stringify({ name: 'QbHttpError', status: 409 });

describe('torrent-add-queue', () => {
  beforeEach(async () => {
    vi.resetModules();
    ipcHandlers.clear();
    mockUnlink.mockResolvedValue(undefined);
    mockQbTorrentsAdd.mockResolvedValue(undefined);
    mockQbRequest.mockResolvedValue(undefined);
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const { registerTorrentAddQueueHandlers } = await import('./torrent-add-queue.js');
    registerTorrentAddQueueHandlers();
  });

  afterEach(() => {
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

  async function enqueueAndSettle(p: TorrentAddJobPayload): Promise<TorrentAddJob> {
    await ipcHandlers.get('qb:enqueueTorrentAdd')!(null, p);
    await vi.waitFor(async () => {
      const [job] = (await ipcHandlers.get('qb:listTorrentAddJobs')!(null)) as TorrentAddJob[];
      expect(['done', 'error', 'duplicate']).toContain(job.status);
    });
    return ((await ipcHandlers.get('qb:listTorrentAddJobs')!(null)) as TorrentAddJob[])[0];
  }

  it('adds the torrent and finishes without post-add calls when nothing needs post-processing', async () => {
    const job = await enqueueAndSettle(payload({ infoHash: 'abc' }));

    expect(mockQbTorrentsAdd).toHaveBeenCalledWith({ id: 's1', ...payload().add });
    expect(mockQbRequest).not.toHaveBeenCalled();
    expect(job.status).toBe('done');
  });

  it('marks the job duplicate on a 409 and skips deletion and post-add steps', async () => {
    mockQbTorrentsAdd.mockRejectedValueOnce(conflict);

    const job = await enqueueAndSettle(
      payload({
        infoHash: 'abc',
        originalPath: '/tmp/a.torrent',
        deleteOriginalOnSuccess: true,
        renames: [{ oldPath: 'a', newPath: 'b' }],
      }),
    );

    expect(job.status).toBe('duplicate');
    expect(mockUnlink).not.toHaveBeenCalled();
    expect(mockQbRequest).not.toHaveBeenCalled();
  });

  it('marks the job failed on a non-409 add error', async () => {
    mockQbTorrentsAdd.mockRejectedValueOnce(JSON.stringify({ name: 'QbHttpError', status: 500 }));

    const job = await enqueueAndSettle(payload());

    expect(job.status).toBe('error');
    expect(job.error).toBe('HTTP 500');
  });

  it('deletes the source file only after a successful add when requested', async () => {
    await enqueueAndSettle(
      payload({ originalPath: '/tmp/a.torrent', deleteOriginalOnSuccess: true }),
    );
    expect(mockUnlink).toHaveBeenCalledWith('/tmp/a.torrent');
  });

  it('keeps the source file when deletion is not requested', async () => {
    await enqueueAndSettle(payload({ originalPath: '/tmp/a.torrent' }));
    expect(mockUnlink).not.toHaveBeenCalled();
  });

  it('still completes the job when deleting the source file fails', async () => {
    mockUnlink.mockRejectedValueOnce(new Error('EPERM'));

    const job = await enqueueAndSettle(
      payload({ originalPath: '/tmp/a.torrent', deleteOriginalOnSuccess: true }),
    );

    expect(job.status).toBe('done');
  });

  it('waits for registration, then renames and sets share limits', async () => {
    mockQbRequest.mockImplementation(async (req: { path: string }) =>
      req.path === '/api/v2/torrents/files' ? [{ name: 'a', index: 0 }] : undefined,
    );

    const job = await enqueueAndSettle(
      payload({
        infoHash: 'abc',
        renames: [{ oldPath: 'a', newPath: 'b' }],
        shareLimits: { ratioLimit: 1, seedingTimeLimit: 2, inactiveSeedingTimeLimit: 3 },
      }),
    );

    expect(job.status).toBe('done');
    const paths = mockQbRequest.mock.calls.map(([r]) => r.path);
    expect(paths).toEqual([
      '/api/v2/torrents/files',
      '/api/v2/torrents/renameFile',
      '/api/v2/torrents/setShareLimits',
    ]);
  });

  it('skips post-add steps when the info hash is unknown', async () => {
    const job = await enqueueAndSettle(payload({ renames: [{ oldPath: 'a', newPath: 'b' }] }));

    expect(job.status).toBe('done');
    expect(mockQbRequest).not.toHaveBeenCalled();
  });

  it('pushes status updates to the renderer', async () => {
    // The queue mutates one job object, so snapshot each status as it is sent.
    const statuses: string[] = [];
    mockSend.mockImplementation((channel: string, job: TorrentAddJob) => {
      if (channel === 'qb:torrentAddJobUpdate') statuses.push(job.status);
    });

    await enqueueAndSettle(payload());

    expect(statuses[0]).toBe('pending');
    expect(statuses).toContain('adding');
    expect(statuses.at(-1)).toBe('done');
  });
});
