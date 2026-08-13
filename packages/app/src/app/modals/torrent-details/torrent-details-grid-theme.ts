import { GRID_DARK_THEME, GRID_LIGHT_THEME } from '../../app.const';

const TORRENT_DETAILS_GRID_PARAMS = {
  borderRadius: 10,
  wrapperBorderRadius: 10,
  rowHeight: 40,
  headerHeight: 38,
  headerFontSize: 11,
  spacing: 7,
} as const;

export const TORRENT_DETAILS_GRID_LIGHT_THEME = GRID_LIGHT_THEME.withParams(
  TORRENT_DETAILS_GRID_PARAMS,
);

export const TORRENT_DETAILS_GRID_DARK_THEME = GRID_DARK_THEME.withParams(
  TORRENT_DETAILS_GRID_PARAMS,
);
