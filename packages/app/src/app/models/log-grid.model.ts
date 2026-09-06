import type { ColumnState } from 'ag-grid-community';

export interface LogGridSettings {
  columnState: ColumnState[] | null;
  colorCodingEnabled: boolean;
}

export const DEFAULT_LOG_GRID_SETTINGS: LogGridSettings = {
  columnState: null,
  colorCodingEnabled: false,
};
