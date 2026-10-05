export type TorrentAddJobStatus =
  | 'pending'
  | 'awaiting-registration'
  | 'renaming'
  | 'applying-priorities'
  | 'done'
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

/**
 * Describes the post-add work for a torrent that has already been handed to qBittorrent via
 * `qb.torrentsAdd` - renaming files/folders, setting non-default file priorities, and/or applying
 * share limits. This is queued separately because every one of these calls needs the torrent to
 * be registered server-side first, which can take a few seconds and previously blocked the
 * add-torrent modal from advancing to the next queued draft.
 */
export interface TorrentAddJobPayload {
  serverId: string;
  infoHash: string;
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
