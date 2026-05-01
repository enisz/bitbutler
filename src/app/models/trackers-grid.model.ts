import type { ColumnState } from 'ag-grid-community';

export interface TrackersGridSettings {
  columnState: ColumnState[];
  floatingFilters: boolean;
}

export const DEFAULT_TRACKERS_GRID_SETTINGS: TrackersGridSettings = {
  floatingFilters: false,
  columnState: [
    { colId: 'tier', hide: false, width: 70 },
    { colId: 'url', hide: false },
    { colId: 'status', hide: false, width: 120 },
    { colId: 'num_peers', hide: false, width: 100 },
    { colId: 'num_seeds', hide: false, width: 100 },
    { colId: 'num_leeches', hide: false, width: 100 },
    { colId: 'num_downloaded', hide: false, width: 130 },
    { colId: 'msg', hide: false },
  ],
};
