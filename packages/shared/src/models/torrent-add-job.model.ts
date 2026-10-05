import type { SelectedTorrentInput } from '../ipc.types.js';

export type TorrentAddJobStatus =
  | 'pending'
  | 'adding'
  | 'awaiting-registration'
  | 'renaming'
  | 'applying-priorities'
  | 'done'
  | 'duplicate'
  | 'error';

export interface TorrentAddJobRename {
  oldPath: string;
  newPath: string;
}

export interface TorrentAddJobFilePriority {
  path: string;
  priority: number;
}

export interface TorrentAddJobShareLimits {
  ratioLimit: number;
  seedingTimeLimit: number;
  inactiveSeedingTimeLimit: number;
}

export interface TorrentAddJobAdd {
  torrents: SelectedTorrentInput[];
  urls?: string[];
  options?: Record<string, unknown>;
}

/**
 * Describes everything that happens after the user submits the add-torrent modal: the
 * `torrents/add` call itself, then (when infoHash is known and any are set) renaming files/folders,
 * setting non-default file priorities, and/or applying share limits - those need the torrent to
 * be registered server-side first, which can take a few seconds. All of it runs in the main
 * process queue so the modal never waits on qBittorrent.
 */
export interface TorrentAddJobPayload {
  serverId: string;
  add: TorrentAddJobAdd;
  infoHash?: string;
  /**
   * Display name. When set, a duplicate (409) is reported with a toast naming it; when absent
   * the renderer raises the "torrent already exists" dialog instead.
   */
  name?: string;
  /** Source .torrent file on disk, passed on to the "torrent already exists" dialog. */
  originalPath?: string;
  /** Delete `originalPath` once qBittorrent has accepted the torrent. */
  deleteOriginalOnSuccess?: boolean;
  renames?: TorrentAddJobRename[];
  priorities?: TorrentAddJobFilePriority[];
  shareLimits?: TorrentAddJobShareLimits;
}

export interface TorrentAddJob {
  id: string;
  status: TorrentAddJobStatus;
  error?: string;
  createdAt: number;
  payload: TorrentAddJobPayload;
}
