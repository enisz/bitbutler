export type TorrentDraftSource = 'startup' | 'second-instance' | 'renderer' | 'dragdrop' | 'manual';

export interface TorrentFileEntry {
  path: string;
  length: number;
  priority?: number;
  progress?: number;
  index?: number;
}

export interface TorrentDraftError {
  message: string;
  code?: string;
}

export interface TorrentDraft {
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
}
