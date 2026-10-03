import type { ColumnState, FilterModel } from 'ag-grid-community';

export interface ManageCategoriesGridSettings {
  columnState: ColumnState[];
  filterModel: FilterModel | null;
}

export const DEFAULT_MANAGE_CATEGORIES_GRID_SETTINGS: ManageCategoriesGridSettings = {
  columnState: [],
  filterModel: null,
};
