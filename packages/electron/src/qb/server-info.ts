import type { BbeServerInfo } from '@bitbutler/shared';
import { qbRequest } from '../ipc/qbittorrent.js';
import { getConnectionInfo, getExportAvailable, setConnectionInfo } from '../ipc/server.js';
import { qbCall } from './client.js';

export function getWebapiVersion(serverId: string): string | null {
  return getConnectionInfo(serverId).webapiVersion;
}

async function probeFullMode(serverId: string): Promise<boolean> {
  try {
    await qbRequest({ id: serverId, path: '/api/v2/torrents/export', responseType: 'buffer' });
    return true;
  } catch (err) {
    try {
      const { status } = JSON.parse(err as string) as { status?: number };
      return status !== 404;
    } catch {
      return false;
    }
  }
}

export async function resolveFullMode(serverId: string): Promise<boolean> {
  const cached = getExportAvailable(serverId);
  return cached === null ? probeFullMode(serverId) : cached === 1;
}

export async function refreshServerInfo(serverId: string): Promise<BbeServerInfo> {
  const [webapiVersion, qbVersion, isFullMode] = await Promise.all([
    qbCall<string>(serverId, { path: '/api/v2/app/webapiVersion' }),
    qbCall<string>(serverId, { path: '/api/v2/app/version' }),
    resolveFullMode(serverId),
  ]);
  const info: BbeServerInfo = {
    webapiVersion: webapiVersion.trim(),
    qbVersion: qbVersion.trim(),
    isFullMode,
  };
  setConnectionInfo(serverId, {
    exportAvailable: isFullMode ? 1 : 0,
    webapiVersion: info.webapiVersion,
    qbVersion: info.qbVersion,
  });
  return info;
}
