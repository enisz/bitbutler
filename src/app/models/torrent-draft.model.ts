export type TorrentDraftSource = 'startup' | 'second-instance' | 'renderer' | 'dragdrop';

export type TorrentFileEntry = {
  path: string;

  length: number;
  priority?: number;
  progress?: number;
  index?: number; // qBittorrent file index; present when loaded from the API
};

export type TorrentDraftError = {
  message: string;
  code?: string;
};

export type TorrentDraft = {
  source: TorrentDraftSource;
  receivedAt: number;

  originalPath?: string;

  originalName?: string;

  torrent?: {
    name: string;
    totalSize: number;
    files: TorrentFileEntry[];
    trackers?: string[];
    infoHashV1?: string;
    infoHashV2?: string;
    isPrivate?: boolean;
  };

  error?: TorrentDraftError;
};
