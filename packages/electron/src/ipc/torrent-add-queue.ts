import type { QbErrorCode, TorrentAddJob, TorrentAddJobPayload } from '@bitbutler/shared';
import { ipcMain } from 'electron';
import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import { getMainWindow } from '../main.js';
import { QbBridgeError } from '../qb/errors.js';
import { addTorrent, filePrio, files, renameFile, setShareLimits } from '../qb/torrent-details.js';

// Same budget as QbService.request in the renderer: 3 retries, backing off 1s/2s/3s.
const MAX_RETRIES = 3;
const RETRY_BASE_DELAY_MS = 1000;

const jobs = new Map<string, TorrentAddJob>();
const drainingServers = new Set<string>();

export function registerTorrentAddQueueHandlers(): void {
  ipcMain.handle('qb:enqueueTorrentAdd', (_evt, payload: TorrentAddJobPayload) => enqueue(payload));
  ipcMain.handle('qb:listTorrentAddJobs', () => Array.from(jobs.values()));
  ipcMain.handle('qb:retryTorrentAddJob', (_evt, jobId: string) => retry(jobId));
  ipcMain.handle('qb:dismissTorrentAddJob', (_evt, jobId: string) => {
    if (jobs.get(jobId)?.status === 'error') jobs.delete(jobId);
  });
}

function retry(jobId: string): void {
  const job = jobs.get(jobId);
  if (job?.status !== 'error') return;
  job.failedStage = undefined;
  job.authExpired = undefined;
  setStatus(job, 'pending');
  void drain(job.payload.serverId);
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
  // Only failed jobs are kept (for retry); anything finished has nothing left to act on.
  if (status === 'done' || status === 'duplicate') jobs.delete(job.id);
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
  const { serverId, add, infoHash, originalPath, deleteOriginalOnSuccess } = job.payload;
  const { renames, priorities, shareLimits } = job.payload;

  try {
    if (!job.addAccepted) {
      setStatus(job, 'adding');
      try {
        await withRetry(() => addTorrent(serverId, add));
      } catch (error) {
        if (isCode(error, 'CONFLICT')) {
          setStatus(job, 'duplicate');
          return;
        }
        throw error;
      }
      job.addAccepted = true;

      if (originalPath && deleteOriginalOnSuccess) {
        await fs.promises.unlink(originalPath).catch((error) => {
          console.error(`[BitButler][torrent-add-queue] Could not delete ${originalPath}.`, error);
        });
      }
    }

    if (!infoHash || !(renames?.length || priorities?.length || shareLimits)) {
      setStatus(job, 'done');
      return;
    }

    setStatus(job, 'awaiting-registration');
    await waitForTorrentRegistered(serverId, infoHash);

    if (renames?.length) {
      setStatus(job, 'renaming');
      for (const { oldPath, newPath } of renames) {
        await withRetry(() => renameFile(serverId, infoHash, oldPath, newPath));
      }
    }

    if (priorities?.length) {
      setStatus(job, 'applying-priorities');
      const contents = await withRetry(() => files(serverId, infoHash));
      const pathToIndex = new Map(contents.map((c) => [c.name, c.index]));
      for (const { path, priority } of priorities) {
        const index = pathToIndex.get(path);
        if (index === undefined) continue;
        await withRetry(() => filePrio(serverId, infoHash, [index], priority));
      }
    }

    if (shareLimits) {
      const { ratioLimit, seedingTimeLimit, inactiveSeedingTimeLimit } = shareLimits;
      await withRetry(() =>
        setShareLimits(
          serverId,
          [infoHash],
          ratioLimit,
          seedingTimeLimit,
          inactiveSeedingTimeLimit,
        ),
      );
    }

    setStatus(job, 'done');
  } catch (error) {
    console.error(`[BitButler][torrent-add-queue] Job ${job.id} failed.`, error);
    job.failedStage = job.addAccepted ? 'setup' : 'add';
    job.authExpired = isCode(error, 'UNAUTHENTICATED') || undefined;
    setStatus(job, 'error', describeError(error));
  }
}

// Only transient failures are retried here, with a growing delay. A dead session is already
// logged back in by the shared qb core, and anything else (a conflict, a bad request, an
// unreadable file) fails at once.
async function withRetry<T>(fn: () => Promise<T>): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await fn();
    } catch (error) {
      if (attempt >= MAX_RETRIES || !isCode(error, 'UNREACHABLE')) throw error;
      await new Promise((resolve) => setTimeout(resolve, RETRY_BASE_DELAY_MS * (attempt + 1)));
    }
  }
}

function isCode(error: unknown, code: QbErrorCode): boolean {
  return error instanceof QbBridgeError && error.code === code;
}

async function waitForTorrentRegistered(serverId: string, hash: string): Promise<void> {
  const maxRetries = 10;
  const delay = 500;
  for (let i = 0; i < maxRetries; i++) {
    try {
      const contents = await withRetry(() => files(serverId, hash));
      if (Array.isArray(contents) && contents.length > 0) return;
    } catch (error) {
      if (!isCode(error, 'NOT_FOUND')) throw error;
    }
    await new Promise((resolve) => setTimeout(resolve, delay));
  }
  throw new Error(`Torrent ${hash} not found after ${maxRetries * delay}ms`);
}

const MAX_BODY_LENGTH = 200;

function describeError(error: unknown): string {
  const message = String((error as Error)?.message ?? error).trim();
  return message.length > MAX_BODY_LENGTH ? `${message.slice(0, MAX_BODY_LENGTH)}...` : message;
}
