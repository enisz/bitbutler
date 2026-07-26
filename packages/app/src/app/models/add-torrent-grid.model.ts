import type { ColumnState } from 'ag-grid-community';

export interface AddTorrentGridSettings {
  columnState: ColumnState[];
}

export const DEFAULT_ADD_TORRENT_GRID_SETTINGS: AddTorrentGridSettings = {
  columnState: [
    { colId: 'state', hide: false, width: 120 },
    { colId: 'name', hide: false, flex: 2 },
    { colId: 'size', hide: false, width: 130 },
    { colId: 'relativePath', hide: false, flex: 1 },
  ],
};
