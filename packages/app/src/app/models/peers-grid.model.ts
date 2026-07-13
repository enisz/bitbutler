import type { ColumnState } from 'ag-grid-community';

export interface PeersGridSettings {
  columnState: ColumnState[];
}

export const DEFAULT_PEERS_GRID_SETTINGS: PeersGridSettings = {
  columnState: [
    { colId: 'country_code', hide: false, width: 30 },
    { colId: 'country', hide: false },
    { colId: 'ip', hide: false },
    { colId: 'port', hide: false },
    { colId: 'connection', hide: false },
    { colId: 'flags', hide: false },
    { colId: 'client', hide: false },
    { colId: 'progress', hide: false, width: 135 },
    { colId: 'progress_percentage', hide: true },
    { colId: 'progress_raw', hide: true },
    { colId: 'dl_speed', hide: false },
    { colId: 'dl_speed_raw', hide: true },
    { colId: 'up_speed', hide: false },
    { colId: 'up_speed_raw', hide: true },
    { colId: 'downloaded', hide: false },
    { colId: 'downloaded_raw', hide: true },
    { colId: 'uploaded', hide: false },
    { colId: 'uploaded_raw', hide: true },
    { colId: 'relevance', hide: false },
    { colId: 'files', hide: false },
  ],
};
