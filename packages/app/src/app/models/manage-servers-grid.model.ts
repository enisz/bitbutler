import type { ColumnState, FilterModel } from 'ag-grid-community';

export interface ManageServersGridSettings {
  columnState: ColumnState[];
  filterModel: FilterModel | null;
}

export const DEFAULT_MANAGE_SERVERS_GRID_SETTINGS: ManageServersGridSettings = {
  columnState: [],
  filterModel: null,
};
