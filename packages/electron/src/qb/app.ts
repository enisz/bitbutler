import type {
  Maindata,
  QbAppPreferences,
  QbLogEntry,
  QbLogPeerEntry,
  QbSetAppPreferences,
  QbTorrentPeersResponse,
} from '@bitbutler/shared';
import { qbCall } from './client.js';

export async function preferences(serverId: string): Promise<QbAppPreferences> {
  return qbCall<QbAppPreferences>(serverId, { method: 'GET', path: '/api/v2/app/preferences' });
}

export async function setPreferences(serverId: string, prefs: QbSetAppPreferences): Promise<void> {
  await qbCall<void>(serverId, {
    method: 'POST',
    path: '/api/v2/app/setPreferences',
    form: { json: JSON.stringify(prefs) },
  });
}

export async function logMain(
  serverId: string,
  options: {
    normal?: boolean;
    info?: boolean;
    warning?: boolean;
    critical?: boolean;
    last_known_id?: number;
  } = {},
): Promise<QbLogEntry[]> {
  return qbCall<QbLogEntry[]>(serverId, {
    method: 'GET',
    path: '/api/v2/log/main',
    query: { ...options },
  });
}

export async function logPeers(
  serverId: string,
  options: { last_known_id?: number } = {},
): Promise<QbLogPeerEntry[]> {
  return qbCall<QbLogPeerEntry[]>(serverId, {
    method: 'GET',
    path: '/api/v2/log/peers',
    query: { ...options },
  });
}

export async function maindata(serverId: string, rid: number): Promise<Maindata> {
  return qbCall<Maindata>(serverId, {
    method: 'GET',
    path: '/api/v2/sync/maindata',
    query: { rid },
  });
}

export async function torrentPeers(
  serverId: string,
  hash: string,
  rid = 0,
): Promise<QbTorrentPeersResponse> {
  return qbCall<QbTorrentPeersResponse>(serverId, {
    method: 'GET',
    path: '/api/v2/sync/torrentPeers',
    query: { hash, rid },
  });
}
