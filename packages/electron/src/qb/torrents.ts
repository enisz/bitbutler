import { qbCall } from './client.js';
import { QbBridgeError } from './errors.js';
import { cleanHashes } from './hashes.js';
import { getWebapiVersion } from './server-info.js';

// qBittorrent 5.0 (WebAPI 2.11) renamed torrents/pause|resume to torrents/stop|start and dropped the
// old names. The thresholds are not documented, so the version only picks which pair to try first.
const START_STOP_MIN_WEBAPI = [2, 11, 0];

type RunApi = 'START_STOP' | 'PAUSE_RESUME';

const runApiCache = new Map<string, RunApi>();

export function resetTorrentRunCache(): void {
  runApiCache.clear();
}

function usesStartStop(webapiVersion: string | null): boolean {
  if (!webapiVersion) return false;
  const parts = webapiVersion.split('.').map((n) => Number.parseInt(n, 10) || 0);
  for (let i = 0; i < START_STOP_MIN_WEBAPI.length; i++) {
    const diff = (parts[i] ?? 0) - START_STOP_MIN_WEBAPI[i];
    if (diff !== 0) return diff > 0;
  }
  return true;
}

async function post<T = void>(
  serverId: string,
  endpoint: string,
  form: Record<string, string>,
): Promise<T> {
  return qbCall<T>(serverId, { method: 'POST', path: `/api/v2/torrents/${endpoint}`, form });
}

// Posts `{ hashes }` to an endpoint, doing nothing for an empty hash list.
function hashesCall(endpoint: string): (serverId: string, hashes: string[]) => Promise<void> {
  return async (serverId, hashes) => {
    const joined = cleanHashes(hashes);
    if (!joined) return;
    await post(serverId, endpoint, { hashes: joined });
  };
}

// Posts `{ hashes, [field]: 'true' | 'false' }`, doing nothing for an empty hash list.
function flagCall(
  endpoint: string,
  field: string,
): (serverId: string, hashes: string[], flag: boolean) => Promise<void> {
  return async (serverId, hashes, flag) => {
    const joined = cleanHashes(hashes);
    if (!joined) return;
    await post(serverId, endpoint, { hashes: joined, [field]: String(flag) });
  };
}

/**
 * Stops or starts torrents on any qBittorrent version. Tries the endpoint pair matching the server's
 * WebAPI version (or the one that worked last time), falls back to the other pair on NOT_FOUND, and
 * throws UNSUPPORTED if neither works.
 */
async function run(
  serverId: string,
  action: 'stop' | 'start',
  hashes: string[] | 'all',
): Promise<void> {
  const hashesParam = hashes === 'all' ? 'all' : cleanHashes(hashes);
  if (!hashesParam) return;

  const first: RunApi =
    runApiCache.get(serverId) ??
    (usesStartStop(getWebapiVersion(serverId)) ? 'START_STOP' : 'PAUSE_RESUME');
  const second: RunApi = first === 'START_STOP' ? 'PAUSE_RESUME' : 'START_STOP';

  const endpointFor = (api: RunApi): string => {
    if (api === 'START_STOP') return action;
    return action === 'start' ? 'resume' : 'pause';
  };

  for (const api of [first, second]) {
    try {
      await post(serverId, endpointFor(api), { hashes: hashesParam });
      runApiCache.set(serverId, api);
      return;
    } catch (err) {
      if (!(err instanceof QbBridgeError) || err.code !== 'NOT_FOUND') throw err;
      if (api === second) {
        throw new QbBridgeError('UNSUPPORTED', `This server does not support torrents/${action}.`);
      }
    }
  }
}

export const stop = (serverId: string, hashes: string[] | 'all'): Promise<void> =>
  run(serverId, 'stop', hashes);

export const start = (serverId: string, hashes: string[] | 'all'): Promise<void> =>
  run(serverId, 'start', hashes);

export async function remove(
  serverId: string,
  hashes: string[],
  deleteFiles: boolean,
): Promise<string> {
  const joined = cleanHashes(hashes);
  if (!joined) throw new QbBridgeError('INVALID', 'No hashes to delete');
  return post<string>(serverId, 'delete', {
    hashes: joined,
    deleteFiles: deleteFiles ? 'true' : 'false',
  });
}

export const recheck = hashesCall('recheck');
export const reannounce = hashesCall('reannounce');
export const increasePrio = hashesCall('increasePrio');
export const decreasePrio = hashesCall('decreasePrio');
export const topPrio = hashesCall('topPrio');
export const bottomPrio = hashesCall('bottomPrio');
export const toggleSequentialDownload = hashesCall('toggleSequentialDownload');
export const toggleFirstLastPiecePrio = hashesCall('toggleFirstLastPiecePrio');

export const setForceStart = flagCall('setForceStart', 'value');
export const setSuperSeeding = flagCall('setSuperSeeding', 'value');
export const setAutoManagement = flagCall('setAutoManagement', 'enable');
