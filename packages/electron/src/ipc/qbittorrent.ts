import type { BitButlerQbTorrentsAddPayload, BitButlerSyncStreamPayload } from '@bitbutler/shared';
import { ipcMain, safeStorage } from 'electron';
import FormData from 'form-data';
import fs from 'node:fs';
import db from '../db.js';
import { rebuildMenu } from '../menu.js';
import { rebuildTrayMenu } from '../tray.js';
import { getActiveServerId } from './server.js';

const cookieJar = new Map<string, string>();

export function getCookieJar(): Map<string, string> {
  return cookieJar;
}

interface ServerRow {
  id: string;
  name: string;
  host: string;
  protocol: string;
  port: number;
  username: string;
  password: Buffer | null;
  auto_login: number;
  created_at: string;
}

interface QbRequestPayload {
  id: string;
  path: string;
  method?: string;
  query?: Record<string, string | number | boolean>;
  body?: unknown;
  form?: Record<string, string>;
  headers?: Record<string, string>;
  responseType?: 'buffer';
}

const stmtGetByIdFull = db.prepare<[string], ServerRow>(`
  SELECT id, name, host, protocol, port, username, password, auto_login, created_at
  FROM servers
  WHERE id = ?
`);

export function registerQbIpcHandlers(): void {
  ipcMain.handle('qb:login', async (_event, payload: unknown) => qbLogin(payload));
  ipcMain.handle('qb:logout', async (_event, payload: unknown) => qbLogout(payload));
  ipcMain.handle('qb:has-cookie', async (_event, payload: unknown) => qbHasCookie(payload));
  ipcMain.handle('qb:request', async (_event, payload: unknown) =>
    qbRequest(payload as QbRequestPayload),
  );
  ipcMain.handle('qb:torrentsAdd', async (_evt, payload: BitButlerQbTorrentsAddPayload) =>
    qbTorrentsAdd(payload),
  );
  ipcMain.on('qb:sync-maindata-stream', async (event, payload: BitButlerSyncStreamPayload) =>
    qbSyncMaindataStream(event, payload),
  );
}

async function qbTorrentsAdd(payload: BitButlerQbTorrentsAddPayload): Promise<unknown> {
  const { id, torrents, urls, options } = payload;

  const fd = new FormData();
  let appended = 0;

  for (const t of torrents ?? []) {
    if (!t?.name) continue;

    if ('path' in t && t.path) {
      const buf = await fs.promises.readFile(t.path);
      fd.append('torrents', buf, { filename: t.name });
      appended++;
    } else if ('bytes' in t && Array.isArray(t.bytes)) {
      fd.append('torrents', Buffer.from(t.bytes), { filename: t.name });
      appended++;
    }
  }

  if (Array.isArray(urls) && urls.length > 0) {
    fd.append('urls', urls.join('\n'));
    appended++;
  }

  if (!appended) throw new Error('No torrent or URL attached to form-data.');

  console.debug(
    `[BitButler][qbittorrent] Adding torrents for server ${id}: ${(torrents ?? []).length} file(s), ${(urls ?? []).length} url(s).`,
  );

  for (const [k, v] of Object.entries(options ?? {})) {
    if (v === undefined || v === null) continue;
    if (typeof v === 'string' && v.trim() === '') continue;
    if (k === 'paused') fd.append('stopped', String(v));
    fd.append(k, String(v));
  }

  const bodyBuffer = fd.getBuffer();

  return qbRequest({
    id,
    method: 'POST',
    path: '/api/v2/torrents/add',
    headers: {
      ...fd.getHeaders(),
      'Content-Length': String(bodyBuffer.length),
    },
    body: bodyBuffer,
  });
}

function qbHasCookie(payload: unknown): { hasCookie: boolean } {
  const id = requireString((payload as Record<string, unknown>)?.id, 'id');
  return { hasCookie: cookieJar.has(id) };
}

function qbLogout(payload: unknown): { loggedOut: boolean } {
  const id = requireString((payload as Record<string, unknown>)?.id, 'id');
  cookieJar.delete(id);
  if (getActiveServerId() === id) {
    ipcMain.emit('server:set-active', null, null);
  }
  rebuildMenu();
  rebuildTrayMenu();
  return { loggedOut: true };
}

async function qbLogin(payload: unknown): Promise<{ loggedIn: boolean }> {
  const p = payload as Record<string, unknown>;
  const id = requireString(p?.id, 'id');
  const runtimeUsername = typeof p?.username === 'string' ? p.username : undefined;
  const runtimePassword = typeof p?.password === 'string' ? p.password : undefined;

  const server = stmtGetByIdFull.get(id);
  if (!server) throw new Error('Server not found.');

  const username = runtimeUsername ?? server.username;
  const password = runtimePassword ?? decryptPassword(server.password);
  const url = buildBaseUrl(server) + '/api/v2/auth/login';

  const body = new URLSearchParams({ username, password });

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Referer: buildBaseUrl(server),
    },
    body,
  });

  const text = await res.text();
  if (!res.ok || (res.status !== 204 && !/^Ok\./i.test(text.trim()))) {
    console.warn(`[BitButler][qbittorrent] Login failed for server ${id} (status ${res.status}).`);
    throw new Error('Login failed. Check username/password and WebUI settings.');
  }

  const cookie = extractSidCookie(res);
  if (!cookie) {
    console.error(
      `[BitButler][qbittorrent] Login succeeded for server ${id} but no SID cookie was returned.`,
    );
    throw new Error(
      'Login succeeded but SID cookie was not returned (check proxy/HTTPS/WebUI config).',
    );
  }

  cookieJar.set(id, cookie);
  console.info(`[BitButler][qbittorrent] Logged in to server ${id}.`);
  ipcMain.emit('server:set-active', null, id);
  rebuildMenu();
  rebuildTrayMenu();
  return { loggedIn: true };
}

export async function qbRequest(payload: QbRequestPayload): Promise<unknown> {
  const { id, path, query, body, form, headers: headersIn } = payload;
  const method = String(payload.method ?? 'GET').toUpperCase();

  requireString(id, 'id');
  requireString(path, 'path');

  const server = stmtGetByIdFull.get(id);
  if (!server) throw new Error('Server not found.');

  const sid = cookieJar.get(id);
  if (!sid) throw new Error('Not logged in (missing cookie).');

  const baseUrl = buildBaseUrl(server);
  const url = new URL(baseUrl + path);

  if (query && typeof query === 'object') {
    for (const [k, v] of Object.entries(query)) {
      if (v === undefined || v === null) continue;
      url.searchParams.set(k, String(v));
    }
  }

  const headers: Record<string, string> = {
    Cookie: sid,
    Referer: baseUrl,
    Origin: baseUrl,
  };

  if (headersIn && typeof headersIn === 'object') {
    Object.assign(headers, headersIn);
  }

  let requestBody: BodyInit | undefined;

  if (form && typeof form === 'object') {
    headers['Content-Type'] = 'application/x-www-form-urlencoded';
    const usp = new URLSearchParams();
    for (const [k, v] of Object.entries(form)) {
      if (v === undefined || v === null) continue;
      usp.set(k, String(v));
    }
    requestBody = usp.toString();
  } else if (body !== undefined && body !== null) {
    const isFormDataLike =
      typeof body === 'object' &&
      typeof (body as Record<string, unknown>)['getHeaders'] === 'function' &&
      typeof (body as Record<string, unknown>)['pipe'] === 'function';

    const isStream =
      typeof body === 'object' && typeof (body as Record<string, unknown>)['pipe'] === 'function';
    const isBuffer = Buffer.isBuffer(body);

    if (isFormDataLike) {
      const fd = body as FormData;
      Object.assign(headers, fd.getHeaders());
      requestBody = fd as unknown as BodyInit;
    } else if (isStream) {
      requestBody = body as BodyInit;
    } else if (isBuffer) {
      requestBody = body as BodyInit;
    } else if (typeof body === 'string') {
      requestBody = body;
    } else if (typeof body === 'object') {
      headers['Content-Type'] = 'application/json';
      requestBody = JSON.stringify(body);
    }
  }

  const res = await fetch(url.toString(), {
    method,
    headers,
    body: requestBody,
  });

  if (!res.ok) {
    const errText = await res.text();
    console.warn(
      `[BitButler][qbittorrent] ${method} ${path} failed for server ${id} (status ${res.status}).`,
    );
    throw JSON.stringify({
      name: 'QbHttpError',
      status: res.status,
      statusText: res.statusText,
      body: errText,
      path,
    });
  }

  const rotated = extractSidCookie(res);
  if (rotated) cookieJar.set(id, rotated);

  if (payload.responseType === 'buffer') {
    const ab = await res.arrayBuffer();
    return Buffer.from(ab);
  }

  const text = await res.text();
  const contentType = res.headers.get('content-type') ?? '';
  if (contentType.includes('application/json')) {
    try {
      return JSON.parse(text);
    } catch {
      return text;
    }
  }

  return text;
}

function buildBaseUrl(server: ServerRow): string {
  return `${server.protocol}://${server.host}:${server.port}`;
}

function decryptPassword(passwordBlob: Buffer | Uint8Array | null): string {
  if (!passwordBlob) return '';
  const buf = Buffer.isBuffer(passwordBlob) ? passwordBlob : Buffer.from(passwordBlob);
  try {
    return safeStorage.decryptString(buf);
  } catch (error) {
    console.error('[BitButler][qbittorrent] Failed to decrypt stored password.', error);
    throw error;
  }
}

function extractSidCookie(res: Response): string | null {
  const h = res.headers;

  if (typeof (h as unknown as Record<string, unknown>)['getSetCookie'] === 'function') {
    const setCookies = (h as unknown as { getSetCookie(): string[] }).getSetCookie();
    return findSidInSetCookies(setCookies);
  }

  const raw = h.get('set-cookie');
  if (!raw) return null;

  const parts = raw.split(/,(?=\s*(?:QBT_SID_\d+|SID)=)/g);
  return findSidInSetCookies(parts);
}

function findSidInSetCookies(setCookies: string[]): string | null {
  if (!Array.isArray(setCookies)) return null;

  for (const c of setCookies) {
    const m = String(c).match(/(^|;\s*)(QBT_SID_\d+|SID)=([^;]+)/);
    if (m) return `${m[2]}=${m[3]}`;
  }
  return null;
}

function requireString(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`Field '${field}' is required.`);
  }
  return value.trim();
}

const streamGeneration = new Map<number, number>();

async function qbSyncMaindataStream(
  event: Electron.IpcMainEvent,
  payload: BitButlerSyncStreamPayload,
): Promise<void> {
  const { id, rid, chunkSize = 500, delayMs = 15, sortBy, sortDesc } = payload;
  const channel = 'qb:sync-maindata-chunk';

  const senderId = event.sender.id;
  const generation = (streamGeneration.get(senderId) ?? 0) + 1;
  streamGeneration.set(senderId, generation);

  const isCurrent = (): boolean =>
    !event.sender.isDestroyed() && streamGeneration.get(senderId) === generation;

  const send = (data: unknown): void => {
    if (isCurrent()) event.reply(channel, data);
  };

  try {
    const maindata = (await qbRequest({
      id,
      method: 'GET',
      path: '/api/v2/sync/maindata',
      query: { rid: rid ?? 0 },
    })) as Record<string, unknown>;
    const allTorrents = (maindata['torrents'] as Record<string, Record<string, unknown>>) || {};

    let torrentHashes = Object.keys(allTorrents);
    const totalTorrents = torrentHashes.length;

    if (sortBy && totalTorrents > 0) {
      torrentHashes.sort((hashA, hashB) => {
        let valA = allTorrents[hashA][sortBy] ?? '';
        let valB = allTorrents[hashB][sortBy] ?? '';

        if (typeof valA === 'string') valA = valA.toLowerCase();
        if (typeof valB === 'string') valB = valB.toLowerCase();

        if (valA < valB) return sortDesc ? 1 : -1;
        if (valA > valB) return sortDesc ? -1 : 1;
        return 0;
      });
    }

    delete maindata['torrents'];

    if (!isCurrent()) return;
    send({ type: 'metadata', data: maindata, total: totalTorrents });

    if (totalTorrents === 0) {
      send({ type: 'done' });
      return;
    }

    let currentIndex = 0;

    const sendNextChunk = (): void => {
      if (!isCurrent()) return;

      const chunk: Record<string, unknown> = {};
      const end = Math.min(currentIndex + chunkSize, totalTorrents);

      for (let i = currentIndex; i < end; i++) {
        const hash = torrentHashes[i];
        chunk[hash] = allTorrents[hash];
      }

      send({ type: 'chunk', data: chunk, progress: end, total: totalTorrents });

      currentIndex = end;

      if (currentIndex < totalTorrents) {
        setTimeout(sendNextChunk, delayMs);
      } else {
        send({ type: 'done' });
      }
    };

    sendNextChunk();
  } catch (error) {
    send({
      type: 'error',
      error: (error as Error).message || 'Streaming sync failed',
    });
  }
}
