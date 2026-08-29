import {
  StatTileConfig,
  TorrentListConfig,
  WidgetConfig,
  WidgetTypeId,
} from '../../models/dashboard.model';

export interface WidgetCatalogMeta {
  id: WidgetTypeId;
  labelKey: string;
  componentSelector: string;
  defaultConfig: WidgetConfig;
  defaultSize: { w: number; h: number };
}

export const WIDGET_CATALOG: Record<WidgetTypeId, WidgetCatalogMeta> = {
  'stat-tile': {
    id: 'stat-tile',
    labelKey: 'pages.dashboard.catalog.stat-tile',
    componentSelector: 'app-stat-tile',
    defaultConfig: { metric: 'download_speed' } satisfies StatTileConfig,
    defaultSize: { w: 3, h: 2 },
  },
  'torrent-list': {
    id: 'torrent-list',
    labelKey: 'pages.dashboard.catalog.torrent-list',
    componentSelector: 'app-torrent-list-widget',
    defaultConfig: {
      count: 5,
      sortField: 'ratio',
      sortOrder: 'desc',
      columns: ['name', 'ratio'],
    } satisfies TorrentListConfig,
    defaultSize: { w: 6, h: 4 },
  },
};
