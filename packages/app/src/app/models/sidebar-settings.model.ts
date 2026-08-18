export interface SidebarFilterGroupsOpen {
  status: boolean;
  trackers: boolean;
  categories: boolean;
  tags: boolean;
  savePaths: boolean;
}

export interface SidebarActiveFilters {
  statusKeys: string[];
  trackers: string[];
  savePaths: string[];
  categories: string[];
  tags: string[];
}

export interface SidebarSettings {
  collapsed: boolean;
  filterGroupsOpen: SidebarFilterGroupsOpen;
  activeFilters: SidebarActiveFilters;
}

export const DEFAULT_SIDEBAR_SETTINGS: SidebarSettings = {
  collapsed: false,
  filterGroupsOpen: {
    status: true,
    trackers: true,
    categories: true,
    tags: true,
    savePaths: true,
  },
  activeFilters: {
    statusKeys: [],
    trackers: [],
    savePaths: [],
    categories: [],
    tags: [],
  },
};
