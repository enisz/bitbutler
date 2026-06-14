import { GridOptions, iconSetQuartzLight, themeQuartz } from 'ag-grid-community';

export const API_URL = '/api/v2';

export const INVALID_FILENAME_CHARS = /^[^<>:"/\\|?*\x00-\x1f]+$/;

const GRID_PARAMS_SHARED = {
  fontFamily: 'inherit',
  accentColor: 'var(--bb-accent)',
  backgroundColor: 'var(--bs-body-bg)',
  chromeBackgroundColor: 'var(--bs-card-bg)',
  foregroundColor: 'var(--bs-body-color)',
  headerBackgroundColor: 'var(--bs-dropdown-bg)',
  headerTextColor: 'var(--bs-body-color)',
  headerFontSize: 13,
  headerVerticalPaddingScale: 1.05,
  borderColor: 'var(--bs-border-color)',
  oddRowBackgroundColor: 'color-mix(in srgb, var(--bs-body-color) 4%, transparent)',
  rowHoverColor: 'var(--bb-grid-row-hover-bg)',
  selectedRowBackgroundColor: 'color-mix(in srgb, var(--bb-accent) 20%, transparent)',
  rangeSelectionBackgroundColor: 'color-mix(in srgb, var(--bb-accent) 14%, transparent)',
  inputBorder: 'var(--bb-control-border)',
  inputFocusBorder: 'var(--bb-control-focus-border)',
  inputFocusShadow: '0 0 0 0.2rem var(--bb-control-focus-ring)',
  spacing: 6,
  borderRadius: 6,
  wrapperBorderRadius: 10,
  pinnedRowBorder: '2px solid var(--bb-accent)',
  pinnedColumnBorder: '2px solid var(--bb-accent)',
} as const;

export const GRID_LIGHT_THEME = themeQuartz.withPart(iconSetQuartzLight).withParams({
  ...GRID_PARAMS_SHARED,
  browserColorScheme: 'light',
});

export const GRID_DARK_THEME = themeQuartz.withPart(iconSetQuartzLight).withParams({
  ...GRID_PARAMS_SHARED,
  browserColorScheme: 'dark',
});

export const GRID_SHARED_OPTIONS: GridOptions = {
  enableBrowserTooltips: false,
  tooltipShowDelay: 500,
  tooltipShowMode: 'whenTruncated',
  suppressCellFocus: true,
  columnHoverHighlight: false,
  tooltipMouseTrack: true,
  preventDefaultOnContextMenu: true,
  suppressContextMenu: true,
};
