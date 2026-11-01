import { qbCall } from './client.js';

async function post(serverId: string, endpoint: string, form?: Record<string, string>) {
  await qbCall<void>(serverId, { method: 'POST', path: `/api/v2/transfer/${endpoint}`, form });
}

export async function downloadLimit(serverId: string): Promise<number> {
  return qbCall<number>(serverId, { method: 'GET', path: '/api/v2/transfer/downloadLimit' });
}

export async function setDownloadLimit(serverId: string, limit: number): Promise<void> {
  await post(serverId, 'setDownloadLimit', { limit: String(limit) });
}

export async function uploadLimit(serverId: string): Promise<number> {
  return qbCall<number>(serverId, { method: 'GET', path: '/api/v2/transfer/uploadLimit' });
}

export async function setUploadLimit(serverId: string, limit: number): Promise<void> {
  await post(serverId, 'setUploadLimit', { limit: String(limit) });
}

// qBittorrent answers 0 or 1.
export async function speedLimitsMode(serverId: string): Promise<boolean> {
  const raw = await qbCall<number>(serverId, {
    method: 'GET',
    path: '/api/v2/transfer/speedLimitsMode',
  });
  return Number(raw) === 1;
}

export async function toggleSpeedLimitsMode(serverId: string): Promise<void> {
  await post(serverId, 'toggleSpeedLimitsMode');
}
