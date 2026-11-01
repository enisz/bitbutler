import { ipcMain, safeStorage } from 'electron';
import type FormData from 'form-data';
import db from '../db.js';
import { rebuildMenu } from '../menu.js';
import { refreshServerInfo } from '../qb/server-info.js';
import { clearTorrentRunCache } from '../qb/torrents.js';
import { rebuildTrayMenu } from '../tray.js';
import { getActiveServerId, getConnectionInfo } from './server.js';

// A host that drops packets never answers, so without a limit a request hangs until the OS gives up.
const REQUEST_TIMEOUT_MS = 20_000;

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
  webapi_version: string | null;
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
  SELECT id, name, host, protocol, port, username, password, auto_login, created_at, webapi_version
  FROM servers
  WHERE id = ?
`);

export function hasCookieFor(id: string): boolean {
  return cookieJar.has(id);
}

export function logoutServer(id: string): { loggedOut: boolean } {
  cookieJar.delete(id);
  clearTorrentRunCache(id);
  if (getActiveServerId() === id) {
    ipcMain.emit('server:set-active', null, null);
  }
  rebuildMenu();
  rebuildTrayMenu();
  return { loggedOut: true };
}

const LOGIN_FAILED_MESSAGE = 'Login failed. Check username/password and WebUI settings.';

// Logs in with the stored (or supplied) credentials and refreshes the cookie jar, without touching
// the active server or the menus - so background work can recover a dead session for any server.
async function loginAndStoreCookie(
  id: string,
  runtimeUsername?: string,
  runtimePassword?: string,
): Promise<void> {
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
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });

  const text = await res.text();
  if (!res.ok) {
    console.warn(`[BitButler][qbittorrent] Login failed for server ${id} (status ${res.status}).`);
    // Same shape as qbRequest's HTTP errors, so a 403 (IP ban) maps to FORBIDDEN and keeps
    // qBittorrent's readable ban message. A 401 is a wrong password, so it gets the friendly text.
    throw JSON.stringify({
      name: 'QbHttpError',
      status: res.status,
      statusText: res.statusText,
      body: res.status === 401 ? LOGIN_FAILED_MESSAGE : text,
      path: '/api/v2/auth/login',
    });
  }
  // qBittorrent before 5.0 answers wrong credentials with 200 "Fails.".
  if (res.status !== 204 && !/^Ok\./i.test(text.trim())) {
    console.warn(`[BitButler][qbittorrent] Login failed for server ${id} (status ${res.status}).`);
    throw new Error(LOGIN_FAILED_MESSAGE);
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
}

export async function qbRelogin(id: string): Promise<void> {
  await loginAndStoreCookie(id);
}

// Best-effort: a failed probe is logged and never fails the login. Skipped once all three values
// are stored, so a login against an already-probed server makes no extra requests.
async function probeServerInfoIfMissing(id: string): Promise<void> {
  const { exportAvailable, webapiVersion, qbVersion } = getConnectionInfo(id);
  if (exportAvailable !== null && webapiVersion !== null && qbVersion !== null) return;
  try {
    await refreshServerInfo(id);
  } catch (err) {
    console.warn(`[BitButler][qbittorrent] Server info probe failed for server ${id}.`, err);
  }
}

export async function loginServer(
  id: string,
  username?: string,
  password?: string,
): Promise<{ loggedIn: boolean }> {
  await loginAndStoreCookie(id, username, password);
  console.info(`[BitButler][qbittorrent] Logged in to server ${id}.`);
  await probeServerInfoIfMissing(id);
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
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
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
