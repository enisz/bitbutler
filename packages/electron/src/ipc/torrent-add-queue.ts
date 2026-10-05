import type { TorrentAddJob, TorrentAddJobPayload } from '@bitbutler/shared';
import { ipcMain } from 'electron';
import { randomUUID } from 'node:crypto';
import { getMainWindow } from '../main.js';
import { qbRequest } from './qbittorrent.js';

const jobs = new Map<string, TorrentAddJob>();
const drainingServers = new Set<string>();

export function registerTorrentAddQueueHandlers(): void {
  ipcMain.handle('qb:enqueueTorrentAdd', (_evt, payload: TorrentAddJobPayload) => enqueue(payload));
  ipcMain.handle('qb:listTorrentAddJobs', () => Array.from(jobs.values()));
}

function enqueue(payload: TorrentAddJobPayload): { jobId: string } {
  const job: TorrentAddJob = {
    id: randomUUID(),
    status: 'pending',
    createdAt: Date.now(),
    payload,
  };
  jobs.set(job.id, job);
  emitUpdate(job);
  void drain(payload.serverId);
  return { jobId: job.id };
}

function emitUpdate(job: TorrentAddJob): void {
  getMainWindow()?.webContents.send('qb:torrentAddJobUpdate', job);
}

function setStatus(job: TorrentAddJob, status: TorrentAddJob['status'], error?: string): void {
  job.status = status;
  job.error = error;
  emitUpdate(job);
}

// One drain loop per server - jobs for different servers process independently, but jobs for the
// same server stay strictly serial, and a failed job never blocks the ones behind it since
// processJob() always resolves, never rejects.
async function drain(serverId: string): Promise<void> {
  if (drainingServers.has(serverId)) return;
  drainingServers.add(serverId);
  try {
    for (let job = nextPending(serverId); job; job = nextPending(serverId)) {
      await processJob(job);
    }
  } finally {
    drainingServers.delete(serverId);
  }
}

function nextPending(serverId: string): TorrentAddJob | undefined {
  for (const job of jobs.values()) {
    if (job.payload.serverId === serverId && job.status === 'pending') return job;
  }
  return undefined;
}

async function processJob(job: TorrentAddJob): Promise<void> {
  const { serverId, infoHash, renames, priorities, shareLimits } = job.payload;

  try {
    setStatus(job, 'awaiting-registration');
    await waitForTorrentRegistered(serverId, infoHash);

    if (renames?.length) {
      setStatus(job, 'renaming');
      for (const { oldPath, newPath } of renames) {
        await qbRequest({
          id: serverId,
          method: 'POST',
          path: '/api/v2/torrents/renameFile',
          form: { hash: infoHash, oldPath, newPath },
        });
      }
    }

    if (priorities?.length) {
      setStatus(job, 'applying-priorities');
      const contents = (await qbRequest({
        id: serverId,
        method: 'GET',
        path: '/api/v2/torrents/files',
        query: { hash: infoHash },
      })) as { name: string; index: number }[];
      const pathToIndex = new Map(contents.map((c) => [c.name, c.index]));
      for (const { path, priority } of priorities) {
        const index = pathToIndex.get(path);
        if (index === undefined) continue;
        await qbRequest({
          id: serverId,
          method: 'POST',
          path: '/api/v2/torrents/filePrio',
          form: { hash: infoHash, id: String(index), priority: String(priority) },
        });
      }
    }

    if (shareLimits) {
      const { ratioLimit, seedingTimeLimit, inactiveSeedingTimeLimit } = shareLimits;
      await qbRequest({
        id: serverId,
        method: 'POST',
        path: '/api/v2/torrents/setShareLimits',
        form: {
          hashes: infoHash,
          ratioLimit: String(ratioLimit),
          seedingTimeLimit: String(seedingTimeLimit),
          inactiveSeedingTimeLimit: String(inactiveSeedingTimeLimit),
        },
      });
    }

    setStatus(job, 'done');
  } catch (error) {
    console.error(`[BitButler][torrent-add-queue] Job ${job.id} failed.`, error);
    setStatus(job, 'error', describeError(error));
  }
}

async function waitForTorrentRegistered(serverId: string, hash: string): Promise<void> {
  const maxRetries = 10;
  const delay = 500;
  for (let i = 0; i < maxRetries; i++) {
    try {
      const contents = (await qbRequest({
        id: serverId,
        method: 'GET',
        path: '/api/v2/torrents/files',
        query: { hash },
      })) as unknown[];
      if (Array.isArray(contents) && contents.length > 0) return;
    } catch (error) {
      if (!isNotFoundError(error)) throw error;
    }
    await new Promise((resolve) => setTimeout(resolve, delay));
  }
  throw new Error(`Torrent ${hash} not found after ${maxRetries * delay}ms`);
}

// qbRequest() throws the JSON.stringify()'d QbHttpError payload directly (as a string, not an
// Error) when called in-process like this, rather than via the IPC boundary.
function parseQbError(error: unknown): { status?: number } | null {
  try {
    return JSON.parse(String(error));
  } catch {
    return null;
  }
}

function isNotFoundError(error: unknown): boolean {
  return parseQbError(error)?.status === 404;
}

function describeError(error: unknown): string {
  const parsed = parseQbError(error);
  if (parsed) return `HTTP ${parsed.status ?? '?'}`;
  return String((error as Error)?.message ?? error);
}
