import type { ColumnState, FilterModel } from 'ag-grid-community';

export interface ManageTagsGridSettings {
  columnState: ColumnState[];
  filterModel: FilterModel | null;
}

export const DEFAULT_MANAGE_TAGS_GRID_SETTINGS: ManageTagsGridSettings = {
  columnState: [],
  filterModel: null,
};
