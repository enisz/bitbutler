import { ipcMain, safeStorage } from 'electron';
import FormData from 'form-data';
import fs from 'node:fs';
import db from '../db.js';
import { rebuildMenu } from '../menu.js';
import { rebuildTrayMenu } from '../tray.js';

const cookieJar = new Map();

export function getCookieJar() {
  return cookieJar;
}

export function registerQbIpcHandlers() {
  ipcMain.handle('qb:login', async (_event, payload) => qbLogin(payload));
  ipcMain.handle('qb:logout', async (_event, payload) => qbLogout(payload));
  ipcMain.handle('qb:has-cookie', async (_event, payload) => qbHasCookie(payload));
  ipcMain.handle('qb:request', async (_event, payload) => qbRequest(payload));
  ipcMain.handle('qb:torrentsAdd', async (_evt, payload) => qbTorrentsAdd(payload));
  ipcMain.on('qb:sync-maindata-stream', async (event, payload) =>
    qbSyncMaindataStream(event, payload),
  );
}

const stmtGetByIdFull = db.prepare(`
  SELECT id, name, host, protocol, port, username, password, auto_login, created_at
  FROM servers
  WHERE id = ?
`);

async function qbTorrentsAdd(payload) {
  const { id, torrents, urls, options } = payload;

  const fd = new FormData();
  let appended = 0;

  for (const t of torrents ?? []) {
    if (!t?.name) continue;

    if (t?.path) {
      const buf = await fs.promises.readFile(t.path);
      fd.append('torrents', buf, { filename: t.name });
      appended++;
    } else if (Array.isArray(t?.bytes)) {
      fd.append('torrents', Buffer.from(t.bytes), { filename: t.name });
      appended++;
    }
  }

  if (Array.isArray(urls) && urls.length > 0) {
    fd.append('urls', urls.join('\n'));
    appended++;
  }

  if (!appended) throw new Error('No torrent or URL attached to form-data.');

  for (const [k, v] of Object.entries(options ?? {})) {
    if (v === undefined || v === null) continue;
    if (typeof v === 'string' && v.trim() === '') continue;
    if (k === 'paused') fd.append('stopped', String(v));
    fd.append(k, String(v));
  }

  const bodyBuffer = fd.getBuffer();

  const headers = {
    ...fd.getHeaders(),
    'Content-Length': String(bodyBuffer.length),
  };

  return qbRequest({
    id,
    method: 'POST',
    path: '/api/v2/torrents/add',
    headers,
    body: bodyBuffer,
  });
}

function qbHasCookie(payload) {
  const id = requireString(payload?.id, 'id');
  return { hasCookie: cookieJar.has(id) };
}

function qbLogout(payload) {
  cookieJar.clear();
  ipcMain.emit('server:set-active', null, null);
  rebuildMenu();
  rebuildTrayMenu();

  return { loggedOut: true };
}

async function qbLogin(payload) {
  const id = requireString(payload?.id, 'id');

  const server = stmtGetByIdFull.get(id);
  if (!server) throw new Error('Server not found.');

  const passwordEncrypted = server.password;
  const password = decryptPassword(passwordEncrypted);

  const url = buildBaseUrl(server) + '/api/v2/auth/login';
  const body = new URLSearchParams({
    username: server.username,
    password,
  });

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Referer: buildBaseUrl(server),
    },
    body,
  });

  const text = await res.text();
  if (!res.ok || !/^Ok\./i.test(text.trim())) {
    throw new Error('Login failed. Check username/password and WebUI settings.');
  }

  const cookie = extractSidCookie(res);
  if (!cookie) {
    throw new Error(
      'Login succeeded but SID cookie was not returned (check proxy/HTTPS/WebUI config).',
    );
  }

  cookieJar.set(id, cookie);
  ipcMain.emit('server:set-active', null, id);
  rebuildMenu();
  rebuildTrayMenu();
  return { loggedIn: true };
}

export async function qbRequest(payload) {
  const id = requireString(payload?.id, 'id');
  const path = requireString(payload?.path, 'path');
  const method = String(payload?.method ?? 'GET').toUpperCase();
  const query = payload?.query;
  const body = payload?.body;
  const form = payload?.form;
  const headersIn = payload?.headers;

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

  const headers = {
    Cookie: sid,
    Referer: baseUrl,
    Origin: baseUrl,
  };

  if (headersIn && typeof headersIn === 'object') {
    Object.assign(headers, headersIn);
  }

  let requestBody = undefined;

  if (form && typeof form === 'object') {
    headers['Content-Type'] = 'application/x-www-form-urlencoded';

    const usp = new URLSearchParams();
    for (const [k, v] of Object.entries(form)) {
      if (v === undefined || v === null) continue;
      usp.set(k, String(v));
    }
    requestBody = usp.toString();
  } else if (body !== undefined && body !== null) {
    const isFormData =
      typeof body === 'object' &&
      typeof body.getHeaders === 'function' &&
      typeof body.pipe === 'function';

    const isStream = typeof body?.pipe === 'function';
    const isBuffer = Buffer.isBuffer(body);

    if (isFormData) {
      Object.assign(headers, body.getHeaders());
      requestBody = body;
    } else if (isStream || isBuffer) {
      requestBody = body;
    } else if (typeof body === 'string') {
      requestBody = body;
    } else if (typeof body === 'object') {
      headers['Content-Type'] = 'application/json';
      requestBody = JSON.stringify(body);
    }
  }

  const isStreamLike =
    requestBody && typeof requestBody === 'object' && typeof requestBody.pipe === 'function';

  const res = await fetch(url.toString(), {
    method,
    headers,
    body: requestBody,
    ...(isStreamLike ? { duplex: 'half' } : {}),
  });

  const text = await res.text();

  if (!res.ok) {
    throw JSON.stringify({
      name: 'QbHttpError',
      status: res.status,
      statusText: res.statusText,
      body: text,
      path,
    });
  }

  const rotated = extractSidCookie(res);
  if (rotated) cookieJar.set(id, rotated);

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

function buildBaseUrl(server) {
  return `${server.protocol}://${server.host}:${server.port}`;
}

function decryptPassword(passwordBlob) {
  const buf = Buffer.isBuffer(passwordBlob) ? passwordBlob : Buffer.from(passwordBlob ?? '');
  return safeStorage.decryptString(buf);
}

function extractSidCookie(res) {
  const h = res.headers;

  if (typeof h.getSetCookie === 'function') {
    const setCookies = h.getSetCookie();
    return findSidInSetCookies(setCookies);
  }

  const raw = h.get('set-cookie');
  if (!raw) return null;

  const parts = raw.split(/,(?=\s*SID=)/g);
  return findSidInSetCookies(parts);
}

function findSidInSetCookies(setCookies) {
  if (!Array.isArray(setCookies)) return null;

  for (const c of setCookies) {
    const m = String(c).match(/(^|;\s*)SID=([^;]+)/);
    if (m) {
      const sidValue = m[2];
      return `SID=${sidValue}`;
    }
  }
  return null;
}

function requireString(value, field) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`Field '${field}' is required.`);
  }
  return value.trim();
}

async function qbSyncMaindataStream(event, payload) {
  const { id, rid, chunkSize = 500, delayMs = 15, sortBy, sortDesc } = payload;
  const channel = 'qb:sync-maindata-chunk';

  try {
    const res = await qbRequest({
      id,
      method: 'GET',
      path: '/api/v2/sync/maindata',
      query: { rid },
    });
    const maindata = res;
    const allTorrents = maindata.torrents || {};

    let torrentHashes = Object.keys(allTorrents);
    const totalTorrents = torrentHashes.length;

    if (sortBy && totalTorrents > 0) {
      torrentHashes.sort((hashA, hashB) => {
        let valA = allTorrents[hashA][sortBy];
        let valB = allTorrents[hashB][sortBy];

        if (valA === undefined || valA === null) valA = '';
        if (valB === undefined || valB === null) valB = '';

        if (typeof valA === 'string') valA = valA.toLowerCase();
        if (typeof valB === 'string') valB = valB.toLowerCase();

        if (valA < valB) return sortDesc ? 1 : -1;
        if (valA > valB) return sortDesc ? -1 : 1;
        return 0;
      });
    }

    delete maindata.torrents;

    event.reply(channel, { type: 'metadata', data: maindata, total: totalTorrents });

    if (totalTorrents === 0) {
      event.reply(channel, { type: 'done' });
      return;
    }

    let currentIndex = 0;

    const sendNextChunk = () => {
      const chunk = {};
      const end = Math.min(currentIndex + chunkSize, totalTorrents);

      for (let i = currentIndex; i < end; i++) {
        const hash = torrentHashes[i];
        chunk[hash] = allTorrents[hash];
      }

      event.reply(channel, { type: 'chunk', data: chunk, progress: end, total: totalTorrents });

      currentIndex = end;

      if (currentIndex < totalTorrents) {
        setTimeout(sendNextChunk, delayMs);
      } else {
        event.reply(channel, { type: 'done' });
      }
    };

    sendNextChunk();
  } catch (error) {
    event.reply(channel, { type: 'error', error: error.message || 'Streaming sync failed' });
  }
}
