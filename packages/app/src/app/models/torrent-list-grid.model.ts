import type { ColumnState } from 'ag-grid-community';

export type RowDoubleClickAction = 'SAVE_PATH' | 'DETAILS' | 'NONE';

export interface TorrentListGridSettings {
  columnState: (ColumnState[] | string[]) | null;
  filterModel: any;
  pagination: boolean;
  animateRows: boolean;
  compactRows: boolean;
  rowDoubleClickAction: RowDoubleClickAction;
  pinnedTopHashes: string[];
  pinnedBottomHashes: string[];
  floatingFilters: boolean;
  pausePollingOnModal: boolean;
}

export const DEFAULT_TORRENT_LIST_GRID_SETTINGS: TorrentListGridSettings = {
  columnState: [
    'name',
    'size',
    'progress',
    'dlspeed',
    'upspeed',
    'eta',
    'downloaded',
    'uploaded',
    'ratio',
    'added_on',
    'save_path',
  ],
  filterModel: {},
  pagination: false,
  animateRows: true,
  compactRows: false,
  rowDoubleClickAction: 'DETAILS',
  pinnedTopHashes: [],
  pinnedBottomHashes: [],
  floatingFilters: false,
  pausePollingOnModal: false,
};
