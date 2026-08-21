import { GridOptions, iconSetQuartzLight, themeQuartz } from 'ag-grid-community';

export const API_URL = '/api/v2';

export const INVALID_FILENAME_CHARS = /^[^<>:"/\\|?*\x00-\x1f]+$/;

const GRID_PARAMS_SHARED = {
  fontFamily: 'inherit',
  accentColor: 'var(--bb-accent)',
  backgroundColor: 'var(--bs-body-bg)',
  chromeBackgroundColor: 'var(--bs-card-bg)',
  foregroundColor: 'var(--bs-body-color)',
  headerBackgroundColor: 'var(--bs-body-bg)',
  headerTextColor: 'var(--bb-control-placeholder)',
  headerFontSize: 10.5,
  headerFontWeight: 700,
  headerVerticalPaddingScale: 1.05,
  borderColor: 'var(--bs-border-color)',
  rowHeight: 44,
  headerHeight: 40,
  oddRowBackgroundColor: 'transparent',
  rowHoverColor: 'var(--bb-grid-row-hover-bg)',
  selectedRowBackgroundColor: 'color-mix(in srgb, var(--bb-accent) 9%, transparent)',
  rangeSelectionBackgroundColor: 'color-mix(in srgb, var(--bb-accent) 14%, transparent)',
  inputBorder: 'var(--bb-control-border)',
  inputFocusBorder: 'var(--bb-control-focus-border)',
  inputFocusShadow: '0 0 0 0.2rem var(--bb-control-focus-ring)',
  spacing: 6,
  borderRadius: 0,
  wrapperBorderRadius: 0,
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

export const GRID_ROW_MUTED_CLASS = 'text-secondary bg-secondary-subtle bb-row-paused';

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
