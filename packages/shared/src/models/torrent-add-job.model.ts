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
  /** Shown in failure/duplicate toasts so the user can tell which torrent a message is about. */
  displayName?: string;
  /**
   * How a duplicate (409) is reported: with the "torrent already exists" dialog (default), or
   * with a toast - for batches, where one dialog per file would be too much.
   */
  duplicateAs?: 'dialog' | 'toast';
  /** Source .torrent file on disk, passed on to the "torrent already exists" dialog. */
  originalPath?: string;
  /** Delete `originalPath` once qBittorrent has accepted the torrent. */
  deleteOriginalOnSuccess?: boolean;
  renames?: TorrentAddJobRename[];
  priorities?: TorrentAddJobFilePriority[];
  shareLimits?: TorrentAddJobShareLimits;
}

/**
 * `add` failures mean the torrent never reached qBittorrent; `setup` failures mean it was added
 * but a follow-up step (rename, priorities, share limits) failed.
 */
export type TorrentAddJobFailedStage = 'add' | 'setup';

export interface TorrentAddJob {
  id: string;
  status: TorrentAddJobStatus;
  error?: string;
  failedStage?: TorrentAddJobFailedStage;
  /** The failure was an auth problem that re-logging in could not fix. */
  authExpired?: boolean;
  /** Set once qBittorrent has accepted the torrent, so a retry skips the add. */
  addAccepted?: boolean;
  createdAt: number;
  payload: TorrentAddJobPayload;
}
