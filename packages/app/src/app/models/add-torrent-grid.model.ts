import type { ColumnState } from 'ag-grid-community';

export interface AddTorrentGridSettings {
  columnState: ColumnState[];
}

export const DEFAULT_ADD_TORRENT_GRID_SETTINGS: AddTorrentGridSettings = {
  columnState: [
    { colId: 'name', hide: false, flex: 2 },
    { colId: 'state', hide: false, width: 120 },
    { colId: 'size', hide: false, width: 130 },
    { colId: 'fileCount', hide: false, width: 100 },
    { colId: 'folderCount', hide: false, width: 100 },
    { colId: 'relativePath', hide: false, flex: 1 },
  ],
};
