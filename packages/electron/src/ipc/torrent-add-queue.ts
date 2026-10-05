import type { TorrentAddJob, TorrentAddJobPayload } from '@bitbutler/shared';
import { ipcMain } from 'electron';
import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import { getMainWindow } from '../main.js';
import { qbRelogin, qbRequest, qbTorrentsAdd } from './qbittorrent.js';

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
        await withRecovery(serverId, () => qbTorrentsAdd({ id: serverId, ...add }));
      } catch (error) {
        if (parseQbError(error)?.status === 409) {
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
        await request(serverId, {
          method: 'POST',
          path: '/api/v2/torrents/renameFile',
          form: { hash: infoHash, oldPath, newPath },
        });
      }
    }

    if (priorities?.length) {
      setStatus(job, 'applying-priorities');
      const contents = (await request(serverId, {
        method: 'GET',
        path: '/api/v2/torrents/files',
        query: { hash: infoHash },
      })) as { name: string; index: number }[];
      const pathToIndex = new Map(contents.map((c) => [c.name, c.index]));
      for (const { path, priority } of priorities) {
        const index = pathToIndex.get(path);
        if (index === undefined) continue;
        await request(serverId, {
          method: 'POST',
          path: '/api/v2/torrents/filePrio',
          form: { hash: infoHash, id: String(index), priority: String(priority) },
        });
      }
    }

    if (shareLimits) {
      const { ratioLimit, seedingTimeLimit, inactiveSeedingTimeLimit } = shareLimits;
      await request(serverId, {
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
    job.failedStage = job.addAccepted ? 'setup' : 'add';
    job.authExpired = isAuthError(error) || undefined;
    setStatus(job, 'error', describeError(error));
  }
}

type QbRequestInput = Omit<Parameters<typeof qbRequest>[0], 'id'>;

function request(serverId: string, payload: QbRequestInput): Promise<unknown> {
  return withRecovery(serverId, () => qbRequest({ id: serverId, ...payload }));
}

// Mirrors QbService.request in the renderer, which background work in main never goes through:
// a dead session is logged back in with the stored credentials, and transient failures are retried
// with a growing delay. Anything else (a 409, a bad request, an unreadable file) fails at once.
async function withRecovery<T>(serverId: string, fn: () => Promise<T>): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await fn();
    } catch (error) {
      if (attempt >= MAX_RETRIES || !isRecoverable(error)) throw error;
      if (isAuthError(error)) {
        try {
          await qbRelogin(serverId);
        } catch (loginError) {
          console.error('[BitButler][torrent-add-queue] Re-login failed.', loginError);
        }
      }
      await new Promise((resolve) => setTimeout(resolve, RETRY_BASE_DELAY_MS * (attempt + 1)));
    }
  }
}

async function waitForTorrentRegistered(serverId: string, hash: string): Promise<void> {
  const maxRetries = 10;
  const delay = 500;
  for (let i = 0; i < maxRetries; i++) {
    try {
      const contents = (await request(serverId, {
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
interface QbHttpErrorInfo {
  status?: number;
  statusText?: string;
  body?: string;
}

function parseQbError(error: unknown): QbHttpErrorInfo | null {
  const raw = String((error as Error)?.message ?? error);
  const idx = raw.indexOf('{');
  if (idx === -1) return null;
  try {
    return JSON.parse(raw.slice(idx));
  } catch {
    return null;
  }
}

function isNotFoundError(error: unknown): boolean {
  return parseQbError(error)?.status === 404;
}

function isAuthError(error: unknown): boolean {
  const status = parseQbError(error)?.status;
  if (status === 401 || status === 403) return true;
  return String((error as Error)?.message ?? error).includes('Not logged in');
}

function isRecoverable(error: unknown): boolean {
  if (isAuthError(error)) return true;
  const status = parseQbError(error)?.status;
  if (status !== undefined) return status >= 500 || status === 408 || status === 429;
  // fetch() rejects with a TypeError for network-level failures (refused, reset, DNS, timeout).
  return error instanceof TypeError;
}

const MAX_BODY_LENGTH = 200;

function describeError(error: unknown): string {
  const parsed = parseQbError(error);
  if (!parsed) return String((error as Error)?.message ?? error);

  const summary = `HTTP ${parsed.status ?? '?'}${parsed.statusText ? ` - ${parsed.statusText}` : ''}`;
  const body = parsed.body?.trim();
  if (!body) return summary;
  return `${summary}: ${body.length > MAX_BODY_LENGTH ? `${body.slice(0, MAX_BODY_LENGTH)}...` : body}`;
}
