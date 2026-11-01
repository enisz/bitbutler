import type { BitButlerQbAPI, IpcResult, QbMethodName } from '@bitbutler/shared';
import { ipcMain } from 'electron';
import { hasCookieFor, loginServer, logoutServer } from '../ipc/qbittorrent.js';
import * as app from './app.js';
import { toQbError, toResult } from './errors.js';
import * as labels from './labels.js';
import * as details from './torrent-details.js';
import * as torrents from './torrents.js';
import * as transfer from './transfer.js';

/** A bridge method with `IpcResult` stripped: what its main-process handler resolves to. */
type Unwrap<F> = F extends (...args: infer A) => Promise<IpcResult<infer T>>
  ? (...args: A) => Promise<T>
  : never;

type QbHandlers = {
  [K in QbMethodName]: K extends `${infer G extends keyof BitButlerQbAPI}.${infer M}`
    ? M extends keyof BitButlerQbAPI[G]
      ? Unwrap<BitButlerQbAPI[G][M]>
      : never
    : never;
};

/**
 * Every bridge method mapped to its domain function. Typed from `BitButlerQbAPI`, so a
 * missing, extra or mistyped handler is a compile error.
 */
export const qbHandlers: QbHandlers = {
  'auth.login': async (serverId, username, password) => {
    try {
      return await loginServer(serverId, username, password);
    } catch (err) {
      // A 403 on login is an IP ban, not an expired session.
      throw toQbError(err, { login: true });
    }
  },
  'auth.logout': async (serverId) => logoutServer(serverId),
  'auth.hasCookie': async (serverId) => hasCookieFor(serverId),

  'app.preferences': app.preferences,
  'app.setPreferences': app.setPreferences,
  'log.main': app.logMain,
  'log.peers': app.logPeers,
  'sync.maindata': app.maindata,
  'sync.torrentPeers': app.torrentPeers,

  'torrents.properties': details.properties,
  'torrents.info': details.info,
  'torrents.trackers': details.trackers,
  'torrents.files': details.files,
  'torrents.setLocation': details.setLocation,
  'torrents.rename': details.rename,
  'torrents.renameFile': details.renameFile,
  'torrents.renameFolder': details.renameFolder,
  'torrents.filePrio': details.filePrio,
  'torrents.increasePrio': torrents.increasePrio,
  'torrents.decreasePrio': torrents.decreasePrio,
  'torrents.topPrio': torrents.topPrio,
  'torrents.bottomPrio': torrents.bottomPrio,
  'torrents.delete': torrents.remove,
  'torrents.recheck': torrents.recheck,
  'torrents.reannounce': torrents.reannounce,
  'torrents.stop': torrents.stop,
  'torrents.start': torrents.start,
  'torrents.setForceStart': torrents.setForceStart,
  'torrents.setSuperSeeding': torrents.setSuperSeeding,
  'torrents.setAutoManagement': torrents.setAutoManagement,
  'torrents.addTags': labels.addTags,
  'torrents.removeTags': labels.removeTags,
  'torrents.removeAllTags': labels.removeAllTags,
  'torrents.tags': labels.tags,
  'torrents.createTags': labels.createTags,
  'torrents.deleteTags': labels.deleteTags,
  'torrents.setCategory': labels.setCategory,
  'torrents.clearCategory': labels.clearCategory,
  'torrents.categories': labels.categories,
  'torrents.createCategory': labels.createCategory,
  'torrents.editCategory': labels.editCategory,
  'torrents.removeCategories': labels.removeCategories,
  'torrents.setShareLimits': details.setShareLimits,
  'torrents.downloadLimit': details.downloadLimit,
  'torrents.setDownloadLimit': details.setDownloadLimit,
  'torrents.uploadLimit': details.uploadLimit,
  'torrents.setUploadLimit': details.setUploadLimit,
  'torrents.setDownloadPath': details.setDownloadPath,
  'torrents.toggleSequentialDownload': torrents.toggleSequentialDownload,
  'torrents.toggleFirstLastPiecePrio': torrents.toggleFirstLastPiecePrio,

  'transfer.downloadLimit': transfer.downloadLimit,
  'transfer.setDownloadLimit': transfer.setDownloadLimit,
  'transfer.uploadLimit': transfer.uploadLimit,
  'transfer.setUploadLimit': transfer.setUploadLimit,
  'transfer.speedLimitsMode': transfer.speedLimitsMode,
  'transfer.toggleSpeedLimitsMode': transfer.toggleSpeedLimitsMode,
};

function isQbMethodName(method: unknown): method is QbMethodName {
  // Own-property check only, so inherited names like `__proto__` or `constructor` are rejected.
  return typeof method === 'string' && Object.hasOwn(qbHandlers, method);
}

async function dispatch(method: unknown, args: unknown): Promise<IpcResult<unknown>> {
  if (!isQbMethodName(method)) {
    const name = typeof method === 'string' ? method : `<${typeof method}>`;
    return { ok: false, code: 'INVALID', message: `Unknown qBittorrent method: ${name}` };
  }
  if (!Array.isArray(args)) {
    return { ok: false, code: 'INVALID', message: `Arguments for ${method} must be an array.` };
  }
  const handler = qbHandlers[method] as (...a: unknown[]) => Promise<unknown>;
  return toResult(() => handler(...(args as unknown[])));
}

export function registerQbBridgeHandlers(): void {
  ipcMain.handle('qb:call', async (_event, method: unknown, args: unknown) =>
    dispatch(method, args),
  );
}
