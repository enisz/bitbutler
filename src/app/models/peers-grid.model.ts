import type { ColumnState } from 'ag-grid-community';

export interface PeersGridSettings {
  columnState: ColumnState[];
  floatingFilters: boolean;
}

export const DEFAULT_PEERS_GRID_SETTINGS: PeersGridSettings = {
  floatingFilters: false,
  columnState: [
    { colId: 'country_code', hide: false, width: 30 },
    { colId: 'country', hide: false },
    { colId: 'ip', hide: false },
    { colId: 'port', hide: false },
    { colId: 'connection', hide: false },
    { colId: 'flags', hide: false },
    { colId: 'client', hide: false },
    { colId: 'progress', hide: false, width: 135 },
    { colId: 'dl_speed', hide: false },
    { colId: 'up_speed', hide: false },
    { colId: 'downloaded', hide: false },
    { colId: 'uploaded', hide: false },
    { colId: 'relevance', hide: false },
    { colId: 'files', hide: false },
  ],
};
