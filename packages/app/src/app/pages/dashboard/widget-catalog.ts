import type { IconDefinition } from '@fortawesome/fontawesome-svg-core';
import {
  faChartColumn,
  faChartPie,
  faDownload,
  faHashtag,
  faTable,
} from '@fortawesome/free-solid-svg-icons';
import {
  ActiveDownloadsConfig,
  BarChartConfig,
  PieChartConfig,
  StatTileConfig,
  TorrentListConfig,
  WidgetChartType,
  WidgetConfig,
  WidgetTypeId,
} from '../../models/dashboard.model';

export interface WidgetCatalogMeta {
  id: WidgetTypeId;
  labelKey: string;
  chartType: WidgetChartType;
  icon: IconDefinition;
  componentSelector: string;
  defaultConfig: WidgetConfig;
  defaultSize: { w: number; h: number };
}

export const WIDGET_CATALOG: Record<WidgetTypeId, WidgetCatalogMeta> = {
  'stat-tile': {
    id: 'stat-tile',
    labelKey: 'pages.dashboard.catalog.stat-tile',
    chartType: 'number',
    icon: faHashtag,
    componentSelector: 'app-stat-tile',
    defaultConfig: { metric: 'download_speed' } satisfies StatTileConfig,
    defaultSize: { w: 3, h: 2 },
  },
  'torrent-list': {
    id: 'torrent-list',
    labelKey: 'pages.dashboard.catalog.torrent-list',
    chartType: 'table',
    icon: faTable,
    componentSelector: 'app-torrent-list-widget',
    defaultConfig: {
      count: 5,
      sortField: 'name',
      sortOrder: 'asc',
      columns: ['name'],
    } satisfies TorrentListConfig,
    defaultSize: { w: 6, h: 4 },
  },
  'pie-chart': {
    id: 'pie-chart',
    labelKey: 'pages.dashboard.catalog.pie-chart',
    chartType: 'pie',
    icon: faChartPie,
    componentSelector: 'app-pie-chart-widget',
    defaultConfig: { groupBy: 'state' } satisfies PieChartConfig,
    defaultSize: { w: 4, h: 4 },
  },
  'bar-chart': {
    id: 'bar-chart',
    labelKey: 'pages.dashboard.catalog.bar-chart',
    chartType: 'column',
    icon: faChartColumn,
    componentSelector: 'app-bar-chart-widget',
    defaultConfig: { field: 'state' } satisfies BarChartConfig,
    defaultSize: { w: 4, h: 4 },
  },
  'active-downloads': {
    id: 'active-downloads',
    labelKey: 'pages.dashboard.catalog.active-downloads',
    chartType: 'table',
    icon: faDownload,
    componentSelector: 'app-active-downloads-widget',
    defaultConfig: { count: 5 } satisfies ActiveDownloadsConfig,
    defaultSize: { w: 6, h: 4 },
  },
};
