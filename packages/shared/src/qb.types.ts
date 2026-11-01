import type {
  Maindata,
  QbAppPreferences,
  QbCategory,
  QbLogEntry,
  QbLogPeerEntry,
  QbSetAppPreferences,
  QbTorrentContent,
  QbTorrentPeersResponse,
  QbTorrentProperties,
  QbTorrentTracker,
  Torrent,
} from './models/qb.model.js';

export type QbErrorCode =
  | 'UNAUTHENTICATED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'UNREACHABLE'
  | 'UNSUPPORTED'
  | 'INVALID'
  | 'FAILED';

export type IpcResult<T> =
  | { ok: true; data: T }
  | { ok: false; code: QbErrorCode; message: string };

type R<T> = Promise<IpcResult<T>>;

export interface BitButlerQbAPI {
  auth: {
    login(serverId: string, username?: string, password?: string): R<{ loggedIn: boolean }>;
    logout(serverId: string): R<{ loggedOut: boolean }>;
    hasCookie(serverId: string): R<boolean>;
  };

  app: {
    preferences(serverId: string): R<QbAppPreferences>;
    setPreferences(serverId: string, prefs: QbSetAppPreferences): R<void>;
  };

  log: {
    main(
      serverId: string,
      options?: {
        normal?: boolean;
        info?: boolean;
        warning?: boolean;
        critical?: boolean;
        last_known_id?: number;
      },
    ): R<QbLogEntry[]>;
    peers(serverId: string, options?: { last_known_id?: number }): R<QbLogPeerEntry[]>;
  };

  sync: {
    maindata(serverId: string, rid: number): R<Maindata>;
    torrentPeers(serverId: string, hash: string, rid?: number): R<QbTorrentPeersResponse>;
  };

  torrents: {
    properties(serverId: string, hash: string): R<QbTorrentProperties>;
    info(serverId: string, hash: string): R<Torrent | null>;
    trackers(serverId: string, hash: string): R<QbTorrentTracker[]>;
    files(serverId: string, hash: string): R<QbTorrentContent[]>;
    setLocation(serverId: string, hashes: string[], location: string): R<void>;
    rename(serverId: string, hash: string, name: string): R<void>;
    renameFile(serverId: string, hash: string, oldPath: string, newPath: string): R<void>;
    renameFolder(serverId: string, hash: string, oldPath: string, newPath: string): R<void>;
    filePrio(serverId: string, hash: string, ids: number[], priority: number): R<void>;
    increasePrio(serverId: string, hashes: string[]): R<void>;
    decreasePrio(serverId: string, hashes: string[]): R<void>;
    topPrio(serverId: string, hashes: string[]): R<void>;
    bottomPrio(serverId: string, hashes: string[]): R<void>;
    delete(serverId: string, hashes: string[], deleteFiles: boolean): R<string>;
    recheck(serverId: string, hashes: string[]): R<void>;
    reannounce(serverId: string, hashes: string[]): R<void>;
    stop(serverId: string, hashes: string[] | 'all'): R<void>;
    start(serverId: string, hashes: string[] | 'all'): R<void>;
    setForceStart(serverId: string, hashes: string[], value: boolean): R<void>;
    setSuperSeeding(serverId: string, hashes: string[], value: boolean): R<void>;
    setAutoManagement(serverId: string, hashes: string[], enable: boolean): R<void>;
    addTags(serverId: string, hashes: string[], tags: string[]): R<void>;
    removeTags(serverId: string, hashes: string[], tags: string[]): R<void>;
    removeAllTags(serverId: string, hashes: string[]): R<void>;
    tags(serverId: string): R<string[]>;
    createTags(serverId: string, tags: string[]): R<void>;
    deleteTags(serverId: string, tags: string[]): R<void>;
    setCategory(serverId: string, hashes: string[], category: string): R<void>;
    clearCategory(serverId: string, hashes: string[]): R<void>;
    categories(serverId: string): R<Record<string, QbCategory>>;
    createCategory(serverId: string, category: string, savePath: string): R<void>;
    editCategory(serverId: string, category: string, savePath: string): R<void>;
    removeCategories(serverId: string, categories: string[]): R<void>;
    setShareLimits(
      serverId: string,
      hashes: string[],
      ratioLimit: number,
      seedingTimeLimit: number,
      inactiveSeedingTimeLimit: number,
    ): R<void>;
    downloadLimit(serverId: string, hashes: string[]): R<Record<string, number>>;
    setDownloadLimit(serverId: string, limit: number, hashes: string[]): R<void>;
    uploadLimit(serverId: string, hashes: string[]): R<Record<string, number>>;
    setUploadLimit(serverId: string, limit: number, hashes: string[]): R<void>;
    setDownloadPath(serverId: string, hashes: string[], path: string): R<void>;
    toggleSequentialDownload(serverId: string, hashes: string[]): R<void>;
    toggleFirstLastPiecePrio(serverId: string, hashes: string[]): R<void>;
  };

  transfer: {
    downloadLimit(serverId: string): R<number>;
    setDownloadLimit(serverId: string, limit: number): R<void>;
    uploadLimit(serverId: string): R<number>;
    setUploadLimit(serverId: string, limit: number): R<void>;
    speedLimitsMode(serverId: string): R<boolean>;
    toggleSpeedLimitsMode(serverId: string): R<void>;
  };
}

export type QbMethodName = {
  [G in keyof BitButlerQbAPI]: `${G}.${Extract<keyof BitButlerQbAPI[G], string>}`;
}[keyof BitButlerQbAPI];

// A Record keyed by every method name forces this list to stay complete: a missing or
// misspelled entry is a compile error, and the keys give the runtime list.
const QB_METHOD_MAP: Record<QbMethodName, true> = {
  'auth.login': true,
  'auth.logout': true,
  'auth.hasCookie': true,
  'app.preferences': true,
  'app.setPreferences': true,
  'log.main': true,
  'log.peers': true,
  'sync.maindata': true,
  'sync.torrentPeers': true,
  'torrents.properties': true,
  'torrents.info': true,
  'torrents.trackers': true,
  'torrents.files': true,
  'torrents.setLocation': true,
  'torrents.rename': true,
  'torrents.renameFile': true,
  'torrents.renameFolder': true,
  'torrents.filePrio': true,
  'torrents.increasePrio': true,
  'torrents.decreasePrio': true,
  'torrents.topPrio': true,
  'torrents.bottomPrio': true,
  'torrents.delete': true,
  'torrents.recheck': true,
  'torrents.reannounce': true,
  'torrents.stop': true,
  'torrents.start': true,
  'torrents.setForceStart': true,
  'torrents.setSuperSeeding': true,
  'torrents.setAutoManagement': true,
  'torrents.addTags': true,
  'torrents.removeTags': true,
  'torrents.removeAllTags': true,
  'torrents.tags': true,
  'torrents.createTags': true,
  'torrents.deleteTags': true,
  'torrents.setCategory': true,
  'torrents.clearCategory': true,
  'torrents.categories': true,
  'torrents.createCategory': true,
  'torrents.editCategory': true,
  'torrents.removeCategories': true,
  'torrents.setShareLimits': true,
  'torrents.downloadLimit': true,
  'torrents.setDownloadLimit': true,
  'torrents.uploadLimit': true,
  'torrents.setUploadLimit': true,
  'torrents.setDownloadPath': true,
  'torrents.toggleSequentialDownload': true,
  'torrents.toggleFirstLastPiecePrio': true,
  'transfer.downloadLimit': true,
  'transfer.setDownloadLimit': true,
  'transfer.uploadLimit': true,
  'transfer.setUploadLimit': true,
  'transfer.speedLimitsMode': true,
  'transfer.toggleSpeedLimitsMode': true,
};

export const QB_METHODS: readonly QbMethodName[] = Object.keys(QB_METHOD_MAP) as QbMethodName[];
