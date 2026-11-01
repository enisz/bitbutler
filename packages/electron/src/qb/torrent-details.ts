import type {
  BitButlerQbTorrentsAddPayload,
  QbTorrentContent,
  QbTorrentProperties,
  QbTorrentTracker,
  Torrent,
} from '@bitbutler/shared';
import FormData from 'form-data';
import fs from 'node:fs';
import { qbCall } from './client.js';
import { QbBridgeError } from './errors.js';
import { cleanHashes } from './hashes.js';

const invalid = (message: string): QbBridgeError => new QbBridgeError('INVALID', message);

function requireHash(hash: string): string {
  const h = (hash ?? '').trim();
  if (!h) throw invalid('hash is required');
  return h;
}

function requireHashes(hashes: string[]): string {
  const joined = cleanHashes(hashes);
  if (!joined) throw invalid('No hashes provided');
  return joined;
}

const get = <T>(serverId: string, endpoint: string, query: Record<string, string>): Promise<T> =>
  qbCall<T>(serverId, { method: 'GET', path: `/api/v2/torrents/${endpoint}`, query });

const post = async (
  serverId: string,
  endpoint: string,
  form: Record<string, string>,
): Promise<void> => {
  await qbCall(serverId, { method: 'POST', path: `/api/v2/torrents/${endpoint}`, form });
};

export const properties = async (serverId: string, hash: string): Promise<QbTorrentProperties> =>
  get(serverId, 'properties', { hash: requireHash(hash) });

export async function info(serverId: string, hash: string): Promise<Torrent | null> {
  const list = await get<Torrent[]>(serverId, 'info', { hashes: requireHash(hash) });
  return list[0] ?? null;
}

export const trackers = async (serverId: string, hash: string): Promise<QbTorrentTracker[]> =>
  get(serverId, 'trackers', { hash: requireHash(hash) });

export const files = (serverId: string, hash: string): Promise<QbTorrentContent[]> =>
  get(serverId, 'files', { hash });

export async function setLocation(
  serverId: string,
  hashes: string[],
  location: string,
): Promise<void> {
  const joined = requireHashes(hashes);
  const loc = (location ?? '').trim();
  if (!loc) throw invalid('location is required');
  await post(serverId, 'setLocation', { hashes: joined, location: loc });
}

export async function rename(serverId: string, hash: string, name: string): Promise<void> {
  const h = (hash ?? '').trim();
  const n = (name ?? '').trim();
  if (!h) throw invalid('hash is required');
  if (!n) throw invalid('name is required');
  await post(serverId, 'rename', { hash: h, name: n });
}

function renamePath(endpoint: 'renameFile' | 'renameFolder') {
  return async (
    serverId: string,
    hash: string,
    oldPath: string,
    newPath: string,
  ): Promise<void> => {
    const h = (hash ?? '').trim();
    const oldP = (oldPath ?? '').trim();
    const newP = (newPath ?? '').trim();
    if (!h || !oldP || !newP) throw invalid('hash, oldPath and newPath are required');
    await post(serverId, endpoint, { hash: h, oldPath: oldP, newPath: newP });
  };
}

export const renameFile = renamePath('renameFile');
export const renameFolder = renamePath('renameFolder');

export async function filePrio(
  serverId: string,
  hash: string,
  ids: number[],
  priority: number,
): Promise<void> {
  const h = (hash ?? '').trim();
  const clean = ids ?? [];
  if (!h) throw invalid('hash is required');
  if (clean.length === 0) throw invalid('ids are required');
  await post(serverId, 'filePrio', { hash: h, id: clean.join('|'), priority: String(priority) });
}

export async function setShareLimits(
  serverId: string,
  hashes: string[],
  ratioLimit: number,
  seedingTimeLimit: number,
  inactiveSeedingTimeLimit: number,
): Promise<void> {
  await post(serverId, 'setShareLimits', {
    hashes: requireHashes(hashes),
    ratioLimit: String(ratioLimit),
    seedingTimeLimit: String(seedingTimeLimit),
    inactiveSeedingTimeLimit: String(inactiveSeedingTimeLimit),
  });
}

export const downloadLimit = (
  serverId: string,
  hashes: string[],
): Promise<Record<string, number>> =>
  get(serverId, 'downloadLimit', { hashes: cleanHashes(hashes) });

export const uploadLimit = (serverId: string, hashes: string[]): Promise<Record<string, number>> =>
  get(serverId, 'uploadLimit', { hashes: cleanHashes(hashes) });

export const setDownloadLimit = (
  serverId: string,
  limit: number,
  hashes: string[],
): Promise<void> =>
  post(serverId, 'setDownloadLimit', { limit: String(limit), hashes: cleanHashes(hashes) });

export const setUploadLimit = (serverId: string, limit: number, hashes: string[]): Promise<void> =>
  post(serverId, 'setUploadLimit', { limit: String(limit), hashes: cleanHashes(hashes) });

export async function setDownloadPath(
  serverId: string,
  hashes: string[],
  path: string,
): Promise<void> {
  const joined = requireHashes(hashes);
  const p = (path ?? '').trim();
  if (!p) throw invalid('path is required');
  await post(serverId, 'setDownloadPath', { hashes: joined, path: p });
}

// Main-process only helpers (not part of the renderer bridge).

// Main-process only: torrents/info for several hashes at once (the whole list, not just the first).
export const infoByHashes = async (serverId: string, hashes: string[]): Promise<Torrent[]> =>
  get(serverId, 'info', { hashes: requireHashes(hashes) });

export function exportTorrentFile(serverId: string, hash: string): Promise<Buffer> {
  return qbCall<Buffer>(serverId, {
    path: '/api/v2/torrents/export',
    query: { hash },
    responseType: 'buffer',
  });
}

// A filename goes into a quoted multipart header, so CR, LF and quotes must never reach it.
const safeFilename = (name: string): string => name.replace(/[\r\n"]/g, '');

export async function addTorrent(
  serverId: string,
  payload: Omit<BitButlerQbTorrentsAddPayload, 'id'>,
): Promise<unknown> {
  const { torrents, urls, options } = payload;

  const fd = new FormData();
  let appended = 0;

  for (const t of torrents ?? []) {
    if (!t?.name) continue;

    if ('path' in t && t.path) {
      const buf = await fs.promises.readFile(t.path);
      fd.append('torrents', buf, { filename: safeFilename(t.name) });
      appended++;
    } else if ('bytes' in t && Array.isArray(t.bytes)) {
      fd.append('torrents', Buffer.from(t.bytes), { filename: safeFilename(t.name) });
      appended++;
    }
  }

  if (Array.isArray(urls) && urls.length > 0) {
    fd.append('urls', urls.join('\n'));
    appended++;
  }

  if (!appended) throw invalid('No torrent or URL attached to form-data.');

  for (const [k, v] of Object.entries(options ?? {})) {
    if (v === undefined || v === null) continue;
    if (typeof v === 'string' && v.trim() === '') continue;
    if (k === 'paused') fd.append('stopped', String(v));
    fd.append(k, String(v));
  }

  const body = fd.getBuffer();

  return qbCall(serverId, {
    method: 'POST',
    path: '/api/v2/torrents/add',
    headers: { ...fd.getHeaders(), 'Content-Length': String(body.length) },
    body,
  });
}
