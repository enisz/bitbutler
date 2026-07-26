export type ScannedTorrentState = 'new' | 'exists' | 'error' | 'added' | 'failed';

export interface ScannedTorrentEntry {
  path: string;
  relativePath: string;
  name: string;
  size: number;
  fileCount: number;
  folderCount: number;
  state: ScannedTorrentState;
  errorMessage?: string;
  hash: string | null;
}
