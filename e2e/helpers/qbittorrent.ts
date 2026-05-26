// e2e/helpers/qbittorrent.ts
import { execFileSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';

export const QB_HOST = '127.0.0.1';
export const QB_PORT = 8080;
export const QB_USER = 'admin';
export const QB_PASS = 'adminadmin';

const CONTAINER = 'bitbutler-e2e-qb';
// Pin to a specific release - update when upgrading qBittorrent in CI
const IMAGE = 'qbittorrentofficial/qbittorrent-nox:5.2.0-1';
const BASE_URL = `http://${QB_HOST}:${QB_PORT}`;

export function startContainer(): void {
  execFileSync('docker', ['rm', '-f', CONTAINER], { stdio: 'ignore' });
  execFileSync(
    'docker',
    ['run', '-d', '--name', CONTAINER, '-p', `${QB_PORT}:8080`, '-e', 'QBT_LEGAL_NOTICE=confirm', IMAGE],
    { stdio: 'pipe' },
  );
}

export function stopContainer(): void {
  execFileSync('docker', ['rm', '-f', CONTAINER], { stdio: 'ignore' });
}

export function readTempPassword(): string {
  const logs = execFileSync('docker', ['logs', CONTAINER]).toString();
  // qBittorrent <5.1: "Temporary password generated for your user: <pass>"
  // qBittorrent 5.1+: "A temporary password is provided for this session: <pass>"
  const match = logs.match(/(?:Temporary password generated for your user|A temporary password is provided for this session): (.+)/);
  if (!match) throw new Error('Could not find temporary password in container logs');
  return match[1].trim();
}

export async function waitForReady(maxAttempts = 120): Promise<void> {
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const res = await fetch(`${BASE_URL}/api/v2/app/version`);
      // 200 = ready (older qB), 403 = ready but auth required (qB 5.2+)
      if (res.ok || res.status === 403) return;
    } catch {
      // not ready yet
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error('qBittorrent-nox did not become ready in time');
}

// Returns the full cookie string, e.g. "SID=abc123" or "QBT_SID_8080=abc123"
// qBittorrent <5 uses "SID=", qBittorrent 5+ uses "QBT_SID_<port>="
export async function login(username: string, password: string): Promise<string> {
  const body = new URLSearchParams({ username, password });
  const res = await fetch(`${BASE_URL}/api/v2/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });
  const setCookie = res.headers.get('set-cookie') ?? '';
  const match = setCookie.match(/((?:QBT_SID_\d+|SID)=[^;]+)/);
  if (!match) throw new Error('Login failed - no SID cookie');
  return match[1];
}

export async function changePassword(sid: string, newPassword: string): Promise<void> {
  const body = new URLSearchParams({ json: JSON.stringify({ web_ui_password: newPassword }) });
  await fetch(`${BASE_URL}/api/v2/app/setPreferences`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Cookie: sid,
    },
    body: body.toString(),
  });
}

export async function addTorrent(sid: string, torrentPath: string): Promise<void> {
  const formData = new FormData();
  const torrentBytes = fs.readFileSync(torrentPath);
  formData.append(
    'torrents',
    new Blob([torrentBytes], { type: 'application/x-bittorrent' }),
    path.basename(torrentPath),
  );
  formData.append('paused', 'true');
  const res = await fetch(`${BASE_URL}/api/v2/torrents/add`, {
    method: 'POST',
    headers: { Cookie: sid },
    body: formData,
  });
  if (!res.ok) throw new Error(`addTorrent failed: ${res.status}`);
}

export async function deleteTorrent(sid: string, hash: string): Promise<void> {
  const body = new URLSearchParams({ hashes: hash, deleteFiles: 'false' });
  await fetch(`${BASE_URL}/api/v2/torrents/delete`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Cookie: sid,
    },
    body: body.toString(),
  });
}

export async function getTorrents(sid: string): Promise<Array<{ hash: string; name: string }>> {
  const res = await fetch(`${BASE_URL}/api/v2/torrents/info`, {
    headers: { Cookie: sid },
  });
  return res.json() as Promise<Array<{ hash: string; name: string }>>;
}

export async function getTorrentProperties(
  sid: string,
  hash: string,
): Promise<{ save_path: string }> {
  const res = await fetch(`${BASE_URL}/api/v2/torrents/properties?hash=${hash}`, {
    headers: { Cookie: sid },
  });
  return res.json() as Promise<{ save_path: string }>;
}

export async function getTorrentInfo(
  sid: string,
): Promise<Array<{ hash: string; name: string; state: string; tags: string }>> {
  const res = await fetch(`${BASE_URL}/api/v2/torrents/info`, {
    headers: { Cookie: sid },
  });
  return res.json() as Promise<Array<{ hash: string; name: string; state: string; tags: string }>>;
}

export async function getTorrentFiles(
  sid: string,
  hash: string,
): Promise<Array<{ name: string; index: number }>> {
  const res = await fetch(`${BASE_URL}/api/v2/torrents/files?hash=${hash}`, {
    headers: { Cookie: sid },
  });
  return res.json() as Promise<Array<{ name: string; index: number }>>;
}

export async function renameTorrentFile(
  sid: string,
  hash: string,
  oldPath: string,
  newPath: string,
): Promise<void> {
  const body = new URLSearchParams({ hash, oldPath, newPath });
  await fetch(`${BASE_URL}/api/v2/torrents/renameFile`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Cookie: sid },
    body: body.toString(),
  });
}

export async function createTag(sid: string, tag: string): Promise<void> {
  const body = new URLSearchParams({ tags: tag });
  await fetch(`${BASE_URL}/api/v2/torrents/createTags`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Cookie: sid },
    body: body.toString(),
  });
}

export async function deleteTags(sid: string, tags: string): Promise<void> {
  const body = new URLSearchParams({ tags });
  await fetch(`${BASE_URL}/api/v2/torrents/deleteTags`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Cookie: sid },
    body: body.toString(),
  });
}

export async function getSid(): Promise<string> {
  return login(QB_USER, QB_PASS);
}
